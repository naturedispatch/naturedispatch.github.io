/**
 * ============================================================
 * NATURE DISPATCH TMS — Loads Module (Full CRUD)
 * ============================================================
 */

App.init('Loads', loadLoadsPage);

// Cache for dropdowns so we don't re-fetch on every render
let _companies = [], _brokers = [], _drivers = [], _trucks = [];

async function loadLoadsPage() {
  const body = document.getElementById('pageBody');

  try {
    // Fetch supporting data for dropdowns (only first time)
    if (_companies.length === 0) {
      [_companies, _brokers, _drivers, _trucks] = await Promise.all([
        Airtable.getAll(CONFIG.TABLES.COMPANIES),
        Airtable.getAll(CONFIG.TABLES.BROKERS),
        Airtable.getAll(CONFIG.TABLES.DRIVERS),
        Airtable.getAll(CONFIG.TABLES.TRUCKS),
      ]);
      populateDropdowns();
    }

    // Fetch loads with optional company filter
    const params = { 'sort[0][field]': 'Load Number', 'sort[0][direction]': 'desc' };
    const filter = App.companyFilter('Company');
    if (filter) params.filterByFormula = filter;

    const loads = await Airtable.getAll(CONFIG.TABLES.LOADS, params);

    // ── Render table ────────────────────────────────────────
    body.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <span class="text-muted">${loads.length} load(s)</span>
        </div>
        <button class="btn btn-nd" onclick="openNewLoad()">
          <i class="bi bi-plus-lg me-1"></i>New Load
        </button>
      </div>

      <div class="table-container">
        <div class="table-responsive">
          <table class="table table-hover align-middle">
            <thead>
              <tr>
                <th>Load #</th>
                <th>Company</th>
                <th>Broker</th>
                <th>Driver</th>
                <th>Truck</th>
                <th>Revenue</th>
                <th>Miles</th>
                <th>Status</th>
                <th>Date</th>
                <th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${loads.map(l => loadRow(l)).join('')}
              ${loads.length === 0 ? '<tr><td colspan="10" class="empty-state"><i class="bi bi-inbox"></i><p>No loads found</p></td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    body.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    console.error(err);
  }
}

function loadRow(rec) {
  const f = rec.fields;
  return `
  <tr>
    <td class="fw-semibold">${f['Load Number'] || '—'}</td>
    <td>${lookupName(_companies, f['Company']) || '—'}</td>
    <td>${lookupName(_brokers, f['Broker']) || '—'}</td>
    <td>${lookupName(_drivers, f['Driver']) || '—'}</td>
    <td>${lookupName(_trucks, f['Truck']) || '—'}</td>
    <td>${App.formatCurrency(f['Revenue'])}</td>
    <td>${f['Miles'] || '—'}</td>
    <td>${App.statusBadge(f['Status'])}</td>
    <td>${App.formatDate(f['Date'])}</td>
    <td class="text-center text-nowrap">
      <button class="btn btn-sm btn-action btn-outline-primary me-1" title="Stops"
        onclick="openStops('${rec.id}', '${f['Load Number'] || ''}')">
        <i class="bi bi-geo-alt"></i>
      </button>
      <button class="btn btn-sm btn-action btn-outline-secondary me-1" title="Edit"
        onclick="openEditLoad('${rec.id}')">
        <i class="bi bi-pencil"></i>
      </button>
      <button class="btn btn-sm btn-action btn-outline-danger" title="Delete"
        onclick="deleteLoad('${rec.id}')">
        <i class="bi bi-trash"></i>
      </button>
    </td>
  </tr>`;
}

// ── Dropdown population ─────────────────────────────────────
function populateDropdowns() {
  fillSelect('loadCompany', _companies, 'Company Name');
  fillSelect('loadBroker',  _brokers,  'Broker Name');
  fillSelect('loadDriver',  _drivers,  'Full Name');
  fillSelect('loadTruck',   _trucks,   'Truck Number');
}

function fillSelect(id, records, nameField) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const first = sel.querySelector('option'); // keep placeholder
  sel.innerHTML = '';
  sel.appendChild(first);
  records.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.fields[nameField] || r.id;
    sel.appendChild(opt);
  });
}

// ── Lookup helper (resolve linked record ID → name) ─────────
function lookupName(cache, linkedIds) {
  if (!linkedIds) return '';
  const id = Array.isArray(linkedIds) ? linkedIds[0] : linkedIds;
  const rec = cache.find(r => r.id === id);
  return rec ? (rec.fields['Full Name'] || rec.fields['Broker Name'] || rec.fields['Company Name'] || rec.fields['Truck Number'] || rec.id) : '';
}

// ── NEW Load ────────────────────────────────────────────────
function openNewLoad() {
  document.getElementById('loadModalTitle').textContent = 'New Load';
  document.getElementById('loadForm').reset();
  document.getElementById('loadRecordId').value = '';
  new bootstrap.Modal(document.getElementById('loadModal')).show();
}

// ── EDIT Load ───────────────────────────────────────────────
async function openEditLoad(recordId) {
  try {
    const rec = await Airtable.getOne(CONFIG.TABLES.LOADS, recordId);
    const f = rec.fields;

    document.getElementById('loadModalTitle').textContent = `Edit Load — ${f['Load Number'] || ''}`;
    document.getElementById('loadRecordId').value = rec.id;
    document.getElementById('loadNumber').value  = f['Load Number'] || '';
    document.getElementById('loadStatus').value  = f['Status'] || 'New';
    document.getElementById('loadRevenue').value = f['Revenue'] || '';
    document.getElementById('loadDate').value    = f['Date'] || '';
    document.getElementById('loadMiles').value   = f['Miles'] || '';
    document.getElementById('loadNotes').value   = f['Notes'] || '';

    // Linked records (arrays)
    setSelectValue('loadCompany', f['Company']);
    setSelectValue('loadBroker',  f['Broker']);
    setSelectValue('loadDriver',  f['Driver']);
    setSelectValue('loadTruck',   f['Truck']);

    new bootstrap.Modal(document.getElementById('loadModal')).show();
  } catch (err) {
    App.showToast('Could not load record: ' + err.message, 'danger');
  }
}

function setSelectValue(id, linkedIds) {
  const el = document.getElementById(id);
  if (!el || !linkedIds) return;
  el.value = Array.isArray(linkedIds) ? linkedIds[0] : linkedIds;
}

// ── SAVE (Create or Update) ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('saveLoadBtn').addEventListener('click', saveLoad);
});

async function saveLoad() {
  const recordId = document.getElementById('loadRecordId').value;
  const fields = {
    'Load Number': document.getElementById('loadNumber').value.trim(),
    'Status':      document.getElementById('loadStatus').value,
    'Revenue':     parseFloat(document.getElementById('loadRevenue').value) || 0,
    'Date':        document.getElementById('loadDate').value || null,
    'Miles':       parseInt(document.getElementById('loadMiles').value) || 0,
    'Notes':       document.getElementById('loadNotes').value.trim(),
  };

  // Linked record fields → must be arrays
  const company = document.getElementById('loadCompany').value;
  const broker  = document.getElementById('loadBroker').value;
  const driver  = document.getElementById('loadDriver').value;
  const truck   = document.getElementById('loadTruck').value;

  if (company) fields['Company'] = [company];
  if (broker)  fields['Broker']  = [broker];
  if (driver)  fields['Driver']  = [driver];
  if (truck)   fields['Truck']   = [truck];

  if (!fields['Load Number']) {
    App.showToast('Load Number is required', 'warning');
    return;
  }

  try {
    if (recordId) {
      await Airtable.update(CONFIG.TABLES.LOADS, recordId, fields);
      App.showToast('Load updated!');
    } else {
      await Airtable.create(CONFIG.TABLES.LOADS, fields);
      App.showToast('Load created!');
    }
    bootstrap.Modal.getInstance(document.getElementById('loadModal')).hide();
    loadLoadsPage(); // refresh table
  } catch (err) {
    App.showToast('Save failed: ' + err.message, 'danger');
  }
}

// ── DELETE Load ─────────────────────────────────────────────
async function deleteLoad(recordId) {
  if (!confirm('Delete this load? This cannot be undone.')) return;
  try {
    await Airtable.remove(CONFIG.TABLES.LOADS, recordId);
    App.showToast('Load deleted.');
    loadLoadsPage();
  } catch (err) {
    App.showToast('Delete failed: ' + err.message, 'danger');
  }
}

// ── LOAD STOPS ──────────────────────────────────────────────
let _currentLoadId = '';

async function openStops(loadId, loadNum) {
  _currentLoadId = loadId;
  document.getElementById('stopsLoadNum').textContent = loadNum;

  try {
    const params = {
      filterByFormula: `FIND("${loadId}", ARRAYJOIN({Load}))`,
      'sort[0][field]': 'Sequence',
      'sort[0][direction]': 'asc',
    };
    const stops = await Airtable.getAll(CONFIG.TABLES.LOAD_STOPS, params);
    renderStops(stops);
    new bootstrap.Modal(document.getElementById('stopsModal')).show();
  } catch (err) {
    App.showToast('Could not load stops: ' + err.message, 'danger');
  }
}

function renderStops(stops) {
  const body = document.getElementById('stopsBody');
  if (stops.length === 0) {
    body.innerHTML = '<p class="text-muted text-center py-3">No stops yet. Click "Add Stop" to begin.</p>';
    return;
  }
  body.innerHTML = `
    <div class="table-responsive">
      <table class="table table-sm">
        <thead>
          <tr><th>#</th><th>Type</th><th>Address</th><th>Date</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${stops.map(s => {
            const f = s.fields;
            return `
            <tr>
              <td>${f['Sequence'] || ''}</td>
              <td><span class="badge ${f['Type'] === 'Pick' ? 'bg-info' : 'bg-success'}">${f['Type'] || ''}</span></td>
              <td>${f['Address'] || ''}</td>
              <td>${App.formatDate(f['Date'])}</td>
              <td>
                <button class="btn btn-sm btn-action btn-outline-danger" onclick="deleteStop('${s.id}')">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('addStopBtn').addEventListener('click', addStop);
});

async function addStop() {
  const type = prompt('Stop Type (Pick / Drop):');
  if (!type) return;
  const address  = prompt('Address:');
  const date     = prompt('Date (YYYY-MM-DD):');
  const sequence = prompt('Sequence #:');

  try {
    await Airtable.create(CONFIG.TABLES.LOAD_STOPS, {
      Load:     [_currentLoadId],
      Type:     type,
      Address:  address || '',
      Date:     date || null,
      Sequence: parseInt(sequence) || 1,
    });
    App.showToast('Stop added!');
    openStops(_currentLoadId, document.getElementById('stopsLoadNum').textContent);
  } catch (err) {
    App.showToast('Failed to add stop: ' + err.message, 'danger');
  }
}

async function deleteStop(stopId) {
  if (!confirm('Delete this stop?')) return;
  try {
    await Airtable.remove(CONFIG.TABLES.LOAD_STOPS, stopId);
    App.showToast('Stop deleted.');
    openStops(_currentLoadId, document.getElementById('stopsLoadNum').textContent);
  } catch (err) {
    App.showToast('Delete failed: ' + err.message, 'danger');
  }
}
