// ui/results.js — render a module's ModuleResult and the overall score/report.
// UI layer (touches DOM). All dynamic text goes through textContent.

import { el, clear } from './dom.js';

const FINDING_MARK = { good: '✓', warn: '•', bad: '✗' };

// Plain-English status words shown on the result badge.
const STATUS_WORD = {
  pass: 'Looks good',
  warn: 'Needs a look',
  fail: 'Needs fixing',
  incomplete: 'Not checked yet',
};

/** Default copier (used if the shell does not pass one in). */
function defaultCopy(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(text);
}

/**
 * Render a single module result block.
 * @param {{title:string}} meta
 * @param {import('../contract.js').ModuleResult} result
 * @param {(text:string, okMsg?:string)=>void} [copy]  shell-provided copier
 * @returns {HTMLElement}
 */
export function renderResult(meta, result, copy = defaultCopy) {
  const wrap = el('section', { class: `result result--${result.status}` });
  wrap.append(
    el('div', { class: 'result__head' }, [
      el('div', { class: 'result__headtext' }, [
        el('h2', { class: 'result__title', text: meta.title }),
        el('span', { class: `result__badge result__badge--${result.status}`, text: STATUS_WORD[result.status] || '' }),
      ]),
      el('span', { class: `result__score result__score--${result.status}`, text: `${result.score}/100` }),
    ]),
  );
  if (result.summary) wrap.append(el('p', { class: 'result__summary', text: result.summary }));

  if (result.findings && result.findings.length) {
    const ul = el('ul', { class: 'findings' });
    for (const f of result.findings) {
      ul.append(
        el('li', { class: `finding finding--${f.level}` }, [
          el('span', { class: 'finding__mark', attrs: { 'aria-hidden': 'true' }, text: FINDING_MARK[f.level] || '•' }),
          el('span', { class: 'finding__text', text: f.text }),
        ]),
      );
    }
    wrap.append(ul);
  }

  if (result.fixes && result.fixes.length) {
    const fixWrap = el('div', { class: 'fixes' }, [
      el('h3', { class: 'fixes__title', text: 'How to fix it' }),
      el('p', { class: 'fixes__lead', text: 'Copy each snippet and drop it into your project.' }),
    ]);
    for (const fix of result.fixes) {
      const row = el('div', { class: 'fix' }, [el('p', { class: 'fix__label', text: fix.label })]);
      if (fix.copyText) {
        const codeWrap = el('div', { class: 'fix__codewrap' }, [
          el('pre', { class: 'fix__code' }, [el('code', { text: fix.copyText })]),
          el('button', {
            class: 'btn btn--ghost btn--sm fix__copy',
            text: 'Copy',
            attrs: { type: 'button', 'aria-label': `Copy fix: ${fix.label}` },
            on: { click: () => copy(fix.copyText, 'Fix copied — paste it into your project') },
          }),
        ]);
        row.append(codeWrap);
      }
      fixWrap.append(row);
    }
    wrap.append(fixWrap);
  }

  return wrap;
}

/**
 * Update the prominent overall readiness score panel.
 * @param {HTMLElement} scoreEl   the container
 * @param {import('../score.js').Overall} overall
 */
export function renderScore(scoreEl, overall) {
  clear(scoreEl);
  const pct = Math.max(0, Math.min(100, Number(overall.score) || 0));
  const gauge = el(
    'div',
    {
      class: `score__gauge score__gauge--${overall.status}`,
      attrs: {
        role: 'img',
        'aria-label': `Launch readiness ${overall.score} out of 100`,
        style: `--pct:${pct}`,
      },
    },
    [
      el('div', { class: 'score__dial' }, [
        el('span', { class: 'score__number', text: String(overall.score) }),
        el('span', { class: 'score__outof', text: '/ 100' }),
      ]),
    ],
  );
  const meta = el('div', { class: 'score__meta' }, [
    el('p', { class: 'score__label', text: overall.label }),
    el('p', {
      class: 'score__progress',
      text: `${overall.checksRun} of ${overall.checksTotal} checks run`,
    }),
  ]);
  scoreEl.append(gauge, meta);
}

/**
 * Render the prioritized fix list (overall.fixes).
 * @param {HTMLElement} container
 * @param {import('../score.js').Overall} overall
 * @param {(text:string, okMsg?:string)=>void} [copy]
 */
export function renderFixList(container, overall, copy = defaultCopy) {
  clear(container);
  if (!overall.fixes || !overall.fixes.length) {
    if (overall.checksRun > 0) {
      container.append(
        el('p', { class: 'fixlist__empty fixlist__empty--clear' }, [
          el('strong', { text: 'Nothing to fix here. ' }),
          'Every check you have run came back clean. Run the rest to be sure.',
        ]),
      );
    } else {
      container.append(
        el('p', { class: 'fixlist__empty', text: 'Run a check and anything worth fixing shows up here, most important first.' }),
      );
    }
    return;
  }
  container.append(el('p', { class: 'fixlist__lead', text: `${overall.fixes.length} thing${overall.fixes.length === 1 ? '' : 's'} to look at, most important first.` }));
  const ol = el('ol', { class: 'fixlist' });
  for (const fix of overall.fixes) {
    const item = el('li', { class: `fixlist__item fixlist__item--${fix.status}` }, [
      el('span', { class: 'fixlist__module', text: fix.moduleTitle }),
      el('span', { class: 'fixlist__label', text: fix.label }),
    ]);
    if (fix.copyText) {
      item.append(
        el('button', {
          class: 'btn btn--ghost btn--sm fixlist__copy',
          text: 'Copy fix',
          attrs: { type: 'button', 'aria-label': `Copy fix: ${fix.label}` },
          on: { click: () => copy(fix.copyText, 'Fix copied') },
        }),
      );
    }
    ol.append(item);
  }
  container.append(ol);
}
