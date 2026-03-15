/**
 * ============================================================
 * NATURE DISPATCH TMS — Dashboard (BRD-compliant)
 * Dispatch visibility, ETA monitoring, driver availability,
 * document tracking, invoice readiness, alerts
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

    // Parallel data fetch (all BRD data sources)
    const [loads, drivers, trucks, alerts] = await Promise.all([
      Airtable.getAll(CONFIG.TABLES.LOADS, params),
      Airtable.getAll(CONFIG.TABLES.DRIVERS, params),
      Airtable.getAll(CONFIG.TABLES.TRUCKS, params),
      Airtable.getAll(CONFIG.TABLES.ALERTS, { filterByFormula: '{Status}!="Resolved"', 'sort[0][field]': 'Due Date', 'sort[0][direction]': 'asc' }),
    ]);

    // ── KPIs ────────────────────────────────────────────────
    const totalLoads    = loads.length;
    const totalRevenue  = loads.reduce((s, r) => s + (parseFloat(r.fields['Revenue']) || 0), 0);
    const availableDrivers = drivers.filter(d => d.fields['Availability'] === 'Available').length;
    const activeTrucks  = trucks.filter(t => t.fields['Status'] === 'Active').length;

    // Loads with missing docs
    const missingDocs = loads.filter(l => {
      const f = l.fields;
      const has = (f['Rate Con PDF']?.length > 0 ? 1 : 0) + (f['BOL PDF']?.length > 0 ? 1 : 0) + (f['Invoice PDF']?.length > 0 ? 1 : 0);
      return has < 3 && f['Status'] !== 'Cancelled';
    }).length;

    // Invoice readiness
    const readyToInvoice = loads.filter(l => l.fields['Invoice Status'] === 'Ready to Invoice').length;
    const overdueInvoice = loads.filter(l => l.fields['Invoice Status'] === 'Docs Missing' || l.fields['Invoice Status'] === 'Not Ready').length;

    // Active loads (not Paid/Cancelled)
    const activeLoads = loads.filter(l => !['Paid', 'Cancelled'].includes(l.fields['Status']));

    // Count by status
    const statusCounts = {};
    loads.forEach(l => {
      const s = l.fields['Status'] || 'Unknown';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    // Driver availability breakdown
    const driverAvail = {};
    drivers.forEach(d => {
      const a = d.fields['Availability'] || 'Not Set';
      driverAvail[a] = (driverAvail[a] || 0) + 1;
    });

    // Open alerts count
    const openAlerts = alerts.filter(a => a.fields['Status'] === 'Open').length;

    // ── Render ──────────────────────────────────────────────
    body.innerHTML = `
      <!-- Row 1: Main KPI Cards -->
      <div class="row g-3 mb-4">
        ${kpiCard('bi-box-seam',       'bg-primary-subtle text-primary',   totalLoads,                        'Total Loads')}
        ${kpiCard('bi-currency-dollar','bg-success-subtle text-success',   App.formatCurrency(totalRevenue),  'Total Revenue')}
        ${kpiCard('bi-person-check',   'bg-info-subtle text-info',         availableDrivers,                  'Available Drivers')}
        ${kpiCard('bi-truck',          'bg-warning-subtle text-warning',   activeTrucks,                      'Active Trucks')}
      </div>

      <!-- Row 2: BRD Operational KPIs -->
      <div class="row g-3 mb-4">
        ${kpiCard('bi-file-earmark-x',    'bg-danger-subtle text-danger',    missingDocs,    'Missing Docs')}
        ${kpiCard('bi-receipt-cutoff',     'bg-info-subtle text-info',        readyToInvoice, 'Ready to Invoice')}
        ${kpiCard('bi-exclamation-triangle','bg-warning-subtle text-warning', overdueInvoice, 'Invoice Blocked')}
        ${kpiCard('bi-bell',              'bg-danger-subtle text-danger',     openAlerts,     'Open Alerts')}
      </div>

      <!-- Row 3: Status + Driver Availability + Alerts -->
      <div class="row g-3 mb-4">
        <!-- Loads by Status -->
        <div class="col-md-4">
          <div class="table-container p-3" style="height:100%">
            <h6 class="fw-bold mb-3"><i class="bi bi-bar-chart me-2"></i>Loads by Status</h6>
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
        <!-- Driver Availability -->
        <div class="col-md-4">
          <div class="table-container p-3" style="height:100%">
            <h6 class="fw-bold mb-3"><i class="bi bi-person-badge me-2"></i>Driver Availability</h6>
            <ul class="list-group list-group-flush">
              ${Object.entries(driverAvail).map(([a,c]) => {
                const colorMap = { 'Available': 'bg-success', 'On Load': 'bg-primary', 'Off Duty': 'bg-secondary', 'Home Time': 'bg-warning text-dark', 'Out of Service': 'bg-danger', 'Not Set': 'bg-secondary' };
                return `<li class="list-group-item d-flex justify-content-between align-items-center">
                  <span class="badge ${colorMap[a] || 'bg-secondary'}">${a}</span>
                  <span class="fw-bold">${c}</span>
                </li>`;
              }).join('')}
              ${Object.keys(driverAvail).length === 0 ? '<li class="list-group-item text-muted">No drivers</li>' : ''}
            </ul>
          </div>
        </div>
        <!-- Open Alerts -->
        <div class="col-md-4">
          <div class="table-container p-3" style="height:100%">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h6 class="fw-bold mb-0"><i class="bi bi-bell me-2"></i>Recent Alerts</h6>
              <a href="alerts.html" class="btn btn-sm btn-outline-nd">View All</a>
            </div>
            ${alerts.length === 0 ? '<p class="text-muted text-center py-3">No open alerts</p>' : `
            <ul class="list-group list-group-flush">
              ${alerts.slice(0, 5).map(a => {
                const f = a.fields;
                const prioMap = { 'Critical': 'text-danger', 'High': 'text-warning', 'Medium': 'text-info', 'Low': 'text-muted' };
                return `<li class="list-group-item px-0 py-2">
                  <div class="d-flex justify-content-between">
                    <div>
                      <i class="bi bi-exclamation-circle ${prioMap[f['Priority']] || ''} me-1"></i>
                      <span class="small fw-semibold">${f['Title'] || '—'}</span>
                    </div>
                    <span class="badge bg-secondary">${f['Type'] || ''}</span>
                  </div>
                </li>`;
              }).join('')}
            </ul>`}
          </div>
        </div>
      </div>

      <!-- Row 4: Recent Loads -->
      <div class="row g-3">
        <div class="col-12">
          <div class="table-container">
            <div class="p-3 d-flex justify-content-between align-items-center">
              <h6 class="fw-bold mb-0"><i class="bi bi-clock-history me-2"></i>Recent Loads</h6>
              <a href="loads.html" class="btn btn-sm btn-outline-nd">View All</a>
            </div>
            <div class="table-responsive">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th>Load #</th>
                    <th>Status</th>
                    <th>Revenue</th>
                    <th>ETA</th>
                    <th>Docs</th>
                    <th>Invoice</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  ${loads.slice(0, 10).map(l => {
                    const f = l.fields;
                    const docCount = (f['Rate Con PDF']?.length > 0 ? 1 : 0) + (f['BOL PDF']?.length > 0 ? 1 : 0) + (f['Invoice PDF']?.length > 0 ? 1 : 0);
                    const docCls = docCount === 3 ? 'bg-success' : docCount > 0 ? 'bg-warning text-dark' : 'bg-danger';
                    const invMap = { 'Not Ready': 'bg-secondary', 'Docs Missing': 'bg-warning text-dark', 'Ready to Invoice': 'bg-info', 'Invoiced': 'bg-primary', 'Paid': 'bg-success', 'Disputed': 'bg-danger' };
                    return `<tr>
                    <td class="fw-semibold">${f['Load Number'] || '—'}</td>
                    <td>${App.statusBadge(f['Status'])}</td>
                    <td>${App.formatCurrency(f['Revenue'])}</td>
                    <td>${f['ETA'] ? App.formatDate(f['ETA']) : '—'}</td>
                    <td><span class="badge ${docCls}">${docCount}/3</span></td>
                    <td><span class="badge ${invMap[f['Invoice Status']] || 'bg-secondary'}">${f['Invoice Status'] || '—'}</span></td>
                    <td>${App.formatDate(l.createdTime)}</td>
                  </tr>`;
                  }).join('')}
                  ${loads.length === 0 ? '<tr><td colspan="7" class="text-center text-muted py-4">No loads found</td></tr>' : ''}
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
