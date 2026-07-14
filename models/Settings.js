const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    alert: { type: Boolean, default: false },
    alertTitle: { type: String, default: '' },
    alertDescription: { type: String, default: '' },
    dailyFirstPrice: { type: Number, default: 50 },
    dailySecondPrice: { type: Number, default: 30 },
    dailyThirdPrice: { type: Number, default: 20 },
    monthlyFirstPrice: { type: Number, default: 500 },
    monthlySecondPrice: { type: Number, default: 300 },
    monthlyThirdPrice: { type: Number, default: 100 },
    referAmount: { type: Number, default: 50 },
    dailyGameLimit: { type: Number, default: 5 },
    Homepageplaygameads: { type: Boolean, default: false },
    homepagetestpracticeads: { type: Boolean, default: false },
    Homepageplaygameadstype: { type: String, enum: ['interstitial', 'rewarded'], default: 'interstitial' },
    homepagetestpracticetype: { type: String, enum: ['interstitial', 'rewarded'], default: 'interstitial' },
    instagramLink: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
