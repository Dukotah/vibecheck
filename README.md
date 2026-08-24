# VibeCheck

**Built an app with AI? Run a vibe check before you ship.** Free, no signup, runs entirely in your browser.

VibeCheck gives an app built with AI coding tools (Cursor, Bolt, Lovable, Replit, v0, Claude) a plain-English **Launch Readiness** report card. It merges five pre-launch checks into one guided GUI with a single readiness score and a prioritized "fix these" list. Everything runs client-side — your code and text never leave the page.

## The 5 checks

| Check | What it answers |
| --- | --- |
| **Legal & Licenses** | Can you legally ship this? License + dependency terms. |
| **Accessibility** | Can everyone actually use it? The high-impact WCAG basics. |
| **AI Crawlers & robots.txt** | Who can crawl and train on your site? |
| **Social Share Preview** | What shows when someone shares your link? |
| **README & Docs** | Can a stranger understand and run your project? |

## Run it locally

Open `index.html` in a browser — there is no build step. To serve it:

```
python3 -m http.server
```

## Develop

All logic lives in pure ES modules under `src/` (no `document`/`window` in core files, so they run under Node). Only the shell/UI layer touches the DOM.

```
node --test
```

## Module contract

Each check is a module at `src/modules/<id>.js` that default-exports:

```js
{
  id: string, title: string, tagline: string,
  run(input) -> {
    status: 'pass'|'warn'|'fail'|'incomplete',
    score: 0..100,
    summary: string,
    findings: [{ level:'good'|'warn'|'bad', text:string }],
    fixes: [{ label:string, copyText:string }]
  },
  formSpec() -> { fields: [...], examples: [...] }
}
```

Core logic for a check lives in `src/modules/<id>/*.js` (pure). Register a new check by importing it in `src/registry.js`.

## License

MIT © 2026 Dukotah
