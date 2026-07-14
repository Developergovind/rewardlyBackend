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
        photo: u.profilePic || '',
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
      'Homepageplaygameads',
      'homepagetestpracticeads',
      'Homepageplaygameadstype',
      'homepagetestpracticetype',
      'instagramLink',
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        settings[field] = req.body[field];
      }
    });

    await settings.save();

    if (req.body.alert === true) {
      await User.updateMany({}, { $set: { alert: true } });
    }

    res.json({ success: true, data: settings, message: 'Settings updated' });
  } catch (err) {
    next(err);
  }
};

const sendNotification = async (req, res, next) => {
  try {
    const { title, description, targetUser } = req.body;

    let targetUsers = [];
    if (targetUser) {
      if (Array.isArray(targetUser)) {
        targetUsers = targetUser.filter(Boolean);
      } else if (typeof targetUser === 'string' && targetUser.trim() !== '') {
        targetUsers = [targetUser.trim()];
      }
    }

    const notification = await Notification.create({
      title,
      description,
      targetUser: targetUsers.length > 0 ? targetUsers : null,
    });

    let pushResult = { successCount: 0, failureCount: 0 };
    if (targetUsers.length > 0) {
      const pushPromises = targetUsers.map(async (userId) => {
        try {
          return await sendPushToUser(userId, title, description, {
            notificationId: notification._id.toString(),
          });
        } catch (err) {
          console.error(`Failed to send push to user ${userId}:`, err.message);
          return { successCount: 0, failureCount: 1 };
        }
      });
      const results = await Promise.all(pushPromises);
      results.forEach((res) => {
        if (res) {
          pushResult.successCount += res.successCount || 0;
          pushResult.failureCount += res.failureCount || 0;
        }
      });
    } else {
      pushResult = await sendPushToAllUsers(title, description, {
        notificationId: notification._id.toString(),
      });
    }

    res.json({
      success: true,
      message: targetUsers.length > 0 ? 'Notification sent to target user(s)' : 'Broadcast notification sent',
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

    res.json({
      success: true,
      message: `${type} winners finalized (active user points preserved)`,
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

const distributeRewards = async (req, res, next) => {
  try {
    const { type, date, firstCode, secondCode, thirdCode } = req.body;

    const dateHelpers = require('../utils/dateHelpers');
    let dateRange;
    if (date) {
      const d = new Date(date);
      const start = dateHelpers.getISTStartOfDay(d);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      dateRange = { start, end };
    } else {
      dateRange = type === 'monthly' ? dateHelpers.getMonthRangeIST() : dateHelpers.getTodayRangeIST();
    }

    let winners = await Winner.find({
      type,
      date: { $gte: dateRange.start, $lt: dateRange.end },
    }).sort({ rank: 1 });

    if (winners.length === 0) {
      await finalizeWinners(type, dateRange);
      winners = await Winner.find({
        type,
        date: { $gte: dateRange.start, $lt: dateRange.end },
      }).sort({ rank: 1 });
    }

    if (winners.length === 0) {
      throw new ApiError(400, `No eligible users found to finalize winners for this date range`);
    }

    const codes = [firstCode, secondCode, thirdCode];
    const updatedWinners = [];

    const getRankSuffix = (rank) => {
      if (rank === 1) return '1st';
      if (rank === 2) return '2nd';
      if (rank === 3) return '3rd';
      return `${rank}th`;
    };

    const getMonthName = (dateVal) => {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const d = new Date(dateVal);
      return `${d.getDate()} ${months[d.getMonth()]}`;
    };

    for (let i = 0; i < winners.length; i++) {
      const winner = winners[i];
      const code = codes[winner.rank - 1];
      if (code) {
        winner.amazonCode = code;
        await winner.save();

        const message = `🎉 Congratulations! Your Amazon Voucher for ranking ${getRankSuffix(winner.rank)} on ${getMonthName(winner.date)} is here: ${code}`;
        await sendPushToUser(
          winner.userId,
          '🎉 Amazon Voucher Delivered!',
          message
        );

        updatedWinners.push(winner);
      }
    }

    res.json({
      success: true,
      message: `${type} rewards distributed successfully`,
      winners: updatedWinners,
    });
  } catch (err) {
    next(err);
  }
};

const getAdminLeaderboard = async (req, res, next) => {
  try {
    const { type = 'today' } = req.query;
    const pointsField = type === 'monthly' ? 'monthGamePoints' : 'todayGamePoints';

    const users = await User.find({ isBlocked: false })
      .sort({ [pointsField]: -1, createdAt: 1 })
      .select('name email profilePic todayGamePoints monthGamePoints deviceName deviceModal deviceUniquCode');

    const leaderboard = users.map((u, index) => ({
      userId: u._id,
      name: u.name,
      email: u.email,
      profilePic: u.profilePic || '',
      points: u[pointsField],
      rank: index + 1,
      deviceName: u.deviceName,
      deviceModal: u.deviceModal,
      deviceUniquCode: u.deviceUniquCode,
    }));

    res.json({
      success: true,
      type,
      leaderboard,
    });
  } catch (err) {
    next(err);
  }
};

const updateUserPoints = async (req, res, next) => {
  try {
    const { todayGamePoints, monthGamePoints } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    if (todayGamePoints !== undefined) {
      user.todayGamePoints = Number(todayGamePoints);
    }
    if (monthGamePoints !== undefined) {
      user.monthGamePoints = Number(monthGamePoints);
    }

    await user.save();

    res.json({
      success: true,
      message: 'User points updated successfully',
      user: {
        id: user._id,
        name: user.name,
        todayGamePoints: user.todayGamePoints,
        monthGamePoints: user.monthGamePoints,
      },
    });
  } catch (err) {
    next(err);
  }
};

const notifyUserWin = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const notification = await Notification.create({
      title,
      description,
      targetUser: [user._id],
    });

    const pushResult = await sendPushToUser(user._id, title, description, {
      notificationId: notification._id.toString(),
    });

    res.json({
      success: true,
      message: 'Win notification sent successfully',
      notification,
      pushResult,
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
  distributeRewards,
  getAdminLeaderboard,
  updateUserPoints,
  notifyUserWin,
};
