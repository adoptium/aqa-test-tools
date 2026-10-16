import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { grepWithContext, tailLines, isJobFinished } from '../src/logtools.js';
import { parseTestTargetsSummary, detectJobType, isIgnoredJob, extractDownstreamResults } from '../src/analyzer.js';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'jenkins-analyze.js');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jenkins-cli-'));
}

test('grepWithContext matches grep -E -B/-A semantics', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'a.log');
  fs.writeFileSync(f, ['1', '2', 'HIT', '4', '5', '6', '7', 'HIT', '9', '10'].join('\n') + '\n');
  assert.equal(grepWithContext(f, 'HIT'), 'HIT\nHIT\n');
  assert.equal(grepWithContext(f, 'HIT', 1, 1), '2\nHIT\n4\n--\n7\nHIT\n9\n');
  // overlapping windows merge without a separator
  assert.equal(grepWithContext(f, 'HIT', 3, 3), '1\n2\nHIT\n4\n5\n6\n7\nHIT\n9\n10\n');
  assert.equal(grepWithContext(f, 'NOPE'), '');
  assert.equal(grepWithContext(path.join(dir, 'missing.log'), 'x'), '');
});

test('tailLines and isJobFinished', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'a.log');
  fs.writeFileSync(f, 'a\nb\nc\nd\nFinished: SUCCESS\n');
  assert.equal(tailLines(f, 2), 'd\nFinished: SUCCESS\n');
  assert.equal(isJobFinished(f), true);
  const g = path.join(dir, 'b.log');
  fs.writeFileSync(g, 'a\nb\n');
  assert.equal(isJobFinished(g), false);
});

test('parseTestTargetsSummary extracts failed targets, tests and totals', () => {
  const log = [
    'TEST TARGETS SUMMARY',
    'FAILED test targets:',
    '  jdk_net_0 - Test results: total: 3; passed: 2; failed: 1',
    '  Failed test cases:',
    '    TEST: java/net/Foo.java',
    'TOTAL: 3 EXECUTED: 3 PASSED: 2 FAILED: 1 DISABLED: 0 SKIPPED: 0',
  ].join('\n');
  const s = parseTestTargetsSummary(log);
  assert.equal(s.failed_targets.length, 1);
  assert.equal(s.failed_targets[0].target, 'jdk_net_0');
  assert.deepEqual(s.failed_targets[0].failed_tests, ['java/net/Foo.java']);
  assert.equal(s.totals.failed, 1);
});

test('parseTestTargetsSummary ignores REDACTED lines but keeps the target and its stats', () => {
  const log = [
    '[2026-10-10T12:09:49.488Z] TEST TARGETS SUMMARY',
    '[2026-10-10T12:09:49.488Z] PASSED test targets:',
    '[2026-10-10T12:09:49.488Z] \tcustomruntime_custom_0 - Test results: passed: 26 ',
    '[2026-10-10T12:09:49.489Z] FAILED test targets:',
    '[2026-10-10T12:09:49.489Z] \tcustominteractives_java_awt_0 - Test results: passed: 58; failed: 2 ',
    '[2026-10-10T12:09:49.489Z] \t\tFailed test cases: ',
    '[2026-10-10T12:09:49.489Z] \t\t\tTEST: ### REDACTED ###',
    '[2026-10-10T12:09:49.489Z]         TEST: ### REDACTED ###',
    '[2026-10-10T12:09:49.489Z]         ',
    '[2026-10-10T12:09:49.489Z] TOTAL: 5   EXECUTED: 5   PASSED: 4   FAILED: 1   DISABLED: 0   SKIPPED: 0',
  ].join('\n');
  const s = parseTestTargetsSummary(log);
  assert.equal(s.failed_targets.length, 1);
  assert.equal(s.failed_targets[0].target, 'custominteractives_java_awt_0');
  assert.equal(s.failed_targets[0].stats, 'passed: 58; failed: 2');
  assert.deepEqual(s.failed_targets[0].failed_tests, []);
  assert.equal(s.totals.failed, 1);
});

test('detectJobType', () => {
  assert.equal(detectJobType('Test_openjdk21_x'), 'test');
  assert.equal(detectJobType('AQA_Test_Pipeline_Foo #1'), 'test');
  assert.equal(detectJobType('build-scripts » jobs » jdk21'), 'build');
});

test('isIgnoredJob matches Test_Job_Auto_Gen variants and ignores them', () => {
  assert.equal(isIgnoredJob('Test_Job_Auto_Gen'), true);
  assert.equal(isIgnoredJob('Test_Job_Auto_Gen_68332'), true);
  assert.equal(isIgnoredJob('Test_Job_Auto_Gen #68332'), true);
  assert.equal(isIgnoredJob('build-scripts » Test_Job_Auto_Gen'), true);
  assert.equal(isIgnoredJob('build-scripts/job/Test_Job_Auto_Gen'), true);
  assert.equal(isIgnoredJob('build-scripts/job/Test_Job_Auto_Gen/68332/'), true);
  assert.equal(isIgnoredJob('Test_openjdk21_hs_extended.openjdk_x86-64_linux'), false);
  assert.equal(isIgnoredJob('AQA_Test_Pipeline_Foo #1'), false);
});

test('CLI analyzes a pipeline dir and writes the report and three prompt files', () => {
  const root = tmpDir();
  const job = path.join(root, 'root_job_1');
  fs.mkdirSync(job);
  fs.writeFileSync(path.join(root, 'metadata.json'), '{}');
  fs.writeFileSync(
    path.join(job, 'build-info.json'),
    JSON.stringify({ fullDisplayName: 'build-scripts » pipeline #1', number: 1, result: 'SUCCESS', duration: 5000, url: 'https://ci.example/job/p/1/' })
  );
  fs.writeFileSync(path.join(job, 'console.log'), 'building\nFinished: SUCCESS\n');

  const out = path.join(root, 'out');
  const stdout = execFileSync('node', [CLI, root, '-o', out], { encoding: 'utf-8' });

  const files = fs.readdirSync(out);
  const analysis = files.find((f) => f.startsWith('pipeline-analysis-'));
  const p1 = files.find((f) => f.startsWith('prompt-1-platform-summary-'));
  const p2 = files.find((f) => f.startsWith('prompt-2-research-query-script-'));
  const p3 = files.find((f) => f.startsWith('prompt-3-research-summary-'));
  assert.ok(analysis && p1 && p2 && p3, `unexpected files: ${files}`);

  assert.match(fs.readFileSync(path.join(out, analysis), 'utf-8'), /\*\*Total Jobs\*\*: 1/);
  // prompt 1 points at the analysis file and at the platform summary path that prompt 2 will read
  const prompt1 = fs.readFileSync(path.join(out, p1), 'utf-8');
  const prompt2 = fs.readFileSync(path.join(out, p2), 'utf-8');
  assert.ok(prompt1.includes(path.join(out, analysis)));
  const summaryPath = prompt1.match(/\*\*Output Path:\*\* (.+)$/m)[1];
  assert.ok(prompt2.includes(summaryPath), 'prompt 2 must read the file prompt 1 writes');
  // prompt 2 writes the queries file and names the runner command; prompt 3 reads the research folder it fills
  const queriesPath = prompt2.match(/\*\*Output Path:\*\* (.+)$/m)[1];
  assert.match(path.basename(queriesPath), /^research-queries-.*\.json$/);
  assert.ok(prompt2.includes('run-research-queries.js'));
  const researchDir = prompt2.match(/"researchDir": "(.+)"/)[1];
  const prompt3 = fs.readFileSync(path.join(out, p3), 'utf-8');
  assert.ok(prompt3.includes(researchDir), 'prompt 3 must read the folder the runner writes');
  // stdout names prompt file 1
  assert.ok(stdout.includes(p1));
});

test('report lists still-running jobs (no Finished: line) as a pruned tree, and prompt 1 asks for them', () => {
  const root = tmpDir();
  const job = path.join(root, 'root_job_1');
  const child = path.join(job, 'Test_child_2');
  fs.mkdirSync(child, { recursive: true });
  fs.writeFileSync(path.join(root, 'metadata.json'), '{}');
  const info = (name, n) => JSON.stringify({ fullDisplayName: name, number: n, duration: 1000, url: `https://ci.example/job/${n}/` });
  fs.writeFileSync(path.join(job, 'build-info.json'), info('build-scripts » pipeline #1', 1));
  fs.writeFileSync(path.join(job, 'console.log'), 'building\nFinished: SUCCESS\n');
  fs.writeFileSync(path.join(child, 'build-info.json'), info('Test_child #2', 2));
  fs.writeFileSync(path.join(child, 'console.log'), 'still executing tests\n');

  const out = path.join(root, 'out');
  execFileSync('node', [CLI, root, '-o', out], { encoding: 'utf-8' });
  const files = fs.readdirSync(out);
  const report = fs.readFileSync(path.join(out, files.find((f) => f.startsWith('pipeline-analysis-'))), 'utf-8');

  assert.match(report, /\*\*⏳ Still running\*\*: 1/);
  assert.match(report, /## ⏳ Still Running Jobs/);
  assert.match(report, /- \[build-scripts » pipeline #1\]\(.+\) — ↳ contains running jobs\n {2}- \[Test_child #2\]\(.+\) — ⏳ \*\*STILL RUNNING\*\*/);
  const prompt1 = fs.readFileSync(path.join(out, files.find((f) => f.startsWith('prompt-1-'))), 'utf-8');
  assert.match(prompt1, /Still Running Jobs/);
});

test('CLI fails cleanly on a directory without metadata.json', () => {
  const root = tmpDir();
  assert.throws(() => execFileSync('node', [CLI, root], { stdio: 'pipe' }), /metadata\.json/);
});

// Helper: pipeline with one root job and the given child dirs ({ name, files: { filename: content } })
function pipelineWithChildren(children) {
  const root = tmpDir();
  const job = path.join(root, 'root_job_1');
  fs.mkdirSync(job, { recursive: true });
  fs.writeFileSync(path.join(root, 'metadata.json'), '{}');
  fs.writeFileSync(
    path.join(job, 'build-info.json'),
    JSON.stringify({ fullDisplayName: 'build-scripts » pipeline #1', number: 1, result: 'SUCCESS', duration: 5000, url: 'https://ci.example/job/p/1/' })
  );
  fs.writeFileSync(path.join(job, 'console.log'), 'building\nFinished: SUCCESS\n');
  for (const c of children) {
    const dir = path.join(job, c.name);
    fs.mkdirSync(dir, { recursive: true });
    for (const [file, content] of Object.entries(c.files)) fs.writeFileSync(path.join(dir, file), content);
  }
  const out = path.join(root, 'out');
  execFileSync('node', [CLI, root, '-o', out], { encoding: 'utf-8' });
  const files = fs.readdirSync(out);
  return fs.readFileSync(path.join(out, files.find((f) => f.startsWith('pipeline-analysis-'))), 'utf-8');
}

test('stub build-info without a result takes it from the finished console, and is not reported as running', () => {
  const stub = JSON.stringify({ fullDisplayName: 'build_child #2', buildNumber: 2, url: 'https://ci.example/job/2/' });
  const report = pipelineWithChildren([
    { name: 'build_child_2', files: { 'build-info.json': stub, 'console.log': 'tests ran\nFinished: SUCCESS\n' } },
  ]);
  assert.match(report, /\*\*⏳ Still running\*\*: 0/);
  assert.doesNotMatch(report, /Still Running Jobs/);
  assert.match(report, /\[build_child #2\]\(.+\)\*\* \[SUCCESS\]/);
});

test('plain successful Test_ jobs are folded into one omitted-count line but still counted', () => {
  const ok = (n) => JSON.stringify({ fullDisplayName: `Test_ok${n} #${n}`, number: n, result: 'SUCCESS', duration: 1000, url: `https://ci.example/job/${n}/` });
  const report = pipelineWithChildren([
    { name: 'Test_ok_2', files: { 'build-info.json': ok(2), 'console.log': 'Finished: SUCCESS\n' } },
    { name: 'Test_ok_3', files: { 'build-info.json': ok(3), 'console.log': 'Finished: SUCCESS\n' } },
  ]);
  assert.match(report, /\*\*Total Jobs\*\*: 3/);
  assert.match(report, /2 more successful test job\(s\) with no failures \(omitted\)/);
  assert.doesNotMatch(report, /Test_ok2/);
});

test('empty job directory is reported as logs unavailable, not still running', () => {
  const report = pipelineWithChildren([{ name: 'sign_installer_14777', files: {} }]);
  assert.match(report, /\*\*⏳ Still running\*\*: 0/);
  assert.match(report, /\[UNKNOWN\/logs unavailable\]/);
  assert.match(report, /Logs not downloaded — directory is empty/);
});

test('download-failure.json (HTTP 404) explains a purged console', () => {
  const failure = JSON.stringify({ url: 'https://ci.example/job/x/5/', error: 'HTTP 404: https://ci.example/job/x/5/consoleText', status: 404 });
  const report = pipelineWithChildren([{ name: 'Test_old_5', files: { 'download-failure.json': failure } }]);
  assert.match(report, /\[UNKNOWN\/logs unavailable\]/);
  assert.match(report, /HTTP 404 — console likely purged by Jenkins/);
  assert.doesNotMatch(report, /Still Running Jobs/);
});

test('build-info.json without console.log keeps the real result and is reported as logs unavailable', () => {
  const info = JSON.stringify({ fullDisplayName: 'Test_old #6', number: 6, result: 'FAILURE', duration: 7000, url: 'https://ci.example/job/6/' });
  const failure = JSON.stringify({ error: 'HTTP 404: x', status: 404 });
  const report = pipelineWithChildren([
    { name: 'Test_old_6', files: { 'build-info.json': info, 'download-failure.json': failure } },
  ]);
  assert.match(report, /\[Test_old #6\]\(.+\)\*\* \[FAILURE\] \(7s\)/);
  assert.match(report, /Console log not available \(HTTP 404 — console likely purged by Jenkins\)/);
  assert.match(report, /\*\*⏳ Still running\*\*: 0/);
});

test('SUCCESS job whose failed target was recovered on rerun is labelled RECOVERED, not FAILED', () => {
  const root = tmpDir();
  const job = path.join(root, 'root_job_1');
  const child = path.join(job, 'Test_jck_mac_2');
  fs.mkdirSync(child, { recursive: true });
  fs.writeFileSync(path.join(root, 'metadata.json'), '{}');
  const info = (name, n, result) => JSON.stringify({ fullDisplayName: name, number: n, result, duration: 1000, url: `https://ci.example/job/${n}/` });
  fs.writeFileSync(path.join(job, 'build-info.json'), info('build-scripts » pipeline #1', 1, 'SUCCESS'));
  fs.writeFileSync(path.join(job, 'console.log'), 'building\nFinished: SUCCESS\n');
  fs.writeFileSync(path.join(child, 'build-info.json'), info('Test_jck_mac #2', 2, 'SUCCESS'));
  fs.writeFileSync(
    path.join(child, 'console.log'),
    [
      'TEST TARGETS SUMMARY',
      'FAILED test targets:',
      '  jck-runtime-api-java_awt_0 - Test results: passed: 3692; failed: 1',
      'TOTAL: 94 EXECUTED: 94 PASSED: 93 FAILED: 1 DISABLED: 0 SKIPPED: 0',
      'Finished: SUCCESS',
    ].join('\n') + '\n'
  );

  const out = path.join(root, 'out');
  execFileSync('node', [CLI, root, '-o', out], { encoding: 'utf-8' });
  const files = fs.readdirSync(out);
  const report = fs.readFileSync(path.join(out, files.find((f) => f.startsWith('pipeline-analysis-'))), 'utf-8');
  assert.match(report, /RECOVERED test targets \(1\)/);
  assert.doesNotMatch(report, /FAILED test targets/);
  const prompt1 = fs.readFileSync(path.join(out, files.find((f) => f.startsWith('prompt-1-platform-summary-'))), 'utf-8');
  assert.match(prompt1, /Final result rule/);
});

test('still-running child overridden by parent AQA_Test_Pipeline_JCK TARGET RESULTS', () => {
  // Structure:
  //   root (build)
  //     AQA_Test_Pipeline_JCK_708  (test, completed FAILURE, has TARGET RESULTS including extended.jck=FAILURE)
  //       AQA_Test_Pipeline_18752  (test, no Finished line -> still running)
  //         Test_openjdk21_hs_extended.jck_x86-64_windows_136  (test, no Finished -> still running)
  //           Test_openjdk21_hs_extended.jck_x86-64_windows_testList_0_127  (test, no Finished)
  //           Test_openjdk21_hs_extended.jck_x86-64_windows_testList_1_124  (test, no Finished)
  const root = tmpDir();
  const rootJob = path.join(root, 'root_1');
  const jckJob = path.join(rootJob, 'AQA_Test_Pipeline_JCK_708');
  const pipeJob = path.join(jckJob, 'AQA_Test_Pipeline_18752');
  const extJob = path.join(pipeJob, 'Test_openjdk21_hs_extended.jck_x86-64_windows_136');
  const tl0 = path.join(extJob, 'Test_openjdk21_hs_extended.jck_x86-64_windows_testList_0_127');
  const tl1 = path.join(extJob, 'Test_openjdk21_hs_extended.jck_x86-64_windows_testList_1_124');
  fs.mkdirSync(tl0, { recursive: true });
  fs.mkdirSync(tl1, { recursive: true });

  fs.writeFileSync(path.join(root, 'metadata.json'), '{}');
  const info = (name, n, result, dur = 1000) =>
    JSON.stringify({ fullDisplayName: name, number: n, result, duration: dur, url: `https://ci.example/job/${n}/` });

  // root build job — finished SUCCESS
  fs.writeFileSync(path.join(rootJob, 'build-info.json'), info('build-scripts » pipeline #1', 1, 'SUCCESS'));
  fs.writeFileSync(path.join(rootJob, 'console.log'), 'building\nFinished: SUCCESS\n');

  // AQA_Test_Pipeline_JCK: completed FAILURE, reports TARGET RESULTS via "Remote job" lines
  fs.writeFileSync(path.join(jckJob, 'build-info.json'), info('AQA_Test_Pipeline_JCK #708 - jdk21 : release : x86-64_windows', 708, 'FAILURE', 50976000));
  fs.writeFileSync(
    path.join(jckJob, 'console.log'),
    [
      '[2026-10-15T10:00:00.000Z] Remote job jdk21 : release : x86-64_windows Target: special.jck Status: SUCCESS',
      '[2026-10-15T10:00:01.000Z] Remote job jdk21 : release : x86-64_windows Target: sanity.jck Status: SUCCESS',
      '[2026-10-15T10:00:02.000Z] Remote job jdk21 : release : x86-64_windows Target: dev.jck Status: UNSTABLE',
      '[2026-10-15T10:00:03.000Z] Remote job jdk21 : release : x86-64_windows Target: extended.jck Status: FAILURE',
      'Finished: FAILURE',
    ].join('\n') + '\n'
  );

  // AQA_Test_Pipeline_18752: no Finished line → still running
  fs.writeFileSync(path.join(pipeJob, 'build-info.json'), info('AQA_Test_Pipeline #18752', 18752, null, 0));
  fs.writeFileSync(path.join(pipeJob, 'console.log'), 'starting tests\n');

  // Test_openjdk21_hs_extended.jck_x86-64_windows: no Finished line → still running
  fs.writeFileSync(path.join(extJob, 'build-info.json'), info('Test_openjdk21_hs_extended.jck_x86-64_windows #136', 136, null, 0));
  fs.writeFileSync(path.join(extJob, 'console.log'), '[2026-10-15T01:52:56.683Z] Exception: hudson.AbortException: Unable to find project for artifact copy: getTRSSOutput\n');

  // testList_0 and testList_1: no Finished line → still running
  fs.writeFileSync(path.join(tl0, 'build-info.json'), info('Test_openjdk21_hs_extended.jck_x86-64_windows_testList_0 #127', 127, null, 0));
  fs.writeFileSync(path.join(tl0, 'console.log'), 'running tests\n');
  fs.writeFileSync(path.join(tl1, 'build-info.json'), info('Test_openjdk21_hs_extended.jck_x86-64_windows_testList_1 #124', 124, null, 0));
  fs.writeFileSync(path.join(tl1, 'console.log'), 'running tests\n');

  const out = path.join(root, 'out');
  execFileSync('node', [CLI, root, '-o', out], { encoding: 'utf-8' });
  const files = fs.readdirSync(out);
  const report = fs.readFileSync(path.join(out, files.find((f) => f.startsWith('pipeline-analysis-'))), 'utf-8');

  // The extended.jck target result is FAILURE — jobs containing "extended.jck" must NOT be shown as still running
  assert.doesNotMatch(report, /Test_openjdk21_hs_extended\.jck_x86-64_windows_testList_0[^)]*\) — ⏳ \*\*STILL RUNNING\*\*/);
  assert.doesNotMatch(report, /Test_openjdk21_hs_extended\.jck_x86-64_windows_testList_1[^)]*\) — ⏳ \*\*STILL RUNNING\*\*/);
  // They should be reported as FAILURE
  assert.match(report, /Test_openjdk21_hs_extended\.jck_x86-64_windows_testList_0[^\n]*\[FAILURE\]/);
  assert.match(report, /Test_openjdk21_hs_extended\.jck_x86-64_windows_testList_1[^\n]*\[FAILURE\]/);
  // Summary running count must not include the overridden jobs
  assert.match(report, /\*\*⏳ Still running\*\*: 0/);
});

test('Test_Job_Auto_Gen instances (e.g. purged HTTP 404 or empty dir) are ignored in report', () => {
  const failure = JSON.stringify({ url: 'https://ci.example/job/Test_Job_Auto_Gen/68332/', error: 'HTTP 404: not found', status: 404 });
  const report = pipelineWithChildren([
    { name: 'Test_Job_Auto_Gen_68332', files: { 'download-failure.json': failure } },
    { name: 'Test_real_job_1', files: { 'build-info.json': JSON.stringify({ fullDisplayName: 'Test_real_job #1', number: 1, result: 'SUCCESS', duration: 1000, url: 'https://ci.example/job/1/' }), 'console.log': 'Finished: SUCCESS\n' } },
  ]);
  assert.doesNotMatch(report, /Test_Job_Auto_Gen/);
  assert.match(report, /\*\*Total Jobs\*\*: 2/);
});
