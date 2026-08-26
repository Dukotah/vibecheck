// shell.js — the app controller. The only file that owns application state.
//
// Flow, end to end:
//   home  → you give us a URL (or files, or a paste)
//   scan  → we fetch what we can and run the five checks, visibly
//   report→ one score, the blockers, the detail, and a link you can share
//
// Everything below the shell is pure: the checks never see the DOM, and the DOM
// never sees anything but strings it sets with textContent.

import { MODULES, MODULE_META, getModule } from './registry.js';
import { aggregate } from './score.js';
import { buildReport, toMarkdown } from './report.js';
import { emptyBundle, addBlob, addUrlScan, setIntent, hasInputFor } from './ingest/bundle.js';
import { isWorthReading } from './ingest/detect.js';
import { encodeReport, decodeReport, shareUrl, badgeMarkdown, SHARE_PARAM } from './share/codec.js';
import { renderScoreHero, renderReport, renderSharedBanner } from './ui/report.js';
import { renderSteps, beat } from './ui/scan.js';
import { el, clear, qs } from './ui/dom.js';
import * as I from './ui/icons.js';

// ── State ───────────────────────────────────────────────────────────────────

const state = {
  bundle: emptyBundle(),
  results: new Map(), // moduleId -> ModuleResult
  ran: false,
  aborted: false,
};

const $ = {
  urlForm: qs('#url-form'),
  urlInput: qs('#url-input'),
  urlSubmit: qs('#url-submit'),
  urlError: qs('#url-error'),
  pickFiles: qs('#pick-files'),
  fileInput: qs('#file-input'),
  scanTarget: qs('#scan-target'),
  scanSteps: qs('#scan-steps'),
  scanCancel: qs('#scan-cancel'),
  scoreHero: qs('#score-hero'),
  reportBody: qs('#report-body'),
  themeToggle: qs('#theme-toggle'),
  toast: qs('#toast'),
};

// ── Theme ───────────────────────────────────────────────────────────────────

function currentTheme() {
  const set = document.documentElement.getAttribute('data-theme');
  if (set) return set;
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

function paintThemeToggle() {
  clear($.themeToggle);
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  $.themeToggle.append(next === 'light' ? I.sun() : I.moon());
  $.themeToggle.setAttribute('aria-label', `Switch to ${next} mode`);
}

$.themeToggle.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem('vibecheck-theme', next);
  } catch {
    /* private mode: the choice just will not persist */
  }
  paintThemeToggle();
});

// ── Views ───────────────────────────────────────────────────────────────────

function setView(name) {
  document.documentElement.setAttribute('data-view', name);
  if (name !== 'report') window.scrollTo({ top: 0, behavior: 'auto' });
}

function toast(message) {
  $.toast.textContent = message;
  $.toast.classList.add('is-on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => $.toast.classList.remove('is-on'), 2200);
}

async function copyText(text, note) {
  try {
    await navigator.clipboard.writeText(text);
    toast(note || 'Copied');
  } catch {
    // Clipboard API needs a secure context and permission. Fall back to a
    // selectable textarea so the user can still get the text out.
    const ta = el('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    try {
      document.execCommand('copy');
      toast(note || 'Copied');
    } catch {
      toast('Could not copy — select the text and copy it manually');
    }
    ta.remove();
  }
}

// ── Running the checks ──────────────────────────────────────────────────────

/** Run every module that has input; leave the rest as not-run. */
function runAll() {
  for (const mod of MODULES) {
    if (!hasInputFor(state.bundle, mod.id)) {
      state.results.delete(mod.id);
      continue;
    }
    state.results.set(mod.id, mod.run(state.bundle.inputs[mod.id]));
  }
  state.ran = true;
}

function entries() {
  return MODULE_META.map((m) => ({
    id: m.id,
    title: m.title,
    result: state.results.get(m.id) || {
      status: 'incomplete',
      score: 0,
      summary: 'Not checked yet.',
      findings: [],
      fixes: [],
    },
  }));
}

function overall() {
  return aggregate(entries());
}

// ── Report ──────────────────────────────────────────────────────────────────

function shareActions(o) {
  const token = encodeReport(o, { siteUrl: state.bundle.siteUrl, at: Date.now() });
  const origin = window.location.origin;
  return [
    {
      label: 'Copy share link',
      icon: I.link,
      primary: true,
      onClick: () => copyText(shareUrl(origin, token), 'Share link copied'),
    },
    {
      label: 'Copy README badge',
      icon: I.badge,
      onClick: () =>
        copyText(badgeMarkdown(origin, o.score, shareUrl(origin, token)), 'Badge markdown copied'),
    },
    { label: 'Download report', icon: I.download, onClick: downloadReport },
    { label: 'Print / PDF', icon: I.printer, onClick: () => window.print() },
    { label: 'Check something else', icon: I.again, onClick: startOver },
  ];
}

function downloadReport() {
  const md = toMarkdown(buildReport(entries(), { siteUrl: state.bundle.siteUrl }));
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { attrs: { href: url, download: 'vibecheck-report.md' } });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Report downloaded');
}

function paintReport() {
  const o = overall();
  renderScoreHero($.scoreHero, {
    overall: o,
    siteUrl: state.bundle.siteUrl,
    actions: shareActions(o),
  });
  renderReport($.reportBody, {
    overall: o,
    entries: entries(),
    bundle: state.bundle,
    handlers: {
      onCopy: copyText,
      onGapSubmit: handleGapSubmit,
      onIntent: handleIntent,
    },
  });
  setView('report');
  // Deliberately NOT writing the share token into the address bar. Sharing is
  // an explicit act — and a ?r= link decodes as the read-only score card, so
  // auto-writing it meant refreshing your own report silently downgraded it to
  // a stranger's view of itself, fixes and all gone.
}

function handleGapSubmit(moduleId, text) {
  const trimmed = String(text || '').trim();

  if (trimmed) {
    // Name the blob after the check that asked for it, so detection is certain.
    const NAME_HINT = {
      legal: '',
      accessibility: 'page.html',
      crawlers: 'robots.txt',
      sharepreview: 'page.html',
      docs: 'README.md',
    };
    state.bundle = addBlob(state.bundle, {
      text: trimmed,
      name: NAME_HINT[moduleId] || '',
      origin: 'paste',
    });
  } else if (moduleId === 'crawlers') {
    // Blank robots.txt plus an intent is a legitimate answer: "I do not have one".
    state.bundle = setIntent(state.bundle, state.bundle.intent);
  } else {
    toast('Paste something first, or drop the file in.');
    return;
  }

  runAll();
  paintReport();
  toast('Score updated');
}

function handleIntent(patch) {
  state.bundle = setIntent(state.bundle, patch);
  runAll();
  paintReport();
}

function startOver() {
  state.bundle = emptyBundle();
  state.results.clear();
  state.ran = false;
  window.history.replaceState({}, '', window.location.pathname);
  $.urlInput.value = '';
  setView('home');
  $.urlInput.focus();
}

// ── The scan run ────────────────────────────────────────────────────────────

async function runScan({ target, fetchFirst }) {
  state.aborted = false;
  $.scanTarget.textContent = target;
  const steps = renderSteps($.scanSteps, [
    ...(fetchFirst ? [{ id: '_fetch', title: 'Reading the page' }] : []),
    ...MODULE_META.map((m) => ({ id: m.id, title: m.title })),
  ]);
  setView('scan');

  if (fetchFirst) {
    steps.start('_fetch');
    try {
      const scan = await fetchSite(fetchFirst);
      if (state.aborted) return;
      state.bundle = addUrlScan(state.bundle, scan);
      steps.finish('_fetch', 'pass');
    } catch (err) {
      steps.finish('_fetch', 'fail');
      setView('home');
      showUrlError(err.message || 'We could not read that page.');
      return;
    }
  }

  for (const mod of MODULES) {
    if (state.aborted) return;
    steps.start(mod.id);
    await beat(140);
    const result = hasInputFor(state.bundle, mod.id)
      ? mod.run(state.bundle.inputs[mod.id])
      : { status: 'incomplete', score: 0, summary: 'Not checked yet.', findings: [], fixes: [] };
    if (result.status === 'incomplete') state.results.delete(mod.id);
    else state.results.set(mod.id, result);
    steps.finish(mod.id, result.status);
  }

  if (state.aborted) return;
  state.ran = true;
  await beat(320);
  paintReport();
}

async function fetchSite(url) {
  const res = await fetch(`/api/scan?url=${encodeURIComponent(url)}`, {
    headers: { accept: 'application/json' },
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    throw new Error('The checker did not answer. Try again in a moment.');
  }
  if (!res.ok) throw new Error(data?.error || 'We could not read that page.');
  return data;
}

$.scanCancel.addEventListener('click', () => {
  state.aborted = true;
  setView(state.ran ? 'report' : 'home');
});

// ── URL entry ───────────────────────────────────────────────────────────────

function showUrlError(message) {
  $.urlError.textContent = message;
  $.urlError.hidden = false;
}

function clearUrlError() {
  $.urlError.hidden = true;
  $.urlError.textContent = '';
}

$.urlInput.addEventListener('input', clearUrlError);

$.urlForm.addEventListener('submit', (e) => {
  e.preventDefault();
  clearUrlError();
  const raw = $.urlInput.value.trim();
  if (!raw) {
    showUrlError('Paste the address of the site you want to check.');
    $.urlInput.focus();
    return;
  }
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed;
  try {
    parsed = new URL(withScheme);
  } catch {
    showUrlError('That does not look like a web address. Try something like my-app.vercel.app');
    return;
  }
  if (!parsed.hostname.includes('.')) {
    showUrlError('That address is missing a domain. Try something like my-app.vercel.app');
    return;
  }
  runScan({ target: parsed.hostname + (parsed.pathname === '/' ? '' : parsed.pathname), fetchFirst: withScheme });
});

// ── Files: picker, drop, paste ──────────────────────────────────────────────

const MAX_FILES = 40;

async function ingestFiles(fileList) {
  const files = Array.from(fileList || []).filter(isWorthReading).slice(0, MAX_FILES);
  if (!files.length) {
    toast('Nothing we could use in there. Try your README, package.json, LICENSE, robots.txt or an HTML file.');
    return false;
  }
  for (const file of files) {
    let text = '';
    try {
      text = await file.text();
    } catch {
      continue;
    }
    state.bundle = addBlob(state.bundle, {
      text,
      name: file.webkitRelativePath || file.name,
      origin: 'file',
    });
  }
  return true;
}

async function handleFiles(fileList) {
  const ok = await ingestFiles(fileList);
  if (!ok) return;
  if (state.ran) {
    runAll();
    paintReport();
    toast('Score updated');
  } else {
    runScan({ target: `${Array.from(fileList).length} file(s) from your project`, fetchFirst: null });
  }
}

$.pickFiles.addEventListener('click', () => $.fileInput.click());
$.fileInput.addEventListener('change', () => {
  handleFiles($.fileInput.files);
  $.fileInput.value = '';
});

let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
  dragDepth += 1;
  document.body.classList.add('is-dragging');
});
window.addEventListener('dragover', (e) => {
  if (document.body.classList.contains('is-dragging')) e.preventDefault();
});
window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) document.body.classList.remove('is-dragging');
});
window.addEventListener('drop', (e) => {
  if (!e.dataTransfer) return;
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('is-dragging');
  if (e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
});

// Paste anything, anywhere on the home screen, and we will work out what it is.
window.addEventListener('paste', (e) => {
  const view = document.documentElement.getAttribute('data-view');
  if (view !== 'home') return;
  const active = document.activeElement;
  if (active && (active.tagName === 'TEXTAREA' || active === $.urlInput)) return;
  const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
  if (!text || text.length < 40) return;
  e.preventDefault();
  state.bundle = addBlob(state.bundle, { text, origin: 'paste' });
  runScan({ target: 'what you pasted', fetchFirst: null });
});

// ── Keyboard ────────────────────────────────────────────────────────────────

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const view = document.documentElement.getAttribute('data-view');
    if (view === 'scan') {
      state.aborted = true;
      setView(state.ran ? 'report' : 'home');
    }
  }
});

// ── Shared links ────────────────────────────────────────────────────────────

function showShared(payload) {
  const titles = new Map(MODULE_META.map((m) => [m.id, m.title]));
  const o = {
    score: payload.score,
    status:
      payload.score >= 85 ? 'ready' : payload.score >= 60 ? 'almost' : 'not-ready',
    label:
      payload.score >= 85
        ? 'Looking launch-ready'
        : payload.score >= 60
          ? 'Almost there — a few fixes'
          : 'Not ready to ship yet',
    checksRun: payload.checks.filter((c) => c.status !== 'incomplete').length,
    checksTotal: payload.checks.length,
    blockers: payload.checks.filter((c) => c.status === 'fail').length,
    breakdown: payload.checks.map((c) => ({
      id: c.id,
      title: titles.get(c.id) || c.id,
      status: c.status,
      score: c.score,
    })),
    // A shared link deliberately carries no findings, so there is nothing here.
    fixes: [],
  };

  renderScoreHero($.scoreHero, {
    overall: o,
    siteUrl: payload.siteUrl,
    actions: [{ label: 'Check something of mine', icon: I.again, primary: true, onClick: startOver }],
  });

  clear($.reportBody);
  renderSharedBanner($.reportBody, payload);
  renderSharedBreakdown($.reportBody, o.breakdown);
  setView('report');
}

const SHARED_WORD = { pass: 'good', warn: 'needs a look', fail: 'blocker', incomplete: 'not checked' };

/** The per-check verdicts, styled like the real report's check rows. */
function renderSharedBreakdown(host, breakdown) {
  const list = el('div', { class: 'checks' });
  for (const b of breakdown) {
    list.append(
      el('div', { class: 'check' }, [
        el('div', { class: 'check__head check__head--static' }, [
          el('span', { class: `badge badge--${b.status}` }, [I.statusIcon(b.status)]),
          el('span', { class: 'check__title' }, [
            el('span', { text: b.title }),
            el('span', { class: 'check__sub', text: SHARED_WORD[b.status] || b.status }),
          ]),
          el('span', {
            class: 'check__score',
            text: b.status === 'incomplete' ? '—' : String(b.score),
          }),
        ]),
      ]),
    );
  }
  host.append(
    el('section', { class: 'panel' }, [
      el('div', { class: 'panel__head' }, [
        el('h2', { class: 'panel__title', text: 'How it scored' }),
        el('p', { class: 'panel__note', text: 'Verdicts only — the details stayed with whoever ran it.' }),
      ]),
      list,
    ]),
  );
}

// ── Boot ────────────────────────────────────────────────────────────────────

paintThemeToggle();

// Give the home-screen list its glyphs (authored icons, no user input).
for (const item of document.querySelectorAll('.promise__item[data-check]')) {
  const slot = item.querySelector('.promise__icon');
  const make = I.CHECK_ICONS[item.getAttribute('data-check')];
  if (slot && make) slot.append(make());
}

const params = new URLSearchParams(window.location.search);
const token = params.get(SHARE_PARAM);
const shared = token ? decodeReport(token) : null;

if (shared) {
  showShared(shared);
} else {
  setView('home');
  // A URL passed in as ?url= runs straight away — handy for bookmarklets.
  const preset = params.get('url');
  if (preset) {
    $.urlInput.value = preset.replace(/^https?:\/\//i, '');
    $.urlForm.dispatchEvent(new Event('submit', { cancelable: true }));
  }
}
