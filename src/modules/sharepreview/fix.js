// fix.js — pure logic that turns the parsed metadata into copy-pasteable
// corrected <meta> tags. Adapted from ogpreview/src/fix.js.
//
// Two outputs:
//   metaFixFor(issue, parsed)  → a single corrected <meta> line for one issue
//                                 (or null if the issue has no tag-shaped fix)
//   correctedHeadBlock(parsed) → a consolidated block of the OG/Twitter tags a
//                                 share-ready page should have, filling gaps with
//                                 sensible placeholders and fixing what we can
//                                 (relative→absolute image/url, http→https).
//
// No browser globals. Output is plain text; the DOM layer copies it verbatim.

import { resolveUrl } from './parse.js';

function firstOf(v) {
  if (Array.isArray(v)) return v.length ? v[0] : null;
  return v == null ? null : v;
}
const og = (p, k) => firstOf(p.og?.[k]);
const tw = (p, k) => firstOf(p.twitter?.[k]);

// Escape a value for safe insertion inside a double-quoted attribute. This also
// makes generated fix text XSS-safe: any < > " & the user pasted is neutralized.
export function attrEscape(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function metaTag(kind, key, content) {
  const attr = kind === 'name' ? 'name' : 'property';
  return `<meta ${attr}="${key}" content="${attrEscape(content)}" />`;
}

function base(parsed) {
  return parsed.finalUrl || parsed.canonical || og(parsed, 'og:url') || null;
}

// Given one audit issue and the parsed page, return the single corrected <meta>
// line that fixes it, or null when the fix is not a single tag.
export function metaFixFor(issue, parsed) {
  const b = base(parsed);
  switch (issue.field) {
    case 'og:title':
      return metaTag('property', 'og:title', og(parsed, 'og:title') || parsed.title || 'Your headline here');
    case 'og:description':
      return metaTag(
        'property',
        'og:description',
        og(parsed, 'og:description') || parsed.description || 'A concise one-sentence summary of the page.'
      );
    case 'og:image': {
      const cur = og(parsed, 'og:image');
      if (cur && b) {
        const abs = resolveUrl(cur, b);
        const https = abs && abs.startsWith('http://') ? abs.replace(/^http:/, 'https:') : abs;
        return metaTag('property', 'og:image', https || 'https://your-site.com/card.png');
      }
      return metaTag('property', 'og:image', 'https://your-site.com/card.png');
    }
    case 'og:image:size':
      return (
        metaTag('property', 'og:image:width', '1200') +
        '\n' +
        metaTag('property', 'og:image:height', '630')
      );
    case 'og:url': {
      const cur = og(parsed, 'og:url');
      if (cur && b) return metaTag('property', 'og:url', resolveUrl(cur, b));
      return metaTag('property', 'og:url', b || 'https://your-site.com/this-page');
    }
    case 'og:type':
      return metaTag('property', 'og:type', og(parsed, 'og:type') || 'website');
    case 'og:site_name':
      return metaTag('property', 'og:site_name', og(parsed, 'og:site_name') || 'Your Brand');
    case 'twitter:card':
      return metaTag('name', 'twitter:card', 'summary_large_image');
    default:
      return null;
  }
}

// A consolidated, corrected <head> block: the OG + Twitter tags a share-ready
// page should have. Existing good values are preserved; missing ones get
// placeholders; relative image/url are made absolute; http→https on image.
export function correctedHeadBlock(parsed) {
  const b = base(parsed);
  const lines = [];
  const absOrPlaceholder = (val, placeholder) => {
    if (!val) return placeholder;
    if (b) {
      const abs = resolveUrl(val, b);
      return abs && abs.startsWith('http://') ? abs.replace(/^http:/, 'https:') : abs;
    }
    return val;
  };

  const title = og(parsed, 'og:title') || parsed.title || 'Your headline here';
  const desc =
    og(parsed, 'og:description') || parsed.description || 'A concise one-sentence summary of the page.';
  const image = absOrPlaceholder(og(parsed, 'og:image'), 'https://your-site.com/card.png');
  const url = absOrPlaceholder(og(parsed, 'og:url'), b || 'https://your-site.com/this-page');
  const type = og(parsed, 'og:type') || 'website';
  const site = og(parsed, 'og:site_name') || 'Your Brand';

  lines.push(metaTag('property', 'og:title', title));
  lines.push(metaTag('property', 'og:description', desc));
  lines.push(metaTag('property', 'og:image', image));
  lines.push(metaTag('property', 'og:image:width', firstOf(parsed.grouped?.['og:image:width']) || '1200'));
  lines.push(metaTag('property', 'og:image:height', firstOf(parsed.grouped?.['og:image:height']) || '630'));
  lines.push(metaTag('property', 'og:url', url));
  lines.push(metaTag('property', 'og:type', type));
  lines.push(metaTag('property', 'og:site_name', site));
  lines.push(metaTag('name', 'twitter:card', 'summary_large_image'));
  lines.push(metaTag('name', 'twitter:title', tw(parsed, 'twitter:title') || title));
  lines.push(metaTag('name', 'twitter:description', tw(parsed, 'twitter:description') || desc));
  lines.push(metaTag('name', 'twitter:image', absOrPlaceholder(tw(parsed, 'twitter:image') || og(parsed, 'og:image'), image)));

  return lines.join('\n');
}
