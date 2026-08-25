# VibeCheck — design system notes

A full visual redesign of the working app. Zero new dependencies, no build step,
no external network requests. The goal: make VibeCheck read like a polished,
professionally-built product (Linear / Vercel / Stripe / Raycast caliber) so the
vibecoders it serves trust it.

Everything below is implemented in `styles/main.css` (design system), `index.html`
(hero/header markup), and `src/ui/*.js` (crafted inline-SVG icons + SVG score
ring). Check logic under `src/modules/`, `src/{contract,registry,score,report}.js`
was **not touched**.

## Design tokens (all in `:root`)

- **Neutral ramp** — a cool slate scale `--n-0 … --n-900` (11 stops). One family,
  no random grays. Semantic roles (`--bg`, `--surface`, `--surface-2/3`, `--line*`,
  `--ink … --ink-4`) are mapped onto the ramp so nothing is hardcoded ad-hoc.
- **Brand** — a single confident indigo-violet (`--brand #5b57e0`) with a 600/700
  darken for AA text/hover and 050/100 tints for soft fills. Replaces the previous
  teal + gradient-soup. One brand color, used with restraint.
- **Semantic pass/warn/fail** — each ships a base (AA text on white), a `-600`
  (AA text on its own soft tint), a `-soft` fill, and a `-line` border. This is why
  every colored chip/finding/card has a matched fill + border + readable text.
- **Type** — system font stack only (`-apple-system, "Segoe UI", Roboto, …`), no web
  fonts. A fluid ~1.2 modular scale `--fs-xs … --fs-2xl` with three line-heights and
  two tracking values, so hierarchy is deliberate (eyebrow → title → sub → body).
- **Space** — a 4px-based scale `--sp-1 … --sp-20`. Every margin/padding/gap uses it,
  which kills the off-grid, "eyeballed" spacing tell.
- **Radius** — `--r-xs … --r-xl` + `--r-pill`, a coherent rounding language.
- **Elevation** — four cool-tinted shadows `--sh-xs … --sh-lg` plus a `--sh-focus`
  ring. Shadows are soft and layered, not the default harsh drop-shadow.
- **Motion** — `--dur .18s` + a single `--ease` cubic-bezier shared by every
  transition, so interactions feel like one system.

## Color roles (quick reference)

| Role | Token | Use |
|------|-------|-----|
| Primary text | `--ink` (16.9:1) | headings, body |
| Secondary text | `--ink-2` (9.8:1) | subtitles, taglines, help |
| Tertiary text | `--ink-3` (4.6:1) | captions, progress |
| Decorative | `--ink-4` | large numerals, placeholders only |
| Brand text/links | `--brand-700` (8.5:1) | links, eyebrow, icons |
| Pass / Warn / Fail | `--pass/-600`, `--warn/-600`, `--fail/-600` | states |

## Motion principles

- Animate **on enter**, ease-out, subtle: results slide up 8px + fade over ~320ms;
  the score ring animates its arc over 700ms; cards lift 3px on hover.
- No looping, flashing, or attention-grabbing motion. Transitions are compositor-
  friendly (transform/opacity/box-shadow).
- **`prefers-reduced-motion: reduce`** collapses every transition/animation to
  ~0ms globally and disables the ring sweep and smooth scroll.

## What removed the "vibecoded" look

1. **Emoji-as-icons → crafted inline SVG.** The brand check, the 🔒/lock, per-check
   glyphs, status badges, and finding marks are now a cohesive stroked 24px icon set
   authored in `src/ui/cards.js` / `results.js` (via a namespaced `icon()` helper in
   `dom.js`). One distinct icon per check (scale, person-in-ring, robot, share card,
   document).
2. **Gradient soup → one restrained brand + soft ambient wash.** A single indigo
   brand; the hero gets one subtle radial glow, not competing gradients.
3. **Off-grid spacing → 4px space scale** applied everywhere.
4. **Flat status → a real semantic system.** Cards carry a colored top-rule + tinted
   icon + matched badge; findings are tinted rows with a filled circular glyph.
5. **Plain conic gauge → crisp SVG progress ring** with tabular-figure score, animated
   arc, status-colored stroke — a genuine hero moment.
6. **Trust signals productized** — header meta with dot separators, hero trust pills
   with inline SVG icons (in-browser / MIT / offline).
7. **Buttons that look clickable** — layered gradient + inset highlight + shadow on
   the primary; bordered elevated ghost; arrow that nudges on hover; clear active/
   disabled/focus states.
8. **Consistent forms, focus rings, empty states**, and a branded print stylesheet
   for the exported report.

## Constraints kept intact

- **Zero network egress** — no web fonts, CDNs, remote images/scripts/styles, or
  `fetch`. Verified by grep. All icons are inline SVG authored in-repo.
- **XSS-safe** — all dynamic/user text still renders via `textContent`; the new SVG
  icons are developer-authored literals with no user input. The adversarial
  `xss.test.mjs` suite renders the new card grid / results / gauge and passes.
- **Functionality preserved** — all 5 checks, forms, run→findings→fixes, live gauge,
  prioritized fix list, and copy/download/print export are unchanged in behavior.
- **Tests green** — `node --test` → 227/227 pass.
- **Accessibility** — AA contrast (verified numerically), visible `:focus-visible`
  rings, semantic HTML, keyboard-operable, reduced-motion honored.
- **Responsive** — mobile-first; grids collapse via `auto-fit`/`auto-fill` and
  explicit breakpoints at 560/880px; hero/type fluid via `clamp()`.

## Before / after

Before: a competent but generic light theme — teal accent, emoji icons, plain
symbol badges, a conic-gradient gauge, some gradient-in-the-background feel, and
`ink`/gray text without a formal ramp.

After: a token-driven system with one confident brand, a full neutral ramp, a
crafted SVG icon set, semantic state chips with matched fill/border/text, an
animated SVG score ring, productized trust signals, and cohesive motion — all AA,
reduced-motion-safe, and still 100% offline and XSS-safe.
