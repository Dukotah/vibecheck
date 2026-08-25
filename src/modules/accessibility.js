// modules/accessibility.js — Accessibility check.
//
// Answers, in plain English: will people using screen readers, keyboards, or
// with low vision be able to use this? It scans pasted HTML for the
// high-impact WCAG 2.2 A/AA basics (page language, page title, alt text, form
// labels, a main heading, meaningful link text, pinch-to-zoom, tab order).
//
// The real logic is the pure, node-testable core in
// src/modules/accessibility/analyze.js. run() is a thin, always-safe wrapper
// that normalizes to the module contract and never throws.

import { normalizeResult, incompleteResult } from '../contract.js';
import { analyze } from './accessibility/analyze.js';

const accessibility = {
  id: 'accessibility',
  title: 'Accessibility',
  tagline: 'Can everyone actually use it? Catch the accessibility basics before launch.',

  /**
   * @param {{ html?: string }} [input]
   * @returns {import('../contract.js').ModuleResult}
   */
  run(input) {
    try {
      return normalizeResult(analyze(input));
    } catch {
      // Contract: run() must never throw on any input.
      return incompleteResult('Paste your page HTML to scan for the accessibility basics.');
    }
  },

  /** @returns {import('../contract.js').FormSpec} */
  formSpec() {
    return {
      fields: [
        {
          name: 'html',
          label: 'Your page HTML',
          type: 'textarea',
          placeholder: 'Paste the HTML of your main page (View Source, then copy everything).',
          help: 'We look at the code only. Nothing leaves your browser.',
        },
      ],
      examples: [
        {
          label: 'A page with common problems',
          value: {
            html:
              '<html>\n<head><meta name="viewport" content="width=device-width, user-scalable=no"></head>\n<body>\n  <img src="logo.png">\n  <form>\n    <input type="email" placeholder="Email">\n  </form>\n  <a href="/pricing">click here</a>\n</body>\n</html>',
          },
        },
        {
          label: 'A well-built page (passes)',
          value: {
            html:
              '<html lang="en">\n<head>\n  <title>Recipe Keeper — save your recipes</title>\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n  <h1>Recipe Keeper</h1>\n  <img src="logo.png" alt="Recipe Keeper logo">\n  <form>\n    <label for="email">Email address</label>\n    <input id="email" type="email">\n  </form>\n  <a href="/pricing">See our pricing</a>\n</body>\n</html>',
          },
        },
      ],
    };
  },
};

export default accessibility;
