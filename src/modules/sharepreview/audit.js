// audit.js — pure logic: inspect parsed metadata and emit actionable issues.
// Adapted from ogpreview/src/audit.js. No browser globals.

import { resolveUrl } from './parse.js';

export const SEVERITY = { ERROR: 'error', WARN: 'warn', OK: 'ok' };

function firstOf(v) {
  if (Array.isArray(v)) return v.length ? v[0] : null;
  return v == null ? null : v;
}
const og = (p, k) => firstOf(p.og?.[k]);
const tw = (p, k) => firstOf(p.twitter?.[k]);

// Is a URL absolute (http/https)?
export function isAbsoluteUrl(u) {
  if (!u) return false;
  return /^https?:\/\//i.test(String(u).trim());
}

// Run the full audit. Returns { issues, counts, score }.
// Each issue: { id, severity, field, message, fix }.
export function audit(parsed) {
  const issues = [];
  const add = (severity, field, message, fix, id) =>
    issues.push({ id: id || field, severity, field, message, fix });

  const ogTitle = og(parsed, 'og:title');
  const ogDesc = og(parsed, 'og:description');
  const ogImage = og(parsed, 'og:image');
  const ogUrl = og(parsed, 'og:url');
  const ogType = og(parsed, 'og:type');
  const ogSite = og(parsed, 'og:site_name');
  const twCard = tw(parsed, 'twitter:card');
  const twImage = tw(parsed, 'twitter:image');
  const base = parsed.finalUrl || parsed.canonical || ogUrl || null;

  // ── og:title ────────────────────────────────────────────────────────────
  if (!ogTitle) {
    if (parsed.title) {
      add(SEVERITY.WARN, 'og:title',
        'No og:title — platforms will fall back to your plain <title> tag.',
        'Add <meta property="og:title" content="…"> so previews are not at the mercy of your raw <title>.');
    } else {
      add(SEVERITY.ERROR, 'og:title',
        'No og:title and no <title> — the preview will have no headline at all.',
        'Add <meta property="og:title" content="Your headline">.');
    }
  } else if (ogTitle.length > 70) {
    add(SEVERITY.WARN, 'og:title',
      `Your share title is ${ogTitle.length} characters — Twitter/X cuts it off around 70.`,
      'Keep og:title under ~60 characters so it is not cut off.');
  } else {
    add(SEVERITY.OK, 'og:title', 'Share title is set.', '');
  }

  // ── og:description ──────────────────────────────────────────────────────
  if (!ogDesc && !parsed.description) {
    add(SEVERITY.WARN, 'og:description',
      'No description — the preview card body will be empty.',
      'Add <meta property="og:description" content="One-sentence summary">.');
  } else if (ogDesc && ogDesc.length > 300) {
    add(SEVERITY.WARN, 'og:description',
      `Your share description is ${ogDesc.length} characters — most apps only show about 200.`,
      'Trim og:description to ~150–200 characters.');
  } else {
    add(SEVERITY.OK, 'og:description', 'Description is set.', '');
  }

  // ── og:image ────────────────────────────────────────────────────────────
  if (!ogImage) {
    add(SEVERITY.ERROR, 'og:image',
      'No preview image — your link will show as a small text-only card everywhere.',
      'Add <meta property="og:image" content="https://…/card.png"> (1200×630 recommended).');
  } else if (!isAbsoluteUrl(ogImage)) {
    const resolved = base ? resolveUrl(ogImage, base) : null;
    add(SEVERITY.ERROR, 'og:image',
      `Your preview image "${ogImage}" is a relative path — Facebook, LinkedIn and iMessage need a full https link.`,
      resolved
        ? `Use the absolute form: ${resolved}`
        : 'Make og:image a full absolute https:// URL.');
  } else if (!/^https:/i.test(ogImage)) {
    add(SEVERITY.WARN, 'og:image',
      'Your preview image loads over http, not https — some apps refuse insecure images.',
      'Serve the image over https.');
  } else {
    add(SEVERITY.OK, 'og:image', 'Preview image is set and absolute.', '');
    const w = Number(firstOf(parsed.grouped?.['og:image:width']));
    const h = Number(firstOf(parsed.grouped?.['og:image:height']));
    if (w && h && (w < 200 || h < 200)) {
      add(SEVERITY.WARN, 'og:image:size',
        `Your declared image is ${w}×${h}px — below the 200×200 minimum, so apps may drop it.`,
        'Use at least 200×200; 1200×630 is ideal for large cards.');
    }
  }

  // ── og:url ──────────────────────────────────────────────────────────────
  if (!ogUrl) {
    add(SEVERITY.WARN, 'og:url',
      'No og:url — set your canonical URL so shares from tracking links unify.',
      'Add <meta property="og:url" content="https://your-canonical-url">.');
  } else if (!isAbsoluteUrl(ogUrl)) {
    add(SEVERITY.ERROR, 'og:url',
      'og:url must be a full absolute URL.',
      'Use the full https:// canonical URL in og:url.');
  }

  // ── og:type ─────────────────────────────────────────────────────────────
  if (!ogType) {
    add(SEVERITY.WARN, 'og:type',
      'No og:type — defaults to "website"; articles lose richer metadata.',
      'Add <meta property="og:type" content="website"> (or "article").');
  }

  // ── og:site_name ────────────────────────────────────────────────────────
  if (!ogSite) {
    add(SEVERITY.WARN, 'og:site_name',
      'No site name — Slack and iMessage show a bare domain instead of your brand.',
      'Add <meta property="og:site_name" content="Your Brand">.');
  }

  // ── twitter:card ────────────────────────────────────────────────────────
  if (!twCard) {
    add(SEVERITY.WARN, 'twitter:card',
      'No twitter:card — X shows a small summary card even when you have a big image.',
      'Add <meta name="twitter:card" content="summary_large_image">.');
  } else if (!['summary', 'summary_large_image', 'app', 'player'].includes(twCard.toLowerCase())) {
    add(SEVERITY.ERROR, 'twitter:card',
      `twitter:card "${twCard}" is not a valid card type.`,
      'Use one of: summary, summary_large_image, app, player.');
  } else if (twCard.toLowerCase() === 'summary_large_image' && !twImage && !ogImage) {
    add(SEVERITY.ERROR, 'twitter:card',
      'twitter:card is summary_large_image but there is no image — X will show a blank/broken card.',
      'Add twitter:image or og:image, or switch to card=summary.');
  }

  // ── malformed JSON-LD ───────────────────────────────────────────────────
  const badLd = (parsed.schema || []).find((s) => s && s.__parseError);
  if (badLd) {
    add(SEVERITY.ERROR, 'json-ld',
      'A JSON-LD (schema.org) block failed to parse — search engines will ignore it.',
      'Fix the JSON syntax in your <script type="application/ld+json"> block.');
  }

  const counts = countBySeverity(issues);
  return { issues, counts, score: scoreFrom(counts) };
}

export function countBySeverity(issues) {
  const counts = { error: 0, warn: 0, ok: 0 };
  for (const i of issues) counts[i.severity] = (counts[i.severity] || 0) + 1;
  return counts;
}

// A 0–100 readiness score. Errors cost 20, warnings cost 6, floored at 0.
export function scoreFrom(counts) {
  const raw = 100 - counts.error * 20 - counts.warn * 6;
  return Math.max(0, Math.min(100, raw));
}

// Convenience: only the non-OK issues, errors first.
export function problems(auditResult) {
  const order = { error: 0, warn: 1, ok: 2 };
  return auditResult.issues
    .filter((i) => i.severity !== SEVERITY.OK)
    .sort((a, b) => order[a.severity] - order[b.severity]);
}
