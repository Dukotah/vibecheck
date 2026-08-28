// rendered.test.mjs — the single-page-app shell guard.
//
// This is the check that stops VibeCheck lying to the exact people it is for.
// Lovable, Bolt, v0 and Replit routinely ship client-rendered apps whose served
// HTML is a mount div and a script tag. Scanned naively, that page has no images
// missing alt text and no unlabelled inputs, so it scores well — confidently,
// and meaninglessly.
//
// Two directions matter, and they are not symmetric. A false positive tells
// someone with a real page that we could not read it: annoying, honest, and
// they can paste. A false negative hands them a good score for an empty page and
// they believe it. The heuristic leans accordingly, and so do these tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { detectShell, hasEmptyMount, SHELL_NOTE } from '../src/ingest/rendered.js';
import { emptyBundle, addUrlScan, addBlob, hasInputFor } from '../src/ingest/bundle.js';

const S = '<' + 'script';
const ES = '</' + 'script>';

const VITE_SHELL = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>My App</title>${S} type="module" crossorigin src="/assets/index-a1b2.js"${ES}<link rel="stylesheet" href="/assets/index.css"></head><body><div id="root"></div></body></html>`;

const CRA_SHELL = `<html lang="en"><head><title>React App</title></head><body><noscript>You need to enable JavaScript to run this app.</noscript><div id="root"></div>${S} src="/static/js/main.js"${ES}</body></html>`;

const NEXT_SHELL = `<html><head><title>x</title></head><body><div id="__next"></div>${S} src="/_next/static/x.js"${ES}</body></html>`;

const REAL_PAGE = `<html lang="en"><head><title>Recipe Keeper</title></head><body><h1>Recipe Keeper</h1><p>Save and organize the recipes you actually cook, for people who keep losing the paper ones.</p><img src="a.png" alt="A stack of recipe cards"><a href="/pricing">See our pricing</a><form><label for="e">Email</label><input id="e"></form>${S} src="/app.js"${ES}</body></html>`;

const STATIC_PAGE = '<html lang="en"><head><title>Hello</title></head><body><h1>Hello</h1><p>A small page with no JavaScript at all.</p></body></html>';

/* ── shells are caught ───────────────────────────────────────────────────── */

test('the common single-page-app shells are recognized', () => {
  for (const [name, html] of Object.entries({
    vite: VITE_SHELL,
    cra: CRA_SHELL,
    next: NEXT_SHELL,
  })) {
    const r = detectShell(html);
    assert.equal(r.shell, true, `${name} shell should be detected`);
    assert.ok(r.reason.length > 0, `${name} should explain itself`);
  }
});

test('an empty body with a script is treated as a shell', () => {
  const html = `<html><head><title>x</title></head><body>${S} src="/a.js"${ES}</body></html>`;
  assert.equal(detectShell(html).shell, true);
});

test('empty mount nodes are found across frameworks', () => {
  assert.equal(hasEmptyMount('<div id="root"></div>'), true);
  assert.equal(hasEmptyMount("<div id='app'>   </div>"), true);
  assert.equal(hasEmptyMount('<div id="__next"></div>'), true);
  assert.equal(hasEmptyMount('<main id="app"></main>'), true);
  // A mount node that already has content in it is a rendered page.
  assert.equal(hasEmptyMount('<div id="root"><h1>Hi</h1></div>'), false);
});

/* ── real pages are NOT caught ───────────────────────────────────────────── */

test('a real page that also ships JavaScript is not a shell', () => {
  assert.equal(detectShell(REAL_PAGE).shell, false);
});

test('a page with no JavaScript is never a shell', () => {
  assert.equal(detectShell(STATIC_PAGE).shell, false);
  // Even a thin one: with no script there is nothing that could fill it in.
  assert.equal(detectShell('<html><body><div id="root"></div></body></html>').shell, false);
});

test('a server-rendered page with a mount node is not a shell', () => {
  const html = `<html lang="en"><head><title>Shop</title></head><body><div id="__next"><h1>Our shop</h1><p>Everything we sell, listed plainly, with prices that do not move around.</p><a href="/cart">Your cart</a></div>${S} src="/_next/x.js"${ES}</body></html>`;
  assert.equal(detectShell(html).shell, false);
});

test('detectShell never throws and defaults to "not a shell"', () => {
  for (const input of [undefined, null, '', '   ', 0, {}, [], 'plain text']) {
    const r = detectShell(input);
    assert.equal(typeof r.shell, 'boolean');
    assert.equal(r.shell, false);
  }
});

/* ── the consequence: no bogus accessibility score ───────────────────────── */

test('a shell page is not given an accessibility score', () => {
  const b = addUrlScan(emptyBundle(), {
    finalUrl: 'https://my-app.vercel.app/',
    html: VITE_SHELL,
    robotsFound: false,
  });
  assert.equal(b.shellOnly, true);
  assert.equal(
    hasInputFor(b, 'accessibility'),
    false,
    'accessibility must not run on an empty shell — it would pass by default',
  );
  assert.ok(b.notes.includes(SHELL_NOTE), 'the user has to be told why');
});

test('share preview still runs on a shell, because its meta tags are real', () => {
  const b = addUrlScan(emptyBundle(), {
    finalUrl: 'https://my-app.vercel.app/',
    html: VITE_SHELL,
    robotsFound: false,
  });
  assert.equal(
    hasInputFor(b, 'sharepreview'),
    true,
    'og/twitter tags are static in a SPA index.html, so that check is still valid',
  );
});

test('a real page still gets its accessibility score', () => {
  const b = addUrlScan(emptyBundle(), {
    finalUrl: 'https://example.com/',
    html: REAL_PAGE,
    robotsFound: false,
  });
  assert.equal(b.shellOnly, false);
  assert.equal(hasInputFor(b, 'accessibility'), true);
});

test('the shell flag survives later pastes', () => {
  let b = addUrlScan(emptyBundle(), {
    finalUrl: 'https://my-app.vercel.app/',
    html: VITE_SHELL,
    robotsFound: false,
  });
  b = addBlob(b, { text: '# My app\n\nIt does a thing.', name: 'README.md', origin: 'file' });
  assert.equal(b.shellOnly, true, 'pasting a README must not clear the warning');
});
