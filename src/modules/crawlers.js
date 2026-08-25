// modules/crawlers.js — AI Crawlers & robots.txt check.
//
// Answers, in plain English for a non-technical vibecoder: "which AI bots can
// read and train on my site, and does my robots.txt actually keep out the ones
// I want to keep out?" The user ticks which groups of AI bots they want to
// block and (optionally) pastes their current robots.txt. We diff intent vs.
// reality and hand back a paste-ready robots.txt.
//
// All real logic is in the pure, node-testable files under ./crawlers/*.js.
// run() just wraps analyze() and normalizes the result.

import { normalizeResult, incompleteResult } from '../contract.js';
import { analyze } from './crawlers/analyze.js';
import { generateRobotsTxt } from './crawlers/generate.js';
import { idsInCategory } from './crawlers/data.js';

const crawlers = {
  id: 'crawlers',
  title: 'AI Crawlers & robots.txt',
  tagline: 'Who can crawl and train on your site? Decide before you go live.',

  /**
   * @param {{ blockTraining?: boolean, blockAssistants?: boolean,
   *           blockSearchAi?: boolean, robotsTxt?: string }} [input]
   * @returns {import('../contract.js').ModuleResult}
   */
  run(input) {
    try {
      return normalizeResult(analyze(input));
    } catch {
      // Contract: run() must never throw on any input.
      return incompleteResult(
        'Tell us which AI bots you want to keep out (or paste your robots.txt) and we will check it for you.',
      );
    }
  },

  /** @returns {import('../contract.js').FormSpec} */
  formSpec() {
    return {
      fields: [
        {
          name: 'blockTraining',
          label: 'Keep AI training bots out (GPTBot, ClaudeBot, CCBot, and friends)',
          type: 'checkbox',
          help: 'These bots copy your pages to help train AI models. Tick this if you would rather they did not.',
        },
        {
          name: 'blockAssistants',
          label: 'Keep AI assistants & answer bots out (ChatGPT, Perplexity, and friends)',
          type: 'checkbox',
          help: 'These bots read your site to answer questions inside a chatbot. Blocking them means your site will not show up in those answers.',
        },
        {
          name: 'blockSearchAi',
          label: 'Opt out of Google & Apple AI training, but stay in normal search',
          type: 'checkbox',
          help: 'The safe middle ground: Google and Apple keep listing you in search, but stop using your content to train their AI.',
        },
        {
          name: 'robotsTxt',
          label: 'Your current robots.txt (optional)',
          type: 'textarea',
          placeholder: 'Paste the contents of your robots.txt file here. No file yet? Leave this blank and we will make you one.',
          help: 'This is the file at yoursite.com/robots.txt. If you built with Bolt/Lovable/v0/Replit you probably do not have one yet — that is fine.',
        },
      ],
      examples: [
        {
          label: 'I have no robots.txt and want to block AI training',
          value: { blockTraining: true, robotsTxt: '' },
        },
        {
          label: 'My robots.txt already blocks GPTBot',
          value: {
            blockTraining: true,
            robotsTxt: generateRobotsTxt(idsInCategory('training')),
          },
        },
        {
          label: 'Oops — I blocked every crawler including Google',
          value: {
            robotsTxt: 'User-agent: *\nDisallow: /',
          },
        },
      ],
    };
  },
};

export default crawlers;
