import * as fs from 'node:fs';

// Native implementations of grep -E -B/-A and tail -n, so no shell commands are needed.
// Pure Node, so they behave the same on macOS, Linux and Windows.

// Console logs are read several times per job, so keep the most recent file in memory.
let cachedPath = null;
let cachedLines = null;

function readLines(filePath) {
  if (cachedPath !== filePath) {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    // Match grep/tail semantics: a trailing newline does not create an extra empty line.
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    cachedPath = filePath;
    cachedLines = lines;
  }
  return cachedLines;
}

/**
 * Equivalent of `grep -E -B before -A after pattern file`, including the `--`
 * separator printed between non-contiguous groups. Returns '' on no match or error.
 */
export function grepWithContext(filePath, pattern, before = 0, after = 0) {
  let lines;
  try {
    lines = readLines(filePath);
  } catch {
    return '';
  }
  const regex = new RegExp(pattern);
  const out = [];
  let lastPrinted = -1;
  let i = 0;
  while (i < lines.length) {
    if (!regex.test(lines[i])) {
      i++;
      continue;
    }
    const start = Math.max(i - before, lastPrinted + 1);
    const originalStart = Math.max(i - before, 0);
    // grep only prints "--" between groups when context lines were requested
    if ((before > 0 || after > 0) && lastPrinted >= 0 && originalStart > lastPrinted + 1) out.push('--');
    // Extend the window forward while further matches fall inside the trailing context.
    let end = Math.min(i + after, lines.length - 1);
    let j = i + 1;
    while (j <= end) {
      if (regex.test(lines[j])) end = Math.min(j + after, lines.length - 1);
      j++;
    }
    for (let k = start; k <= end; k++) out.push(lines[k]);
    lastPrinted = end;
    i = end + 1;
  }
  return out.length > 0 ? out.join('\n') + '\n' : '';
}

/** Equivalent of `tail -n N file`. Returns '' on error. */
export function tailLines(filePath, numLines) {
  try {
    const lines = readLines(filePath);
    return lines.slice(-numLines).join('\n') + (lines.length > 0 ? '\n' : '');
  } catch {
    return '';
  }
}

/** A job has finished if "Finished:" appears in the last 5 lines of its console log. */
export function isJobFinished(logPath) {
  return tailLines(logPath, 5).includes('Finished:');
}

/** The result named by the console's final "Finished: <RESULT>" line (e.g. "SUCCESS"), or null if there is none. */
export function finishedResult(logPath) {
  const match = tailLines(logPath, 5).match(/Finished:\s*([A-Z_]+)/);
  return match ? match[1] : null;
}

