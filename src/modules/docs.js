// modules/docs.js — README & Docs check (STUB).
//
// Real logic (later) lives in src/modules/docs/*.js and answers: if a stranger
// (or a future you) lands on this project, can they figure out what it is,
// install it, and run it? It scores a pasted README for the essentials: a
// title, a one-line description, install steps, usage, and a license mention.
//
// This stub satisfies the module contract so the whole app wires up green.

import { incompleteResult } from '../contract.js';

const docs = {
  id: 'docs',
  title: 'README & Docs',
  tagline: 'Can a stranger understand and run your project? Score your README.',

  /**
   * @param {{ readme?: string }} [input]
   * @returns {import('../contract.js').ModuleResult}
   */
  run(input) {
    return incompleteResult('Paste your README to score it for the essentials people expect.');
  },

  /** @returns {import('../contract.js').FormSpec} */
  formSpec() {
    return {
      fields: [
        {
          name: 'readme',
          label: 'Your README',
          type: 'textarea',
          placeholder: 'Paste the contents of your README.md file.',
          help: 'No README yet? We will give you a starter template you can copy.',
        },
      ],
      examples: [
        {
          label: 'A one-line README',
          value: { readme: '# My App\n\nA thing I built.' },
        },
      ],
    };
  },
};

export default docs;
