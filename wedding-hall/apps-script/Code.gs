/* The Zadik Hall: enquiry and approval service.

   A Google Apps Script web app attached to a Google Sheet. It:
   - receives enquiries from the website form and saves them to the sheet as Pending,
   - emails the office a link to review each enquiry and approve or decline it,
   - lists approved dates, so the website calendar marks them Reserved.

   Any row in the sheet with Status "Approved" and a Date blocks that date on the calendar,
   so dates can also be blocked or released by editing the sheet. Setup steps are in README.md. */

var CONFIG = {
  NOTIFY_EMAIL: 'info@jewishoakland.org',  // receives every enquiry and approves it
  HALL_NAME: 'The Zadik Hall',
  OFFICE_PHONE: '510.545.6770',
  SEND_ACKNOWLEDGEMENT: false,             // true also emails the visitor a short "we received it" note
  SHEET_NAME: 'Enquiries',
  CACHE_SECONDS: 60                        // how long the calendar's list of dates is cached
};

var HEADERS = ['ID', 'Token', 'Received', 'Status', 'Decided', 'Date', 'Hebrew date', 'Event type',
  'Name', 'Email', 'Phone', 'Guests', 'Confirmed'];
var COL = {};
HEADERS.forEach(function (h, i) { COL[h] = i; });

var EVENT_TYPES = ['Wedding', 'Bar or Bas Mitzvah', 'Bris', 'Sheva Brachos', 'Something else'];
var STATUS = { pending: 'Pending', approved: 'Approved', declined: 'Declined' };
var REQUIRED_CONFIRMATIONS = 5;

// ---------------------------------------------------------------- Web app entry points

// The website form posts the enquiry as JSON
function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'The enquiry could not be read.' });
  }
  return json_(saveEnquiry_(data));
}

// ?action=reserved  approved dates for the calendar
// ?action=review    the page the office uses to approve or decline one enquiry
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'reserved') return json_({ ok: true, reserved: reservedDates_() });
  if (p.action === 'review') return reviewPage_(p.id, p.token);
  return json_({ ok: true, service: CONFIG.HALL_NAME + ' enquiries' });
}

// Called by the Approve and Decline buttons on the review page
function decide(id, token, decision) {
  if ([STATUS.approved, STATUS.declined, STATUS.pending].indexOf(decision) === -1) {
    return { ok: false, error: 'Unknown decision.' };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var found = findRow_(id);
    if (!found || String(found.values[COL.Token]) !== String(token)) {
      return { ok: false, error: 'This link is not valid.' };
    }
    var sheet = sheet_();
    sheet.getRange(found.row, COL.Status + 1).setValue(decision);
    sheet.getRange(found.row, COL.Decided + 1).setValue(new Date());
    CacheService.getScriptCache().remove('reserved');
    return { ok: true, status: decision };
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------- Enquiries

function saveEnquiry_(data) {
  data = data || {};
  if (data.website) return { ok: true };   // the hidden field was filled in, so it's a bot: ignore quietly
  var clean = validate_(data);
  if (clean.error) return { ok: false, error: clean.error };

  var id = Utilities.getUuid().split('-')[0];
  var token = Utilities.getUuid();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet_().appendRow([
      id, token, new Date(), STATUS.pending, '',
      text_(clean.date), text_(clean.hebrewDate), text_(clean.type),
      text_(clean.name), text_(clean.email), text_(clean.phone), text_(clean.guests),
      text_(clean.confirmed.join('; '))
    ]);
  } finally {
    lock.releaseLock();
  }

  notifyOffice_(id, token, clean);
  if (CONFIG.SEND_ACKNOWLEDGEMENT) acknowledge_(clean);
  return { ok: true, id: id };
}

function validate_(d) {
  function s(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }
  var out = {
    name: s(d.name, 120),
    email: s(d.email, 200),
    phone: s(d.phone, 40),
    type: s(d.type, 40),
    date: s(d.date, 10),
    hebrewDate: s(d.hebrewDate, 60),
    guests: s(d.guests, 6)
  };
  if (!out.name) return { error: 'Please give your name.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) return { error: 'Please give a valid email address.' };
  if (EVENT_TYPES.indexOf(out.type) === -1) out.type = 'Something else';
  if (out.date && !/^\d{4}-\d{2}-\d{2}$/.test(out.date)) return { error: 'Please choose a valid date.' };
  if (out.guests && !/^\d{1,4}$/.test(out.guests)) return { error: 'Please give the guest count as a number.' };
  var confirmed = Array.isArray(d.confirmed) ? d.confirmed.map(function (c) { return s(c, 200); }).filter(String) : [];
  if (confirmed.length < REQUIRED_CONFIRMATIONS) return { error: 'Please confirm you have read the rules.' };
  out.confirmed = confirmed.slice(0, 10);
  return out;
}

// The email to the office, with the review link
function notifyOffice_(id, token, e) {
  var link = reviewUrl_(id, token);
  var clash = e.date && approvedOn_(e.date, id).length > 0;
  var lines = [
    ['Name', e.name], ['Email', e.email], ['Phone', e.phone || '-'], ['Event type', e.type],
    ['Preferred date', e.date ? e.date + (e.hebrewDate ? ' (' + e.hebrewDate + ')' : '') : 'Flexible'],
    ['Guest count', e.guests || '-']
  ];
  var subject = 'New enquiry: ' + e.type + (e.date ? ', ' + e.date : '') + ' (' + e.name + ')';
  var text = 'A new enquiry for ' + CONFIG.HALL_NAME + '.\n\n' +
    lines.map(function (l) { return l[0] + ': ' + l[1]; }).join('\n') +
    (clash ? '\n\nNote: this date is already approved for another event.' : '') +
    '\n\nThe visitor confirmed they have read:\n- ' + e.confirmed.join('\n- ') +
    '\n\nReview, approve or decline: ' + link +
    '\n\nReply to this email to answer the visitor directly.';
  var html = '<p>A new enquiry for ' + esc_(CONFIG.HALL_NAME) + '.</p><table cellpadding="4">' +
    lines.map(function (l) { return '<tr><td><strong>' + esc_(l[0]) + '</strong></td><td>' + esc_(l[1]) + '</td></tr>'; }).join('') +
    '</table>' +
    (clash ? '<p><strong>Note: this date is already approved for another event.</strong></p>' : '') +
    '<p>The visitor confirmed they have read:</p><ul>' +
    e.confirmed.map(function (c) { return '<li>' + esc_(c) + '</li>'; }).join('') + '</ul>' +
    '<p><a href="' + esc_(link) + '">Review, approve or decline this enquiry</a></p>' +
    '<p>Reply to this email to answer the visitor directly.</p>';
  MailApp.sendEmail({ to: CONFIG.NOTIFY_EMAIL, replyTo: e.email, subject: subject, body: text, htmlBody: html, name: CONFIG.HALL_NAME + ' website' });
}

function acknowledge_(e) {
  var text = 'Thank you for your enquiry to ' + CONFIG.HALL_NAME + '.\n\n' +
    'The office will reply about ' + (e.date ? e.date : 'your date') + '. Your date is not reserved until the office ' +
    'confirms it, the rental agreement is signed and the reservation payment is received.\n\n' +
    'Questions? Call ' + CONFIG.OFFICE_PHONE + '.';
  MailApp.sendEmail({ to: e.email, replyTo: CONFIG.NOTIFY_EMAIL, subject: 'We received your enquiry', body: text, name: CONFIG.HALL_NAME });
}

// ---------------------------------------------------------------- Calendar

// Approved dates only. No names or contact details leave the sheet.
function reservedDates_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('reserved');
  if (hit) return JSON.parse(hit);
  var seen = {};
  rows_().forEach(function (r) {
    if (String(r[COL.Status]).trim() !== STATUS.approved) return;
    var date = normalizeDate_(r[COL.Date]);
    if (date) seen[date] = true;
  });
  var list = Object.keys(seen).sort().map(function (d) { return { date: d }; });
  cache.put('reserved', JSON.stringify(list), CONFIG.CACHE_SECONDS);
  return list;
}

// ---------------------------------------------------------------- Review page

function reviewPage_(id, token) {
  var found = id && token ? findRow_(id) : null;
  if (!found || String(found.values[COL.Token]) !== String(token)) {
    return page_('Link not valid', '<h1>This link is not valid</h1><p>Open the review link from the enquiry email again.</p>');
  }
  var r = found.values;
  var date = normalizeDate_(r[COL.Date]);
  var clashes = date ? approvedOn_(date, r[COL.ID]) : [];
  var rows = [
    ['Status', r[COL.Status]], ['Name', r[COL.Name]], ['Email', r[COL.Email]], ['Phone', r[COL.Phone] || '-'],
    ['Event type', r[COL['Event type']]], ['Preferred date', date ? date + (r[COL['Hebrew date']] ? ' (' + r[COL['Hebrew date']] + ')' : '') : 'Flexible'],
    ['Guest count', r[COL.Guests] || '-'], ['Confirmed', r[COL.Confirmed]]
  ];
  var body = '<h1>Enquiry ' + esc_(r[COL.ID]) + '</h1>' +
    (clashes.length ? '<p class="warn">This date is already approved for another enquiry (' + clashes.map(esc_).join(', ') + ').</p>' : '') +
    (date ? '' : '<p class="warn">No date was given, so approving will not block anything on the calendar.</p>') +
    '<table>' + rows.map(function (x) { return '<tr><th>' + esc_(x[0]) + '</th><td id="f-' + esc_(x[0]).replace(/\s/g, '') + '">' + esc_(x[1]) + '</td></tr>'; }).join('') + '</table>' +
    '<p>Approving blocks this date on the website calendar. Declining leaves it open.</p>' +
    '<p><button id="approve">Approve and block the date</button> <button id="decline" class="secondary">Decline</button></p>' +
    '<p id="result" role="status"></p>' +
    '<script>' +
    'var ID = ' + JSON.stringify(String(r[COL.ID])) + ', TOKEN = ' + JSON.stringify(String(token)) + ';' +
    'function go(decision) {' +
    '  document.getElementById("approve").disabled = true; document.getElementById("decline").disabled = true;' +
    '  document.getElementById("result").textContent = "Saving...";' +
    '  google.script.run.withSuccessHandler(function (res) {' +
    '    document.getElementById("result").textContent = res.ok ? "Saved: " + res.status + "." : res.error;' +
    '    if (res.ok) document.getElementById("f-Status").textContent = res.status;' +
    '    document.getElementById("approve").disabled = false; document.getElementById("decline").disabled = false;' +
    '  }).withFailureHandler(function (err) { document.getElementById("result").textContent = "Something went wrong: " + err.message; }).decide(ID, TOKEN, decision);' +
    '}' +
    'document.getElementById("approve").onclick = function () { go("Approved"); };' +
    'document.getElementById("decline").onclick = function () { go("Declined"); };' +
    '</script>';
  return page_('Review enquiry', body);
}

function page_(title, body) {
  var html = '<!doctype html><html><head><base target="_top"><style>' +
    'body{font-family:Georgia,serif;max-width:640px;margin:32px auto;padding:0 16px;color:#2a2420;background:#fbf8f3}' +
    'h1{font-weight:500}table{border-collapse:collapse;width:100%;margin:16px 0}th,td{text-align:left;padding:8px;border-bottom:1px solid #e3d8c5;vertical-align:top}' +
    'th{width:34%;font-family:Arial,sans-serif;font-size:13px;color:#6e6359}' +
    'button{font:600 14px Arial,sans-serif;padding:12px 18px;border:0;background:#2a2420;color:#fff;cursor:pointer;margin:0 8px 8px 0}' +
    'button.secondary{background:#fff;color:#2a2420;border:1px solid #2a2420}button:disabled{opacity:.5}' +
    '.warn{background:#fbf1db;border-left:3px solid #b08a52;padding:10px 12px}' +
    '</style></head><body>' + body + '</body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(title + ' · ' + CONFIG.HALL_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------------------------------------------------------------- Sheet helpers

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function rows_() {
  return sheet_().getDataRange().getValues().slice(1);
}

function findRow_(id) {
  var all = rows_();
  for (var i = 0; i < all.length; i++) {
    if (String(all[i][COL.ID]) === String(id)) return { row: i + 2, values: all[i] };
  }
  return null;
}

// IDs of other approved enquiries on the same date
function approvedOn_(date, exceptId) {
  return rows_().filter(function (r) {
    return String(r[COL.Status]).trim() === STATUS.approved && normalizeDate_(r[COL.Date]) === date && String(r[COL.ID]) !== String(exceptId);
  }).map(function (r) { return String(r[COL.ID] || 'added by hand'); });
}

// Dates typed into the sheet by hand may come back as Date objects
function normalizeDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var s = String(v == null ? '' : v).trim().replace(/^'/, '');
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function reviewUrl_(id, token) {
  return ScriptApp.getService().getUrl() + '?action=review&id=' + encodeURIComponent(id) + '&token=' + encodeURIComponent(token);
}

// Stores visitor text as plain text, so the sheet never treats it as a formula or a number
function text_(v) {
  return v === '' || v == null ? '' : "'" + String(v);
}

function esc_(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
