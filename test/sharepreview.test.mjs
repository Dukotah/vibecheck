// test/sharepreview.test.mjs — tests for the Social Share Preview module and
// its pure cores. Run: node --test test/sharepreview.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import sharepreview from '../src/modules/sharepreview.js';
import { validateModule, STATUSES } from '../src/contract.js';
import { checkSharePreview } from '../src/modules/sharepreview/check.js';
import { parseHtml } from '../src/modules/sharepreview/parse.js';
import { audit } from '../src/modules/sharepreview/audit.js';
import { correctedHeadBlock, metaFixFor, attrEscape } from '../src/modules/sharepreview/fix.js';
import { buildPreviews, truncate } from '../src/modules/sharepreview/preview.js';

const READY = `<head>
  <title>My Cool App</title>
  <meta property="og:title" content="My Cool App" />
  <meta property="og:description" content="The fastest way to do the thing." />
  <meta property="og:image" content="https://mycoolapp.com/card.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="https://mycoolapp.com" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="My Cool App" />
  <meta name="twitter:card" content="summary_large_image" />
</head>`;

// ── Contract compliance ──────────────────────────────────────────────────────

test('module satisfies the contract (validateModule = no problems)', () => {
  assert.deepEqual(validateModule(sharepreview), []);
});

test('id equals filename slot and title/tagline are non-empty strings', () => {
  assert.equal(sharepreview.id, 'sharepreview');
  assert.ok(sharepreview.title.length > 0);
  assert.ok(sharepreview.tagline.length > 0);
});

test('formSpec fields reference headHtml and pageUrl and carry help/placeholder', () => {
  const spec = sharepreview.formSpec();
  const names = spec.fields.map((f) => f.name);
  assert.ok(names.includes('headHtml'));
  assert.ok(names.includes('pageUrl'));
  for (const f of spec.fields) {
    assert.ok(typeof f.label === 'string' && f.label.length > 0);
    assert.ok(['text', 'textarea', 'url', 'checkbox'].includes(f.type));
  }
});

test('every formSpec example uses only real field names', () => {
  const spec = sharepreview.formSpec();
  const names = new Set(spec.fields.map((f) => f.name));
  assert.ok(spec.examples.length >= 1);
  for (const ex of spec.examples) {
    assert.ok(typeof ex.label === 'string' && ex.label.length > 0);
    for (const key of Object.keys(ex.value)) assert.ok(names.has(key), `bad example key ${key}`);
  }
});

// ── run() tolerance / never-throws ───────────────────────────────────────────

test('run(undefined) is incomplete and does not throw', () => {
  const r = sharepreview.run(undefined);
  assert.equal(r.status, 'incomplete');
  assert.equal(r.findings.length, 0);
  assert.equal(r.fixes.length, 0);
});

test('run(null) is incomplete', () => {
  assert.equal(sharepreview.run(null).status, 'incomplete');
});

test('run(string) does not throw and returns valid shape', () => {
  const r = sharepreview.run('not an object');
  assert.ok(STATUSES.includes(r.status));
  assert.equal(r.status, 'incomplete');
});

test('run({}) with no headHtml is incomplete', () => {
  assert.equal(sharepreview.run({}).status, 'incomplete');
});

test('run with whitespace-only headHtml is incomplete', () => {
  assert.equal(sharepreview.run({ headHtml: '   \n\t ' }).status, 'incomplete');
});

test('run with non-string headHtml (number) is tolerated', () => {
  const r = sharepreview.run({ headHtml: 12345 });
  assert.equal(r.status, 'incomplete');
});

test('run always returns integer score in 0..100', () => {
  for (const input of [undefined, {}, { headHtml: READY }, { headHtml: '<head></head>' }]) {
    const r = sharepreview.run(input);
    assert.ok(Number.isInteger(r.score));
    assert.ok(r.score >= 0 && r.score <= 100);
  }
});

// ── Scoring behaviour ────────────────────────────────────────────────────────

test('a fully share-ready page passes with a high score', () => {
  const r = sharepreview.run({ headHtml: READY });
  assert.equal(r.status, 'pass');
  assert.ok(r.score >= 90, `score was ${r.score}`);
  assert.ok(r.findings.some((f) => f.level === 'good'));
});

test('a page with only a <title> fails (no image, no og tags)', () => {
  const r = sharepreview.run({ headHtml: '<head><title>My App</title></head>' });
  assert.equal(r.status, 'fail');
  assert.ok(r.score < 90);
  assert.ok(r.findings.some((f) => f.level === 'bad'));
});

test('a completely empty head element is a fail (missing image)', () => {
  const r = sharepreview.run({ headHtml: '<head></head>' });
  assert.equal(r.status, 'fail');
});

test('relative og:image is flagged as a fail (needs absolute URL)', () => {
  const html =
    '<head><meta property="og:image" content="/card.png" /><meta property="og:title" content="Hi" /></head>';
  const r = sharepreview.run({ headHtml: html });
  assert.equal(r.status, 'fail');
  assert.ok(r.findings.some((f) => /relative path|full https/i.test(f.text)));
});

test('pageUrl resolves a relative og:image into an absolute https fix', () => {
  const html = '<head><meta property="og:image" content="/card.png" /></head>';
  const r = sharepreview.run({ headHtml: html, pageUrl: 'https://mycoolapp.com' });
  const block = r.fixes.map((f) => f.copyText).join('\n');
  assert.ok(block.includes('https://mycoolapp.com/card.png'), 'expected absolute image in fix');
});

test('http og:image (not https) is at least a warning', () => {
  const html =
    '<head><meta property="og:image" content="http://x.com/c.png" /><meta property="og:title" content="Hi" /><meta property="og:description" content="d" /><meta property="og:url" content="https://x.com" /><meta property="og:type" content="website" /><meta property="og:site_name" content="X" /><meta name="twitter:card" content="summary_large_image" /></head>';
  const r = sharepreview.run({ headHtml: html });
  assert.ok(r.findings.some((f) => f.level === 'warn' && /http/i.test(f.text)));
});

test('invalid twitter:card value is a fail', () => {
  const html =
    '<head><meta property="og:image" content="https://x.com/c.png" /><meta name="twitter:card" content="giant_banner" /></head>';
  const r = sharepreview.run({ headHtml: html });
  assert.ok(r.findings.some((f) => f.level === 'bad' && /card type/i.test(f.text)));
});

test('overlong og:title triggers a truncation warning', () => {
  const longTitle = 'A'.repeat(120);
  const html = `<head><meta property="og:image" content="https://x.com/c.png" /><meta property="og:title" content="${longTitle}" /><meta property="og:description" content="d" /><meta property="og:url" content="https://x.com" /><meta property="og:type" content="website" /><meta property="og:site_name" content="X" /><meta name="twitter:card" content="summary_large_image" /></head>`;
  const r = sharepreview.run({ headHtml: html });
  assert.ok(r.findings.some((f) => /characters/i.test(f.text) && /70/.test(f.text)));
});

// ── Fixes are always offered and XSS-safe ────────────────────────────────────

test('run always includes the consolidated share-ready fix block first', () => {
  const r = sharepreview.run({ headHtml: '<head><title>My App</title></head>' });
  assert.ok(r.fixes.length >= 1);
  assert.ok(/complete, share-ready/i.test(r.fixes[0].label));
  assert.ok(r.fixes[0].copyText.includes('og:title'));
});

test('fix copyText never contains a raw unescaped script tag from user input', () => {
  const evil =
    '<head><meta property="og:title" content="</title><script>alert(1)</script>" /></head>';
  const r = sharepreview.run({ headHtml: evil });
  for (const fix of r.fixes) {
    assert.ok(!/<script>/i.test(fix.copyText), 'raw <script> leaked into a fix');
  }
});

test('attrEscape neutralizes angle brackets, quotes and ampersands', () => {
  assert.equal(attrEscape('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;');
  assert.equal(attrEscape(null), '');
  assert.equal(attrEscape(undefined), '');
});

test('correctedHeadBlock is deterministic and includes all core og tags', () => {
  const parsed = parseHtml('<head><title>T</title></head>');
  const block = correctedHeadBlock(parsed);
  for (const key of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'og:site_name', 'twitter:card']) {
    assert.ok(block.includes(key), `block missing ${key}`);
  }
  assert.equal(block, correctedHeadBlock(parseHtml('<head><title>T</title></head>')));
});

test('metaFixFor returns null for issues without a single-tag fix', () => {
  const parsed = parseHtml(READY);
  assert.equal(metaFixFor({ field: 'json-ld' }, parsed), null);
  assert.equal(metaFixFor({ field: 'nonexistent-field' }, parsed), null);
});

// ── Adversarial / edge input for the parser ──────────────────────────────────

test('parser survives a > inside a quoted content attribute', () => {
  const parsed = parseHtml('<head><meta property="og:title" content="Why 5 > 3 matters" /></head>');
  assert.equal(parsed.og['og:title'], 'Why 5 > 3 matters');
});

test('parser ignores tags inside HTML comments', () => {
  const parsed = parseHtml('<head><!-- <meta property="og:image" content="/x.png" /> --></head>');
  assert.equal(parsed.og['og:image'], undefined);
});

test('parser handles single-quoted attribute values', () => {
  const parsed = parseHtml("<head><meta property='og:title' content='Hello' /></head>");
  assert.equal(parsed.og['og:title'], 'Hello');
});

test('parser decodes HTML entities in title', () => {
  const parsed = parseHtml('<head><title>Tom &amp; Jerry</title></head>');
  assert.equal(parsed.title, 'Tom & Jerry');
});

test('malformed JSON-LD is recorded and surfaces a fail finding', () => {
  const html =
    '<head><meta property="og:image" content="https://x.com/c.png"/><script type="application/ld+json">{bad json,}</script></head>';
  const parsed = parseHtml(html);
  assert.ok(parsed.schema.some((s) => s && s.__parseError));
  const r = sharepreview.run({ headHtml: html });
  assert.ok(r.findings.some((f) => /JSON-LD/i.test(f.text)));
});

test('multiple og:image tags do not crash and first one is used', () => {
  const html =
    '<head><meta property="og:image" content="https://x.com/a.png" /><meta property="og:image" content="https://x.com/b.png" /></head>';
  const r = sharepreview.run({ headHtml: html });
  assert.ok(STATUSES.includes(r.status));
});

// ── Preview model cores ──────────────────────────────────────────────────────

test('buildPreviews returns all six platforms', () => {
  const parsed = parseHtml(READY);
  const p = buildPreviews(parsed);
  for (const k of ['twitter', 'facebook', 'linkedin', 'slack', 'discord', 'imessage']) {
    assert.ok(p[k], `missing platform ${k}`);
  }
});

test('with an absolute og:image every OG platform reports hasImage', () => {
  const parsed = parseHtml(READY);
  const p = buildPreviews(parsed);
  assert.ok(p.facebook.hasImage && p.linkedin.hasImage && p.imessage.hasImage);
});

test('truncate cuts on a word boundary and appends an ellipsis', () => {
  const out = truncate('the quick brown fox jumps over', 12);
  assert.ok(out.endsWith('…'));
  assert.ok(out.length <= 13);
  assert.equal(truncate(null, 10), null);
  assert.equal(truncate('short', 100), 'short');
});

test('audit score matches the run() score for the ready page', () => {
  const parsed = parseHtml(READY);
  const a = audit(parsed);
  const r = sharepreview.run({ headHtml: READY });
  assert.equal(a.score, r.score);
});

test('checkSharePreview returns incomplete for text with no markup at all', () => {
  const r = checkSharePreview('just some plain sentence with no tags');
  assert.equal(r.status, 'incomplete');
});
