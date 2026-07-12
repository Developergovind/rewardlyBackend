const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const User = require('../models/User');
const Settings = require('../models/Settings');
const GameHistory = require('../models/GameHistory');
const RewardHistory = require('../models/RewardHistory');
const Winner = require('../models/Winner');
const Notification = require('../models/Notification');
const { signAdminToken } = require('../utils/jwt');
const { sendPushToUser, sendPushToAllUsers } = require('../utils/firebase');
const {
  finalizeWinners,
  resetDailyStats,
  resetMonthlyStats,
} = require('../utils/winnerService');
const { getTodayRangeIST, getMonthRangeIST } = require('../utils/dateHelpers');
const ApiError = require('../utils/ApiError');

const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const token = signAdminToken(admin._id);

    res.json({
      success: true,
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email },
    });
  } catch (err) {
    next(err);
  }
};

const getDashboard = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalNotifications = await Notification.countDocuments();

    const totalPointsResult = await RewardHistory.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalPointsDistributed = totalPointsResult[0]?.total ?? 0;

    const todayRange = getTodayRangeIST();
    const monthRange = getMonthRangeIST();

    const todayTop3 = await User.find({ isBlocked: false, todayGamePoints: { $gt: 0 } })
      .sort({ todayGamePoints: -1 })
      .limit(3)
      .select('name email profilePic todayGamePoints');

    const monthTop3 = await User.find({ isBlocked: false, monthGamePoints: { $gt: 0 } })
      .sort({ monthGamePoints: -1 })
      .limit(3)
      .select('name email profilePic monthGamePoints');

    const todayWinners = await Winner.find({
      type: 'daily',
      date: { $gte: todayRange.start, $lt: todayRange.end },
    })
      .sort({ rank: 1 })
      .populate('userId', 'name profilePic');

    const monthWinners = await Winner.find({
      type: 'monthly',
      date: { $gte: monthRange.start, $lt: monthRange.end },
    })
      .sort({ rank: 1 })
      .populate('userId', 'name profilePic');

    const todayPointsDistributed = await GameHistory.aggregate([
      { $match: { playedAt: { $gte: todayRange.start, $lt: todayRange.end } } },
      { $group: { _id: null, total: { $sum: '$pointsEarned' } } },
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalPointsDistributed,
        todayPointsDistributed: todayPointsDistributed[0]?.total ?? 0,
        totalNotifications,
        todayTop3: todayTop3.map((u, i) => ({
          rank: i + 1,
          name: u.name,
          email: u.email,
          profilePic: u.profilePic,
          points: u.todayGamePoints,
        })),
        monthTop3: monthTop3.map((u, i) => ({
          rank: i + 1,
          name: u.name,
          email: u.email,
          profilePic: u.profilePic,
          points: u.monthGamePoints,
        })),
        todayWinners: todayWinners.map((w) => ({
          rank: w.rank,
          name: w.userId?.name,
          profilePic: w.userId?.profilePic,
          prizeAmount: w.prizeAmount,
        })),
        monthWinners: monthWinners.map((w) => ({
          rank: w.rank,
          name: w.userId?.name,
          profilePic: w.userId?.profilePic,
          prizeAmount: w.prizeAmount,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const { search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const sortField = ['name', 'email', 'todayGamePoints', 'monthGamePoints', 'createdAt', 'referCount'].includes(sortBy)
      ? sortBy
      : 'createdAt';
    const sort = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

    const [users, total] = await Promise.all([
      User.find(filter).sort(sort).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: users.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        deviceToken: u.deviceToken,
        todayGamePoints: u.todayGamePoints,
        monthGamePoints: u.monthGamePoints,
        referCode: u.referCode,
        referCount: u.referCount,
        referAmount: u.referAmount,
        isBlocked: u.isBlocked,
        createdAt: u.createdAt,
      })),
      total,
      pagination: { page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const [gameHistory, rewardHistory] = await Promise.all([
      GameHistory.find({ userId: user._id }).sort({ playedAt: -1 }).limit(100),
      RewardHistory.find({ userId: user._id }).sort({ createdAt: -1 }).limit(100),
    ]);

    res.json({
      success: true,
      user,
      gameHistory,
      rewardHistory,
    });
  } catch (err) {
    next(err);
  }
};

const toggleBlockUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    res.json({
      success: true,
      message: user.isBlocked ? 'User blocked' : 'User unblocked',
      isBlocked: user.isBlocked,
    });
  } catch (err) {
    next(err);
  }
};

const getSettings = async (req, res, next) => {
  try {
    const settings = await Settings.findOne();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    const fields = [
      'alert',
      'alertTitle',
      'alertDescription',
      'dailyFirstPrice',
      'dailySecondPrice',
      'dailyThirdPrice',
      'monthlyFirstPrice',
      'monthlySecondPrice',
      'monthlyThirdPrice',
      'referAmount',
      'dailyGameLimit',
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        settings[field] = req.body[field];
      }
    });

    await settings.save();
    res.json({ success: true, data: settings, message: 'Settings updated' });
  } catch (err) {
    next(err);
  }
};

const sendNotification = async (req, res, next) => {
  try {
    const { title, description, targetUser } = req.body;

    const notification = await Notification.create({
      title,
      description,
      targetUser: targetUser || null,
    });

    let pushResult;
    if (targetUser) {
      pushResult = await sendPushToUser(targetUser, title, description, {
        notificationId: notification._id.toString(),
      });
    } else {
      pushResult = await sendPushToAllUsers(title, description, {
        notificationId: notification._id.toString(),
      });
    }

    res.json({
      success: true,
      message: targetUser ? 'Notification sent to user' : 'Broadcast notification sent',
      notification,
      pushResult,
    });
  } catch (err) {
    next(err);
  }
};

const finalizeWinnersManual = async (req, res, next) => {
  try {
    const { type = 'daily' } = req.body;

    const dateRange = type === 'monthly' ? getMonthRangeIST() : getTodayRangeIST();

    const result = await finalizeWinners(type, dateRange);

    if (type === 'daily') {
      await resetDailyStats();
    } else {
      await resetMonthlyStats();
    }

    res.json({
      success: true,
      message: `${type} winners finalized`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

const getAdminWinners = async (req, res, next) => {
  try {
    const todayRange = getTodayRangeIST();
    const monthRange = getMonthRangeIST();

    const [dailyWinners, monthlyWinners] = await Promise.all([
      Winner.find({ type: 'daily', date: { $gte: todayRange.start, $lt: todayRange.end } })
        .sort({ rank: 1 })
        .populate('userId', 'name email profilePic'),
      Winner.find({ type: 'monthly', date: { $gte: monthRange.start, $lt: monthRange.end } })
        .sort({ rank: 1 })
        .populate('userId', 'name email profilePic'),
    ]);

    res.json({
      success: true,
      daily: dailyWinners,
      monthly: monthlyWinners,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
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
};
