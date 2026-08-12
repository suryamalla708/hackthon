#!/usr/bin/env node
/**
 * repair.js — Phase 4: Automated AI Repair Loop
 *
 * Usage:
 *   node scripts/repair.js            # Runs repair loop (Gemini API or Mock Mode fallback)
 *   node scripts/repair.js --revert   # Restores all seeded bugs and regenerates pipeline
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config(); // Load .env file if it exists

const ROOT = path.resolve(__dirname, '..');
const REPORT_IN = path.join(ROOT, 'logs', 'code-locations.json');
const FAILURE_REPORT = path.join(ROOT, 'logs', 'failure-report.json');

// Original broken contents for revert capability
const ORIGINAL_BUGS = {
  'src/controllers/userController.js': (content) => {
    return content.replace(
      /name:\s*req\.body\.name,\s*\/\/\s*BUG\s*B1/g,
      'name: req.body.username, // BUG B1'
    );
  },
  'src/controllers/productController.js': (content) => {
    let output = content.replace(
      /const\s+savedProduct\s*=\s*await\s+product\.save\(\);/g,
      'const savedProduct = product.save();'
    );
    output = output.replace(
      /const\s+discountPercent\s*=\s*10;[\s\S]*?const\s+discountedPrice\s*=\s*product\.price\s*\*\s*\(1\s*-\s*discountPercent\s*\/\s*100\);/g,
      'const discountPercent = 0; // BUG B4: discount divisor is 0 → price / 0 = Infinity\n    const discountedPrice = product.price / discountPercent;'
    );
    return output;
  },
  'src/routes/users.js': (content) => {
    return content.replace(
      /router\.delete\('\/:id',\s*userController\.deleteUser\);/g,
      "router.put('/:id', userController.deleteUser);"
    );
  },
  'src/middleware/errorHandler.js': (content) => {
    return `/**
 * Global Express error-handling middleware.
 *
 * ============================================================
 * BUG B5: This function only has 3 parameters (req, res, next).
 * Express identifies error handlers by their ARITY (4 params).
 * With only 3 params, Express treats this as a regular middleware,
 * NOT an error handler — errors passed via next(err) are silently
 * dropped and the request hangs or falls through to Express's
 * default handler, which returns plain-text 500 HTML, not JSON.
 * ============================================================
 *
 * FIX: Change signature to (err, req, res, next)
 */
function errorHandler(req, res, next) { // BUG B5: missing 'err' as first param
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  });
}

module.exports = errorHandler;
`;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    ...options
  });
  return result;
}

function restoreOriginalBugs() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  RepairAI — Restoring Seeded Bugs                    ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  for (const [relPath, modifier] of Object.entries(ORIGINAL_BUGS)) {
    const absPath = path.join(ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      console.warn(`[WARN] File not found: ${relPath}`);
      continue;
    }
    const current = fs.readFileSync(absPath, 'utf8');
    const restored = modifier(current);
    fs.writeFileSync(absPath, restored, 'utf8');
    console.log(`  [RESTORED] ${relPath}`);
  }

  console.log('\nRunning diagnostics and rebuilding pipeline logs...\n');
  const pipeResult = runCommand('npm', ['run', 'pipeline']);
  if (pipeResult.status !== 0) {
    console.error('[ERROR] Failed to run pipeline after revert:', pipeResult.stderr);
  } else {
    console.log('Pipeline successfully rebuilt! Logs populated with bugs.');
  }
}

async function callGeminiAPI(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API call failed: ${response.statusText} (${errText})`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response from LLM');
  }
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// Line-by-line Mock Patching (immune to Windows line-ending differences)
// ─────────────────────────────────────────────────────────────────────────────
function applyLineMockPatch(filePath, fileContent, findings) {
  const lines = fileContent.split(/\r?\n/);
  let patchedCount = 0;

  for (const finding of findings) {
    // 1. wrong_field_access in userController.js (B1)
    if (finding.strategy === 'wrong_field_access' && filePath.includes('userController.js')) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('name: req.body.username, // BUG B1')) {
          lines[i] = lines[i].replace('req.body.username', 'req.body.name');
          patchedCount++;
        }
      }
    }
    // 2. missing_await in productController.js (B2)
    else if (finding.strategy === 'missing_await' && filePath.includes('productController.js')) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('const savedProduct = product.save(); // BUG B2')) {
          lines[i] = lines[i].replace('product.save()', 'await product.save()');
          patchedCount++;
        }
      }
    }
    // 3. division_by_zero in productController.js (B4)
    else if (
      (finding.strategy === 'division_by_zero' || finding.strategy === 'division_by_zero_variable') &&
      filePath.includes('productController.js')
    ) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('const discountPercent = 0; // BUG B4')) {
          lines[i] = '    const discountPercent = 10; // 10% discount';
          if (i + 1 < lines.length && lines[i + 1].includes('const discountedPrice = product.price / discountPercent;')) {
            lines[i + 1] = '    const discountedPrice = product.price * (1 - discountPercent / 100);';
          }
          patchedCount++;
        }
      }
    }
    // 4. wrong_http_method in users.js (B3)
    else if (finding.strategy === 'wrong_http_method' && filePath.includes('users.js')) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("router.put('/:id', userController.deleteUser); // BUG B3")) {
          lines[i] = lines[i].replace('router.put', 'router.delete');
          patchedCount++;
        }
      }
    }
    // 5. error_handler_arity in errorHandler.js (B5)
    else if (finding.strategy === 'error_handler_arity' && filePath.includes('errorHandler.js')) {
      // For B5, we replace the whole handler function
      let insideHandler = false;
      let startIdx = -1;
      let endIdx = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('function errorHandler(')) {
          startIdx = i;
          insideHandler = true;
        }
        if (insideHandler && lines[i].includes('module.exports = errorHandler;')) {
          endIdx = i;
          break;
        }
      }

      if (startIdx !== -1 && endIdx !== -1) {
        const pre = lines.slice(0, startIdx);
        const post = lines.slice(endIdx);
        const fixedHandler = [
          'function errorHandler(err, req, res, next) { // BUG B5: missing \'err\' as first param',
          '  let statusCode = res.statusCode !== 200 ? res.statusCode : 500;',
          '  if (err.name === \'ValidationError\') {',
          '    statusCode = 400;',
          '  } else if (err.status || err.statusCode) {',
          '    statusCode = err.status || err.statusCode;',
          '  }',
          '  res.status(statusCode).json({',
          '    error: err.name || \'Internal Server Error\',',
          '    message: err.message || \'An unexpected error occurred\',',
          '  });',
          '}'
        ];
        lines.splice(startIdx, endIdx - startIdx, ...fixedHandler);
        patchedCount++;
      }
    }
  }

  return { patched: lines.join('\n'), patchedCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Loop
// ─────────────────────────────────────────────────────────────────────────────

async function repairCode() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  RepairAI — Phase 4: AI Repair Loop                  ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(REPORT_IN)) {
    console.error('[ERROR] logs/code-locations.json not found. Run: npm run pipeline');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(REPORT_IN, 'utf8'));
  const locations = data.locations || [];

  if (locations.length === 0) {
    console.log('No failures detected in logs/code-locations.json. Everything is healthy! 🎉');
    return;
  }

  // Load failure-report.json to map failureId to testFile
  let failureToTestFileMap = {};
  if (fs.existsSync(FAILURE_REPORT)) {
    const reportData = JSON.parse(fs.readFileSync(FAILURE_REPORT, 'utf8'));
    for (const f of reportData.failures || []) {
      failureToTestFileMap[f.id] = f.testFile;
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const isMockMode = !apiKey;

  if (isMockMode) {
    console.log('[MOCK MODE] GEMINI_API_KEY is not set in environment or .env file.');
    console.log('[MOCK MODE] Simulating LLM code generation based on Phase 3 findings...\n');
  } else {
    console.log('[REAL MODE] Using Google Gemini API (gemini-1.5-flash) to generate patches...\n');
  }

  let successCount = 0;
  let failCount = 0;

  for (const loc of locations) {
    console.log(`🔧 Resolving Failure: [${loc.failureId}] for endpoint: ${loc.endpoint ? `${loc.endpoint.method} ${loc.endpoint.path}` : 'unknown'}`);
    console.log(`   Test: "${loc.testName}"`);
    console.log(`   Error: ${loc.error?.message?.split('\n')?.[0]}`);

    const testFile = failureToTestFileMap[loc.failureId] || '';

    for (const suspect of loc.fileSuspects) {
      const relPath = suspect.file;
      const absPath = path.join(ROOT, relPath);
      if (!fs.existsSync(absPath)) {
        console.log(`   ❌ Suspect file not found: ${relPath}`);
        continue;
      }

      const originalContent = fs.readFileSync(absPath, 'utf8');
      let newContent = '';

      if (isMockMode) {
        // Apply mock patch
        const { patched, patchedCount } = applyLineMockPatch(relPath, originalContent, suspect.findings);
        if (patchedCount === 0) {
          console.log(`   ⚠️ No matching mock patch pattern for ${relPath}. Skipping.`);
          continue;
        }
        newContent = patched;
        console.log(`   [PATCH GENERATED] Mock-generated patch for ${relPath}`);
      } else {
        // Construct prompt and call real LLM
        console.log(`   [LLM REQUEST] Querying Gemini API for ${relPath}...`);
        const findingsSummary = suspect.findings
          .filter(f => f.confidence === 'HIGH')
          .map(f => `- Line ${f.line}: [${f.strategy}] ${f.reason}`)
          .join('\n');

        const prompt = `You are a software engineer specializing in Node.js/Express and MongoDB.
Your task is to fix a bug in the following source code file:

File Name: ${relPath}

=== Test Failure Context ===
Test: ${loc.testName}
Error Name: ${loc.error?.type}
Error Message: ${loc.error?.message}
Expected: ${loc.error?.expected}
Received: ${loc.error?.received}
Stack Trace:
${loc.error?.fullStack}

=== HTTP Server Context ===
Request Logs:
${loc.requestLogs?.join('\n') || '(no request logs)'}
Error captures:
${JSON.stringify(loc.errorCaptures, null, 2)}

=== Bug Search Tool Findings (High Confidence) ===
${findingsSummary || '(no specific line flagged)'}

=== Source Code File ===
${originalContent}

=== Instructions ===
1. Analyze the test failure and the bug search tool findings.
2. Fix the bug in the file.
3. Output the ENTIRE repaired file contents.
4. Wrap your code output in a single markdown code block like this:
\`\`\`javascript
// code here
\`\`\`
5. Provide NO explanations, NO markdown text outside the code block, and NO other commentary. Your reply must contain only the code block.`;

        try {
          const llmReply = await callGeminiAPI(apiKey, prompt);
          // Parse response block
          const match = llmReply.match(/```(?:javascript|js)?([\s\S]*?)```/i);
          if (match) {
            newContent = match[1].trim();
          } else {
            newContent = llmReply.trim();
          }
          console.log(`   [LLM RESPONSE] Successfully retrieved patch.`);
        } catch (err) {
          console.error(`   ❌ Gemini API call failed: ${err.message}`);
          continue;
        }
      }

      // Apply patch
      fs.writeFileSync(absPath, newContent, 'utf8');

      // Verify patch: targeted Jest run using simplified regex pattern matching test name
      const testNamePattern = loc.testName.replace(/[^a-zA-Z0-9\s]/g, '.*');
      console.log(`   [VERIFYING] Running targeted test: npx jest ${testFile} -t "${testNamePattern}"`);
      const testResult = runCommand('npx', ['jest', [testFile], '-t', `"${testNamePattern}"`, '--forceExit']);

      if (testResult.status === 0) {
        console.log(`   ✅ SUCCESS: Patch successfully repaired this bug!\n`);
        successCount++;
      } else {
        console.warn(`   ❌ FAILURE: Patch failed verification (tests failed). Restoring original file.\n`);
        fs.writeFileSync(absPath, originalContent, 'utf8');
        failCount++;
      }
    }
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('  REPAIR SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Successfully Repaired : ${successCount}`);
  console.log(`  Failed to Repair      : ${failCount}`);
  console.log('');
  if (failCount === 0 && successCount > 0) {
    console.log('  🎉 All files repaired and verified! 100% success rate.');
  } else if (successCount > 0) {
    console.log('  ⚠️ Some files were repaired, but others failed verification.');
  } else {
    console.log('  ❌ Repair loop completed with no successful patches.');
  }
  console.log('═══════════════════════════════════════════════════════\n');
}

// Check arguments
if (process.argv.includes('--revert')) {
  restoreOriginalBugs();
} else {
  repairCode().catch(err => {
    console.error('Unhandled error in repair loop:', err);
    process.exit(1);
  });
}
