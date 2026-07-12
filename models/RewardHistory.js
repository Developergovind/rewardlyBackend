const mongoose = require('mongoose');

const rewardHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rewardType: {
      type: String,
      required: true,
      enum: ['daily_winner', 'monthly_winner', 'referral_bonus', 'game_play'],
    },
    amount: { type: Number, required: true },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RewardHistory', rewardHistorySchema);
