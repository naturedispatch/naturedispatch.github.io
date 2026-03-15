/**
 * ============================================================
 * NATURE DISPATCH TMS — Settlements Module (CRUD)
 * Most totals are Airtable rollups/formulas (read-only here).
 * We only create/edit: Week Ending + Driver link.
 * ============================================================
 */

App.init('Settlements', loadSettlementsPage);

let _sDrivers = [];

async function loadSettlementsPage() {
  const body = document.getElementById('pageBody');
  try {
    if (_sDrivers.length === 0) {
      _sDrivers = await Airtable.getAll(CONFIG.TABLES.DRIVERS);
      _fillSel('settlementDriver', _sDrivers, 'Full Name');
    }

    const params = { 'sort[0][field]': 'Week Ending', 'sort[0][direction]': 'desc' };

    const settlements = await Airtable.getAll(CONFIG.TABLES.SETTLEMENTS, params);

    body.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <span class="text-muted">${settlements.length} settlement(s)</span>
        <div class="d-flex gap-2">
          ${CSV.buttons('Settlements')}
          <button class="btn btn-nd" onclick="openNewSettlement()"><i class="bi bi-plus-lg me-1"></i>New Settlement</button>
        </div>
      </div>
      <div class="table-container"><div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead><tr>
            <th>Week Ending</th><th>Driver</th><th>Gross Revenue</th>
            <th>Fuel</th><th>Tolls</th><th>Expenses</th>
            <th class="text-success">Net Pay</th><th class="text-center">Actions</th>
          </tr></thead>
          <tbody>
            ${settlements.map(s => settlementRow(s)).join('')}
            ${settlements.length === 0 ? '<tr><td colspan="8" class="empty-state"><i class="bi bi-calculator"></i><p>No settlements</p></td></tr>' : ''}
          </tbody>
        </table>
      </div></div>`;
  } catch (err) { body.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
}

function settlementRow(rec) {
  const f = rec.fields;
  const revenue  = parseFloat(f['Total Gross Revenue']) || 0;
  const fuel     = parseFloat(f['Total Fuel']) || 0;
  const tolls    = parseFloat(f['Total Tolls']) || 0;
  const expenses = parseFloat(f['Total Expenses']) || 0;
  const net      = parseFloat(f['Net Pay']) || (revenue - fuel - tolls - expenses);

  const driverName = _lookupName(_sDrivers, f['Driver']);

  return `<tr>
    <td class="fw-semibold">${App.formatDate(f['Week Ending'])}</td>
    <td>${driverName}</td>
    <td>${App.formatCurrency(revenue)}</td>
    <td class="text-danger">${App.formatCurrency(fuel)}</td>
    <td class="text-danger">${App.formatCurrency(tolls)}</td>
    <td class="text-danger">${App.formatCurrency(expenses)}</td>
    <td class="fw-bold text-success">${App.formatCurrency(net)}</td>
    <td class="text-center text-nowrap">
      <button class="btn btn-sm btn-action btn-outline-secondary me-1" onclick="openEditSettlement('${rec.id}')"><i class="bi bi-pencil"></i></button>
      <button class="btn btn-sm btn-action btn-outline-danger" onclick="deleteSettlement('${rec.id}')"><i class="bi bi-trash"></i></button>
    </td>
  </tr>`;
}

function _lookupName(cache, ids) {
  if (!ids) return '—';
  const id = Array.isArray(ids) ? ids[0] : ids;
  const r = cache.find(c => c.id === id);
  return r ? (r.fields['Full Name'] || r.fields['Company Name'] || r.id) : '—';
}

function _fillSel(elId, records, field) {
  const sel = document.getElementById(elId);
  if (!sel) return;
  const ph = sel.querySelector('option');
  sel.innerHTML = '';
  sel.appendChild(ph);
  records.forEach(r => { const o = document.createElement('option'); o.value = r.id; o.textContent = r.fields[field] || r.id; sel.appendChild(o); });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('saveSettlementBtn').addEventListener('click', saveSettlement);
});

// ── CRUD ────────────────────────────────────────────────────
function openNewSettlement() {
  document.getElementById('settlementModalTitle').textContent = 'New Settlement';
  document.getElementById('settlementForm').reset();
  document.getElementById('settlementRecordId').value = '';
  new bootstrap.Modal(document.getElementById('settlementModal')).show();
}

async function openEditSettlement(id) {
  try {
    const rec = await Airtable.getOne(CONFIG.TABLES.SETTLEMENTS, id);
    const f = rec.fields;
    document.getElementById('settlementModalTitle').textContent = 'Edit Settlement';
    document.getElementById('settlementRecordId').value = rec.id;
    document.getElementById('settlementWeekEnding').value = f['Week Ending'] || '';
    const did = Array.isArray(f['Driver']) ? f['Driver'][0] : f['Driver'] || '';
    document.getElementById('settlementDriver').value = did;
    new bootstrap.Modal(document.getElementById('settlementModal')).show();
  } catch (err) { App.showToast(err.message, 'danger'); }
}

async function saveSettlement() {
  const id = document.getElementById('settlementRecordId').value;
  const fields = {
    'Week Ending': document.getElementById('settlementWeekEnding').value || null,
  };
  const driver = document.getElementById('settlementDriver').value;
  if (driver) fields['Driver'] = [driver];

  if (!fields['Week Ending']) { App.showToast('Week Ending date is required', 'warning'); return; }

  try {
    if (id) { await Airtable.update(CONFIG.TABLES.SETTLEMENTS, id, fields); App.showToast('Updated!'); }
    else    { await Airtable.create(CONFIG.TABLES.SETTLEMENTS, fields); App.showToast('Created!'); }
    bootstrap.Modal.getInstance(document.getElementById('settlementModal')).hide();
    loadSettlementsPage();
  } catch (err) { App.showToast(err.message, 'danger'); }
}

async function deleteSettlement(id) {
  if (!confirm('Delete this settlement?')) return;
  try { await Airtable.remove(CONFIG.TABLES.SETTLEMENTS, id); App.showToast('Deleted.'); loadSettlementsPage(); }
  catch (err) { App.showToast(err.message, 'danger'); }
}
