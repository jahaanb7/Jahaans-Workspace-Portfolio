// Refreshes data/github-cache.json with public metadata for the repositories
// listed in data/projects.json. Optional maintenance tool, not a build step.
//
// Usage: node tools/refresh-github.mjs
// Optional: GITHUB_TOKEN=... node tools/refresh-github.mjs   (raises the rate limit; never logged or saved)
//
// Behaviour:
// - Only repositories under OWNER that appear in projects.json are fetched (the allowlist).
// - Editorial fields in projects.json are never touched.
// - On any error (network, rate limit, missing repo) the previous cache entry is kept.
// - The cache file is only rewritten when at least one repository was fetched successfully.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OWNER = 'jahaanb7';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cachePath = path.join(root, 'data/github-cache.json');
const token = process.env.GITHUB_TOKEN || '';

const { projects } = JSON.parse(await readFile(path.join(root, 'data/projects.json'), 'utf8'));
const allow = [...new Set(projects
  .map((p) => (p.repoUrl || '').match(new RegExp(`^https://github\\.com/${OWNER}/([^/#?]+)`)))
  .filter(Boolean)
  .map((m) => m[1]))];

let cache = { owner: OWNER, fetchedAt: null, repos: {} };
try { cache = JSON.parse(await readFile(cachePath, 'utf8')); } catch { /* first run */ }

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'portfolio-refresh-script' };
if (token) headers.Authorization = `Bearer ${token}`;

async function getJson(url) {
  const res = await fetch(url, { headers });
  const remaining = res.headers.get('x-ratelimit-remaining');
  if (res.status === 403 && remaining === '0') {
    const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
    throw Object.assign(new Error(`rate limited until ${new Date(reset).toISOString()}`), { fatal: true });
  }
  if (res.status === 404) throw new Error('not found (renamed, deleted or private)');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { data: await res.json(), link: res.headers.get('link') || '' };
}

// Pagination: confirm the allowlisted repos still exist publicly under the owner.
async function listPublicRepos() {
  const names = new Set();
  let url = `https://api.github.com/users/${OWNER}/repos?per_page=100&type=owner`;
  for (let page = 0; url && page < 10; page++) {
    const { data, link } = await getJson(url);
    data.forEach((r) => names.add(r.name));
    url = (link.match(/<([^>]+)>;\s*rel="next"/) || [])[1];
  }
  return names;
}

let ok = 0;
const problems = [];
let publicNames = null;
try { publicNames = await listPublicRepos(); }
catch (e) { problems.push(`repo list: ${e.message}`); if (e.fatal) await finish(); }

for (const name of allow) {
  if (publicNames && !publicNames.has(name)) {
    problems.push(`${name}: not in the public repository list, keeping previous cache entry`);
    continue;
  }
  try {
    const { data: r } = await getJson(`https://api.github.com/repos/${OWNER}/${encodeURIComponent(name)}`);
    cache.repos[name] = {
      htmlUrl: r.html_url,
      description: r.description || '',
      language: r.language || '',
      pushedAt: r.pushed_at,
      updatedAt: r.updated_at,
      archived: Boolean(r.archived),
    };
    ok++;
  } catch (e) {
    problems.push(`${name}: ${e.message}, keeping previous cache entry`);
    if (e.fatal) break;
  }
}
await finish();

async function finish() {
  if (ok > 0) {
    cache.owner = OWNER;
    cache.fetchedAt = new Date().toISOString();
    const tmp = `${cachePath}.tmp`;
    await writeFile(tmp, JSON.stringify(cache, null, 2) + '\n');
    await rename(tmp, cachePath);
  }
  console.log(`Refreshed ${ok} of ${allow.length} repositories${ok ? '' : ' (cache left unchanged)'}.`);
  problems.forEach((p) => console.log(`  - ${p}`));
  process.exit(ok > 0 || allow.length === 0 ? 0 : 1);
}
