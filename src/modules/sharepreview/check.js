// check.js — pure orchestration: parse pasted head HTML, audit it, and shape a
// contract-compatible result { status, score, summary, findings, fixes }.
// No browser globals. Never throws on any input.

import { parseHtml } from './parse.js';
import { audit, problems, SEVERITY } from './audit.js';
import { correctedHeadBlock, metaFixFor } from './fix.js';
import { buildPreviews } from './preview.js';

// Does the pasted text contain anything we can actually read?
function hasContent(html) {
  if (typeof html !== 'string') return false;
  return html.trim().length > 0;
}

// Does the pasted text look like it has ANY head-ish tags at all? Used to
// distinguish "nothing to check" from "text with no meta tags".
function looksLikeMarkup(html) {
  return /<\s*(meta|title|html|head|link|og:|twitter:)/i.test(html) || /<\s*meta\b/i.test(html);
}

// Map an audit issue to a contract finding level.
function levelFor(severity) {
  if (severity === SEVERITY.ERROR) return 'bad';
  if (severity === SEVERITY.WARN) return 'warn';
  return 'good';
}

// Map an audit issue-count profile to an overall status.
function statusFor(counts) {
  if (counts.error > 0) return 'fail';
  if (counts.warn > 0) return 'warn';
  return 'pass';
}

/**
 * Run the share-preview check against pasted head HTML (+ optional page URL).
 * @param {string} headHtml   pasted HTML / <head>
 * @param {string} [pageUrl]  optional canonical/base URL to resolve relative images
 * @returns {{status:string, score:number, summary:string, findings:Array, fixes:Array}}
 */
export function checkSharePreview(headHtml, pageUrl) {
  if (!hasContent(headHtml)) {
    return {
      status: 'incomplete',
      score: 0,
      summary: 'Paste your page <head> HTML to preview how your link looks when shared.',
      findings: [],
      fixes: [],
    };
  }

  const finalUrl = typeof pageUrl === 'string' && pageUrl.trim() ? pageUrl.trim() : null;
  const parsed = parseHtml(headHtml, { finalUrl });

  // Nothing meta-shaped at all: guide them rather than pretending to grade.
  const anyMeta = parsed.rawMeta.length > 0 || parsed.title || Object.keys(parsed.og).length > 0;
  if (!anyMeta && !looksLikeMarkup(headHtml)) {
    return {
      status: 'incomplete',
      score: 0,
      summary:
        'We could not find any HTML tags in what you pasted. Paste your page <head> (the part with <meta> and <title> tags).',
      findings: [],
      fixes: [],
    };
  }

  const result = audit(parsed);
  const status = statusFor(result.counts);
  const findings = [];

  // Good things first (so a healthy page still shows green findings).
  for (const issue of result.issues) {
    if (issue.severity === SEVERITY.OK && issue.message) {
      findings.push({ level: 'good', text: issue.message });
    }
  }
  // Then problems, errors before warnings.
  for (const issue of problems(result)) {
    findings.push({ level: levelFor(issue.severity), text: issue.message });
  }

  // A plain-English "here is what each app will show" line.
  const previews = buildPreviews(parsed);
  const imageEverywhere = ['facebook', 'linkedin', 'imessage'].every((p) => previews[p].hasImage);
  if (imageEverywhere) {
    findings.push({
      level: 'good',
      text: 'Every major app (iMessage, Slack, X, Facebook, LinkedIn, Discord) will show a rich image card.',
    });
  } else if (previews.twitter.hasImage || previews.facebook.hasImage) {
    findings.push({
      level: 'warn',
      text: 'Some apps will show an image but others will fall back to a plain text card — add an absolute og:image to fix that.',
    });
  } else {
    findings.push({
      level: 'bad',
      text: 'Right now your link shows as a plain text card with no image in every app.',
    });
  }

  // Fixes: the consolidated head block, plus a per-tag snippet for the things
  // that actually BREAK the card. Warnings are already covered by the block, and
  // listing each one separately turns "1 problem" into a wall of six near-
  // identical rows at the top of the user's to-do list.
  const fixes = [];
  const seenFixText = new Set();
  for (const issue of problems(result)) {
    if (issue.severity !== SEVERITY.ERROR) continue;
    const snippet = metaFixFor(issue, parsed);
    if (snippet && !seenFixText.has(snippet)) {
      seenFixText.add(snippet);
      fixes.push({ label: `Fix "${issue.field}": paste this into your <head>`, copyText: snippet });
    }
  }
  // Always offer the consolidated, share-ready head block as the headline fix.
  fixes.unshift({
    label: 'Copy a complete, share-ready set of tags for your <head>',
    copyText: correctedHeadBlock(parsed),
  });

  // Summary in plain English.
  const { error, warn } = result.counts;
  let summary;
  if (status === 'pass') {
    summary = 'Your link is share-ready. It will show a clean card with a title, description, and image.';
  } else if (status === 'warn') {
    summary = `Your link will preview, but ${warn} thing${warn === 1 ? '' : 's'} could be tidied up for a sharper card.`;
  } else {
    summary = `Your link preview has ${error} problem${error === 1 ? '' : 's'} that will make it look broken or empty when shared. Copy the fix below.`;
  }

  return { status, score: result.score, summary, findings, fixes };
}
