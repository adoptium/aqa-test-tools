#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';

const USAGE = `Usage: run-research-queries <research-queries.json> [options]

Runs every GitHub API query listed in a research-queries-<ts>.json file (written by the
"testcase research query script" prompt) and saves each response under the research folder:

  <research-dir>/
  ├── research-manifest.json        one entry per query: status, ok, output file
  └── <test-slug>/
      ├── test-info.json            test metadata copied from the queries file
      ├── <query-id>.json           query, HTTP status and response body
      └── <query-id>.source.txt     decoded file content (contents API responses only)

Authentication uses the GITHUB_TOKEN environment variable. Only https://api.github.com/ URLs are
accepted, so the token is never sent anywhere else.

Options:
  -o, --out-dir <dir>   Research folder (default: "researchDir" from the queries file)
  -f, --force           Re-run queries even when a successful result file already exists
  -n, --dry-run         Validate the queries file and list the URLs without calling the API
  -h, --help            Show this help`;

const API_HOST = 'api.github.com';
const MAX_RETRIES = 3;
const MAX_RATE_LIMIT_WAIT_MS = 120_000;
// Minimum gap between requests per endpoint class (GitHub: code search 10/min, other search 30/min).
const MIN_INTERVAL_MS = { code: 6500, search: 2200, other: 150 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const args = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') args.help = true;
    else if (a === '-f' || a === '--force') args.force = true;
    else if (a === '-n' || a === '--dry-run') args.dryRun = true;
    else if (a === '-o' || a === '--out-dir') {
      if (i + 1 >= argv.length) throw new Error(`Option ${a} requires a value`);
      args.outDir = argv[++i];
    } else if (a.startsWith('-')) throw new Error(`Unknown option: ${a}`);
    else positional.push(a);
  }
  if (positional.length > 1) throw new Error(`Expected one queries file, got ${positional.length}`);
  args.queriesFile = positional[0];
  return args;
}

/** Makes a string safe to use as a single path segment. */
function slug(s) {
  return String(s).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '').slice(0, 120) || 'unnamed';
}

/** Validates the queries file and returns a list of problems (empty when valid). */
function validate(spec) {
  const problems = [];
  if (!spec || !Array.isArray(spec.tests) || spec.tests.length === 0) {
    return ['"tests" must be a non-empty array'];
  }
  const slugs = new Set();
  spec.tests.forEach((t, ti) => {
    const where = `tests[${ti}]`;
    if (!t.slug) problems.push(`${where}: missing "slug"`);
    else if (slugs.has(slug(t.slug))) problems.push(`${where}: duplicate slug "${t.slug}"`);
    else slugs.add(slug(t.slug));
    if (!Array.isArray(t.queries) || t.queries.length === 0) {
      problems.push(`${where}: "queries" must be a non-empty array`);
      return;
    }
    const ids = new Set();
    t.queries.forEach((q, qi) => {
      const qw = `${where}.queries[${qi}]`;
      if (!q.id) problems.push(`${qw}: missing "id"`);
      else if (ids.has(slug(q.id))) problems.push(`${qw}: duplicate id "${q.id}" in test "${t.slug}"`);
      else ids.add(slug(q.id));
      let u;
      try {
        u = new URL(q.url);
      } catch {
        problems.push(`${qw}: invalid "url"`);
        return;
      }
      if (u.protocol !== 'https:' || u.hostname !== API_HOST) {
        problems.push(`${qw}: url must start with https://${API_HOST}/ (got ${q.url})`);
      }
    });
  });
  return problems;
}

/**
 * GitHub's issue search returns HTTP 422 unless the query contains an is:issue or
 * is:pull-request qualifier. Add is:issue when it is missing.
 */
function normalizeUrl(url) {
  const u = new URL(url);
  if (u.pathname !== '/search/issues') return url;
  const q = u.searchParams.get('q') ?? '';
  if (/\bis:(issue|pr|pull-request)\b/i.test(q)) return url;
  u.searchParams.set('q', `${q} is:issue`.trim());
  return u.toString();
}

const lastRequestAt = { code: 0, search: 0, other: 0 };

async function throttle(url) {
  const p = new URL(url).pathname;
  const bucket = p.startsWith('/search/code') ? 'code' : p.startsWith('/search/') ? 'search' : 'other';
  const wait = lastRequestAt[bucket] + MIN_INTERVAL_MS[bucket] - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt[bucket] = Date.now();
}

function rateLimitWaitMs(res, text) {
  const retryAfter = Number(res.headers.get('retry-after'));
  if (retryAfter > 0) return retryAfter * 1000 + 1000;
  if (res.headers.get('x-ratelimit-remaining') === '0') {
    const reset = Number(res.headers.get('x-ratelimit-reset'));
    if (reset > 0) return Math.max(reset * 1000 - Date.now(), 0) + 1000;
  }
  if (/rate limit/i.test(text)) return 60_000;
  return null; // not a rate limit response
}

async function request(url, token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'jenkins-pipeline-analyzer-cli',
  };
  for (let attempt = 0; ; attempt++) {
    await throttle(url);
    let res;
    let text;
    try {
      res = await fetch(url, { headers, redirect: 'follow' });
      text = await res.text();
    } catch (e) {
      if (attempt >= MAX_RETRIES) return { status: 0, ok: false, text: '', error: e.message, headers: new Headers() };
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (res.status === 403 || res.status === 429) {
      const wait = rateLimitWaitMs(res, text);
      if (wait !== null && attempt < MAX_RETRIES && wait <= MAX_RATE_LIMIT_WAIT_MS) {
        console.error(`  rate limited, waiting ${Math.ceil(wait / 1000)}s before retry`);
        await sleep(wait);
        continue;
      }
    } else if (res.status >= 500 && attempt < MAX_RETRIES) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    return { status: res.status, ok: res.ok, text, headers: res.headers };
  }
}

function alreadyDone(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')).ok === true;
  } catch {
    return false;
  }
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`Error: ${e.message}\n\n${USAGE}`);
    process.exit(2);
  }
  if (args.help || !args.queriesFile) {
    console.log(USAGE);
    process.exit(args.help ? 0 : 2);
  }

  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(path.resolve(args.queriesFile), 'utf-8'));
  } catch (e) {
    console.error(`Error: cannot read queries file: ${e.message}`);
    process.exit(1);
  }
  const problems = validate(spec);
  if (problems.length) {
    console.error(`Error: invalid queries file:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }

  const researchDir = path.resolve(args.outDir ?? spec.researchDir ?? 'research');
  const total = spec.tests.reduce((n, t) => n + t.queries.length, 0);

  if (args.dryRun) {
    console.log(`Research folder: ${researchDir}\n${spec.tests.length} tests, ${total} queries:`);
    for (const t of spec.tests) for (const q of t.queries) console.log(`  [${t.slug}] ${q.id}  ${normalizeUrl(q.url)}`);
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('Error: GITHUB_TOKEN environment variable is not set');
    process.exit(1);
  }

  fs.mkdirSync(researchDir, { recursive: true });
  const manifest = [];
  let n = 0;

  for (const t of spec.tests) {
    const testDir = path.join(researchDir, slug(t.slug));
    fs.mkdirSync(testDir, { recursive: true });
    const { queries, ...info } = t;
    fs.writeFileSync(path.join(testDir, 'test-info.json'), JSON.stringify(info, null, 2), 'utf-8');

    for (const q of queries) {
      n++;
      const base = slug(q.id);
      const outFile = path.join(testDir, `${base}.json`);
      const rel = path.relative(researchDir, outFile);
      if (!args.force && alreadyDone(outFile)) {
        console.log(`[${n}/${total}] skip (done)  ${t.slug}/${q.id}`);
        manifest.push({ test: t.slug, id: q.id, file: rel, skipped: true, ok: true });
        continue;
      }
      console.log(`[${n}/${total}] ${t.slug}/${q.id}`);
      const url = normalizeUrl(q.url);
      const r = await request(url, token);

      let body;
      try {
        body = JSON.parse(r.text);
      } catch {
        body = r.text;
      }
      let sourceFile;
      if (body && typeof body === 'object' && body.encoding === 'base64' && typeof body.content === 'string') {
        sourceFile = `${base}.source.txt`;
        fs.writeFileSync(path.join(testDir, sourceFile), Buffer.from(body.content, 'base64').toString('utf-8'), 'utf-8');
        body.content = `(decoded to ${sourceFile})`;
      }

      const result = {
        id: q.id,
        test: t.slug,
        purpose: q.purpose,
        url,
        status: r.status,
        ok: r.ok,
        ...(r.error ? { error: r.error } : {}),
        fetchedAt: new Date().toISOString(),
        ...(sourceFile ? { sourceFile } : {}),
        body,
      };
      fs.writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf-8');
      if (!r.ok) console.error(`  FAILED: HTTP ${r.status}${r.error ? ` ${r.error}` : ''}`);
      manifest.push({ test: t.slug, id: q.id, file: rel, status: r.status, ok: r.ok });
    }
  }

  const failed = manifest.filter((m) => !m.ok).length;
  fs.writeFileSync(
    path.join(researchDir, 'research-manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        queriesFile: path.resolve(args.queriesFile),
        platformSummary: spec.platformSummary,
        total,
        failed,
        results: manifest,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`\nDone: ${total - failed}/${total} queries succeeded. Results in ${researchDir}`);
  if (failed) {
    console.log(`${failed} failed - re-run the same command to retry only the failed queries.`);
    process.exit(1);
  }
}

main();
