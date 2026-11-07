// sync-quantumsim.mjs: pull the orbital physics straight from github.com/jahaanb7/QuantumSim.
//
// js/quantumsim/orbitals.js is a byte-for-byte copy of src/physics/orbitals.js in that repo;
// js/orbital.js only draws what it returns. Never edit the copy here: change QuantumSim, push,
// then run this.
//
//   node tools/sync-quantumsim.mjs            # update to QuantumSim main
//   node tools/sync-quantumsim.mjs <sha|tag>  # pin to a ref
//   node tools/sync-quantumsim.mjs --check    # fail if the copy differs from the pinned commit

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'jahaanb7/QuantumSim';
const FILES = [['src/physics/orbitals.js', 'js/quantumsim/orbitals.js']];
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(root, 'js/quantumsim/SOURCE.json');

const args = process.argv.slice(2);
const check = args.includes('--check');
let ref = args.find((a) => !a.startsWith('--'));

const gh = async (url, accept) => {
  const res = await fetch(url, { headers: { accept, 'user-agent': 'portfolio-sync' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
};

if (check) ref = JSON.parse(await readFile(sourcePath, 'utf8')).commit;
const commit = await gh(`https://api.github.com/repos/${REPO}/commits/${ref || 'main'}`, 'application/vnd.github+json')
  .then((r) => r.json());
const sha = commit.sha;

let stale = false;
for (const [from, to] of FILES) {
  const text = await gh(`https://raw.githubusercontent.com/${REPO}/${sha}/${from}`, 'text/plain').then((r) => r.text());
  const dest = join(root, to);
  if (check) {
    const local = await readFile(dest, 'utf8').catch(() => '');
    if (local !== text) { stale = true; console.error(`✗ ${to} differs from ${REPO}@${sha.slice(0, 7)}:${from}`); }
    else console.log(`✓ ${to} matches ${REPO}@${sha.slice(0, 7)}:${from}`);
  } else {
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, text);
    console.log(`${to} ← ${REPO}@${sha.slice(0, 7)}:${from}`);
  }
}

if (check) process.exit(stale ? 1 : 0);
await writeFile(sourcePath, JSON.stringify({
  repo: `https://github.com/${REPO}`,
  commit: sha,
  message: commit.commit.message.split('\n')[0],
  files: Object.fromEntries(FILES.map(([from, to]) => [to, from])),
}, null, 2) + '\n');
