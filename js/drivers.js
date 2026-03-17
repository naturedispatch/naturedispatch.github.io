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
      App.fillSelect('driverCompany', _companiesCache, 'Company Name');
      App.fillSelect('driverTruck', _trucksCache, 'Truck Number');
    }

    const params = { 'sort[0][field]': 'Full Name', 'sort[0][direction]': 'asc' };
    const filter = App.companyFilter('Company');
    if (filter) params.filterByFormula = filter;

    const drivers = await Airtable.getAll(CONFIG.TABLES.DRIVERS, params);

    const filtersHtml = App.renderTableFilters({
      searchId: 'driversSearch',
      filters: [
        { id: 'filterDriverType', label: 'All Types', options: [
          {value:'W2',text:'W2'},{value:'1099',text:'1099'},{value:'Owner Operator',text:'Owner Operator'},{value:'Company Driver',text:'Company Driver'}
        ]},
        { id: 'filterAvailability', label: 'All Availability', options: [
          {value:'Available',text:'Available'},{value:'On Load',text:'On Load'},{value:'Off Duty',text:'Off Duty'},
          {value:'Home Time',text:'Home Time'},{value:'Out of Service',text:'Out of Service'}
        ]}
      ]
    });

    body.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <span class="text-muted">${drivers.length} driver(s)</span>
        <div class="d-flex gap-2">
          ${CSV.buttons('Drivers')}
          <button class="btn btn-nd" onclick="openNewDriver()"><i class="bi bi-plus-lg me-1"></i>New Driver</button>
        </div>
      </div>
      ${filtersHtml}
      <div class="table-container">
        <div class="table-responsive">
          <table class="table table-hover align-middle">
            <thead>
              <tr>
                <th>Full Name</th><th>E-mail</th><th>Phone</th><th>Company</th><th>Driver Type</th>
                <th>Pay Method</th><th>Assigned Truck</th><th>Availability</th><th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${drivers.map(d => driverRow(d)).join('')}
              ${drivers.length === 0 ? '<tr><td colspan="9" class="empty-state"><i class="bi bi-person-x"></i><p>No drivers found</p></td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>`;

    App.bindTableFilters({ searchId: 'driversSearch', filterIds: ['filterDriverType','filterAvailability'] });
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
  const companyName = App.lookupName(_companiesCache, f['Company'], 'Company Name');
  const truckName = App.lookupName(_trucksCache, f['Assigned Truck'], 'Truck Number');
  return `
  <tr data-filterDriverType="${f['Driver Type'] || ''}" data-filterAvailability="${f['Availability'] || ''}">
    <td class="fw-semibold">${f['Full Name'] || '—'}</td>
    <td>${f['E-mail'] || '—'}</td>
    <td>${f['Phone'] || '—'}</td>
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
    document.getElementById('driverEmail').value      = f['E-mail'] || '';
    document.getElementById('driverPhone').value      = f['Phone'] || '';
    document.getElementById('driverZip').value        = f['Zip Code'] || '';
    document.getElementById('driverHireDate').value   = f['Hire Date'] || '';
    document.getElementById('driverType').value       = f['Driver Type'] || '';
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
  const btn = document.getElementById('saveDriverBtn');
  const id = document.getElementById('driverRecordId').value;
  const fields = {
    'Full Name':    document.getElementById('driverName').value.trim(),
    'E-mail':       document.getElementById('driverEmail').value.trim() || null,
    'Phone':        document.getElementById('driverPhone').value.trim() || null,
    'Zip Code':     document.getElementById('driverZip').value.trim() || null,
    'Hire Date':    document.getElementById('driverHireDate').value || null,
    'Driver Type':  document.getElementById('driverType').value || null,
    'Pay Method':   document.getElementById('driverPayMethod').value,
    'Availability': document.getElementById('driverAvailability').value || null,
  };
  const company = document.getElementById('driverCompany').value;
  if (company) fields['Company'] = [company];
  const truck = document.getElementById('driverTruck').value;
  if (truck) fields['Assigned Truck'] = [truck];

  if (!fields['Full Name']) { App.showToast('Full Name is required', 'warning'); return; }

  await App.withLoading(btn, async () => {
    if (id) { await Airtable.update(CONFIG.TABLES.DRIVERS, id, fields); App.showToast('Driver updated!'); }
    else    { await Airtable.create(CONFIG.TABLES.DRIVERS, fields); App.showToast('Driver created!'); }
    bootstrap.Modal.getInstance(document.getElementById('driverModal')).hide();
    loadDriversPage();
  });
}

// ── Delete ────────────────────────────────────────────────
async function deleteDriver(id) {
  if (!confirm('Delete this driver?')) return;
  try { await Airtable.remove(CONFIG.TABLES.DRIVERS, id); App.showToast('Deleted.'); loadDriversPage(); }
  catch (err) { App.showToast(err.message, 'danger'); }
}
