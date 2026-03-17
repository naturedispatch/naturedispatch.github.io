/**
 * ============================================================
 * NATURE DISPATCH TMS — Visual Effects Engine  v2.0
 * ============================================================
 * • Command Center game-menu overlay (Ctrl+K)
 * • Truck Order Button animation (GSAP)
 * • Stat-card counters + magnetic tilt
 * • Page transition effects
 * • NO sidebar effects — sidebar stays stock
 * ============================================================
 */

const NDEffects = (() => {
  /* ── Init ─────────────────────────────────────────────── */
  function init() {
    if (typeof gsap === 'undefined') return;
    requestAnimationFrame(() => {
      animateStatCards();
      animatePageEntry();
      setupHoverEffects();
      buildCommandCenter();
      setupPageTransitions();
    });
  }

  /* ============================================================
     COMMAND CENTER — full-screen game-menu overlay
     ============================================================ */
  function buildCommandCenter() {
    // Only build on pages with a sidebar (not login)
    if (!document.querySelector('.sidebar')) return;

    const currentPage = location.pathname.split('/').pop() || 'index.html';

    // Menu items with descriptions and keyboard shortcut hints
    const menuItems = [
      { href: 'index.html',       icon: 'bi-speedometer2',       label: 'Dashboard',         desc: 'Overview & KPIs',         key: '1' },
      { href: 'loads.html',       icon: 'bi-box-seam',           label: 'Loads',              desc: 'Manage shipments',        key: '2' },
      { href: 'drivers.html',     icon: 'bi-person-badge',       label: 'Drivers',            desc: 'Driver roster',           key: '3' },
      { href: 'trucks.html',      icon: 'bi-truck',              label: 'Trucks & Trailers',  desc: 'Fleet management',        key: '4' },
      { href: 'brokers.html',     icon: 'bi-building',           label: 'Brokers',            desc: 'Broker directory',        key: '5' },
      { href: 'documents.html',   icon: 'bi-file-earmark-check', label: 'Documents',          desc: 'Files & compliance',      key: '6' },
      { href: 'settlements.html', icon: 'bi-calculator',         label: 'Settlements',        desc: 'Driver pay',              key: '7' },
      { href: 'expenses.html',    icon: 'bi-receipt',            label: 'Expenses',           desc: 'Costs & fuel',            key: '8' },
      { href: 'alerts.html',      icon: 'bi-bell',               label: 'Alerts',             desc: 'Notifications',           key: '9' },
      { href: 'reports.html',     icon: 'bi-graph-up',           label: 'Reports',            desc: 'Analytics & charts',      key: '0' },
      { href: 'settings.html',    icon: 'bi-gear',               label: 'Settings',           desc: 'Preferences & API',       key: null },
      { href: 'users.html',       icon: 'bi-people',             label: 'Users',              desc: 'Accounts & roles',        key: null },
    ];

    // External links
    const externalLinks = [
      { href: 'https://cloud.safelaneeld.com/c/616b9deb-04ec-486c-ac55-191d6f9ffe85/l', icon: 'bi-broadcast',    label: 'ELD Portal' },
      { href: 'https://ua.getipass.com/web/guest/home',                                   icon: 'bi-credit-card',  label: 'iPass Tolls' },
      { href: 'https://app.enterprise-diesel.com/',                                       icon: 'bi-fuel-pump',    label: 'Enterprise Diesel' },
    ];

    // Filter by user permissions
    const _hasPerm = (key) => typeof Auth !== 'undefined' && Auth.hasPermission ? Auth.hasPermission(key) : true;

    // Build grid HTML
    const gridHTML = menuItems
      .filter(item => {
        const key = item.href.replace('.html', '');
        return _hasPerm(key);
      })
      .map(item => {
        const isActive = currentPage === item.href;
        return `
        <a href="${item.href}" class="cmd-menu-item${isActive ? ' active-page' : ''}" data-search="${item.label.toLowerCase()} ${item.desc.toLowerCase()}">
          <div class="cmd-menu-icon"><i class="bi ${item.icon}"></i></div>
          <div class="cmd-menu-text">
            <div class="cmd-menu-label">${item.label}</div>
            <div class="cmd-menu-desc">${item.desc}</div>
          </div>
          ${item.key ? `<span class="cmd-menu-key">${item.key}</span>` : ''}
        </a>`;
      })
      .join('');

    const extHTML = externalLinks
      .map(l => `<a href="${l.href}" target="_blank" rel="noopener" class="cmd-ext-link"><i class="bi ${l.icon}"></i>${l.label}<i class="bi bi-box-arrow-up-right"></i></a>`)
      .join('');

    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'cmd-center-overlay';
    overlay.id = 'cmdCenter';
    overlay.innerHTML = `
      <div class="cmd-center-backdrop" id="cmdBackdrop"></div>
      <div class="cmd-center-content">
        <div class="cmd-center-close" id="cmdClose"><i class="bi bi-x-lg"></i></div>
        <div class="cmd-center-header">
          <h2><i class="bi bi-truck-front me-2" style="color:var(--nd-neon)"></i>Command Center</h2>
          <p class="cmd-subtitle">Nature Dispatch TMS</p>
        </div>
        <div class="cmd-center-search">
          <i class="bi bi-search"></i>
          <input type="text" id="cmdSearchInput" placeholder="Search modules…" autocomplete="off" />
        </div>
        <div class="cmd-center-grid" id="cmdGrid">${gridHTML}</div>
        <div class="cmd-center-externals">${extHTML}</div>
        <div class="cmd-center-footer">Press <kbd>Ctrl</kbd> + <kbd>K</kbd> to toggle · <kbd>Esc</kbd> to close · Number keys for quick access</div>
      </div>`;

    document.body.appendChild(overlay);

    // Add trigger button to topbar
    const topbar = document.querySelector('.topbar .d-flex.align-items-center.gap-3');
    if (topbar) {
      const trigger = document.createElement('button');
      trigger.className = 'cmd-trigger-btn';
      trigger.title = 'Command Center (Ctrl+K)';
      trigger.innerHTML = '<i class="bi bi-grid-3x3-gap"></i>';
      // Insert before the search or as first child of the right side
      const rightSide = document.querySelector('.topbar > .d-flex:last-child');
      if (rightSide) {
        rightSide.insertBefore(trigger, rightSide.firstChild);
      } else {
        topbar.appendChild(trigger);
      }
      trigger.addEventListener('click', () => toggleCommandCenter());
    }

    // Event listeners
    document.getElementById('cmdBackdrop').addEventListener('click', () => closeCommandCenter());
    document.getElementById('cmdClose').addEventListener('click', () => closeCommandCenter());

    // Search filter
    const searchInput = document.getElementById('cmdSearchInput');
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      document.querySelectorAll('.cmd-menu-item').forEach(item => {
        const searchText = item.getAttribute('data-search') || '';
        item.style.display = (!q || searchText.includes(q)) ? '' : 'none';
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+K — toggle menu
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandCenter();
        return;
      }

      const isOpen = overlay.classList.contains('open');

      // Esc — close
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        closeCommandCenter();
        return;
      }

      // Number keys for quick nav (when menu is open and search not focused)
      if (isOpen && !document.activeElement.matches('input')) {
        const num = parseInt(e.key);
        if (!isNaN(num)) {
          const target = menuItems.find(m => m.key === String(num));
          if (target && target.href !== currentPage) {
            e.preventDefault();
            navigateWithTransition(target.href);
          }
        }
      }
    });
  }

  function toggleCommandCenter() {
    const overlay = document.getElementById('cmdCenter');
    if (!overlay) return;
    if (overlay.classList.contains('open')) {
      closeCommandCenter();
    } else {
      openCommandCenter();
    }
  }

  function openCommandCenter() {
    const overlay = document.getElementById('cmdCenter');
    if (!overlay) return;
    overlay.classList.add('open');

    // Focus search
    setTimeout(() => {
      const input = document.getElementById('cmdSearchInput');
      if (input) { input.value = ''; input.focus(); }
    }, 100);

    // GSAP stagger entrance for menu items
    if (typeof gsap !== 'undefined') {
      const items = overlay.querySelectorAll('.cmd-menu-item');
      gsap.fromTo(items,
        { y: 20, opacity: 0, scale: .95 },
        {
          y: 0, opacity: 1, scale: 1,
          duration: .35,
          stagger: .03,
          ease: 'power3.out',
          delay: .1
        }
      );

      // Header entrance
      const header = overlay.querySelector('.cmd-center-header');
      if (header) {
        gsap.fromTo(header,
          { y: -15, opacity: 0 },
          { y: 0, opacity: 1, duration: .4, ease: 'power2.out' }
        );
      }
    }
  }

  function closeCommandCenter() {
    const overlay = document.getElementById('cmdCenter');
    if (!overlay) return;

    if (typeof gsap !== 'undefined') {
      const items = overlay.querySelectorAll('.cmd-menu-item');
      gsap.to(items, {
        y: -10, opacity: 0,
        duration: .2,
        stagger: .015,
        ease: 'power2.in',
        onComplete: () => overlay.classList.remove('open')
      });
    } else {
      overlay.classList.remove('open');
    }
  }

  /* ============================================================
     PAGE TRANSITIONS
     ============================================================ */
  function setupPageTransitions() {
    // Intercept internal navigation links
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href) return;

      // Only intercept local .html links (not external, not #, not javascript:)
      if (href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:') || link.target === '_blank') return;
      if (!href.endsWith('.html')) return;

      // Don't transition to current page
      const current = location.pathname.split('/').pop() || 'index.html';
      if (href === current) return;

      e.preventDefault();
      navigateWithTransition(href);
    });
  }

  function navigateWithTransition(href) {
    if (typeof gsap === 'undefined') {
      window.location.href = href;
      return;
    }

    // Close command center first if open
    const cmdOverlay = document.getElementById('cmdCenter');
    if (cmdOverlay && cmdOverlay.classList.contains('open')) {
      cmdOverlay.classList.remove('open');
    }

    // Create transition overlay
    const transEl = document.createElement('div');
    transEl.className = 'nd-page-transition';
    transEl.innerHTML = `
      <div class="nd-transition-bg"></div>
      <div class="nd-transition-icon"><i class="bi bi-truck-front"></i></div>`;
    document.body.appendChild(transEl);

    const bg = transEl.querySelector('.nd-transition-bg');
    const icon = transEl.querySelector('.nd-transition-icon');

    const tl = gsap.timeline({
      onComplete: () => { window.location.href = href; }
    });

    tl.to(bg, { scaleY: 1, duration: .35, ease: 'power3.inOut' })
      .fromTo(icon, { opacity: 0, scale: .6 }, { opacity: 1, scale: 1, duration: .25, ease: 'back.out(1.7)' }, '-=.15');
  }

  /* ============================================================
     TRUCK BUTTON ANIMATION — adapted from Order Button example
     ============================================================ */
  function initTruckButton(button) {
    if (!button || button.dataset.truckInit) return;
    button.dataset.truckInit = '1';

    if (typeof gsap === 'undefined') return;

    button.addEventListener('click', (e) => {
      // Prevent re-triggering while animating
      if (button.classList.contains('animation') || button.classList.contains('done')) return;

      e.preventDefault();

      button.classList.add('animation');

      gsap.to(button, {
        '--truck-x': 0,
        '--truck-y': 0,
        '--truck-y-n': -26,
        duration: 0,
      });

      const tl = gsap.timeline({
        onComplete: () => onTruckComplete(button)
      });

      // Box loading
      tl.to(button, { '--box-s': 1, '--box-o': 1, duration: .3, delay: .5 })
        // Box sliding into truck
        .to(button, { '--box-x': 0, '--box-y': 0, duration: .4, ease: 'back.in(1.6)' })
        // Truck starts moving
        .to(button, { '--truck-x': 160, duration: .8, ease: 'power1.in' })
        // Progress bar fills with truck
        .to(button, { '--progress': 1, duration: .8, ease: 'power1.in' }, '-=.8')
        // Slight truck bounce while moving
        .to(button, { '--truck-y': -2, duration: .15, yoyo: true, repeat: 3 }, '-=.6');
    });
  }

  function onTruckComplete(button) {
    button.classList.remove('animation');
    button.classList.add('done');

    // Fire custom event so the page module can handle the action
    button.dispatchEvent(new CustomEvent('truck-done', { bubbles: true }));

    // Reset after a delay
    gsap.delayedCall(2.5, () => resetTruckButton(button));
  }

  function resetTruckButton(button) {
    button.classList.remove('done');
    gsap.set(button, {
      '--progress': 0,
      '--truck-x': 4,
      '--truck-y': 0,
      '--truck-y-n': -26,
      '--box-x': -24,
      '--box-y': -6,
      '--box-s': .5,
      '--box-o': 0,
    });
  }

  /**
   * Create the truck button HTML.
   * @param {string} defaultText – Label shown before click (e.g. "Dispatch Load")
   * @param {string} successText – Label shown after animation (e.g. "Dispatched!")
   * @returns {string} HTML string for the truck button
   */
  function truckButtonHTML(defaultText, successText) {
    return `
    <button class="truck-button" type="button">
      <span class="default">${defaultText}</span>
      <span class="success">${successText}<svg viewBox="0 0 12 10"><polyline points="1.5 6 4.5 9 10.5 1"></polyline></svg></span>
      <div class="truck">
        <div class="wheel"></div>
        <div class="back"></div>
        <div class="front"></div>
        <div class="box"></div>
      </div>
    </button>`;
  }

  /* ============================================================
     STAT CARDS — Animated Counters + Entrance
     ============================================================ */
  function animateStatCards() {
    const cards = document.querySelectorAll('.stat-card');
    if (!cards.length) return;

    cards.forEach((card, i) => {
      gsap.from(card, {
        y: 40, opacity: 0, scale: .95,
        duration: .6,
        delay: .1 + (i * .08),
        ease: 'power3.out',
      });

      // Animate counter values
      const valueEl = card.querySelector('.stat-value');
      if (valueEl) {
        const text = valueEl.textContent.trim();
        const numMatch = text.match(/[\$]?([\d,]+)/);
        if (numMatch) {
          const prefix = text.startsWith('$') ? '$' : '';
          const targetNum = parseInt(numMatch[1].replace(/,/g, ''));
          const suffix = text.replace(/[\$\d,]/g, '');
          if (targetNum > 0 && targetNum < 1000000) {
            const obj = { val: 0 };
            gsap.to(obj, {
              val: targetNum,
              duration: 1.2,
              delay: .3 + (i * .08),
              ease: 'power2.out',
              onUpdate() {
                valueEl.textContent = prefix + Math.round(obj.val).toLocaleString() + suffix;
              }
            });
          }
        }
      }
    });
  }

  /* ── Page Entry Animation ─────────────────────────────── */
  function animatePageEntry() {
    const pageBody = document.getElementById('pageBody');
    if (!pageBody) return;

    const tables = pageBody.querySelectorAll('.table-container');
    tables.forEach((t, i) => {
      gsap.from(t, {
        y: 30, opacity: 0,
        duration: .5,
        delay: .2 + (i * .1),
        ease: 'power2.out',
      });
    });
  }

  /* ── Hover Effects ────────────────────────────────────── */
  function setupHoverEffects() {
    // Stat card magnetic tilt
    document.querySelectorAll('.stat-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        gsap.to(card, {
          rotateX: (y - rect.height / 2) / 20,
          rotateY: (rect.width / 2 - x) / 20,
          transformPerspective: 800,
          duration: .3,
          ease: 'power2.out',
        });
      });
      card.addEventListener('mouseleave', () => {
        gsap.to(card, {
          rotateX: 0, rotateY: 0,
          duration: .5,
          ease: 'elastic.out(1, 0.5)',
        });
      });
    });

    // Button click ripple
    document.querySelectorAll('.btn-nd').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ripple = document.createElement('span');
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        Object.assign(ripple.style, {
          position: 'absolute',
          width: size + 'px', height: size + 'px',
          left: (e.clientX - rect.left - size / 2) + 'px',
          top: (e.clientY - rect.top - size / 2) + 'px',
          background: 'rgba(255,255,255,.2)',
          borderRadius: '50%',
          transform: 'scale(0)',
          pointerEvents: 'none',
        });
        btn.style.position = 'relative';
        btn.style.overflow = 'hidden';
        btn.appendChild(ripple);
        gsap.to(ripple, {
          scale: 2.5, opacity: 0,
          duration: .6,
          ease: 'power2.out',
          onComplete: () => ripple.remove(),
        });
      });
    });

    // Init any truck buttons on the page
    document.querySelectorAll('.truck-button').forEach(initTruckButton);
  }

  /* ── Observe DOM for dynamic content ──────────────────── */
  function observe() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length) {
          const newCards = document.querySelectorAll('.stat-card:not([data-animated])');
          newCards.forEach((card, i) => {
            card.setAttribute('data-animated', '1');
            gsap.from(card, {
              y: 30, opacity: 0, scale: .95,
              duration: .5,
              delay: i * .06,
              ease: 'power3.out'
            });
          });
          // Re-init any new truck buttons or hover effects
          document.querySelectorAll('.truck-button').forEach(initTruckButton);
          setupHoverEffects();
        }
      }
    });
    const pageBody = document.getElementById('pageBody');
    if (pageBody) {
      observer.observe(pageBody, { childList: true, subtree: true });
    }
  }

  /* ── Bootstrap ────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      init();
      observe();
    }, 50);
  });

  return {
    init,
    animateStatCards,
    animatePageEntry,
    truckButtonHTML,
    initTruckButton,
    resetTruckButton,
    openCommandCenter,
    closeCommandCenter,
    toggleCommandCenter,
    navigateWithTransition,
  };
})();
