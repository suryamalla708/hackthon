#!/usr/bin/env node
/**
 * collectFailures.js — Phase 2: Failure Detection & Log Collection
 *
 * This script:
 *  1. Runs the Jest test suite with --json output
 *  2. Captures stdout (Express request logs) and stderr (verbose Jest output)
 *  3. Parses Jest's structured JSON results
 *  4. Parses any [CAPTURE] error log lines from errorCapture middleware
 *  5. Correlates failures with endpoints, source file hints, and request logs
 *  6. Writes a comprehensive failure-report.json for the AI repair agent
 *
 * Usage:
 *   node scripts/collectFailures.js
 *   npm run collect
 */

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(ROOT, 'logs');
const JEST_RESULTS_FILE = path.join(LOGS_DIR, 'jest-results.json');
const STDOUT_LOG = path.join(LOGS_DIR, 'jest-stdout.log');
const STDERR_LOG = path.join(LOGS_DIR, 'jest-stderr.log');
const CAPTURE_LOG = path.join(LOGS_DIR, 'error-captures.json');
const FAILURE_REPORT = path.join(LOGS_DIR, 'failure-report.json');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

/**
 * Extract the HTTP endpoint (method + path) from test/describe title strings.
 * Searches all ancestor titles and the test title for patterns like:
 *   "GET /api/users", "DELETE /api/users/:id", "POST /api/products"
 */
function extractEndpoint(titles) {
  const allText = titles.join(' ');
  const match = allText.match(/\b(GET|POST|PUT|DELETE|PATCH)\s+(\/[^\s,)>]+)/i);
  if (match) {
    return {
      method: match[1].toUpperCase(),
      path: match[2].replace(/\/$/, '') || '/',
    };
  }
  return null;
}

/**
 * Extract source file hints from a Jest/Node.js stack trace string.
 * Returns an array of relative paths pointing to src/ files (not node_modules).
 */
function extractSourceHints(stackTrace) {
  if (!stackTrace) return [];
  const hints = new Set();
  const lines = stackTrace.split('\n');

  for (const line of lines) {
    // Match "at SomeFunc (/absolute/path/to/src/file.js:12:34)"
    // or "at /absolute/path/to/src/file.js:12:34"
    const match = line.match(/\(?((?:[A-Za-z]:)?[/\\].+?\.js):\d+:\d+\)?/);
    if (!match) continue;

    const absPath = match[1].replace(/\\/g, '/');
    if (absPath.includes('node_modules')) continue;
    if (!absPath.includes('/src/')) continue;

    // Make relative to backend root
    const srcIdx = absPath.indexOf('/src/');
    if (srcIdx !== -1) {
      hints.add('src' + absPath.slice(srcIdx + 4));
    }
  }

  return [...hints];
}

/**
 * Infer likely source files from the API endpoint path by scanning the src/ directory.
 * e.g., /api/users → ["src/routes/users.js", "src/controllers/userController.js"]
 */
function inferSourceFiles(endpoint) {
  if (!endpoint) return [];
  const pathParts = endpoint.path.split('/').filter(Boolean);
  const resource = pathParts.find((p) => p !== 'api' && !p.startsWith(':'));
  if (!resource) return [];

  // Try both plural ("products") and singular ("product") forms
  const variants = [resource.toLowerCase()];
  if (resource.endsWith('s')) variants.push(resource.slice(0, -1).toLowerCase());

  const hints = [];
  const srcDir = path.join(ROOT, 'src');

  function searchDir(dir, depth) {
    if (depth > 4) return;
    try {
      for (const entry of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          searchDir(fullPath, depth + 1);
        } else if (entry.endsWith('.js') && variants.some((v) => entry.toLowerCase().includes(v))) {
          const rel = fullPath.replace(/\\/g, '/').split('/backend/')[1];
          if (rel) hints.push(rel);
        }
      }
    } catch { /* ignore */ }
  }

  searchDir(srcDir, 0);
  return hints;
}

/**
 * Extract Express request log lines from combined output.
 * These come from the console.log in app.js request logger middleware.
 * Format: "[2026-08-12T13:06:22.629Z] GET /api/products"
 */
function extractRequestLogs(output) {
  if (!output) return [];
  return output
    .split('\n')
    .filter((l) => /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(l) && /\b(GET|POST|PUT|DELETE|PATCH)\b/.test(l))
    .map((l) => l.replace(/^\s*console\.log\s*/, '').trim())
    .filter(Boolean);
}

/**
 * Parse [CAPTURE] lines written by errorCapture middleware.
 * These are structured JSON objects logged by the 4-param error handler.
 */
function parseErrorCaptures(output) {
  if (!output) return [];
  const captures = [];
  const lines = output.split('\n');
  for (const line of lines) {
    const idx = line.indexOf('[CAPTURE]');
    if (idx === -1) continue;
    try {
      const json = line.slice(idx + '[CAPTURE]'.length).trim();
      captures.push(JSON.parse(json));
    } catch {
      // skip malformed lines
    }
  }
  return captures;
}

/**
 * Match request logs to a specific endpoint.
 */
function matchLogsToEndpoint(requestLogs, endpoint) {
  if (!endpoint) return [];
  const basePathPattern = endpoint.path.replace(/:\w+/g, ''); // strip :id params
  return requestLogs.filter(
    (log) =>
      log.includes(endpoint.method) &&
      log.includes(basePathPattern)
  );
}

/**
 * Match error captures to a specific endpoint.
 */
function matchCapturesToEndpoint(captures, endpoint) {
  if (!endpoint) return [];
  return captures.filter(
    (c) =>
      c.request?.method === endpoint.method &&
      c.request?.path?.startsWith(endpoint.path.replace(/:\w+/g, ''))
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function collectFailures() {
  ensureLogsDir();

  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  RepairAI — Phase 2: Failure Collector               ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\nRun ID  : ${runId}`);
  console.log(`Started : ${startedAt}`);
  console.log('\n[1/4] Running Jest test suite...\n');

  // ── Run Jest ──────────────────────────────────────────────
  const jestArgs = [
    'jest',
    '--forceExit',
    '--detectOpenHandles',
    '--verbose',
    '--json',
    '--outputFile=logs/jest-results.json',  // relative path avoids Windows space-in-path issues
  ];

  const jestResult = spawnSync('npx', jestArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,           // Required on Windows for npx to resolve correctly
    env: {
      ...process.env,
      FORCE_COLOR: '0',    // disable ANSI color codes for cleaner parsing
      NO_COLOR: '1',
    },
    maxBuffer: 50 * 1024 * 1024, // 50MB buffer for verbose output
  });

  // Diagnose spawn errors
  if (jestResult.error) {
    console.error('[ERROR] Failed to spawn Jest process:', jestResult.error.message);
    process.exit(1);
  }

  const stdout = jestResult.stdout || '';
  const stderr = jestResult.stderr || '';

  // Save raw output files for debugging
  fs.writeFileSync(STDOUT_LOG, stdout);
  fs.writeFileSync(STDERR_LOG, stderr);

  console.log('[2/4] Parsing Jest results...');

  // ── Read Jest JSON ─────────────────────────────────────────
  if (!fs.existsSync(JEST_RESULTS_FILE)) {
    console.error('\n[ERROR] jest-results.json was not created.');
    console.error('Jest stderr:\n', jestResult.stderr);
    process.exit(1);
  }

  let jestData;
  try {
    jestData = JSON.parse(fs.readFileSync(JEST_RESULTS_FILE, 'utf8'));
  } catch (e) {
    console.error('[ERROR] Failed to parse jest-results.json:', e.message);
    process.exit(1);
  }

  console.log('[3/4] Extracting request logs and error captures...');

  // The verbose output (stderr) contains Express request logs and [CAPTURE] lines
  const combinedOutput = stdout + '\n' + stderr;
  const requestLogs = extractRequestLogs(combinedOutput);
  const errorCaptures = parseErrorCaptures(combinedOutput);

  // Save parsed captures
  fs.writeFileSync(CAPTURE_LOG, JSON.stringify(errorCaptures, null, 2));

  console.log('[4/4] Building failure report...\n');

  // ── Build failure objects ─────────────────────────────────
  const failures = [];
  let failureIdx = 0;

  for (const testSuite of jestData.testResults) {
    // In Jest's JSON output: suite file path is under "name", not "testFilePath"
    const suiteName = (testSuite.name || '').replace(/\\/g, '/');
    const suiteFile = suiteName.split('/backend/')[1] || suiteName;

    // Individual tests are under "assertionResults", not "testResults"
    const tests = testSuite.assertionResults || [];

    for (const test of tests) {
      if (test.status !== 'failed') continue;

      failureIdx++;
      const ancestorTitles = test.ancestorTitles || [];
      const allTitles = [...ancestorTitles, test.title];
      const endpoint = extractEndpoint(allTitles);

      const rawError = (test.failureMessages || []).join('\n\n');
      const firstErrorLines = rawError.split('\n').slice(0, 8).join('\n').trim();

      // Extract which assertion failed (expected vs received)
      const expectedMatch = rawError.match(/Expected(?:\s+value)?:\s*(.+)/);
      const receivedMatch = rawError.match(/Received(?:\s+value)?:\s*(.+)/);

      // 1. Stack-trace based hints (from assertion/error stacks)
      const stackHints = extractSourceHints(rawError);

      // 2. Path-based hints (inferred from the endpoint resource name via filesystem scan)
      const pathHints = inferSourceFiles(endpoint);

      // Merge, deduplicating, stack hints first (more precise when available)
      const sourceHints = [...new Set([...stackHints, ...pathHints])];

      const matchedLogs = matchLogsToEndpoint(requestLogs, endpoint);
      const matchedCaptures = matchCapturesToEndpoint(errorCaptures, endpoint);

      failures.push({
        id: `failure-${String(failureIdx).padStart(3, '0')}`,
        testFile: suiteFile,
        describeBlock: ancestorTitles.join(' > '),
        testName: test.title,
        fullTitle: allTitles.join(' > '),
        status: 'failed',
        durationMs: test.duration ?? null,
        error: {
          type: rawError.match(/^\s*(\w+Error):/m)?.[1] || 'AssertionError',
          message: firstErrorLines,
          expected: expectedMatch?.[1]?.trim() ?? null,
          received: receivedMatch?.[1]?.trim() ?? null,
          fullStack: rawError,
        },
        endpoint: endpoint,
        sourceHints: sourceHints,
        requestLogs: matchedLogs,
        errorCaptures: matchedCaptures,
      });
    }
  }

  // ── Assemble final report ─────────────────────────────────
  const completedAt = new Date().toISOString();

  const report = {
    runId,
    startedAt,
    completedAt,
    summary: {
      total: jestData.numTotalTests,
      passed: jestData.numPassedTests,
      failed: jestData.numFailedTests,
      pending: jestData.numPendingTests ?? 0,
      skipped: jestData.numTodoTests ?? 0,
      success: jestData.success,
    },
    testSuites: {
      total: jestData.numTotalTestSuites,
      failed: jestData.numFailedTestSuites,
      passed: jestData.numPassedTestSuites,
    },
    failures,
    allRequestLogs: requestLogs,
    allErrorCaptures: errorCaptures,
    // Metadata for Phase 3 (code search)
    meta: {
      sourceRoot: 'src/',
      testRoot: 'tests/',
      bugFiles: [
        'src/controllers/userController.js',
        'src/controllers/productController.js',
        'src/middleware/errorHandler.js',
        'src/routes/users.js',
      ],
    },
  };

  fs.writeFileSync(FAILURE_REPORT, JSON.stringify(report, null, 2));

  // ── Print summary ─────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FAILURE REPORT SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Total Tests : ${report.summary.total}`);
  console.log(`  Passed      : ${report.summary.passed} ✅`);
  console.log(`  Failed      : ${report.summary.failed} ❌`);
  console.log(`  Request logs: ${requestLogs.length} captured`);
  console.log(`  Error caps  : ${errorCaptures.length} captured`);
  console.log('');

  for (const f of failures) {
    const ep = f.endpoint ? `${f.endpoint.method} ${f.endpoint.path}` : '(no endpoint)';
    const hints = f.sourceHints.filter(h => h.startsWith('src/')).join(', ') || 'none';
    console.log(`  ❌ [${f.id}]`);
    console.log(`     Suite    : ${f.describeBlock}`);
    console.log(`     Test     : ${f.testName}`);
    console.log(`     Endpoint : ${ep}`);
    console.log(`     Files    : ${hints}`);
    console.log(`     Error    : ${f.error.message.split('\n')[0].slice(0, 80)}`);
    if (f.error.expected !== null) {
      console.log(`     Expected : ${f.error.expected}`);
      console.log(`     Received : ${f.error.received}`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Output files:`);
  console.log(`    logs/failure-report.json  ← Main AI agent input`);
  console.log(`    logs/jest-results.json    ← Raw Jest JSON`);
  console.log(`    logs/jest-stdout.log      ← Request logs`);
  console.log(`    logs/jest-stderr.log      ← Jest verbose output`);
  console.log(`    logs/error-captures.json  ← Structured error captures`);
  console.log('═══════════════════════════════════════════════════════');

  return report;
}

module.exports = { collectFailures };

// Run when called directly
if (require.main === module) {
  collectFailures();
}
