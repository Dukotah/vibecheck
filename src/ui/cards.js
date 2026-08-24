// ui/cards.js — render the dashboard grid of check cards from MODULE_META.
// UI layer (touches DOM). Pure metadata comes from the registry.

import { el } from './dom.js';

const STATUS_LABEL = {
  pass: 'Passed',
  warn: 'Needs a look',
  fail: 'Failed',
  incomplete: 'Not checked yet',
};

/**
 * Render one check card.
 * @param {{id:string,title:string,tagline:string}} meta
 * @param {string} status  current status for this module ('incomplete' default)
 * @param {(id:string)=>void} onOpen  called when the card's action is clicked
 * @returns {HTMLElement}
 */
export function renderCard(meta, status, onOpen) {
  const st = STATUS_LABEL[status] ? status : 'incomplete';
  const badge = el('span', {
    class: `card__badge card__badge--${st}`,
    text: STATUS_LABEL[st],
    attrs: { 'data-status': st },
  });
  const title = el('h3', { class: 'card__title', text: meta.title });
  const tagline = el('p', { class: 'card__tagline', text: meta.tagline });
  const action = el('button', {
    class: 'card__action',
    text: 'Run this check',
    attrs: { type: 'button', 'data-module': meta.id },
    on: { click: () => onOpen(meta.id) },
  });

  return el(
    'article',
    { class: 'card', attrs: { 'data-module-card': meta.id } },
    [el('div', { class: 'card__head' }, [title, badge]), tagline, action],
  );
}

/**
 * Render the full grid.
 * @param {Array<{id:string,title:string,tagline:string}>} metaList
 * @param {Record<string,string>} statuses  id -> status
 * @param {(id:string)=>void} onOpen
 * @returns {HTMLElement}
 */
export function renderCardGrid(metaList, statuses, onOpen) {
  const grid = el('div', { class: 'card-grid', attrs: { role: 'list' } });
  for (const meta of metaList) {
    const wrap = el('div', { attrs: { role: 'listitem' } }, [
      renderCard(meta, statuses[meta.id] || 'incomplete', onOpen),
    ]);
    grid.append(wrap);
  }
  return grid;
}
