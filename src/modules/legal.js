// modules/legal.js — Legal & Licenses check.
//
// Answers, in plain English: can this vibecoder legally ship what they built?
// It looks at two things:
//   1. Does the project have a clear license of its own? (No license = nobody,
//      including future you, can legally reuse it — "all rights reserved".)
//   2. Are the open-source libraries it pulled in safe to ship? (No copyleft
//      surprises that force your code open, no "no license" packages.)
//
// The real logic lives in the pure files under src/modules/legal/*.js, which are
// adapted from the tested LicenseGuard cores. run() just wraps them and passes
// the result through the shared normalizer so the shape is always contract-valid.

import { normalizeResult } from '../contract.js';
import { analyze } from './legal/analyze.js';

const legal = {
  id: 'legal',
  title: 'Legal & Licenses',
  tagline: 'Can you legally ship this? Check your license and your dependencies.',

  /**
   * @param {{ licenseText?: string, packages?: string }} [input]
   * @returns {import('../contract.js').ModuleResult}
   */
  run(input) {
    try {
      return normalizeResult(analyze(input));
    } catch {
      // Defensive: the contract says run() must never throw on any input.
      return normalizeResult({
        status: 'incomplete',
        score: 0,
        summary:
          'Paste your LICENSE file and your dependency list (package.json or requirements.txt) to check for legal blockers.',
        findings: [],
        fixes: [],
      });
    }
  },

  /** @returns {import('../contract.js').FormSpec} */
  formSpec() {
    return {
      fields: [
        {
          name: 'licenseText',
          label: 'Your LICENSE file',
          type: 'textarea',
          placeholder:
            'Paste the contents of your LICENSE file here.\n\nDo not have one? Leave this blank and we will hand you a ready-to-use one.',
          help: 'Look in your project for a file named LICENSE (no extension). If there is not one, that is exactly what we want to catch.',
        },
        {
          name: 'packages',
          label: 'Your dependency list',
          type: 'textarea',
          placeholder:
            'Paste the whole contents of your package.json (JavaScript) or requirements.txt (Python).',
          help: 'This is the list of outside libraries your app uses. Some of them carry license terms that can quietly block a launch. We check every one.',
        },
      ],
      examples: [
        {
          label: 'MIT project, all-safe deps',
          value: {
            licenseText:
              'MIT License\n\nCopyright (c) 2026 You\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software...',
            packages: JSON.stringify(
              { name: 'my-app', dependencies: { react: '^18.2.0', express: '^4.18.2', zod: '^3.22.0' } },
              null,
              2,
            ),
          },
        },
        {
          label: 'No license + a risky dependency',
          value: {
            licenseText: '',
            packages: JSON.stringify(
              { name: 'my-app', dependencies: { react: '^18.2.0', ghostscript4js: '^3.2.0' } },
              null,
              2,
            ),
          },
        },
        {
          label: 'Python (requirements.txt)',
          value: {
            licenseText: 'MIT License\n\nCopyright (c) 2026 You',
            packages: 'fastapi==0.110.0\nrequests>=2.31.0\nPyQt5==5.15.10\nmysqlclient==2.2.0\n',
          },
        },
      ],
    };
  },
};

export default legal;
