// ui/icons.js — the icon set, authored inline so the page never makes a
// network request for a sprite sheet or a font.
//
// Every path here is a developer-authored literal. No user input reaches this
// file, which is why it is the one place allowed to build markup structurally.

import { icon } from './dom.js';

const STROKE = {
  stroke: 'currentColor',
  'stroke-width': '1.7',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};

function stroked(paths, className) {
  return icon({
    className,
    paths: paths.map((d) => (typeof d === 'string' ? { d, attrs: STROKE } : d)),
  });
}

/** One glyph per check, so the five are distinguishable at a glance. */
export const CHECK_ICONS = {
  // Scales — legal
  legal: (c) => stroked(['M12 4v16', 'M7 20h10', 'M4 8h16', 'M12 4 4 8l-2 5a4 4 0 0 0 8 0Z', 'M12 4l8 4 2 5a4 4 0 0 1-8 0Z'], c),
  // Person in a ring — accessibility
  accessibility: (c) =>
    stroked([
      { tag: 'circle', attrs: { ...STROKE, cx: '12', cy: '12', r: '9' } },
      { tag: 'circle', attrs: { ...STROKE, cx: '12', cy: '7.6', r: '1.4' } },
      'M7.5 10.4c3 .9 6 .9 9 0',
      'M12 10.6v4M12 14.6l-2 4.2M12 14.6l2 4.2',
    ], c),
  // Robot — crawlers
  crawlers: (c) =>
    stroked([
      { tag: 'rect', attrs: { ...STROKE, x: '4', y: '8', width: '16', height: '11', rx: '3' } },
      'M12 4v4',
      { tag: 'circle', attrs: { ...STROKE, cx: '9.2', cy: '13', r: '1.1' } },
      { tag: 'circle', attrs: { ...STROKE, cx: '14.8', cy: '13', r: '1.1' } },
      'M2.5 12.5v3M21.5 12.5v3',
    ], c),
  // Share card — social preview
  sharepreview: (c) =>
    stroked([
      { tag: 'rect', attrs: { ...STROKE, x: '3', y: '5', width: '18', height: '14', rx: '2.5' } },
      'M3 14.5 8 10l4.5 4',
      { tag: 'circle', attrs: { ...STROKE, cx: '15.5', cy: '9.5', r: '1.4' } },
    ], c),
  // Document — docs
  docs: (c) =>
    stroked(['M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z', 'M14 3v4h4', 'M8.5 12h7M8.5 16h5'], c),
};

export const check = (c) => stroked(['M4.5 12.5 9.5 17.5 19.5 6.5'], c);
export const bang = (c) => stroked(['M12 7v6', { tag: 'circle', attrs: { ...STROKE, cx: '12', cy: '16.6', r: '.9', fill: 'currentColor' } }], c);
export const cross = (c) => stroked(['M7 7l10 10M17 7 7 17'], c);
export const dash = (c) => stroked(['M7 12h10'], c);
export const chevron = (c) => stroked(['M6 9.5 12 15.5 18 9.5'], c);
export const copy = (c) => stroked([
  { tag: 'rect', attrs: { ...STROKE, x: '9', y: '9', width: '11', height: '11', rx: '2' } },
  'M5 15V6a2 2 0 0 1 2-2h8',
], c);
export const link = (c) => stroked(['M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7l-1.3 1.3', 'M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 0 0 5.7 5.7l1.3-1.3'], c);
export const download = (c) => stroked(['M12 4v11', 'M8 11.5 12 15.5 16 11.5', 'M5 19h14'], c);
export const printer = (c) => stroked([
  'M7 9V4h10v5', 'M7 18H5.5A1.5 1.5 0 0 1 4 16.5v-5A1.5 1.5 0 0 1 5.5 10h13a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H17',
  { tag: 'rect', attrs: { ...STROKE, x: '7', y: '15', width: '10', height: '5', rx: '1' } },
], c);
export const again = (c) => stroked(['M3.5 12.5A6.5 6.5 0 0 1 15 8.4M16.5 7.5V4M16.5 7.5H13', 'M16.5 7.5A6.5 6.5 0 0 1 5 11.6M3.5 12.5V16M3.5 12.5H7'], c);
export const file = (c) => stroked(['M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z', 'M14 3v4h4'], c);
export const globe = (c) => stroked([
  { tag: 'circle', attrs: { ...STROKE, cx: '12', cy: '12', r: '9' } },
  'M3 12h18', 'M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18',
], c);
export const badge = (c) => stroked([
  { tag: 'circle', attrs: { ...STROKE, cx: '12', cy: '10', r: '6' } },
  'M8.5 15 7 21l5-2.4L17 21l-1.5-6',
], c);
export const moon = (c) => stroked(['M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z'], c);
export const sun = (c) => stroked([
  { tag: 'circle', attrs: { ...STROKE, cx: '12', cy: '12', r: '4' } },
  'M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4',
], c);

/** Status glyph for a check result. */
export function statusIcon(status, className) {
  if (status === 'pass') return check(className);
  if (status === 'warn') return bang(className);
  if (status === 'fail') return cross(className);
  return dash(className);
}
