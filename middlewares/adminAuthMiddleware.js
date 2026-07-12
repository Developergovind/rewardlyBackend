const Admin = require('../models/Admin');
const { verifyAdminToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');

const adminAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Admin authentication required');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAdminToken(token);

    if (decoded.type !== 'admin') {
      throw new ApiError(401, 'Invalid admin token');
    }

    const admin = await Admin.findById(decoded.adminId).select('-password');
    if (!admin) {
      throw new ApiError(401, 'Admin not found');
    }

    req.admin = admin;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(new ApiError(401, 'Invalid or expired admin token'));
  }
};

module.exports = adminAuthMiddleware;
