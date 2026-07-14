const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    targetUser: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
