import { test } from 'node:test';
import assert from 'node:assert/strict';

import docs from '../src/modules/docs.js';
import { validateModule, STATUSES, FINDING_LEVELS } from '../src/contract.js';
import {
  toText,
  wordCount,
  lineCount,
  extractHeadings,
  firstTitle,
  hasCodeBlock,
  hasBadge,
  hasImage,
  detectSections,
  checkReadme,
} from '../src/modules/docs/analyze.js';
import {
  fenceFor,
  codeBlock,
  licenseBlurb,
  generateReadme,
  sectionSnippet,
} from '../src/modules/docs/template.js';

const SOLID = [
  '# Recipe Keeper',
  '',
  '> A simple app to save and organize your favorite recipes.',
  '',
  '## Installation',
  '',
  '```bash',
  'npm install',
  'npm run dev',
  '```',
  '',
  '## Usage',
  '',
  'Open http://localhost:3000 and click "New Recipe".',
  '',
  '## License',
  '',
  'MIT',
].join('\n');

// ── Contract compliance ──────────────────────────────────────────────────────

test('module satisfies the VibeCheck contract', () => {
  assert.deepEqual(validateModule(docs), []);
});

test('id equals its filename slot', () => {
  assert.equal(docs.id, 'docs');
});

test('run(undefined) is a neutral incomplete result with score 0', () => {
  const r = docs.run(undefined);
  assert.equal(r.status, 'incomplete');
  assert.equal(r.score, 0);
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.fixes, []);
  assert.ok(r.summary.length > 0);
});

test('run tolerates adversarial input without throwing', () => {
  for (const bad of [null, undefined, 'string', 42, [], true, { readme: 123 }, { readme: {} }, NaN]) {
    assert.doesNotThrow(() => docs.run(bad));
    const r = docs.run(bad);
    assert.ok(STATUSES.includes(r.status));
    assert.ok(Number.isInteger(r.score) && r.score >= 0 && r.score <= 100);
    assert.ok(Array.isArray(r.findings) && Array.isArray(r.fixes));
  }
});

test('every finding uses a valid level and string text', () => {
  const r = docs.run({ readme: SOLID });
  for (const f of r.findings) {
    assert.ok(FINDING_LEVELS.includes(f.level));
    assert.equal(typeof f.text, 'string');
  }
});

// ── run(): pasted-README scoring ─────────────────────────────────────────────

test('a solid README passes with a high score', () => {
  const r = docs.run({ readme: SOLID });
  assert.equal(r.status, 'pass');
  assert.ok(r.score >= 80, `expected >=80, got ${r.score}`);
  assert.equal(r.fixes.length, 0, 'a passing README needs no fixes');
});

test('a bare one-line README fails', () => {
  const r = docs.run({ readme: '# My App\n\nA thing I built.' });
  assert.equal(r.status, 'fail');
  assert.ok(r.score < 50);
  assert.ok(r.fixes.length > 0, 'a failing README should offer fixes');
});

test('an empty/whitespace README with no answers is incomplete', () => {
  assert.equal(docs.run({ readme: '' }).status, 'incomplete');
  assert.equal(docs.run({ readme: '   \n\t  ' }).status, 'incomplete');
});

test('failing README offers a whole-file starter fix', () => {
  const r = docs.run({ readme: '# X' });
  const starter = r.fixes.find((f) => /starter/i.test(f.label));
  assert.ok(starter, 'expected a whole-file starter fix');
  assert.ok(starter.copyText.includes('## Installation'));
  assert.ok(starter.copyText.includes('## License'));
});

test('missing-section fixes are labeled per section', () => {
  const r = docs.run({ readme: '# App\n\nDoes a useful thing for a specific set of people.' });
  const labels = r.fixes.map((f) => f.label).join(' | ');
  assert.ok(/install/i.test(labels));
  assert.ok(/usage/i.test(labels));
  assert.ok(/license/i.test(labels));
});

test('a warn-tier README gets warn status, not fail', () => {
  // Title + description + install + license but no usage → 15+20+20+15 = 70.
  const md = [
    '# Toolbox',
    '',
    '> A small toolbox of scripts for tidying up messy CSV files quickly.',
    '',
    '## Installation',
    '',
    'pip install toolbox',
    '',
    '## License',
    '',
    'MIT',
  ].join('\n');
  const r = docs.run({ readme: md });
  assert.equal(r.status, 'warn');
  assert.ok(r.score >= 50 && r.score < 80);
});

test('inline license mention (no heading) is detected', () => {
  const s = detectSections('# App\n\nGreat tool for many people. Licensed under the MIT license.');
  assert.equal(s.hasLicense, true);
});

// ── run(): guided-answers path (generate a README) ───────────────────────────

test('guided answers with no README generate a copyable README fix', () => {
  const r = docs.run({
    name: 'Recipe Keeper',
    description: 'A simple app to save and organize your favorite recipes.',
    install: 'npm install\nnpm run dev',
    usage: 'Open http://localhost:3000 and click "New Recipe".',
    license: 'MIT',
  });
  assert.ok(['pass', 'warn'].includes(r.status));
  const gen = r.fixes.find((f) => /README/i.test(f.label));
  assert.ok(gen);
  assert.ok(gen.copyText.startsWith('# Recipe Keeper'));
  assert.ok(gen.copyText.includes('## Usage'));
});

test('a single guided answer still produces a generated README (not incomplete)', () => {
  const r = docs.run({ name: 'Solo' });
  assert.notEqual(r.status, 'incomplete');
  assert.ok(r.fixes.some((f) => f.copyText.includes('# Solo')));
});

test('whitespace README plus guided answers uses the guided path', () => {
  const r = docs.run({ readme: '   ', name: 'Fallback', description: 'x'.repeat(50) });
  assert.notEqual(r.status, 'incomplete');
  assert.ok(r.fixes.some((f) => f.copyText.includes('# Fallback')));
});

// ── XSS-safety of fix output ─────────────────────────────────────────────────

test('generated fix copyText is plain markdown, not raw HTML injection', () => {
  const r = docs.run({ name: '<script>alert(1)</script>', description: '<img src=x onerror=alert(1)>' });
  const text = r.fixes.map((f) => f.copyText).join('\n');
  // The generator does not wrap user text in HTML tags of its own; the shell
  // renders everything via textContent, so the literal string is inert. We just
  // assert we never emit a *constructed* executable tag around user input.
  assert.ok(!/<script>[^<]*<\/script>\s*<\/h1>/i.test(text));
  // The user's literal text is preserved as data (Markdown title line).
  assert.ok(text.includes('# <script>alert(1)</script>'));
});

test('fixes always have string label and copyText', () => {
  const r = docs.run({ readme: '# X' });
  for (const f of r.fixes) {
    assert.equal(typeof f.label, 'string');
    assert.equal(typeof f.copyText, 'string');
  }
});

// ── analyze.js core ──────────────────────────────────────────────────────────

test('toText coerces non-strings safely', () => {
  assert.equal(toText(null), '');
  assert.equal(toText(undefined), '');
  assert.equal(toText(42), '42');
  assert.equal(toText({}), '');
  assert.equal(toText('hi'), 'hi');
});

test('wordCount and lineCount handle junk input', () => {
  assert.equal(wordCount(null), 0);
  assert.equal(wordCount('  '), 0);
  assert.equal(wordCount('one two  three'), 3);
  assert.equal(lineCount('a\n\nb\n  \nc'), 3);
});

test('extractHeadings ignores # inside fenced code blocks', () => {
  const md = '# Real Title\n\n```bash\n# this is a shell comment\nnpm i\n```\n\n## Usage';
  const hs = extractHeadings(md);
  assert.deepEqual(hs.map((h) => h.text), ['Real Title', 'Usage']);
});

test('firstTitle returns the H1 text or empty', () => {
  assert.equal(firstTitle('# Hello\n## Sub'), 'Hello');
  assert.equal(firstTitle('no headings here'), '');
  assert.equal(firstTitle('## only h2'), '');
});

test('hasCodeBlock detects fenced and indented code', () => {
  assert.equal(hasCodeBlock('```\nnpm i\n```'), true);
  assert.equal(hasCodeBlock('~~~\ncode\n~~~'), true);
  assert.equal(hasCodeBlock('text\n\n    indented code'), true);
  assert.equal(hasCodeBlock('just prose'), false);
  assert.equal(hasCodeBlock('```\n\n```'), false, 'empty fence is not a code block');
});

test('hasCodeBlock is ReDoS-safe on a long run of backticks (no catastrophic backtracking)', () => {
  // Regression: the old regex /(```+|~~~+)[^\n]*\n([\s\S]*?)\n\1/ took ~3.5s at
  // 3000 backticks and hung the tab at 6000+. A long unbroken backtick run is
  // easy to hit accidentally (a mangled paste) and trivial to weaponize. The
  // linear scan must finish this near-instantly. 50k backticks, hard bound.
  const payload = '`'.repeat(50000);
  const start = Date.now();
  const result = hasCodeBlock(payload);
  const elapsed = Date.now() - start;
  assert.equal(result, false, 'a run of backticks with no newline is not a code block');
  assert.ok(elapsed < 500, `hasCodeBlock should be O(n); took ${elapsed}ms (ReDoS regression)`);
});

test('checkReadme is ReDoS-safe on hostile backtick-heavy input', () => {
  // End-to-end: the full README analyzer (which calls hasCodeBlock) must not hang
  // on pasted input that is a giant backtick run.
  const start = Date.now();
  const rep = checkReadme('`'.repeat(50000));
  const elapsed = Date.now() - start;
  assert.ok(rep.score >= 0 && rep.score <= 100);
  assert.ok(elapsed < 1000, `checkReadme should not backtrack catastrophically; took ${elapsed}ms`);
});

test('hasBadge and hasImage detect shields and images', () => {
  assert.equal(hasBadge('![build](https://img.shields.io/badge/x.svg)'), true);
  assert.equal(hasImage('![shot](./screenshot.png)'), true);
  assert.equal(hasBadge('![shot](./screenshot.png)'), false);
  assert.equal(hasImage('no images'), false);
});

test('detectSections flags an empty README', () => {
  const s = detectSections('');
  assert.equal(s.empty, true);
  assert.equal(s.hasTitle, false);
});

test('detectSections recognizes install commands without a heading', () => {
  const s = detectSections('# App\n\nRun `npm install` then `npm run dev` to start it up locally now.');
  assert.equal(s.hasInstall, true);
});

test('checkReadme scores each essential additively', () => {
  const rep = checkReadme(SOLID);
  assert.equal(rep.empty, false);
  assert.ok(rep.score >= 80);
  assert.deepEqual(rep.missing, []);
});

test('checkReadme on empty returns score 0 and all essentials missing', () => {
  const rep = checkReadme('');
  assert.equal(rep.empty, true);
  assert.equal(rep.score, 0);
  assert.ok(rep.missing.includes('hasTitle'));
  assert.ok(rep.missing.includes('hasLicense'));
});

test('checkReadme never returns a score outside 0..100', () => {
  for (const input of ['', SOLID, '# x', null, undefined, 'a '.repeat(5000)]) {
    const rep = checkReadme(input);
    assert.ok(rep.score >= 0 && rep.score <= 100);
  }
});

// ── template.js core ─────────────────────────────────────────────────────────

test('fenceFor grows past backtick runs in user code', () => {
  assert.equal(fenceFor('plain'), '```');
  assert.equal(fenceFor('has ``` fence inside'), '````');
  assert.equal(fenceFor('```` four'), '`````');
});

test('codeBlock wraps body and never lets it escape the fence', () => {
  const block = codeBlock('echo ```oops```', 'bash');
  const fence = block.split('\n')[0].replace('bash', '');
  assert.ok(fence.length >= 4, 'fence must be longer than the inner run');
  assert.ok(block.startsWith(fence + 'bash'));
  assert.ok(block.trimEnd().endsWith(fence));
});

test('licenseBlurb defaults unknown/blank to MIT (suggested)', () => {
  assert.equal(licenseBlurb('').name, 'MIT');
  assert.equal(licenseBlurb('').suggested, true);
  assert.equal(licenseBlurb('none').name, 'MIT');
  assert.equal(licenseBlurb('MIT').suggested, false);
  assert.equal(licenseBlurb('apache 2.0').name, 'Apache-2.0');
  assert.ok(/GPL/.test(licenseBlurb('gplv3').name));
});

test('generateReadme is deterministic and always has the core sections', () => {
  const input = { name: 'Foo', description: 'Bar baz', install: 'make', usage: 'run it', license: 'MIT' };
  const a = generateReadme(input);
  const b = generateReadme(input);
  assert.equal(a, b, 'same input must yield byte-identical output');
  assert.ok(a.startsWith('# Foo'));
  assert.ok(a.includes('## Installation'));
  assert.ok(a.includes('## Usage'));
  assert.ok(a.includes('## License'));
  assert.ok(a.endsWith('\n'));
});

test('generateReadme fills sensible defaults when fields are blank', () => {
  const md = generateReadme({});
  assert.ok(md.includes('# Your Project'));
  assert.ok(md.includes('npm install'));
  assert.ok(md.includes('MIT'));
});

test('generateReadme never throws on junk input', () => {
  for (const bad of [null, undefined, 'string', 42, [], { name: {} }]) {
    assert.doesNotThrow(() => generateReadme(bad));
    assert.ok(generateReadme(bad).endsWith('\n'));
  }
});

test('sectionSnippet returns just the requested section', () => {
  assert.ok(sectionSnippet('title', { name: 'Z' }).startsWith('# Z'));
  assert.ok(sectionSnippet('install', {}).startsWith('## Installation'));
  assert.ok(sectionSnippet('usage', { usage: 'do it' }).startsWith('## Usage'));
  assert.ok(sectionSnippet('license', { license: 'MIT' }).startsWith('## License'));
  assert.equal(sectionSnippet('nope', {}), '');
});

// ── formSpec ─────────────────────────────────────────────────────────────────

test('formSpec fields all have valid types and plain-language labels', () => {
  const spec = docs.formSpec();
  const valid = new Set(['text', 'textarea', 'url', 'checkbox']);
  assert.ok(spec.fields.length >= 1);
  for (const f of spec.fields) {
    assert.ok(valid.has(f.type), `bad type ${f.type}`);
    assert.equal(typeof f.label, 'string');
    assert.ok(f.label.length > 0);
    // Non-technical: no bare "README.md path" jargon in the primary label of
    // the guided questions (readme paste field is allowed to say README).
  }
});

test('formSpec examples only reference real field names', () => {
  const spec = docs.formSpec();
  const names = new Set(spec.fields.map((f) => f.name));
  assert.ok(spec.examples.length >= 1);
  for (const ex of spec.examples) {
    assert.equal(typeof ex.label, 'string');
    for (const key of Object.keys(ex.value)) {
      assert.ok(names.has(key), `example references unknown field ${key}`);
    }
  }
});

test('formSpec examples actually run through run() to the expected status', () => {
  const spec = docs.formSpec();
  const byLabel = Object.fromEntries(spec.examples.map((e) => [e.label, e.value]));
  assert.equal(docs.run(byLabel['A bare one-line README (needs work)']).status, 'fail');
  assert.equal(docs.run(byLabel['A solid README (passes)']).status, 'pass');
  assert.ok(['pass', 'warn'].includes(docs.run(byLabel['No README — build one from answers']).status));
});
