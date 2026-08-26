# VibeCheck v2 — the brief

## The prompt I'm building against

> Turn VibeCheck from a five-form worksheet into a ten-second tool.
>
> A vibecoder just deployed something with Cursor or Lovable. They are proud and
> slightly terrified. They have a URL. Give them a page where they paste that URL,
> hit enter, and eight seconds later know whether they can ship — in words their
> mother would understand — with a copy-paste fix for everything that is wrong,
> and a score card good enough that they *want* to post it.
>
> One input. Dark by default. No accounts, no upsell, no config.
> The engine already works; the product does not exist yet. Build the product.

## What that means concretely

**One front door.** `Paste your app's URL → Check it.` The URL alone runs three of the
five checks (accessibility, social share preview, AI crawlers) against the real page.
A second door — drop your project files — fills in the two the URL cannot see
(license, README). No "pick a check first". No view-source homework.

**A run you can watch.** Checks resolve one at a time on screen. It should feel like
something is happening, because something is.

**A report, not a page.** Big score, a band you can say out loud
(*not ready / almost / launch-ready*), then "Fix these first" — blockers on top,
each with one-click copy. Details underneath for whoever wants them.

**Something to share.** Every result gets a permanent link that reproduces the exact
report, a LinkedIn-ready preview card, and a README badge. This is the growth loop
and it is the reason the article has anything to point at.

**Feel.** Dark-first (light toggle). Numbers in tabular mono. Score counts up.
Enter works, Escape works, paste anywhere works. Nothing bounces, nothing flashes.
Fast enough that you run it twice.

## Rules I am not allowed to break

1. Dropped files never leave the browser. Only a URL you type is sent, and only to
   our own fetcher — no third-party proxy, nothing logged.
2. `run()` never throws. Every check survives garbage input.
3. All user-derived text renders via `textContent`. The XSS suite stays green.
4. Check logic under `src/modules/` is already correct and tested — extend, don't rewrite.
5. Plain English everywhere. If a sentence needs a CS degree, it is a bug.
