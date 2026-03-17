/**
 * ============================================================
 * NATURE DISPATCH TMS — Google Maps Distance Module
 * ============================================================
 * • Uses Google Maps Distance Matrix API to calculate distances
 * • Fills the Miles field on loads automatically
 * ============================================================
 */

const GMaps = (() => {

  const STORAGE_KEY = 'nd_gmaps_key';

  function getApiKey() {
    return localStorage.getItem(STORAGE_KEY) || '';
  }

  /**
   * Calculate driving distance between two addresses.
   * Uses the Google Distance Matrix API (via JSONP-style proxy for CORS).
   *
   * Since the Distance Matrix API doesn't support CORS from browsers,
   * we use the Directions API via the Maps JavaScript API.
   * We'll load the script dynamically and use the service.
   *
   * @param {string} origin – Origin address
   * @param {string} destination – Destination address
   * @returns {Promise<{distanceMiles: number, distanceText: string, durationText: string}>}
   */
  async function calculateDistance(origin, destination) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('Google Maps API key not configured. Go to Settings → Integrations.');
    if (!origin || !destination) throw new Error('Both origin and destination addresses are required.');

    // Load Google Maps JS SDK if not already loaded
    await _ensureMapsLoaded(apiKey);

    return new Promise((resolve, reject) => {
      const service = new google.maps.DistanceMatrixService();
      service.getDistanceMatrix({
        origins: [origin],
        destinations: [destination],
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.IMPERIAL,
      }, (response, status) => {
        if (status !== 'OK') {
          reject(new Error(`Distance Matrix API error: ${status}`));
          return;
        }
        const element = response?.rows?.[0]?.elements?.[0];
        if (!element || element.status !== 'OK') {
          reject(new Error(`Could not calculate route: ${element?.status || 'UNKNOWN'}`));
          return;
        }
        // distance.value is in meters, convert to miles
        const meters = element.distance.value;
        const miles = Math.round(meters * 0.000621371);
        resolve({
          distanceMiles: miles,
          distanceText: element.distance.text,
          durationText: element.duration.text,
        });
      });
    });
  }

  /**
   * Calculate total driving distance for an array of stops (in order).
   * Returns total miles for the full route.
   * @param {Array<string>} addresses – Array of addresses in order
   * @returns {Promise<{totalMiles: number, legs: Array}>}
   */
  async function calculateRouteDistance(addresses) {
    if (addresses.length < 2) throw new Error('Need at least 2 addresses to calculate distance.');

    const apiKey = getApiKey();
    if (!apiKey) throw new Error('Google Maps API key not configured. Go to Settings → Integrations.');

    await _ensureMapsLoaded(apiKey);

    return new Promise((resolve, reject) => {
      const service = new google.maps.DirectionsService();
      const origin = addresses[0];
      const destination = addresses[addresses.length - 1];
      const waypoints = addresses.slice(1, -1).map(addr => ({ location: addr, stopover: true }));

      service.route({
        origin,
        destination,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.IMPERIAL,
      }, (result, status) => {
        if (status !== 'OK') {
          reject(new Error(`Directions API error: ${status}`));
          return;
        }
        const legs = result.routes[0].legs.map(leg => ({
          from: leg.start_address,
          to: leg.end_address,
          distanceMiles: Math.round(leg.distance.value * 0.000621371),
          distanceText: leg.distance.text,
          durationText: leg.duration.text,
        }));
        const totalMiles = legs.reduce((sum, leg) => sum + leg.distanceMiles, 0);
        resolve({ totalMiles, legs });
      });
    });
  }

  /** Ensure Google Maps JS API is loaded */
  let _mapsPromise = null;
  function _ensureMapsLoaded(apiKey) {
    if (window.google?.maps?.DistanceMatrixService) return Promise.resolve();
    if (_mapsPromise) return _mapsPromise;

    _mapsPromise = new Promise((resolve, reject) => {
      // Create a callback name
      const cbName = '_gmapsInit' + Date.now();
      window[cbName] = () => {
        delete window[cbName];
        resolve();
      };
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=${cbName}&libraries=places`;
      script.async = true;
      script.onerror = () => {
        _mapsPromise = null;
        reject(new Error('Failed to load Google Maps SDK'));
      };
      document.head.appendChild(script);
    });
    return _mapsPromise;
  }

  return { getApiKey, calculateDistance, calculateRouteDistance };
})();
