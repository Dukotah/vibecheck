# VibeCheck

**Built an app with AI? Run a vibe check before you ship.** Free, no signup, runs entirely in your browser.

VibeCheck gives an app built with AI coding tools (Cursor, Bolt, Lovable, Replit, v0, Claude) a plain-English **Launch Readiness** report card. It merges five pre-launch checks into one guided screen with a single readiness score and a prioritized "fix these first" list. Everything runs client-side — your code and text never leave the page.

You paste something simple (your page HTML, your README, your `robots.txt`), and VibeCheck hands back a clear score, what is wrong in normal words, and copy-paste fixes you can drop straight into your project. No terminal, no accounts, no jargon.

## Who it is for

Non-technical "vibecoders" who built something real with an AI tool and want to know it is safe and ready to ship — without needing to understand licenses, WCAG, Open Graph, or `robots.txt` first.

## The 5 checks

| Check | What it answers | You paste |
| --- | --- | --- |
| **Legal & Licenses** | Can you legally ship this? Your license plus your dependencies' terms. | Your `LICENSE` + `package.json` / `requirements.txt` |
| **Accessibility** | Can everyone actually use it? The high-impact WCAG 2.2 basics: page language, title, image alt text, form labels, a main heading, meaningful links, zoom, tab order. | Your page HTML |
| **AI Crawlers & robots.txt** | Who can crawl and train on your site? Tick which AI bots to keep out and check your file actually does it. | Which bots to block (+ optional `robots.txt`) |
| **Social Share Preview** | What shows when someone shares your link — a nice card or a naked URL? | Your page `<head>` HTML |
| **README & Docs** | Can a stranger understand and run your project? | Your `README.md` (or a few guided answers) |

Each check gives a 0–100 score and paste-ready fixes. The overall **Launch Readiness** score updates live as you go. Checks you have not run yet do not drag the score down — they are counted as "not checked yet".

## The result

- One **Launch Readiness** score (0–100) with a friendly band: *Not ready to ship yet* → *Almost there* → *Looking launch-ready*.
- A prioritized **fix list**, blockers first, each with a one-click copy.
- A shareable report you can **copy as Markdown**, **download** as a `.md` file, or **print / save as PDF**.

## Run it locally

There is no build step. Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server
```

Then visit `http://localhost:8000`. Everything works offline once the page has loaded — nothing you paste is ever uploaded.

## Develop

All logic lives in pure ES modules under `src/` (no `document`/`window` in core files, so they run under Node). Only the shell/UI layer (`src/shell.js`, `src/ui/*`) touches the DOM. All dynamic text is rendered via `textContent`, so pasted content can never inject markup.

Run the test suite:

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

`run()` must never throw on any input. Core logic for a check lives in the pure files under `src/modules/<id>/*.js`. Register a new check by importing it in `src/registry.js`; the dashboard, scorer, and report builder pick it up automatically.

## Changelog

### 1.0.0

- First complete release. All five checks implement real logic (Legal, Accessibility, AI Crawlers, Social Share Preview, README & Docs) wired end-to-end through one guided screen.
- Built the Accessibility check: a pure HTML scanner for the high-impact WCAG 2.2 A/AA basics, with copy-paste fixes.
- Live overall Launch Readiness score plus a prioritized, blockers-first fix list.
- Shareable report: copy as Markdown, download `.md`, or print / save as PDF.
- Non-technical onboarding, plain-language copy throughout, built-in examples, and clear empty / partial / complete states.
- Premium-but-calm, fully responsive, dependency-free UI. XSS-safe rendering.

## License

MIT © 2026 Dukotah
