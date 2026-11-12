// Run with `npm test` (node's built-in test runner, no dependencies).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lastUpdated } from './lib.mjs';

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
