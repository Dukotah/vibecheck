// share/codec.js — turn a finished report into a link, and a link back into a
// report.
//
// The shared link is deliberately a SCORE CARD, not a full audit. It carries
// the overall score, the per-check verdicts, and the site it was run against —
// and nothing else. Not the page HTML, not the dependency list, not the license
// text, not the findings, not even the names of what is broken. You can post
// your score without publishing your problems.
//
// Encoding is JSON -> UTF-8 -> base64url, put in the `?r=` query string (a
// query, not a hash, so the server can render a preview card for it). Small
// enough for LinkedIn, no server storage, no database, no accounts.
//
// Pure: no DOM, no network, never throws.

export const SHARE_VERSION = 2;
export const SHARE_PARAM = 'r';

/** Compact status codes, so the payload stays short. */
const STATUS_CODE = { incomplete: 0, pass: 1, warn: 2, fail: 3 };
const CODE_STATUS = ['incomplete', 'pass', 'warn', 'fail'];

const MAX_URL_CHARS = 200;

function clip(text, max) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** base64url encode a UTF-8 string, in both browser and Node. */
export function toBase64Url(text) {
  const bytes = new TextEncoder().encode(String(text));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 =
    typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url decode back to a UTF-8 string. Returns '' on anything malformed. */
export function fromBase64Url(encoded) {
  try {
    const s = String(encoded || '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = s.length % 4 === 0 ? s : s + '='.repeat(4 - (s.length % 4));
    if (typeof atob === 'function') {
      const binary = atob(pad);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    }
    return Buffer.from(pad, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

/**
 * Build the shareable payload from an aggregate() result.
 *
 * @param {object} overall the object returned by score.js aggregate()
 * @param {{ siteUrl?: string, at?: number }} [meta]
 * @returns {object} plain JSON-safe payload
 */
export function buildPayload(overall, meta) {
  const o = overall && typeof overall === 'object' ? overall : {};
  const m = meta && typeof meta === 'object' ? meta : {};
  const breakdown = Array.isArray(o.breakdown) ? o.breakdown : [];

  return {
    v: SHARE_VERSION,
    s: Math.max(0, Math.min(100, Math.round(Number(o.score) || 0))),
    u: clip(m.siteUrl || '', MAX_URL_CHARS),
    // Minutes since epoch keeps the payload short; we only ever show a date.
    t: Math.floor((Number(m.at) || Date.now()) / 60000),
    c: breakdown.map((b) => [
      String(b.id || ''),
      STATUS_CODE[b.status] ?? 0,
      Math.max(0, Math.min(100, Math.round(Number(b.score) || 0))),
    ]),
  };
}

/**
 * Encode an aggregate() result into the `r=` value for a share link.
 * @returns {string} base64url token ('' if nothing to share)
 */
export function encodeReport(overall, meta) {
  const payload = buildPayload(overall, meta);
  if (!payload.c.length) return '';
  return toBase64Url(JSON.stringify(payload));
}

/**
 * Decode a share token back into a payload. Returns null if it is missing,
 * malformed, from a future version, or otherwise not something we trust.
 * Every field is re-validated: a share link is untrusted input.
 *
 * @param {string} token
 * @returns {null | { version:number, score:number, siteUrl:string, at:number,
 *                    checks:Array<{id:string,status:string,score:number}> }}
 */
export function decodeReport(token) {
  const json = fromBase64Url(token);
  if (!json) return null;
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const version = Number(raw.v);
  if (!Number.isFinite(version) || version < 1 || version > SHARE_VERSION) return null;

  const score = Math.max(0, Math.min(100, Math.round(Number(raw.s) || 0)));
  const checks = (Array.isArray(raw.c) ? raw.c : [])
    .filter((row) => Array.isArray(row) && row.length >= 2)
    .slice(0, 12)
    .map((row) => ({
      id: clip(row[0], 40),
      status: CODE_STATUS[Number(row[1])] || 'incomplete',
      score: Math.max(0, Math.min(100, Math.round(Number(row[2]) || 0))),
    }))
    .filter((c) => c.id);

  if (!checks.length) return null;

  let siteUrl = clip(raw.u, MAX_URL_CHARS);
  // Only ever surface an http(s) address; never a javascript: or data: URL.
  if (siteUrl && !/^https?:\/\//i.test(siteUrl)) siteUrl = '';

  const at = Number(raw.t);
  return {
    version,
    score,
    siteUrl,
    at: Number.isFinite(at) && at > 0 ? at * 60000 : 0,
    checks,
  };
}

/**
 * Reduce anything URL-ish down to a bare scheme://host origin, with no path,
 * query or fragment. Falls back to a light string trim if it will not parse.
 * @param {string} origin
 * @returns {string}
 */
export function normalizeOrigin(origin) {
  const raw = String(origin || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/[?#].*$/, '').replace(/\/+$/, '');
  }
}

/**
 * Full share URL for a report.
 * @param {string} origin e.g. 'https://vibecheck.copperbaytech.com'
 * @param {string} token
 */
export function shareUrl(origin, token) {
  const base = normalizeOrigin(origin);
  if (!token) return base;
  return `${base}/?${SHARE_PARAM}=${token}`;
}

/**
 * The markdown badge a user can paste into their own README.
 * @param {string} origin
 * @param {number} score
 * @param {string} [link] where the badge should point (defaults to the origin)
 */
export function badgeMarkdown(origin, score, link) {
  const base = normalizeOrigin(origin);
  const n = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const target = link || base;
  return `[![Launch Readiness: ${n}/100](${base}/api/badge?score=${n})](${target})`;
}
