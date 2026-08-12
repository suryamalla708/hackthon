#!/usr/bin/env node
/**
 * agent.js — Phase 5: AI Debugging Agent
 *
 * This script:
 *  1. Reads failure locations from logs/code-locations.json
 *  2. For each failure, loops through its suspect files
 *  3. Calls the Google Gemini API in JSON mode (guaranteed schema: rootCause, search, replace)
 *     or simulates mock response if --mock is specified
 *  4. Performs a backup-and-restore in-place patch to isolate testing
 *  5. Runs targeted Jest validation tests
 *  6. Retries up to 3 times with error feedback in case of failures
 *
 * Usage:
 *   node scripts/agent.js          # Queries real LLM (requires GEMINI_API_KEY)
 *   node scripts/agent.js --mock   # Runs mock-simulated loop to test retry/revert mechanism
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config(); // Load .env file

const ROOT = path.resolve(__dirname, '..');
const REPORT_IN = path.join(ROOT, 'logs', 'code-locations.json');
const FAILURE_REPORT = path.join(ROOT, 'logs', 'failure-report.json');

// Mock data to simulate Attempt 1 (fails) and Attempt 2 (passes)
const MOCK_PATCHES = {
  'src/controllers/productController.js': {
    missing_await: [
      {
        rootCause: "Awaiting the save operation, but with a deliberate typo to verify retry handling.",
        search: "const savedProduct = product.save(); // BUG B2: missing await",
        replace: "const savedProduct = await product.save(typo); // Attempt 1"
      },
      {
        rootCause: "Awaiting the promise returned by product.save() to resolve before accessing its properties.",
        search: "const savedProduct = product.save(); // BUG B2: missing await",
        replace: "const savedProduct = await product.save(); // BUG B2: missing await"
      }
    ],
    division_by_zero: [
      {
        rootCause: "Temporary fix with wrong price logic to verify retry handling.",
        search: "const discountPercent = 0; // BUG B4: discount divisor is 0 → price / 0 = Infinity\n    const discountedPrice = product.price / discountPercent;",
        replace: "const discountPercent = 0; // BUG B4: discount divisor is 0 → price / 0 = Infinity\n    const discountedPrice = product.price / 1; // Attempt 1"
      },
      {
        rootCause: "Fixing division by zero in product discount calculation by checking divisor.",
        search: "const discountPercent = 0; // BUG B4: discount divisor is 0 → price / 0 = Infinity\n    const discountedPrice = product.price / discountPercent;",
        replace: "const discountPercent = 10; // 10% discount\n    const discountedPrice = product.price * (1 - discountPercent / 100);"
      }
    ]
  },
  'src/controllers/userController.js': {
    wrong_field_access: [
      {
        rootCause: "Reading req.body.user instead of req.body.name to verify retry handling.",
        search: "name: req.body.username, // BUG B1",
        replace: "name: req.body.user, // Attempt 1"
      },
      {
        rootCause: "Assigning user name from name field instead of username.",
        search: "name: req.body.username, // BUG B1",
        replace: "name: req.body.name, // BUG B1"
      }
    ]
  },
  'src/routes/users.js': {
    wrong_http_method: [
      {
        rootCause: "Registering route as POST instead of DELETE to verify retry handling.",
        search: "router.put('/:id', userController.deleteUser); // BUG B3",
        replace: "router.post('/:id', userController.deleteUser); // Attempt 1"
      },
      {
        rootCause: "DELETE method correctly registered.",
        search: "router.put('/:id', userController.deleteUser); // BUG B3",
        replace: "router.delete('/:id', userController.deleteUser); // BUG B3"
      }
    ]
  },
  'src/middleware/errorHandler.js': {
    error_handler_arity: [
      {
        rootCause: "Adding extra parameter instead of err parameter to verify retry handling.",
        search: "function errorHandler(req, res, next) { // BUG B5: missing 'err' as first param",
        replace: "function errorHandler(req, res, next, extra) { // Attempt 1"
      },
      {
        rootCause: "Fixing errorHandler arity by adding err as first parameter and mapping Mongoose ValidationError to 400.",
        search: "function errorHandler(req, res, next) { // BUG B5: missing 'err' as first param\n  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;\n  res.status(statusCode).json({\n    error: 'Internal Server Error',\n    message: 'An unexpected error occurred',\n  });\n}",
        replace: "function errorHandler(err, req, res, next) { // BUG B5: missing 'err' as first param\n  let statusCode = res.statusCode !== 200 ? res.statusCode : 500;\n  if (err.name === 'ValidationError') {\n    statusCode = 400;\n  } else if (err.status || err.statusCode) {\n    statusCode = err.status || err.statusCode;\n  }\n  res.status(statusCode).json({\n    error: err.name || 'Internal Server Error',\n    message: err.message || 'An unexpected error occurred',\n  });\n}"
      }
    ]
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

async function callGeminiAPI(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            rootCause: { type: "STRING" },
            search: { type: "STRING" },
            replace: { type: "STRING" }
          },
          required: ["rootCause", "search", "replace"]
        }
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API call failed: ${response.statusText} (${errText})`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response from LLM');
  }
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Loop
// ─────────────────────────────────────────────────────────────────────────────

async function debugAndRepair() {
  const isMockMode = process.argv.includes('--mock');

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  RepairAI — Phase 5: AI Debugging Agent              ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (isMockMode) {
    console.log('[MOCK MODE] Simulating LLM query and testing retry/revert mechanism...\n');
  } else {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ ERROR: GEMINI_API_KEY environment variable is not set.');
      console.error('Please configure it in a .env file, export it, or run with --mock flag:\n  npm run agent -- --mock');
      process.exit(1);
    }
  }

  if (!fs.existsSync(REPORT_IN)) {
    console.error(`❌ ERROR: ${REPORT_IN} not found. Please run the pipeline first:\n  npm run collect && npm run search`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(REPORT_IN, 'utf8'));
  const locations = data.locations || [];

  if (locations.length === 0) {
    console.log('🎉 No failures detected in logs/code-locations.json. Everything is passing!');
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

  let successCount = 0;
  let failCount = 0;

  for (const loc of locations) {
    console.log(`🔧 Investigating Failure: [${loc.failureId}] for endpoint: ${loc.endpoint ? `${loc.endpoint.method} ${loc.endpoint.path}` : 'unknown'}`);
    console.log(`   Test Name: "${loc.testName}"`);
    console.log(`   Error     : ${loc.error?.message?.split('\n')?.[0]}`);

    const testFile = failureToTestFileMap[loc.failureId] || '';
    let isRepaired = false;

    for (const suspect of loc.fileSuspects) {
      if (isRepaired) break;

      const relPath = suspect.file.replace(/\\/g, '/');
      const absPath = path.join(ROOT, relPath);
      if (!fs.existsSync(absPath)) {
        console.log(`   ⚠️ Suspect file not found: ${relPath}`);
        continue;
      }

      console.log(`   📂 Analysing suspect file: ${relPath}`);

      const attemptHistory = [];
      const MAX_ATTEMPTS = 3;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        console.log(`     🔄 Attempt ${attempt}/${MAX_ATTEMPTS} for ${relPath}...`);

        const originalContent = fs.readFileSync(absPath, 'utf8');
        let search = '';
        let replace = '';
        let rootCause = '';

        if (isMockMode) {
          let targetStrategy = '';
          const testName = loc.testName.toLowerCase();
          if (testName.includes('b1') || testName.includes('correct name')) {
            targetStrategy = 'wrong_field_access';
          } else if (testName.includes('b2') || testName.includes('valid _id')) {
            targetStrategy = 'missing_await';
          } else if (testName.includes('b3') || testName.includes('delete a user')) {
            targetStrategy = 'wrong_http_method';
          } else if (testName.includes('b4') || testName.includes('discountedprice')) {
            targetStrategy = 'division_by_zero';
          } else if (testName.includes('no email') || testName.includes('negative price')) {
            targetStrategy = 'error_handler_arity';
          }

          const mockFile = MOCK_PATCHES[relPath];
          let mockFound = false;

          if (mockFile && targetStrategy) {
            const mockPatchesList = mockFile[targetStrategy];
            if (mockPatchesList) {
              const patchData = mockPatchesList[Math.min(attempt - 1, mockPatchesList.length - 1)];
              search = patchData.search;
              replace = patchData.replace;
              rootCause = patchData.rootCause;
              mockFound = true;
            }
          }

          if (!mockFound) {
            console.log(`     ⚠️ No matching mock patch pattern for ${relPath} and strategy ${targetStrategy}. Skipping.`);
            break;
          }

          console.log(`     💡 Root Cause Identified: ${rootCause}`);
        } else {
          // Query real Gemini LLM
          const findingsSummary = (suspect.findings || [])
            .filter(f => f.confidence === 'HIGH')
            .map(f => `- Line ${f.line}: [${f.strategy}] ${f.reason}`)
            .join('\n');

          let prompt = `You are a software engineer specializing in Node.js/Express and MongoDB.
Your task is to fix a bug in the following source code file:

File Name: ${relPath}

=== Test Failure Context ===
Test Suite: ${loc.describeBlock}
Test Name: ${loc.testName}
Error Type: ${loc.error?.type}
Error Message: ${loc.error?.message}
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
`;

          if (attemptHistory.length > 0) {
            prompt += `\n=== Previous Failed Attempts ===\n`;
            attemptHistory.forEach((h, idx) => {
              prompt += `Attempt ${idx + 1} Failed:
- Search Block:
${h.search}
- Replace Block:
${h.replace}
- Test Execution Output:
${h.testOutput}
\n`;
            });
            prompt += `Please analyze the previous failure(s) and provide a corrected search and replace block. Ensure the 'search' block exists in the code exactly as written, and the 'replace' block fixes the issue without introducing new bugs.`;
          }

          prompt += `\n=== Instructions ===
1. Analyze the test failure, error message, stack trace, and the bug search tool findings.
2. Identify the root cause of the failure.
3. Locate the code block that needs to be fixed.
4. Output a JSON object matching the requested schema:
   - 'rootCause': A brief explanation of what is wrong and how to fix it.
   - 'search': The exact substring in the source code file that needs to be replaced. You must copy the existing code EXACTLY, including all spaces, tabs, and line endings.
   - 'replace': The corrected code block that should replace the 'search' block.
`;

          try {
            const apiKey = process.env.GEMINI_API_KEY;
            const llmReply = await callGeminiAPI(apiKey, prompt);
            const parsed = JSON.parse(llmReply);
            search = parsed.search;
            replace = parsed.replace;
            rootCause = parsed.rootCause;

            console.log(`     💡 Root Cause Identified: ${rootCause}`);
          } catch (err) {
            console.error(`     ❌ Gemini API call or JSON parsing failed: ${err.message}`);
            attemptHistory.push({
              search: '(none)',
              replace: '(none)',
              testOutput: `Gemini API query or JSON parsing error: ${err.message}`
            });
            continue;
          }
        }

        // Apply patch only to a temporary copy (using backup-and-restore)
        const tempBackupPath = `${absPath}.bak`;
        fs.copyFileSync(absPath, tempBackupPath);

        let testOutput = '';
        let testPassed = false;

        try {
          // Normalize line endings to prevent Windows vs Unix mismatch issues
          const normalizedContent = originalContent.replace(/\r\n/g, '\n');
          const normalizedSearch = search.replace(/\r\n/g, '\n');
          const normalizedReplace = replace.replace(/\r\n/g, '\n');

          if (!normalizedContent.includes(normalizedSearch)) {
            console.log(`       [DEBUG] normalizedContent (first 300 chars): ${JSON.stringify(normalizedContent.slice(0, 300))}`);
            console.log(`       [DEBUG] normalizedSearch: ${JSON.stringify(normalizedSearch)}`);
            throw new Error('The search block was not found in the file content.');
          }

          const patchedContent = normalizedContent.replace(normalizedSearch, normalizedReplace);
          fs.writeFileSync(absPath, patchedContent, 'utf8');

          // Run targeted Jest test
          const testNamePattern = loc.testName.replace(/[^a-zA-Z0-9]/g, '.*');
          console.log(`     [TESTING] running targeted test: npx jest ${testFile} -t "${testNamePattern}"`);
          const testResult = runCommand('npx', ['jest', testFile, '-t', `"${testNamePattern}"`, '--forceExit']);

          testOutput = (testResult.stdout || '') + '\n' + (testResult.stderr || '');
          testPassed = testResult.status === 0;

          // Parse and print Jest test summary to stdout
          const summaryLines = testOutput.split('\n')
            .filter(line => line.includes('Test Suites:') || line.includes('Tests:') || line.includes('Time:'));
          if (summaryLines.length > 0) {
            console.log(`     📊 Jest Summary: ${summaryLines.join(' | ').trim()}`);
          }

          // Check if Jest matched 0 tests (neither passed nor failed tests present in summary)
          const testsLine = testOutput.split('\n').find(line => line.includes('Tests:'));
          const matchedZero = !testsLine || (!testsLine.includes('passed') && !testsLine.includes('failed'));

          if (matchedZero) {
            console.log(`     ⚠️ WARNING: Jest matched 0 tests! Treating as verification failure.`);
            testPassed = false;
          }

          if (testPassed) {
            console.log(`     ✅ SUCCESS: Patch successfully repaired this bug!`);
            fs.unlinkSync(tempBackupPath); // Discard backup, keep fix
            isRepaired = true;
            successCount++;
            break;
          } else {
            console.log(`     ❌ FAIL: Patch applied, but targeted test failed.`);
            // Revert changes immediately
            fs.copyFileSync(tempBackupPath, absPath);
            fs.unlinkSync(tempBackupPath);
            attemptHistory.push({ search, replace, testOutput });
          }
        } catch (err) {
          console.log(`     ❌ ERROR applying patch: ${err.message}`);
          // Revert changes immediately
          if (fs.existsSync(tempBackupPath)) {
            fs.copyFileSync(tempBackupPath, absPath);
            fs.unlinkSync(tempBackupPath);
          }
          attemptHistory.push({ search, replace, testOutput: err.message });
        }
      }

      if (!isRepaired) {
        console.log(`     ❌ Failed to repair ${relPath} after ${MAX_ATTEMPTS} attempts.`);
        failCount++;
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  REPAIR SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Repaired successfully : ${successCount}`);
  console.log(`  Failed to repair      : ${failCount}`);
  console.log('');
  if (failCount === 0 && successCount > 0) {
    console.log('  🎉 All detected failures successfully resolved! 100% success rate.');
  } else {
    console.log('  ⚠️ Some failures could not be resolved by the agent.');
  }
  console.log('═══════════════════════════════════════════════════════\n');
}

debugAndRepair().catch(err => {
  console.error('Unhandled error in debugging loop:', err);
  process.exit(1);
});
