const User = require('../models/User');
const { verifyUserToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication required');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyUserToken(token);

    if (decoded.type !== 'user') {
      throw new ApiError(401, 'Invalid token type');
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new ApiError(401, 'User not found');
    }

    if (user.isBlocked) {
      throw new ApiError(403, 'Your account has been blocked');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(new ApiError(401, 'Invalid or expired token'));
  }
};

module.exports = authMiddleware;
