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
  finalizeWinnersManual,
  getAdminWinners,
} = require('../controllers/adminController');
const {
  adminLoginValidation,
  settingsValidation,
  notificationValidation,
  finalizeWinnersValidation,
  mongoIdParam,
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
router.post('/winners/finalize', finalizeWinnersValidation, validate, finalizeWinnersManual);
router.get('/winners', getAdminWinners);

module.exports = router;
