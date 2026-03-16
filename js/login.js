/**
 * ============================================================
 * NATURE DISPATCH TMS — Login Page Logic
 * ============================================================
 * Handles sign-in against the Airtable Users table.
 * Also handles first-time setup (create first Admin account).
 * ============================================================
 */

(async () => {
  // If already logged in, go to dashboard
  if (localStorage.getItem('nd_user')) {
    location.replace('index.html');
    return;
  }

  const loginCard = document.getElementById('loginCard');
  const setupCard = document.getElementById('setupCard');

  // ── Check if any users exist ────────────────────────────
  try {
    const users = await Airtable.getAll(CONFIG.TABLES.USERS, { maxRecords: 1 });
    if (users.length === 0) {
      // No users → show setup form
      loginCard.classList.add('d-none');
      setupCard.classList.remove('d-none');
    }
  } catch (err) {
    console.error('Could not check Users table:', err);
    // If table doesn't exist yet, show setup
    loginCard.classList.add('d-none');
    setupCard.classList.remove('d-none');
  }

  // ── Default permissions per role ──────────────────────────
  const ALL_PERMISSIONS = [
    'dashboard', 'loads', 'pipeline', 'drivers', 'trucks', 'brokers',
    'documents', 'settlements', 'expenses', 'alerts', 'reports', 'settings', 'users',
  ];
  const ROLE_DEFAULTS = {
    'Admin':      [...ALL_PERMISSIONS],
    'Dispatcher': ['dashboard', 'loads', 'pipeline', 'drivers', 'trucks', 'brokers', 'documents', 'expenses', 'alerts', 'reports'],
    'Driver':     ['dashboard', 'documents', 'alerts'],
  };

  // ── Login form ────────────────────────────────────────────
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');

    errorEl.classList.add('d-none');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Signing in…';

    try {
      // Query Airtable for matching email
      const filter = `AND(LOWER({Email})='${email}', {Status}='Active')`;
      const users = await Airtable.getAll(CONFIG.TABLES.USERS, { filterByFormula: filter });

      if (users.length === 0) {
        throw new Error('Invalid email or account is inactive.');
      }

      const user = users[0];
      const f = user.fields;

      // Check password (plain text comparison — no backend)
      if (f['Password'] !== password) {
        throw new Error('Invalid password.');
      }

      // Build session object
      const permsRaw = f['Permissions'] || '';
      const permissions = permsRaw
        ? permsRaw.split(',').map(s => s.trim()).filter(Boolean)
        : (ROLE_DEFAULTS[f['Role']] || ROLE_DEFAULTS['Driver']);

      const session = {
        id: user.id,
        name: f['Full Name'] || 'User',
        email: f['Email'],
        role: f['Role'] || 'Driver',
        permissions,
        company: f['Company'] || null,
      };

      localStorage.setItem('nd_user', JSON.stringify(session));
      location.replace('index.html');

    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('d-none');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i> Sign In';
    }
  });

  // ── Setup form (first Admin) ──────────────────────────────
  document.getElementById('setupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('setupName').value.trim();
    const email = document.getElementById('setupEmail').value.trim().toLowerCase();
    const password = document.getElementById('setupPassword').value;
    const errorEl = document.getElementById('setupError');
    const btn = document.getElementById('setupBtn');

    errorEl.classList.add('d-none');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Creating…';

    try {
      const permissions = ALL_PERMISSIONS.join(',');
      const created = await Airtable.create(CONFIG.TABLES.USERS, {
        'Full Name': name,
        'Email': email,
        'Password': password,
        'Role': 'Admin',
        'Status': 'Active',
        'Permissions': permissions,
      });

      // Auto-login with the new admin
      const session = {
        id: created.id,
        name,
        email,
        role: 'Admin',
        permissions: ALL_PERMISSIONS,
        company: null,
      };

      localStorage.setItem('nd_user', JSON.stringify(session));
      location.replace('index.html');

    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('d-none');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-person-plus me-1"></i> Create Admin Account';
    }
  });
})();
