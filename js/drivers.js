/**
 * ============================================================
 * NATURE DISPATCH TMS — Drivers Module (CRUD)
 * ============================================================
 */

App.init('Drivers', loadDriversPage);

let _companiesCache = [];
let _trucksCache = [];

async function loadDriversPage() {
  const body = document.getElementById('pageBody');

  try {
    if (_companiesCache.length === 0) {
      [_companiesCache, _trucksCache] = await Promise.all([
        Airtable.getAll(CONFIG.TABLES.COMPANIES),
        Airtable.getAll(CONFIG.TABLES.TRUCKS),
      ]);
      fillCompanySelect('driverCompany', _companiesCache);
      fillTruckSelect('driverTruck', _trucksCache);
    }

    const params = { 'sort[0][field]': 'Full Name', 'sort[0][direction]': 'asc' };
    const filter = App.companyFilter('Company');
    if (filter) params.filterByFormula = filter;

    const drivers = await Airtable.getAll(CONFIG.TABLES.DRIVERS, params);

    body.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <span class="text-muted">${drivers.length} driver(s)</span>
        <div class="d-flex gap-2">
          ${CSV.buttons('Drivers')}
          <button class="btn btn-nd" onclick="openNewDriver()"><i class="bi bi-plus-lg me-1"></i>New Driver</button>
        </div>
      </div>
      <div class="table-container">
        <div class="table-responsive">
          <table class="table table-hover align-middle">
            <thead>
              <tr>
                <th>Full Name</th><th>Company</th><th>Driver Type</th>
                <th>Pay Method</th><th>Assigned Truck</th><th>Availability</th><th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${drivers.map(d => driverRow(d)).join('')}
              ${drivers.length === 0 ? '<tr><td colspan="7" class="empty-state"><i class="bi bi-person-x"></i><p>No drivers found</p></td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    body.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

function availabilityBadge(status) {
  const map = {
    'Available':      'bg-success',
    'On Load':        'bg-primary',
    'Off Duty':       'bg-secondary',
    'Home Time':      'bg-warning text-dark',
    'Out of Service': 'bg-danger',
  };
  return `<span class="badge ${map[status] || 'bg-secondary'}">${status || '—'}</span>`;
}

function driverRow(rec) {
  const f = rec.fields;
  const companyName = lookupCompany(f['Company']);
  const truckName = lookupTruck(f['Assigned Truck']);
  return `
  <tr>
    <td class="fw-semibold">${f['Full Name'] || '—'}</td>
    <td>${companyName}</td>
    <td>${f['Driver Type'] || '—'}</td>
    <td>${f['Pay Method'] || '—'}</td>
    <td>${truckName}</td>
    <td>${availabilityBadge(f['Availability'])}</td>
    <td class="text-center text-nowrap">
      <button class="btn btn-sm btn-action btn-outline-secondary me-1" onclick="openEditDriver('${rec.id}')"><i class="bi bi-pencil"></i></button>
      <button class="btn btn-sm btn-action btn-outline-danger" onclick="deleteDriver('${rec.id}')"><i class="bi bi-trash"></i></button>
    </td>
  </tr>`;
}

function lookupCompany(ids) {
  if (!ids) return '—';
  const id = Array.isArray(ids) ? ids[0] : ids;
  const r = _companiesCache.find(c => c.id === id);
  return r ? r.fields['Company Name'] : '—';
}

function lookupTruck(ids) {
  if (!ids) return '—';
  const id = Array.isArray(ids) ? ids[0] : ids;
  const r = _trucksCache.find(c => c.id === id);
  return r ? (r.fields['Truck Number'] || r.id) : '—';
}

function fillTruckSelect(elId, trucks) {
  const sel = document.getElementById(elId);
  if (!sel) return;
  const placeholder = sel.querySelector('option');
  sel.innerHTML = '';
  sel.appendChild(placeholder);
  trucks.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.fields['Truck Number'] || t.id;
    sel.appendChild(opt);
  });
}

function fillCompanySelect(elId, companies) {
  const sel = document.getElementById(elId);
  if (!sel) return;
  const placeholder = sel.querySelector('option');
  sel.innerHTML = '';
  sel.appendChild(placeholder);
  companies.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.fields['Company Name'];
    sel.appendChild(opt);
  });
}

// ── Create ────────────────────────────────────────────────
function openNewDriver() {
  document.getElementById('driverModalTitle').textContent = 'New Driver';
  document.getElementById('driverForm').reset();
  document.getElementById('driverRecordId').value = '';
  new bootstrap.Modal(document.getElementById('driverModal')).show();
}

// ── Edit ──────────────────────────────────────────────────
async function openEditDriver(id) {
  try {
    const rec = await Airtable.getOne(CONFIG.TABLES.DRIVERS, id);
    const f = rec.fields;
    document.getElementById('driverModalTitle').textContent = `Edit — ${f['Full Name'] || ''}`;
    document.getElementById('driverRecordId').value = rec.id;
    document.getElementById('driverName').value       = f['Full Name'] || '';
    document.getElementById('driverType').value       = f['Driver Type'] || 'Company Driver';
    document.getElementById('driverPayMethod').value  = f['Pay Method'] || 'Per Mile';
    const cid = Array.isArray(f['Company']) ? f['Company'][0] : f['Company'] || '';
    document.getElementById('driverCompany').value = cid;
    const tid = Array.isArray(f['Assigned Truck']) ? f['Assigned Truck'][0] : f['Assigned Truck'] || '';
    document.getElementById('driverTruck').value = tid;
    document.getElementById('driverAvailability').value = f['Availability'] || '';
    new bootstrap.Modal(document.getElementById('driverModal')).show();
  } catch (err) { App.showToast(err.message, 'danger'); }
}

// ── Save ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('saveDriverBtn').addEventListener('click', saveDriver);
});

async function saveDriver() {
  const id = document.getElementById('driverRecordId').value;
  const fields = {
    'Full Name':    document.getElementById('driverName').value.trim(),
    'Driver Type':  document.getElementById('driverType').value,
    'Pay Method':   document.getElementById('driverPayMethod').value,
    'Availability': document.getElementById('driverAvailability').value || null,
  };
  const company = document.getElementById('driverCompany').value;
  if (company) fields['Company'] = [company];
  const truck = document.getElementById('driverTruck').value;
  if (truck) fields['Assigned Truck'] = [truck];

  if (!fields['Full Name']) { App.showToast('Full Name is required', 'warning'); return; }

  try {
    if (id) { await Airtable.update(CONFIG.TABLES.DRIVERS, id, fields); App.showToast('Driver updated!'); }
    else    { await Airtable.create(CONFIG.TABLES.DRIVERS, fields); App.showToast('Driver created!'); }
    bootstrap.Modal.getInstance(document.getElementById('driverModal')).hide();
    loadDriversPage();
  } catch (err) { App.showToast(err.message, 'danger'); }
}

// ── Delete ────────────────────────────────────────────────
async function deleteDriver(id) {
  if (!confirm('Delete this driver?')) return;
  try { await Airtable.remove(CONFIG.TABLES.DRIVERS, id); App.showToast('Deleted.'); loadDriversPage(); }
  catch (err) { App.showToast(err.message, 'danger'); }
}
