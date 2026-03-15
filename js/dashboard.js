/**
 * ============================================================
 * NATURE DISPATCH TMS — Dashboard
 * ============================================================
 */

App.init('Dashboard', loadDashboard);

async function loadDashboard() {
  const body = document.getElementById('pageBody');

  try {
    // Build filter params
    const params = {};
    const filter = App.companyFilter('Company');
    if (filter) params.filterByFormula = filter;

    // Parallel data fetch
    const [loads, drivers, trucks] = await Promise.all([
      Airtable.getAll(CONFIG.TABLES.LOADS, params),
      Airtable.getAll(CONFIG.TABLES.DRIVERS, params),
      Airtable.getAll(CONFIG.TABLES.TRUCKS, params),
    ]);

    // ── KPIs ────────────────────────────────────────────────
    const totalLoads    = loads.length;
    const totalRevenue  = loads.reduce((s, r) => s + (parseFloat(r.fields['Revenue']) || 0), 0);
    const activeDrivers = drivers.filter(d => d.fields['Status'] === 'Active').length;
    const activeTrucks  = trucks.filter(t => t.fields['Status'] === 'Active').length;

    // Count by status
    const statusCounts = {};
    loads.forEach(l => {
      const s = l.fields['Status'] || 'Unknown';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    // ── Render ──────────────────────────────────────────────
    body.innerHTML = `
      <!-- KPI Cards -->
      <div class="row g-3 mb-4">
        ${kpiCard('bi-box-seam',     'bg-primary-subtle text-primary',   totalLoads,                      'Total Loads')}
        ${kpiCard('bi-currency-dollar','bg-success-subtle text-success', App.formatCurrency(totalRevenue),'Total Revenue')}
        ${kpiCard('bi-person-badge', 'bg-info-subtle text-info',         activeDrivers,                   'Active Drivers')}
        ${kpiCard('bi-truck',        'bg-warning-subtle text-warning',   activeTrucks,                    'Active Trucks')}
      </div>

      <!-- Second row: Status breakdown + Recent loads -->
      <div class="row g-3">
        <!-- Status breakdown -->
        <div class="col-md-4">
          <div class="table-container p-3">
            <h6 class="fw-bold mb-3">Loads by Status</h6>
            <ul class="list-group list-group-flush">
              ${Object.entries(statusCounts).map(([s,c]) => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  ${App.statusBadge(s)}
                  <span class="fw-bold">${c}</span>
                </li>
              `).join('')}
              ${Object.keys(statusCounts).length === 0 ? '<li class="list-group-item text-muted">No loads yet</li>' : ''}
            </ul>
          </div>
        </div>
        <!-- Recent loads -->
        <div class="col-md-8">
          <div class="table-container">
            <div class="p-3 d-flex justify-content-between align-items-center">
              <h6 class="fw-bold mb-0">Recent Loads</h6>
              <a href="loads.html" class="btn btn-sm btn-outline-nd">View All</a>
            </div>
            <div class="table-responsive">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th>Load #</th>
                    <th>Broker</th>
                    <th>Revenue</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  ${loads.slice(0, 10).map(l => `
                  <tr>
                    <td class="fw-semibold">${l.fields['Load Number'] || '—'}</td>
                    <td>${(l.fields['Broker Name'] && l.fields['Broker Name'][0]) || '—'}</td>
                    <td>${App.formatCurrency(l.fields['Revenue'])}</td>
                    <td>${App.statusBadge(l.fields['Status'])}</td>
                    <td>${App.formatDate(l.createdTime)}</td>
                  </tr>`).join('')}
                  ${loads.length === 0 ? '<tr><td colspan="5" class="text-center text-muted py-4">No loads found</td></tr>' : ''}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<div class="alert alert-danger"><strong>Error:</strong> ${err.message}</div>`;
    console.error(err);
  }
}

function kpiCard(icon, colorClass, value, label) {
  return `
  <div class="col-sm-6 col-xl-3">
    <div class="card stat-card p-3">
      <div class="d-flex align-items-center gap-3">
        <div class="stat-icon ${colorClass}">
          <i class="bi ${icon}"></i>
        </div>
        <div>
          <div class="stat-value">${value}</div>
          <div class="stat-label">${label}</div>
        </div>
      </div>
    </div>
  </div>`;
}
