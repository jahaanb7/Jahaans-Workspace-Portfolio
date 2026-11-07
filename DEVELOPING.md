# Developing the portfolio

A static portfolio written in HTML, CSS and plain JavaScript. There is no framework, no bundler and no backend.

## Preview locally

ES modules need a real server; opening `index.html` as a file shows the static version only.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Layout

```
index.html                  The scratchbook. Blocks between <!-- catalogue:* --> markers are generated.
style.css                   All styles. Colour, type, spacing and motion tokens are in :root at the top.
js/site.js                  Menu, section highlight, schematic tabs, tool picker and matrix (plain script).
js/main.js                  Module entry: starts the figures, workbench, print pile; lazy-loads the scratchbook, Rough Notation and motion.
js/raster-core.js           The rasterizer used by Fig. 1 and Fig. 2 (no DOM; also runs in Node).
js/raster-study.js          Opening figure: sketch → wireframe → shaded intro, controls, pausing, fallbacks.
js/pipeline.js              Rasterix pipeline stages; fluid frame slider and contact sheet.
js/notebook.js              Scratchbook: own page-turn engine (spreads / top-bound pad), contents, list view, keys, drag, swipe.
js/workbench.js             Workbench cards: line studies plot in, note underlines, the Chladni sand simulation.
js/fan.js                   The Rasterix print pile.
js/orbital.js               QuantumSim orbital explorer: canvas drawing only, physics from js/quantumsim/.
js/quantumsim/orbitals.js   Unmodified copy of QuantumSim's src/physics/orbitals.js (commit in SOURCE.json). Do not edit.
js/motion.js                Scroll motion for tablets and desktops (GSAP + ScrollTrigger).
projects/*.html             Case studies for the three featured projects.
data/projects.json          Project facts: title, question, status, milestone, next step, links.
data/experiments.json       Scratchbook pages per project: layout, figure, sketch, observation, open question, tools.
data/skills.json            Methods and instruments: tool groups and the tool-by-project matrix.
data/notes.json             Published writing.
assets/drawings/*.svg       Drawing sheets, inlined into index.html by the catalogue script.
assets/sketches/*.svg       Rough.js sketches and computed Chladni lines, inlined the same way.
assets/vendor/              GSAP 3.12.5, ScrollTrigger, Rough Notation 0.5.1 (with licences).
tools/sync-quantumsim.mjs   Re-copies orbitals.js from github.com/jahaanb7/QuantumSim (--check to verify).
tools/build-catalogue.mjs   Writes status slips, drawings, notebook, skills and writing into index.html.
tools/stl_to_drawing.py     Projects STL meshes to visible and hidden edges (needs numpy).
tools/make_orion_sheet.py   Builds assets/drawings/orion-airframe.svg from that projection.
tools/make-sketches.mjs     Draws assets/sketches/*.svg with Rough.js (vendored in tools/vendor/, fixed seeds).
tools/make_chladni_sheet.py Chladni enclosure drawing from the ChladniPlate STLs.
tools/make_chladni_modes.py Computed Chladni nodal lines.
tools/make_line_studies.py  Workbench line studies (orion-study.svg, chladni-study.svg) and the shaded chladni-cad.webp, from the STLs.
DESIGN.md                   The design system: tokens, components, motion and interface rules. Read this first.
DESIGN_DIRECTION.md         Story, references and asset map for this version (DESIGN_BRIEF.md is the previous one).
CREDITS.md                  Asset record: sources, rights, placement.
```

## Where to edit things

| To change | Edit | Then |
|---|---|---|
| A project's status, milestone, next step or links | `data/projects.json` | `node tools/build-catalogue.mjs` |
| A scratchbook page (layout, figure, sketch, observation, note) | `data/experiments.json` | same |
| Add a notebook page | add an entry with a `projectId` that exists in `projects.json` | same |
| Skills and the tool matrix | `data/skills.json` (list only projects whose repository shows the tool) | same |
| Writing | `data/notes.json` | same |
| Featured project figures and captions | `index.html` directly | — |
| A sketch | `tools/make-sketches.mjs` | `node tools/make-sketches.mjs`, then the catalogue script |
| Drawing sheets | the SVG in `assets/drawings/`, or rerun the two Python tools for Orion | `node tools/build-catalogue.mjs` |
| Workbench cards (tabs, notes, tags) | `index.html`, `#workbench` (`data-note` gets the red underline) | — |
| Workbench line studies / CAD view | `python3 tools/make_line_studies.py <Orion repo> <ChladniPlate repo> [--cad]` | `node tools/build-catalogue.mjs` |
| Motion timing | `--dur-*` and `--ease-*` in `style.css`; `MOTION` in `js/motion.js`; `TURN_MS` in `js/notebook.js` | — |
| Colours and type | tokens at the top of `style.css` | — |

Allowed statuses: `Working prototype`, `In progress`, `Planned`, `Archived`. Only write what has actually happened, and never fill `updatedAt` with today's date.

`node tools/build-catalogue.mjs --check` exits with an error if `index.html` is out of date.

## How the interactive parts degrade

- **No JavaScript:** every figure shows a static image, workbench tab panels are listed one after another, the prints sit side by side, the scratchbook shows its list view, both schematic sheets are visible.
- **Reduced motion:** no scroll motion, pinning, plotting or opening sequence; the sand simulation shows its settled pattern; the scratchbook changes pages instantly.
- **Tablets (768 to 1023 px):** no scroll-linked motion; line studies still plot in when seen.
- **Phones:** no scroll motion; the ATLAS diagram scrolls sideways; every button, slider and tab works.
- **Scratchbook:** two-page spreads from 760 px of stage width (leaf turns on the spine), a top-bound pad below that. Page height follows the longest entry.

## Regenerate the Orion drawing

```bash
python3 tools/stl_to_drawing.py <path-to-Orion-repo>/CAD tools/data/orion-geometry.json
python3 tools/make_orion_sheet.py tools/data/orion-geometry.json assets/drawings/orion-airframe.svg
node tools/build-catalogue.mjs
```

## Refresh GitHub metadata

```bash
node tools/refresh-github.mjs
# optional, for a higher rate limit:
GITHUB_TOKEN=... node tools/refresh-github.mjs
```

The script only fetches repositories named in `projects.json`. It never edits editorial text. If a repository is missing or the API fails, the previous cache entry is kept. The token is read from the environment and is never printed or saved.

## Replace an image

Put the new file in `assets/images/` (WebP, around 1,200 to 1,600 px wide), update `image`, `imageWidth`, `imageHeight` and `imageAlt` in the JSON, and rerun the catalogue script. Case-study pages reference images directly in their HTML.

If you change the hero mesh or pose, run `node tools/render-hero-frame.mjs` to regenerate the static frame.

## Deploy

### GitHub Pages

1. Push this folder to a repository, for example `jahaanb7.github.io` (served at the root) or `portfolio` (served at `/portfolio/`).
2. In the repository settings, open Pages, choose "Deploy from a branch", then `main` and `/ (root)`.
3. All paths are relative, so the site works at the root and in a subfolder.

### Any static host (for example Hostinger)

Upload every file except `tools/`, `BUILD-PLAN.md`, `DESIGN.md`, `DESIGN_BRIEF.md`, `DESIGN_DIRECTION.md`, `.agents/`, `.claude/` and `skills-lock.json`. No build step is needed.

### After the URL is known

Add `<link rel="canonical">`, `og:url` and an absolute `og:image` to each page, and a `sitemap.xml`. These are left out until then on purpose.

## Credits

See CREDITS.md. In short: Bricolage Grotesque, Newsreader and Caveat (SIL OFL); Rough.js and Rough Notation (MIT); GSAP and ScrollTrigger (standard GSAP licence); the Galileo (1610) image is public domain; the hero mesh is Blender's Suzanne.
