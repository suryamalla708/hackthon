const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk');
const RepairHistory = require('../models/RepairHistory');

const ROOT = path.resolve(__dirname, '../../..');
const TEMP_WORKSPACE = path.join(ROOT, 'backend', 'backend_temp');
const REPORT_IN = path.join(ROOT, 'backend', 'logs', 'code-locations.json');
const FAILURE_REPORT = path.join(ROOT, 'backend', 'logs', 'failure-report.json');

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    shell: true,
    ...options
  });
}

function cleanTempWorkspace() {
  if (!fs.existsSync(TEMP_WORKSPACE)) return;
  // PowerShell Remove-Item -Recurse -Force removes junction reparse points
  // without following them into their targets (unlike cmd rmdir /s /q or fs.rmSync).
  if (process.platform === 'win32') {
    spawnSync(
      'powershell',
      ['-NoProfile', '-Command', `Remove-Item -Path '${TEMP_WORKSPACE}' -Recurse -Force -ErrorAction SilentlyContinue`],
      { shell: false }
    );
  } else {
    try { fs.rmSync(TEMP_WORKSPACE, { recursive: true, force: true }); } catch (_) {}
  }
}

function prepareTempWorkspace() {
  cleanTempWorkspace();
  fs.mkdirSync(TEMP_WORKSPACE, { recursive: true });

  const backendDir = path.join(ROOT, 'backend');
  const itemsToCopy = ['src', 'tests', 'package.json', 'jest.config.js'];
  for (const item of itemsToCopy) {
    const srcPath = path.join(backendDir, item);
    const destPath = path.join(TEMP_WORKSPACE, item);
    if (fs.existsSync(srcPath)) {
      if (fs.statSync(srcPath).isDirectory()) {
        fs.cpSync(srcPath, destPath, { recursive: true });
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // Create junction for node_modules (fast, no copy needed)
  const nmSrc = path.join(backendDir, 'node_modules');
  const nmDest = path.join(TEMP_WORKSPACE, 'node_modules');
  if (fs.existsSync(nmSrc)) {
    fs.symlinkSync(nmSrc, nmDest, 'junction');
  }
}

async function callClaudeAPI(apiKey, prompt, maxRetries = 3) {
  const anthropic = new Anthropic({ apiKey });
  let lastError;

  const systemPrompt = "You are an AI Debugging Agent fixing a broken Node.js API. Output ONLY valid JSON matching the exact schema requested, with no markdown formatting or extra text.";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      });
      
      let text = response.content[0].text.trim();
      // Sometimes Claude wraps in ```json ... ``` despite instructions
      if (text.startsWith('```json')) {
        text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (text.startsWith('```')) {
        text = text.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      return JSON.parse(text);
    } catch (err) {
      lastError = err;
      const msg = err.message || '';
      if ((msg.includes('429') || msg.includes('rate_limit')) && attempt < maxRetries) {
        const waitSecs = 30;
        console.log(`[CLAUDE] Rate limited. Waiting ${waitSecs}s before retry (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, waitSecs * 1000));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

exports.runRepair = async function(failureId) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set.');
  }

  if (!fs.existsSync(REPORT_IN)) {
    throw new Error('Failure report not found. Run the test pipeline first.');
  }

  const data = JSON.parse(fs.readFileSync(REPORT_IN, 'utf8'));
  const loc = (data.locations || []).find(l => l.failureId === failureId);
  if (!loc) {
    throw new Error(`Failure ID ${failureId} not found in logs.`);
  }

  let failureToTestFileMap = {};
  if (fs.existsSync(FAILURE_REPORT)) {
    const reportData = JSON.parse(fs.readFileSync(FAILURE_REPORT, 'utf8'));
    for (const f of reportData.failures || []) {
      failureToTestFileMap[f.id] = f.testFile;
    }
  }
  const testFile = failureToTestFileMap[failureId] || '';
  const errorMsg = loc.error?.message?.split('\n')?.[0] || 'Unknown Error';
  
  const historyRecord = new RepairHistory({
    failureId,
    testName: loc.testName,
    errorMsg,
    fileSuspects: loc.fileSuspects.map(s => s.file)
  });
  await historyRecord.save();

  let isRepaired = false;

  for (const suspect of loc.fileSuspects) {
    if (isRepaired) break;

    const relPath = suspect.file.replace(/\\/g, '/');
    const absPath = path.join(ROOT, 'backend', relPath);
    if (!fs.existsSync(absPath)) continue;

    const attemptHistory = [];
    const MAX_ATTEMPTS = 3;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
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
          prompt += `Attempt ${idx + 1} Failed:\n- Search Block:\n${h.search}\n- Replace Block:\n${h.replace}\n- Test Output:\n${h.testOutput}\n\n`;
        });
        prompt += `Analyze the previous failures and provide a corrected patch.\n`;
      }

      prompt += `Identify the root cause of the failure and output a valid JSON response matching the required schema. Ensure the 'search' block exactly matches the substring in the source file, and 'replace' fixes it.`;

      let attemptData = { attemptNumber: attempt, search: '', replace: '', testOutput: '' };
      
      try {
        const parsed = await callClaudeAPI(apiKey, prompt);
        search = parsed.patch.search;
        replace = parsed.patch.replace;
        rootCause = parsed.rootCause;
        explanation = parsed.explanation;
        
        attemptData.search = search;
        attemptData.replace = replace;

        // Apply patch
        const normalizedContent = originalContent.replace(/\r\n/g, '\n');
        const normalizedSearch = search.replace(/\r\n/g, '\n');
        const normalizedReplace = replace.replace(/\r\n/g, '\n');

        if (!normalizedContent.includes(normalizedSearch)) {
           throw new Error('Search block not found in source file.');
        }

        const patchedContent = normalizedContent.replace(normalizedSearch, normalizedReplace);
        fs.writeFileSync(tempFilePath, patchedContent, 'utf8');

        // Test it
        const testNamePattern = loc.testName.replace(/[^a-zA-Z0-9]/g, '.*');
        const testResult = runCommand('npx', ['jest', testFile, '-t', `"${testNamePattern}"`, '--forceExit'], { cwd: TEMP_WORKSPACE });

        const testOutput = (testResult.stdout || '') + '\n' + (testResult.stderr || '');
        attemptData.testOutput = testOutput;
        const testPassed = testResult.status === 0;

        const testsLine = testOutput.split('\n').find(line => line.includes('Tests:'));
        const matchedZero = !testsLine || (!testsLine.includes('passed') && !testsLine.includes('failed'));
        
        attemptHistory.push(attemptData);
        historyRecord.attempts.push(attemptData);
        historyRecord.rootCause = rootCause;
        historyRecord.explanation = explanation;
        await historyRecord.save();

        if (testPassed && !matchedZero) {
          isRepaired = true;
          break; // Stop attempting!
        }
      } catch (err) {
        attemptData.testOutput = err.message;
        attemptData.search = search || '(none)';
        attemptData.replace = replace || '(none)';
        attemptHistory.push(attemptData);
        historyRecord.attempts.push(attemptData);
        await historyRecord.save();
      }
    }
    if (isRepaired) break;
  }

  cleanTempWorkspace();

  historyRecord.status = isRepaired ? 'FIX_VERIFIED' : 'REPAIR_FAILED';
  await historyRecord.save();

  return historyRecord;
};
