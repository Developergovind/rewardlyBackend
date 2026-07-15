const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Settings = require('../models/Settings');
const RewardHistory = require('../models/RewardHistory');
const Notification = require('../models/Notification');
const { signUserToken } = require('../utils/jwt');
const { generateReferCode } = require('../utils/referCode');
const { sendPushToUser } = require('../utils/firebase');
const ApiError = require('../utils/ApiError');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const googleSignIn = async (req, res, next) => {
  try {
    const { idToken, referredBy, deviceToken, deviceName, deviceModal, deviceUniquCode } = req.body;

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, name, email, picture } = payload;

    let user = await User.findOne({ googleId });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const settings = await Settings.findOne();
      const referCode = await generateReferCode();

      user = new User({
        googleId,
        name: name || 'User',
        email,
        profilePic: picture || '',
        referCode,
        leftGame: settings?.dailyGameLimit ?? 5,
        referredBy: null,
        deviceName: deviceName || null,
        deviceModal: deviceModal || null,
        deviceUniquCode: deviceUniquCode || null,
      });

      if (referredBy) {
        const referrer = await User.findOne({ referCode: referredBy.trim() });
        if (referrer && referrer.email !== email) {
          user.referredBy = referredBy.trim();
          const referPoints = settings?.referAmount ?? 50;

          referrer.referCount += 1;
          referrer.referAmount += referPoints;
          await referrer.save();

          await RewardHistory.create({
            userId: referrer._id,
            rewardType: 'referral_bonus',
            amount: referPoints,
            description: `Referral bonus for inviting ${name || email}`,
          });

          await Notification.create({
            title: 'Referral Bonus!',
            description: `You earned ${referPoints} points for referring ${name || 'a new user'}!`,
            targetUser: referrer._id,
          });

          await sendPushToUser(
            referrer._id,
            'Referral Bonus!',
            `You earned ${referPoints} points for referring ${name || 'a new user'}!`
          );
        }
      }

      await user.save();
    }

    let userUpdated = false;
    if (deviceToken && user.deviceToken !== deviceToken) {
      user.deviceToken = deviceToken;
      userUpdated = true;
    }
    if (deviceName && user.deviceName !== deviceName) {
      user.deviceName = deviceName;
      userUpdated = true;
    }
    if (deviceModal && user.deviceModal !== deviceModal) {
      user.deviceModal = deviceModal;
      userUpdated = true;
    }
    if (deviceUniquCode && user.deviceUniquCode !== deviceUniquCode) {
      user.deviceUniquCode = deviceUniquCode;
      userUpdated = true;
    }
    if (userUpdated) {
      await user.save();
    }

    const token = signUserToken(user._id);

    res.json({
      success: true,
      token,
      userType: 'user',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        referCode: user.referCode,
        isNewUser,
        userType: 'user',
      },
    });
  } catch (err) {
    if (err.message?.includes('Token used too late') || err.message?.includes('Invalid token')) {
      return next(new ApiError(401, 'Invalid Google ID token'));
    }
    next(err);
  }
};

module.exports = { googleSignIn };
