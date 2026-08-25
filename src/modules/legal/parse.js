// parse.js — pure parsers that turn pasted manifest text into a normalized list
// of { name, version, group } dependency entries. No DOM, no I/O.
//
// Supported inputs:
//   • package.json           (npm — dependencies/devDependencies/etc.)
//   • package-lock.json      (npm v2/v3 lockfile "packages" map)
//   • requirements.txt       (pip)
//   • Pipfile / raw pip freeze / one-name-per-line lists (best effort)

/** Dependency groups we recognize in a package.json. */
export const NPM_GROUPS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

/**
 * Detect which kind of manifest a blob of text is, without throwing.
 * @returns {'package-json'|'package-lock'|'pipfile-lock'|'poetry-lock'|'requirements'|'unknown'}
 */
export function detectFormat(text) {
  if (typeof text !== 'string') return 'unknown';
  const trimmed = text.trim();
  if (!trimmed) return 'unknown';

  if (trimmed[0] === '{') {
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj === 'object') {
        // Pipfile.lock: JSON with _meta + default/develop maps of pinned pip deps.
        if (obj._meta && (obj.default || obj.develop)) {
          return 'pipfile-lock';
        }
        if (obj.lockfileVersion !== undefined || obj.packages || obj.dependencies?.['']) {
          return 'package-lock';
        }
        if (
          NPM_GROUPS.some((g) => obj[g] && typeof obj[g] === 'object') ||
          obj.name !== undefined ||
          obj.version !== undefined
        ) {
          return 'package-json';
        }
        return 'package-json';
      }
    } catch {
      return 'unknown';
    }
  }
  // poetry.lock is TOML with repeated [[package]] tables.
  if (/^\s*\[\[package\]\]/m.test(trimmed)) {
    return 'poetry-lock';
  }
  // Non-JSON text: assume a pip-style requirements list.
  return 'requirements';
}

/** Normalize a raw npm version spec into a plain display string. */
function cleanVersion(spec) {
  if (typeof spec !== 'string') return '';
  return spec.trim();
}

/**
 * Parse a package.json string into dependency entries.
 * Deduplicates by name (first group wins) and preserves the declaring group.
 * @throws {SyntaxError} if the JSON is invalid.
 */
export function parsePackageJson(text) {
  const obj = JSON.parse(text);
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new SyntaxError('package.json must be a JSON object');
  }
  const out = [];
  const seen = new Set();
  for (const group of NPM_GROUPS) {
    const deps = obj[group];
    if (!deps || typeof deps !== 'object') continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (seen.has(name)) continue;
      seen.add(name);
      out.push({ name, version: cleanVersion(spec), group, ecosystem: 'npm' });
    }
  }
  return out;
}

/**
 * Parse an npm package-lock.json (v2/v3) into dependency entries, using the
 * license field baked into the lockfile when present.
 */
export function parsePackageLock(text) {
  const obj = JSON.parse(text);
  const out = [];
  const seen = new Set();
  const pkgs = obj?.packages;
  if (pkgs && typeof pkgs === 'object') {
    for (const [path, info] of Object.entries(pkgs)) {
      if (!path) continue; // "" is the root project
      // path looks like "node_modules/foo" or "node_modules/a/node_modules/b"
      const idx = path.lastIndexOf('node_modules/');
      if (idx === -1) continue;
      const name = path.slice(idx + 'node_modules/'.length);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push({
        name,
        version: info?.version ? String(info.version) : '',
        group: info?.dev ? 'devDependencies' : 'dependencies',
        ecosystem: 'npm',
        declaredLicense: normalizeLicenseField(info?.license),
      });
    }
  }
  return out;
}

/** Turn a package.json/lock `license` field (string or object) into a string. */
export function normalizeLicenseField(field) {
  if (!field) return '';
  if (typeof field === 'string') return field.trim();
  if (typeof field === 'object') {
    if (typeof field.type === 'string') return field.type.trim();
  }
  return '';
}

const REQ_LINE = /^([A-Za-z0-9][A-Za-z0-9._-]*)/;

/**
 * Parse a pip requirements.txt (or freeze output) into entries.
 * Ignores comments, blank lines, -r includes, options, URLs and env markers.
 */
export function parseRequirements(text) {
  const out = [];
  const seen = new Set();
  const lines = String(text).split(/\r?\n/);
  for (let raw of lines) {
    let line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    // Strip inline comments (`pkg==1.0  # note`)
    const hash = line.indexOf(' #');
    if (hash !== -1) line = line.slice(0, hash).trim();
    if (!line) continue;
    // Skip options / includes / editable installs / plain URLs
    if (line.startsWith('-')) continue;
    if (/^(https?|git\+|file:|\.)/i.test(line)) continue;
    // Drop environment markers (`pkg==1; python_version < "3.8"`)
    const semi = line.indexOf(';');
    if (semi !== -1) line = line.slice(0, semi).trim();
    // Drop extras (`pkg[extra]`)
    line = line.replace(/\[[^\]]*\]/, '');

    const m = REQ_LINE.exec(line);
    if (!m) continue;
    const name = m[1];
    const rest = line.slice(m[0].length).trim();
    const version = extractReqVersion(rest);
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, version, group: 'requirements', ecosystem: 'pip' });
  }
  return out;
}

/** Pull a readable version constraint out of the remainder of a req line. */
function extractReqVersion(rest) {
  if (!rest) return '';
  const m = /^(==|>=|<=|~=|!=|>|<|===)\s*([^,\s]+)/.exec(rest);
  if (m) return m[1] + m[2];
  return rest;
}

/**
 * Parse a Pipfile.lock (JSON) into pip dependency entries. Pipfile.lock pins
 * exact versions under `default` (runtime) and `develop` (dev) maps; each value
 * is an object with a `version` like "==1.2.3". It does NOT carry licenses, so
 * these route through the PyPI cache / live resolver like requirements.txt.
 */
export function parsePipfileLock(text) {
  const obj = JSON.parse(text);
  const out = [];
  const seen = new Set();
  const sections = [
    ['default', 'dependencies'],
    ['develop', 'devDependencies'],
  ];
  for (const [section, group] of sections) {
    const deps = obj?.[section];
    if (!deps || typeof deps !== 'object') continue;
    for (const [name, info] of Object.entries(deps)) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      let version = '';
      if (info && typeof info === 'object' && typeof info.version === 'string') {
        version = info.version.trim();
      }
      out.push({ name, version, group, ecosystem: 'pip' });
    }
  }
  return out;
}

/**
 * Parse a poetry.lock (TOML) into pip dependency entries. Poetry lockfiles are
 * a sequence of `[[package]]` tables, each with `name`, `version`, and an
 * optional `category = "dev"`. We do a tiny line-based TOML scan (no dependency)
 * that reads only the fields we need. Licenses are not stored, so entries route
 * through the PyPI cache / live resolver.
 */
export function parsePoetryLock(text) {
  const out = [];
  const seen = new Set();
  const lines = String(text).split(/\r?\n/);
  let cur = null;

  const flush = () => {
    if (cur && cur.name) {
      const key = cur.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          name: cur.name,
          version: cur.version || '',
          group: cur.dev ? 'devDependencies' : 'dependencies',
          ecosystem: 'pip',
        });
      }
    }
    cur = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '[[package]]') {
      flush();
      cur = { name: '', version: '', dev: false };
      continue;
    }
    if (!cur) continue;
    // A new non-package table (e.g. [package.dependencies]) ends the scalar block.
    if (line.startsWith('[') && line !== '[[package]]') {
      // keep cur but stop reading scalars until the next [[package]]
      // (nested tables like [package.source] don't carry name/version/category)
      cur._nested = true;
      continue;
    }
    if (cur._nested) continue;
    const kv = /^([A-Za-z0-9_-]+)\s*=\s*(.+)$/.exec(line);
    if (!kv) continue;
    const k = kv[1];
    let v = kv[2].trim().replace(/^["']|["']$/g, '');
    if (k === 'name') cur.name = v;
    else if (k === 'version') cur.version = v;
    else if (k === 'category') cur.dev = v === 'dev';
  }
  flush();
  return out;
}

/**
 * Top-level dispatcher: detect the format and parse accordingly.
 * Returns { format, entries, error }. Never throws.
 */
export function parseManifest(text, formatHint) {
  const format = formatHint && formatHint !== 'auto' ? formatHint : detectFormat(text);
  try {
    let entries = [];
    if (format === 'package-json') entries = parsePackageJson(text);
    else if (format === 'package-lock') entries = parsePackageLock(text);
    else if (format === 'pipfile-lock') entries = parsePipfileLock(text);
    else if (format === 'poetry-lock') entries = parsePoetryLock(text);
    else if (format === 'requirements') entries = parseRequirements(text);
    else return { format, entries: [], error: 'Unrecognized format. Paste a package.json or requirements.txt.' };
    return { format, entries, error: null };
  } catch (e) {
    return { format, entries: [], error: e instanceof Error ? e.message : String(e) };
  }
}
