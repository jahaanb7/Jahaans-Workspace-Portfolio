---
version: alpha
name: Jahaan-Bhavsar-Scratchbook
description: A pencil-led engineer's scratchbook on warm, grained paper. Graphite line drawings projected from real CAD, a blue ink, a red pencil, dark "plates" for live software figures, a serif display voice for section headlines and a heavy grotesque for the opening. Visuals first; text is one line wherever possible.

colors:
  paper: "#EFEBE0"          # page
  paper-2: "#E6E0D1"
  paper-3: "#F7F4EC"        # scraps and prints
  paper-4: "#E9E2CF"        # yellowed print
  sheet: "#F8F5EC"          # workbench drawing sheets
  rule: "#CBC4B2"           # hairlines
  ink: "#1D1F22"            # text, outlines
  ink-2: "#555A60"          # secondary text, labels
  graphite: "#3B3E42"
  blue: "#2A55B8"           # links, dimensions, focus ring, the opening's key word
  blue-wash: "rgba(42, 85, 184, 0.08)"
  red: "#B3382A"            # red pencil: section numbers, italic display line, active tab, handwritten notes
  tape: "rgba(214, 200, 160, 0.62)"
  plate: "#0B0D0F"          # live software figures
  plate-2: "#15191D"
  plate-rule: "#2B3137"
  plate-ink: "#E6E4DD"
  plate-ink-2: "#A9AEB3"
  plate-blue: "#9EBEF4"
  sand-plate: "#26292D"     # Chladni simulation background
  sand: "#EDE6D3"

typography:
  display:                  # section headlines; second line italic in red
    fontFamily: Newsreader Display (opsz 60), Newsreader, Georgia, serif
    fontSize: clamp(2.7rem, 1.2rem + 5vw, 6rem)
    fontWeight: 420
    lineHeight: 0.98
    letterSpacing: -0.025em
  card-title:
    fontFamily: Newsreader Display
    fontSize: clamp(2rem, 1.3rem + 2.2vw, 3.1rem)
    fontWeight: 420
    lineHeight: 1
  hero:                     # opening only
    fontFamily: Bricolage Grotesque, ui-sans-serif, system-ui
    fontSize: clamp(2.8rem, 1.5rem + 5.4vw, 6.4rem)
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: -0.045em
  heading:
    fontFamily: Bricolage Grotesque
    fontSize: clamp(2rem, 1.5rem + 2.2vw, 3.3rem)
    fontWeight: 700
  tagline:
    fontFamily: Bricolage Grotesque
    fontSize: clamp(1.04rem, 1rem + 0.2vw, 1.14rem)
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: Newsreader (opsz 16), Georgia, serif
    fontSize: clamp(1.04rem, 1rem + 0.2vw, 1.14rem)
    lineHeight: 1.5
  subtitle:
    fontFamily: Newsreader
    fontSize: clamp(1.18rem, 1.1rem + 0.4vw, 1.4rem)
    color: ink-2
  label-mono:               # card numbers, tabs, tags, drawing titles, footers
    fontFamily: ui-monospace, SF Mono, Menlo, Consolas, monospace
    fontSize: 0.62rem–0.76rem
    letterSpacing: 0.08em
    textTransform: uppercase
    fontVariantNumeric: tabular-nums
  hand:                     # short notes only; a font, not Jahaan's handwriting
    fontFamily: Caveat
    fontSize: 1.35rem–1.75rem
    color: red or blue

spacing:
  gutter: clamp(16px, 3vw, 40px)     # plus env(safe-area-inset-*)
  column-gap: clamp(14px, 2vw, 28px)
  section: clamp(3rem, 2rem + 4vw, 6rem)
  section-head-bottom: clamp(2.5rem, 6vw, 5rem)
  wrap: 1280px

radius:
  paper: 2px
  button: 3px 5px 3px 6px   # slightly uneven, hand-cut
  plate: 3px
  pill: 999px               # segmented controls
  round: 50%                # arrow link

elevation:
  print: "0 1px 1px rgba(40,30,10,.08), 0 10px 24px -14px rgba(40,30,10,.45)"
  sheet: "0 1px 1px rgba(60,45,20,.06), 0 2px 4px rgba(60,45,20,.05), 0 22px 40px -22px rgba(60,45,20,.42)"
  sheet-lifted: "0 1px 1px rgba(60,45,20,.06), 0 4px 8px rgba(60,45,20,.06), 0 34px 56px -26px rgba(60,45,20,.5)"
  plate: "0 22px 40px -26px rgba(16,20,24,.7)"

motion:
  fast: 180ms
  base: 260ms
  reveal: 600ms
  turn: 900ms
  ease-out: cubic-bezier(0.2, 0.7, 0.2, 1)
  ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)
---

# Jahaan Bhavsar: scratchbook design system

This is the file to read before changing how the site looks. Tokens above mirror `:root` in
`style.css`; when the two disagree, `style.css` wins and this file should be fixed.
The format follows Google Stitch's DESIGN.md, as collected in VoltAgent/awesome-design-md.
Interaction rules come from Vercel's Web Interface Guidelines (see the end of this file).

## Overview

A student engineer's working scratchbook. The page is warm paper with a fine grain. Line drawings
are projected from the actual CAD meshes in Jahaan's repositories. Live software sits on dark
"plates". A red pencil marks section numbers, active tabs and short handwritten notes. Every
section opens the same way: a mono eyebrow, a two-line serif headline whose second line is red
italic, and a short sans tagline on the right.

**Honesty is part of the design.** Hardware is design-only, so it carries a visible state (dot +
label), footers such as "no dimensions inferred", and **Computed**/**Conceptual** labels where
they apply. Do not remove these to tidy a layout.

## Colors

One palette of blues plus a neutral; everything else is a tint of these (tokens at the end of `style.css`):

| Token | Hex | Dark mode | Light mode |
| --- | --- | --- | --- |
| navy | `#1B3A57` | plates (as `#0F2236`) | headings and body text |
| slate | `#2C3E50` | rules, panel edges | secondary text |
| steel | `#4A6E8D` | secondary fills, fluid at rest | the accent |
| sky | `#A4C8E1` | the accent, live renders | live renders on plates |
| paper | `#F0F0F0` | text (the page is black) | the page |

- One accent per view: the italic headline line, section numbers, active controls and handwriting.
- Live plates are navy with sky renders in both themes.
- Status always comes with a text label, never colour alone.

## Typography

- **Display serif** (Newsreader Display, opsz 60) is for section headlines and card titles. The
  headline is two lines: roman first, then `<em>` on a new line in red italic.
- **Bricolage Grotesque** is for the opening h1, navigation, buttons and taglines.
- **Newsreader text** is for body, subtitles and descriptions, at 46ch or less.
- **Monospace uppercase** is for labels: card numbers (`04 / ORION`), tabs, tags
  (`KICAD / STM32 / CONTROL THEORY`), drawing titles and footers. Numbers are tabular.
- **Caveat** is for notes of five words or fewer. Never use it for body text.
- Headings use `text-wrap: balance` and paragraphs use `pretty`. Use the real `…` character and
  non-breaking spaces in values (`1420&nbsp;MHz`).

## Layout

- Content sits in a 1280px wrap with a fluid gutter and safe-area insets.
- Section head: a grid with the headline on the left and the tagline right-aligned to the
  baseline. It becomes one left-aligned column at 760px and below.
- Workbench: two columns, and the right card starts lower (`.is-low`) so the pair reads as a
  spread. A third, wide card puts its sheet on the left and its text on the right. The cards
  become one column at 900px and below.
- Tab panels share one grid cell (`.paper-stack`), so changing tabs never moves the page.
- Breakpoints in use: 480, 560, 760, 768 (motion), 900, 1024 (motion).

## Elevation & depth

Shadows are layered: an ambient hairline plus a long, soft directional shadow tinted toward the
paper's brown. Sheets lift slightly on hover (fine pointers only). Rotations stay within ±2°.
On phones the tilt is halved, and body text is never rotated.

## Components

### Section head (`.sec-head`)
`p.eyebrow` (red Caveat number plus label), then `h2.display-title` with `<em>`, then `p.sec-tag`
with at most two lines.

### Workbench card (`.bench-card`)
1. `.card-meta`: `NN / NAME` on the left, a state dot and label on the right. The dot pings three
   times, then stops.
2. `.paper`: a sheet tilted by `--tilt`, holding:
   - `.paper-tabs`: mono tabs; the active one is red with a 2px red underline that scales in. ARIA
     tabs with arrow, Home and End keys come from `js/site.js`, which emits `tabs:change`.
   - `.dwg-title` and `.dwg-sub`, the drawing, and a `.paper-note` handwritten in red. Rough
     Notation underlines the note once it has been seen.
   - `.paper-foot`: a mono provenance line, specific to each panel.
3. `.card-body`: a serif title with a 52px round `.arrow-link` (with an `aria-label`), a grey
   subtitle, a one-line description, mono tags, and the generated status slip (date only).

### Line study (`[data-study]`)
These SVGs come from `tools/make_line_studies.py`. Each view is a `g.study-view` with `--v` set
to its index and a mono `study-lbl` such as `01 / elevation`. Visible lines (`.v`) are plotted
in using `pathLength=1` and the dash offset; hidden lines (`.h`) fade in at 0.32. Reduced
motion shows the finished drawing.

### Buttons
- `.btn`: ink outline with uneven radius; it inverts on hover.
- `.arrow-link`: a round outline that inverts on hover, with the arrow nudging up and right.
- Segmented control (`.sand-modes`): a pill using `aria-pressed`.
- Every target is at least 40px high on fine pointers and 44px on coarse pointers.

### Materials
- `.ref-print`: a taped print for references, always captioned as a reference.
- `.scrap`: a torn-edge paper sketch.
- `.plate`: a dark figure that runs code.

## Motion

- Use CSS where possible; GSAP is used only for scroll-linked work on screens 768px and wider.
- Animate only `transform`, `opacity`, `stroke-dashoffset` and `clip-path`.
- Never use `transition: all`.
- With `prefers-reduced-motion: reduce`, everything is instant and the finished state is shown.
- Anything that moves on its own stops by itself:
  - The opening intro takes about 4.6s and stops on any input.
  - The state dot pings three times.
  - The sand simulation runs only while its tab is open and on screen, and stops once it settles.
  - The backdrop (`js/backdrop.js`) draws contour lines of the Chladni plate field, blending
    slowly from one mode pair to the next (14 s each); the nodal line u = 0 is in the accent and
    the mouse presses a small dent into it. About 20 fps, paused in hidden tabs, a still frame
    with reduced motion. Keep it faint.
  - The opening title (`js/hero-title.js`) is annotated like a drawing: guides measured from the
    live font, hatched letters and labels for real geometric features (centroid, inflection,
    chord, vertex). Labels hide below 760px.
  - The fluid plate (`assets/fluid/`, built from the Fluid-Simulation repo's `web/`) loads near the
    viewport, runs only while on screen, and shows a settled still with reduced motion.

## Do's and Don'ts

### Do
- Project drawings from the real meshes; label views and keep "no dimensions inferred" when that is true.
- Keep one red accent per view.
- Write captions as one line. Let the visual carry the idea.
- Check every claim (tags, parts, MCU) against the repository before printing it.
- Give every icon-only control an accessible name and every image an alt.

### Don't
- Don't invent results, dates, measurements or builds. Nothing physical has been built yet.
- Don't add paragraphs where a figure would do.
- Don't use red and blue on the same element, or use colour as the only signal.
- Don't rotate body text, or rotate anything by more than 2°.
- Don't add a font, a framework or a bundler.

## Interface rules (Vercel Web Interface Guidelines, as applied here)

- **Focus:** visible `:focus-visible` rings everywhere, never removed without a replacement, and a
  skip link. Headings and anchors have `scroll-margin-top`.
- **Targets:** at least 24px (44px on mobile). Use `touch-action: manipulation` and a
  tap-highlight tinted to the brand.
- **State:**
  - Tabs follow the APG pattern.
  - Drag and swipe in the scratchbook have button and keyboard equivalents.
  - Async text uses polite `aria-live`.
- **Layout:**
  - No horizontal page scroll; wide drawings scroll inside their own region.
  - Flex and grid children get `min-width: 0`.
  - Respect safe areas, with `viewport-fit=cover`.
- **Performance:**
  - Explicit image dimensions and lazy loading below the fold.
  - Critical fonts are preloaded with `font-display: swap`.
  - Canvases pause off-screen.
- **Theming:** `color-scheme: light`, and `theme-color` matches the paper.
- Audit with `/web-interface-guidelines index.html style.css js/*.js`.
