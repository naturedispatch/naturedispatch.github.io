/**
 * ============================================================
 * NATURE DISPATCH TMS — Maps Provider Facade  v3.0
 * ============================================================
 * Auto-selects between TomTom and Google Maps based on which
 * API key is configured.  Priority: TomTom → Google.
 *
 * All other modules call  GMaps.createMap / GMaps.renderRoute
 * etc. — this facade delegates to the active provider.
 * ============================================================
 */

const GMaps = (() => {

  const KEYS = {
    GMAPS:    'nd_gmaps_key',
    TOMTOM:   'nd_tomtom_key',
    PROVIDER: 'nd_maps_provider',   // 'tomtom' | 'google' | 'auto'
  };

  function getApiKey() {
    // Return whichever key belongs to the active provider
    const p = _activeProvider();
    if (p === 'tomtom') return localStorage.getItem(KEYS.TOMTOM) || '';
    return localStorage.getItem(KEYS.GMAPS) || '';
  }

  /** Determine the active provider: explicit choice or auto-detect */
  function _activeProvider() {
    const pref = localStorage.getItem(KEYS.PROVIDER) || 'auto';
    if (pref === 'tomtom' && localStorage.getItem(KEYS.TOMTOM)) return 'tomtom';
    if (pref === 'google'  && localStorage.getItem(KEYS.GMAPS))  return 'google';
    // Auto: prefer TomTom (Google billing broken)
    if (localStorage.getItem(KEYS.TOMTOM)) return 'tomtom';
    if (localStorage.getItem(KEYS.GMAPS))  return 'google';
    return 'none';
  }

  /** Get the underlying provider module */
  function _provider() {
    const p = _activeProvider();
    if (p === 'tomtom' && typeof TomTomProvider !== 'undefined') return TomTomProvider;
    if (p === 'google')  return _GoogleProvider;
    if (typeof TomTomProvider !== 'undefined' && TomTomProvider.getApiKey()) return TomTomProvider;
    return _GoogleProvider;  // fallback
  }

  /** Which provider name is active? (for UI) */
  function activeProviderName() {
    const p = _activeProvider();
    if (p === 'tomtom') return 'TomTom';
    if (p === 'google') return 'Google Maps';
    return 'None';
  }

  /* ══════════════════════════════════════════════════════════
     GOOGLE MAPS — inline provider (kept from v2)
     ══════════════════════════════════════════════════════════ */
  const _GoogleProvider = (() => {

    function getApiKey() { return localStorage.getItem(KEYS.GMAPS) || ''; }

    let _mapsPromise = null;

    function _ensureMapsLoaded(apiKey) {
      if (window.google?.maps?.Map) return Promise.resolve();
      if (_mapsPromise) return _mapsPromise;

      _mapsPromise = new Promise((resolve, reject) => {
        const cbName = '_gmapsInit' + Date.now();
        window[cbName] = () => { delete window[cbName]; resolve(); };
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&callback=${cbName}&libraries=places,geometry,routes`;
        script.async = true;
        script.onerror = () => { _mapsPromise = null; reject(new Error('Failed to load Google Maps SDK')); };
        document.head.appendChild(script);
      });
      return _mapsPromise;
    }

    async function ensureLoaded() {
      const key = getApiKey();
      if (!key) throw new Error('Google Maps API key not configured. Go to Settings → Integrations.');
      await _ensureMapsLoaded(key);
    }

    async function calculateDistance(origin, destination) {
      await ensureLoaded();
      if (!origin || !destination) throw new Error('Both origin and destination addresses are required.');
      return new Promise((resolve, reject) => {
        const service = new google.maps.DistanceMatrixService();
        service.getDistanceMatrix({
          origins: [origin], destinations: [destination],
          travelMode: google.maps.TravelMode.DRIVING,
          unitSystem: google.maps.UnitSystem.IMPERIAL,
        }, (response, status) => {
          if (status !== 'OK') { reject(new Error(`Distance Matrix error: ${status}`)); return; }
          const el = response?.rows?.[0]?.elements?.[0];
          if (!el || el.status !== 'OK') { reject(new Error(`Route failed: ${el?.status || 'UNKNOWN'}`)); return; }
          const miles = Math.round(el.distance.value * 0.000621371);
          resolve({ distanceMiles: miles, distanceText: el.distance.text, durationText: el.duration.text });
        });
      });
    }

    async function calculateRouteDistance(addresses) {
      if (addresses.length < 2) throw new Error('Need at least 2 addresses.');
      await ensureLoaded();
      return new Promise((resolve, reject) => {
        const service = new google.maps.DirectionsService();
        const origin = addresses[0];
        const destination = addresses[addresses.length - 1];
        const waypoints = addresses.slice(1, -1).map(a => ({ location: a, stopover: true }));
        service.route({ origin, destination, waypoints, travelMode: google.maps.TravelMode.DRIVING, unitSystem: google.maps.UnitSystem.IMPERIAL }, (result, status) => {
          if (status !== 'OK') { reject(new Error(`Directions error: ${status}`)); return; }
          const legs = result.routes[0].legs.map(leg => ({
            from: leg.start_address, to: leg.end_address,
            distanceMiles: Math.round(leg.distance.value * 0.000621371),
            distanceText: leg.distance.text, durationText: leg.duration.text,
          }));
          const totalMiles = legs.reduce((sum, l) => sum + l.distanceMiles, 0);
          resolve({ totalMiles, legs, directionsResult: result });
        });
      });
    }

    const _mapStyles = [
      { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#c9e2d8' }] },
      { featureType: 'landscape', elementType: 'geometry.fill', stylers: [{ color: '#f4f8f6' }] },
      { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#52b788' }] },
      { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#2d6a4f' }] },
      { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#d8f3dc' }] },
      { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#e5f5eb' }] },
    ];

    async function createMap(container, options = {}) {
      await ensureLoaded();
      const el = typeof container === 'string' ? document.getElementById(container) : container;
      if (!el) throw new Error('Map container not found');
      return new google.maps.Map(el, {
        zoom: options.zoom || 5,
        center: options.center || { lat: 39.8283, lng: -98.5795 },
        mapTypeControl: false, streetViewControl: false, fullscreenControl: true, zoomControl: true,
        styles: options.styles || _mapStyles, ...options,
      });
    }

    function _markerIcon(type, seq) {
      const colors = {
        pickup: { bg: '#3b82f6', border: '#1d4ed8' }, delivery: { bg: '#22c55e', border: '#15803d' },
        waypoint: { bg: '#f59e0b', border: '#d97706' }, truck: { bg: '#52b788', border: '#2d6a4f' },
      };
      const c = colors[type] || colors.waypoint;
      const label = seq != null ? seq : (type === 'pickup' ? 'P' : type === 'delivery' ? 'D' : '');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">
        <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28s16-16 16-28C32 7.16 24.84 0 16 0z" fill="${c.bg}" stroke="${c.border}" stroke-width="1.5"/>
        <circle cx="16" cy="15" r="9" fill="white" opacity=".9"/>
        <text x="16" y="19" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-weight="700" font-size="11" fill="${c.bg}">${label}</text>
      </svg>`;
      return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), scaledSize: new google.maps.Size(32, 44), anchor: new google.maps.Point(16, 44) };
    }

    async function renderRoute(map, stops) {
      await ensureLoaded();
      if (!stops || stops.length < 2) throw new Error('Need at least 2 stops for route.');
      const addresses = stops.map(s => s.address).filter(Boolean);
      if (addresses.length < 2) throw new Error('Stops missing addresses.');
      const service = new google.maps.DirectionsService();
      const origin = addresses[0]; const destination = addresses[addresses.length - 1];
      const waypoints = addresses.slice(1, -1).map(a => ({ location: a, stopover: true }));
      return new Promise((resolve, reject) => {
        service.route({ origin, destination, waypoints, travelMode: google.maps.TravelMode.DRIVING, optimizeWaypoints: false }, (result, status) => {
          if (status !== 'OK') { reject(new Error(`Route rendering failed: ${status}`)); return; }
          const renderer = new google.maps.DirectionsRenderer({
            map, directions: result, suppressMarkers: true,
            polylineOptions: { strokeColor: '#2d6a4f', strokeWeight: 4, strokeOpacity: 0.85 },
          });
          const markers = [];
          const legs = result.routes[0].legs;
          markers.push(_addStopMarker(map, legs[0].start_location, stops[0], 0));
          for (let i = 0; i < legs.length; i++) {
            const stopData = stops[i + 1] || { type: 'delivery', label: '' };
            markers.push(_addStopMarker(map, legs[i].end_location, stopData, i + 1));
          }
          resolve({ directionsResult: result, renderer, markers });
        });
      });
    }

    function _addStopMarker(map, position, stopData, index) {
      const type = (stopData.type || '').toLowerCase().includes('pickup') ? 'pickup'
                 : (stopData.type || '').toLowerCase().includes('deliv') ? 'delivery' : 'waypoint';
      const marker = new google.maps.Marker({
        map, position, icon: _markerIcon(type, stopData.seq || index + 1),
        title: `${stopData.type || 'Stop'} #${index + 1}: ${stopData.label || stopData.address || ''}`,
        animation: google.maps.Animation.DROP,
      });
      const info = new google.maps.InfoWindow({
        content: `<div style="font-family:Inter,system-ui,sans-serif;min-width:180px;padding:4px">
          <div style="font-weight:700;font-size:.85rem;margin-bottom:4px">
            <span style="display:inline-block;padding:1px 8px;border-radius:4px;font-size:.72rem;color:#fff;background:${type === 'pickup' ? '#3b82f6' : type === 'delivery' ? '#22c55e' : '#f59e0b'};margin-right:4px">${stopData.type || 'Stop'}</span>#${stopData.seq || index + 1}
          </div>
          <div style="font-size:.82rem;color:#374151">${stopData.address || stopData.label || 'No address'}</div>
          ${stopData.appointment ? `<div style="font-size:.72rem;color:#6b7280;margin-top:4px"><i class="bi bi-clock"></i> ${stopData.appointment}</div>` : ''}
        </div>`,
      });
      marker.addListener('click', () => info.open(map, marker));
      return marker;
    }

    function addLoadPins(map, pins) {
      const bounds = new google.maps.LatLngBounds();
      const markers = [];
      pins.forEach(pin => {
        const pos = { lat: pin.lat, lng: pin.lng }; bounds.extend(pos);
        const statusColor = { 'New':'#3b82f6','Dispatched':'#8b5cf6','In Transit':'#f59e0b','Delivered':'#22c55e','Invoiced':'#6366f1','Paid':'#10b981','Pending Approval':'#ef4444','Cancelled':'#6b7280' }[pin.status] || '#52b788';
        const marker = new google.maps.Marker({ map, position: pos, icon: _markerIcon('truck', ''), title: pin.label });
        const infoWindow = new google.maps.InfoWindow({
          content: `<div style="font-family:Inter,system-ui,sans-serif;min-width:200px;padding:4px">
            <div style="font-weight:700;font-size:.88rem;margin-bottom:6px">${pin.label}</div>
            <div style="margin-bottom:4px"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:.72rem;color:#fff;background:${statusColor}">${pin.status}</span></div>
            <div style="font-size:.8rem;color:#374151">${pin.info || ''}</div>
          </div>`,
        });
        marker.addListener('click', () => infoWindow.open(map, marker));
        markers.push(marker);
      });
      if (pins.length > 0) map.fitBounds(bounds, 60);
      return markers;
    }

    async function attachAutocomplete(input, options = {}) {
      await ensureLoaded();
      const el = typeof input === 'string' ? document.getElementById(input) : input;
      if (!el) return null;
      const autocomplete = new google.maps.places.Autocomplete(el, {
        types: ['address'], componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'geometry', 'address_components'], ...options,
      });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place?.formatted_address) el.value = place.formatted_address;
        el.dispatchEvent(new CustomEvent('place-selected', { bubbles: true, detail: {
          address: place?.formatted_address || el.value,
          lat: place?.geometry?.location?.lat(), lng: place?.geometry?.location?.lng(),
          components: place?.address_components || [],
        }}));
      });
      return autocomplete;
    }

    async function geocode(address) {
      await ensureLoaded();
      return new Promise((resolve, reject) => {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address }, (results, status) => {
          if (status !== 'OK' || !results[0]) { reject(new Error(`Geocoding failed: ${status}`)); return; }
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng(), formatted: results[0].formatted_address });
        });
      });
    }

    async function batchGeocode(addresses) {
      await ensureLoaded();
      const results = [];
      for (let i = 0; i < addresses.length; i++) {
        try { const r = await geocode(addresses[i]); results.push({ address: addresses[i], lat: r.lat, lng: r.lng }); }
        catch (_) { results.push(null); }
        if (i < addresses.length - 1) await new Promise(r => setTimeout(r, 200));
      }
      return results;
    }

    return { getApiKey, ensureLoaded, calculateDistance, calculateRouteDistance, createMap, renderRoute, addLoadPins, attachAutocomplete, geocode, batchGeocode };
  })();

  /* ══════════════════════════════════════════════════════════
     FACADE — Delegates every call to the active provider
     ══════════════════════════════════════════════════════════ */

  return {
    getApiKey,
    activeProviderName,
    ensureLoaded:           (...a) => _provider().ensureLoaded(...a),
    calculateDistance:      (...a) => _provider().calculateDistance(...a),
    calculateRouteDistance: (...a) => _provider().calculateRouteDistance(...a),
    createMap:             (...a) => _provider().createMap(...a),
    renderRoute:           (...a) => _provider().renderRoute(...a),
    addLoadPins:           (...a) => _provider().addLoadPins(...a),
    attachAutocomplete:    (...a) => _provider().attachAutocomplete(...a),
    geocode:               (...a) => _provider().geocode(...a),
    batchGeocode:          (...a) => _provider().batchGeocode(...a),
  };
})();
