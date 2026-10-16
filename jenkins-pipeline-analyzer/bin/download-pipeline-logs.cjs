#!/usr/bin/env node

/**
 * Jenkins Pipeline Log Downloader
 * 
 * Downloads all console logs from a Jenkins pipeline build recursively,
 * including all downstream jobs up to a specified depth.
 * 
 * Usage:
 *   node download-pipeline-logs.cjs <jenkins-url> [--depth N] [--output DIR] [--handlers FILE]
 *
 * Requires JENKINS_USER and JENKINS_TOKEN environment variables.
 * --depth defaults to 10.
 * --handlers defaults to ../console-handlers.json. Downstream build URLs containing a handler's
 * "urlKeyword" are fetched via its "consoleQuery" (unauthenticated); all others use the Jenkins API.
 *
 * Example:
 *   node download-pipeline-logs.cjs https://ci.adoptium.net/job/build-scripts/job/openjdk21-pipeline/504/ --depth 10 --output ./analyse-jdk21u-build-504
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node download-pipeline-logs.cjs <jenkins-build-url> [--depth N] [--output DIR]');
  console.error('Example: node download-pipeline-logs.cjs https://ci.adoptium.net/job/build-scripts/job/openjdk21-pipeline/504/ --depth 10 --output ./analyse-jdk21u-build-504');
  process.exit(1);
}

const DEFAULT_MAX_DEPTH = 10;
const buildUrl = args[0];
const depthIndex = args.indexOf('--depth');
const maxDepth = depthIndex !== -1 ? parseInt(args[depthIndex + 1]) : DEFAULT_MAX_DEPTH;
if (Number.isNaN(maxDepth) || maxDepth < 0) {
  console.error('Error: --depth requires a non-negative integer');
  process.exit(1);
}
const outputIndex = args.indexOf('--output');
const outputDir = outputIndex !== -1 ? args[outputIndex + 1] : null;

// Get Jenkins credentials from environment
const JENKINS_USER = process.env.JENKINS_USER;
const JENKINS_TOKEN = process.env.JENKINS_TOKEN;

if (!JENKINS_USER || !JENKINS_TOKEN) {
  console.error('Error: JENKINS_USER and JENKINS_TOKEN environment variables are required');
  process.exit(1);
}

// Parse Jenkins URL to extract job name and build number
function parseJenkinsUrl(url) {
  // Example: https://ci.adoptium.net/job/build-scripts/job/release-openjdk26-pipeline/2/
  // The base URL is everything before the first "/job/" (may include a path prefix, e.g. https://ci.eclipse.org/temurin-compliance)
  const match = url.match(/^(https?:\/\/.+?)\/job\/(.+?)\/(\d+)\/?$/);
  if (!match) {
    throw new Error(`Invalid Jenkins build URL: ${url}`);
  }
  
  return {
    baseUrl: match[1],
    jobName: match[2],
    buildNumber: parseInt(match[3])
  };
}

// pluggable console handlers (see console-handlers.json). Override with --handlers FILE.
const handlersIndex = args.indexOf('--handlers');
const handlersFile = handlersIndex !== -1 ? args[handlersIndex + 1] : path.join(__dirname, '..', 'console-handlers.json');
let consoleHandlers = [];
const downloadFailures = []; // { url, error } for every job that could not be downloaded

// Retry-able statuses (server-side transient errors and rate limiting)
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 2000; // 2s, doubles each attempt (2s, 4s, 8s, 16s)

// Delay helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Make an unauthenticated HTTP GET request (for console handler queries)
async function makeUnauthenticatedRequest(url) {
  const protocol = url.startsWith('https') ? https : http;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await new Promise((resolve, reject) => {
      protocol.get(url, {}, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          res.on('end', () => resolve({ status: res.statusCode, retryable: RETRYABLE_STATUSES.has(res.statusCode) }));
          return;
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ ok: true, data }));
      }).on('error', (err) => reject(err));
    });

    if (result.ok) return result.data;

    if (result.retryable && attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`  ⚠ HTTP ${result.status} on attempt ${attempt}/${MAX_RETRIES} — retrying in ${delay}ms: ${url}`);
      await sleep(delay);
      continue;
    }

    throw Object.assign(new Error(`HTTP ${result.status}: ${url}`), { status: result.status });
  }
}

// Make authenticated HTTP request with automatic retry on transient errors
async function makeRequest(url, returnHeaders = false) {
  const auth = 'Basic ' + Buffer.from(`${JENKINS_USER}:${JENKINS_TOKEN}`).toString('base64');
  const protocol = url.startsWith('https') ? https : http;
  const options = { headers: { 'Authorization': auth } };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await new Promise((resolve, reject) => {
      protocol.get(url, options, (res) => {
        if (res.statusCode !== 200) {
          // Drain the response body before resolving so the socket is released
          res.resume();
          res.on('end', () => resolve({ status: res.statusCode, retryable: RETRYABLE_STATUSES.has(res.statusCode) }));
          return;
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (returnHeaders) {
            resolve({ ok: true, data, headers: res.headers });
          } else {
            resolve({ ok: true, data });
          }
        });
      }).on('error', (err) => reject(err));
    });

    if (result.ok) {
      return returnHeaders ? { data: result.data, headers: result.headers } : result.data;
    }

    if (result.retryable && attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`  ⚠ HTTP ${result.status} on attempt ${attempt}/${MAX_RETRIES} — retrying in ${delay}ms: ${url}`);
      await sleep(delay);
      continue;
    }

    throw Object.assign(new Error(`HTTP ${result.status}: ${url}`), { status: result.status });
  }
}

// Get log size in bytes from Jenkins API (headers only, no body download)
async function getLogSize(baseUrl, jobName, buildNumber) {
  const url = `${baseUrl}/job/${jobName}/${buildNumber}/logText/progressiveText?start=0`;
  const auth = 'Basic ' + Buffer.from(`${JENKINS_USER}:${JENKINS_TOKEN}`).toString('base64');
  const protocol = url.startsWith('https') ? https : http;
  const options = { headers: { 'Authorization': auth } };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await new Promise((resolve) => {
      protocol.get(url, options, (res) => {
        const status = res.statusCode;
        const textSize = res.headers['x-text-size'];
        // Destroy immediately — we only need the headers
        res.destroy();

        if (status === 200) {
          resolve({ ok: true, size: textSize ? parseInt(textSize) : 0 });
        } else {
          resolve({ ok: false, status, retryable: RETRYABLE_STATUSES.has(status) });
        }
      }).on('error', () => resolve({ ok: false, status: 0, retryable: true }));
    });

    if (result.ok) return result.size;

    if (result.retryable && attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`  ⚠ HTTP ${result.status} getting log size on attempt ${attempt}/${MAX_RETRIES} — retrying in ${delay}ms`);
      await sleep(delay);
      continue;
    }

    return 0; // Non-retryable or exhausted — fall back to full download
  }
  return 0;
}

// Download console log with smart truncation for large logs
async function downloadConsoleLog(baseUrl, jobName, buildNumber) {
  console.log(`Downloading: ${jobName} #${buildNumber}`);
  
  // Check log size first
  const logSize = await getLogSize(baseUrl, jobName, buildNumber);
  const logSizeMB = (logSize / (1024 * 1024)).toFixed(2);
  console.log(`  Log size: ${logSizeMB} MB`);
  
  const MAX_LOG_SIZE = 50 * 1024 * 1024; // 50MB in bytes
  
  if (logSize > MAX_LOG_SIZE) {
    console.log(`  Large log detected (>${MAX_LOG_SIZE / (1024 * 1024)}MB), downloading last 10MB only...`);
    
    // For large logs, only download the last 10MB
    // This contains test results, error messages, and completion status
    // We skip the beginning since progressiveText API returns everything from start position to end
    const lastSectionSize = Math.min(10 * 1024 * 1024, logSize); // 10MB
    const lastSectionStart = Math.max(0, logSize - lastSectionSize);
    const lastLinesUrl = `${baseUrl}/job/${jobName}/${buildNumber}/logText/progressiveText?start=${lastSectionStart}`;
    const lastLines = await makeRequest(lastLinesUrl);
    
    // Add header indicating truncation
    return `[... LOG TRUNCATED - SHOWING LAST ${(lastSectionSize / (1024 * 1024)).toFixed(1)}MB OF ${logSizeMB}MB ...]\n\n` + lastLines;
  } else {
    // For smaller logs, download complete log
    const url = `${baseUrl}/job/${jobName}/${buildNumber}/consoleText`;
    return await makeRequest(url);
  }
}

// Get build info
async function getBuildInfo(baseUrl, jobName, buildNumber) {
  const url = `${baseUrl}/job/${jobName}/${buildNumber}/api/json`;
  const data = await makeRequest(url);
  return JSON.parse(data);
}
// Build a canonical "<baseUrl>/job/<jobName>/<buildNumber>/" URL. jobName uses "/job/" between folder levels.
function makeBuildUrl(baseUrl, jobName, buildNumber) {
  return `${baseUrl.replace(/\/+$/, '')}/job/${jobName}/${buildNumber}/`;
}

<<<<<<< HEAD
// Ignore utility/generator jobs like Test_Job_Auto_Gen whose instances are frequently purged by Jenkins
function isIgnoredJob(jobName) {
  if (!jobName) return false;
  return /(?:^|[^a-zA-Z0-9])Test_Job_Auto_Gen(?:$|[^a-zA-Z0-9])/.test(jobName);
}

=======
>>>>>>> upstream/master
// Parse downstream jobs from a console log. Every search term yields a canonical build URL, so the
// caller can treat all downstream jobs uniformly (see resolveConsoleHandler for per-URL handling).
//   "Starting building: a » b #8"        - relative to contextBaseUrl (the Jenkins this console came from)
//   "Build a » b #8 completed: FAILURE"  - relative to contextBaseUrl
//   "Remote build URL: https://.../job/X/123/" - absolute URL, possibly on a different Jenkins
function parseDownstreamJobs(consoleLog, contextBaseUrl) {
  const jobs = new Map(); // keyed by build URL to deduplicate

  for (const line of consoleLog.split('\n')) {
    const startMatch = line.match(/Starting building:\s+(.+?)\s+#(\d+)/);
    if (startMatch) {
      const jobName = startMatch[1].replace(/\s+»\s+/g, '/job/');
<<<<<<< HEAD
      if (isIgnoredJob(jobName)) continue;
=======
>>>>>>> upstream/master
      const buildNumber = parseInt(startMatch[2]);
      const url = makeBuildUrl(contextBaseUrl, jobName, buildNumber);
      // Status 'STARTED' is overwritten if a completion line is found
      if (!jobs.has(url)) jobs.set(url, { buildUrl: url, jobName, buildNumber, status: 'STARTED' });
    }

    const completeMatch = line.match(/Build\s+(.+?)\s+#(\d+)\s+completed:\s+(\w+)/);
    if (completeMatch) {
      const jobName = completeMatch[1].replace(/\s+»\s+/g, '/job/');
<<<<<<< HEAD
      if (isIgnoredJob(jobName)) continue;
=======
>>>>>>> upstream/master
      const buildNumber = parseInt(completeMatch[2]);
      const url = makeBuildUrl(contextBaseUrl, jobName, buildNumber);
      jobs.set(url, { buildUrl: url, jobName, buildNumber, status: completeMatch[3] });
    }

    const remoteUrlMatch = line.match(/Remote build URL:\s*(https?:\/\/\S+)/);
    if (remoteUrlMatch) {
      try {
        const { baseUrl, jobName, buildNumber } = parseJenkinsUrl(remoteUrlMatch[1]);
<<<<<<< HEAD
        if (isIgnoredJob(jobName)) continue;
=======
>>>>>>> upstream/master
        const url = makeBuildUrl(baseUrl, jobName, buildNumber);
        if (!jobs.has(url)) jobs.set(url, { buildUrl: url, jobName, buildNumber, status: 'STARTED' });
      } catch (err) {
        console.error(`  ⚠ Ignoring unparseable "Remote build URL": ${remoteUrlMatch[1]}`);
      }
    }
  }

  return Array.from(jobs.values());
}

// Load pluggable console handlers. Each handler: { urlKeyword, jobRegex, buildNumberRegex, consoleQuery }
function loadConsoleHandlers(file) {
  if (!fs.existsSync(file)) {
    console.log(`ℹ No console handlers file at ${file} — all downstream jobs use the Jenkins API`);
    return [];
  }
  const config = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const handlers = Array.isArray(config) ? config : config.handlers || [];
  for (const h of handlers) {
    for (const field of ['urlKeyword', 'jobRegex', 'buildNumberRegex', 'consoleQuery']) {
      if (!h[field]) throw new Error(`Console handler is missing "${field}" in ${file}: ${JSON.stringify(h)}`);
    }
    new RegExp(h.jobRegex); // fail fast on invalid regex
    new RegExp(h.buildNumberRegex);
  }
  console.log(`Loaded ${handlers.length} console handler(s) from ${file}`);
  return handlers;
}

// First handler whose urlKeyword is contained in the build URL, or undefined for the default Jenkins behaviour
function resolveConsoleHandler(buildUrl) {
  return consoleHandlers.find((h) => buildUrl.includes(h.urlKeyword));
}

// Fetch console + build info through a matched handler: extract JOB / BUILD_NUMBER with the handler's
// matcher regexes, then query consoleQuery (no authentication) with %JOB% / %BUILD_NUMBER% substituted.
async function fetchViaConsoleHandler(handler, buildUrl) {
  const jobMatch = new RegExp(handler.jobRegex).exec(buildUrl);
  const numberMatch = new RegExp(handler.buildNumberRegex).exec(buildUrl);
  if (!jobMatch || !jobMatch[1] || !numberMatch || !numberMatch[1]) {
    throw new Error(`Handler for "${handler.urlKeyword}" could not extract job/build number from ${buildUrl}`);
  }
  const job = jobMatch[1];
  const buildNumber = numberMatch[1];
  const queryUrl = handler.consoleQuery
    .replace(/%JOB%/g, encodeURIComponent(job))
    .replace(/%BUILD_NUMBER%/g, buildNumber);

  console.log(`  Downloading console (${handler.urlKeyword}): ${queryUrl}`);
  const consoleLog = await makeUnauthenticatedRequest(queryUrl);
  const buildInfo = {
    jobName: job,
    fullDisplayName: `${job} #${buildNumber}`,
    buildNumber: parseInt(buildNumber),
    url: buildUrl,
    consoleSource: queryUrl,
  };
  return { consoleLog, buildInfo };
}

// Default behaviour: Jenkins API on the build URL, using JENKINS_USER / JENKINS_TOKEN
// If the console cannot be fetched (e.g. HTTP 404 once Jenkins has purged it), api/json often still works:
// return the build info with consoleLog = null so the real result and duration are kept.
async function fetchViaJenkinsApi(baseUrl, jobName, buildNumber) {
  let consoleLog = null;
  let consoleError = null;
  try {
    consoleLog = await downloadConsoleLog(baseUrl, jobName, buildNumber);
  } catch (error) {
    consoleError = error;
  }
  let buildInfo;
  try {
    buildInfo = await getBuildInfo(baseUrl, jobName, buildNumber);
  } catch (error) {
    throw consoleError ?? error;
  }
  if (consoleError) {
    console.error(`  ⚠ Console unavailable for ${jobName} #${buildNumber} (${consoleError.message}) — keeping build info only`);
    return { consoleLog: null, buildInfo, consoleError };
  }
  return { consoleLog, buildInfo };
}

// Create safe filename from job name
function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9_-]/gi, '_');
}

// Record why a job's console could not be downloaded, so the analyzer can report it (e.g. 404 = purged)
function writeDownloadFailure(jobDir, url, error) {
  const failure = { url, error: error.message, ...(error.status ? { status: error.status } : {}) };
  fs.writeFileSync(path.join(jobDir, 'download-failure.json'), JSON.stringify(failure, null, 2));
}

// Recursively download pipeline logs. Every job is identified by its build URL.
async function downloadPipeline(buildUrl, parentDir, currentDepth = 0, analyzedJobs = new Set()) {
  const { baseUrl, jobName, buildNumber } = parseJenkinsUrl(buildUrl);
<<<<<<< HEAD
  if (isIgnoredJob(jobName)) {
    console.log(`Skipping ignored job: ${jobName}`);
    return;
  }
=======
>>>>>>> upstream/master
  const jobKey = makeBuildUrl(baseUrl, jobName, buildNumber);

  // Prevent circular downloads
  if (analyzedJobs.has(jobKey)) {
    console.log(`Skipping already downloaded: ${jobKey}`);
    return;
  }
  analyzedJobs.add(jobKey);

  // Hierarchical layout: children are nested inside the parent job's directory
  const jobDir = path.join(parentDir, `${sanitizeFilename(jobName)}_${buildNumber}`);
  fs.mkdirSync(jobDir, { recursive: true });

  try {
    const handler = resolveConsoleHandler(jobKey);
    const { consoleLog, buildInfo, consoleError } = handler
      ? await fetchViaConsoleHandler(handler, jobKey)
      : await fetchViaJenkinsApi(baseUrl, jobName, buildNumber);

    fs.writeFileSync(path.join(jobDir, 'build-info.json'), JSON.stringify(buildInfo, null, 2));
    if (consoleLog === null) {
      // Build info saved but no console: record why, and skip downstream discovery (it needs the console)
      writeDownloadFailure(jobDir, jobKey, consoleError);
      downloadFailures.push({ url: jobKey, error: consoleError.message });
      console.log(`⚠ Saved build info only (no console): ${jobDir}`);
      return;
    }
    fs.writeFileSync(path.join(jobDir, 'console.log'), consoleLog);
    console.log(`✓ Saved: ${jobDir}`);

    if (currentDepth < maxDepth) {
      const downstreamJobs = parseDownstreamJobs(consoleLog, baseUrl);
      console.log(`Found ${downstreamJobs.length} downstream jobs`);

      // Download ALL downstream jobs (not just failed ones)
      // A 500ms inter-job delay reduces the chance of hitting Jenkins rate limits
      for (const downstream of downstreamJobs) {
        await sleep(500);
        await downloadPipeline(downstream.buildUrl, jobDir, currentDepth + 1, analyzedJobs);
      }
    }
  } catch (error) {
    console.error(`✗ Failed to download ${jobName} #${buildNumber}:`, error.message);
    writeDownloadFailure(jobDir, jobKey, error);
    downloadFailures.push({ url: jobKey, error: error.message });
  }
}




// Main execution
async function main() {
  try {
    const { baseUrl, jobName, buildNumber } = parseJenkinsUrl(buildUrl);
    
    // Create output directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const defaultOutputDir = path.join(process.cwd(), `jenkins-logs-${timestamp}`);
    const finalOutputDir = outputDir || defaultOutputDir;
    
    console.log(`Jenkins Pipeline Log Downloader`);
    console.log(`================================`);
    console.log(`Build URL: ${buildUrl}`);
    console.log(`Job: ${jobName}`);
    console.log(`Build: #${buildNumber}`);
    console.log(`Max Depth: ${maxDepth}`);
    console.log(`Output: ${finalOutputDir}`);
    console.log(`================================\n`);
    
    fs.mkdirSync(finalOutputDir, { recursive: true });
    
    // Save metadata
    const metadata = {
      buildUrl,
      baseUrl,
      jobName,
      buildNumber,
      maxDepth,
      timestamp,
      downloadedAt: new Date().toISOString()
    };
    fs.writeFileSync(
      path.join(finalOutputDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    // Start recursive download - pass finalOutputDir as initial parent
    consoleHandlers = loadConsoleHandlers(handlersFile);
    await downloadPipeline(buildUrl, finalOutputDir, 0);
    
    console.log(`\n================================`);
    console.log(downloadFailures.length > 0 ? `⚠ Download finished with failures` : `✓ Download complete!`);
    console.log(`Output directory: ${finalOutputDir}`);
    if (downloadFailures.length > 0) {
      console.log(`\n⚠ Download failures: ${downloadFailures.length}`);
      for (const f of downloadFailures) console.log(`  ✗ ${f.url} — ${f.error}`);
    }
    console.log(`\nTo analyze these logs, run:`);
    console.log(`  node ${path.join(__dirname, 'jenkins-analyze.js')} "${finalOutputDir}" --out-dir "${finalOutputDir}"`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();

// Made with Your AI
