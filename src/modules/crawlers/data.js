// modules/crawlers/data.js — the curated AI-crawler list, adapted (pure, no DOM)
// from the CrawlerBlock source tool (data/crawlers.js). This is the reference
// data that lets VibeCheck read a pasted robots.txt and say, in plain English,
// which AI bots it currently allows or blocks.
//
// Each entry:
//   id       — stable slug.
//   ua       — the EXACT User-agent token as it appears in robots.txt.
//   name     — human name.
//   company  — operator.
//   category — 'training' | 'assistant' | 'search' (drives the grouped picker).
//   purpose  — one-line plain description.

export const LIST_LAST_UPDATED = '2026-08-19';

export const CATEGORIES = {
  training: {
    id: 'training',
    label: 'AI training crawlers',
    blurb:
      'Bots that scrape your pages to build datasets for training AI models. Blocking these is the classic "opt out of AI training" move.',
  },
  assistant: {
    id: 'assistant',
    label: 'AI assistants & answer engines',
    blurb:
      'Bots that fetch your content to answer a user\'s question in a chatbot or AI answer box. Blocking these removes your site from those answers.',
  },
  search: {
    id: 'search',
    label: 'Search-linked AI controls',
    blurb:
      'Special tokens that let you keep normal search indexing while opting OUT of a search engine\'s AI features (Google-Extended, Applebot-Extended).',
  },
};

export const CRAWLERS = [
  { id: 'gptbot', ua: 'GPTBot', name: 'GPTBot', company: 'OpenAI', category: 'training', purpose: 'Crawls the web to gather training data for OpenAI models.' },
  { id: 'oai-searchbot', ua: 'OAI-SearchBot', name: 'OAI-SearchBot', company: 'OpenAI', category: 'assistant', purpose: 'Surfaces sites in ChatGPT search results.' },
  { id: 'chatgpt-user', ua: 'ChatGPT-User', name: 'ChatGPT-User', company: 'OpenAI', category: 'assistant', purpose: 'Fetches a page live when a ChatGPT user asks about a URL.' },
  { id: 'claudebot', ua: 'ClaudeBot', name: 'ClaudeBot', company: 'Anthropic', category: 'training', purpose: 'Crawls the web to gather training data for Anthropic\'s Claude models.' },
  { id: 'claude-user', ua: 'Claude-User', name: 'Claude-User', company: 'Anthropic', category: 'assistant', purpose: 'Fetches a page live when a Claude user\'s request references it.' },
  { id: 'claude-searchbot', ua: 'Claude-SearchBot', name: 'Claude-SearchBot', company: 'Anthropic', category: 'assistant', purpose: 'Indexes sites to improve search results inside Claude.' },
  { id: 'anthropic-ai', ua: 'anthropic-ai', name: 'anthropic-ai', company: 'Anthropic', category: 'training', purpose: 'Legacy Anthropic crawler token; block for completeness.' },
  { id: 'google-extended', ua: 'Google-Extended', name: 'Google-Extended', company: 'Google', category: 'search', purpose: 'Opt out of Gemini training WITHOUT affecting normal Google Search ranking.' },
  { id: 'applebot-extended', ua: 'Applebot-Extended', name: 'Applebot-Extended', company: 'Apple', category: 'search', purpose: 'Opt out of Apple generative-model training without blocking Siri/Spotlight.' },
  { id: 'applebot', ua: 'Applebot', name: 'Applebot', company: 'Apple', category: 'assistant', purpose: 'Powers Siri and Spotlight suggestions.' },
  { id: 'ccbot', ua: 'CCBot', name: 'CCBot', company: 'Common Crawl', category: 'training', purpose: 'Builds the open Common Crawl corpus, a primary training source for most LLMs.' },
  { id: 'perplexitybot', ua: 'PerplexityBot', name: 'PerplexityBot', company: 'Perplexity', category: 'assistant', purpose: 'Indexes sites so they can be cited in Perplexity\'s answer engine.' },
  { id: 'perplexity-user', ua: 'Perplexity-User', name: 'Perplexity-User', company: 'Perplexity', category: 'assistant', purpose: 'Fetches a page live in response to a specific Perplexity user request.' },
  { id: 'amazonbot', ua: 'Amazonbot', name: 'Amazonbot', company: 'Amazon', category: 'assistant', purpose: 'Crawls to improve Alexa answers and Amazon AI features.' },
  { id: 'bytespider', ua: 'Bytespider', name: 'Bytespider', company: 'ByteDance', category: 'training', purpose: 'ByteDance (TikTok) crawler that gathers data for AI training.' },
  { id: 'meta-externalagent', ua: 'meta-externalagent', name: 'meta-externalagent', company: 'Meta', category: 'training', purpose: 'Meta\'s crawler for gathering data to train its AI (Llama) products.' },
  { id: 'meta-externalfetcher', ua: 'meta-externalfetcher', name: 'meta-externalfetcher', company: 'Meta', category: 'assistant', purpose: 'Fetches individual pages on demand for Meta AI assistant features.' },
  { id: 'cohere-ai', ua: 'cohere-ai', name: 'cohere-ai', company: 'Cohere', category: 'training', purpose: 'Cohere crawler used to gather data for its enterprise LLMs.' },
  { id: 'diffbot', ua: 'Diffbot', name: 'Diffbot', company: 'Diffbot', category: 'training', purpose: 'Builds a structured knowledge graph of the web that is licensed for AI use.' },
  { id: 'youbot', ua: 'YouBot', name: 'YouBot', company: 'You.com', category: 'assistant', purpose: 'Crawls the web to power You.com\'s AI search and chat answers.' },
  { id: 'duckassistbot', ua: 'DuckAssistBot', name: 'DuckAssistBot', company: 'DuckDuckGo', category: 'assistant', purpose: 'Fetches content for DuckDuckGo\'s DuckAssist AI answer feature.' },
  { id: 'mistralai-user', ua: 'MistralAI-User', name: 'MistralAI-User', company: 'Mistral AI', category: 'assistant', purpose: 'Fetches pages live for Mistral\'s Le Chat assistant.' },
  { id: 'ai2bot', ua: 'AI2Bot', name: 'AI2Bot', company: 'Allen Institute for AI', category: 'training', purpose: 'Gathers open web data for AI2\'s open research models.' },
];

/** Look up a crawler by id. */
export function crawlerById(id) {
  return CRAWLERS.find((c) => c.id === id) || null;
}

/** All distinct company names. */
export function companies() {
  return [...new Set(CRAWLERS.map((c) => c.company))].sort();
}

/** Ids of every crawler in a category. */
export function idsInCategory(categoryId) {
  return CRAWLERS.filter((c) => c.category === categoryId).map((c) => c.id);
}
