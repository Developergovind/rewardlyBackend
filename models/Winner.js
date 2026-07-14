const mongoose = require('mongoose');

const winnerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['daily', 'monthly'], required: true },
    rank: { type: Number, required: true, min: 1, max: 3 },
    prizeAmount: { type: Number, required: true },
    date: { type: Date, required: true, index: true },
    amazonCode: { type: String, default: null },
  },
  { timestamps: true }
);

winnerSchema.index({ type: 1, date: 1, rank: 1 });

module.exports = mongoose.model('Winner', winnerSchema);
