// template.js — pure README generator. No DOM. Deterministic output for a given
// input so it is safe to assert in tests and to hand to the user as a one-click
// "copy this whole README" fix.
//
// Adapted from readmekit's generate.js, trimmed to the fields a non-technical
// vibecoder actually answers in the guided form. Sections with no content are
// omitted. User text is placed into Markdown as-is (Markdown, not HTML), except
// the fenced-code guard (fenceFor) which prevents a stray ``` in the user's
// snippet from breaking the block — the same safety readmekit ships.

/** Coerce to trimmed string. */
function str(v) {
  if (typeof v === 'string') return v.trim();
  if (v == null) return '';
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
    return String(v).trim();
  }
  return '';
}

/**
 * Choose a safe fence: if the body contains a run of backticks, use one more
 * backtick than the longest run (min 3). Prevents user code from escaping the
 * code block.
 */
export function fenceFor(body) {
  const runs = String(body == null ? '' : body).match(/`+/g) || [];
  let longest = 0;
  for (const r of runs) longest = Math.max(longest, r.length);
  return '`'.repeat(Math.max(3, longest + 1));
}

/** Build a fenced code block with an optional language hint. */
export function codeBlock(body, lang = '') {
  const fence = fenceFor(body);
  const trimmed = String(body == null ? '' : body).replace(/\s+$/, '');
  return `${fence}${lang}\n${trimmed}\n${fence}`;
}

/** Map a plain-language license answer to a short License-section blurb. */
export function licenseBlurb(license) {
  const raw = str(license).toUpperCase();
  if (!raw || raw === 'NONE' || raw === "DON'T KNOW" || raw === 'DONT KNOW' || raw === 'UNSURE') {
    return {
      name: 'MIT',
      blurb: 'This project is licensed under the MIT License — free to use, modify, and share.',
      suggested: true,
    };
  }
  if (raw === 'MIT') {
    return { name: 'MIT', blurb: 'This project is licensed under the MIT License.', suggested: false };
  }
  if (/APACHE/.test(raw)) {
    return { name: 'Apache-2.0', blurb: 'This project is licensed under the Apache License 2.0.', suggested: false };
  }
  if (/AGPL/.test(raw)) {
    return { name: 'AGPL-3.0', blurb: 'This project is licensed under the GNU AGPL v3.0.', suggested: false };
  }
  if (/GPL/.test(raw)) {
    return { name: 'GPL-3.0', blurb: 'This project is licensed under the GNU GPL v3.0.', suggested: false };
  }
  if (/BSD/.test(raw)) {
    return { name: 'BSD-3-Clause', blurb: 'This project is licensed under the BSD 3-Clause License.', suggested: false };
  }
  // Whatever they typed — use it verbatim.
  return { name: str(license), blurb: `This project is licensed under the ${str(license)} License.`, suggested: false };
}

/**
 * Generate a complete starter README.md string from the guided answers.
 * Input keys (all optional): name, description, install, usage, license.
 * Deterministic and never throws.
 */
export function generateReadme(input) {
  const src = input && typeof input === 'object' ? input : {};
  const name = str(src.name) || 'Your Project';
  const description = str(src.description);
  const install = str(src.install);
  const usage = str(src.usage);
  const lic = licenseBlurb(src.license);

  const out = [];
  out.push(`# ${name}`);

  if (description) {
    out.push('', `> ${description}`);
  } else {
    out.push('', '> One sentence describing what this does and who it is for.');
  }

  out.push('', '## Installation', '');
  out.push(codeBlock(install || 'npm install\nnpm run dev', 'bash'));

  out.push('', '## Usage', '');
  if (usage) {
    out.push(codeBlock(usage, ''));
  } else {
    out.push('Describe how to use it here, with a short example.');
  }

  out.push('', '## License', '', lic.blurb);

  // Collapse extra blank lines and end with a single trailing newline.
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/**
 * Build a small, targeted markdown snippet for a single missing section, so the
 * fix list can offer "add just this" rather than the whole file.
 */
export function sectionSnippet(kind, input) {
  const src = input && typeof input === 'object' ? input : {};
  switch (kind) {
    case 'title':
      return `# ${str(src.name) || 'Your Project'}\n`;
    case 'description':
      return `> ${str(src.description) || 'One sentence describing what this does and who it is for.'}\n`;
    case 'install':
      return ['## Installation', '', codeBlock(str(src.install) || 'npm install\nnpm run dev', 'bash'), ''].join('\n');
    case 'usage':
      return ['## Usage', '', str(src.usage) ? codeBlock(str(src.usage), '') : 'Show a short example of it in action.', ''].join('\n');
    case 'license': {
      const lic = licenseBlurb(src.license);
      return ['## License', '', lic.blurb, ''].join('\n');
    }
    default:
      return '';
  }
}
