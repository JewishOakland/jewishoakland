/* The Zadik Hall: booking rules and pricing. Pure functions, no DOM.
   Times are minutes after midnight. Dates are 'YYYY-MM-DD' in venue local time. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BookingRules = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CONFIG = {
    earliestStart: 8 * 60,     // no event starts before 8:00 AM
    latestEnd: 23 * 60,        // no event ends after 11:00 PM
    slotMinutes: 30,           // start times are on the half hour
    minHours: 2,
    gapHours: 6,               // minimum gap between events on the same day
    eveningAfter: 18 * 60,     // an event that ends after 6:00 PM is an evening event
    nextDayStart: 12 * 60,     // after an evening event, nothing starts before noon the next day
    shabbatOpensAt: 18 * 60,   // on Saturday, nothing starts before 6:00 PM or before Shabbat ends, whichever is later
    weekendDays: [5, 6, 0],    // Friday, Saturday night and Sunday use the weekend rate (0 = Sunday, 6 = Saturday)
    packages: {
      weekday: { label: 'Weekday Event', base: 650, included: 5, extra: 125 },
      weekend: { label: 'Weekend Event', base: 850, included: 5, extra: 175 },
      extended: { label: 'Extended Event', base: 1200, included: 8, extra: 175 }
    },
    reservationShare: 0.5,     // 50% reservation payment secures the date
    securityDeposit: 500
  };

  var MESSAGES = {
    window: 'Events run between 8:00 AM and 11:00 PM.',
    slot: 'Start times are on the half hour.',
    duration: 'Events must be at least 2 hours long.',
    overlap: 'That time overlaps an existing reservation.',
    gap: 'There must be at least 6 hours between events.',
    evening: 'After an evening event, the next event can start at noon the following day at the earliest.',
    closed: 'The hall is closed on this day.',
    hours: 'On this day, events can run from {from} to {to}.'
  };

  function dayNumber(dateStr) {
    var p = dateStr.split('-').map(Number);
    return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000);
  }

  // Absolute minutes from a fixed origin, so events on different days compare correctly.
  function at(dateStr, minutes) {
    return dayNumber(dateStr) * 1440 + minutes;
  }

  function weekdayOf(dateStr) {
    return new Date(dayNumber(dateStr) * 86400000).getUTCDay();
  }

  function addDays(dateStr, n) {
    return new Date((dayNumber(dateStr) + n) * 86400000).toISOString().slice(0, 10);
  }

  function isEvening(b) {
    return b.end > CONFIG.eveningAfter;
  }

  // Checks two reservations against each other. Returns null if they can coexist, or a reason key.
  function conflict(a, b) {
    var aStart = at(a.date, a.start), aEnd = at(a.date, a.end);
    var bStart = at(b.date, b.start), bEnd = at(b.date, b.end);
    if (aStart < bEnd && bStart < aEnd) return 'overlap';

    var first = aStart < bStart ? a : b;
    var second = first === a ? b : a;
    var firstEnd = at(first.date, first.end);
    var secondStart = at(second.date, second.start);

    if (isEvening(first)) {
      var noonAfter = at(addDays(first.date, 1), CONFIG.nextDayStart);
      if (secondStart < noonAfter) return 'evening';
    }
    if (secondStart - firstEnd < CONFIG.gapHours * 60) return 'gap';
    return null;
  }

  function roundUp(minutes) { return Math.ceil(minutes / CONFIG.slotMinutes) * CONFIG.slotMinutes; }
  function roundDown(minutes) { return Math.floor(minutes / CONFIG.slotMinutes) * CONFIG.slotMinutes; }

  // When the hall can be used on a day, given that day's calendar information:
  // { weekday, holidayMajor, holiday, candles, havdalah, nextHolidayMajor } (times in minutes).
  // Yom Tov is closed all day. Saturday opens at 6:00 PM or after Shabbat ends, whichever is later.
  // The day before Yom Tov closes at candle lighting. Friday candle lighting is for information only.
  function windowFor(day) {
    var w = { earliest: CONFIG.earliestStart, latest: CONFIG.latestEnd, closed: false, note: null };
    if (day.holidayMajor) {
      w.closed = true;
      w.note = (day.holiday || 'Yom Tov') + ': closed';
      return w;
    }
    if (day.weekday === 6) {
      var opens = CONFIG.shabbatOpensAt;
      if (day.havdalah != null) opens = Math.max(opens, roundUp(day.havdalah));
      w.earliest = Math.max(w.earliest, opens);
      w.note = 'Shabbat: open from ' + formatTime(w.earliest);
    }
    if (day.nextHolidayMajor && day.candles != null) {
      w.latest = Math.min(w.latest, roundDown(day.candles));
      w.note = 'Erev Yom Tov: events end by ' + formatTime(w.latest);
    }
    if (w.latest - w.earliest < CONFIG.minHours * 60) {
      w.closed = true;
      w.note = day.weekday === 6 ? 'Shabbat: closed' : (w.note ? w.note.split(':')[0] + ': closed' : 'Closed');
    }
    return w;
  }

  // Checks one requested reservation against a list of existing reservations,
  // and against the day's opening window if one is given.
  function validateBooking(request, existing, window) {
    if (window) {
      if (window.closed) return { ok: false, reason: 'closed', message: MESSAGES.closed };
      if (request.start < window.earliest || request.end > window.latest) {
        return {
          ok: false, reason: 'hours',
          message: MESSAGES.hours.replace('{from}', formatTime(window.earliest)).replace('{to}', formatTime(window.latest))
        };
      }
    }
    if (request.start < CONFIG.earliestStart || request.end > CONFIG.latestEnd || request.end <= request.start) {
      return { ok: false, reason: 'window', message: MESSAGES.window };
    }
    if (request.start % CONFIG.slotMinutes !== 0) {
      return { ok: false, reason: 'slot', message: MESSAGES.slot };
    }
    if ((request.end - request.start) / 60 < CONFIG.minHours) {
      return { ok: false, reason: 'duration', message: MESSAGES.duration };
    }
    for (var i = 0; i < existing.length; i++) {
      var reason = conflict(request, existing[i]);
      if (reason) {
        // Only report reservations that are close enough to matter for this date.
        if (Math.abs(dayNumber(existing[i].date) - dayNumber(request.date)) <= 1) {
          return { ok: false, reason: reason, message: MESSAGES[reason] };
        }
      }
    }
    return { ok: true };
  }

  // Which packages can be chosen for this date
  function optionsFor(dateStr) {
    var wd = weekdayOf(dateStr);
    var keys = [];
    if (wd >= 1 && wd <= 4) keys.push('weekday');
    if (CONFIG.weekendDays.indexOf(wd) !== -1) keys.push('weekend');
    keys.push('extended');
    return { packages: keys };
  }

  function priceFor(packageKey, start, end) {
    var pkg = CONFIG.packages[packageKey];
    var hours = (end - start) / 60;
    var extraHours = Math.max(0, Math.ceil(hours - pkg.included));
    var extraCost = extraHours * pkg.extra;
    return {
      packageKey: packageKey,
      label: pkg.label,
      hours: hours,
      base: pkg.base,
      includedHours: pkg.included,
      extraHours: extraHours,
      extraRate: pkg.extra,
      extraCost: extraCost,
      total: pkg.base + extraCost
    };
  }

  function reservationTerms(total, dateStr) {
    return {
      total: total,
      reservationPayment: Math.round(total * CONFIG.reservationShare),
      balanceDue: addDays(dateStr, -14),
      securityDeposit: CONFIG.securityDeposit
    };
  }

  function formatTime(minutes) {
    var h = Math.floor(minutes / 60), m = minutes % 60;
    var suffix = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + (m ? ':' + (m < 10 ? '0' : '') + m : ':00') + ' ' + suffix;
  }

  return {
    CONFIG: CONFIG,
    MESSAGES: MESSAGES,
    dayNumber: dayNumber,
    addDays: addDays,
    weekdayOf: weekdayOf,
    conflict: conflict,
    validateBooking: validateBooking,
    windowFor: windowFor,
    optionsFor: optionsFor,
    priceFor: priceFor,
    reservationTerms: reservationTerms,
    formatTime: formatTime
  };
});
