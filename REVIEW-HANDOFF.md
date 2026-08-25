# Review Handoff — VibeCheck

For the **reviewing agent** who will evaluate VibeCheck and then oversee the
launch article. Read this, run the app, run the tests, walk the checklist, and
sign off (or file concerns). The companion `ARTICLE-BRIEF.md` in this same
directory is the writer's brief.

- **Repo root:** `/mnt/c/Users/dukot/projects/oss/vibecheck/`
- **What it is:** a free, no-signup, browser-only (static, GitHub-Pages-ready)
  web app that gives an app built with AI coding tools a plain-English **Launch
  Readiness** report card — one score plus a prioritized fix list.
- **QA grade going in:** A. **Tests:** 225 passing via `node --test`.

---

## How to run it locally

There is no build step and no dependencies to install. Two ways:

**A. Static server (recommended — matches how it ships on GitHub Pages):**

```
python3 -m http.server
```

Run that from the repo root, then open `http://localhost:8000`. Any static
server works (`npx serve`, etc.). A server is preferred over `file://` because
the app loads ES modules, which some browsers restrict under `file://`.

**B. Straight file open:** double-clicking `index.html` will work in most modern
browsers, but if module loading is blocked, fall back to option A.

**Offline claim to verify:** once the page has loaded, everything runs
client-side. Nothing pasted is uploaded. There are **no `fetch`/network calls in
`src/`** — the "online-enhance" idea in the product concept is *not* wired up in
this release; the app is fully paste/offline. Confirm this yourself (see
checklist). Do not let the article claim online-enhance features exist.

**Run the test suite:**

```
node --test
```

(or `npm test`, which is aliased to the same). Expect **225 tests, 0 failures.**
This includes an adversarial XSS regression suite (`test/xss.test.mjs`) across
all five modules.

---

## The five modules — what each does + source tool it reuses

Each check is a module at `src/modules/<id>.js` that default-exports a contract
object (`id`, `title`, `tagline`, `run(input)`, `formSpec()`). Pure per-check
logic lives under `src/modules/<id>/*.js` and is Node-testable (no DOM globals).
`run()` is contract-bound to **never throw on any input** and to return a
normalized result. Registration is via `src/registry.js`; the dashboard, scorer,
and report builder pick modules up automatically.

| # | Module (`id`) | What it does | Reuses source tool |
| - | --- | --- | --- |
| 1 | **Legal & Licenses** (`legal`) | Parses a pasted `LICENSE` + dependency list (`package.json` / `requirements.txt`), classifies the project's own license and each dependency's license by risk (permissive / copyleft / source-available / unknown / none), and flags blockers. Resolves package names via a bundled offline license cache (`legal/npm.js`, `legal/pypi.js`). If no license, offers a ready-to-use one. | **LicenseGuard** cores (`src/modules/legal/analyze.js`, `classify.js`, `licenses.js`, `parse.js`) |
| 2 | **Accessibility** (`accessibility`) | Pure HTML scanner for the high-impact WCAG 2.2 A/AA basics: page language, page title, image alt text, form labels, a main heading, meaningful link text, pinch-to-zoom, tab order. Returns findings + copy-paste fixes. | Purpose-built for VibeCheck (`accessibility/analyze.js`, `criteria.js`) — no external tool lineage |
| 3 | **AI Crawlers & robots.txt** (`crawlers`) | User ticks which AI-bot groups to block (training / assistants / Google+Apple-AI-training-but-stay-in-search); optionally pastes current `robots.txt`. Diffs intent vs. reality and generates a paste-ready `robots.txt`. Bot list is a build-time offline dataset (`crawlers/data.js`). | Purpose-built for VibeCheck (`crawlers/analyze.js`, `generate.js`, `data.js`) |
| 4 | **Social Share Preview** (`sharepreview`) | Parses `<head>` HTML, reads Open Graph + Twitter Card meta tags, reports what each app (iMessage/Slack/X/LinkedIn/Facebook/Discord) will show, and hands back corrected tags. | **ogpreview** (`src/modules/sharepreview/parse.js`, `audit.js`, `fix.js`, `preview.js`, `check.js`) |
| 5 | **README & Docs** (`docs`) | Scores a pasted `README.md` against the sections that matter (title, description, install, usage, license, etc.); or, from a few guided answers, generates a starter README in markdown. | Purpose-built for VibeCheck (`docs/analyze.js`, `template.js`) |

**Scoring model to sanity-check:** each module returns `status` (`pass` / `warn`
/ `fail` / `incomplete`) and a 0–100 score. `src/score.js` aggregates into the
overall Launch Readiness score; unrun checks are treated as "not checked yet"
and must **not** drag the score down. `src/report.js` builds the exportable
report (copy Markdown / download `.md` / print-PDF).

**Security posture:** all dynamic text is rendered via `textContent`, not
`innerHTML`, so pasted content cannot inject markup. Only the shell/UI layer
(`src/shell.js`, `src/ui/*`) touches the DOM; core module files avoid
`document`/`window` so they run under Node. This is backed by the XSS test suite.

---

## QA verdict + known concerns

**Verdict:** Grade A. All 225 tests pass. Logic is real (not stubbed) across all
five checks, wired end-to-end through one guided screen. XSS-safe rendering is
tested adversarially. No network calls; the privacy/offline claim holds.

**Known concerns to weigh (none are blockers, but the article must not overstate
— cross-reference the limitations list in `ARTICLE-BRIEF.md` §8):**

- **License + crawler data are bundled offline caches, fixed at build time.**
  Obscure/new packages resolve as "unknown," and new AI crawlers will not be in
  the list. Correct behavior, but it is a point-in-time snapshot.
- **Accessibility and share-preview read pasted static HTML** — no crawl, no JS
  execution, no live-site login. Results are only as current/complete as what
  the user pastes. Not a full audit; cannot catch contrast nuance or dynamic
  states.
- **No persistence** — no accounts, no saved runs; the report must be exported
  by the user or it is gone on reload. Intended, but verify the export paths
  actually work.
- **"Online-enhance" is conceptual, not shipped.** Confirm there are no dead UI
  affordances implying online modes that do not exist.
- **Not legal advice / not a certification.** Ensure the UI copy itself does not
  imply either.

---

## Sign-off checklist

Run through this before approving the tool or greenlighting the article.

**Runs and passes**
- [ ] `node --test` from repo root reports **225 tests, 0 failures**.
- [ ] `python3 -m http.server` serves the app; `http://localhost:8000` loads
      with no console errors.
- [ ] Reload with network throttled/offline (after first load): app still fully
      functional — confirms client-side/offline claim.
- [ ] Grep confirms no live network calls in core:
      `grep -rn "fetch\|XMLHttpRequest" src/` returns nothing load-bearing.

**Each of the 5 checks works**
- [ ] **Legal:** run each built-in example (MIT+safe deps, no-license+risky dep,
      Python requirements.txt) — scores and blocker findings make sense; a
      no-license project offers a ready-to-use license; a risky dep is named.
- [ ] **Accessibility:** paste HTML missing lang/title/alt/labels — each basic is
      flagged with a copy-paste fix; clean HTML scores high.
- [ ] **Crawlers:** tick block options with no `robots.txt` → generates one;
      paste `User-agent: *\nDisallow: /` → it warns you blocked Google.
- [ ] **Share Preview:** paste `<head>` with/without OG tags → per-app preview
      is accurate; missing tags come back as paste-ready corrected tags.
- [ ] **Docs:** paste a one-line README → low score + missing sections named;
      guided-answer mode generates a starter README.

**Aggregate experience**
- [ ] Overall Launch Readiness score updates live; unrun checks are "not checked
      yet" and do NOT lower the score.
- [ ] Fix list is prioritized blockers-first with working one-click copy.
- [ ] Report export works all three ways: copy as Markdown, download `.md`,
      print / save as PDF.
- [ ] Empty / partial / complete states each render cleanly; responsive layout
      holds on a narrow viewport.

**Safety**
- [ ] XSS: paste hostile content (e.g. `<img src=x onerror=alert(1)>`,
      `</script>`) into every field — it renders as inert text, no execution,
      no broken layout. (Backed by `test/xss.test.mjs`.)

**Article gate**
- [ ] Draft article claims match reality: no promised online-enhance features,
      no "certification"/"legal advice"/"guaranteed pass" language, limitations
      from `ARTICLE-BRIEF.md` §8 are present and not softened.
- [ ] CTA links to `https://dukotah.github.io/vibecheck/`.
- [ ] Reminder recorded: **publishing to Indeed is a manual owner step** — no
      automated posting exists.
