// modules/accessibility/analyze.js — the pure decision core for the
// Accessibility check. No DOM, never throws. It scans a pasted HTML string for
// the highest-impact, automatable WCAG 2.2 A/AA basics and turns them into a
// normalized { status, score, summary, findings, fixes } result.
//
// Plain-English framing for a non-technical vibecoder: "Will people using
// screen readers, keyboards, or with low vision be able to use this page?"
//
// We deliberately keep this to checks a machine can reliably catch from static
// HTML alone (no rendering, no color math beyond obvious traps): missing alt
// text, unlabeled inputs, a missing page language, no page title, a missing
// top-level heading, generic link text, positive tabindex, and the classic
// "user-scalable=no" zoom trap. Anything that needs a real browser or human
// judgement is surfaced as a gentle reminder, never as a hard fail.

import { toText } from '../docs/analyze.js';

/** Strip HTML comments so commented-out markup never triggers a finding. */
function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, ' ');
}

/** All opening tags of a given name, with their raw attribute string. */
function tagsOf(html, name) {
  const re = new RegExp(`<${name}(\\s[^>]*?)?\\/?>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1] || '');
  return out;
}

/** Read one attribute's value from a raw attribute string (or null). */
function attr(attrsRaw, key) {
  const re = new RegExp(`\\b${key}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = re.exec(attrsRaw);
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? '';
}

/** True if the raw attribute string contains a bare (valueless) attribute. */
function hasBareAttr(attrsRaw, key) {
  return new RegExp(`(^|\\s)${key}(\\s|=|$)`, 'i').test(attrsRaw);
}

const GENERIC_LINKS = new Set([
  'click here', 'here', 'read more', 'more', 'link', 'this', 'this link',
  'learn more', 'details', 'go', 'click',
]);

/**
 * The core scan. Pure. Returns a normalized module result shape.
 * @param {{ html?: string }} [input]
 * @returns {{status:string, score:number, summary:string, findings:Array, fixes:Array}}
 */
export function analyze(input) {
  const raw = toText(input && input.html).trim();
  if (!raw) {
    return {
      status: 'incomplete',
      score: 0,
      summary: 'Paste your page HTML and we will scan it for the accessibility basics. Nothing leaves your browser.',
      findings: [],
      fixes: [],
    };
  }
  // Guard: is this actually markup? A blob with no tags is likely a mis-paste.
  if (!/<[a-z!/]/i.test(raw)) {
    return {
      status: 'incomplete',
      score: 0,
      summary: 'That does not look like HTML. Paste the page source (right-click the page, then "View Page Source").',
      findings: [],
      fixes: [],
    };
  }

  const html = stripComments(raw);
  const findings = [];
  const fixes = [];
  const seenFix = new Set();
  const addFix = (label, copyText) => {
    if (seenFix.has(label)) return;
    seenFix.add(label);
    fixes.push({ label, copyText });
  };

  // Each check that APPLIES to this page contributes a point; passing checks
  // earn it. Checks that do not apply (e.g. no images on the page) are skipped
  // so a simple page is not punished for what it does not contain.
  let applicable = 0;
  let earned = 0;
  const score1 = () => (applicable += 1);
  const pass = () => (earned += 1);

  // ── 1. Page language (WCAG 3.1.1) ─────────────────────────────
  score1();
  const htmlTag = tagsOf(html, 'html')[0];
  const lang = htmlTag != null ? attr(htmlTag, 'lang') : null;
  if (htmlTag == null) {
    // No <html> tag — likely a fragment. Don't penalize, just note it.
    applicable -= 1;
  } else if (lang && lang.trim()) {
    pass();
    findings.push({ level: 'good', text: `Your page declares its language ("${lang.trim()}"), so screen readers use the right voice.` });
  } else {
    findings.push({ level: 'bad', text: 'Your <html> tag is missing a language. Screen readers guess the wrong accent and pronunciation.' });
    addFix('Set your page language', 'Change your opening tag to:\n<html lang="en">');
  }

  // ── 2. Page title (WCAG 2.4.2) ────────────────────────────────
  const hasHead = /<head[\s>]/i.test(html) || htmlTag != null;
  if (hasHead) {
    score1();
    const titleMatch = /<title\s*>([\s\S]*?)<\/title>/i.exec(html);
    if (titleMatch && titleMatch[1].trim()) {
      pass();
      findings.push({ level: 'good', text: `Your page has a title ("${titleMatch[1].trim().slice(0, 60)}"), which names the tab and helps orientation.` });
    } else {
      findings.push({ level: 'bad', text: 'Your page has no <title>. The browser tab and screen-reader announcement will be blank or a raw URL.' });
      addFix('Give your page a title', '<title>Your App Name — what it does</title>');
    }
  }

  // ── 3. Images have alt text (WCAG 1.1.1) ──────────────────────
  const imgs = tagsOf(html, 'img');
  if (imgs.length) {
    score1();
    const missing = imgs.filter((a) => attr(a, 'alt') == null && !hasBareAttr(a, 'alt'));
    if (missing.length === 0) {
      pass();
      findings.push({ level: 'good', text: `All ${imgs.length} image${imgs.length === 1 ? '' : 's'} on the page have alt text for screen-reader users.` });
    } else {
      findings.push({
        level: 'bad',
        text: `${missing.length} of ${imgs.length} image${imgs.length === 1 ? '' : 's'} ${missing.length === 1 ? 'has' : 'have'} no alt text. Blind users hear nothing, or the raw file name.`,
      });
      addFix(
        'Add alt text to every image',
        'Each <img> needs an alt describing it. Decorative images use empty alt so they are skipped:\n\n<img src="logo.png" alt="Acme company logo">\n<img src="divider.png" alt="">',
      );
    }
  }

  // ── 4. Form inputs are labeled (WCAG 1.3.1 / 4.1.2) ───────────
  const inputs = [
    ...tagsOf(html, 'input'),
    ...tagsOf(html, 'select'),
    ...tagsOf(html, 'textarea'),
  ].filter((a) => {
    const type = (attr(a, 'type') || '').toLowerCase();
    return !['hidden', 'submit', 'button', 'reset', 'image'].includes(type);
  });
  if (inputs.length) {
    score1();
    const labelForIds = new Set();
    const labelReAll = /<label(\s[^>]*)?>/gi;
    let lm;
    while ((lm = labelReAll.exec(html)) !== null) {
      const forId = attr(lm[1] || '', 'for');
      if (forId) labelForIds.add(forId);
    }
    const unlabeled = inputs.filter((a) => {
      const id = attr(a, 'id');
      if (id && labelForIds.has(id)) return false;
      if (attr(a, 'aria-label')) return false;
      if (attr(a, 'aria-labelledby')) return false;
      if (attr(a, 'title')) return false;
      return true;
    });
    if (unlabeled.length === 0) {
      pass();
      findings.push({ level: 'good', text: 'Your form fields have labels, so people know what each box is for.' });
    } else {
      findings.push({
        level: 'bad',
        text: `${unlabeled.length} form field${unlabeled.length === 1 ? '' : 's'} ${unlabeled.length === 1 ? 'has' : 'have'} no label. Screen-reader users hear "edit text" with no clue what to type.`,
      });
      addFix(
        'Label every form field',
        'Connect a <label> to each input with a matching id:\n\n<label for="email">Email address</label>\n<input id="email" type="email">',
      );
    }
  }

  // ── 5. A top-level heading exists (WCAG 1.3.1 / 2.4.6) ─────────
  const bodyish = /<body[\s>]/i.test(html) || tagsOf(html, 'h1').length || tagsOf(html, 'h2').length;
  if (bodyish) {
    score1();
    const h1s = tagsOf(html, 'h1').length;
    if (h1s === 1) {
      pass();
      findings.push({ level: 'good', text: 'Your page has one clear main heading (<h1>), the anchor screen-reader users navigate from.' });
    } else if (h1s === 0) {
      findings.push({ level: 'warn', text: 'Your page has no main heading (<h1>). Screen-reader users lose the "what is this page" anchor.' });
      addFix('Add one main heading', 'Put a single <h1> near the top naming the page:\n\n<h1>What this page is</h1>');
    } else {
      findings.push({ level: 'warn', text: `Your page has ${h1s} <h1> headings. Aim for exactly one main heading, then <h2>/<h3> beneath it.` });
    }
  }

  // ── 6. Link text is meaningful (WCAG 2.4.4) ───────────────────
  const linkRe = /<a(\s[^>]*)?>([\s\S]*?)<\/a>/gi;
  let la;
  const genericLinks = [];
  let linkCount = 0;
  while ((la = linkRe.exec(html)) !== null) {
    const attrs = la[1] || '';
    const text = la[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const accessible = attr(attrs, 'aria-label') || attr(attrs, 'title') || text;
    linkCount += 1;
    if (GENERIC_LINKS.has((accessible || '').trim())) genericLinks.push(accessible.trim());
  }
  if (linkCount) {
    score1();
    if (genericLinks.length === 0) {
      pass();
      findings.push({ level: 'good', text: 'Your links describe where they go, so a screen-reader user scanning links understands each one.' });
    } else {
      findings.push({
        level: 'warn',
        text: `${genericLinks.length} link${genericLinks.length === 1 ? '' : 's'} say vague things like "${genericLinks[0]}". Out of context (a screen reader lists links alone) they are meaningless.`,
      });
      addFix('Make link text describe the destination', 'Swap generic text for the target:\n\nBefore: Read <a href="/pricing">here</a>\nAfter:  Read our <a href="/pricing">pricing guide</a>');
    }
  }

  // ── 7. Zoom is not disabled (WCAG 1.4.4) ──────────────────────
  const viewport = tagsOf(html, 'meta').find((a) => (attr(a, 'name') || '').toLowerCase() === 'viewport');
  if (viewport != null) {
    score1();
    const content = (attr(viewport, 'content') || '').toLowerCase();
    const zoomBlocked = /user-scalable\s*=\s*(no|0)/.test(content) || /maximum-scale\s*=\s*(1(\.0+)?|0)\b/.test(content);
    if (!zoomBlocked) {
      pass();
      findings.push({ level: 'good', text: 'Your page lets people pinch-to-zoom, which low-vision users rely on.' });
    } else {
      findings.push({ level: 'bad', text: 'Your page disables zoom (user-scalable=no / maximum-scale=1). Low-vision users cannot enlarge text to read it.' });
      addFix('Stop blocking zoom', 'Use a viewport that allows scaling:\n\n<meta name="viewport" content="width=device-width, initial-scale=1">');
    }
  }

  // ── 8. No positive tabindex traps (WCAG 2.4.3) ────────────────
  const positiveTab = [
    ...tagsOf(html, 'a'), ...tagsOf(html, 'button'), ...tagsOf(html, 'input'),
    ...tagsOf(html, 'div'), ...tagsOf(html, 'span'), ...tagsOf(html, 'select'), ...tagsOf(html, 'textarea'),
  ].filter((a) => {
    const t = attr(a, 'tabindex');
    return t != null && Number(t) > 0;
  });
  if (positiveTab.length) {
    // Only counts as an applicable check when the anti-pattern is present.
    score1();
    findings.push({ level: 'warn', text: `${positiveTab.length} element${positiveTab.length === 1 ? '' : 's'} use a positive tabindex, which scrambles the keyboard tab order and confuses everyone tabbing through.` });
    addFix('Remove positive tabindex', 'Delete tabindex="1" (and higher). Let the natural DOM order drive keyboard focus; only use tabindex="0" or "-1".');
  }

  // A gentle, always-present reminder about the parts a static scan can't judge.
  findings.push({
    level: 'warn',
    text: 'Reminder: a code scan cannot check color contrast, keyboard-only flows, or captions. Do a quick keyboard-only pass (Tab through everything) before launch.',
  });

  // ── Score & status ────────────────────────────────────────────
  const score = applicable === 0 ? 50 : Math.round((earned / applicable) * 100);
  const hasBad = findings.some((f) => f.level === 'bad');
  const status = hasBad ? 'fail' : score >= 80 ? 'pass' : 'warn';

  let summary;
  if (status === 'pass') {
    summary = 'The accessibility basics look solid. Nice work — most vibecoded apps miss these.';
  } else if (status === 'warn') {
    summary = 'A few accessibility things to tidy up, but no showstoppers. Knock out the fixes below.';
  } else {
    summary = 'Some people will struggle to use this page as-is. The fixes below are the high-impact ones to do first.';
  }

  return { status, score, summary, findings, fixes };
}
