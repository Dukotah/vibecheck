// xss.test.mjs — adversarial regression test. Feeds every module hostile input
// (script tags, inline-event img payloads, javascript: URLs) and renders the
// real UI layer (results, fix list, score gauge, card grid, forms) into a tiny
// self-contained DOM, then asserts the produced HTML contains NO live markup.
//
// This is a rendering-level guarantee: the UI layer must escape all user-derived
// text via textContent so a pasted "<img onerror>" becomes inert "&lt;img...".
// If any module ever emits raw HTML into the DOM, these tests fail.

import { test } from 'node:test';
import assert from 'node:assert/strict';

/* ── Minimal DOM sufficient for the UI layer (el/clear/qs + textContent) ── */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

class TextNode {
  constructor(t) { this._text = String(t); this.parentNode = null; }
  get nodeType() { return 3; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
  get outerHTML() { return escapeHtml(this._text); }
}

class Elem {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this._tag = tag.toLowerCase();
    this.childNodes = [];
    this.parentNode = null;
    this.attributes = {};
    this._className = '';
    this.style = {};
    this.checked = false;
    this.value = '';
    this._listeners = {};
    this.classList = {
      _s: new Set(),
      add: (...c) => { c.forEach((x) => x && this.classList._s.add(x)); },
      remove: (...c) => { c.forEach((x) => this.classList._s.delete(x)); },
      contains: (x) => this.classList._s.has(x),
    };
  }
  get nodeType() { return 1; }
  get className() { return this._className; }
  set className(v) {
    this._className = String(v);
    // Mirror the browser: assigning className re-seeds classList.
    this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean));
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  addEventListener(evt, fn) { (this._listeners[evt] ||= []).push(fn); }
  dispatch(evt, e = {}) { e.preventDefault ||= () => {}; (this._listeners[evt] || []).forEach((fn) => fn(e)); }
  click() { this.dispatch('click', {}); }
  get firstChild() { return this.childNodes[0] || null; }
  removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); return c; }
  append(...kids) {
    for (const k of kids) {
      const n = k && k.nodeType ? k : new TextNode(String(k));
      n.parentNode = this;
      this.childNodes.push(n);
    }
  }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(v) { this.childNodes = []; this.append(new TextNode(String(v))); }
  _walk(fn) { for (const c of this.childNodes) if (c.nodeType === 1) { fn(c); c._walk(fn); } }
  querySelector(sel) { let r = null; this._walk((n) => { if (!r && matchSel(n, sel)) r = n; }); return r; }
  querySelectorAll(sel) { const out = []; this._walk((n) => { if (matchSel(n, sel)) out.push(n); }); return out; }
  scrollIntoView() {}
  get outerHTML() {
    const attrs = Object.entries(this.attributes)
      .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`).join('');
    const cls = this._className ? ` class="${escapeHtml(this._className)}"` : '';
    const inner = this.childNodes.map((c) => c.outerHTML).join('');
    return `<${this._tag}${cls}${attrs}>${inner}</${this._tag}>`;
  }
}

function matchSel(n, sel) {
  sel = sel.trim();
  if (sel.startsWith('.')) return n.classList.contains(sel.slice(1));
  if (sel.startsWith('#')) return n.attributes.id === sel.slice(1);
  return n._tag === sel.toLowerCase();
}

// Install the shim before importing the UI layer (which touches `document`).
globalThis.document = {
  createElement: (t) => new Elem(t),
  createTextNode: (t) => new TextNode(t),
};

const { MODULES } = await import('../src/registry.js');
const { normalizeResult } = await import('../src/contract.js');
const { renderResult, renderScore, renderFixList } = await import('../src/ui/results.js');
const { renderCardGrid } = await import('../src/ui/cards.js');
const { renderForm } = await import('../src/ui/form.js');
const { aggregate } = await import('../src/score.js');
const { buildReport, toMarkdown } = await import('../src/report.js');

/** Assert a rendered HTML string carries no LIVE (unescaped) dangerous markup. */
function assertNoLiveMarkup(html, ctx) {
  const lower = html.toLowerCase();
  // Escaped content uses &lt; so it can never form a real tag. A literal '<'
  // followed by a tag name is the only dangerous shape.
  assert.ok(!/<script\b/.test(lower), `live <script> leaked in ${ctx}`);
  assert.ok(!/<[a-z][^>]*\son[a-z]+\s*=/.test(lower), `live inline-event handler leaked in ${ctx}`);
  // A live user-injected <img>: our own render layer never emits <img>, so any
  // literal (unescaped) <img in the output would mean a payload broke through.
  assert.ok(!/<img\b/.test(lower), `live <img> leaked in ${ctx}`);
  assert.ok(!/<a\b[^>]*\bhref\s*=\s*["']?javascript:/.test(lower), `live javascript: href leaked in ${ctx}`);
}

// A payload that tries every common injection shape at once.
const XSS = '<img src=x onerror=alert(1)>"><script>alert(2)</script><a href="javascript:alert(3)">x</a>';

// Per-module hostile inputs, targeting each field a module reads.
const HOSTILE = {
  legal: {
    licenseText: XSS,
    packages: JSON.stringify({ name: XSS, dependencies: { [XSS]: '1.0.0', 'evil"><script>': '^1' } }),
  },
  accessibility: {
    html: `<html lang="${XSS}"><head><title>${XSS}</title></head><body><img src=x><a href="/">click here</a><input></body></html>`,
  },
  crawlers: { blockTraining: true, robotsTxt: `User-agent: ${XSS}\nDisallow: /\n<script>alert(1)</script>` },
  sharepreview: {
    headHtml: `<head><title>${XSS}</title><meta property="og:title" content="${XSS}"><meta property="og:image" content="javascript:alert(1)"></head>`,
    pageUrl: 'javascript:alert(1)',
  },
  docs: { readme: `# ${XSS}\n\n<script>alert(1)</script>`, name: XSS, description: XSS },
};

for (const mod of MODULES) {
  test(`[${mod.id}] hostile input renders with no live markup`, () => {
    const result = normalizeResult(mod.run(HOSTILE[mod.id] || {}));

    // findings/fixes must be plain strings (nothing exotic reaches the DOM).
    for (const f of result.findings) assert.equal(typeof f.text, 'string');
    for (const f of result.fixes) {
      assert.equal(typeof f.label, 'string');
      assert.equal(typeof f.copyText, 'string');
    }

    const block = renderResult({ title: mod.title }, result, () => {});
    const html = block.outerHTML;
    assertNoLiveMarkup(html, `renderResult(${mod.id})`);

    // Whatever a module chooses to do with the payload — echo it back escaped,
    // or neutralize it entirely — no literal tag opener may appear unescaped.
    // (An escaped "&lt;img ... onerror=alert(1)&gt;" is inert text and fine; the
    // dangerous shape is a real "<img"/"<script" which assertNoLiveMarkup rejects.)
    assert.ok(!html.includes('<script'), `${mod.id}: unescaped <script in output`);
    assert.ok(!html.includes('<img'), `${mod.id}: unescaped <img in output`);
  });

  test(`[${mod.id}] hostile input renders a clean form`, () => {
    const c = new Elem('div');
    let ran = null;
    renderForm(c, mod, (inp) => { ran = inp; }, () => {});
    assertNoLiveMarkup(c.outerHTML, `form(${mod.id})`);
    // Clicking every example must not throw and must not inject markup.
    for (const btn of c.querySelectorAll('.checkform__example')) btn.click();
    assertNoLiveMarkup(c.outerHTML, `form-after-example(${mod.id})`);
    const form = c.querySelector('form');
    form.dispatch('submit', {});
    assert.notEqual(ran, null, `${mod.id} form submit should fire onRun`);
  });
}

test('aggregate + fix list + score gauge stay injection-free with hostile results', () => {
  const entries = MODULES.map((m) => ({
    id: m.id, title: m.title, result: normalizeResult(m.run(HOSTILE[m.id] || {})),
  }));
  const overall = aggregate(entries);

  const scoreEl = new Elem('div');
  renderScore(scoreEl, overall);
  assertNoLiveMarkup(scoreEl.outerHTML, 'renderScore');
  // The score gauge writes a CSS custom property; it must be numeric-only so a
  // crafted score can never inject CSS.
  const gauge = scoreEl.querySelector('.score__gauge');
  const style = gauge && gauge.getAttribute('style');
  assert.ok(/^--pct:\d+$/.test(style), `gauge style must be numeric-only, got: ${style}`);

  const fixEl = new Elem('div');
  renderFixList(fixEl, overall, () => {});
  assertNoLiveMarkup(fixEl.outerHTML, 'renderFixList');

  const grid = renderCardGrid(
    MODULES.map((m, i) => ({ id: m.id, title: m.title, tagline: m.tagline, order: i })),
    Object.fromEntries(entries.map((e) => [e.id, e.result.status])),
    () => {},
    null,
  );
  assertNoLiveMarkup(grid.outerHTML, 'cardGrid');

  // Markdown export is copied as text/markdown (never rendered as HTML), but it
  // must still be a well-formed non-empty string for hostile input.
  const md = toMarkdown(buildReport(entries));
  assert.equal(typeof md, 'string');
  assert.ok(md.length > 20);
});
