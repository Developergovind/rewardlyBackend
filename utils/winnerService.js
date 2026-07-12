const User = require('../models/User');
const Winner = require('../models/Winner');
const RewardHistory = require('../models/RewardHistory');
const Settings = require('../models/Settings');
const { sendPushToUser } = require('./firebase');

const PRIZE_FIELDS = {
  daily: ['dailyFirstPrice', 'dailySecondPrice', 'dailyThirdPrice'],
  monthly: ['monthlyFirstPrice', 'monthlySecondPrice', 'monthlyThirdPrice'],
};

const POINTS_FIELDS = {
  daily: 'todayGamePoints',
  monthly: 'monthGamePoints',
};

const finalizeWinners = async (type, dateRange) => {
  const settings = await Settings.findOne();
  if (!settings) {
    throw new Error('Settings document not found');
  }

  const pointsField = POINTS_FIELDS[type];
  const prizeFields = PRIZE_FIELDS[type];

  const existing = await Winner.countDocuments({
    type,
    date: { $gte: dateRange.start, $lt: dateRange.end },
  });

  if (existing > 0) {
    console.log(`${type} winners already finalized for this period`);
    return { skipped: true, winners: [] };
  }

  const topUsers = await User.find({ isBlocked: false, [pointsField]: { $gt: 0 } })
    .sort({ [pointsField]: -1 })
    .limit(3)
    .select('_id name email profilePic todayGamePoints monthGamePoints');

  const winners = [];

  for (let i = 0; i < topUsers.length; i++) {
    const user = topUsers[i];
    const rank = i + 1;
    const prizeAmount = settings[prizeFields[i]];

    const winner = await Winner.create({
      userId: user._id,
      type,
      rank,
      prizeAmount,
      date: dateRange.start,
    });

    await RewardHistory.create({
      userId: user._id,
      rewardType: type === 'daily' ? 'daily_winner' : 'monthly_winner',
      amount: prizeAmount,
      description: `${type.charAt(0).toUpperCase() + type.slice(1)} winner — rank ${rank}`,
    });

    await sendPushToUser(
      user._id,
      '🎉 Congratulations!',
      `You ranked #${rank} in the ${type} leaderboard and won ${prizeAmount} points!`
    );

    winners.push({
      winner,
      user: {
        _id: user._id,
        name: user.name,
        profilePic: user.profilePic,
        points: user[pointsField],
      },
    });
  }

  return { skipped: false, winners };
};

const resetDailyStats = async () => {
  const settings = await Settings.findOne();
  const dailyGameLimit = settings?.dailyGameLimit ?? 5;

  await User.updateMany({}, {
    $set: { todayGamePoints: 0, leftGame: dailyGameLimit },
  });
};

const resetMonthlyStats = async () => {
  await User.updateMany({}, { $set: { monthGamePoints: 0 } });
};

module.exports = {
  finalizeWinners,
  resetDailyStats,
  resetMonthlyStats,
};
