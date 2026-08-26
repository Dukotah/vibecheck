import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, scoreBand } from '../src/score.js';

const entry = (id, result) => ({ id, title: id.toUpperCase(), result });

test('aggregate of empty input is incomplete/0', () => {
  const o = aggregate([]);
  assert.equal(o.score, 0);
  assert.equal(o.status, 'incomplete');
  assert.equal(o.checksRun, 0);
  assert.equal(o.checksTotal, 0);
  assert.deepEqual(o.fixes, []);
});

test('aggregate of undefined is graceful', () => {
  const o = aggregate(undefined);
  assert.equal(o.status, 'incomplete');
});

test('all-incomplete entries stay incomplete but count total', () => {
  const o = aggregate([
    entry('a', { status: 'incomplete', score: 0, summary: '', findings: [], fixes: [] }),
    entry('b', { status: 'incomplete', score: 0, summary: '', findings: [], fixes: [] }),
  ]);
  assert.equal(o.status, 'incomplete');
  assert.equal(o.checksRun, 0);
  assert.equal(o.checksTotal, 2);
});

test('a single pass reports its own score, not a rounded bucket', () => {
  const o = aggregate([entry('a', { status: 'pass', score: 90, summary: '', findings: [], fixes: [] })]);
  assert.equal(o.score, 90);
  assert.equal(o.status, 'ready');
  assert.equal(o.checksRun, 1);
});

test('incomplete checks do not drag down the average', () => {
  const o = aggregate([
    entry('a', { status: 'pass', score: 90, summary: '', findings: [], fixes: [] }),
    entry('b', { status: 'incomplete', score: 0, summary: '', findings: [], fixes: [] }),
  ]);
  assert.equal(o.score, 90);
  assert.equal(o.checksRun, 1);
  assert.equal(o.checksTotal, 2);
});

test('pass+warn+fail averages the real scores', () => {
  const o = aggregate([
    entry('a', { status: 'pass', score: 100, summary: '', findings: [], fixes: [] }),
    entry('b', { status: 'warn', score: 50, summary: '', findings: [], fixes: [] }),
    entry('c', { status: 'fail', score: 0, summary: '', findings: [], fixes: [] }),
  ]);
  assert.equal(o.score, 50);
  assert.equal(o.status, 'not-ready');
  assert.equal(o.checksRun, 3);
});

test('fixes are collected and ordered fail-first', () => {
  const o = aggregate([
    entry('a', { status: 'warn', score: 50, summary: '', findings: [], fixes: [{ label: 'warn-fix', copyText: '' }] }),
    entry('b', { status: 'fail', score: 0, summary: '', findings: [], fixes: [{ label: 'fail-fix', copyText: '' }] }),
  ]);
  assert.equal(o.fixes.length, 2);
  assert.equal(o.fixes[0].label, 'fail-fix');
  assert.equal(o.fixes[0].moduleTitle, 'B');
});

test('breakdown lists every entry', () => {
  const o = aggregate([
    entry('a', { status: 'pass', score: 100, summary: '', findings: [], fixes: [] }),
    entry('b', { status: 'fail', score: 0, summary: '', findings: [], fixes: [] }),
  ]);
  assert.equal(o.breakdown.length, 2);
  assert.equal(o.breakdown[0].id, 'a');
});

test('malformed entry results are normalized, not thrown', () => {
  const o = aggregate([entry('a', { status: 'garbage' }), null, entry('b', undefined)]);
  assert.equal(o.status, 'incomplete');
  assert.equal(o.breakdown.length, 2);
});

test('scoreBand thresholds', () => {
  assert.equal(scoreBand(90).status, 'ready');
  assert.equal(scoreBand(70).status, 'almost');
  assert.equal(scoreBand(30).status, 'not-ready');
  assert.equal(scoreBand(85).status, 'ready');
  assert.equal(scoreBand(60).status, 'almost');
});

test('the to-do list deals one fix per check before repeating a check', () => {
  // A page missing all its social tags produces many near-identical fixes.
  // Without interleaving they bury every other blocker under a wall of
  // "Fix og:whatever", which is correctly ordered and useless to read.
  const o = aggregate([
    entry('share', {
      status: 'fail', score: 30, summary: '', findings: [],
      fixes: [
        { label: 'og:title', copyText: 'a' },
        { label: 'og:image', copyText: 'b' },
        { label: 'og:url', copyText: 'c' },
        { label: 'og:type', copyText: 'd' },
      ],
    }),
    entry('legal', {
      status: 'fail', score: 10, summary: '', findings: [],
      fixes: [{ label: 'Add a LICENSE file', copyText: 'e' }],
    }),
    entry('docs', {
      status: 'warn', score: 60, summary: '', findings: [],
      fixes: [{ label: 'Add install steps', copyText: 'f' }],
    }),
  ]);

  const ids = o.fixes.map((f) => f.id);
  // Both blockers surface before the second social-tag fix.
  assert.deepEqual(ids.slice(0, 2), ['share', 'legal']);
  // Blockers still all come before the warn-tier fix.
  assert.equal(ids[ids.length - 1], 'docs');
  assert.equal(o.fixes.length, 6);
});

test('interleaving preserves every fix exactly once', () => {
  const o = aggregate([
    entry('a', { status: 'fail', score: 0, summary: '', findings: [], fixes: [{ label: 'a1', copyText: '' }, { label: 'a2', copyText: '' }] }),
    entry('b', { status: 'warn', score: 50, summary: '', findings: [], fixes: [{ label: 'b1', copyText: '' }] }),
  ]);
  assert.deepEqual(o.fixes.map((f) => f.label).sort(), ['a1', 'a2', 'b1']);
});
