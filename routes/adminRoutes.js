const express = require('express');
const adminAuthMiddleware = require('../middlewares/adminAuthMiddleware');
const {
  adminLogin,
  getDashboard,
  getUsers,
  getUserById,
  toggleBlockUser,
  getSettings,
  updateSettings,
  sendNotification,
  getAdminWinners,
  distributeRewards,
  getAdminLeaderboard,
  updateUserPoints,
  notifyUserWin,
} = require('../controllers/adminController');
const {
  adminLoginValidation,
  settingsValidation,
  notificationValidation,
  mongoIdParam,
  rewardDistributionValidation,
  updateUserPointsValidation,
  notifyUserWinValidation,
  adminLeaderboardValidation,
} = require('../middlewares/validators');
const validate = require('../middlewares/validate');

const router = express.Router();

router.post('/login', adminLoginValidation, validate, adminLogin);

router.use(adminAuthMiddleware);

router.get('/dashboard', getDashboard);
router.get('/users', getUsers);
router.get('/users/:id', mongoIdParam, validate, getUserById);
router.put('/users/:id/block', mongoIdParam, validate, toggleBlockUser);
router.get('/settings', getSettings);
router.put('/settings', settingsValidation, validate, updateSettings);
router.post('/notification', notificationValidation, validate, sendNotification);
router.get('/winners', getAdminWinners);
router.post('/winners/distribute', rewardDistributionValidation, validate, distributeRewards);
router.get('/leaderboard', adminLeaderboardValidation, validate, getAdminLeaderboard);
router.put('/users/:id/points', mongoIdParam, updateUserPointsValidation, validate, updateUserPoints);
router.post('/users/:id/notify-win', mongoIdParam, notifyUserWinValidation, validate, notifyUserWin);

module.exports = router;
