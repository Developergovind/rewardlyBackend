const User = require('../models/User');

const generateReferCode = async () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code;
  let exists = true;

  while (exists) {
    let suffix = '';
    for (let i = 0; i < 5; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code = `REWARDLY-${suffix}`;
    exists = await User.exists({ referCode: code });
  }

  return code;
};

module.exports = { generateReferCode };
