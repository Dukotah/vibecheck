// ingest/detect.js — work out what a blob of text actually IS.
//
// The whole point of VibeCheck v2 is that you never have to answer the question
// "which check does this belong to?". You hand over a file (or paste something,
// or drop a whole folder) and we figure it out. This module is that guess.
//
// Pure: no DOM, no network, never throws. Filename evidence beats content
// evidence, because a file literally named LICENSE is not ambiguous.

/** The kinds of input VibeCheck knows how to use. */
export const KINDS = ['html', 'readme', 'packages', 'license', 'robots'];

/** Human labels, used in the "here's what we found" receipt. */
export const KIND_LABEL = {
  html: 'your page',
  readme: 'your README',
  packages: 'your dependency list',
  license: 'your license',
  robots: 'your robots.txt',
  unknown: 'something we could not place',
};

const BASENAME_RULES = [
  [/^licen[cs]e(-[\w.]+)?(\.(txt|md|rst))?$/i, 'license'],
  [/^copying(\.(txt|md))?$/i, 'license'],
  [/^readme(\.(md|markdown|txt|rst))?$/i, 'readme'],
  [/^package\.json$/i, 'packages'],
  [/^requirements[\w.-]*\.txt$/i, 'packages'],
  [/^pyproject\.toml$/i, 'packages'],
  [/^pipfile$/i, 'packages'],
  [/^robots\.txt$/i, 'robots'],
  [/\.(html?|xhtml)$/i, 'html'],
  [/\.(md|markdown)$/i, 'readme'],
];

/** Strip any directory path and return the lowercase file name. */
export function basename(name) {
  const s = String(name || '').trim();
  if (!s) return '';
  const parts = s.split(/[\\/]/);
  return (parts[parts.length - 1] || '').toLowerCase();
}

/** Guess purely from a file name. Returns a kind or null. */
export function detectByName(name) {
  const base = basename(name);
  if (!base) return null;
  for (const [re, kind] of BASENAME_RULES) {
    if (re.test(base)) return kind;
  }
  return null;
}

function looksLikeHtml(t) {
  if (/^\s*<!doctype\s+html/i.test(t)) return true;
  if (/<html[\s>]/i.test(t)) return true;
  if (/<head[\s>]/i.test(t)) return true;
  if (/<body[\s>]/i.test(t)) return true;
  // A pasted <head> fragment: several meta/title/link tags and no markdown feel.
  const tagHits = (t.match(/<(meta|title|link|script|div|section|main|nav)[\s>]/gi) || []).length;
  return tagHits >= 3;
}

function looksLikeRobots(t) {
  return /^\s*user-?agent\s*:/im.test(t) && /^\s*(dis)?allow\s*:/im.test(t);
}

function looksLikePackages(t) {
  const trimmed = t.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        if (parsed.dependencies || parsed.devDependencies || parsed.peerDependencies) return true;
        if (typeof parsed.name === 'string' && typeof parsed.version === 'string') return true;
      }
    } catch {
      // Not JSON, or truncated JSON — fall through to the line heuristics.
    }
    // A truncated / commented package.json still reads like one.
    if (/"(dependencies|devDependencies)"\s*:/.test(trimmed)) return true;
  }
  // requirements.txt: several lines shaped like `name==1.2.3` or `name>=1.0`.
  const reqLines = (trimmed.match(/^[A-Za-z][\w.-]*\s*(==|>=|<=|~=|!=|>|<)\s*[\w.*+-]+\s*$/gm) || [])
    .length;
  if (reqLines >= 2) return true;
  // pyproject.toml dependency table.
  if (/^\s*\[(tool\.poetry\.)?dependencies\]/im.test(trimmed)) return true;
  return false;
}

function looksLikeLicense(t) {
  const head = t.slice(0, 3000);
  return (
    /\bMIT License\b/i.test(head) ||
    /\bApache License\b/i.test(head) ||
    /\bGNU (GENERAL|LESSER GENERAL|AFFERO GENERAL) PUBLIC LICENSE\b/i.test(head) ||
    /\bBSD \d-Clause\b/i.test(head) ||
    /\bMozilla Public License\b/i.test(head) ||
    /Permission is hereby granted, free of charge/i.test(head) ||
    /Redistribution and use in source and binary forms/i.test(head) ||
    /\bThe Unlicense\b/i.test(head) ||
    /This is free and unencumbered software released into the public domain/i.test(head)
  );
}

function looksLikeReadme(t) {
  const trimmed = t.trim();
  if (/^#{1,3}\s+\S/m.test(trimmed)) return true; // a markdown heading
  if (/^\S.*\n[=-]{3,}\s*$/m.test(trimmed)) return true; // setext heading
  if (/```/.test(trimmed) && /^\s*[-*]\s+/m.test(trimmed)) return true;
  return false;
}

/**
 * Classify a blob of text, optionally helped by its file name.
 *
 * @param {string} text
 * @param {string} [name] original file name, if there was one
 * @returns {{ kind: string, confidence: 'name'|'content'|'none' }}
 */
export function detect(text, name) {
  const t = typeof text === 'string' ? text : '';

  const byName = detectByName(name);
  if (byName) {
    // One override: a file called README.md that is plainly an HTML page is
    // HTML. Names are strong evidence, not a contract.
    if (byName === 'readme' && looksLikeHtml(t)) return { kind: 'html', confidence: 'content' };
    return { kind: byName, confidence: 'name' };
  }

  if (!t.trim()) return { kind: 'unknown', confidence: 'none' };

  // Order matters: the most structurally distinctive formats go first.
  if (looksLikeHtml(t)) return { kind: 'html', confidence: 'content' };
  if (looksLikeRobots(t)) return { kind: 'robots', confidence: 'content' };
  if (looksLikePackages(t)) return { kind: 'packages', confidence: 'content' };
  if (looksLikeLicense(t)) return { kind: 'license', confidence: 'content' };
  if (looksLikeReadme(t)) return { kind: 'readme', confidence: 'content' };

  return { kind: 'unknown', confidence: 'none' };
}

/** Files we never want to read, even if the user drags a whole project folder. */
const IGNORED_DIRS = /(^|[\\/])(node_modules|\.git|\.next|dist|build|out|vendor|__pycache__|\.venv|venv|coverage|\.vercel|\.cache)([\\/]|$)/i;

/**
 * Should we bother reading this file from a folder drop?
 * Keeps the drop handler from chewing through 40,000 node_modules files.
 * @param {{ name?: string, path?: string, size?: number }} file
 */
export function isWorthReading(file) {
  const f = file || {};
  const path = String(f.path || f.name || '');
  if (!path) return false;
  if (IGNORED_DIRS.test(path)) return false;
  if (typeof f.size === 'number' && f.size > 2_000_000) return false;
  if (detectByName(path)) return true;
  // Unknown extensions are only worth a look if they have no extension at all
  // (LICENSE, Pipfile) — otherwise skip the .png/.woff/.tsx noise.
  const base = basename(path);
  return !base.includes('.');
}
