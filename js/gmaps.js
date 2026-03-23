/**
 * ============================================================
 * NATURE DISPATCH TMS — Google Maps Module  v2.0
 * ============================================================
 * • Distance Matrix & Directions APIs (existing)
 * • NEW: Render interactive maps with route polylines
 * • NEW: Add markers for stops (pickup = blue, delivery = green)
 * • NEW: Places Autocomplete on address inputs
 * • NEW: Geocoding helpers
 * • NEW: Dashboard fleet overview map
 * ============================================================
 */

const GMaps = (() => {

  const STORAGE_KEY = 'nd_gmaps_key';

  function getApiKey() {
    return localStorage.getItem(STORAGE_KEY) || '';
  }

  /* ══════════════════════════════════════════════════════════
     LOAD GOOGLE MAPS SDK
     ══════════════════════════════════════════════════════════ */
  let _mapsPromise = null;

  function _ensureMapsLoaded(apiKey) {
    if (window.google?.maps?.DistanceMatrixService) return Promise.resolve();
    if (_mapsPromise) return _mapsPromise;

    _mapsPromise = new Promise((resolve, reject) => {
      const cbName = '_gmapsInit' + Date.now();
      window[cbName] = () => {
        delete window[cbName];
        resolve();
      };
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${cbName}&libraries=places,geometry`;
      script.async = true;
      script.onerror = () => {
        _mapsPromise = null;
        reject(new Error('Failed to load Google Maps SDK'));
      };
      document.head.appendChild(script);
    });
    return _mapsPromise;
  }

  /** Ensure the SDK is loaded using the saved API key */
  async function ensureLoaded() {
    const key = getApiKey();
    if (!key) throw new Error('Google Maps API key not configured. Go to Settings → Integrations.');
    await _ensureMapsLoaded(key);
  }

  /* ══════════════════════════════════════════════════════════
     DISTANCE CALCULATION (existing — kept as-is)
     ══════════════════════════════════════════════════════════ */

  async function calculateDistance(origin, destination) {
    await ensureLoaded();
    if (!origin || !destination) throw new Error('Both origin and destination addresses are required.');

    return new Promise((resolve, reject) => {
      const service = new google.maps.DistanceMatrixService();
      service.getDistanceMatrix({
        origins: [origin],
        destinations: [destination],
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

      service.route({
        origin, destination, waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.IMPERIAL,
      }, (result, status) => {
        if (status !== 'OK') { reject(new Error(`Directions error: ${status}`)); return; }
        const legs = result.routes[0].legs.map(leg => ({
          from: leg.start_address,
          to: leg.end_address,
          distanceMiles: Math.round(leg.distance.value * 0.000621371),
          distanceText: leg.distance.text,
          durationText: leg.duration.text,
        }));
        const totalMiles = legs.reduce((sum, l) => sum + l.distanceMiles, 0);
        resolve({ totalMiles, legs, directionsResult: result });
      });
    });
  }

  /* ══════════════════════════════════════════════════════════
     MAP RENDERING — Interactive route maps
     ══════════════════════════════════════════════════════════ */

  // ND-branded map styling (dark green tones to match TMS theme)
  const _mapStyles = [
    { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#c9e2d8' }] },
    { featureType: 'landscape', elementType: 'geometry.fill', stylers: [{ color: '#f4f8f6' }] },
    { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#52b788' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#2d6a4f' }] },
    { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#d8f3dc' }] },
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#e5f5eb' }] },
  ];

  /**
   * Render a Google Map inside a container element.
   * @param {HTMLElement|string} container – DOM element or id
   * @param {Object} [options]
   * @returns {google.maps.Map}
   */
  async function createMap(container, options = {}) {
    await ensureLoaded();
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) throw new Error('Map container not found');

    return new google.maps.Map(el, {
      zoom: options.zoom || 5,
      center: options.center || { lat: 39.8283, lng: -98.5795 }, // Center of US
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      styles: options.styles || _mapStyles,
      ...options,
    });
  }

  /**
   * Generate a custom SVG marker icon for stops.
   * @param {'pickup'|'delivery'|'waypoint'|'truck'} type
   * @param {number} [seq] – Stop sequence number
   * @returns {Object} google.maps.Icon
   */
  function _markerIcon(type, seq) {
    const colors = {
      pickup:   { bg: '#3b82f6', border: '#1d4ed8' },  // blue
      delivery: { bg: '#22c55e', border: '#15803d' },  // green
      waypoint: { bg: '#f59e0b', border: '#d97706' },  // amber
      truck:    { bg: '#52b788', border: '#2d6a4f' },  // brand
    };
    const c = colors[type] || colors.waypoint;
    const label = seq != null ? seq : (type === 'pickup' ? 'P' : type === 'delivery' ? 'D' : '');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28s16-16 16-28C32 7.16 24.84 0 16 0z" fill="${c.bg}" stroke="${c.border}" stroke-width="1.5"/>
      <circle cx="16" cy="15" r="9" fill="white" opacity=".9"/>
      <text x="16" y="19" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-weight="700" font-size="11" fill="${c.bg}">${label}</text>
    </svg>`;

    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(32, 44),
      anchor: new google.maps.Point(16, 44),
    };
  }

  /**
   * Render a route on a map with stop markers and driving polyline.
   * @param {google.maps.Map} map
   * @param {Array<{address: string, type: string, label?: string, seq?: number}>} stops
   * @returns {Promise<{directionsResult, renderer, markers: Array}>}
   */
  async function renderRoute(map, stops) {
    await ensureLoaded();
    if (!stops || stops.length < 2) throw new Error('Need at least 2 stops for route.');

    const addresses = stops.map(s => s.address).filter(Boolean);
    if (addresses.length < 2) throw new Error('Stops missing addresses.');

    const service = new google.maps.DirectionsService();
    const origin = addresses[0];
    const destination = addresses[addresses.length - 1];
    const waypoints = addresses.slice(1, -1).map(a => ({ location: a, stopover: true }));

    return new Promise((resolve, reject) => {
      service.route({
        origin, destination, waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      }, (result, status) => {
        if (status !== 'OK') { reject(new Error(`Route rendering failed: ${status}`)); return; }

        // Draw the route polyline
        const renderer = new google.maps.DirectionsRenderer({
          map,
          directions: result,
          suppressMarkers: true, // We'll add custom markers
          polylineOptions: {
            strokeColor: '#2d6a4f',
            strokeWeight: 4,
            strokeOpacity: 0.85,
          },
        });

        // Add custom markers for each stop
        const markers = [];
        const route = result.routes[0];
        const legs = route.legs;

        // First stop
        markers.push(_addStopMarker(map, legs[0].start_location, stops[0], 0));

        // Waypoints + final
        for (let i = 0; i < legs.length; i++) {
          const stopIdx = i + 1;
          const stopData = stops[stopIdx] || { type: 'delivery', label: '' };
          markers.push(_addStopMarker(map, legs[i].end_location, stopData, stopIdx));
        }

        resolve({ directionsResult: result, renderer, markers });
      });
    });
  }

  function _addStopMarker(map, position, stopData, index) {
    const type = (stopData.type || '').toLowerCase().includes('pickup') ? 'pickup'
               : (stopData.type || '').toLowerCase().includes('deliv') ? 'delivery'
               : 'waypoint';

    const marker = new google.maps.Marker({
      map,
      position,
      icon: _markerIcon(type, stopData.seq || index + 1),
      title: `${stopData.type || 'Stop'} #${index + 1}: ${stopData.label || stopData.address || ''}`,
      animation: google.maps.Animation.DROP,
    });

    // Info window
    const info = new google.maps.InfoWindow({
      content: `
        <div style="font-family:Inter,system-ui,sans-serif;min-width:180px;padding:4px">
          <div style="font-weight:700;font-size:.85rem;margin-bottom:4px">
            <span style="display:inline-block;padding:1px 8px;border-radius:4px;font-size:.72rem;color:#fff;background:${type === 'pickup' ? '#3b82f6' : type === 'delivery' ? '#22c55e' : '#f59e0b'};margin-right:4px">${stopData.type || 'Stop'}</span>
            #${stopData.seq || index + 1}
          </div>
          <div style="font-size:.82rem;color:#374151">${stopData.address || stopData.label || 'No address'}</div>
          ${stopData.appointment ? `<div style="font-size:.72rem;color:#6b7280;margin-top:4px"><i class="bi bi-clock"></i> ${stopData.appointment}</div>` : ''}
        </div>`,
    });
    marker.addListener('click', () => info.open(map, marker));

    return marker;
  }

  /**
   * Render multiple load pins on a single map (dashboard fleet overview).
   * @param {google.maps.Map} map
   * @param {Array<{lat: number, lng: number, label: string, status: string, info: string}>} pins
   * @returns {Array<google.maps.Marker>}
   */
  function addLoadPins(map, pins) {
    const bounds = new google.maps.LatLngBounds();
    const markers = [];

    pins.forEach(pin => {
      const pos = { lat: pin.lat, lng: pin.lng };
      bounds.extend(pos);

      const statusColor = {
        'New': '#3b82f6', 'Dispatched': '#8b5cf6', 'In Transit': '#f59e0b',
        'Delivered': '#22c55e', 'Invoiced': '#6366f1', 'Paid': '#10b981',
        'Pending Approval': '#ef4444', 'Cancelled': '#6b7280',
      }[pin.status] || '#52b788';

      const marker = new google.maps.Marker({
        map, position: pos,
        icon: _markerIcon('truck', ''),
        title: pin.label,
      });

      const infoContent = `
        <div style="font-family:Inter,system-ui,sans-serif;min-width:200px;padding:4px">
          <div style="font-weight:700;font-size:.88rem;margin-bottom:6px">${pin.label}</div>
          <div style="margin-bottom:4px"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:.72rem;color:#fff;background:${statusColor}">${pin.status}</span></div>
          <div style="font-size:.8rem;color:#374151">${pin.info || ''}</div>
        </div>`;
      const infoWindow = new google.maps.InfoWindow({ content: infoContent });
      marker.addListener('click', () => infoWindow.open(map, marker));
      markers.push(marker);
    });

    if (pins.length > 0) map.fitBounds(bounds, 60);
    return markers;
  }

  /* ══════════════════════════════════════════════════════════
     PLACES AUTOCOMPLETE
     ══════════════════════════════════════════════════════════ */

  /**
   * Attach Google Places Autocomplete to an input field.
   * @param {HTMLInputElement|string} input – DOM element or id
   * @param {Object} [options] – google.maps.places.AutocompleteOptions
   * @returns {google.maps.places.Autocomplete}
   */
  async function attachAutocomplete(input, options = {}) {
    await ensureLoaded();
    const el = typeof input === 'string' ? document.getElementById(input) : input;
    if (!el) return null;

    const autocomplete = new google.maps.places.Autocomplete(el, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
      fields: ['formatted_address', 'geometry', 'address_components'],
      ...options,
    });

    // When place selected, replace value with formatted address
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place && place.formatted_address) {
        el.value = place.formatted_address;
      }
      // Fire a custom event for consumers
      el.dispatchEvent(new CustomEvent('place-selected', {
        bubbles: true,
        detail: {
          address: place?.formatted_address || el.value,
          lat: place?.geometry?.location?.lat(),
          lng: place?.geometry?.location?.lng(),
          components: place?.address_components || [],
        },
      }));
    });

    return autocomplete;
  }

  /* ══════════════════════════════════════════════════════════
     GEOCODING
     ══════════════════════════════════════════════════════════ */

  /**
   * Geocode an address to lat/lng.
   * @param {string} address
   * @returns {Promise<{lat: number, lng: number, formatted: string}>}
   */
  async function geocode(address) {
    await ensureLoaded();
    return new Promise((resolve, reject) => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address }, (results, status) => {
        if (status !== 'OK' || !results[0]) {
          reject(new Error(`Geocoding failed: ${status}`));
          return;
        }
        const loc = results[0].geometry.location;
        resolve({
          lat: loc.lat(),
          lng: loc.lng(),
          formatted: results[0].formatted_address,
        });
      });
    });
  }

  /**
   * Batch geocode an array of addresses.
   * Throttles to avoid rate limits (200ms between requests).
   * @param {Array<string>} addresses
   * @returns {Promise<Array<{address: string, lat: number, lng: number}|null>>}
   */
  async function batchGeocode(addresses) {
    await ensureLoaded();
    const results = [];
    for (let i = 0; i < addresses.length; i++) {
      try {
        const r = await geocode(addresses[i]);
        results.push({ address: addresses[i], lat: r.lat, lng: r.lng });
      } catch (_) {
        results.push(null);
      }
      if (i < addresses.length - 1) await _sleep(200);
    }
    return results;
  }

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ══════════════════════════════════════════════════════════
     PUBLIC API
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
