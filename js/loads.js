/**
 * ============================================================
 * NATURE DISPATCH TMS — Loads Module (Full CRUD + BRD Features)
 * ETA tracking, Document control, Invoice readiness, Load Stops
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
        <div class="d-flex gap-2">
          ${CSV.buttons('Loads')}
          <a href="pipeline.html" class="btn btn-sm btn-outline-nd"><i class="bi bi-kanban me-1"></i>Pipeline</a>
          <button class="btn btn-nd" onclick="openNewLoad()">
            <i class="bi bi-plus-lg me-1"></i>New Load
          </button>
        </div>
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
                <th>ETA</th>
                <th>Docs</th>
                <th>Invoice</th>
                <th>Status</th>
                <th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${loads.map(l => loadRow(l)).join('')}
              ${loads.length === 0 ? '<tr><td colspan="11" class="empty-state"><i class="bi bi-inbox"></i><p>No loads found</p></td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    body.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    console.error(err);
  }
}

// ── Document status helper ──────────────────────────────────
function docStatus(fields) {
  const hasRateCon = fields['Rate Con PDF'] && fields['Rate Con PDF'].length > 0;
  const hasBOL     = fields['BOL PDF'] && fields['BOL PDF'].length > 0;
  const hasInvoice = fields['Invoice PDF'] && fields['Invoice PDF'].length > 0;
  const count = (hasRateCon ? 1 : 0) + (hasBOL ? 1 : 0) + (hasInvoice ? 1 : 0);
  if (count === 3) return '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>3/3</span>';
  if (count > 0)   return `<span class="badge bg-warning text-dark"><i class="bi bi-exclamation-circle me-1"></i>${count}/3</span>`;
  return '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>0/3</span>';
}

// ── Invoice status badge ────────────────────────────────────
function invoiceBadge(status) {
  const map = {
    'Not Ready':        'bg-secondary',
    'Docs Missing':     'bg-warning text-dark',
    'Ready to Invoice': 'bg-info',
    'Invoiced':         'bg-primary',
    'Paid':             'bg-success',
    'Disputed':         'bg-danger',
  };
  return `<span class="badge ${map[status] || 'bg-secondary'}">${status || '—'}</span>`;
}

// ── ETA display helper ──────────────────────────────────────
function etaDisplay(eta) {
  if (!eta) return '<span class="text-muted">—</span>';
  const etaDate = new Date(eta);
  const now = new Date();
  const diffHrs = (etaDate - now) / (1000 * 60 * 60);
  let cls = 'text-muted';
  if (diffHrs < 0) cls = 'text-danger fw-bold';        // overdue
  else if (diffHrs < 2) cls = 'text-warning fw-bold';  // arriving soon
  else cls = 'text-success';
  return `<span class="${cls}">${App.formatDate(eta)}</span>`;
}

function loadRow(rec) {
  const f = rec.fields;
  return `
  <tr>
    <td class="fw-semibold">${f['Load Number'] || '—'}</td>
    <td>${lookupName(_companies, f['Company']) || '—'}</td>
    <td>${lookupName(_brokers, f['Brokers/Shippers']) || '—'}</td>
    <td>${lookupName(_drivers, f['Driver']) || '—'}</td>
    <td>${lookupName(_trucks, f['Truck']) || '—'}</td>
    <td>${App.formatCurrency(f['Revenue'])}</td>
    <td>${etaDisplay(f['ETA'])}</td>
    <td>${docStatus(f)}</td>
    <td>${invoiceBadge(f['Invoice Status'])}</td>
    <td>${App.statusBadge(f['Status'])}</td>
    <td class="text-center text-nowrap">
      <button class="btn btn-sm btn-action btn-outline-primary me-1" title="Stops"
        onclick="openStops('${rec.id}', '${(f['Load Number'] || '').replace(/'/g, "\\'")}')">
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
  const indicator = document.getElementById('loadDocsIndicator');
  if (indicator) indicator.innerHTML = '<i class="bi bi-file-earmark me-1"></i>Save load first, then upload docs in Airtable';
  new bootstrap.Modal(document.getElementById('loadModal')).show();
}

// ── EDIT Load ───────────────────────────────────────────────
async function openEditLoad(recordId) {
  try {
    const rec = await Airtable.getOne(CONFIG.TABLES.LOADS, recordId);
    const f = rec.fields;

    document.getElementById('loadModalTitle').textContent = `Edit Load — ${f['Load Number'] || ''}`;
    document.getElementById('loadRecordId').value = rec.id;
    document.getElementById('loadNumber').value       = f['Load Number'] || '';
    document.getElementById('loadStatus').value       = f['Status'] || 'New';
    document.getElementById('loadRevenue').value      = f['Revenue'] || '';
    document.getElementById('loadMiles').value        = f['Miles'] || '';
    document.getElementById('loadNotes').value        = f['Notes'] || '';
    document.getElementById('loadInvoiceStatus').value = f['Invoice Status'] || '';

    // DateTime fields (convert from ISO to datetime-local format)
    setDateTimeInput('loadPickupDate', f['Pickup Date']);
    setDateTimeInput('loadDeliveryDate', f['Delivery Date']);
    setDateTimeInput('loadETA', f['ETA']);

    // Linked records (arrays)
    setSelectValue('loadCompany', f['Company']);
    setSelectValue('loadBroker',  f['Brokers/Shippers']);
    setSelectValue('loadDriver',  f['Driver']);
    setSelectValue('loadTruck',   f['Truck']);

    // Document indicator
    const indicator = document.getElementById('loadDocsIndicator');
    if (indicator) {
      const hasRateCon = f['Rate Con PDF'] && f['Rate Con PDF'].length > 0;
      const hasBOL     = f['BOL PDF'] && f['BOL PDF'].length > 0;
      const hasInvoice = f['Invoice PDF'] && f['Invoice PDF'].length > 0;
      indicator.innerHTML = `
        <span class="${hasRateCon ? 'text-success' : 'text-danger'}"><i class="bi bi-${hasRateCon ? 'check' : 'x'}-circle me-1"></i>Rate Con</span>
        <span class="mx-1">|</span>
        <span class="${hasBOL ? 'text-success' : 'text-danger'}"><i class="bi bi-${hasBOL ? 'check' : 'x'}-circle me-1"></i>BOL</span>
        <span class="mx-1">|</span>
        <span class="${hasInvoice ? 'text-success' : 'text-danger'}"><i class="bi bi-${hasInvoice ? 'check' : 'x'}-circle me-1"></i>Invoice</span>`;
    }

    new bootstrap.Modal(document.getElementById('loadModal')).show();
  } catch (err) {
    App.showToast('Could not load record: ' + err.message, 'danger');
  }
}

function setDateTimeInput(id, isoValue) {
  const el = document.getElementById(id);
  if (!el || !isoValue) { if (el) el.value = ''; return; }
  // Convert ISO to datetime-local format (YYYY-MM-DDTHH:MM)
  const d = new Date(isoValue);
  const pad = n => String(n).padStart(2, '0');
  el.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    'Load Number':    document.getElementById('loadNumber').value.trim(),
    'Status':         document.getElementById('loadStatus').value,
    'Revenue':        parseFloat(document.getElementById('loadRevenue').value) || 0,
    'Miles':          parseInt(document.getElementById('loadMiles').value) || 0,
    'Notes':          document.getElementById('loadNotes').value.trim(),
    'Invoice Status': document.getElementById('loadInvoiceStatus').value || null,
  };

  // DateTime fields → convert to ISO
  const pickup   = document.getElementById('loadPickupDate').value;
  const delivery = document.getElementById('loadDeliveryDate').value;
  const eta      = document.getElementById('loadETA').value;
  if (pickup)   fields['Pickup Date']   = new Date(pickup).toISOString();
  if (delivery) fields['Delivery Date'] = new Date(delivery).toISOString();
  if (eta)      fields['ETA']           = new Date(eta).toISOString();

  // Linked record fields → must be arrays
  const company = document.getElementById('loadCompany').value;
  const broker  = document.getElementById('loadBroker').value;
  const driver  = document.getElementById('loadDriver').value;
  const truck   = document.getElementById('loadTruck').value;

  if (company) fields['Company']          = [company];
  if (broker)  fields['Brokers/Shippers'] = [broker];
  if (driver)  fields['Driver']           = [driver];
  if (truck)   fields['Truck']            = [truck];

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
// Airtable field names: Load Link, Stop Type, Stop Sequence, Appointment Date/Time, Address
let _currentLoadId = '';

async function openStops(loadId, loadNum) {
  _currentLoadId = loadId;
  document.getElementById('stopsLoadNum').textContent = loadNum;

  try {
    const params = {
      filterByFormula: `FIND("${loadId}", ARRAYJOIN({Load Link}))`,
      'sort[0][field]': 'Stop Sequence',
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
          <tr><th>#</th><th>Type</th><th>Address</th><th>Appointment</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${stops.map(s => {
            const f = s.fields;
            return `
            <tr>
              <td>${f['Stop Sequence'] || ''}</td>
              <td><span class="badge ${f['Stop Type'] === 'Pickup' ? 'bg-info' : 'bg-success'}">${f['Stop Type'] || ''}</span></td>
              <td>${f['Address'] || ''}</td>
              <td>${App.formatDate(f['Appointment Date/Time'])}</td>
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
  const type = prompt('Stop Type (Pickup / Delivery):');
  if (!type) return;
  const address  = prompt('Address:');
  const date     = prompt('Appointment Date/Time (YYYY-MM-DD HH:MM):');
  const sequence = prompt('Stop Sequence #:');

  const fields = {
    'Load Link':  [_currentLoadId],
    'Stop Type':  type,
    'Address':    address || '',
    'Stop Sequence': parseInt(sequence) || 1,
  };
  if (date) fields['Appointment Date/Time'] = new Date(date).toISOString();

  try {
    await Airtable.create(CONFIG.TABLES.LOAD_STOPS, fields);
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
