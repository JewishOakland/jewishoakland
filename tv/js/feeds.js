/* Chabad Oakland TV: reads the website's events feed, the Kiddush board, Hebcal and the slides page.
   Pure functions, no DOM. Event times are wall-clock stamps 'YYYYMMDDTHHMMSS' in Oakland time,
   so they compare as strings. Days are 'YYYYMMDD'. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Feeds = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TZ = 'America/Los_Angeles';

  /* ---------- time ---------- */

  // The wall-clock stamp for a moment, in the center's time zone
  function stampOf(date, tz) {
    var p = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz || TZ, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(date).forEach(function (x) { p[x.type] = x.value; });
    return p.year + p.month + p.day + 'T' + (p.hour === '24' ? '00' : p.hour) + p.minute + p.second;
  }

  function dayOf(stamp) { return stamp.slice(0, 8); }

  function utcOfDay(day) { return Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8)); }

  function addDays(day, n) {
    var d = new Date(utcOfDay(day) + n * 86400000);
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
  }

  function weekdayOf(day) { return new Date(utcOfDay(day)).getUTCDay(); }

  function isoDay(day) { return day.slice(0, 4) + '-' + day.slice(4, 6) + '-' + day.slice(6, 8); }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function formatTime(stamp) {
    var h = +stamp.slice(9, 11), m = stamp.slice(11, 13);
    return (h % 12 || 12) + ':' + m + ' ' + (h < 12 ? 'AM' : 'PM');
  }

  function formatDay(day, today, style) {
    if (day === today) return 'Today';
    if (day === addDays(today, 1)) return 'Tomorrow';
    return new Date(utcOfDay(day)).toLocaleDateString('en-US', {
      timeZone: 'UTC', weekday: style === 'short' ? 'short' : 'long', month: 'short', day: 'numeric'
    });
  }

  // "1 Kislev 5787", using the spellings the site uses
  function hebrewDate(date, tz) {
    try {
      return new Intl.DateTimeFormat('en-u-ca-hebrew', { timeZone: tz || TZ, day: 'numeric', month: 'long', year: 'numeric' })
        .format(date).replace(/Heshvan/g, 'Cheshvan').replace(/Tishri\b/g, 'Tishrei').replace(/ AM$/, '');
    } catch (e) {
      return '';
    }
  }

  /* ---------- events feed (CiviCRM iCal) ---------- */

  function unescapeText(s) {
    return s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
  }

  function decodeEntities(s) {
    return s.replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos|nbsp|rsquo|lsquo|rdquo|ldquo|ndash|mdash);/gi, function (m, e) {
      var named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—' };
      if (e[0] !== '#') return named[e.toLowerCase()];
      return String.fromCharCode(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1));
    });
  }

  // DTSTART values: 20261113T073000 (local), 20261113T153000Z (UTC) or 20261113 (all day)
  function stampFromICal(value, tz) {
    if (/^\d{8}$/.test(value)) return value + 'T000000';
    var m = /^(\d{8})T(\d{6})(Z?)$/.exec(value);
    if (!m) return null;
    if (!m[3]) return m[1] + 'T' + m[2];
    var v = m[1] + m[2];
    return stampOf(new Date(Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8), +v.slice(8, 10), +v.slice(10, 12), +v.slice(12, 14))), tz);
  }

  // A short blurb: the first sentence or two, up to about `max` characters
  function blurb(text, max) {
    var t = text.replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    var cut = t.slice(0, max), end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    if (end > max / 3) return cut.slice(0, end + 1);
    return cut.slice(0, cut.lastIndexOf(' ')) + '…';
  }

  // Paragraphs become sentences; a first line that only repeats the event's title is dropped
  function describe(text, title) {
    var lines = text.split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    if (lines.length > 1 && lines[0].toLowerCase().indexOf(title.toLowerCase()) === 0) lines.shift();
    return blurb(lines.map(function (l) { return /[.!?:;,"”)]$/.test(l) ? l : l + '.'; }).join(' '), 220);
  }

  function parseICal(text, tz) {
    var events = [], cur = null;
    text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n').forEach(function (line) {
      if (line === 'BEGIN:VEVENT') { cur = {}; return; }
      if (line === 'END:VEVENT') {
        if (cur && cur.start) events.push(cur);
        cur = null;
        return;
      }
      if (!cur) return;
      var colon = line.indexOf(':');
      if (colon < 0) return;
      var name = line.slice(0, colon).split(';')[0].toUpperCase(), value = line.slice(colon + 1);
      if (name === 'UID') cur.id = value;
      else if (name === 'SUMMARY') cur.title = decodeEntities(unescapeText(value)).trim();
      else if (name === 'DTSTART') { cur.start = stampFromICal(value, tz); cur.allDay = /^\d{8}$/.test(value); }
      else if (name === 'DTEND') cur.end = stampFromICal(value, tz);
      else if (name === 'LOCATION') cur.location = unescapeText(value).replace(/\s*\n\s*/g, ', ').replace(/[,\s\\]+$/, '').replace(/,\s*(United States|USA)$/i, '').trim();
      else if (name === 'URL') cur.url = value.trim();
      else if (name === 'DESCRIPTION') cur.description = decodeEntities(unescapeText(value));
      else if (name === 'X-ALT-DESC') {
        var img = /<img[^>]*\ssrc="([^"]+)"/i.exec(unescapeText(value));
        if (img) cur.image = decodeEntities(img[1]);
      }
    });
    events.forEach(function (e) {
      if (!e.end || e.end < e.start) e.end = e.start;
      e.title = e.title || 'Event';
      // CiviCRM gives events without a set time (like the Menorah, up all week) a midnight start
      if (e.start.slice(9) === '000000') e.allDay = true;
      if (e.description != null) e.description = describe(e.description, e.title);
    });
    return events.sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
  }

  function hidden(e, hide) {
    var t = e.title.toLowerCase();
    return (hide || []).some(function (h) { return t === String(h).toLowerCase(); });
  }

  // Events still to come (or happening now) within `days` days, minus the titles in `hide`
  function upcoming(events, now, days, hide) {
    var until = addDays(dayOf(now), days) + 'T000000';
    return events.filter(function (e) {
      return (e.end > e.start ? e.end : e.start) >= now && e.start < until && !hidden(e, hide);
    });
  }

  // An event that began on an earlier day and is still going is listed under `today`
  function groupByDay(events, today) {
    var groups = [];
    events.forEach(function (e) {
      var d = today && dayOf(e.start) < today ? today : dayOf(e.start), last = groups[groups.length - 1];
      if (last && last.day === d) last.events.push(e);
      else groups.push({ day: d, events: [e] });
    });
    return groups;
  }

  // One-off events worth a full slide: titles that repeat at most `maxRepeats` times in the
  // whole feed (so weekly classes and services are left out), first date of each, soonest first
  function featured(events, now, opts) {
    var counts = {};
    events.forEach(function (e) { counts[e.title] = (counts[e.title] || 0) + 1; });
    var seen = {};
    return upcoming(events, now, opts.days, opts.hide).filter(function (e) {
      if (counts[e.title] > opts.maxRepeats || seen[e.title]) return false;
      seen[e.title] = true;
      return true;
    }).slice(0, opts.max);
  }

  function multiDay(e) { return dayOf(e.end) > dayOf(e.start) && (e.allDay || e.end.slice(9) !== '000000' || dayOf(e.end) > addDays(dayOf(e.start), 1)); }

  function shortDay(day) {
    return new Date(utcOfDay(day)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
  }

  // "Sunday, Nov 22 · 5:00 PM – 6:30 PM", "Today · 7:30 PM", "Fri, Dec 4 – Sun, Dec 13"
  function whenText(e, today) {
    if (multiDay(e)) return shortDay(dayOf(e.start)) + ' – ' + shortDay(dayOf(e.end));
    var text = formatDay(dayOf(e.start), today);
    if (e.allDay) return text;
    return text + ' · ' + formatTime(e.start) + (e.end > e.start ? ' – ' + formatTime(e.end) : '');
  }

  /* ---------- Hebcal: Shabbat and Yom Tov ---------- */

  function parshaName(title) { return title.replace(/^Parashat /, 'Parshat '); }

  // Shabbat and Yom Tov periods from Hebcal's candle lighting and havdalah items.
  // Each is { start, end: Date, name, candles, havdalah: Date, day: Saturday or last day 'YYYYMMDD' }
  function holyDays(items, tz) {
    var list = items.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    var out = [], open = null;
    list.forEach(function (it) {
      var at = new Date(it.date);
      if (it.category === 'candles' && !open) open = { start: at, candles: at, names: [] };
      else if (it.category === 'havdalah' && open) {
        open.end = at; open.havdalah = at;
        open.day = stampOf(at, tz).slice(0, 8);
        out.push(open);
        open = null;
      }
    });
    out.forEach(function (w) {
      var from = stampOf(w.start, tz).slice(0, 8), to = w.day, parsha = null, holiday = null;
      list.forEach(function (it) {
        var d = it.date.slice(0, 10).replace(/-/g, '');
        if (d < from || d > to) return;
        if (it.category === 'parashat' && !parsha) parsha = parshaName(it.title);
        if (it.category === 'holiday' && it.subcat === 'major' && !/Candles?$/.test(it.title) && !holiday) holiday = it.title;
      });
      w.name = parsha || holiday || 'Shabbat';
      w.holiday = holiday;
      delete w.names;
    });
    return out;
  }

  // The Shabbat or Yom Tov happening now, or else the next one
  function currentOrNext(periods, date) {
    for (var i = 0; i < periods.length; i++) if (periods[i].end > date) return periods[i];
    return null;
  }

  function isHolyTime(periods, date) {
    return periods.some(function (p) { return p.start <= date && date < p.end; });
  }

  /* ---------- Kiddush board ---------- */

  // The board is { 'YYYY-MM-DD': [ { name, dedication } ] }; a single object is also accepted
  function normalizeBoard(board) {
    var out = {};
    Object.keys(board || {}).forEach(function (k) {
      var list = Array.isArray(board[k]) ? board[k] : [board[k]];
      list = list.filter(Boolean).map(function (s) {
        return { name: String(s.name || '').trim() || 'Anonymous', dedication: String(s.dedication || '').trim() };
      });
      if (list.length) out[k.replace(/-/g, '')] = (out[k.replace(/-/g, '')] || []).concat(list);
    });
    return out;
  }

  // The next `count` Shabbatot from `now` with their parsha and sponsors.
  // Saturday's Kiddush is over by late afternoon, so from 3 PM Saturday the list starts next week.
  function kiddushWeeks(hebcalItems, board, now, count) {
    var day = dayOf(now), toSat = (6 - weekdayOf(day) + 7) % 7;
    if (toSat === 0 && now.slice(9) >= '150000') toSat = 7;
    var names = {};
    (hebcalItems || []).forEach(function (it) {
      var d = it.date.slice(0, 10).replace(/-/g, '');
      if (it.category === 'parashat') names[d] = parshaName(it.title);
      else if (it.category === 'holiday' && it.subcat === 'major' && !/Candles?$/.test(it.title) && !names[d]) names[d] = it.title;
    });
    var sponsors = normalizeBoard(board), weeks = [];
    for (var i = 0; i < count; i++) {
      var sat = addDays(day, toSat + 7 * i);
      weeks.push({ day: sat, name: names[sat] || 'Shabbat', sponsors: sponsors[sat] || [] });
    }
    return weeks;
  }

  /* ---------- slides from a WordPress page ---------- */

  function attr(tag, name) {
    var m = new RegExp('\\s' + name + '\\s*=\\s*"([^"]*)"', 'i').exec(tag) || new RegExp('\\s' + name + "\\s*=\\s*'([^']*)'", 'i').exec(tag);
    return m ? decodeEntities(m[1]) : '';
  }

  // The widest picture in a srcset, else src
  function bestImage(tag) {
    var best = attr(tag, 'src') || attr(tag, 'data-src'), bestW = 0;
    (attr(tag, 'srcset') || attr(tag, 'data-srcset')).split(',').forEach(function (part) {
      var bits = part.trim().split(/\s+/), w = parseInt(bits[1], 10) || 0;
      if (bits[0] && w > bestW) { best = bits[0]; bestW = w; }
    });
    return best;
  }

  function youtubeId(url) {
    var m = /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url);
    return m ? m[1] : null;
  }

  // Images, videos and embeds from the page, in page order. To show one picture longer or
  // shorter than usual, put e.g. "20s" in its alt text. Videos play to the end.
  function slidesFromHtml(html) {
    var slides = [], wantSource = false, re = /<(img|video|source|iframe|a)\b[^>]*>|<\/video>/gi, m;
    while ((m = re.exec(html || ''))) {
      var tag = m[0], kind = (m[1] || '').toLowerCase(), seconds = null, s = /(?:^|\s)(\d{1,3})\s?s(?:ec(?:onds)?)?\b/i.exec(attr(tag, 'alt'));
      if (s) seconds = +s[1];
      if (tag.toLowerCase() === '</video>') { wantSource = false; continue; }
      if (kind === 'img') {
        var src = bestImage(tag);
        if (src) slides.push({ type: 'image', src: src, seconds: seconds });
      } else if (kind === 'video') {
        if (attr(tag, 'src')) slides.push({ type: 'video', src: attr(tag, 'src') });
        else wantSource = true;
      } else if (kind === 'source' && wantSource) {
        slides.push({ type: 'video', src: attr(tag, 'src') });
        wantSource = false;
      } else if (kind === 'iframe' || (kind === 'a' && youtubeId(attr(tag, 'href')))) {
        var url = attr(tag, kind === 'a' ? 'href' : 'src'), id = youtubeId(url);
        if (id) slides.push({ type: 'youtube', id: id });
        else if (url) slides.push({ type: 'page', src: url });
      }
    }
    // A YouTube link that WordPress also turned into an embed would show twice
    return slides.filter(function (sl, i) {
      return sl.type !== 'youtube' || !slides.slice(0, i).some(function (p) { return p.type === 'youtube' && p.id === sl.id; });
    });
  }

  // Put one generated slide (event, Kiddush) after every `every` of the center's own slides
  function interleave(own, extra, every) {
    var out = [], j = 0;
    every = Math.max(1, every || 1);
    own.forEach(function (s, i) {
      out.push(s);
      if ((i + 1) % every === 0 && j < extra.length) out.push(extra[j++]);
    });
    while (j < extra.length) out.push(extra[j++]);
    return out;
  }

  return {
    stampOf: stampOf,
    dayOf: dayOf,
    addDays: addDays,
    weekdayOf: weekdayOf,
    isoDay: isoDay,
    formatTime: formatTime,
    formatDay: formatDay,
    shortDay: shortDay,
    multiDay: multiDay,
    whenText: whenText,
    hebrewDate: hebrewDate,
    parseICal: parseICal,
    upcoming: upcoming,
    groupByDay: groupByDay,
    featured: featured,
    holyDays: holyDays,
    currentOrNext: currentOrNext,
    isHolyTime: isHolyTime,
    normalizeBoard: normalizeBoard,
    kiddushWeeks: kiddushWeeks,
    slidesFromHtml: slidesFromHtml,
    youtubeId: youtubeId,
    interleave: interleave
  };
});
