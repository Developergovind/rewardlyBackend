const jwt = require('jsonwebtoken');

const signUserToken = (userId) => {
  return jwt.sign({ userId, type: 'user' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

const signAdminToken = (adminId) => {
  return jwt.sign({ adminId, type: 'admin' }, process.env.JWT_ADMIN_SECRET, {
    expiresIn: '7d',
  });
};

const verifyUserToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyAdminToken = (token) => {
  return jwt.verify(token, process.env.JWT_ADMIN_SECRET);
};

module.exports = {
  signUserToken,
  signAdminToken,
  verifyUserToken,
  verifyAdminToken,
};
