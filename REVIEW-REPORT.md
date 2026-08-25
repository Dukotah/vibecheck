# VibeCheck — Independent Pre-Release Security & QA Review

**Reviewer:** Independent senior security + QA (adversarial, first-principles)
**Date:** 2026-08-25
**Scope:** Full app — 5 check modules, shell, scoring, report export, UI layer, supply chain
**Method:** Static analysis of every source file, `node --test`, a custom adversarial probe (hostile input to every `run()`, ReDoS timing, prototype-pollution, license-classification spot-checks, full-pipeline aggregation), a DOM-shim render pass, and an HTTP smoke test of the served app.

---

## Executive verdict

- **SAFE:** YES (after one fix landed in this review).
- **FUNCTIONAL:** YES — all 5 checks produce correct, non-stubbed, sensible output; the shell wires them end-to-end; the score and report export are correct.
- **Grade: A-**
- **Ready to publish/ship:** **YES.** No open blockers. The one HIGH-severity issue found (a ReDoS in the README check) was fixed, regression-tested, and committed during this review.

The privacy promise ("nothing leaves your browser") is **verified true**: there is zero network egress anywhere in the codebase. There are zero runtime dependencies, no CDN assets, no secrets. The XSS posture is genuinely strong — the UI layer inserts 100% of dynamic text via `textContent`, and generated artifacts (robots.txt, meta tags, README, LICENSE) are either escaped or are plain-text/Markdown the user is deliberately generating from their own content.

---

## Findings table

| # | Sev | Area | File:line | Evidence | Status |
|---|-----|------|-----------|----------|--------|
| 1 | **HIGH** | ReDoS / DoS | `src/modules/docs/analyze.js:80` (old) | Regex `/(```+|~~~+)[^\n]*\n([\s\S]*?)\n\1/` with a `\1` backreference: 1000 backticks = 130ms, 3000 = 3536ms, 6000+ hung past 15s. Reachable from the README textarea (untrusted paste). Freezes the browser tab. | **FIXED** — rewritten as a linear line-scan; commit `7d55217`; regression tests added. |
| 2 | LOW | Performance | `src/modules/accessibility/analyze.js` (multiple `tagsOf` passes) | 30k `<a>` tags (~90KB paste) ≈ 1.2s; 40k ≈ 0.74s. Mildly superlinear from multiple regex passes over a growing string. Not catastrophic backtracking; sub-second for realistic pastes. | OPEN (informational) — optional: cap input length or single-pass tokenize. |
| 3 | LOW | Output trust (Markdown) | `src/report.js:82,98,108`; `src/modules/docs/template.js` | User-pasted text is embedded verbatim into the exported Markdown (findings text, fix labels, generated README). This is by design (the user is exporting their own content) and is copied as `text/markdown`, never rendered as HTML by VibeCheck. If the user pastes that Markdown into a naive HTML renderer elsewhere, that renderer — not VibeCheck — is responsible for escaping. | OPEN (accepted) — no action needed; document the export is raw Markdown. |
| 4 | INFO | A11y polish | `styles/main.css` | No `prefers-contrast` media query; input `:focus` uses `outline:none` + a box-shadow ring (acceptable pattern). Reduced-motion, `:focus-visible`, skip-link, and a print stylesheet are all present and correct. | OPEN (nice-to-have) |

No MEDIUM findings. No other HIGH findings.

---

## What I tested and how

1. **Full source read** of `index.html`, `src/shell.js`, all of `src/ui/*`, `contract.js`, `score.js`, `report.js`, `registry.js`, and every module entry + pure core under `src/modules/**`.
2. **`node --test`** (bare, per house convention) — before and after my fix.
3. **Custom adversarial probe** (`run()` of all 5 modules against empty/undefined/null/garbage/oversized/adversarial inputs; ReDoS timing on regex-heavy paths; prototype-pollution via `__proto__`/`constructor.prototype` JSON; license-classification spot checks; full aggregate + Markdown-export pipeline; incomplete-excluded-from-average invariant).
4. **DOM-shim render pass** — confirmed the existing `test/xss.test.mjs` genuinely renders hostile input through the real UI layer and asserts no live markup (it does; it is not a rubber-stamp).
5. **HTTP smoke test** — served the app and confirmed `index.html`, `src/shell.js`, every JS import, and the stylesheet all return 200; confirmed every `qs('#id')` in the shell has a matching id in `index.html` (`#toast` is created at runtime — correct).
6. **Supply chain** — `git remote` (none), `.gitignore`, absence of `node_modules`/lockfile, and grep for secrets.

---

## Test results

- **Before fix:** 225 tests, 225 pass, 0 fail.
- **After fix:** **227 tests, 227 pass, 0 fail** (added 2 ReDoS regression tests).
- Suite runs bare `node --test`, pure ES modules, zero deps — house conventions preserved.
- **Test quality:** Meaningful, not rubber-stamps. `test/xss.test.mjs` renders through the real UI layer with a faithful DOM shim and asserts no live `<script>/<img>/onerror/javascript:`, plus that the score gauge's CSS custom property is numeric-only (`/^--pct:\d+$/`). Module tests assert real status/score bands, edge cases, determinism of generators, and that `formSpec` examples actually run through `run()` to the expected status. 196 `test()` calls spread evenly across all modules + contract + score + report + registry.

---

## Per-module functional assessment

| Module | Status | Notes |
|--------|--------|-------|
| **legal** | PASS | Correct license risk classification (spot-checked: MIT/Apache/BSD → permissive, GPL → strong-copyleft, AGPL → network-copyleft, `""` → unlicensed, junk → unknown; SPDX expressions handled: `OR` picks safest, `AND` picks riskiest). Missing LICENSE → honest `fail` with a paste-ready MIT file. `describeDep` embeds user dep names, but via `textContent` — safe. Never throws (try/catch + normalizeResult). |
| **accessibility** | PASS | Catches real WCAG 2.2 A/AA basics (lang, title, alt, labels, single h1, generic links, zoom trap, positive tabindex) with an honest "a scan can't check contrast/keyboard" reminder. Applicable-only scoring (a simple page isn't punished for what it lacks). Regex-based HTML scan is linear per pass; see finding #2. |
| **crawlers** | PASS | Curated crawler list has accurate, current UA tokens (GPTBot, ClaudeBot, Google-Extended, PerplexityBot, Bytespider, meta-externalagent, etc.). `sanitizeToken` strips control chars (defence-in-depth against robots.txt line injection — tokens are curated, not user input, so this is belt-and-suspenders). Correctly diffs intent vs. pasted robots.txt; flags the `User-agent: * / Disallow: /` search-killer. Generated robots.txt is exactly what it claims. |
| **sharepreview** | PASS | Tolerant OG/Twitter parser (quote-aware tag scanner, entity decode, comment stripping). `attrEscape` escapes `& " < >` in generated meta-tag **content** (the user-controlled part), so corrected tags are XSS-safe as text and as paste. Relative→absolute + http→https image fixing works. `javascript:` in `og:image`/`pageUrl` is neutralized (escaped as content; never becomes a live href). |
| **docs** | PASS | Scores a pasted README on the essentials (title/description/install/usage/license) with forgiving heuristics for messy AI-generated READMEs; generates a clean starter README from guided answers. `fenceFor` prevents code-fence breakout in generated Markdown. **This is where the HIGH ReDoS lived (`hasCodeBlock`) — now fixed.** |

**Shell (end-to-end):** cards render from the registry, the form renders from `formSpec`, running a check updates findings + the aggregate score + the prioritized fix list, and export produces valid Markdown. `incomplete` checks are correctly excluded from the average (verified: 1 pass + 4 incomplete → score 100, checksRun 1; all incomplete → score 0, status `incomplete`). Copy-fix buttons pass the correct paste-ready text through a clipboard helper with a graceful `execCommand` fallback. Download uses a Blob + object URL (revoked after use); print calls `window.print()`. Export/print buttons are disabled until at least one real result exists.

---

## Safety audit results

- **XSS:** No `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` anywhere. Every dynamic string reaches the DOM via `el(...).textContent` (`src/ui/dom.js`). The only style attribute written from data is the score gauge's `--pct`, clamped to a `Number` 0–100. Generated meta-tag content is HTML-attribute-escaped. Hostile payloads (`<script>`, `<img onerror>`, `"><svg onload>`, `javascript:` URLs, template-breakouts) were fed to all 5 modules and rendered through the real UI layer with zero live markup. **PASS.**
- **Network / privacy:** Zero `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, remote `import()`, external `<script>/<link>/<img>`, analytics, or telemetry. The only external references are placeholder example URLs in strings and the GitHub repo link in the footer. The "nothing leaves your browser" claim is **true**. **PASS.**
- **Dangerous sinks:** No `eval`, `new Function`, string-arg `setTimeout/setInterval`, or `dangerouslySetInnerHTML`-equivalent. No prototype pollution: JSON parsing of `package.json`/lockfiles iterates known keys and never assigns from parsed input into `__proto__`/`constructor`/`prototype` (verified `({}).polluted` unchanged after `__proto__` and `constructor.prototype` payloads). **PASS.**
- **ReDoS:** One catastrophic-backtracking regex found and fixed (finding #1). All other regexes over user input are linear or trivially bounded (verified by scanning for backreferences/nested quantifiers and by timing pathological inputs). **PASS after fix.**
- **Supply chain:** Zero runtime dependencies, no lockfile, no `node_modules`, no CDN assets, no committed secrets/keys/tokens. No git remote configured. **PASS.**
- **Output correctness:** robots.txt, meta tags, LICENSE, and README artifacts contain exactly what they claim; no malformed or misleading output a user would wrongly trust. License tiers are correct and honest (unknown is surfaced as "not automatically safe", never as a false pass). **PASS.**

---

## Non-technical UX assessment

Language is genuinely plain throughout (findings, fixes, form labels, help text avoid jargon or explain it inline). The flow is obvious: pick a check → paste something simple (or click a built-in example) → get a clear score + copy-paste fixes → live overall readiness gauge → export/print. Empty, partial, and complete states are all handled with distinct, encouraging copy. Accessibility is above average for a static tool: semantic landmarks, `aria-live` regions on results/score, labeled inputs, skip-link, visible focus, reduced-motion support, and a print stylesheet. Every example input round-trips through `run()` (asserted in tests), so the "Try an example" buttons always demonstrate real behavior. Nothing is half-built, stubbed, or a placeholder shipped as real; the `.gitkeep` files are empty-dir markers, not dead code.

---

## Recommendation

**Ship it.** VibeCheck is a genuinely safe, genuinely functional, dependency-free, offline, client-side tool that does what it claims for its non-technical audience. The single HIGH-severity issue (README ReDoS) is fixed and regression-tested; remaining findings are LOW/INFO and non-blocking.

**Optional follow-ups (not blockers):**
- Cap textarea input length (e.g. a few hundred KB) as blanket protection against very large pastes hitting finding #2's superlinear accessibility scan.
- Add a one-line note that the exported report is raw Markdown (finding #3).
- Consider a `prefers-contrast` media query for completeness (finding #4).

---

## Changes made during this review

- **`src/modules/docs/analyze.js`** — replaced the ReDoS-prone `hasCodeBlock` regex with a linear O(n) line-by-line fence scanner. Behavior preserved for all real cases (fenced ` ``` ` and `~~~` blocks with content = true, empty fences = false, indented blocks = true, prose = false).
- **`test/docs.test.mjs`** — added two regression tests bounding `hasCodeBlock` and `checkReadme` runtime on a 50,000-backtick payload (would fail on the old regex; pass in <5ms now).
- Committed locally as `7d55217` ("review: fix ReDoS in docs hasCodeBlock…"). No push, no remote added. No test was weakened or deleted.
