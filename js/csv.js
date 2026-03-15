/**
 * ============================================================
 * NATURE DISPATCH TMS — CSV Import / Export Utility
 * ============================================================
 * Provides CSV export (download) and CSV import (upload + create
 * records) for every Airtable table in the system.
 * Included on every page via app.js — exposes global CSV object.
 * ============================================================
 */

const CSV = (() => {

  // ── TABLE DEFINITIONS ─────────────────────────────────────
  // Each entry maps a table key to its Airtable table name
  // and the column headers we export (+ use for import mapping).
  const TABLE_DEFS = {
    Loads: {
      table: CONFIG.TABLES.LOADS,
      fields: ['Load Number','Status','Revenue','Miles','Notes','Invoice Status','ETA','Pickup Date','Delivery Date'],
    },
    Drivers: {
      table: CONFIG.TABLES.DRIVERS,
      fields: ['Full Name','Phone','Email','License Number','CDL Expiry','Availability','Status'],
    },
    Trucks: {
      table: CONFIG.TABLES.TRUCKS,
      fields: ['Truck Number','Type','Make','Model','Year','VIN','Status','License Plate'],
    },
    Brokers: {
      table: CONFIG.TABLES.BROKERS,
      fields: ['Broker Name','MC Number','Contact Name','Phone','Email','Address'],
    },
    Expenses: {
      table: CONFIG.TABLES.EXPENSES,
      fields: ['Description','Category','Amount','Date','Status'],
    },
    Settlements: {
      table: CONFIG.TABLES.SETTLEMENTS,
      fields: ['Settlement Number','Period Start','Period End','Total Revenue','Total Expenses','Net Pay','Status'],
    },
    Alerts: {
      table: CONFIG.TABLES.ALERTS,
      fields: ['Title','Type','Priority','Status','Description','Due Date'],
    },
    'Fuel Transactions': {
      table: CONFIG.TABLES.FUEL,
      fields: ['Date','Gallons','Price Per Gallon','Total','Location','State'],
    },
    'Toll Transactions': {
      table: CONFIG.TABLES.TOLLS,
      fields: ['Date','Amount','Plaza','State'],
    },
  };

  // ── EXPORT ────────────────────────────────────────────────

  /**
   * Export a table's records as a CSV file download.
   * @param {string} tableKey – key from TABLE_DEFS (e.g. 'Loads')
   * @param {Array} [records] – optional pre-fetched records; if omitted, fetches from Airtable
   */
  async function exportTable(tableKey, records) {
    const def = TABLE_DEFS[tableKey];
    if (!def) { App.showToast(`Unknown table: ${tableKey}`, 'danger'); return; }

    try {
      if (!records) {
        App.showToast('Fetching data…', 'info');
        records = await Airtable.getAll(def.table);
      }

      const headers = def.fields;
      const rows = records.map(rec => {
        return headers.map(h => {
          let val = rec.fields[h];
          // Handle arrays (linked records)
          if (Array.isArray(val)) val = val.join('; ');
          // Handle objects (attachments)
          if (val && typeof val === 'object') val = JSON.stringify(val);
          // CSV escape
          val = val == null ? '' : String(val);
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            val = '"' + val.replace(/"/g, '""') + '"';
          }
          return val;
        });
      });

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      _download(csvContent, `${tableKey}_${_dateStamp()}.csv`);
      App.showToast(`Exported ${records.length} ${tableKey} records`, 'success');
    } catch (err) {
      App.showToast('Export failed: ' + err.message, 'danger');
    }
  }

  /**
   * Export ALL tables into separate CSV downloads (zip-like batch).
   */
  async function exportAll() {
    for (const key of Object.keys(TABLE_DEFS)) {
      await exportTable(key);
    }
  }

  // ── IMPORT ────────────────────────────────────────────────

  /**
   * Opens a file picker, reads CSV, and creates records in Airtable.
   * @param {string} tableKey – key from TABLE_DEFS
   */
  function importTable(tableKey) {
    const def = TABLE_DEFS[tableKey];
    if (!def) { App.showToast(`Unknown table: ${tableKey}`, 'danger'); return; }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const rows = _parseCSV(text);
        if (rows.length < 2) { App.showToast('CSV file is empty or has no data rows', 'warning'); return; }

        const headers = rows[0];
        const dataRows = rows.slice(1).filter(r => r.some(cell => cell.trim()));

        // Confirm with user
        if (!confirm(`Import ${dataRows.length} records into "${tableKey}"?\n\nColumns: ${headers.join(', ')}`)) return;

        App.showToast(`Importing ${dataRows.length} records…`, 'info');

        // Airtable batch create (max 10 at a time)
        let created = 0;
        for (let i = 0; i < dataRows.length; i += 10) {
          const batch = dataRows.slice(i, i + 10);
          const records = batch.map(row => {
            const fields = {};
            headers.forEach((h, idx) => {
              const val = row[idx]?.trim();
              if (val) {
                // Try to detect numbers
                if (['Revenue','Amount','Miles','Total','Gallons','Price Per Gallon','Net Pay','Total Revenue','Total Expenses'].includes(h)) {
                  fields[h] = parseFloat(val) || 0;
                } else {
                  fields[h] = val;
                }
              }
            });
            return { fields };
          });

          // Batch create via API
          const res = await fetch(`${CONFIG.API_URL}/${encodeURIComponent(def.table)}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${CONFIG.AIRTABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ records }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(JSON.stringify(err));
          }
          created += batch.length;
        }

        App.showToast(`Successfully imported ${created} records into ${tableKey}!`, 'success');

        // Refresh current page after import
        _refreshCurrentPage(tableKey);

      } catch (err) {
        App.showToast('Import failed: ' + err.message, 'danger');
        console.error(err);
      }
    });
    input.click();
  }

  // ── RENDER EXPORT/IMPORT UI ───────────────────────────────

  /**
   * Returns HTML for export/import buttons for a given page.
   * @param {string} tableKey
   * @returns {string} HTML
   */
  function buttons(tableKey) {
    return `
      <div class="btn-group">
        <button class="btn btn-sm btn-outline-nd" onclick="CSV.exportTable('${tableKey}')" title="Export CSV">
          <i class="bi bi-download me-1"></i>Export CSV
        </button>
        <button class="btn btn-sm btn-outline-nd" onclick="CSV.importTable('${tableKey}')" title="Import CSV">
          <i class="bi bi-upload me-1"></i>Import CSV
        </button>
      </div>`;
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────

  /** Try to refresh the current page after a CSV import */
  function _refreshCurrentPage(tableKey) {
    const refreshMap = {
      'Loads':       'loadLoadsPage',
      'Drivers':     'loadDriversPage',
      'Trucks':      'loadTrucksPage',
      'Brokers':     'loadBrokersPage',
      'Expenses':    'loadExpensesPage',
      'Settlements': 'loadSettlementsPage',
      'Alerts':      'loadAlertsPage',
    };
    const fn = refreshMap[tableKey];
    if (fn && typeof window[fn] === 'function') window[fn]();
  }

  function _download(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function _dateStamp() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  }

  /**
   * Simple CSV parser that respects quoted fields.
   */
  function _parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          currentCell += '"';
          i++; // skip escaped quote
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          currentCell += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          currentRow.push(currentCell);
          currentCell = '';
        } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
          currentRow.push(currentCell);
          currentCell = '';
          rows.push(currentRow);
          currentRow = [];
          if (ch === '\r') i++; // skip \n
        } else {
          currentCell += ch;
        }
      }
    }
    // Last cell/row
    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell);
      rows.push(currentRow);
    }
    return rows;
  }

  return { exportTable, exportAll, importTable, buttons, TABLE_DEFS };
})();
