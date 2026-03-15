/**
 * ============================================================
 * NATURE DISPATCH TMS — Fuel / Tolls / Expenses Module (CRUD)
 * ============================================================
 * Three separate Airtable tables:
 *   Fuel Transactions : Date, Amount, Gallons, Truck
 *   Toll Transactions : Date, Amount, Location/Plaza, Truck
 *   Expenses          : Date, Amount, Category, Driver, Expense Name, Truck
 * ============================================================
 */

App.init('Expenses', loadExpensesPage);

let _eDrivers = [], _eTrucks = [];

async function loadExpensesPage() {
  const body = document.getElementById('pageBody');
  try {
    if (_eDrivers.length === 0) {
      [_eDrivers, _eTrucks] = await Promise.all([
        Airtable.getAll(CONFIG.TABLES.DRIVERS),
        Airtable.getAll(CONFIG.TABLES.TRUCKS),
      ]);
      App.fillSelect('expDriver', _eDrivers, 'Full Name');
      App.fillSelect('expTruck', _eTrucks, 'Truck Number');
    }

    const params = { 'sort[0][field]': 'Date', 'sort[0][direction]': 'desc' };

    // Fetch Fuel, Tolls, and Expenses tables in parallel
    const [fuel, tolls, expenses] = await Promise.all([
      Airtable.getAll(CONFIG.TABLES.FUEL, params).catch(() => []),
      Airtable.getAll(CONFIG.TABLES.TOLLS, params).catch(() => []),
      Airtable.getAll(CONFIG.TABLES.EXPENSES, params).catch(() => []),
    ]);

    // Normalize: tag each record with its source table
    const all = [
      ...fuel.map(r => ({ ...r, _cat: 'Fuel', _table: 'FUEL' })),
      ...tolls.map(r => ({ ...r, _cat: 'Toll', _table: 'TOLLS' })),
      ...expenses.map(r => ({ ...r, _cat: r.fields['Category'] || 'Other', _table: 'EXPENSES' })),
    ].sort((a, b) => (b.fields['Date'] || '').localeCompare(a.fields['Date'] || ''));

    const totalAmount = all.reduce((s, r) => s + (parseFloat(r.fields['Amount']) || 0), 0);

    body.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <span class="text-muted">${all.length} record(s)</span>
          <span class="ms-3 fw-bold">Total: ${App.formatCurrency(totalAmount)}</span>
        </div>
        <div class="d-flex gap-2">
          ${CSV.buttons('Expenses')}
          <button class="btn btn-nd" onclick="openNewExpense()"><i class="bi bi-plus-lg me-1"></i>New Expense</button>
        </div>
      </div>

      <!-- Category tabs -->
      <ul class="nav nav-tabs mb-3">
        <li class="nav-item"><button class="nav-link active" data-filter="all" onclick="filterExpTab(this,'all')">All (${all.length})</button></li>
        <li class="nav-item"><button class="nav-link" data-filter="Fuel" onclick="filterExpTab(this,'Fuel')">Fuel (${fuel.length})</button></li>
        <li class="nav-item"><button class="nav-link" data-filter="Toll" onclick="filterExpTab(this,'Toll')">Tolls (${tolls.length})</button></li>
        <li class="nav-item"><button class="nav-link" data-filter="Other" onclick="filterExpTab(this,'Other')">Other (${expenses.length})</button></li>
      </ul>

      <div class="table-container"><div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead><tr>
            <th>Date</th><th>Category</th><th>Amount</th><th>Details</th><th>Truck</th><th>Driver</th><th class="text-center">Actions</th>
          </tr></thead>
          <tbody id="expTableBody">
            ${all.map(r => expRow(r)).join('')}
            ${all.length === 0 ? '<tr><td colspan="7" class="empty-state"><i class="bi bi-receipt"></i><p>No expenses</p></td></tr>' : ''}
          </tbody>
        </table>
      </div></div>`;

    window._allExpenses = all;
  } catch (err) { body.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
}

/** Build a detail string depending on the source table */
function _expDetails(rec) {
  const f = rec.fields;
  if (rec._table === 'FUEL') {
    return f['Gallons'] ? `${f['Gallons']} gal` : '—';
  }
  if (rec._table === 'TOLLS') {
    return f['Location/Plaza'] || '—';
  }
  // Expenses table
  return f['Expense Name'] || '—';
}

function expRow(rec) {
  const f = rec.fields;
  const catBadge = {
    Fuel: 'bg-warning text-dark',
    Toll: 'bg-info',
    Maintenance: 'bg-danger',
  };
  const cls = catBadge[rec._cat] || 'bg-secondary';
  return `<tr data-cat="${rec._cat}">
    <td>${App.formatDate(f['Date'])}</td>
    <td><span class="badge ${cls}">${rec._cat}</span></td>
    <td class="fw-semibold">${App.formatCurrency(f['Amount'])}</td>
    <td><small>${_expDetails(rec)}</small></td>
    <td>${App.lookupName(_eTrucks, f['Truck'], 'Truck Number')}</td>
    <td>${rec._table === 'EXPENSES' ? App.lookupName(_eDrivers, f['Driver']) : '—'}</td>
    <td class="text-center">
      <button class="btn btn-sm btn-action btn-outline-danger" onclick="deleteExpense('${rec.id}','${rec._cat}')"><i class="bi bi-trash"></i></button>
    </td>
  </tr>`;
}


// ── Client-side tab filter ──────────────────────────────────
function filterExpTab(btn, cat) {
  document.querySelectorAll('.nav-tabs .nav-link').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#expTableBody tr').forEach(row => {
    if (cat === 'all') { row.style.display = ''; return; }
    if (cat === 'Other') {
      row.style.display = (!['Fuel','Toll'].includes(row.dataset.cat)) ? '' : 'none';
    } else {
      row.style.display = row.dataset.cat === cat ? '' : 'none';
    }
  });
}

// ── CRUD ────────────────────────────────────────────────────
function openNewExpense() {
  document.getElementById('expenseModalTitle').textContent = 'New Expense';
  document.getElementById('expenseForm').reset();
  document.getElementById('expRecordId').value = '';
  _toggleExpFields('Fuel'); // default category
  new bootstrap.Modal(document.getElementById('expenseModal')).show();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('saveExpenseBtn').addEventListener('click', saveExpense);
  // Toggle form fields when category changes
  document.getElementById('expCategory').addEventListener('change', function () {
    _toggleExpFields(this.value);
  });
});

/** Show/hide form fields depending on category */
function _toggleExpFields(cat) {
  const isFuel = cat === 'Fuel';
  const isToll = cat === 'Toll';
  const isExpense = !isFuel && !isToll;

  document.getElementById('grpGallons').style.display   = isFuel ? '' : 'none';
  document.getElementById('grpLocation').style.display   = isToll ? '' : 'none';
  document.getElementById('grpExpName').style.display     = isExpense ? '' : 'none';
  document.getElementById('grpDriver').style.display      = isExpense ? '' : 'none';
}

async function saveExpense() {
  const btn = document.getElementById('saveExpenseBtn');
  const id  = document.getElementById('expRecordId').value;
  const cat = document.getElementById('expCategory').value;

  // Map category → Airtable table
  let table;
  if (cat === 'Fuel')       table = CONFIG.TABLES.FUEL;
  else if (cat === 'Toll')  table = CONFIG.TABLES.TOLLS;
  else                      table = CONFIG.TABLES.EXPENSES;

  const fields = {
    Amount: parseFloat(document.getElementById('expAmount').value) || 0,
    Date:   document.getElementById('expDate').value || null,
  };

  const truck = document.getElementById('expTruck').value;
  if (truck) fields['Truck'] = [truck];

  // Table-specific fields
  if (table === CONFIG.TABLES.FUEL) {
    const gal = parseFloat(document.getElementById('expGallons').value);
    if (gal) fields['Gallons'] = gal;
  } else if (table === CONFIG.TABLES.TOLLS) {
    const loc = document.getElementById('expLocation').value.trim();
    if (loc) fields['Location/Plaza'] = loc;
  } else {
    // Expenses table
    fields['Category'] = cat;
    const expName = document.getElementById('expExpName').value.trim();
    if (expName) fields['Expense Name'] = expName;
    const driver = document.getElementById('expDriver').value;
    if (driver) fields['Driver'] = [driver];
  }

  if (!fields.Amount) { App.showToast('Amount required', 'warning'); return; }

  await App.withLoading(btn, async () => {
    if (id) { await Airtable.update(table, id, fields); App.showToast('Updated!'); }
    else    { await Airtable.create(table, fields); App.showToast('Created!'); }
    bootstrap.Modal.getInstance(document.getElementById('expenseModal')).hide();
    loadExpensesPage();
  });
}

async function deleteExpense(id, cat) {
  if (!confirm('Delete this expense?')) return;
  let table;
  if (cat === 'Fuel')       table = CONFIG.TABLES.FUEL;
  else if (cat === 'Toll')  table = CONFIG.TABLES.TOLLS;
  else                      table = CONFIG.TABLES.EXPENSES;
  try { await Airtable.remove(table, id); App.showToast('Deleted.'); loadExpensesPage(); }
  catch (err) { App.showToast(err.message, 'danger'); }
}
