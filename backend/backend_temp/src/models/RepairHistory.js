const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  attemptNumber: { type: Number, required: true },
  search: { type: String, required: true },
  replace: { type: String, required: true },
  testOutput: { type: String, required: true }
}, { _id: false });

const repairHistorySchema = new mongoose.Schema({
  failureId: { type: String, required: true },
  testName: { type: String, required: true },
  errorMsg: { type: String, required: true },
  fileSuspects: { type: [String], required: true },
  rootCause: { type: String },
  explanation: { type: String },
  attempts: [attemptSchema],
  status: { type: String, enum: ['PENDING', 'FIX_VERIFIED', 'REPAIR_FAILED'], default: 'PENDING' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RepairHistory', repairHistorySchema);
