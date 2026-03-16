/**
 * ============================================================
 * NATURE DISPATCH TMS — Auth Guard
 * ============================================================
 * Included on every page EXCEPT login.html.
 * Synchronously checks localStorage for a valid session.
 * If no session → redirect to login.html immediately.
 * Also enforces per-page permissions.
 * ============================================================
 */

const Auth = (() => {
  const SESSION_KEY = 'nd_user';

  // ── Page permission mapping ─────────────────────────────
  const PAGE_MAP = {
    'index.html':       'dashboard',
    'loads.html':       'loads',
    'pipeline.html':    'pipeline',
    'drivers.html':     'drivers',
    'trucks.html':      'trucks',
    'brokers.html':     'brokers',
    'documents.html':   'documents',
    'settlements.html': 'settlements',
    'expenses.html':    'expenses',
    'alerts.html':      'alerts',
    'reports.html':     'reports',
    'settings.html':    'settings',
    'users.html':       'users',
  };

  // ── All available permission keys ─────────────────────────
  const ALL_PERMISSIONS = [
    'dashboard', 'loads', 'pipeline', 'drivers', 'trucks', 'brokers',
    'documents', 'settlements', 'expenses', 'alerts', 'reports', 'settings', 'users',
  ];

  // ── Default permissions per role ──────────────────────────
  const ROLE_DEFAULTS = {
    'Admin':      [...ALL_PERMISSIONS],
    'Dispatcher': ['dashboard', 'loads', 'pipeline', 'drivers', 'trucks', 'brokers', 'documents', 'expenses', 'alerts', 'reports'],
    'Driver':     ['dashboard', 'documents', 'alerts'],
  };

  const page = location.pathname.split('/').pop() || 'index.html';

  // Login page is always public
  if (page === 'login.html') {
    return {
      user: null,
      isLoggedIn: false,
      hasPermission: () => true,
      logout: () => {},
      ALL_PERMISSIONS,
      ROLE_DEFAULTS,
    };
  }

  // ── Check session ─────────────────────────────────────────
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    location.replace('login.html');
    // Return stub to prevent errors while redirecting
    return { user: null, isLoggedIn: false, hasPermission: () => false, logout: () => {}, ALL_PERMISSIONS, ROLE_DEFAULTS };
  }

  let user;
  try {
    user = JSON.parse(raw);
  } catch {
    localStorage.removeItem(SESSION_KEY);
    location.replace('login.html');
    return { user: null, isLoggedIn: false, hasPermission: () => false, logout: () => {}, ALL_PERMISSIONS, ROLE_DEFAULTS };
  }

  // ── Parse permissions ─────────────────────────────────────
  const perms = Array.isArray(user.permissions)
    ? user.permissions
    : (typeof user.permissions === 'string' ? user.permissions.split(',').map(s => s.trim()).filter(Boolean) : []);

  // ── Enforce page-level permission ─────────────────────────
  const pageKey = PAGE_MAP[page];
  if (pageKey && !perms.includes(pageKey)) {
    location.replace('index.html');
    return { user: null, isLoggedIn: false, hasPermission: () => false, logout: () => {}, ALL_PERMISSIONS, ROLE_DEFAULTS };
  }

  // ── Public API ────────────────────────────────────────────
  function hasPermission(key) {
    return perms.includes(key);
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    location.replace('login.html');
  }

  return { user, isLoggedIn: true, hasPermission, logout, ALL_PERMISSIONS, ROLE_DEFAULTS };
})();
