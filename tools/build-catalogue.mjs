// Writes the data-driven parts of index.html from data/*.json and assets/drawings/*.svg.
// Everything it writes is plain HTML: the page shows all content without JavaScript.
//
//   node tools/build-catalogue.mjs          writes index.html
//   node tools/build-catalogue.mjs --check  exits 1 if index.html is out of date
//
// Markers in index.html:
//   <!-- catalogue:status:<projectId>:start --> ... :end -->   status / milestone / next step
//   <!-- catalogue:svg:<file>:start --> ... :end -->           inline copy of assets/drawings/<file>.svg
//   <!-- catalogue:sketch:<file>:start --> ... :end -->        inline copy of assets/sketches/<file>.svg
//   <!-- catalogue:notebook:start --> ... :end -->             experiment notebook (reading view markup)
//   <!-- catalogue:writing:start --> ... :end -->              writing contents spread
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (f) => JSON.parse(await readFile(path.join(root, f), 'utf8'));
const { projects, statuses, nextQuestions = [] } = await readJson('data/projects.json');
const { notes = [] } = await readJson('data/notes.json');
const { experiments = [] } = await readJson('data/experiments.json');
const skills = await readJson('data/skills.json');

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const safeUrl = (u = '') => (/^(https:\/\/|projects\/|assets\/|#)/.test(u) ? esc(u) : '');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = (iso, short = false) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return short ? `${MONTHS[m - 1].slice(0, 3)} ${y}` : `${MONTHS[m - 1]} ${d}, ${y}`;
};

const byId = new Map(projects.map((p) => [p.id, p]));
for (const p of projects) {
  if (!statuses.includes(p.status)) throw new Error(`${p.id}: unknown status "${p.status}"`);
  if (p.image && !p.imageAlt) throw new Error(`${p.id}: image needs imageAlt`);
}
for (const x of experiments) {
  if (!byId.has(x.projectId)) throw new Error(`experiments: unknown projectId "${x.projectId}"`);
  if (x.figure?.type === 'image' && !x.figure.alt) throw new Error(`experiments: ${x.projectId} figure needs alt`);
}
for (const g of skills.groups) for (const t of g.tools) for (const id of t.projects) {
  if (!byId.has(id)) throw new Error(`skills: "${t.name}" lists unknown project "${id}"`);
}

const statusTag = (s) => `<span class="status" data-status="${esc(s)}">${esc(s)}</span>`;

// Where each project lives on the home page (featured, workbench sheet, or notebook page).
const anchorFor = (id) => (experiments.some((x) => x.projectId === id) ? `#xp-${id}` : `#${id}`);

function statusSlip(id) {
  const p = byId.get(id);
  if (!p) throw new Error(`status marker: unknown project "${id}"`);
  const date = fmtDate(p.updatedAt, true);
  return `<p class="slip">${statusTag(p.status)}${date ? ` <span class="slip-date">updated <time datetime="${esc(p.updatedAt)}">${date}</time></span>` : ''}</p>`;
}

function figureHtml(f, n) {
  if (f.type === 'code') {
    return `<figure class="xp-fig xp-code">
              <pre tabindex="0" aria-label="${esc(f.lang)} source from ${esc(f.file)}"><code>${esc(f.code)}</code></pre>
              <figcaption><span class="mono">${esc(f.file)}</span></figcaption>
            </figure>`;
  }
  return `<figure class="xp-fig">
              <img src="${safeUrl(f.src)}" width="${f.width}" height="${f.height}" alt="${esc(f.alt)}" loading="lazy" decoding="async">
              <figcaption>${esc(f.caption)}</figcaption>
            </figure>`;
}

function notebookHtml() {
  const contents = experiments.map((x, i) => {
    const p = byId.get(x.projectId);
    return `<li><a href="#xp-${esc(p.id)}" data-xp-link="${esc(p.id)}"><span class="toc-no">${i + 1}</span><span class="toc-title">${esc(p.title)}</span><span class="toc-dots" aria-hidden="true"></span><span class="toc-meta">${esc(x.kicker)}</span></a></li>`;
  }).join('\n            ');
  const articles = experiments.map((x, i) => {
    const p = byId.get(x.projectId);
    const n = i + 1;
    const sketch = x.sketch ? `
              <figure class="xp-sketch">
                ${readFileSync(path.join(root, 'assets/sketches', `${x.sketch}.svg`), 'utf8').trim()}
                <figcaption>${esc(x.sketchCaption || '')}</figcaption>
              </figure>` : '';
    const nn = String(n).padStart(2, '0');
    const total = String(experiments.length).padStart(2, '0');
    return `
          <article class="xp" id="xp-${esc(p.id)}" data-xp="${esc(p.id)}" data-tab="${esc(x.tab || p.title)}" data-layout="${esc(x.layout || 'plain')}" aria-labelledby="xp-${esc(p.id)}-title">
            <div class="xp-a">
              <p class="xp-kicker"><span class="xp-no">Experiment ${nn}</span> / ${esc(x.kicker)}</p>
              <h3 id="xp-${esc(p.id)}-title">${esc(x.headline || p.title)}</h3>
              <p class="xp-sub">${esc(p.title)}</p>
              <p class="xp-q">${esc(p.question)}</p>
              <p class="xp-desc">${esc(x.explanation)}</p>${x.equation ? `
              <p class="xp-eq" aria-label="Equation: ${esc(x.equation)}">${esc(x.equation)}</p>` : ''}
              <p class="xp-tags" translate="no">${x.tools.map(esc).join(' / ')}</p>
              <div class="xp-foot">
                <span class="xp-state"><span class="dot" aria-hidden="true"></span>${esc(p.status)}</span>
                ${p.repoUrl ? `<a class="xp-open-link" href="${safeUrl(p.repoUrl)}">Open the project <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></a>` : ''}
              </div>
              <p class="xp-folio mono" aria-hidden="true">${nn} / ${total}</p>
            </div>
            <div class="xp-b" data-figs="${1 + (x.sketch ? 1 : 0) + (x.gallery || []).length}">
              ${figureHtml(x.figure, n)}${sketch}${(x.gallery || []).map((g) => `
              <figure class="xp-fig xp-more">
                <img src="${safeUrl(g.src)}" width="${g.width}" height="${g.height}" alt="${esc(g.alt)}" loading="lazy" decoding="async">
                <figcaption>${esc(g.caption)}</figcaption>
              </figure>`).join('')}${x.note ? `
              <p class="hand xp-note">${esc(x.note)}</p>` : ''}
              <p class="xp-obs">${esc(x.observation)}</p>${x.openQuestion ? `
              <p class="xp-openq"><span class="mono">Open question</span> ${esc(x.openQuestion)}</p>` : ''}
            </div>
          </article>`;
  }).join('');
  const qs = nextQuestions.map((q) => `<li>${esc(q)}</li>`).join('\n              ');
  return `
        <div class="reading" id="notebook-reading" data-reading>
          <nav class="reading-contents" aria-label="Experiments in this notebook">
            <p class="mono">Contents</p>
            <ol>
            ${contents}
            </ol>
          </nav>${articles}
          <aside class="xp-open" aria-labelledby="open-q-title">
            <h3 id="open-q-title">Open questions</h3>
            <ol>
              ${qs}
            </ol>
          </aside>
        </div>`;
}

const GLYPHS = {
  mesh: '<svg class="glyph" viewBox="0 0 120 80" aria-hidden="true"><path class="g-ink" d="M14 66L42 14L74 40L106 20L96 70ZM42 14L54 70L14 66M54 70L74 40L96 70M74 40L42 14"/><g class="g-dot"><circle cx="14" cy="66" r="2.6"/><circle cx="42" cy="14" r="2.6"/><circle cx="74" cy="40" r="2.6"/><circle cx="106" cy="20" r="2.6"/><circle cx="96" cy="70" r="2.6"/><circle cx="54" cy="70" r="2.6"/></g></svg>',
  schematic: '<svg class="glyph" viewBox="0 0 120 80" aria-hidden="true"><path class="g-ink" d="M6 30H26L30 22L36 38L42 22L48 38L54 22L58 30H72M72 18V42M80 18V42M80 30H96V58M86 58H106M90 64H102M94 70H98M6 30V58H40"/><circle class="g-dot" cx="96" cy="30" r="2.6"/><text class="g-t" x="34" y="14">R</text><text class="g-t" x="70" y="12">C</text></svg>',
  cylinder: '<svg class="glyph" viewBox="0 0 120 80" aria-hidden="true"><path class="g-ink" d="M18 22H82Q104 22 112 40Q104 58 82 58H18Z"/><path class="g-hid" d="M30 22V58M82 22V58"/><path class="g-dim" d="M18 70H112M18 66V74M112 66V74M8 22V58M4 22H12M4 58H12"/><path class="g-cl" d="M4 40H116"/></svg>',
};

function skillsHtml() {
  const groups = skills.groups.map((g, gi) => {
    const tools = g.tools.map((t) => {
      const key = t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const proj = t.projects.map((id) => `<a href="${anchorFor(id)}"${experiments.some((x) => x.projectId === id) ? ` data-xp-link="${esc(id)}"` : ''}>${esc(byId.get(id).title)}</a>`).join(', ');
      return `
              <li data-tool="${esc(key)}"><button type="button" class="inst-name" data-pick="${esc(key)}" aria-pressed="false">${esc(t.name)}</button><p class="inst-use" hidden>${esc(t.use)}</p><p class="inst-proj"><span class="visually-hidden">Used in: </span>${proj}</p></li>`;
    }).join('');
    return `
          <section class="inst" aria-labelledby="inst-${esc(g.id)}">
            <div class="inst-head">
              ${GLYPHS[g.glyph] || ''}
              <p class="mono">Group ${String.fromCharCode(65 + gi)}</p>
              <h3 id="inst-${esc(g.id)}">${esc(g.title)}</h3>
            </div>
            <ul class="inst-tools">${tools}
            </ul>
          </section>`;
  }).join('');
  const cols = skills.columns;
  const head = cols.map((id) => `<th scope="col" data-col="${esc(id)}"><a href="${anchorFor(id)}"${experiments.some((x) => x.projectId === id) ? ` data-xp-link="${esc(id)}"` : ''}>${esc(skills.columnLabels[id] || byId.get(id).title)}</a></th>`).join('');
  const rows = skills.groups.map((g) => {
    const gRow = `
                <tr class="m-group"><th scope="rowgroup" colspan="${cols.length + 1}">${esc(g.title)}</th></tr>`;
    return gRow + g.tools.map((t) => {
      const key = t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const cells = cols.map((id) => (t.projects.includes(id)
        ? `<td data-col="${esc(id)}" class="on"><span class="dot" aria-hidden="true"></span><span class="visually-hidden">Used in ${esc(byId.get(id).title)}</span></td>`
        : `<td data-col="${esc(id)}"><span class="visually-hidden">Not used</span></td>`)).join('');
      return `
                <tr data-tool="${esc(key)}"><th scope="row" tabindex="0">${esc(t.name)}</th>${cells}</tr>`;
    }).join('');
  }).join('');
  return `
        <div class="instruments">${groups}
        </div>
        <details class="matrix-details"><summary>Every tool against every project</summary>
        <figure class="matrix-fig">
          <div class="matrix-wrap" tabindex="0" role="region" aria-labelledby="matrix-cap">
            <table class="matrix">
              <thead><tr><th scope="col"><span class="visually-hidden">Tool</span></th>${head}</tr></thead>
              <tbody>${rows}
              </tbody>
            </table>
          </div>
          <figcaption id="matrix-cap"><span class="fig-no">Table 1</span> Which tool appears in which repository. Focus or hover a tool to trace its projects.</figcaption>
        </figure></details>`;
}

function writingHtml() {
  const sorted = [...notes].sort((a, b) => (a.publishedAt < b.publishedAt ? -1 : 1));
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const items = sorted.map((n, i) => {
    const short = n.title.split(/:\s*/).slice(1).join(': ') || n.title;
    const related = n.related && byId.get(n.related);
    return `
            <li class="clip clip-${i + 1}">
              <p class="clip-part mono">Part ${roman[i] || i + 1} · ${esc(String(n.readingMinutes))} min read</p>
              <h4 class="clip-title"><a href="${safeUrl(n.url)}">${esc(short)}<span class="visually-hidden"> (${esc(n.title)}, on Medium)</span></a></h4>
              <p class="clip-pub"><time datetime="${esc(n.publishedAt)}">${fmtDate(n.publishedAt)}</time> · ${esc(n.venue)}${related ? ` · companion to <a href="${anchorFor(related.id)}">${esc(related.title)}</a>` : ''}</p>
            </li>`;
  }).join('');
  return `
          <ol class="clippings">${items}
          </ol>`;
}

// data/skills.json is still validated above; the Tools section moved to the GitHub profile.
const fixed = { notebook: notebookHtml(), writing: writingHtml() };

const file = path.join(root, 'index.html');
let html = await readFile(file, 'utf8');
const original = html;

for (const [name, content] of Object.entries(fixed)) {
  const re = new RegExp(`(<!-- catalogue:${name}:start -->)[\\s\\S]*?(\\s*<!-- catalogue:${name}:end -->)`);
  if (!re.test(html)) throw new Error(`marker catalogue:${name} missing in index.html`);
  html = html.replace(re, (_, a, b) => `${a}${content}${b}`);
}

let slips = 0;
html = html.replace(/(<!-- catalogue:status:([a-z0-9-]+):start -->)[\s\S]*?(<!-- catalogue:status:\2:end -->)/g, (_, a, id, b) => {
  slips += 1;
  return `${a}${statusSlip(id)}${b}`;
});

const svgNames = [...html.matchAll(/<!-- catalogue:svg:([a-z0-9-]+):start -->/g)].map((m) => m[1]);
const svgs = Object.fromEntries(await Promise.all(svgNames.map(async (n) => [n, (await readFile(path.join(root, 'assets/drawings', `${n}.svg`), 'utf8')).trim()])));
html = html.replace(/(<!-- catalogue:svg:([a-z0-9-]+):start -->)[\s\S]*?(<!-- catalogue:svg:\2:end -->)/g, (_, a, n, b) => `${a}${svgs[n]}${b}`);

const sketchNames = [...html.matchAll(/<!-- catalogue:sketch:([a-z0-9-]+):start -->/g)].map((m) => m[1]);
html = html.replace(/(<!-- catalogue:sketch:([a-z0-9-]+):start -->)[\s\S]*?(<!-- catalogue:sketch:\2:end -->)/g,
  (_, a, n, b) => `${a}${readFileSync(path.join(root, 'assets/sketches', `${n}.svg`), 'utf8').trim()}${b}`);

if (process.argv.includes('--check')) {
  if (html !== original) { console.error('index.html is out of date. Run: node tools/build-catalogue.mjs'); process.exit(1); }
  console.log('index.html is up to date.');
} else {
  await writeFile(file, html);
  console.log(`index.html: ${slips} status slips, ${svgNames.length} drawings, ${sketchNames.length} sketches, ${experiments.length} notebook entries, ${skills.groups.length} skill groups, ${notes.length} articles.`);
}
