// Display helpers for the account and tracking pages.

// e.g. "24 Oct 2026", or fallback when there is no date
export function formatDate(value, fallback = '') {
  return value
    ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : fallback;
}

// Status pill classes, e.g. "Pending Verification" -> "status-pill pill-pending-verification"
export function pillClass(status) {
  return `status-pill pill-${String(status).toLowerCase().replace(' ', '-')}`;
}
