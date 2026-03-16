/**
 * ============================================================
 * NATURE DISPATCH TMS — Loads Module (Full CRUD + BRD Features)
 * ETA tracking, Document control, Invoice readiness, Load Stops
 * ============================================================
 */

App.init('Loads', loadLoadsPage);

// Cache for dropdowns so we don't re-fetch on every render
let _companies = [], _brokers = [], _drivers = [], _trucks = [];

// Document field definitions for upload boxes
const DOC_FIELDS = [
  { inputId: 'fileRateCon', contentId: 'docRateCon', boxId: 'boxRateCon', field: 'Rate Con PDF', label: 'Rate Con' },
  { inputId: 'fileBOL',     contentId: 'docBOL',     boxId: 'boxBOL',     field: 'BOL PDF',     label: 'BOL' },
  { inputId: 'fileInvoice', contentId: 'docInvoice', boxId: 'boxInvoice', field: 'Invoice PDF', label: 'Invoice' },
];

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
    <td>${App.lookupName(_companies, f['Company'])}</td>
    <td>${App.lookupName(_brokers, f['Brokers/Shippers'])}</td>
    <td>${App.lookupName(_drivers, f['Driver'])}</td>
    <td>${App.lookupName(_trucks, f['Truck'])}</td>
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
  App.fillSelect('loadCompany', _companies, 'Company Name');
  App.fillSelect('loadBroker',  _brokers,  'Broker Name');
  App.fillSelect('loadDriver',  _drivers,  'Full Name');
  App.fillSelect('loadTruck',   _trucks,   'Truck Number');
}

// ── NEW Load ────────────────────────────────────────────────
function openNewLoad() {
  document.getElementById('loadModalTitle').textContent = 'New Load';
  document.getElementById('loadForm').reset();
  document.getElementById('loadRecordId').value = '';
  resetDocBoxes();
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

    // Render document upload boxes
    DOC_FIELDS.forEach(d => {
      const att = f[d.field];
      const input = document.getElementById(d.inputId);
      if (input) input.value = '';
      if (att && att.length > 0) {
        setDocBoxExisting(d.contentId, d.boxId, d.label, att[0]);
      } else {
        setDocBoxEmpty(d.contentId, d.boxId, d.inputId, d.label);
      }
    });

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
  document.getElementById('saveLoadBtn').addEventListener('click', saveLoad);  document.getElementById('addStopBtn').addEventListener('click', addStop);
  initDocBoxes();});

async function saveLoad() {
  const btn = document.getElementById('saveLoadBtn');
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

  await App.withLoading(btn, async () => {
    let savedId;
    if (recordId) {
      await Airtable.update(CONFIG.TABLES.LOADS, recordId, fields);
      savedId = recordId;
    } else {
      const created = await Airtable.create(CONFIG.TABLES.LOADS, fields);
      savedId = created.id;
    }

    // Upload any pending document files
    await uploadPendingDocs(savedId);

    App.showToast(recordId ? 'Load updated!' : 'Load created!');
    bootstrap.Modal.getInstance(document.getElementById('loadModal')).hide();
    loadLoadsPage();
  });
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

// ── DOCUMENT UPLOAD HELPERS ───────────────────────────────

function initDocBoxes() {
  DOC_FIELDS.forEach(({ inputId, boxId, contentId, label }) => {
    const box = document.getElementById(boxId);
    const input = document.getElementById(inputId);
    if (!box || !input) return;

    // Click on box → trigger file input (unless clicking a link)
    box.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      input.click();
    });

    // When file is selected → update display
    input.addEventListener('change', () => {
      if (input.files[0]) {
        setDocBoxPending(contentId, boxId, label, input.files[0].name);
      }
    });
  });
}

function resetDocBoxes() {
  DOC_FIELDS.forEach(d => setDocBoxEmpty(d.contentId, d.boxId, d.inputId, d.label));
}

function setDocBoxEmpty(contentId, boxId, inputId, label) {
  const content = document.getElementById(contentId);
  const box = document.getElementById(boxId);
  const input = document.getElementById(inputId);
  if (!content || !box) return;
  box.className = 'doc-upload-box';
  content.innerHTML = `
    <i class="bi bi-cloud-arrow-up doc-upload-icon"></i>
    <div class="doc-upload-label">${label}</div>
    <div class="doc-upload-hint">Click to upload</div>`;
  if (input) input.value = '';
}

function setDocBoxExisting(contentId, boxId, label, attachment) {
  const content = document.getElementById(contentId);
  const box = document.getElementById(boxId);
  if (!content || !box) return;
  box.className = 'doc-upload-box has-doc';
  const fname = attachment.filename || 'Document';
  content.innerHTML = `
    <i class="bi bi-file-earmark-check doc-upload-icon text-success"></i>
    <div class="doc-upload-label">${label}</div>
    <div class="doc-upload-filename" title="${fname}">${fname}</div>
    <div class="d-flex gap-1 mt-2 justify-content-center">
      <a href="${attachment.url}" target="_blank" class="btn btn-xs btn-outline-success"><i class="bi bi-eye me-1"></i>View</a>
    </div>
    <div class="doc-upload-hint mt-1">Click to replace</div>`;
}

function setDocBoxPending(contentId, boxId, label, filename) {
  const content = document.getElementById(contentId);
  const box = document.getElementById(boxId);
  if (!content || !box) return;
  box.className = 'doc-upload-box has-file';
  content.innerHTML = `
    <i class="bi bi-file-earmark-arrow-up doc-upload-icon text-primary"></i>
    <div class="doc-upload-label">${label}</div>
    <div class="doc-upload-filename" title="${filename}">${filename}</div>
    <div class="doc-upload-hint text-primary">Will upload on save</div>`;
}

async function uploadPendingDocs(recordId) {
  for (const { inputId, field, label } of DOC_FIELDS) {
    const input = document.getElementById(inputId);
    if (input?.files?.[0]) {
      try {
        await Airtable.uploadAttachment(CONFIG.TABLES.LOADS, recordId, field, input.files[0]);
      } catch (err) {
        App.showToast(`Failed to upload ${label}: ${err.message}`, 'warning');
      }
    }
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

async function addStop() {
  const body = document.getElementById('stopsBody');
  // If the inline form already exists, focus it
  if (document.getElementById('stopFormInline')) {
    document.getElementById('stopAddress').focus();
    return;
  }
  // Render inline form at top of stops body
  const formHtml = `
    <div id="stopFormInline" class="card p-3 mb-3" style="border:1.5px solid var(--nd-accent);border-radius:var(--nd-radius-sm);animation:fadeInUp .3s ease">
      <div class="row g-2 align-items-end">
        <div class="col-md-3">
          <label class="form-label">Type</label>
          <select class="form-select form-select-sm" id="stopType">
            <option value="Pickup">Pickup</option>
            <option value="Delivery">Delivery</option>
          </select>
        </div>
        <div class="col-md-4">
          <label class="form-label">Address</label>
          <input type="text" class="form-control form-control-sm" id="stopAddress" placeholder="Enter address…">
        </div>
        <div class="col-md-3">
          <label class="form-label">Appointment</label>
          <input type="datetime-local" class="form-control form-control-sm" id="stopDate">
        </div>
        <div class="col-md-2">
          <label class="form-label">Seq #</label>
          <input type="number" class="form-control form-control-sm" id="stopSeq" value="1" min="1">
        </div>
      </div>
      <div class="d-flex gap-2 mt-2">
        <button class="btn btn-sm btn-nd" id="stopSaveBtn" onclick="saveNewStop()"><i class="bi bi-check-lg me-1"></i>Save Stop</button>
        <button class="btn btn-sm btn-outline-secondary" onclick="document.getElementById('stopFormInline').remove()">Cancel</button>
      </div>
    </div>`;
  body.insertAdjacentHTML('afterbegin', formHtml);
  document.getElementById('stopAddress').focus();
}

async function saveNewStop() {
  const btn = document.getElementById('stopSaveBtn');
  const fields = {
    'Load Link':     [_currentLoadId],
    'Stop Type':     document.getElementById('stopType').value,
    'Address':       document.getElementById('stopAddress').value.trim() || '',
    'Stop Sequence': parseInt(document.getElementById('stopSeq').value) || 1,
  };
  const date = document.getElementById('stopDate').value;
  if (date) fields['Appointment Date/Time'] = new Date(date).toISOString();

  await App.withLoading(btn, async () => {
    await Airtable.create(CONFIG.TABLES.LOAD_STOPS, fields);
    App.showToast('Stop added!');
    openStops(_currentLoadId, document.getElementById('stopsLoadNum').textContent);
  });
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
