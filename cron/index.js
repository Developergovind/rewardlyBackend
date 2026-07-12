const cron = require('node-cron');
const {
  finalizeWinners,
  resetDailyStats,
  resetMonthlyStats,
} = require('../utils/winnerService');
const { getTodayRangeIST, getMonthRangeIST, getYesterdayRangeIST, getLastMonthRangeIST } = require('../utils/dateHelpers');

const startCronJobs = () => {
  // Daily reset at midnight IST (00:00 IST = 18:30 UTC previous day... actually IST is UTC+5:30)
  // Midnight IST = 18:30 UTC (previous calendar day in UTC during standard... wait)
  // IST midnight = 00:00 +0530 = 18:30 UTC previous day
  // Cron in UTC: 30 18 * * * for daily at IST midnight
  cron.schedule('30 18 * * *', async () => {
    console.log('[CRON] Running daily winner finalization and reset...');
    try {
      const yesterdayRange = getYesterdayRangeIST();
      await finalizeWinners('daily', yesterdayRange);
      await resetDailyStats();
      console.log('[CRON] Daily reset completed');
    } catch (err) {
      console.error('[CRON] Daily reset failed:', err.message);
    }
  });

  // Monthly reset on 1st at midnight IST
  cron.schedule('30 18 1 * *', async () => {
    console.log('[CRON] Running monthly winner finalization and reset...');
    try {
      const lastMonthRange = getLastMonthRangeIST();
      await finalizeWinners('monthly', lastMonthRange);
      await resetMonthlyStats();
      console.log('[CRON] Monthly reset completed');
    } catch (err) {
      console.error('[CRON] Monthly reset failed:', err.message);
    }
  });

  console.log('Cron jobs scheduled (IST timezone)');
};

module.exports = { startCronJobs };
