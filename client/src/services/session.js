// Login sessions saved in localStorage: one for staff (admin panel) and one for public accounts.
// The key names are the same as before, so existing sessions carry over.
const KEYS = {
  admin: { token: 'token', profile: 'admin' },
  user: { token: 'userToken', profile: 'user' }
};

const listeners = { admin: new Set(), user: new Set() };

function notify(kind) {
  listeners[kind].forEach((listener) => listener());
}

// Reads the expiry from the token payload. Only the server can tell whether the token is genuine.
function isExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return !payload.exp || payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

function remove(kind) {
  localStorage.removeItem(KEYS[kind].token);
  localStorage.removeItem(KEYS[kind].profile);
}

// { token, profile } of a saved, unexpired session, or null. Expired or damaged sessions are thrown away.
export function readSession(kind) {
  const token = localStorage.getItem(KEYS[kind].token);
  const profile = localStorage.getItem(KEYS[kind].profile);
  if (!token || !profile) return null;
  try {
    if (!isExpired(token)) return { token, profile: JSON.parse(profile) };
  } catch {
    // unreadable profile, treated like an expired session
  }
  remove(kind);
  // Tell the app the session is over, so the route guards send the person to log in.
  // Deferred because this can run while React is rendering.
  queueMicrotask(() => notify(kind));
  return null;
}

export function saveSession(kind, token, profile) {
  localStorage.setItem(KEYS[kind].token, token);
  localStorage.setItem(KEYS[kind].profile, JSON.stringify(profile));
  notify(kind);
}

export function clearSession(kind) {
  remove(kind);
  notify(kind);
}

// Calls listener whenever this kind of session starts or ends, here or in another tab. Returns an unsubscribe function.
export function subscribe(kind, listener) {
  listeners[kind].add(listener);
  return () => listeners[kind].delete(listener);
}

window.addEventListener('storage', (e) => {
  Object.keys(KEYS).forEach((kind) => {
    if (e.key === null || Object.values(KEYS[kind]).includes(e.key)) notify(kind);
  });
});
