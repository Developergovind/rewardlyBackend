const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const {
  getHome,
  getLeaderboard,
  getRewardHistory,
  getWinners,
  getNotifications,
  markNotificationRead,
  playGame,
  updateDeviceToken,
} = require('../controllers/userController');
const {
  playGameValidation,
  deviceTokenValidation,
  scoreQueryValidation,
  winnersQueryValidation,
  mongoIdParam,
} = require('../middlewares/validators');
const validate = require('../middlewares/validate');

const router = express.Router();

router.use(authMiddleware);

router.get('/home', getHome);
router.get('/score', scoreQueryValidation, validate, getLeaderboard);
router.get('/rewards/history', getRewardHistory);
router.get('/winners', winnersQueryValidation, validate, getWinners);
router.get('/notifications', getNotifications);
router.post('/notifications/:id/read', mongoIdParam, validate, markNotificationRead);
router.post('/game/play', playGameValidation, validate, playGame);
router.put('/user/device-token', deviceTokenValidation, validate, updateDeviceToken);

module.exports = router;
