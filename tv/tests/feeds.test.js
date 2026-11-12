const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/feeds.js');

// Shaped like the site's CiviCRM feed: folded lines, escaped commas, HTML description with a picture
const ICAL = [
  'BEGIN:VCALENDAR',
  'X-WR-TIMEZONE:America/Los_Angeles',
  'BEGIN:VEVENT',
  'UID:CiviCRM_EventID_1@www.jewishoakland.org',
  'SUMMARY:Shacharis',
  'X-ALT-DESC;FMTTYPE=text/html:<html><body><p><img al',
  ' t="" src="https://www.jewishoakland.org/wp-content/uploads/Shachar',
  ' is%281%29.jpg" /></p></body></html>',
  'DESCRIPTION:\\n \\n The sun has risen\\; a new day beckons.',
  'DTSTART:20261113T073000',
  'DTEND:20261113T073000',
  'LOCATION:3014 Lakeshore Ave\\n OAKLAND\\, CA 94610\\',
  'URL:https://www.jewishoakland.org/civicrm/event/info/?reset=1&id=1',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:2',
  'SUMMARY:Latke Wars',
  'DTSTART:20261206T160000',
  'DTEND:20261206T180000',
  'LOCATION:Lake Merritt\\n ',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:3',
  'SUMMARY:Kabbalat Shabbat',
  'DTSTART:20261113T183000',
  'DTEND:20261113T193000',
  'END:VEVENT',
  'END:VCALENDAR'
].join('\r\n');

test('reads the CiviCRM feed', () => {
  const ev = F.parseICal(ICAL);
  assert.deepEqual(ev.map((e) => e.title), ['Shacharis', 'Kabbalat Shabbat', 'Latke Wars']);
  const s = ev[0];
  assert.equal(s.start, '20261113T073000');
  assert.equal(s.image, 'https://www.jewishoakland.org/wp-content/uploads/Shacharis%281%29.jpg');
  assert.equal(s.description, 'The sun has risen; a new day beckons.');
  assert.equal(s.location, '3014 Lakeshore Ave, OAKLAND, CA 94610');
  assert.equal(ev[2].location, 'Lake Merritt');
});

test('UTC and all-day times become Oakland wall-clock time', () => {
  const ev = F.parseICal('BEGIN:VEVENT\nSUMMARY:A\nDTSTART:20261201T030000Z\nEND:VEVENT\nBEGIN:VEVENT\nSUMMARY:B\nDTSTART;VALUE=DATE:20261202\nEND:VEVENT');
  assert.equal(ev[0].start, '20261130T190000');
  assert.equal(ev[1].start, '20261202T000000');
  assert.equal(ev[1].allDay, true);
});

test('upcoming hides listed titles, keeps events in progress and stops at the horizon', () => {
  const ev = F.parseICal(ICAL);
  const now = '20261113T190000'; // during Kabbalat Shabbat
  assert.deepEqual(F.upcoming(ev, now, 14, ['shacharis']).map((e) => e.title), ['Kabbalat Shabbat']);
  assert.deepEqual(F.upcoming(ev, now, 30, ['Shacharis']).map((e) => e.title), ['Kabbalat Shabbat', 'Latke Wars']);
  assert.deepEqual(F.upcoming(ev, '20261113T060000', 1, []).map((e) => e.title), ['Shacharis', 'Kabbalat Shabbat']);
});

test('groups events by day', () => {
  const g = F.groupByDay(F.parseICal(ICAL));
  assert.deepEqual(g.map((d) => [d.day, d.events.length]), [['20261113', 2], ['20261206', 1]]);
});

test('featured skips weekly events and repeats', () => {
  const weekly = [];
  for (let i = 0; i < 5; i++) weekly.push({ title: 'Tanya', start: F.addDays('20261116', 7 * i) + 'T113000', end: F.addDays('20261116', 7 * i) + 'T123000' });
  const ev = weekly.concat([
    { title: 'Menorah', start: '20261205T170000', end: '20261205T170000' },
    { title: 'Menorah', start: '20261206T170000', end: '20261206T170000' },
    { title: 'Far away', start: '20270301T170000', end: '20270301T170000' }
  ]).sort((a, b) => (a.start < b.start ? -1 : 1));
  const f = F.featured(ev, '20261112T120000', { days: 45, max: 6, maxRepeats: 3 });
  assert.deepEqual(f.map((e) => e.title + ' ' + e.start.slice(0, 8)), ['Menorah 20261205']);
});

test('formats times and days', () => {
  assert.equal(F.formatTime('20261113T073000'), '7:30 AM');
  assert.equal(F.formatTime('20261113T120500'), '12:05 PM');
  assert.equal(F.formatTime('20261113T000000'), '12:00 AM');
  assert.equal(F.formatDay('20261112', '20261112'), 'Today');
  assert.equal(F.formatDay('20261113', '20261112'), 'Tomorrow');
  assert.equal(F.formatDay('20261115', '20261112'), 'Sunday, Nov 15');
});

test('Hebrew date uses the site spellings', () => {
  assert.equal(F.hebrewDate(new Date('2026-11-12T20:00:00Z')), '2 Kislev 5787');
  assert.match(F.hebrewDate(new Date('2026-10-20T20:00:00Z')), /Cheshvan 5787$/);
});

// Shaped like Hebcal's /hebcal JSON
const HEBCAL = [
  { title: 'Candle lighting: 4:40pm', date: '2026-11-13T16:40:00-08:00', category: 'candles' },
  { title: 'Parashat Toldot', date: '2026-11-14', category: 'parashat' },
  { title: 'Havdalah: 5:39pm', date: '2026-11-14T17:39:00-08:00', category: 'havdalah' },
  { title: 'Chanukah: 1 Candle', date: '2026-12-04T16:31:00-08:00', category: 'holiday', subcat: 'major' },
  { title: 'Candle lighting: 4:31pm', date: '2026-12-04T16:31:00-08:00', category: 'candles' },
  { title: 'Parashat Vayeshev', date: '2026-12-05', category: 'parashat' },
  { title: 'Havdalah: 5:33pm', date: '2026-12-05T17:33:00-08:00', category: 'havdalah' },
  { title: 'Candle lighting: 7:20pm', date: '2027-04-21T19:20:00-07:00', category: 'candles' },
  { title: 'Pesach I', date: '2027-04-22', category: 'holiday', subcat: 'major' },
  { title: 'Candle lighting: 8:21pm', date: '2027-04-22T20:21:00-07:00', category: 'candles' },
  { title: 'Pesach II', date: '2027-04-23', category: 'holiday', subcat: 'major' },
  { title: 'Havdalah: 8:22pm', date: '2027-04-23T20:22:00-07:00', category: 'havdalah' }
];

test('finds Shabbat and Yom Tov periods', () => {
  const p = F.holyDays(HEBCAL);
  assert.deepEqual(p.map((x) => [x.name, x.day]), [
    ['Parshat Toldot', '20261114'],
    ['Parshat Vayeshev', '20261205'],
    ['Pesach I', '20270423']
  ]);
  assert.equal(p[2].holiday, 'Pesach I');
  assert.equal(p[0].start.toISOString(), '2026-11-14T00:40:00.000Z');
});

test('knows when it is Shabbat', () => {
  const p = F.holyDays(HEBCAL);
  assert.equal(F.isHolyTime(p, new Date('2026-11-13T16:39:00-08:00')), false);
  assert.equal(F.isHolyTime(p, new Date('2026-11-13T16:40:00-08:00')), true);
  assert.equal(F.isHolyTime(p, new Date('2026-11-14T12:00:00-08:00')), true);
  assert.equal(F.isHolyTime(p, new Date('2026-11-14T17:39:00-08:00')), false);
  assert.equal(F.isHolyTime(p, new Date('2027-04-22T23:00:00-07:00')), true); // second day of Pesach
  assert.equal(F.currentOrNext(p, new Date('2026-11-15T10:00:00-08:00')).name, 'Parshat Vayeshev');
});

test('Kiddush weeks pair Shabbatot with the board', () => {
  const board = { '2026-11-21': [{ name: 'The Cohen family', dedication: 'In honor of Sarah' }], '2026-11-14': { name: '' } };
  const w = F.kiddushWeeks(HEBCAL, board, '20261112T120000', 3);
  assert.deepEqual(w.map((x) => [x.day, x.name, x.sponsors.length]), [
    ['20261114', 'Parshat Toldot', 1],
    ['20261121', 'Shabbat', 1],
    ['20261128', 'Shabbat', 0]
  ]);
  assert.equal(w[0].sponsors[0].name, 'Anonymous');
  assert.equal(w[1].sponsors[0].dedication, 'In honor of Sarah');
});

test('after Kiddush on Saturday the board moves to next week', () => {
  assert.equal(F.kiddushWeeks([], {}, '20261114T110000', 1)[0].day, '20261114');
  assert.equal(F.kiddushWeeks([], {}, '20261114T160000', 1)[0].day, '20261121');
  assert.equal(F.kiddushWeeks([], {}, '20261115T090000', 1)[0].day, '20261121');
});

test('reads slides from a WordPress page', () => {
  const html = `
    <figure class="wp-block-image"><img src="https://x.org/a-1024x576.jpg" srcset="https://x.org/a-1024x576.jpg 1024w, https://x.org/a.jpg 2560w, https://x.org/a-300x169.jpg 300w" alt="20s"></figure>
    <figure class="wp-block-video"><video controls src="https://x.org/clip.mp4"></video></figure>
    <video><source src="https://x.org/other.mp4" type="video/mp4"></video>
    <figure class="wp-block-embed is-provider-youtube"><div class="wp-block-embed__wrapper">
      <iframe title="Chanukah" src="https://www.youtube.com/embed/abcdefghijk?feature=oembed"></iframe>
    </div></figure>
    <p><a href="https://youtu.be/abcdefghijk">same video</a></p>
    <iframe src="https://docs.google.com/presentation/d/e/xyz/embed?start=true"></iframe>
    <img src="https://x.org/b.png" alt="Kids at the menorah">`;
  assert.deepEqual(F.slidesFromHtml(html), [
    { type: 'image', src: 'https://x.org/a.jpg', seconds: 20 },
    { type: 'video', src: 'https://x.org/clip.mp4' },
    { type: 'video', src: 'https://x.org/other.mp4' },
    { type: 'youtube', id: 'abcdefghijk' },
    { type: 'page', src: 'https://docs.google.com/presentation/d/e/xyz/embed?start=true' },
    { type: 'image', src: 'https://x.org/b.png', seconds: null }
  ]);
});

test('interleave puts a generated slide after every n of our own', () => {
  assert.deepEqual(F.interleave([1, 2, 3, 4], ['a', 'b', 'c'], 2), [1, 2, 'a', 3, 4, 'b', 'c']);
  assert.deepEqual(F.interleave([], ['a'], 2), ['a']);
});

test('an event with a midnight start runs all day, and multi-day events show their dates', () => {
  const [menorah] = F.parseICal([
    'BEGIN:VEVENT', 'SUMMARY:The Oakland Menorah',
    'DTSTART;TZID=America/Los_Angeles:20261204T000000', 'DTEND;TZID=America/Los_Angeles:20261213T235900',
    'LOCATION:Lake Merritt Amphitheater\\, Oakland\\, CA\\, United States', 'END:VEVENT'
  ].join('\n'));
  assert.equal(menorah.allDay, true);
  assert.equal(menorah.location, 'Lake Merritt Amphitheater, Oakland, CA');
  assert.equal(F.whenText(menorah, '20261112'), 'Fri, Dec 4 – Sun, Dec 13');
  // On Dec 8 it is listed under today, not under Dec 4
  assert.equal(F.groupByDay([menorah], '20261208')[0].day, '20261208');
  const latke = { title: 'Latke Wars', start: '20261122T170000', end: '20261122T183000' };
  assert.equal(F.whenText(latke, '20261112'), 'Sunday, Nov 22 · 5:00 PM – 6:30 PM');
  assert.equal(F.whenText({ title: 'X', start: '20261113T073000', end: '20261113T073000' }, '20261112'), 'Tomorrow · 7:30 AM');
});

test('descriptions drop a repeated title and keep paragraphs apart', () => {
  const [e] = F.parseICal('BEGIN:VEVENT\nSUMMARY:Latke Wars\nDTSTART:20261122T170000\n' +
    'DESCRIPTION:Latke Wars: The CTeen Pre-Chanukah Cook-Off\\n \\n Grab an apron\\n \\n Bring friends!\nEND:VEVENT');
  assert.equal(e.description, 'Grab an apron. Bring friends!');
});
