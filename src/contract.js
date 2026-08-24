// contract.js — the shared VibeCheck module contract. Pure, no DOM.
//
// Every check module (src/modules/<id>.js) default-exports an object that
// satisfies this contract. The shell, the scorer, and the report builder all
// depend ONLY on this shape, so later agents can fill in real logic without
// touching the wiring.
//
// A module looks like:
//   {
//     id, title, tagline,
//     run(input)  -> ModuleResult
//     formSpec()  -> FormSpec
//   }

/** Valid result statuses, worst → best is not implied; use STATUS_WEIGHT. */
export const STATUSES = ['pass', 'warn', 'fail', 'incomplete'];

/** Valid finding levels. */
export const FINDING_LEVELS = ['good', 'warn', 'bad'];

/**
 * How much each status counts toward "is this launch-ready". `incomplete`
 * means the user has not run the check yet — it is neutral, not a failure.
 * @type {Record<string, number>}
 */
export const STATUS_WEIGHT = {
  pass: 1,
  warn: 0.5,
  fail: 0,
  incomplete: null, // excluded from the overall average
};

/**
 * @typedef {Object} Finding
 * @property {'good'|'warn'|'bad'} level
 * @property {string} text
 */

/**
 * @typedef {Object} Fix
 * @property {string} label     short human instruction ("Add a LICENSE file")
 * @property {string} copyText  paste-ready text/snippet the user can copy
 */

/**
 * @typedef {Object} ModuleResult
 * @property {'pass'|'warn'|'fail'|'incomplete'} status
 * @property {number} score   0..100
 * @property {string} summary
 * @property {Finding[]} findings
 * @property {Fix[]} fixes
 */

/**
 * @typedef {Object} FormField
 * @property {string} name
 * @property {string} label
 * @property {'text'|'textarea'|'url'|'checkbox'} type
 * @property {string} [placeholder]
 * @property {string} [help]
 */

/**
 * @typedef {Object} FormSpec
 * @property {FormField[]} fields
 * @property {Array<{label:string,value:Object}>} examples
 */

/** An empty, not-yet-run result. Modules return this before any input. */
export function incompleteResult(summary = 'Not checked yet.') {
  return { status: 'incomplete', score: 0, summary, findings: [], fixes: [] };
}

/**
 * Clamp any number to a valid 0..100 score. Non-numbers become 0.
 * @param {unknown} n
 * @returns {number}
 */
export function clampScore(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return Math.round(v);
}

/**
 * Normalize/validate a raw module result into a guaranteed-valid ModuleResult.
 * Later real modules can rely on this to never emit a malformed shape.
 * @param {Partial<ModuleResult>} raw
 * @returns {ModuleResult}
 */
export function normalizeResult(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const status = STATUSES.includes(r.status) ? r.status : 'incomplete';
  const findings = Array.isArray(r.findings)
    ? r.findings
        .filter((f) => f && typeof f === 'object')
        .map((f) => ({
          level: FINDING_LEVELS.includes(f.level) ? f.level : 'warn',
          text: String(f.text ?? ''),
        }))
    : [];
  const fixes = Array.isArray(r.fixes)
    ? r.fixes
        .filter((f) => f && typeof f === 'object')
        .map((f) => ({
          label: String(f.label ?? ''),
          copyText: String(f.copyText ?? ''),
        }))
    : [];
  return {
    status,
    score: status === 'incomplete' ? clampScore(r.score ?? 0) : clampScore(r.score),
    summary: String(r.summary ?? ''),
    findings,
    fixes,
  };
}

/**
 * Assert that an object satisfies the module contract. Returns a list of
 * problem strings (empty = valid). Used by tests and by the registry loader.
 * @param {any} mod
 * @returns {string[]}
 */
export function validateModule(mod) {
  const problems = [];
  if (!mod || typeof mod !== 'object') {
    problems.push('module is not an object');
    return problems;
  }
  for (const key of ['id', 'title', 'tagline']) {
    if (typeof mod[key] !== 'string' || mod[key].length === 0) {
      problems.push(`missing string "${key}"`);
    }
  }
  if (typeof mod.run !== 'function') problems.push('missing run() function');
  if (typeof mod.formSpec !== 'function') problems.push('missing formSpec() function');

  if (typeof mod.formSpec === 'function') {
    let spec;
    try {
      spec = mod.formSpec();
    } catch (e) {
      problems.push(`formSpec() threw: ${e && e.message}`);
    }
    if (spec && !Array.isArray(spec.fields)) problems.push('formSpec().fields is not an array');
    if (spec && !Array.isArray(spec.examples)) problems.push('formSpec().examples is not an array');
  }

  if (typeof mod.run === 'function') {
    let res;
    try {
      res = mod.run(undefined);
    } catch (e) {
      problems.push(`run(undefined) threw: ${e && e.message}`);
    }
    if (res) {
      if (!STATUSES.includes(res.status)) problems.push(`run().status invalid: ${res.status}`);
      if (typeof res.score !== 'number' || res.score < 0 || res.score > 100) {
        problems.push('run().score not a 0..100 number');
      }
      if (typeof res.summary !== 'string') problems.push('run().summary not a string');
      if (!Array.isArray(res.findings)) problems.push('run().findings not an array');
      if (!Array.isArray(res.fixes)) problems.push('run().fixes not an array');
    }
  }
  return problems;
}
