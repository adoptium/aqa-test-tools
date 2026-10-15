#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzePipeline, setVerbose } from '../src/analyzer.js';
import { renderReport } from '../src/report.js';
import {
  buildPlatformSummaryPrompt,
  buildTestcaseResearchQueryScriptPrompt,
  generateTestcaseResearchSummary,
} from '../src/prompts.js';

const USAGE = `Usage: jenkins-analyze <pipelineDir> [options]

Analyzes a Jenkins pipeline log directory (created by download-pipeline-logs.cjs) and writes:
  1. pipeline-analysis-<ts>.md                      the analysis report
  2. prompt-1-platform-summary-<ts>.md              Prompt for Your AI: platform summary
  3. prompt-2-research-query-script-<ts>.md         Prompt for Your AI: write research-queries-<ts>.json
  4. prompt-3-research-summary-<ts>.md              Prompt for Your AI: summarize the research folder

Options:
  -o, --out-dir <dir>      Where to write the files (default: <pipelineDir>)
  -j, --jenkins-url <url>  Jenkins base URL for stub entries of empty job dirs
                           (default: https://ci.adoptium.net)
  -v, --verbose            Log per-job progress to stderr
  -h, --help               Show this help`;

function parseArgs(argv) {
  const args = { jenkinsUrl: 'https://ci.adoptium.net', verbose: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const needValue = () => {
      if (i + 1 >= argv.length) throw new Error(`Option ${a} requires a value`);
      return argv[++i];
    };
    if (a === '-h' || a === '--help') args.help = true;
    else if (a === '-v' || a === '--verbose') args.verbose = true;
    else if (a === '-o' || a === '--out-dir') args.outDir = needValue();
    else if (a === '-j' || a === '--jenkins-url') args.jenkinsUrl = needValue();
    else if (a.startsWith('-')) throw new Error(`Unknown option: ${a}`);
    else positional.push(a);
  }
  if (positional.length > 1) throw new Error(`Expected one pipelineDir, got ${positional.length}`);
  args.pipelineDir = positional[0];
  return args;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`Error: ${e.message}\n\n${USAGE}`);
    process.exit(2);
  }
  if (args.help || !args.pipelineDir) {
    console.log(USAGE);
    process.exit(args.help ? 0 : 2);
  }

  const pipelineDir = path.resolve(args.pipelineDir);
  if (!fs.existsSync(pipelineDir) || !fs.statSync(pipelineDir).isDirectory()) {
    console.error(`Error: not a directory: ${pipelineDir}`);
    process.exit(1);
  }
  const outDir = path.resolve(args.outDir ?? pipelineDir);
  fs.mkdirSync(outDir, { recursive: true });
  setVerbose(args.verbose);

  let analysis;
  try {
    analysis = analyzePipeline(pipelineDir, { jenkinsUrl: args.jenkinsUrl });
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const analysisPath = path.join(outDir, `pipeline-analysis-${ts}.md`);
  const platformSummaryPath = path.join(outDir, `platform-summary-${ts}.md`); // written later by Your AI
  const researchPath = path.join(outDir, `testcase-research-${ts}.md`); // written later by Your AI
  const queriesPath = path.join(outDir, `research-queries-${ts}.json`); // written later by Your AI
  const researchDir = path.join(outDir, `research-${ts}`); // written later by run-research-queries.js
  const prompt1Path = path.join(outDir, `prompt-1-platform-summary-${ts}.md`);
  const prompt2Path = path.join(outDir, `prompt-2-research-query-script-${ts}.md`);
  const prompt3Path = path.join(outDir, `prompt-3-research-summary-${ts}.md`);
  const runnerPath = fileURLToPath(new URL('./run-research-queries.js', import.meta.url));
  const runnerCommand = `node "${runnerPath}" "${queriesPath}"`;

  fs.writeFileSync(analysisPath, renderReport(analysis), 'utf-8');
  fs.writeFileSync(prompt1Path, buildPlatformSummaryPrompt(analysisPath, platformSummaryPath), 'utf-8');
  fs.writeFileSync(
    prompt2Path,
    buildTestcaseResearchQueryScriptPrompt(platformSummaryPath, queriesPath, researchDir, runnerCommand),
    'utf-8',
  );
  fs.writeFileSync(prompt3Path, generateTestcaseResearchSummary(researchDir, researchPath, platformSummaryPath), 'utf-8');

  console.log(`Analysis report:  ${analysisPath}\n`);
  console.log('IMPORTANT: Open a NEW task in Your AI for EACH prompt below to ensure full context space is available (run one at a time, wait for each to finish):\n');
  console.log(`  Step 1 - platform summary (writes ${platformSummaryPath}):`);
  console.log(`    Read and follow the instructions in ${prompt1Path}`);
}

main();
