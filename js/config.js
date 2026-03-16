/**
 * ============================================================
 * NATURE DISPATCH TMS — Configuration
 * ============================================================
 * Replace the placeholder values below with your real Airtable
 * credentials. NEVER commit real keys to a public repository.
 * ============================================================
 */

const CONFIG = {
  // ── Airtable credentials ──────────────────────────────────
  AIRTABLE_API_KEY: 'patAKpi0XDLhsX0jX.ec08d45b8912d537a2eb7fa4d58706265752bc5e909392a6dba0609f4ec3219d',
  AIRTABLE_BASE_ID: 'appULcWGhml7tkEEx',

  // ── Table names (must match your Airtable base exactly) ───
  TABLES: {
    COMPANIES:   'Companies',
    DRIVERS:     'Drivers',
    TRUCKS:      'Trucks',
    TRAILERS:    'Trucks',            // No separate Trailers table — uses Trucks
    BROKERS:     'Brokers/Shippers',
    LOADS:       'Loads',
    LOAD_STOPS:  'Load Stops',
    FUEL:        'Fuel Transactions',
    TOLLS:       'Toll Transactions',
    EXPENSES:    'Expenses',
    SETTLEMENTS: 'Settlements',
    ALERTS:      'Alerts',
    USERS:       'Users',
  },

  // ── Company IDs (Airtable record IDs) ─────────────────────
  // Used for the company filter across all pages
  COMPANIES_MAP: {
    'Nature Dispatch': 'recMyFTRqMPJLMy1H',
    'YSA Transport':   'rec5eZStgZueTDMlX',
    'NXT Freight':     'reczTwpkM6mTbcV0K',
  },

  // ── Settlement formula constants ──────────────────────────
  COMPANY_FEE_PERCENT: 12,  // 12% dispatch fee

  // ── Airtable API base URLs ────────────────────────────────
  get API_URL() {
    return `https://api.airtable.com/v0/${this.AIRTABLE_BASE_ID}`;
  },
};
