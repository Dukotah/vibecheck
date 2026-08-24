// registry.js — the ordered list of all VibeCheck check modules. No DOM.
//
// This is the single source of truth for "which checks exist and in what
// order". The shell renders one card per entry; the scorer runs every entry.
// To add a check: create src/modules/<id>.js (contract-compliant) and import
// it here.

import legal from './modules/legal.js';
import accessibility from './modules/accessibility.js';
import crawlers from './modules/crawlers.js';
import sharepreview from './modules/sharepreview.js';
import docs from './modules/docs.js';
import { validateModule } from './contract.js';

/**
 * The check modules, in the order the dashboard presents them. Each entry is
 * the module object itself (which carries id/title/tagline/run/formSpec).
 * @type {Array<import('./contract.js').ModuleResult extends never ? never : any>}
 */
export const MODULES = [legal, accessibility, crawlers, sharepreview, docs];

/** Stable ids, in order. */
export const MODULE_IDS = MODULES.map((m) => m.id);

/**
 * Lightweight display metadata for each module (what the dashboard card needs
 * before the user has run anything).
 * @type {Array<{ id:string, title:string, tagline:string, order:number }>}
 */
export const MODULE_META = MODULES.map((m, i) => ({
  id: m.id,
  title: m.title,
  tagline: m.tagline,
  order: i,
}));

/**
 * Look up a module by id.
 * @param {string} id
 * @returns {any | undefined}
 */
export function getModule(id) {
  return MODULES.find((m) => m.id === id);
}

/**
 * Validate every registered module against the contract.
 * @returns {Record<string, string[]>} map of id -> problems (empty arrays = ok)
 */
export function validateRegistry() {
  const report = {};
  for (const m of MODULES) {
    report[m.id] = validateModule(m);
  }
  return report;
}
