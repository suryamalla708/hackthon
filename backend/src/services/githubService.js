const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk');
const GitHubImport = require('../models/GitHubImport');
const RepairHistory = require('../models/RepairHistory');

const ROOT = path.resolve(__dirname, '../../..');
const IMPORTS_DIR = path.join(ROOT, 'backend', 'github_imports');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    shell: true,
    timeout: 180000, // 3 min default
    ...options,
  });
}

function countFiles(dir, ext, depth = 0) {
  if (depth > 6 || !fs.existsSync(dir)) return 0;
  let count = 0;
  try {
    for (const entry of fs.readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.git') continue;
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) count += countFiles(full, ext, depth + 1);
      else if (entry.endsWith(ext)) count++;
    }
  } catch { /* ignore permission errors */ }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Validate GitHub URL
// ─────────────────────────────────────────────────────────────────────────────

async function validateGitHubUrl(url) {
  // Accepted formats:
  //   https://github.com/owner/repo
  //   https://github.com/owner/repo.git
  //   github.com/owner/repo
  const pattern = /^(?:https?:\/\/)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/;
  const match = url.trim().match(pattern);
  if (!match) {
    return { valid: false, error: 'Invalid GitHub URL. Expected format: https://github.com/owner/repo' };
  }

  const owner = match[1];
  const repo = match[2];

  // Check if repo exists via GitHub public API
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { 'User-Agent': 'RepairAI-Agent' },
    });
    if (response.status === 404) {
      return { valid: false, error: `Repository ${owner}/${repo} not found. Make sure it is public.` };
    }
    if (!response.ok) {
      return { valid: false, error: `GitHub API returned status ${response.status}` };
    }
    const data = await response.json();
    return {
      valid: true,
      owner,
      repo,
      description: data.description || '',
      stars: data.stargazers_count || 0,
      language: data.language || 'Unknown',
      defaultBranch: data.default_branch || 'main',
    };
  } catch (err) {
    // If fetch fails (no internet, etc.), still allow the clone attempt
    return { valid: true, owner, repo, description: '', stars: 0, language: 'Unknown', defaultBranch: 'main' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Clone Repository
// ─────────────────────────────────────────────────────────────────────────────

function cloneRepo(repoUrl, owner, repo) {
  if (!fs.existsSync(IMPORTS_DIR)) {
    fs.mkdirSync(IMPORTS_DIR, { recursive: true });
  }

  const dirName = `${owner}-${repo}-${Date.now()}`;
  const targetDir = path.join(IMPORTS_DIR, dirName);

  const normalizedUrl = repoUrl.trim().startsWith('http')
    ? repoUrl.trim()
    : `https://${repoUrl.trim()}`;

  const result = runCommand('git', ['clone', '--depth', '1', normalizedUrl, `"${targetDir}"`], {
    timeout: 120000, // 2 min for clone
  });

  if (result.status !== 0) {
    const errMsg = (result.stderr || '').trim();
    throw new Error(`Git clone failed: ${errMsg || 'Unknown error'}`);
  }

  if (!fs.existsSync(targetDir)) {
    throw new Error('Clone succeeded but target directory not found');
  }

  return targetDir;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Detect Project Structure
// ─────────────────────────────────────────────────────────────────────────────

function detectProject(workspacePath) {
  const info = {
    hasPackageJson: false,
    framework: 'unknown',
    testFramework: 'unknown',
    entryPoint: '',
    dependencies: [],
    srcFiles: 0,
    testFiles: 0,
  };

  const pkgPath = path.join(workspacePath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return info;
  }

  info.hasPackageJson = true;
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return info;
  }

  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  info.dependencies = Object.keys(allDeps).slice(0, 30);

  // Detect framework
  if (allDeps.express) info.framework = 'express';
  else if (allDeps.fastify) info.framework = 'fastify';
  else if (allDeps.koa) info.framework = 'koa';
  else if (allDeps.hapi || allDeps['@hapi/hapi']) info.framework = 'hapi';
  else if (allDeps.next) info.framework = 'next';
  else info.framework = 'node';

  // Detect test framework
  if (allDeps.jest) info.testFramework = 'jest';
  else if (allDeps.mocha) info.testFramework = 'mocha';
  else if (allDeps.vitest) info.testFramework = 'vitest';
  else if (allDeps.ava) info.testFramework = 'ava';
  else if (allDeps.tap) info.testFramework = 'tap';

  // Detect entry point
  if (pkg.main) info.entryPoint = pkg.main;
  else if (fs.existsSync(path.join(workspacePath, 'src', 'server.js'))) info.entryPoint = 'src/server.js';
  else if (fs.existsSync(path.join(workspacePath, 'src', 'app.js'))) info.entryPoint = 'src/app.js';
  else if (fs.existsSync(path.join(workspacePath, 'index.js'))) info.entryPoint = 'index.js';
  else if (fs.existsSync(path.join(workspacePath, 'server.js'))) info.entryPoint = 'server.js';
  else if (fs.existsSync(path.join(workspacePath, 'app.js'))) info.entryPoint = 'app.js';

  // Count files
  info.srcFiles = countFiles(path.join(workspacePath, 'src'), '.js')
    + countFiles(path.join(workspacePath, 'lib'), '.js');
  info.testFiles = countFiles(path.join(workspacePath, 'tests'), '.js')
    + countFiles(path.join(workspacePath, 'test'), '.js')
    + countFiles(path.join(workspacePath, '__tests__'), '.js');

  return info;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Install Dependencies
// ─────────────────────────────────────────────────────────────────────────────

function installDeps(workspacePath) {
  const result = runCommand('npm', ['install', '--no-audit', '--no-fund'], {
    cwd: workspacePath,
    timeout: 180000, // 3 min
    env: { ...process.env, NODE_ENV: 'development' },
  });

  if (result.status !== 0) {
    const errLines = (result.stderr || '').split('\n').filter(l => l.includes('ERR!')).slice(0, 5);
    throw new Error(`npm install failed: ${errLines.join(' | ') || result.stderr?.slice(0, 200) || 'Unknown error'}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Run Analysis Pipeline (Jest + Code Search)
// ─────────────────────────────────────────────────────────────────────────────

function runAnalysisPipeline(workspacePath, testFramework) {
  const logsDir = path.join(workspacePath, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // ── Step 1: Run tests and capture output ─────────────────────
  let testResult;
  const jestResultsPath = path.join(logsDir, 'jest-results.json');

  if (testFramework === 'jest') {
    testResult = runCommand('npx', [
      'jest', '--forceExit', '--detectOpenHandles', '--verbose',
      '--json', `--outputFile=${jestResultsPath}`,
    ], {
      cwd: workspacePath,
      timeout: 120000, // 2 min
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });
  } else if (testFramework === 'vitest') {
    testResult = runCommand('npx', ['vitest', 'run', '--reporter=json'], {
      cwd: workspacePath,
      timeout: 120000,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });
  } else if (testFramework === 'mocha') {
    testResult = runCommand('npx', ['mocha', '--recursive', '--reporter', 'json'], {
      cwd: workspacePath,
      timeout: 120000,
    });
  } else {
    // Try running npm test and capture output
    testResult = runCommand('npm', ['test', '--', '--forceExit'], {
      cwd: workspacePath,
      timeout: 120000,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });
  }

  const stdout = testResult.stdout || '';
  const stderr = testResult.stderr || '';
  const combinedOutput = stdout + '\n' + stderr;

  // Save raw output
  fs.writeFileSync(path.join(logsDir, 'test-stdout.log'), stdout);
  fs.writeFileSync(path.join(logsDir, 'test-stderr.log'), stderr);

  // ── Step 2: Parse failures ──────────────────────────────────
  const failures = [];

  // Try Jest JSON format first
  if (fs.existsSync(jestResultsPath)) {
    try {
      const jestData = JSON.parse(fs.readFileSync(jestResultsPath, 'utf8'));
      let failureIdx = 0;

      for (const testSuite of (jestData.testResults || [])) {
        const suiteName = (testSuite.name || '').replace(/\\/g, '/');
        const suiteRelPath = suiteName.includes('/') ? suiteName.split('/').slice(-2).join('/') : suiteName;
        const tests = testSuite.assertionResults || [];

        for (const test of tests) {
          if (test.status !== 'failed') continue;
          failureIdx++;

          const ancestorTitles = test.ancestorTitles || [];
          const rawError = (test.failureMessages || []).join('\n\n');
          const firstErrorLines = rawError.split('\n').slice(0, 8).join('\n').trim();

          // Extract source hints from stack traces
          const sourceHints = [];
          const stackLines = rawError.split('\n');
          for (const line of stackLines) {
            const match = line.match(/\(?((?:[A-Za-z]:)?[/\\].+?\.js):\d+:\d+\)?/);
            if (match) {
              const absPath = match[1].replace(/\\/g, '/');
              if (absPath.includes('node_modules')) continue;
              if (absPath.includes('/src/') || absPath.includes('/lib/')) {
                const srcIdx = absPath.indexOf('/src/');
                const libIdx = absPath.indexOf('/lib/');
                const idx = srcIdx !== -1 ? srcIdx : libIdx;
                const prefix = srcIdx !== -1 ? 'src' : 'lib';
                if (idx !== -1) sourceHints.push(prefix + absPath.slice(idx + (prefix.length + 1)));
              }
            }
          }

          // Extract endpoint hints
          const allText = [...ancestorTitles, test.title].join(' ');
          const endpointMatch = allText.match(/\b(GET|POST|PUT|DELETE|PATCH)\s+(\/[^\s,)>]+)/i);
          const endpoint = endpointMatch ? {
            method: endpointMatch[1].toUpperCase(),
            path: endpointMatch[2].replace(/\/$/, '') || '/',
          } : null;

          // Build suspect files from source hints
          const fileSuspects = [...new Set(sourceHints)].map(hint => {
            const absPath = path.join(workspacePath, hint);
            let fullContent = '';
            let totalLines = 0;
            if (fs.existsSync(absPath)) {
              fullContent = fs.readFileSync(absPath, 'utf8');
              totalLines = fullContent.split('\n').length;
            }
            return {
              file: hint,
              totalLines,
              fullContent,
              findings: [],
            };
          });

          failures.push({
            failureId: `failure-${String(failureIdx).padStart(3, '0')}`,
            testFile: suiteRelPath,
            describeBlock: ancestorTitles.join(' > '),
            testName: test.title,
            fullTitle: [...ancestorTitles, test.title].join(' > '),
            status: 'failed',
            error: {
              type: rawError.match(/^\s*(\w+Error):/m)?.[1] || 'AssertionError',
              message: firstErrorLines,
              fullStack: rawError,
            },
            endpoint,
            sourceHints: [...new Set(sourceHints)],
            fileSuspects,
          });
        }
      }
    } catch (e) {
      console.error('[GitHub Import] Failed to parse Jest results:', e.message);
    }
  }

  // Fallback: parse raw output for error patterns if no Jest JSON
  if (failures.length === 0 && testResult.status !== 0) {
    const errorLines = combinedOutput.split('\n').filter(l =>
      l.includes('FAIL') || l.includes('Error:') || l.includes('AssertionError')
    ).slice(0, 10);

    if (errorLines.length > 0) {
      failures.push({
        failureId: 'failure-001',
        testFile: 'unknown',
        describeBlock: 'Test Suite',
        testName: 'Test run failed',
        fullTitle: 'Test Suite > Test run failed',
        status: 'failed',
        error: {
          type: 'TestRunError',
          message: errorLines.join('\n'),
          fullStack: combinedOutput.slice(0, 3000),
        },
        endpoint: null,
        sourceHints: [],
        fileSuspects: [],
      });
    }
  }

  // ── Step 3: Run code search on suspect files ─────────────────
  for (const failure of failures) {
    for (const suspect of failure.fileSuspects) {
      const absPath = path.join(workspacePath, suspect.file);
      if (!fs.existsSync(absPath)) continue;
      const content = fs.readFileSync(absPath, 'utf8');
      const lines = content.split('\n');

      const findings = [];

      // Strategy: missing await
      const DB_METHODS = ['save', 'find', 'findById', 'findOne', 'findByIdAndUpdate', 'findByIdAndDelete',
        'create', 'insertMany', 'deleteMany', 'updateMany', 'countDocuments'];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('//') || line.startsWith('*')) continue;
        for (const method of DB_METHODS) {
          if (new RegExp(`\\.${method}\\s*\\(`).test(line) && !/\bawait\b/.test(line.split('//')[0])) {
            if (/require|import/.test(line)) continue;
            findings.push({
              strategy: 'missing_await', confidence: 'HIGH', line: i + 1,
              lineContent: lines[i].trimEnd(),
              reason: `'.${method}()' called without 'await'`,
            });
          }
        }
      }

      // Strategy: wrong field access
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const assignMatch = raw.match(/(\w+)\s*:\s*req\.body\.(\w+)/);
        if (assignMatch && assignMatch[1].toLowerCase() !== assignMatch[2].toLowerCase()) {
          findings.push({
            strategy: 'wrong_field_access', confidence: 'HIGH', line: i + 1,
            lineContent: raw.trimEnd(),
            reason: `Mismatch: assigns '${assignMatch[1]}' from req.body.${assignMatch[2]}`,
          });
        }
      }

      // Strategy: division by zero
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        if (/[^\s/]\/\s*0(?!\.)/.test(raw)) {
          findings.push({
            strategy: 'division_by_zero', confidence: 'HIGH', line: i + 1,
            lineContent: raw.trimEnd(),
            reason: 'Literal division by zero produces Infinity',
          });
        }
      }

      // Strategy: error handler arity (middleware files)
      if (suspect.file.includes('middleware')) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          const match = line.match(/function\s+(\w+)\s*\(\s*(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*\)/);
          if (match) {
            const params = [match[2], match[3], match[4]];
            if (params.includes('req') && params.includes('res') && params.includes('next')) {
              findings.push({
                strategy: 'error_handler_arity', confidence: 'HIGH', line: i + 1,
                lineContent: lines[i].trimEnd(),
                reason: `'${match[1]}' has 3 params — Express error handlers need 4: (err, req, res, next)`,
              });
            }
          }
        }
      }

      suspect.findings = findings;
    }
  }

  // Save the analysis results
  const codeLocations = {
    generatedAt: new Date().toISOString(),
    totalFailures: failures.length,
    locations: failures.map(f => ({
      failureId: f.failureId,
      endpoint: f.endpoint,
      testName: f.fullTitle,
      error: f.error,
      fileSuspects: f.fileSuspects,
    })),
  };
  fs.writeFileSync(path.join(logsDir, 'code-locations.json'), JSON.stringify(codeLocations, null, 2));

  return failures;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Run Repair on an Imported Repo
// ─────────────────────────────────────────────────────────────────────────────

async function runImportRepair(importDoc, failureId) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set. Cannot run repair.');
  }
  const workspacePath = importDoc.workspacePath;
  const codeLocPath = path.join(workspacePath, 'logs', 'code-locations.json');

  if (!fs.existsSync(codeLocPath)) {
    throw new Error('Code locations not found. Re-run the analysis pipeline.');
  }

  const data = JSON.parse(fs.readFileSync(codeLocPath, 'utf8'));
  const loc = (data.locations || []).find(l => l.failureId === failureId);
  if (!loc) throw new Error(`Failure ID ${failureId} not found.`);

  const errorMsg = loc.error?.message?.split('\n')?.[0] || 'Unknown Error';

  // Create repair history record
  const historyRecord = new RepairHistory({
    failureId,
    testName: loc.testName,
    errorMsg,
    fileSuspects: loc.fileSuspects.map(s => s.file),
  });
  await historyRecord.save();

  let isRepaired = false;

  for (const suspect of loc.fileSuspects) {
    if (isRepaired) break;

    const relPath = suspect.file.replace(/\\/g, '/');
    const absPath = path.join(workspacePath, relPath);
    if (!fs.existsSync(absPath)) continue;

    const MAX_ATTEMPTS = 3;
    const attemptHistory = [];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const originalContent = fs.readFileSync(absPath, 'utf8');
      // Create backup
      fs.writeFileSync(absPath + '.bak', originalContent, 'utf8');

      let search = '', replace = '', rootCause = '', explanation = '';
      let attemptData = { attemptNumber: attempt, search: '', replace: '', testOutput: '' };

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

      prompt += `Identify the root cause and output valid JSON with: rootCause, affectedFile, affectedLine, explanation, patch: { search, replace }. Ensure 'search' exactly matches a substring in the source.`;

      try {
        const anthropic = new Anthropic({ apiKey });
        const systemPrompt = "You are an AI Debugging Agent fixing a broken Node.js API. Output ONLY valid JSON matching the exact schema requested, with no markdown formatting or extra text.";

        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          temperature: 0.1,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }]
        });
        
        let text = response.content[0].text.trim();
        if (text.startsWith('```json')) {
          text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (text.startsWith('```')) {
          text = text.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        const parsed = JSON.parse(text);
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
        fs.writeFileSync(absPath, patchedContent, 'utf8');

        // Run tests
        const testNamePattern = loc.testName.replace(/[^a-zA-Z0-9]/g, '.*');
        const testResult = runCommand('npx', ['jest', '-t', `"${testNamePattern}"`, '--forceExit'], {
          cwd: workspacePath,
          timeout: 60000,
        });

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
          break;
        } else {
          // Revert
          fs.writeFileSync(absPath, originalContent, 'utf8');
        }
      } catch (err) {
        // Revert on error
        if (fs.existsSync(absPath + '.bak')) {
          fs.copyFileSync(absPath + '.bak', absPath);
        }
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

  historyRecord.status = isRepaired ? 'FIX_VERIFIED' : 'REPAIR_FAILED';
  await historyRecord.save();

  // Link the repair to the import
  importDoc.repairs.push(historyRecord._id);
  await importDoc.save();

  return historyRecord;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Cleanup Import
// ─────────────────────────────────────────────────────────────────────────────

function cleanupImport(workspacePath) {
  if (!workspacePath || !workspacePath.includes('github_imports')) {
    throw new Error('Invalid workspace path — refusing to delete for safety.');
  }
  if (!fs.existsSync(workspacePath)) return;

  if (process.platform === 'win32') {
    spawnSync('powershell', [
      '-NoProfile', '-Command',
      `Remove-Item -Path '${workspacePath}' -Recurse -Force -ErrorAction SilentlyContinue`,
    ], { shell: false });
  } else {
    try { fs.rmSync(workspacePath, { recursive: true, force: true }); } catch (_) {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Import Pipeline (orchestrates all steps)
// ─────────────────────────────────────────────────────────────────────────────

async function runFullImport(repoUrl) {
  // 1. Validate
  const validation = await validateGitHubUrl(repoUrl);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Create DB record
  const importDoc = new GitHubImport({
    repoUrl: repoUrl.trim(),
    owner: validation.owner,
    repo: validation.repo,
    status: 'CLONING',
  });
  await importDoc.save();

  try {
    // 3. Clone
    const workspacePath = cloneRepo(repoUrl, validation.owner, validation.repo);
    importDoc.workspacePath = workspacePath;
    await importDoc.save();

    // 4. Detect
    importDoc.status = 'DETECTING';
    await importDoc.save();
    const projectInfo = detectProject(workspacePath);
    importDoc.projectInfo = projectInfo;
    await importDoc.save();

    if (!projectInfo.hasPackageJson) {
      importDoc.status = 'FAILED';
      importDoc.error = 'No package.json found. This does not appear to be a Node.js project.';
      await importDoc.save();
      return importDoc;
    }

    // 5. Install
    importDoc.status = 'INSTALLING';
    await importDoc.save();
    installDeps(workspacePath);

    // 6. Analyze
    importDoc.status = 'ANALYZING';
    await importDoc.save();

    if (projectInfo.testFramework === 'unknown') {
      importDoc.status = 'READY';
      importDoc.error = 'No recognized test framework found (jest, mocha, vitest). Cannot run analysis.';
      await importDoc.save();
      return importDoc;
    }

    const failures = runAnalysisPipeline(workspacePath, projectInfo.testFramework);
    importDoc.failures = failures;
    importDoc.status = 'READY';
    await importDoc.save();

    return importDoc;
  } catch (err) {
    importDoc.status = 'FAILED';
    importDoc.error = err.message;
    await importDoc.save();
    return importDoc;
  }
}

module.exports = {
  validateGitHubUrl,
  cloneRepo,
  detectProject,
  installDeps,
  runAnalysisPipeline,
  runImportRepair,
  cleanupImport,
  runFullImport,
};
