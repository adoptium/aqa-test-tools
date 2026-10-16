// Renders an analysis result as the markdown pipeline report: summary counts plus the job tree.

const ICONS = { SUCCESS: '✅', FAILURE: '❌', UNSTABLE: '⚠️', ABORTED: '🚫' };
const iconFor = (status) => ICONS[status] ?? '❓';

// Successful Test_ jobs with nothing to report (no failures, no reruns, no children) add no information
// to the platform summary, only tokens. They are folded into one count line per parent job; they still
// count in the Summary Statistics.
function isPlainSuccessTestJob(a) {
  const { result, jobName, stillRunning } = a.buildInfo;
  return (
    result === 'SUCCESS' &&
    !stillRunning &&
    jobName.startsWith('Test_') &&
    !/_rerun\b/.test(jobName) &&
    !(a.downstreamAnalyses?.length > 0) &&
    !(a.targetResults?.length > 0) &&
    !(a.testTargetsSummary?.failed_targets?.length > 0)
  );
}

// Direct children of the root pipeline job are the per-platform build jobs, e.g.
// "build-scripts » jobs » release » jobs » jdk21u » jdk21u-release-alpine-linux-x64-temurin #33"
// -> "alpine-linux-x64". Anything else (e.g. refactor_openjdk_release_tool) is grouped as "other jobs".
// Each section is wrapped in marker comments so a reader can find and chunk it by line range:
//   <!-- PLATFORM START: alpine-linux-x64 -->  ...  <!-- PLATFORM END: alpine-linux-x64 -->
const PLATFORM_JOB = /^jdk\d+u?-(?:release-)?(.+?)-[a-z0-9_]+$/;
const OTHER_LABEL = 'other-jobs';
function platformLabel(analysis) {
  const name = analysis.buildInfo.jobName.replace(/\s+#\d+\s*$/, '').split('»').pop().trim();
  return PLATFORM_JOB.exec(name)?.[1] ?? null;
}
const markerStart = (label) => (label === OTHER_LABEL ? `<!-- OTHER JOBS START -->` : `<!-- PLATFORM START: ${label} -->`);
const markerEnd = (label) => (label === OTHER_LABEL ? `<!-- OTHER JOBS END -->` : `<!-- PLATFORM END: ${label} -->`);
const MARKER = /^<!-- (PLATFORM|OTHER JOBS) (START|END)(?:: (.+?))? -->$/;

// Rerun lists repeat entries and can contain whole job-parameter strings: dedupe and cap the length.
const MAX_ITEM_LENGTH = 200;
const compactItems = (items) =>
  [...new Set(items.map((t) => (t.length > MAX_ITEM_LENGTH ? `${t.slice(0, MAX_ITEM_LENGTH)}…` : t)))];

export function formatTreeOutput(analysis, level = 0, itemNumber = 1) {
  const lines = [];
  const indent = '  '.repeat(level);
  const result = analysis.buildInfo.result;
  const { stillRunning, logsUnavailable } = analysis.buildInfo;
  const displayResult =
    result !== 'UNKNOWN' ? result : stillRunning ? 'UNKNOWN/still running' : logsUnavailable ? 'UNKNOWN/logs unavailable' : 'UNKNOWN/result unknown';

  // fullDisplayName already includes "#NN"; drop an accidentally duplicated "#NN #NN"
  let jobDisplayName = analysis.buildInfo.jobName;
  const deduped = jobDisplayName.replace(/\s+#(\d+)\s+#\1$/, ' #$1');
  jobDisplayName = deduped !== jobDisplayName ? deduped : jobDisplayName.replace(/(\s+#\d+)\s+#\d+$/, '$1');

  const durationSec = Math.round(analysis.buildInfo.duration / 1000);
  const prefix = level === 0 ? '###' : level === 1 ? `${itemNumber}.` : '-';
  const jobUrl = analysis.buildInfo.url;
  const jobNameFormatted = jobUrl ? `[${jobDisplayName}](${jobUrl})` : jobDisplayName;

  lines.push(`${indent}${prefix} ${iconFor(result)} **${jobNameFormatted}** [${displayResult}] (${durationSec}s)`);

  const summary = analysis.testTargetsSummary;
  if (summary) {
    const si = '  '.repeat(level + 1);
    lines.push(`${si}- 📋 **TEST TARGETS SUMMARY:**`);

    if (summary.totals) {
      lines.push(
        `${si}  - 📊 Totals: ${summary.totals.executed} executed, ${summary.totals.passed} passed, ${summary.totals.failed} failed`
      );
    }

    const rerun = summary.rerun_info;
    if (rerun) {
      lines.push(`${si}  - 🔄 **RERUN INFORMATION:**`);
      if (rerun.rerun_testcases?.length > 0) {
        lines.push(`${si}    - Rerun test cases: ${rerun.rerun_testcases.length}`);
      }
      if (rerun.rerun_targets?.length > 0) {
        lines.push(`${si}    - Rerun test targets: ${rerun.rerun_targets.join(', ')}`);
      }
      if (rerun.rerun_passed?.length > 0) {
        const passed = compactItems(rerun.rerun_passed);
        lines.push(`${si}    - ✅ Passed on rerun (${passed.length}):`);
        passed.forEach((t) => lines.push(`${si}      - ${t}`));
      }
      if (rerun.rerun_failed?.length > 0) {
        const failed = compactItems(rerun.rerun_failed);
        lines.push(`${si}    - ❌ Still failed on rerun (${failed.length}):`);
        failed.forEach((t) => lines.push(`${si}      - ${t}`));
      }
    }

    if (summary.failed_targets.length > 0) {
      // A job that finished SUCCESS recovered these failures on its rerun job: they are not final failures
      const recovered = result === 'SUCCESS';
      lines.push(
        recovered
          ? `${si}  - 🔁 **RECOVERED test targets (${summary.failed_targets.length}) — failed in initial run, passed on rerun; job finished SUCCESS, NOT a final failure:**`
          : `${si}  - ❌ **FAILED test targets (${summary.failed_targets.length}):**`
      );
      for (const target of summary.failed_targets) {
        lines.push(`${si}    - ${recovered ? '🟢' : '🔴'} **${target.target}**`);
        lines.push(`${si}      - Stats: ${target.stats}`);
        if (target.failed_tests.length > 0) {
          lines.push(`${si}      - Failed tests (${target.failed_tests.length}):`);
          target.failed_tests.forEach((t) => lines.push(`${si}        - ${t}`));
        }
      }
    }

    if (summary.passed_targets.length > 0) {
      lines.push(`${si}  - ✅ PASSED test targets (${summary.passed_targets.length})`);
    }
  }

  if (analysis.targetResults?.length > 0) {
    const ji = '  '.repeat(level + 1);
    lines.push(`${ji}- 🧪 **TARGET RESULTS:**`);
    for (const r of analysis.targetResults) {
      lines.push(`${ji}  - ${iconFor(r.status)} Platform: ${r.platform}, Target: ${r.target}, Status: ${r.status}`);
    }
  }

  if (analysis.failureDetails && (result !== 'SUCCESS' || analysis.buildInfo.logsUnavailable)) {
    lines.push(`${'  '.repeat(level + 1)}- 💡 ${analysis.failureDetails.rootCause}`);
  }

  if (analysis.downstreamAnalyses?.length > 0) {
    lines.push(`${'  '.repeat(level + 1)}- 🔗 **Downstream Jobs:**`);
    const plain = analysis.downstreamAnalyses.filter(isPlainSuccessTestJob);
    const shown = analysis.downstreamAnalyses.filter((d) => !isPlainSuccessTestJob(d));
    // Only the root's children are platform sections; markers are emitted only if at least one is a platform
    const labels = level === 0 ? shown.map((d) => platformLabel(d) ?? OTHER_LABEL) : [];
    const useMarkers = labels.some((l) => l !== OTHER_LABEL);
    let open = null;
    shown.forEach((d, idx) => {
      if (useMarkers && labels[idx] !== open) {
        if (open) lines.push(markerEnd(open));
        open = labels[idx];
        lines.push(markerStart(open));
      }
      lines.push(formatTreeOutput(d, level + 2, idx + 1));
    });
    if (open) lines.push(markerEnd(open));
    if (plain.length > 0) {
      lines.push(`${'  '.repeat(level + 2)}- ✅ ${plain.length} more successful test job(s) with no failures (omitted)`);
    }
  }

  return lines.join('\n');
}

export function countJobs(analysis) {
  let total = 1;
  let failed = analysis.buildInfo.result === 'FAILURE' ? 1 : 0;
  let success = analysis.buildInfo.result === 'SUCCESS' ? 1 : 0;
  let running = analysis.buildInfo.stillRunning ? 1 : 0;
  for (const d of analysis.downstreamAnalyses ?? []) {
    const c = countJobs(d);
    total += c.total;
    failed += c.failed;
    success += c.success;
    running += c.running;
  }
  return { total, failed, success, running };
}

/**
 * Pruned copy of the job tree containing only still-running jobs and their ancestors.
 * Returns null when neither this job nor any descendant is still running.
 */
export function pruneToRunning(analysis) {
  const children = (analysis.downstreamAnalyses ?? []).map(pruneToRunning).filter(Boolean);
  if (!analysis.buildInfo.stillRunning && children.length === 0) return null;
  return { analysis, children };
}

function formatRunningNode(node, depth) {
  const { buildInfo } = node.analysis;
  const name = buildInfo.url ? `[${buildInfo.jobName}](${buildInfo.url})` : buildInfo.jobName;
  const marker = buildInfo.stillRunning ? '⏳ **STILL RUNNING**' : '↳ contains running jobs';
  const lines = [`${'  '.repeat(depth)}- ${name} — ${marker}`];
  for (const child of node.children) lines.push(formatRunningNode(child, depth + 1));
  return lines.join('\n');
}

/** Markdown section listing the still-running jobs as a tree, or '' if everything has finished. */
export function formatRunningSection(analysis) {
  const tree = pruneToRunning(analysis);
  if (!tree) return '';
  return `## ⏳ Still Running Jobs

Jobs below have no \`Finished:\` line in their console log. Jobs marked "contains running jobs" are shown only for context.

${formatRunningNode(tree, 0)}

`;
}

// Section index: one row per marker pair, with 1-based line numbers in the final file.
function formatSectionIndex(sections) {
  if (sections.length === 0) return '';
  const rows = sections.map(
    (s) => `| ${s.label} | ${s.start} | ${s.end} | ${s.end - s.start + 1} |`
  );
  return `## Section Index

Line numbers refer to this file. Each section is wrapped in \`<!-- PLATFORM START: name -->\` / \`<!-- PLATFORM END: name -->\` marker lines (\`grep -n "START:\\|END:\\|JOBS START\\|JOBS END"\`). Lines before the first section are the root pipeline job line.

| Section | Start line | End line | Lines |
|---------|-----------|---------|-------|
${rows.join('\n')}

`;
}

/** The markdown report written to pipeline-analysis-<timestamp>.md */
export function renderReport(analysis) {
  const stats = countJobs(analysis);
  const tree = formatTreeOutput(analysis);
  const treeLines = tree.split('\n');

  // Locate the marker pairs inside the tree (0-based, relative to the tree's first line)
  const found = [];
  let current = null;
  treeLines.forEach((line, i) => {
    const m = MARKER.exec(line);
    if (!m) return;
    if (m[2] === 'START') current = { label: m[1] === 'PLATFORM' ? m[3] : OTHER_LABEL, start: i };
    else if (current) found.push({ ...current, end: i });
  });

  const build = (treeFirstLine) => {
    const sections = found.map((s) => ({ label: s.label, start: treeFirstLine + s.start, end: treeFirstLine + s.end }));
    const head = `# Jenkins Pipeline Analysis

## Summary Statistics
- **Total Jobs**: ${stats.total}
- **✅ Successful**: ${stats.success}
- **❌ Failed**: ${stats.failed}
- **⏳ Still running**: ${stats.running}
- **⚠️ Other (Unstable/Aborted/Unknown)**: ${stats.total - stats.success - stats.failed - stats.running}

${formatSectionIndex(sections)}${formatRunningSection(analysis)}## Detailed Pipeline Tree

`;
    return head;
  };

  // The index length does not depend on the numbers in it, so one pass fixes the offset for the second
  const firstLine = build(0).split('\n').length;
  return `${build(firstLine)}${tree}\n`;
}
