/**
 * ============================================================
 * NATURE DISPATCH TMS — Reports & Analytics
 * ============================================================
 * Timeline-based analytics: revenue, loads, driver utilisation,
 * expense breakdown.  Filterable by date range.
 * No chart library — pure HTML/CSS bar charts & tables.
 * ============================================================
 */

App.init('Reports & Analytics', loadReportsPage);

async function loadReportsPage() {
  const body = document.getElementById('pageBody');

  // Default range: last 30 days → today
  const today = new Date();
  const thirtyAgo = new Date(today);
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);

  body.innerHTML = `
    <!-- Date Range Picker -->
    <div class="settings-section mb-4" style="animation-delay:0s">
      <div class="d-flex flex-wrap align-items-end gap-3">
        <div>
          <label class="form-label">From</label>
          <input type="date" class="form-control" id="rptFrom" value="${_isoDate(thirtyAgo)}">
        </div>
        <div>
          <label class="form-label">To</label>
          <input type="date" class="form-control" id="rptTo" value="${_isoDate(today)}">
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <button class="btn btn-sm btn-outline-nd" onclick="_setRange(7)">7 Days</button>
          <button class="btn btn-sm btn-outline-nd" onclick="_setRange(14)">14 Days</button>
          <button class="btn btn-sm btn-outline-nd active" onclick="_setRange(30)">30 Days</button>
          <button class="btn btn-sm btn-outline-nd" onclick="_setRange(90)">90 Days</button>
          <button class="btn btn-sm btn-outline-nd" onclick="_setRange(365)">1 Year</button>
        </div>
        <button class="btn btn-nd" onclick="_runReport()">
          <i class="bi bi-bar-chart me-1"></i>Generate Report
        </button>
        <div class="ms-auto">
          ${CSV.buttons('Loads')}
        </div>
      </div>
    </div>
    <div id="reportResults">
      <div class="text-center py-5" style="color:#94a3b8">
        <i class="bi bi-graph-up" style="font-size:3rem;opacity:.4"></i>
        <p class="mt-2 fw-semibold">Select a date range and click "Generate Report"</p>
      </div>
    </div>
  `;

  // Auto-generate on first load
  _runReport();
}

// ── Quick range buttons ─────────────────────────────────────
function _setRange(days) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  document.getElementById('rptFrom').value = _isoDate(from);
  document.getElementById('rptTo').value = _isoDate(to);

  // Active state
  document.querySelectorAll('.btn-outline-nd.active').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');

  _runReport();
}

function _isoDate(d) {
  return d.toISOString().split('T')[0];
}

// ── Main report generation ──────────────────────────────────
async function _runReport() {
  const container = document.getElementById('reportResults');
  container.innerHTML = `
    <div class="text-center py-5" style="animation:fadeIn .5s ease">
      <div class="spinner-border" style="width:2.5rem;height:2.5rem;border-width:3px"></div>
      <p class="mt-3" style="color:#94a3b8;font-weight:500;font-size:.9rem">Generating report…</p>
    </div>`;

  const fromDate = new Date(document.getElementById('rptFrom').value + 'T00:00:00');
  const toDate   = new Date(document.getElementById('rptTo').value + 'T23:59:59');

  try {
    // Build filter
    const params = {};
    const companyFilter = App.companyFilter('Company');
    if (companyFilter) params.filterByFormula = companyFilter;

    const [loads, expenses, drivers] = await Promise.all([
      Airtable.getAll(CONFIG.TABLES.LOADS, params),
      Airtable.getAll(CONFIG.TABLES.EXPENSES, params),
      Airtable.getAll(CONFIG.TABLES.DRIVERS, params),
    ]);

    // ── Filter by date range (use created time or Pickup Date) ──
    const filteredLoads = loads.filter(l => {
      const d = new Date(l.fields['Pickup Date'] || l.createdTime);
      return d >= fromDate && d <= toDate;
    });

    const filteredExpenses = expenses.filter(e => {
      const d = new Date(e.fields['Date'] || e.createdTime);
      return d >= fromDate && d <= toDate;
    });

    // ── KPIs ────────────────────────────────────────────────
    const totalLoads    = filteredLoads.length;
    const totalRevenue  = filteredLoads.reduce((s, r) => s + (parseFloat(r.fields['Revenue']) || 0), 0);
    const totalMiles    = filteredLoads.reduce((s, r) => s + (parseInt(r.fields['Miles']) || 0), 0);
    const totalExpenses = filteredExpenses.reduce((s, r) => s + (parseFloat(r.fields['Amount']) || 0), 0);
    const netProfit     = totalRevenue - totalExpenses;
    const avgRevenuePerLoad = totalLoads > 0 ? totalRevenue / totalLoads : 0;
    const ratePerMile   = totalMiles > 0 ? totalRevenue / totalMiles : 0;
    const deliveredLoads = filteredLoads.filter(l => ['Delivered','Invoiced','Paid'].includes(l.fields['Status'])).length;
    const deliveryRate  = totalLoads > 0 ? Math.round((deliveredLoads / totalLoads) * 100) : 0;

    // ── Revenue by Week ─────────────────────────────────────
    const weeklyData = {};
    filteredLoads.forEach(l => {
      const d = new Date(l.fields['Pickup Date'] || l.createdTime);
      const weekStart = _getWeekStart(d);
      const key = _isoDate(weekStart);
      if (!weeklyData[key]) weeklyData[key] = { revenue: 0, loads: 0, miles: 0 };
      weeklyData[key].revenue += parseFloat(l.fields['Revenue']) || 0;
      weeklyData[key].loads += 1;
      weeklyData[key].miles += parseInt(l.fields['Miles']) || 0;
    });
    const weekKeys = Object.keys(weeklyData).sort();
    const maxWeekRev = Math.max(...Object.values(weeklyData).map(w => w.revenue), 1);

    // ── Revenue by Status ───────────────────────────────────
    const statusRevenue = {};
    filteredLoads.forEach(l => {
      const s = l.fields['Status'] || 'Unknown';
      statusRevenue[s] = (statusRevenue[s] || 0) + (parseFloat(l.fields['Revenue']) || 0);
    });

    // ── Top Drivers ─────────────────────────────────────────
    const driverRevenue = {};
    filteredLoads.forEach(l => {
      const driverIds = l.fields['Driver'];
      if (!driverIds) return;
      const did = Array.isArray(driverIds) ? driverIds[0] : driverIds;
      const drv = drivers.find(d => d.id === did);
      const name = drv ? (drv.fields['Full Name'] || 'Unknown') : 'Unknown';
      if (!driverRevenue[name]) driverRevenue[name] = { revenue: 0, loads: 0, miles: 0 };
      driverRevenue[name].revenue += parseFloat(l.fields['Revenue']) || 0;
      driverRevenue[name].loads += 1;
      driverRevenue[name].miles += parseInt(l.fields['Miles']) || 0;
    });
    const topDrivers = Object.entries(driverRevenue)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10);

    // ── Expense Categories ──────────────────────────────────
    const expenseByCategory = {};
    filteredExpenses.forEach(e => {
      const cat = e.fields['Category'] || 'Other';
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (parseFloat(e.fields['Amount']) || 0);
    });

    // ── RENDER ──────────────────────────────────────────────
    container.innerHTML = `
      <!-- KPI Row -->
      <div class="row g-3 mb-4">
        ${_rptKpi('bi-box-seam','bg-primary-subtle text-primary', totalLoads, 'Total Loads')}
        ${_rptKpi('bi-currency-dollar','bg-success-subtle text-success', _fmt(totalRevenue), 'Revenue')}
        ${_rptKpi('bi-signpost-2','bg-info-subtle text-info', totalMiles.toLocaleString(), 'Total Miles')}
        ${_rptKpi('bi-calculator','bg-warning-subtle text-warning', _fmt(totalExpenses), 'Expenses')}
        ${_rptKpi('bi-graph-up-arrow','bg-success-subtle text-success', _fmt(netProfit), 'Net Profit')}
        ${_rptKpi('bi-cash-stack','bg-info-subtle text-info', _fmt(avgRevenuePerLoad), 'Avg/Load')}
        ${_rptKpi('bi-speedometer2','bg-primary-subtle text-primary', '$' + ratePerMile.toFixed(2), 'Rate/Mile')}
        ${_rptKpi('bi-check2-circle','bg-success-subtle text-success', deliveryRate + '%', 'Delivery Rate')}
      </div>

      <div class="row g-4">
        <!-- Revenue by Week (bar chart) -->
        <div class="col-lg-8">
          <div class="settings-section">
            <h5><i class="bi bi-bar-chart"></i> Revenue by Week</h5>
            ${weekKeys.length === 0 ? '<p class="text-muted">No data for this period</p>' : `
            <div style="overflow-x:auto">
              <div class="d-flex align-items-end gap-2" style="min-height:200px;padding-top:10px">
                ${weekKeys.map(key => {
                  const w = weeklyData[key];
                  const pct = Math.max((w.revenue / maxWeekRev) * 100, 4);
                  return `
                  <div class="text-center flex-fill" style="min-width:60px">
                    <div style="font-size:.7rem;font-weight:700;color:var(--nd-secondary);margin-bottom:4px">${_fmt(w.revenue)}</div>
                    <div style="height:${pct}%;min-height:${pct * 1.8}px;background:linear-gradient(180deg,var(--nd-accent),var(--nd-secondary));border-radius:8px 8px 4px 4px;transition:all .3s;position:relative" title="${w.loads} loads — ${_fmt(w.revenue)}">
                    </div>
                    <div style="font-size:.65rem;color:#94a3b8;margin-top:6px;font-weight:600">${_shortDate(key)}</div>
                    <div style="font-size:.6rem;color:#cbd5e1">${w.loads} loads</div>
                  </div>`;
                }).join('')}
              </div>
            </div>`}
          </div>
        </div>

        <!-- Revenue by Status -->
        <div class="col-lg-4">
          <div class="settings-section" style="height:100%">
            <h5><i class="bi bi-pie-chart"></i> Revenue by Status</h5>
            ${Object.keys(statusRevenue).length === 0 ? '<p class="text-muted">No data</p>' : `
            <div class="d-flex flex-column gap-2">
              ${Object.entries(statusRevenue).sort((a,b) => b[1]-a[1]).map(([status, rev]) => {
                const pct = Math.round((rev / totalRevenue) * 100) || 0;
                return `
                <div>
                  <div class="d-flex justify-content-between mb-1">
                    <span style="font-size:.82rem;font-weight:600">${App.statusBadge(status)}</span>
                    <span style="font-size:.82rem;font-weight:700">${_fmt(rev)}</span>
                  </div>
                  <div style="height:6px;background:#f1f5f9;border-radius:99px;overflow:hidden">
                    <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--nd-accent),var(--nd-secondary));border-radius:99px;transition:width .5s"></div>
                  </div>
                </div>`;
              }).join('')}
            </div>`}
          </div>
        </div>
      </div>

      <!-- Row 2: Drivers + Expenses -->
      <div class="row g-4 mt-1">
        <!-- Top Drivers -->
        <div class="col-lg-7">
          <div class="settings-section">
            <h5><i class="bi bi-person-badge"></i> Top Drivers by Revenue</h5>
            ${topDrivers.length === 0 ? '<p class="text-muted">No driver data</p>' : `
            <div class="table-responsive">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Driver</th>
                    <th>Loads</th>
                    <th>Miles</th>
                    <th>Revenue</th>
                    <th>Avg/Load</th>
                  </tr>
                </thead>
                <tbody>
                  ${topDrivers.map(([name, data], i) => `
                  <tr>
                    <td><span class="badge ${i < 3 ? 'bg-warning text-dark' : 'bg-secondary'}">${i+1}</span></td>
                    <td class="fw-semibold">${name}</td>
                    <td>${data.loads}</td>
                    <td>${data.miles.toLocaleString()}</td>
                    <td class="fw-bold">${_fmt(data.revenue)}</td>
                    <td>${_fmt(data.revenue / data.loads)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>`}
          </div>
        </div>

        <!-- Expense Breakdown -->
        <div class="col-lg-5">
          <div class="settings-section" style="height:100%">
            <h5><i class="bi bi-receipt"></i> Expense Breakdown</h5>
            ${Object.keys(expenseByCategory).length === 0 ? '<p class="text-muted">No expenses in this period</p>' : `
            <div class="d-flex flex-column gap-3">
              ${Object.entries(expenseByCategory).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => {
                const pct = Math.round((amt / totalExpenses) * 100);
                return `
                <div>
                  <div class="d-flex justify-content-between mb-1">
                    <span style="font-size:.82rem;font-weight:600">${cat}</span>
                    <span style="font-size:.82rem;font-weight:700">${_fmt(amt)} <span style="color:#94a3b8;font-weight:500">(${pct}%)</span></span>
                  </div>
                  <div style="height:6px;background:#f1f5f9;border-radius:99px;overflow:hidden">
                    <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#ed8936,#c05621);border-radius:99px;transition:width .5s"></div>
                  </div>
                </div>`;
              }).join('')}
            </div>`}
          </div>
        </div>
      </div>

      <!-- Export All -->
      <div class="settings-section mt-4">
        <h5><i class="bi bi-download"></i> Bulk Export</h5>
        <p style="font-size:.85rem;color:#94a3b8;margin-bottom:16px">Download CSV files for each table in your TMS</p>
        <div class="d-flex flex-wrap gap-2">
          ${Object.keys(CSV.TABLE_DEFS).map(key => `
            <button class="btn btn-sm btn-outline-nd" onclick="CSV.exportTable('${key}')">
              <i class="bi bi-file-earmark-spreadsheet me-1"></i>${key}
            </button>
          `).join('')}
          <button class="btn btn-sm btn-nd ms-2" onclick="CSV.exportAll()">
            <i class="bi bi-download me-1"></i>Export All Tables
          </button>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    console.error(err);
  }
}

// ── Helpers ─────────────────────────────────────────────────
function _rptKpi(icon, cls, value, label) {
  return `
  <div class="col-6 col-lg-3">
    <div class="card stat-card p-3">
      <div class="d-flex align-items-center gap-3">
        <div class="stat-icon ${cls}"><i class="bi ${icon}"></i></div>
        <div>
          <div class="stat-value" style="font-size:1.3rem">${value}</div>
          <div class="stat-label">${label}</div>
        </div>
      </div>
    </div>
  </div>`;
}

function _fmt(n) { return App.formatCurrency(n); }

function _shortDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function _getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
