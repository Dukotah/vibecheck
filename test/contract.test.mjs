import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampScore,
  normalizeResult,
  incompleteResult,
  validateModule,
  STATUS_WEIGHT,
} from '../src/contract.js';

test('clampScore clamps and rounds', () => {
  assert.equal(clampScore(-5), 0);
  assert.equal(clampScore(150), 100);
  assert.equal(clampScore(72.6), 73);
  assert.equal(clampScore('abc'), 0);
  assert.equal(clampScore(NaN), 0);
});

test('incompleteResult has the neutral shape', () => {
  const r = incompleteResult('nope');
  assert.equal(r.status, 'incomplete');
  assert.equal(r.score, 0);
  assert.equal(r.summary, 'nope');
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.fixes, []);
});

test('normalizeResult coerces a malformed object', () => {
  const r = normalizeResult({
    status: 'bogus',
    score: 999,
    summary: 42,
    findings: [{ level: 'weird', text: 'x' }, 'garbage'],
    fixes: [{ label: 'a' }, null],
  });
  assert.equal(r.status, 'incomplete');
  assert.equal(typeof r.summary, 'string');
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].level, 'warn');
  assert.equal(r.fixes.length, 1);
  assert.equal(r.fixes[0].copyText, '');
});

test('normalizeResult keeps a valid pass result', () => {
  const r = normalizeResult({
    status: 'pass',
    score: 88,
    summary: 'good',
    findings: [{ level: 'good', text: 'ok' }],
    fixes: [],
  });
  assert.equal(r.status, 'pass');
  assert.equal(r.score, 88);
  assert.equal(r.findings[0].level, 'good');
});

test('normalizeResult on undefined yields incomplete', () => {
  const r = normalizeResult(undefined);
  assert.equal(r.status, 'incomplete');
});

test('STATUS_WEIGHT excludes incomplete from averaging', () => {
  assert.equal(STATUS_WEIGHT.pass, 1);
  assert.equal(STATUS_WEIGHT.warn, 0.5);
  assert.equal(STATUS_WEIGHT.fail, 0);
  assert.equal(STATUS_WEIGHT.incomplete, null);
});

test('validateModule flags a broken module', () => {
  const problems = validateModule({ id: '', run: 'no', formSpec: () => 5 });
  assert.ok(problems.length > 0);
});

test('validateModule accepts a minimal compliant module', () => {
  const mod = {
    id: 'x',
    title: 'X',
    tagline: 't',
    run: () => incompleteResult(),
    formSpec: () => ({ fields: [], examples: [] }),
  };
  assert.deepEqual(validateModule(mod), []);
});
