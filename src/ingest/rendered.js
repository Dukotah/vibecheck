// ingest/rendered.js — decide whether fetched HTML is the actual page, or just
// the empty shell a single-page app serves before its JavaScript runs.
//
// This matters more here than almost anywhere else. The tools named on our own
// front page — Lovable, Bolt, v0, Replit — routinely ship client-rendered apps
// whose served HTML is a <div id="root"></div> and a script tag. Scanning that
// for accessibility finds no images without alt text, no unlabelled inputs and
// no missing headings, because it finds nothing at all, and then cheerfully
// reports "a few things to tidy up, but no showstoppers".
//
// A confident score on an empty page is worse than no score. So we detect the
// shell and say so.
//
// Note what is NOT affected: the social share preview reads <meta> tags out of
// <head>, and those are static in a SPA's index.html. That check stays valid.
//
// Pure: no DOM, no network, never throws.

/** Mount points frameworks leave empty for the client to fill. */
const MOUNT_IDS = ['root', 'app', '__next', '_next', '__nuxt', 'q-app', 'svelte'];

/** Strip anything that is not user-visible text. */
function bodyText(html) {
  const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  const body = bodyMatch ? bodyMatch[1] : html;
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<template[\s\S]*?<\/template>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Count body elements that could carry real content. */
function contentTagCount(html) {
  const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  const body = bodyMatch ? bodyMatch[1] : html;
  const stripped = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const matches = stripped.match(
    /<(h[1-6]|p|a|img|button|input|textarea|select|li|table|article|section|nav|header|footer|main|form|video|picture)[\s>]/gi,
  );
  return matches ? matches.length : 0;
}

/** Does the body contain a framework mount node that was left empty? */
export function hasEmptyMount(html) {
  for (const id of MOUNT_IDS) {
    // <div id="root"></div> with only whitespace inside.
    const re = new RegExp(`<(div|main|section)[^>]*\\bid=["']?${id}["']?[^>]*>\\s*</\\1>`, 'i');
    if (re.test(html)) return true;
  }
  return false;
}

/**
 * Is this HTML an unrendered single-page-app shell?
 *
 * Deliberately conservative: a false positive tells someone with a real page
 * that we cannot read it, which is annoying but honest. A false negative hands
 * them a meaningless score they will believe, which is the failure we care about.
 *
 * @param {string} html
 * @returns {{ shell: boolean, reason: string }}
 */
export function detectShell(html) {
  const source = typeof html === 'string' ? html : '';
  if (!source.trim()) return { shell: false, reason: '' };

  const hasScript = /<script[\s>]/i.test(source);
  if (!hasScript) return { shell: false, reason: '' };

  const text = bodyText(source);
  const tags = contentTagCount(source);
  const emptyMount = hasEmptyMount(source);

  // The clearest signal: a known mount point, left empty, with no real text.
  if (emptyMount && text.length < 400) {
    return {
      shell: true,
      reason: 'the page builds itself with JavaScript after it loads',
    };
  }

  // The weaker signal: essentially nothing in the body at all.
  if (text.length < 120 && tags <= 2) {
    return {
      shell: true,
      reason: 'the page arrived almost empty',
    };
  }

  return { shell: false, reason: '' };
}

/** The plain-English explanation shown in place of a bogus score. */
export const SHELL_NOTE =
  'We could only read the empty shell of this page — ' +
  'it builds itself with JavaScript after it loads, so there was nothing here to check yet. ' +
  'To check it properly: open your site, right-click the page, choose "Inspect", ' +
  'right-click the <html> tag and choose "Copy outerHTML", then paste it below.';
