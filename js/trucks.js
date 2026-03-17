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
      App.fillSelect('truckCompany', _coCache, 'Company Name');
    }

    const params = { 'sort[0][field]': 'Truck Number', 'sort[0][direction]': 'asc' };
    const filter = App.companyFilter('Company');
    if (filter) params.filterByFormula = filter;

    const trucks = await Airtable.getAll(CONFIG.TABLES.TRUCKS, params);

    const trucksFilters = App.renderTableFilters({
      searchId: 'trucksSearch',
      filters: [
        { id: 'filterTruckStatus', label: 'All Status', options: [
          {value:'Actif',text:'Actif'},{value:'Maintenance',text:'Maintenance'},{value:'Hors service',text:'Hors service'},
          {value:'Active',text:'Active'},{value:'Inactive',text:'Inactive'},{value:'In Maintenance',text:'In Maintenance'}
        ]}
      ]
    });

    body.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <span class="text-muted">${trucks.length} truck(s)</span>
        <div class="d-flex gap-2">
          ${CSV.buttons('Trucks')}
          <button class="btn btn-nd" onclick="openNewTruck()"><i class="bi bi-plus-lg me-1"></i>New Truck</button>
        </div>
      </div>
      ${trucksFilters}
      <div class="table-container"><div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead><tr>
            <th>Truck #</th><th>Company</th><th>Model</th><th>Year</th>
            <th>DOT #</th><th>ELD</th><th>Status</th><th class="text-center">Actions</th>
          </tr></thead>
          <tbody>
            ${trucks.map(r => {
              const f = r.fields;
              const stMap = { 'Actif': 'bg-success', 'Maintenance': 'bg-warning text-dark', 'Hors service': 'bg-danger', 'Active': 'bg-success', 'Inactive': 'bg-secondary', 'In Maintenance': 'bg-warning text-dark' };
              const stCls = stMap[f['Status']] || 'bg-secondary';
              return `<tr data-filterTruckStatus="${f['Status'] || ''}">
                <td class="fw-semibold">${f['Truck Number'] || '—'}</td>
                <td>${App.lookupName(_coCache, f['Company'], 'Company Name')}</td>
                <td>${f['Model'] || '—'}</td>
                <td>${f['Year'] || '—'}</td>
                <td><small>${f['DOT Number'] || '—'}</small></td>
                <td><small>${f['ELD Provider'] || '—'}</small></td>
                <td><span class="badge ${stCls}">${f['Status'] || 'N/A'}</span></td>
                <td class="text-center text-nowrap">
                  <button class="btn btn-sm btn-action btn-outline-secondary me-1" onclick="openEditTruck('${r.id}')"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-action btn-outline-danger" onclick="deleteTruck('${r.id}')"><i class="bi bi-trash"></i></button>
                </td>
              </tr>`;
            }).join('')}
            ${trucks.length === 0 ? '<tr><td colspan="8" class="empty-state"><i class="bi bi-truck"></i><p>No trucks found</p></td></tr>' : ''}
          </tbody>
        </table>
      </div></div>`;

    App.bindTableFilters({ searchId: 'trucksSearch', filterIds: ['filterTruckStatus'] });
  } catch (err) {
    body.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
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
    document.getElementById('truckNumber').value       = f['Truck Number'] || '';
    document.getElementById('truckVin').value          = f['VIN / Plate'] || '';
    document.getElementById('truckLicensePlate').value = f['License Plate'] || '';
    document.getElementById('truckYear').value         = f['Year'] || '';
    document.getElementById('truckModel').value        = f['Model'] || '';
    document.getElementById('truckDOT').value          = f['DOT Number'] || '';
    document.getElementById('truckMC').value           = f['MC Number'] || '';
    document.getElementById('truckELD').value          = f['ELD Provider'] || '';
    document.getElementById('truckInsuranceExp').value = f['Insurance Expiration Date'] || '';
    document.getElementById('truckIFTAExp').value      = f['IFTA Expiration Date'] || '';
    document.getElementById('truckAnnualInsp').value   = f['Annual Inspection Date'] || '';
    document.getElementById('truckNotes').value        = f['Notes'] || '';
    document.getElementById('truckStatus').value       = f['Status'] || 'Actif';
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
  const btn = document.getElementById('saveTruckBtn');
  const id = document.getElementById('truckRecordId').value;

  const fields = {
    'Truck Number':             document.getElementById('truckNumber').value.trim(),
    'VIN / Plate':              document.getElementById('truckVin').value.trim(),
    'License Plate':            document.getElementById('truckLicensePlate').value.trim() || null,
    'Year':                     parseInt(document.getElementById('truckYear').value) || null,
    'Model':                    document.getElementById('truckModel').value.trim() || null,
    'DOT Number':               document.getElementById('truckDOT').value.trim() || null,
    'MC Number':                document.getElementById('truckMC').value.trim() || null,
    'ELD Provider':             document.getElementById('truckELD').value.trim() || null,
    'Insurance Expiration Date': document.getElementById('truckInsuranceExp').value || null,
    'IFTA Expiration Date':     document.getElementById('truckIFTAExp').value || null,
    'Annual Inspection Date':   document.getElementById('truckAnnualInsp').value || null,
    'Notes':                    document.getElementById('truckNotes').value.trim() || null,
    Status:                     document.getElementById('truckStatus').value,
  };
  const co = document.getElementById('truckCompany').value;
  if (co) fields['Company'] = [co];

  if (!fields['Truck Number']) { App.showToast('Truck Number is required', 'warning'); return; }

  await App.withLoading(btn, async () => {
    if (id) { await Airtable.update(CONFIG.TABLES.TRUCKS, id, fields); App.showToast('Updated!'); }
    else    { await Airtable.create(CONFIG.TABLES.TRUCKS, fields); App.showToast('Created!'); }
    bootstrap.Modal.getInstance(document.getElementById('truckModal')).hide();
    loadTrucksPage();
  });
}

// ── Delete ──────────────────────────────────────────────────
async function deleteTruck(id) {
  if (!confirm('Delete this truck?')) return;
  try { await Airtable.remove(CONFIG.TABLES.TRUCKS, id); App.showToast('Deleted.'); loadTrucksPage(); }
  catch (err) { App.showToast(err.message, 'danger'); }
}
