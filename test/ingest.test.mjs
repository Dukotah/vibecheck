// ingest.test.mjs — the one-input promise, tested.
//
// If detection is wrong the whole product is wrong: you drop a folder in and
// the tool silently checks the wrong thing. These tests pin the guesses.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { detect, detectByName, isWorthReading, basename } from '../src/ingest/detect.js';
import {
  emptyBundle,
  addBlob,
  addUrlScan,
  setIntent,
  setSiteUrl,
  hasInputFor,
  usedSources,
} from '../src/ingest/bundle.js';

/* ── detect: by name ─────────────────────────────────────────────────────── */

test('file names that are unambiguous are trusted', () => {
  const cases = {
    'LICENSE': 'license',
    'license.txt': 'license',
    'LICENSE.md': 'license',
    'LICENSE-MIT': 'license',
    'COPYING': 'license',
    'README.md': 'readme',
    'readme': 'readme',
    'Readme.rst': 'readme',
    'package.json': 'packages',
    'requirements.txt': 'packages',
    'requirements-dev.txt': 'packages',
    'pyproject.toml': 'packages',
    'Pipfile': 'packages',
    'robots.txt': 'robots',
    'index.html': 'html',
    'about.htm': 'html',
    'docs/GUIDE.md': 'readme',
  };
  for (const [name, kind] of Object.entries(cases)) {
    assert.equal(detectByName(name), kind, `${name} should be ${kind}`);
  }
});

test('a path is reduced to its file name before matching', () => {
  assert.equal(basename('C:\\projects\\app\\package.json'), 'package.json');
  assert.equal(basename('/home/me/app/LICENSE'), 'license');
  assert.equal(detectByName('src/vendor/robots.txt'), 'robots');
});

test('an unknown file name yields no guess', () => {
  assert.equal(detectByName('main.tsx'), null);
  assert.equal(detectByName(''), null);
  assert.equal(detectByName(undefined), null);
});

/* ── detect: by content ──────────────────────────────────────────────────── */

test('HTML is recognized from a document, a fragment, or a bare head', () => {
  assert.equal(detect('<!doctype html><html><body>hi</body></html>').kind, 'html');
  assert.equal(detect('<html lang="en"><head><title>x</title></head></html>').kind, 'html');
  assert.equal(
    detect('<head><meta charset="utf-8"><title>x</title><link rel="stylesheet" href="a.css"></head>').kind,
    'html',
  );
});

test('robots.txt is recognized by its two required directives', () => {
  assert.equal(detect('User-agent: *\nDisallow: /admin\n').kind, 'robots');
  assert.equal(detect('user-agent: GPTBot\nallow: /\n').kind, 'robots');
  // A README that merely mentions robots.txt is not one.
  assert.notEqual(detect('# My app\n\nAdd a robots.txt file later.').kind, 'robots');
});

test('dependency manifests are recognized in both ecosystems', () => {
  assert.equal(detect(JSON.stringify({ name: 'a', version: '1.0.0' })).kind, 'packages');
  assert.equal(detect(JSON.stringify({ dependencies: { react: '^18' } })).kind, 'packages');
  assert.equal(detect('fastapi==0.110.0\nrequests>=2.31.0\n').kind, 'packages');
  assert.equal(detect('[tool.poetry.dependencies]\npython = "^3.11"\n').kind, 'packages');
});

test('license text is recognized without a file name', () => {
  assert.equal(detect('MIT License\n\nCopyright (c) 2026 You\n').kind, 'license');
  assert.equal(detect('Permission is hereby granted, free of charge, to any person').kind, 'license');
  assert.equal(detect('                Apache License\n           Version 2.0').kind, 'license');
  assert.equal(
    detect('This is free and unencumbered software released into the public domain.').kind,
    'license',
  );
});

test('markdown falls through to README', () => {
  assert.equal(detect('# My project\n\nIt does a thing.').kind, 'readme');
  assert.equal(detect('My project\n==========\n\nIt does a thing.').kind, 'readme');
});

test('a name beats content, except when the content is plainly a web page', () => {
  // A file called LICENSE holding markdown is still the license file.
  assert.equal(detect('# Not really a heading', 'LICENSE').confidence, 'name');
  assert.equal(detect('# Not really a heading', 'LICENSE').kind, 'license');
  // But a README.md that is actually an exported HTML page is HTML.
  assert.equal(detect('<!doctype html><html><head></head></html>', 'README.md').kind, 'html');
});

test('detect never throws and always returns a kind', () => {
  for (const input of [undefined, null, '', '   ', 0, {}, [], 'zzz']) {
    const out = detect(input);
    assert.equal(typeof out.kind, 'string');
    assert.ok(out.kind.length > 0);
  }
});

/* ── folder drops ────────────────────────────────────────────────────────── */

test('a folder drop skips build output and dependency trees', () => {
  const skip = [
    { path: 'node_modules/react/package.json', size: 100 },
    { path: 'app/.git/config', size: 100 },
    { path: 'dist/index.html', size: 100 },
    { path: '.next/server/page.js', size: 100 },
    { path: 'app/__pycache__/x.pyc', size: 100 },
    { path: 'src/App.tsx', size: 100 },
    { path: 'logo.png', size: 100 },
    { path: 'README.md', size: 9_000_000 },
  ];
  for (const f of skip) assert.equal(isWorthReading(f), false, `should skip ${f.path}`);

  const keep = [
    { path: 'README.md', size: 2000 },
    { path: 'package.json', size: 900 },
    { path: 'LICENSE', size: 1100 },
    { path: 'public/robots.txt', size: 60 },
    { path: 'index.html', size: 5000 },
  ];
  for (const f of keep) assert.equal(isWorthReading(f), true, `should read ${f.path}`);
});

/* ── bundle assembly ─────────────────────────────────────────────────────── */

const HTML = '<!doctype html><html lang="en"><head><title>App</title></head><body><h1>App</h1></body></html>';

test('an empty bundle can run nothing', () => {
  const b = emptyBundle();
  for (const id of ['legal', 'accessibility', 'crawlers', 'sharepreview', 'docs']) {
    assert.equal(hasInputFor(b, id), false, `${id} should have no input`);
  }
});

test('one HTML file feeds both of the checks that need a page', () => {
  const b = addBlob(emptyBundle(), { text: HTML, name: 'index.html', origin: 'file' });
  assert.equal(hasInputFor(b, 'accessibility'), true);
  assert.equal(hasInputFor(b, 'sharepreview'), true);
  assert.equal(b.inputs.accessibility.html, HTML);
  assert.equal(b.inputs.sharepreview.headHtml, HTML);
});

test('a license and a manifest both land on the legal check', () => {
  let b = emptyBundle();
  b = addBlob(b, { text: 'MIT License\n\nCopyright (c) 2026 You', name: 'LICENSE', origin: 'file' });
  b = addBlob(b, { text: JSON.stringify({ dependencies: { react: '^18' } }), name: 'package.json', origin: 'file' });
  assert.ok(b.inputs.legal.licenseText.startsWith('MIT License'));
  assert.ok(b.inputs.legal.packages.includes('react'));
  assert.equal(hasInputFor(b, 'legal'), true);
});

test('index.html wins over another page, whatever the order', () => {
  const other = '<html><head><title>Other</title></head><body>other</body></html>';
  let a = emptyBundle();
  a = addBlob(a, { text: other, name: 'about.html', origin: 'file' });
  a = addBlob(a, { text: HTML, name: 'index.html', origin: 'file' });
  assert.equal(a.inputs.accessibility.html, HTML);

  let b = emptyBundle();
  b = addBlob(b, { text: HTML, name: 'index.html', origin: 'file' });
  b = addBlob(b, { text: other, name: 'about.html', origin: 'file' });
  assert.equal(b.inputs.accessibility.html, HTML, 'index.html should not be displaced');
});

test('package.json wins over requirements.txt in a polyglot repo', () => {
  let b = emptyBundle();
  b = addBlob(b, { text: 'fastapi==0.110.0\nrequests>=2.31.0\n', name: 'requirements.txt', origin: 'file' });
  b = addBlob(b, { text: JSON.stringify({ dependencies: { react: '^18' } }), name: 'package.json', origin: 'file' });
  assert.ok(b.inputs.legal.packages.includes('react'));
});

test('only one source of a kind is ever marked used', () => {
  let b = emptyBundle();
  b = addBlob(b, { text: '# One', name: 'README.md', origin: 'file' });
  b = addBlob(b, { text: '# Two, and longer than the first one by some margin', name: 'readme.txt', origin: 'file' });
  const readmes = usedSources(b).filter((s) => s.kind === 'readme');
  assert.equal(readmes.length, 1);
  assert.equal(b.sources.length, 2, 'the loser is still recorded, just not used');
});

test('an unusable blob is recorded but feeds nothing', () => {
  const b = addBlob(emptyBundle(), { text: 'just some prose with no structure at all', origin: 'paste' });
  assert.equal(b.sources.length, 1);
  assert.equal(b.sources[0].used, false);
  assert.equal(b.sources[0].kind, 'unknown');
});

test('empty and malformed blobs are ignored, not crashed on', () => {
  for (const blob of [undefined, null, {}, { text: '' }, { text: '   ' }, { text: 42 }]) {
    const b = addBlob(emptyBundle(), blob);
    assert.equal(b.sources.length, 0);
  }
});

test('adding a blob does not mutate the bundle it came from', () => {
  const before = addBlob(emptyBundle(), { text: HTML, name: 'index.html', origin: 'file' });
  const snapshot = JSON.stringify(before);
  addBlob(before, { text: '# Readme', name: 'README.md', origin: 'file' });
  assert.equal(JSON.stringify(before), snapshot, 'addBlob must return a new bundle');
});

/* ── URL scans ───────────────────────────────────────────────────────────── */

test('a URL scan fills the three checks a live page can answer', () => {
  const b = addUrlScan(emptyBundle(), {
    finalUrl: 'https://example.com/',
    html: HTML,
    robotsTxt: 'User-agent: GPTBot\nDisallow: /\n',
    robotsFound: true,
  });
  assert.equal(b.siteUrl, 'https://example.com/');
  assert.equal(hasInputFor(b, 'accessibility'), true);
  assert.equal(hasInputFor(b, 'sharepreview'), true);
  assert.equal(hasInputFor(b, 'crawlers'), true);
  // The page address must reach the share-preview check so relative image
  // paths can be resolved into the absolute URLs sharing apps require.
  assert.equal(b.inputs.sharepreview.pageUrl, 'https://example.com/');
  // A live URL cannot show us these.
  assert.equal(hasInputFor(b, 'legal'), false);
  assert.equal(hasInputFor(b, 'docs'), false);
});

test('a missing robots.txt is a finding, not a gap', () => {
  const b = addUrlScan(emptyBundle(), {
    finalUrl: 'https://example.com/',
    html: HTML,
    robotsTxt: '',
    robotsFound: false,
  });
  // Default intent (block training bots) plus an empty file is enough to run.
  assert.equal(hasInputFor(b, 'crawlers'), true);
  assert.equal(b.inputs.crawlers.robotsTxt, '');
  const robots = b.sources.find((s) => s.kind === 'robots');
  assert.equal(robots.missing, true);
});

test('a truncated page is disclosed, not hidden', () => {
  const b = addUrlScan(emptyBundle(), {
    finalUrl: 'https://example.com/',
    html: HTML,
    robotsFound: false,
    truncated: true,
  });
  assert.ok(b.notes.some((n) => /large/i.test(n)));
});

test('addUrlScan tolerates a garbage response', () => {
  for (const scan of [undefined, null, {}, { html: 42 }, { finalUrl: 5 }]) {
    const b = addUrlScan(emptyBundle(), scan);
    assert.equal(typeof b.siteUrl, 'string');
  }
});

/* ── intent + site url ───────────────────────────────────────────────────── */

test('changing the blocking intent re-arms the crawlers check', () => {
  let b = addUrlScan(emptyBundle(), {
    finalUrl: 'https://example.com/',
    html: HTML,
    robotsTxt: 'User-agent: *\nAllow: /\n',
    robotsFound: true,
  });
  b = setIntent(b, { blockTraining: false, blockAssistants: true });
  assert.equal(b.inputs.crawlers.blockTraining, false);
  assert.equal(b.inputs.crawlers.blockAssistants, true);
  assert.ok(b.inputs.crawlers.robotsTxt.includes('User-agent'), 'the file itself is preserved');
});

test('setting the site url later still reaches the share-preview check', () => {
  let b = addBlob(emptyBundle(), { text: HTML, name: 'index.html', origin: 'file' });
  b = setSiteUrl(b, 'https://mine.dev/');
  assert.equal(b.inputs.sharepreview.pageUrl, 'https://mine.dev/');
});
