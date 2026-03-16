/**
 * ============================================================
 * NATURE DISPATCH TMS — Documents Module (BRD §7.4)
 * Track required documents for each load, identify missing
 * paperwork. Shows Rate Con PDF, BOL PDF, Invoice PDF status.
 * ============================================================
 */

App.init('Documents', loadDocumentsPage);

async function loadDocumentsPage() {
  const body = document.getElementById('pageBody');

  try {
    const params = { 'sort[0][field]': 'Load Number', 'sort[0][direction]': 'desc' };
    const filter = App.companyFilter('Company');
    if (filter) params.filterByFormula = filter;

    const loads = await Airtable.getAll(CONFIG.TABLES.LOADS, params);

    // Stats
    const complete = loads.filter(l => docCount(l.fields) === 3).length;
    const partial  = loads.filter(l => { const c = docCount(l.fields); return c > 0 && c < 3; }).length;
    const missing  = loads.filter(l => docCount(l.fields) === 0 && l.fields['Status'] !== 'Cancelled').length;

    body.innerHTML = `
      <!-- Document Stats -->
      <div class="row g-3 mb-4">
        <div class="col-sm-4">
          <div class="card stat-card p-3">
            <div class="d-flex align-items-center gap-3">
              <div class="stat-icon bg-success-subtle text-success"><i class="bi bi-file-earmark-check"></i></div>
              <div><div class="stat-value">${complete}</div><div class="stat-label">Complete (3/3)</div></div>
            </div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="card stat-card p-3">
            <div class="d-flex align-items-center gap-3">
              <div class="stat-icon bg-warning-subtle text-warning"><i class="bi bi-file-earmark-minus"></i></div>
              <div><div class="stat-value">${partial}</div><div class="stat-label">Partial</div></div>
            </div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="card stat-card p-3">
            <div class="d-flex align-items-center gap-3">
              <div class="stat-icon bg-danger-subtle text-danger"><i class="bi bi-file-earmark-x"></i></div>
              <div><div class="stat-value">${missing}</div><div class="stat-label">No Docs</div></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Filter buttons -->
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-outline-nd active" onclick="filterDocs('all', this)">All (${loads.length})</button>
          <button class="btn btn-outline-danger" onclick="filterDocs('missing', this)">Missing Docs (${missing + partial})</button>
          <button class="btn btn-outline-success" onclick="filterDocs('complete', this)">Complete (${complete})</button>
        </div>
        <span class="text-muted">${loads.length} load(s)</span>
      </div>

      <div class="table-container">
        <div class="table-responsive">
          <table class="table table-hover align-middle" id="docsTable">
            <thead>
              <tr>
                <th>Load #</th>
                <th>Status</th>
                <th class="text-center">Rate Con</th>
                <th class="text-center">BOL</th>
                <th class="text-center">Invoice</th>
                <th class="text-center">Score</th>
                <th>Invoice Status</th>
              </tr>
            </thead>
            <tbody>
              ${loads.map(l => docRow(l)).join('')}
              ${loads.length === 0 ? '<tr><td colspan="7" class="empty-state"><i class="bi bi-file-earmark-x"></i><p>No loads found</p></td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    body.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    console.error(err);
  }
}

function docCount(f) {
  return (f['Rate Con PDF']?.length > 0 ? 1 : 0) + (f['BOL PDF']?.length > 0 ? 1 : 0) + (f['Invoice PDF']?.length > 0 ? 1 : 0);
}

function docIcon(files, recordId, fieldName) {
  if (files && files.length > 0) {
    const url = files[0].url;
    return `<a href="${url}" target="_blank" class="text-success" title="View document"><i class="bi bi-check-circle-fill fs-5"></i></a>`;
  }
  return `<button class="btn btn-link p-0 text-danger border-0" title="Click to upload" onclick="uploadDocDirect('${recordId}','${fieldName}')"><i class="bi bi-cloud-arrow-up fs-5"></i></button>`;
}

function docRow(rec) {
  const f = rec.fields;
  const count = docCount(f);
  const scoreCls = count === 3 ? 'bg-success' : count > 0 ? 'bg-warning text-dark' : 'bg-danger';
  const invMap = { 'Not Ready': 'bg-secondary', 'Docs Missing': 'bg-warning text-dark', 'Ready to Invoice': 'bg-info', 'Invoiced': 'bg-primary', 'Paid': 'bg-success', 'Disputed': 'bg-danger' };

  return `
  <tr data-docs="${count}">
    <td class="fw-semibold">${f['Load Number'] || '—'}</td>
    <td>${App.statusBadge(f['Status'])}</td>
    <td class="text-center">${docIcon(f['Rate Con PDF'], rec.id, 'Rate Con PDF')}</td>
    <td class="text-center">${docIcon(f['BOL PDF'], rec.id, 'BOL PDF')}</td>
    <td class="text-center">${docIcon(f['Invoice PDF'], rec.id, 'Invoice PDF')}</td>
    <td class="text-center"><span class="badge ${scoreCls}">${count}/3</span></td>
    <td><span class="badge ${invMap[f['Invoice Status']] || 'bg-secondary'}">${f['Invoice Status'] || '—'}</span></td>
  </tr>`;
}

// ── Direct upload from documents page ───────────────────────
function uploadDocDirect(recordId, fieldName) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.png,.jpg,.jpeg,.doc,.docx';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    App.showToast(`Uploading ${fieldName}…`, 'info');
    try {
      await Airtable.uploadAttachment(CONFIG.TABLES.LOADS, recordId, fieldName, file);
      App.showToast(`${fieldName} uploaded!`, 'success');
      loadDocumentsPage();
    } catch (err) {
      App.showToast('Upload failed: ' + err.message, 'danger');
    }
  };
  input.click();
}

// ── Client-side filter ──────────────────────────────────────
function filterDocs(mode, btn) {
  // Toggle active button
  document.querySelectorAll('.btn-group .btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const rows = document.querySelectorAll('#docsTable tbody tr');
  rows.forEach(row => {
    const docs = parseInt(row.dataset.docs);
    if (mode === 'all') row.style.display = '';
    else if (mode === 'missing') row.style.display = docs < 3 ? '' : 'none';
    else if (mode === 'complete') row.style.display = docs === 3 ? '' : 'none';
  });
}
