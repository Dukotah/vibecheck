# Article Brief — VibeCheck launch article (for vibecoders)

This is a brief for a writer. It is not the article. Use it to draft a
publish-ready piece for **vibecoders** — non-technical people who built a real
app with an AI coding tool and want to know it is safe to ship. Assume many
readers land on this from a jobs/career context (e.g. an Indeed post or a
career-adjacent page), so they may be career-switchers, side-project builders,
or someone shipping their first thing. Meet them there.

> **Publishing note for the owner:** there is no automated posting to Indeed or
> anywhere else. Publishing is a manual owner step. This brief and the drafted
> article are handoff artifacts only.

---

## 1. The reader and their pain

**Who they are.** Someone who described what they wanted to Cursor, Bolt,
Lovable, Replit, v0, or Claude and got back a working app. They can run it. It
looks real. They are proud of it — and quietly terrified to put it in front of
the world, because they do not actually know what is under the hood.

**What keeps them up at night (say these back to them):**

- "Am I allowed to even publish this? The AI pulled in a bunch of libraries I
  never chose. What if one of them means I have to give my code away for free?"
- "I have no license file. Is that bad? Does it matter?"
- "Can a blind person or someone using a keyboard actually use my app, or am I
  about to get called out — or sued — the day I launch?"
- "Every AI company is scraping the web. Is mine being copied to train models
  right now? Can I stop it? Did I accidentally block Google instead?"
- "I posted my link and it showed up as an ugly bare URL with no picture. It
  looked amateur. Why?"
- "My README is one line. If someone smart looks at my repo, will they think I
  have no idea what I am doing?"

The through-line: **they built something real, but nobody handed them the
pre-flight checklist that technical people take for granted.** They do not want
a lecture on WCAG or SPDX license identifiers. They want a friend to look at it
and say "yep, ship it" or "fix these three things first."

---

## 2. The core promise of VibeCheck

**Built an app with AI? Run a vibe check before you ship.**

VibeCheck is a free, no-signup web app that gives your project a single,
plain-English **Launch Readiness** score (0–100) and a prioritized "fix these
first" list — blockers at the top. You paste simple things you already have
(your page's HTML, your README, your dependency list), and it hands back what is
wrong in normal words plus copy-paste fixes you drop straight into your project.

Three honest hooks the writer can lean on:

1. **No terminal, no accounts, no jargon.** If you can copy and paste, you can
   use it.
2. **Your code never leaves your browser.** Everything runs client-side on your
   own machine. Nothing you paste is uploaded anywhere. (This is true and
   verifiable — lead with it, it defuses the "am I leaking my secret project"
   fear.)
3. **It is five separate pre-launch checks merged into one guided screen** with
   one score, so you are not juggling five tools and five verdicts.

---

## 3. The five checks, in plain English (and why each matters BEFORE you ship)

Explain each as: *what it answers → what you paste → why it matters before
launch.* Keep the tone reassuring, not scary.

### Check 1 — Legal & Licenses
- **Answers:** "Can I legally ship this?"
- **You paste:** your `LICENSE` file (if you have one) and your dependency list
  (`package.json` or `requirements.txt`).
- **Why before shipping:** The AI probably added open-source libraries you never
  picked. Most are harmless (MIT, Apache), but a few carry "copyleft" terms that
  can force *your* code to become open-source too, and some carry no license at
  all (a real risk). Separately, if *your* project has no license file, then
  legally nobody — not even future you — can reuse it; it defaults to "all
  rights reserved." VibeCheck flags the risky ones by name and, if you have no
  license, hands you a ready-to-use one. Fixing this after launch is far more
  painful than before.

### Check 2 — Accessibility
- **Answers:** "Can everyone actually use it?"
- **You paste:** your page's HTML.
- **Why before shipping:** It scans the high-impact accessibility basics (the
  page declares its language, has a title, images have alt text, form fields
  have labels, there is a real main heading, links say where they go, users can
  pinch-to-zoom, tab order makes sense). These are the things that lock out
  people using screen readers, keyboards, or low vision — and they are also the
  ones that draw complaints and legal attention. They are cheap to fix in code
  and embarrassing to fix in public.

### Check 3 — AI Crawlers & robots.txt
- **Answers:** "Who can crawl and train on my site?"
- **You paste:** you tick which groups of AI bots to keep out, and optionally
  paste your current `robots.txt`.
- **Why before shipping:** The moment you go live, AI crawlers can start copying
  your pages to train models or answer questions inside chatbots. You may be
  fine with that, or you may not — but it should be *your* choice, made on
  purpose. VibeCheck lets you decide (block training bots, block AI assistants,
  or the middle ground: opt out of Google/Apple AI training but stay in normal
  search) and checks whether your file actually does what you intend. It also
  catches the classic disaster: a `robots.txt` that accidentally blocks *every*
  crawler, including Google, so your site never appears in search.

### Check 4 — Social Share Preview
- **Answers:** "What shows when someone shares my link — a nice card or a naked
  URL?"
- **You paste:** the `<head>` HTML of your page.
- **Why before shipping:** The first time your link gets dropped in iMessage,
  Slack, X, LinkedIn, Facebook, or Discord, it either renders a clean card with
  a title, description, and image — or a bare, lifeless URL that reads as
  "amateur." This is set by a handful of Open Graph and Twitter Card meta tags
  that AI tools routinely leave out. VibeCheck reads what you have, tells you
  what each app will show, and hands you the corrected tags to paste in. It is a
  five-minute fix that changes the entire first impression of your launch.

### Check 5 — README & Docs
- **Answers:** "Can a stranger understand and run my project?"
- **You paste:** your `README.md` — or, if you do not have one, you answer a few
  guided questions and it writes a starter README for you.
- **Why before shipping:** Your README is the front door. If it is one line (or
  the AI's placeholder), anyone who looks — a potential user, a collaborator, a
  hiring manager, future-you six months from now — cannot tell what the project
  is, how to install it, how to run it, or what license it is under. VibeCheck
  scores what you have against the sections that matter and fills the gaps with
  paste-ready markdown.

**Tie it together:** each check gives its own 0–100 score, and the overall
Launch Readiness score updates live as you complete them. Checks you have not
run yet are counted as "not checked yet" — they do not unfairly drag your score
down. When you are done, you get a prioritized fix list (blockers first) and a
shareable report you can copy as Markdown, download as a `.md`, or print / save
as PDF.

---

## 4. Suggested structure / outline

1. **Hook (2–3 sentences).** "You built an app with AI. It works. You are
   scared to launch it — and you should double-check a few things first." Name
   the exact tools (Cursor/Bolt/Lovable/Replit/v0/Claude) so the reader feels
   seen.
2. **The gap nobody warned you about.** Vibecoding got you a working app; it did
   not give you the pre-flight checklist technical founders take for granted.
   List 3–4 of the pains from section 1 as short, punchy questions.
3. **Meet VibeCheck.** The core promise (section 2). Lead with "free, no signup,
   nothing you paste leaves your browser." Include the one-line what-it-does.
4. **The five checks.** One short subsection each (section 3). For each: the
   plain-English question it answers, the one thing you paste, and the "here is
   what could go wrong at launch" stakes. Keep it skimmable — bold the question.
5. **What you actually get out of it.** One score, a friendly band ("Not ready
   to ship yet" → "Almost there" → "Looking launch-ready"), a prioritized fix
   list with one-click copy, and an exportable report.
6. **How to run it (30 seconds).** Open the app, paste, read your score. No
   install. Optionally: it is open-source and you can run it locally.
7. **Honest limits.** A short, plain paragraph (section 7). This builds trust,
   especially with a jobs-site audience who has seen overhyped tools.
8. **Call to action** (section 6).

Keep total length ~900–1400 words. Short paragraphs. No walls of text. Second
person ("you"). Zero unexplained jargon — if you must use a term like "Open
Graph," define it in the same sentence.

---

## 5. Candidate titles (pick/adapt)

1. Built an App with AI? Run This Free Check Before You Hit Publish
2. The 5-Minute Launch Checklist for Anyone Who Built an App with AI
3. You Vibecoded an App. Here's How to Know It's Actually Safe to Ship.
4. From "It Works on My Screen" to "Ready to Launch" — A Free Vibe Check
5. Before You Share That Link: 5 Things AI Left Out of Your App
6. No-Signup Launch Readiness Score for Cursor, Bolt, Lovable & Replit Projects
7. Shipped by AI, Checked by You: A Plain-English Readiness Report Card
8. Is Your AI-Built App Ready to Launch? Find Out in Your Browser, Free

---

## 6. Call to action

Primary: **"Run your free vibe check now — no signup, nothing leaves your
browser."** Link to the live app: `https://dukotah.github.io/vibecheck/`.

Reinforce with a low-commitment framing: "Paste one thing, get one score. If it
says 'launch-ready,' ship with confidence. If not, it tells you exactly what to
fix and hands you the fix." Optional secondary CTA for the technical-curious:
"It's open-source (MIT) and runs entirely client-side — inspect it or run it
locally if you like."

---

## 7. SEO keywords

**Primary:** launch readiness checklist, is my app ready to launch, AI-built app
checklist, vibecoding launch checklist.

**Tool/audience:** Cursor app checklist, Bolt app checklist, Lovable app
checklist, Replit app checklist, v0 app checklist, apps built with AI.

**Per-check long-tail:** free license checker for dependencies, do I need a
LICENSE file, website accessibility checker (paste HTML), block AI crawlers
robots.txt, block GPTBot ClaudeBot, why does my link show no preview, Open Graph
image not showing, how to write a README.

**Qualifiers that convert:** free, no signup, no install, runs in browser,
client-side, privacy-safe.

Do not keyword-stuff. Work these into natural headings and sentences.

---

## 8. Honest known limitations (the writer MUST NOT overstate)

State these plainly. Do not imply certification, legal advice, or a guarantee.

- **It is a readiness *indicator*, not a certification or legal advice.** The
  Legal & Licenses check flags common risks from a bundled offline database of
  popular package licenses; it is not a lawyer and does not audit every possible
  dependency or transitive dependency. A high score is not legal clearance.
- **The Accessibility check covers the high-impact WCAG 2.2 basics from pasted
  HTML — it is not a full audit.** It cannot catch everything (color contrast
  nuance, dynamic/JS-rendered states, real screen-reader behavior). A good score
  means you cleared the common, high-impact basics, not that you are fully
  WCAG-compliant.
- **You paste static content; it does not crawl or log into your live site.**
  For accessibility and share-preview it reads the HTML you give it, so results
  are only as current as what you paste. It does not execute your app.
- **License data is a bundled cache of popular packages, not a live registry
  lookup.** Very new or obscure packages may resolve as "unknown" rather than
  wrong — treat unknowns as "go check this one," not "this is fine."
- **The AI-crawler list reflects known bots at build time.** New crawlers appear
  constantly; the generated `robots.txt` covers the well-known ones, and
  `robots.txt` is a request that well-behaved bots honor — it is not an
  enforcement wall.
- **No accounts, no history, no saved projects.** It does not remember your
  runs; the report is generated on the spot and it is on you to export it.
- **Do not promise it will "make your app pass" anything or "protect" you from
  scraping/lawsuits.** Frame it as: it surfaces the common pre-launch problems
  early, in plain English, with fixes — so you ship on purpose instead of by
  accident.
