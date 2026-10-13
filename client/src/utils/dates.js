// Today's date as YYYY-MM-DD in the user's own time zone, for date inputs.
// toISOString() would give the UTC date, which in India is still yesterday until 5:30 am.
export function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
