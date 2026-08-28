// ratelimit.test.mjs — the throttle on /api/scan.
//
// /api/scan is an open URL fetcher on a public deployment. The limiter is not a
// distributed one and does not claim to be; what it must do is stop one client
// looping, never lock out a normal user, never let a caller pick its own bucket,
// and never grow its memory without bound.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createLimiter, clientKey } from '../api/_ratelimit.js';

/* ── the window ──────────────────────────────────────────────────────────── */

test('allows up to the limit, then refuses', () => {
  const lim = createLimiter({ windowMs: 60_000, max: 3 });
  const t = 1_000_000;
  assert.equal(lim.hit('a', t).allowed, true);
  assert.equal(lim.hit('a', t).allowed, true);
  assert.equal(lim.hit('a', t).allowed, true);
  assert.equal(lim.hit('a', t).allowed, false, 'the fourth hit in the window is refused');
});

test('reports how long to wait, and it never rounds to zero', () => {
  const lim = createLimiter({ windowMs: 60_000, max: 1 });
  const t = 1_000_000;
  lim.hit('a', t);
  const blocked = lim.hit('a', t + 59_000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 1000);
});

test('the window resets once it has passed', () => {
  const lim = createLimiter({ windowMs: 60_000, max: 2 });
  const t = 1_000_000;
  lim.hit('a', t);
  lim.hit('a', t);
  assert.equal(lim.hit('a', t + 30_000).allowed, false, 'still inside the window');
  assert.equal(lim.hit('a', t + 60_001).allowed, true, 'a new window starts clean');
});

test('one client being throttled does not affect anybody else', () => {
  const lim = createLimiter({ windowMs: 60_000, max: 2 });
  const t = 1_000_000;
  lim.hit('noisy', t);
  lim.hit('noisy', t);
  assert.equal(lim.hit('noisy', t).allowed, false);
  assert.equal(lim.hit('someone-else', t).allowed, true);
});

test('remaining counts down and never goes negative', () => {
  const lim = createLimiter({ windowMs: 60_000, max: 2 });
  const t = 1_000_000;
  assert.equal(lim.hit('a', t).remaining, 1);
  assert.equal(lim.hit('a', t).remaining, 0);
  assert.equal(lim.hit('a', t).remaining, 0);
});

/* ── memory ──────────────────────────────────────────────────────────────── */

test('expired entries are dropped, so memory follows live traffic', () => {
  const lim = createLimiter({ windowMs: 1000, max: 5 });
  for (let i = 0; i < 200; i += 1) lim.hit(`ip-${i}`, 1_000_000);
  assert.equal(lim.size(), 200);
  lim.hit('later', 1_002_000);
  assert.equal(lim.size(), 1, 'everything from the old window is gone');
});

test('a flood of unique keys cannot grow the map without bound', () => {
  const lim = createLimiter({ windowMs: 3_600_000, max: 5, maxKeys: 50 });
  for (let i = 0; i < 500; i += 1) lim.hit(`ip-${i}`, 1_000_000 + i);
  assert.ok(lim.size() <= 51, `map should stay bounded, got ${lim.size()}`);
});

/* ── identifying the client ──────────────────────────────────────────────── */

test('the client address is the FIRST x-forwarded-for entry', () => {
  // Anything after the first entry was appended by proxies in front of us.
  // Reading the last one lets a caller prepend a fake and rotate buckets freely.
  assert.equal(clientKey({ headers: { 'x-forwarded-for': '203.0.113.9' } }), '203.0.113.9');
  assert.equal(
    clientKey({ headers: { 'x-forwarded-for': '203.0.113.9, 70.41.3.18, 150.172.238.178' } }),
    '203.0.113.9',
  );
});

test('a caller cannot dodge the limiter by spoofing later hops', () => {
  const lim = createLimiter({ windowMs: 60_000, max: 2 });
  const t = 1_000_000;
  const spoofed = (n) => ({ headers: { 'x-forwarded-for': `198.51.100.7, fake-${n}` } });
  lim.hit(clientKey(spoofed(1)), t);
  lim.hit(clientKey(spoofed(2)), t);
  assert.equal(
    lim.hit(clientKey(spoofed(3)), t).allowed,
    false,
    'all three resolve to the same real client',
  );
});

test('requests with no usable address share one bucket rather than going free', () => {
  assert.equal(clientKey({ headers: {} }), 'unknown');
  assert.equal(clientKey({}), 'unknown');
  assert.equal(clientKey(undefined), 'unknown');
  assert.equal(clientKey({ headers: { 'x-forwarded-for': '   ' } }), 'unknown');
});

test('an absurdly long forwarded-for cannot be used to bloat keys', () => {
  const key = clientKey({ headers: { 'x-forwarded-for': 'x'.repeat(5000) } });
  assert.ok(key.length <= 64);
});

test('an array-valued header is handled', () => {
  assert.equal(clientKey({ headers: { 'x-forwarded-for': ['203.0.113.9'] } }), '203.0.113.9');
});

/* ── real use is not affected ────────────────────────────────────────────── */

test('a person checking several sites in a row is never throttled', () => {
  const lim = createLimiter({ windowMs: 60_000, max: 12 });
  let t = 1_000_000;
  // Six scans, fifteen seconds apart: someone working through their projects.
  for (let i = 0; i < 6; i += 1) {
    assert.equal(lim.hit('me', t).allowed, true, `scan ${i + 1} should go through`);
    t += 15_000;
  }
});
