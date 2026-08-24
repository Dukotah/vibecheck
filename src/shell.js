// shell.js — the app shell. Wires the registry + score + report modules to the
// DOM. This is the ONLY entry point index.html loads. It touches the DOM; all
// real logic is imported from the pure core modules.

import { MODULES, MODULE_META, getModule } from './registry.js';
import { aggregate } from './score.js';
import { buildReport, toMarkdown } from './report.js';
import { normalizeResult } from './contract.js';
import { qs, clear } from './ui/dom.js';
import { renderCardGrid } from './ui/cards.js';
import { renderForm } from './ui/form.js';
import { renderResult, renderScore, renderFixList } from './ui/results.js';

/** Live app state: last result per module id. */
const state = {
  results: {}, // id -> ModuleResult
};

/** Build the scored entries array (registry order) from current state. */
function scoredEntries() {
  return MODULE_META.map((m) => ({
    id: m.id,
    title: m.title,
    result: state.results[m.id] || normalizeResult({ status: 'incomplete' }),
  }));
}

/** Current status per module id, for the dashboard cards. */
function statusMap() {
  const out = {};
  for (const m of MODULE_META) out[m.id] = (state.results[m.id] || {}).status || 'incomplete';
  return out;
}

function refreshOverview() {
  const overall = aggregate(scoredEntries());
  const scoreEl = qs('#score-panel');
  if (scoreEl) renderScore(scoreEl, overall);
  const fixEl = qs('#fix-list');
  if (fixEl) renderFixList(fixEl, overall);
}

function renderDashboard() {
  const dash = qs('#dashboard');
  if (!dash) return;
  clear(dash);
  dash.append(renderCardGrid(MODULE_META, statusMap(), openModule));
}

function openModule(id) {
  const mod = getModule(id);
  const panel = qs('#work-panel');
  if (!mod || !panel) return;
  clear(panel);
  panel.hidden = false;
  renderForm(
    panel,
    mod,
    (input) => runModule(id, input),
    () => {
      panel.hidden = true;
      clear(panel);
    },
  );
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function runModule(id, input) {
  const mod = getModule(id);
  if (!mod) return;
  const result = normalizeResult(mod.run(input));
  state.results[id] = result;

  const resultsEl = qs('#results');
  if (resultsEl) {
    clear(resultsEl);
    resultsEl.append(renderResult({ title: mod.title }, result));
  }
  renderDashboard();
  refreshOverview();
}

function wireExport() {
  const btn = qs('#export-md');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const md = toMarkdown(buildReport(scoredEntries()));
    if (navigator.clipboard) navigator.clipboard.writeText(md);
  });
}

/** Boot. */
export function init() {
  renderDashboard();
  refreshOverview();
  wireExport();
}

// Auto-init when loaded as a module in the browser.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
