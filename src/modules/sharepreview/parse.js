// parse.js — pure HTML meta-tag extraction. No browser globals; runs under node.
//
// Adapted from ogpreview/src/parse.js. Given a raw HTML string (or just a
// <head>), pull out every <meta>, <title>, <link rel="..."> and <html lang>
// that matters for link previews. A small tolerant regex tokenizer keeps this
// dependency-free and identical in node and the browser.

// ── Attribute parsing ────────────────────────────────────────────────────────
export function parseAttributes(tagBody) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;
  let m;
  while ((m = re.exec(tagBody)) !== null) {
    const name = m[1].toLowerCase();
    const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
    attrs[name] = decodeEntities(value);
  }
  return attrs;
}

// ── HTML entity decoding ─────────────────────────────────────────────────────
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  copy: '©', reg: '®', trade: '™', hellip: '…',
  mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', eacute: 'é', egrave: 'è',
};

export function decodeEntities(str) {
  if (str == null) return '';
  return String(str).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isNaN(code) || code < 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    const named = NAMED[body];
    return named !== undefined ? named : whole;
  });
}

// ── Strip comments so we never read tags inside <!-- ... --> ─────────────────
function stripComments(html) {
  return String(html).replace(/<!--[\s\S]*?-->/g, '');
}

// ── Quote-aware tag scanner ──────────────────────────────────────────────────
function scanTags(html, tagName) {
  const out = [];
  const src = String(html);
  const open = new RegExp('<' + tagName + '\\b', 'gi');
  let m;
  while ((m = open.exec(src)) !== null) {
    const bodyStart = m.index + m[0].length;
    let i = bodyStart;
    let quote = null;
    while (i < src.length) {
      const ch = src[i];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        break;
      }
      i++;
    }
    let body = src.slice(bodyStart, i);
    body = body.replace(/\/\s*$/, '');
    out.push(body);
    open.lastIndex = i + 1;
  }
  return out;
}

// ── Extract <title> ──────────────────────────────────────────────────────────
export function extractTitle(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(stripComments(html));
  if (!m) return null;
  return decodeEntities(m[1].replace(/\s+/g, ' ').trim()) || null;
}

// ── Extract <html lang="..."> ────────────────────────────────────────────────
export function extractLang(html) {
  const m = /<html\b([^>]*)>/i.exec(stripComments(html));
  if (!m) return null;
  const attrs = parseAttributes(m[1]);
  return attrs.lang || null;
}

// ── Extract all <meta> tags into a normalized list ───────────────────────────
export function extractMetaTags(html) {
  const clean = stripComments(html);
  const metas = [];
  for (const body of scanTags(clean, 'meta')) {
    const attrs = parseAttributes(body);
    const key = attrs.property || attrs.name || attrs.itemprop || null;
    if (key == null) continue;
    const value = attrs.content !== undefined ? attrs.content : '';
    metas.push({ key: key.toLowerCase().trim(), value, raw: attrs });
  }
  return metas;
}

// ── Extract <link rel="canonical" | "icon"> ──────────────────────────────────
export function extractLinks(html) {
  const clean = stripComments(html);
  const links = [];
  for (const body of scanTags(clean, 'link')) {
    const attrs = parseAttributes(body);
    if (!attrs.rel) continue;
    links.push({ rel: attrs.rel.toLowerCase().trim(), href: attrs.href || '' });
  }
  return links;
}

// ── Top-level: parse everything a preview needs from a page ──────────────────
export function parseHtml(html, { finalUrl = null } = {}) {
  const rawMeta = extractMetaTags(html);
  const links = extractLinks(html);

  const grouped = {};
  for (const t of rawMeta) {
    (grouped[t.key] ||= []).push(t.value);
  }
  const first = (key) => (grouped[key] && grouped[key].length ? grouped[key][0] : null);

  const og = {};
  const twitter = {};
  for (const key of Object.keys(grouped)) {
    if (key.startsWith('og:') || key.startsWith('article:') || key.startsWith('product:') || key.startsWith('fb:') || key === 'og') {
      og[key] = grouped[key].length === 1 ? grouped[key][0] : grouped[key];
    }
    if (key.startsWith('twitter:')) {
      twitter[key] = grouped[key].length === 1 ? grouped[key][0] : grouped[key];
    }
  }

  return {
    finalUrl,
    title: extractTitle(html),
    lang: extractLang(html),
    description: first('description'),
    canonical: (links.find((l) => l.rel === 'canonical') || {}).href || null,
    themeColor: first('theme-color'),
    og,
    twitter,
    schema: extractJsonLd(html),
    grouped,
    links,
    rawMeta,
  };
}

// ── JSON-LD (schema.org) extraction ──────────────────────────────────────────
export function extractJsonLd(html) {
  const clean = stripComments(html);
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const attrs = parseAttributes(m[1]);
    const type = (attrs.type || '').toLowerCase();
    if (type !== 'application/ld+json') continue;
    const text = m[2].trim();
    if (!text) continue;
    try {
      out.push(JSON.parse(text));
    } catch {
      out.push({ __parseError: true, raw: text.slice(0, 200) });
    }
  }
  return out;
}

// ── URL resolution (relative → absolute) ─────────────────────────────────────
export function resolveUrl(href, base) {
  if (!href) return href || null;
  if (!base) return href;
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}
