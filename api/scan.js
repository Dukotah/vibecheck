// api/scan.js — fetch a public page (and its robots.txt) so VibeCheck can check
// a live site instead of making the user View Source and copy/paste.
//
// This is the ONLY network call VibeCheck ever makes. It is deliberately small
// and deliberately paranoid:
//   - http/https only, no credentials in the URL, no non-standard ports
//   - every hop of a redirect chain is re-validated (no redirect to localhost)
//   - the hostname is resolved and rejected if it lands on a private/loopback/
//     link-local/CGNAT range (SSRF defense)
//   - hard timeout, hard byte cap, at most 5 redirects
//   - nothing is stored or logged: we read the page, hand it back, forget it
//
// Runs on Vercel's Node runtime. No dependencies.

import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 1_500_000; // ~1.5MB of HTML is far more than any real page
const MAX_ROBOTS_BYTES = 100_000;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const UA = 'VibeCheck/2.0 (+https://vibecheck.copperbaytech.com; launch readiness checker)';

/** Private / reserved IP ranges we refuse to fetch from. */
export function isBlockedIp(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p[0] === 0) return true; // 0.0.0.0/8
    if (p[0] === 10) return true; // private
    if (p[0] === 127) return true; // loopback
    if (p[0] === 169 && p[1] === 254) return true; // link-local + cloud metadata
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT
    if (p[0] === 192 && p[1] === 0 && p[2] === 0) return true;
    if (p[0] >= 224) return true; // multicast + reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::' || v === '::1') return true;
    if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true;
    if (v.startsWith('::ffff:')) return isBlockedIp(v.slice(7)); // IPv4-mapped
    return false;
  }
  return true;
}

/**
 * Parse + validate a candidate URL. Throws a user-readable Error on refusal.
 * @param {string} raw
 * @returns {URL}
 */
export function parseTarget(raw) {
  const text = String(raw || '').trim();
  if (!text) throw new Error('No address given.');
  if (text.length > 2000) throw new Error('That address is too long.');

  let u;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    throw new Error('That does not look like a web address.');
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Only http and https addresses can be checked.');
  }
  if (u.username || u.password) {
    throw new Error('Addresses with a username or password are not allowed.');
  }
  if (u.port && !['', '80', '443', '8080', '3000'].includes(u.port)) {
    throw new Error('Only the standard web ports can be checked.');
  }

  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new Error('That address points at a private machine, so it cannot be checked from here.');
  }
  if (!host.includes('.') && !net.isIP(host)) {
    throw new Error('That does not look like a public web address.');
  }
  if (net.isIP(host) && isBlockedIp(host)) {
    throw new Error('That address points at a private network, so it cannot be checked from here.');
  }
  return u;
}

/** Resolve the hostname and refuse private destinations. */
async function assertPublicHost(u) {
  const host = u.hostname;
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new Error('That address points at a private network.');
    return;
  }
  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new Error(`We could not find a site at ${host}.`);
  }
  if (!addrs.length) throw new Error(`We could not find a site at ${host}.`);
  for (const a of addrs) {
    if (isBlockedIp(a.address)) {
      throw new Error('That address resolves to a private network, so it cannot be checked from here.');
    }
  }
}

/** Read a response body with a hard byte cap. */
async function readCapped(res, cap) {
  const reader = res.body && res.body.getReader ? res.body.getReader() : null;
  if (!reader) {
    const text = await res.text();
    return { text: text.slice(0, cap), truncated: text.length > cap };
  }
  const chunks = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > cap) {
      chunks.push(value.subarray(0, value.length - (total - cap)));
      truncated = true;
      try {
        await reader.cancel();
      } catch {
        /* already closing */
      }
      break;
    }
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return { text: buf.toString('utf8'), truncated };
}

/**
 * Fetch a URL, following redirects manually so every hop gets validated.
 * @returns {Promise<{ res: Response, finalUrl: URL }>}
 */
async function safeFetch(startUrl, accept) {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicHost(current);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(current.toString(), {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'user-agent': UA, accept },
      });
    } catch (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') throw new Error('That site took too long to answer.');
      throw new Error('We could not reach that address.');
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { res, finalUrl: current };
      let next;
      try {
        next = new URL(loc, current);
      } catch {
        throw new Error('That site sent us somewhere invalid.');
      }
      current = parseTarget(next.toString());
      continue;
    }
    return { res, finalUrl: current };
  }
  throw new Error('That site redirected too many times.');
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return send(res, 405, { error: 'Use GET.' });
  }
  const raw =
    (req.query && req.query.url) ||
    (req.body && typeof req.body === 'object' && req.body.url) ||
    '';

  let target;
  try {
    target = parseTarget(Array.isArray(raw) ? raw[0] : raw);
  } catch (err) {
    return send(res, 400, { error: err.message });
  }

  // --- the page itself -----------------------------------------------------
  let page;
  try {
    page = await safeFetch(target, 'text/html,application/xhtml+xml');
  } catch (err) {
    return send(res, 502, { error: err.message });
  }

  if (page.res.status >= 400) {
    return send(res, 502, {
      error: `That address answered with an error (HTTP ${page.res.status}). Double-check the link is live and public.`,
    });
  }

  const ctype = (page.res.headers.get('content-type') || '').toLowerCase();
  if (ctype && !ctype.includes('html') && !ctype.includes('xml') && !ctype.includes('text/plain')) {
    return send(res, 415, {
      error: 'That address is not a web page — VibeCheck checks pages, not files.',
    });
  }

  const { text: html, truncated } = await readCapped(page.res, MAX_BYTES);
  if (!html.trim()) {
    return send(res, 502, {
      error:
        'That page came back empty. If it renders with JavaScript only, paste your HTML instead.',
    });
  }

  // --- robots.txt on the same origin --------------------------------------
  let robotsTxt = '';
  let robotsFound = false;
  try {
    const robotsUrl = new URL('/robots.txt', page.finalUrl);
    const r = await safeFetch(robotsUrl, 'text/plain');
    if (r.res.status >= 200 && r.res.status < 300) {
      const rtype = (r.res.headers.get('content-type') || '').toLowerCase();
      const body = await readCapped(r.res, MAX_ROBOTS_BYTES);
      // Some hosts answer 200 with an HTML 404 page. Treat that as "no robots.txt".
      const looksHtml = rtype.includes('html') || /^\s*<(!doctype|html)/i.test(body.text);
      if (!looksHtml && body.text.trim()) {
        robotsTxt = body.text;
        robotsFound = true;
      }
    }
  } catch {
    // No robots.txt is a normal, meaningful answer — not an error.
  }

  return send(res, 200, {
    finalUrl: page.finalUrl.toString(),
    status: page.res.status,
    html,
    truncated,
    robotsTxt,
    robotsFound,
  });
}
