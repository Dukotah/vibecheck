// api/badge.js — the README badge.
//
// `/api/badge?score=87` returns a small SVG in the shields.io house style, so a
// VibeCheck score can sit at the top of a README next to the build badge. No
// dependencies, no state, no tracking: the score is in the URL, we just draw it.

const COLORS = {
  ready: '#22a06b',
  almost: '#d69112',
  notReady: '#d1495b',
  unknown: '#7e8aa1',
};

const LABEL = 'launch readiness';

/** Rough advance width for the 11px DejaVu-ish font shields uses. */
function textWidth(text) {
  let w = 0;
  for (const ch of String(text)) {
    if (/[iljI.,:;'!|]/.test(ch)) w += 3.1;
    else if (/[frt()[\]]/.test(ch)) w += 4.4;
    else if (/[A-Z]/.test(ch)) w += 8.0;
    else if (/[mwMW]/.test(ch)) w += 10.5;
    else if (/[0-9]/.test(ch)) w += 7.0;
    else if (ch === ' ') w += 3.6;
    else w += 6.6;
  }
  return w;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function bandColor(score, valid) {
  if (!valid) return COLORS.unknown;
  if (score >= 85) return COLORS.ready;
  if (score >= 60) return COLORS.almost;
  return COLORS.notReady;
}

export function renderBadge(rawScore) {
  const n = Number(rawScore);
  const valid = Number.isFinite(n);
  const score = valid ? Math.max(0, Math.min(100, Math.round(n))) : null;
  const value = valid ? `${score}/100` : 'not run';
  const color = bandColor(score, valid);

  const padding = 10;
  const labelW = Math.round(textWidth(LABEL) + padding * 2);
  const valueW = Math.round(textWidth(value) + padding * 2);
  const total = labelW + valueW;
  const h = 20;

  // Text is drawn twice: once as a soft shadow, once solid — the shields look.
  const label = esc(LABEL);
  const val = esc(value);

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${total}" height="${h}" role="img" aria-label="${label}: ${val}">
  <title>${label}: ${val}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${total}" height="${h}" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="${h}" fill="#40485a"/>
    <rect x="${labelW}" width="${valueW}" height="${h}" fill="${color}"/>
    <rect width="${total}" height="${h}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,Geneva,sans-serif" font-size="11">
    <text x="${labelW / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelW / 2}" y="14">${label}</text>
    <text x="${labelW + valueW / 2}" y="15" fill="#010101" fill-opacity=".3">${val}</text>
    <text x="${labelW + valueW / 2}" y="14">${val}</text>
  </g>
</svg>`;
}

export default function handler(req, res) {
  const raw = req.query && req.query.score;
  const svg = renderBadge(Array.isArray(raw) ? raw[0] : raw);

  res.statusCode = 200;
  res.setHeader('content-type', 'image/svg+xml; charset=utf-8');
  // A badge for a given score never changes, so let it cache hard.
  res.setHeader('cache-control', 'public, max-age=86400, s-maxage=604800, immutable');
  res.end(svg);
}
