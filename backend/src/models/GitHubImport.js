const mongoose = require('mongoose');

const projectInfoSchema = new mongoose.Schema({
  hasPackageJson: { type: Boolean, default: false },
  framework: { type: String, default: 'unknown' },
  testFramework: { type: String, default: 'unknown' },
  entryPoint: { type: String, default: '' },
  dependencies: { type: [String], default: [] },
  srcFiles: { type: Number, default: 0 },
  testFiles: { type: Number, default: 0 },
}, { _id: false });

const githubImportSchema = new mongoose.Schema({
  repoUrl: { type: String, required: true },
  owner: { type: String, required: true },
  repo: { type: String, required: true },
  workspacePath: { type: String, default: '' },
  status: {
    type: String,
    enum: ['CLONING', 'DETECTING', 'INSTALLING', 'ANALYZING', 'READY', 'REPAIRING', 'FAILED', 'CLEANED'],
    default: 'CLONING',
  },
  projectInfo: { type: projectInfoSchema, default: () => ({}) },
  failures: { type: [mongoose.Schema.Types.Mixed], default: [] },
  repairs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RepairHistory' }],
  error: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('GitHubImport', githubImportSchema);
