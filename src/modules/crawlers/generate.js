// modules/crawlers/generate.js — pure robots.txt generator + parser, adapted
// from the CrawlerBlock source tool (src/generate.js). No DOM. Never throws.
//
// Two jobs:
//   1. parseBlockedCrawlers(text) — read an EXISTING robots.txt and report which
//      of our known AI crawlers it already blocks (Disallow: /).
//   2. generateRobotsTxt(ids)     — produce a clean, paste-ready robots.txt that
//      blocks a chosen set of crawlers.
//
// SECURITY: the User-agent tokens come from the curated list (not user input),
// and the copy-paste path is sanitised so a crafted value can never inject a new
// robots.txt line. Output is plain text rendered via textContent in the shell.

import { CRAWLERS, CATEGORIES, crawlerById, LIST_LAST_UPDATED } from './data.js';

/**
 * Normalise a raw selection into a clean, de-duplicated, spec-ordered list of
 * crawler ids. Unknown ids are dropped so output is always deterministic.
 */
export function normalizeSelection(ids) {
  const wanted = new Set(Array.isArray(ids) ? ids : []);
  return CRAWLERS.filter((c) => wanted.has(c.id)).map((c) => c.id);
}

/**
 * Sanitise a User-agent token before it lands in a generated file. Real curated
 * tokens are clean; this is defence-in-depth. Strips control chars (so it can
 * never start a new line) and returns '' for junk.
 */
export function sanitizeToken(raw) {
  if (typeof raw !== 'string') return '';
  let out = '';
  for (const ch of raw) {
    const code = ch.codePointAt(0);
    if (code < 0x20 || code === 0x7f) continue;
    out += ch;
  }
  return out.trim();
}

/**
 * Build a clean robots.txt that blocks the selected crawlers, one readable block
 * per bot. Deterministic (spec order). Returns plain text.
 *
 * @param {string[]} ids selected crawler ids
 * @returns {string}
 */
export function generateRobotsTxt(ids) {
  const selected = normalizeSelection(ids);
  const lines = [
    '# robots.txt — AI crawler rules',
    '# Made with VibeCheck. robots.txt is an honor system: well-behaved bots obey it.',
    `# Crawler list reviewed against operator docs: ${LIST_LAST_UPDATED}`,
    '',
  ];

  if (selected.length === 0) {
    lines.push('# No AI crawlers selected — nothing is blocked.');
    return lines.join('\n');
  }

  for (const id of selected) {
    const c = crawlerById(id);
    const ua = sanitizeToken(c.ua);
    if (!ua) continue;
    lines.push(`# ${c.name} — ${c.company}`);
    lines.push(`User-agent: ${ua}`);
    lines.push('Disallow: /');
    lines.push('');
  }

  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}

/**
 * The two-line robots.txt block for a single crawler.
 */
export function robotsLineFor(id) {
  const c = crawlerById(id);
  if (!c) return '';
  const ua = sanitizeToken(c.ua);
  if (!ua) return '';
  return `User-agent: ${ua}\nDisallow: /`;
}

/**
 * Parse an EXISTING robots.txt and return the ids of our known AI crawlers that
 * it already blocks (has a User-agent group for AND a `Disallow: /`). Also
 * reports whether a wildcard `User-agent: *` group blocks the whole site.
 * Case-insensitive on the UA token. Never throws.
 *
 * @param {string} robotsText
 * @returns {{ blocked: string[], wildcardBlocksAll: boolean, hasContent: boolean }}
 */
export function parseRobots(robotsText) {
  if (!robotsText || typeof robotsText !== 'string') {
    return { blocked: [], wildcardBlocksAll: false, hasContent: false };
  }
  const lines = robotsText.split(/\r?\n/);
  const uaToId = new Map(CRAWLERS.map((c) => [c.ua.toLowerCase(), c.id]));

  const blocked = new Set();
  let wildcardBlocksAll = false;
  let hasContent = false;

  let currentAgents = [];
  let expectingAgents = true;
  let groupBlocks = false;

  const flush = () => {
    if (groupBlocks) {
      for (const ua of currentAgents) {
        if (ua === '*') wildcardBlocksAll = true;
        const id = uaToId.get(ua);
        if (id) blocked.add(id);
      }
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    hasContent = true;
    const field = m[1].toLowerCase();
    const value = m[2].trim();

    if (field === 'user-agent') {
      if (!expectingAgents) {
        flush();
        currentAgents = [];
        groupBlocks = false;
        expectingAgents = true;
      }
      currentAgents.push(value.toLowerCase());
    } else {
      expectingAgents = false;
      // Disallow: /  → full block. Disallow: <empty> means "allow all".
      if (field === 'disallow' && value === '/') groupBlocks = true;
    }
  }
  flush();

  return {
    blocked: CRAWLERS.filter((c) => blocked.has(c.id)).map((c) => c.id),
    wildcardBlocksAll,
    hasContent,
  };
}
