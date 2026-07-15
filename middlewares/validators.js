const { body, param, query } = require('express-validator');

const googleSignInValidation = [
  body('idToken').notEmpty().withMessage('Google ID token is required'),
  body('referredBy').optional().isString().trim(),
  body('deviceToken').optional().isString().trim(),
  body('deviceName').optional().isString().trim(),
  body('deviceModal').optional().isString().trim(),
  body('deviceUniquCode').optional().isString().trim(),
];

const adminLoginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const playGameValidation = [
  body('pointsEarned')
    .isInt({ min: 0 })
    .withMessage('pointsEarned must be a non-negative integer'),
];

const deviceTokenValidation = [
  body('deviceToken').notEmpty().withMessage('deviceToken is required'),
];

const settingsValidation = [
  body('alert').optional().isBoolean(),
  body('alertTitle').optional().isString(),
  body('alertDescription').optional().isString(),
  body('dailyFirstPrice').optional().isFloat({ min: 0.01 }).withMessage('Must be positive'),
  body('dailySecondPrice').optional().isFloat({ min: 0.01 }).withMessage('Must be positive'),
  body('dailyThirdPrice').optional().isFloat({ min: 0.01 }).withMessage('Must be positive'),
  body('monthlyFirstPrice').optional().isFloat({ min: 0.01 }).withMessage('Must be positive'),
  body('monthlySecondPrice').optional().isFloat({ min: 0.01 }).withMessage('Must be positive'),
  body('monthlyThirdPrice').optional().isFloat({ min: 0.01 }).withMessage('Must be positive'),
  body('referAmount').optional().isFloat({ min: 0.01 }).withMessage('Must be positive'),
  body('Homepageplaygameads').optional().isBoolean(),
  body('homepagetestpracticeads').optional().isBoolean(),
  body('Homepageplaygameadstype').optional().isIn(['interstitial', 'rewarded']),
  body('homepagetestpracticetype').optional().isIn(['interstitial', 'rewarded']),
  body('instagramLink').optional().isString().trim(),
];

const notificationValidation = [
  body('title').notEmpty().trim().withMessage('Title is required'),
  body('description').notEmpty().trim().withMessage('Description is required'),
  body('targetUser')
    .optional()
    .custom((value) => {
      if (Array.isArray(value)) {
        return value.every((id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id));
      }
      if (typeof value === 'string' && value.trim() !== '') {
        return /^[0-9a-fA-F]{24}$/.test(value);
      }
      return true;
    })
    .withMessage('targetUser must be a valid Mongo ID or array of Mongo IDs'),
];

const rewardDistributionValidation = [
  body('type').isIn(['daily', 'monthly']).withMessage('Type must be daily or monthly'),
  body('date').notEmpty().withMessage('Date is required').isISO8601().withMessage('Date must be a valid ISO8601 date string'),
  body('firstCode').optional().isString().trim(),
  body('secondCode').optional().isString().trim(),
  body('thirdCode').optional().isString().trim(),
  body('firstUserId').optional().isMongoId().withMessage('firstUserId must be a valid Mongo ID'),
  body('secondUserId').optional().isMongoId().withMessage('secondUserId must be a valid Mongo ID'),
  body('thirdUserId').optional().isMongoId().withMessage('thirdUserId must be a valid Mongo ID'),
];

const scoreQueryValidation = [
  query('type').optional().isIn(['today', 'monthly']).withMessage('Type must be today or monthly'),
];

const winnersQueryValidation = [
  query('type').optional().isIn(['today', 'monthly']).withMessage('Type must be today or monthly'),
];

const mongoIdParam = [
  param('id').isMongoId().withMessage('Invalid ID'),
];

const updateUserPointsValidation = [
  body('todayGamePoints').optional().isInt({ min: 0 }).withMessage('Must be a non-negative integer'),
  body('monthGamePoints').optional().isInt({ min: 0 }).withMessage('Must be a non-negative integer'),
];

const notifyUserWinValidation = [
  body('title').notEmpty().trim().withMessage('Title is required'),
  body('description').notEmpty().trim().withMessage('Description is required'),
];

const adminLeaderboardValidation = [
  query('type').optional().isIn(['today', 'monthly']).withMessage('Type must be today or monthly'),
];

module.exports = {
  googleSignInValidation,
  adminLoginValidation,
  playGameValidation,
  deviceTokenValidation,
  settingsValidation,
  notificationValidation,
  scoreQueryValidation,
  winnersQueryValidation,
  mongoIdParam,
  rewardDistributionValidation,
  updateUserPointsValidation,
  notifyUserWinValidation,
  adminLeaderboardValidation,
};
