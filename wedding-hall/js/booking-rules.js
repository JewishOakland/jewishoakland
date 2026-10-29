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
    weekendDays: [5, 0],       // Friday and Sunday use the weekend rate (0 = Sunday, 6 = Saturday)
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
    evening: 'After an evening event, the next event can start at noon the following day at the earliest.'
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

  // Checks one requested reservation against a list of existing reservations.
  function validateBooking(request, existing) {
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

  // Which packages can be chosen for this date. Shabbat (Saturday) and holidays need approval.
  function optionsFor(dateStr, options) {
    var opts = options || {};
    var wd = weekdayOf(dateStr);
    var needsApproval = wd === 6 || !!opts.holiday || !!opts.shabbatOverlap;
    var keys = [];
    if (wd >= 1 && wd <= 4) keys.push('weekday');
    if (CONFIG.weekendDays.indexOf(wd) !== -1) keys.push('weekend');
    keys.push('extended');
    return { packages: keys, needsApproval: needsApproval };
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
    optionsFor: optionsFor,
    priceFor: priceFor,
    reservationTerms: reservationTerms,
    formatTime: formatTime
  };
});
