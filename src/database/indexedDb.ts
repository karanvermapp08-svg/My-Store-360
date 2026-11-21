import {
  Transaction,
  Party,
  Item,
  CompanyProfile,
  AppSettings,
  RoleDefinition,
  Employee,
  AttendanceRecord,
  UserActivityLog,
  AppUser,
  CustomerAccount,
  StaffTask,
  PortalNotification,
  CustomerActivityRecord,
  SupportMessageRecord,
  BillingCoupon,
  MSCreditTransaction,
  StockTransactionRecord,
  PaymentRecord,
  ReturnRefundRequest,
  StoreServiceAreaConfig,
  PurchaseScanRecord,
  HsnMasterEntry,
  GstClassificationAudit,
  EInvoiceRecord,
  EInvoiceApiLog,
  EWayBillRecord,
  BusinessSettingsBundle,
  PartyGroup,
  ServiceReminderRecord,
  SettingsAuditEntry,
} from '../types';

export const DB_NAME = 'BusinessManager360_DB';
export const DB_VERSION = 6;

export type DbStoreName =
  | 'products'
  | 'customers'
  | 'suppliers'
  | 'sales'
  | 'purchases'
  | 'invoices'
  | 'inventory'
  | 'expenses'
  | 'income'
  | 'ledgers'
  | 'settings'
  | 'preferences'
  | 'users'
  | 'roles'
  | 'employees'
  | 'attendance'
  | 'activityLogs'
  | 'customerAccounts'
  | 'staffTasks'
  | 'portalNotifications'
  | 'customerActivity'
  | 'supportMessages'
  | 'coupons'
  | 'msCreditTransactions'
  | 'stockHistory'
  | 'payments'
  | 'returnRequests'
  | 'purchaseScans'
  | 'hsnMaster'
  | 'gstAudits'
  | 'eInvoiceRecords'
  | 'eInvoiceLogs'
  | 'eWayBillRecords'
  | 'partyGroups'
  | 'serviceReminders'
  | 'settingsAuditLogs';

export interface InventoryRecord extends Item {
  stockValue: number;
  isLowStock: boolean;
  lastSyncedAt: string;
}

export interface LedgerEntryRecord {
  id: string;
  invoiceNo: string;
  date: string;
  partyName: string;
  accountType: 'Sales' | 'Purchase' | 'Expense' | 'Income' | 'Cash/Bank Receipt' | 'Return';
  debit: number;
  credit: number;
  balanceImpact: number;
  paymentType: string;
  createdAt: string;
}

export interface DatabaseStats {
  dbName: string;
  version: number;
  available: boolean;
  stores: Record<DbStoreName, number>;
  totalRecords: number;
  lastSyncedAt: string;
}

const ALL_STORES: { name: DbStoreName; keyPath: string }[] = [
  { name: 'products', keyPath: 'id' },
  { name: 'customers', keyPath: 'id' },
  { name: 'suppliers', keyPath: 'id' },
  { name: 'sales', keyPath: 'id' },
  { name: 'purchases', keyPath: 'id' },
  { name: 'invoices', keyPath: 'id' },
  { name: 'inventory', keyPath: 'id' },
  { name: 'expenses', keyPath: 'id' },
  { name: 'income', keyPath: 'id' },
  { name: 'ledgers', keyPath: 'id' },
  { name: 'settings', keyPath: 'key' },
  { name: 'preferences', keyPath: 'key' },
  { name: 'users', keyPath: 'id' },
  { name: 'roles', keyPath: 'id' },
  { name: 'employees', keyPath: 'id' },
  { name: 'attendance', keyPath: 'id' },
  { name: 'activityLogs', keyPath: 'id' },
  { name: 'customerAccounts', keyPath: 'id' },
  { name: 'staffTasks', keyPath: 'id' },
  { name: 'portalNotifications', keyPath: 'id' },
  { name: 'customerActivity', keyPath: 'id' },
  { name: 'supportMessages', keyPath: 'id' },
  { name: 'coupons', keyPath: 'id' },
  { name: 'msCreditTransactions', keyPath: 'id' },
  { name: 'stockHistory', keyPath: 'id' },
  { name: 'payments', keyPath: 'id' },
  { name: 'returnRequests', keyPath: 'id' },
  { name: 'purchaseScans', keyPath: 'id' },
  { name: 'hsnMaster', keyPath: 'code' },
  { name: 'gstAudits', keyPath: 'id' },
  { name: 'eInvoiceRecords', keyPath: 'id' },
  { name: 'eInvoiceLogs', keyPath: 'id' },
  { name: 'eWayBillRecords', keyPath: 'id' },
  { name: 'partyGroups', keyPath: 'id' },
  { name: 'serviceReminders', keyPath: 'id' },
  { name: 'settingsAuditLogs', keyPath: 'id' },
];

let dbPromise: Promise<IDBDatabase | null> | null = null;

export function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

export function initDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDBAvailable()) {
    return Promise.resolve(null);
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const oldVersion = event.oldVersion || 0;

        // v1 -> v6: Non-destructive schema upgrade adding 5-Module ERP + Complete Settings stores without touching existing data
        if (oldVersion < 6) {
          ALL_STORES.forEach(({ name, keyPath }) => {
            if (!db.objectStoreNames.contains(name)) {
              const store = db.createObjectStore(name, { keyPath });
              if (name === 'invoices' || name === 'sales' || name === 'purchases') {
                store.createIndex('by_type', 'type', { unique: false });
                store.createIndex('by_party', 'partyName', { unique: false });
              }
              if (name === 'products' || name === 'inventory') {
                store.createIndex('by_category', 'category', { unique: false });
              }
              if (name === 'customerAccounts') {
                store.createIndex('by_email', 'email', { unique: false });
                store.createIndex('by_phone', 'phone', { unique: false });
              }
            }
          });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        console.warn('IndexedDB open failed; falling back gracefully to localStorage:', request.error);
        resolve(null);
      };

      request.onblocked = () => {
        console.warn('IndexedDB upgrade blocked by another open tab');
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB initialization error:', err);
      resolve(null);
    }
  });

  return dbPromise;
}

export async function getAllFromStore<T>(storeName: DbStoreName): Promise<T[]> {
  const db = await initDatabase();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function replaceStoreRecords<T>(storeName: DbStoreName, records: T[]): Promise<void> {
  const db = await initDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      for (const item of records) {
        if (item !== undefined && item !== null) {
          store.put(item);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function putKV(
  storeName: 'settings' | 'preferences',
  key: string,
  value: unknown
): Promise<void> {
  const db = await initDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put({ key, value, updatedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getKV<T>(storeName: 'settings' | 'preferences', key: string): Promise<T | null> {
  const db = await initDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => {
        const res = req.result as { key: string; value: T } | undefined;
        resolve(res ? res.value : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function syncTransactionsToStores(transactions: Transaction[]): Promise<void> {
  const sales = transactions.filter((t) =>
    ['Sale', 'Estimate', 'Proforma', 'Sale Order', 'Delivery Challan', 'Sale Return', 'Payment-In'].includes(t.type)
  );
  const purchases = transactions.filter((t) => t.type === 'Purchase');
  const expenses = transactions.filter((t) => t.type === 'Expense');
  const income = transactions.filter((t) => t.type === 'Other Income');

  const ledgers: LedgerEntryRecord[] = transactions
    .filter((t) => !t.isCancelled)
    .map((t) => {
      const isCreditAccount = ['Sale', 'Other Income', 'Payment-In'].includes(t.type);
      return {
        id: `led-${t.id}`,
        invoiceNo: t.invoiceNo,
        date: t.date,
        partyName: t.partyName,
        accountType:
          t.type === 'Purchase'
            ? 'Purchase'
            : t.type === 'Expense'
            ? 'Expense'
            : t.type === 'Other Income'
            ? 'Income'
            : t.type === 'Payment-In'
            ? 'Cash/Bank Receipt'
            : t.type === 'Sale Return'
            ? 'Return'
            : 'Sales',
        debit: isCreditAccount ? 0 : t.totalAmount,
        credit: isCreditAccount ? t.totalAmount : 0,
        balanceImpact: t.balance,
        paymentType: t.paymentType,
        createdAt: t.createdAt,
      };
    });

  await Promise.all([
    replaceStoreRecords('invoices', transactions),
    replaceStoreRecords('sales', sales),
    replaceStoreRecords('purchases', purchases),
    replaceStoreRecords('expenses', expenses),
    replaceStoreRecords('income', income),
    replaceStoreRecords('ledgers', ledgers),
  ]);
}

export async function syncPartiesToStores(parties: Party[]): Promise<void> {
  const customers = parties.filter((p) => p.type === 'Customer' || !p.type);
  const suppliers = parties.filter((p) => p.type === 'Supplier');
  await Promise.all([
    replaceStoreRecords('customers', customers),
    replaceStoreRecords('suppliers', suppliers),
  ]);
}

export async function syncItemsToStores(items: Item[]): Promise<void> {
  const now = new Date().toISOString();
  const inventoryRecords: InventoryRecord[] = items.map((item) => ({
    ...item,
    stockValue: Math.round((item.stock || 0) * (item.purchasePrice || item.salePrice || 0) * 100) / 100,
    isLowStock: (item.stock || 0) <= (item.minStockAlert ?? 5),
    lastSyncedAt: now,
  }));

  await Promise.all([
    replaceStoreRecords('products', items),
    replaceStoreRecords('inventory', inventoryRecords),
  ]);
}

export interface HydratedDatabasePayload {
  initialized: boolean;
  transactions: Transaction[];
  parties: Party[];
  items: Item[];
  company: CompanyProfile | null;
  settings: AppSettings | null;
  users: AppUser[];
  roles: RoleDefinition[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  activityLogs: UserActivityLog[];
  customerAccounts: CustomerAccount[];
  staffTasks: StaffTask[];
  portalNotifications: PortalNotification[];
  customerActivity: CustomerActivityRecord[];
  supportMessages: SupportMessageRecord[];
  coupons: BillingCoupon[];
  msCreditTransactions: MSCreditTransaction[];
  stockHistory: StockTransactionRecord[];
  payments: PaymentRecord[];
  returnRequests: ReturnRefundRequest[];
  serviceAreaConfig: StoreServiceAreaConfig | null;
  sidebarCollapsed: boolean | null;
  expandedSidebarGroups: Record<string, boolean> | null;
  purchaseScans: PurchaseScanRecord[];
  hsnMaster: HsnMasterEntry[];
  gstAudits: GstClassificationAudit[];
  eInvoiceRecords: EInvoiceRecord[];
  eInvoiceLogs: EInvoiceApiLog[];
  eWayBillRecords: EWayBillRecord[];
  businessSettings: BusinessSettingsBundle | null;
  partyGroups: PartyGroup[];
  serviceReminders: ServiceReminderRecord[];
  settingsAuditLogs: SettingsAuditEntry[];
}

export async function loadAllFromIndexedDB(): Promise<HydratedDatabasePayload> {
  const db = await initDatabase();
  if (!db) {
    return {
      initialized: false,
      transactions: [],
      parties: [],
      items: [],
      company: null,
      settings: null,
      users: [],
      roles: [],
      employees: [],
      attendance: [],
      activityLogs: [],
      customerAccounts: [],
      staffTasks: [],
      portalNotifications: [],
      customerActivity: [],
      supportMessages: [],
      coupons: [],
      msCreditTransactions: [],
      stockHistory: [],
      payments: [],
      returnRequests: [],
      serviceAreaConfig: null,
      sidebarCollapsed: null,
      expandedSidebarGroups: null,
      purchaseScans: [],
      hsnMaster: [],
      gstAudits: [],
      eInvoiceRecords: [],
      eInvoiceLogs: [],
      eWayBillRecords: [],
      businessSettings: null,
      partyGroups: [],
      serviceReminders: [],
      settingsAuditLogs: [],
    };
  }

  const [
    initializedFlag,
    invoices,
    customers,
    suppliers,
    products,
    company,
    appSettings,
    users,
    roles,
    employees,
    attendance,
    activityLogs,
    customerAccounts,
    staffTasks,
    portalNotifications,
    customerActivity,
    supportMessages,
    coupons,
    msCreditTransactions,
    stockHistory,
    payments,
    returnRequests,
    serviceAreaConfig,
    sidebarCollapsed,
    expandedSidebarGroups,
    purchaseScans,
    hsnMaster,
    gstAudits,
    eInvoiceRecords,
    eInvoiceLogs,
    eWayBillRecords,
    businessSettings,
    partyGroups,
    serviceReminders,
    settingsAuditLogs,
  ] = await Promise.all([
    getKV<boolean>('preferences', 'db_initialized'),
    getAllFromStore<Transaction>('invoices'),
    getAllFromStore<Party>('customers'),
    getAllFromStore<Party>('suppliers'),
    getAllFromStore<Item>('products'),
    getKV<CompanyProfile>('settings', 'company_profile'),
    getKV<AppSettings>('settings', 'app_settings'),
    getAllFromStore<AppUser>('users'),
    getAllFromStore<RoleDefinition>('roles'),
    getAllFromStore<Employee>('employees'),
    getAllFromStore<AttendanceRecord>('attendance'),
    getAllFromStore<UserActivityLog>('activityLogs'),
    getAllFromStore<CustomerAccount>('customerAccounts'),
    getAllFromStore<StaffTask>('staffTasks'),
    getAllFromStore<PortalNotification>('portalNotifications'),
    getAllFromStore<CustomerActivityRecord>('customerActivity'),
    getAllFromStore<SupportMessageRecord>('supportMessages'),
    getAllFromStore<BillingCoupon>('coupons'),
    getAllFromStore<MSCreditTransaction>('msCreditTransactions'),
    getAllFromStore<StockTransactionRecord>('stockHistory'),
    getAllFromStore<PaymentRecord>('payments'),
    getAllFromStore<ReturnRefundRequest>('returnRequests'),
    getKV<StoreServiceAreaConfig>('settings', 'store_service_area'),
    getKV<boolean>('preferences', 'sidebar_collapsed'),
    getKV<Record<string, boolean>>('preferences', 'sidebar_expanded_groups'),
    getAllFromStore<PurchaseScanRecord>('purchaseScans'),
    getAllFromStore<HsnMasterEntry>('hsnMaster'),
    getAllFromStore<GstClassificationAudit>('gstAudits'),
    getAllFromStore<EInvoiceRecord>('eInvoiceRecords'),
    getAllFromStore<EInvoiceApiLog>('eInvoiceLogs'),
    getAllFromStore<EWayBillRecord>('eWayBillRecords'),
    getKV<BusinessSettingsBundle>('settings', 'business_settings_bundle'),
    getAllFromStore<PartyGroup>('partyGroups'),
    getAllFromStore<ServiceReminderRecord>('serviceReminders'),
    getAllFromStore<SettingsAuditEntry>('settingsAuditLogs'),
  ]);

  const partiesMap = new Map<string, Party>();
  [...customers, ...suppliers].forEach((p) => {
    if (p && p.id) partiesMap.set(p.id, p);
  });

  const sortedInvoices = [...invoices].sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );

  return {
    initialized: Boolean(initializedFlag || invoices.length > 0 || products.length > 0 || company),
    transactions: sortedInvoices,
    parties: Array.from(partiesMap.values()),
    items: products,
    company,
    settings: appSettings,
    users,
    roles,
    employees,
    attendance,
    activityLogs,
    customerAccounts,
    staffTasks,
    portalNotifications,
    customerActivity,
    supportMessages,
    coupons,
    msCreditTransactions,
    stockHistory,
    payments,
    returnRequests,
    serviceAreaConfig,
    sidebarCollapsed,
    expandedSidebarGroups,
    purchaseScans,
    hsnMaster,
    gstAudits,
    eInvoiceRecords,
    eInvoiceLogs,
    eWayBillRecords,
    businessSettings,
    partyGroups,
    serviceReminders,
    settingsAuditLogs,
  };
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  const db = await initDatabase();
  const stores = {} as Record<DbStoreName, number>;
  let totalRecords = 0;

  for (const { name } of ALL_STORES) {
    stores[name] = 0;
  }

  if (db) {
    await Promise.all(
      ALL_STORES.map(
        ({ name }) =>
          new Promise<void>((resolve) => {
            try {
              const tx = db.transaction(name, 'readonly');
              const store = tx.objectStore(name);
              const req = store.count();
              req.onsuccess = () => {
                const count = req.result || 0;
                stores[name] = count;
                totalRecords += count;
                resolve();
              };
              req.onerror = () => resolve();
            } catch {
              resolve();
            }
          })
      )
    );
  }

  return {
    dbName: DB_NAME,
    version: DB_VERSION,
    available: Boolean(db),
    stores,
    totalRecords,
    lastSyncedAt: new Date().toISOString(),
  };
}

export function exportCsvFile(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
): void {
  const escapeCell = (val: string | number | boolean | null | undefined): string => {
    const str = val === null || val === undefined ? '' : String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];

  // UTF-8 BOM ensures Excel opens INR symbol (₹) and Devanagari/Unicode properly offline
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
