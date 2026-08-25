// analyze.js — pure README analysis. No DOM, no I/O, never throws.
//
// Adapted from readmekit's critique/completeness logic, but instead of scoring a
// structured project object, it reads a *pasted README string* the way a
// non-technical vibecoder would have it, and answers: "if a stranger lands on
// this project, can they tell what it is, install it, run it, and know the
// license?"
//
// The heart is detectSections(readme) -> a boolean map of the essentials, plus
// wordCount/heading helpers. checkReadme() turns that into findings + a 0..100
// score. All functions tolerate undefined/null/non-string input.

/** Coerce any value to a string safely (null/undefined/objects -> ''). */
export function toText(v) {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
    return String(v);
  }
  return '';
}

/** Count words in a value. Non-strings count as 0. */
export function wordCount(v) {
  const t = toText(v).trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

/** Count non-blank lines. */
export function lineCount(v) {
  return toText(v)
    .split(/\r?\n/)
    .filter((l) => l.trim()).length;
}

/**
 * Extract markdown headings as { level, text } in document order. A heading is
 * an ATX heading (`#`..`######`). Fenced code blocks are ignored so a `#` inside
 * a shell snippet is not mistaken for a heading.
 */
export function extractHeadings(readme) {
  const text = toText(readme);
  const lines = text.split(/\r?\n/);
  const headings = [];
  let inFence = false;
  let fenceMark = '';
  for (const raw of lines) {
    const line = raw.replace(/\t/g, '  ');
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const mark = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceMark = mark;
      } else if (mark === fenceMark) {
        inFence = false;
        fenceMark = '';
      }
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) {
      headings.push({ level: m[1].length, text: m[2].trim() });
    }
  }
  return headings;
}

/** The first H1 (`# Title`) text, or '' if none. */
export function firstTitle(readme) {
  const h = extractHeadings(readme).find((x) => x.level === 1);
  return h ? h.text : '';
}

/**
 * Does the README contain at least one fenced code block with content?
 *
 * Implemented as a linear line-by-line scan rather than a single regex with a
 * `\1` backreference. The old regex `/(```+|~~~+)[^\n]*\n([\s\S]*?)\n\1/` was
 * vulnerable to catastrophic backtracking (ReDoS): a long unbroken run of
 * backticks with no newline made the engine try every split of the run as the
 * opening fence, hanging the browser tab on hostile/accidental input. This scan
 * is O(n) and never backtracks.
 */
export function hasCodeBlock(readme) {
  const text = toText(readme);
  const lines = text.split(/\r?\n/);
  let openFence = null; // the ``` or ~~~ run that opened the current block
  let sawContent = false;
  for (const line of lines) {
    const fenceMatch = /^\s*(```+|~~~+)/.exec(line);
    if (fenceMatch) {
      const mark = fenceMatch[1][0];
      if (openFence === null) {
        openFence = mark; // opening fence
        sawContent = false;
      } else if (mark === openFence) {
        // Closing fence: a block with any non-blank content counts.
        if (sawContent) return true;
        openFence = null;
      }
      continue;
    }
    if (openFence !== null && line.trim()) sawContent = true;
  }
  // Indented code block: 4+ leading spaces on a non-empty line following a blank.
  return /(^|\n)[ \t]*\n {4,}\S/.test(text);
}

/** Does the README contain a shields.io / badge image? */
export function hasBadge(readme) {
  const text = toText(readme);
  return /!\[[^\]]*\]\(https?:\/\/[^)]*(shields\.io|badge|img\.shields|badgen)[^)]*\)/i.test(
    text,
  );
}

/** Does the README embed any image (screenshot / demo / badge)? */
export function hasImage(readme) {
  return /!\[[^\]]*\]\([^)]+\)/.test(toText(readme));
}

/** Heading keyword banks. A section is present if any heading matches. */
const SECTION_KEYWORDS = {
  install: [
    'install',
    'installation',
    'setup',
    'set up',
    'getting started',
    'get started',
    'quick start',
    'quickstart',
    'run locally',
    'running locally',
    'prerequisites',
    'requirements',
  ],
  usage: [
    'usage',
    'how to use',
    'using',
    'example',
    'examples',
    'getting started',
    'quick start',
    'quickstart',
    'demo',
    'api',
    'commands',
  ],
  license: ['license', 'licence', 'licensing'],
  contributing: ['contributing', 'contribute', 'development', 'developing'],
};

function headingMatches(headings, keywords) {
  return headings.some((h) => {
    const t = h.text.toLowerCase();
    return keywords.some((k) => t.includes(k));
  });
}

/**
 * Detect the essential parts of a README. Returns a map of booleans plus a few
 * useful primitives. Heuristics are intentionally forgiving of the messy,
 * AI-generated READMEs vibecoders actually paste.
 */
export function detectSections(readme) {
  const text = toText(readme);
  const headings = extractHeadings(text);
  const title = firstTitle(text);
  const words = wordCount(text);

  // A description = meaningful prose near the top that is not just the title.
  // Use total prose length as a proxy: a title-only README has almost no words.
  const bodyWords = words - wordCount(title);

  // License can be declared in a heading OR mentioned inline (very common:
  // "Licensed under MIT" / "MIT License" with no heading).
  const licenseHeading = headingMatches(headings, SECTION_KEYWORDS.license);
  const licenseInline =
    /\b(mit|apache(\s|-)?2|apache license|gpl|agpl|bsd|mpl|isc|unlicense|mozilla public)\b[^\n]{0,40}\b(licen[sc]e)?\b/i.test(
      text,
    ) && /licen[sc]e|licensed|unlicense/i.test(text);

  // Install/usage can live under a heading, or a top-level project with no
  // headings at all may still show a code block that is effectively usage.
  const installHeading = headingMatches(headings, SECTION_KEYWORDS.install);
  const usageHeading = headingMatches(headings, SECTION_KEYWORDS.usage);
  const code = hasCodeBlock(text);
  const mentionsInstallCmd = /\b(npm install|npm i |yarn add|yarn install|pnpm add|pip install|poetry add|cargo add|go get|bundle install|composer require|git clone)\b/i.test(
    text,
  );

  return {
    empty: words === 0,
    hasTitle: !!title,
    title,
    words,
    bodyWords,
    headingCount: headings.length,
    hasDescription: bodyWords >= 12,
    hasInstall: installHeading || mentionsInstallCmd,
    hasUsage: usageHeading || (code && !installHeading) || (code && usageHeading),
    hasCode: code,
    hasLicense: licenseHeading || licenseInline,
    hasContributing: headingMatches(headings, SECTION_KEYWORDS.contributing),
    hasBadge: hasBadge(text),
    hasImage: hasImage(text),
  };
}

// Weights for each essential toward the readiness score. Sum = 100.
const WEIGHTS = {
  hasTitle: 15,
  hasDescription: 20,
  hasInstall: 20,
  hasUsage: 20,
  hasLicense: 15,
  extras: 10, // any one of: image/screenshot, badge, contributing
};

/**
 * Analyze a pasted README into a normalized report:
 * { empty, score, sections, findings, missing[] }.
 * Never throws. `findings` are { level, text } objects matching the VibeCheck
 * finding shape. `missing` lists the essential keys that are absent.
 */
export function checkReadme(readme) {
  const s = detectSections(readme);
  const findings = [];
  const missing = [];

  if (s.empty) {
    return {
      empty: true,
      score: 0,
      sections: s,
      missing: ['hasTitle', 'hasDescription', 'hasInstall', 'hasUsage', 'hasLicense'],
      findings: [],
    };
  }

  let score = 0;

  // Title.
  if (s.hasTitle) {
    score += WEIGHTS.hasTitle;
    findings.push({ level: 'good', text: `Has a clear title ("${clip(s.title)}").` });
  } else {
    missing.push('hasTitle');
    findings.push({
      level: 'bad',
      text: 'No title heading. Start the README with "# Your Project Name" so people know what this is.',
    });
  }

  // Description.
  if (s.hasDescription) {
    score += WEIGHTS.hasDescription;
    findings.push({ level: 'good', text: 'Explains what the project is in a sentence or two.' });
  } else {
    missing.push('hasDescription');
    findings.push({
      level: 'bad',
      text: 'Almost no description. Add a line or two saying what it does and who it is for.',
    });
  }

  // Install.
  if (s.hasInstall) {
    score += WEIGHTS.hasInstall;
    findings.push({ level: 'good', text: 'Tells people how to install or set it up.' });
  } else {
    missing.push('hasInstall');
    findings.push({
      level: 'bad',
      text: 'No install or setup steps. A stranger cannot get it running. Add an "Installation" section.',
    });
  }

  // Usage.
  if (s.hasUsage) {
    score += WEIGHTS.hasUsage;
    findings.push({ level: 'good', text: 'Shows how to actually use it (a usage section or example).' });
  } else {
    missing.push('hasUsage');
    findings.push({
      level: 'bad',
      text: 'No usage example. A working snippet is the single highest-impact section. Add one.',
    });
  }

  // License.
  if (s.hasLicense) {
    score += WEIGHTS.hasLicense;
    findings.push({ level: 'good', text: 'Mentions a license so people know if they can use it.' });
  } else {
    missing.push('hasLicense');
    findings.push({
      level: 'warn',
      text: 'No license mentioned. Without one, "all rights reserved" applies. Add a License section (MIT is a common choice).',
    });
  }

  // Extras: any one of image/badge/contributing earns the extras bucket.
  const extras = [];
  if (s.hasImage) extras.push('a screenshot or image');
  if (s.hasBadge) extras.push('status badges');
  if (s.hasContributing) extras.push('a Contributing section');
  if (extras.length) {
    score += WEIGHTS.extras;
    findings.push({ level: 'good', text: `Nice extras: ${extras.join(', ')}.` });
  } else {
    findings.push({
      level: 'warn',
      text: 'No screenshot, badges, or Contributing section. A screenshot alone makes a project look far more trustworthy.',
    });
  }

  if (score > 100) score = 100;
  if (score < 0) score = 0;

  return { empty: false, score, sections: s, missing, findings };
}

function clip(s, n = 60) {
  const t = toText(s).trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}
