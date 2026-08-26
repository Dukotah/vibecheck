// score.js — aggregate per-module results into one Launch Readiness score
// plus a prioritized "fix these" list. Pure, no DOM.
//
// Design choices:
//  - The overall score is the AVERAGE OF THE REAL CHECK SCORES, not of their
//    pass/warn/fail buckets. That matters for feel: fix one alt attribute and
//    the number moves. A score that only jumps in thirds feels broken.
//  - A check that found a genuine blocker (`fail`) is capped at BLOCKER_CAP
//    until the blocker is gone, so "80% of an unshippable thing" can never
//    read as launch-ready.
//  - `incomplete` checks (not run yet) do NOT drag the score down. They are
//    excluded from the average and surfaced as "not checked yet" instead.
//  - If nothing has been run, overall score is 0 and status is 'incomplete'.
//  - Fixes are ordered worst-status-first so the user sees blockers on top.

import { normalizeResult } from './contract.js';

/** Ranking used to order fixes: fails first, then warns. */
const STATUS_PRIORITY = { fail: 0, warn: 1, incomplete: 2, pass: 3 };

/** A check that flagged a blocker cannot contribute more than this. */
export const BLOCKER_CAP = 50;

/**
 * @typedef {Object} ScoredEntry
 * @property {string} id
 * @property {string} title
 * @property {import('./contract.js').ModuleResult} result
 */

/**
 * @typedef {Object} Overall
 * @property {number} score            0..100 launch-readiness score
 * @property {'ready'|'almost'|'not-ready'|'incomplete'} status
 * @property {string} label            plain-English band label
 * @property {number} checksRun        how many checks produced a real status
 * @property {number} checksTotal      how many checks exist
 * @property {number} blockers         how many checks came back 'fail'
 * @property {Array<{id:string,title:string,status:string,score:number}>} breakdown
 * @property {Array<{id:string,moduleTitle:string,label:string,copyText:string,status:string}>} fixes
 */

/**
 * Map a 0..100 number to a friendly readiness band.
 * @param {number} score
 * @returns {{status:'ready'|'almost'|'not-ready', label:string}}
 */
export function scoreBand(score) {
  if (score >= 85) return { status: 'ready', label: 'Looking launch-ready' };
  if (score >= 60) return { status: 'almost', label: 'Almost there — a few fixes' };
  return { status: 'not-ready', label: 'Not ready to ship yet' };
}

/**
 * What a single check contributes to the overall score.
 * @param {import('./contract.js').ModuleResult} result
 * @returns {number|null} null = does not count (not run yet)
 */
export function contribution(result) {
  if (!result || result.status === 'incomplete') return null;
  if (result.status === 'fail') return Math.min(result.score, BLOCKER_CAP);
  return result.score;
}

/**
 * Aggregate an array of scored entries into the overall readiness object.
 * Accepts partial/empty input gracefully.
 *
 * @param {ScoredEntry[]} [entries]
 * @returns {Overall}
 */
export function aggregate(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const breakdown = [];
  const fixes = [];
  let total = 0;
  let counted = 0;
  let blockers = 0;

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const result = normalizeResult(entry.result);
    const id = String(entry.id ?? '');
    const title = String(entry.title ?? id);

    breakdown.push({ id, title, status: result.status, score: result.score });
    if (result.status === 'fail') blockers += 1;

    const value = contribution(result);
    if (value !== null) {
      total += value;
      counted += 1;
    }

    for (const fix of result.fixes) {
      fixes.push({
        id,
        moduleTitle: title,
        label: fix.label,
        copyText: fix.copyText,
        status: result.status,
      });
    }
  }

  fixes.sort((a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9));

  const checksTotal = list.length;
  if (counted === 0) {
    return {
      score: 0,
      status: 'incomplete',
      label: 'Run a check to get your score',
      checksRun: 0,
      checksTotal,
      blockers: 0,
      breakdown,
      fixes,
    };
  }

  const score = Math.round(total / counted);
  const band = scoreBand(score);
  return {
    score,
    status: band.status,
    label: band.label,
    checksRun: counted,
    checksTotal,
    blockers,
    breakdown,
    fixes,
  };
}
