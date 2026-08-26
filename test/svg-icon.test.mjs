// Regression test for the "graphics broken in real browsers" bug.
//
// icon() builds inline SVG. In a REAL browser, elements from
// document.createElementNS have a read-only `className` (an SVGAnimatedString),
// so assigning a string to it throws a TypeError in strict-mode ES modules and
// aborts every icon() call — blanking all graphics. The other test suites use a
// plain-createElement shim (writable className, no createElementNS), which took
// the fallback path and hid the bug. This suite reproduces the real-SVG
// semantics so the failure is caught in CI, not by a user.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Minimal SVG-like element: className is getter-only and THROWS on assignment,
// exactly like SVGElement.className in a strict-mode module context.
class SvgLikeElem {
  constructor(tag) {
    this._tag = tag;
    this.attributes = {};
    this.childNodes = [];
    Object.defineProperty(this, 'className', {
      configurable: true,
      get() { return { baseVal: this.attributes.class || '' }; },
      set() { throw new TypeError("Cannot set property className of SVGElement (read-only)"); },
    });
  }
  get nodeType() { return 1; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  append(...kids) { for (const k of kids) this.childNodes.push(k); }
}

// Install a browser-like document that HAS createElementNS (so icon() takes the
// real-SVG path) before importing the UI layer.
globalThis.document = {
  createElementNS: (_ns, tag) => new SvgLikeElem(tag),
  createElement: (tag) => new SvgLikeElem(tag),
};

const { icon } = await import('../src/ui/dom.js');

test('icon() does not throw on the real-SVG (getter-only className) path', () => {
  assert.doesNotThrow(() => {
    icon({ className: 'card__glyph', viewBox: '0 0 24 24', paths: [{ d: 'M4 12h16' }] });
  });
});

test('icon() sets the class via the class attribute (not the className property)', () => {
  const svg = icon({ className: 'card__glyph', paths: [{ d: 'M4 12h16' }] });
  assert.equal(svg.getAttribute('class'), 'card__glyph');
});

test('icon() appends its <path> children with their d attribute', () => {
  const svg = icon({ paths: [{ d: 'M4 12h16' }, { d: 'M12 4v16' }] });
  assert.equal(svg.childNodes.length, 2);
  assert.equal(svg.childNodes[0].getAttribute('d'), 'M4 12h16');
  assert.equal(svg.childNodes[1].getAttribute('d'), 'M12 4v16');
});

test('icon() still sets viewBox/fill/aria on the root', () => {
  const svg = icon({ viewBox: '0 0 16 16', paths: [] });
  assert.equal(svg.getAttribute('viewBox'), '0 0 16 16');
  assert.equal(svg.getAttribute('fill'), 'none');
  assert.equal(svg.getAttribute('aria-hidden'), 'true');
});
