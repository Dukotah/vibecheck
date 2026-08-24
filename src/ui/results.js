// ui/results.js — render a module's ModuleResult and the overall score/report.
// UI layer (touches DOM). All dynamic text goes through textContent.

import { el, clear } from './dom.js';

const FINDING_MARK = { good: '✓', warn: '•', bad: '✗' };

/**
 * Render a single module result block.
 * @param {{title:string}} meta
 * @param {import('../contract.js').ModuleResult} result
 * @returns {HTMLElement}
 */
export function renderResult(meta, result) {
  const wrap = el('section', { class: `result result--${result.status}` });
  wrap.append(
    el('div', { class: 'result__head' }, [
      el('h2', { class: 'result__title', text: meta.title }),
      el('span', { class: `result__score result__score--${result.status}`, text: `${result.score}/100` }),
    ]),
  );
  if (result.summary) wrap.append(el('p', { class: 'result__summary', text: result.summary }));

  if (result.findings && result.findings.length) {
    const ul = el('ul', { class: 'findings' });
    for (const f of result.findings) {
      ul.append(
        el('li', { class: `finding finding--${f.level}` }, [
          el('span', { class: 'finding__mark', text: FINDING_MARK[f.level] || '•' }),
          el('span', { class: 'finding__text', text: f.text }),
        ]),
      );
    }
    wrap.append(ul);
  }

  if (result.fixes && result.fixes.length) {
    const fixWrap = el('div', { class: 'fixes' }, [el('h3', { class: 'fixes__title', text: 'How to fix it' })]);
    for (const fix of result.fixes) {
      const row = el('div', { class: 'fix' }, [el('p', { class: 'fix__label', text: fix.label })]);
      if (fix.copyText) {
        row.append(el('pre', { class: 'fix__code' }, [el('code', { text: fix.copyText })]));
        row.append(
          el('button', {
            class: 'btn btn--ghost fix__copy',
            text: 'Copy',
            attrs: { type: 'button' },
            on: {
              click: () => {
                if (navigator.clipboard) navigator.clipboard.writeText(fix.copyText);
              },
            },
          }),
        );
      }
      fixWrap.append(row);
    }
    wrap.append(fixWrap);
  }

  return wrap;
}

/**
 * Update the prominent overall readiness score panel.
 * @param {HTMLElement} scoreEl   the container (#score-value etc live inside)
 * @param {import('../score.js').Overall} overall
 */
export function renderScore(scoreEl, overall) {
  clear(scoreEl);
  const gauge = el('div', { class: `score__gauge score__gauge--${overall.status}` }, [
    el('span', { class: 'score__number', text: String(overall.score) }),
    el('span', { class: 'score__outof', text: '/ 100' }),
  ]);
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
 */
export function renderFixList(container, overall) {
  clear(container);
  if (!overall.fixes || !overall.fixes.length) {
    container.append(el('p', { class: 'fixlist__empty', text: 'No fixes yet — run some checks to see your to-do list.' }));
    return;
  }
  container.append(el('h2', { class: 'fixlist__title', text: 'Fix these before you ship' }));
  const ol = el('ol', { class: 'fixlist' });
  for (const fix of overall.fixes) {
    ol.append(
      el('li', { class: `fixlist__item fixlist__item--${fix.status}` }, [
        el('span', { class: 'fixlist__module', text: fix.moduleTitle }),
        el('span', { class: 'fixlist__label', text: fix.label }),
      ]),
    );
  }
  container.append(ol);
}
