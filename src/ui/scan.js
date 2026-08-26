// ui/scan.js — the run screen.
//
// The checks themselves take about a millisecond each. The wait is the network
// fetch. Showing the checks resolve one by one is not theatre for its own sake:
// it tells you what is being looked at, and it makes a failure legible ("it got
// stuck on the page fetch") instead of a spinner that means nothing.

import { el, clear } from './dom.js';

const VERDICT = { pass: 'good', warn: 'check', fail: 'blocker', incomplete: 'skipped' };

/**
 * Draw the step list.
 * @param {HTMLElement} host
 * @param {Array<{id:string,title:string}>} steps
 * @returns {{ start:Function, finish:Function }} controls
 */
export function renderSteps(host, steps) {
  clear(host);
  const rows = new Map();

  for (const step of steps) {
    const dot = el('span', { class: 'step__dot' });
    const verdict = el('span', { class: 'step__verdict' });
    const row = el('li', { class: 'step step--pending', attrs: { 'data-id': step.id } }, [
      dot,
      el('span', { class: 'step__name', text: step.title }),
      verdict,
    ]);
    rows.set(step.id, { row, verdict });
    host.append(row);
  }

  return {
    /** Mark a step as in-flight. */
    start(id) {
      const entry = rows.get(id);
      if (!entry) return;
      entry.row.className = 'step step--running';
      entry.verdict.textContent = '';
    },
    /** Mark a step finished with its status. */
    finish(id, status) {
      const entry = rows.get(id);
      if (!entry) return;
      entry.row.className = 'step step--done';
      entry.row.setAttribute('data-status', status);
      entry.verdict.textContent = VERDICT[status] || '';
    },
  };
}

/** A pause that still feels like work is happening, without being fake-slow. */
export function beat(ms) {
  const reduce =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return new Promise((resolve) => setTimeout(resolve, reduce ? 0 : ms));
}
