// modules/crawlers/analyze.js — the pure decision core for the crawlers check.
// No DOM, never throws. Turns "what the user WANTS to block" + "what their
// robots.txt ACTUALLY blocks" into a normalized { status, score, summary,
// findings, fixes } result.
//
// Plain-English framing for a non-technical vibecoder:
//   - They tick which groups of AI bots they want to keep out.
//   - They (optionally) paste their current robots.txt.
//   - We tell them whether the file matches their wish, and hand them a
//     paste-ready robots.txt that does.

import { CATEGORIES, idsInCategory, crawlerById } from './data.js';
import { normalizeSelection, generateRobotsTxt, parseRobots } from './generate.js';

/** Map the form's plain-language checkboxes to crawler-id selections. */
export const INTENT_TO_CATEGORY = {
  blockTraining: 'training',
  blockAssistants: 'assistant',
  blockSearchAi: 'search',
};

/**
 * Resolve the user's ticked intents into a de-duplicated, spec-ordered set of
 * crawler ids to block. Tolerates missing/partial/garbage input.
 *
 * @param {object} input the raw form object
 * @returns {string[]} crawler ids
 */
export function desiredIds(input) {
  const src = input && typeof input === 'object' ? input : {};
  const ids = [];
  for (const [field, category] of Object.entries(INTENT_TO_CATEGORY)) {
    if (src[field]) ids.push(...idsInCategory(category));
  }
  return normalizeSelection(ids);
}

/** True if the user asked to block anything at all. */
export function hasIntent(input) {
  return desiredIds(input).length > 0;
}

/** Human list of category labels the user chose. */
function chosenCategoryLabels(input) {
  const src = input && typeof input === 'object' ? input : {};
  const labels = [];
  for (const [field, category] of Object.entries(INTENT_TO_CATEGORY)) {
    if (src[field]) labels.push(CATEGORIES[category].label.toLowerCase());
  }
  return labels;
}

/** Short human names for a list of crawler ids. */
function names(ids) {
  return ids.map((id) => (crawlerById(id) ? crawlerById(id).name : id));
}

/**
 * The core analysis. Pure.
 *
 * @param {object} input form values (blockTraining/blockAssistants/blockSearchAi
 *   booleans + robotsTxt string)
 * @returns {{status:string, score:number, summary:string,
 *            findings:Array<{level:string,text:string}>,
 *            fixes:Array<{label:string,copyText:string}>}}
 */
export function analyze(input) {
  const src = input && typeof input === 'object' ? input : {};
  const wantIds = desiredIds(src);
  const robotsRaw = typeof src.robotsTxt === 'string' ? src.robotsTxt : '';
  const parsed = parseRobots(robotsRaw);
  const haveRobots = parsed.hasContent;

  const findings = [];
  const fixes = [];

  // Nothing to check: no intent chosen AND no robots.txt pasted.
  if (wantIds.length === 0 && !haveRobots) {
    return {
      status: 'incomplete',
      score: 0,
      summary:
        'Tell us which AI bots you want to keep out (or paste your robots.txt) and we will check it for you.',
      findings: [],
      fixes: [],
    };
  }

  const desiredRobots = generateRobotsTxt(wantIds);

  // Case A: user chose intents but pasted no robots.txt → they likely have none.
  if (wantIds.length > 0 && !haveRobots) {
    findings.push({
      level: 'warn',
      text: `You want to block ${chosenCategoryLabels(src).join(' and ')}, but we did not see a robots.txt. Most AI-built sites ship without one, which means every AI crawler is currently allowed.`,
    });
    findings.push({
      level: 'good',
      text: `We built a robots.txt that blocks ${wantIds.length} AI crawler${wantIds.length === 1 ? '' : 's'} for you.`,
    });
    fixes.push({
      label: 'Create a robots.txt file at the root of your site with this text',
      copyText: desiredRobots,
    });
    return {
      status: 'warn',
      score: 55,
      summary: `You have no robots.txt yet, so every AI crawler can read your site. Add the one below to block ${wantIds.length} bot${wantIds.length === 1 ? '' : 's'}.`,
      findings,
      fixes,
    };
  }

  // Case B: user pasted a robots.txt but chose no intent → just report + reassure.
  if (wantIds.length === 0 && haveRobots) {
    const already = parsed.blocked;
    if (parsed.wildcardBlocksAll) {
      findings.push({
        level: 'bad',
        text: 'Your robots.txt has "User-agent: *" with "Disallow: /", which asks EVERY crawler — including Google and Bing — to stay away. If this site should show up in search, that is almost certainly a mistake.',
      });
      fixes.push({
        label: 'If you want normal search but want to block AI bots, replace your robots.txt with this',
        copyText: generateRobotsTxt([...idsInCategory('training'), ...idsInCategory('assistant'), ...idsInCategory('search')]),
      });
      return {
        status: 'fail',
        score: 25,
        summary: 'Your robots.txt blocks every crawler, so search engines may drop your site. Fix this before launch.',
        findings,
        fixes,
      };
    }
    if (already.length > 0) {
      findings.push({
        level: 'good',
        text: `Your robots.txt already asks ${already.length} known AI crawler${already.length === 1 ? '' : 's'} to stay out: ${names(already).join(', ')}.`,
      });
      return {
        status: 'pass',
        score: 100,
        summary: `Your robots.txt already blocks ${already.length} AI crawler${already.length === 1 ? '' : 's'}. Nothing to do unless you want to block more.`,
        findings,
        fixes,
      };
    }
    findings.push({
      level: 'warn',
      text: 'We read your robots.txt and it does not block any known AI crawler, so all of them can currently read and train on your site. That may be exactly what you want (more reach) — just make it a choice.',
    });
    fixes.push({
      label: 'Want to opt out of AI training? Add these lines to your robots.txt',
      copyText: generateRobotsTxt(idsInCategory('training')),
    });
    return {
      status: 'warn',
      score: 70,
      summary: 'Your robots.txt allows every AI crawler. Fine if intentional; here is how to opt out if not.',
      findings,
      fixes,
    };
  }

  // Case C: user chose intents AND pasted a robots.txt → the real diff.
  const wantSet = new Set(wantIds);
  const haveSet = new Set(parsed.blocked);
  const missing = wantIds.filter((id) => !haveSet.has(id)); // wanted but not blocked
  const covered = wantIds.filter((id) => haveSet.has(id)); // wanted and blocked

  if (parsed.wildcardBlocksAll) {
    findings.push({
      level: 'bad',
      text: 'Your robots.txt uses "User-agent: *" with "Disallow: /", which tells EVERY crawler (Google, Bing, and AI bots) to stay away. That will hurt normal search visibility.',
    });
  }

  if (covered.length > 0) {
    findings.push({
      level: 'good',
      text: `Already handled: ${names(covered).join(', ')} ${covered.length === 1 ? 'is' : 'are'} blocked, matching what you asked for.`,
    });
  }

  if (missing.length > 0) {
    findings.push({
      level: 'bad',
      text: `Not yet blocked: ${names(missing).join(', ')}. You asked to keep ${missing.length === 1 ? 'this bot' : 'these bots'} out but your robots.txt does not do it.`,
    });
    fixes.push({
      label: 'Replace your robots.txt with this to block everything you selected',
      copyText: desiredRobots,
    });
    const wildcardPenalty = parsed.wildcardBlocksAll ? 15 : 0;
    const coverage = covered.length / wantIds.length; // 0..<1
    const score = Math.max(20, Math.round(30 + coverage * 40) - wildcardPenalty);
    return {
      status: 'fail',
      score,
      summary: `Your robots.txt is missing ${missing.length} of the ${wantIds.length} AI crawler${wantIds.length === 1 ? '' : 's'} you wanted to block. Paste in the fixed version below.`,
      findings,
      fixes,
    };
  }

  // Everything the user wanted is blocked. Only remaining issue: wildcard.
  if (parsed.wildcardBlocksAll) {
    fixes.push({
      label: 'You block the AI bots you wanted, but you also block Google/Bing. Use this instead to keep search',
      copyText: desiredRobots,
    });
    return {
      status: 'warn',
      score: 65,
      summary: 'You block the AI crawlers you selected, but your wildcard rule also blocks normal search engines.',
      findings,
      fixes,
    };
  }

  findings.push({
    level: 'good',
    text: `Perfect match: every AI crawler you selected (${wantIds.length}) is blocked by your robots.txt, and normal search engines are still allowed.`,
  });
  return {
    status: 'pass',
    score: 100,
    summary: `Your robots.txt blocks all ${wantIds.length} AI crawler${wantIds.length === 1 ? '' : 's'} you selected. You are set.`,
    findings,
    fixes,
  };
}
