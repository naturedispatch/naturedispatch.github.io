/**
 * ============================================================
 * NATURE DISPATCH TMS — Airtable CRUD Helper
 * ============================================================
 * Generic, reusable functions to interact with the Airtable
 * REST API.  Every page-specific module calls these helpers.
 * ============================================================
 */

const Airtable = (() => {
  // ── Private helpers ───────────────────────────────────────
  const _headers = () => ({
    Authorization: `Bearer ${CONFIG.AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  });

  const _url = (table, recordId = '') => {
    const encoded = encodeURIComponent(table);
    return recordId
      ? `${CONFIG.API_URL}/${encoded}/${recordId}`
      : `${CONFIG.API_URL}/${encoded}`;
  };

  /**
   * Fetch ALL records (handles Airtable pagination automatically).
   * @param {string} table   – Table name from CONFIG.TABLES
   * @param {object} params  – Optional query params (filterByFormula, sort, fields…)
   * @returns {Promise<Array>} – Array of { id, fields } objects
   */
  async function getAll(table, params = {}) {
    let allRecords = [];
    let offset = null;

    do {
      const query = new URLSearchParams(params);
      if (offset) query.set('offset', offset);

      const res = await fetch(`${_url(table)}?${query.toString()}`, {
        headers: _headers(),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(`Airtable GET error: ${JSON.stringify(err)}`);
      }

      const data = await res.json();
      allRecords = allRecords.concat(data.records);
      offset = data.offset || null;
    } while (offset);

    return allRecords;
  }

  /**
   * Fetch a single record by ID.
   */
  async function getOne(table, recordId) {
    const res = await fetch(_url(table, recordId), { headers: _headers() });
    if (!res.ok) throw new Error(`Airtable GET error: ${res.status}`);
    return res.json();
  }

  /**
   * Create one record.
   * @param {string} table
   * @param {object} fields – key/value pairs matching Airtable field names
   */
  async function create(table, fields) {
    const res = await fetch(_url(table), {
      method: 'POST',
      headers: _headers(),
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Airtable CREATE error: ${JSON.stringify(err)}`);
    }
    return res.json();
  }

  /**
   * Update one record (PATCH = partial update).
   */
  async function update(table, recordId, fields) {
    const res = await fetch(_url(table, recordId), {
      method: 'PATCH',
      headers: _headers(),
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Airtable UPDATE error: ${JSON.stringify(err)}`);
    }
    return res.json();
  }

  /**
   * Delete one record.
   */
  async function remove(table, recordId) {
    const res = await fetch(_url(table, recordId), {
      method: 'DELETE',
      headers: _headers(),
    });
    if (!res.ok) throw new Error(`Airtable DELETE error: ${res.status}`);
    return res.json();
  }

  // ── Public API ────────────────────────────────────────────
  return { getAll, getOne, create, update, remove };
})();
