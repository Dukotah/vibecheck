// modules/sharepreview.js — Social Share Preview check.
//
// When someone drops your link in iMessage, Slack, X, LinkedIn, Facebook, or
// Discord, does it show a nice card — or a naked URL? This reads the Open Graph
// and Twitter Card meta tags from pasted <head> HTML and reports what each app
// will show, then hands the user paste-ready corrected tags.
//
// Pure core logic lives in src/modules/sharepreview/*.js (adapted from the
// ogpreview tool). run() wraps it and normalizes to the module contract.

import { normalizeResult } from '../contract.js';
import { checkSharePreview } from './sharepreview/check.js';

const sharepreview = {
  id: 'sharepreview',
  title: 'Social Share Preview',
  tagline: 'What shows when someone shares your link? Make it look intentional.',

  /**
   * @param {{ headHtml?: string, pageUrl?: string }} [input]
   * @returns {import('../contract.js').ModuleResult}
   */
  run(input) {
    const src = input && typeof input === 'object' ? input : {};
    const headHtml = typeof src.headHtml === 'string' ? src.headHtml : '';
    const pageUrl = typeof src.pageUrl === 'string' ? src.pageUrl : '';
    let raw;
    try {
      raw = checkSharePreview(headHtml, pageUrl);
    } catch {
      // Contract requires run() never throws. Fall back to neutral.
      raw = {
        status: 'incomplete',
        score: 0,
        summary: 'Paste your page <head> HTML to preview how your link looks when shared.',
        findings: [],
        fixes: [],
      };
    }
    return normalizeResult(raw);
  },

  /** @returns {import('../contract.js').FormSpec} */
  formSpec() {
    return {
      fields: [
        {
          name: 'headHtml',
          label: 'Your page HTML (or just the part between <head> and </head>)',
          type: 'textarea',
          placeholder:
            'Paste your HTML here. We only need the <head> — the part with your <meta> and <title> tags.',
          help:
            'Not sure where to find it? In your browser, right-click the page, choose "View Page Source", and copy the top section. These tags control the title, description, and image in the link preview card.',
        },
        {
          name: 'pageUrl',
          label: 'Your page address (optional)',
          type: 'url',
          placeholder: 'https://your-site.com/your-page',
          help:
            'Optional. If your image tag uses a short path like "/card.png", pasting your address lets us turn it into the full link that sharing apps require.',
        },
      ],
      examples: [
        {
          label: 'A page missing all social tags',
          value: { headHtml: '<head><title>My App</title></head>' },
        },
        {
          label: 'A page with a relative image path',
          value: {
            headHtml:
              '<head>\n  <title>My Cool App</title>\n  <meta property="og:title" content="My Cool App" />\n  <meta property="og:description" content="The fastest way to do the thing." />\n  <meta property="og:image" content="/card.png" />\n</head>',
            pageUrl: 'https://mycoolapp.com',
          },
        },
        {
          label: 'A fully share-ready page',
          value: {
            headHtml:
              '<head>\n  <title>My Cool App</title>\n  <meta property="og:title" content="My Cool App" />\n  <meta property="og:description" content="The fastest way to do the thing." />\n  <meta property="og:image" content="https://mycoolapp.com/card.png" />\n  <meta property="og:url" content="https://mycoolapp.com" />\n  <meta property="og:type" content="website" />\n  <meta property="og:site_name" content="My Cool App" />\n  <meta name="twitter:card" content="summary_large_image" />\n</head>',
          },
        },
      ],
    };
  },
};

export default sharepreview;
