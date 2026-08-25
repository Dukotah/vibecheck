// ui/cards.js — render the dashboard grid of check cards from MODULE_META.
// UI layer (touches DOM). Pure metadata comes from the registry.

import { el } from './dom.js';

const STATUS_LABEL = {
  pass: 'Looks good',
  warn: 'Needs a look',
  fail: 'Needs fixing',
  incomplete: 'Not checked yet',
};

// A tiny plain-symbol per status (aria-hidden; the label carries meaning).
const STATUS_ICON = { pass: '✓', warn: '!', fail: '✕', incomplete: '·' };

/**
 * Render one check card.
 * @param {{id:string,title:string,tagline:string,order?:number}} meta
 * @param {string} status  current status for this module ('incomplete' default)
 * @param {(id:string)=>void} onOpen  called when the card's action is clicked
 * @param {boolean} [active]  is this card's form currently open?
 * @returns {HTMLElement}
 */
export function renderCard(meta, status, onOpen, active = false) {
  const st = STATUS_LABEL[status] ? status : 'incomplete';
  const badge = el(
    'span',
    { class: `card__badge card__badge--${st}`, attrs: { 'data-status': st } },
    [
      el('span', { class: 'card__badge-icon', attrs: { 'aria-hidden': 'true' }, text: STATUS_ICON[st] }),
      el('span', { text: STATUS_LABEL[st] }),
    ],
  );
  const num = typeof meta.order === 'number'
    ? el('span', { class: 'card__num', attrs: { 'aria-hidden': 'true' }, text: String(meta.order + 1) })
    : null;
  const title = el('h3', { class: 'card__title' }, [num, meta.title].filter(Boolean));
  const tagline = el('p', { class: 'card__tagline', text: meta.tagline });

  const ran = st !== 'incomplete';
  const action = el('button', {
    class: `card__action${ran ? ' card__action--ran' : ''}`,
    text: active ? 'Open ↓' : ran ? 'Run again' : 'Run this check',
    attrs: { type: 'button', 'data-module': meta.id },
    on: { click: () => onOpen(meta.id) },
  });

  return el(
    'article',
    {
      class: `card card--${st}${active ? ' card--active' : ''}`,
      attrs: { 'data-module-card': meta.id },
    },
    [el('div', { class: 'card__head' }, [title, badge]), tagline, action],
  );
}

/**
 * Render the full grid.
 * @param {Array<{id:string,title:string,tagline:string}>} metaList
 * @param {Record<string,string>} statuses  id -> status
 * @param {(id:string)=>void} onOpen
 * @param {string|null} [openId]  id of the currently open module (highlighted)
 * @returns {HTMLElement}
 */
export function renderCardGrid(metaList, statuses, onOpen, openId = null) {
  const grid = el('div', { class: 'card-grid', attrs: { role: 'list' } });
  for (const meta of metaList) {
    const wrap = el('div', { attrs: { role: 'listitem' } }, [
      renderCard(meta, statuses[meta.id] || 'incomplete', onOpen, meta.id === openId),
    ]);
    grid.append(wrap);
  }
  return grid;
}
