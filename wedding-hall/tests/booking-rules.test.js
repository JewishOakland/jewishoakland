const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/booking-rules.js');

const h = (n) => n * 60;
const res = (date, startH, endH) => ({ date, start: h(startH), end: h(endH) });

test('six hours between daytime events is allowed', () => {
  // 9 AM to 2 PM, then 8 PM the same day: exactly 6 hours apart
  const existing = [res('2026-11-04', 9, 14)];
  assert.deepEqual(R.validateBooking(res('2026-11-04', 20, 23), existing), { ok: true });
});

test('less than six hours between events is refused', () => {
  const existing = [res('2026-11-04', 9, 14)];
  const r = R.validateBooking(res('2026-11-04', 19, 22), existing);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'gap');
});

test('gap also applies when the new event comes first', () => {
  const existing = [res('2026-11-04', 14, 18)];
  const r = R.validateBooking(res('2026-11-04', 9, 12), existing);
  assert.equal(r.reason, 'gap');
});

test('an evening event blocks the next day until noon', () => {
  const existing = [res('2026-11-04', 16, 22)]; // ends after 6 PM, so it is an evening event
  const early = R.validateBooking(res('2026-11-05', 10, 15), existing);
  assert.equal(early.reason, 'evening');
  assert.deepEqual(R.validateBooking(res('2026-11-05', 12, 17), existing), { ok: true });
});

test('an evening event also blocks the same day', () => {
  const existing = [res('2026-11-04', 16, 22)];
  const r = R.validateBooking(res('2026-11-04', 6, 10), existing);
  assert.equal(r.ok, false);
});

test('a new evening event blocks an existing event the next morning', () => {
  const existing = [res('2026-11-05', 9, 13)];
  const r = R.validateBooking(res('2026-11-04', 16, 22), existing);
  assert.equal(r.reason, 'evening');
  assert.deepEqual(R.validateBooking(res('2026-11-04', 16, 22), [res('2026-11-05', 12, 16)]), { ok: true });
});

test('overlapping events are refused', () => {
  const r = R.validateBooking(res('2026-11-04', 11, 15), [res('2026-11-04', 9, 13)]);
  assert.equal(r.reason, 'overlap');
});

test('events on other days do not interfere', () => {
  assert.deepEqual(R.validateBooking(res('2026-11-06', 9, 14), [res('2026-11-03', 9, 14)]), { ok: true });
});

test('time window, slot and minimum length are enforced', () => {
  assert.equal(R.validateBooking({ date: '2026-11-04', start: 7 * 60 + 30, end: h(12) }, []).reason, 'window');
  assert.equal(R.validateBooking({ date: '2026-11-04', start: h(20), end: 23 * 60 + 30 }, []).reason, 'window');
  assert.equal(R.validateBooking({ date: '2026-11-04', start: h(10) + 15, end: h(14) }, []).reason, 'slot');
  assert.equal(R.validateBooking({ date: '2026-11-04', start: h(10), end: h(11) }, []).reason, 'duration');
});

test('weekday package: 5 hours is the base price', () => {
  assert.equal(R.priceFor('weekday', h(9), h(14)).total, 650);
});

test('weekday package: each hour over 5 is $125', () => {
  const p = R.priceFor('weekday', h(9), h(16));
  assert.equal(p.extraHours, 2);
  assert.equal(p.total, 650 + 2 * 125);
});

test('part hours round up to a full extra hour', () => {
  assert.equal(R.priceFor('weekday', h(9), h(14) + 30).extraCost, 125);
});

test('weekend package charges $175 per extra hour', () => {
  assert.equal(R.priceFor('weekend', h(9), h(14)).total, 850);
  assert.equal(R.priceFor('weekend', h(9), h(17)).total, 850 + 3 * 175);
});

test('extended package: 8 hours included, then $175 per hour', () => {
  assert.equal(R.priceFor('extended', h(9), h(17)).total, 1200);
  assert.equal(R.priceFor('extended', h(9), h(18)).total, 1200 + 175);
});

test('packages offered depend on the day', () => {
  // 2026-11-02 is a Monday, 2026-11-06 a Friday, 2026-11-07 a Saturday, 2026-11-08 a Sunday
  assert.equal(R.weekdayOf('2026-11-02'), 1);
  assert.deepEqual(R.optionsFor('2026-11-02').packages, ['weekday', 'extended']);
  assert.deepEqual(R.optionsFor('2026-11-06').packages, ['weekend', 'extended']);
  assert.deepEqual(R.optionsFor('2026-11-08').packages, ['weekend', 'extended']);
});

test('Shabbat needs approval; a plain weekday does not', () => {
  assert.equal(R.optionsFor('2026-11-07').needsApproval, true);
  assert.equal(R.optionsFor('2026-11-02').needsApproval, false);
  assert.equal(R.optionsFor('2026-11-02', { holiday: true }).needsApproval, true);
});

test('reservation terms: 50% now, balance 14 days before', () => {
  const t = R.reservationTerms(1200, '2026-11-20');
  assert.equal(t.reservationPayment, 600);
  assert.equal(t.balanceDue, '2026-11-06');
  assert.equal(t.securityDeposit, 500);
});

test('times are formatted for display', () => {
  assert.equal(R.formatTime(h(9)), '9:00 AM');
  assert.equal(R.formatTime(h(12) + 30), '12:30 PM');
  assert.equal(R.formatTime(h(18)), '6:00 PM');
});
