import * as fs from 'node:fs';
import * as path from 'node:path';
import { grepWithContext, tailLines, isJobFinished, finishedResult } from './logtools.js';

// Analyzes a downloaded Jenkins pipeline directory: classifies each job as a test or build job,
// extracts failures from its console log, and recurses into downstream job directories.

let verbose = false;
export function setVerbose(v) {
  verbose = v;
}
function log(msg) {
  if (verbose) console.error(msg);
}

// Test_ = individual test jobs; AQA_Test_Pipeline_ = orchestration pipelines that launch Test_ jobs.
export function detectJobType(jobName) {
  return jobName.startsWith('Test_') || jobName.startsWith('AQA_Test_Pipeline_') ? 'test' : 'build';
}

// Ignore utility/generator jobs like Test_Job_Auto_Gen whose instances are frequently purged by Jenkins
export function isIgnoredJob(jobName) {
  if (!jobName) return false;
  return /(?:^|[^a-zA-Z0-9])Test_Job_Auto_Gen(?:$|[^a-zA-Z0-9])/.test(jobName);
}

// Downstream job results reported in a console log. Two equivalent line formats are recognised:
//   "Build <job path> #<n> completed: <STATUS>"
//        -> { jobName, buildNumber, status }
//   "[ts] Remote job jdk21 :  : weekly : aarch64_linux Target: extended.custom Status: SUCCESS"
//        -> { jobName: <target>, platform, target, status }
export function extractDownstreamResults(logPath) {
  const results = [];
  const output = grepWithContext(logPath, 'Build .* completed:|Remote job .* Target: [^ ]+ Status: [A-Z_]+');
  for (const line of output.split('\n')) {
    const completed = line.match(/Build\s+(.+?)\s+#(\d+)\s+completed:\s+(\w+)/);
    if (completed) {
      const jobName = completed[1].replace(/\s+»\s+/g, '/job/');
      if (isIgnoredJob(jobName)) continue;
      results.push({
        jobName,
        buildNumber: parseInt(completed[2]),
        status: completed[3],
      });
      continue;
    }
    const target = line.match(/Remote job (.+?)\s+Target:\s+(\S+)\s+Status:\s+(\S+)/);
    if (target) {
      if (isIgnoredJob(target[2]) || isIgnoredJob(target[1])) continue;
      const segments = target[1].split(':').map((s) => s.trim()).filter((s) => s.length > 0);
      const platform = segments.length > 0 ? segments[segments.length - 1] : target[1].trim();
      results.push({ jobName: target[2], platform, target: target[2], status: target[3] });
    }
  }
  return results;
}

export function extractRerunTargets(logPath) {
  const rerunInfo = {};

  // CUSTOM_TARGET= holds space-delimited test cases
  const customTargetMatch = grepWithContext(logPath, 'CUSTOM_TARGET=');
  if (customTargetMatch) {
    const match = customTargetMatch.match(/CUSTOM_TARGET=["']?([^"'\n]+)["']?/);
    if (match && match[1]) {
      const value = match[1].trim();
      if (value.length > 0) rerunInfo.rerun_testcases = value.split(/\s+/).filter((t) => t.length > 0);
    }
  }

  // TARGET=testList TESTLIST= holds comma-delimited test targets (only used if no CUSTOM_TARGET)
  if (!rerunInfo.rerun_testcases || rerunInfo.rerun_testcases.length === 0) {
    const targetMatch = grepWithContext(logPath, 'TARGET=testList TESTLIST=');
    if (targetMatch) {
      const match = targetMatch.match(/TARGET=testList\s+TESTLIST=["']?([^"'\n]+)["']?/);
      if (match && match[1]) {
        const value = match[1].trim();
        if (value.length > 0) {
          rerunInfo.rerun_targets = value.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
        }
      }
    }
  }
  return rerunInfo;
}

// Raw TEST TARGETS SUMMARY text (timestamps stripped, max 200 lines)
export function extractTestTargetsSummary(logContent) {
  const clean = logContent.replace(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]\s*/g, '');
  const idx = clean.indexOf('TEST TARGETS SUMMARY');
  if (idx === -1) return null;
  return clean.substring(idx).split('\n').slice(0, 200).join('\n');
}

export function parseTestTargetsSummary(logContent) {
  const summaryText = extractTestTargetsSummary(logContent);
  if (!summaryText) return null;

  const result = { passed_targets: [], failed_targets: [] };

  const failedMatch = summaryText.match(/FAILED test targets:([\s\S]*?)(?=\nTOTAL:|$)/);
  if (failedMatch) {
    let currentTarget = null;
    let inFailedTestCases = false;

    for (const line of failedMatch[1].split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('TOTAL:')) continue;
      // Redacted entries (e.g. "TEST: ### REDACTED ###") carry no usable information
      if (trimmed.includes('REDACTED')) continue;

      if (trimmed === 'Failed test cases:') {
        inFailedTestCases = true;
        continue;
      }
      if (inFailedTestCases && trimmed.startsWith('TEST:')) {
        const testName = trimmed.replace(/^TEST:\s*/, '').trim();
        if (currentTarget && testName) currentTarget.failed_tests.push(testName);
        continue;
      }
      if (inFailedTestCases && !trimmed.startsWith('TEST:')) inFailedTestCases = false;

      // Target line: "name" or "name - Test results: ..."
      const targetMatch = trimmed.match(/^(\S+)(?:\s+-\s+Test results:\s+(.+))?$/);
      if (targetMatch && !trimmed.startsWith('TEST:')) {
        if (currentTarget) result.failed_targets.push(currentTarget);
        currentTarget = { target: targetMatch[1], stats: targetMatch[2] || '', failed_tests: [] };
        inFailedTestCases = false;
      }
    }
    if (currentTarget) result.failed_targets.push(currentTarget);
  }

  const totalMatch = summaryText.match(
    /TOTAL:\s+(\d+)\s+EXECUTED:\s+(\d+)\s+PASSED:\s+(\d+)\s+FAILED:\s+(\d+)\s+DISABLED:\s+(\d+)\s+SKIPPED:\s+(\d+)/
  );
  if (totalMatch) {
    result.totals = {
      total: parseInt(totalMatch[1]),
      executed: parseInt(totalMatch[2]),
      passed: parseInt(totalMatch[3]),
      failed: parseInt(totalMatch[4]),
      disabled: parseInt(totalMatch[5]),
      skipped: parseInt(totalMatch[6]),
    };
  }
  return result;
}

function buildInfoOf(info) {
  return {
    jobName: info.fullDisplayName || 'unknown',
    buildNumber: info.number || 0,
    result: info.result || 'UNKNOWN',
    duration: info.duration || 0,
    url: info.url || '',
    ...(info.stillRunning ? { stillRunning: true } : {}),
    ...(info.logsUnavailable ? { logsUnavailable: true } : {}),
  };
}

/**
 * Settle a job's result from its console log. Mutates info.
 * - "Finished:" present: the job is done. build-info.json may carry no result (stubs written for
 *   console-handler jobs only hold names and URLs), so take it from the "Finished: <RESULT>" line.
 * - "Finished:" absent: the job is still running and its result is not final.
 */
function resolveRunState(info, logPath) {
  if (isJobFinished(logPath)) {
    info.result = info.result || finishedResult(logPath) || 'UNKNOWN';
    return;
  }
  info.result = 'UNKNOWN';
  info.stillRunning = true;
  log(`Job still running (no "Finished:" found): ${info.fullDisplayName}`);
}

function stillRunning(info, endingSection) {
  return {
    buildInfo: buildInfoOf(info),
    quickSummary: { category: 'still_running', confidence: 0.8, oneLineSummary: 'No visible issues, still running' },
    failureDetails: {
      rootCause: 'No visible issues, still running',
      affectedComponents: ['test_execution'],
      recommendations: [
        'Job may still be executing',
        'Check Jenkins UI for current status',
        'Wait for job completion before analyzing',
      ],
    },
    failureLogTail: endingSection,
  };
}

const TEST_ERROR_PATTERNS = [
  { pattern: 'Cannot run program', category: 'execution_error' },
  { pattern: 'java.io.IOException', category: 'io_error' },
  { pattern: 'Error:', category: 'general_error' },
  { pattern: 'Exception', category: 'exception' },
  { pattern: 'FAILED', category: 'test_failure' },
  { pattern: 'BUILD FAILED', category: 'build_failure' },
  { pattern: 'Exec failed', category: 'execution_error' },
];

const LOG_REVIEW_RECOMMENDATIONS = [
  'Review the last 300 lines of console log for error details',
  'Check if test environment is properly configured',
  'Verify required dependencies are available',
];

function analyzeTestJobCore(logPath, buildInfoPath) {
  log(`Analyzing test job: ${logPath}`);
  const info = JSON.parse(fs.readFileSync(buildInfoPath, 'utf-8'));

  resolveRunState(info, logPath);

  const summarySection = grepWithContext(logPath, 'TEST TARGETS SUMMARY', 10, 200);
  const testTargetsSummaryRaw = summarySection ? extractTestTargetsSummary(summarySection) : null;
  const testTargetsSummary = summarySection ? parseTestTargetsSummary(summarySection) : null;

  if (!summarySection || !testTargetsSummary) {
    if (info.result !== 'SUCCESS') {
      const endingSection = tailLines(logPath, 300);

      let detectedError = '';
      let errorCategory = 'unknown_failure';
      const endingLines = endingSection.split('\n');
      for (const { pattern, category } of TEST_ERROR_PATTERNS) {
        const hit = endingLines.find((l) => l.includes(pattern));
        if (hit !== undefined) {
          detectedError = hit.trim();
          errorCategory = category;
          break;
        }
      }

      if (info.stillRunning && !detectedError) return stillRunning(info, endingSection);

      if (detectedError) {
        return {
          buildInfo: buildInfoOf(info),
          quickSummary: { category: errorCategory, confidence: 0.7, oneLineSummary: detectedError },
          failureDetails: {
            rootCause: detectedError,
            affectedComponents: ['test_execution'],
            recommendations: LOG_REVIEW_RECOMMENDATIONS,
          },
          failureLogTail: endingSection,
        };
      }

      return {
        buildInfo: buildInfoOf(info),
        quickSummary: {
          category: 'unknown_failure',
          confidence: 0.3,
          oneLineSummary: 'Unknown Failure - No TEST TARGETS SUMMARY found',
        },
        failureDetails: {
          rootCause: 'No specific error could be identified from the logs',
          affectedComponents: ['test_execution'],
          recommendations: LOG_REVIEW_RECOMMENDATIONS,
        },
        failureLogTail: endingSection,
      };
    }

    // SUCCESS without a summary is unusual but not an error
    return {
      buildInfo: buildInfoOf(info),
      quickSummary: { category: 'test_no_summary', confidence: 0.5, oneLineSummary: 'No TEST TARGETS SUMMARY found in log' },
    };
  }

  const failedTargetNames = testTargetsSummary.failed_targets.map((t) => t.target);
  const totalFailedTests = testTargetsSummary.failed_targets.reduce((sum, t) => sum + t.failed_tests.length, 0);

  return {
    buildInfo: buildInfoOf(info),
    quickSummary: {
      category: 'test_failure',
      confidence: 0.9,
      oneLineSummary: testTargetsSummary.totals
        ? `${testTargetsSummary.totals.failed} test target(s) failed, ${totalFailedTests} test case(s) failed`
        : `${failedTargetNames.length} test target(s) failed, ${totalFailedTests} test case(s) failed`,
    },
    failureDetails: {
      rootCause: `Test failures detected in targets: ${failedTargetNames.join(', ')}`,
      affectedComponents: failedTargetNames,
      recommendations: [
        'Review individual test case failures in TEST TARGETS SUMMARY',
        'Check for environmental issues',
        'Compare with previous successful builds',
      ],
    },
    testTargetsSummary,
    testTargetsSummaryRaw: testTargetsSummaryRaw || undefined,
  };
}

// Test job analysis plus any per-target results the job reports ("Remote job ... Target: ... Status:" lines)
function analyzeTestJob(logPath, buildInfoPath) {
  const analysis = analyzeTestJobCore(logPath, buildInfoPath);
  const targetResults = extractDownstreamResults(logPath).filter((r) => r.target);
  if (targetResults.length > 0) {
    analysis.targetResults = targetResults;
    if (analysis.quickSummary.category === 'test_no_summary') {
      analysis.quickSummary.oneLineSummary =
        `${targetResults.length} target(s): ` + targetResults.map((r) => `${r.target}=${r.status}`).join(', ');
    }
  }
  return analysis;
}

function analyzeBuildJob(logPath, buildInfoPath) {
  log(`Analyzing build job: ${logPath}`);
  const info = JSON.parse(fs.readFileSync(buildInfoPath, 'utf-8'));

  resolveRunState(info, logPath);

  const downstreamJobs = extractDownstreamResults(logPath);

  const errors = [];
  for (const pattern of ['ERROR', 'FATAL', 'Exception', 'failed', 'BUILD FAILED']) {
    const errorContext = grepWithContext(logPath, pattern, 2, 2);
    if (errorContext) {
      errors.push(...errorContext.split('\n').slice(0, 5).filter((l) => l.trim()));
    }
  }

  const failedDownstream = downstreamJobs.filter((j) => j.status !== 'SUCCESS');
  return {
    buildInfo: buildInfoOf(info),
    quickSummary: {
      category: info.result === 'FAILURE' ? 'build_failure' : 'build_unstable',
      confidence: 0.8,
      oneLineSummary: `Build ${info.result}, ${downstreamJobs.length} downstream jobs triggered (${failedDownstream.length} failed)`,
    },
    failureDetails: {
      rootCause: errors.length > 0 ? errors.slice(0, 3).join(' | ') : 'See ending section for details',
      affectedComponents: failedDownstream.map((j) => j.jobName),
      recommendations: [
        'Check build logs for compilation errors',
        'Review downstream job failures',
        'Verify build environment configuration',
      ],
    },
  };
}

function readJsonIfPresent(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

/** Human-readable reason from a download-failure.json written by the downloader. */
function describeDownloadFailure(failure) {
  if (!failure) return 'directory is empty';
  if (failure.status === 404) return 'HTTP 404 — console likely purged by Jenkins';
  return failure.error || 'download failed';
}

/**
 * Entry for a child job whose console.log is missing. Uses build-info.json when the downloader still
 * saved it (real result and duration), otherwise rebuilds a stub from the directory name
 * (<JobName>_<buildNumber>). Never marked stillRunning: the state is unknown, not "running".
 */
function logsUnavailableEntry(dir, dirName, opts) {
  const info = readJsonIfPresent(path.join(dir, 'build-info.json'));
  const reason = describeDownloadFailure(readJsonIfPresent(path.join(dir, 'download-failure.json')));

  let buildInfo;
  if (info) {
    buildInfo = buildInfoOf({ ...info, logsUnavailable: true });
  } else {
    const match = dirName.match(/^(.+?)_(\d+)$/);
    if (!match) return null;
    const jobName = match[1];
    const buildNumber = parseInt(match[2], 10);
    buildInfo = buildInfoOf({
      fullDisplayName: `${jobName} #${buildNumber}`,
      number: buildNumber,
      url: `${opts.jenkinsUrl.replace(/\/+$/, '')}/job/${jobName}/${buildNumber}/`,
      logsUnavailable: true,
    });
  }
  log(`Logs unavailable (${reason}): ${buildInfo.jobName}`);

  const summary = info ? `Console log not available (${reason})` : `Logs not downloaded — ${reason}`;
  return {
    buildInfo,
    quickSummary: { category: 'logs_unavailable', confidence: 0, oneLineSummary: summary },
    failureDetails: {
      rootCause: `${summary}; its downstream jobs could not be discovered`,
      affectedComponents: [],
      recommendations: [],
    },
  };
}

/**
 * When a job is still-running but a parent's TARGET RESULTS already recorded the outcome for a
 * matching target, the parent is authoritative.  Walk the child's full downstream tree and override
 * any still-running node whose job name contains one of the parent's target names.
 *
 * Matching rule: the job name must contain the target string (e.g. "extended.jck") as a substring,
 * using a case-insensitive dot-aware comparison (dots in target names are treated literally).
 */
function resolveStillRunningFromParentTargets(childAnalysis, parentTargetResults) {
  if (!parentTargetResults || parentTargetResults.length === 0) return;

  if (childAnalysis.buildInfo.stillRunning) {
    const jobName = childAnalysis.buildInfo.jobName;
    for (const tr of parentTargetResults) {
      // Escape dots in target names so "extended.jck" matches literally, not as regex wildcard
      const escapedTarget = tr.target.replace(/\./g, '\\.');
      if (new RegExp(escapedTarget, 'i').test(jobName)) {
        // Override the still-running state with the parent-reported result
        childAnalysis.buildInfo.result = tr.status;
        delete childAnalysis.buildInfo.stillRunning;
        childAnalysis.quickSummary = {
          category: tr.status === 'FAILURE' ? 'test_failure' : tr.status === 'UNSTABLE' ? 'test_failure' : 'test_no_summary',
          confidence: 0.9,
          oneLineSummary: `Result from parent TARGET RESULTS: ${tr.target}=${tr.status}`,
        };
        if (childAnalysis.failureDetails) {
          childAnalysis.failureDetails.rootCause = `Result from parent TARGET RESULTS: ${tr.target}=${tr.status}`;
        }
        break;
      }
    }
  }

  // Recurse into downstream jobs first so children are resolved before we inspect them below
  for (const downstream of childAnalysis.downstreamAnalyses ?? []) {
    resolveStillRunningFromParentTargets(downstream, parentTargetResults);
  }

  // AQA_Test_Pipeline intermediary jobs (e.g. AQA_Test_Pipeline #18752) don't carry a target name
  // themselves; they are pure orchestrators. The stillRunning guard ensures we only do this when the
  // job has no result of its own (no "Finished:" line in its console). Once all their downstream
  // jobs are resolved, they must also have completed — infer result from the worst child outcome.
  if (
    childAnalysis.buildInfo.stillRunning &&
    childAnalysis.buildInfo.jobName.includes('AQA_Test_Pipeline') &&
    (childAnalysis.downstreamAnalyses?.length ?? 0) > 0 &&
    !childAnalysis.downstreamAnalyses.some((d) => d.buildInfo.stillRunning)
  ) {
    const SEVERITY = { FAILURE: 3, UNSTABLE: 2, SUCCESS: 1 };
    const worstResult = childAnalysis.downstreamAnalyses.reduce(
      (worst, d) => ((SEVERITY[d.buildInfo.result] ?? 0) > (SEVERITY[worst] ?? 0) ? d.buildInfo.result : worst),
      'UNKNOWN'
    );
    childAnalysis.buildInfo.result = worstResult;
    delete childAnalysis.buildInfo.stillRunning;
    childAnalysis.quickSummary = {
      category: worstResult === 'FAILURE' ? 'test_failure' : worstResult === 'UNSTABLE' ? 'test_failure' : 'test_no_summary',
      confidence: 0.8,
      oneLineSummary: `Result inferred from downstream jobs: ${worstResult}`,
    };
    if (childAnalysis.failureDetails) {
      childAnalysis.failureDetails.rootCause = `Result inferred from downstream jobs: ${worstResult}`;
    }
  }
}

/**
 * Recursively analyze a job directory (console.log + build-info.json) and its child job directories.
 * @param {string} jobDir
 * @param {{jenkinsUrl: string}} opts jenkinsUrl is used to build stub entries for empty directories
 */
export function analyzeJobDirectory(jobDir, opts) {
  const logPath = path.join(jobDir, 'console.log');
  const infoPath = path.join(jobDir, 'build-info.json');
  if (!fs.existsSync(logPath) || !fs.existsSync(infoPath)) {
    throw new Error(`Missing console.log or build-info.json in ${jobDir}`);
  }

  const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
  const analysis =
    detectJobType(info.fullDisplayName || '') === 'test'
      ? analyzeTestJob(logPath, infoPath)
      : analyzeBuildJob(logPath, infoPath);

  const childDirs = fs.readdirSync(jobDir, { withFileTypes: true }).filter((e) => e.isDirectory());

  for (const childDir of childDirs) {
    if (isIgnoredJob(childDir.name)) continue;
    const childPath = path.join(jobDir, childDir.name);
    const childLogPath = path.join(childPath, 'console.log');
    const childInfoPath = path.join(childPath, 'build-info.json');
    const hasLog = fs.existsSync(childLogPath);
    const hasInfo = fs.existsSync(childInfoPath);

    if (hasLog && hasInfo) {
      try {
        const childAnalysis = analyzeJobDirectory(childPath, opts);
        const childInfo = JSON.parse(fs.readFileSync(childInfoPath, 'utf-8'));

        // Rerun jobs: record what was rerun and what passed / still failed
        if ((childInfo.fullDisplayName || '').includes('_rerun')) {
          const rerunInfo = extractRerunTargets(childLogPath);
          const failedTargets = childAnalysis.testTargetsSummary?.failed_targets ?? [];

          if (rerunInfo.rerun_testcases && rerunInfo.rerun_testcases.length > 0) {
            const rerunFailed = failedTargets.flatMap((t) => t.failed_tests);
            rerunInfo.rerun_failed = rerunFailed;
            rerunInfo.rerun_passed = rerunInfo.rerun_testcases.filter((tc) => !rerunFailed.includes(tc));
          } else if (rerunInfo.rerun_targets && rerunInfo.rerun_targets.length > 0) {
            const failedNames = failedTargets.map((t) => t.target);
            rerunInfo.rerun_failed = failedNames;
            rerunInfo.rerun_passed = rerunInfo.rerun_targets.filter((t) => !failedNames.includes(t));
          }

          if (childAnalysis.testTargetsSummary) childAnalysis.testTargetsSummary.rerun_info = rerunInfo;
        }

        // If this job has TARGET RESULTS from its parent-reported outcomes, use them to resolve any
        // still-running descendants whose job names match a target (parent is authoritative once it
        // has completed and recorded results for all targets).
        if (analysis.targetResults?.length > 0) {
          resolveStillRunningFromParentTargets(childAnalysis, analysis.targetResults);
        }

        (analysis.downstreamAnalyses ??= []).push(childAnalysis);
      } catch (error) {
        console.error(`Failed to analyze child directory ${childPath}: ${error.message}`);
      }
    } else if (!hasLog) {
      // Console log missing: the download failed (e.g. HTTP 404 after Jenkins purged it) or was cut short
      const entry = logsUnavailableEntry(childPath, childDir.name, opts);
      if (entry) (analysis.downstreamAnalyses ??= []).push(entry);
    }
  }
  return analysis;
}

/**
 * Analyze a pipeline directory created by download-pipeline-logs.cjs.
 * Layout: <pipelineDir>/metadata.json and <pipelineDir>/<rootJob>/{console.log,build-info.json,<child jobs>/...}
 */
export function analyzePipeline(pipelineDir, opts = { jenkinsUrl: 'https://ci.adoptium.net' }) {
  log(`Analyzing pipeline directory: ${pipelineDir}`);
  if (!fs.existsSync(path.join(pipelineDir, 'metadata.json'))) {
    throw new Error(`No metadata.json found in ${pipelineDir}`);
  }

  const jobDirs = fs
    .readdirSync(pipelineDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !isIgnoredJob(e.name) && fs.existsSync(path.join(pipelineDir, e.name, 'console.log')));

  if (jobDirs.length === 0) throw new Error(`No root job directory found in ${pipelineDir}`);
  if (jobDirs.length > 1) {
    console.error(`Warning: Multiple root job directories found, using first one: ${jobDirs[0].name}`);
  }
  return analyzeJobDirectory(path.join(pipelineDir, jobDirs[0].name), opts);
}
