const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../js/hebrew-calendar.js');

// Intl's Hebrew calendar is used here only as a reference to test our own arithmetic against
const ref = new Intl.DateTimeFormat('en-u-ca-hebrew', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
function refParts(n) {
  const p = Object.fromEntries(ref.formatToParts(new Date(n * 86400000)).map(x => [x.type, x.value]));
  return { year: Number(p.year), month: p.month, day: Number(p.day) };
}

// Years 5806 and 5807 (2045 to 2046) are the one known difference from the reference calendar. We keep the
// standard rule for them, so the reference's 1 Tishri 5807 is one day later. Check these dates before relying on them.
const KNOWN_DIFFERENCE_YEARS = [5806, 5807];

test('our Hebrew dates match the reference calendar, 1990 to 2100', () => {
  const start = H.dayNumber('1990-01-01'), end = H.dayNumber('2100-12-31');
  let mismatches = [];
  for (let n = start; n <= end; n++) {
    if (KNOWN_DIFFERENCE_YEARS.includes(H.fromDayNumber(n).year)) continue;
    const ours = H.fromDayNumber(n);
    const theirs = refParts(n);
    if (ours.year !== theirs.year || ours.month !== theirs.month || ours.day !== theirs.day) {
      mismatches.push([H.dateKey(n), ours, theirs]);
      if (mismatches.length > 5) break;
    }
  }
  assert.deepEqual(mismatches, []);
});

test('converting to a Hebrew date and back gives the same day', () => {
  for (let n = H.dayNumber('1995-01-01'); n < H.dayNumber('2060-01-01'); n += 7) {
    const hd = H.fromDayNumber(n);
    assert.equal(H.toDayNumber(hd), n);
  }
});

test('every Hebrew year has a valid length', () => {
  for (let y = 5750; y <= 5860; y++) {
    assert.ok([353, 354, 355, 383, 384, 385].includes(H.yearLength(y)), `year ${y} length ${H.yearLength(y)}`);
  }
});

test('Rosh Hashanah 5787 is 12 September 2026', () => {
  assert.equal(H.dateKey(H.toDayNumber({ year: 5787, month: 'Tishri', day: 1 })), '2026-09-12');
});

test('holidays fall on the right days', () => {
  const day = (ds) => H.holidayOn(H.dayNumber(ds));
  assert.equal(day('2026-09-12').name, 'Rosh Hashanah');
  assert.equal(day('2026-09-21').name, 'Yom Kippur');
  assert.equal(day('2026-09-21').major, true);
  assert.equal(day('2026-09-26').name, 'Sukkot');
  assert.equal(day('2026-10-03').name, 'Shmini Atzeret');
  assert.equal(day('2026-10-04').name, 'Simchat Torah');
  assert.equal(day('2026-12-05').name, 'Chanukah');
  assert.equal(day('2026-11-03'), null);
});

test('every Shabbat has a reading, except Yom Tov Shabbatot', () => {
  let missing = [];
  for (let n = H.dayNumber('2000-01-01'); n < H.dayNumber('2100-01-01'); n++) {
    if (H.weekdayOf(n) !== 6) continue;
    const hol = H.holidayOn(n);
    const reading = H.parashaOn(n);
    if (hol && hol.major) { if (reading !== null) missing.push(H.dateKey(n) + ' should be null'); continue; }
    if (!reading) missing.push(H.dateKey(n));
  }
  assert.deepEqual(missing.slice(0, 10), []);
});

test('each weekly cycle reads every portion once, in order', () => {
  // A reading is combined only if it is one of the known pairs (Lech-Lecha is a single portion)
  const pairNames = H.COMBINED.map(p => p[0] + '-' + p[1]);
  const portionsOf = (reading) => (pairNames.includes(reading) ? reading.split('-') : [reading]);
  for (let cy = 5760; cy <= 5860; cy++) {
    const start = H.toDayNumber({ year: cy, month: 'Tishri', day: 23 });
    const readings = [];
    for (let n = start + 1; n < H.toDayNumber({ year: cy + 1, month: 'Tishri', day: 23 }); n++) {
      if (H.weekdayOf(n) !== 6) continue;
      const r = H.parashaOn(n);
      if (r) readings.push(r);
    }
    const combined = readings.filter(r => pairNames.includes(r)).length;
    const expanded = readings.flatMap(portionsOf);
    assert.ok(readings.length === 53 - combined || readings.length === 54, `cycle ${cy}: ${readings.length} readings`);
    assert.deepEqual(expanded, H.PORTIONS.slice(0, expanded.length), `cycle ${cy}`);
  }
});

test('Shabbat times are plausible for Oakland', () => {
  // Winter and summer solstices in 2026, Pacific time
  const dec = H.dayInfo('2026-12-18');   // Friday
  const jun = H.dayInfo('2026-06-19');   // Friday
  assert.ok(dec.candles > 16 * 60 + 20 && dec.candles < 16 * 60 + 40, `December candles ${dec.candlesText}`);
  assert.ok(jun.candles > 20 * 60 && jun.candles < 20 * 60 + 30, `June candles ${jun.candlesText}`);
});
