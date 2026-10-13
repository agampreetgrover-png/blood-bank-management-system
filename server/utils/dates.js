// Calendar dates as 'YYYY-MM-DD' strings. These compare correctly as plain strings.

// The date in the server's own time zone. toISOString() would give the UTC date,
// which in India is still the previous day until 5:30 am.
function localDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// True for a real calendar date written as YYYY-MM-DD (rejects things like 2026-02-30)
function isDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  return localDate(new Date(y, m - 1, d)) === value;
}

module.exports = { localDate, isDateString };
