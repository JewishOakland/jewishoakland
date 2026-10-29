/* The Zadik Hall: availability calendar and enquiry form (Plan Your Event page).
   Needs js/booking-rules.js and js/hebrew-calendar.js to be loaded first.

   The calendar is a guide. Shabbat and Yom Tov availability is confirmed by the office, and
   no date is reserved until the office confirms it. Reserved dates come from loadReservations(),
   which is not connected to a shared store yet, so no date is marked reserved until it is. */
(function () {
  'use strict';

  var R = window.BookingRules;
  var H = window.HebrewCalendar;
  var ENQUIRY_EMAIL = 'info@jewishoakland.org';

  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var now = new Date();
  var todayKey = keyOf(now);
  var view = { year: now.getFullYear(), month: now.getMonth() };
  var reservations = [];     // [{ date, start, end }] in minutes

  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function keyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  // Live reservations. Connect this to the venue's booking store, returning
  // [{ date: 'YYYY-MM-DD', start: minutes, end: minutes }] for the range. Until then, nothing is reserved.
  function loadReservations(fromKey, toKey) {
    return Promise.resolve([]);
  }

  function ensureReservations() {
    var first = new Date(view.year, view.month, 1);
    var last = new Date(view.year, view.month + 1, 0);
    return loadReservations(keyOf(first), keyOf(last)).then(function (list) { reservations = list || []; });
  }

  // Days whose availability depends on Shabbat or Yom Tov, which the office confirms
  function askOffice(info) {
    return info.weekday === 6 || info.holidayMajor || info.nextHolidayMajor;
  }

  function dayCell(year, month, d) {
    var date = new Date(year, month, d);
    var key = keyOf(date);
    var info = H.dayInfo(key);
    var w = R.windowFor(info);
    var booked = reservations.some(function (r) { return r.date === key; });
    var past = key < todayKey;
    var limited = !w.closed && (w.earliest > R.CONFIG.earliestStart || w.latest < R.CONFIG.latestEnd);

    var cls = 'cal-day';
    if (past) cls += ' is-past';
    if (booked) cls += ' is-booked';
    else if (w.closed) cls += ' is-closed';
    else if (limited) cls += ' is-limited';
    else if (!past) cls += ' is-open';
    if (key === $('date').value) cls += ' is-selected';

    var selectable = !past && !booked && !w.closed;
    var cell = el(selectable ? 'button' : 'div', cls);
    if (selectable) {
      cell.type = 'button';
      cell.setAttribute('aria-label', date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) +
        (w.note ? '. ' + w.note : '') + (askOffice(info) ? '. Check with the office' : ''));
      cell.addEventListener('click', function () { choose(key); });
    }

    cell.appendChild(el('span', 'cal-num', String(d)));
    cell.appendChild(el('span', 'cal-heb', d === 1 ? info.hebrew.month + ' ' + info.hebrewNumeral : info.hebrewNumeral));
    if (info.holiday && !info.holidayMajor) cell.appendChild(el('span', 'cal-note', info.holiday));
    if (info.weekday === 6 && info.parsha) cell.appendChild(el('span', 'cal-note cal-parsha', 'Parashat ' + info.parsha));
    if ((info.weekday === 5 || info.nextHolidayMajor) && !info.holidayMajor && info.weekday !== 6) {
      cell.appendChild(el('span', 'cal-note', 'Candles ' + info.candlesText));
    }
    if (info.weekday === 6 && !info.holidayMajor) cell.appendChild(el('span', 'cal-note', 'Shabbat ends ' + info.havdalahText));
    if (booked) cell.appendChild(el('span', 'cal-note cal-status', 'Reserved'));
    else if (w.note) cell.appendChild(el('span', 'cal-note cal-status', w.note));
    if (!booked && !past && askOffice(info)) cell.appendChild(el('span', 'cal-note', 'Check with the office'));
    return cell;
  }

  function hebrewRange(year, month, count) {
    var first = H.dayInfo(keyOf(new Date(year, month, 1))).hebrew;
    var last = H.dayInfo(keyOf(new Date(year, month, count))).hebrew;
    var a = first.month + ' ' + first.year, b = last.month + ' ' + last.year;
    return a === b ? a : a + ' to ' + b;
  }

  function render() {
    var first = new Date(view.year, view.month, 1);
    var count = new Date(view.year, view.month + 1, 0).getDate();
    $('cal-month').textContent = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    $('cal-hebrew').textContent = hebrewRange(view.year, view.month, count);

    var grid = $('cal-grid');
    grid.textContent = '';
    WEEKDAYS.forEach(function (name) { grid.appendChild(el('div', 'cal-dow', name)); });
    for (var b = 0; b < first.getDay(); b++) grid.appendChild(el('div', 'cal-blank'));
    for (var d = 1; d <= count; d++) grid.appendChild(dayCell(view.year, view.month, d));
  }

  function moveMonth(step) {
    var next = new Date(view.year, view.month + step, 1);
    view.year = next.getFullYear();
    view.month = next.getMonth();
    render();
    ensureReservations().then(render);
  }

  // A short note under the date field about the chosen day
  function describeDate() {
    var date = $('date').value;
    var note = $('date-note');
    if (!date) { note.textContent = ''; return; }
    var info = H.dayInfo(date);
    var w = R.windowFor(info);
    var parts = [];
    if (w.note) parts.push(w.note + '.');
    if (askOffice(info)) parts.push('Shabbat and Yom Tov availability is confirmed by the office.');
    note.textContent = parts.join(' ');
  }

  function choose(key) {
    $('date').value = key;
    var d = new Date(key + 'T12:00:00');
    view.year = d.getFullYear();
    view.month = d.getMonth();
    render();
    describeDate();
    $('enquire').scrollIntoView({ behavior: 'smooth' });
    $('names').focus({ preventScroll: true });
  }

  function onSubmit(e) {
    e.preventDefault();
    var form = e.target;
    if (!form.reportValidity()) return;
    var data = new FormData(form);
    var date = data.get('date');
    var dateLine = 'Preferred date: flexible';
    if (date) {
      var info = H.dayInfo(date);
      var pretty = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      dateLine = 'Preferred date: ' + pretty + ' (' + info.hebrewNumeral + ' ' + info.hebrew.month + ' ' + info.hebrew.year + ')';
    }
    var body = [
      'Name: ' + data.get('names'),
      'Email: ' + data.get('email'),
      'Phone: ' + (data.get('phone') || '-'),
      'Event type: ' + data.get('type'),
      dateLine,
      'Guest count: ' + (data.get('guests') || '-'),
      '',
      'Please let me know if this date is available. I understand the date is not reserved until the office confirms it.'
    ].join('\n');
    var subject = 'Hall enquiry: ' + data.get('type') + (date ? ', ' + date : '') + ' (' + data.get('names') + ')';
    window.location.href = 'mailto:' + ENQUIRY_EMAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  }

  function init() {
    $('date').min = todayKey;
    $('cal-prev').addEventListener('click', function () { moveMonth(-1); });
    $('cal-next').addEventListener('click', function () { moveMonth(1); });
    $('date').addEventListener('change', function () {
      if ($('date').value) {
        var d = new Date($('date').value + 'T12:00:00');
        view.year = d.getFullYear();
        view.month = d.getMonth();
      }
      render();
      describeDate();
    });
    $('enquiry').addEventListener('submit', onSubmit);
    render();
    ensureReservations().then(render);
  }

  init();
})();
