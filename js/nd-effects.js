/**
 * ============================================================
 * NATURE DISPATCH TMS — Visual Effects Engine
 * GSAP-powered animations & interactions
 * Inspired by: Active Navbar Indicator, Electric Border,
 *              Order Button Animation, Car Slider
 * ============================================================
 */

const NDEffects = (() => {
  /* ── Wait for DOM + GSAP ──────────────────────────────── */
  function init() {
    if (typeof gsap === 'undefined') return;

    requestAnimationFrame(() => {
      animateSidebar();
      animateStatCards();
      animatePageEntry();
      setupHoverEffects();
      setupSidebarIndicator();
    });
  }

  /* ── Sidebar Entrance Animation ───────────────────────── */
  function animateSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // Brand entrance
    const brand = sidebar.querySelector('.sidebar-brand');
    if (brand) {
      gsap.from(brand, {
        x: -30,
        opacity: 0,
        duration: .6,
        ease: 'power3.out',
        delay: .1
      });
    }

    // Nav links stagger entrance
    const navLinks = sidebar.querySelectorAll('.nav-link');
    if (navLinks.length) {
      gsap.from(navLinks, {
        x: -20,
        opacity: 0,
        duration: .4,
        stagger: .04,
        ease: 'power2.out',
        delay: .2
      });
    }
  }

  /* ── Sidebar Active Indicator (Electric Glow Bar) ─────── */
  function setupSidebarIndicator() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const activeLink = sidebar.querySelector('.nav-link.active');
    if (!activeLink) return;

    // Create the glow indicator element
    const indicator = document.createElement('div');
    indicator.className = 'nd-nav-indicator';
    Object.assign(indicator.style, {
      position: 'absolute',
      left: '0',
      width: '3px',
      background: 'linear-gradient(180deg, #6ee7b7, #52b788, #6ee7b7)',
      borderRadius: '0 4px 4px 0',
      pointerEvents: 'none',
      zIndex: '10',
      boxShadow: '0 0 8px rgba(110,231,183,.5), 0 0 16px rgba(82,183,136,.3), 0 0 24px rgba(82,183,136,.15)',
      transition: 'top .35s cubic-bezier(.4,0,.2,1), height .35s cubic-bezier(.4,0,.2,1)',
    });

    // Position relative container
    const navContainer = sidebar.querySelector('ul.nav');
    if (!navContainer) return;
    navContainer.style.position = 'relative';
    navContainer.appendChild(indicator);

    // Position indicator at active link
    function positionIndicator(link) {
      const navRect = navContainer.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      indicator.style.top = (linkRect.top - navRect.top + 8) + 'px';
      indicator.style.height = (linkRect.height - 16) + 'px';
    }

    positionIndicator(activeLink);

    // Animate indicator on hover
    const allLinks = sidebar.querySelectorAll('.nav-link');
    allLinks.forEach(link => {
      link.addEventListener('mouseenter', () => {
        positionIndicator(link);
        gsap.to(indicator, {
          boxShadow: '0 0 12px rgba(110,231,183,.6), 0 0 24px rgba(82,183,136,.4), 0 0 36px rgba(82,183,136,.2)',
          duration: .2
        });
      });
    });

    // Return to active on mouse leave
    const navList = sidebar.querySelector('ul.nav');
    if (navList) {
      navList.addEventListener('mouseleave', () => {
        const currentActive = sidebar.querySelector('.nav-link.active');
        if (currentActive) {
          positionIndicator(currentActive);
          gsap.to(indicator, {
            boxShadow: '0 0 8px rgba(110,231,183,.5), 0 0 16px rgba(82,183,136,.3), 0 0 24px rgba(82,183,136,.15)',
            duration: .3
          });
        }
      });
    }
  }

  /* ── Stat Cards: Animated Counters + Entrance ─────────── */
  function animateStatCards() {
    const cards = document.querySelectorAll('.stat-card');
    if (!cards.length) return;

    cards.forEach((card, i) => {
      gsap.from(card, {
        y: 40,
        opacity: 0,
        scale: .95,
        duration: .6,
        delay: .1 + (i * .08),
        ease: 'power3.out',
      });

      // Animate the counter values
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
                const formatted = Math.round(obj.val).toLocaleString();
                valueEl.textContent = prefix + formatted + suffix;
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

    // Animate table containers
    const tables = pageBody.querySelectorAll('.table-container');
    tables.forEach((t, i) => {
      gsap.from(t, {
        y: 30,
        opacity: 0,
        duration: .5,
        delay: .2 + (i * .1),
        ease: 'power2.out',
      });
    });
  }

  /* ── Hover Glow Effects ───────────────────────────────── */
  function setupHoverEffects() {
    // Stat card magnetic tilt
    const cards = document.querySelectorAll('.stat-card');
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;

        gsap.to(card, {
          rotateX: rotateX,
          rotateY: rotateY,
          transformPerspective: 800,
          duration: .3,
          ease: 'power2.out',
        });
      });

      card.addEventListener('mouseleave', () => {
        gsap.to(card, {
          rotateX: 0,
          rotateY: 0,
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
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        Object.assign(ripple.style, {
          position: 'absolute',
          width: size + 'px',
          height: size + 'px',
          left: x + 'px',
          top: y + 'px',
          background: 'rgba(255,255,255,.2)',
          borderRadius: '50%',
          transform: 'scale(0)',
          pointerEvents: 'none',
        });

        btn.style.position = 'relative';
        btn.style.overflow = 'hidden';
        btn.appendChild(ripple);

        gsap.to(ripple, {
          scale: 2.5,
          opacity: 0,
          duration: .6,
          ease: 'power2.out',
          onComplete: () => ripple.remove(),
        });
      });
    });
  }

  /* ── Observe DOM for dynamic content ──────────────────── */
  function observe() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length) {
          // Re-animate new stat cards
          const newCards = document.querySelectorAll('.stat-card:not([data-animated])');
          newCards.forEach((card, i) => {
            card.setAttribute('data-animated', '1');
            gsap.from(card, {
              y: 30,
              opacity: 0,
              scale: .95,
              duration: .5,
              delay: i * .06,
              ease: 'power3.out'
            });
          });

          // Re-run hover effects for new buttons
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
    // Small delay to let the page render first
    setTimeout(() => {
      init();
      observe();
    }, 50);
  });

  return { init, animateStatCards, animatePageEntry };
})();
