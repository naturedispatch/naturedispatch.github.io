/**
 * ============================================================
 * NATURE DISPATCH TMS — Trucks & Trailers Module (CRUD)
 * ============================================================
 */

App.init('Trucks', loadTrucksPage);

let _coCache = [];

async function loadTrucksPage() {
  const body = document.getElementById('pageBody');

  try {
    if (_coCache.length === 0) {
      _coCache = await Airtable.getAll(CONFIG.TABLES.COMPANIES);
      _fillCoSelect('truckCompany', _coCache);
    }

    const params = { 'sort[0][field]': 'Truck Number', 'sort[0][direction]': 'asc' };
    const filter = App.companyFilter('Company');
    if (filter) params.filterByFormula = filter;

    const trucks = await Airtable.getAll(CONFIG.TABLES.TRUCKS, params);

    body.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <span class="text-muted">${trucks.length} truck(s)</span>
        <div class="d-flex gap-2">
          ${CSV.buttons('Trucks')}
          <button class="btn btn-nd" onclick="openNewTruck()"><i class="bi bi-plus-lg me-1"></i>New Truck</button>
        </div>
      </div>
      <div class="table-container"><div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead><tr><th>Truck #</th><th>Company</th><th>VIN / Plate</th><th>Status</th><th class="text-center">Actions</th></tr></thead>
          <tbody>
            ${trucks.map(r => {
              const f = r.fields;
              const stCls = f['Status'] === 'Active' ? 'bg-success' : f['Status'] === 'In Maintenance' ? 'bg-warning text-dark' : 'bg-secondary';
              return `<tr>
                <td class="fw-semibold">${f['Truck Number'] || '—'}</td>
                <td>${_lookCo(f['Company'])}</td>
                <td><small>${f['VIN / Plate'] || '—'}</small></td>
                <td><span class="badge ${stCls}">${f['Status'] || 'N/A'}</span></td>
                <td class="text-center text-nowrap">
                  <button class="btn btn-sm btn-action btn-outline-secondary me-1" onclick="openEditTruck('${r.id}')"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-action btn-outline-danger" onclick="deleteTruck('${r.id}')"><i class="bi bi-trash"></i></button>
                </td>
              </tr>`;
            }).join('')}
            ${trucks.length === 0 ? '<tr><td colspan="5" class="empty-state"><i class="bi bi-truck"></i><p>No trucks found</p></td></tr>' : ''}
          </tbody>
        </table>
      </div></div>`;
  } catch (err) {
    body.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

function _lookCo(ids) {
  if (!ids) return '—';
  const id = Array.isArray(ids) ? ids[0] : ids;
  const r = _coCache.find(c => c.id === id);
  return r ? r.fields['Company Name'] : '—';
}

function _fillCoSelect(elId, cos) {
  const sel = document.getElementById(elId);
  if (!sel) return;
  const ph = sel.querySelector('option');
  sel.innerHTML = '';
  sel.appendChild(ph);
  cos.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.fields['Company Name']; sel.appendChild(o); });
}

// ── Create ──────────────────────────────────────────────────
function openNewTruck() {
  document.getElementById('truckModalTitle').textContent = 'New Truck';
  document.getElementById('truckForm').reset();
  document.getElementById('truckRecordId').value = '';
  new bootstrap.Modal(document.getElementById('truckModal')).show();
}

// ── Edit ────────────────────────────────────────────────────
async function openEditTruck(id) {
  try {
    const rec = await Airtable.getOne(CONFIG.TABLES.TRUCKS, id);
    const f = rec.fields;
    document.getElementById('truckModalTitle').textContent = 'Edit Truck';
    document.getElementById('truckRecordId').value = rec.id;
    document.getElementById('truckNumber').value  = f['Truck Number'] || '';
    document.getElementById('truckVin').value     = f['VIN / Plate'] || '';
    document.getElementById('truckStatus').value  = f['Status'] || 'Active';
    const cid = Array.isArray(f['Company']) ? f['Company'][0] : f['Company'] || '';
    document.getElementById('truckCompany').value = cid;
    new bootstrap.Modal(document.getElementById('truckModal')).show();
  } catch (err) { App.showToast(err.message, 'danger'); }
}

// ── Save ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('saveTruckBtn').addEventListener('click', saveTruck);
});

async function saveTruck() {
  const id = document.getElementById('truckRecordId').value;

  const fields = {
    'Truck Number': document.getElementById('truckNumber').value.trim(),
    'VIN / Plate':  document.getElementById('truckVin').value.trim(),
    Status:         document.getElementById('truckStatus').value,
  };
  const co = document.getElementById('truckCompany').value;
  if (co) fields['Company'] = [co];

  if (!fields['Truck Number']) { App.showToast('Truck Number is required', 'warning'); return; }

  try {
    if (id) { await Airtable.update(CONFIG.TABLES.TRUCKS, id, fields); App.showToast('Updated!'); }
    else    { await Airtable.create(CONFIG.TABLES.TRUCKS, fields); App.showToast('Created!'); }
    bootstrap.Modal.getInstance(document.getElementById('truckModal')).hide();
    loadTrucksPage();
  } catch (err) { App.showToast(err.message, 'danger'); }
}

// ── Delete ──────────────────────────────────────────────────
async function deleteTruck(id) {
  if (!confirm('Delete this truck?')) return;
  try { await Airtable.remove(CONFIG.TABLES.TRUCKS, id); App.showToast('Deleted.'); loadTrucksPage(); }
  catch (err) { App.showToast(err.message, 'danger'); }
}
