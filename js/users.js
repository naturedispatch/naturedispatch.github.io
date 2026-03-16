/**
 * ============================================================
 * NATURE DISPATCH TMS — Users Module
 * ============================================================
 * CRUD for Users with role assignment, permission management,
 * and inline permission checkboxes.
 * Only accessible to users with the 'users' permission (Admin).
 * ============================================================
 */

App.init('Users', loadUsersPage);

// ── Permission labels (display names for each key) ──────────
const PERM_LABELS = {
  dashboard:   { icon: 'bi-speedometer2',       label: 'Dashboard' },
  loads:       { icon: 'bi-box-seam',            label: 'Loads' },
  pipeline:    { icon: 'bi-kanban',              label: 'Pipeline' },
  drivers:     { icon: 'bi-person-badge',        label: 'Drivers' },
  trucks:      { icon: 'bi-truck',               label: 'Trucks' },
  brokers:     { icon: 'bi-building',            label: 'Brokers' },
  documents:   { icon: 'bi-file-earmark-check',  label: 'Documents' },
  settlements: { icon: 'bi-calculator',          label: 'Settlements' },
  expenses:    { icon: 'bi-receipt',             label: 'Expenses' },
  alerts:      { icon: 'bi-bell',               label: 'Alerts' },
  reports:     { icon: 'bi-graph-up',            label: 'Reports' },
  settings:    { icon: 'bi-gear',               label: 'Settings' },
  users:       { icon: 'bi-people',             label: 'Users' },
};

let _companies = [];

async function loadUsersPage() {
  const body = document.getElementById('pageBody');

  try {
    const [users, companies] = await Promise.all([
      Airtable.getAll(CONFIG.TABLES.USERS, { 'sort[0][field]': 'Full Name', 'sort[0][direction]': 'asc' }),
      Airtable.getAll(CONFIG.TABLES.COMPANIES),
    ]);
    _companies = companies;

    const activeCount  = users.filter(u => u.fields['Status'] === 'Active').length;
    const adminCount   = users.filter(u => u.fields['Role'] === 'Admin').length;
    const dispCount    = users.filter(u => u.fields['Role'] === 'Dispatcher').length;
    const driverCount  = users.filter(u => u.fields['Role'] === 'Driver').length;

    body.innerHTML = `
      <!-- Stats -->
      <div class="row g-3 mb-4">
        <div class="col-sm-3">
          <div class="card stat-card p-3">
            <div class="d-flex align-items-center gap-3">
              <div class="stat-icon bg-primary-subtle text-primary"><i class="bi bi-people"></i></div>
              <div><div class="stat-value">${users.length}</div><div class="stat-label">Total Users</div></div>
            </div>
          </div>
        </div>
        <div class="col-sm-3">
          <div class="card stat-card p-3">
            <div class="d-flex align-items-center gap-3">
              <div class="stat-icon bg-success-subtle text-success"><i class="bi bi-check-circle"></i></div>
              <div><div class="stat-value">${activeCount}</div><div class="stat-label">Active</div></div>
            </div>
          </div>
        </div>
        <div class="col-sm-3">
          <div class="card stat-card p-3">
            <div class="d-flex align-items-center gap-3">
              <div class="stat-icon bg-danger-subtle text-danger"><i class="bi bi-shield-lock"></i></div>
              <div><div class="stat-value">${adminCount}</div><div class="stat-label">Admins</div></div>
            </div>
          </div>
        </div>
        <div class="col-sm-3">
          <div class="card stat-card p-3">
            <div class="d-flex align-items-center gap-3">
              <div class="stat-icon bg-info-subtle text-info"><i class="bi bi-headset"></i></div>
              <div><div class="stat-value">${dispCount}</div><div class="stat-label">Dispatchers</div></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="mb-0 fw-bold">All Users</h6>
        <button class="btn btn-nd btn-sm" onclick="openNewUser()">
          <i class="bi bi-person-plus me-1"></i>Add User
        </button>
      </div>

      <!-- Table -->
      <div class="table-container">
        <div class="table-responsive">
          <table class="table table-hover align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Permissions</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => userRow(u)).join('')}
              ${users.length === 0 ? '<tr><td colspan="6" class="empty-state"><i class="bi bi-people"></i><p>No users found</p></td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    body.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    console.error(err);
  }
}

function userRow(rec) {
  const f = rec.fields;
  const roleCls = { 'Admin': 'bg-danger', 'Dispatcher': 'bg-primary', 'Driver': 'bg-info' };
  const statusCls = f['Status'] === 'Active' ? 'bg-success' : 'bg-secondary';
  const perms = f['Permissions'] ? f['Permissions'].split(',').map(s => s.trim()).filter(Boolean) : [];
  const permBadges = perms.slice(0, 5).map(p => `<span class="badge bg-light text-dark me-1" style="font-size:.65rem">${p}</span>`).join('');
  const more = perms.length > 5 ? `<span class="text-muted" style="font-size:.65rem">+${perms.length - 5} more</span>` : '';

  // Highlight current logged-in user
  const isMe = Auth.user && Auth.user.id === rec.id;

  return `
  <tr>
    <td>
      <div class="d-flex align-items-center gap-2">
        <div class="user-avatar-sm">${(f['Full Name'] || '?')[0].toUpperCase()}</div>
        <div>
          <div class="fw-semibold">${f['Full Name'] || '—'}</div>
          ${isMe ? '<span class="badge bg-warning text-dark" style="font-size:.6rem">You</span>' : ''}
        </div>
      </div>
    </td>
    <td style="font-size:.85rem">${f['Email'] || '—'}</td>
    <td><span class="badge ${roleCls[f['Role']] || 'bg-secondary'}">${f['Role'] || '—'}</span></td>
    <td><span class="badge ${statusCls}">${f['Status'] || '—'}</span></td>
    <td>${permBadges}${more}</td>
    <td class="text-end">
      <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditUser('${rec.id}')" title="Edit">
        <i class="bi bi-pencil"></i>
      </button>
      ${!isMe ? `<button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${rec.id}','${(f['Full Name'] || '').replace(/'/g, "\\'")}')" title="Delete">
        <i class="bi bi-trash"></i>
      </button>` : ''}
    </td>
  </tr>`;
}

// ── Permission Grid ─────────────────────────────────────────
function renderPermGrid(selected = []) {
  const grid = document.getElementById('permGrid');
  if (!grid) return;
  grid.innerHTML = Auth.ALL_PERMISSIONS.map(key => {
    const p = PERM_LABELS[key] || { icon: 'bi-circle', label: key };
    const checked = selected.includes(key) ? 'checked' : '';
    return `
    <div class="col-6 col-md-4 col-lg-3">
      <div class="form-check perm-check">
        <input class="form-check-input" type="checkbox" id="perm_${key}" value="${key}" ${checked}>
        <label class="form-check-label" for="perm_${key}">
          <i class="bi ${p.icon} me-1"></i>${p.label}
        </label>
      </div>
    </div>`;
  }).join('');
}

function getSelectedPerms() {
  return Auth.ALL_PERMISSIONS.filter(key => {
    const cb = document.getElementById('perm_' + key);
    return cb && cb.checked;
  });
}

// ── New User ────────────────────────────────────────────────
function openNewUser() {
  document.getElementById('userModalTitle').textContent = 'New User';
  document.getElementById('userForm').reset();
  document.getElementById('userRecordId').value = '';
  document.getElementById('userPassword').required = true;
  document.getElementById('passwordHint').textContent = 'Min 4 characters';

  App.fillSelect('userCompany', _companies, 'Company Name');

  // Set default permissions for Dispatcher role
  renderPermGrid(Auth.ROLE_DEFAULTS['Dispatcher'] || []);

  new bootstrap.Modal(document.getElementById('userModal')).show();
}

// ── Edit User ───────────────────────────────────────────────
async function openEditUser(id) {
  const rec = await Airtable.getOne(CONFIG.TABLES.USERS, id);
  const f = rec.fields;

  document.getElementById('userModalTitle').textContent = 'Edit User';
  document.getElementById('userRecordId').value = rec.id;
  document.getElementById('userName').value = f['Full Name'] || '';
  document.getElementById('userEmail').value = f['Email'] || '';
  document.getElementById('userPassword').value = f['Password'] || '';
  document.getElementById('userPassword').required = false;
  document.getElementById('passwordHint').textContent = 'Leave unchanged to keep current password';
  document.getElementById('userRole').value = f['Role'] || 'Dispatcher';
  document.getElementById('userStatus').value = f['Status'] || 'Active';

  App.fillSelect('userCompany', _companies, 'Company Name');
  const companyId = Array.isArray(f['Company']) ? f['Company'][0] : f['Company'];
  if (companyId) document.getElementById('userCompany').value = companyId;

  // Load permissions
  const perms = f['Permissions'] ? f['Permissions'].split(',').map(s => s.trim()).filter(Boolean) : (Auth.ROLE_DEFAULTS[f['Role']] || []);
  renderPermGrid(perms);

  new bootstrap.Modal(document.getElementById('userModal')).show();
}

// ── Save User ───────────────────────────────────────────────
async function saveUser() {
  const btn = document.getElementById('saveUserBtn');
  const recordId = document.getElementById('userRecordId').value;
  const name = document.getElementById('userName').value.trim();
  const email = document.getElementById('userEmail').value.trim();
  const password = document.getElementById('userPassword').value;
  const role = document.getElementById('userRole').value;
  const status = document.getElementById('userStatus').value;
  const companyVal = document.getElementById('userCompany').value;
  const permissions = getSelectedPerms();

  if (!name || !email) {
    App.showToast('Name and Email are required', 'warning');
    return;
  }
  if (!recordId && (!password || password.length < 4)) {
    App.showToast('Password must be at least 4 characters', 'warning');
    return;
  }

  const fields = {
    'Full Name': name,
    'Email': email,
    'Role': role,
    'Status': status,
    'Permissions': permissions.join(','),
  };

  if (password) fields['Password'] = password;
  if (companyVal) fields['Company'] = [companyVal];

  await App.withLoading(btn, async () => {
    if (recordId) {
      await Airtable.update(CONFIG.TABLES.USERS, recordId, fields);

      // If editing own profile, update session
      if (Auth.user && Auth.user.id === recordId) {
        const session = {
          id: recordId,
          name,
          email,
          role,
          permissions,
          company: companyVal || null,
        };
        localStorage.setItem('nd_user', JSON.stringify(session));
      }

      App.showToast('User updated!');
    } else {
      await Airtable.create(CONFIG.TABLES.USERS, fields);
      App.showToast('User created!');
    }
    bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
    loadUsersPage();
  });
}

// ── Delete User ─────────────────────────────────────────────
async function deleteUser(id, name) {
  if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
  try {
    await Airtable.remove(CONFIG.TABLES.USERS, id);
    App.showToast('User deleted!');
    loadUsersPage();
  } catch (err) {
    App.showToast('Delete failed: ' + err.message, 'danger');
  }
}

// ── Event Listeners ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('saveUserBtn').addEventListener('click', saveUser);

  // Toggle password visibility
  document.getElementById('togglePasswordBtn').addEventListener('click', () => {
    const input = document.getElementById('userPassword');
    const icon = document.querySelector('#togglePasswordBtn i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'bi bi-eye-slash';
    } else {
      input.type = 'password';
      icon.className = 'bi bi-eye';
    }
  });

  // Auto-fill permissions when role changes
  document.getElementById('userRole').addEventListener('change', (e) => {
    const role = e.target.value;
    const defaults = Auth.ROLE_DEFAULTS[role] || [];
    renderPermGrid(defaults);
  });
});
