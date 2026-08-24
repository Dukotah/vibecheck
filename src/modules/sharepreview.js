// modules/sharepreview.js — Social Share Preview check (STUB).
//
// Real logic (later) lives in src/modules/sharepreview/*.js and answers: when
// someone drops your link in iMessage, Slack, X, LinkedIn, or Discord, does it
// show a nice card — or a naked URL? It reads the Open Graph and Twitter Card
// meta tags from pasted <head> HTML and reports what each platform will show.
//
// This stub satisfies the module contract so the whole app wires up green.

import { incompleteResult } from '../contract.js';

const sharepreview = {
  id: 'sharepreview',
  title: 'Social Share Preview',
  tagline: 'What shows when someone shares your link? Make it look intentional.',

  /**
   * @param {{ headHtml?: string }} [input]
   * @returns {import('../contract.js').ModuleResult}
   */
  run(input) {
    return incompleteResult('Paste your page <head> HTML to preview how your link looks when shared.');
  },

  /** @returns {import('../contract.js').FormSpec} */
  formSpec() {
    return {
      fields: [
        {
          name: 'headHtml',
          label: 'Your page HTML (or just the <head>)',
          type: 'textarea',
          placeholder: 'Paste your HTML. We only need the <head> with your <meta> and <title> tags.',
          help: 'These tags control the title, description, and image in the link preview card.',
        },
      ],
      examples: [
        {
          label: 'A page missing all social tags',
          value: { headHtml: '<head><title>My App</title></head>' },
        },
      ],
    };
  },
};

export default sharepreview;
