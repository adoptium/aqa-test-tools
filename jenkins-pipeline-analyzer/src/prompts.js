import * as fs from 'node:fs';

// Prompt generators for the AI follow-up steps: the platform summary, the failing test case
// research query script, and the research summary. Each returns the text of a prompt file for Your AI.

// ── Prompt 1: platform summary ────────────────────────────────────────────────

/**
 * @param {string} analysisFilePath   absolute path to the pipeline-analysis-*.md file
 * @param {string} outputPath         absolute path where Your AI should write platform-summary-*.md
 */
export function buildPlatformSummaryPrompt(analysisFilePath, outputPath) {
  const lineCount = fs.readFileSync(analysisFilePath, 'utf-8').split('\n').length;

  return `# Platform Summary Generation Task

The pipeline analysis file has ${lineCount} lines. You MUST read it in full before generating the summary.

## ⚠️ STEP 1 — Read the full analysis file first

Use your read_file tool to read the COMPLETE file:

**File path:** ${analysisFilePath}

If the file is large, read it in range chunks (e.g. 1-300, 301-600, …) until you have read ALL ${lineCount} lines. Do NOT start generating the summary until you have read every line — platforms appear throughout the file and missing any section will produce an incomplete summary.

To save context, the analysis file already omits successful \`Test_\` jobs that have no failures: each parent shows a single "N more successful test job(s) with no failures (omitted)" line instead. Those jobs are still counted in the Summary Statistics, so take job totals from there. Do not try to list them.

## STEP 2 — Plan, then build the summary file INCREMENTALLY

⚠️ The summary can be very large. NEVER write it in one response or one tool call — a single oversized response fails with "Maximum response length reached".
⚠️ CRITICAL — NO PARALLEL APPENDS: Never issue multiple \`insert_content\` calls in parallel in the same turn. Parallel appends execute concurrently and clobber each other, corrupting the output. Every append must be strictly sequential in its own separate turn.

Instead:

1. First list the platforms found in the analysis file and create a TODO list with update_todo_list: one item for the header/executive summary/overview table, one item per platform, and one for the still-running section.
2. In turn 1, create the output file with write_file containing ONLY the Header, Executive Summary and Platform Overview Table (sections 1-3 below).
3. Then, for each platform in turn (strictly ONE platform and ONE \`insert_content\` tool call per assistant turn — NEVER call \`insert_content\` in parallel):
   - The first platform's append starts with the "# 4. Detailed Platform Analysis" heading followed by that platform's section.
   - APPEND that platform's detailed section (section 4) to the end of the file using insert_content with line 0 (line 0 = append).
   - Wait for the tool result in the next turn, mark the TODO item complete with update_todo_list, and then append the next platform in a new turn.
4. Finally, in a separate turn, append section 5 (Still Running Jobs) in its own insert_content call.
5. Keep every response short: do not repeat content already written, and do not echo the file back in chat.

The summary must meet the following requirements:

### Required Output Structure:

Every numbered main section below (1-5) MUST start with a horizontal rule and a numbered level-1 heading, in this form:

---

# N. Section title

The \`---\` rule goes on its own line with a blank line before and after it. Use these exact headings: \`# 1. Header\`, \`# 2. Executive Summary\`, \`# 3. Platform Overview\`, \`# 4. Detailed Platform Analysis\`, \`# 5. Still Running Jobs\`. Write the heading for section 4 once, before the first platform; the per-platform sections then follow under it. Section 1 may use the pipeline title as its heading instead, but keep the number (e.g. \`# 1. Pipeline Name #NN\`) and skip the leading rule since it is the first thing in the file.

1. **Header Section**
   - Pipeline name and build number with clickable link
   - Overall status
   - Analysis date

2. **Executive Summary**
   - Total jobs count
   - Success/failure/unstable percentages
   - Total test failures count

3. **Platform Overview Table**
   Use EXACTLY this 6-column format:
   | Platform | Build Status | AQA Test Pipeline | JCK Pipeline | Test Failures | Notes |
   |----------|-------------|------------------|--------------|---------------|-------|

   Rules for EVERY cell in the Build Status, AQA Test Pipeline and JCK Pipeline columns:
   - ALWAYS format as: [icon STATUS #NN](URL) — e.g. [✅ SUCCESS #26](https://ci.adoptium.net/job/.../26/)
   - The build number #NN and URL come from the analysis file tree — every job entry has both
   - If a pipeline was not found for a platform, use — (dash)
   - NEVER write a bare icon+status like "✅ SUCCESS" without the #NN hyperlink
   - Use the icon that matches the result: ✅ SUCCESS, ❌ FAILURE, ⚠️ UNSTABLE, 🚫 ABORTED, ❓ UNKNOWN

   - The "AQA Test Pipeline" column holds the AQA_Test_Pipeline (or AQA_Test_Pipeline_RELEASE if present in the build job) link and status — NOT the sign_temurin_gpg release job.
   - The "JCK Pipeline" column holds the AQA_Test_Pipeline_JCK link and status — NOT the AQA_Test_Pipeline.
   - Column order: Platform, Build Status, AQA Test Pipeline, JCK Pipeline, Test Failures, Notes.
   - Every Platform cell MUST be an in-document hyperlink to that platform's section in "4. Detailed Platform Analysis": [Platform name](#platform-<slug>), e.g. [Alpine Linux](#platform-alpine-linux). The slug is the platform name lowercased with every run of non-alphanumeric characters replaced by a single hyphen (e.g. "Linux x64" → \`platform-linux-x64\`).

   Include ALL platforms found (AIX, Alpine Linux, Linux variants, macOS, Windows)

4. **Detailed Platform Analysis**
   For EACH platform, create a section that starts with a horizontal rule and a large platform title, exactly like this:

   ---

   <a id="platform-<slug>"></a>

   ## 🖥️ <Platform name>

   The \`<a id>\` anchor line uses the same slug as that platform's link in the Platform Overview table, so the link resolves; place it between the \`---\` rule and the heading. The \`---\` rule MUST be on its own line with a blank line before and after it, so every platform section is clearly separated from the previous one. The platform title MUST be a level-2 heading (\`##\`), larger than the \`####\` sub-section headings below it. Do not use \`##\` for anything else.

   Then include these sub-sections:

   #### Build Job
   Table with: Job Name (as clickable link with #NN), Status, Details
   
   #### Test Failures Detail
   Table with: Job (clickable link), Test Target, Stats, Failed Tests
   - List ALL failed test targets found in the analysis for jobs that did not finish SUCCESS (see the Final result rule below)
   - Include the specific test case names that failed
   - Use proper markdown formatting with <br> for line breaks in table cells
   - Ignore any line containing REDACTED (e.g. "### REDACTED ###"), but still list the failed test target with its Stats (e.g. "passed: 58; failed: 2").
   
   #### Other Failed/Unstable Jobs
   Any jobs that failed but don't have detailed test info

5. **Still Running Jobs**
   The analysis file may contain a "## ⏳ Still Running Jobs" section and jobs marked \`[UNKNOWN/still running]\` in the tree. These jobs have no \`Finished:\` line in their console log, so their results are not final.
   Jobs tagged \`[UNKNOWN/logs unavailable]\` (console purged or not downloaded) or \`[UNKNOWN/result unknown]\` are NOT running. Do not list them as still running; list them separately as "Logs unavailable / result unknown", with the reason shown in the analysis file.
   - Add a top-level "Still Running" section as a tree (parent pipeline → child jobs), nested the same way as in the analysis file, with each job as a clickable link [job-name #NN](URL)
   - In EACH platform's detailed section, add a "#### Still Running" sub-section listing that platform's running jobs (clickable links). If none, write "None"
   - Add a "Still running" count to the Executive Summary and mention it in the Notes column of the Platform Overview Table
   - Use ⏳ for running jobs. Do NOT count them as failures, and do NOT report failures from them as final — their results are incomplete
   - If the analysis file has no still-running jobs, state "No jobs still running"

### Important Guidelines:

- ALL job names MUST be clickable markdown links in format: [job-name #NN](URL)
- Platform Overview Table status cells MUST include the build number and hyperlink — never bare text
- Extract URLs from the analysis file — they are already present in every job entry
- Include ALL test failures found, not just a summary
- List specific test case names (e.g., vmTestbase/gc/gctests/MTLinkedListGC/MTLinkedListGC.java)
- Use tables for structured data
- Use <br> tags for multi-line content in table cells
- Be comprehensive — don't skip test failures
- Track rerun information (tests that passed/failed on rerun)
- **Final result rule (applies to ALL test jobs, JCK/TCK and others, and to sections 2-4):** a job's result is the status in brackets on its tree line, e.g. \`[SUCCESS]\`. A job whose status is SUCCESS is NOT a failure, even if its tree entry contains a \`FAILED test targets\` list or a downstream \`_rerun\` job. That list only shows what failed in the initial run before the rerun recovered it (the report labels it \`RECOVERED test targets\`). Therefore:
  - NEVER list a SUCCESS job in "Test Failures Detail" or "Other Failed/Unstable Jobs", and do NOT count its recovered targets in the Test Failures column or Executive Summary failure totals.
  - Example: \`Test_openjdk27_hs_extended.jck_aarch64_mac #15 [SUCCESS]\` shows 1 failed target (jck-runtime-api-java_awt_0) but its \`_rerun #6\` is SUCCESS, so it is NOT a failure. The most you may do is mention it in Notes as "recovered on rerun".
  - Only list a job's failed targets when that job's own status is FAILURE or UNSTABLE, and a \`_rerun\` job's failed targets only when the rerun's own status is not SUCCESS.
  - Before writing "Test Failures Detail", go through each candidate failure and check the bracketed status on its tree line; drop it if it is SUCCESS.

## STEP 3 — Output file and final check

Write and append to this file (create it with write_file on the first step, extend it with insert_content line 0 strictly one call per turn afterwards — never parallel appends):

**Output Path:** ${outputPath}

When all TODO items are complete, use grep on the output file for \`^#### Build Job\` (or read it in chunks) to confirm every platform has a section. Then reply with a one-line confirmation. Do NOT print the summary in chat.`;
}


// ── Prompt 2: failing test case research — write the query script ────────────

/**
 * Prompt 2 does NOT run any research query. It makes the AI turn the platform summary into a
 * research-queries-*.json file that the user can review and then execute in one batch with
 * bin/run-research-queries.js (which authenticates with GITHUB_TOKEN). This avoids one approval
 * prompt per query.
 *
 * The platform summary is produced by the AI when it runs prompt 1, so it does not exist yet when this
 * prompt is generated. The prompt therefore tells the AI to read the file instead of embedding it.
 *
 * @param {string} platformSummaryPath  absolute path where the platform-summary-*.md file will exist
 * @param {string} queriesPath          absolute path where the AI should write research-queries-*.json
 * @param {string} researchDir          absolute path of the folder the runner will write results into
 * @param {string} runnerCommand        shell command the user runs to execute the queries file
 */
export function buildTestcaseResearchQueryScriptPrompt(platformSummaryPath, queriesPath, researchDir, runnerCommand) {
  return `# Test Case Research — Query Script Generation Task

A Jenkins pipeline platform summary containing test failures is saved at \`${platformSummaryPath}\`.

Your job is to PLAN the GitHub research for EVERY failing test case and write the planned queries to a JSON file. **You must NOT execute any query.** Do not run curl, do not call any GitHub API, do not use execute_command for research. The user will review the JSON file and then run all queries in one batch with a script.

## STEP 0 — Read the platform summary first

Use your read_file tool to read the COMPLETE file (in range chunks if it is large) before doing anything else:

**File path:** ${platformSummaryPath}

If the file does not exist, stop and tell the user to run the platform summary prompt first.

## STEP 1 — Extract the failing tests

1. Extract ALL failing test cases from the platform summary into a numbered list.
2. De-duplicate: a test that fails on several platforms or jobs is ONE entry, with every platform and Jenkins job URL recorded in that entry.
3. Create a TODO list with update_todo_list, one item per test, and update it as you go. Do not stop until every test has an entry.

## STEP 2 — Plan the queries for each test

All URLs MUST start with \`https://api.github.com/\`. The runner rejects every other host. Every URL must be fully formed and URL-encoded (spaces as \`%20\` or \`+\`, \`:\` inside a search term quoted as needed, no unresolved \`[placeholders]\`).

For each test, plan these queries (skip one only if it clearly cannot apply):

| id | purpose | URL pattern |
|---|---|---|
| \`aqa-code\` | Where the test is referenced in AQA (sources, playlists, exclude lists) | \`https://api.github.com/search/code?q=<TestName>+repo:adoptium/aqa-tests&per_page=10\` |
| \`aqa-issues\` | Existing AQA issues naming the test | \`https://api.github.com/search/issues?q=<TestName>+repo:adoptium/aqa-tests+is:issue&per_page=10\` |
| \`jdk-code\` | Test source in OpenJDK | \`https://api.github.com/search/code?q=<TestName>+repo:openjdk/jdk&per_page=10\` |
| \`jdk-source\` | Test source file content, ONLY when the path is deterministic (see below) | \`https://api.github.com/repos/openjdk/jdk/contents/<path>\` |
| \`infra-issues\` | Platform-specific infrastructure issues (one per distinct platform, keep to the 2 most affected platforms) | \`https://api.github.com/search/issues?q=<platform>+<failure-keyword>+repo:adoptium/infrastructure+is:issue&per_page=10\` |
| \`aqa-platform-issues\` | AQA issues about this failure type on this platform | \`https://api.github.com/search/issues?q=<platform>+<failure-keyword>+repo:adoptium/aqa-tests+is:issue&per_page=10\` |

Guidance:
- \`<TestName>\` is the simple test or class name (for example \`MTLinkedListGC\`), not the whole path. For jtreg tests, prefer the file name without extension.
- \`jdk-source\`: jtreg test paths in the summary map to \`test/jdk/<path>\` (jdk_* targets), \`test/hotspot/jtreg/<path>\` (hotspot_* and vmTestbase targets), or \`test/langtools/<path>\` / \`test/jaxp/<path>\`. Only add the query when the summary gives a path you can map with confidence; otherwise leave the source to the \`jdk-code\` search.
- Add \`https://api.github.com/repos/adoptium/aqa-tests/contents/openjdk/excludes\` once to the FIRST test only (id \`aqa-excludes-dir\`) so the exclude lists are available to everyone.
- Add extra queries only when the failure message in the summary gives a distinctive keyword (an exception name, an error code, a JDK bug id such as JDK-8312345). For a JDK bug id use \`https://api.github.com/search/issues?q=JDK-8312345+repo:adoptium/aqa-tests+is:issue\`.
- Keep each test to at most 8 queries. The runner throttles code search to stay within GitHub rate limits, so the total number of queries is what costs time.
- Query \`id\` values use only letters, digits, \`.\`, \`_\` and \`-\`, and are unique within the test.
- Every \`search/issues\` URL MUST contain \`is:issue\` (or \`is:pull-request\`) in the \`q\` parameter, otherwise GitHub answers HTTP 422. The runner adds \`+is:issue\` if it is missing.

## STEP 3 — Write the queries file

Write ONE JSON file with write_file (valid JSON, no comments, no trailing commas) to:

**Output Path:** ${queriesPath}

Schema:

\`\`\`json
{
  "platformSummary": "${platformSummaryPath}",
  "researchDir": "${researchDir}",
  "tests": [
    {
      "slug": "001-MTLinkedListGC",
      "name": "MTLinkedListGC",
      "path": "vmTestbase/gc/gctests/MTLinkedListGC/MTLinkedListGC.java",
      "target": "jdk_custom",
      "failureSummary": "one line: how it failed, copied from the platform summary",
      "platforms": ["AIX", "Windows x64"],
      "jobUrls": ["https://ci.adoptium.net/job/..."],
      "queries": [
        {
          "id": "aqa-code",
          "purpose": "Find where MTLinkedListGC is referenced in aqa-tests",
          "url": "https://api.github.com/search/code?q=MTLinkedListGC+repo:adoptium/aqa-tests&per_page=10"
        }
      ]
    }
  ]
}
\`\`\`

Rules:
- \`slug\` is unique per test, starts with a zero-padded sequence number (\`001-\`, \`002-\`, …) and uses only letters, digits, \`.\`, \`_\` and \`-\`. It becomes a folder name under the research folder.
- Copy \`path\`, \`target\`, platforms and job URLs exactly from the platform summary. Do not invent any of them.
- Do not put tokens, secrets or auth headers in the file. The runner adds authentication from the \`GITHUB_TOKEN\` environment variable.
- After writing, re-read the file and check that it is valid JSON, that every test from your TODO list is present, and that every URL starts with \`https://api.github.com/\`.

## STEP 4 — Tell the user what to do next

End with a short message containing:
1. The number of tests and the total number of queries in the file.
2. That they should review \`${queriesPath}\` first. They can delete queries they do not want, and \`--dry-run\` lists the URLs without calling anything.
3. The command to execute all queries in one batch (needs \`GITHUB_TOKEN\` exported in the shell):

\`\`\`bash
${runnerCommand}
\`\`\`

4. That the results are written under \`${researchDir}\`, and that the next prompt (research summary) reads that folder.

Remember: write the queries only. Do NOT execute them.`;
}

// ── Prompt 3: failing test case research — summarize the collected results ──

/**
 * @param {string} researchDir   absolute path of the folder written by bin/run-research-queries.js
 * @param {string} outputPath    absolute path where the AI should write testcase-research-*.md
 * @param {string} platformSummaryPath  absolute path to the platform-summary-*.md file
 */
export function generateTestcaseResearchSummary(researchDir, outputPath, platformSummaryPath) {
  return `# Test Case Research — Summary Generation Task

The research queries for the failing test cases have already been executed by a script. The raw results are saved in the research folder:

**Research folder:** ${researchDir}

Your job is to read those results and write ONE markdown summary covering EVERY failing test case. **Do NOT call the GitHub API or run curl.** Use only read_file, list_files, glob and grep on local files. If something is missing, record it as a research gap instead of fetching it.

## Layout of the research folder

\`\`\`
${researchDir}/
├── research-manifest.json        every query: test slug, id, status, ok, result file
└── <test-slug>/
    ├── test-info.json            name, path, target, failureSummary, platforms, jobUrls
    ├── <query-id>.json           { id, purpose, url, status, ok, body }
    └── <query-id>.source.txt     decoded file content (contents API queries only)
\`\`\`

Search results: \`body.items[]\` (code search items have \`name\`, \`path\`, \`html_url\`, \`repository.full_name\`; issue search items have \`number\`, \`title\`, \`state\`, \`html_url\`, \`body\`, \`updated_at\`, \`labels\`). A result with \`ok: false\` or a non-2xx \`status\` failed — report it as a gap, do not treat it as "nothing found".

## STEP 0 — Read the inputs

1. If the research folder or \`research-manifest.json\` does not exist, stop and tell the user to run the research queries script first.
2. Read \`research-manifest.json\`. Note the totals and every failed query.
3. Read the platform summary for context (platform, job links, failure types): \`${platformSummaryPath}\`. Skip this if the file is missing.
4. Use list_files to list the research folder, then create a TODO list with update_todo_list with one item per test folder.

## STEP 1 — Research each test, one at a time

For each test folder, in order:
1. Read \`test-info.json\`.
2. Read every \`<query-id>.json\`. For large files read in range chunks, or use grep for \`"html_url"\`, \`"title"\`, \`"state"\`, \`"path"\` to scan quickly. Only read the \`body\` of an issue when its title looks relevant.
3. Read any \`*.source.txt\` file (test source) — focus on the header comments, \`@test\`/\`@summary\`/\`@requires\`/\`@modules\` tags and anything platform-specific.
4. Judge relevance: an issue that merely contains a common word is not evidence. Only cite issues whose title or body concerns this test, this failure type, or this platform problem.
5. Write that test's section (format below), then mark the TODO item complete.

Every URL, issue number and path in the report MUST come from the files in the research folder. Never invent one. State evidence quality honestly.

## Format of each test section

### [Test Name] — [Platform(s)]

**Test Information:**
- **Full Path:** [from test-info.json]
- **Test Target:** [target]
- **Failed On:** [platforms]
- **Job Links:** [jobUrls]
- **Failure:** [failureSummary]

**Test Purpose:** [from the source file or search results; say "not available" if no source was retrieved]

**Findings:**
- **Source / References:** [html_url links from the code searches]
- **Related AQA Issues:** [Issue #N](url) — state — one-line relevance
- **Related Infrastructure Issues:** [Issue #N](url) — state — one-line relevance
- **Exclusion Lists:** [entries mentioning this test, with file URL; or "none found"]
- **JDK bug references:** [JDK-XXXXX seen in issues/source; or "none found"]

**Analysis:**
- **Failure Pattern:** [based on the data collected]
- **Root Cause Hypothesis:** [based on the data collected]
- **Test vs Product Issue:** [assessment with evidence]
- **Confidence Level:** [High/Medium/Low, and why]

**Recommendations:**
- **Priority:** [Critical/High/Medium/Low with rationale]
- **Immediate Actions:** [specific steps]
- **Investigation Needed:** [what is still unknown]

**Research Gaps:** [failed or empty queries for this test, with their query ids]

---

## Final report structure

The saved report MUST contain these sections in this order:

1. **Executive Summary** — number of tests analysed, number of queries run/failed (from the manifest), key patterns, the highest-priority items with evidence.
2. **Research Methodology** — queries were pre-planned, reviewed by the user and executed in one authenticated batch; the research folder path; how relevance was judged.
3. **Individual Test Research** — one section per test, as above, in slug order. No test may be omitted.
4. **Cross-Cutting Analysis** — patterns across tests, platform-specific trends, component areas (GC, compiler, runtime, networking…), systemic issues.
5. **Prioritized Action Plan** — ranked by impact (platforms/tests affected), severity, evidence quality and effort.
6. **Research Gaps** — failed queries (from the manifest), tests with thin evidence, unanswered questions, and a suggestion to re-run the script (it retries only failed queries) if many failed.

## Save the report

When all tests are covered, save the complete report with write_file (count every line, including empty lines, for line_count):

**Output Path:** ${outputPath}`;
}
