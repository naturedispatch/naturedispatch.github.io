/**
 * ============================================================
 * NATURE DISPATCH TMS — Settings Page
 * ============================================================
 * • Logo upload (stored in localStorage as base64)
 * • Light / Dark theme toggle
 * • Accent color presets
 * • Future placeholders: AI, Users, Roles
 * ============================================================
 */

const Settings = (() => {
  // ── Storage keys ──────────────────────────────────────────
  const KEYS = {
    THEME:  'nd_theme',        // 'light' | 'dark'
    LOGO:   'nd_logo',         // base64 data-URI
    ACCENT: 'nd_accent_color', // hex string
  };

  // ── Accent color presets ──────────────────────────────────
  const ACCENT_PRESETS = [
    { name: 'Forest Green', primary: '#1b4332', secondary: '#2d6a4f', accent: '#52b788', light: '#d8f3dc', dark: '#081c15' },
    { name: 'Ocean Blue',   primary: '#1a365d', secondary: '#2b6cb0', accent: '#4299e1', light: '#bee3f8', dark: '#0a1628' },
    { name: 'Sunset Orange',primary: '#7b341e', secondary: '#c05621', accent: '#ed8936', light: '#feebc8', dark: '#1a0f05' },
    { name: 'Royal Purple', primary: '#44337a', secondary: '#6b46c1', accent: '#9f7aea', light: '#e9d8fd', dark: '#1a102e' },
    { name: 'Steel Gray',   primary: '#1a202c', secondary: '#4a5568', accent: '#a0aec0', light: '#edf2f7', dark: '#0d1117' },
    { name: 'Ruby Red',     primary: '#742a2a', secondary: '#c53030', accent: '#fc8181', light: '#fed7d7', dark: '#1a0505' },
  ];

  // ── Render settings page ──────────────────────────────────
  function render() {
    const body = document.getElementById('pageBody');
    const savedTheme  = localStorage.getItem(KEYS.THEME) || 'light';
    const savedLogo   = localStorage.getItem(KEYS.LOGO);
    const savedAccent = localStorage.getItem(KEYS.ACCENT) || '#52b788';

    body.innerHTML = `
      <div class="row g-4">
        <!-- Left: Settings Nav -->
        <div class="col-lg-3">
          <div class="settings-section" style="padding:20px">
            <nav class="settings-nav nav flex-column gap-1">
              <a class="nav-link active" href="#appearance" data-section="appearance">
                <i class="bi bi-palette me-2"></i>Appearance
              </a>
              <a class="nav-link" href="#branding" data-section="branding">
                <i class="bi bi-image me-2"></i>Branding
              </a>
              <hr style="margin:8px 0;opacity:.1">
              <a class="nav-link disabled" href="#" style="opacity:.4">
                <i class="bi bi-robot me-2"></i>AI Assistant
                <span class="badge bg-secondary ms-auto" style="font-size:.65rem">Soon</span>
              </a>
              <a class="nav-link disabled" href="#" style="opacity:.4">
                <i class="bi bi-people me-2"></i>Users
                <span class="badge bg-secondary ms-auto" style="font-size:.65rem">Soon</span>
              </a>
              <a class="nav-link disabled" href="#" style="opacity:.4">
                <i class="bi bi-shield-lock me-2"></i>Roles & Permissions
                <span class="badge bg-secondary ms-auto" style="font-size:.65rem">Soon</span>
              </a>
            </nav>
          </div>
        </div>

        <!-- Right: Settings Content -->
        <div class="col-lg-9">
          <!-- Appearance Section -->
          <div id="section-appearance" class="settings-section">
            <h5><i class="bi bi-palette"></i> Appearance</h5>

            <!-- Theme Toggle -->
            <div class="d-flex align-items-center justify-content-between mb-4 p-3" style="background:rgba(82,183,136,.04);border-radius:12px;border:1px solid rgba(82,183,136,.08)">
              <div>
                <div style="font-weight:700;font-size:.9rem">Theme Mode</div>
                <div style="font-size:.8rem;color:#94a3b8">Switch between light and dark interface</div>
              </div>
              <div class="d-flex align-items-center gap-3">
                <i class="bi bi-sun" style="font-size:1.1rem;color:#f59e0b"></i>
                <label class="theme-switch">
                  <input type="checkbox" id="themeToggle" ${savedTheme === 'dark' ? 'checked' : ''}>
                  <span class="slider"></span>
                </label>
                <i class="bi bi-moon-stars" style="font-size:1rem;color:#6366f1"></i>
              </div>
            </div>

            <!-- Accent Color -->
            <div class="mb-2">
              <div style="font-weight:700;font-size:.9rem;margin-bottom:4px">Accent Color</div>
              <div style="font-size:.8rem;color:#94a3b8;margin-bottom:14px">Choose a color theme for buttons, links and highlights</div>
              <div class="d-flex flex-wrap gap-3" id="colorSwatches">
                ${ACCENT_PRESETS.map((p, i) => `
                  <div class="text-center">
                    <div class="color-swatch ${p.accent === savedAccent ? 'active' : ''}"
                         style="background:linear-gradient(135deg, ${p.secondary}, ${p.accent})"
                         data-index="${i}" title="${p.name}">
                      ${p.accent === savedAccent ? '<i class="bi bi-check2 text-white"></i>' : ''}
                    </div>
                    <div style="font-size:.68rem;font-weight:600;color:#94a3b8;margin-top:4px">${p.name}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Branding Section -->
          <div id="section-branding" class="settings-section">
            <h5><i class="bi bi-image"></i> Branding</h5>

            <div class="row align-items-start g-4">
              <div class="col-auto">
                <div style="font-weight:700;font-size:.9rem;margin-bottom:8px">Company Logo</div>
                <div class="logo-preview" id="logoPreview" title="Click to upload logo">
                  ${savedLogo
                    ? `<img src="${savedLogo}" alt="Company Logo" id="logoImg">`
                    : `<div class="logo-placeholder">
                        <i class="bi bi-cloud-arrow-up"></i>
                        <span>Upload Logo</span>
                      </div>`}
                </div>
                <input type="file" id="logoInput" accept="image/*" class="d-none">
              </div>
              <div class="col">
                <div style="font-size:.82rem;color:#94a3b8;margin-top:32px">
                  <p style="margin-bottom:8px"><i class="bi bi-info-circle me-1"></i> Recommended: Square image, at least 200×200px</p>
                  <p style="margin-bottom:8px"><i class="bi bi-file-earmark-image me-1"></i> Formats: PNG, JPG, SVG (max 500KB)</p>
                  <p style="margin-bottom:16px"><i class="bi bi-hdd me-1"></i> Stored locally in your browser</p>
                  ${savedLogo ? `<button class="btn btn-sm btn-outline-danger" id="removeLogo">
                    <i class="bi bi-trash3 me-1"></i>Remove Logo
                  </button>` : ''}
                </div>
              </div>
            </div>
          </div>

          <!-- Coming Soon Sections -->
          <div class="settings-section" style="opacity:.6">
            <h5><i class="bi bi-robot"></i> AI Assistant <span class="badge bg-secondary ms-2" style="font-size:.7rem">Coming Soon</span></h5>
            <p style="font-size:.85rem;color:#94a3b8;margin:0">Integration with Google Gemini for smart load suggestions, route optimization, and automated reporting.</p>
          </div>

          <div class="settings-section" style="opacity:.6">
            <h5><i class="bi bi-people"></i> Users & Roles <span class="badge bg-secondary ms-2" style="font-size:.7rem">Coming Soon</span></h5>
            <p style="font-size:.85rem;color:#94a3b8;margin:0">Manage team members, assign roles (Admin, Dispatcher, Driver, Accounting), and control access permissions.</p>
          </div>
        </div>
      </div>
    `;

    bindEvents();
  }

  // ── Event Bindings ────────────────────────────────────────
  function bindEvents() {
    // Theme toggle
    const toggle = document.getElementById('themeToggle');
    toggle.addEventListener('change', () => {
      const theme = toggle.checked ? 'dark' : 'light';
      applyTheme(theme);
      localStorage.setItem(KEYS.THEME, theme);
      App.showToast(`Switched to ${theme} mode`, 'success');
    });

    // Color swatches
    document.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        const idx = parseInt(sw.dataset.index);
        const preset = ACCENT_PRESETS[idx];
        applyAccentColor(preset);
        localStorage.setItem(KEYS.ACCENT, preset.accent);

        // Update active state
        document.querySelectorAll('.color-swatch').forEach(s => {
          s.classList.remove('active');
          s.innerHTML = '';
        });
        sw.classList.add('active');
        sw.innerHTML = '<i class="bi bi-check2 text-white"></i>';

        App.showToast(`Applied "${preset.name}" theme`, 'success');
      });
    });

    // Logo upload
    const logoPreview = document.getElementById('logoPreview');
    const logoInput   = document.getElementById('logoInput');

    logoPreview.addEventListener('click', () => logoInput.click());

    logoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Size check (500KB)
      if (file.size > 512000) {
        App.showToast('Logo must be under 500KB', 'danger');
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        localStorage.setItem(KEYS.LOGO, dataUrl);
        applySidebarLogo(dataUrl);

        // Update preview
        logoPreview.innerHTML = `<img src="${dataUrl}" alt="Company Logo" id="logoImg">`;
        App.showToast('Logo updated successfully!', 'success');

        // Re-render to show Remove button
        render();
      };
      reader.readAsDataURL(file);
    });

    // Remove logo
    const removeBtn = document.getElementById('removeLogo');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        localStorage.removeItem(KEYS.LOGO);
        resetSidebarLogo();
        App.showToast('Logo removed', 'success');
        render();
      });
    }

    // Settings nav
    document.querySelectorAll('.settings-nav .nav-link:not(.disabled)').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.settings-nav .nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        const section = link.dataset.section;
        if (section) {
          document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // ── Theme Application ─────────────────────────────────────
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  // ── Accent Color Application ──────────────────────────────
  function applyAccentColor(preset) {
    const root = document.documentElement;
    root.style.setProperty('--nd-primary',   preset.primary);
    root.style.setProperty('--nd-secondary', preset.secondary);
    root.style.setProperty('--nd-accent',    preset.accent);
    root.style.setProperty('--nd-light',     preset.light);
    root.style.setProperty('--nd-dark',      preset.dark);

    // Save the full preset
    localStorage.setItem('nd_accent_preset', JSON.stringify(preset));
  }

  // ── Sidebar Logo Application ──────────────────────────────
  function applySidebarLogo(dataUrl) {
    const brand = document.querySelector('.sidebar-brand');
    if (!brand) return;
    const iconDiv = brand.querySelector('div');
    if (iconDiv) {
      iconDiv.innerHTML = `<img src="${dataUrl}" alt="Logo" style="width:100%;height:100%;object-fit:contain;border-radius:8px">`;
    }
  }

  function resetSidebarLogo() {
    const brand = document.querySelector('.sidebar-brand');
    if (!brand) return;
    const iconDiv = brand.querySelector('div');
    if (iconDiv) {
      iconDiv.innerHTML = `<i class="bi bi-truck-front" style="color:#fff;font-size:1.1rem"></i>`;
    }
  }

  // ── Boot ──────────────────────────────────────────────────
  App.init('Settings', render);

  return { applyTheme, applyAccentColor, applySidebarLogo, KEYS, ACCENT_PRESETS };
})();
