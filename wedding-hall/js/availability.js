/* The Zadik Hall: availability calendar and reservation request form.
   Needs js/booking-rules.js and js/hebrew-calendar.js to be loaded first.

   Hebrew dates, holidays, parashah and Shabbat times are calculated by js/hebrew-calendar.js.
   Reserved dates come from loadReservations(), which is not connected to a shared store yet,
   so no date is marked reserved until it is. */
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
  var submitAllowed = false;

  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function keyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function money(n) { return '$' + n.toLocaleString('en-US'); }

  // Live reservations. Connect this to the venue's booking store, returning
  // [{ date: 'YYYY-MM-DD', start: minutes, end: minutes }] for the range. Until then, nothing is reserved.
  function loadReservations(fromKey, toKey) {
    return Promise.resolve([]);
  }

  function ensureReservations() {
    var first = new Date(view.year, view.month, 1);
    var last = new Date(view.year, view.month + 1, 0);
    return loadReservations(keyOf(new Date(first.getTime() - 86400000)), keyOf(new Date(last.getTime() + 86400000)))
      .then(function (list) { reservations = list || []; });
  }

  // Bookings made within 14 days of the event owe the full fee and deposit up front.
  // Otherwise 50% now and the balance 14 days before the event.
  function paymentNote(date, total) {
    var terms = R.reservationTerms(total, date);
    var daysAway = R.dayNumber(date) - R.dayNumber(todayKey);
    if (daysAway <= 14) {
      return 'Booking within 14 days of the event: the full rental fee of ' + money(total) +
        ' and the ' + money(terms.securityDeposit) + ' refundable security deposit are due when you book.';
    }
    var due = new Date(terms.balanceDue + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return 'Reservation payment (50%): ' + money(terms.reservationPayment) +
      '. Refundable security deposit: ' + money(terms.securityDeposit) +
      '. Balance due by ' + due + '.';
  }

  function dayCell(year, month, d) {
    var date = new Date(year, month, d);
    var key = keyOf(date);
    var info = H.dayInfo(key);
    var booked = reservations.some(function (r) { return r.date === key; });
    var past = key < todayKey;
    var needsApproval = info.weekday === 6 || info.holidayMajor;

    var cls = 'cal-day';
    if (past) cls += ' is-past';
    if (booked) cls += ' is-booked';
    else if (needsApproval) cls += ' is-approval';
    else if (!past) cls += ' is-open';
    if (key === $('date').value) cls += ' is-selected';

    var selectable = !past && !booked;
    var cell = el(selectable ? 'button' : 'div', cls);
    if (selectable) {
      cell.type = 'button';
      cell.setAttribute('aria-label', date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
      cell.addEventListener('click', function () { choose(key); });
    }

    cell.appendChild(el('span', 'cal-num', String(d)));
    var heb = d === 1 ? info.hebrew.month + ' ' + info.hebrewNumeral : info.hebrewNumeral;
    cell.appendChild(el('span', 'cal-heb', heb));
    if (booked) cell.appendChild(el('span', 'cal-note', 'Reserved'));
    if (info.holiday && !booked) cell.appendChild(el('span', 'cal-note', info.holiday));
    if (info.weekday === 5 && info.candlesText) cell.appendChild(el('span', 'cal-note', 'Candles ' + info.candlesText));
    if (info.weekday === 6) {
      if (info.parsha) cell.appendChild(el('span', 'cal-note cal-parsha', 'Parashat ' + info.parsha));
      if (info.havdalahText) cell.appendChild(el('span', 'cal-note', 'Ends ' + info.havdalahText));
      if (!booked) cell.appendChild(el('span', 'cal-note cal-approval-note', 'Approval needed'));
    }
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
    refreshMonth();
  }

  function refreshMonth() {
    render();
    ensureReservations().then(function () { render(); refresh(); });
  }

  function choose(key) {
    $('date').value = key;
    var d = new Date(key + 'T12:00:00');
    view.year = d.getFullYear();
    view.month = d.getMonth();
    render();
    refresh();
    $('enquire').scrollIntoView({ behavior: 'smooth' });
  }

  // Start and length choices
  function fillTimes() {
    var start = $('start');
    for (var t = R.CONFIG.earliestStart; t + R.CONFIG.minHours * 60 <= R.CONFIG.latestEnd; t += R.CONFIG.slotMinutes) {
      start.appendChild(new Option(R.formatTime(t), String(t)));
    }
    start.value = String(9 * 60);
    var hours = $('hours');
    for (var h = R.CONFIG.minHours; h <= 12; h++) {
      hours.appendChild(new Option(h + (h === 1 ? ' hour' : ' hours'), String(h)));
    }
    hours.value = '5';
  }

  function fillPackages(keys) {
    var select = $('package');
    var previous = select.value;
    select.textContent = '';
    keys.forEach(function (k) { select.appendChild(new Option(R.CONFIG.packages[k].label, k)); });
    select.value = keys.indexOf(previous) !== -1 ? previous : keys[0];
  }

  // A Friday event that runs past candle lighting needs approval
  function overlapsShabbat(date, endMin) {
    var info = H.dayInfo(date);
    return info.weekday === 5 && info.candles != null && endMin > info.candles;
  }

  function refresh() {
    var date = $('date').value;
    var box = $('price');
    var submit = $('enquiry').querySelector('button[type="submit"]');
    box.textContent = '';
    submitAllowed = false;

    if (!date) {
      box.appendChild(el('p', 'price-hint', 'Choose a date to see the times available and the price.'));
      submit.disabled = false;
      return;
    }

    var startMin = Number($('start').value);
    var endMin = startMin + Number($('hours').value) * 60;
    var info = H.dayInfo(date);
    var opts = R.optionsFor(date, { holiday: info.holidayMajor, shabbatOverlap: overlapsShabbat(date, endMin) });
    fillPackages(opts.packages);

    var check = R.validateBooking({ date: date, start: startMin, end: endMin }, reservations);
    if (!check.ok) {
      box.appendChild(el('p', 'price-error', check.message));
      submit.disabled = true;
      return;
    }

    var price = R.priceFor($('package').value, startMin, endMin);

    box.appendChild(el('p', 'price-title', price.label + ' · ' + R.formatTime(startMin) + ' to ' + R.formatTime(endMin)));
    var lines = [['Base package (' + price.includedHours + ' hours)', money(price.base)]];
    if (price.extraHours > 0) {
      lines.push([price.extraHours + (price.extraHours === 1 ? ' additional hour' : ' additional hours') + ' at ' + money(price.extraRate) + ' each', money(price.extraCost)]);
    }
    lines.push(['Total', money(price.total)]);
    lines.forEach(function (line, i) {
      var row = el('div', 'price-row' + (i === lines.length - 1 ? ' is-total' : ''));
      row.appendChild(el('span', null, line[0]));
      row.appendChild(el('span', null, line[1]));
      box.appendChild(row);
    });
    box.appendChild(el('p', 'price-note', paymentNote(date, price.total)));
    if (opts.needsApproval) {
      box.appendChild(el('p', 'price-note', 'This date needs approval from the office before it is confirmed.'));
    }
    submitAllowed = true;
    submit.disabled = false;
  }

  function onSubmit(e) {
    e.preventDefault();
    refresh();
    if (!submitAllowed) return;

    var data = new FormData(e.target);
    var date = data.get('date');
    var startMin = Number(data.get('start'));
    var endMin = startMin + Number(data.get('hours')) * 60;
    var price = R.priceFor(data.get('package'), startMin, endMin);
    var info = H.dayInfo(date);
    var approval = R.optionsFor(date, { holiday: info.holidayMajor, shabbatOverlap: overlapsShabbat(date, endMin) }).needsApproval;

    var body = [
      'Names: ' + data.get('names'),
      'Email: ' + data.get('email'),
      'Phone: ' + (data.get('phone') || '-'),
      'Celebration: ' + data.get('celebration'),
      'Date: ' + date + ' (' + info.hebrewNumeral + ' ' + info.hebrew.month + ' ' + info.hebrew.year + ')',
      'Time: ' + R.formatTime(startMin) + ' to ' + R.formatTime(endMin) + ' (' + price.hours + ' hours)',
      'Package: ' + price.label + ' ' + money(price.total),
      paymentNote(date, price.total),
      'Expected guests: ' + (data.get('guests') || '-'),
      'Would like to start with: ' + data.get('visit'),
      approval ? 'Note: this date needs approval from the office.' : '',
      '',
      'Please confirm this date and time. Nothing is booked until it is confirmed.',
      '',
      data.get('message') || ''
    ].join('\n');
    var subject = 'Booking request: ' + data.get('celebration') + ', ' + date + ' (' + data.get('names') + ')';
    window.location.href = 'mailto:' + ENQUIRY_EMAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  }

  function init() {
    $('date').min = todayKey;
    fillTimes();
    $('cal-prev').addEventListener('click', function () { moveMonth(-1); });
    $('cal-next').addEventListener('click', function () { moveMonth(1); });
    ['date', 'start', 'hours', 'package'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        if (id === 'date') render();
        refresh();
      });
    });
    $('enquiry').addEventListener('submit', onSubmit);
    refreshMonth();
  }

  init();
})();
