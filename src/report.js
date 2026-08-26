// report.js — turn per-module results into a plain-English report card object
// and a Markdown export. Pure, no DOM.

import { aggregate } from './score.js';
import { normalizeResult } from './contract.js';

const STATUS_EMOJI = { pass: '✅', warn: '⚠️', fail: '❌', incomplete: '⬜' };
const STATUS_WORD = {
  pass: 'Passed',
  warn: 'Needs a look',
  fail: 'Failed',
  incomplete: 'Not checked yet',
};

/**
 * @typedef {Object} ReportCard
 * @property {string} title
 * @property {string} generatedAt   ISO timestamp
 * @property {import('./score.js').Overall} overall
 * @property {Array<{
 *   id:string, title:string, status:string, statusWord:string,
 *   score:number, summary:string,
 *   findings:import('./contract.js').Finding[],
 *   fixes:import('./contract.js').Fix[]
 * }>} sections
 */

/**
 * Build the structured report card object from scored entries.
 * @param {import('./score.js').ScoredEntry[]} [entries]
 * @param {{ now?: Date, siteUrl?: string }} [opts]
 * @returns {ReportCard}
 */
export function buildReport(entries, opts = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const overall = aggregate(list);
  const now = opts.now instanceof Date ? opts.now : new Date();

  const sections = list.map((entry) => {
    const result = normalizeResult(entry && entry.result);
    const id = String((entry && entry.id) ?? '');
    const title = String((entry && entry.title) ?? id);
    return {
      id,
      title,
      status: result.status,
      statusWord: STATUS_WORD[result.status] ?? result.status,
      score: result.score,
      summary: result.summary,
      findings: result.findings,
      fixes: result.fixes,
    };
  });

  return {
    title: 'VibeCheck — Launch Readiness Report',
    generatedAt: now.toISOString(),
    siteUrl: typeof opts.siteUrl === 'string' ? opts.siteUrl : '',
    overall,
    sections,
  };
}

/**
 * Render a ReportCard as Markdown (paste-into-anything export).
 * @param {ReportCard} report
 * @returns {string}
 */
export function toMarkdown(report) {
  if (!report || typeof report !== 'object') return '';
  const o = report.overall || { score: 0, label: '', checksRun: 0, checksTotal: 0 };
  const lines = [];

  lines.push(`# ${report.title}`);
  lines.push('');
  lines.push(`**Launch Readiness: ${o.score}/100 — ${o.label}**`);
  if (report.siteUrl) {
    lines.push('');
    lines.push(`Checked: ${report.siteUrl}`);
  }
  lines.push('');
  lines.push(`_${o.checksRun} of ${o.checksTotal} checks run. Generated ${report.generatedAt}._`);
  lines.push('');

  for (const s of report.sections || []) {
    const emoji = STATUS_EMOJI[s.status] ?? '';
    lines.push(`## ${emoji} ${s.title} — ${s.statusWord} (${s.score}/100)`);
    if (s.summary) {
      lines.push('');
      lines.push(s.summary);
    }
    if (s.findings && s.findings.length) {
      lines.push('');
      for (const f of s.findings) {
        const mark = f.level === 'good' ? '- ✓' : f.level === 'bad' ? '- ✗' : '- •';
        lines.push(`${mark} ${f.text}`);
      }
    }
    if (s.fixes && s.fixes.length) {
      lines.push('');
      lines.push('**Fixes:**');
      for (const fix of s.fixes) {
        lines.push(`- ${fix.label}`);
      }
    }
    lines.push('');
  }

  if (o.fixes && o.fixes.length) {
    lines.push('## Prioritized fix list');
    lines.push('');
    o.fixes.forEach((fix, i) => {
      lines.push(`${i + 1}. **${fix.moduleTitle}** — ${fix.label}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}
