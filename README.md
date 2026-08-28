# VibeCheck

**You built it in a weekend. Is it safe to ship on Monday?**

Paste the link to the thing you made with Cursor, Lovable, Bolt, Replit, v0 or Claude.
Ten seconds later you get a **Launch Readiness** score out of 100, in plain English,
with the fixes already written out for you.

→ **[vibecheck.copperbaytech.com](https://vibecheck.copperbaytech.com)**

Free. No signup. No account. No upsell.

---

## Why this exists

AI coding tools are very good at producing something that runs. They are not
good at telling you what you forgot. The things that bite people after launch
are boring and invisible: no LICENSE file, a copyleft dependency you never
looked at, images with no alt text, a `robots.txt` that either does not exist or
accidentally blocks Google, a link that unfurls as a naked URL, a README nobody
can follow.

None of that shows up when the app "works". All of it shows up later.

VibeCheck runs the five checks that catch the majority of it, and explains the
results the way a friend would rather than the way a linter would.

## The five checks

| Check | The question it answers |
| --- | --- |
| **Legal & Licenses** | Can you legally ship this? Your own license, plus every library you pulled in. |
| **Accessibility** | Can everyone actually use it? The high-impact WCAG 2.2 A/AA basics. |
| **AI Crawlers** | Who gets to read and train on your site — and does your `robots.txt` really do what you think? |
| **Social Share Preview** | Does your link show a card or a naked URL when someone posts it? |
| **README & Docs** | Could a stranger install and run this without asking you? |

Each returns a 0–100 score, plain-English findings, and paste-ready fixes.
The overall score is the average of the checks you ran; a check that finds a
real blocker is capped at 50 until the blocker is gone. Checks you have not run
yet do not drag the score down — they show as "not checked yet".

## Two ways in

**Paste a URL.** That is the front door. One address gets you accessibility,
share preview and AI crawlers, checked against the page that is actually live.

**Drop your files.** Drag your project folder onto the page (or paste any file's
contents anywhere). VibeCheck works out what each file is — `README.md`,
`package.json`, `LICENSE`, `robots.txt`, an HTML page — and routes it to the
right check. That covers the two things a live URL can never show us: your
license situation and your docs.

You can mix them. Run the URL, then paste your README into the report to fill
the gap, and the score updates in place.

**If your app renders entirely in the browser** — the usual output of Lovable,
Bolt, v0 and Replit — the HTML we can fetch is an empty shell, and grading
accessibility on it would produce a good score for a page with nothing in it.
VibeCheck detects that, refuses to score it, and tells you how to paste the
rendered HTML instead. The share preview still runs, because those `<meta>` tags
are really in the shell.

## Where your code goes

Nowhere.

- **Dropped and pasted files never leave your browser.** They are read with the
  File API and checked in the page. There is no upload.
- **The only thing that is ever sent anywhere is a URL you type.** It goes to our
  own `/api/scan` function, which fetches that public page and its `robots.txt`
  and hands the HTML straight back. Not a third-party proxy. Nothing is stored,
  nothing is logged, nothing is queued.
- **A share link publishes a score, not your problems.** The `?r=` token carries
  the overall score, the per-check verdicts, and the address you checked. It does
  not carry your HTML, your dependencies, your license text, your findings, or
  even the names of what is broken.

The fetcher is written defensively: http/https only, no credentials in the URL,
every redirect hop re-validated, DNS resolved and refused if it lands on a
private, loopback, link-local or CGNAT address, plus a hard timeout, a byte cap,
and a redirect limit. It is also throttled — 12 scans a minute and 120 an hour
per client — because an open URL fetcher on a public deployment is otherwise a
free proxy. That limiter lives in one serverless instance's memory, so it stops
one client looping rather than a distributed flood; it is not pretending to be
more than that.

## Share your score

Every report gives you:

- a **share link** that reproduces the score card,
- a **README badge** — `[![Launch Readiness: 87/100](…/api/badge?score=87)](…)`,
- a **Markdown report** you can download,
- and **print / save as PDF**.

## Run it yourself

The front end has no build step and no dependencies. Serve the folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Everything works except the URL front door,
which needs the serverless function. For that, use the Vercel CLI:

```bash
npx vercel dev
```

Run the tests:

```bash
node --test
```

## How it is put together

```
index.html          the app shell: three views (home / scan / report)
styles/main.css     the design system — dark first, one accent, tokens only
src/
  shell.js          the controller; the only file that owns state
  registry.js       which checks exist, in what order
  contract.js       the shape every check must return
  score.js          per-check scores → one Launch Readiness number
  report.js         report card object + Markdown export
  ingest/
    detect.js       "what is this blob of text?" — the one-input promise
    bundle.js       collect sources → per-check inputs, with a receipt
    rendered.js     real HTML, or an unrendered single-page-app shell?
  share/codec.js    report ⇄ share link, hostile-input-proof
  modules/<id>.js   one adapter per check
  modules/<id>/*.js the pure logic for that check
  ui/               the only files allowed to touch the DOM
api/
  scan.js           fetch a public page + its robots.txt (SSRF-hardened)
  _ratelimit.js     per-client throttle (underscore = not routed)
  badge.js          the README badge, as SVG
tools/make-og.py    renders og.png, the social card
```

The rules the codebase holds itself to:

1. **Check logic is pure.** No `document`, no `window`, no `fetch` under
   `src/modules/`. It all runs under plain Node, which is why it is testable.
2. **`run()` never throws.** Every check survives `undefined`, garbage, and
   deliberately hostile input. The contract enforces it and the tests prove it.
3. **All dynamic text renders through `textContent`.** Nothing user-derived is
   ever interpolated into markup. `test/xss.test.mjs` feeds every check a payload
   combining `<script>`, `<img onerror>` and `javascript:` URLs, renders the real
   UI into a DOM shim, and asserts no live markup survives.
4. **No external assets.** No web fonts, no CDNs, no remote images, no
   analytics. The icons are inline SVG authored in-repo. The CSP is strict and
   inline script is forbidden outright.

## Adding a check

Create `src/modules/<id>.js` default-exporting:

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

Put the real logic in pure files under `src/modules/<id>/`, register it in
`src/registry.js`, and teach `src/ingest/detect.js` what input it needs. The
scan, the scorer, the report and the share link all pick it up automatically.

## Changelog

### 2.0.1

- Refuse to score accessibility on a client-rendered app shell. A page that
  builds itself with JavaScript was scoring 75/100 on an empty body — confident
  and meaningless, for exactly the tools this is aimed at.
- The AI-crawler blocking choice can be changed after the check has run. It was
  previously a dead end: a site that deliberately welcomes AI crawlers was told
  it had a blocker with nowhere to say otherwise.
- Throttle `/api/scan` (12/min, 120/hour per client).
- Label our own file input. VibeCheck failed its own accessibility check, which
  is either embarrassing or the best possible endorsement.

### 2.0.0

- **One input.** A URL front door that fetches the live page, plus drag-and-drop
  (and paste-anywhere) file ingestion that works out what each file is. Replaces
  the five separate paste-a-thing forms.
- **A run you can watch**, and a report that completes itself — checks a URL
  cannot answer show an inline paste box that updates the score in place.
- **Shareable results**: score-card links, a README badge endpoint, an OG card.
- **Dark first**, with a light toggle that respects your system setting.
- Scores now average the real per-check numbers instead of pass/warn/fail
  buckets, so fixing one thing actually moves the needle. Blockers cap at 50.
- Hardened: SSRF-guarded fetcher, strict CSP, no inline script, hostile-input
  tests for the share codec and the whole render layer.

### 1.0.0

- First complete release. Five checks with real logic, wired end to end through
  one guided screen, with a live overall score and a prioritized fix list.

## License

MIT © 2026 Dukotah
