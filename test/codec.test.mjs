// codec.test.mjs — share links.
//
// Two things matter here. One: a link must survive a round trip, or people post
// a score that does not load. Two: a link is untrusted input from the internet,
// so decode has to be hostile-proof — it is going straight into the page.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  encodeReport,
  decodeReport,
  buildPayload,
  shareUrl,
  badgeMarkdown,
  toBase64Url,
  fromBase64Url,
  SHARE_VERSION,
} from '../src/share/codec.js';
import { aggregate } from '../src/score.js';

function entry(id, status, score, fixes = []) {
  return {
    id,
    title: id.toUpperCase(),
    result: { status, score, summary: `${id} summary`, findings: [], fixes },
  };
}

const SAMPLE = [
  entry('legal', 'fail', 20, [{ label: 'Add a LICENSE file', copyText: 'MIT License...' }]),
  entry('accessibility', 'warn', 72, [{ label: 'Add alt text to 3 images', copyText: '<img alt="...">' }]),
  entry('crawlers', 'pass', 100),
  entry('sharepreview', 'warn', 60),
  entry('docs', 'incomplete', 0),
];

/* ── base64url ───────────────────────────────────────────────────────────── */

test('base64url survives a round trip, including non-ASCII', () => {
  for (const s of ['', 'hello', '{"a":1}', 'héllo — wörld ✅', '🚀'.repeat(20)]) {
    assert.equal(fromBase64Url(toBase64Url(s)), s);
  }
});

test('base64url output is URL-safe', () => {
  const token = toBase64Url(JSON.stringify({ padding: '???>>><<<' + 'ÿ'.repeat(30) }));
  assert.ok(!/[+/=]/.test(token), `token must be url-safe, got ${token}`);
});

test('decoding garbage returns an empty string rather than throwing', () => {
  for (const bad of [undefined, null, '!!!', '@@@@', 42, {}]) {
    assert.equal(typeof fromBase64Url(bad), 'string');
  }
});

/* ── round trip ──────────────────────────────────────────────────────────── */

test('a report round-trips through a share link', () => {
  const overall = aggregate(SAMPLE);
  const at = 1_800_000_000_000;
  const token = encodeReport(overall, { siteUrl: 'https://my-app.vercel.app/', at });
  const back = decodeReport(token);

  assert.ok(back);
  assert.equal(back.version, SHARE_VERSION);
  assert.equal(back.score, overall.score);
  assert.equal(back.siteUrl, 'https://my-app.vercel.app/');
  assert.equal(back.checks.length, SAMPLE.length);
  assert.deepEqual(
    back.checks.map((c) => c.id),
    SAMPLE.map((e) => e.id),
  );
  assert.equal(back.checks[0].status, 'fail');
  assert.equal(back.checks[2].status, 'pass');
  assert.equal(back.checks[4].status, 'incomplete');
  // Timestamps are stored to the minute, so allow that much drift.
  assert.ok(Math.abs(back.at - at) < 60_000);
});

test('the share payload publishes a score and nothing else', () => {
  const payload = buildPayload(aggregate(SAMPLE), { siteUrl: 'https://x.dev' });
  const json = JSON.stringify(payload);
  // Everything that describes what is actually wrong stays on the machine that
  // ran the check. A shared link is a score card, not a disclosure.
  assert.ok(!json.includes('Add a LICENSE file'), 'fix labels must stay private');
  assert.ok(!json.includes('MIT License...'), 'paste-ready text must stay private');
  assert.ok(!json.includes('summary'), 'per-check summaries must stay private');
  assert.ok(!json.includes('alt text'), 'finding text must stay private');
  // What it does carry: version, score, url, timestamp, per-check verdicts.
  assert.deepEqual(Object.keys(payload).sort(), ['c', 's', 't', 'u', 'v']);
});

test('a share link stays short enough to post', () => {
  const token = encodeReport(aggregate(SAMPLE), { siteUrl: 'https://my-app.vercel.app/some/deep/path' });
  const url = shareUrl('https://vibecheck.copperbaytech.com', token);
  assert.ok(url.length < 400, `share link is ${url.length} chars, too long to paste comfortably`);
  assert.ok(url.startsWith('https://vibecheck.copperbaytech.com/?r='));
});

test('nothing to share yields no token', () => {
  assert.equal(encodeReport(aggregate([]), {}), '');
  assert.equal(encodeReport(undefined, undefined), '');
});

/* ── hostile tokens ──────────────────────────────────────────────────────── */

test('malformed tokens are rejected, never partially rendered', () => {
  const bad = [
    '',
    null,
    undefined,
    'not base64 at all !!!',
    toBase64Url('not json'),
    toBase64Url('[]'),
    toBase64Url('null'),
    toBase64Url('"a string"'),
    toBase64Url('{}'),
    toBase64Url('{"v":1}'),
    toBase64Url('{"v":1,"c":[]}'),
    toBase64Url(`{"v":${SHARE_VERSION + 1},"c":[["a",1,50]]}`),
    toBase64Url('{"v":0,"c":[["a",1,50]]}'),
  ];
  for (const token of bad) {
    assert.equal(decodeReport(token), null, `should reject ${JSON.stringify(token)}`);
  }
});

test('a dangerous site URL never survives decoding', () => {
  for (const u of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x', 'file:///etc/passwd']) {
    const token = toBase64Url(JSON.stringify({ v: 1, s: 50, u, c: [['legal', 1, 50]] }));
    assert.equal(decodeReport(token).siteUrl, '', `should strip ${u}`);
  }
  const okToken = toBase64Url(JSON.stringify({ v: 1, s: 50, u: 'https://ok.dev', c: [['legal', 1, 50]] }));
  assert.equal(decodeReport(okToken).siteUrl, 'https://ok.dev');
});

test('out-of-range and wrong-typed fields are clamped, not trusted', () => {
  const token = toBase64Url(
    JSON.stringify({
      v: 1,
      s: 9999,
      t: -5,
      c: [['legal', 99, 500], ['docs', -1, -20], [null, 1, 1], 'garbage'],
    }),
  );
  const back = decodeReport(token);
  assert.ok(back);
  assert.equal(back.score, 100, 'score is clamped to 100');
  assert.equal(back.at, 0, 'a negative timestamp is dropped');
  assert.equal(back.checks.length, 2, 'unusable rows are dropped');
  assert.equal(back.checks[0].score, 100);
  assert.equal(back.checks[0].status, 'incomplete', 'an unknown status code falls back to incomplete');
  assert.equal(back.checks[1].score, 0);
});

test('an absurd number of checks is capped', () => {
  const many = Array.from({ length: 200 }, (_, i) => [`c${i}`, 1, 50]);
  const back = decodeReport(toBase64Url(JSON.stringify({ v: 1, s: 50, c: many })));
  assert.ok(back.checks.length <= 12);
});

/* ── badge ───────────────────────────────────────────────────────────────── */

test('the README badge is valid markdown pointing at our own endpoint', () => {
  const md = badgeMarkdown('https://vibecheck.copperbaytech.com/', 87, 'https://vibecheck.copperbaytech.com/?r=abc');
  assert.equal(
    md,
    '[![Launch Readiness: 87/100](https://vibecheck.copperbaytech.com/api/badge?score=87)](https://vibecheck.copperbaytech.com/?r=abc)',
  );
});

test('the badge clamps a nonsense score', () => {
  assert.ok(badgeMarkdown('https://x.dev', 999).includes('score=100'));
  assert.ok(badgeMarkdown('https://x.dev', -5).includes('score=0'));
  assert.ok(badgeMarkdown('https://x.dev', 'abc').includes('score=0'));
});

test('shareUrl strips anything already on the origin', () => {
  assert.equal(shareUrl('https://x.dev/?r=old#frag', 'tok'), 'https://x.dev/?r=tok');
  assert.equal(shareUrl('https://x.dev/', 'tok'), 'https://x.dev/?r=tok');
});
