const express = require('express');
const router = express.Router();
const GitHubImport = require('../models/GitHubImport');
const {
  validateGitHubUrl,
  runFullImport,
  runImportRepair,
  cleanupImport,
} = require('../services/githubService');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/github/validate — Quick URL validation without cloning
// ─────────────────────────────────────────────────────────────────────────────
router.post('/validate', async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl) return res.status(400).json({ error: 'repoUrl is required' });
    const result = await validateGitHubUrl(repoUrl);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/github/import — Full import pipeline: validate → clone → detect → install → analyze
// ─────────────────────────────────────────────────────────────────────────────
router.post('/import', async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl) return res.status(400).json({ error: 'repoUrl is required' });

    const importDoc = await runFullImport(repoUrl);
    res.json({ success: true, import: importDoc });
  } catch (err) {
    console.error('[GitHub Import] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/github/imports — List all imports
// ─────────────────────────────────────────────────────────────────────────────
router.get('/imports', async (req, res) => {
  try {
    const imports = await GitHubImport.find()
      .sort({ createdAt: -1 })
      .select('-failures.fileSuspects.fullContent'); // exclude large content from listing
    res.json({ imports });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/github/imports/:id — Get single import detail
// ─────────────────────────────────────────────────────────────────────────────
router.get('/imports/:id', async (req, res) => {
  try {
    const importDoc = await GitHubImport.findById(req.params.id).populate('repairs');
    if (!importDoc) return res.status(404).json({ error: 'Import not found' });
    res.json({ import: importDoc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/github/imports/:id/repair — Run AI repair on a failure
// ─────────────────────────────────────────────────────────────────────────────
router.post('/imports/:id/repair', async (req, res) => {
  try {
    const { failureId } = req.body;
    if (!failureId) return res.status(400).json({ error: 'failureId is required' });

    const importDoc = await GitHubImport.findById(req.params.id);
    if (!importDoc) return res.status(404).json({ error: 'Import not found' });
    if (importDoc.status !== 'READY') {
      return res.status(400).json({ error: `Import is not ready (status: ${importDoc.status})` });
    }

    importDoc.status = 'REPAIRING';
    await importDoc.save();

    try {
      const result = await runImportRepair(importDoc, failureId);
      importDoc.status = 'READY';
      await importDoc.save();
      res.json({ success: true, result });
    } catch (repairErr) {
      importDoc.status = 'READY';
      await importDoc.save();
      throw repairErr;
    }
  } catch (err) {
    console.error('[GitHub Repair] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/github/imports/:id — Cleanup and delete import
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/imports/:id', async (req, res) => {
  try {
    const importDoc = await GitHubImport.findById(req.params.id);
    if (!importDoc) return res.status(404).json({ error: 'Import not found' });

    // Clean up filesystem
    if (importDoc.workspacePath) {
      cleanupImport(importDoc.workspacePath);
    }

    importDoc.status = 'CLEANED';
    importDoc.workspacePath = '';
    await importDoc.save();

    res.json({ success: true, message: 'Import cleaned up' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
