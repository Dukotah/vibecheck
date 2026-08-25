// test/accessibility.test.mjs — the pure Accessibility core.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/modules/accessibility/analyze.js';
import accessibility from '../src/modules/accessibility.js';

test('empty / missing input returns a neutral incomplete result', () => {
  for (const input of [undefined, null, {}, { html: '' }, { html: '   ' }]) {
    const r = analyze(input);
    assert.equal(r.status, 'incomplete');
    assert.equal(r.score, 0);
    assert.deepEqual(r.findings, []);
    assert.deepEqual(r.fixes, []);
  }
});

test('non-HTML paste is treated as incomplete, not a failure', () => {
  const r = analyze({ html: 'just some plain notes I pasted by mistake' });
  assert.equal(r.status, 'incomplete');
});

test('a clean page passes with no fixes', () => {
  const html =
    '<html lang="en"><head><title>Recipe Keeper</title>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"></head>' +
    '<body><h1>Recipe Keeper</h1>' +
    '<img src="logo.png" alt="Recipe Keeper logo">' +
    '<form><label for="e">Email</label><input id="e" type="email"></form>' +
    '<a href="/pricing">See our pricing</a></body></html>';
  const r = analyze({ html });
  assert.equal(r.status, 'pass');
  assert.ok(r.score >= 80);
  assert.deepEqual(r.fixes, []);
});

test('missing alt text is caught as a bad finding with a fix', () => {
  const r = analyze({ html: '<html lang="en"><body><h1>Hi</h1><img src="a.png"></body></html>' });
  assert.equal(r.status, 'fail');
  assert.ok(r.findings.some((f) => f.level === 'bad' && /alt/i.test(f.text)));
  assert.ok(r.fixes.some((f) => /alt/i.test(f.label)));
});

test('missing lang is caught', () => {
  const r = analyze({ html: '<html><body><h1>Hi</h1></body></html>' });
  assert.ok(r.findings.some((f) => f.level === 'bad' && /language/i.test(f.text)));
  assert.ok(r.fixes.some((f) => /lang="en"/.test(f.copyText)));
});

test('unlabeled form field is caught', () => {
  const r = analyze({ html: '<html lang="en"><body><h1>Hi</h1><form><input type="email"></form></body></html>' });
  assert.ok(r.findings.some((f) => /label/i.test(f.text) && f.level === 'bad'));
});

test('a field with aria-label counts as labeled', () => {
  const r = analyze({ html: '<html lang="en"><body><h1>Hi</h1><form><input type="email" aria-label="Email"></form></body></html>' });
  assert.ok(!r.findings.some((f) => /no label/i.test(f.text)));
});

test('disabled zoom (user-scalable=no) is caught', () => {
  const html =
    '<html lang="en"><head><title>x</title><meta name="viewport" content="width=device-width, user-scalable=no"></head><body><h1>Hi</h1></body></html>';
  const r = analyze({ html });
  assert.ok(r.findings.some((f) => /zoom/i.test(f.text) && f.level === 'bad'));
});

test('generic link text is flagged as a warning', () => {
  const html = '<html lang="en"><body><h1>Hi</h1><a href="/x">click here</a></body></html>';
  const r = analyze({ html });
  assert.ok(r.findings.some((f) => /vague|click here/i.test(f.text)));
});

test('commented-out markup does not trigger findings', () => {
  const html = '<html lang="en"><body><h1>Hi</h1><!-- <img src="x.png"> --></body></html>';
  const r = analyze({ html });
  assert.ok(!r.findings.some((f) => /alt text/i.test(f.text)));
});

test('run() never throws and returns a contract-valid shape', () => {
  for (const input of [undefined, null, 'string', 42, { html: 123 }, { html: '<img>' }]) {
    assert.doesNotThrow(() => accessibility.run(input));
    const r = accessibility.run(input);
    assert.ok(['pass', 'warn', 'fail', 'incomplete'].includes(r.status));
    assert.ok(r.score >= 0 && r.score <= 100);
    assert.ok(Array.isArray(r.findings));
    assert.ok(Array.isArray(r.fixes));
  }
});

test('every formSpec example produces a valid, non-throwing result', () => {
  for (const ex of accessibility.formSpec().examples) {
    assert.doesNotThrow(() => accessibility.run(ex.value));
    const r = accessibility.run(ex.value);
    assert.ok(['pass', 'warn', 'fail'].includes(r.status));
  }
});
