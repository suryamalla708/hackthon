const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const RepairHistory = require('../models/RepairHistory');
const { runRepair } = require('../services/repairService');

const ROOT = path.resolve(__dirname, '../../..');
const REPORT_IN = path.join(ROOT, 'backend', 'logs', 'code-locations.json');

// Get active failures from logs
router.get('/failures', (req, res) => {
  try {
    if (!fs.existsSync(REPORT_IN)) {
      return res.json({ failures: [] });
    }
    const data = JSON.parse(fs.readFileSync(REPORT_IN, 'utf8'));
    res.json({ failures: data.locations || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get repair history from MongoDB
router.get('/history', async (req, res) => {
  try {
    const history = await RepairHistory.find().sort({ createdAt: -1 });
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run a repair job
router.post('/run', async (req, res) => {
  try {
    const { failureId } = req.body;
    if (!failureId) return res.status(400).json({ error: 'failureId required' });
    
    // We await the entire flow. Express usually times out after 2 minutes, 
    // but the repair shouldn't take longer than 30s-1m.
    const result = await runRepair(failureId);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Repair failed:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
