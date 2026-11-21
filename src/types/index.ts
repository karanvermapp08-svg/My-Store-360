export interface InvoiceItem {
  id: string;
  name: string;
  hsn: string;
  qty: number;
  unit: string;
  price: number;
  discountPercent: number;
  taxPercent: number;
  amount: number;
  batchNo?: string;
  expiryDate?: string;
  freeQty?: number;
  barcode?: string;
  taxCategory?: 'Taxable' | 'Exempt' | 'Zero-Rated' | 'Nil Rated';
  taxInclusive?: boolean;
  returnedQty?: number;
  damagedQty?: number;
  invoicedQty?: number;
  serialNo?: string;
  serialId?: string;
  mrp?: number;
  discountAmount?: number;
  unitCostAtSale?: number;
  unitCostEdited?: boolean;
  totalCost?: number;
  grossProfit?: number;
  profitMarginPercent?: number;
  costingMethodUsed?: CostingMethodType;
  // Smart Kirana Auto Weight & Amount fields
  itemId?: string;
  brand?: string;
  originalInputValue?: number;
  inputMode?: 'amount' | 'weight' | 'qty';
  normalizedWeightGrams?: number;
  baseQty?: number;
  baseUnit?: string;
  displayWeightLabel?: string;
  discountMode?: 'percent' | 'fixed';
  mfgDate?: string;
  orderedQty?: number;
  receivedQty?: number;
  supplierSku?: string;
}

export interface Transaction {
  id: string;
  type: 'Sale' | 'Estimate' | 'Proforma' | 'Payment-In' | 'Sale Order' | 'Delivery Challan' | 'Sale Return' | 'Purchase' | 'Purchase Return' | 'Expense' | 'Other Income';
  invoiceNo: string;
  date: string; // DD/MM/YYYY, HH:MM AM/PM
  partyName: string;
  partyPhone?: string;
  partyAddress?: string;
  partyGstin?: string;
  firm: string;
  user: string;
  paymentType: 'Cash' | 'Cheque' | 'Bank Transfer' | 'UPI' | 'Credit';
  totalAmount: number;
  receivedAmount: number;
  balance: number;
  dueDate: string;
  status: 'Paid' | 'Unpaid' | 'Partial';
  items: InvoiceItem[];
  notes?: string;
  createdAt: string;
  source?: 'POS' | 'MANUAL' | 'ONLINE_STORE';
  onlineOrderId?: string;
  customerId?: string;
  orderWorkflowStatus?:
    | 'Pending Approval'
    | 'Confirmed'
    | 'Packing'
    | 'Out for Delivery'
    | 'Delivered'
    | 'Cancelled'
    | 'Return Requested'
    | 'Returned';
  deliveryBoyId?: string;
  deliveryBoyName?: string;
  deliveryBoyPhone?: string;
  deliveryBagId?: string;
  deliveryOtp?: string;
  deliveryOtpVerified?: boolean;
  deliveryFee?: number;
  couponCode?: string;
  couponDiscount?: number;
  msCreditUsed?: number;
  msCreditEarned?: number;
  paymentRecordId?: string;
  paymentRef?: string;
  paymentStatus?: 'Pending' | 'Pending Verification' | 'Paid' | 'Refunded';
  linkedSaleInvoiceId?: string;
  linkedSaleInvoiceNo?: string;
  orderTimeline?: { status: string; timestamp: string; note: string; actor?: string }[];
  // Professional GST & Billing fields
  stateOfSupply?: string;
  gstType?: 'Intra-State' | 'Inter-State';
  subtotal?: number;
  totalDiscount?: number;
  taxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  roundOff?: number;
  // Document linkage & conversion
  originalInvoiceNo?: string;
  originalInvoiceId?: string;
  returnReason?: string;
  convertedFrom?: { type: 'Estimate' | 'Sale Order' | 'Delivery Challan'; docId: string; docNo: string };
  fulfillmentStatus?: 'Pending' | 'Partially Fulfilled' | 'Completed' | 'Cancelled';
  allocatedPayments?: { paymentId: string; receiptNo: string; amount: number; date: string }[];
  // Revision history & controlled cancellation
  revisionHistory?: { timestamp: string; modifiedBy: string; changes: string; totalAmount: number }[];
  isCancelled?: boolean;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  // Logistics
  vehicleNumber?: string;
  challanNo?: string;
  // Seller & Online Store extensions
  saleChannel?: 'Wholesale' | 'Retail' | 'Online' | 'POS';
  sellerId?: string;
  rejectedReason?: string;
  // Integrated ERP 5-Module Extensions
  sourceScanId?: string;
  attachedDocumentName?: string;
  attachedDocumentDataUrl?: string;
  supplierGstin?: string;
  poNumber?: string;
  // Delivery Challan Extensions
  challanPurpose?: 'Goods sent before billing' | 'Approval' | 'Returnable goods' | 'Job work' | 'Other';
  challanStatus?:
    | 'Draft'
    | 'Ready for Dispatch'
    | 'Dispatched'
    | 'Partially Returned'
    | 'Pending Billing'
    | 'Partially Invoiced'
    | 'Converted'
    | 'Cancelled';
  expectedDeliveryDate?: string;
  billingAddress?: string;
  shippingAddress?: string;
  transporterName?: string;
  deliveryPerson?: string;
  dispatchLocation?: string;
  deliveryLocation?: string;
  showPricesOnChallan?: boolean;
  challanReturns?: ChallanReturnRecord[];
  linkedChallanId?: string;
  linkedQuotationId?: string;
  linkedOrderId?: string;
  skipStockDeduction?: boolean;
  // Estimate / Quotation Extensions
  quotationStatus?: QuotationStatus;
  quotationVersion?: number;
  quotationRevisions?: QuotationRevision[];
  quotationApproval?: QuotationApproval;
  quotationShareToken?: string;
  partyEmail?: string;
  referenceNo?: string;
  salesperson?: string;
  shippingCharges?: number;
  otherCharges?: number;
  overallDiscount?: number;
  termsAndConditions?: string;
  // E-Invoice & E-Way Bill Links
  eInvoiceId?: string;
  eWayBillId?: string;
  // Advanced Profit & Loss Engine fields
  freightCharges?: number;
  otherPurchaseExpenses?: number;
  gstInputCreditEligible?: boolean;
  invoiceDiscountMode?: 'percent' | 'fixed';
  invoiceDiscountValue?: number;
  totalCostOfGoodsSold?: number;
  grossProfit?: number;
  netProfit?: number;
  profitMarginPercent?: number;
  isLossInvoice?: boolean;
  expenseCategory?: string;
  discountApproval?: {
    approvedBy: string;
    approvedRole: string;
    reason: string;
    approvedAt: string;
    lossAmount: number;
  };
  // 5001-5400 Transaction, Billing, Payment & Purchase Engine fields
  uuid?: string;
  sequenceNo?: number;
  branchId?: string;
  warehouseId?: string;
  workflowStatus?: TransactionWorkflowStatus;
  stateHistory?: TransactionStateHistoryEntry[];
  version?: number;
  versionHistory?: TransactionVersionSnapshot[];
  tags?: string[];
  customFields?: Record<string, string>;
  packagingCharges?: number;
  adjustmentAmount?: number;
  changeReturned?: number;
  creditApplied?: number;
  isReversed?: boolean;
  reversedByTxId?: string;
  reversalOfTxId?: string;
  splitFromTxId?: string;
  consolidatedFromIds?: string[];
  activityHistory?: TransactionActivityEntry[];
  attachments?: Array<{ id: string; name: string; mimeType?: string; dataUrl: string; uploadedAt: string }>;
  // Payment Engine extensions
  extendedPaymentMode?: ExtendedPaymentMode;
  splitPayments?: SplitPaymentPart[];
  writeOffAmount?: number;
  excessAdvanceAmount?: number;
  refundedAmount?: number;
  reconciled?: boolean;
  reconciledAt?: string;
  reconciledRef?: string;
  approvalRequired?: boolean;
  approvalReason?: string;
  // Purchase / PO / GRN extensions
  supplierQuotationId?: string;
  grnStatus?: 'Not Received' | 'Partially Received' | 'Fully Received';
  grnReceipts?: Array<{
    id: string;
    grnNo: string;
    date: string;
    receivedBy: string;
    items: Array<{ name: string; qtyReceived: number; batchNo?: string; expiryDate?: string }>;
    linkedBillId?: string;
  }>;
  linkedPoId?: string;
  linkedPoNo?: string;
}

export interface PartyShippingAddress {
  id: string;
  label: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault?: boolean;
}

export interface Party {
  id: string;
  name: string;
  phone: string;
  email: string;
  type: 'Customer' | 'Supplier';
  balance: number;
  gstin: string;
  address: string;
  state?: string;
  city?: string;
  pincode?: string;
  country?: string;
  creditLimit?: number;
  creditPeriodDays?: number;
  groupId?: string;
  groupName?: string;
  status?: 'Active' | 'Inactive' | 'Blocked';
  shippingAddress?: string;
  shippingAddresses?: PartyShippingAddress[];
  contactPerson?: string;
  notes?: string;
  customFields?: Record<string, string>;
  reminderOptOut?: boolean;
}

export type InvoiceTemplateType = 'gst-tax-invoice' | 'modern' | 'classic' | 'thermal-2' | 'thermal-3';

export interface Item {
  id: string;
  name: string;
  code: string;
  barcode?: string;
  category: string;
  salePrice: number;
  purchasePrice: number;
  stock: number;
  unit: string;
  taxRate: number;
  minStockAlert?: number;
  maxStockLevel?: number;
  reservedStock?: number;
  wholesalePrice?: number;
  dealerPrice?: number;
  minWholesaleQty?: number;
  mrp?: number;
  brand?: string;
  mfgDate?: string;
  expiryDate?: string;
  subLabel?: string;
  // HSN / SAC & GST Classification fields
  hsnCode?: string;
  sacCode?: string;
  taxCategory?: 'Taxable' | 'Exempt' | 'Zero-Rated' | 'Nil Rated';
  effectiveDate?: string;
  taxClassificationVerified?: boolean;
  taxInclusive?: boolean;
  batchNo?: string;
  lastSupplierPrice?: number;
  lastPurchaseSupplier?: string;
  lastPurchaseDate?: string;
  // Warehouse, unit conversion & tags
  godownId?: string;
  godownStocks?: Record<string, number>;
  unitConversion?: { secondaryUnit: string; rate: number };
  tags?: string[];
  // E-commerce & Store fields
  description?: string;
  image?: string;
  isOnlineAvailable?: boolean;
  onlineDiscountPercent?: number;
  rating?: number;
  reviewCount?: number;
  highlights?: string[];
  isDeal?: boolean;
  isRecommended?: boolean;
  isBestSeller?: boolean;
  isTrending?: boolean;
  customFields?: Record<string, string>;
  // Cost Management & Profit Protection fields
  lastPurchasePrice?: number;
  weightedAvgCost?: number;
  openingStock?: number;
  minSellingPrice?: number;
  targetMarginPercent?: number;
  gstInputCreditEligible?: boolean;
  // Smart Kirana Loose / Weight Product Settings
  productType?: 'Loose' | 'Packaged' | 'Piece';
  minSellingQty?: number;
  decimalPrecision?: number;
  customerPrices?: Record<string, number>;
  // Advanced Item Management Module fields
  isActive?: boolean;
  createdAt?: string;
  sku?: string;
  subcategory?: string;
  manufacturer?: string;
  itemType?: 'Product' | 'Service' | 'Raw Material' | 'Finished Goods' | 'Composite Product';
  extraBarcodes?: string[];
  purchaseUnit?: string;
  purchaseTaxRate?: number;
  purchaseDiscountPercent?: number;
  additionalPurchaseCharges?: number;
  preferredSupplier?: string;
  minPurchaseQty?: number;
  maxSellingPrice?: number;
  gstApplicable?: boolean;
  cessRate?: number;
  gstTypePreference?: 'Inclusive' | 'Exclusive';
  defaultDiscountPercent?: number;
  defaultDiscountAmount?: number;
  maxDiscountLimitPercent?: number;
  qtyDiscountMinQty?: number;
  qtyDiscountPercent?: number;
  wholesaleDiscountPercent?: number;
  promoDiscountPercent?: number;
  reorderLevel?: number;
  damagedStock?: number;
  expiredStock?: number;
  rackNumber?: string;
  shelfLocation?: string;
  priceHistory?: Array<{
    id: string;
    timestamp: string;
    actor: string;
    field: string;
    oldValue: number;
    newValue: number;
    reason?: string;
  }>;
}

export interface CompanyProfile {
  name: string;
  legalName?: string;
  phone: string;
  altPhone?: string;
  email: string;
  website?: string;
  address: string;
  city?: string;
  pincode?: string;
  country?: string;
  gstin: string;
  pan?: string;
  registrationNo?: string;
  state: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  upiId: string;
  logoDataUrl?: string;
  businessType?: string;
  businessCategory?: string;
  ownerName?: string;
  description?: string;
  openingDate?: string;
}

export interface AppSettings {
  invoicePrefix: string;
  nextInvoiceNumber: number;
  invoicePadding?: number;
  invoiceSuffix?: string;
  defaultTaxRate: number;
  enableGst: boolean;
  enableThermalPrint: boolean;
  defaultInvoiceTemplate?: InvoiceTemplateType;
  enableRoundOff?: boolean;
  enableCreditLimitWarning?: boolean;
  currencySymbol: string;
  themeColor: string;
  storeName?: string;
  storeTagline?: string;
  freeDeliveryThreshold?: number;
  standardDeliveryFee?: number;
}

// ==========================================
// 1. CUSTOMER APP MODELS
// ==========================================
export interface CustomerCartItem {
  item: Item;
  qty: number;
  selectedUnit: string;
}

export interface CustomerAddress {
  id: string;
  name: string;
  phone: string;
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
  label: 'Home' | 'Work' | 'Other';
}

export interface CustomerReview {
  id: string;
  itemId: string;
  customerName: string;
  rating: number; // 1 to 5
  comment: string;
  date: string;
  verifiedBuyer: boolean;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  items: {
    itemId: string;
    name: string;
    price: number;
    qty: number;
    unit: string;
    amount: number;
  }[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  totalAmount: number;
  paymentMethod: 'Cash on Delivery' | 'UPI QR' | 'Credit/Debit Card' | 'Net Banking';
  paymentStatus: 'Pending' | 'Paid';
  deliveryAddress: CustomerAddress;
  status: 'Order Placed' | 'Confirmed' | 'Packing in Godown' | 'Out for Delivery' | 'Delivered' | 'Returned' | 'Cancelled';
  timeline: {
    status: string;
    timestamp: string;
    note: string;
  }[];
  returnReason?: string;
  refundStatus?: 'None' | 'Requested' | 'Approved' | 'Refunded';
}

// ==========================================
// 2. SELLER APP EXTENSIONS: GODOWNS, STOCK TRANSFERS, EXPENSES, LOANS
// ==========================================
export interface Godown {
  id: string;
  name: string;
  location: string;
  manager: string;
  contact: string;
  capacitySqFt: number;
  isCentral: boolean;
  totalStockValue: number;
}

export interface StockTransfer {
  id: string;
  transferNo: string;
  date: string;
  fromGodownId: string;
  fromGodownName: string;
  toGodownId: string;
  toGodownName: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  notes?: string;
  dispatchedBy: string;
  status: 'Completed' | 'In Transit';
}

export interface Expense {
  id: string;
  voucherNo: string;
  date: string;
  category: 'Rent' | 'Electricity & Water' | 'Logistics & Fuel' | 'Staff Salary' | 'Marketing' | 'Maintenance' | 'Tea & Office' | 'General';
  amount: number;
  paidTo: string;
  paymentMode: 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque';
  notes?: string;
}

export interface Loan {
  id: string;
  loanNo: string;
  lenderName: string;
  type: 'Taken (Liability)' | 'Given (Asset)';
  principalAmount: number;
  interestRatePercent: number;
  startDate: string;
  tenureMonths: number;
  emiAmount: number;
  outstandingBalance: number;
  status: 'Active' | 'Closed';
}

export interface BusinessNotification {
  id: string;
  type: 'ORDER' | 'STOCK' | 'PAYMENT' | 'SYSTEM';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

// ==========================================
// 3. ADMIN PANEL MODELS: MULTI-TENANCY, ROLES, AUDIT
// ==========================================
export interface Business {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  plan: 'Free Trial' | 'Silver' | 'Gold' | 'Platinum Enterprise';
  status: 'Active' | 'Expiring Soon' | 'Expired' | 'Suspended';
  storesCount: number;
  usersCount: number;
  totalRevenue: number;
  joinedDate: string;
}

export interface StoreBranch {
  id: string;
  businessId: string;
  name: string;
  code: string;
  city: string;
  address: string;
  phone: string;
  isMainBranch: boolean;
  dailySales: number;
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Store Manager' | 'Cashier' | 'Warehouse Staff' | 'Customer';
  status: 'Active' | 'Inactive';
  lastActive: string;
  accessibleBranches: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  module: 'Billing' | 'Inventory' | 'Godown' | 'Customer Store' | 'Settings' | 'Security';
  ipAddress: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
}

export interface PlatformSubscription {
  planId: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  features: string[];
  recommended?: boolean;
}

export type EcosystemMode = 'seller' | 'customer' | 'admin';

// ==========================================
// 4. ENTERPRISE RBAC & EMPLOYEE MANAGEMENT MODELS
// ==========================================
export type BuiltInRoleType =
  | 'Owner'
  | 'Admin'
  | 'Manager'
  | 'Cashier'
  | 'Accountant'
  | 'Sales'
  | 'Purchase'
  | 'Inventory'
  | 'Delivery'
  | 'Seller'
  | 'Online Store Manager';

export type BillingModule =
  | 'sales_pos'          // Sales & POS
  | 'purchase_expenses'  // Purchase & Expenses
  | 'items_inventory'    // Items & Inventory
  | 'parties'            // Parties & Ledgers
  | 'accounting'         // Accounting & Reconciliation
  | 'reports'            // Reports & BI
  | 'cash_bank_assets'   // Cash, Bank & Assets
  | 'staff_security'     // Staff & Security Governance
  | 'utilities_sync'     // Utilities & Data Sync
  | 'settings_config';   // Company Settings & Subscription

export type ModuleAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'cancel'
  | 'refund'
  | 'export'
  | 'print'
  | 'configure';

export type GranularPermissionKey = `${BillingModule}.${ModuleAction}`;

export type PermissionKey =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'cancel'
  | 'refund'
  | 'export'
  | 'print'
  | 'configure'
  | 'payment'
  | 'discount'
  | 'report'
  | 'settings'
  | 'branch'
  | 'product'
  | 'customer'
  | 'supplier'
  | GranularPermissionKey;

export type PrivilegeLevel = 1 | 2 | 3 | 4 | 5; // 1: Restricted, 2: Standard, 3: Supervisory, 4: Administrative, 5: Root Owner
export type RiskTier = 'Standard' | 'Moderate' | 'High' | 'Critical';
export type BranchScope =
  | 'All Branches'
  | 'Assigned Branch Only'
  | 'Assigned Warehouse Only'
  | 'Custom Scope'
  | 'all'
  | 'assigned_branch_only'
  | 'regional'
  | 'central_warehouse';

export interface PermissionGroup {
  id: string;
  name: string;
  moduleCode: BillingModule;
  description: string;
  permissions: {
    key: PermissionKey;
    action: ModuleAction;
    label: string;
    description: string;
  }[];
}

export interface RoleDefinition {
  id: string;
  name: string;
  type: BuiltInRoleType | 'Custom';
  description: string;
  isBuiltIn: boolean;
  color: string;
  permissions: PermissionKey[];
  assignedUsersCount: number;
  // Billing-Specific Controls & Enterprise Metadata
  privilegeLevel?: PrivilegeLevel;
  riskTier?: RiskTier;
  branchScope?: BranchScope;
  lastModifiedDate?: string;
  lastModifiedBy?: string;
  lastModified?: string;
  modifiedBy?: string;
  maxDiscountPercent?: number; // e.g. 5% Cashier, 15% Manager, 100% Owner
  maxRefundAmountWithoutApproval?: number; // e.g. 0 Cashier, 2000 Manager, unlimited Owner
  canViewPurchasePrice?: boolean;
  canViewProfitMargins?: boolean;
  canEditFinalizedBills?: 'No' | 'Limited' | 'Approval' | 'Restricted' | 'Yes' | boolean;
  canCancelInvoices?: 'No' | 'Approval' | 'Restricted' | 'Yes' | boolean;
  isArchived?: boolean;
}

export interface Employee {
  id: string;
  employeeId: string; // e.g. "EMP-1001"
  name: string;
  email: string;
  phone: string;
  department: 'Sales & Marketing' | 'Accounts & Finance' | 'Billing & Counter' | 'Warehouse & Logistics' | 'Operations' | 'Procurement';
  designation: string; // e.g. "Store Manager", "Lead Cashier", "Senior Accountant"
  role?: string;
  joiningDate: string; // DD/MM/YYYY
  status: 'Active' | 'On Leave' | 'Probation' | 'Terminated' | 'Pending Approval';
  roleId: string;
  roleName: string;
  avatar?: string;
  salary: number;
  commissionRatePercent: number; // e.g. 2.5%
  totalSalesAchieved: number;
  totalCommissionEarned: number;
  ordersHandled: number;
  rating: number; // e.g. 4.8
  assignedBranch: string;
  governmentId?: string;
  address?: string;
}

export interface UserSession {
  id: string;
  userId: string;
  userName: string;
  device: string; // e.g. "Chrome 128 / Windows 11"
  ipAddress: string;
  location: string;
  loginTime: string;
  lastActiveTime: string;
  isCurrent: boolean;
  status: 'Active' | 'Expired' | 'Terminated';
}

export interface LoginHistoryRecord {
  id: string;
  userId: string;
  userName: string;
  email: string;
  role: string;
  timestamp: string;
  device: string;
  ipAddress: string;
  status: 'Success' | 'Failed - Incorrect Password' | 'Blocked Attempt' | 'Approved by Admin';
  location: string;
}

export interface UserActivityLog {
  id: string;
  userId: string;
  userName: string;
  role: string;
  action: string;
  module: 'Auth' | 'Sales' | 'Purchase' | 'Inventory' | 'Employee' | 'Roles' | 'Settings' | 'Billing' | 'Security';
  details: string;
  timestamp: string;
  ipAddress: string;
  targetId?: string;
  targetType?: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  outcome?: 'Success' | 'Denied' | 'Approved' | 'Flagged';
}

export interface UserInvitation {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  department: string;
  invitedBy: string;
  invitedAt: string;
  status: 'Pending' | 'Accepted' | 'Expired' | 'Revoked';
  inviteToken: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // DD/MM/YYYY
  punchInTime: string; // e.g. "09:15 AM"
  punchOutTime?: string; // e.g. "06:30 PM"
  status: 'Present' | 'Late' | 'Half Day' | 'On Leave' | 'Absent';
  workingHours: number;
  notes?: string;
}

export type SellerType = 'Wholesaler Only' | 'Retailer Only' | 'Both Wholesaler + Retailer';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleId: string;
  roleName: string;
  employeeId?: string;
  avatar?: string;
  status: 'Active' | 'Blocked' | 'Pending Approval';
  isApproved: boolean;
  twoFactorEnabled?: boolean;
  lastLogin: string;
  password?: string;
  passwordHash?: string;
  accountType?: 'ADMIN' | 'STAFF';
  sellerType?: SellerType;
  deliveryAvailability?: 'Available' | 'On Break' | 'Offline';
  deliveryRating?: number;
  onlineInventoryAccess?: boolean;
}

export interface SupportTicket {
  id: string;
  ticketNo: string;
  customerName: string;
  phone: string;
  email?: string;
  category: 'Billing & GST' | 'Printer & Hardware' | 'Inventory & Sync' | 'Licensing & Activation' | 'General Query';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  message: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  createdAt: string;
  updatedAt: string;
  resolutionNotes?: string;
  assignedAgent?: string;
}

export interface PremiumSubscription {
  plan: 'Free Trial' | 'Silver Desktop' | 'Gold Desktop + Mobile';
  status: 'Active' | 'Trial' | 'Expired';
  licenseKey?: string;
  activatedAt?: string;
  expiresAt: string;
  maxUsers: number;
  features: string[];
}

export interface PremiumOrder {
  id: string;
  orderNumber: string;
  plan: 'Silver Desktop' | 'Gold Desktop + Mobile';
  amount: number;
  durationMonths: number;
  paymentMethod: 'UPI' | 'Net Banking' | 'Debit/Credit Card';
  paymentStatus: 'Completed' | 'Pending Verification';
  createdAt: string;
  generatedLicenseKey: string;
}

// ==========================================
// 5. CUSTOMER & STAFF PORTAL MODELS (OFFLINE RBAC)
// ==========================================
export type PortalStage = 'welcome' | 'customer-login' | 'customer-register' | 'staff-login';
export type AccountType = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export interface CustomerAccount {
  id: string;
  customerId: string; // e.g. CUST001
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  authProvider: 'local' | 'google';
  linkedPartyName: string;
  addresses: CustomerAddress[];
  msCreditBalance?: number;
  msCreditEarnedTotal?: number;
  msCreditUsedTotal?: number;
  createdAt: string;
  lastLogin: string;
}

export interface StaffTask {
  id: string;
  staffId: string; // e.g. ST001 or EMP-1001
  staffName: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Pending' | 'In Progress' | 'Completed';
  dueDate: string;
  assignedBy: string;
  createdAt: string;
}

export interface PortalNotification {
  id: string;
  recipientType: 'CUSTOMER' | 'STAFF';
  recipientId: string;
  title: string;
  message: string;
  type: 'order' | 'payment' | 'task' | 'system';
  read: boolean;
  createdAt: string;
}

export interface CustomerActivityRecord {
  id: string;
  customerId: string;
  customerName: string;
  action: string;
  details: string;
  timestamp: string;
  status: 'Info' | 'Success' | 'Alert';
}

export interface SupportMessageRecord {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  orderId?: string;
  subject: string;
  message: string;
  createdAt: string;
  status: 'Open' | 'Replied';
  replies?: {
    id: string;
    sender: 'Customer' | 'Manager';
    senderName: string;
    message: string;
    timestamp: string;
  }[];
}

// ==========================================
// 6. UNIFIED BILLING & CUSTOMER STORE ENTITIES
// ==========================================
export interface BillingCoupon {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: 'percent' | 'flat';
  discountValue: number;
  maxDiscount?: number;
  minOrderValue: number;
  eligibleCategories?: string[];
  expiryDate: string; // YYYY-MM-DD
  usageLimitTotal: number;
  usageLimitPerCustomer: number;
  usedCount: number;
  usedByCustomerIds: string[];
  isActive: boolean;
  createdBy: string;
}

export interface MSCreditTransaction {
  id: string;
  customerId: string;
  customerName: string;
  type: 'EARN' | 'REDEEM' | 'REFUND' | 'ADJUSTMENT';
  amount: number; // 1 MS Credit = ₹1
  balanceAfter: number;
  orderId?: string;
  invoiceNo?: string;
  description: string;
  createdAt: string;
}

export interface StockTransactionRecord {
  id: string;
  itemId: string;
  itemName: string;
  type:
    | 'RESERVE'
    | 'RELEASE'
    | 'DEDUCT_SALE'
    | 'RETURN_RESTOCK'
    | 'MANUAL_ADJUSTMENT'
    | 'PURCHASE_INWARD'
    | 'DAMAGED_WRITE_OFF'
    | 'PURCHASE_RETURN';
  qtyChange: number;
  stockAfter: number;
  reservedAfter: number;
  referenceNo: string;
  actor: string;
  timestamp: string;
  notes?: string;
}

export interface PaymentRecord {
  id: string;
  paymentNo: string;
  orderId?: string;
  invoiceNo?: string;
  customerId?: string;
  partyName: string;
  amount: number;
  method: 'Cash on Delivery' | 'UPI' | 'Online Payment' | 'Card' | 'Net Banking' | 'Bank Transfer' | 'Cash';
  status: 'Pending' | 'Pending Verification' | 'Completed' | 'Refunded' | 'Failed';
  transactionRef?: string;
  refundStatus?: 'None' | 'Requested' | 'Refunded';
  createdAt: string;
  verifiedBy?: string;
}

export interface ReturnRefundRequest {
  id: string;
  returnNo: string;
  orderId: string;
  invoiceNo?: string;
  customerId: string;
  customerName: string;
  reason: string;
  items: { itemId?: string; name: string; qty: number; amount: number }[];
  refundAmount: number;
  status: 'Requested' | 'Approved' | 'Rejected' | 'Refunded';
  createdAt: string;
  processedBy?: string;
  processedAt?: string;
}

export interface StoreServiceAreaConfig {
  storeEnabled: boolean;
  storeName: string;
  hubName: string;
  allowedPincodes: string[];
  maxRadiusKm: number;
  storeLat: number;
  storeLng: number;
  outOfAreaMessage: string;
  minOrderValue?: number;
  freeDeliveryThreshold: number;
  standardDeliveryFee: number;
  additionalOutskirtFee: number;
  msCreditEarnPercent: number;
  allowWholesalePricing: boolean;
}

export interface AiAssistantProposedAction {
  actionType: 'NONE' | 'CREATE_PURCHASE_ORDER' | 'ADJUST_MIN_STOCK' | 'CREATE_STOCK_ADJUSTMENT';
  title: string;
  description: string;
  itemId?: string;
  itemName?: string;
  supplierName?: string;
  qty?: number;
  unitPrice?: number;
  newMinStock?: number;
}

export interface AiAssistantResponse {
  answer: string;
  highlights: Array<{ label: string; value: string }>;
  proposedAction?: AiAssistantProposedAction;
}

// ==========================================
// 7. DEEP ERP UPGRADE MODELS (ACCOUNTING, BATCHES, SERIALS, VARIANTS, RECURRING, RECYCLE BIN)
// ==========================================
export type ThemePreference = 'light' | 'dark' | 'system';

export type PaymentTermsType = 'Due on Receipt' | 'Net 7' | 'Net 15' | 'Net 30' | 'Net 45' | 'Net 60' | 'Custom';

export interface ItemBatch {
  id: string;
  itemId: string;
  itemName: string;
  batchNumber: string;
  mfgDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  purchaseRate: number;
  saleRate: number;
  qty: number;
  warehouseId?: string;
}

export interface ItemVariant {
  id: string;
  itemId: string;
  name: string; // e.g. "Small", "Medium", "1kg Red"
  sku: string;
  barcode: string;
  price: number;
  stock: number;
}

export interface SerialNumberRecord {
  id: string;
  serialNo: string;
  itemId: string;
  itemName: string;
  purchaseDate: string;
  saleDate?: string;
  customerName?: string;
  warrantyMonths: number;
  warrantyEndDate?: string;
  status: 'Available' | 'Sold' | 'Returned' | 'Damaged';
}

export interface PriceHistoryEntry {
  id: string;
  itemId: string;
  itemName: string;
  priceType: 'Sale Price' | 'Purchase Price' | 'Wholesale Price';
  oldPrice: number;
  newPrice: number;
  timestamp: string;
  actor: string;
}

export type AccountGroupType = 'Assets' | 'Liabilities' | 'Capital' | 'Income' | 'Expenses';

export interface AccountRecord {
  id: string;
  code: string;
  name: string;
  group: AccountGroupType;
  subType: string;
  openingBalance: number;
  normalBalance: 'Debit' | 'Credit';
  isActive: boolean;
  isSystem?: boolean;
}

export interface JournalLine {
  id: string;
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  narration?: string;
}

export interface JournalVoucher {
  id: string;
  voucherNo: string;
  date: string; // DD/MM/YYYY
  voucherType: 'Journal' | 'Sales' | 'Purchase' | 'Receipt' | 'Payment' | 'Contra';
  referenceNo?: string;
  narration: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  createdBy: string;
  createdAt: string;
}

export interface RecurringTemplate {
  id: string;
  title: string;
  txType: 'Sale' | 'Expense' | 'Other Income';
  partyName: string;
  amount: number;
  paymentType: 'Cash' | 'UPI' | 'Bank Transfer' | 'Credit';
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
  nextRunDate: string; // YYYY-MM-DD
  lastRunDate?: string;
  isActive: boolean;
  notes?: string;
}

export interface RecycleBinRecord {
  id: string;
  entityType: 'Transaction' | 'Party' | 'Item' | 'JournalVoucher';
  label: string;
  subLabel: string;
  deletedAt: string;
  deletedBy: string;
  payload: any;
}

export type DashboardCardKey =
  | 'sales'
  | 'purchases'
  | 'profit'
  | 'receivables'
  | 'payables'
  | 'cash'
  | 'bank'
  | 'stock';

export interface DashboardCardPref {
  key: DashboardCardKey;
  label: string;
  visible: boolean;
  order: number;
}

export interface ConfirmationDialogConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void | Promise<void>;
}

export interface ToastNotice {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  undoLabel?: string;
  onUndo?: () => void;
}

// ==========================================
// MODULE 1: AI PURCHASE BILL SCANNER
// ==========================================
export interface PurchaseScanItem {
  id: string;
  scannedName: string;
  brand?: string;
  hsnCode?: string;
  barcode?: string;
  qty: number;
  freeQty: number;
  unit: string;
  purchasePrice: number;
  discountPercent: number;
  discountAmount: number;
  taxableValue: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  batchNo?: string;
  expiryDate?: string;
  packageSize?: string;
  matchStatus: 'MATCHED' | 'UNMATCHED' | 'CREATE_NEW' | 'IGNORED';
  matchedItemId?: string;
  matchedItemName?: string;
  matchConfidence?: number;
  matchMethod?: 'Barcode' | 'HSN' | 'Name' | 'Brand+Size' | 'Manual';
  previousPurchasePrice?: number;
  lastSupplierPrice?: number;
  currentSellingPrice?: number;
  updatedSellingPrice?: number;
}

export interface PurchaseScanRecord {
  id: string;
  status: 'DRAFT' | 'VERIFIED' | 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  confirmedAt?: string;
  createdBy: string;
  sourceFiles: Array<{
    name: string;
    mimeType: string;
    sizeBytes: number;
    previewDataUrl?: string;
  }>;
  supplierName: string;
  supplierGstin: string;
  supplierAddress: string;
  supplierPhone: string;
  matchedSupplierId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  purchaseOrderNo?: string;
  gstType: 'Intra-State' | 'Inter-State';
  subtotal: number;
  totalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  grandTotal: number;
  duplicateWarning?: string;
  linkedPurchaseTxId?: string;
  items: PurchaseScanItem[];
}

// ==========================================
// MODULE 2: HSN / SAC & GST CLASSIFICATION
// ==========================================
export interface HsnMasterEntry {
  code: string;
  type: 'HSN' | 'SAC';
  description: string;
  category: string;
  gstRate: number;
  taxCategory: 'Taxable' | 'Exempt' | 'Zero-Rated' | 'Nil Rated';
  uqc: string;
  sourceRef: string;
  effectiveDate: string;
}

export interface GstClassificationAudit {
  id: string;
  timestamp: string;
  actor: string;
  action: 'SINGLE_UPDATE' | 'BULK_UPDATE' | 'CSV_IMPORT';
  affectedCount: number;
  summary: string;
  changes: Array<{
    itemId: string;
    itemName: string;
    oldHsn?: string;
    newHsn?: string;
    oldRate: number;
    newRate: number;
    oldCategory?: string;
    newCategory?: string;
  }>;
}

// ==========================================
// MODULE 3: DELIVERY CHALLAN RETURNS
// ==========================================
export interface ChallanReturnRecord {
  id: string;
  date: string;
  recordedBy: string;
  notes?: string;
  items: Array<{
    itemId?: string;
    name: string;
    acceptedQty: number;
    damagedQty: number;
  }>;
}

// ==========================================
// MODULE 5: QUOTATION REVISIONS & APPROVALS
// ==========================================
export type QuotationStatus =
  | 'Draft'
  | 'Sent'
  | 'Viewed'
  | 'Accepted'
  | 'Rejected'
  | 'Expired'
  | 'Modification Requested'
  | 'Converted to Order'
  | 'Converted to Invoice';

export interface QuotationRevision {
  version: number;
  savedAt: string;
  savedBy: string;
  totalAmount: number;
  items: InvoiceItem[];
  notes?: string;
  changeSummary: string;
}

export interface QuotationApproval {
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Modification Requested';
  respondedAt?: string;
  customerName?: string;
  comment?: string;
  token: string;
}

// ==========================================
// MODULE 4: E-INVOICE & E-WAY BILL (IRP/NIC)
// ==========================================
export interface EInvoiceRecord {
  id: string;
  transactionId: string;
  invoiceNo: string;
  invoiceDate: string;
  partyName: string;
  buyerGstin: string;
  sellerGstin: string;
  taxableAmount: number;
  totalTax: number;
  totalAmount: number;
  status: 'PENDING' | 'GENERATED' | 'FAILED' | 'CANCELLED';
  irn?: string;
  ackNo?: string;
  ackDate?: string;
  signedQrCode?: string;
  errorMessage?: string;
  gspProvider?: string;
  cancelReasonCode?: string;
  cancelRemarks?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EInvoiceApiLog {
  id: string;
  eInvoiceId?: string;
  invoiceNo: string;
  endpoint: string;
  action: 'VALIDATE' | 'GENERATE_IRN' | 'CANCEL_IRN' | 'GENERATE_EWB';
  statusCode: number;
  success: boolean;
  message: string;
  timestamp: string;
}

export interface EWayBillRecord {
  id: string;
  transactionId: string;
  invoiceNo: string;
  eInvoiceIrn?: string;
  partyName: string;
  totalAmount: number;
  status: 'PENDING' | 'GENERATED' | 'FAILED' | 'CANCELLED';
  ewbNo?: string;
  ewbDate?: string;
  validUpto?: string;
  transporterName: string;
  transporterId?: string;
  vehicleNumber: string;
  transportMode: 'Road' | 'Rail' | 'Air' | 'Ship';
  distanceKm: number;
  dispatchLocation: string;
  deliveryLocation: string;
  transportDocNo?: string;
  transportDocDate?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface GspCredentialStatus {
  configured: boolean;
  providerName: string;
  environment: 'Sandbox' | 'Production';
  sellerGstin: string;
  maskedClientId?: string;
  irpEndpointConfigured: boolean;
  ewbEndpointConfigured: boolean;
  updatedAt?: string;
}

// ==========================================
// COMPLETE SETTINGS MODULE & ROLE-BASED ACCESS
// ==========================================
export type SettingsCategoryId =
  | 'general'
  | 'transaction'
  | 'print'
  | 'taxes-gst'
  | 'transaction-message'
  | 'party'
  | 'item'
  | 'service-reminders'
  | 'accounting'
  | 'role-access'
  | 'masters'
  | 'users-portal'
  | 'audit-backup';

export type CoreSettingsCategoryId =
  | 'general'
  | 'transaction'
  | 'print'
  | 'taxes-gst'
  | 'transaction-message'
  | 'party'
  | 'item'
  | 'service-reminders'
  | 'accounting';

export type CustomFieldType =
  | 'Text'
  | 'Number'
  | 'Date'
  | 'Dropdown'
  | 'Email'
  | 'Phone'
  | 'URL';

export interface CustomFieldDefinition {
  id: string;
  name: string;
  fieldType: CustomFieldType;
  enabled: boolean;
  required: boolean;
  showInPrint: boolean;
  showInProfile: boolean;
  defaultValue?: string;
  options?: string[];
}

export interface PartyGroup {
  id: string;
  name: string;
  partyType: 'Customer' | 'Supplier' | 'Both';
  description?: string;
  defaultDiscountPercent?: number;
  createdAt: string;
}

export interface PaymentReminderLog {
  id: string;
  partyId: string;
  partyName: string;
  channel: 'WhatsApp' | 'SMS' | 'Email' | 'Manual';
  amountDue: number;
  messagePreview: string;
  sentAt: string;
  sentBy: string;
}

export type SequenceDocumentType =
  | 'Sales Invoice'
  | 'Purchase Bill'
  | 'Sales Return'
  | 'Purchase Return'
  | 'Estimate / Quotation'
  | 'Proforma Invoice'
  | 'Sales Order'
  | 'Purchase Order'
  | 'Delivery Challan'
  | 'Payment Receipt'
  | 'Payment Out'
  | 'Credit Note'
  | 'Debit Note'
  | 'Expense'
  | 'Other Income'
  | 'Journal Voucher'
  | 'Stock Adjustment'
  | 'Stock Transfer';

export type NumberResetPolicy = 'Never' | 'Financial Year' | 'Monthly' | 'Yearly';

export interface InvoiceNumberSequenceConfig {
  docType: SequenceDocumentType;
  prefix: string;
  startNumber: number;
  nextNumber: number;
  suffix: string;
  digits: number;
  useFinancialYear: boolean;
  autoNumbering: boolean;
  allowManualOverride: boolean;
  preventDuplicate: boolean;
  resetPolicy?: NumberResetPolicy;
  lastResetPeriodKey?: string;
  branchPrefixes?: Record<string, string>;
  warehousePrefixes?: Record<string, string>;
}

export type PrintableDocumentType =
  | 'Sales Invoice'
  | 'Purchase Bill'
  | 'Estimate / Quotation'
  | 'Sales Order'
  | 'Delivery Challan'
  | 'Payment Receipt'
  | 'Payment Out'
  | 'Sales Return'
  | 'Purchase Return'
  | 'Credit Note'
  | 'Debit Note';

export interface PrintSettingsConfig {
  defaultTemplate: InvoiceTemplateType;
  activeDocumentType: PrintableDocumentType;
  pageSize: 'A4 Portrait' | 'A4 Landscape' | 'A5' | 'Thermal 58mm' | 'Thermal 80mm' | 'Custom';
  customWidthMm: number;
  customHeightMm: number;
  marginMm: number;
  fontSizePt: number;
  tableRowSpacing: 'Compact' | 'Standard' | 'Relaxed';
  headerSpacingPx: number;
  footerSpacingPx: number;
  // Branding
  showLogo: boolean;
  logoPosition: 'Left' | 'Center' | 'Right';
  showBusinessName: boolean;
  showBusinessAddress: boolean;
  showContactInfo: boolean;
  showGstin: boolean;
  showPan: boolean;
  showWebsiteEmail: boolean;
  documentTitles: Record<PrintableDocumentType, string>;
  customHeaderNote: string;
  customFooterNote: string;
  // Item Table Columns
  showSerialNo: boolean;
  showItemName: boolean;
  showItemDescription: boolean;
  showBarcode: boolean;
  showHsnSac: boolean;
  showQty: boolean;
  showUnit: boolean;
  showFreeQty: boolean;
  showRate: boolean;
  showDiscountCol: boolean;
  showTaxableValue: boolean;
  showGstPercent: boolean;
  showCgst: boolean;
  showSgst: boolean;
  showIgst: boolean;
  showAmount: boolean;
  // Additional Print Fields
  showCustomerAddress: boolean;
  showShippingAddress: boolean;
  showCustomerGstin: boolean;
  showInvoiceDate: boolean;
  showDueDate: boolean;
  showPaymentTerms: boolean;
  showReferenceNo: boolean;
  showNotes: boolean;
  showTermsAndConditions: boolean;
  showAuthorizedSignature: boolean;
  showCustomerSignature: boolean;
  showReceivedBy: boolean;
  showTransportInfo: boolean;
  showVehicleNumber: boolean;
  showQrCode: boolean;
  // Behaviour
  showPricesOnChallan: boolean;
  showTaxDetails: boolean;
  showDiscountSummary: boolean;
  showPaymentDetails: boolean;
  showAdditionalCustomFields: boolean;
  autoPrintOnSave: boolean;
}

export type MessageTemplateType =
  | 'Sales Invoice'
  | 'Purchase Bill'
  | 'Estimate / Quotation'
  | 'Sales Order'
  | 'Delivery Challan'
  | 'Payment Reminder'
  | 'Payment Received'
  | 'Payment Due'
  | 'Overdue Payment'
  | 'Sales Return'
  | 'Purchase Return';

export interface TransactionMessageTemplate {
  id: string;
  type: MessageTemplateType;
  subject: string;
  body: string;
  enableWhatsApp: boolean;
  enableSms: boolean;
  enableEmail: boolean;
}

export type ServiceReminderCategory =
  | 'Product Warranty'
  | 'Equipment Service'
  | 'Customer Follow-up'
  | 'Payment Follow-up'
  | 'Annual Maintenance'
  | 'Custom Reminder';

export interface ServiceReminderRecord {
  id: string;
  category: ServiceReminderCategory;
  title: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  relatedItemName?: string;
  reminderDate: string; // YYYY-MM-DD
  nextReminderDate?: string; // YYYY-MM-DD
  repeatFrequency: 'None' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
  message: string;
  assignedEmployee?: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Upcoming' | 'Due Today' | 'Overdue' | 'Completed' | 'Cancelled';
  createdAt: string;
  completedAt?: string;
}

export interface RoleSettingsCategoryPermission {
  view: boolean;
  edit: boolean;
}

export interface RoleSettingsAccessRule {
  roleName: string;
  categories: Record<CoreSettingsCategoryId, RoleSettingsCategoryPermission>;
  canManageRoleAccess: boolean;
  canResetSettings: boolean;
  canBackupAndRestore: boolean;
  canViewAuditHistory: boolean;
}

export interface SettingsAuditEntry {
  id: string;
  businessId: string;
  category: SettingsCategoryId;
  settingName: string;
  previousValue: string;
  newValue: string;
  changedBy: string;
  changedRole: string;
  timestamp: string;
  reason?: string;
}

export interface BusinessSettingsBundle {
  businessId: string;
  updatedAt: string;
  general: {
    country: string;
    currencyCode: string;
    currencySymbol: string;
    currencyPosition: 'before' | 'after';
    numberFormat: 'Indian (12,34,567.89)' | 'International (1,234,567.89)';
    dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
    timeFormat: '12-hour' | '24-hour';
    timeZone: string;
    language: 'English (India)' | 'Hindi' | 'Kannada' | 'Tamil' | 'Telugu' | 'Marathi';
    decimalPrecision: number;
    thousandSeparator: ',' | '.' | ' ';
    decimalSeparator: '.' | ',';
    financialYearStartMonth: number; // 4 = April
    financialYearLabel: string; // e.g. 'FY 2026-27'
    financialYearStartDate: string;
    financialYearEndDate: string;
    enablePreviousYearViewing: boolean;
    carryForwardOpeningBalance: boolean;
    defaultSalesType: 'Retail' | 'Wholesale' | 'POS';
    defaultPurchaseType: 'Credit' | 'Cash';
    defaultPaymentMethod: 'Cash' | 'UPI' | 'Bank Transfer' | 'Card' | 'Cheque';
    defaultTaxMode: 'Inclusive' | 'Exclusive';
    allowNegativeStock: boolean;
    lowStockNotifications: boolean;
    enableMultiBranch: boolean;
    lastBackupDate?: string;
    lastBackupStatus?: 'Success' | 'Pending' | 'Failed';
  };
  transaction: {
    sequences: InvoiceNumberSequenceConfig[];
    sales: {
      defaultTransactionType: 'Cash' | 'Credit' | 'POS';
      defaultSalePriceMode: 'Retail' | 'Wholesale' | 'MRP';
      defaultDiscountPercent: number;
      enableLineDiscount: boolean;
      enableOverallDiscount: boolean;
      taxMode: 'Exclusive' | 'Inclusive';
      enableRoundOff: boolean;
      enableShippingCharges: boolean;
      enableAdditionalCharges: boolean;
      requireCustomerSelection: boolean;
      enableSalesperson: boolean;
      defaultDueDays: number;
      defaultTerms: string;
      defaultNotes: string;
      enableReferenceNo: boolean;
    };
    purchase: {
      requireSupplierSelection: boolean;
      defaultTaxMode: 'Exclusive' | 'Inclusive';
      enablePurchaseDiscount: boolean;
      enableFreightCharges: boolean;
      enableOtherExpenses: boolean;
      defaultDueDays: number;
      requireSupplierInvoiceNo: boolean;
      requireSupplierInvoiceDate: boolean;
      updateStockOnConfirm: boolean;
    };
    payment: {
      defaultPaymentMode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Card';
      enabledModes: Array<'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Card' | 'Other'>;
      allowPartialPayment: boolean;
      allowAdvancePayment: boolean;
      allowMultiModeSplit: boolean;
      requirePaymentReference: boolean;
    };
    salesReturn: {
      requireOriginalInvoice: boolean;
      allowPartialReturn: boolean;
      defaultRefundMethod: 'Cash' | 'Bank Transfer' | 'UPI' | 'Credit Note';
      autoCreateCreditNote: boolean;
      separateDamagedStock: boolean;
      requireApproval: boolean;
    };
    purchaseReturn: {
      requireSupplierReference: boolean;
      allowPartialReturn: boolean;
      autoAdjustSupplierCredit: boolean;
      reverseInputTaxCredit: boolean;
    };
    behaviour: {
      allowNegativeStock: boolean;
      warnInsufficientStock: boolean;
      preventDuplicateInvoice: boolean;
      preventDuplicatePurchaseBill: boolean;
      updateInventoryOnConfirmedTx: boolean;
      reverseStockOnCancellation: boolean;
      maintainStockMovementLedger: boolean;
    };
  };
  print: PrintSettingsConfig;
  gst: {
    isGstRegistered: boolean;
    legalName: string;
    tradeName: string;
    registrationType: 'Regular' | 'Composition' | 'Unregistered' | 'SEZ' | 'Casual';
    stateCode: string;
    placeOfBusiness: string;
    compositionRatePercent: number;
    gstVerifiedStatus: 'Verified' | 'Pending Verification' | 'Not Applicable';
    enableCgstSgst: boolean;
    enableIgst: boolean;
    enableUtgst: boolean;
    enableExemptSupplies: boolean;
    enableNilRated: boolean;
    enableZeroRated: boolean;
    enableReverseCharge: boolean;
    defaultTaxRates: number[];
    defaultHsnMandatory: boolean;
    autoCalcTax: boolean;
    taxCalculationMode: 'Exclusive' | 'Inclusive';
    taxRounding: 'Nearest Rupee' | 'Exact Paise' | 'Round Up';
    lineLevelTax: boolean;
    invoiceLevelTaxSummary: boolean;
    enableEInvoice: boolean;
    enableEWayBill: boolean;
    eWayBillThreshold: number;
    flagUncertainHsnForReview: boolean;
  };
  messages: {
    templates: TransactionMessageTemplate[];
    remindersEnabled: boolean;
    dueDateReminderDays: number;
    overdueReminderFrequencyDays: number;
    requireManualSendConfirmation: boolean;
    whatsAppIntegrationEnabled: boolean;
    smsIntegrationEnabled: boolean;
    emailIntegrationEnabled: boolean;
  };
  party: {
    enablePartyGrouping: boolean;
    enableShippingAddress: boolean;
    allowMultipleShippingAddresses: boolean;
    enablePartyStatus: boolean;
    preventDeleteWithTransactions: boolean;
    blockTransactionsForBlockedParties: boolean;
    enablePaymentReminder: boolean;
    paymentReminderDaysBeforeDue: number;
    remindOnDueDate: boolean;
    remindAfterDueDate: boolean;
    paymentReminderAfterDays: number;
    paymentReminderMessage: string;
    enableWhatsAppReminderShare: boolean;
    requireConsentBeforeSend: boolean;
    customerMobileMandatory: boolean;
    supplierMobileMandatory: boolean;
    gstinRequirement: 'Optional' | 'Required for B2B' | 'Always Required';
    enableCreditLimitControl: boolean;
    enablePartyLedger: boolean;
    additionalFields: CustomFieldDefinition[];
  };
  item: {
    defaultItemType: 'Product' | 'Service';
    defaultUnit: string;
    defaultCategory: string;
    defaultTaxRate: number;
    defaultMinStockAlert: number;
    units: Array<{ id: string; name: string; shortCode: string; baseFactor?: number; isDefault?: boolean }>;
    categories: Array<{ id: string; name: string; subCategories?: string[] }>;
    enableBarcodeAutoGen: boolean;
    barcodeFormat: 'EAN-13' | 'Code 128' | 'EAN-8' | 'UPC-A';
    preventDuplicateBarcode: boolean;
    barcodeLabelSize: '50x25mm' | '38x25mm' | 'A4 24-Grid';
    enableWholesalePricing: boolean;
    enableMrpValidation: boolean;
    priceTaxMode: 'Inclusive' | 'Exclusive';
    enableInventoryTracking: boolean;
    allowNegativeStock: boolean;
    enableBatchTracking: boolean;
    enableExpiryTracking: boolean;
    enableSerialTracking: boolean;
    expiryWarningDays: number;
    lowStockNotification: boolean;
    outOfStockNotification: boolean;
    stockValuationMethod: 'FIFO' | 'Weighted Average' | 'Purchase Price';
    additionalFields: CustomFieldDefinition[];
  };
  serviceReminders: {
    enabled: boolean;
    defaultRepeatFrequency: 'None' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
    notifyDaysBefore: number;
    showOnDashboard: boolean;
    enableInAppAlerts: boolean;
    enableEmailAlerts: boolean;
    enableWhatsAppManualShare: boolean;
  };
  accounting: {
    accountingBasis: 'Accrual' | 'Cash';
    displayMode: 'Debit / Credit' | 'Plus / Minus';
    ledgerDateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD';
    defaultPaymentAccountId: string;
    roundOffAccountName: string;
    discountAccountName: string;
    freightAccountName: string;
    taxAccountName: string;
    protectBankDetailsByRole: boolean;
    expenseCategories: string[];
    paymentMethods: Array<{ id: string; name: string; type: 'Cash' | 'Bank' | 'UPI' | 'Card' | 'Cheque' | 'Other'; enabled: boolean }>;
    profitControl?: ProfitControlSettings;
    lockedPeriods?: LockedFinancialPeriod[];
  };
  roleSettingsAccess: Record<string, RoleSettingsAccessRule>;
}

export type CostingMethodType = 'Weighted Average' | 'FIFO' | 'Last Purchase Price';

export interface ProfitControlSettings {
  costingMethod: CostingMethodType;
  defaultDiscountType: 'percent' | 'fixed';
  maxDiscountPercent: number;
  minProfitMarginPercent: number;
  targetProfitMarginPercent: number;
  allowLossMakingSales: boolean;
  requireAdminPinForLoss: boolean;
  adminApprovalPin: string;
  gstBasisForProfit: 'Exclude Creditable GST' | 'Include All Tax';
  includeExpensesInNetProfit: boolean;
}

export interface LockedFinancialPeriod {
  id: string;
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  lockedBy: string;
  lockedAt: string;
}

export interface DiscountApprovalRecord {
  id: string;
  invoiceNo: string;
  partyName: string;
  requestedBy: string;
  approvedBy: string;
  discountAmount: number;
  discountPercent: number;
  lossAmount: number;
  reason: string;
  timestamp: string;
  status: 'Approved' | 'Blocked';
}

export interface BankAccountRecord {
  id: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  accountType: 'Current' | 'Savings' | 'Overdraft / CC';
  openingBalance: number;
  isPrimary?: boolean;
}

export interface ChequeRecord {
  id: string;
  chequeNo: string;
  date: string;
  partyName: string;
  bankName: string;
  direction: 'Received (Inward)' | 'Issued (Outward)';
  amount: number;
  status: 'Pending' | 'Cleared' | 'Bounced';
  linkedTxId?: string;
  notes?: string;
}

export interface ProductBundle {
  id: string;
  name: string;
  sku: string;
  bundlePrice: number;
  components: { itemId: string; itemName: string; qty: number; unitPrice: number }[];
  isActive: boolean;
}

// ==========================================
// 8. ENTERPRISE TRANSACTION, INVOICE, PAYMENT & PURCHASE ENGINE (5,001 - 5,400)
// ==========================================
export type TransactionWorkflowStatus =
  | 'Draft'
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Completed'
  | 'Cancelled'
  | 'Reversed'
  | 'Archived';

export interface TransactionStateHistoryEntry {
  id: string;
  timestamp: string;
  fromStatus: TransactionWorkflowStatus | 'None';
  toStatus: TransactionWorkflowStatus;
  actor: string;
  reason?: string;
}

export interface TransactionVersionSnapshot {
  version: number;
  timestamp: string;
  actor: string;
  reason: string;
  snapshot: {
    invoiceNo: string;
    date: string;
    partyName: string;
    paymentType: Transaction['paymentType'];
    totalAmount: number;
    receivedAmount: number;
    balance: number;
    status: Transaction['status'];
    workflowStatus?: TransactionWorkflowStatus;
    items: InvoiceItem[];
    notes?: string;
    subtotal?: number;
    totalDiscount?: number;
    shippingCharges?: number;
    packagingCharges?: number;
    otherCharges?: number;
    adjustmentAmount?: number;
  };
}

export interface TransactionActivityEntry {
  id: string;
  timestamp: string;
  action: 'Created' | 'Edited' | 'Printed' | 'Shared' | 'Emailed' | 'Exported' | 'Reminded' | 'Paid' | 'Cancelled' | 'Reversed' | 'Approved' | 'Rejected' | 'Restored';
  actor: string;
  details: string;
}

export interface TransactionTemplate {
  id: string;
  name: string;
  txType: Transaction['type'];
  partyName?: string;
  paymentType: Transaction['paymentType'];
  items: InvoiceItem[];
  notes?: string;
  tags?: string[];
  shippingCharges?: number;
  packagingCharges?: number;
  otherCharges?: number;
  createdBy: string;
  createdAt: string;
}

export interface RecurringExecutionLog {
  id: string;
  templateId: string;
  templateTitle: string;
  executedAt: string;
  status: 'Success' | 'Failed';
  generatedTxId?: string;
  generatedInvoiceNo?: string;
  errorMessage?: string;
  retryCount: number;
}

export type ExtendedPaymentMode =
  | 'Cash'
  | 'Bank'
  | 'UPI'
  | 'Card'
  | 'Cheque'
  | 'Demand Draft'
  | 'NEFT'
  | 'RTGS'
  | 'IMPS'
  | 'Wallet'
  | 'Other'
  | 'Mixed/Split';

export interface SplitPaymentPart {
  id: string;
  mode: Exclude<ExtendedPaymentMode, 'Mixed/Split'>;
  amount: number;
  referenceNo?: string;
  accountName?: string;
}

export interface PaymentLimitsConfig {
  cashSingleTxLimit: number;
  bankSingleTxLimit: number;
  userDailyLimit: number;
  branchDailyLimit: number;
  requireApprovalAboveLimit: boolean;
}

export interface SupplierItemMapping {
  id: string;
  supplierName: string;
  itemId: string;
  itemName: string;
  supplierSku: string;
  agreedPrice: number;
  lastQuotedPrice: number;
  leadTimeDays: number;
  moq: number;
  updatedAt: string;
}

export interface SupplierQuotation {
  id: string;
  quoteNo: string;
  date: string;
  validUntil: string;
  supplierName: string;
  supplierPhone?: string;
  items: Array<{
    itemId?: string;
    itemName: string;
    unit: string;
    qty: number;
    quotedRate: number;
    taxPercent: number;
    leadTimeDays?: number;
  }>;
  totalAmount: number;
  status: 'Open' | 'Selected' | 'Converted to PO' | 'Expired';
  notes?: string;
  createdAt: string;
}
