// modules/accessibility.js — Accessibility check (STUB).
//
// Real logic (later) lives in src/modules/accessibility/*.js and answers: will
// people using screen readers, keyboards, or with low vision be able to use
// this? It scans pasted HTML for the high-impact WCAG basics (alt text, form
// labels, page language, heading order, color-contrast hints, link text).
//
// This stub satisfies the module contract so the whole app wires up green.

import { incompleteResult } from '../contract.js';

const accessibility = {
  id: 'accessibility',
  title: 'Accessibility',
  tagline: 'Can everyone actually use it? Catch the accessibility basics before launch.',

  /**
   * @param {{ html?: string }} [input]
   * @returns {import('../contract.js').ModuleResult}
   */
  run(input) {
    return incompleteResult('Paste your page HTML to scan for the accessibility basics.');
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
          label: 'A tiny page with an unlabeled image',
          value: { html: '<html><body><img src="logo.png"><h1>Hi</h1></body></html>' },
        },
      ],
    };
  },
};

export default accessibility;
