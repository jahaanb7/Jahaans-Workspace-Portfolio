# Credits and asset record

Everything not made for this site, with its source and rights, plus where it is used.
Project media (renders, screenshots, schematics, CAD projections) comes from Jahaan's own repositories.

## Reference images (public domain)

| File | Creator | Source | Rights | Used in |
| --- | --- | --- | --- | --- |
| `assets/images/ref-galileo-moon.webp` | Galileo Galilei, *Sidereus Nuncius*, 1610 | [Wikimedia Commons: Sidereus_Nuncius_half_moon.jpg](https://commons.wikimedia.org/wiki/File:Sidereus_Nuncius_half_moon.jpg) | Public domain | Opening, labelled as a reference, not Jahaan's drawing |
| `assets/images/ref-goddard-1926.webp` | Photo: Esther C. Goddard, 8 March 1926 (Great Images in NASA) | [Wikimedia Commons: Goddard_and_Rocket.jpg](https://commons.wikimedia.org/wiki/File:Goddard_and_Rocket.jpg) | Public domain | Not placed in the current layout (kept for later) |

Downloaded once, resized and converted to WebP. `Galileo_moon_phases.jpg` (Commons, public domain) was also downloaded but is not used yet.

## Generated on this site (no third-party content)

| File | How it is made |
| --- | --- |
| `assets/sketches/suzanne-sketch.svg` | `tools/make-sketches.mjs`: silhouette and crease edges of `assets/mesh/hero-mesh.json`, drawn with Rough.js |
| `assets/sketches/projection.svg`, `orbital-radial.svg`, `verlet.svg`, `buffy-scopes.svg`, `arrow-*.svg`, `frame-*.svg` | `tools/make-sketches.mjs` (fixed seeds, so output is stable) |
| `assets/sketches/chladni-modes.svg` | `tools/make_chladni_modes.py`: computed nodal lines, not observations |
| `assets/drawings/chladni-enclosure.svg` | `tools/make_chladni_sheet.py` from `ChladniPlate/production/enclosure_V2.stl` and `enclosure_cap.stl` |
| `assets/images/chladni-schematic.webp` | KiCad 10 CLI export of `ChladniPlate_Schematic.kicad_sch`, cropped |
| `assets/drawings/orion-study.svg` | `tools/make_line_studies.py` from `Orion/CAD/Orion_Master_V0.1.stl`: elevation, oblique and plan projections, hidden lines removed |
| `assets/drawings/chladni-study.svg` | `tools/make_line_studies.py` from the two ChladniPlate enclosure STLs: oblique and plan projections |
| `assets/images/chladni-cad.webp` | `tools/make_line_studies.py --cad`: flat-shaded z-buffer render of the same STLs, with projected edges |
| Sand simulation (Workbench, Patterns tab) | `js/workbench.js`: particles on the computed displacement of an ideal square plate, not a recording |

## Code and fonts

| Item | Licence | Location |
| --- | --- | --- |
| Rough.js 4.6.6 (Preet Shihn) | MIT | `tools/vendor/` (build time only) |
| Rough Notation 0.5.1 (Preet Shihn) | MIT | `assets/vendor/` |
| GSAP 3.12.5 and ScrollTrigger | GreenSock standard licence | `assets/vendor/` |
| Bricolage Grotesque | SIL OFL 1.1 | `assets/fonts/` (`OFL-bricolage.txt`) |
| Newsreader (text cut, plus display roman and italic instanced at opsz 60 from [google/fonts](https://github.com/google/fonts/tree/main/ofl/newsreader)) | SIL OFL 1.1 (`OFL-newsreader.txt`) | `assets/fonts/` |
| Caveat | SIL OFL 1.1 | `assets/fonts/` (`OFL-caveat.txt`) |
| Suzanne mesh | Blender Foundation test model | via the Rasterix repository |

The print-pile interaction is an original re-implementation of the idea in Codrops' StackMotionHoverEffects; no code or artwork from that demo is included.

## Design references (rules, not assets)

| Source | What it informed |
| --- | --- |
| [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) (Vercel Web Interface Guidelines) | Accessibility, focus, targets, motion and typography rules; see `DESIGN.md` |
| [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) | The `DESIGN.md` format (Google Stitch): tokens in front matter, then rules. No design was copied |
