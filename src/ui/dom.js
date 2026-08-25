// ui/dom.js — tiny XSS-safe DOM helpers used by the shell. This file DOES
// touch document; only the UI layer is allowed to. Core logic stays pure.

/**
 * Create an element. `text` is always set via textContent (never innerHTML),
 * so dynamic strings can never inject markup.
 * @param {string} tag
 * @param {{ class?:string, text?:string, attrs?:Record<string,string>, on?:Record<string,Function> }} [opts]
 * @param {Array<Node|string>} [children]
 * @returns {HTMLElement}
 */
export function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text != null) node.textContent = String(opts.text);
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) {
      if (v != null) node.setAttribute(k, String(v));
    }
  }
  if (opts.on) {
    for (const [evt, fn] of Object.entries(opts.on)) {
      node.addEventListener(evt, fn);
    }
  }
  for (const child of children) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Remove all children from a node. */
export function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
}

/** Find one element by selector (thin wrapper for readability). */
export function qs(sel, root = document) {
  return root.querySelector(sel);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Build an inline SVG icon from a DEVELOPER-AUTHORED spec (no user input ever
 * reaches this — the `paths`/attrs are literals defined in the UI layer). Uses
 * the SVG namespace in real browsers so paths render; degrades gracefully in
 * the minimal test DOM shim (which lacks createElementNS) by producing an inert
 * element carrying no live markup.
 *
 * @param {{ paths:Array<{d?:string, tag?:string, attrs?:Record<string,string>}>,
 *           viewBox?:string, attrs?:Record<string,string>, className?:string }} spec
 * @returns {Node}
 */
export function icon(spec = {}) {
  const hasNS = typeof document !== 'undefined' && typeof document.createElementNS === 'function';
  const make = (tag) => (hasNS ? document.createElementNS(SVG_NS, tag) : document.createElement(tag));

  const svg = make('svg');
  const setAttr = (node, k, v) => {
    if (v == null) return;
    if (node.setAttribute) node.setAttribute(k, String(v));
  };
  setAttr(svg, 'viewBox', spec.viewBox || '0 0 24 24');
  setAttr(svg, 'fill', 'none');
  setAttr(svg, 'aria-hidden', 'true');
  setAttr(svg, 'focusable', 'false');
  if (spec.className) {
    if ('className' in svg) svg.className = spec.className; // shim path
    setAttr(svg, 'class', spec.className); // real SVG needs the attribute
  }
  if (spec.attrs) for (const [k, v] of Object.entries(spec.attrs)) setAttr(svg, k, v);

  for (const p of spec.paths || []) {
    const child = make(p.tag || 'path');
    if (p.d != null) setAttr(child, 'd', p.d);
    if (p.attrs) for (const [k, v] of Object.entries(p.attrs)) setAttr(child, k, v);
    if (svg.append) svg.append(child);
  }
  return svg;
}
