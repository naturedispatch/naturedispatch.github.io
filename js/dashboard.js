/**
 * ============================================================
 * NATURE DISPATCH TMS — Dashboard (BRD-compliant)
 * Dispatch visibility, ETA monitoring, driver availability,
 * document tracking, invoice readiness, alerts
 * ============================================================
 */

App.init('Dashboard', loadDashboard);

// Auto-refresh every 5 minutes
let _dashboardRefreshTimer = null;
function _startAutoRefresh() {
  clearInterval(_dashboardRefreshTimer);
  _dashboardRefreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible') loadDashboard();
  }, 5 * 60 * 1000);
}

async function loadDashboard() {
  const body = document.getElementById('pageBody');
  _startAutoRefresh();

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

    // Profit margin (revenue - cost)
    const totalCost = loads.reduce((s, r) => s + (parseFloat(r.fields['Cost']) || 0), 0);
    const profitMargin = totalRevenue - totalCost;
    const marginPct = totalRevenue > 0 ? ((profitMargin / totalRevenue) * 100).toFixed(1) : '0.0';

    // Greeting based on time of day
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    const userName = (typeof Auth !== 'undefined' && Auth.user?.name) ? Auth.user.name.split(' ')[0] : '';

    // ── Render ──────────────────────────────────────────────
    body.innerHTML = `
      <!-- Welcome + Live Clock -->
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h5 class="fw-bold mb-1" style="color:var(--nd-dark)">${greeting}${userName ? ', ' + userName : ''} 👋</h5>
          <small class="text-muted">Here's your dispatch overview</small>
        </div>
        <div class="text-end">
          <div id="dashClock" class="fw-bold" style="font-size:1.3rem;color:var(--nd-dark);font-variant-numeric:tabular-nums"></div>
          <small class="text-muted" id="dashDate"></small>
        </div>
      </div>

      <!-- Row 1: Main KPI Cards -->
      <div class="row g-3 mb-4">
        ${kpiCard('bi-box-seam',       'bg-primary-subtle text-primary',   totalLoads,                        'Total Loads')}
        ${kpiCard('bi-currency-dollar','bg-success-subtle text-success',   App.formatCurrency(totalRevenue),  'Total Revenue')}
        ${kpiCard('bi-graph-up-arrow', 'bg-success-subtle text-success',   App.formatCurrency(profitMargin),  'Profit (' + marginPct + '%)')}
        ${kpiCard('bi-truck',          'bg-warning-subtle text-warning',   activeTrucks,                      'Active Trucks')}
      </div>

      <!-- Row 2: BRD Operational KPIs -->
      <div class="row g-3 mb-4">
        ${kpiCard('bi-file-earmark-x',    'bg-danger-subtle text-danger',    missingDocs,    'Missing Docs')}
        ${kpiCard('bi-receipt-cutoff',     'bg-info-subtle text-info',        readyToInvoice, 'Ready to Invoice')}
        ${kpiCard('bi-exclamation-triangle','bg-warning-subtle text-warning', overdueInvoice, 'Invoice Blocked')}
        ${kpiCard('bi-bell',              'bg-danger-subtle text-danger',     openAlerts,     'Open Alerts')}
      </div>

      <!-- Row 2.5: Fleet Overview Map -->
      <div class="row g-3 mb-4">
        <div class="col-12">
          <div class="table-container p-3">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h6 class="fw-bold mb-0"><i class="bi bi-map me-2"></i>Fleet Overview Map</h6>
              <span class="badge bg-primary-subtle text-primary">${activeLoads.length} active load(s)</span>
            </div>
            <div id="dashboardFleetMap" class="nd-map-container" style="height:380px">
              <div class="d-flex align-items-center justify-content-center h-100 text-muted">
                <div class="spinner-border spinner-border-sm me-2"></div> Loading map…
              </div>
            </div>
          </div>
        </div>
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
                    <td title="${App.formatDate(l.createdTime)}">${App.relativeTime(l.createdTime)}</td>
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

    // ── Live clock ─────────────────────────────────────────
    _startClock();

    // ── Render Fleet Map (async, non-blocking) ─────────────
    _renderFleetMap(activeLoads);
  } catch (err) {
    body.innerHTML = `<div class="alert alert-danger"><strong>Error:</strong> ${err.message}</div>`;
    console.error(err);
  }
}

// ── Live clock updater ──────────────────────────────────────
let _clockInterval = null;
function _startClock() {
  clearInterval(_clockInterval);
  const update = () => {
    const now = new Date();
    const clockEl = document.getElementById('dashClock');
    const dateEl = document.getElementById('dashDate');
    if (clockEl) clockEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };
  update();
  _clockInterval = setInterval(update, 1000);
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

/**
 * Render the fleet overview map on the dashboard.
 * Fetches first stop of each active load, geocodes it, pins it on the map.
 */
async function _renderFleetMap(activeLoads) {
  const mapEl = document.getElementById('dashboardFleetMap');
  if (!mapEl) return;

  // Check if Maps key is available
  if (!GMaps.getApiKey()) {
    mapEl.innerHTML = `<div class="d-flex align-items-center justify-content-center h-100 text-muted" style="font-size:.85rem">
      <i class="bi bi-key me-2"></i>Configure a Maps API key in Settings → Integrations
    </div>`;
    return;
  }

  if (activeLoads.length === 0) {
    mapEl.innerHTML = `<div class="d-flex align-items-center justify-content-center h-100 text-muted" style="font-size:.85rem">
      <i class="bi bi-geo-alt me-2"></i>No active loads to display
    </div>`;
    return;
  }

  try {
    await GMaps.ensureLoaded();

    // Fetch stops for active loads that have the Load Stops field
    const loadsWithStops = activeLoads.filter(l => l.fields['Load Stops']?.length > 0);
    const allStopIds = loadsWithStops.flatMap(l => l.fields['Load Stops']);

    let allStops = [];
    if (allStopIds.length > 0) {
      // Fetch in batches of 20 due to formula length limits
      for (let i = 0; i < allStopIds.length; i += 20) {
        const batch = allStopIds.slice(i, i + 20);
        const formula = 'OR(' + batch.map(id => `RECORD_ID()='${id}'`).join(',') + ')';
        const batchStops = await Airtable.getAll(CONFIG.TABLES.LOAD_STOPS, { filterByFormula: formula });
        allStops = allStops.concat(batchStops);
      }
    }

    // Build a map: stopId → stop record
    const stopMap = {};
    allStops.forEach(s => { stopMap[s.id] = s; });

    // Get the first pickup address for each active load
    const addresses = [];
    const loadLabels = [];
    for (const load of loadsWithStops) {
      const stopIds = load.fields['Load Stops'] || [];
      // Find the first stop with an address
      for (const sid of stopIds) {
        const stop = stopMap[sid];
        if (stop?.fields['Address']) {
          addresses.push(stop.fields['Address']);
          loadLabels.push({
            label: `Load ${load.fields['Load Number'] || '—'}`,
            status: load.fields['Status'] || 'New',
            info: `${App.formatCurrency(load.fields['Revenue'])} • ${load.fields['Miles'] || '?'} mi`,
          });
          break;
        }
      }
    }

    if (addresses.length === 0) {
      mapEl.innerHTML = `<div class="d-flex align-items-center justify-content-center h-100 text-muted" style="font-size:.85rem">
        <i class="bi bi-geo-alt me-2"></i>No stop addresses available for active loads
      </div>`;
      return;
    }

    // Geocode addresses
    const geocoded = await GMaps.batchGeocode(addresses);

    // Build pins
    const pins = geocoded.map((geo, i) => {
      if (!geo) return null;
      return { lat: geo.lat, lng: geo.lng, ...loadLabels[i] };
    }).filter(Boolean);

    if (pins.length === 0) {
      mapEl.innerHTML = `<div class="d-flex align-items-center justify-content-center h-100 text-muted" style="font-size:.85rem">
        <i class="bi bi-geo-alt me-2"></i>Could not geocode load addresses
      </div>`;
      return;
    }

    // Render the map
    const map = await GMaps.createMap(mapEl, { zoom: 4 });
    GMaps.addLoadPins(map, pins);

  } catch (err) {
    mapEl.innerHTML = `<div class="d-flex align-items-center justify-content-center h-100 text-muted" style="font-size:.85rem">
      <i class="bi bi-exclamation-triangle me-2"></i>Fleet map unavailable
    </div>`;
    console.warn('Fleet map error:', err);
  }
}
