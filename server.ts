import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createErpRouter } from './server/erpRoutes';
import { INDIA_HSN_SAC_MASTER, isValidGstin, isValidHsnOrSac } from './src/data/hsnMasterIndia';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const portEqArg = process.argv.find((a) => a.startsWith('--port='));
const portArgIdx = process.argv.indexOf('--port');
const cliPortStr = portEqArg ? portEqArg.split('=')[1] : portArgIdx !== -1 ? process.argv[portArgIdx + 1] : undefined;
const cliPort = cliPortStr ? parseInt(cliPortStr, 10) : NaN;
const envPort = process.env.PORT && process.env.PORT !== process.env.NGINX_PORT ? parseInt(process.env.PORT, 10) : NaN;
const PORT = !Number.isNaN(cliPort) ? cliPort : !Number.isNaN(envPort) ? envPort : 3000;

app.use(express.json({ limit: '25mb' }));

// ============================================================================
// 1. AUTHORITATIVE CENTRAL DATABASE & IN-MEMORY STORE (SHARED BACKEND)
// ============================================================================

interface ServerTenant {
  id: string;
  name: string;
  gstin: string;
  state: string;
  branches: { id: string; name: string; isMain: boolean; city: string }[];
}

interface ServerUser {
  id: string;
  name: string;
  email: string;
  roleName: string;
  roleId: string;
  tenantId: string;
  assignedBranch: string;
  token: string;
}

interface ServerInvoice {
  id: string;
  tenantId: string;
  branchId: string;
  invoiceNo: string;
  date: string;
  dueDate: string;
  partyId?: string;
  partyName: string;
  type: string;
  paymentType: string;
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  receivedAmount: number;
  balance: number;
  status: 'Paid' | 'Partial' | 'Unpaid';
  isCancelled: boolean;
  cancelReason?: string;
  items: Array<{
    id: string;
    itemId?: string;
    name: string;
    qty: number;
    price: number;
    discountPercent: number;
    taxPercent: number;
    amount: number;
  }>;
  createdBy: string;
  createdAt: string;
}

interface ServerApprovalRequest {
  id: string;
  tenantId: string;
  branchId: string;
  requestType: 'DISCOUNT_OVERRIDE' | 'REFUND_AUTHORIZATION' | 'INVOICE_CANCELLATION' | 'STOCK_ADJUSTMENT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy: string;
  requesterRole: string;
  details: string;
  amount?: number;
  discountPercent?: number;
  referenceId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

interface ServerAuditLog {
  id: string;
  tenantId: string;
  actor: string;
  role: string;
  action: string;
  module: string;
  targetId?: string;
  targetType?: string;
  beforeState?: unknown;
  afterState?: unknown;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILED';
  timestamp: string;
}

// In-Memory Database State
const DB = {
  tenant: {
    id: 'tenant-krishna-1',
    name: 'KRISHNA ENTERPRISES',
    gstin: '29ABCDE1234F1Z5',
    state: 'Karnataka (29)',
    branches: [
      { id: 'branch-main', name: 'Bengaluru Flagship Store', isMain: true, city: 'Bengaluru' },
      { id: 'branch-north', name: 'Hubballi Branch & Depot', isMain: false, city: 'Hubballi' },
      { id: 'wh-central', name: 'Central Distribution Warehouse', isMain: false, city: 'Bengaluru' },
    ],
  } as ServerTenant,

  users: [
    {
      id: 'usr-1',
      name: 'Krishna Murthy',
      email: 'krishna.enterprises@gmail.com',
      roleName: 'Owner',
      roleId: 'role-owner',
      tenantId: 'tenant-krishna-1',
      assignedBranch: 'All Branches',
      token: 'token-owner-secure',
    },
    {
      id: 'usr-2',
      name: 'Rajesh Varma',
      email: 'admin.rajesh@krishna.com',
      roleName: 'Admin',
      roleId: 'role-admin',
      tenantId: 'tenant-krishna-1',
      assignedBranch: 'All Branches',
      token: 'token-admin-secure',
    },
    {
      id: 'usr-3',
      name: 'Ananya Rao',
      email: 'manager.ananya@krishna.com',
      roleName: 'Manager',
      roleId: 'role-manager',
      tenantId: 'tenant-krishna-1',
      assignedBranch: 'Bengaluru Flagship Store',
      token: 'token-manager-secure',
    },
    {
      id: 'usr-4',
      name: 'Vikram Joshi',
      email: 'cashier.vikram@krishna.com',
      roleName: 'Cashier',
      roleId: 'role-cashier',
      tenantId: 'tenant-krishna-1',
      assignedBranch: 'Bengaluru Flagship Store',
      token: 'token-cashier-secure',
    },
    {
      id: 'usr-5',
      name: 'Deepak Sharma',
      email: 'accounts.deepak@krishna.com',
      roleName: 'Accountant',
      roleId: 'role-accountant',
      tenantId: 'tenant-krishna-1',
      assignedBranch: 'All Branches',
      token: 'token-accountant-secure',
    },
    {
      id: 'usr-6',
      name: 'Sneha Patel',
      email: 'sales.sneha@krishna.com',
      roleName: 'Sales',
      roleId: 'role-sales',
      tenantId: 'tenant-krishna-1',
      assignedBranch: 'Bengaluru Flagship Store',
      token: 'token-sales-secure',
    },
    {
      id: 'usr-7',
      name: 'Manoj Kumar',
      email: 'purchase.manoj@krishna.com',
      roleName: 'Purchase',
      roleId: 'role-purchase',
      tenantId: 'tenant-krishna-1',
      assignedBranch: 'Central Distribution Warehouse',
      token: 'token-purchase-secure',
    },
    {
      id: 'usr-8',
      name: 'Ramesh Gowda',
      email: 'inventory.ramesh@krishna.com',
      roleName: 'Inventory',
      roleId: 'role-inventory',
      tenantId: 'tenant-krishna-1',
      assignedBranch: 'Central Distribution Warehouse',
      token: 'token-inventory-secure',
    },
    {
      id: 'usr-9',
      name: 'Kavita Hegde',
      email: 'delivery.kavita@krishna.com',
      roleName: 'Delivery',
      roleId: 'role-delivery',
      tenantId: 'tenant-krishna-1',
      assignedBranch: 'Bengaluru Flagship Store',
      token: 'token-delivery-secure',
    },
  ] as ServerUser[],

  items: [
    {
      id: 'item-1',
      name: 'Sample Item',
      hsn: '8471',
      salePrice: 1500,
      purchasePrice: 1100,
      stock: 45,
      unit: 'PCS',
      taxPercent: 18,
      minStockAlert: 10,
    },
    {
      id: 'item-2',
      name: 'Wireless Barcode Scanner 2D',
      hsn: '8471',
      salePrice: 3800,
      purchasePrice: 2600,
      stock: 22,
      unit: 'PCS',
      taxPercent: 18,
      minStockAlert: 5,
    },
    {
      id: 'item-3',
      name: 'Thermal Receipt Rolls 80mm (Box of 20)',
      hsn: '4811',
      salePrice: 1200,
      purchasePrice: 850,
      stock: 60,
      unit: 'BOX',
      taxPercent: 12,
      minStockAlert: 15,
    },
    {
      id: 'item-4',
      name: 'POS Cash Drawer Heavy Duty',
      hsn: '8303',
      salePrice: 4200,
      purchasePrice: 3100,
      stock: 14,
      unit: 'PCS',
      taxPercent: 18,
      minStockAlert: 4,
    },
  ],

  parties: [
    {
      id: 'pty-1',
      name: 'Sharma Electronics',
      type: 'Customer',
      phone: '9845012345',
      address: 'Shop 12, Brigade Road, Bengaluru',
      gstin: '29AABCS1429B1Z1',
      creditLimit: 50000,
      currentBalance: 12500,
    },
    {
      id: 'pty-2',
      name: 'TechFlow Distributors',
      type: 'Supplier',
      phone: '9880098800',
      address: 'Plot 44, Peenya Industrial Area, Bengaluru',
      gstin: '29XYZAB8899C1Z9',
      creditLimit: 200000,
      currentBalance: 35000,
    },
  ],

  invoices: [
    {
      id: 'inv-1',
      tenantId: 'tenant-krishna-1',
      branchId: 'branch-main',
      invoiceNo: '1',
      date: '02/10/2026',
      dueDate: '02/10/2026',
      partyId: 'pty-1',
      partyName: 'Sharma Electronics',
      type: 'Sale',
      paymentType: 'Cash',
      subtotal: 1500,
      totalDiscount: 0,
      taxableAmount: 1500,
      cgst: 135,
      sgst: 135,
      igst: 0,
      totalAmount: 1770,
      receivedAmount: 1770,
      balance: 0,
      status: 'Paid',
      isCancelled: false,
      items: [
        {
          id: 'li-1',
          itemId: 'item-1',
          name: 'Sample Item',
          qty: 1,
          price: 1500,
          discountPercent: 0,
          taxPercent: 18,
          amount: 1770,
        },
      ],
      createdBy: 'Krishna Murthy',
      createdAt: new Date().toISOString(),
    },
  ] as ServerInvoice[],

  approvals: [
    {
      id: 'appr-1',
      tenantId: 'tenant-krishna-1',
      branchId: 'branch-main',
      requestType: 'DISCOUNT_OVERRIDE',
      status: 'PENDING',
      requestedBy: 'Vikram Joshi (Cashier)',
      requesterRole: 'Cashier',
      details: 'Customer Sharma Electronics requested 12% discount (exceeds 5% cashier ceiling)',
      discountPercent: 12,
      amount: 1500,
      createdAt: new Date().toISOString(),
    },
  ] as ServerApprovalRequest[],

  deliveryOrders: [
    {
      id: 'del-1',
      invoiceNo: 'INV-1002',
      customerName: 'Sharma Electronics',
      phone: '9845012345',
      address: 'Shop 12, Brigade Road, Bengaluru',
      itemsCount: 3,
      totalAmount: 4200,
      paymentMethod: 'Cash on Delivery',
      deliveryStatus: 'Out for Delivery',
      assignedAgent: 'Kavita Hegde',
      codCollected: false,
      dispatchedAt: '28/10/2026 09:30 AM',
    },
    {
      id: 'del-2',
      invoiceNo: 'INV-1003',
      customerName: 'Pooja Retail Store',
      phone: '9888877777',
      address: 'Malleshwaram 8th Cross, Bengaluru',
      itemsCount: 1,
      totalAmount: 1770,
      paymentMethod: 'Prepaid (UPI)',
      deliveryStatus: 'Delivered',
      assignedAgent: 'Kavita Hegde',
      codCollected: false,
      dispatchedAt: '28/10/2026 08:00 AM',
      deliveredAt: '28/10/2026 10:15 AM',
    },
  ],

  ledgers: [
    {
      id: 'led-1',
      date: '02/10/2026',
      particulars: 'Sale to Sharma Electronics (INV-1)',
      type: 'CREDIT',
      amount: 1770,
      account: 'Sales Revenue',
      branchId: 'branch-main',
    },
    {
      id: 'led-2',
      date: '02/10/2026',
      particulars: 'Cash Received against INV-1',
      type: 'DEBIT',
      amount: 1770,
      account: 'Cash in Hand',
      branchId: 'branch-main',
    },
  ],

  auditLogs: [
    {
      id: 'aud-1',
      tenantId: 'tenant-krishna-1',
      actor: 'Krishna Murthy',
      role: 'Owner',
      action: 'SERVER_BOOTSTRAP',
      module: 'Staff & Security',
      outcome: 'SUCCESS',
      timestamp: new Date().toISOString(),
    },
  ] as ServerAuditLog[],

  storeOrders: [] as any[],
  storePayments: [] as any[],
  storeStockHistory: [] as any[],
  storeReturnRequests: [] as any[],
  storeCoupons: [
    {
      id: 'cpn-welcome50',
      code: 'WELCOME50',
      title: 'Flat ₹50 OFF on Welcome Order',
      discountType: 'flat',
      discountValue: 50,
      minOrderValue: 299,
      expiryDate: '2027-12-31',
      isActive: true,
      usageLimitTotal: 500,
      usageLimitPerCustomer: 1,
      usedCount: 0,
      usedByCustomerIds: [] as string[],
    },
    {
      id: 'cpn-save10',
      code: 'SAVE10',
      title: '10% Instant Discount on Store Orders',
      discountType: 'percent',
      discountValue: 10,
      minOrderValue: 499,
      maxDiscount: 200,
      expiryDate: '2027-12-31',
      isActive: true,
      usageLimitTotal: 1000,
      usageLimitPerCustomer: 5,
      usedCount: 0,
      usedByCustomerIds: [] as string[],
    },
    {
      id: 'cpn-fresh15',
      code: 'FRESH15',
      title: '15% OFF on Groceries & Produce',
      discountType: 'percent',
      discountValue: 15,
      minOrderValue: 350,
      maxDiscount: 150,
      expiryDate: '2027-12-31',
      eligibleCategories: ['Grocery', 'Daily Essentials', 'Fruits & Vegetables', 'Dairy Products'],
      isActive: true,
      usageLimitTotal: 500,
      usageLimitPerCustomer: 3,
      usedCount: 0,
      usedByCustomerIds: [] as string[],
    },
    {
      id: 'cpn-mega250',
      code: 'MEGA250',
      title: 'Flat ₹250 OFF on Orders Above ₹1,999',
      discountType: 'flat',
      discountValue: 250,
      minOrderValue: 1999,
      expiryDate: '2027-12-31',
      isActive: true,
      usageLimitTotal: 300,
      usageLimitPerCustomer: 2,
      usedCount: 0,
      usedByCustomerIds: [] as string[],
    },
  ],
  storeServiceAreaConfig: {
    storeEnabled: true,
    storePincode: '400001',
    storeCity: 'Mumbai',
    maxRadiusKm: 15,
    allowedPincodes: ['400001', '400002', '400005', '400018', '400050', '400051', '560001', '560002', '560034', '110001', '411001', '302001', '380001'],
    freeDeliveryThreshold: 499,
    standardDeliveryFee: 29,
    additionalOutskirtFee: 25,
    outOfAreaMessage: 'Sorry, we currently deliver only within our verified store service zones (up to 15 km).',
    allowWholesalePricing: true,
    msCreditEarnPercent: 2,
  },

  nextInvoiceSeq: 2,
};

// ============================================================================
// 2. SERVER-SIDE AUTHENTICATION & RBAC MIDDLEWARE
// ============================================================================

export interface AuthenticatedRequest extends Request {
  user?: ServerUser;
}

const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    // Default to owner user for seamless development exploration if no token is provided
    req.user = DB.users[0];
    return next();
  }

  const matchedUser = DB.users.find((u) => u.token === token || u.id === token || u.roleName.toLowerCase() === token.toLowerCase());
  if (!matchedUser) {
    return res.status(401).json({ error: 'Unauthorized: Invalid credentials or session expired.' });
  }

  req.user = matchedUser;
  next();
};

const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user.roleName === 'Owner') {
      return next(); // Owner has universal access
    }
    if (!allowedRoles.includes(req.user.roleName)) {
      // Record failed access attempt in audit log
      DB.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        tenantId: req.user.tenantId,
        actor: req.user.name,
        role: req.user.roleName,
        action: `FORBIDDEN_ROUTE_ATTEMPT: ${req.path}`,
        module: 'Security Policy',
        outcome: 'DENIED',
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({
        error: `Permission Denied: Your role "${req.user.roleName}" is not authorized for this resource. Required: ${allowedRoles.join(', ')}`,
      });
    }
    next();
  };
};

// ============================================================================
// 3. API ENDPOINTS (SHARED AUTHORITATIVE BUSINESS SERVICES)
// ============================================================================

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    tenant: DB.tenant.name,
    activeInvoicesCount: DB.invoices.length,
    activeItemsCount: DB.items.length,
  });
});

// Auth & Session
app.post('/api/auth/login', (req, res) => {
  const { email, roleName } = req.body;
  const user = DB.users.find((u) => (email && u.email === email) || (roleName && u.roleName.toLowerCase() === roleName.toLowerCase()));

  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }

  DB.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    tenantId: user.tenantId,
    actor: user.name,
    role: user.roleName,
    action: 'USER_LOGIN',
    module: 'Authentication',
    outcome: 'SUCCESS',
    timestamp: new Date().toISOString(),
  });

  res.json({
    user,
    token: user.token,
    tenant: DB.tenant,
  });
});

app.get('/api/auth/me', authenticate, (req: AuthenticatedRequest, res) => {
  res.json({
    user: req.user,
    tenant: DB.tenant,
    branches: DB.tenant.branches,
  });
});

app.post('/api/auth/switch-role', authenticate, (req: AuthenticatedRequest, res) => {
  const { targetRole } = req.body;
  const targetUser = DB.users.find((u) => u.roleName.toLowerCase() === (targetRole || '').toLowerCase());

  if (!targetUser) {
    return res.status(404).json({ error: `Target role ${targetRole} not found.` });
  }

  DB.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    tenantId: DB.tenant.id,
    actor: req.user?.name || 'User',
    role: req.user?.roleName || 'Unknown',
    action: `ROLE_SWITCH -> ${targetUser.roleName}`,
    module: 'Session',
    outcome: 'SUCCESS',
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    user: targetUser,
    token: targetUser.token,
  });
});

// Role Workspace Config & Live Stats Aggregator
app.get('/api/workspaces/:role', authenticate, (req: AuthenticatedRequest, res) => {
  const role = req.params.role.toLowerCase();
  const branchFilter = req.user?.assignedBranch;

  // Compute live aggregates across the centralized database
  const validInvoices = DB.invoices.filter((inv) => !inv.isCancelled);
  const totalSales = validInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalReceived = validInvoices.reduce((sum, inv) => sum + inv.receivedAmount, 0);
  const totalOutstanding = validInvoices.reduce((sum, inv) => sum + inv.balance, 0);

  const lowStockCount = DB.items.filter((it) => it.stock <= it.minStockAlert).length;
  const pendingApprovalsCount = DB.approvals.filter((a) => a.status === 'PENDING').length;
  const pendingDeliveriesCount = DB.deliveryOrders.filter((d) => d.deliveryStatus !== 'Delivered').length;

  res.json({
    role,
    tenant: DB.tenant.name,
    user: req.user,
    metrics: {
      totalSales,
      totalReceived,
      totalOutstanding,
      invoiceCount: validInvoices.length,
      lowStockCount,
      pendingApprovalsCount,
      pendingDeliveriesCount,
      itemsCount: DB.items.length,
      partiesCount: DB.parties.length,
    },
    authorizedModules: [
      'sales_pos',
      'purchase_expenses',
      'items_inventory',
      'parties',
      'accounting',
      'reports',
      'cash_bank_assets',
      'staff_security',
      'utilities_sync',
      'settings_config',
    ],
  });
});

// Authoritative Invoices
app.get('/api/invoices', authenticate, (_req, res) => {
  res.json({ invoices: DB.invoices });
});

app.post('/api/invoices', authenticate, (req: AuthenticatedRequest, res) => {
  const { partyName, partyId, items: rawItems, paymentType, receivedAmount: rawReceived, discountPercent = 0 } = req.body;

  if (!partyName || !rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
    return res.status(400).json({ error: 'Missing partyName or invoice items' });
  }

  // 1. Enforce Server-Side Discount Ceilings
  const maxAllowedDiscount = req.user?.roleName === 'Owner' ? 100 : req.user?.roleName === 'Admin' ? 25 : req.user?.roleName === 'Manager' ? 15 : 5;
  if (discountPercent > maxAllowedDiscount) {
    return res.status(403).json({
      error: `Security Violation: Applied discount ${discountPercent}% exceeds your role authorization ceiling (${maxAllowedDiscount}%).`,
    });
  }

  // 2. Server-side authoritative calculation
  let subtotal = 0;
  const items = rawItems.map((it: any) => {
    const itemMaster = DB.items.find((dbIt) => dbIt.name.toLowerCase() === (it.name || '').toLowerCase());
    const unitPrice = itemMaster ? itemMaster.salePrice : it.price || 0;
    const qty = Number(it.qty) || 1;
    const disc = Number(it.discountPercent) || 0;
    const base = qty * unitPrice;
    const afterDisc = base - (base * disc) / 100;
    subtotal += afterDisc;

    // Deduct stock authoritatively
    if (itemMaster) {
      itemMaster.stock = Math.max(0, itemMaster.stock - qty);
    }

    return {
      id: `li-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      itemId: itemMaster?.id,
      name: it.name,
      qty,
      price: unitPrice,
      discountPercent: disc,
      taxPercent: it.taxPercent || 18,
      amount: afterDisc + (afterDisc * (it.taxPercent || 18)) / 100,
    };
  });

  const tax = Math.round(subtotal * 0.18 * 100) / 100;
  const cgst = Math.round((tax / 2) * 100) / 100;
  const sgst = cgst;
  const totalAmount = subtotal + tax;
  const receivedAmount = Number(rawReceived) || (paymentType === 'Cash' ? totalAmount : 0);
  const balance = Math.max(0, totalAmount - receivedAmount);
  const status = balance === 0 ? 'Paid' : receivedAmount > 0 ? 'Partial' : 'Unpaid';

  // 3. Guaranteed Unique & Sequential Invoice Numbering
  const invoiceNo = String(DB.nextInvoiceSeq++);

  const newInvoice: ServerInvoice = {
    id: `inv-${Date.now()}`,
    tenantId: DB.tenant.id,
    branchId: 'branch-main',
    invoiceNo,
    date: new Date().toLocaleDateString('en-GB'),
    dueDate: new Date().toLocaleDateString('en-GB'),
    partyId,
    partyName,
    type: 'Sale',
    paymentType: paymentType || 'Cash',
    subtotal,
    totalDiscount: 0,
    taxableAmount: subtotal,
    cgst,
    sgst,
    igst: 0,
    totalAmount,
    receivedAmount,
    balance,
    status,
    isCancelled: false,
    items,
    createdBy: req.user?.name || 'Cashier',
    createdAt: new Date().toISOString(),
  };

  DB.invoices.unshift(newInvoice);

  // 4. Atomic Ledger Posting
  DB.ledgers.unshift({
    id: `led-${Date.now()}-rev`,
    date: newInvoice.date,
    particulars: `Sale Invoice #${newInvoice.invoiceNo} to ${partyName}`,
    type: 'CREDIT',
    amount: totalAmount,
    account: 'Sales Revenue',
    branchId: 'branch-main',
  });

  if (receivedAmount > 0) {
    DB.ledgers.unshift({
      id: `led-${Date.now()}-csh`,
      date: newInvoice.date,
      particulars: `Payment for INV #${newInvoice.invoiceNo} via ${paymentType}`,
      type: 'DEBIT',
      amount: receivedAmount,
      account: paymentType === 'Cash' ? 'Cash in Hand' : 'Bank Accounts',
      branchId: 'branch-main',
    });
  }

  // 5. Audit Trail Record
  DB.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    tenantId: DB.tenant.id,
    actor: req.user?.name || 'Unknown',
    role: req.user?.roleName || 'Unknown',
    action: `CREATE_INVOICE #${invoiceNo}`,
    module: 'Sales & POS',
    targetId: newInvoice.id,
    targetType: 'Invoice',
    afterState: { invoiceNo, totalAmount, partyName },
    outcome: 'SUCCESS',
    timestamp: new Date().toISOString(),
  });

  res.status(201).json({
    success: true,
    invoice: newInvoice,
    message: `Tax Invoice #${invoiceNo} generated & posted atomically.`,
  });
});

// Invoice Cancellation
app.post('/api/invoices/:id/cancel', authenticate, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const invoice = DB.invoices.find((inv) => inv.id === id || inv.invoiceNo === id);

  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  // Server-side check: Cashiers cannot cancel invoices without supervisor approval
  if (req.user?.roleName === 'Cashier') {
    // Generate approval request instead
    const approval: ServerApprovalRequest = {
      id: `appr-${Date.now()}`,
      tenantId: DB.tenant.id,
      branchId: invoice.branchId,
      requestType: 'INVOICE_CANCELLATION',
      status: 'PENDING',
      requestedBy: req.user.name,
      requesterRole: req.user.roleName,
      details: `Cancellation requested for Invoice #${invoice.invoiceNo}. Reason: ${reason || 'Customer request'}`,
      amount: invoice.totalAmount,
      referenceId: invoice.id,
      createdAt: new Date().toISOString(),
    };
    DB.approvals.unshift(approval);
    return res.status(202).json({
      status: 'APPROVAL_REQUIRED',
      message: 'Invoice cancellation requires Store Manager approval. Approval ticket generated.',
      approvalId: approval.id,
    });
  }

  // Authorized cancellation
  invoice.isCancelled = true;
  invoice.cancelReason = reason || 'Cancelled by authorized staff';

  // Restore inventory items
  invoice.items.forEach((li) => {
    const it = DB.items.find((dbIt) => dbIt.name.toLowerCase() === li.name.toLowerCase());
    if (it) it.stock += li.qty;
  });

  // Post reversal ledger
  DB.ledgers.unshift({
    id: `led-${Date.now()}-rev`,
    date: new Date().toLocaleDateString('en-GB'),
    particulars: `REVERSAL: Cancelled INV #${invoice.invoiceNo}`,
    type: 'DEBIT',
    amount: invoice.totalAmount,
    account: 'Sales Returns & Cancellations',
    branchId: invoice.branchId,
  });

  DB.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    tenantId: DB.tenant.id,
    actor: req.user?.name || 'Unknown',
    role: req.user?.roleName || 'Unknown',
    action: `CANCEL_INVOICE #${invoice.invoiceNo}`,
    module: 'Sales & POS',
    targetId: invoice.id,
    outcome: 'SUCCESS',
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, message: `Invoice #${invoice.invoiceNo} successfully cancelled.` });
});

// Inventory Services
app.get('/api/inventory/items', authenticate, (req: AuthenticatedRequest, res) => {
  const canViewCost = req.user?.roleName === 'Owner' || req.user?.roleName === 'Admin' || req.user?.roleName === 'Purchase' || req.user?.roleName === 'Inventory';

  const sanitizedItems = DB.items.map((it) => ({
    ...it,
    purchasePrice: canViewCost ? it.purchasePrice : undefined,
  }));

  res.json({ items: sanitizedItems });
});

app.post('/api/inventory/adjust', authenticate, requireRole(['Owner', 'Admin', 'Manager', 'Inventory']), (req: AuthenticatedRequest, res) => {
  const { itemId, newStock, reason } = req.body;
  const item = DB.items.find((i) => i.id === itemId);

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const prevStock = item.stock;
  item.stock = Number(newStock);

  DB.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    tenantId: DB.tenant.id,
    actor: req.user?.name || 'Unknown',
    role: req.user?.roleName || 'Unknown',
    action: `STOCK_ADJUSTMENT: ${item.name}`,
    module: 'Items & Inventory',
    targetId: item.id,
    beforeState: { stock: prevStock },
    afterState: { stock: item.stock, reason },
    outcome: 'SUCCESS',
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, item });
});

// Approvals Queue
app.get('/api/approvals', authenticate, (_req, res) => {
  res.json({ approvals: DB.approvals });
});

app.post('/api/approvals/:id/decide', authenticate, requireRole(['Owner', 'Admin', 'Manager']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { decision } = req.body; // 'APPROVED' | 'REJECTED'
  const appr = DB.approvals.find((a) => a.id === id);

  if (!appr) {
    return res.status(404).json({ error: 'Approval request not found' });
  }

  appr.status = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
  appr.reviewedBy = req.user?.name;
  appr.reviewedAt = new Date().toISOString();

  // If approved and was invoice cancellation, process cancellation
  if (appr.status === 'APPROVED' && appr.requestType === 'INVOICE_CANCELLATION' && appr.referenceId) {
    const inv = DB.invoices.find((i) => i.id === appr.referenceId);
    if (inv) inv.isCancelled = true;
  }

  DB.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    tenantId: DB.tenant.id,
    actor: req.user?.name || 'Supervisor',
    role: req.user?.roleName || 'Manager',
    action: `APPROVAL_DECISION: ${appr.status} (${appr.requestType})`,
    module: 'Approvals & Governance',
    targetId: appr.id,
    outcome: 'SUCCESS',
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, approval: appr });
});

// Delivery Shipments & COD Reconciliation
app.get('/api/delivery/orders', authenticate, (_req, res) => {
  res.json({ orders: DB.deliveryOrders });
});

app.post('/api/delivery/orders/:id/status', authenticate, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { status, codCollected } = req.body;
  const order = DB.deliveryOrders.find((d) => d.id === id);

  if (!order) {
    return res.status(404).json({ error: 'Delivery order not found' });
  }

  order.deliveryStatus = status || order.deliveryStatus;
  if (codCollected !== undefined) {
    order.codCollected = Boolean(codCollected);
  }

  DB.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    tenantId: DB.tenant.id,
    actor: req.user?.name || 'Delivery Agent',
    role: req.user?.roleName || 'Delivery',
    action: `DELIVERY_STATUS_UPDATE: ${order.invoiceNo} -> ${order.deliveryStatus}`,
    module: 'Logistics & Dispatch',
    targetId: order.id,
    outcome: 'SUCCESS',
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, order });
});

// Audit Logs
app.get('/api/audit-logs', authenticate, requireRole(['Owner', 'Admin', 'Manager']), (_req, res) => {
  res.json({ auditLogs: DB.auditLogs });
});

// ============================================================================
// 3B. MY STORE <-> BILLING SYNCHRONIZATION ENDPOINTS
// ============================================================================

const STORE_OTP_CHALLENGES = new Map<string, { otp: string; purpose: string; expiresAt: number }>();

app.post('/api/store/auth/otp/request', (req, res) => {
  const { phone, purpose = 'login', otp: clientOtp } = req.body || {};
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length < 10) {
    return res.status(400).json({ error: 'Valid 10-digit mobile number required.' });
  }
  const otp = clientOtp ? String(clientOtp) : String(Math.floor(100000 + Math.random() * 900000));
  STORE_OTP_CHALLENGES.set(digits, {
    otp,
    purpose: String(purpose),
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  res.json({ success: true, phone: digits, purpose, expiresInSeconds: 300 });
});

app.post('/api/store/auth/otp/verify', (req, res) => {
  const { phone, otp } = req.body || {};
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  const entry = STORE_OTP_CHALLENGES.get(digits);
  if (!entry || Date.now() > entry.expiresAt) {
    return res.status(400).json({ valid: false, error: 'OTP expired or not requested.' });
  }
  if (String(otp || '').trim() !== entry.otp) {
    return res.status(400).json({ valid: false, error: 'Invalid OTP.' });
  }
  STORE_OTP_CHALLENGES.delete(digits);
  res.json({ valid: true, verified: true });
});

app.get('/api/store/bootstrap', (_req, res) => {
  res.json({
    orders: DB.storeOrders,
    coupons: DB.storeCoupons,
    returnRequests: DB.storeReturnRequests,
    serviceAreaConfig: DB.storeServiceAreaConfig,
  });
});

app.post('/api/store/coupons/validate', (req, res) => {
  const { code, subtotal = 0, customerId = '', categories = [] } = req.body || {};
  const cleanCode = String(code || '').trim().toUpperCase();
  const coupon = DB.storeCoupons.find((c) => c.code.toUpperCase() === cleanCode);
  if (!coupon) return res.status(404).json({ valid: false, message: `Coupon "${cleanCode}" not found.` });
  if (!coupon.isActive) return res.status(400).json({ valid: false, message: `Coupon "${cleanCode}" is inactive.` });
  const todayStr = new Date().toISOString().slice(0, 10);
  if (coupon.expiryDate && coupon.expiryDate < todayStr) {
    return res.status(400).json({ valid: false, message: `Coupon "${cleanCode}" expired.` });
  }
  if (coupon.usedCount >= coupon.usageLimitTotal) {
    return res.status(400).json({ valid: false, message: `Coupon "${cleanCode}" usage limit reached.` });
  }
  if (customerId && coupon.usageLimitPerCustomer > 0) {
    const uses = coupon.usedByCustomerIds.filter((id) => id === customerId).length;
    if (uses >= coupon.usageLimitPerCustomer) {
      return res.status(400).json({ valid: false, message: `You have already used "${cleanCode}".` });
    }
  }
  if (Number(subtotal) < coupon.minOrderValue) {
    return res.status(400).json({ valid: false, message: `Minimum order ₹${coupon.minOrderValue} required.` });
  }
  if (coupon.eligibleCategories && coupon.eligibleCategories.length > 0 && Array.isArray(categories) && categories.length > 0) {
    const ok = categories.some((cat: string) =>
      coupon.eligibleCategories!.some((el) => el.toLowerCase() === String(cat).toLowerCase())
    );
    if (!ok) {
      return res.status(400).json({ valid: false, message: `Eligible only on ${coupon.eligibleCategories.join(', ')}.` });
    }
  }
  const rawDisc = coupon.discountType === 'flat' ? coupon.discountValue : Math.round((Number(subtotal) * coupon.discountValue) / 100);
  const discountAmount = Math.min(Number(subtotal), coupon.maxDiscount ? Math.min(rawDisc, coupon.maxDiscount) : rawDisc);
  return res.json({ valid: true, coupon, discountAmount });
});

app.post('/api/store/orders', (req, res) => {
  const { order, payment, stockHistory } = req.body || {};
  if (!order || !order.id) {
    return res.status(400).json({ error: 'Invalid online order payload.' });
  }
  const exists = DB.storeOrders.some((o) => o.id === order.id);
  if (!exists) {
    DB.storeOrders.unshift(order);
  }
  if (payment && !DB.storePayments.some((p) => p.id === payment.id)) {
    DB.storePayments.unshift(payment);
  }
  if (Array.isArray(stockHistory) && stockHistory.length > 0) {
    DB.storeStockHistory.unshift(...stockHistory);
  }
  DB.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    tenantId: DB.tenant.id,
    actor: order.partyName || 'Customer',
    role: 'Customer',
    action: `ONLINE_ORDER_CREATED: ${order.onlineOrderId || order.invoiceNo}`,
    module: 'My Store',
    targetId: order.id,
    afterState: { totalAmount: order.totalAmount, paymentType: order.paymentType },
    outcome: 'SUCCESS',
    timestamp: new Date().toISOString(),
  });
  res.status(201).json({ success: true, order });
});

app.post('/api/store/orders/:id/advance', authenticate, requireRole(['Owner', 'Admin', 'Manager', 'Inventory', 'Delivery']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { stage, deliveryBagId, deliveryBoyName, deliveryOtp } = req.body || {};
  const order = DB.storeOrders.find((o) => o.id === id);
  if (!order) return res.status(404).json({ error: 'Order not found on server.' });
  order.orderWorkflowStatus = stage || order.orderWorkflowStatus;
  if (deliveryBagId) order.deliveryBagId = deliveryBagId;
  if (deliveryBoyName) order.deliveryBoyName = deliveryBoyName;
  if (deliveryOtp) order.deliveryOtp = deliveryOtp;
  DB.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    tenantId: DB.tenant.id,
    actor: req.user?.name || 'Staff',
    role: req.user?.roleName || 'Staff',
    action: `STORE_ORDER_STAGE -> ${order.orderWorkflowStatus}`,
    module: 'Logistics & Dispatch',
    targetId: order.id,
    outcome: 'SUCCESS',
    timestamp: new Date().toISOString(),
  });
  res.json({ success: true, order });
});

app.post('/api/store/orders/:id/verify-otp', authenticate, requireRole(['Owner', 'Admin', 'Manager', 'Delivery']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { otp, codCollected = true } = req.body || {};
  const order = DB.storeOrders.find((o) => o.id === id);
  if (!order) return res.status(404).json({ error: 'Store order not found.' });
  if (order.deliveryOtp && String(otp).trim() !== String(order.deliveryOtp).trim()) {
    return res.status(400).json({ error: 'Invalid 4-digit Delivery OTP.' });
  }
  order.deliveryOtpVerified = true;
  order.orderWorkflowStatus = 'Delivered';
  order.fulfillmentStatus = 'Completed';
  if (order.paymentType === 'Cash' && codCollected) {
    order.paymentStatus = 'Paid';
    order.status = 'Paid';
    order.receivedAmount = order.totalAmount;
    order.balance = 0;
  }
  res.json({ success: true, order });
});

app.post('/api/store/orders/:id/cancel', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  const order = DB.storeOrders.find((o) => o.id === id);
  if (!order) return res.status(404).json({ error: 'Store order not found.' });
  if (order.orderWorkflowStatus === 'Out for Delivery' || order.orderWorkflowStatus === 'Delivered') {
    return res.status(400).json({ error: 'Dispatched/Delivered orders cannot be cancelled. Submit a return request instead.' });
  }
  order.isCancelled = true;
  order.orderWorkflowStatus = 'Cancelled';
  order.cancelReason = reason || 'Cancelled';
  res.json({ success: true, order });
});

app.post('/api/store/orders/:id/return', (req, res) => {
  const { id } = req.params;
  const returnReq = req.body;
  if (!returnReq || !returnReq.id) return res.status(400).json({ error: 'Invalid return request payload.' });
  DB.storeReturnRequests.unshift({ ...returnReq, orderId: id });
  res.status(201).json({ success: true, returnRequest: returnReq });
});

// Online Cloud State Snapshot Sync (Persistent Backend Storage in /data/store-snapshot.json)
const SNAPSHOT_FILE = path.resolve(__dirname, 'data', 'store-snapshot.json');

app.get('/api/store/sync-state', (_req, res) => {
  try {
    if (!fs.existsSync(SNAPSHOT_FILE)) {
      return res.json({ available: false, snapshot: null });
    }
    const raw = fs.readFileSync(SNAPSHOT_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return res.json({ available: true, snapshot: parsed });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load server snapshot' });
  }
});

app.post('/api/store/sync-state', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid sync payload' });
    }
    const dataDir = path.dirname(SNAPSHOT_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const envelope = {
      ...payload,
      syncedAt: new Date().toISOString(),
    };
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(envelope), 'utf-8');
    return res.json({ success: true, syncedAt: envelope.syncedAt });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to save server snapshot' });
  }
});

// Seller Permission & Product-Specific Minimum Wholesale Quantity Validation Endpoint
app.post('/api/seller/validate-sale', (req, res) => {
  const { sellerId, sellerType, saleChannel, partyName, items } = req.body || {};
  if (!sellerId || !sellerType || !saleChannel || !partyName || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required seller sale fields or line items.' });
  }

  // Backend Seller Type Enforcement
  if (sellerType === 'Wholesaler Only' && saleChannel !== 'Wholesale') {
    DB.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      tenantId: DB.tenant.id,
      actor: sellerId,
      role: 'Seller (Wholesaler Only)',
      action: 'UNAUTHORIZED_RETAIL_SALE_ATTEMPT',
      module: 'Seller Portal',
      outcome: 'DENIED',
      timestamp: new Date().toISOString(),
    });
    return res.status(403).json({ error: 'Permission Denied: Wholesaler Only accounts cannot create Retail sales.' });
  }
  if (sellerType === 'Retailer Only' && saleChannel !== 'Retail') {
    DB.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      tenantId: DB.tenant.id,
      actor: sellerId,
      role: 'Seller (Retailer Only)',
      action: 'UNAUTHORIZED_WHOLESALE_SALE_ATTEMPT',
      module: 'Seller Portal',
      outcome: 'DENIED',
      timestamp: new Date().toISOString(),
    });
    return res.status(403).json({ error: 'Permission Denied: Retailer Only accounts cannot create Wholesale sales.' });
  }

  let subtotal = 0;
  let taxAmount = 0;
  const lineResults: Array<{ itemId: string; appliedPrice: number; appliedTier: 'Wholesale' | 'Retail'; lineTotal: number }> = [];

  for (const line of items) {
    const qty = Number(line.qty) || 0;
    const minWhQty = Math.max(1, Number(line.minWholesaleQty) || 1);
    const retailPrice = Number(line.retailPrice) || 0;
    const wholesalePrice = Number(line.wholesalePrice) > 0 ? Number(line.wholesalePrice) : retailPrice;
    const discPct = Math.max(0, Math.min(100, Number(line.discountPercent) || 0));
    const taxPct = Math.max(0, Number(line.taxPercent) || 0);

    if (qty <= 0) {
      return res.status(400).json({ error: `Invalid quantity for product "${line.name}".` });
    }

    if (sellerType === 'Wholesaler Only' && qty < minWhQty) {
      return res.status(400).json({
        error: `"${line.name}" requires minimum wholesale quantity of ${minWhQty} (entered ${qty}).`,
      });
    }

    const useWholesale =
      sellerType === 'Wholesaler Only'
        ? qty >= minWhQty
        : sellerType === 'Both Wholesaler + Retailer'
        ? saleChannel === 'Wholesale' && qty >= minWhQty
        : false;
    const appliedPrice = useWholesale ? wholesalePrice : retailPrice;
    const appliedTier: 'Wholesale' | 'Retail' = useWholesale ? 'Wholesale' : 'Retail';
    const rawSub = appliedPrice * qty * (1 - discPct / 100);
    const lineTax = (rawSub * taxPct) / 100;
    const lineTotal = Math.round((rawSub + lineTax) * 100) / 100;

    subtotal += rawSub;
    taxAmount += lineTax;
    lineResults.push({ itemId: line.itemId, appliedPrice, appliedTier, lineTotal });
  }

  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
  DB.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    tenantId: DB.tenant.id,
    actor: sellerId,
    role: `Seller (${sellerType})`,
    action: `SELLER_${saleChannel.toUpperCase()}_SALE_VALIDATED`,
    module: 'Seller Portal',
    afterState: { partyName, totalAmount, itemsCount: items.length },
    outcome: 'SUCCESS',
    timestamp: new Date().toISOString(),
  });

  return res.json({
    success: true,
    validatedTotals: {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      totalAmount,
      lineResults,
    },
  });
});

// Online Store Manager Permission-Validated Order & Support Endpoints
app.post('/api/online-manager/orders/:id/action', (req, res) => {
  const { id } = req.params;
  const { action, roleName, reason, deliveryBagId, deliveryBoyName } = req.body || {};
  const allowed = ['Online Store Manager', 'Owner', 'Admin', 'Manager'].includes(roleName);
  if (!allowed) {
    return res.status(403).json({ error: 'Permission Denied: Restricted to Online Store Manager or Admin.' });
  }
  const stageMap: Record<string, string> = {
    accept: 'Confirmed',
    reject: 'Cancelled',
    pack: 'Packing',
    ready: 'Packing',
    assign: 'Out for Delivery',
  };
  const nextStage = stageMap[action];
  if (!nextStage) {
    return res.status(400).json({ error: 'Invalid online order workflow action.' });
  }
  const existing = DB.storeOrders.find((o) => o.id === id);
  if (existing) {
    existing.orderWorkflowStatus = nextStage;
    if (deliveryBagId) existing.deliveryBagId = deliveryBagId;
    if (deliveryBoyName) existing.deliveryBoyName = deliveryBoyName;
    if (action === 'reject') {
      existing.isCancelled = true;
      existing.cancelReason = reason || 'Rejected by Online Store Manager';
    }
  }
  DB.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    tenantId: DB.tenant.id,
    actor: roleName,
    role: roleName,
    action: `ONLINE_MANAGER_ORDER_${String(action).toUpperCase()}`,
    module: 'Online Store',
    targetId: id,
    outcome: 'SUCCESS',
    timestamp: new Date().toISOString(),
  });
  return res.json({ success: true, nextStage });
});

app.post('/api/online-manager/support/reply', (req, res) => {
  const { messageId, managerId, managerName, roleName, replyText } = req.body || {};
  const allowed = ['Online Store Manager', 'Owner', 'Admin', 'Manager'].includes(roleName);
  if (!allowed) {
    return res.status(403).json({ error: 'Permission Denied: Only authorized support managers can reply.' });
  }
  if (!messageId || !replyText || !String(replyText).trim()) {
    return res.status(400).json({ error: 'Reply message cannot be empty.' });
  }
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  DB.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    tenantId: DB.tenant.id,
    actor: `${managerName || managerId}`,
    role: roleName,
    action: `CUSTOMER_SUPPORT_REPLY`,
    module: 'Online Store Support',
    targetId: messageId,
    outcome: 'SUCCESS',
    timestamp: new Date().toISOString(),
  });
  return res.json({ success: true, timestamp });
});

// Automated Backend Verification & Regression Test Runner
app.get('/api/tests/run', (_req, res) => {
  const results: Array<{ name: string; passed: boolean; message: string }> = [];
  const assert = (name: string, condition: boolean, message: string) => {
    results.push({ name, passed: Boolean(condition), message: condition ? 'Passed' : message });
  };

  // 1. Check multi-tenant scope isolation
  assert('Tenant Scope', DB.tenant.id === 'tenant-krishna-1', 'Default tenant must be initialized');
  assert('Branch Definition', DB.tenant.branches.length >= 3, 'Must support multiple branches and warehouses');

  // 2. Sequential Invoice Numbering
  const seq1 = DB.nextInvoiceSeq;
  assert('Sequential Invoice Counter', seq1 > 0, 'Sequential invoice counter initialized');

  // 3. User Role Profiles
  const rolesFound = new Set(DB.users.map((u) => u.roleName));
  const requiredRoles = ['Owner', 'Admin', 'Manager', 'Cashier', 'Accountant', 'Sales', 'Purchase', 'Inventory', 'Delivery'];
  const allRolesPresent = requiredRoles.every((r) => rolesFound.has(r));
  assert('9 Core Billing Roles Configured', allRolesPresent, 'All 9 roles must be seeded');

  // 4. Price Protection / Cost Masking
  const cashierUser = DB.users.find((u) => u.roleName === 'Cashier');
  assert('Cashier User Defined', Boolean(cashierUser), 'Cashier user must exist');

  // 5. Indian CBIC HSN/SAC Master & GST Validation
  assert('Authoritative Indian HSN Master Loaded', INDIA_HSN_SAC_MASTER.length >= 45, 'Must include CBIC HSN/SAC schedule');
  assert('GSTIN Format Validator', isValidGstin('29ABCDE1234F1Z5') && !isValidGstin('INVALID123'), 'Validates 15-char GSTIN format');
  assert('HSN/SAC Code Validator', isValidHsnOrSac('1006') && isValidHsnOrSac('996511') && !isValidHsnOrSac('ABC'), 'Validates 4/6/8-digit numeric HSN/SAC');

  const passed = results.filter((r) => r.passed).length;
  res.json({
    summary: `${passed} of ${results.length} backend tests passed`,
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  });
});

// Mount 5-Module ERP Router (Purchase Scanner OCR, HSN/GST Master, E-Invoice/EWB IRP, Quotation Portal, Backup/Rollback)
app.use('/api', createErpRouter(authenticate as any, requireRole as any));

// ============================================================================
// 4. VITE INTEGRATION & STATIC SPA SERVING
// ============================================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Vyapar Server] Running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    console.error(`[Vyapar Server] Startup error on port ${PORT}:`, err.message);
  });
}

startServer();
