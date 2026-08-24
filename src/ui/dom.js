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
