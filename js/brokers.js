/**
 * ============================================================
 * NATURE DISPATCH TMS — Brokers / Shippers Module (CRUD)
 * ============================================================
 */

App.init('Brokers & Shippers', loadBrokersPage);

async function loadBrokersPage() {
  const body = document.getElementById('pageBody');
  try {
    const params = { 'sort[0][field]': 'Broker Name', 'sort[0][direction]': 'asc' };
    const brokers = await Airtable.getAll(CONFIG.TABLES.BROKERS, params);

    body.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <span class="text-muted">${brokers.length} broker(s)</span>
        <button class="btn btn-nd" onclick="openNewBroker()"><i class="bi bi-plus-lg me-1"></i>New Broker</button>
      </div>
      <div class="table-container"><div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead><tr><th>Broker Name</th><th>Main Phone</th><th>Contact Email</th><th class="text-center">Actions</th></tr></thead>
          <tbody>
            ${brokers.map(b => {
              const f = b.fields;
              return `<tr>
                <td class="fw-semibold">${f['Broker Name'] || '—'}</td>
                <td>${f['Main Phone'] || '—'}</td>
                <td>${f['Contact Email'] || '—'}</td>
                <td class="text-center text-nowrap">
                  <button class="btn btn-sm btn-action btn-outline-secondary me-1" onclick="openEditBroker('${b.id}')"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-action btn-outline-danger" onclick="deleteBroker('${b.id}')"><i class="bi bi-trash"></i></button>
                </td>
              </tr>`;
            }).join('')}
            ${brokers.length === 0 ? '<tr><td colspan="4" class="empty-state"><i class="bi bi-building"></i><p>No brokers</p></td></tr>' : ''}
          </tbody>
        </table>
      </div></div>`;
  } catch (err) { body.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
}

function openNewBroker() {
  document.getElementById('brokerModalTitle').textContent = 'New Broker';
  document.getElementById('brokerForm').reset();
  document.getElementById('brokerRecordId').value = '';
  new bootstrap.Modal(document.getElementById('brokerModal')).show();
}

async function openEditBroker(id) {
  try {
    const rec = await Airtable.getOne(CONFIG.TABLES.BROKERS, id);
    const f = rec.fields;
    document.getElementById('brokerModalTitle').textContent = `Edit — ${f['Broker Name'] || ''}`;
    document.getElementById('brokerRecordId').value = rec.id;
    document.getElementById('brokerName').value    = f['Broker Name'] || '';
    document.getElementById('brokerPhone').value   = f['Main Phone'] || '';
    document.getElementById('brokerEmail').value   = f['Contact Email'] || '';
    new bootstrap.Modal(document.getElementById('brokerModal')).show();
  } catch (err) { App.showToast(err.message, 'danger'); }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('saveBrokerBtn').addEventListener('click', saveBroker);
});

async function saveBroker() {
  const id = document.getElementById('brokerRecordId').value;
  const fields = {
    'Broker Name':   document.getElementById('brokerName').value.trim(),
    'Main Phone':    document.getElementById('brokerPhone').value.trim(),
    'Contact Email': document.getElementById('brokerEmail').value.trim(),
  };
  if (!fields['Broker Name']) { App.showToast('Broker Name required', 'warning'); return; }
  try {
    if (id) { await Airtable.update(CONFIG.TABLES.BROKERS, id, fields); App.showToast('Updated!'); }
    else    { await Airtable.create(CONFIG.TABLES.BROKERS, fields); App.showToast('Created!'); }
    bootstrap.Modal.getInstance(document.getElementById('brokerModal')).hide();
    loadBrokersPage();
  } catch (err) { App.showToast(err.message, 'danger'); }
}

async function deleteBroker(id) {
  if (!confirm('Delete this broker?')) return;
  try { await Airtable.remove(CONFIG.TABLES.BROKERS, id); App.showToast('Deleted.'); loadBrokersPage(); }
  catch (err) { App.showToast(err.message, 'danger'); }
}
