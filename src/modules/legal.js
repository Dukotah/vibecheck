// modules/legal.js — Legal & Licenses check (STUB).
//
// Real logic (later) lives in src/modules/legal/*.js and answers: does the
// project have a clear license, and are the open-source dependencies it pulled
// in safe to ship (no copyleft surprises, no "no license" packages)?
//
// This stub satisfies the module contract so the whole app wires up green.

import { incompleteResult } from '../contract.js';

const legal = {
  id: 'legal',
  title: 'Legal & Licenses',
  tagline: 'Can you legally ship this? Check your license and your dependencies.',

  /**
   * @param {{ licenseText?: string, packages?: string }} [input]
   * @returns {import('../contract.js').ModuleResult}
   */
  run(input) {
    return incompleteResult(
      'Paste your LICENSE file (or say you have none) and your package list to check for legal blockers.',
    );
  },

  /** @returns {import('../contract.js').FormSpec} */
  formSpec() {
    return {
      fields: [
        {
          name: 'licenseText',
          label: 'Your LICENSE file text',
          type: 'textarea',
          placeholder: 'Paste the contents of your LICENSE file, or leave blank if you do not have one.',
          help: 'Not sure? Look for a file named LICENSE in your project.',
        },
        {
          name: 'packages',
          label: 'Your dependencies',
          type: 'textarea',
          placeholder: 'Paste your package.json, requirements.txt, or a list of libraries you used.',
          help: 'This tells us if any library you used has license terms that could block a launch.',
        },
      ],
      examples: [
        {
          label: 'MIT license, no dependencies',
          value: { licenseText: 'MIT License\n\nCopyright (c) 2026 You', packages: '' },
        },
      ],
    };
  },
};

export default legal;
