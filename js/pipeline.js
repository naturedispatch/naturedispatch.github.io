/**
 * ============================================================
 * NATURE DISPATCH TMS — Pipeline / Kanban View for Loads
 * ============================================================
 * Drag-and-drop load cards between status columns to update
 * the load's Status in Airtable instantly.
 * ============================================================
 */

App.init('Pipeline', loadPipeline);

// Status columns in order
const PIPELINE_STATUSES = ['New', 'Dispatched', 'In Transit', 'Delivered', 'Invoiced', 'Paid', 'Cancelled'];

const STATUS_COLORS = {
  'New':        { bg: '#e0f2fe', border: '#0ea5e9', text: '#0369a1', icon: 'bi-plus-circle' },
  'Dispatched': { bg: '#e0e7ff', border: '#6366f1', text: '#4338ca', icon: 'bi-send' },
  'In Transit': { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', icon: 'bi-truck' },
  'Delivered':  { bg: '#d1fae5', border: '#10b981', text: '#065f46', icon: 'bi-check2-circle' },
  'Invoiced':   { bg: '#f1f5f9', border: '#64748b', text: '#334155', icon: 'bi-receipt' },
  'Paid':       { bg: '#d4d4d8', border: '#3f3f46', text: '#18181b', icon: 'bi-cash-stack' },
  'Cancelled':  { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', icon: 'bi-x-circle' },
};

let _allLoads = [];
let _drivers = [];
let _brokers = [];

async function loadPipeline() {
  const body = document.getElementById('pageBody');

  try {
    const params = { 'sort[0][field]': 'Load Number', 'sort[0][direction]': 'desc' };
    const filter = App.companyFilter('Company');
    if (filter) params.filterByFormula = filter;

    [_allLoads, _drivers, _brokers] = await Promise.all([
      Airtable.getAll(CONFIG.TABLES.LOADS, params),
      Airtable.getAll(CONFIG.TABLES.DRIVERS),
      Airtable.getAll(CONFIG.TABLES.BROKERS),
    ]);

    renderPipeline(body);
  } catch (err) {
    body.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    console.error(err);
  }
}

function renderPipeline(body) {
  // Group loads by status
  const grouped = {};
  PIPELINE_STATUSES.forEach(s => grouped[s] = []);
  _allLoads.forEach(l => {
    const s = l.fields['Status'] || 'New';
    if (grouped[s]) grouped[s].push(l);
    else grouped['New'].push(l);
  });

  body.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        <span class="text-muted">${_allLoads.length} load(s) across ${PIPELINE_STATUSES.length} stages</span>
      </div>
      <div class="d-flex gap-2">
        ${CSV.buttons('Loads')}
        <a href="loads.html" class="btn btn-sm btn-outline-nd ms-2">
          <i class="bi bi-table me-1"></i>Table View
        </a>
      </div>
    </div>
    <div class="pipeline-board" id="pipelineBoard">
      ${PIPELINE_STATUSES.map(status => {
        const col = STATUS_COLORS[status];
        const loads = grouped[status];
        return `
        <div class="pipeline-column" data-status="${status}">
          <div class="pipeline-column-header" style="border-color:${col.border}">
            <div class="d-flex align-items-center gap-2">
              <i class="bi ${col.icon}" style="color:${col.border}"></i>
              <span class="pipeline-column-title">${status}</span>
            </div>
            <span class="pipeline-count" style="background:${col.bg};color:${col.text}">${loads.length}</span>
          </div>
          <div class="pipeline-cards" data-status="${status}"
               ondrop="_onDrop(event)" ondragover="_onDragOver(event)" ondragenter="_onDragEnter(event)" ondragleave="_onDragLeave(event)">
            ${loads.map(l => _loadCard(l, col)).join('')}
            ${loads.length === 0 ? `<div class="pipeline-empty">Drop loads here</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

// ── Load Card ───────────────────────────────────────────────
function _loadCard(rec, col) {
  const f = rec.fields;
  const driverName = App.lookupName(_drivers, f['Driver']);
  const brokerName = App.lookupName(_brokers, f['Brokers/Shippers']);

  return `
  <div class="pipeline-card" draggable="true" data-id="${rec.id}"
       ondragstart="_onDragStart(event)" ondragend="_onDragEnd(event)">
    <div class="d-flex justify-content-between align-items-start mb-2">
      <span class="fw-bold" style="color:${col.text};font-size:.85rem">${f['Load Number'] || '—'}</span>
      <span style="font-size:.78rem;font-weight:700;color:var(--nd-secondary)">${App.formatCurrency(f['Revenue'])}</span>
    </div>
    ${brokerName ? `<div class="pipeline-detail"><i class="bi bi-building me-1"></i>${brokerName}</div>` : ''}
    ${driverName ? `<div class="pipeline-detail"><i class="bi bi-person me-1"></i>${driverName}</div>` : ''}
    ${f['Miles'] ? `<div class="pipeline-detail"><i class="bi bi-signpost-2 me-1"></i>${f['Miles']} mi</div>` : ''}
    ${f['ETA'] ? `<div class="pipeline-detail"><i class="bi bi-clock me-1"></i>ETA: ${App.formatDate(f['ETA'])}</div>` : ''}
    <div class="d-flex justify-content-between align-items-center mt-2 pt-2" style="border-top:1px solid rgba(0,0,0,.06)">
      <div class="d-flex gap-1">
        ${_miniDoc(f['Rate Con PDF'], 'RC')}
        ${_miniDoc(f['BOL PDF'], 'BOL')}
        ${_miniDoc(f['Invoice PDF'], 'INV')}
      </div>
      <div class="pipeline-drag-hint"><i class="bi bi-grip-vertical"></i></div>
    </div>
  </div>`;
}

function _miniDoc(att, label) {
  const has = att && att.length > 0;
  return `<span style="font-size:.6rem;font-weight:700;padding:2px 5px;border-radius:4px;background:${has ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.08)'};color:${has ? '#059669' : '#dc2626'}">${label}</span>`;
}

// ── Drag & Drop ─────────────────────────────────────────────
let _draggedId = null;

function _onDragStart(e) {
  _draggedId = e.target.dataset.id;
  e.target.classList.add('pipeline-card-dragging');
  e.dataTransfer.effectAllowed = 'move';
  // Highlight all columns
  document.querySelectorAll('.pipeline-cards').forEach(c => c.classList.add('pipeline-drop-zone'));
}

function _onDragEnd(e) {
  e.target.classList.remove('pipeline-card-dragging');
  document.querySelectorAll('.pipeline-cards').forEach(c => {
    c.classList.remove('pipeline-drop-zone', 'pipeline-drop-hover');
  });
}

function _onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function _onDragEnter(e) {
  e.preventDefault();
  const target = e.currentTarget;
  target.classList.add('pipeline-drop-hover');
}

function _onDragLeave(e) {
  // Only remove if leaving the container (not entering a child)
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('pipeline-drop-hover');
  }
}

async function _onDrop(e) {
  e.preventDefault();
  const target = e.currentTarget;
  target.classList.remove('pipeline-drop-hover');

  const newStatus = target.dataset.status;
  if (!_draggedId || !newStatus) return;

  // Find the load
  const load = _allLoads.find(l => l.id === _draggedId);
  if (!load) return;

  const oldStatus = load.fields['Status'];
  if (oldStatus === newStatus) return;

  // Optimistic update
  load.fields['Status'] = newStatus;
  renderPipeline(document.getElementById('pageBody'));

  try {
    await Airtable.update(CONFIG.TABLES.LOADS, _draggedId, { 'Status': newStatus });
    App.showToast(`Load ${load.fields['Load Number']} → ${newStatus}`, 'success');
  } catch (err) {
    // Rollback
    load.fields['Status'] = oldStatus;
    renderPipeline(document.getElementById('pageBody'));
    App.showToast('Update failed: ' + err.message, 'danger');
  }

  _draggedId = null;
}
