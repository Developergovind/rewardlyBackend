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
      userType: 'admin',
      admin: { id: admin._id, name: admin.name, email: admin.email, userType: 'admin' },
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


const getAdminWinners = async (req, res, next) => {
  try {
    const { type } = req.query;
    const filter = {};
    if (type) {
      filter.type = type;
    }

    const winners = await Winner.find(filter)
      .sort({ date: -1, rank: 1 })
      .populate('userId', 'name email profilePic');

    const formattedWinners = winners.map((w) => {
      const obj = w.toObject ? w.toObject() : w;
      return {
        ...obj,
        rewardDistribute: obj.rewardDistribute ?? false,
      };
    });

    res.json({
      success: true,
      data: formattedWinners,
    });
  } catch (err) {
    next(err);
  }
};

const distributeRewards = async (req, res, next) => {
  try {
    const {
      type,
      date,
      firstCode,
      secondCode,
      thirdCode,
      firstUserId,
      secondUserId,
      thirdUserId,
    } = req.body;

    if (!type || !date) {
      throw new ApiError(400, 'Type and date are required');
    }

    const dateHelpers = require('../utils/dateHelpers');
    const d = new Date(date);
    const start = dateHelpers.getISTStartOfDay(d);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const dateRange = { start, end };

    const settings = await Settings.findOne();
    if (!settings) {
      throw new ApiError(500, 'Settings not found');
    }

    const prizeFields = {
      daily: ['dailyFirstPrice', 'dailySecondPrice', 'dailyThirdPrice'],
      monthly: ['monthlyFirstPrice', 'monthlySecondPrice', 'monthlyThirdPrice'],
    }[type];

    const distributionData = [
      { userId: firstUserId, code: firstCode, rank: 1, prizeAmount: settings[prizeFields[0]] },
      { userId: secondUserId, code: secondCode, rank: 2, prizeAmount: settings[prizeFields[1]] },
      { userId: thirdUserId, code: thirdCode, rank: 3, prizeAmount: settings[prizeFields[2]] },
    ];

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
      const dateObj = new Date(dateVal);
      return `${dateObj.getDate()} ${months[dateObj.getMonth()]}`;
    };

    for (const item of distributionData) {
      if (item.userId) {
        // Find or create Winner document
        let winner = await Winner.findOne({
          type,
          date: dateRange.start,
          rank: item.rank,
        });

        if (winner) {
          winner.userId = item.userId;
          winner.amazonCode = item.code || '';
          winner.rewardDistribute = true;
          winner.prizeAmount = item.prizeAmount;
          await winner.save();
        } else {
          winner = await Winner.create({
            userId: item.userId,
            type,
            rank: item.rank,
            prizeAmount: item.prizeAmount,
            date: dateRange.start,
            amazonCode: item.code || '',
            rewardDistribute: true,
          });
        }

        // Add to RewardHistory
        await RewardHistory.create({
          userId: item.userId,
          rewardType: type === 'daily' ? 'daily_winner' : 'monthly_winner',
          amount: item.prizeAmount,
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} winner — rank ${item.rank}`,
        });

        // Send Notification in database
        const message = `🎉 Congratulations! Your Amazon Voucher for ranking ${getRankSuffix(item.rank)} on ${getMonthName(winner.date)} is here: ${item.code || ''}`;

        const notification = await Notification.create({
          title: '🎉 Amazon Voucher Delivered!',
          description: message,
          targetUser: [item.userId],
        });

        try {
          await sendPushToUser(
            item.userId,
            '🎉 Amazon Voucher Delivered!',
            message,
            {
              notificationId: notification._id.toString(),
            }
          );
        } catch (err) {
          console.error(`Failed to send push notification to user ${item.userId}:`, err.message);
        }

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
  getAdminWinners,
  distributeRewards,
  getAdminLeaderboard,
  updateUserPoints,
  notifyUserWin,
};
