// preview.js — pure logic: turn parsed page metadata into per-platform
// link-preview models. Adapted from ogpreview/src/preview.js. Each platform
// picks fields with its own precedence and truncation, mirroring the real
// crawlers (Twitterbot, LinkedInBot, Slackbot, Apple's iMessage previewer).
//
// No browser globals.

import { resolveUrl } from './parse.js';

function firstOf(v) {
  if (Array.isArray(v)) return v.length ? v[0] : null;
  return v == null ? null : v;
}
function og(parsed, key) {
  return firstOf(parsed.og?.[key]);
}
function tw(parsed, key) {
  return firstOf(parsed.twitter?.[key]);
}

// Truncate to n chars on a word boundary, appending an ellipsis if cut.
export function truncate(str, n) {
  if (str == null) return null;
  const s = String(str).trim();
  if (s.length <= n) return s;
  let cut = s.slice(0, n);
  const sp = cut.lastIndexOf(' ');
  if (sp > n * 0.6) cut = cut.slice(0, sp);
  return cut.replace(/[\s.,;:!-]+$/, '') + '…';
}

// Derive a display domain from the final URL / canonical.
export function displayDomain(parsed) {
  const src = parsed.finalUrl || parsed.canonical || og(parsed, 'og:url');
  if (!src) return null;
  try {
    return new URL(src).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function absImage(parsed, href) {
  if (!href) return null;
  return resolveUrl(href, parsed.finalUrl || parsed.canonical || og(parsed, 'og:url'));
}

// ── Twitter / X ──────────────────────────────────────────────────────────────
export function twitterPreview(parsed) {
  const cardRaw = (tw(parsed, 'twitter:card') || '').toLowerCase();
  const card = ['summary', 'summary_large_image', 'app', 'player'].includes(cardRaw)
    ? cardRaw
    : og(parsed, 'og:image')
      ? 'summary_large_image'
      : 'summary';
  const title =
    tw(parsed, 'twitter:title') || og(parsed, 'og:title') || parsed.title || null;
  const description =
    tw(parsed, 'twitter:description') || og(parsed, 'og:description') || parsed.description || null;
  const image = absImage(parsed, tw(parsed, 'twitter:image') || og(parsed, 'og:image'));
  return {
    platform: 'twitter',
    label: 'Twitter / X',
    card,
    large: card === 'summary_large_image',
    domain: displayDomain(parsed),
    title: truncate(title, 70),
    description: card === 'summary_large_image' ? null : truncate(description, 200),
    image,
    hasImage: !!image,
  };
}

// ── LinkedIn (OG-only) ───────────────────────────────────────────────────────
export function linkedinPreview(parsed) {
  const title = og(parsed, 'og:title') || parsed.title || null;
  const description = og(parsed, 'og:description') || parsed.description || null;
  const image = absImage(parsed, og(parsed, 'og:image'));
  return {
    platform: 'linkedin',
    label: 'LinkedIn',
    domain: (displayDomain(parsed) || '').toUpperCase() || null,
    title: truncate(title, 200),
    description: truncate(description, 250),
    image,
    hasImage: !!image,
  };
}

// ── Slack ────────────────────────────────────────────────────────────────────
export function slackPreview(parsed) {
  const siteName = og(parsed, 'og:site_name') || displayDomain(parsed) || null;
  const title = og(parsed, 'og:title') || parsed.title || null;
  const description = og(parsed, 'og:description') || parsed.description || null;
  const image = absImage(parsed, og(parsed, 'og:image') || tw(parsed, 'twitter:image'));
  return {
    platform: 'slack',
    label: 'Slack',
    siteName,
    title: truncate(title, 160),
    description: truncate(description, 300),
    image,
    hasImage: !!image,
    barColor: parsed.themeColor || '#4a90d9',
  };
}

// ── iMessage / Apple ─────────────────────────────────────────────────────────
export function imessagePreview(parsed) {
  const title = og(parsed, 'og:title') || parsed.title || null;
  const image = absImage(parsed, og(parsed, 'og:image'));
  const siteName =
    firstOf(parsed.grouped?.['apple-mobile-web-app-title']) ||
    og(parsed, 'og:site_name') ||
    displayDomain(parsed) ||
    null;
  return {
    platform: 'imessage',
    label: 'iMessage',
    domain: (displayDomain(parsed) || '').toUpperCase() || null,
    siteName,
    title: truncate(title, 120),
    image,
    hasImage: !!image,
    rich: !!image,
  };
}

// ── Facebook (OG-only) ───────────────────────────────────────────────────────
export function facebookPreview(parsed) {
  const title = og(parsed, 'og:title') || parsed.title || null;
  const description = og(parsed, 'og:description') || parsed.description || null;
  const image = absImage(parsed, og(parsed, 'og:image'));
  const siteName = og(parsed, 'og:site_name') || displayDomain(parsed) || null;
  return {
    platform: 'facebook',
    label: 'Facebook',
    domain: (displayDomain(parsed) || '').toUpperCase() || null,
    siteName,
    title: truncate(title, 100),
    description: truncate(description, 300),
    image,
    hasImage: !!image,
    large: !!image,
  };
}

// ── Discord ──────────────────────────────────────────────────────────────────
export function discordPreview(parsed) {
  const siteName = og(parsed, 'og:site_name') || displayDomain(parsed) || null;
  const title = og(parsed, 'og:title') || parsed.title || null;
  const description = og(parsed, 'og:description') || parsed.description || null;
  const image = absImage(parsed, og(parsed, 'og:image') || tw(parsed, 'twitter:image'));
  return {
    platform: 'discord',
    label: 'Discord',
    siteName,
    title: truncate(title, 256),
    description: truncate(description, 350),
    image,
    hasImage: !!image,
    barColor: parsed.themeColor || '#5865f2',
  };
}

// ── Build all previews at once ───────────────────────────────────────────────
export function buildPreviews(parsed) {
  return {
    twitter: twitterPreview(parsed),
    facebook: facebookPreview(parsed),
    linkedin: linkedinPreview(parsed),
    slack: slackPreview(parsed),
    discord: discordPreview(parsed),
    imessage: imessagePreview(parsed),
  };
}
