/**
 * ============================================================
 * NATURE DISPATCH TMS — Alerts Module (BRD §7.6)
 * Manages alerts: ETA delays, missing docs, overdue invoices
 * ============================================================
 */

App.init('Alerts', loadAlertsPage);

let _alertLoads = [], _alertDrivers = [];

async function loadAlertsPage() {
  const body = document.getElementById('pageBody');

  try {
    // Fetch supporting data for dropdowns
    if (_alertLoads.length === 0) {
      [_alertLoads, _alertDrivers] = await Promise.all([
        Airtable.getAll(CONFIG.TABLES.LOADS),
        Airtable.getAll(CONFIG.TABLES.DRIVERS),
      ]);
      populateAlertDropdowns();
    }

    const params = {
      'sort[0][field]': 'Due Date',
      'sort[0][direction]': 'desc',
    };

    const alerts = await Airtable.getAll(CONFIG.TABLES.ALERTS, params);

    // Stats
    const open = alerts.filter(a => a.fields['Status'] === 'Open').length;
    const ack  = alerts.filter(a => a.fields['Status'] === 'Acknowledged').length;
    const resolved = alerts.filter(a => a.fields['Status'] === 'Resolved').length;

    body.innerHTML = `
      <!-- Alert stats -->
      <div class="row g-3 mb-4">
        <div class="col-sm-4">
          <div class="card stat-card p-3">
            <div class="d-flex align-items-center gap-3">
              <div class="stat-icon bg-danger-subtle text-danger"><i class="bi bi-exclamation-circle"></i></div>
              <div><div class="stat-value">${open}</div><div class="stat-label">Open</div></div>
            </div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="card stat-card p-3">
            <div class="d-flex align-items-center gap-3">
              <div class="stat-icon bg-warning-subtle text-warning"><i class="bi bi-eye"></i></div>
              <div><div class="stat-value">${ack}</div><div class="stat-label">Acknowledged</div></div>
            </div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="card stat-card p-3">
            <div class="d-flex align-items-center gap-3">
              <div class="stat-icon bg-success-subtle text-success"><i class="bi bi-check-circle"></i></div>
              <div><div class="stat-value">${resolved}</div><div class="stat-label">Resolved</div></div>
            </div>
          </div>
        </div>
      </div>

      <div class="d-flex justify-content-between align-items-center mb-3">
        <span class="text-muted">${alerts.length} alert(s)</span>
        <button class="btn btn-nd" onclick="openNewAlert()"><i class="bi bi-plus-lg me-1"></i>New Alert</button>
      </div>

      <div class="table-container">
        <div class="table-responsive">
          <table class="table table-hover align-middle">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Related</th>
                <th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${alerts.map(a => alertRow(a)).join('')}
              ${alerts.length === 0 ? '<tr><td colspan="7" class="empty-state"><i class="bi bi-bell-slash"></i><p>No alerts</p></td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    body.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    console.error(err);
  }
}

function priorityBadge(prio) {
  const map = { 'Critical': 'bg-danger', 'High': 'bg-warning text-dark', 'Medium': 'bg-info', 'Low': 'bg-secondary' };
  const iconMap = { 'Critical': 'bi-exclamation-triangle-fill', 'High': 'bi-exclamation-circle-fill', 'Medium': 'bi-info-circle', 'Low': 'bi-dash-circle' };
  return `<span class="badge ${map[prio] || 'bg-secondary'}"><i class="bi ${iconMap[prio] || 'bi-circle'} me-1"></i>${prio || '—'}</span>`;
}

function alertStatusBadge(status) {
  const map = { 'Open': 'bg-danger', 'Acknowledged': 'bg-warning text-dark', 'Resolved': 'bg-success' };
  return `<span class="badge ${map[status] || 'bg-secondary'}">${status || '—'}</span>`;
}

function alertTypeBadge(type) {
  const map = { 'ETA Delay': 'bg-warning text-dark', 'Missing Document': 'bg-danger', 'Overdue Invoice': 'bg-purple', 'Driver Unavailable': 'bg-info', 'General': 'bg-secondary' };
  return `<span class="badge ${map[type] || 'bg-secondary'}">${type || '—'}</span>`;
}

function alertRow(rec) {
  const f = rec.fields;
  // Resolve related load/driver names
  let related = '';
  if (f['Load'] && f['Load'].length > 0) {
    const load = _alertLoads.find(l => l.id === f['Load'][0]);
    related += `<span class="badge bg-primary-subtle text-primary me-1"><i class="bi bi-box-seam me-1"></i>${load ? load.fields['Load Number'] : 'Load'}</span>`;
  }
  if (f['Driver'] && f['Driver'].length > 0) {
    const drv = _alertDrivers.find(d => d.id === f['Driver'][0]);
    related += `<span class="badge bg-info-subtle text-info"><i class="bi bi-person me-1"></i>${drv ? drv.fields['Full Name'] : 'Driver'}</span>`;
  }
  if (!related) related = '<span class="text-muted">—</span>';

  return `
  <tr class="${f['Status'] === 'Open' && f['Priority'] === 'Critical' ? 'table-danger' : f['Status'] === 'Open' ? 'table-warning' : ''}">
    <td>${priorityBadge(f['Priority'])}</td>
    <td class="fw-semibold">${f['Title'] || '—'}</td>
    <td>${alertTypeBadge(f['Type'])}</td>
    <td>${alertStatusBadge(f['Status'])}</td>
    <td>${App.formatDate(f['Due Date'])}</td>
    <td>${related}</td>
    <td class="text-center text-nowrap">
      ${f['Status'] === 'Open' ? `<button class="btn btn-sm btn-action btn-outline-warning me-1" title="Acknowledge" onclick="ackAlert('${rec.id}')"><i class="bi bi-eye"></i></button>` : ''}
      ${f['Status'] !== 'Resolved' ? `<button class="btn btn-sm btn-action btn-outline-success me-1" title="Resolve" onclick="resolveAlert('${rec.id}')"><i class="bi bi-check-lg"></i></button>` : ''}
      <button class="btn btn-sm btn-action btn-outline-secondary me-1" title="Edit" onclick="openEditAlert('${rec.id}')"><i class="bi bi-pencil"></i></button>
      <button class="btn btn-sm btn-action btn-outline-danger" title="Delete" onclick="deleteAlert('${rec.id}')"><i class="bi bi-trash"></i></button>
    </td>
  </tr>`;
}

// ── Dropdown population ─────────────────────────────────────
function populateAlertDropdowns() {
  const loadSel = document.getElementById('alertLoad');
  if (loadSel) {
    _alertLoads.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = l.fields['Load Number'] || l.id;
      loadSel.appendChild(opt);
    });
  }
  const drvSel = document.getElementById('alertDriver');
  if (drvSel) {
    _alertDrivers.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.fields['Full Name'] || d.id;
      drvSel.appendChild(opt);
    });
  }
}

// ── Quick actions ───────────────────────────────────────────
async function ackAlert(id) {
  try {
    await Airtable.update(CONFIG.TABLES.ALERTS, id, { 'Status': 'Acknowledged' });
    App.showToast('Alert acknowledged');
    loadAlertsPage();
  } catch (err) { App.showToast(err.message, 'danger'); }
}

async function resolveAlert(id) {
  try {
    await Airtable.update(CONFIG.TABLES.ALERTS, id, { 'Status': 'Resolved' });
    App.showToast('Alert resolved!');
    loadAlertsPage();
  } catch (err) { App.showToast(err.message, 'danger'); }
}

// ── NEW Alert ───────────────────────────────────────────────
function openNewAlert() {
  document.getElementById('alertModalTitle').textContent = 'New Alert';
  document.getElementById('alertForm').reset();
  document.getElementById('alertRecordId').value = '';
  new bootstrap.Modal(document.getElementById('alertModal')).show();
}

// ── EDIT Alert ──────────────────────────────────────────────
async function openEditAlert(recordId) {
  try {
    const rec = await Airtable.getOne(CONFIG.TABLES.ALERTS, recordId);
    const f = rec.fields;
    document.getElementById('alertModalTitle').textContent = `Edit Alert — ${f['Title'] || ''}`;
    document.getElementById('alertRecordId').value = rec.id;
    document.getElementById('alertTitle').value       = f['Title'] || '';
    document.getElementById('alertType').value        = f['Type'] || 'General';
    document.getElementById('alertPriority').value    = f['Priority'] || 'Medium';
    document.getElementById('alertStatus').value      = f['Status'] || 'Open';
    document.getElementById('alertDescription').value = f['Description'] || '';

    // Due Date
    const dueDateEl = document.getElementById('alertDueDate');
    if (f['Due Date']) {
      const d = new Date(f['Due Date']);
      const pad = n => String(n).padStart(2, '0');
      dueDateEl.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } else { dueDateEl.value = ''; }

    // Linked records
    if (f['Load'] && f['Load'].length > 0) document.getElementById('alertLoad').value = f['Load'][0];
    if (f['Driver'] && f['Driver'].length > 0) document.getElementById('alertDriver').value = f['Driver'][0];

    new bootstrap.Modal(document.getElementById('alertModal')).show();
  } catch (err) { App.showToast(err.message, 'danger'); }
}

// ── SAVE Alert ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('saveAlertBtn').addEventListener('click', saveAlert);
});

async function saveAlert() {
  const recordId = document.getElementById('alertRecordId').value;
  const fields = {
    'Title':       document.getElementById('alertTitle').value.trim(),
    'Type':        document.getElementById('alertType').value,
    'Priority':    document.getElementById('alertPriority').value,
    'Status':      document.getElementById('alertStatus').value,
    'Description': document.getElementById('alertDescription').value.trim(),
  };

  const dueDate = document.getElementById('alertDueDate').value;
  if (dueDate) fields['Due Date'] = new Date(dueDate).toISOString();

  const load   = document.getElementById('alertLoad').value;
  const driver = document.getElementById('alertDriver').value;
  if (load)   fields['Load']   = [load];
  if (driver) fields['Driver'] = [driver];

  if (!fields['Title']) { App.showToast('Title is required', 'warning'); return; }

  try {
    if (recordId) {
      await Airtable.update(CONFIG.TABLES.ALERTS, recordId, fields);
      App.showToast('Alert updated!');
    } else {
      await Airtable.create(CONFIG.TABLES.ALERTS, fields);
      App.showToast('Alert created!');
    }
    bootstrap.Modal.getInstance(document.getElementById('alertModal')).hide();
    loadAlertsPage();
  } catch (err) { App.showToast('Save failed: ' + err.message, 'danger'); }
}

// ── DELETE Alert ────────────────────────────────────────────
async function deleteAlert(id) {
  if (!confirm('Delete this alert?')) return;
  try {
    await Airtable.remove(CONFIG.TABLES.ALERTS, id);
    App.showToast('Alert deleted.');
    loadAlertsPage();
  } catch (err) { App.showToast(err.message, 'danger'); }
}
