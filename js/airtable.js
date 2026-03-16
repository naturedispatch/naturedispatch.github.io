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

  /** Extract a human-friendly error message from Airtable's error response */
  async function _handleError(res, action) {
    try {
      const body = await res.json();
      const msg = body?.error?.message || body?.error?.type || JSON.stringify(body);
      throw new Error(`${action}: ${msg}`);
    } catch (e) {
      if (e.message.startsWith(action)) throw e;
      throw new Error(`${action}: HTTP ${res.status}`);
    }
  }

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

      if (!res.ok) await _handleError(res, 'Fetch failed');

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
    if (!res.ok) await _handleError(res, 'Fetch failed');
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
    if (!res.ok) await _handleError(res, 'Create failed');
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
    if (!res.ok) await _handleError(res, 'Update failed');
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
    if (!res.ok) await _handleError(res, 'Delete failed');
    return res.json();
  }

  /**
   * Upload a file attachment directly to a record field.
   * Uses the Airtable Content Upload API.
   * @param {string} tableName – Table name (kept for potential fallback)
   * @param {string} recordId  – Airtable record ID
   * @param {string} fieldName – Attachment field name (e.g. 'Rate Con PDF')
   * @param {File}   file      – File object from <input type="file">
   */
  async function uploadAttachment(tableName, recordId, fieldName, file) {
    // Content Upload API format: /v0/{baseId}/{recordId}/{fieldIdOrName}/uploadAttachment
    const url = `${CONFIG.CONTENT_URL}/${recordId}/${encodeURIComponent(fieldName)}/uploadAttachment`;
    const buffer = await file.arrayBuffer();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.AIRTABLE_API_KEY}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: buffer,
    });
    if (!res.ok) {
      // Log detailed error for debugging
      let detail = '';
      try { const b = await res.clone().json(); detail = JSON.stringify(b); } catch(e) {}
      console.error('Airtable Content Upload error:', res.status, detail);
      await _handleError(res, 'Upload failed');
    }
    return res.json();
  }

  // ── Public API ────────────────────────────────────────────
  return { getAll, getOne, create, update, remove, uploadAttachment };
})();
