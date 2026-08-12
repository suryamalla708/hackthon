#!/usr/bin/env node
/**
 * searchCode.js — Phase 3: Source Code Search & Fault Localisation
 *
 * Reads logs/failure-report.json, loads every hinted source file,
 * and applies five targeted search strategies to locate the exact
 * buggy lines:
 *
 *  1. missing_await        — async Mongoose calls without await
 *  2. wrong_http_method    — router.put() where router.delete() is needed
 *  3. division_by_zero     — literal /0 or variable assigned 0 used as divisor
 *  4. wrong_field_access   — req.body.<field> that likely doesn't match payload
 *  5. error_handler_arity  — Express error handlers with 3 params instead of 4
 *  6. keyword_match        — fallback: terms extracted from the error message
 *
 * Writes logs/code-locations.json — the primary input for Phase 4 (LLM).
 *
 * Usage:
 *   node scripts/searchCode.js
 *   npm run search
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..');
const LOGS_DIR  = path.join(ROOT, 'logs');
const REPORT_IN = path.join(LOGS_DIR, 'failure-report.json');
const OUT_FILE  = path.join(LOGS_DIR, 'code-locations.json');

// ─────────────────────────────────────────────────────────────────────────────
// File helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Read a source file relative to the backend root. Returns null if missing. */
function readSourceFile(relPath) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) return null;
  const content = fs.readFileSync(absPath, 'utf8');
  return { path: relPath, content, lines: content.split('\n') };
}

/**
 * Return a numbered code snippet surrounding a given line.
 * @param {string[]} lines    - All lines of the file (0-indexed array)
 * @param {number}   lineNum  - The focal line (1-indexed)
 * @param {number}   context  - Number of surrounding lines to include
 */
function getContext(lines, lineNum, context = 5) {
  const start = Math.max(0, lineNum - context - 1);
  const end   = Math.min(lines.length, lineNum + context);
  const snippet = lines
    .slice(start, end)
    .map((l, i) => {
      const n = start + i + 1;
      const marker = n === lineNum ? '>>>' : '   ';
      return `${marker} ${String(n).padStart(4, ' ')} | ${l}`;
    })
    .join('\n');
  return { lineStart: start + 1, lineEnd: end, snippet };
}

function searchMissingAwait(file) {
  const DB_METHODS = [
    'save', 'find', 'findById', 'findOne',
    'findByIdAndUpdate', 'findByIdAndDelete',
    'create', 'insertMany', 'deleteMany', 'updateMany', 'countDocuments',
  ];
  const findings = [];

  for (let i = 0; i < file.lines.length; i++) {
    const raw  = file.lines[i];
    const line = raw.trim();
    if (line.startsWith('//') || line.startsWith('*')) continue;

    for (const method of DB_METHODS) {
      const callPat = new RegExp(`\.${method}\\s*\\(`);
      if (!callPat.test(line)) continue;

      // Skip lines that ALREADY have await (they are correct) - strip comments first
      const codeOnly = line.split('//')[0].trim();
      if (/\bawait\b/.test(codeOnly)) continue;
      // Skip function/method definitions like:  async save() {
      if (/^(async\s+)?[\w]+\s*\(/.test(line) && line.includes('{')) continue;
      // Skip import/require lines
      if (/require|import/.test(line)) continue;
      // Skip comment-only lines (already checked above, but be safe)
      if (line.startsWith('//') || line.startsWith('*')) continue;

      const ctx = getContext(file.lines, i + 1);
      findings.push({
        strategy: 'missing_await',
        confidence: 'HIGH',
        line: i + 1,
        lineContent: raw.trimEnd(),
        reason: `'.${method}()' called without 'await' in async context — the call returns a Promise instead of the resolved value. Subsequent code using the result gets a Promise object, not the document.`,
        ...ctx,
      });
    }
  }
  return findings;
}

/**
 * Strategy 2 — Wrong HTTP method registration.
 * For DELETE endpoint failures: look for router.put() registering a /:id handler
 * that should be router.delete().
 */
function searchWrongHttpMethod(file, endpoint) {
  const findings = [];
  if (!endpoint || endpoint.method !== 'DELETE') return findings;

  for (let i = 0; i < file.lines.length; i++) {
    const raw  = file.lines[i];
    const line = raw.trim();
    if (line.startsWith('//') || line.startsWith('*')) continue;

    // router.put('/:id', ...) in a routes file that should handle DELETE
    if (/router\.(put|post|get|patch)\s*\(/.test(line)) {
      const methodMatch = line.match(/router\.(\w+)\s*\(/);
      const registered  = methodMatch?.[1]?.toUpperCase();
      // If this line also mentions a deleteXxx handler or /:id and endpoint expects DELETE
      if (
        registered && registered !== 'DELETE' &&
        (/:\w+/.test(line) || /delete/i.test(line))
      ) {
        const ctx = getContext(file.lines, i + 1);
        findings.push({
          strategy: 'wrong_http_method',
          confidence: 'HIGH',
          line: i + 1,
          lineContent: raw.trimEnd(),
          reason: `Route registered as router.${registered.toLowerCase()}() but test expects DELETE ${endpoint.path}. Should be router.delete().`,
          ...ctx,
        });
      }
    }
  }
  return findings;
}

/**
 * Strategy 3 — Division by zero.
 * Catches both:
 *   a) literal  `x / 0`
 *   b) `x / variable` where `variable` is assigned 0 within 15 lines above
 */
function searchDivisionByZero(file) {
  const findings = [];

  for (let i = 0; i < file.lines.length; i++) {
    const raw  = file.lines[i];
    const line = raw.trim();
    if (line.startsWith('//') || line.startsWith('*')) continue;

    // (a) literal division by zero: something / 0
    if (/[^\s/]\/\s*0(?!\.)/.test(raw) || /\bprice\b.*\/\s*0\b/.test(raw)) {
      // Avoid false positive from URL strings
      if (!raw.includes("'") && !raw.includes('"') || /\/\s*0/.test(raw.replace(/['"][^'"]*['"]/g, ''))) {
        const ctx = getContext(file.lines, i + 1);
        findings.push({
          strategy: 'division_by_zero',
          confidence: 'HIGH',
          line: i + 1,
          lineContent: raw.trimEnd(),
          reason: `Literal division by zero: '/ 0' produces Infinity. JSON.stringify(Infinity) → null.`,
          ...ctx,
        });
        continue;
      }
    }

    // (b) division by a variable that is assigned 0 nearby
    const divMatch = raw.match(/(\w+)\s*\/\s*(\w+)\s*;/);
    if (divMatch) {
      const divisor = divMatch[2];
      if (divisor === '0') continue; // already caught above
      const lookback = Math.max(0, i - 15);
      for (let j = lookback; j < i; j++) {
        if (new RegExp(`\\bconst\\b.*\\b${divisor}\\s*=\\s*0\\b|\\blet\\b.*\\b${divisor}\\s*=\\s*0\\b|\\b${divisor}\\s*=\\s*0\\b`).test(file.lines[j])) {
          const ctx = getContext(file.lines, i + 1);
          findings.push({
            strategy: 'division_by_zero_variable',
            confidence: 'HIGH',
            line: i + 1,
            lineContent: raw.trimEnd(),
            reason: `Divides by '${divisor}' which is set to 0 at line ${j + 1} — produces Infinity.`,
            ...ctx,
          });
          break;
        }
      }
    }
  }
  return findings;
}

/**
 * Strategy 4 — Wrong request body field access.
 * Flags `req.body.<field>` usages where the field name differs from
 * what common naming conventions / model definitions would expect.
 *
 * Heuristic: if the controller reads req.body.X to populate model field Y,
 * and X ≠ Y, it's suspicious. We flag any req.body access that doesn't
 * match the field being assigned.
 */
function searchWrongFieldAccess(file) {
  const findings = [];

  for (let i = 0; i < file.lines.length; i++) {
    const raw  = file.lines[i];
    const line = raw.trim();
    if (line.startsWith('//') || line.startsWith('*')) continue;

    // Find assignments like:  fieldName: req.body.someField
    const assignMatch = raw.match(/(\w+)\s*:\s*req\.body\.(\w+)/);
    if (assignMatch) {
      const target = assignMatch[1].toLowerCase(); // model field name
      const source = assignMatch[2].toLowerCase(); // body field being read

      if (target !== source) {
        const ctx = getContext(file.lines, i + 1);
        findings.push({
          strategy: 'wrong_field_access',
          confidence: 'HIGH',
          line: i + 1,
          lineContent: raw.trimEnd(),
          reason: `Mismatch: assigns model field '${target}' from req.body.${source}. If the request sends '${target}', this should be req.body.${target}.`,
          ...ctx,
        });
      }
    }
  }
  return findings;
}

/**
 * Strategy 5 — Express error handler with wrong arity.
 * Express only recognises a middleware as an error handler if its function
 * signature has exactly 4 parameters: (err, req, res, next).
 * A 3-param function is treated as regular middleware and errors are silently skipped.
 *
 * Only applied to files in middleware/ directory to avoid false-positives on controllers.
 */
function searchErrorHandlerArity(file) {
  const findings = [];
  // Only analyse middleware files — controllers intentionally have 3 params
  const isMiddleware = file.path.includes('/middleware/') || file.path.includes('\\middleware\\');
  if (!isMiddleware) return findings;

  for (let i = 0; i < file.lines.length; i++) {
    const raw  = file.lines[i];
    const line = raw.trim();

    // Match: function someHandler(req, res, next) — 3 params, no 'err'
    const threeParam = line.match(/function\s+(\w+)\s*\(\s*(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*\)/);
    if (threeParam) {
      const [, fnName, p1, p2, p3] = threeParam;
      const params = [p1, p2, p3];
      // Flag any function in a middleware file that has (req, res, next) but no err
      if (params.includes('req') && params.includes('res') && params.includes('next')) {
        const ctx = getContext(file.lines, i + 1);
        findings.push({
          strategy: 'error_handler_arity',
          confidence: 'HIGH',
          line: i + 1,
          lineContent: raw.trimEnd(),
          reason: `'${fnName}(${params.join(', ')})' has only 3 parameters. Express error handlers MUST have 4: (err, req, res, next). With 3 params, Express treats this as normal middleware and errors passed via next(err) are never caught here.`,
          ...ctx,
        });
      }
    }
  }
  return findings;
}

/**
 * Strategy 6 — Keyword fallback search.
 * Extracts signal words from error messages and searches for them in source.
 */
function extractKeywords(errorMsg) {
  const NOISE = new Set([
    'error','expect','received','expected','value','object','equality',
    'defined','undefined','null','true','false','the','and','or','but',
    'is','to','be','not','for','in','of','a','an','with','on','at','by',
    'it','its','this','that','will','can','cannot','should','have','has',
    'was','were','when','than','then','which','what','how',
    'test','jest','assert','pass','fail',
  ]);
  return [...new Set(
    errorMsg
      .split(/[\s\n\r.,;:()[\]{}'"!?=<>\/\\@]+/)
      .map(w => w.replace(/[^a-zA-Z0-9_$]/g, ''))
      .filter(w => w.length >= 4 && !NOISE.has(w.toLowerCase()) && !/^\d+$/.test(w))
      .slice(0, 12)
  )];
}

function searchKeywords(file, keywords) {
  const findings = [];
  const seen = new Set();

  for (const kw of keywords) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    for (let i = 0; i < file.lines.length; i++) {
      if (seen.has(i)) continue;
      const raw  = file.lines[i];
      const line = raw.trim();
      if (line.startsWith('//') || line.startsWith('*')) continue;
      if (!regex.test(raw)) continue;

      seen.add(i);
      const ctx = getContext(file.lines, i + 1, 3);
      findings.push({
        strategy: 'keyword_match',
        confidence: 'LOW',
        keyword: kw,
        line: i + 1,
        lineContent: raw.trimEnd(),
        reason: `Keyword '${kw}' (extracted from error message) found at line ${i + 1}.`,
        ...ctx,
      });
    }
  }
  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-file analysis
// ─────────────────────────────────────────────────────────────────────────────

function analyseFile(file, failure) {
  const all = [];
  const { endpoint, error } = failure;

  // Run all targeted strategies
  all.push(...searchMissingAwait(file));
  all.push(...searchWrongHttpMethod(file, endpoint));
  all.push(...searchDivisionByZero(file));
  all.push(...searchWrongFieldAccess(file));
  all.push(...searchErrorHandlerArity(file));

  // Keyword fallback for any lines not already caught
  const highLines = new Set(all.map(f => f.line));
  const keywords  = extractKeywords(error.message + ' ' + (error.expected || '') + ' ' + (error.received || ''));
  const kwFindings = searchKeywords(file, keywords).filter(f => !highLines.has(f.line));
  all.push(...kwFindings);

  // Sort: HIGH confidence first, then by line number
  const ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  all.sort((a, b) => (ORDER[a.confidence] ?? 9) - (ORDER[b.confidence] ?? 9) || a.line - b.line);

  return all;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function searchCode() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  RepairAI — Phase 3: Source Code Search              ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(REPORT_IN)) {
    console.error('[ERROR] logs/failure-report.json not found. Run: npm run collect');
    process.exit(1);
  }

  const report   = JSON.parse(fs.readFileSync(REPORT_IN, 'utf8'));
  const failures = report.failures || [];

  console.log(`[1/3] Loaded ${failures.length} failures from failure-report.json`);
  console.log('[2/3] Scanning source files...\n');

  const locations = [];

  for (const failure of failures) {
    const ep = failure.endpoint
      ? `${failure.endpoint.method} ${failure.endpoint.path}`
      : '(unknown endpoint)';

    console.log(`  ─── ${failure.id}: ${ep}`);

    const fileSuspects = [];

    for (const relPath of [...new Set([...(failure.sourceHints || []), 'src/middleware/errorHandler.js'])]) {
      if (relPath.startsWith('tests/')) continue; // skip test files
      const file = readSourceFile(relPath);
      if (!file) {
        console.log(`       ⚠  Could not read: ${relPath}`);
        continue;
      }

      const findings = analyseFile(file, failure);
      const highCount = findings.filter(f => f.confidence === 'HIGH').length;

      console.log(`       📂 ${relPath}  (${file.lines.length} lines, ${findings.length} findings, ${highCount} HIGH)`);
      for (const f of findings.filter(f => f.confidence === 'HIGH')) {
        console.log(`            L${f.line}: [${f.strategy}] ${f.reason.slice(0, 72)}`);
      }

      fileSuspects.push({
        file: relPath,
        totalLines: file.lines.length,
        fullContent: file.content,           // included for LLM context (Phase 4)
        findings: findings,
      });
    }

    locations.push({
      failureId: failure.id,
      endpoint: failure.endpoint,
      testName: failure.fullTitle,
      error: failure.error,
      requestLogs: failure.requestLogs,
      errorCaptures: failure.errorCaptures,
      fileSuspects,
    });

    console.log('');
  }

  console.log('[3/3] Writing code-locations.json...');

  const output = {
    generatedAt: new Date().toISOString(),
    sourceRunId: report.runId,
    totalFailures: failures.length,
    locations,
    // Summary for quick overview
    summary: locations.map(loc => ({
      failureId: loc.failureId,
      endpoint: loc.endpoint,
      highConfidenceFindings: loc.fileSuspects
        .flatMap(f => f.findings)
        .filter(f => f.confidence === 'HIGH')
        .map(f => ({
          file: loc.fileSuspects.find(s => s.findings.includes(f))?.file,
          line: f.line,
          strategy: f.strategy,
          reason: f.reason.slice(0, 120),
        })),
    })),
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));

  // ── Pretty summary ──────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  CODE SEARCH SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  for (const loc of output.summary) {
    const ep = loc.endpoint ? `${loc.endpoint.method} ${loc.endpoint.path}` : '?';
    const count = loc.highConfidenceFindings.length;
    console.log(`\n  [${loc.failureId}] ${ep}  (${count} HIGH findings)`);
    for (const h of loc.highConfidenceFindings) {
      console.log(`    ↳ ${h.file}:${h.line}  [${h.strategy}]`);
      console.log(`      ${h.reason}`);
    }
  }
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Output: logs/code-locations.json');
  console.log('═══════════════════════════════════════════════════════\n');

  return output;
}

module.exports = { searchCode };

if (require.main === module) {
  searchCode();
}
