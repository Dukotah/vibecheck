// licenses.js — SPDX license database, seeded from the SPDX License List
// (https://spdx.org/licenses/). Each entry is keyed by its canonical SPDX
// identifier and carries a risk tier plus a plain-English commercial-use note.
//
// Tiers:
//   'permissive'      🟢 safe for closed-source commercial use, attribution only
//   'weak-copyleft'   🟡 usable commercially with conditions (share changes to the lib)
//   'strong-copyleft' 🔴 may force you to open-source your own code
//   'public-domain'   🟢 no restrictions at all
//   'network-copyleft'🔴 AGPL family — triggers even for network/SaaS use
//   'proprietary'     🔴 source-available / non-free, restrictions apply
//   'unknown'         ⚪ could not classify (treat with caution)
//
// This is intentionally a curated subset of the ~600 SPDX ids covering the
// licenses that actually show up in real npm / PyPI dependency trees, plus the
// long tail of copyleft ids you must never miss.

export const LICENSES = {
  // ── Public domain / equivalent ────────────────────────────────────────────
  '0BSD': { name: 'BSD Zero Clause License', tier: 'public-domain' },
  Unlicense: { name: 'The Unlicense', tier: 'public-domain' },
  'CC0-1.0': { name: 'Creative Commons Zero v1.0 Universal', tier: 'public-domain' },
  WTFPL: { name: 'Do What The F*ck You Want To Public License', tier: 'public-domain' },
  'blessing': { name: 'SQLite Blessing', tier: 'public-domain' },
  'MIT-0': { name: 'MIT No Attribution', tier: 'public-domain' },

  // ── Permissive ─────────────────────────────────────────────────────────────
  MIT: { name: 'MIT License', tier: 'permissive' },
  'Apache-2.0': { name: 'Apache License 2.0', tier: 'permissive' },
  'Apache-1.1': { name: 'Apache License 1.1', tier: 'permissive' },
  ISC: { name: 'ISC License', tier: 'permissive' },
  'BSD-2-Clause': { name: 'BSD 2-Clause "Simplified" License', tier: 'permissive' },
  'BSD-3-Clause': { name: 'BSD 3-Clause "New" or "Revised" License', tier: 'permissive' },
  'BSD-3-Clause-Clear': { name: 'BSD 3-Clause Clear License', tier: 'permissive' },
  'BSD-4-Clause': { name: 'BSD 4-Clause "Original" License', tier: 'permissive' },
  Zlib: { name: 'zlib License', tier: 'permissive' },
  'libpng-2.0': { name: 'PNG Reference Library version 2', tier: 'permissive' },
  BSL: { name: 'Boost Software License 1.0', tier: 'permissive' },
  'BSL-1.0': { name: 'Boost Software License 1.0', tier: 'permissive' },
  'PostgreSQL': { name: 'PostgreSQL License', tier: 'permissive' },
  'Python-2.0': { name: 'Python License 2.0', tier: 'permissive' },
  'PSF-2.0': { name: 'Python Software Foundation License 2.0', tier: 'permissive' },
  'X11': { name: 'X11 License', tier: 'permissive' },
  'NCSA': { name: 'University of Illinois/NCSA Open Source License', tier: 'permissive' },
  'Unicode-DFS-2016': { name: 'Unicode License Agreement - Data Files and Software (2016)', tier: 'permissive' },
  'Artistic-2.0': { name: 'Artistic License 2.0', tier: 'permissive' },
  'AFL-3.0': { name: 'Academic Free License v3.0', tier: 'permissive' },
  'HPND': { name: 'Historical Permission Notice and Disclaimer', tier: 'permissive' },
  'W3C': { name: 'W3C Software Notice and License', tier: 'permissive' },
  'MulanPSL-2.0': { name: 'Mulan Permissive Software License, Version 2', tier: 'permissive' },
  'Fair': { name: 'Fair License', tier: 'permissive' },
  'Beerware': { name: 'Beerware License', tier: 'permissive' },
  'CC-BY-4.0': { name: 'Creative Commons Attribution 4.0', tier: 'permissive' },
  'CC-BY-3.0': { name: 'Creative Commons Attribution 3.0', tier: 'permissive' },
  'OFL-1.1': { name: 'SIL Open Font License 1.1', tier: 'permissive' },

  // ── Weak copyleft (file/library-level) ─────────────────────────────────────
  'LGPL-2.0-only': { name: 'GNU Library General Public License v2 only', tier: 'weak-copyleft' },
  'LGPL-2.0-or-later': { name: 'GNU Library General Public License v2 or later', tier: 'weak-copyleft' },
  'LGPL-2.1-only': { name: 'GNU Lesser General Public License v2.1 only', tier: 'weak-copyleft' },
  'LGPL-2.1-or-later': { name: 'GNU Lesser General Public License v2.1 or later', tier: 'weak-copyleft' },
  'LGPL-3.0-only': { name: 'GNU Lesser General Public License v3.0 only', tier: 'weak-copyleft' },
  'LGPL-3.0-or-later': { name: 'GNU Lesser General Public License v3.0 or later', tier: 'weak-copyleft' },
  'MPL-1.1': { name: 'Mozilla Public License 1.1', tier: 'weak-copyleft' },
  'MPL-2.0': { name: 'Mozilla Public License 2.0', tier: 'weak-copyleft' },
  'EPL-1.0': { name: 'Eclipse Public License 1.0', tier: 'weak-copyleft' },
  'EPL-2.0': { name: 'Eclipse Public License 2.0', tier: 'weak-copyleft' },
  'CDDL-1.0': { name: 'Common Development and Distribution License 1.0', tier: 'weak-copyleft' },
  'CDDL-1.1': { name: 'Common Development and Distribution License 1.1', tier: 'weak-copyleft' },
  'CECILL-C': { name: 'CeCILL-C Free Software License Agreement', tier: 'weak-copyleft' },
  'CPL-1.0': { name: 'Common Public License 1.0', tier: 'weak-copyleft' },
  'Ms-PL': { name: 'Microsoft Public License', tier: 'weak-copyleft' },
  'APSL-2.0': { name: 'Apple Public Source License 2.0', tier: 'weak-copyleft' },
  'OSL-3.0': { name: 'Open Software License 3.0', tier: 'weak-copyleft' },
  'Artistic-1.0': { name: 'Artistic License 1.0', tier: 'weak-copyleft' },

  // ── Strong copyleft (whole-program) ────────────────────────────────────────
  'GPL-1.0-only': { name: 'GNU General Public License v1.0 only', tier: 'strong-copyleft' },
  'GPL-1.0-or-later': { name: 'GNU General Public License v1.0 or later', tier: 'strong-copyleft' },
  'GPL-2.0-only': { name: 'GNU General Public License v2.0 only', tier: 'strong-copyleft' },
  'GPL-2.0-or-later': { name: 'GNU General Public License v2.0 or later', tier: 'strong-copyleft' },
  'GPL-3.0-only': { name: 'GNU General Public License v3.0 only', tier: 'strong-copyleft' },
  'GPL-3.0-or-later': { name: 'GNU General Public License v3.0 or later', tier: 'strong-copyleft' },
  'CECILL-2.1': { name: 'CeCILL Free Software License Agreement v2.1', tier: 'strong-copyleft' },
  'EUPL-1.1': { name: 'European Union Public License 1.1', tier: 'strong-copyleft' },
  'EUPL-1.2': { name: 'European Union Public License 1.2', tier: 'strong-copyleft' },
  'CC-BY-SA-4.0': { name: 'Creative Commons Attribution Share Alike 4.0', tier: 'strong-copyleft' },
  'MS-RL': { name: 'Microsoft Reciprocal License', tier: 'strong-copyleft' },
  'Ms-RL': { name: 'Microsoft Reciprocal License', tier: 'strong-copyleft' },

  // ── Network copyleft (AGPL family — triggers on SaaS/network use) ──────────
  'AGPL-1.0-only': { name: 'Affero General Public License v1.0 only', tier: 'network-copyleft' },
  'AGPL-1.0-or-later': { name: 'Affero General Public License v1.0 or later', tier: 'network-copyleft' },
  'AGPL-3.0-only': { name: 'GNU Affero General Public License v3.0 only', tier: 'network-copyleft' },
  'AGPL-3.0-or-later': { name: 'GNU Affero General Public License v3.0 or later', tier: 'network-copyleft' },

  // ── Proprietary / source-available / non-free ──────────────────────────────
  'BUSL-1.1': { name: 'Business Source License 1.1', tier: 'proprietary' },
  'SSPL-1.0': { name: 'Server Side Public License v1', tier: 'proprietary' },
  'Elastic-2.0': { name: 'Elastic License 2.0', tier: 'proprietary' },
  'Commons-Clause': { name: 'Commons Clause License Condition v1.0', tier: 'proprietary' },
  'CC-BY-NC-4.0': { name: 'Creative Commons Attribution Non Commercial 4.0', tier: 'proprietary' },
  'CC-BY-NC-SA-4.0': { name: 'Creative Commons Attribution Non Commercial Share Alike 4.0', tier: 'proprietary' },
  'CC-BY-ND-4.0': { name: 'Creative Commons Attribution No Derivatives 4.0', tier: 'proprietary' },
  'Aladdin': { name: 'Aladdin Free Public License', tier: 'proprietary' },
  'JSON': { name: 'JSON License ("shall be used for Good, not Evil")', tier: 'proprietary' },
  'Facebook-2-Clause': { name: 'Facebook Patent License (legacy)', tier: 'proprietary' },
};

// Human-readable metadata per tier: label, emoji, css class, and a plain-English
// explanation of what "commercial use" means for that category.
export const TIERS = {
  'public-domain': {
    label: 'Public domain',
    emoji: '🟢',
    order: 0,
    css: 'ok',
    short: 'No restrictions.',
    explain:
      'Effectively no restrictions. You can use, modify, ship, and sell the code with no obligations — not even attribution in most cases. Safe for any commercial product.',
  },
  permissive: {
    label: 'Permissive',
    emoji: '🟢',
    order: 1,
    css: 'ok',
    short: 'Safe for commercial use.',
    explain:
      'Safe for closed-source commercial use. You can build and sell proprietary software on top of it. The only common condition is that you keep the original copyright and license notice somewhere in your distribution (e.g. a NOTICE or licenses file). You never have to publish your own source.',
  },
  'weak-copyleft': {
    label: 'Weak copyleft',
    emoji: '🟡',
    order: 2,
    css: 'warn',
    short: 'Commercial use OK, with conditions.',
    explain:
      'Usable in commercial and closed-source products, but with conditions. If you MODIFY the licensed library itself, you generally must publish those modifications under the same license. Your own separate application code can stay proprietary as long as you dynamically link and do not modify the library. Read the specific terms (LGPL vs MPL vs EPL differ) before shipping modified versions.',
  },
  'strong-copyleft': {
    label: 'Strong copyleft',
    emoji: '🔴',
    order: 3,
    css: 'bad',
    short: 'May require open-sourcing your code.',
    explain:
      'High risk for proprietary products. If you distribute software that includes or links this code, the license can require you to release YOUR ENTIRE codebase under the same copyleft license — forcing your source code open. Fine for internal-only tools you never distribute, but review carefully (ideally with a lawyer) before shipping a commercial product that includes it.',
  },
  'network-copyleft': {
    label: 'Network copyleft (AGPL)',
    emoji: '🔴',
    order: 4,
    css: 'bad',
    short: 'Triggers even for SaaS / hosted use.',
    explain:
      'The strongest risk for SaaS. Unlike GPL, the AGPL copyleft obligation triggers even when you only offer the software over a network (a hosted web app or API) without distributing binaries. If your users interact with it remotely, you may have to offer them your complete source code. Avoid in a closed-source SaaS unless you have legal sign-off.',
  },
  proprietary: {
    label: 'Proprietary / source-available',
    emoji: '🔴',
    order: 5,
    css: 'bad',
    short: 'Non-free — restrictions apply.',
    explain:
      'Not an open-source license under the OSI definition. These are "source-available" or non-commercial licenses (BUSL, SSPL, Elastic, Commons Clause, CC-NC, etc.) that restrict how you may use, host, or resell the software — often forbidding competing commercial or SaaS offerings. Read the exact terms; you may need a paid commercial license.',
  },
  unknown: {
    label: 'Unknown / unclassified',
    emoji: '⚪',
    order: 6,
    css: 'unknown',
    short: 'Could not identify the license.',
    explain:
      'This SPDX id or license string is not in our database, so we cannot assess its risk. Look it up on spdx.org/licenses before relying on it. An unrecognized license is not automatically safe.',
  },
  unlicensed: {
    label: 'Unlicensed / missing',
    emoji: '⚪',
    order: 7,
    css: 'unknown',
    short: 'No license declared.',
    explain:
      'No license was declared for this dependency (or it is explicitly marked UNLICENSED / private). By default, code with NO license is "all rights reserved" — you have no legal permission to use it. Treat missing licenses as a blocker until clarified.',
  },
};

export const TIER_ORDER = [
  'strong-copyleft',
  'network-copyleft',
  'proprietary',
  'weak-copyleft',
  'unknown',
  'unlicensed',
  'permissive',
  'public-domain',
];

// ── Data provenance / staleness ──────────────────────────────────────────────
// Bump DATA_AS_OF whenever the bundled caches (npm.js / pypi.js / licenses.js)
// are refreshed. Shown in the UI so users know how fresh the offline answers are.
export const DATA_AS_OF = '2026-08-19';

// The count of licenses actually carried in this bundled database. Referenced by
// the UI/README so we never over-claim the SPDX coverage.
export const LICENSE_COUNT = Object.keys(LICENSES).length;

// Packages that have RELICENSED at least once (often from permissive/open to a
// source-available or copyleft license on a later version). When one of these
// resolves from the OFFLINE CACHE, the UI nudges the user to verify live because
// the cached answer may reflect an older version's license.
export const RELICENSE_WATCHLIST = new Set([
  // npm
  'mapbox-gl',
  '@mapbox/mapbox-gl-js',
  'highcharts',
  'react-map-gl',
  // pip / cross-ecosystem (name as it appears in each ecosystem, lowercased)
  'elasticsearch',
  'elasticsearch-dsl',
  'redis',
  'terraform',
  'consul',
  'vault',
  'sentry-sdk',
  'sentry',
  '@sentry/node',
  '@sentry/browser',
  'cockroachdb',
  'grafana',
  'akka',
]);

/** True if a package name is on the relicense watchlist (case-insensitive). */
export function isWatchlisted(name) {
  if (!name || typeof name !== 'string') return false;
  return RELICENSE_WATCHLIST.has(name) || RELICENSE_WATCHLIST.has(name.toLowerCase());
}

// ── Per-license permissions / conditions / limitations (TLDRLegal-style) ─────
// Structured detail answering the natural follow-up questions ("can I modify?",
// "must I disclose source?", "is there a patent grant?") without leaving the page.
// Defined per TIER (the practical granularity users act on); classifyLicense
// surfaces the matching entry so the UI can render it inline.
export const TIER_DETAIL = {
  'public-domain': {
    permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use', 'Sublicense'],
    conditions: [],
    limitations: ['No warranty', 'No liability'],
    patentGrant: 'none',
    discloseSource: 'no',
  },
  permissive: {
    permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use', 'Patent use (Apache-2.0)'],
    conditions: ['Include copyright notice', 'Include license text'],
    limitations: ['No warranty', 'No liability', 'No trademark grant'],
    patentGrant: 'sometimes',
    discloseSource: 'no',
  },
  'weak-copyleft': {
    permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use'],
    conditions: [
      'Disclose source of the LIBRARY if modified',
      'Same license for the library files',
      'Include copyright + license notice',
      'State changes',
    ],
    limitations: ['No warranty', 'No liability'],
    patentGrant: 'sometimes',
    discloseSource: 'if you modify the library',
  },
  'strong-copyleft': {
    permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use', 'Patent use (GPL-3.0)'],
    conditions: [
      'Disclose source of YOUR whole program',
      'Same (copyleft) license for the combined work',
      'Include copyright + license notice',
      'State changes',
    ],
    limitations: ['No warranty', 'No liability'],
    patentGrant: 'sometimes',
    discloseSource: 'yes, on distribution',
  },
  'network-copyleft': {
    permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use', 'Patent use'],
    conditions: [
      'Disclose source to NETWORK users (not just on distribution)',
      'Same (AGPL) license for the combined work',
      'Include copyright + license notice',
      'State changes',
    ],
    limitations: ['No warranty', 'No liability'],
    patentGrant: 'yes',
    discloseSource: 'yes, even over a network / SaaS',
  },
  proprietary: {
    permissions: ['Private use', 'Use per the specific terms only'],
    conditions: ['Read the exact license', 'May require a paid/commercial license', 'Usage restrictions apply'],
    limitations: ['No warranty', 'No liability', 'May forbid competing SaaS / resale', 'Not OSI-approved'],
    patentGrant: 'varies',
    discloseSource: 'varies',
  },
  unknown: {
    permissions: [],
    conditions: ['Identify the license before relying on it'],
    limitations: ['Unrecognized — not automatically safe'],
    patentGrant: 'unknown',
    discloseSource: 'unknown',
  },
  unlicensed: {
    permissions: [],
    conditions: ['Obtain explicit permission from the author'],
    limitations: ['All rights reserved by default — no permission granted'],
    patentGrant: 'none',
    discloseSource: 'n/a',
  },
};
