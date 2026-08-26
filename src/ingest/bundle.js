// ingest/bundle.js — collect whatever the user gave us into one object the
// checks can run against.
//
// A bundle is the app's working memory: every source we accepted (a dropped
// file, a paste, a fetched page) plus the per-module inputs those sources
// produced. The UI shows the bundle back to the user as a receipt — "here is
// what I found and what I did with it" — which is what makes the one-input
// flow feel honest instead of magic.
//
// Pure: no DOM, no network, never throws.

import { detect, KIND_LABEL } from './detect.js';

/** Which check each kind of file feeds. Used for the receipt copy. */
export const KIND_FEEDS = {
  html: ['accessibility', 'sharepreview'],
  robots: ['crawlers'],
  license: ['legal'],
  packages: ['legal'],
  readme: ['docs'],
};

/** A fresh, empty bundle. */
export function emptyBundle() {
  return {
    siteUrl: '',
    sources: [],
    inputs: {
      legal: {},
      accessibility: {},
      crawlers: {},
      sharepreview: {},
      docs: {},
    },
    intent: { blockTraining: true, blockAssistants: false, blockSearchAi: false },
    notes: [],
  };
}

/** Deep-ish clone so callers can treat bundles as immutable values. */
function cloneBundle(b) {
  const base = emptyBundle();
  if (!b || typeof b !== 'object') return base;
  return {
    siteUrl: typeof b.siteUrl === 'string' ? b.siteUrl : '',
    sources: Array.isArray(b.sources) ? b.sources.map((s) => ({ ...s })) : [],
    inputs: {
      legal: { ...(b.inputs?.legal || {}) },
      accessibility: { ...(b.inputs?.accessibility || {}) },
      crawlers: { ...(b.inputs?.crawlers || {}) },
      sharepreview: { ...(b.inputs?.sharepreview || {}) },
      docs: { ...(b.inputs?.docs || {}) },
    },
    intent: { ...base.intent, ...(b.intent || {}) },
    notes: Array.isArray(b.notes) ? b.notes.slice() : [],
  };
}

/** Prefer an index page over a random one; otherwise prefer the bigger file. */
function htmlBeats(candidate, incumbent) {
  if (!incumbent) return true;
  const candIndex = /(^|[\\/])index\.html?$/i.test(candidate.name || '');
  const incIndex = /(^|[\\/])index\.html?$/i.test(incumbent.name || '');
  if (candIndex !== incIndex) return candIndex;
  return (candidate.text || '').length > (incumbent.text || '').length;
}

/** package.json beats requirements.txt when someone drops a polyglot repo. */
function packagesBeats(candidate, incumbent) {
  if (!incumbent) return true;
  const candJson = /package\.json$/i.test(candidate.name || '');
  const incJson = /package\.json$/i.test(incumbent.name || '');
  if (candJson !== incJson) return candJson;
  return (candidate.text || '').length > (incumbent.text || '').length;
}

/**
 * Add one blob of text to a bundle. Returns a NEW bundle.
 *
 * @param {object} bundle
 * @param {{ text:string, name?:string, origin?:'file'|'paste'|'url' }} blob
 * @returns {object} the new bundle
 */
export function addBlob(bundle, blob) {
  const next = cloneBundle(bundle);
  const text = typeof blob?.text === 'string' ? blob.text : '';
  const name = typeof blob?.name === 'string' ? blob.name : '';
  const origin = blob?.origin === 'file' || blob?.origin === 'url' ? blob.origin : 'paste';
  if (!text.trim()) return next;

  const { kind, confidence } = detect(text, name);
  const source = {
    name: name || KIND_LABEL[kind] || 'pasted text',
    kind,
    origin,
    confidence,
    bytes: text.length,
    text,
    used: kind !== 'unknown',
  };

  if (kind === 'unknown') {
    next.sources.push(source);
    return next;
  }

  // Only one source of each kind wins; keep the best one.
  const existing = next.sources.find((s) => s.kind === kind && s.used);
  if (kind === 'html') {
    if (!htmlBeats(source, existing)) {
      source.used = false;
      next.sources.push(source);
      return next;
    }
  } else if (kind === 'packages') {
    if (!packagesBeats(source, existing)) {
      source.used = false;
      next.sources.push(source);
      return next;
    }
  } else if (existing && (existing.text || '').length >= text.length) {
    source.used = false;
    next.sources.push(source);
    return next;
  }
  if (existing) existing.used = false;

  switch (kind) {
    case 'html':
      next.inputs.accessibility = { html: text };
      next.inputs.sharepreview = { headHtml: text, pageUrl: next.siteUrl || '' };
      break;
    case 'robots':
      next.inputs.crawlers = { ...next.intent, robotsTxt: text };
      break;
    case 'license':
      next.inputs.legal = { ...next.inputs.legal, licenseText: text };
      break;
    case 'packages':
      next.inputs.legal = { ...next.inputs.legal, packages: text };
      break;
    case 'readme':
      next.inputs.docs = { ...next.inputs.docs, readme: text };
      break;
    default:
      break;
  }

  next.sources.push(source);
  return next;
}

/**
 * Fold a whole scan response from /api/scan into a bundle.
 *
 * @param {object} bundle
 * @param {{ finalUrl:string, html:string, robotsTxt:string, robotsFound:boolean }} scan
 * @returns {object} the new bundle
 */
export function addUrlScan(bundle, scan) {
  let next = cloneBundle(bundle);
  const s = scan && typeof scan === 'object' ? scan : {};
  const finalUrl = typeof s.finalUrl === 'string' ? s.finalUrl : '';
  if (finalUrl) next.siteUrl = finalUrl;

  if (typeof s.html === 'string' && s.html.trim()) {
    next = addBlob(next, { text: s.html, name: 'index.html', origin: 'url' });
    // The page URL lets the share-preview check resolve relative image paths.
    next.inputs.sharepreview = { ...next.inputs.sharepreview, pageUrl: next.siteUrl };
  }

  if (s.robotsFound && typeof s.robotsTxt === 'string' && s.robotsTxt.trim()) {
    next = addBlob(next, { text: s.robotsTxt, name: 'robots.txt', origin: 'url' });
  } else {
    // No robots.txt is itself the finding. Feeding the check an empty file plus
    // the user's blocking intent produces "you have none, here is one".
    next.inputs.crawlers = { ...next.intent, robotsTxt: '' };
    next.sources.push({
      name: 'robots.txt',
      kind: 'robots',
      origin: 'url',
      confidence: 'name',
      bytes: 0,
      text: '',
      used: true,
      missing: true,
    });
  }

  if (s.truncated) {
    next.notes.push('That page is unusually large, so we checked the first part of it.');
  }
  return next;
}

/** Re-apply the user's AI-crawler blocking choice to the crawlers input. */
export function setIntent(bundle, intent) {
  const next = cloneBundle(bundle);
  next.intent = { ...next.intent, ...(intent || {}) };
  next.inputs.crawlers = { ...next.intent, robotsTxt: next.inputs.crawlers?.robotsTxt || '' };
  return next;
}

/** Set the site URL (so share-preview can resolve relative image paths). */
export function setSiteUrl(bundle, url) {
  const next = cloneBundle(bundle);
  next.siteUrl = typeof url === 'string' ? url : '';
  if (next.inputs.sharepreview && next.inputs.sharepreview.headHtml) {
    next.inputs.sharepreview = { ...next.inputs.sharepreview, pageUrl: next.siteUrl };
  }
  return next;
}

/** Does this bundle have enough to run the given module? */
export function hasInputFor(bundle, moduleId) {
  const input = bundle?.inputs?.[moduleId];
  if (!input || typeof input !== 'object') return false;
  switch (moduleId) {
    case 'accessibility':
      return !!String(input.html || '').trim();
    case 'sharepreview':
      return !!String(input.headHtml || '').trim();
    case 'legal':
      return !!(String(input.licenseText || '').trim() || String(input.packages || '').trim());
    case 'docs':
      return !!String(input.readme || '').trim();
    case 'crawlers':
      return (
        typeof input.robotsTxt === 'string' &&
        (input.robotsTxt.trim().length > 0 ||
          !!(input.blockTraining || input.blockAssistants || input.blockSearchAi))
      );
    default:
      return false;
  }
}

/** The sources we actually used, newest wins, for the "what we found" receipt. */
export function usedSources(bundle) {
  return (bundle?.sources || []).filter((s) => s.used);
}
