const { getAdmin } = require('../config/firebase');
const User = require('../models/User');

const CHUNK_SIZE = 500;

const removeInvalidTokens = async (tokens, response) => {
  if (!response?.responses) return;

  const invalidTokens = [];
  response.responses.forEach((res, index) => {
    if (!res.success) {
      const code = res.error?.code;
      if (
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered'
      ) {
        invalidTokens.push(tokens[index]);
      }
    }
  });

  if (invalidTokens.length > 0) {
    await User.updateMany({ deviceToken: { $in: invalidTokens } }, { $set: { deviceToken: null } });
  }
};

const sendPushNotification = async (tokens, title, body, data = {}) => {
  const admin = getAdmin();
  if (!admin) {
    console.warn('Firebase not initialized — skipping push notification');
    return { successCount: 0, failureCount: tokens.length };
  }

  const validTokens = [...new Set(tokens.filter(Boolean))];
  if (validTokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  let totalSuccess = 0;
  let totalFailure = 0;

  for (let i = 0; i < validTokens.length; i += CHUNK_SIZE) {
    const chunk = validTokens.slice(i, i + CHUNK_SIZE);

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      });

      totalSuccess += response.successCount;
      totalFailure += response.failureCount;
      await removeInvalidTokens(chunk, response);
    } catch (err) {
      console.error('FCM send error:', err.message);
      totalFailure += chunk.length;
    }
  }

  return { successCount: totalSuccess, failureCount: totalFailure };
};

const sendPushToUser = async (userId, title, body, data = {}) => {
  const user = await User.findById(userId).select('deviceToken');
  if (!user?.deviceToken) return { successCount: 0, failureCount: 0 };
  return sendPushNotification([user.deviceToken], title, body, data);
};

const sendPushToAllUsers = async (title, body, data = {}) => {
  const users = await User.find({ deviceToken: { $ne: null }, isBlocked: false }).select('deviceToken');
  const tokens = users.map((u) => u.deviceToken);
  return sendPushNotification(tokens, title, body, data);
};

module.exports = {
  sendPushNotification,
  sendPushToUser,
  sendPushToAllUsers,
};
