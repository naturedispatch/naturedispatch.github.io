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
      { href: 'index.html',       icon: 'bi-speedometer2',    label: 'Dashboard',          key: 'dashboard' },
      { href: 'loads.html',       icon: 'bi-box-seam',        label: 'Loads',              key: 'loads' },
      { href: 'pipeline.html',   icon: 'bi-kanban',          label: 'Pipeline',           key: 'pipeline' },
      { href: 'drivers.html',     icon: 'bi-person-badge',    label: 'Drivers',            key: 'drivers' },
      { href: 'trucks.html',      icon: 'bi-truck',           label: 'Trucks & Trailers',  key: 'trucks' },
      { href: 'brokers.html',     icon: 'bi-building',        label: 'Brokers',            key: 'brokers' },
      { href: 'documents.html',   icon: 'bi-file-earmark-check', label: 'Documents',       key: 'documents' },
      { href: 'settlements.html', icon: 'bi-calculator',      label: 'Settlements',        key: 'settlements' },
      { href: 'expenses.html',    icon: 'bi-receipt',         label: 'Expenses',           key: 'expenses' },
      { href: 'alerts.html',      icon: 'bi-bell',            label: 'Alerts',             key: 'alerts' },
      { href: 'reports.html',    icon: 'bi-graph-up',        label: 'Reports',            key: 'reports' },
    ];

    // Filter by user permissions (Auth global from auth.js)
    const _hasPerm = (key) => typeof Auth !== 'undefined' && Auth.hasPermission ? Auth.hasPermission(key) : true;
    const visibleLinks = links.filter(l => _hasPerm(l.key));

    const nav = visibleLinks
      .map(
        (l) => `
      <li class="nav-item">
        <a class="nav-link${page === l.href ? ' active' : ''}" href="${l.href}">
          <i class="bi ${l.icon} me-2"></i>${l.label}
        </a>
      </li>`
      )
      .join('');

    // Settings & Users links (permission-gated)
    const settingsLink = _hasPerm('settings') ? `
        <li class="nav-item" style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06)">
          <a class="nav-link${page === 'settings.html' ? ' active' : ''}" href="settings.html">
            <i class="bi bi-gear me-2"></i>Settings
          </a>
        </li>` : '';

    const usersLink = _hasPerm('users') ? `
        <li class="nav-item">
          <a class="nav-link${page === 'users.html' ? ' active' : ''}" href="users.html">
            <i class="bi bi-people me-2"></i>Users
          </a>
        </li>` : '';

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
        ${settingsLink}
        ${usersLink}
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
        <small>&copy; ${new Date().getFullYear()} Nature Dispatch TMS</small>
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
        ${typeof Auth !== 'undefined' && Auth.user ? `
        <div class="d-flex align-items-center gap-2">
          <div class="user-avatar-topbar" title="${Auth.user.name}">${(Auth.user.name || '?')[0].toUpperCase()}</div>
          <div class="d-none d-md-block" style="line-height:1.2">
            <div style="font-size:.78rem;font-weight:600">${Auth.user.name}</div>
            <div style="font-size:.65rem;color:#94a3b8">${Auth.user.role}</div>
          </div>
          <button class="btn btn-sm btn-outline-secondary ms-1" onclick="Auth.logout()" title="Sign out" style="border-radius:8px;padding:3px 8px">
            <i class="bi bi-box-arrow-right"></i>
          </button>
        </div>` : ''}
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

      // ── Restore saved appearance settings ───────────────
      _restoreAppearance();

      // Initial data load
      if (typeof onReady === 'function') onReady();
    });
  }

  // ── Small utilities ───────────────────────────────────────

  /**
   * Restore saved theme, accent color, and logo from localStorage.
   * Called on every page init so settings persist across navigation.
   */
  function _restoreAppearance() {
    // Theme (light / dark)
    const savedTheme = localStorage.getItem('nd_theme');
    if (savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    // Accent color preset
    const presetJson = localStorage.getItem('nd_accent_preset');
    if (presetJson) {
      try {
        const p = JSON.parse(presetJson);
        const root = document.documentElement;
        root.style.setProperty('--nd-primary',   p.primary);
        root.style.setProperty('--nd-secondary', p.secondary);
        root.style.setProperty('--nd-accent',    p.accent);
        root.style.setProperty('--nd-light',     p.light);
        root.style.setProperty('--nd-dark',      p.dark);
      } catch (_) { /* ignore corrupt data */ }
    }

    // Company logo
    const savedLogo = localStorage.getItem('nd_logo');
    if (savedLogo) {
      const brand = document.querySelector('.sidebar-brand');
      if (brand) {
        const iconDiv = brand.querySelector('div');
        if (iconDiv) {
          iconDiv.innerHTML = `<img src="${savedLogo}" alt="Logo" style="width:100%;height:100%;object-fit:contain;border-radius:8px">`;
        }
      }
    }
  }

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

  // ── Shared lookup helpers (avoid duplicating in every module) ─

  /**
   * Resolve a linked-record ID (or array of IDs) to a display name.
   * Tries common fields: Full Name, Broker Name, Company Name, Truck Number.
   * @param {Array} cache  – Array of Airtable records
   * @param {string|string[]} linkedIds – Record ID or array of IDs
   * @param {string} [preferField] – Optional preferred field name
   * @returns {string} Display name or '—'
   */
  function lookupName(cache, linkedIds, preferField) {
    if (!linkedIds) return '—';
    const id = Array.isArray(linkedIds) ? linkedIds[0] : linkedIds;
    const rec = cache.find(r => r.id === id);
    if (!rec) return '—';
    if (preferField && rec.fields[preferField]) return rec.fields[preferField];
    return rec.fields['Full Name']
      || rec.fields['Broker Name']
      || rec.fields['Company Name']
      || rec.fields['Truck Number']
      || rec.id;
  }

  /**
   * Populate a <select> element with records from a cache.
   * Keeps the first <option> (placeholder) and replaces the rest.
   * @param {string} selectId – DOM id of the <select>
   * @param {Array} records   – Airtable records array
   * @param {string} field    – Field name used for option labels
   */
  function fillSelect(selectId, records, field) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const placeholder = sel.querySelector('option');
    sel.innerHTML = '';
    if (placeholder) sel.appendChild(placeholder);
    records.forEach(r => {
      const o = document.createElement('option');
      o.value = r.id;
      o.textContent = r.fields[field] || r.id;
      sel.appendChild(o);
    });
  }

  /**
   * Disable a button and show a spinner while an async action runs.
   * @param {HTMLElement} btn – The button element
   * @param {Function} asyncFn – Async function to execute
   */
  async function withLoading(btn, asyncFn) {
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving…';
    try {
      await asyncFn();
    } catch (err) {
      showToast(err.message || 'Operation failed', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
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
    lookupName,
    fillSelect,
    withLoading,
  };
})();
