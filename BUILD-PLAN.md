# Jahaan Bhavsar Portfolio: Build Plan

Status: **approved and built (first release, 2026-11-06).** Since approval: ATLAS and the Chladni plate have no hardware built; contact is GitHub only; the two Medium articles were added as Notes; the hero mesh uses the full 968-triangle Suzanne (cheap enough at 320 px).
Investigation date: 2026-11-06. Sources: the public GitHub profile `jahaanb7`, the GitHub API, shallow clones of all 13 public repositories, and the brief in `Jahaan_Portfolio_Claude_Code_Prompt.md`.

Decisions confirmed by Jahaan during planning:

- All listed projects are **solo work**, including Orion and Myelovar.
- Contact is **GitHub only** for the first release. No email is published.

---

## 1. Website overview and audience

A static, hand-built portfolio for Jahaan Bhavsar, a student builder in Brampton, Ontario, who works across graphics, physics simulation, embedded hardware, and applied ML.

Audiences, in priority order:

1. **People assessing engineering work** (programs, mentors, internships). They need to see quickly what was built, how, and whether it works. They will click through to source.
2. **Technically curious visitors and other builders.** They want one thing they can play with and a clear explanation.
3. **Potential collaborators.** They need to see what is active now and how to reach Jahaan.

Success: a visitor leaves remembering a rasterizer they rotated in the hero, a quantum simulation that checks its own numbers, a fluid made of particles, and a rocket flight computer being designed in the open.

## 2. Core positioning and brand personality

**Positioning:** a student who learns an idea by implementing it, testing it, and explaining what happened.

**Line:** "I build things to understand things."

**Personality:** curious, exact, unhurried. Confidence comes from artifacts and stated limits, not adjectives. First person, plain words, short paragraphs. No mission-control voice, no invented company, no em dashes in public copy.

## 3. GitHub evidence inventory

Legend for "Checked": **Ran** = executed by me during planning. **Built** = compiled by me. **URL** = HTTP-checked. **Read** = source inspected only.

| Project | Current URL | Observed tech | What the code / artifacts demonstrate | Stated only in docs | Media available | Demo | Checked | Status |
|---|---|---|---|---|---|---|---|---|
| **Rasterix** | github.com/jahaanb7/Rasterix-Software-Rasterizer- | Java, Swing/AWT `BufferedImage` for pixel output only | 1,483 lines. Hand-written vectors, matrices, quaternion camera, OBJ loader, perspective matrix, backface culling via cross/dot product, Lambert-style directional shading, edge-function **barycentric** triangle fill, z-buffer, Bresenham lines, textured triangles. | "Smooth 60 FPS" (not measured). | 10 OBJ meshes + textures in `resources/`. **No screenshots in repo.** | 4 GitHub Releases (v1.0.0 to v1.3.0, Jan 2026) with macOS/Windows/Linux builds. CI passing (2026-02-02). | **Built** (javac 25, all 16 classes compile). Window not run. | Working prototype |
| **QuantumSim** | github.com/jahaanb7/QuantumSim | Vanilla JS ES modules, Three.js r180 (vendored), WebGL2 | ~6,650 lines. Monte-Carlo sampling of hydrogen-like `\|ψ\|²`, analytic 2D infinite well, split-step Fourier TDSE solver for tunneling, custom FFT, 1,618-line field-guide explainer. | Numerical accuracy beyond the sanity check. | **10 generated figures** in `docs/figures/` (1,400 to 1,900 px wide): clouds, radial, box states, tunneling snapshots, spacetime, transmission. | **No hosted demo** (GitHub Pages 404). Runs locally with a static server. | **Ran** README sanity check in Node: norm 1.0000, packet T 0.0404, plane-wave T 0.0324, grid 1024. Matches README. | Working prototype, active (pushed 2026-11-04) |
| **Fluid simulation** | github.com/jahaanb7/Fluid-Simulation | C++17, OpenGL, GLFW, GLAD, ImGui, GLM, OpenMP | 1,068 lines. 3D SPH with Poly6 density, Spiky gradient pressure, viscosity Laplacian, hashed spatial grid (27-cell neighbour search), Verlet integration, mouse "stir", impulse, live sliders. | None beyond controls. | **No screenshots or video in repo.** | None. **Latest CI run failed** (2026-04-24). | Read only. | Working prototype (last push 2026-04-24) |
| **Orion** | github.com/jahaanb7/Orion | KiCad schematics (5 sheets), STL CAD, Markdown journal | Schematic sheets: power, navigation sensors, flight compute module, peripherals. Airframe/nose cone/motor STLs. BOM. Week-1 journal (Sept 14 to 20, 2026) with design reasoning. | Flight goal (30 to 40 m, PID-stabilised TVC). No firmware, PCB layout, or test data yet. | 5 schematic/CAD screenshots in journal + 4 in README (GitHub user-attachments). | None. | Read only. | In progress (pushed 2026-10-06) |
| **ATLAS radio telescope** | github.com/jahaanb7/RadioTelescope_ALTAS (spelling kept) | None yet | **Two-line README only.** No code, CAD, or data. | 1 m dish, hydrogen-line detection. | None. | None. | Read only. | Planned (see §22) |
| **Myelovar** (display name from package `myelovar`) | github.com/jahaanb7/BioMedizone_Hackathon | Python package, FastAPI, React/Vite UI, Docker, pytest | 7-stage pipeline (s0 to s6): VCF/GWAS input, common-variant filter, ENCODE MM.1S regulatory overlap, JASPAR motif disruption, ABC gene linking, DepMap relevance, weighted score with per-variant explanation. 33 tests claimed. | Funnel counts (3.94M to 48,113) and validation statistics. **Not independently verified.** | 4 validation figures (funnel, enrichment, score histogram, lead ranks). | Local only (`make api`, precomputed demo). | Read only. | Working prototype (hackathon) |
| **Particle simulation** | github.com/jahaanb7/Science-Simulations | C++, OpenGL, GLFW, GLAD, GLM, Emscripten | Velocity Verlet, inverse-square gravity, elastic collisions, boundary sphere, free camera. | Repo description promises black holes etc. that are not in code. | None in repo. | **Live web build** at jahaanb7.github.io/Science-Simulations (HTTP 200, Emscripten). 2 releases. CI passing. | **URL** checked, not interacted. | Working prototype |
| **Chladni plate** | github.com/jahaanb7/ChladniPlate | KiCad, STEP/STL CAD, BOM | Full assembly guide, priced BOM (CA$83.09), schematic PDF, enclosure STLs. | Pattern results (no photos of sand patterns). | Wiring diagrams + CAD renders (README attachments). | Physical build. | Read only. | Working prototype (assumed built; no photo, see §22) |
| **Lorenz attractor** | github.com/jahaanb7/Lorenz-Attractor-Simulation | Python, Jupyter, Matplotlib | 2-cell notebook with one rendered plot; README notes on chaos and Van der Pol. | n/a | 1 PNG embedded in notebook output. | n/a | Read only. | Archived |
| **ML from scratch** | github.com/jahaanb7/Machine-Learning-Models | Jupyter, NumPy, pandas | Linear regression, normal-equation regression, logistic regression, NumPy tutorial. `Naive_Bayes.ipynb` is **empty/invalid**. | "From scratch" (true for model logic; uses NumPy). | Notebook plots. | n/a | Read only. | Archived / learning log |
| **Buffy (assistant)** | github.com/jahaanb7/J.A.R.V.I.S | Electron, TypeScript, Ollama, optional Anthropic API, Vitest | Desktop assistant with tool calls, approval-gated code tools, calendar, memory, phone companion page, unit tests. | **Repo description says "transformer LLM from scratch in Python": does not match the code.** | None. | Desktop only. | Read only. | In progress (pushed 2026-10-22, single commit) |
| MINI_JARVIS | github.com/jahaanb7/MINI_JARVIS | Python speech-to-text, TTS | Earlier voice-assistant prototype. | | | | Read | Archived, folded into Buffy's entry as "earlier version" |
| Profile README | github.com/jahaanb7/jahaanb7 | | Banner image, interests line, bio sentence quoted in the brief. | | Banner image | | Read | n/a |

### Content uncertainties and corrections to surface

1. **GitHub bio changed.** The account bio now reads "Class of 2028 - Highschool". The sentence quoted in the brief lives in the profile README. I will use the README sentence.
2. **Orion's repository description says "Making a High Speed Drone from scratch"**, while its README and journal describe a TVC rocket. The site will say rocket. Recommend updating the GitHub description.
3. **Orion journal fact check:** it says the STM32F7 runs "around 480 MHz". STM32F7 parts top out at 216 MHz; 480 MHz is the STM32H7 family. The site will not repeat the clock figure until Jahaan confirms the exact part number.
4. **J.A.R.V.I.S description** claims a from-scratch transformer LLM; the code is an Electron assistant using Ollama or Claude. The site will describe the code. Recommend updating the description.
5. **Rasterix README** clone and release links still point to the old name `Software-Rasterizer`. GitHub redirects them, but the site links to the current URL.
6. **Rasterix `src/main/web/`** is a 7-line stub. The hero study is a new, separate browser implementation and will be described that way.
7. **Fluid simulation CI is red.** The site will not link a build badge. Fixing CI is recommended before promoting downloads.
8. **No screenshots** exist for Rasterix, the fluid sim, or the particle sim. These are the most important media gaps (see §17).
9. **Community facts** (CodeCraft Academy, Hack Club sponsorship, FRC 1325, Haven Hack Club, CPSS) have no public source I could check. They will be marked self-reported and held for Jahaan's confirmation of wording.

## 4. Narrative and curation decisions

Every project is told as **Question → Model → Implementation → Observation → Next question**.

Tiering:

| Tier | Projects | Treatment |
|---|---|---|
| Featured (own case-study pages) | Rasterix, QuantumSim, Fluid simulation | Large editorial sections on the homepage + full page each |
| Workbench (prominent, in progress) | Orion, ATLAS | Status rows with milestone, next step, date |
| Supporting work (compact index) | Myelovar, Particle simulation, Chladni plate, Buffy, Lorenz, ML notebooks | Text rows with one-line question, tech, status, source link |

Why this order: Rasterix connects directly to the hero; QuantumSim is the most complete and best-documented; the fluid sim shows numerical methods in C++. Orion is compelling development but not finished, so it leads the workbench rather than the featured list. Myelovar is strong engineering but in a domain where overclaiming is risky, so it sits in supporting work with careful wording.

MINI_JARVIS is mentioned only inside Buffy's entry ("an earlier Python prototype"). It is not listed separately.

## 5. Website structure and navigation

```
/                      Home
/projects/rasterix.html
/projects/quantumsim.html
/projects/fluid-simulation.html
```

Homepage sections, in order:

1. Hero with rasterization study
2. Evidence strip
3. Selected work (3 featured)
4. Workbench + Next questions
5. Supporting work index (data-driven, filterable only if ≥ 8 entries)
6. How I work (simulate, build, explain) + About
7. Teaching and teams (2 to 3 items, after confirmation)
8. Final CTA
9. Footer

Field notes are **omitted from the first release** (none written and checked yet). The nav shows **Work, Workbench, About, GitHub**; "Notes" is added when the first note ships (see §12).

Navigation: sticky compact bar, left-aligned name, links right. Below 720 px it becomes a disclosure menu button (`aria-expanded`, Escape closes, focus returns). Project pages show a breadcrumb back to `Work`.

## 6. Hero copy and rasterization-study specification

**Eyebrow:** Jahaan Bhavsar / Brampton, Ontario
**Headline:** I build things / to understand things.
**Supporting copy (proposed, same length):** I turn physics and math into renderers, simulations, and hardware I can test.
**Primary CTA:** Explore my work (anchor to `#work`)
**Secondary CTA:** GitHub (external)

**Study caption:** A browser study of the graphics pipeline I explored in Java. → links to the Rasterix case study.

Rasterization study:

- Vanilla JS + 2D Canvas. **No WebGL, no Three.js.** Writes to an `ImageData` buffer at reduced internal resolution (≈ 320×320 desktop, 220×220 mobile), upscaled with `image-rendering: pixelated` so pixels read as pixels.
- Real pipeline mirroring Rasterix: model rotation (quaternion), view transform, the same perspective matrix shown in the Rasterix README, perspective divide, viewport map, backface culling, flat directional shading, edge-function barycentric fill, z-buffer.
- Mesh: a low-poly mesh from Rasterix's own `resources/` (decimated `monkey.obj` to ≈ 300 to 500 triangles), shipped as a compact JSON. Fallback: a procedural icosphere if the decimation looks poor.
- Modes: **Vertices**, **Wireframe**, **Shaded**. Segmented control, buttons with `aria-pressed`.
- Controls: Pause/Play, rotate left/right/up/down buttons (keyboard operable, held = continuous), Reset. Pointer drag on the canvas is optional and uses `touch-action: pan-y` so vertical scrolling is never captured.
- Auto-rotates on load. Stops when offscreen (`IntersectionObserver`), when `document.hidden`, or when paused.
- `prefers-reduced-motion`: no auto-rotation; renders one static shaded frame; controls still work step-wise.
- No-JS / failure: a pre-rendered PNG of the same mesh (generated from the study itself) sits in the markup and is replaced by the canvas on successful init.
- Live readout in mono: triangle count drawn / culled, current mode. Numbers are computed, not decorative.

## 7. Evidence strip

No animated counters. A single row of plain, verifiable labels:

`Java software rasterizer · 4 releases` · `Split-step Fourier TDSE in the browser` · `3D SPH in C++/OpenGL` · `KiCad flight computer in progress`

Each label links to its source. Counts appear only where they are checkable on GitHub.

## 8. Mission and three pillars

Short intro: "Most of what I make starts as a question I could not answer by reading."

| Pillar | Meaning | Proof |
|---|---|---|
| **Simulate** | Write the equations as code and watch them run. | QuantumSim, fluid sim, particle sim, Lorenz |
| **Build** | Make it physical or make it ship. | Orion, Chladni plate, Rasterix releases |
| **Explain** | Write down what happened, including what did not work. | QuantumSim field guide, Orion journal, fluid README |

## 9. Story, teaching, teams, and community

Short About, first person, about 120 words: learn an idea, implement it, test it, explain it. Interests listed once in plain text.

Teaching and teams: pick **two or three** after Jahaan confirms wording:

- CodeCraft Academy: founder; "taught 170+ students" shown as self-reported ("about 170 students so far, by my count") unless a source is provided. Hack Club fiscal sponsorship stated only if confirmed.
- FRC Team 1325: programming role, exact wording confirmed.
- Haven Hack Club: "organizing" vs "organized" depends on whether the event has happened.

No awards, sponsors, or outcomes are invented. CPSS outreach is dropped unless Jahaan wants it.

Tools (compact, tied to work): Java, C++, Python, JavaScript, TypeScript, OpenGL, KiCad, Git, NumPy. **STM32** listed only once firmware exists or Jahaan confirms hands-on use.

## 10. Featured work and case-study outlines

Homepage treatment: each featured project gets a full-width editorial block with alternating proportions (image 7/12 + text 5/12, then reversed, then a full-bleed figure with text beneath), not three identical cards. Each block: question, two-sentence explanation, status label, Source / Case study / Demo or Download actions.

Each case-study page follows the same skeleton:

1. **Overview** (non-specialist, ~80 words) + hero figure
2. **Question**
3. **Model**: the central maths, typeset in HTML/MathML-friendly markup, short
4. **Implementation**: file map + 1 to 3 real source excerpts with line references
5. **A design decision and why**
6. **Observation**: evidence of current behaviour
7. **Limits and next question**
8. Links + credits

| | Rasterix | QuantumSim | Fluid simulation |
|---|---|---|---|
| Question | How does a triangle become a pixel? | How can you make quantum probability something you can explore? | How can a few thousand particles act like a fluid? |
| Model | Perspective matrix, edge functions, barycentric weights | Born rule; sampling `\|ψ\|²`; split-step Fourier | SPH kernels: Poly6, Spiky gradient, viscosity Laplacian |
| Excerpt | `LineDrawer.edge_function` + barycentric loop; `DepthBuffer.depthTest` | `physics/tdse.js` step; orbital sampler | `Fluid.h` kernels; `SpatialGrid` hash |
| Design decision | Depth buffer stores larger-is-closer and initialises to −∞, so one comparison handles occlusion | Physics modules contain no DOM code, so the solver is testable in Node | Hashed 3D grid with cell size = smoothing radius h, so each particle checks 27 cells instead of all particles |
| Evidence | Compiles cleanly (javac 25, checked); 4 cross-platform releases; screenshots to capture | Sanity check reproduced (norm 1.0000, T ≈ 0.0404 vs 0.0324 analytic); 10 figures | Screen recording to capture; CI currently failing (stated) |
| Limit | CPU only, single thread; no perspective-correct texture interpolation verified; performance unmeasured | One-electron model; 1D tunneling; rectangular barrier only | Kernel constants and stiffness hand-tuned; no incompressibility guarantee; visual not quantitative |
| Credit | Standard rasterization literature | Three.js r180 (MIT) | Inspired by Sebastian Lague's fluid simulation video; GLFW, GLAD, ImGui, GLM |

## 11. Active workbench and future experiments

Rendered from `data/projects.json` entries with `status` in {Working prototype, In progress, Planned}. Each row: question, status label (text, not colour only), latest documented milestone, next step, last-updated date (from repo push date or journal date), links.

- **Orion**: "Can I keep a small rocket vertical with a gimballed motor and my own flight computer?" Status: In progress. Milestone: Week 1 schematic and CAD (Sept 14 to 20, 2026): power rails, triple-IMU and dual-barometer navigation sheet, compute sheet started. Next: finish schematic, PCB layout, print airframe, OpenRocket model, gimbal test. Visual: KiCad schematic screenshot. **No telemetry, no flight claims.**
- **ATLAS**: "Can a one-metre dish I build detect the 21 cm hydrogen line?" Status: Planned (pending §22). Milestone: repository created. Next: first documented design step. No spectra shown. A one-line explanation of the 1420.4 MHz line, nothing about dark matter.

**Next questions** (restrained list of directions, labelled as such): hydrogen-line signal processing; RFI and anomaly detection; galactic rotation from H I Doppler shifts; sensor fusion and control for Orion; learning ML algorithms by implementing them.

## 12. Field notes and publishing rules

Not in v1. Extension path ready:

- `notes/` folder with a template `notes/_template.html`, documented in README.
- A note is published only when it explains something Jahaan built, every equation is checked against the code, and it has a date.
- Adding the first note: copy template, add an entry to `data/notes.json` (created then), and the "Notes" nav item appears automatically when that file has ≥ 1 entry.

## 13. Final CTA and footer

**CTA:** "Working on something interesting?" + one sentence + **Find me on GitHub** button. No form, no email in v1 (Jahaan's choice). Adding an email later = one field in `data/site.json`.

**Footer:** name, © 2026 (year written by script with static fallback), compact project links, "Built by hand with HTML, CSS, and JavaScript", credits (fonts under OFL, Three.js only on the QuantumSim page reference, Sebastian Lague inspiration note).

## 14. Visual style guide and typography

Palette (from the brief) with checked contrast:

| Role | Hex | Use | Contrast on `#0B0D0F` |
|---|---|---|---|
| Background | `#0B0D0F` | page | n/a |
| Surface | `#14181C` | figures, workbench rows | n/a |
| Text | `#ECECE7` | body, headings | 16.4:1 |
| Secondary | `#A0A6AC` | captions, meta | 7.9:1 (7.3:1 on surface) |
| Rule | `#292F34` | 1px rules, grid | decorative only |
| Blue | `#ABCDF7` | links, selected state, data distinction | 11.9:1 (10.9:1 on surface) |
| Light editorial | `#F1F0EA` | one section only (About), text `#0B0D0F` | 17.1:1 |

(WCAG ratios computed during planning. Any new text pair under 4.5:1 is rejected.)

Type:

- **Space Grotesk** 400 and 600 (self-hosted WOFF2, Latin subset). Headings 600; body 400.
- **IBM Plex Mono** 400 for labels, dates, IDs, readouts, equations.
- Fallbacks: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` and `ui-monospace, "SF Mono", Menlo, monospace`.
- Scale: `clamp()` fluid sizes. Hero headline ≈ 44 px mobile to 112 px desktop, deliberate line break. Body 17 to 18 px, line-height 1.6, measure ≤ 68ch.

Layout: 12-column grid, 24 px gutters, 16 px side gutter on mobile, content left-aligned. Fine 1 px rules between sections, small mono section labels (`01 / Work`). Measurement ticks appear only next to the hero canvas and figures, where they mean something (pixel grid scale).

No glass, glows, neon, fake terminals, or decorative equations. Optional static SVG grain at ≤ 3% opacity, single tiled image.

## 15. Motion, interaction, and scroll behaviour

- Native scrolling. **No Lenis in v1** (risk to anchors and history outweighs benefit). Revisit later.
- **GSAP + ScrollTrigger: optional**, loaded with pinned versions from cdnjs, `defer`. If they fail, content is already visible. Uses: short hero entrance (≤ 600 ms), gentle line reveals on section headings, one desktop-only pinned sequence (≤ 1.5 viewport heights) showing vertices → wireframe → shaded, driving the same canvas study. No pin on mobile or reduced motion.
- Body copy is never hidden behind animation.
- Reduced motion: no entrance, no pin, no auto-rotate; all controls work.
- No preloader, custom cursor, scroll lock, or sound.

## 16. Mobile and accessibility

- Skip link, landmark elements, one `h1` per page, ordered headings.
- Visible focus ring (2 px blue outline + offset).
- Touch targets ≥ 44×44 px.
- Status shown as text label + shape glyph, never colour alone.
- Hero stacks: text first, canvas second, square, smaller internal resolution.
- Long titles use `overflow-wrap: anywhere`; equations scroll horizontally inside their own box only.
- Actions always visible (no hover-only).
- Videos (if added later) have controls, captions, and a text summary.

## 17. Authentic media inventory

| Asset | Source | Status |
|---|---|---|
| QuantumSim figures 01 to 10 | `QuantumSim/docs/figures` | Available, will be resized to WebP/AVIF |
| QuantumSim UI screenshots | Run locally, capture | **To capture** during build |
| Rasterix screenshots (wireframe, shaded, textured) | Run compiled engine, capture | **To capture**; needs a screen-capture step on Jahaan's Mac |
| Hero static frame | Rendered by the browser study | Build step |
| Fluid sim screenshot + short loop | Build locally with CMake | **To capture**; if the build fails, Jahaan supplies a recording |
| Particle sim screenshot | Live web build | To capture |
| Orion schematics + CAD | GitHub user-attachments in README/journal | Download and self-host |
| Chladni CAD + wiring | GitHub user-attachments | Download and self-host |
| Myelovar funnel figure | `validation/figures/fig_funnel.png` | Available |
| Portrait | No local `Media` folder found | None; About uses artifacts and type |

## 18. Optional Higgsfield / Seedance asset appendix

**Not required for launch. Nothing has been generated.** Higgsfield CLI is installed and authenticated on this machine, so this is possible later.

Spec for every clip: 1080p, 8 to 12 s, H.264 MP4 + WebM, ≤ 3 MB each, local poster JPG, mobile variant 720p ≤ 1.5 MB or poster-only. No text rendered inside the video; labels are HTML.

1. **From geometry to image.** Preferred source is a screen recording of the real hero study (accurate geometry). Generated footage only for atmosphere around it.
2. **From model to machine.** Slow camera moves across real Orion CAD renders and schematic screenshots (image-to-video from real artifacts). No launch, no flame, no flight.
3. **From signal to understanding.** Dish → receiver chain → spectrum. Only after ATLAS has real hardware or data. Any spectrum not from recorded data is labelled "illustrative" in HTML.

Each clip stands alone; no reliance on continuity between them. No depiction of Jahaan.

## 19. Static architecture, schema, GitHub refresh

```
index.html  style.css  script.js
projects/rasterix.html  projects/quantumsim.html  projects/fluid-simulation.html
data/projects.json  data/github-cache.json  data/site.json
assets/images/  assets/video/  assets/fonts/  assets/mesh/hero-mesh.json
js/raster-study.js  js/catalogue.js  js/motion.js
notes/_template.html
tools/refresh-github.mjs
README.md  BUILD-PLAN.md
```

All paths relative (`./`, `../`) so the site works at a domain root and under a GitHub Pages subpath.

`data/projects.json` entry fields: `id, title, question, summary, category, tags, status, featured, sortOrder, repoUrl, demoUrl, caseStudyUrl, image, imageAlt, updatedAt, milestone, nextStep, evidence, credits`.

Missing-value rules: no `demoUrl` → no demo button; no `image` → typographic tile with the project's question and a ruled frame; no `updatedAt` → date omitted; no `caseStudyUrl` → title links to repo.

Progressive enhancement: the featured projects, workbench, and supporting index are **written into the HTML** as well, so the site works without JS. `catalogue.js` re-renders from JSON (using `textContent`, never `innerHTML` for repo text) to enable filters.

`tools/refresh-github.mjs` (Node ≥ 18, no dependencies): reads an allowlist from `projects.json`, fetches `/repos/jahaanb7/{name}` with pagination where relevant, writes `language, description, pushed_at, html_url` to `github-cache.json`. On any error or rate limit it keeps the previous cache and prints a summary. Optional `GITHUB_TOKEN` from env, never logged, never written to disk. Editorial fields are never overwritten.

## 20. Performance budget and loading

- Initial transfer target ≤ 1 MB compressed (fonts ≈ 90 KB, CSS ≈ 25 KB, JS ≈ 30 KB, hero mesh ≈ 20 KB, static hero frame ≈ 40 KB, above-fold images ≤ 300 KB).
- GSAP (~70 KB) deferred and optional.
- Images: AVIF/WebP with JPEG fallback, explicit `width`/`height`, `loading="lazy"` below the fold.
- Video: never in initial load; `preload="none"` with poster.
- Canvas: rendering paused offscreen and when hidden.
- Lighthouse mobile measured locally with Chrome; actual numbers and conditions reported, no invented scores.

## 21. Implementation phases and definition of done

1. **Foundation**: tokens, fonts, layout grid, nav, footer, static homepage with all content in HTML.
2. **Hero study**: raster-study.js, mesh export, static fallback frame, controls, reduced motion.
3. **Catalogue**: projects.json, catalogue.js, workbench, supporting index, filters if justified.
4. **Case studies**: three pages with figures and source excerpts.
5. **Media**: capture and optimise screenshots.
6. **Motion**: optional GSAP layer.
7. **Maintenance**: refresh script, README.
8. **Verification** (list in brief §15): static server, nested paths, no-JS, keyboard, reduced motion, 360 / 768 / 1280 px, console clean, link check, Lighthouse measured.

Done = every visible control works, every link resolves, no fabricated claims, measured performance reported.

## 22. Maintenance guide and unresolved decisions

Maintenance (full version goes in README): add a project = one JSON entry; change status = edit `status`, `milestone`, `nextStep`, `updatedAt`; refresh metadata = `node tools/refresh-github.mjs`; replace media = drop file in `assets/images` and update `image`.

**Genuinely unresolved, need Jahaan:**

1. **Deployment target.** GitHub Pages (`jahaanb7.github.io/...`) or a Hostinger domain? Canonical URLs, sitemap, and social preview URLs wait for this.
2. **ATLAS status.** Is there any hardware, design, or data yet? If yes, status becomes "In progress" with that milestone.
3. **Chladni plate.** Has it been built and run? A photo of a sand pattern would be strong evidence.
4. **Orion MCU part number** (STM32F7 vs H7) and whether STM32 belongs in the tools list.
5. **Community wording** for CodeCraft, FRC 1325, and Haven Hack Club, and which two or three to show.
6. **Screen captures.** Can Jahaan run Rasterix and the fluid sim for screenshots, or should I attempt local builds and captures?
7. **GitHub descriptions** for Orion and J.A.R.V.I.S: will Jahaan update them so the site and GitHub agree?
