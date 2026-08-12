#!/usr/bin/env node
/**
 * agent.js — Phase 5: AI Debugging Agent
 *
 * Requirements implemented:
 * - Integration with @google/genai SDK
 * - Uses gemini-3.5-flash
 * - Structured outputs (rootCause, affectedFile, affectedLine, explanation, patch)
 * - Temporary non-destructive workspace testing (via backend_temp + node_modules junction)
 * - Detailed logging: BROKEN API -> FAILURE DETECTED -> GEMINI ANALYSIS -> ROOT CAUSE -> PATCH -> PATCH APPLIED TO COPY -> TESTS -> FIX VERIFIED
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { GoogleGenAI, Type } = require('@google/genai');

require('dotenv').config();

const ROOT = path.resolve(__dirname, '..');
const REPORT_IN = path.join(ROOT, 'logs', 'code-locations.json');
const FAILURE_REPORT = path.join(ROOT, 'logs', 'failure-report.json');
const TEMP_WORKSPACE = path.join(ROOT, 'backend_temp');

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    shell: true,
    ...options
  });
}

function cleanTempWorkspace() {
  if (!fs.existsSync(TEMP_WORKSPACE)) return;
  // On Windows, `cmd /c rmdir /s /q` is the only reliable way to delete junction directories.
  if (process.platform === 'win32') {
    spawnSync('cmd', ['/c', 'rmdir', '/s', '/q', TEMP_WORKSPACE], { shell: false });
  } else {
    try { fs.rmSync(TEMP_WORKSPACE, { recursive: true, force: true }); } catch (_) {}
  }
}

function prepareTempWorkspace() {
  cleanTempWorkspace();
  fs.mkdirSync(TEMP_WORKSPACE, { recursive: true });

  const itemsToCopy = ['src', 'tests', 'package.json', 'jest.config.js'];
  for (const item of itemsToCopy) {
    const srcPath = path.join(ROOT, item);
    const destPath = path.join(TEMP_WORKSPACE, item);
    if (fs.existsSync(srcPath)) {
      if (fs.statSync(srcPath).isDirectory()) {
        fs.cpSync(srcPath, destPath, { recursive: true });
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // Create junction for node_modules
  const nmSrc = path.join(ROOT, 'node_modules');
  const nmDest = path.join(TEMP_WORKSPACE, 'node_modules');
  if (fs.existsSync(nmSrc)) {
    fs.symlinkSync(nmSrc, nmDest, 'junction');
  }
}

async function callGeminiAPI(apiKey, prompt, maxRetries = 3) {
  const ai = new GoogleGenAI({ apiKey });
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rootCause: { type: Type.STRING },
              affectedFile: { type: Type.STRING },
              affectedLine: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
              patch: {
                type: Type.OBJECT,
                properties: {
                  search: { type: Type.STRING },
                  replace: { type: Type.STRING }
                },
                required: ['search', 'replace']
              }
            },
            required: ['rootCause', 'affectedFile', 'affectedLine', 'explanation', 'patch']
          }
        }
      });
      return JSON.parse(response.text);
    } catch (err) {
      lastError = err;
      const msg = err.message || '';
      if (msg.includes('429') && attempt < maxRetries) {
        const match = msg.match(/retry in ([\\.\\d]+)s/i);
        const waitSecs = match ? Math.min(Math.ceil(parseFloat(match[1])) + 2, 65) : 30;
        console.log(`     [GEMINI] Rate limited. Waiting ${waitSecs}s before retry (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, waitSecs * 1000));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function debugAndRepair() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  RepairAI — Phase 5: AI Debugging Agent              ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ ERROR: GEMINI_API_KEY environment variable is not set.');
    process.exit(1);
  }

  if (!fs.existsSync(REPORT_IN)) {
    console.error(`❌ ERROR: ${REPORT_IN} not found. Please run the pipeline first.`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(REPORT_IN, 'utf8'));
  const locations = data.locations || [];

  if (locations.length === 0) {
    console.log('🎉 No failures detected.');
    return;
  }

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
    console.log(`\nBROKEN API -> FAILURE DETECTED: [${loc.failureId}]`);
    console.log(`   Test Name: "${loc.testName}"`);
    console.log(`   Error: ${loc.error?.message?.split('\n')?.[0]}`);

    const testFile = failureToTestFileMap[loc.failureId] || '';
    let isRepaired = false;

    for (const suspect of loc.fileSuspects) {
      if (isRepaired) break;

      const relPath = suspect.file.replace(/\\/g, '/');
      const absPath = path.join(ROOT, relPath);
      if (!fs.existsSync(absPath)) {
        continue;
      }

      console.log(`   📂 Analysing suspect file: ${relPath}`);

      const attemptHistory = [];
      const MAX_ATTEMPTS = 3;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        console.log(`     🔄 Attempt ${attempt}/${MAX_ATTEMPTS} for ${relPath}...`);
        
        // Ensure temporary workspace is completely clean for every attempt
        prepareTempWorkspace();

        const tempFilePath = path.join(TEMP_WORKSPACE, relPath);
        const originalContent = fs.readFileSync(tempFilePath, 'utf8');

        let search = '';
        let replace = '';
        let rootCause = '';
        let explanation = '';

        const findingsSummary = (suspect.findings || [])
          .filter(f => f.confidence === 'HIGH')
          .map(f => `- Line ${f.line}: [${f.strategy}] ${f.reason}`)
          .join('\n');

        let prompt = `You are an AI Debugging Agent fixing a broken Node.js API.
Target File: ${relPath}

=== Test Failure Context ===
Test Name: ${loc.testName}
Error Message: ${loc.error?.message}
Stack Trace:
${loc.error?.fullStack}

=== Code Search Findings ===
${findingsSummary || '(no specific line flagged)'}

=== Target File Source Code ===
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
- Test Output:
${h.testOutput}
\n`;
          });
          prompt += `Analyze the previous failures and provide a corrected patch.\n`;
        }

        prompt += `Identify the root cause of the failure and output a valid JSON response matching the required schema. Ensure the 'search' block exactly matches the substring in the source file, and 'replace' fixes it.`;

        try {
          console.log(`     🧠 GEMINI ANALYSIS (querying gemini-3.5-flash)...`);
          const parsed = await callGeminiAPI(apiKey, prompt);
          search = parsed.patch.search;
          replace = parsed.patch.replace;
          rootCause = parsed.rootCause;
          explanation = parsed.explanation;

          console.log(`     💡 ROOT CAUSE: ${rootCause}`);
          console.log(`     📝 EXPLANATION: ${explanation}`);
          console.log(`     🔧 PATCH GENERATED`);
        } catch (err) {
          console.error(`     ❌ API call failed: ${err.message}`);
          attemptHistory.push({
            search: '(none)',
            replace: '(none)',
            testOutput: `API Error: ${err.message}`
          });
          continue;
        }

        try {
          // Apply patch to the temp workspace copy
          const normalizedContent = originalContent.replace(/\r\n/g, '\n');
          const normalizedSearch = search.replace(/\r\n/g, '\n');
          const normalizedReplace = replace.replace(/\r\n/g, '\n');

          if (!normalizedContent.includes(normalizedSearch)) {
             throw new Error('Search block not found in source file.');
          }

          const patchedContent = normalizedContent.replace(normalizedSearch, normalizedReplace);
          fs.writeFileSync(tempFilePath, patchedContent, 'utf8');
          console.log(`     📂 PATCH APPLIED TO COPY (${relPath})`);

          // Run targeted Jest test inside the temp workspace
          const testNamePattern = loc.testName.replace(/[^a-zA-Z0-9]/g, '.*');
          console.log(`     🧪 TESTS: Running npx jest ${testFile} -t "${testNamePattern}" in temporary copy...`);
          
          const testResult = runCommand('npx', ['jest', testFile, '-t', `"${testNamePattern}"`, '--forceExit'], { cwd: TEMP_WORKSPACE });

          const testOutput = (testResult.stdout || '') + '\n' + (testResult.stderr || '');
          const testPassed = testResult.status === 0;

          const summaryLines = testOutput.split('\n')
            .filter(line => line.includes('Test Suites:') || line.includes('Tests:') || line.includes('Time:'));
          if (summaryLines.length > 0) {
            console.log(`     📊 Jest Summary: ${summaryLines.join(' | ').trim()}`);
          }

          const testsLine = testOutput.split('\n').find(line => line.includes('Tests:'));
          const matchedZero = !testsLine || (!testsLine.includes('passed') && !testsLine.includes('failed'));
          if (matchedZero) {
            console.log(`     ⚠️ WARNING: Jest matched 0 tests! Treating as verification failure.`);
          }

          if (testPassed && !matchedZero) {
            console.log(`     ✅ FIX VERIFIED`);
            isRepaired = true;
            successCount++;
            break;
          } else {
            console.log(`     ❌ TESTS FAILED on Attempt ${attempt}`);
            attemptHistory.push({ search, replace, testOutput });
          }
        } catch (err) {
          console.log(`     ❌ ERROR applying patch: ${err.message}`);
          attemptHistory.push({ search, replace, testOutput: err.message });
        }
      }
    }

    if (!isRepaired) {
      console.log(`   ❌ REPAIR_FAILED for [${loc.failureId}] after 3 attempts.`);
      failCount++;
    }

    if (isRepaired) {
       console.log('\n[INFO] Stopped after successfully demonstrating one real Gemini-powered repair.');
       break;
    }
  }

  // Cleanup temp workspace
  cleanTempWorkspace();

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  REPAIR SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  FIX_VERIFIED : ${successCount}`);
  console.log(`  REPAIR_FAILED: ${failCount}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

debugAndRepair().catch(err => {
  console.error('Unhandled error in debugging loop:', err);
  process.exit(1);
});
