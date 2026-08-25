import { test } from 'node:test';
import assert from 'node:assert/strict';

import crawlers from '../src/modules/crawlers.js';
import { validateModule, STATUSES } from '../src/contract.js';
import {
  CRAWLERS,
  crawlerById,
  idsInCategory,
  companies,
} from '../src/modules/crawlers/data.js';
import {
  normalizeSelection,
  generateRobotsTxt,
  robotsLineFor,
  parseRobots,
  sanitizeToken,
} from '../src/modules/crawlers/generate.js';
import { analyze, desiredIds, hasIntent } from '../src/modules/crawlers/analyze.js';

// ── data.js ────────────────────────────────────────────────────────────────

test('CRAWLERS has entries and stable unique ids', () => {
  assert.ok(CRAWLERS.length >= 15);
  const ids = CRAWLERS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'ids must be unique');
});

test('every crawler has a ua, name, company and known category', () => {
  const cats = new Set(['training', 'assistant', 'search']);
  for (const c of CRAWLERS) {
    assert.equal(typeof c.ua, 'string');
    assert.ok(c.ua.length);
    assert.ok(c.name.length && c.company.length);
    assert.ok(cats.has(c.category), `${c.id} bad category ${c.category}`);
  }
});

test('crawlerById finds and misses cleanly', () => {
  assert.equal(crawlerById('gptbot').ua, 'GPTBot');
  assert.equal(crawlerById('nope'), null);
  assert.equal(crawlerById(undefined), null);
});

test('idsInCategory and companies work', () => {
  assert.ok(idsInCategory('training').includes('gptbot'));
  assert.ok(idsInCategory('training').includes('claudebot'));
  assert.equal(idsInCategory('bogus').length, 0);
  assert.ok(companies().includes('OpenAI'));
  assert.ok(companies().includes('Anthropic'));
});

// ── generate.js ──────────────────────────────────────────────────────────────

test('normalizeSelection dedupes, drops unknowns, keeps spec order', () => {
  const out = normalizeSelection(['ccbot', 'nope', 'gptbot', 'gptbot']);
  assert.deepEqual(out, ['gptbot', 'ccbot']); // spec order (gptbot before ccbot)
});

test('normalizeSelection tolerates junk input', () => {
  assert.deepEqual(normalizeSelection(undefined), []);
  assert.deepEqual(normalizeSelection(null), []);
  assert.deepEqual(normalizeSelection('gptbot'), []); // string is not an array
  assert.deepEqual(normalizeSelection(42), []);
});

test('generateRobotsTxt produces valid User-agent/Disallow blocks', () => {
  const txt = generateRobotsTxt(['gptbot', 'claudebot']);
  assert.match(txt, /User-agent: GPTBot/);
  assert.match(txt, /User-agent: ClaudeBot/);
  assert.match(txt, /Disallow: \//);
  // Exactly two Disallow lines for two bots.
  assert.equal((txt.match(/Disallow: \//g) || []).length, 2);
});

test('generateRobotsTxt with empty selection says nothing blocked', () => {
  const txt = generateRobotsTxt([]);
  assert.match(txt, /No AI crawlers selected/);
  assert.doesNotMatch(txt, /Disallow: \//);
});

test('generateRobotsTxt round-trips through parseRobots', () => {
  const ids = idsInCategory('training');
  const txt = generateRobotsTxt(ids);
  const parsed = parseRobots(txt);
  assert.deepEqual(parsed.blocked.sort(), normalizeSelection(ids).sort());
  assert.equal(parsed.wildcardBlocksAll, false);
});

test('robotsLineFor returns a 2-line block or empty', () => {
  assert.equal(robotsLineFor('gptbot'), 'User-agent: GPTBot\nDisallow: /');
  assert.equal(robotsLineFor('nope'), '');
});

// ── parseRobots ──────────────────────────────────────────────────────────────

test('parseRobots on empty/garbage input never throws and reports no content', () => {
  for (const bad of [undefined, null, '', 42, {}, []]) {
    const p = parseRobots(bad);
    assert.deepEqual(p.blocked, []);
    assert.equal(p.hasContent, false);
    assert.equal(p.wildcardBlocksAll, false);
  }
});

test('parseRobots detects a single blocked bot', () => {
  const p = parseRobots('User-agent: GPTBot\nDisallow: /');
  assert.deepEqual(p.blocked, ['gptbot']);
  assert.equal(p.hasContent, true);
});

test('parseRobots is case-insensitive on the UA token', () => {
  const p = parseRobots('user-agent: gptbot\ndisallow: /');
  assert.deepEqual(p.blocked, ['gptbot']);
});

test('parseRobots does NOT count Disallow: <empty> (that means allow all)', () => {
  const p = parseRobots('User-agent: GPTBot\nDisallow:');
  assert.deepEqual(p.blocked, []);
});

test('parseRobots handles multiple agents in one group', () => {
  const p = parseRobots('User-agent: GPTBot\nUser-agent: CCBot\nDisallow: /');
  assert.deepEqual(p.blocked.sort(), ['ccbot', 'gptbot']);
});

test('parseRobots flags a wildcard full-site block', () => {
  const p = parseRobots('User-agent: *\nDisallow: /');
  assert.equal(p.wildcardBlocksAll, true);
});

test('parseRobots ignores comments and blank lines', () => {
  const p = parseRobots('# my file\n\nUser-agent: GPTBot # openai\nDisallow: / # everything\n');
  assert.deepEqual(p.blocked, ['gptbot']);
});

test('parseRobots separates groups: a later allow-all group does not unblock', () => {
  const txt = 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow:';
  const p = parseRobots(txt);
  assert.deepEqual(p.blocked, ['gptbot']);
  assert.equal(p.wildcardBlocksAll, false);
});

// ── sanitizeToken (XSS / injection hardening) ────────────────────────────────

test('sanitizeToken strips newlines so a token cannot inject a robots.txt line', () => {
  assert.equal(sanitizeToken('GPTBot\nDisallow: /evil'), 'GPTBotDisallow: /evil');
  assert.equal(sanitizeToken('a\r\nb'), 'ab');
  assert.equal(sanitizeToken('\t\ttrim  '), 'trim');
  assert.equal(sanitizeToken(undefined), '');
});

test('generated robots.txt never contains raw script/HTML from data', () => {
  const txt = generateRobotsTxt(CRAWLERS.map((c) => c.id));
  assert.doesNotMatch(txt, /<script/i);
  assert.doesNotMatch(txt, /<\/?[a-z]+>/i);
});

// ── analyze / desiredIds ─────────────────────────────────────────────────────

test('desiredIds maps intent checkboxes to categories', () => {
  assert.deepEqual(desiredIds({ blockTraining: true }).sort(), idsInCategory('training').sort());
  assert.ok(hasIntent({ blockAssistants: true }));
  assert.equal(hasIntent({}), false);
  assert.equal(hasIntent(undefined), false);
  assert.equal(hasIntent('junk'), false);
});

test('analyze with no intent and no robots.txt is incomplete', () => {
  const r = analyze({});
  assert.equal(r.status, 'incomplete');
  assert.equal(r.score, 0);
  assert.deepEqual(r.fixes, []);
});

test('analyze: intent but no robots.txt → warn + offers a generated file', () => {
  const r = analyze({ blockTraining: true });
  assert.equal(r.status, 'warn');
  assert.ok(r.score > 0 && r.score < 100);
  assert.ok(r.fixes.length >= 1);
  assert.match(r.fixes[0].copyText, /User-agent: GPTBot/);
});

test('analyze: robots.txt fully covers the intent → pass, no fixes', () => {
  const robotsTxt = generateRobotsTxt(idsInCategory('training'));
  const r = analyze({ blockTraining: true, robotsTxt });
  assert.equal(r.status, 'pass');
  assert.equal(r.score, 100);
  assert.deepEqual(r.fixes, []);
});

test('analyze: robots.txt misses some wanted bots → fail + fix with all', () => {
  // Wants training + assistants, but file only blocks GPTBot.
  const r = analyze({
    blockTraining: true,
    blockAssistants: true,
    robotsTxt: 'User-agent: GPTBot\nDisallow: /',
  });
  assert.equal(r.status, 'fail');
  assert.ok(r.score >= 20 && r.score <= 100);
  assert.ok(r.fixes.length >= 1);
  // The fix should include ClaudeBot (training, wanted, not yet blocked).
  assert.match(r.fixes[0].copyText, /User-agent: ClaudeBot/);
});

test('analyze: wildcard block-all is a fail with a search-safe fix', () => {
  const r = analyze({ robotsTxt: 'User-agent: *\nDisallow: /' });
  assert.equal(r.status, 'fail');
  assert.ok(r.fixes.length >= 1);
  assert.ok(r.findings.some((f) => f.level === 'bad'));
});

test('analyze: robots.txt present, no intent, already blocks AI → pass', () => {
  const robotsTxt = 'User-agent: GPTBot\nDisallow: /';
  const r = analyze({ robotsTxt });
  assert.equal(r.status, 'pass');
  assert.equal(r.score, 100);
});

test('analyze: robots.txt present, no intent, blocks nothing → warn + opt-out fix', () => {
  const r = analyze({ robotsTxt: 'User-agent: Googlebot\nAllow: /' });
  assert.equal(r.status, 'warn');
  assert.ok(r.fixes.length >= 1);
  assert.match(r.fixes[0].copyText, /User-agent: GPTBot/);
});

test('analyze: intent fully met but wildcard also blocks search → warn', () => {
  const robotsTxt = generateRobotsTxt(idsInCategory('training')) + '\n\nUser-agent: *\nDisallow: /';
  const r = analyze({ blockTraining: true, robotsTxt });
  assert.equal(r.status, 'warn');
  assert.ok(r.fixes.length >= 1);
});

test('analyze never throws on adversarial input', () => {
  for (const bad of [undefined, null, 'string', 42, [], { robotsTxt: 123 }, { blockTraining: 'yes' }]) {
    assert.doesNotThrow(() => analyze(bad));
  }
});

// ── module contract / run() / formSpec() ─────────────────────────────────────

test('module satisfies the shared contract', () => {
  assert.deepEqual(validateModule(crawlers), []);
});

test('module id equals filename slot "crawlers"', () => {
  assert.equal(crawlers.id, 'crawlers');
});

test('run(undefined) returns a valid incomplete result', () => {
  const r = crawlers.run(undefined);
  assert.ok(STATUSES.includes(r.status));
  assert.equal(r.status, 'incomplete');
  assert.equal(r.score, 0);
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.fixes, []);
});

test('run() tolerates arbitrary/adversarial input without throwing', () => {
  for (const bad of [null, 'string', 42, [], { robotsTxt: 999 }]) {
    assert.doesNotThrow(() => crawlers.run(bad));
    const r = crawlers.run(bad);
    assert.ok(STATUSES.includes(r.status));
    assert.ok(r.score >= 0 && r.score <= 100);
  }
});

test('run() returns integer scores in 0..100', () => {
  const inputs = [
    { blockTraining: true },
    { blockTraining: true, robotsTxt: 'User-agent: GPTBot\nDisallow: /' },
    { robotsTxt: 'User-agent: *\nDisallow: /' },
    { blockTraining: true, blockAssistants: true, robotsTxt: 'User-agent: GPTBot\nDisallow: /' },
  ];
  for (const inp of inputs) {
    const r = crawlers.run(inp);
    assert.ok(Number.isInteger(r.score));
    assert.ok(r.score >= 0 && r.score <= 100);
  }
});

test('run() fixes carry paste-ready copyText and human labels', () => {
  const r = crawlers.run({ blockTraining: true });
  for (const fix of r.fixes) {
    assert.equal(typeof fix.label, 'string');
    assert.ok(fix.label.length > 0);
    assert.equal(typeof fix.copyText, 'string');
  }
});

test('run() output is XSS-safe: no HTML tags leak into findings/fixes', () => {
  const r = crawlers.run({
    blockTraining: true,
    blockAssistants: true,
    robotsTxt: '<script>alert(1)</script>\nUser-agent: GPTBot\nDisallow: /',
  });
  const blob = JSON.stringify(r);
  assert.doesNotMatch(blob, /<script/i);
});

test('formSpec fields include the four inputs with valid types', () => {
  const spec = crawlers.formSpec();
  const names = spec.fields.map((f) => f.name);
  assert.ok(names.includes('blockTraining'));
  assert.ok(names.includes('blockAssistants'));
  assert.ok(names.includes('blockSearchAi'));
  assert.ok(names.includes('robotsTxt'));
  const valid = new Set(['text', 'textarea', 'url', 'checkbox']);
  for (const f of spec.fields) assert.ok(valid.has(f.type));
});

test('formSpec examples only reference real field names', () => {
  const spec = crawlers.formSpec();
  const names = new Set(spec.fields.map((f) => f.name));
  assert.ok(spec.examples.length >= 1);
  for (const ex of spec.examples) {
    assert.equal(typeof ex.label, 'string');
    for (const key of Object.keys(ex.value)) {
      assert.ok(names.has(key), `example uses unknown field ${key}`);
    }
  }
});

test('formSpec examples actually drive run() to non-incomplete results', () => {
  const spec = crawlers.formSpec();
  for (const ex of spec.examples) {
    const r = crawlers.run(ex.value);
    assert.notEqual(r.status, 'incomplete', `example "${ex.label}" should produce a real check`);
  }
});
