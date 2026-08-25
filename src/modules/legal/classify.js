// classify.js — pure license resolution + risk classification. No DOM.
//
// Two jobs:
//   1. resolveLicense(entry) — figure out the SPDX id(s) for a dependency, using
//      the license baked into a lockfile, or the bundled npm/PyPI caches.
//   2. classifyLicense(spdx) — map a license string (possibly an SPDX expression
//      like "MIT OR Apache-2.0" or "(GPL-2.0 WITH Classpath-exception)") to a
//      risk tier, choosing the WORST tier for AND and the BEST tier for OR.

import { LICENSES, TIERS, TIER_ORDER, TIER_DETAIL, isWatchlisted } from './licenses.js';
import { PYPI_LICENSES } from './pypi.js';
import { lookupNpmLicense } from './npm.js';

// Worse = higher risk. Lower rank number = better (safer).
const TIER_RANK = {
  'public-domain': 0,
  permissive: 1,
  'weak-copyleft': 2,
  proprietary: 3,
  'strong-copyleft': 4,
  'network-copyleft': 5,
  unknown: 6,
  unlicensed: 7,
};

/** Common non-SPDX aliases people actually write in the wild → canonical id. */
const ALIASES = {
  'apache 2.0': 'Apache-2.0',
  'apache2': 'Apache-2.0',
  'apache-2': 'Apache-2.0',
  'apachev2': 'Apache-2.0',
  'apache license 2.0': 'Apache-2.0',
  'the apache software license, version 2.0': 'Apache-2.0',
  'apache software license': 'Apache-2.0',
  'bsd': 'BSD-3-Clause',
  'bsd license': 'BSD-3-Clause',
  'new bsd license': 'BSD-3-Clause',
  'bsd-3': 'BSD-3-Clause',
  'bsd3': 'BSD-3-Clause',
  'bsd-2': 'BSD-2-Clause',
  'simplified bsd': 'BSD-2-Clause',
  'the mit license': 'MIT',
  'mit license': 'MIT',
  'expat': 'MIT',
  'x11': 'X11',
  'gpl': 'GPL-3.0-only',
  'gplv2': 'GPL-2.0-only',
  'gpl-2': 'GPL-2.0-only',
  'gpl2': 'GPL-2.0-only',
  'gplv3': 'GPL-3.0-only',
  'gpl-3': 'GPL-3.0-only',
  'gpl3': 'GPL-3.0-only',
  'lgpl': 'LGPL-3.0-only',
  'lgplv2.1': 'LGPL-2.1-only',
  'lgplv3': 'LGPL-3.0-only',
  'agpl': 'AGPL-3.0-only',
  'agplv3': 'AGPL-3.0-only',
  'agpl-3': 'AGPL-3.0-only',
  'mpl': 'MPL-2.0',
  'mpl 2.0': 'MPL-2.0',
  'mozilla public license 2.0': 'MPL-2.0',
  'isc license': 'ISC',
  'the unlicense': 'Unlicense',
  'public domain': 'Unlicense',
  'wtfpl': 'WTFPL',
  'zlib/libpng': 'Zlib',
  'psf': 'PSF-2.0',
  'python software foundation license': 'PSF-2.0',
  'cc0': 'CC0-1.0',
  'boost': 'BSL-1.0',
  'boost software license': 'BSL-1.0',
};

/** Values that explicitly mean "no license granted". */
const UNLICENSED_MARKERS = new Set(['unlicensed', 'private', 'nolicense', 'none', 'proprietary-internal']);

/** Normalize a raw license token to a canonical SPDX id if we can. */
export function canonicalizeId(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.trim();
  if (!s) return '';
  // Strip surrounding parens on a bare token and SPDX +/only/or-later noise handled elsewhere.
  const lower = s.toLowerCase();
  if (LICENSES[s]) return s;
  // Case-insensitive exact match against known ids.
  for (const id of Object.keys(LICENSES)) {
    if (id.toLowerCase() === lower) return id;
  }
  if (ALIASES[lower]) return ALIASES[lower];
  // "GPL-3.0" (deprecated form) → "GPL-3.0-only"
  const deprecated = tryDeprecatedGpl(s);
  if (deprecated) return deprecated;
  return s; // return as-is; classify() will bucket unknowns
}

function tryDeprecatedGpl(s) {
  const m = /^((?:A|L)?GPL)-([0-9.]+)$/i.exec(s.trim());
  if (!m) return '';
  const family = m[1].toUpperCase();
  const ver = m[2];
  const candidate = `${family}-${ver}-only`;
  return LICENSES[candidate] ? candidate : '';
}

/** Split an SPDX expression into ops and operand tokens. Very small parser. */
export function tokenizeExpression(expr) {
  // Normalize the "+" suffix (GPL-2.0+) into "-or-later" semantics but keep token.
  return String(expr)
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Classify a single license STRING (may be an SPDX expression) into a tier.
 * @returns {{ tier: string, ids: string[], expression: string, choice: 'single'|'and'|'or' }}
 */
export function classifyLicense(raw) {
  const input = (raw || '').trim();
  if (!input) {
    return { tier: 'unlicensed', ids: [], expression: '', choice: 'single' };
  }
  if (UNLICENSED_MARKERS.has(input.toLowerCase())) {
    return { tier: 'unlicensed', ids: [input], expression: input, choice: 'single' };
  }

  const tokens = tokenizeExpression(input);
  const hasOr = tokens.some((t) => t.toUpperCase() === 'OR');
  const hasAnd = tokens.some((t) => t.toUpperCase() === 'AND');

  // Collect operand tiers (ignore WITH exception operands after the license).
  const operandTiers = [];
  const ids = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const up = t.toUpperCase();
    if (up === 'OR' || up === 'AND') continue;
    if (up === 'WITH') {
      i++; // skip the exception name that follows
      continue;
    }
    let token = t;
    let orLater = false;
    if (token.endsWith('+')) {
      orLater = true;
      token = token.slice(0, -1);
    }
    const id = canonicalizeId(token);
    ids.push(id);
    let tier = tierOf(id);
    // "GPL-2.0+" that we couldn't map: still treat as strong-copyleft if it looks like GPL.
    if (tier === 'unknown' && orLater) {
      const guess = guessFamily(token);
      if (guess) tier = guess;
    }
    if (tier === 'unknown') {
      const guess = guessFamily(token);
      if (guess) tier = guess;
    }
    operandTiers.push(tier);
  }

  if (operandTiers.length === 0) {
    return { tier: 'unknown', ids, expression: input, choice: 'single' };
  }
  if (operandTiers.length === 1) {
    return { tier: operandTiers[0], ids, expression: input, choice: 'single' };
  }

  // OR = licensee may choose → pick the SAFEST (lowest rank).
  // AND = must satisfy all → pick the RISKIEST (highest rank).
  if (hasOr && !hasAnd) {
    const best = operandTiers.reduce((a, b) => (TIER_RANK[a] <= TIER_RANK[b] ? a : b));
    return { tier: best, ids, expression: input, choice: 'or' };
  }
  const worst = operandTiers.reduce((a, b) => (TIER_RANK[a] >= TIER_RANK[b] ? a : b));
  return { tier: worst, ids, expression: input, choice: hasAnd ? 'and' : 'single' };
}

/** Tier for a canonical id, or 'unknown'. */
export function tierOf(id) {
  const entry = LICENSES[id];
  return entry ? entry.tier : 'unknown';
}

/** Heuristic family guess for unrecognized strings that clearly name a family. */
function guessFamily(token) {
  const t = token.toLowerCase();
  if (t.includes('agpl')) return 'network-copyleft';
  if (t.includes('lgpl')) return 'weak-copyleft';
  if (t.includes('gpl')) return 'strong-copyleft';
  if (t.includes('mpl') || t.includes('mozilla')) return 'weak-copyleft';
  if (t.includes('epl') || t.includes('eclipse')) return 'weak-copyleft';
  if (t.includes('apache')) return 'permissive';
  if (t.includes('mit')) return 'permissive';
  if (t.includes('bsd')) return 'permissive';
  if (t.includes('isc')) return 'permissive';
  if (t.includes('busl') || t.includes('sspl') || t.includes('elastic') || t.includes('commons clause')) {
    return 'proprietary';
  }
  return null;
}

/**
 * Resolve the license for a dependency entry into a classified result.
 * Precedence: explicit declaredLicense (from lockfile) > bundled cache lookup.
 * @returns entry augmented with { license, resolvedFrom, classification }
 */
export function resolveLicense(entry) {
  let licenseStr = '';
  let resolvedFrom = 'none';

  if (entry.declaredLicense) {
    licenseStr = entry.declaredLicense;
    resolvedFrom = 'declared';
  } else if (entry.ecosystem === 'pip') {
    const hit = PYPI_LICENSES[entry.name.toLowerCase()];
    if (hit) {
      licenseStr = hit;
      resolvedFrom = 'pypi-cache';
    }
  } else if (entry.ecosystem === 'npm') {
    const hit = lookupNpmLicense(entry.name);
    if (hit) {
      licenseStr = hit;
      resolvedFrom = 'npm-cache';
    }
  }

  const classification = classifyLicense(licenseStr);
  const finalResolvedFrom = licenseStr ? resolvedFrom : 'unresolved';
  // A cached hit for a known-volatile package: nudge the user to verify live.
  const staleRisk =
    isWatchlisted(entry.name) &&
    (finalResolvedFrom === 'npm-cache' || finalResolvedFrom === 'pypi-cache');
  return {
    ...entry,
    license: classification.expression || licenseStr,
    resolvedFrom: finalResolvedFrom,
    tier: classification.tier,
    tierMeta: TIERS[classification.tier],
    detail: TIER_DETAIL[classification.tier] || null,
    staleRisk,
    classification,
  };
}

// ── Policy engine (FOSSA/Snyk-style allow / flag / deny) ─────────────────────
// A policy is { allow:Set<tier|id>, deny:Set<tier|id> }. deny wins over allow.
// Matching is by risk TIER or by exact/canonical license id (case-insensitive).

/** Build a normalized policy object from loose input (arrays or sets of strings). */
export function makePolicy({ allow = [], deny = [] } = {}) {
  const norm = (list) => {
    const s = new Set();
    for (const raw of list) {
      if (!raw || typeof raw !== 'string') continue;
      const t = raw.trim();
      if (!t) continue;
      s.add(t.toLowerCase());
    }
    return s;
  };
  return { allow: norm(allow), deny: norm(deny) };
}

/** Does a policy set match this result (by tier or by any of its license ids)? */
function policyHit(set, result) {
  if (!set || set.size === 0) return false;
  if (set.has(result.tier)) return true;
  const ids = result.classification?.ids || [];
  for (const id of ids) {
    if (id && set.has(String(id).toLowerCase())) return true;
  }
  if (result.license && set.has(String(result.license).toLowerCase())) return true;
  return false;
}

/**
 * Apply a policy to a classified result. Returns the result augmented with a
 * `policy` field: 'denied' | 'allowed' | 'default'. Deny takes precedence.
 * Does not mutate the input.
 */
export function applyPolicy(result, policy) {
  if (!policy) return { ...result, policy: 'default' };
  if (policyHit(policy.deny, result)) return { ...result, policy: 'denied' };
  if (policyHit(policy.allow, result)) return { ...result, policy: 'allowed' };
  return { ...result, policy: 'default' };
}

/**
 * Resolve + classify a whole list of entries. If a policy is supplied, each
 * result is also annotated with its policy decision (allowed/denied/default).
 */
export function classifyAll(entries, policy) {
  const out = entries.map(resolveLicense);
  return policy ? out.map((r) => applyPolicy(r, policy)) : out;
}

/**
 * Summarize classified results into per-tier counts and an overall risk verdict.
 * When results carry policy decisions, the verdict honors them: an explicitly
 * DENIED license forces 'blocked'; an explicitly ALLOWED license is not counted
 * as a blocker or caution (e.g. "we self-host, AGPL is fine").
 */
export function summarize(results) {
  const counts = {};
  for (const key of Object.keys(TIERS)) counts[key] = 0;
  for (const r of results) counts[r.tier] = (counts[r.tier] || 0) + 1;

  const hasPolicy = results.some((r) => r.policy && r.policy !== 'default');
  let denied = 0;
  let allowed = 0;

  const isDefaultBlocking = (t) =>
    t === 'strong-copyleft' || t === 'network-copyleft' || t === 'proprietary';
  const isDefaultCaution = (t) => t === 'weak-copyleft' || t === 'unknown' || t === 'unlicensed';

  let hasBlocking = false;
  let hasCaution = false;
  for (const r of results) {
    if (r.policy === 'denied') {
      denied++;
      hasBlocking = true;
      continue;
    }
    if (r.policy === 'allowed') {
      allowed++;
      continue; // explicitly cleared by policy
    }
    if (isDefaultBlocking(r.tier)) hasBlocking = true;
    else if (isDefaultCaution(r.tier)) hasCaution = true;
  }

  let verdict;
  if (hasBlocking) verdict = 'blocked';
  else if (hasCaution) verdict = 'caution';
  else verdict = 'clear';

  const summary = { counts, verdict, total: results.length };
  if (hasPolicy) summary.policy = { denied, allowed };
  return summary;
}

/** Sort results riskiest-first for display. */
export function sortByRisk(results) {
  const rank = (t) => TIER_ORDER.indexOf(t);
  return [...results].sort((a, b) => {
    const d = rank(a.tier) - rank(b.tier);
    if (d !== 0) return d;
    return a.name.localeCompare(b.name);
  });
}
