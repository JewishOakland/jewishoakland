/* The Zadik Hall: our own Hebrew calendar. Calculates Hebrew dates, holidays, the weekly
   parashah, and Shabbat candle-lighting and havdalah times for Oakland. No outside service.

   Dates are day numbers (days since 1970-01-01, UTC) or 'YYYY-MM-DD' strings for the
   Gregorian calendar, and Hebrew dates are { year, month, day }. Times are minutes after midnight
   in Oakland local time. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HebrewCalendar = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CONFIG = {
    latitude: 37.8107,
    longitude: -122.2437,
    candleMinutes: 18,     // lighting this many minutes before sunset
    havdalahMinutes: 42    // havdalah this many minutes after sunset
  };

  // Day number of the Hebrew calendar's epoch offset, fixed so that 1 Tishri 5787 is 2026-09-12.
  var OFFSET = -2092590;

  var MONTHS_COMMON = ['Tishri', 'Heshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Nisan', 'Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul'];
  var MONTHS_LEAP = ['Tishri', 'Heshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar I', 'Adar II', 'Nisan', 'Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul'];

  // Diaspora holidays. "major" days are Yom Tov: the hall is closed and there is no weekly reading.
  var HOLIDAYS = [
    { month: 'Tishri', day: 1, name: 'Rosh Hashanah', major: true },
    { month: 'Tishri', day: 2, name: 'Rosh Hashanah', major: true },
    { month: 'Tishri', day: 3, name: 'Fast of Gedaliah', major: false },
    { month: 'Tishri', day: 10, name: 'Yom Kippur', major: true },
    { month: 'Tishri', day: 15, name: 'Sukkot', major: true },
    { month: 'Tishri', day: 16, name: 'Sukkot', major: true },
    { month: 'Tishri', day: 17, name: 'Sukkot (Chol HaMoed)', major: false, length: 4 },
    { month: 'Tishri', day: 21, name: 'Hoshana Rabbah', major: false },
    { month: 'Tishri', day: 22, name: 'Shmini Atzeret', major: true },
    { month: 'Tishri', day: 23, name: 'Simchat Torah', major: true },
    { month: 'Kislev', day: 25, name: 'Chanukah', major: false, length: 8 },
    { month: 'Shevat', day: 15, name: 'Tu BiShvat', major: false },
    { month: 'Adar', day: 13, name: 'Fast of Esther', major: false },
    { month: 'Adar', day: 14, name: 'Purim', major: false },
    { month: 'Nisan', day: 15, name: 'Pesach', major: true },
    { month: 'Nisan', day: 16, name: 'Pesach', major: true },
    { month: 'Nisan', day: 17, name: 'Pesach (Chol HaMoed)', major: false, length: 4 },
    { month: 'Nisan', day: 21, name: 'Pesach', major: true },
    { month: 'Nisan', day: 22, name: 'Pesach', major: true },
    { month: 'Iyar', day: 18, name: 'Lag BaOmer', major: false },
    { month: 'Sivan', day: 6, name: 'Shavuot', major: true },
    { month: 'Sivan', day: 7, name: 'Shavuot', major: true },
    { month: 'Av', day: 9, name: 'Tisha B\'Av', major: false }
  ];

  // The 54 weekly portions, in order.
  var PORTIONS = [
    'Bereshit', 'Noach', 'Lech-Lecha', 'Vayera', 'Chayei Sara', 'Toldot', 'Vayetze', 'Vayishlach', 'Vayeshev', 'Miketz', 'Vayigash', 'Vayechi',
    'Shemot', 'Vaera', 'Bo', 'Beshalach', 'Yitro', 'Mishpatim', 'Terumah', 'Tetzaveh', 'Ki Tisa', 'Vayakhel', 'Pekudei',
    'Vayikra', 'Tzav', 'Shemini', 'Tazria', 'Metzora', 'Achrei Mot', 'Kedoshim', 'Emor', 'Behar', 'Bechukotai',
    'Bamidbar', 'Naso', 'Behaalotecha', 'Shlach', 'Korach', 'Chukat', 'Balak', 'Pinchas', 'Matot', 'Masei',
    'Devarim', 'Vaetchanan', 'Eikev', 'Reeh', 'Shoftim', 'Ki Teitzei', 'Ki Tavo', 'Nitzavim', 'Vayelech', 'Haazinu',
    'Vezot Haberakhah'
  ];

  // The first 53 portions are read on Shabbat. Vezot Haberakhah is read on Simchat Torah.
  var UNIT_COUNT = 53;

  // Pairs read together in years with fewer weekly readings. Used in this order.
  var COMBINED = [
    ['Vayakhel', 'Pekudei'], ['Tazria', 'Metzora'], ['Achrei Mot', 'Kedoshim'], ['Behar', 'Bechukotai'],
    ['Chukat', 'Balak'], ['Matot', 'Masei'], ['Nitzavim', 'Vayelech']
  ];

  var HEBREW_NUMERALS = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב', 'יג', 'יד', 'טו', 'טז', 'יז', 'יח', 'יט', 'כ',
    'כא', 'כב', 'כג', 'כד', 'כה', 'כו', 'כז', 'כח', 'כט', 'ל'];

  // ---- Gregorian helpers ----

  function dayNumber(dateStr) {
    var p = dateStr.split('-').map(Number);
    return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000);
  }

  function dateKey(n) {
    return new Date(n * 86400000).toISOString().slice(0, 10);
  }

  function weekdayOf(n) {
    return new Date(n * 86400000).getUTCDay();   // 0 = Sunday, 6 = Saturday
  }

  // ---- Hebrew calendar arithmetic ----

  // Days from the epoch to the molad-based new year, before the year-length adjustments
  function elapsedDays(year) {
    var months = Math.floor((235 * year - 234) / 19);
    var parts = 12084 + 13753 * months;
    var days = 29 * months + Math.floor(parts / 25920);
    if ((3 * (days + 1)) % 7 < 3) days += 1;
    return days;
  }

  function newYearDelay(year) {
    var prev = elapsedDays(year - 1), current = elapsedDays(year), next = elapsedDays(year + 1);
    if (next - current === 356) return 2;
    if (current - prev === 382) return 1;
    return 0;
  }

  // Day number of 1 Tishri of the given Hebrew year
  function roshHashanah(year) {
    return elapsedDays(year) + newYearDelay(year) + OFFSET;
  }

  function isLeap(year) {
    return ((7 * year + 1) % 19) < 7;
  }

  function monthNames(year) {
    return isLeap(year) ? MONTHS_LEAP : MONTHS_COMMON;
  }

  function yearLength(year) {
    return roshHashanah(year + 1) - roshHashanah(year);
  }

  function monthLength(year, month) {
    var len = yearLength(year);
    switch (month) {
      case 'Heshvan': return len % 10 === 5 ? 30 : 29;   // complete years
      case 'Kislev': return len % 10 === 3 ? 29 : 30;    // deficient years
      case 'Tevet': return 29;
      case 'Shevat': return 30;
      case 'Adar': return 29;
      case 'Adar I': return 30;
      case 'Adar II': return 29;
      case 'Nisan': return 30;
      case 'Iyar': return 29;
      case 'Sivan': return 30;
      case 'Tamuz': return 29;
      case 'Av': return 30;
      case 'Elul': return 29;
      default: return 30;   // Tishri
    }
  }

  // Hebrew date to day number
  function toDayNumber(hd) {
    var names = monthNames(hd.year), n = roshHashanah(hd.year);
    for (var i = 0; i < names.length && names[i] !== hd.month; i++) n += monthLength(hd.year, names[i]);
    return n + hd.day - 1;
  }

  // Day number to Hebrew date
  function fromDayNumber(n) {
    var year = Math.floor((n - OFFSET) / 365.2468);
    while (roshHashanah(year) > n) year--;
    while (roshHashanah(year + 1) <= n) year++;
    var names = monthNames(year), offset = n - roshHashanah(year), i = 0;
    while (offset >= monthLength(year, names[i])) {
      offset -= monthLength(year, names[i]);
      i++;
    }
    return { year: year, month: names[i], day: offset + 1 };
  }

  function hebrewNumeral(day) {
    return HEBREW_NUMERALS[day] || String(day);
  }

  // Holiday on a day number, if any: { name, major } or null
  function holidayOn(n) {
    var hd = fromDayNumber(n);
    for (var i = 0; i < HOLIDAYS.length; i++) {
      var h = HOLIDAYS[i];
      // In a leap year, the Adar holidays fall in Adar II
      var month = h.month === 'Adar' && isLeap(hd.year) ? 'Adar II' : h.month;
      var start = toDayNumber({ year: hd.year, month: month, day: h.day });
      var span = h.length || 1;
      if (n >= start && n < start + span) return { name: h.name, major: h.major };
    }
    return null;
  }

  // ---- Weekly parashah ----

  var cycleCache = {};

  // Counts the weekly readings in the cycle that begins after Simchat Torah of cycleYear
  function cycle(cycleYear) {
    if (cycleCache[cycleYear]) return cycleCache[cycleYear];
    var start = toDayNumber({ year: cycleYear, month: 'Tishri', day: 23 });
    var end = toDayNumber({ year: cycleYear + 1, month: 'Tishri', day: 23 });
    var readings = 0;
    for (var n = start + 1; n < end; n++) {
      if (weekdayOf(n) === 6 && !(holidayOn(n) && holidayOn(n).major)) readings++;
    }
    cycleCache[cycleYear] = { start: start, end: end, readings: readings, list: buildReadings(readings) };
    return cycleCache[cycleYear];
  }

  // The reading order for a cycle with the given number of weekly readings, with pairs combined as needed
  function buildReadings(count) {
    // A cycle with 54 readings reads every portion once, Vezot Haberakhah last.
    // This is the one rule here that has not been checked against a printed calendar.
    if (count === PORTIONS.length) return PORTIONS.slice();
    var combine = UNIT_COUNT - count;   // pairs to combine so the 53 portions fit into `count` readings
    if (combine < 0 || combine > COMBINED.length) return null;
    var pairs = COMBINED.slice(0, combine).map(function (p) { return p[0]; });
    var list = [];
    for (var i = 0; i < UNIT_COUNT; i++) {
      var name = PORTIONS[i];
      var pair = null;
      for (var j = 0; j < combine; j++) if (COMBINED[j][0] === name) pair = COMBINED[j];
      if (pair) {
        list.push(pair[0] + '-' + pair[1]);
        i++;   // the second half of the pair is read with the first
      } else {
        list.push(name);
      }
    }
    return list;
  }

  // Parashah read on a Saturday, or null for Yom Tov Shabbatot and dates with no reading
  function parashaOn(n) {
    if (weekdayOf(n) !== 6) return null;
    var hol = holidayOn(n);
    if (hol && hol.major) return null;
    var hd = fromDayNumber(n);
    var cycleYear = n >= toDayNumber({ year: hd.year, month: 'Tishri', day: 23 }) ? hd.year : hd.year - 1;
    var c = cycle(cycleYear);
    if (!c.list) return null;
    var index = 0;
    for (var m = c.start + 1; m < n; m++) {
      if (weekdayOf(m) === 6 && !(holidayOn(m) && holidayOn(m).major)) index++;
    }
    return c.list[index] || null;
  }

  // ---- Sun times (sunrise equation, accurate to about a minute) ----

  // Oakland's offset from UTC, US Pacific rules
  function pacificOffsetHours(ms) {
    var year = new Date(ms).getUTCFullYear();
    function nthSunday(month, nth) {
      var first = new Date(Date.UTC(year, month, 1)).getUTCDay();
      return Date.UTC(year, month, 1 + ((7 - first) % 7) + 7 * (nth - 1));
    }
    var dstStart = nthSunday(2, 2) + 10 * 3600000;   // second Sunday in March, 2 AM Pacific
    var dstEnd = nthSunday(10, 1) + 9 * 3600000;     // first Sunday in November, 2 AM Pacific
    return ms >= dstStart && ms < dstEnd ? -7 : -8;
  }

  function localMinutes(ms) {
    var local = ms + pacificOffsetHours(ms) * 3600000;
    return Math.floor(((local % 86400000) + 86400000) % 86400000 / 60000);
  }

  // Sunset for a Gregorian day number, as a UTC millisecond timestamp
  function sunsetMs(n) {
    var J2000 = 2451545, rad = Math.PI / 180;
    var jDate = n + 2440588;                                              // Julian day number at noon
    var cycleDays = Math.ceil(jDate - J2000 + 0.0008);
    var jStar = cycleDays - CONFIG.longitude / 360;
    var M = (357.5291 + 0.98560028 * jStar) % 360;
    var C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
    var L = (M + C + 180 + 102.9372) % 360;
    var jTransit = J2000 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
    var sinDec = Math.sin(L * rad) * Math.sin(23.4397 * rad);
    var cosDec = Math.cos(Math.asin(sinDec));
    var cosW = (Math.sin(-0.833 * rad) - Math.sin(CONFIG.latitude * rad) * sinDec) /
      (Math.cos(CONFIG.latitude * rad) * cosDec);
    var w = Math.acos(cosW) / rad;
    var jSet = jTransit + w / 360;
    return Math.round((jSet - 2440587.5) * 86400000);
  }

  function clockText(minutes) {
    var h = Math.floor(minutes / 60), m = minutes % 60;
    var suffix = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + suffix;
  }

  // Shabbat times for a day: candles (Friday) and havdalah (Saturday), in local minutes
  function shabbatTimes(n) {
    var sunset = localMinutes(sunsetMs(n));
    return { sunset: sunset, candles: sunset - CONFIG.candleMinutes, havdalah: sunset + CONFIG.havdalahMinutes };
  }

  // Everything the calendar needs for one day
  function dayInfo(dateStr) {
    var n = typeof dateStr === 'number' ? dateStr : dayNumber(dateStr);
    var wd = weekdayOf(n);
    var hd = fromDayNumber(n);
    var hol = holidayOn(n);
    var next = holidayOn(n + 1);
    var times = shabbatTimes(n);
    var info = {
      date: dateKey(n),
      weekday: wd,
      hebrew: hd,
      hebrewNumeral: hebrewNumeral(hd.day),
      holiday: hol ? hol.name : null,
      holidayMajor: !!(hol && hol.major),
      nextHolidayMajor: !!(next && next.major),
      nextHoliday: next && next.major ? next.name : null,
      sunset: times.sunset,
      candles: times.candles,
      candlesText: clockText(times.candles),
      havdalah: times.havdalah,
      havdalahText: clockText(times.havdalah)
    };
    if (wd === 6) info.parsha = parashaOn(n);
    return info;
  }

  return {
    CONFIG: CONFIG,
    PORTIONS: PORTIONS,
    COMBINED: COMBINED,
    dayNumber: dayNumber,
    dateKey: dateKey,
    weekdayOf: weekdayOf,
    isLeap: isLeap,
    monthNames: monthNames,
    monthLength: monthLength,
    yearLength: yearLength,
    roshHashanah: roshHashanah,
    toDayNumber: toDayNumber,
    fromDayNumber: fromDayNumber,
    hebrewNumeral: hebrewNumeral,
    holidayOn: holidayOn,
    parashaOn: parashaOn,
    sunsetMs: sunsetMs,
    localMinutes: localMinutes,
    shabbatTimes: shabbatTimes,
    clockText: clockText,
    dayInfo: dayInfo
  };
});
