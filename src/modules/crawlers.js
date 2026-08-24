// modules/crawlers.js — AI Crawlers & robots.txt check (STUB).
//
// Real logic (later) lives in src/modules/crawlers/*.js and answers: does your
// robots.txt say what you think it says? It parses robots.txt and reports which
// search engines and which AI crawlers (GPTBot, ClaudeBot, Google-Extended,
// PerplexityBot, CCBot, etc.) you are currently allowing or blocking — and
// whether you accidentally blocked everyone.
//
// This stub satisfies the module contract so the whole app wires up green.

import { incompleteResult } from '../contract.js';

const crawlers = {
  id: 'crawlers',
  title: 'AI Crawlers & robots.txt',
  tagline: 'Who can crawl and train on your site? Decide before you go live.',

  /**
   * @param {{ robotsTxt?: string }} [input]
   * @returns {import('../contract.js').ModuleResult}
   */
  run(input) {
    return incompleteResult('Paste your robots.txt to see which search and AI crawlers you allow or block.');
  },

  /** @returns {import('../contract.js').FormSpec} */
  formSpec() {
    return {
      fields: [
        {
          name: 'robotsTxt',
          label: 'Your robots.txt',
          type: 'textarea',
          placeholder: 'Paste the contents of your robots.txt file (or your site URL + /robots.txt).',
          help: 'No robots.txt yet? That is fine — we will tell you what a good starter looks like.',
        },
      ],
      examples: [
        {
          label: 'Block AI training crawlers',
          value: { robotsTxt: 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /' },
        },
      ],
    };
  },
};

export default crawlers;
