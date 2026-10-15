# jenkins-pipeline-analyzer-cli

Standalone tooling to download a Jenkins pipeline's logs, analyze them, and hand the results to Your AI for summarising.

- No npm dependencies and no `grep`/`tail` shell-outs.
- Needs Node 18 or later.
- Everything is in this folder.

| Script | Purpose |
|---|---|
| `bin/download-pipeline-logs.cjs` | Step 1. Downloads the pipeline's console logs and build info from Jenkins, recursively. |
| `bin/jenkins-analyze.js` | Step 2. Analyzes the downloaded logs and writes the report plus prompt files for Your AI. |

## Prerequisites

1. Node 18 or later (`node --version`).
2. A Jenkins username and API token (Jenkins, then your user, then Configure, then API Token), exported in your shell:
   ```bash
   export JENKINS_USER="your-username"
   export JENKINS_TOKEN="your-api-token"
   ```

## Workflow

Run all commands from this folder, or use absolute paths. The examples use the jdk27 build 82 pipeline.

### 1. Download the pipeline logs

```bash
node bin/download-pipeline-logs.cjs \
  https://ci.adoptium.net/job/build-scripts/job/openjdk27-pipeline/82/ \
  --handlers ~/workspace/console-handlers.json \
  --output ~/workspace/analyzer-out/analyse-jdk27-82
```

| Argument | Default | Meaning |
|---|---|---|
| `<jenkins-build-url>` | required | Full URL of the pipeline build. It must end in the build number. |
| `--depth N` | `10` | How many levels of downstream jobs to follow. |
| `--output DIR` | `./jenkins-logs-<timestamp>` | Where to save the logs. |
| `--handlers FILE` | `./console-handlers.json` | Path to a JSON file with pluggable console handlers (see below). |

The script saves every job's `console.log` and `build-info.json` in nested folders that mirror the Jenkins job hierarchy:

```
analyse-jdk27-82/
├── metadata.json
└── build-scripts_job_openjdk27-pipeline_82/
    ├── console.log
    ├── build-info.json
    └── <downstream job>_<n>/
        ├── console.log
        ├── build-info.json
        └── ...
```

#### Downstream jobs and console handlers

The downloader finds downstream jobs by searching each console log for `Starting building: <job> #<n>`, `Build <job> #<n> completed: <STATUS>` and `Remote build URL: <url>`. Each match becomes a build URL. For each build URL:

1. If it contains a handler's `urlKeyword` (first match wins), the handler extracts `JOB` and `BUILD_NUMBER` with `jobRegex` and `buildNumberRegex` (capture group 1 of each) and fetches the console from `consoleQuery`, with `%JOB%` and `%BUILD_NUMBER%` substituted. No authentication is sent.
2. Otherwise the console and build info come from the Jenkins API at that URL using `JENKINS_USER` and `JENKINS_TOKEN`.

`console-handlers.json`:

```json
{
  "handlers": [
    {
      "name": "Remote job dashboard",
      "urlKeyword": "remote-dashboard",
      "jobRegex": ".*/job/([^/]+)/[0-9]+/?$",
      "buildNumberRegex": ".*/([0-9]+)/?$",
      "consoleQuery": "https://remote.dashboard.app/api/console?job=%JOB%&build=%BUILD_NUMBER%"
    }
  ]
}
```

Notes:
- A large pipeline can take 20+ minutes and use several GB. The downloader waits 0.5s between jobs and retries on HTTP 429/5xx.
- Logs over 50MB are cut to their last 10MB, with a truncation notice at the top.
- If a download is interrupted, delete the output folder and start again.
- When it finishes, the script prints the exact `jenkins-analyze` command for step 2.

### 2. Analyze the logs

```bash
node bin/jenkins-analyze.js analyse-jdk27-82 --out-dir analyse-jdk27-82
```

| Option | Default | Meaning |
|---|---|---|
| `-o, --out-dir DIR` | the pipeline directory | Where to write the output files. |
| `-j, --jenkins-url URL` | `https://ci.adoptium.net` | Base URL for stub entries of job folders that have no logs. |
| `-v, --verbose` | off | Per-job progress on stderr. |

It writes the output files with a shared timestamp and prints their paths:

| File | Purpose |
|---|---|
| `pipeline-analysis-<ts>.md` | The analysis report: summary counts and the full job tree with failed test targets and test cases. |
| `prompt-1-platform-summary-<ts>.md` | Prompt for Your AI. Reads the analysis report and writes `platform-summary-<ts>.md`. |

The last lines it prints are the steps to run, in order:

```
IMPORTANT: Open a NEW task in Your AI for EACH prompt below to ensure full context space is available (run one at a time, wait for each to finish):

  Step 1 - platform summary (writes .../platform-summary-<ts>.md):
    Read and follow the instructions in .../prompt-1-platform-summary-<ts>.md
```

### 3. Review the analysis report (optional)

Open `pipeline-analysis-<ts>.md`. It is useful on its own, and it is the input to the next step.

### 4. Your AI task: platform summary

Paste the **Step 1** line into a new task in Your AI. Your AI reads the whole analysis report and writes `platform-summary-<ts>.md`. It is a per-platform table of build, compliance and release pipeline status with links, followed by test failures grouped by type.

Wait for Your AI to finish and check that the file exists before moving on.

### Output summary

After a full run, the output folder holds:

```
pipeline-analysis-<ts>.md              step 2 (CLI)
prompt-1-platform-summary-<ts>.md      step 2 (CLI)
platform-summary-<ts>.md               step 4 (Your AI)
```

To keep the logs separate from the generated files, pass `-o` to `jenkins-analyze.js`.

## Troubleshooting

| Message | Fix |
|---|---|
| `JENKINS_USER and JENKINS_TOKEN environment variables are required` | Export both variables (see Prerequisites). |
| `Invalid Jenkins build URL` | Use the full URL, with `https://`, `/job/` segments and a trailing build number. |
| `HTTP 401` or `403` | Check that the username and token are right, the token hasn't expired, and you have access to the build. |
| `HTTP 404` | Check that the job path and build number exist. |
| `No metadata.json found in ...` | Point `jenkins-analyze.js` at the folder the downloader created (the one holding `metadata.json`), not at a job folder inside it. |
| `Failed to download ... #N` lines | One job failed to download. The rest continue, and the job is missing from the analysis. Re-run the download if it matters. |
| `UNKNOWN/logs unavailable` or `Logs not downloaded` in the report | The job's console could not be downloaded. The downloader records the reason in `download-failure.json` in the job folder, and the report repeats it (for example `HTTP 404 — console likely purged by Jenkins`). If Jenkins still served the build info, the real result is kept. Re-run the download if the log is still available. The job's downstream jobs cannot be discovered without its console. |
| `UNKNOWN/result unknown` in the report | The console is finished but no result could be read from `build-info.json` or the `Finished:` line. |
| `--depth requires a non-negative integer` | Pass a number, for example `--depth 10`. |

## Tests

```bash
npm test
```

## Layout

```
bin/download-pipeline-logs.cjs   step 1: downloader (Node built-ins only)
console-handlers.json            pluggable console handlers for step 1
bin/jenkins-analyze.js           step 2: analysis CLI
src/logtools.js                  native grep / tail replacements
src/analyzer.js                  job and pipeline analysis
src/report.js                    markdown tree and report
src/prompts.js                   prompt generators
test/analyzer.test.js
```
