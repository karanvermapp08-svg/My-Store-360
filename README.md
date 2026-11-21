# Business Manager 360 (100% Offline Desktop Suite)

**Manage. Grow. Succeed.**

**Business Manager 360** is a 100% offline desktop-style local web application for Indian retail/kirana and wholesale businesses — featuring GST & Non-GST billing, POS counter mode, multi-godown inventory, party ledgers, cash & bank reconciliation, expenses/income, financial reports, and role-based access control.

All required libraries (`react`, `lucide-react`, `jspdf`, `motion`, Tailwind CSS styles), icons (`/public/icons`), service worker caching (`/public/service-worker.js`), and persistence (`IndexedDB: BusinessManager360_DB`) are bundled locally with zero runtime internet or external CDN dependencies.

---

## Key Offline & Architecture Features

1. **100% Offline Ready (`BusinessManager360_DB` + Offline Service Worker)**:
   - Zero external Google Fonts, zero remote avatar images, zero cloud database dependencies.
   - Local system typography stacks for UI and monospace financial amounts.
   - Works seamlessly when Wi-Fi / internet is disconnected or behind air-gapped LANs.
   - Installable as a standalone Desktop PWA via Chrome/Edge (`manifest.json` + local PNG/SVG icons + offline Service Worker).

2. **Collapsible Maroon Sidebar (`#8B1E2D`)**:
   - **Expanded mode**: Shows category icons, full menu labels, live record counts / PRO badges, and expandable/collapsible menu groups (`CORE & POS`, `ORDERS & RETURNS`, `INVENTORY & STOCK`, `ACCOUNTING & FINANCE`, `PARTIES & CRM`, `REPORTS & ANALYTICS`, `SETTINGS & STAFF`).
   - **Collapsed mode**: Compact icon-only rail (`68px` width) with floating hover tooltips; the main dashboard automatically expands into the reclaimed width without overlap.
   - Top toggle button persists expanded/collapsed state and open/collapsed menu groups across refreshes and computer restarts (`localStorage` + IndexedDB `preferences`).

3. **IndexedDB Primary Local Database (`src/database/indexedDb.ts`)**:
   - Dedicated IndexedDB object stores for: `products`, `inventory`, `customers`, `suppliers`, `sales`, `purchases`, `invoices`, `expenses`, `income`, `ledgers`, `settings`, `preferences`, `users`, `roles`, `employees`, `attendance`, and `activityLogs`.
   - Automatic schema versioning (`DB_VERSION = 2`) with non-destructive `onupgradeneeded` migrations and automatic first-run migration from legacy `localStorage` data.
   - Respects cleared transaction state across reloads (never silently resets user data back to demo records).
   - **Full JSON Backup & Restore**: Exports and restores company profile, settings, transactions, parties, products, users, roles, employees, attendance, and UI preferences.
   - **One-Click CSV Exports**: UTF-8 BOM CSV exports for Excel / LibreOffice across Products, Customers, Suppliers, Sales & Invoices, Purchases, Expenses, Other Income, and Ledgers.

4. **Customer & Staff Portal + Admin RBAC (`src/components/portal/` & `/customer-staff-portal/`)**:
   - **Welcome Selection Screen**: Opens first when unauthenticated (`Customer Portal` vs `Staff Portal`).
   - **Customer Portal**: Separate login (`Email & Password`, transparent offline notices for `Google` & `Mobile OTP`, plus `Create Account` registration), strictly isolated Customer Dashboard (`My Orders`, `My Invoices`, `Pending Payments`, `My Addresses`, `Notifications`, `Contact Shop`, `Logout`).
   - **Staff Portal**: Separate login (`Staff ID or Email` + `Password`, **no public registration**), dedicated Staff Workspace (`Today's Tasks`, `Daily Work`, permission-gated `Billing`, `Customer Management`, `Inventory`, `Attendance` punch in/out, `Notifications`).
   - **Admin Control (`CUSTOMER & STAFF MANAGEMENT` in Admin Sidebar)**: Full ERP management for Owner/Admin (`OWNER-01` / `ADM-01`) including Customer Accounts, Staff Accounts, Add Staff (auto-generated Staff IDs like `ST002`), Staff Permissions, Customer Activity, Login History, and Account Status.
   - **Password Security**: All passwords are salted and hashed with PBKDF2-SHA256 / stretched SHA-256 (`src/utils/cryptoAuth.ts`) and never stored in plain text.
   - **Online / Multi-Device Notice**: Google Sign-In, live SMS OTP delivery, and multi-device remote customer/staff login require an active internet connection and a backend API server (not included in 100% offline local mode).

---

## Local Structure

- `index.html` — Local entry HTML linked to `/manifest.json` and `/icons/*`
- `customer-staff-portal/` — Dedicated standalone offline portal folder (`index.html`, `customer-login.html`, `customer-dashboard.html`, `staff-login.html`, `staff-dashboard.html`, `register.html`, `css/portal.css`, `js/portal-auth.js`, `assets/portal-brand.svg`) sharing `BusinessManager360_DB`
- `public/icons/` — Local vector (`icon.svg`) and raster PWA icons (`192x192`, `512x512`, `maskable`, `apple-touch-icon`)
- `public/manifest.json` — Offline Web App Manifest
- `public/service-worker.js` — Offline shell and bundled Vite asset cache
- `src/database/indexedDb.ts` — Primary IndexedDB database engine (`DB_VERSION = 3`), schema upgrader, and CSV exporter
- `src/utils/cryptoAuth.ts` — Salted PBKDF2-SHA256 & stretched SHA-256 password hashing/verification
- `src/components/portal/` — React Portal screens (`WelcomePortalScreen`, `CustomerLoginView`, `StaffLoginView`, `CustomerDashboard`, `StaffDashboard`, `CustomerStaffManagementView`)
- `src/context/VyaparContext.tsx` — Application state, IndexedDB hydration/sync, sidebar state persistence, RBAC, and accounting
- `src/components/Sidebar.tsx` — Collapsible sidebar + expandable groups + `CUSTOMER & STAFF MANAGEMENT` controls
- `src/components/SettingsHubView.tsx` — Business profile, invoice templates, GST settings, IndexedDB stats inspector, CSV exports, and full JSON backup/restore
- `local-server.cjs` — Zero-dependency local HTTP server serving `/dist` and `/customer-staff-portal/` on `http://127.0.0.1:3000`
- `Start-Business-Manager-360.bat` — One-click Windows offline desktop launcher
- `server.ts` — Express + Vite development server

---

## How to Run Locally & Offline

### Prerequisites
- Node.js v18+ installed once on the PC.

### Option A: One-Click Offline Launch (Windows)
1. Double-click **`Start-Business-Manager-360.bat`** in the project folder.
2. If `/dist` does not exist yet, the launcher builds it automatically; otherwise it starts `node local-server.cjs` immediately with **zero internet connection required** and opens `http://127.0.0.1:3000` in your browser.
3. Optional: In Chrome or Edge, click the **Install app** icon in the address bar to launch Business Manager 360 in its own standalone desktop window.

### Option B: Manual Terminal Commands
```bash
# 1. Install dependencies (first time only, while online)
npm install

# 2. Build the 100% self-contained production bundle into /dist
npm run build

# 3. Start the offline local server anytime (works with Wi-Fi / internet OFF)
npm run start:offline
```
Then open `http://127.0.0.1:3000` (or `http://127.0.0.1:3000/customer-staff-portal/` for the standalone HTML portal).

### Option C: Development Server
```bash
npm run dev
```

---

## Default Login Credentials

| Portal | Account / ID | Email | Password | Dashboard Opened |
|---|---|---|---|---|
| **Customer Portal** | `CUST001` (Rahul Sharma) | `rahul.customer@mystore.local` | `customer@123` | Separate Customer Dashboard |
| **Customer Portal** | `CUST002` (Ananya Iyer) | `ananya@mumbaitech.in` | `customer@123` | Separate Customer Dashboard |
| **Staff Portal** | `ST001` (Neha Verma) | `neha.staff@mystore.local` | `staff@password123` | Separate Staff Dashboard |
| **Staff Portal** | `EMP-1003` (Cashier) | `sunil.pos@krishnaenterprises.com` | `cashier@password123` | Separate Staff Dashboard |
| **Staff Portal** | `EMP-1006` (Delivery) | `deepak.delivery@krishnaenterprises.com` | `delivery@password123` | Separate Staff Dashboard |
| **Admin ERP** | `OWNER-01` (Owner) | `krishna.enterprises@gmail.com` | `owner@password123` | Full Business Manager 360 Admin ERP |
| **Admin ERP** | `ADM-01` (Admin) | `alok.admin@krishnaenterprises.com` | `admin@password123` | Full Business Manager 360 Admin ERP |

---

## Verified Automated Checks

- `npm run lint` (`tsc --noEmit`): Verified 0 TypeScript errors.
- `npm run build` (`vite build`): Verified self-contained production bundle in `/dist`.
- External asset scan on `dist/`: Zero external font CDN links (`fonts.googleapis.com` / `fonts.gstatic.com`), zero external image URLs (`images.unsplash.com`), and zero remote script CDNs in HTML/JS/CSS outputs.
- Local offline server smoke test (`node local-server.cjs --port 3100`): Verified HTTP `200` responses for `/`, `/manifest.json`, `/service-worker.js`, `/customer-staff-portal/`, `/customer-staff-portal/customer-login.html`, `/customer-staff-portal/staff-login.html`, and local icons.

