# Nature Dispatch TMS

Transport Management System (TMS) — MVP

## Stack
- **Frontend:** HTML5, CSS3 (Bootstrap 5), Vanilla JavaScript
- **Backend:** Airtable REST API
- **Hosting:** GitHub Pages

## Quick Start

1. Open `js/config.js` and replace the placeholder values:
   - `AIRTABLE_API_KEY` → your Airtable Personal Access Token
   - `AIRTABLE_BASE_ID` → your Airtable Base ID
   - `COMPANIES_MAP` → the record IDs of your 3 companies

2. Open `index.html` in a browser (or deploy to GitHub Pages).

## Pages

| Page | File | Description |
|------|------|-------------|
| Dashboard | `index.html` | KPI cards + recent loads |
| Loads | `loads.html` | Full CRUD for loads + multi-stops |
| Drivers | `drivers.html` | Driver management |
| Trucks & Trailers | `trucks.html` | Equipment management |
| Brokers | `brokers.html` | Broker / Shipper directory |
| Settlements | `settlements.html` | Pay calculation (Revenue − 12% − Fuel − Tolls − Expenses) |
| Expenses | `expenses.html` | Fuel, Tolls, and other expenses |

## Company Filter
A global dropdown in the top bar filters data by company (**Nature Dispatch**, **YSA Transport**, or **NXT Freight**). The selection is persisted in `localStorage`.

## Deploying to GitHub Pages
```bash
git init
git remote add origin https://github.com/naturedispatch/<repo-name>.git
git add .
git commit -m "Initial MVP"
git push -u origin main
```
Then enable GitHub Pages on the `main` branch in repository Settings → Pages.
