/**
 * ============================================================
 * NATURE DISPATCH TMS — TomTom Maps Provider
 * ============================================================
 * Drop-in alternative to Google Maps using TomTom SDK v6.
 * Same public API shape as the Google provider so GMaps facade
 * can delegate transparently.
 *
 * TomTom APIs used:
 *   • Maps SDK for Web (interactive maps)
 *   • Routing API (directions + distance)
 *   • Search API (geocoding + fuzzy search for autocomplete)
 * ============================================================
 */

const TomTomProvider = (() => {

  const STORAGE_KEY = 'nd_tomtom_key';
  const SDK_VERSION = '6.25.0';

  function getApiKey() {
    return localStorage.getItem(STORAGE_KEY) || '';
  }

  /* ══════════════════════════════════════════════════════════
     LOAD TOMTOM SDK (CSS + JS)
     ══════════════════════════════════════════════════════════ */
  let _sdkPromise = null;

  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load: ' + src));
      document.head.appendChild(s);
    });
  }

  function _loadCSS(href) {
    return new Promise((resolve) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href;
      l.onload = resolve;
      l.onerror = resolve; // non-blocking
      document.head.appendChild(l);
    });
  }

  function _ensureSDKLoaded() {
    if (window.tt?.map) return Promise.resolve();
    if (_sdkPromise) return _sdkPromise;

    _sdkPromise = Promise.all([
      _loadCSS(`https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/${SDK_VERSION}/maps/maps.css`),
      _loadScript(`https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/${SDK_VERSION}/maps/maps-web.min.js`),
      _loadScript(`https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/${SDK_VERSION}/services/services-web.min.js`),
    ]).catch(err => {
      _sdkPromise = null;
      throw err;
    });

    return _sdkPromise;
  }

  async function ensureLoaded() {
    const key = getApiKey();
    if (!key) throw new Error('TomTom API key not configured. Go to Settings → Integrations.');
    await _ensureSDKLoaded();
  }

  /* ══════════════════════════════════════════════════════════
     DISTANCE CALCULATION
     ══════════════════════════════════════════════════════════ */

  async function calculateDistance(origin, destination) {
    await ensureLoaded();
    if (!origin || !destination) throw new Error('Both origin and destination addresses are required.');

    const [orig, dest] = await Promise.all([geocode(origin), geocode(destination)]);
    const key = getApiKey();

    const url = `https://api.tomtom.com/routing/1/calculateRoute/${orig.lat},${orig.lng}:${dest.lat},${dest.lng}/json?key=${encodeURIComponent(key)}&travelMode=car`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`TomTom Routing error: ${resp.status}`);
    const data = await resp.json();
    const route = data.routes?.[0];
    if (!route) throw new Error('No route found');

    const meters = route.summary.lengthInMeters;
    const seconds = route.summary.travelTimeInSeconds;
    const miles = Math.round(meters * 0.000621371);

    return {
      distanceMiles: miles,
      distanceText: miles + ' mi',
      durationText: _formatDuration(seconds),
    };
  }

  async function calculateRouteDistance(addresses) {
    if (addresses.length < 2) throw new Error('Need at least 2 addresses.');
    await ensureLoaded();

    // Geocode all addresses
    const coords = await batchGeocode(addresses);
    const valid = coords.filter(Boolean);
    if (valid.length < 2) throw new Error('Could not geocode enough addresses.');

    const key = getApiKey();
    const locations = valid.map(c => `${c.lat},${c.lng}`).join(':');

    const url = `https://api.tomtom.com/routing/1/calculateRoute/${locations}/json?key=${encodeURIComponent(key)}&travelMode=car&routeType=fastest`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`TomTom Routing error: ${resp.status}`);
    const data = await resp.json();
    const route = data.routes?.[0];
    if (!route) throw new Error('No route found');

    const legs = route.legs.map((leg, i) => {
      const m = Math.round(leg.summary.lengthInMeters * 0.000621371);
      return {
        from: addresses[i] || '',
        to: addresses[i + 1] || '',
        distanceMiles: m,
        distanceText: m + ' mi',
        durationText: _formatDuration(leg.summary.travelTimeInSeconds),
      };
    });
    const totalMiles = legs.reduce((s, l) => s + l.distanceMiles, 0);

    return { totalMiles, legs, _routeData: route };
  }

  function _formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return h > 0 ? `${h} hr ${m} min` : `${m} min`;
  }

  /* ══════════════════════════════════════════════════════════
     MAP RENDERING
     ══════════════════════════════════════════════════════════ */

  async function createMap(container, options = {}) {
    await ensureLoaded();
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) throw new Error('Map container not found');

    const map = tt.map({
      key: getApiKey(),
      container: el,
      center: options.center ? [options.center.lng, options.center.lat] : [-98.5795, 39.8283],
      zoom: options.zoom || 4,
    });

    // Add navigation controls
    map.addControl(new tt.NavigationControl(), 'top-right');

    // Store ref for later
    map._ndContainer = el;
    return map;
  }

  /**
   * Build custom marker HTML (same look as Google version).
   */
  function _markerHtml(type, seq) {
    const colors = {
      pickup:   { bg: '#3b82f6', border: '#1d4ed8' },
      delivery: { bg: '#22c55e', border: '#15803d' },
      waypoint: { bg: '#f59e0b', border: '#d97706' },
      truck:    { bg: '#52b788', border: '#2d6a4f' },
    };
    const c = colors[type] || colors.waypoint;
    const label = seq != null ? seq : (type === 'pickup' ? 'P' : type === 'delivery' ? 'D' : '');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28s16-16 16-28C32 7.16 24.84 0 16 0z" fill="${c.bg}" stroke="${c.border}" stroke-width="1.5"/>
      <circle cx="16" cy="15" r="9" fill="white" opacity=".9"/>
      <text x="16" y="19" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-weight="700" font-size="11" fill="${c.bg}">${label}</text>
    </svg>`;
  }

  function _createMarkerEl(type, seq) {
    const el = document.createElement('div');
    el.innerHTML = _markerHtml(type, seq);
    el.style.cursor = 'pointer';
    return el;
  }

  /**
   * Render a route on a TomTom map with markers.
   */
  async function renderRoute(map, stops) {
    await ensureLoaded();
    if (!stops || stops.length < 2) throw new Error('Need at least 2 stops for route.');

    const addresses = stops.map(s => s.address).filter(Boolean);
    if (addresses.length < 2) throw new Error('Stops missing addresses.');

    const coords = await batchGeocode(addresses);
    const valid = coords.filter(Boolean);
    if (valid.length < 2) throw new Error('Could not geocode stop addresses.');

    const key = getApiKey();
    const locations = valid.map(c => `${c.lat},${c.lng}`).join(':');

    const url = `https://api.tomtom.com/routing/1/calculateRoute/${locations}/json?key=${encodeURIComponent(key)}&travelMode=car&routeType=fastest`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`TomTom routing error: ${resp.status}`);
    const data = await resp.json();
    const route = data.routes?.[0];
    if (!route) throw new Error('No route returned');

    // Draw route polyline
    const geoJson = _routeToGeoJSON(route);
    if (map.getSource('nd-route')) {
      map.getSource('nd-route').setData(geoJson);
    } else {
      map.addSource('nd-route', { type: 'geojson', data: geoJson });
      map.addLayer({
        id: 'nd-route-line',
        type: 'line',
        source: 'nd-route',
        paint: {
          'line-color': '#2d6a4f',
          'line-width': 4,
          'line-opacity': 0.85,
        },
      });
    }

    // Add markers
    const markers = [];
    for (let i = 0; i < valid.length; i++) {
      const stopData = stops[i] || {};
      const type = (stopData.type || '').toLowerCase().includes('pickup') ? 'pickup'
                 : (stopData.type || '').toLowerCase().includes('deliv') ? 'delivery'
                 : 'waypoint';

      const popupHtml = `
        <div style="font-family:Inter,system-ui,sans-serif;min-width:180px;padding:4px">
          <div style="font-weight:700;font-size:.85rem;margin-bottom:4px">
            <span style="display:inline-block;padding:1px 8px;border-radius:4px;font-size:.72rem;color:#fff;background:${type === 'pickup' ? '#3b82f6' : type === 'delivery' ? '#22c55e' : '#f59e0b'};margin-right:4px">${stopData.type || 'Stop'}</span>
            #${stopData.seq || i + 1}
          </div>
          <div style="font-size:.82rem;color:#374151">${stopData.address || stopData.label || 'No address'}</div>
          ${stopData.appointment ? `<div style="font-size:.72rem;color:#6b7280;margin-top:4px">⏰ ${stopData.appointment}</div>` : ''}
        </div>`;

      const popup = new tt.Popup({ offset: [0, -44], closeButton: true }).setHTML(popupHtml);
      const marker = new tt.Marker({ element: _createMarkerEl(type, stopData.seq || i + 1) })
        .setLngLat([valid[i].lng, valid[i].lat])
        .setPopup(popup)
        .addTo(map);
      markers.push(marker);
    }

    // Fit bounds
    const bounds = new tt.LngLatBounds();
    valid.forEach(c => bounds.extend([c.lng, c.lat]));
    map.fitBounds(bounds, { padding: 60, maxZoom: 14 });

    return { markers };
  }

  function _routeToGeoJSON(route) {
    const coords = route.legs.flatMap(leg =>
      leg.points.map(p => [p.longitude, p.latitude])
    );
    return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} };
  }

  /**
   * Add load pins to a map (dashboard fleet overview).
   */
  function addLoadPins(map, pins) {
    const bounds = new tt.LngLatBounds();
    const markers = [];

    pins.forEach(pin => {
      bounds.extend([pin.lng, pin.lat]);

      const statusColor = {
        'New': '#3b82f6', 'Dispatched': '#8b5cf6', 'In Transit': '#f59e0b',
        'Delivered': '#22c55e', 'Invoiced': '#6366f1', 'Paid': '#10b981',
        'Pending Approval': '#ef4444', 'Cancelled': '#6b7280',
      }[pin.status] || '#52b788';

      const popupHtml = `
        <div style="font-family:Inter,system-ui,sans-serif;min-width:200px;padding:4px">
          <div style="font-weight:700;font-size:.88rem;margin-bottom:6px">${pin.label}</div>
          <div style="margin-bottom:4px"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:.72rem;color:#fff;background:${statusColor}">${pin.status}</span></div>
          <div style="font-size:.8rem;color:#374151">${pin.info || ''}</div>
        </div>`;

      const popup = new tt.Popup({ offset: [0, -44], closeButton: true }).setHTML(popupHtml);
      const marker = new tt.Marker({ element: _createMarkerEl('truck', '') })
        .setLngLat([pin.lng, pin.lat])
        .setPopup(popup)
        .addTo(map);
      markers.push(marker);
    });

    if (pins.length > 0) map.fitBounds(bounds, { padding: 60, maxZoom: 12 });
    return markers;
  }

  /* ══════════════════════════════════════════════════════════
     SEARCH / AUTOCOMPLETE
     ══════════════════════════════════════════════════════════ */

  let _acDebounce = null;

  async function attachAutocomplete(input) {
    await ensureLoaded();
    const el = typeof input === 'string' ? document.getElementById(input) : input;
    if (!el) return null;

    // Create results dropdown
    let dropdown = el._ndAcDropdown;
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'nd-tt-autocomplete';
      dropdown.style.cssText = 'display:none;position:absolute;z-index:10600;background:#fff;border:1px solid rgba(82,183,136,.2);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.12);max-height:260px;overflow-y:auto;width:100%;';
      el.parentNode.style.position = 'relative';
      el.parentNode.appendChild(dropdown);
      el._ndAcDropdown = dropdown;
    }

    const key = getApiKey();

    el.addEventListener('input', () => {
      clearTimeout(_acDebounce);
      const q = el.value.trim();
      if (q.length < 3) { dropdown.style.display = 'none'; return; }

      _acDebounce = setTimeout(async () => {
        try {
          const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(q)}.json?key=${encodeURIComponent(key)}&countrySet=US&typeahead=true&limit=5&entityTypeSet=Address,Street,Municipality`;
          const resp = await fetch(url);
          if (!resp.ok) return;
          const data = await resp.json();

          if (!data.results?.length) { dropdown.style.display = 'none'; return; }

          dropdown.innerHTML = data.results.map(r => {
            const addr = r.address?.freeformAddress || '';
            return `<div class="nd-tt-ac-item" style="padding:8px 12px;font-size:.85rem;cursor:pointer;border-bottom:1px solid #f1f5f9;" data-lat="${r.position?.lat}" data-lng="${r.position?.lon}" data-addr="${addr.replace(/"/g, '&quot;')}">${addr}</div>`;
          }).join('');
          dropdown.style.display = '';
        } catch (_) { dropdown.style.display = 'none'; }
      }, 250);
    });

    // Click result
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.nd-tt-ac-item');
      if (!item) return;
      el.value = item.dataset.addr;
      dropdown.style.display = 'none';
      el.dispatchEvent(new CustomEvent('place-selected', {
        bubbles: true,
        detail: {
          address: item.dataset.addr,
          lat: parseFloat(item.dataset.lat),
          lng: parseFloat(item.dataset.lng),
          components: [],
        },
      }));
    });

    // Hover effect
    dropdown.addEventListener('mouseover', (e) => {
      const item = e.target.closest('.nd-tt-ac-item');
      if (item) item.style.background = 'rgba(82,183,136,.06)';
    });
    dropdown.addEventListener('mouseout', (e) => {
      const item = e.target.closest('.nd-tt-ac-item');
      if (item) item.style.background = '';
    });

    // Hide on blur (delayed to allow click)
    el.addEventListener('blur', () => setTimeout(() => { dropdown.style.display = 'none'; }, 200));

    return { _el: el, _dropdown: dropdown };
  }

  /* ══════════════════════════════════════════════════════════
     GEOCODING
     ══════════════════════════════════════════════════════════ */

  async function geocode(address) {
    const key = getApiKey();
    if (!key) throw new Error('TomTom API key not configured.');

    const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(address)}.json?key=${encodeURIComponent(key)}&limit=1&countrySet=US`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Geocoding failed: ${resp.status}`);
    const data = await resp.json();
    const r = data.results?.[0];
    if (!r) throw new Error('No geocoding result for: ' + address);

    return {
      lat: r.position.lat,
      lng: r.position.lon,
      formatted: r.address?.freeformAddress || address,
    };
  }

  async function batchGeocode(addresses) {
    const results = [];
    for (let i = 0; i < addresses.length; i++) {
      try {
        const r = await geocode(addresses[i]);
        results.push({ address: addresses[i], lat: r.lat, lng: r.lng });
      } catch (_) {
        results.push(null);
      }
      if (i < addresses.length - 1) await _sleep(150);
    }
    return results;
  }

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ══════════════════════════════════════════════════════════
     PUBLIC API  (same shape as Google provider)
     ══════════════════════════════════════════════════════════ */
  return {
    getApiKey,
    ensureLoaded,
    calculateDistance,
    calculateRouteDistance,
    createMap,
    renderRoute,
    addLoadPins,
    attachAutocomplete,
    geocode,
    batchGeocode,
  };
})();
