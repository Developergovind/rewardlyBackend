const mongoose = require('mongoose');

const gameHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pointsEarned: { type: Number, required: true, min: 0 },
    playedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

module.exports = mongoose.model('GameHistory', gameHistorySchema);
