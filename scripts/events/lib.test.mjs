// Run with `npm test` (node's built-in test runner, no dependencies).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lastUpdated, updatedStamp } from './lib.mjs';

test('updatedStamp: Polish time, same day shows only the hour', () => {
  const s = updatedStamp('2026-11-12T12:00:00Z', new Date('2026-11-12T15:00:00Z'));
  assert.equal(s.time, '13:00'); // CET = UTC+1 in November
  assert.equal(s.date, null);
  assert.equal(s.datetime, '2026-11-12T12:00:00.000Z');
  assert.equal(s.title, 'Ostatnia aktualizacja danych: czwartek, 12 listopada 2026, 13:00 (czas polski)');
});

test('updatedStamp: 23:30 UTC in winter is 00:30 the next Polish day', () => {
  const s = updatedStamp('2026-11-11T23:30:00Z', new Date('2026-11-12T06:00:00Z'));
  assert.equal(s.time, '00:30');
  assert.equal(s.date, null); // same Polish day as the build
  const prev = updatedStamp('2026-11-11T22:59:00Z', new Date('2026-11-12T06:00:00Z'));
  assert.equal(prev.time, '23:59');
  assert.equal(prev.date, '11 lis');
});

test('updatedStamp: summer time (UTC+2) and short month without a dot', () => {
  const s = updatedStamp('2026-10-01T08:05:00Z', new Date('2026-11-12T06:00:00Z'));
  assert.equal(s.time, '10:05');
  assert.equal(s.date, '1 paź');
});

test('lastUpdated: newest headline fetch wins over older event changes', () => {
  const events = [{ addedAt: '2026-11-12T07:00:00Z' }, { addedAt: '2026-11-11T07:00:00Z', updatedAt: '2026-11-12T08:00:00Z' }];
  const articles = [{ fetchedAt: '2026-11-12T02:52:31.099Z' }, { fetchedAt: '2026-11-12T11:00:05.000Z' }];
  assert.equal(lastUpdated(events, articles), '2026-11-12T11:00:05.000Z');
});

test('lastUpdated: newest event change wins when it is later; updatedAt beats addedAt', () => {
  const events = [{ addedAt: '2026-11-12T13:00:00Z', updatedAt: '2026-11-12T12:30:00Z' }];
  const articles = [{ fetchedAt: '2026-11-12T11:00:05.000Z' }];
  // updatedAt is used even though addedAt is later: same rule as the event's own "zaktualizowano" label
  assert.equal(lastUpdated(events, articles), '2026-11-12T12:30:00.000Z');
});

test('lastUpdated: compares instants, not strings (with and without milliseconds)', () => {
  // As strings "…08:42Z" > "…08:42:31Z", but 08:42:31 is the later instant.
  assert.equal(lastUpdated([{ addedAt: '2026-11-12T08:42Z' }], [{ fetchedAt: '2026-11-12T08:42:31Z' }]), '2026-11-12T08:42:31.000Z');
});

test('lastUpdated: ignores missing or broken timestamps; null when there is nothing', () => {
  assert.equal(lastUpdated([{}, { addedAt: 'nope' }], [{}]), null);
  assert.equal(lastUpdated([], []), null);
  assert.equal(lastUpdated([{}], [{ fetchedAt: '2026-11-10T10:00:00Z' }]), '2026-11-10T10:00:00.000Z');
});
