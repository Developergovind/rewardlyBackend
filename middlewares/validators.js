const { body, param, query } = require('express-validator');

const googleSignInValidation = [
  body('idToken').notEmpty().withMessage('Google ID token is required'),
  body('referredBy').optional().isString().trim(),
  body('deviceToken').optional().isString().trim(),
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
  body('dailyGameLimit').optional().isInt({ min: 1 }).withMessage('Must be at least 1'),
];

const notificationValidation = [
  body('title').notEmpty().trim().withMessage('Title is required'),
  body('description').notEmpty().trim().withMessage('Description is required'),
  body('targetUser').optional().isMongoId().withMessage('Invalid target user ID'),
];

const finalizeWinnersValidation = [
  body('type').optional().isIn(['daily', 'monthly']).withMessage('Type must be daily or monthly'),
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

module.exports = {
  googleSignInValidation,
  adminLoginValidation,
  playGameValidation,
  deviceTokenValidation,
  settingsValidation,
  notificationValidation,
  finalizeWinnersValidation,
  scoreQueryValidation,
  winnersQueryValidation,
  mongoIdParam,
};
