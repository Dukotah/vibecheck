// modules/docs.js — README & Docs check.
//
// Answers, in plain English: if a stranger (or future-you) lands on this
// project, can they figure out what it is, install it, run it, and know the
// license? The user can PASTE their existing README to score it, or answer a
// few guided questions and we hand back a ready-to-paste starter README.
//
// Pure core logic lives in src/modules/docs/analyze.js (scoring a pasted README)
// and src/modules/docs/template.js (generating README markdown). run() here is
// a thin, always-safe wrapper; it never throws and always returns a normalized
// result via normalizeResult().

import { normalizeResult, incompleteResult, clampScore } from '../contract.js';
import { checkReadme, toText } from './docs/analyze.js';
import { generateReadme, sectionSnippet } from './docs/template.js';

// Human labels for the missing-section keys the analyzer reports.
const MISSING_LABEL = {
  hasTitle: 'a title',
  hasDescription: 'a description',
  hasInstall: 'install steps',
  hasUsage: 'a usage example',
  hasLicense: 'a license',
};

// Map an analyzer missing key to the template's snippet kind.
const MISSING_TO_KIND = {
  hasTitle: 'title',
  hasDescription: 'description',
  hasInstall: 'install',
  hasUsage: 'usage',
  hasLicense: 'license',
};

/** Did the user supply any guided answer (the README-generator path)? */
function hasGuidedInput(i) {
  return !!(toText(i.name) || toText(i.description) || toText(i.install) || toText(i.usage) || toText(i.license));
}

const docs = {
  id: 'docs',
  title: 'README & Docs',
  tagline: 'Can a stranger understand and run your project? Score your README.',

  /**
   * @param {{ readme?: string, name?: string, description?: string,
   *           install?: string, usage?: string, license?: string }} [input]
   * @returns {import('../contract.js').ModuleResult}
   */
  run(input) {
    const i = input && typeof input === 'object' ? input : {};
    const readme = toText(i.readme).trim();

    // Nothing to check yet → neutral, excluded from the score average.
    if (!readme && !hasGuidedInput(i)) {
      return incompleteResult(
        'Paste your README to score it, or answer a few questions and we will write a starter README for you.',
      );
    }

    // Path A: they pasted a README — score it for real.
    if (readme) {
      const report = checkReadme(readme);

      if (report.empty) {
        // Whitespace-only paste, but they may still have guided answers.
        if (!hasGuidedInput(i)) {
          return incompleteResult('That README looks empty. Paste some content, or answer the questions below.');
        }
      } else {
        const score = clampScore(report.score);
        const status = score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail';
        const missingLabels = report.missing.map((k) => MISSING_LABEL[k]).filter(Boolean);

        const summary =
          status === 'pass'
            ? 'Your README covers the essentials a newcomer needs.'
            : status === 'warn'
              ? `Your README is a decent start but is missing ${listPhrase(missingLabels)}.`
              : `Your README is missing ${listPhrase(missingLabels)} — a stranger could not get it running.`;

        // Build fixes: one paste-ready snippet per missing essential, plus a
        // whole-file starter if things are rough. copyText is plain markdown
        // text (rendered via textContent by the shell — XSS-safe).
        const fixes = [];
        for (const key of report.missing) {
          const kind = MISSING_TO_KIND[key];
          if (!kind) continue;
          fixes.push({
            label: `Add ${MISSING_LABEL[key]} to your README`,
            copyText: sectionSnippet(kind, i),
          });
        }
        if (score < 50) {
          fixes.push({
            label: 'Or replace the whole thing with a clean starter README',
            copyText: generateReadme(i),
          });
        }

        return normalizeResult({ status, score, summary, findings: report.findings, fixes });
      }
    }

    // Path B: no (usable) README, but guided answers exist → generate one and
    // score those answers as if they were the README.
    const generated = generateReadme(i);
    const report = checkReadme(generated);
    const score = clampScore(report.score);
    const status = score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail';

    const findings = [
      {
        level: 'good',
        text: 'You do not have a README yet — we generated one from your answers. Copy it below.',
      },
    ];
    // Note which answers were thin so they know what to flesh out.
    const missingLabels = report.missing.map((k) => MISSING_LABEL[k]).filter(Boolean);
    if (missingLabels.length) {
      findings.push({
        level: 'warn',
        text: `Still light on ${listPhrase(missingLabels)} — fill those in for a stronger README.`,
      });
    }

    return normalizeResult({
      status,
      score,
      summary: 'No README found, so we wrote a starter one from your answers. Copy it and drop it in as README.md.',
      findings,
      fixes: [
        { label: 'Copy your new README.md', copyText: generated },
      ],
    });
  },

  /** @returns {import('../contract.js').FormSpec} */
  formSpec() {
    return {
      fields: [
        {
          name: 'readme',
          label: 'Your README (paste it here)',
          type: 'textarea',
          placeholder: 'Open your README.md file, copy everything, and paste it here.',
          help: 'This is the text file people see first on your GitHub or project page. No README yet? Leave this blank and answer the questions below — we will write one for you.',
        },
        {
          name: 'name',
          label: 'What is your project called?',
          type: 'text',
          placeholder: 'e.g. Recipe Keeper',
          help: 'The name people will see at the top.',
        },
        {
          name: 'description',
          label: 'In one sentence, what does it do?',
          type: 'text',
          placeholder: 'e.g. A simple app to save and organize your favorite recipes.',
          help: 'Say what it does and who it is for. This is the first thing visitors read.',
        },
        {
          name: 'install',
          label: 'How does someone set it up?',
          type: 'textarea',
          placeholder: 'e.g.\nnpm install\nnpm run dev',
          help: 'The commands to get it running. Not sure? Leave it blank and we will fill in the usual ones.',
        },
        {
          name: 'usage',
          label: 'How do people use it?',
          type: 'textarea',
          placeholder: 'e.g. Open http://localhost:3000 and click "New Recipe" to get started.',
          help: 'A short example of it in action. This is the most valuable part of a README.',
        },
        {
          name: 'license',
          label: 'Which license? (optional)',
          type: 'text',
          placeholder: 'e.g. MIT',
          help: 'Not sure? Type MIT — it is the most common and lets others use your project freely.',
        },
      ],
      examples: [
        {
          label: 'A bare one-line README (needs work)',
          value: { readme: '# My App\n\nA thing I built.' },
        },
        {
          label: 'A solid README (passes)',
          value: {
            readme:
              '# Recipe Keeper\n\n> A simple app to save and organize your favorite recipes.\n\n## Installation\n\n```bash\nnpm install\nnpm run dev\n```\n\n## Usage\n\nOpen http://localhost:3000 and click "New Recipe".\n\n## License\n\nMIT',
          },
        },
        {
          label: 'No README — build one from answers',
          value: {
            name: 'Recipe Keeper',
            description: 'A simple app to save and organize your favorite recipes.',
            install: 'npm install\nnpm run dev',
            usage: 'Open http://localhost:3000 and click "New Recipe".',
            license: 'MIT',
          },
        },
      ],
    };
  },
};

/** Join a list into a natural phrase: [a] -> "a"; [a,b] -> "a and b"; more -> "a, b and c". */
function listPhrase(items) {
  const xs = items.filter(Boolean);
  if (xs.length === 0) return 'a few things';
  if (xs.length === 1) return xs[0];
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

export default docs;
