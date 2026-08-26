// ui/report.js — render the finished report.
//
// This is the screen people screenshot, so it gets the care: one big honest
// number, the blockers first, then the detail for whoever wants it, then a
// receipt of exactly what we looked at.
//
// Every piece of dynamic text goes through el({ text }) → textContent. Nothing
// user-derived is ever interpolated into markup.

import { el, clear } from './dom.js';
import * as I from './icons.js';

// Browser affordances that a non-browser test DOM does not have. Guarding here
// keeps the render layer testable without a headless browser.
const canAnimate = typeof requestAnimationFrame === 'function';
const raf = canAnimate ? requestAnimationFrame : (fn) => fn(0);
const nowMs = () => (typeof performance === 'object' && performance.now ? performance.now() : Date.now());

const RING_R = 66;
const RING_C = 2 * Math.PI * RING_R;

const VERDICT_WORD = { pass: 'good', warn: 'worth a look', fail: 'blocker', incomplete: 'not run' };

/** How the overall band reads as a sentence, not a label. */
function verdictLine(overall) {
  const { blockers = 0, checksRun = 0, checksTotal = 0, status } = overall;
  const left = checksTotal - checksRun;
  if (status === 'incomplete') return 'Nothing checked yet.';
  if (blockers > 0) {
    return `${blockers === 1 ? 'One thing' : `${blockers} things`} would bite you if you shipped this today. ${
      left > 0 ? `${left} more ${left === 1 ? 'check needs' : 'checks need'} input from you.` : 'Everything else looks fine.'
    }`;
  }
  if (status === 'ready') {
    return left > 0
      ? `Nothing is blocking you. ${left} ${left === 1 ? 'check is' : 'checks are'} still waiting on input if you want the full picture.`
      : 'Nothing is blocking you. Ship it.';
  }
  return left > 0
    ? `No hard blockers, but there is polish left. ${left} ${left === 1 ? 'check is' : 'checks are'} still waiting on input.`
    : 'No hard blockers, but there is polish left below.';
}

/** Animate a number up to its value, unless the user asked for less motion. */
function countUp(node, to) {
  const reduce =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!canAnimate || reduce || to <= 0) {
    node.textContent = String(to);
    return;
  }
  const start = nowMs();
  const dur = 900;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = String(Math.round(to * eased));
    if (t < 1) raf(tick);
  };
  raf(tick);
}

function ring(score, status) {
  const svg = el('div', { class: 'score__ring' });
  const NS = 'http://www.w3.org/2000/svg';
  const hasNS = typeof document.createElementNS === 'function';
  const make = (t) => (hasNS ? document.createElementNS(NS, t) : document.createElement(t));

  const s = make('svg');
  s.setAttribute('viewBox', '0 0 160 160');
  s.setAttribute('aria-hidden', 'true');

  const track = make('circle');
  for (const [k, v] of Object.entries({
    cx: '80', cy: '80', r: String(RING_R), fill: 'none', 'stroke-width': '10',
  })) track.setAttribute(k, v);
  track.setAttribute('class', 'score__track');

  const arc = make('circle');
  for (const [k, v] of Object.entries({
    cx: '80', cy: '80', r: String(RING_R), fill: 'none', 'stroke-width': '10',
    'stroke-linecap': 'round',
    'stroke-dasharray': String(RING_C),
    'stroke-dashoffset': String(RING_C),
  })) arc.setAttribute(k, v);
  arc.setAttribute('class', 'score__arc');

  if (s.append) s.append(track, arc);
  svg.append(s);

  const num = el('span', { class: 'score__num' }, [
    el('span', { text: '0' }),
    el('span', { class: 'score__den', text: '/ 100' }),
  ]);
  svg.append(num);

  // Let the browser paint the empty ring once, then sweep it.
  raf(() => {
    const pct = Math.max(0, Math.min(100, score)) / 100;
    arc.setAttribute('stroke-dashoffset', String(RING_C * (1 - pct)));
    countUp(num.firstChild, score);
  });

  return svg;
}

/**
 * The big score card at the top of the report.
 * @param {HTMLElement} host
 * @param {{ overall:object, siteUrl?:string, actions?:Array<{label:string,icon?:Function,onClick:Function,primary?:boolean}> }} opts
 */
export function renderScoreHero(host, opts = {}) {
  const overall = opts.overall || { score: 0, status: 'incomplete', label: '', breakdown: [] };
  clear(host);

  const meta = el('div', { class: 'score__meta' });
  if (opts.siteUrl) {
    meta.append(
      el('span', { class: 'metapill metapill--target', attrs: { title: opts.siteUrl } }, [
        I.globe(), el('span', { text: prettyUrl(opts.siteUrl) }),
      ]),
    );
  }
  meta.append(
    el('span', { class: 'metapill', text: `${overall.checksRun} of ${overall.checksTotal} checks run` }),
  );
  if (overall.blockers > 0) {
    meta.append(
      el('span', {
        class: 'metapill metapill--blocker',
        text: `${overall.blockers} blocker${overall.blockers === 1 ? '' : 's'}`,
      }),
    );
  }

  const card = el('div', { class: `score score--${overall.status}` }, [
    ring(overall.score, overall.status),
    el('div', { class: 'score__main' }, [
      el('h2', { class: 'score__band', text: overall.label }),
      el('p', { class: 'score__verdict', text: verdictLine(overall) }),
      meta,
    ]),
  ]);

  host.append(card);

  const actions = Array.isArray(opts.actions) ? opts.actions : [];
  if (actions.length) {
    const bar = el('div', { class: 'score__actions' });
    for (const a of actions) {
      const btn = el(
        'button',
        {
          class: `btn btn--sm ${a.primary ? 'btn--primary' : 'btn--quiet'}`,
          attrs: { type: 'button' },
          on: { click: a.onClick },
        },
        [a.icon ? a.icon() : null, el('span', { text: a.label })],
      );
      bar.append(btn);
    }
    host.append(bar);
  }
}

function prettyUrl(u) {
  try {
    const url = new URL(u);
    const path = url.pathname === '/' ? '' : url.pathname;
    return `${url.hostname}${path}`;
  } catch {
    return String(u).slice(0, 80);
  }
}

/** A titled section wrapper. */
function panel(title, note, body) {
  return el('section', { class: 'panel' }, [
    el('div', { class: 'panel__head' }, [
      el('h2', { class: 'panel__title', text: title }),
      note ? el('p', { class: 'panel__note', text: note }) : null,
    ]),
    body,
  ]);
}

/** The prioritized to-do list. */
function fixPanel(overall, onCopy) {
  const fixes = overall.fixes || [];
  if (!fixes.length) return null;

  const list = el('div', { class: 'fixlist' });
  fixes.forEach((fix, i) => {
    const isBlocker = fix.status === 'fail';
    const row = el('div', { class: `fix${isBlocker ? ' fix--blocker' : ''}` });

    row.append(el('span', { class: 'fix__rank', text: String(i + 1).padStart(2, '0') }));

    const from = el('span', { class: 'fix__from' }, [
      el('span', { class: 'fix__tag', text: isBlocker ? 'blocker' : 'polish' }),
      el('span', { text: fix.moduleTitle }),
    ]);

    const main = el('div', { class: 'fix__main' }, [
      el('p', { class: 'fix__label', text: fix.label }),
      from,
    ]);

    // The snippet is collapsed by default. A to-do list you have to scroll
    // through is not a to-do list, and most people hit Copy without reading —
    // but the ones who do want to read it should not have to hunt for it.
    if (fix.copyText) {
      const lines = fix.copyText.split('\n').length;
      const code = el('pre', { class: 'fix__code', text: fix.copyText });
      code.hidden = true;

      const peek = el(
        'button',
        {
          class: 'fix__peek',
          attrs: { type: 'button', 'aria-expanded': 'false' },
        },
        [I.chevron(), el('span', { text: `Show the text (${lines} line${lines === 1 ? '' : 's'})` })],
      );
      peek.addEventListener('click', () => {
        const open = peek.getAttribute('aria-expanded') === 'true';
        peek.setAttribute('aria-expanded', open ? 'false' : 'true');
        code.hidden = open;
        peek.lastChild.textContent = open
          ? `Show the text (${lines} line${lines === 1 ? '' : 's'})`
          : 'Hide the text';
      });
      from.append(peek);
      main.append(code);
    }
    row.append(main);

    if (fix.copyText) {
      row.append(
        el(
          'button',
          {
            class: 'btn btn--quiet btn--sm',
            attrs: { type: 'button' },
            on: { click: () => onCopy(fix.copyText, 'Fix copied') },
          },
          [I.copy(), el('span', { text: 'Copy' })],
        ),
      );
    }
    list.append(row);
  });

  const blockers = fixes.filter((f) => f.status === 'fail').length;
  return panel(
    'Fix these first',
    blockers ? 'Blockers on top. Each one comes with the text to paste.' : 'Nothing here is blocking — this is polish.',
    list,
  );
}

/** One expandable row per check that actually ran. */
function checkPanel(entries, onCopy) {
  const ran = entries.filter((e) => e.result.status !== 'incomplete');
  if (!ran.length) return null;

  const list = el('div', { class: 'checks' });

  for (const entry of ran) {
    const { id, title, result } = entry;
    const bodyId = `check-body-${id}`;
    const body = el('div', { class: 'check__body', attrs: { id: bodyId } });
    body.hidden = true;

    if (result.findings.length) {
      const ul = el('ul', { class: 'findings' });
      for (const f of result.findings) {
        ul.append(
          el('li', { class: `finding finding--${f.level}` }, [
            el('span', { class: 'finding__mark' }),
            el('span', { text: f.text }),
          ]),
        );
      }
      body.append(ul);
    }

    for (const fix of result.fixes) {
      body.append(
        el('div', { class: 'gap' }, [
          el('p', { class: 'gap__title', text: fix.label }),
          fix.copyText ? el('pre', { class: 'fix__code', text: fix.copyText }) : null,
          fix.copyText
            ? el('div', { class: 'gap__actions' }, [
                el(
                  'button',
                  { class: 'btn btn--quiet btn--sm', attrs: { type: 'button' }, on: { click: () => onCopy(fix.copyText, 'Copied') } },
                  [I.copy(), el('span', { text: 'Copy' })],
                ),
              ])
            : null,
        ]),
      );
    }

    const head = el(
      'button',
      {
        class: 'check__head',
        attrs: { type: 'button', 'aria-expanded': 'false', 'aria-controls': bodyId },
      },
      [
        el('span', { class: `badge badge--${result.status}` }, [I.statusIcon(result.status)]),
        el('span', { class: 'check__title' }, [
          el('span', { text: title }),
          el('span', { class: 'check__sub', text: result.summary }),
        ]),
        el('span', { class: 'check__score', text: `${result.score}` }),
        el('span', { class: 'check__chev' }, [I.chevron()]),
      ],
    );
    head.addEventListener('click', () => {
      const open = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', open ? 'false' : 'true');
      body.hidden = open;
    });

    list.append(el('div', { class: 'check' }, [head, body]));
  }

  return panel('Every check', `${ran.length} of ${entries.length} ran. Open one for the detail.`, list);
}

/** Copy for the checks we could not run, plus the input that would fix that. */
const GAP_COPY = {
  legal: {
    ask: 'Paste your LICENSE file and your package.json',
    why: 'So we can tell you whether you — and the libraries you pulled in — actually let you ship this.',
    placeholder: 'Paste your LICENSE, or your package.json, or both (one at a time is fine).',
  },
  accessibility: {
    ask: 'Paste your page HTML',
    why: 'We could not read the live page, so paste the source and we will scan it here in your browser.',
    placeholder: 'Right-click your page → View Page Source → copy everything → paste it here.',
  },
  crawlers: {
    ask: 'Paste your robots.txt',
    why: 'This is the file that decides which AI crawlers get to read and train on your site.',
    placeholder: 'The contents of yoursite.com/robots.txt. No file yet? Leave it blank and pick your bots below.',
  },
  sharepreview: {
    ask: 'Paste your page HTML',
    why: 'The tags in your <head> decide whether your link shows a card or a naked URL.',
    placeholder: 'Paste your HTML — we only read the <head>.',
  },
  docs: {
    ask: 'Paste your README',
    why: 'So we can tell you whether a stranger could actually install and run this.',
    placeholder: 'Open README.md, copy everything, paste it here. No README? Leave it blank and we will write you one.',
  },
};

/** Inline "add what is missing" boxes, so the report completes itself. */
function gapPanel(entries, bundle, handlers) {
  const missing = entries.filter((e) => e.result.status === 'incomplete');
  if (!missing.length) return null;

  const list = el('div', { class: 'checks' });

  for (const entry of missing) {
    const copy = GAP_COPY[entry.id] || {
      ask: `Add input for ${entry.title}`,
      why: '',
      placeholder: 'Paste it here.',
    };
    const box = el('div', { class: 'gap' }, [
      el('p', { class: 'gap__title', text: copy.ask }),
      copy.why ? el('p', { class: 'gap__note', text: copy.why }) : null,
    ]);

    const area = el('textarea', {
      class: 'paste',
      attrs: { placeholder: copy.placeholder, spellcheck: 'false', 'aria-label': copy.ask },
    });
    box.append(area);

    if (entry.id === 'crawlers') {
      box.append(intentToggles(bundle, handlers.onIntent));
    }

    box.append(
      el('div', { class: 'gap__actions' }, [
        el(
          'button',
          {
            class: 'btn btn--primary btn--sm',
            attrs: { type: 'button' },
            on: { click: () => handlers.onGapSubmit(entry.id, area.value) },
          },
          [el('span', { text: 'Run this check' })],
        ),
      ]),
    );

    list.append(
      el('div', { class: 'check' }, [
        el('div', { class: 'check__head check__head--static' }, [
          el('span', { class: 'badge' }, [I.statusIcon('incomplete')]),
          el('span', { class: 'check__title' }, [
            el('span', { text: entry.title }),
            el('span', { class: 'check__sub', text: 'Not checked yet' }),
          ]),
          el('span', { class: 'check__score', text: '—' }),
        ]),
        box,
      ]),
    );
  }

  return panel(
    'Finish the picture',
    'A live URL cannot show us your license or your README. Paste them and the score updates.',
    list,
  );
}

const INTENT_OPTS = [
  ['blockTraining', 'Keep AI training bots out', 'GPTBot, ClaudeBot, CCBot and friends copy your pages to train models.'],
  ['blockAssistants', 'Keep AI assistants out', 'ChatGPT and Perplexity read your site to answer questions. Blocking them costs you reach.'],
  ['blockSearchAi', 'Opt out of Google & Apple AI training', 'Stay in normal search, stop feeding their models. The safe middle ground.'],
];

function intentToggles(bundle, onIntent) {
  const intent = (bundle && bundle.intent) || {};
  const wrap = el('div', { class: 'intent' });
  for (const [key, label, note] of INTENT_OPTS) {
    const input = el('input', { attrs: { type: 'checkbox' } });
    input.checked = !!intent[key];
    input.addEventListener('change', () => onIntent({ [key]: input.checked }));
    wrap.append(
      el('label', { class: 'intent__opt' }, [
        input,
        el('span', {}, [el('span', { text: label }), el('span', { class: 'intent__note', text: note })]),
      ]),
    );
  }
  return wrap;
}

/** What we read, and where it came from. */
function receiptPanel(bundle) {
  const sources = (bundle?.sources || []).filter((s) => s.used);
  if (!sources.length) return null;

  const wrap = el('div', { class: 'receipt' });
  for (const s of sources) {
    wrap.append(
      el('span', { class: `receipt__item${s.missing ? ' receipt__item--missing' : ''}` }, [
        s.origin === 'url' ? I.globe() : I.file(),
        el('span', { text: s.missing ? `${s.name} — not found` : s.name }),
      ]),
    );
  }
  const notes = bundle?.notes || [];
  const body = el('div', {}, [
    wrap,
    ...notes.map((n) => el('p', { class: 'panel__note', text: n })),
  ]);

  return panel('What we looked at', 'Read in your browser. Only the address you typed ever left it.', body);
}

/**
 * Render the whole report body.
 *
 * @param {HTMLElement} host
 * @param {{ overall:object, entries:Array<{id,title,result}>, bundle:object,
 *           handlers:{ onCopy:Function, onGapSubmit:Function, onIntent:Function } }} opts
 */
export function renderReport(host, opts = {}) {
  const { overall, entries = [], bundle = {}, handlers = {} } = opts;
  clear(host);
  const onCopy = handlers.onCopy || (() => {});

  const parts = [
    fixPanel(overall, onCopy),
    gapPanel(entries, bundle, handlers),
    checkPanel(entries, onCopy),
    receiptPanel(bundle),
  ].filter(Boolean);

  for (const p of parts) host.append(p);
}

/** The read-only banner shown when someone opens a shared score link. */
export function renderSharedBanner(host, payload, onRunMine) {
  const when = payload.at ? new Date(payload.at) : null;
  const stamp = when
    ? when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const text = payload.siteUrl
    ? `Someone ran VibeCheck on ${prettyUrl(payload.siteUrl)}${stamp ? ` on ${stamp}` : ''}.`
    : `A shared VibeCheck score${stamp ? ` from ${stamp}` : ''}.`;

  const bar = el('div', { class: 'sharedbar' }, [
    el('p', { text: `${text} This is the score card only — the details stay with whoever ran it.` }),
    el(
      'button',
      { class: 'btn btn--primary btn--sm', attrs: { type: 'button' }, on: { click: onRunMine } },
      [el('span', { text: 'Check my own' })],
    ),
  ]);
  host.append(bar);
}
