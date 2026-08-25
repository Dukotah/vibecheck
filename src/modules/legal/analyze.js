// analyze.js — pure orchestration for the VibeCheck "Legal & Licenses" check.
// No DOM, no I/O. Turns two pasted inputs (the project's own LICENSE text and a
// dependency manifest like package.json / requirements.txt) into the normalized
// { status, score, summary, findings, fixes } shape the app contract expects.
//
// It reuses the battle-tested LicenseGuard cores copied into this folder:
//   parse.js     — manifest → dependency entries
//   classify.js  — entries → risk-tiered results + summary verdict
//   licenses.js  — SPDX database, tiers, plain-English explanations
//
// Everything here is written for a NON-TECHNICAL "vibecoder": the findings and
// fixes are plain English, and where the source tool produced a paste-ready
// artifact (a LICENSE file, a README license line) we surface it as a copy fix.

import { parseManifest } from './parse.js';
import { classifyAll, classifyLicense, summarize, sortByRisk } from './classify.js';
import { TIERS, DATA_AS_OF } from './licenses.js';

// Tiers that should BLOCK a launch of a closed-source / commercial product.
const BLOCKING_TIERS = new Set(['strong-copyleft', 'network-copyleft', 'proprietary', 'unlicensed']);
// Tiers that need a human to look but are not automatic blockers.
const CAUTION_TIERS = new Set(['weak-copyleft', 'unknown']);

/**
 * A ready-to-use MIT LICENSE file, filled with a placeholder year + name.
 * MIT is the safest, most permissive default for someone who just wants to
 * ship and does not know what to pick.
 */
export function mitLicenseText(year = new Date().getFullYear(), holder = 'Your Name') {
  const y = String(year).replace(/[^0-9]/g, '') || String(new Date().getFullYear());
  const name = String(holder || 'Your Name').replace(/[\r\n]+/g, ' ').trim() || 'Your Name';
  return `MIT License

Copyright (c) ${y} ${name}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
}

/**
 * Guess whether pasted LICENSE text actually looks like a real license file,
 * and classify it into a risk tier. Very defensive: any non-string is "none".
 * @returns {{ present: boolean, tier: string, name: string, spdx: string }}
 */
export function detectOwnLicense(licenseText) {
  if (typeof licenseText !== 'string') return blankOwn();
  const raw = licenseText.trim();
  if (!raw) return blankOwn();

  // A one-word paste ("MIT", "Apache-2.0", "none") is a license id, not a file.
  const oneToken = /^[A-Za-z0-9.+\-]+$/.test(raw) && raw.length <= 40;
  if (oneToken) {
    const cls = classifyLicense(raw);
    return {
      present: cls.tier !== 'unlicensed',
      tier: cls.tier,
      name: TIERS[cls.tier]?.label || 'Unknown',
      spdx: cls.expression || raw,
    };
  }

  // A pasted file body: sniff the family from its wording.
  const t = raw.toLowerCase();
  const looksLikeLicense =
    /permission is hereby granted/.test(t) ||
    /\blicense\b/.test(t) ||
    /copyright\s*\(c\)/.test(t) ||
    /gnu (general|lesser|affero)/.test(t) ||
    /apache license/.test(t) ||
    /mozilla public license/.test(t) ||
    /redistribution and use/.test(t);

  const spdx = sniffSpdxFromBody(t);
  const cls = classifyLicense(spdx);
  return {
    present: looksLikeLicense,
    tier: looksLikeLicense ? cls.tier : 'unlicensed',
    name: looksLikeLicense ? TIERS[cls.tier]?.label || 'Unknown' : 'Unlicensed / missing',
    spdx: looksLikeLicense ? spdx : '',
  };
}

function blankOwn() {
  return { present: false, tier: 'unlicensed', name: 'Unlicensed / missing', spdx: '' };
}

/** Map the wording of a pasted license body to a best-guess SPDX id. */
function sniffSpdxFromBody(lowerText) {
  const t = lowerText;
  if (/gnu affero/.test(t)) return 'AGPL-3.0-only';
  if (/gnu lesser/.test(t)) return 'LGPL-3.0-only';
  if (/gnu general public license/.test(t)) {
    if (/version 2/.test(t)) return 'GPL-2.0-only';
    return 'GPL-3.0-only';
  }
  if (/mozilla public license/.test(t)) return 'MPL-2.0';
  if (/apache license/.test(t)) return 'Apache-2.0';
  if (/permission is hereby granted, free of charge/.test(t)) return 'MIT';
  if (/redistribution and use in source and binary/.test(t)) return 'BSD-3-Clause';
  if (/business source license/.test(t)) return 'BUSL-1.1';
  if (/server side public license/.test(t)) return 'SSPL-1.0';
  if (/this is free and unencumbered software released into the public domain/.test(t)) return 'Unlicense';
  return 'MIT'; // it read like a license but we could not place it; treat as permissive-ish unknown
}

/**
 * Core analysis. Pure. Never throws.
 * @param {{ licenseText?: string, packages?: string }} input
 */
export function analyze(input) {
  const licenseText = input && typeof input === 'object' ? input.licenseText : undefined;
  const packages = input && typeof input === 'object' ? input.packages : undefined;

  const hasLicenseInput = typeof licenseText === 'string' && licenseText.trim().length > 0;
  const hasPackagesInput = typeof packages === 'string' && packages.trim().length > 0;

  // Nothing to check yet → neutral / excluded from the score average.
  if (!hasLicenseInput && !hasPackagesInput) {
    return {
      status: 'incomplete',
      score: 0,
      summary:
        'Paste your LICENSE file and your dependency list (package.json or requirements.txt) to check for legal blockers.',
      findings: [],
      fixes: [],
    };
  }

  const findings = [];
  const fixes = [];
  let deductions = 0;

  // ── 1. The project's OWN license ────────────────────────────────────────────
  const own = detectOwnLicense(licenseText);
  if (!hasLicenseInput || !own.present) {
    findings.push({
      level: 'bad',
      text:
        'No license file found. Without one, your code is "all rights reserved" by default, which means no one else can legally use, host, or contribute to it, and some app stores and hosts will reject it.',
    });
    deductions += 40;
    fixes.push({
      label: 'Add a LICENSE file (MIT is the simple, safe default). Save this as a file named LICENSE.',
      copyText: mitLicenseText(),
    });
    fixes.push({
      label: 'Mention your license in your README so people can see it at a glance.',
      copyText: '## License\n\nReleased under the [MIT License](./LICENSE).\n',
    });
  } else if (own.tier === 'network-copyleft' || own.tier === 'strong-copyleft') {
    findings.push({
      level: 'warn',
      text: `Your project uses a copyleft license (${own.name}). That is a valid choice, but it means anyone who uses your code may have to open-source their own. Make sure that is what you intend.`,
    });
    deductions += 10;
  } else if (own.tier === 'proprietary') {
    findings.push({
      level: 'warn',
      text: `Your license text reads as source-available / non-free (${own.name}). Fine if intentional, but people cannot freely reuse it.`,
    });
    deductions += 5;
  } else {
    findings.push({
      level: 'good',
      text: `You have a clear license (${own.name}). People can understand what they are allowed to do with your project.`,
    });
  }

  // ── 2. The dependencies you pulled in ───────────────────────────────────────
  let depSummary = null;
  let riskyList = [];
  if (hasPackagesInput) {
    const parsed = parseManifest(packages);
    if (parsed.error && parsed.entries.length === 0) {
      findings.push({
        level: 'warn',
        text:
          'We could not read your dependency list. Paste the full contents of your package.json or requirements.txt file and try again.',
      });
      deductions += 5;
    } else if (parsed.entries.length === 0) {
      findings.push({
        level: 'good',
        text: 'No third-party dependencies detected, so there are no outside license terms to worry about.',
      });
    } else {
      const results = classifyAll(parsed.entries);
      depSummary = summarize(results);
      const sorted = sortByRisk(results);
      const blockers = sorted.filter((r) => BLOCKING_TIERS.has(r.tier));
      const cautions = sorted.filter((r) => CAUTION_TIERS.has(r.tier));
      riskyList = [...blockers, ...cautions];

      const total = results.length;
      findings.push({
        level: 'good',
        text: `Checked ${total} ${total === 1 ? 'dependency' : 'dependencies'} against a bundled license database (data as of ${DATA_AS_OF}).`,
      });

      if (blockers.length) {
        deductions += Math.min(50, blockers.length * 18);
        for (const r of blockers.slice(0, 8)) {
          findings.push({ level: 'bad', text: describeDep(r) });
        }
        if (blockers.length > 8) {
          findings.push({ level: 'bad', text: `…and ${blockers.length - 8} more dependencies with launch-blocking licenses.` });
        }
      }
      if (cautions.length) {
        deductions += Math.min(20, cautions.length * 6);
        for (const r of cautions.slice(0, 5)) {
          findings.push({ level: 'warn', text: describeDep(r) });
        }
        if (cautions.length > 5) {
          findings.push({ level: 'warn', text: `…and ${cautions.length - 5} more dependencies worth a quick look.` });
        }
      }
      if (!blockers.length && !cautions.length) {
        findings.push({
          level: 'good',
          text: 'Every dependency is permissive or public domain, so it is safe to ship in a commercial or closed-source product.',
        });
      }

      // A paste-ready "review these" checklist fix when anything needs attention.
      if (riskyList.length) {
        fixes.push({
          label: 'Review these dependencies before you launch (copy this checklist).',
          copyText: reviewChecklist(riskyList),
        });
      }
    }
  } else {
    findings.push({
      level: 'warn',
      text:
        'You did not paste a dependency list, so we only checked your own license. Paste your package.json or requirements.txt to catch risky libraries too.',
    });
    deductions += 5;
  }

  // ── 3. Score + status ───────────────────────────────────────────────────────
  const score = Math.max(0, Math.min(100, Math.round(100 - deductions)));
  const status = decideStatus({ own, hasLicenseInput, hasPackagesInput, depSummary, score });
  const summary = buildSummary({ own, hasLicenseInput, hasPackagesInput, depSummary, riskyList });

  return { status, score, summary, findings, fixes };
}

/** One plain-English line describing a single risky dependency. */
function describeDep(r) {
  const meta = TIERS[r.tier] || TIERS.unknown;
  const lic = r.license ? ` (${r.license})` : '';
  if (r.tier === 'unlicensed') {
    return `"${r.name}" has no clear license${lic}. By default that means "all rights reserved" and you may not have permission to ship it.`;
  }
  if (r.tier === 'network-copyleft') {
    return `"${r.name}" is AGPL-style${lic}: using it in a hosted web app or SaaS can force you to publish your own source code. ${meta.short}`;
  }
  if (r.tier === 'strong-copyleft') {
    return `"${r.name}" is strong copyleft${lic}: shipping it can require you to open-source your whole app. ${meta.short}`;
  }
  if (r.tier === 'proprietary') {
    return `"${r.name}" is source-available / non-free${lic}: it may forbid commercial or competing use. Check the exact terms.`;
  }
  if (r.tier === 'weak-copyleft') {
    return `"${r.name}" is weak copyleft${lic}: fine to use, but if you modify the library itself you must share those changes.`;
  }
  return `"${r.name}" has an unrecognized license${lic}. Look it up before you rely on it; an unknown license is not automatically safe.`;
}

/** Build the copy-paste "review these" checklist artifact. */
function reviewChecklist(riskyList) {
  const lines = ['Dependencies to review before launch:', ''];
  for (const r of riskyList) {
    const meta = TIERS[r.tier] || TIERS.unknown;
    lines.push(`- [ ] ${r.name}${r.version ? ' ' + r.version : ''} — ${r.license || 'no license'} (${meta.label})`);
  }
  lines.push('');
  lines.push('Safe/permissive licenses (MIT, Apache-2.0, BSD, ISC) need no action beyond keeping their notices.');
  return lines.join('\n');
}

/** Decide the overall status for this check. */
function decideStatus({ own, hasLicenseInput, hasPackagesInput, depSummary, score }) {
  const ownMissing = !hasLicenseInput || !own.present;
  const depBlocked = depSummary && depSummary.verdict === 'blocked';
  const depCaution = depSummary && depSummary.verdict === 'caution';

  if (ownMissing || depBlocked) return 'fail';
  // Only half the check ran (no dependency list pasted) → never a clean pass.
  if (!hasPackagesInput) return 'warn';
  if (depCaution || score < 90) return 'warn';
  return 'pass';
}

/** Plain-English one/two-line summary. */
function buildSummary({ own, hasLicenseInput, hasPackagesInput, depSummary, riskyList }) {
  const parts = [];
  if (!hasLicenseInput || !own.present) {
    parts.push('Your project has no license yet, so no one can legally reuse it.');
  } else {
    parts.push(`Your project is licensed (${own.name}).`);
  }
  if (hasPackagesInput && depSummary) {
    if (depSummary.verdict === 'blocked') {
      parts.push(`Some dependencies have launch-blocking licenses (${riskyList.length} to review).`);
    } else if (depSummary.verdict === 'caution') {
      parts.push(`A few dependencies need a quick look (${riskyList.length} flagged).`);
    } else {
      parts.push('All your dependencies are safe to ship commercially.');
    }
  }
  return parts.join(' ');
}
