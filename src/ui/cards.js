// ui/cards.js — render the dashboard grid of check cards from MODULE_META.
// UI layer (touches DOM). Pure metadata comes from the registry.

import { el, icon } from './dom.js';

const STATUS_LABEL = {
  pass: 'Looks good',
  warn: 'Needs a look',
  fail: 'Needs fixing',
  incomplete: 'Not checked yet',
};

/* Developer-authored inline-SVG icons — one crafted glyph per check. These are
   fixed literals (never user input), stroked on a 24×24 grid for a cohesive set. */
const STROKE = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
const CHECK_ICON = {
  // Legal & Licenses — balance scale
  legal: [
    { d: 'M12 3v18', attrs: STROKE },
    { d: 'M7 6h10', attrs: STROKE },
    { d: 'M7 6 4 13h6L7 6Z', attrs: STROKE },
    { d: 'M17 6l-3 7h6l-3-7Z', attrs: STROKE },
    { d: 'M4 13a3 3 0 0 0 6 0M14 13a3 3 0 0 0 6 0', attrs: STROKE },
    { d: 'M8.5 21h7', attrs: STROKE },
  ],
  // Accessibility — person-in-ring
  accessibility: [
    { tag: 'circle', attrs: { cx: '12', cy: '12', r: '9', ...STROKE } },
    { tag: 'circle', attrs: { cx: '12', cy: '7.5', r: '1.15', fill: 'currentColor', stroke: 'none' } },
    { d: 'M7.5 10.2c1.4.7 3 1.05 4.5 1.05s3.1-.35 4.5-1.05', attrs: STROKE },
    { d: 'M12 11.25V15m0 0-2 3.2M12 15l2 3.2', attrs: STROKE },
  ],
  // AI Crawlers & robots.txt — robot face
  crawlers: [
    { tag: 'rect', attrs: { x: '4.5', y: '8', width: '15', height: '11', rx: '2.5', ...STROKE } },
    { d: 'M12 8V4.5M12 4.5h-.01', attrs: STROKE },
    { tag: 'circle', attrs: { cx: '9', cy: '13', r: '1.15', fill: 'currentColor', stroke: 'none' } },
    { tag: 'circle', attrs: { cx: '15', cy: '13', r: '1.15', fill: 'currentColor', stroke: 'none' } },
    { d: 'M9.5 16.2h5', attrs: STROKE },
    { d: 'M4.5 12.5H3M21 12.5h-1.5', attrs: STROKE },
  ],
  // Social Share Preview — image / share card
  sharepreview: [
    { tag: 'rect', attrs: { x: '3.5', y: '5', width: '17', height: '14', rx: '2.5', ...STROKE } },
    { tag: 'circle', attrs: { cx: '8.5', cy: '10', r: '1.5', ...STROKE } },
    { d: 'M4 16.5 9 12l3.2 3 3-2.4L20 16.8', attrs: STROKE },
  ],
  // README & Docs — document with lines
  docs: [
    { d: 'M6.5 3.5h7L18 8v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5A1.5 1.5 0 0 1 6.5 3.5Z', attrs: STROKE },
    { d: 'M13 3.5V8h4.5', attrs: STROKE },
    { d: 'M8.5 12.5h7M8.5 15.5h7M8.5 9.5h2.5', attrs: STROKE },
  ],
};

/* Small status glyphs (aria-hidden; the label text carries meaning). */
const STATUS_GLYPH = {
  pass: [{ d: 'm4.5 8.5 2.4 2.4L11.5 5', attrs: { ...STROKE, 'stroke-width': '2' } }],
  warn: [{ d: 'M8 3.5v5.2', attrs: { ...STROKE, 'stroke-width': '2' } }, { d: 'M8 11.6h.01', attrs: { ...STROKE, 'stroke-width': '2' } }],
  fail: [{ d: 'M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5', attrs: { ...STROKE, 'stroke-width': '2' } }],
  incomplete: [{ tag: 'circle', attrs: { cx: '8', cy: '8', r: '2.4', fill: 'currentColor', stroke: 'none' } }],
};

function checkIcon(id) {
  return icon({ className: 'card__glyph', paths: CHECK_ICON[id] || CHECK_ICON.docs });
}

function statusGlyph(status) {
  return icon({ viewBox: '0 0 16 16', className: 'card__badge-icon', paths: STATUS_GLYPH[status] || STATUS_GLYPH.incomplete });
}

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
      statusGlyph(st),
      el('span', { text: STATUS_LABEL[st] }),
    ],
  );

  const iconWrap = el('span', { class: 'card__icon', attrs: { 'aria-hidden': 'true' } }, [checkIcon(meta.id)]);
  const num = typeof meta.order === 'number'
    ? el('span', { class: 'card__num', attrs: { 'aria-hidden': 'true' }, text: String(meta.order + 1) })
    : null;
  const title = el('h3', { class: 'card__title', text: meta.title });
  const tagline = el('p', { class: 'card__tagline', text: meta.tagline });

  const ran = st !== 'incomplete';
  const action = el('button', {
    class: `card__action${ran ? ' card__action--ran' : ''}`,
    attrs: { type: 'button', 'data-module': meta.id },
    on: { click: () => onOpen(meta.id) },
  }, [
    el('span', { text: active ? 'Open check' : ran ? 'Run again' : 'Run this check' }),
    icon({ viewBox: '0 0 16 16', className: 'card__action-arrow', paths: [{ d: 'M3.5 8h9M8.5 4l4 4-4 4', attrs: { ...STROKE, 'stroke-width': '1.75' } }] }),
  ]);

  return el(
    'article',
    {
      class: `card card--${st}${active ? ' card--active' : ''}`,
      attrs: { 'data-module-card': meta.id },
    },
    [
      el('div', { class: 'card__head' }, [
        el('div', { class: 'card__lead' }, [iconWrap, num]),
        badge,
      ]),
      el('div', { class: 'card__body' }, [title, tagline]),
      action,
    ],
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
