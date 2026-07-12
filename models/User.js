const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    profilePic: { type: String, default: '' },
    deviceToken: { type: String, default: null },
    todayGamePoints: { type: Number, default: 0 },
    monthGamePoints: { type: Number, default: 0 },
    leftGame: { type: Number, default: 5 },
    referCode: { type: String, required: true, unique: true, index: true },
    referredBy: { type: String, default: null },
    referCount: { type: Number, default: 0 },
    referAmount: { type: Number, default: 0 },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
