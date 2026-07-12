const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const toIST = (date = new Date()) => new Date(date.getTime() + IST_OFFSET_MS);

const getISTParts = (date = new Date()) => {
  const ist = toIST(date);
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth(),
    day: ist.getUTCDate(),
  };
};

const istMidnightToUTC = (year, month, day) => {
  const istMidnightUtc = Date.UTC(year, month, day, 0, 0, 0, 0);
  return new Date(istMidnightUtc - IST_OFFSET_MS);
};

const getISTDate = () => toIST();

const getISTStartOfDay = (date = new Date()) => {
  const { year, month, day } = getISTParts(date);
  return istMidnightToUTC(year, month, day);
};

const getISTStartOfMonth = (date = new Date()) => {
  const { year, month } = getISTParts(date);
  return istMidnightToUTC(year, month, 1);
};

const getTodayRangeIST = () => {
  const { year, month, day } = getISTParts();
  return {
    start: istMidnightToUTC(year, month, day),
    end: istMidnightToUTC(year, month, day + 1),
  };
};

const getMonthRangeIST = () => {
  const { year, month } = getISTParts();
  return {
    start: istMidnightToUTC(year, month, 1),
    end: istMidnightToUTC(year, month + 1, 1),
  };
};

const getYesterdayRangeIST = () => {
  const { year, month, day } = getISTParts();
  return {
    start: istMidnightToUTC(year, month, day - 1),
    end: istMidnightToUTC(year, month, day),
  };
};

const getLastMonthRangeIST = () => {
  const { year, month } = getISTParts();
  return {
    start: istMidnightToUTC(year, month - 1, 1),
    end: istMidnightToUTC(year, month, 1),
  };
};

module.exports = {
  getISTDate,
  getISTStartOfDay,
  getISTStartOfMonth,
  getTodayRangeIST,
  getMonthRangeIST,
  getYesterdayRangeIST,
  getLastMonthRangeIST,
};
