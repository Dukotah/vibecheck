# Article brief — VibeCheck

Everything you need to write the LinkedIn post and the longer piece. Written to
be raided, not published as-is.

**Live:** https://vibecheck.copperbaytech.com
**Source:** https://github.com/Dukotah/vibecheck
**Social card:** `og.png` — dark, shows a score ring at 87/100

---

## The one-sentence version

VibeCheck is a free tool that takes the link to something you built with AI and
tells you, in plain English, whether it is safe to ship — with the fixes already
written out.

## The angle that makes it a story

Not "I built a tool." Everybody built a tool.

The story is **the gap between working and shippable**, and that AI coding tools
sit squarely in it. They are excellent at producing something that runs. They
are structurally bad at telling you what you forgot, because what you forgot is
not in the prompt. Nobody asks Cursor "and also, is my dependency licensing
going to bite me?"

So a generation of people are shipping real, live, public software with:

- no LICENSE file at all — which legally means all rights reserved, including
  against future-you and any collaborator
- dependencies nobody looked at, some of them copyleft
- images with no alt text and inputs with no labels
- no `robots.txt`, so every AI crawler is helping itself; or a `robots.txt`
  that accidentally tells Google to go away
- links that unfurl in Slack as a naked URL
- a README nobody but the author could follow

None of that shows up when the app "works". All of it shows up later, usually in
front of someone whose opinion matters.

**The line to use:** *AI made it trivial to build software and no easier at all
to launch it.*

## What the tool actually does

Paste a URL. Ten seconds later: a Launch Readiness score out of 100, a band you
can say out loud (*not ready / almost there / launch-ready*), a to-do list with
blockers on top, and paste-ready text for every fix.

Five checks:

| Check | The question |
| --- | --- |
| Legal & Licenses | Can you legally ship this? |
| Accessibility | Can everyone actually use it? |
| AI Crawlers | Who gets to read and train on your site? |
| Social Share Preview | Card, or naked URL? |
| README & Docs | Could a stranger run this? |

One URL answers three of them against the live page. Drag your project folder in
and it works out what each file is — `README.md`, `package.json`, `LICENSE`,
`robots.txt` — and fills in the other two. Those files never leave the browser.

## The details worth putting in the piece

Pick two or three. All of them are true and checkable.

1. **The privacy claim is specific, not vibes.** Dropped files are read with the
   File API and never uploaded. The only thing ever sent anywhere is a URL you
   type, and it goes to our own fetcher — no third-party CORS proxy, nothing
   stored. This is the objection people have ("am I uploading my secret
   project?") so lead with it.

2. **A shared link publishes a score, not your problems.** The `?r=` token
   carries the overall score, the per-check verdicts and the address. It does
   not carry your HTML, your dependencies, your findings, or even the *names* of
   what is broken. You can post the number without publishing the mess.

3. **The tool that checks your headers has real ones.** Strict CSP with inline
   script forbidden outright — the theme bootstrap lives in its own file
   specifically so the policy can say `script-src 'self'` and mean it.

4. **The fetcher is the scary part, so it is the careful part.** http/https
   only, no credentials in the URL, every redirect hop re-validated, and the
   hostname resolved and refused if it lands on a private, loopback, link-local
   or CGNAT address. A URL like `localtest.me` — a real public domain that
   resolves to 127.0.0.1 — is rejected. Plus a hard timeout, byte cap and
   redirect limit.

5. **Two bugs the build only found by using it.** Running the real pipeline
   against a live site showed the "Fix these first" list filling up with six
   near-identical "Fix og:whatever" rows, burying an actual blocker. Correctly
   sorted; useless to read. Fixed by dealing one fix per check in turn within
   each severity tier, and by only emitting per-tag snippets for problems that
   genuinely break the card. **This is the honest beat of the piece: the unit
   tests were all green both times.**

6. **The score had to move.** v1 scored on pass/warn/fail buckets, so a check
   passing at 90 reported as 100 and fixing one thing changed nothing. Now the
   score is the average of the real per-check numbers — with any check that
   found a blocker capped at 50 until it is gone. A number that does not respond
   to your work is not a score, it is a decoration.

7. **The architecture rule that made it testable.** No `document`, no `window`,
   no `fetch` anywhere under `src/modules/`. Every check is a pure function from
   text to a result object, which is why 275 tests run in under a second with no
   browser. The UI layer is the only thing allowed near the DOM, and every
   dynamic string goes through `textContent`, enforced by a suite that feeds all
   five checks a payload combining `<script>`, `<img onerror>` and `javascript:`
   and asserts no live markup survives the render.

## The honest bit (do not skip this)

v1 of this existed and was, by the numbers, finished: five working checks, 227
passing tests, a clean design system. It was also unusable. It made you pick a
check, then paste the specific artifact that check wanted, five separate times,
on a page that was a marketing site with a form bolted into the middle. It was
light-mode only. It had never been deployed, so there was no link.

**The engine was done and the product did not exist.** That distinction is the
most useful thing in this whole story, because it is exactly the trap AI-assisted
building sets: you get working parts fast and mistake them for a working thing.

What changed in v2 was not capability. Every check does the same thing it did
before. What changed was the number of decisions asked of the user, which went
from five to one.

## Post shapes

**Short LinkedIn post — the confession opener**

> I built a tool, finished it, tested it, and then couldn't bring myself to send
> anyone the link.
>
> It worked. Five checks, 227 passing tests, a design system. It was also
> miserable to use: pick a check, find the right file, paste it, repeat five
> times.
>
> The engine was done. The product didn't exist.
>
> [what changed — one input]
>
> [link]

**Short LinkedIn post — the problem opener**

> AI made it trivial to build software. It made it no easier at all to launch
> one.
>
> Things I keep finding on live, public sites built with AI tools this year:
> [list three]
>
> None of it shows up when the app "works." All of it shows up later.
>
> [link]

**Longer piece — suggested spine**

1. The gap between working and shippable, and why AI tools widen it
2. The five things that actually bite people (with the specifics)
3. v1: how I built something finished and unusable
4. The one-input rewrite, and what it cost
5. Two bugs that only surfaced by using the thing — with green tests
6. What I would tell someone shipping this weekend

## Numbers you can quote

- 5 checks, 275 tests, 0 dependencies in the front end, no build step
- One input replaces five separate paste-a-thing forms
- ~10 seconds from paste to score
- Share links are ~240 characters
- Free, no signup, no account, MIT

## Do not claim

- That it catches everything. It catches the common, high-impact misses. The
  footer says so and the piece should too.
- That it is legal advice. It is not.
- That it can see inside a JavaScript-only page. If a site renders entirely
  client-side, the fetched HTML is a shell — the tool says so and offers the
  paste path instead.
