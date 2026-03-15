/**
 * ============================================================
 * NATURE DISPATCH TMS — Shared Application Logic
 * ============================================================
 * • Injects the sidebar & top-bar into every page
 * • Manages the global "Company" filter (persisted in localStorage)
 * • Provides small UI utility functions
 * ============================================================
 */

const App = (() => {
  // ── Current company filter (default: show all) ────────────
  let _currentCompany = localStorage.getItem('nd_company') || 'all';

  function getCurrentCompany() {
    return _currentCompany;
  }

  function setCurrentCompany(value) {
    _currentCompany = value;
    localStorage.setItem('nd_company', value);
  }

  /**
   * Returns an Airtable filterByFormula string that limits
   * results to the selected company.  Call this from each page
   * module before fetching records.
   * @param {string} companyField – The Airtable field name that
   *   links to the Companies table (e.g. "Company", "Company ID").
   */
  function companyFilter(companyField = 'Company') {
    if (_currentCompany === 'all') return '';
    // Linked-record fields store an array of record IDs
    return `FIND("${_currentCompany}", ARRAYJOIN({${companyField}}))`;
  }

  // ── Sidebar HTML ──────────────────────────────────────────
  function renderSidebar() {
    const page = location.pathname.split('/').pop() || 'index.html';
    const links = [
      { href: 'index.html',       icon: 'bi-speedometer2',    label: 'Dashboard' },
      { href: 'loads.html',       icon: 'bi-box-seam',        label: 'Loads' },
      { href: 'drivers.html',     icon: 'bi-person-badge',    label: 'Drivers' },
      { href: 'trucks.html',      icon: 'bi-truck',           label: 'Trucks & Trailers' },
      { href: 'brokers.html',     icon: 'bi-building',        label: 'Brokers' },
      { href: 'documents.html',   icon: 'bi-file-earmark-check', label: 'Documents' },
      { href: 'settlements.html', icon: 'bi-calculator',      label: 'Settlements' },
      { href: 'expenses.html',    icon: 'bi-receipt',         label: 'Expenses' },
      { href: 'alerts.html',      icon: 'bi-bell',            label: 'Alerts' },
    ];

    const nav = links
      .map(
        (l) => `
      <li class="nav-item">
        <a class="nav-link${page === l.href ? ' active' : ''}" href="${l.href}">
          <i class="bi ${l.icon} me-2"></i>${l.label}
        </a>
      </li>`
      )
      .join('');

    return `
    <div class="sidebar p-3">
      <a href="index.html" class="sidebar-brand d-flex align-items-center mb-4 text-decoration-none">
        <div style="width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,var(--nd-accent),var(--nd-secondary));display:flex;align-items:center;justify-content:center;margin-right:10px;box-shadow:0 2px 10px rgba(82,183,136,.3)">
          <i class="bi bi-truck-front" style="color:#fff;font-size:1.1rem"></i>
        </div>
        <span class="fs-5 fw-bold">Nature Dispatch</span>
      </a>
      <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:1.2px;color:rgba(255,255,255,.25);font-weight:700;padding:0 14px;margin-bottom:8px">Menu</div>
      <ul class="nav nav-pills flex-column mb-auto">${nav}
        <li class="nav-item" style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06)">
          <a class="nav-link" href="https://cloud.safelaneeld.com/c/616b9deb-04ec-486c-ac55-191d6f9ffe85/l" target="_blank" rel="noopener">
            <i class="bi bi-broadcast me-2"></i>ELD Portal <i class="bi bi-box-arrow-up-right ms-1 small" style="opacity:.5"></i>
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link" href="https://ua.getipass.com/web/guest/home" target="_blank" rel="noopener">
            <i class="bi bi-credit-card me-2"></i>iPass Tolls <i class="bi bi-box-arrow-up-right ms-1 small" style="opacity:.5"></i>
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link" href="https://app.enterprise-diesel.com/" target="_blank" rel="noopener">
            <i class="bi bi-fuel-pump me-2"></i>Enterprise Diesel <i class="bi bi-box-arrow-up-right ms-1 small" style="opacity:.5"></i>
          </a>
        </li>
      </ul>
      <hr>
      <div class="text-center" style="opacity:.35">
        <small>&copy; 2026 Nature Dispatch TMS</small>
      </div>
    </div>`;
  }

  // ── Top Bar HTML (company filter + page title) ────────────
  function renderTopBar(pageTitle) {
    const companies = ['all', ...Object.keys(CONFIG.COMPANIES_MAP)];
    const opts = companies
      .map(
        (c) =>
          `<option value="${c}"${c === _currentCompany ? ' selected' : ''}>${
            c === 'all' ? 'All Companies' : c
          }</option>`
      )
      .join('');

    return `
    <div class="topbar d-flex justify-content-between align-items-center px-4 py-2">
      <div class="d-flex align-items-center gap-3">
        <button class="sidebar-toggle" id="sidebarToggle" title="Toggle menu">
          <i class="bi bi-list"></i>
        </button>
        <h4 class="mb-0">${pageTitle}</h4>
      </div>
      <div class="d-flex align-items-center gap-3">
        <div class="d-flex align-items-center gap-2" style="background:#f8fafb;padding:4px 6px 4px 12px;border-radius:10px;border:1.5px solid #e2e8f0">
          <i class="bi bi-building" style="color:var(--nd-secondary);font-size:.85rem"></i>
          <select id="companyFilter" class="form-select form-select-sm" style="width:180px;border:none;background:transparent;font-size:.82rem;font-weight:600;padding:4px 8px;box-shadow:none">
            ${opts}
          </select>
        </div>
      </div>
    </div>`;
  }

  // ── Bootstrap the page layout ─────────────────────────────
  function init(pageTitle, onReady) {
    document.addEventListener('DOMContentLoaded', () => {
      const wrapper = document.getElementById('app');
      if (!wrapper) return;

      wrapper.innerHTML = `
        ${renderSidebar()}
        <div class="main-content flex-grow-1 d-flex flex-column">
          ${renderTopBar(pageTitle)}
          <div class="page-body flex-grow-1 p-4" id="pageBody">
            <div class="text-center py-5" style="animation:fadeIn .5s ease">
              <div class="spinner-border" style="width:2.5rem;height:2.5rem;border-width:3px" role="status"></div>
              <p class="mt-3" style="color:#94a3b8;font-weight:500;font-size:.9rem">Loading…</p>
            </div>
          </div>
        </div>`;

      // ── Sidebar toggle ──────────────────────────────────
      const _app = document.getElementById('app');
      const _togBtn = document.getElementById('sidebarToggle');
      const _togIcon = _togBtn.querySelector('i');

      // Restore saved state
      if (localStorage.getItem('nd_sidebar') === 'collapsed') {
        _app.classList.add('sidebar-collapsed');
        _togIcon.className = 'bi bi-layout-sidebar-inset';
      }

      _togBtn.addEventListener('click', () => {
        const isMobile = window.innerWidth <= 992;
        if (isMobile) {
          document.body.classList.toggle('sidebar-mobile-open');
        } else {
          _app.classList.toggle('sidebar-collapsed');
          const collapsed = _app.classList.contains('sidebar-collapsed');
          _togIcon.className = collapsed ? 'bi bi-layout-sidebar-inset' : 'bi bi-list';
          localStorage.setItem('nd_sidebar', collapsed ? 'collapsed' : 'open');
        }
      });

      // Mobile overlay to close sidebar
      const overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', () => {
        document.body.classList.remove('sidebar-mobile-open');
      });

      // Company filter change handler
      document.getElementById('companyFilter').addEventListener('change', (e) => {
        setCurrentCompany(e.target.value);
        if (typeof onReady === 'function') onReady();
      });

      // Initial data load
      if (typeof onReady === 'function') onReady();
    });
  }

  // ── Small utilities ───────────────────────────────────────
  function $(selector) {
    return document.querySelector(selector);
  }

  function showToast(message, type = 'success') {
    const container =
      document.getElementById('toastContainer') || createToastContainer();
    const id = 'toast_' + Date.now();
    container.insertAdjacentHTML(
      'beforeend',
      `<div id="${id}" class="toast align-items-center text-bg-${type} border-0 show" role="alert" style="border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.12);animation:fadeInUp .3s ease">
        <div class="d-flex">
          <div class="toast-body" style="font-weight:500;font-size:.875rem">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      </div>`
    );
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.remove();
    }, 4000);
  }

  function createToastContainer() {
    const div = document.createElement('div');
    div.id = 'toastContainer';
    div.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    div.style.zIndex = 1100;
    document.body.appendChild(div);
    return div;
  }

  function formatCurrency(val) {
    const n = parseFloat(val) || 0;
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  function formatDate(val) {
    if (!val) return '—';
    return new Date(val).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  function statusBadge(status) {
    const map = {
      'New':        'bg-info',
      'Dispatched': 'bg-primary',
      'In Transit': 'bg-warning text-dark',
      'Delivered':  'bg-success',
      'Invoiced':   'bg-secondary',
      'Paid':       'bg-dark',
      'Cancelled':  'bg-danger',
    };
    const cls = map[status] || 'bg-secondary';
    return `<span class="badge ${cls}">${status || 'N/A'}</span>`;
  }

  return {
    init,
    getCurrentCompany,
    setCurrentCompany,
    companyFilter,
    $,
    showToast,
    formatCurrency,
    formatDate,
    statusBadge,
  };
})();
