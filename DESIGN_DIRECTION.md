# Design direction: the scratchbook

Written 2026-11-06. Replaces the "engineering journal" brief (DESIGN_BRIEF.md).

## Aesthetic

A pencil-led engineer's scratchbook: warm paper with grain, graphite lines, a blue ink and a red pencil.
Real project media is taped, clipped or pasted in. **Visuals first, very little text**: one-line
captions, handwritten questions, status chips. Honesty labels always stay (design only, computed,
conceptual, reference).

Type: Newsreader Display (section headlines, red italic second line), Bricolage Grotesque (opening, navigation, taglines), Newsreader (text), Caveat (short notes only; it is a font, not
Jahaan's handwriting), system monospace (labels).

## Reference map

| Reference | What was taken | Status |
| --- | --- | --- |
| Scout Graphics (scoutgraphics.com) | Tactile collage on warm off-white; drawn marks between sections | Inspected |
| Tiago Fragoso (tiagofragoso.com) | Hand-drawn frames, a hand line that recurs down the page | Inspected |
| Shawn Golden (shawngolden.org) | Playful controls inside a strict grid | Inspected |
| Daniel Sun (danielsun.space) | Caveat used sparingly next to a clean sans | Inspected |
| Codrops StackMotionHoverEffects | The pile of prints that fans out (re-implemented, nothing copied) | Inspected |
| Codrops articles (ITom, van der Sanden) | Not accessible (blocked to automated fetches) | Not used |

## Story flow

Curiosity (opening: sketch → wireframe → render, Galileo reference) → Investigations (Rasterix,
QuantumSim, Fluid) → Making (Workbench "Code meets the physical world.": Orion, Chladni and ATLAS cards) →
Loose experiments (scratchbook) → Tools, writing, about.

## Asset-to-section map

| Section | Assets |
| --- | --- |
| Opening | Live rasterizer, `suzanne-sketch.svg`, `ref-galileo-moon.webp` |
| Rasterix | Pipeline canvas and stage frames, `projection.svg`, Java renders in the print pile |
| QuantumSim | `qs-fig03-clouds.webp`, `orbital-radial.svg`, `qs-fig06-tunnel-snapshots.webp` |
| Fluid | Six `fluid-seq-*.webp` frames as a dark contact sheet |
| Workbench | `orion-study.svg`, `orion-cad.webp`, Orion schematics, `chladni-study.svg`, `chladni-cad.webp`, live sand simulation, `chladni-schematic.webp`, `atlas-concept.svg` |
| Scratchbook | Entry figures from `data/experiments.json`, `verlet.svg`, `buffy-scopes.svg` |
| Tools | Tool buttons, project matrix (behind a toggle) |
| Writing | Two clippings from `data/notes.json` |

## Motion plan

- **Lead:** the workbench line studies plot themselves in view by view (CSS, all screen sizes),
  then the red handwritten note is underlined by Rough Notation. Re-selecting the tab plots again.
  The Chladni "Patterns" tab runs a sand simulation that settles on computed nodal lines.
- **Supporting:** the opening sketch → wireframe → shaded sequence (once, stops on interaction);
  the scratchbook page turn (own engine: spreads turn on the spine, phones flip a top-bound pad;
  buttons, arrow keys, corner drag, swipe; instant with reduced motion); the Rasterix print pile.
- **Secondary:** pipeline pin (desktop), other drawings ink in, fluid frames follow scroll, prints drift.
- Tokens: 180 / 260 / 600 / 900 ms (`--dur-*` in style.css, `MOTION` in js/motion.js).
- Rotations stay within ±2°; body text and captions stay level.

The design system itself (tokens, components, rules) lives in DESIGN.md.
