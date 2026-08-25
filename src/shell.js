// shell.js — the app shell. Wires the registry + score + report modules to the
// DOM. This is the ONLY entry point index.html loads. It touches the DOM; all
// real logic is imported from the pure core modules.

import { MODULE_META, getModule } from './registry.js';
import { aggregate } from './score.js';
import { buildReport, toMarkdown } from './report.js';
import { normalizeResult } from './contract.js';
import { qs, clear, el } from './ui/dom.js';
import { renderCardGrid } from './ui/cards.js';
import { renderForm } from './ui/form.js';
import { renderResult, renderScore, renderFixList } from './ui/results.js';

/** Live app state: last result per module id, plus which one is open. */
const state = {
  results: {}, // id -> ModuleResult
  openId: null, // currently open module id (or null)
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

/** How many checks have produced a real (non-incomplete) result. */
function checksRunCount() {
  return MODULE_META.filter((m) => {
    const s = (state.results[m.id] || {}).status;
    return s && s !== 'incomplete';
  }).length;
}

/* -------------------------------------------------------------------------- */
/* Toast — small, transient, accessible confirmation ("Copied!" etc.)         */
/* -------------------------------------------------------------------------- */

let toastTimer = null;
function toast(message) {
  let host = qs('#toast');
  if (!host) {
    host = el('div', { class: 'toast', attrs: { id: 'toast', role: 'status', 'aria-live': 'polite' } });
    document.body.append(host);
  }
  host.textContent = message;
  host.classList.add('toast--show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => host.classList.remove('toast--show'), 2200);
}

/** Copy text to the clipboard with graceful fallback + a toast. */
async function copyText(text, okMsg = 'Copied to your clipboard') {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast(okMsg);
    return true;
  } catch {
    toast('Could not copy — select the text and copy it manually');
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Overview: overall score + prioritized fix list + progress messaging        */
/* -------------------------------------------------------------------------- */

function refreshOverview() {
  const overall = aggregate(scoredEntries());
  const scoreEl = qs('#score-panel');
  if (scoreEl) renderScore(scoreEl, overall);
  const fixEl = qs('#fix-list');
  if (fixEl) renderFixList(fixEl, overall, copyText);

  // Enable export/download/print only once there is at least one real result.
  const hasResults = checksRunCount() > 0;
  for (const sel of ['#export-md', '#download-md', '#print-report']) {
    const b = qs(sel);
    if (b) b.disabled = !hasResults;
  }

  // Progress hint under the score.
  const prog = qs('#run-progress');
  if (prog) {
    const done = overall.checksRun;
    const total = overall.checksTotal;
    if (done === 0) {
      prog.textContent = 'Nothing checked yet — pick a check below to begin. Your score updates as you go.';
    } else if (done < total) {
      prog.textContent = `${done} of ${total} checks done. Finish the rest for your full launch-readiness score.`;
    } else {
      prog.textContent = 'All 5 checks done — this is your full launch-readiness score.';
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Dashboard cards                                                            */
/* -------------------------------------------------------------------------- */

function renderDashboard() {
  const dash = qs('#dashboard');
  if (!dash) return;
  clear(dash);
  dash.append(renderCardGrid(MODULE_META, statusMap(), openModule, state.openId));
}

/* -------------------------------------------------------------------------- */
/* Open a module, run it, show its result                                     */
/* -------------------------------------------------------------------------- */

function openModule(id) {
  const mod = getModule(id);
  const panel = qs('#work-panel');
  if (!mod || !panel) return;
  state.openId = id;
  clear(panel);
  panel.hidden = false;
  renderForm(
    panel,
    mod,
    (input) => runModule(id, input),
    () => {
      state.openId = null;
      panel.hidden = true;
      clear(panel);
      renderDashboard();
    },
  );
  renderDashboard();
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
    resultsEl.append(renderResult({ title: mod.title }, result, copyText));
  }
  const heading = qs('#report-heading');
  if (heading) heading.textContent = `Result: ${mod.title}`;

  renderDashboard();
  refreshOverview();

  // Bring the fresh result into view so the user sees the outcome of "Check it".
  if (resultsEl) resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* -------------------------------------------------------------------------- */
/* Report export: copy Markdown, download .md, print                          */
/* -------------------------------------------------------------------------- */

function currentMarkdown() {
  return toMarkdown(buildReport(scoredEntries()));
}

function wireExport() {
  const copyBtn = qs('#export-md');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (checksRunCount() === 0) {
        toast('Run at least one check first');
        return;
      }
      copyText(currentMarkdown(), 'Report copied as Markdown');
    });
  }

  const dlBtn = qs('#download-md');
  if (dlBtn) {
    dlBtn.addEventListener('click', () => {
      if (checksRunCount() === 0) {
        toast('Run at least one check first');
        return;
      }
      const md = currentMarkdown();
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vibecheck-launch-readiness.md';
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Report downloaded');
    });
  }

  const printBtn = qs('#print-report');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      if (checksRunCount() === 0) {
        toast('Run at least one check first');
        return;
      }
      window.print();
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Boot                                                                       */
/* -------------------------------------------------------------------------- */

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
