const Settings = require('../models/Settings');
const User = require('../models/User');
const GameHistory = require('../models/GameHistory');
const RewardHistory = require('../models/RewardHistory');
const Winner = require('../models/Winner');
const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const { getTodayRangeIST, getMonthRangeIST } = require('../utils/dateHelpers');

const getHome = async (req, res, next) => {
  try {
    const user = req.user;
    const settings = await Settings.findOne();

    res.json({
      name: user.name,
      email: user.email,
      todaygamepoints: user.todayGamePoints,
      monthgamepoints: user.monthGamePoints,
      leftgame: user.leftGame,
      refercode: user.referCode,
      refercount: user.referCount,
      referamount: user.referAmount,
      alert: settings?.alert ?? false,
      alertTitle: settings?.alertTitle ?? '',
      alertDescription: settings?.alertDescription ?? '',
      dailyfirstprice: settings?.dailyFirstPrice ?? 0,
      dailysecondprice: settings?.dailySecondPrice ?? 0,
      dailythirdprice: settings?.dailyThirdPrice ?? 0,
      monthlyfirstprice: settings?.monthlyFirstPrice ?? 0,
      monthlysecondprice: settings?.monthlySecondPrice ?? 0,
      monthlythirdprice: settings?.monthlyThirdPrice ?? 0,
    });
  } catch (err) {
    next(err);
  }
};

const getLeaderboard = async (req, res, next) => {
  try {
    const { type = 'today' } = req.query;
    const pointsField = type === 'monthly' ? 'monthGamePoints' : 'todayGamePoints';

    const topUsers = await User.find({ isBlocked: false, [pointsField]: { $gt: 0 } })
      .sort({ [pointsField]: -1 })
      .limit(50)
      .select('name profilePic todayGamePoints monthGamePoints');

    const leaderboard = topUsers.map((u, index) => ({
      userId: u._id,
      name: u.name,
      profilePic: u.profilePic,
      points: u[pointsField],
      rank: index + 1,
    }));

    const currentUser = req.user;
    let myRank = leaderboard.find((e) => e.userId.toString() === currentUser._id.toString());

    if (!myRank) {
      const higherCount = await User.countDocuments({
        isBlocked: false,
        [pointsField]: { $gt: currentUser[pointsField] },
      });
      myRank = {
        userId: currentUser._id,
        name: currentUser.name,
        profilePic: currentUser.profilePic,
        points: currentUser[pointsField],
        rank: higherCount + 1,
      };
    }

    res.json({
      success: true,
      type,
      leaderboard,
      myRank,
    });
  } catch (err) {
    next(err);
  }
};

const getRewardHistory = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [rewards, total] = await Promise.all([
      RewardHistory.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      RewardHistory.countDocuments({ userId: req.user._id }),
    ]);

    res.json({
      success: true,
      data: rewards,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

const getWinners = async (req, res, next) => {
  try {
    const { type = 'today' } = req.query;
    const range = type === 'monthly' ? getMonthRangeIST() : getTodayRangeIST();

    const winners = await Winner.find({
      type: type === 'monthly' ? 'monthly' : 'daily',
      date: { $gte: range.start, $lt: range.end },
    })
      .sort({ rank: 1 })
      .populate('userId', 'name profilePic');

    const data = winners.map((w) => ({
      userId: w.userId._id,
      name: w.userId.name,
      profilePic: w.userId.profilePic,
      rank: w.rank,
      prizeAmount: w.prizeAmount,
      date: w.date,
    }));

    res.json({ success: true, type, data });
  } catch (err) {
    next(err);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const userId = req.user._id;

    const filter = {
      $or: [{ targetUser: null }, { targetUser: userId }],
    };

    const [notifications, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
    ]);

    const data = notifications.map((n) => ({
      _id: n._id,
      title: n.title,
      description: n.description,
      isRead: n.readBy.some((id) => id.toString() === userId.toString()),
      createdAt: n.createdAt,
    }));

    res.json({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      throw new ApiError(404, 'Notification not found');
    }

    const userId = req.user._id;
    const isRelevant =
      notification.targetUser === null ||
      notification.targetUser?.toString() === userId.toString();

    if (!isRelevant) {
      throw new ApiError(403, 'Notification not accessible');
    }

    if (!notification.readBy.some((id) => id.toString() === userId.toString())) {
      notification.readBy.push(userId);
      await notification.save();
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    next(err);
  }
};

const playGame = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const { pointsEarned } = req.body;

    if (user.leftGame <= 0) {
      throw new ApiError(400, 'No games remaining for today');
    }

    user.leftGame -= 1;
    user.todayGamePoints += pointsEarned;
    user.monthGamePoints += pointsEarned;
    await user.save();

    await GameHistory.create({
      userId: user._id,
      pointsEarned,
      playedAt: new Date(),
    });

    await RewardHistory.create({
      userId: user._id,
      rewardType: 'game_play',
      amount: pointsEarned,
      description: `Earned ${pointsEarned} points from game play`,
    });

    res.json({
      success: true,
      todaygamepoints: user.todayGamePoints,
      monthgamepoints: user.monthGamePoints,
      leftgame: user.leftGame,
      pointsEarned,
    });
  } catch (err) {
    next(err);
  }
};

const updateDeviceToken = async (req, res, next) => {
  try {
    const { deviceToken } = req.body;
    req.user.deviceToken = deviceToken;
    await req.user.save();

    res.json({ success: true, message: 'Device token updated' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getHome,
  getLeaderboard,
  getRewardHistory,
  getWinners,
  getNotifications,
  markNotificationRead,
  playGame,
  updateDeviceToken,
};
