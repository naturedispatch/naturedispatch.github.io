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
    const filtersHtml = App.renderTableFilters({
      searchId: 'loadsSearch',
      dateId: 'loadsDate',
      filters: [
        { id: 'filterStatus', label: 'All Status', options: [
          {value:'Pending Approval',text:'Pending Approval'},{value:'New',text:'New'},{value:'Dispatched',text:'Dispatched'},{value:'In Transit',text:'In Transit'},
          {value:'Delivered',text:'Delivered'},{value:'Invoiced',text:'Invoiced'},{value:'Paid',text:'Paid'},{value:'Cancelled',text:'Cancelled'}
        ]},
        { id: 'filterInvoice', label: 'All Invoice', options: [
          {value:'Not Ready',text:'Not Ready'},{value:'Docs Missing',text:'Docs Missing'},{value:'Ready to Invoice',text:'Ready to Invoice'},
          {value:'Invoiced',text:'Invoiced'},{value:'Paid',text:'Paid'},{value:'Disputed',text:'Disputed'}
        ]}
      ]
    });

    body.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <span class="text-muted">${loads.length} load(s)</span>
        </div>
        <div class="d-flex gap-2">
          ${CSV.buttons('Loads')}
          <button class="btn btn-sm btn-outline-nd" onclick="openImportRateCon()">
            <i class="bi bi-robot me-1"></i>Import Rate Con
          </button>
          <button class="btn btn-nd" onclick="openNewLoad()">
            <i class="bi bi-plus-lg me-1"></i>New Load
          </button>
        </div>
      </div>
      ${filtersHtml}
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

    // Bind filter events
    App.bindTableFilters({ searchId: 'loadsSearch', filterIds: ['filterStatus','filterInvoice'], dateId: 'loadsDate' });
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
  const isPending = f['Status'] === 'Pending Approval';
  return `
  <tr data-filterStatus="${f['Status'] || ''}" data-filterInvoice="${f['Invoice Status'] || ''}" data-date="${f['Pickup Date'] || f['ETA'] || ''}">
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
      ${isPending ? `
      <button class="btn btn-sm btn-action btn-outline-success me-1" title="Approve Load"
        onclick="approveLoad('${rec.id}')">
        <i class="bi bi-check-lg"></i>
      </button>
      <button class="btn btn-sm btn-action btn-outline-danger me-1" title="Reject Load"
        onclick="rejectLoad('${rec.id}')">
        <i class="bi bi-x-lg"></i>
      </button>` : ''}
      <button class="btn btn-sm btn-action btn-outline-info me-1" title="View Details"
        onclick="openLoadDetail('${rec.id}')">
        <i class="bi bi-eye"></i>
      </button>
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

// ── Load Detail View ─────────────────────────────────────────
async function openLoadDetail(id) {
  const modal = new bootstrap.Modal(document.getElementById('loadDetailModal'));
  modal.show();
  const body = document.getElementById('loadDetailBody');
  body.innerHTML = '<div class="text-center py-4"><div class="spinner-border"></div></div>';

  try {
    const rec = await Airtable.getOne(CONFIG.TABLES.LOADS, id);
    const f = rec.fields;

    const companyName = App.lookupName(_companies, f['Company']);
    const brokerName  = App.lookupName(_brokers, f['Brokers/Shippers']);
    const driverName  = App.lookupName(_drivers, f['Driver']);
    const truckName   = App.lookupName(_trucks, f['Truck']);

    // Fetch load stops
    let stops = [];
    try {
      const allStops = await Airtable.getAll(CONFIG.TABLES.LOAD_STOPS, {
        filterByFormula: `FIND("${id}", ARRAYJOIN({Load Link}))`,
        'sort[0][field]': 'Stop Sequence', 'sort[0][direction]': 'asc'
      });
      stops = allStops;
    } catch (_) {}

    const _d = (v) => App.formatDate(v);
    const _c = (v) => App.formatCurrency(v);
    const _docLink = (arr, label) => {
      if (!arr || !arr.length) return `<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>${label} Missing</span>`;
      return `<a href="${arr[0].url}" target="_blank" class="badge bg-success text-decoration-none"><i class="bi bi-file-earmark-check me-1"></i>${label}</a>`;
    };

    body.innerHTML = `
      <div class="row g-4">
        <!-- Left: Load Info -->
        <div class="col-lg-7">
          <h6 class="text-muted text-uppercase mb-3" style="font-size:.72rem;letter-spacing:1px">Load Information</h6>
          <div class="row g-2 mb-3">
            <div class="col-6"><strong>Load #</strong><div>${f['Load Number'] || '—'}</div></div>
            <div class="col-6"><strong>Status</strong><div>${App.statusBadge(f['Status'])}</div></div>
            <div class="col-6"><strong>Company</strong><div>${companyName}</div></div>
            <div class="col-6"><strong>Broker</strong><div>${brokerName}</div></div>
            <div class="col-6"><strong>Driver</strong><div>${driverName}</div></div>
            <div class="col-6"><strong>Truck</strong><div>${truckName}</div></div>
          </div>
          <hr>
          <div class="row g-2 mb-3">
            <div class="col-4"><strong>Pickup</strong><div>${_d(f['Pickup Date'])}</div></div>
            <div class="col-4"><strong>Delivery</strong><div>${_d(f['Delivery Date'])}</div></div>
            <div class="col-4"><strong>ETA</strong><div>${etaDisplay(f['ETA'])}</div></div>
          </div>
          <div class="row g-2 mb-3">
            <div class="col-4"><strong>Revenue</strong><div class="fs-5 fw-bold text-success">${_c(f['Revenue'])}</div></div>
            <div class="col-4"><strong>Miles</strong><div>${f['Miles'] || '—'}
              <button class="btn btn-xs btn-outline-nd ms-2" onclick="calculateLoadDistance('${id}')" title="Calculate via Google Maps">
                <i class="bi bi-signpost-2"></i>
              </button>
            </div></div>
            <div class="col-4"><strong>Invoice Status</strong><div>${invoiceBadge(f['Invoice Status'])}</div></div>
          </div>
          ${f['Notes'] ? `<div class="mb-3"><strong>Notes</strong><div class="mt-1 p-2 bg-light rounded" style="font-size:.85rem">${f['Notes']}</div></div>` : ''}
        </div>
        <!-- Right: Documents & Stops -->
        <div class="col-lg-5">
          <h6 class="text-muted text-uppercase mb-3" style="font-size:.72rem;letter-spacing:1px">Documents</h6>
          <div class="d-flex flex-wrap gap-2 mb-4">
            ${_docLink(f['Rate Con PDF'], 'Rate Con')}
            ${_docLink(f['BOL PDF'], 'BOL')}
            ${_docLink(f['Invoice PDF'], 'Invoice')}
          </div>

          <h6 class="text-muted text-uppercase mb-3" style="font-size:.72rem;letter-spacing:1px">Load Stops (${stops.length})</h6>
          ${stops.length ? stops.map((s, i) => {
            const sf = s.fields;
            return `<div class="d-flex align-items-start gap-2 mb-2 p-2 rounded" style="background:#f8fafb;border:1px solid #e2e8f0">
              <span class="badge ${sf['Stop Type'] === 'Pickup' ? 'bg-primary' : 'bg-success'} mt-1">${sf['Stop Type'] || 'Stop'}</span>
              <div>
                <div style="font-size:.85rem;font-weight:500">${sf['Address'] || 'No address'}</div>
                <div style="font-size:.75rem;color:#94a3b8">${sf['Appointment Date/Time'] ? _d(sf['Appointment Date/Time']) : ''} • Seq #${sf['Stop Sequence'] || i+1}</div>
              </div>
            </div>`;
          }).join('') : '<p class="text-muted" style="font-size:.85rem">No stops added</p>'}
        </div>
      </div>`;

    document.getElementById('loadDetailTitle').textContent = `Load ${f['Load Number'] || ''} — Details`;
  } catch (err) {
    body.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// ██  RATE CON IMPORT — AI WORKFLOW                          ██
// ══════════════════════════════════════════════════════════════

let _importFile = null;
let _importData = null;    // parsed data from AI
let _importMiles = 0;      // calculated distance

function openImportRateCon() {
  _importFile = null;
  _importData = null;
  _importMiles = 0;
  document.getElementById('importStep1').style.display = '';
  document.getElementById('importStep2').style.display = 'none';
  document.getElementById('importStep3').style.display = 'none';
  document.getElementById('importCreateBtn').style.display = 'none';
  document.getElementById('importProcessBtn').disabled = true;
  document.getElementById('importFileName').textContent = '';
  document.getElementById('importFileInput').value = '';
  new bootstrap.Modal(document.getElementById('importRateConModal')).show();
}

// File selection (click + drag-and-drop)
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('importFileInput');
  const dropzone = document.getElementById('importDropzone');
  if (!input || !dropzone) return;

  input.addEventListener('change', () => {
    if (input.files[0]) {
      _importFile = input.files[0];
      document.getElementById('importFileName').innerHTML =
        `<i class="bi bi-file-earmark-pdf-fill me-1 text-danger"></i><strong>${_importFile.name}</strong> (${((_importFile.size)/1024).toFixed(1)} KB)`;
      document.getElementById('importProcessBtn').disabled = false;
    }
  });

  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
      _importFile = file;
      input.files = e.dataTransfer.files;
      document.getElementById('importFileName').innerHTML =
        `<i class="bi bi-file-earmark-pdf-fill me-1 text-danger"></i><strong>${_importFile.name}</strong> (${((_importFile.size)/1024).toFixed(1)} KB)`;
      document.getElementById('importProcessBtn').disabled = false;
    }
  });
});

async function processRateCon() {
  if (!_importFile) return;

  const apiKey = Gemini.getApiKey();
  if (!apiKey) {
    App.showToast('Gemini API key not configured. Go to Settings → Integrations.', 'warning');
    return;
  }

  // Step 2: show spinner
  document.getElementById('importStep1').style.display = 'none';
  document.getElementById('importStep2').style.display = '';

  try {
    const result = await Gemini.parseRateCon(_importFile);
    _importData = result;
    renderImportPreview(result);

    // Step 3: show preview
    document.getElementById('importStep2').style.display = 'none';
    document.getElementById('importStep3').style.display = '';
    document.getElementById('importCreateBtn').style.display = '';
  } catch (err) {
    console.error('AI parsing failed:', err);
    App.showToast('AI parsing failed: ' + err.message, 'danger');
    // Go back to step 1
    document.getElementById('importStep2').style.display = 'none';
    document.getElementById('importStep1').style.display = '';
  }
}

function renderImportPreview(data) {
  // Load info
  document.getElementById('aiLoadNumber').value = data.load_number || '';
  document.getElementById('aiRevenue').value    = data.revenue || '';
  document.getElementById('aiEquipment').value  = data.equipment_type || '';
  document.getElementById('aiWeight').value     = data.weight || '';
  document.getElementById('aiCommodity').value  = data.commodity || '';
  document.getElementById('aiNotes').value      = [data.special_instructions, data.notes].filter(Boolean).join('\n');

  // Company dropdown
  const compSel = document.getElementById('aiCompany');
  compSel.innerHTML = '<option value="">Select…</option>' +
    _companies.map(c => `<option value="${c.id}">${c.fields['Company Name'] || ''}</option>`).join('');

  // Broker info
  document.getElementById('aiBrokerName').textContent  = data.broker_name || '—';
  document.getElementById('aiBrokerMC').textContent    = data.broker_mc ? `MC# ${data.broker_mc}` : '';
  document.getElementById('aiBrokerPhone').textContent = data.broker_phone || '';
  document.getElementById('aiBrokerEmail').textContent = data.broker_email || '';

  // Stops
  const stopsEl = document.getElementById('aiStopsList');
  if (data.stops && data.stops.length) {
    stopsEl.innerHTML = data.stops.map((s, i) => `
      <div class="d-flex align-items-start gap-2 mb-2 p-2 rounded" style="background:#f8fafb;border:1px solid #e2e8f0">
        <span class="badge ${s.type === 'Pickup' ? 'bg-primary' : 'bg-success'} mt-1">${s.type || 'Stop'}</span>
        <div style="flex:1">
          <div style="font-size:.85rem;font-weight:500">${s.company_name || ''}</div>
          <div style="font-size:.8rem;color:#64748b">${[s.address, s.city, s.state, s.zip].filter(Boolean).join(', ')}</div>
          <div style="font-size:.75rem;color:#94a3b8">${s.date || ''} ${s.time || ''} ${s.reference ? '• Ref: ' + s.reference : ''}</div>
        </div>
      </div>`).join('');
  } else {
    stopsEl.innerHTML = '<p class="text-muted" style="font-size:.85rem">No stops detected</p>';
  }

  // Reset distance info
  document.getElementById('aiMilesValue').textContent = '—';
  document.getElementById('aiCalcDistBtn').disabled = false;
}

// ── Calculate distance from import preview stops ────────────
async function calcImportDistance() {
  const btn = document.getElementById('aiCalcDistBtn');
  if (!_importData || !_importData.stops || _importData.stops.length < 2) {
    App.showToast('Need at least 2 stops to calculate distance', 'warning');
    return;
  }

  const gmapsKey = GMaps.getApiKey();
  if (!gmapsKey) {
    App.showToast('Google Maps API key not configured. Go to Settings → Integrations.', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Calculating…';

  try {
    const addresses = _importData.stops.map(s =>
      [s.address, s.city, s.state, s.zip].filter(Boolean).join(', ')
    );
    const result = await GMaps.calculateRouteDistance(addresses);
    _importMiles = Math.round(result.totalMiles);
    document.getElementById('aiMilesValue').textContent = _importMiles.toLocaleString() + ' mi';
    document.getElementById('aiDistanceInfo').innerHTML = `
      <div style="font-size:.82rem;color:#64748b">
        ${result.legs.map((leg, i) =>
          `<div class="mb-1"><strong>Leg ${i+1}:</strong> ${leg.distanceText} (${leg.durationText})</div>`
        ).join('')}
      </div>
      <button class="btn btn-sm btn-outline-nd w-100 mt-2" onclick="calcImportDistance()">
        <i class="bi bi-arrow-clockwise me-2"></i>Recalculate
      </button>`;
    App.showToast(`Total distance: ${_importMiles} miles`);
  } catch (err) {
    console.error('Distance calc failed:', err);
    App.showToast('Distance calculation failed: ' + err.message, 'warning');
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-signpost-2 me-2"></i>Calculate Distance';
  }
}

// ── Create load from imported Rate Con ──────────────────────
async function createLoadFromImport() {
  const btn = document.getElementById('importCreateBtn');
  if (!_importData) return;

  await App.withLoading(btn, async () => {
    // Build load fields
    const fields = {
      'Load Number': document.getElementById('aiLoadNumber').value.trim() || _importData.load_number || 'AI-' + Date.now(),
      'Status':      'Pending Approval',
      'Revenue':     parseFloat(document.getElementById('aiRevenue').value) || 0,
      'Miles':       _importMiles || 0,
      'Notes':       document.getElementById('aiNotes').value || '',
    };

    // Link company if selected
    const company = document.getElementById('aiCompany').value;
    if (company) fields['Company'] = [company];

    // Try to match broker by name
    const brokerName = _importData.broker_name;
    if (brokerName) {
      const matchedBroker = _brokers.find(b =>
        (b.fields['Broker Name'] || '').toLowerCase().includes(brokerName.toLowerCase())
      );
      if (matchedBroker) fields['Brokers/Shippers'] = [matchedBroker.id];
    }

    // Create the load in Airtable
    const created = await Airtable.create(CONFIG.TABLES.LOADS, fields);
    const loadId = created.id;

    // Create stops from AI data
    if (_importData.stops && _importData.stops.length) {
      for (let i = 0; i < _importData.stops.length; i++) {
        const s = _importData.stops[i];
        const stopFields = {
          'Load Link':      [loadId],
          'Stop Type':      s.type === 'Delivery' ? 'Delivery' : 'Pickup',
          'Stop Sequence':  i + 1,
          'Address':        [s.address, s.city, s.state, s.zip].filter(Boolean).join(', '),
        };
        if (s.date) {
          try {
            stopFields['Appointment Date/Time'] = new Date(s.date + (s.time ? ' ' + s.time : '')).toISOString();
          } catch (_) {}
        }
        try {
          await Airtable.create(CONFIG.TABLES.LOAD_STOPS, stopFields);
        } catch (err) {
          console.warn(`Failed to create stop ${i + 1}:`, err);
        }
      }
    }

    // Upload the Rate Con PDF to the new load
    if (_importFile) {
      try {
        await Airtable.uploadAttachment(CONFIG.TABLES.LOADS, loadId, 'Rate Con PDF', _importFile);
      } catch (err) {
        console.warn('Rate Con upload failed:', err);
      }
    }

    App.showToast('Load created with Pending Approval status!', 'success');
    bootstrap.Modal.getInstance(document.getElementById('importRateConModal')).hide();
    loadLoadsPage();
  });
}

// ══════════════════════════════════════════════════════════════
// ██  ADMIN APPROVAL / REJECT WORKFLOW                       ██
// ══════════════════════════════════════════════════════════════

async function approveLoad(recordId) {
  if (!confirm('Approve this load and change status to "New"?')) return;
  try {
    await Airtable.update(CONFIG.TABLES.LOADS, recordId, { 'Status': 'New' });
    App.showToast('Load approved! Status changed to New.', 'success');
    loadLoadsPage();
  } catch (err) {
    App.showToast('Approve failed: ' + err.message, 'danger');
  }
}

async function rejectLoad(recordId) {
  if (!confirm('Reject this load? Status will be set to "Cancelled".')) return;
  try {
    await Airtable.update(CONFIG.TABLES.LOADS, recordId, { 'Status': 'Cancelled' });
    App.showToast('Load rejected. Status changed to Cancelled.', 'warning');
    loadLoadsPage();
  } catch (err) {
    App.showToast('Reject failed: ' + err.message, 'danger');
  }
}

// ══════════════════════════════════════════════════════════════
// ██  GOOGLE MAPS DISTANCE — EXISTING LOADS                  ██
// ══════════════════════════════════════════════════════════════

async function calculateLoadDistance(loadId) {
  const gmapsKey = GMaps.getApiKey();
  if (!gmapsKey) {
    App.showToast('Google Maps API key not configured. Go to Settings → Integrations.', 'warning');
    return;
  }

  App.showToast('Calculating distance…', 'info');

  try {
    // Fetch stops for this load
    const stops = await Airtable.getAll(CONFIG.TABLES.LOAD_STOPS, {
      filterByFormula: `FIND("${loadId}", ARRAYJOIN({Load Link}))`,
      'sort[0][field]': 'Stop Sequence',
      'sort[0][direction]': 'asc',
    });

    if (stops.length < 2) {
      App.showToast('Need at least 2 stops to calculate distance.', 'warning');
      return;
    }

    const addresses = stops.map(s => s.fields['Address']).filter(Boolean);
    if (addresses.length < 2) {
      App.showToast('Stops are missing addresses.', 'warning');
      return;
    }

    const result = await GMaps.calculateRouteDistance(addresses);
    const miles = Math.round(result.totalMiles);

    // Update the load record with calculated miles
    await Airtable.update(CONFIG.TABLES.LOADS, loadId, { 'Miles': miles });

    App.showToast(`Distance calculated: ${miles} miles. Load updated!`, 'success');
    loadLoadsPage();
  } catch (err) {
    App.showToast('Distance calculation failed: ' + err.message, 'danger');
    console.error(err);
  }
}
