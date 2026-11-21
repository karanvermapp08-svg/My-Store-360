import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Transaction,
  Party,
  Item,
  CompanyProfile,
  AppSettings,
  RoleDefinition,
  Employee,
  AttendanceRecord,
  UserSession,
  LoginHistoryRecord,
  UserActivityLog,
  UserInvitation,
  AppUser,
  PermissionKey,
  BillingModule,
  ModuleAction,
  SupportTicket,
  PremiumSubscription,
  PremiumOrder,
  InvoiceTemplateType,
  PortalStage,
  AccountType,
  CustomerAccount,
  CustomerAddress,
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
  SellerType,
  ThemePreference,
  ItemBatch,
  ItemVariant,
  SerialNumberRecord,
  PriceHistoryEntry,
  AccountRecord,
  JournalVoucher,
  RecurringTemplate,
  RecycleBinRecord,
  DashboardCardPref,
  ConfirmationDialogConfig,
  ToastNotice,
  PurchaseScanRecord,
  HsnMasterEntry,
  GstClassificationAudit,
  ChallanReturnRecord,
  QuotationStatus,
  QuotationRevision,
  EInvoiceRecord,
  EInvoiceApiLog,
  EWayBillRecord,
  InvoiceItem,
  BusinessSettingsBundle,
  CoreSettingsCategoryId,
  SettingsCategoryId,
  PartyGroup,
  ServiceReminderRecord,
  SettingsAuditEntry,
  PaymentReminderLog,
  SequenceDocumentType,
  RoleSettingsAccessRule,
  AiAssistantProposedAction,
  DiscountApprovalRecord,
  LockedFinancialPeriod,
  TransactionWorkflowStatus,
  TransactionActivityEntry,
  TransactionTemplate,
  RecurringExecutionLog,
  ExtendedPaymentMode,
  SplitPaymentPart,
  PaymentLimitsConfig,
  SupplierQuotation,
  SupplierItemMapping,
  InvoiceNumberSequenceConfig,
} from '../types';
import {
  buildDefaultBusinessSettings,
  buildDefaultRoleSettingsAccess,
  DEFAULT_PARTY_GROUPS,
  DEFAULT_SERVICE_REMINDERS,
} from '../data/defaultSettings';
import {
  autoBuildJournalFromTransaction,
  buildDefaultChartOfAccounts,
  computeNextRecurringDate,
} from '../utils/erpEngine';
import {
  computePurchaseLineLandedCosts,
  computeWeightedAverageAfterPurchase,
  getEffectiveCostingMethod,
  getItemWeightedAvgCost,
  isDateInLockedPeriod,
  stampSaleTransactionProfit,
} from '../utils/profitEngine';
import {
  buildSplitInvoiceItems,
  canTransitionWorkflowState,
  createTransactionSnapshot,
  DEFAULT_PAYMENT_LIMITS,
  evaluatePaymentLimits,
  formatSequenceNumber,
  generateTransactionUuid,
  getResetPeriodKey,
  mapExtendedModeToTxPaymentType,
} from '../utils/transactionEngine';
import {
  convertUnitQty,
  formatBaseQtyHuman,
  roundQtyPrecision,
} from '../utils/kiranaBilling';
import { exportCurrentViewPdf as generateCurrentViewPdf } from '../utils/pdfExport';
import {
  DEFAULT_ROLES,
  DEFAULT_EMPLOYEES,
  DEFAULT_ATTENDANCE,
  DEFAULT_SESSIONS,
  DEFAULT_LOGIN_HISTORY,
  DEFAULT_ACTIVITY_LOGS,
  DEFAULT_USERS,
  DEFAULT_INVITATIONS,
  DEFAULT_SUPPORT_TICKETS,
  DEFAULT_SUBSCRIPTION,
} from '../utils/rbacDefaults';
import { safeGetStoredData, safeSetStoredData, generateUniqueId } from '../utils/storage';
import {
  DatabaseStats,
  initDatabase,
  loadAllFromIndexedDB,
  syncTransactionsToStores,
  syncPartiesToStores,
  syncItemsToStores,
  replaceStoreRecords,
  putKV,
  getDatabaseStats,
  exportCsvFile,
} from '../database/indexedDb';
import { hashPassword, verifyPassword } from '../utils/cryptoAuth';
import {
  DEFAULT_CUSTOMER_ACCOUNTS,
  DEFAULT_STAFF_TASKS,
  DEFAULT_PORTAL_NOTIFICATIONS,
  DEFAULT_CUSTOMER_ACTIVITY,
  DEFAULT_BILLING_COUPONS,
  DEFAULT_MS_CREDIT_TRANSACTIONS,
  DEFAULT_STORE_SERVICE_AREA,
  STORE_UNIFIED_ITEMS,
  sanitizeAndHashSeedUsers,
  stripSecretFieldsFromUser,
} from '../utils/portalDefaults';
import { COMBO_PACKS } from '../utils/customerStoreCatalog';
import { apiClient } from '../utils/apiClient';
import {
  ensureItemsHaveUniqueBarcodes,
  generateUniqueEan13Barcode,
  isBarcodeUnique,
  normalizeBarcode,
} from '../utils/barcodeUtils';

export type BarcodeScannerMode = 'billing' | 'pos' | 'purchase' | 'lookup' | 'adjustment';

export interface RecentScanEntry {
  id: string;
  code: string;
  itemId?: string;
  itemName?: string;
  price?: number;
  stock?: number;
  found: boolean;
  timestamp: string;
}

const DEFAULT_SIDEBAR_GROUPS: Record<string, boolean> = {
  'CORE ERP': true,
  'MORE GST & ERP TOOLS': false,
};

interface PersistedPortalSession {
  sessionType: AccountType;
  userId: string;
}

interface VyaparContextType {
  // Navigation & View
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeSaleSubtype: string;
  setActiveSaleSubtype: (type: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  expandedSidebarGroups: Record<string, boolean>;
  toggleSidebarGroup: (groupTitle: string) => void;
  setAllSidebarGroups: (expanded: boolean) => void;

  // Online Server Sync & Export / Restore
  isDbHydrated: boolean;
  dbStats: DatabaseStats | null;
  serverSyncStatus: 'online' | 'syncing' | 'reconnecting';
  lastServerSyncAt: string | null;
  syncNowWithServer: () => Promise<boolean>;
  refreshDbStats: () => Promise<void>;
  restoreFullBackup: (backupData: Record<string, any>) => Promise<{ restoredCounts: Record<string, number> }>;
  exportModuleCsv: (
    module: 'products' | 'customers' | 'suppliers' | 'sales' | 'purchases' | 'expenses' | 'income' | 'ledgers'
  ) => void;

  // Search & Filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterPeriod: string;
  setFilterPeriod: (period: string) => void;
  filterStartDate: string;
  setFilterStartDate: (date: string) => void;
  filterEndDate: string;
  setFilterEndDate: (date: string) => void;
  filterFirm: string;
  setFilterFirm: (firm: string) => void;
  filterUser: string;
  setFilterUser: (user: string) => void;

  // Data
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Transaction | null;
  updateTransaction: (id: string, tx: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => boolean;
  clearTransactions: () => void;
  loadDemoData: () => void;

  parties: Party[];
  addParty: (party: Omit<Party, 'id'>) => Party;
  updateParty: (partyId: string, updates: Partial<Party>) => { success: boolean; message: string };
  selectedPartyId: string;
  setSelectedPartyId: (id: string) => void;

  items: Item[];
  addItem: (item: Omit<Item, 'id'>) => Item;
  updateItem: (itemId: string, updates: Partial<Item>) => { success: boolean; message: string };
  selectedItemId: string;
  setSelectedItemId: (id: string) => void;
  adjustStock: (itemId: string, newStock: number, reason?: string) => void;
  recordDamagedStock: (itemId: string, damagedQty: number, reason?: string) => { success: boolean; message: string };
  recordPurchaseReturn: (input: {
    supplierName: string;
    originalBillNo?: string;
    items: InvoiceItem[];
    reason: string;
  }) => { success: boolean; message: string; transaction?: Transaction };
  recordUdharEntry: (input: {
    partyId: string;
    kind: 'GIVE_UDHAAR' | 'RECEIVE_PAYMENT';
    amount: number;
    paymentMode?: Transaction['paymentType'];
    dueDate?: string;
    notes?: string;
  }) => { success: boolean; message: string; transaction?: Transaction };
  executeConfirmedAiAction: (action: AiAssistantProposedAction) => { success: boolean; message: string };

  company: CompanyProfile;
  updateCompany: (profile: Partial<CompanyProfile>) => void;

  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;

  // Upgrade 02: Advanced Billing & Conversion Operations
  selectedTemplate: InvoiceTemplateType;
  setSelectedTemplate: (template: InvoiceTemplateType) => void;
  convertEstimateToInvoice: (estimateId: string) => Transaction | null;
  convertSalesOrderToInvoice: (orderId: string) => Transaction | null;
  convertChallanToInvoice: (
    challanId: string,
    customLines?: Array<{ itemId?: string; name: string; qtyToInvoice: number }>
  ) => Transaction | null;
  cancelInvoice: (invoiceId: string, reason: string) => boolean;
  allocatePaymentIn: (paymentId: string, allocations: { invoiceId: string; amount: number }[]) => boolean;
  checkPartyCreditLimit: (partyName: string, additionalBalance: number) => { exceeded: boolean; currentBalance: number; creditLimit: number; excess: number };
  isInvoiceNumberDuplicate: (invoiceNo: string, excludeId?: string) => boolean;
  getNextFormattedInvoiceNo: () => string;

  // Calculated Stats
  totalSalesAmount: number;
  totalReceivedAmount: number;
  totalBalanceAmount: number;

  // Modals
  isAddSaleOpen: boolean;
  setIsAddSaleOpen: (open: boolean) => void;
  isAddPurchaseOpen: boolean;
  setIsAddPurchaseOpen: (open: boolean) => void;
  selectedInvoice: Transaction | null;
  setSelectedInvoice: (invoice: Transaction | null) => void;
  isInvoicePreviewOpen: boolean;
  setIsInvoicePreviewOpen: (open: boolean) => void;
  isCompanyModalOpen: boolean;
  setIsCompanyModalOpen: (open: boolean) => void;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;
  isShortcutsModalOpen: boolean;
  setIsShortcutsModalOpen: (open: boolean) => void;
  isHelpModalOpen: boolean;
  setIsHelpModalOpen: (open: boolean) => void;
  isVersionsModalOpen: boolean;
  setIsVersionsModalOpen: (open: boolean) => void;
  isSupportModalOpen: boolean;
  setIsSupportModalOpen: (open: boolean) => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  isAnalyticsModalOpen: boolean;
  setIsAnalyticsModalOpen: (open: boolean) => void;
  isPremiumModalOpen: boolean;
  setIsPremiumModalOpen: (open: boolean) => void;
  isMyStoreModalOpen: boolean;
  setIsMyStoreModalOpen: (open: boolean) => void;
  isAddPartyModalOpen: boolean;
  setIsAddPartyModalOpen: (open: boolean) => void;
  editingParty: Party | null;
  setEditingParty: (party: Party | null) => void;
  isAddItemModalOpen: boolean;
  setIsAddItemModalOpen: (open: boolean) => void;
  editingItem: Item | null;
  setEditingItem: (item: Item | null) => void;
  prefilledBarcodeForNewItem: string;
  setPrefilledBarcodeForNewItem: (code: string) => void;
  isBarcodeScannerOpen: boolean;
  setIsBarcodeScannerOpen: (open: boolean) => void;
  barcodeScannerMode: BarcodeScannerMode;
  setBarcodeScannerMode: (mode: BarcodeScannerMode) => void;
  openBarcodeScanner: (
    mode?: BarcodeScannerMode,
    onScan?: (item: Item | null, rawCode: string) => void
  ) => void;
  triggerBarcodeScannedCallback: (item: Item | null, rawCode: string) => void;
  recentScannedBarcodes: RecentScanEntry[];
  recordScannedBarcode: (rawCode: string, item?: Item | null) => void;
  clearRecentScans: () => void;
  isLogoutModalOpen: boolean;
  setIsLogoutModalOpen: (open: boolean) => void;
  isAccessRestrictedOpen: boolean;
  setIsAccessRestrictedOpen: (open: boolean) => void;
  restrictedFeatureName: string;
  setRestrictedFeatureName: (name: string) => void;
  canAccessFeature: (featureKey: string) => boolean;
  checkFeatureAccess: (featureKey: string, featureLabel: string) => boolean;

  // Export PDF Document
  exportCurrentViewPdf: (options?: { title?: string; statusFilter?: string; paymentTypeFilter?: string }) => void;

  // Authentication & RBAC State
  isAuthenticated: boolean;
  currentUser: AppUser | null;
  setCurrentUser: (user: AppUser | null) => void;
  users: AppUser[];
  roles: RoleDefinition[];
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  sessions: UserSession[];
  loginHistory: LoginHistoryRecord[];
  activityLogs: UserActivityLog[];
  invitations: UserInvitation[];
  sessionTimeoutMinutes: number;
  setSessionTimeoutMinutes: (mins: number) => void;

  // RBAC Actions
  login: (email: string, password?: string, roleName?: string) => boolean;
  register: (name: string, email: string, phone: string, password: string, roleId: string, department?: string) => boolean;
  logout: () => void;
  switchUser: (userId: string) => void;
  switchRole: (roleIdOrName: string) => void;
  hasPermission: (permission: PermissionKey) => boolean;
  hasModulePermission: (module: BillingModule, action: ModuleAction) => boolean;
  canApplyDiscount: (percent: number) => { allowed: boolean; maxAllowed: number; reason?: string };
  canApproveRefund: (amount: number) => { allowed: boolean; requiresApproval: boolean; reason?: string };
  canEditFinalizedBill: (billId?: string) => { allowed: boolean; policy: 'No' | 'Limited' | 'Approval' | 'Yes'; reason?: string };
  canCancelInvoice: (invoiceId?: string) => { allowed: boolean; policy: 'No' | 'Approval' | 'Restricted' | 'Yes'; reason?: string };
  isFinancialDataVisible: () => { purchaseCost: boolean; profitMargins: boolean; bankBalances: boolean };
  canOverrideStockLimit: () => boolean;
  canManageBarcodes: () => boolean;

  // Employee Actions
  addEmployee: (emp: Omit<Employee, 'id'>) => Employee;
  updateEmployee: (id: string, emp: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;

  // Role Actions
  createRole: (role: Omit<RoleDefinition, 'id' | 'isBuiltIn' | 'assignedUsersCount'>) => RoleDefinition;
  updateRole: (id: string, role: Partial<RoleDefinition>) => void;
  deleteRole: (id: string) => boolean;
  duplicateRole: (roleId: string, newName?: string) => RoleDefinition | null;
  archiveRole: (roleId: string) => boolean;
  removeAllFeaturesFromRole: (roleId: string) => void;
  grantAllFeaturesToRole: (roleId: string) => void;
  resetRolesToDefault: () => void;

  // User Administration
  toggleUserBlock: (userId: string) => void;
  approveUser: (userId: string) => void;
  inviteUser: (invite: Omit<UserInvitation, 'id' | 'invitedAt' | 'status' | 'inviteToken'>) => void;
  revokeInvitation: (invitationId: string) => void;
  recordAttendance: (employeeId: string, punchType: 'IN' | 'OUT', notes?: string) => void;
  recordActivity: (
    action: string,
    module: UserActivityLog['module'],
    details: string,
    extra?: {
      targetId?: string;
      targetType?: string;
      beforeState?: Record<string, any>;
      afterState?: Record<string, any>;
      outcome?: 'Success' | 'Denied' | 'Approved' | 'Flagged';
    }
  ) => void;
  terminateSession: (sessionId: string) => void;

  // Support Tickets
  supportTickets: SupportTicket[];
  addSupportTicket: (ticket: Omit<SupportTicket, 'id' | 'ticketNo' | 'createdAt' | 'updatedAt' | 'status'>) => SupportTicket;
  updateSupportTicket: (id: string, updates: Partial<SupportTicket>) => void;

  // Premium & Licensing
  subscription: PremiumSubscription;
  premiumOrders: PremiumOrder[];
  activateLicenseKey: (key: string) => { success: boolean; message: string };
  createPremiumOrder: (plan: 'Silver Desktop' | 'Gold Desktop + Mobile', paymentMethod: 'UPI' | 'Net Banking' | 'Debit/Credit Card') => PremiumOrder;

  // Auth & Employee Modals
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalTab: 'login' | 'register' | 'switch' | 'invitations';
  setAuthModalTab: (tab: 'login' | 'register' | 'switch' | 'invitations') => void;
  isAddEmployeeModalOpen: boolean;
  setIsAddEmployeeModalOpen: (open: boolean) => void;
  selectedEmployee: Employee | null;
  setSelectedEmployee: (emp: Employee | null) => void;
  isRoleEditorModalOpen: boolean;
  setIsRoleEditorModalOpen: (open: boolean) => void;
  selectedRole: RoleDefinition | null;
  setSelectedRole: (role: RoleDefinition | null) => void;
  isEmployeeDetailModalOpen: boolean;
  setIsEmployeeDetailModalOpen: (open: boolean) => void;

  // Notification Toast & Confirmation Modal
  toastMessage: string | null;
  toastNotice: ToastNotice | null;
  showToast: (
    msg: string,
    type?: ToastNotice['type'],
    undo?: { label: string; onUndo: () => void }
  ) => void;
  dismissToast: () => void;
  confirmDialog: ConfirmationDialogConfig | null;
  requestConfirmation: (config: ConfirmationDialogConfig) => void;
  closeConfirmation: () => void;

  // Customer & Staff Portal State
  portalStage: PortalStage;
  setPortalStage: (stage: PortalStage) => void;
  activeSessionType: AccountType | null;
  currentCustomer: Omit<CustomerAccount, 'passwordHash'> | null;
  customerAccounts: CustomerAccount[];
  staffTasks: StaffTask[];
  portalNotifications: PortalNotification[];
  customerActivity: CustomerActivityRecord[];
  supportMessages: SupportMessageRecord[];
  adminPortalSubTab: 'customer-accounts' | 'staff-accounts' | 'add-staff' | 'staff-permissions' | 'customer-activity' | 'login-history' | 'account-status';
  setAdminPortalSubTab: (tab: 'customer-accounts' | 'staff-accounts' | 'add-staff' | 'staff-permissions' | 'customer-activity' | 'login-history' | 'account-status') => void;

  // Customer & Staff Portal Authentication Actions
  loginCustomerWithEmail: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  requestCustomerMobileOtp: (
    phone: string,
    purpose: 'login' | 'register'
  ) => Promise<{ success: boolean; otpPreview?: string; message: string }>;
  verifyCustomerMobileOtpLogin: (
    phone: string,
    otp: string
  ) => Promise<{ success: boolean; message: string }>;
  registerCustomerAccount: (input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    otp?: string;
  }) => Promise<{ success: boolean; message: string }>;
  loginStaffOrAdmin: (identifier: string, password: string) => Promise<{ success: boolean; message: string }>;

  // Admin-Only Customer & Staff Management
  isAdminSession: () => boolean;
  adminCreateStaffAccount: (input: {
    staffId?: string;
    name: string;
    email: string;
    phone: string;
    password: string;
    roleId: string;
    department: Employee['department'];
    designation: string;
    salary?: number;
  }) => Promise<{ success: boolean; message: string; staffUser?: AppUser }>;
  adminToggleStaffStatus: (userId: string) => { success: boolean; message: string };
  adminResetStaffPassword: (userId: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  adminUpdateStaffRole: (userId: string, newRoleId: string) => { success: boolean; message: string };
  adminToggleCustomerStatus: (customerId: string, nextStatus: 'Active' | 'Inactive' | 'Suspended') => { success: boolean; message: string };
  adminResetCustomerPassword: (customerId: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  adminAssignStaffTask: (task: Omit<StaffTask, 'id' | 'createdAt' | 'assignedBy'>) => { success: boolean; message: string };

  // Customer Portal Scoped Actions
  updateCustomerProfile: (updates: { fullName?: string; phone?: string }) => boolean;
  addCustomerAddress: (addr: Omit<CustomerAddress, 'id'>) => boolean;
  deleteCustomerAddress: (addrId: string) => boolean;
  setDefaultCustomerAddress: (addrId: string) => boolean;
  payCustomerPendingInvoice: (invoiceId: string, method: 'UPI' | 'Bank Transfer' | 'Cash') => boolean;
  submitCustomerSupportMessage: (subject: string, message: string) => boolean;
  markPortalNotificationRead: (notifId: string) => void;
  placeCustomerOnlineOrder: (orderInput: {
    items: {
      id: string;
      name: string;
      hsn: string;
      qty: number;
      unit: string;
      price: number;
      taxPercent: number;
      linkedItemId?: string;
    }[];
    subtotal: number;
    discount: number;
    deliveryFee: number;
    taxAmount: number;
    totalAmount: number;
    paymentMethod: 'UPI' | 'Cash' | 'Credit' | 'Bank Transfer';
    isPaid: boolean;
    deliveryAddressSummary: string;
    deliveryPincode?: string;
    hubName: string;
    promoCode?: string;
    msCreditToUse?: number;
    paymentRef?: string;
    notes?: string;
  }) => { success: boolean; transaction?: Transaction; message: string };

  // Unified Store + Billing + MS Credit + Coupon + Delivery OTP Workflow
  coupons: BillingCoupon[];
  msCreditTransactions: MSCreditTransaction[];
  stockHistory: StockTransactionRecord[];
  payments: PaymentRecord[];
  returnRequests: ReturnRefundRequest[];
  serviceAreaConfig: StoreServiceAreaConfig;
  validateCouponForCustomer: (
    code: string,
    cartSubtotal: number,
    cartCategories?: string[],
    customerId?: string
  ) => { valid: boolean; coupon?: BillingCoupon; discountAmount: number; message: string };
  validateDeliveryPincode: (pincode: string) => {
    serviceable: boolean;
    deliveryFee: number;
    outskirtFee: number;
    message: string;
  };
  approveOnlineOrder: (orderId: string) => { success: boolean; message: string };
  packOnlineOrder: (orderId: string, customBagId?: string) => { success: boolean; bagId?: string; message: string };
  assignDeliveryBoyToOrder: (
    orderId: string,
    staffId?: string,
    staffName?: string,
    staffPhone?: string
  ) => { success: boolean; otp?: string; message: string };
  verifyDeliveryOtpAndCompleteOrder: (
    orderId: string,
    enteredOtp: string,
    codCollected?: boolean
  ) => { success: boolean; invoice?: Transaction; msCreditEarned?: number; message: string };
  cancelCustomerOnlineOrder: (orderId: string, reason: string) => { success: boolean; message: string };
  submitCustomerReturnRequest: (
    orderId: string,
    reason: string,
    selectedItems?: { itemId?: string; name: string; qty: number; amount: number }[]
  ) => { success: boolean; request?: ReturnRefundRequest; message: string };
  processReturnRefundRequest: (
    returnId: string,
    decision: 'Approved' | 'Rejected'
  ) => { success: boolean; message: string };
  resetCustomerPassword: (
    email: string,
    phone: string,
    newPassword: string
  ) => Promise<{ success: boolean; message: string }>;
  saveBillingCoupon: (coupon: Omit<BillingCoupon, 'id' | 'usedCount' | 'usedByCustomerIds' | 'createdBy'>) => { success: boolean; message: string };
  toggleBillingCouponStatus: (couponId: string) => { success: boolean; message: string };
  updateServiceAreaConfig: (updates: Partial<StoreServiceAreaConfig>) => { success: boolean; message: string };

  // Staff Portal Task Actions
  toggleStaffTaskStatus: (taskId: string, nextStatus: StaffTask['status']) => void;

  // Seller, Online Store Manager & Delivery Portal Shared Actions
  updateProductPricing: (
    itemId: string,
    updates: { salePrice?: number; wholesalePrice?: number; minWholesaleQty?: number; stock?: number }
  ) => boolean;
  replyToCustomerSupport: (messageId: string, replyText: string) => Promise<{ success: boolean; message: string }>;
  rejectOnlineOrder: (orderId: string, reason: string) => { success: boolean; message: string };
  markOrderReadyForDispatch: (orderId: string, bagId?: string) => { success: boolean; message: string };
  updateDeliveryBoyAvailability: (status: 'Available' | 'On Break' | 'Offline', targetUserId?: string) => void;
  markDeliveryOutcome: (orderId: string, outcome: 'Cancelled' | 'Returned', reason: string) => { success: boolean; message: string };
  adminUpdateUserConfig: (
    userId: string,
    updates: { sellerType?: SellerType; onlineInventoryAccess?: boolean; deliveryAvailability?: 'Available' | 'On Break' | 'Offline' }
  ) => { success: boolean; message: string };

  // Deep ERP Modules (Theme, Dashboard Customization, Double-Entry Accounting, Batches, Serials, Variants, Price History, Recurring, Recycle Bin, Bulk Import)
  themePreference: ThemePreference;
  setThemePreference: (theme: ThemePreference) => void;
  dashboardCards: DashboardCardPref[];
  setDashboardCards: React.Dispatch<React.SetStateAction<DashboardCardPref[]>>;
  accounts: AccountRecord[];
  journalVouchers: JournalVoucher[];
  addAccount: (acc: Omit<AccountRecord, 'id'>) => AccountRecord;
  updateAccount: (id: string, updates: Partial<AccountRecord>) => void;
  createJournalVoucher: (input: Omit<JournalVoucher, 'id' | 'createdAt' | 'createdBy'>) => { success: boolean; message: string; voucher?: JournalVoucher };
  executeContraVoucher: (direction: 'CASH_TO_BANK' | 'BANK_TO_CASH', amount: number, ref?: string) => { success: boolean; message: string };
  batches: ItemBatch[];
  addBatch: (batch: Omit<ItemBatch, 'id'>) => ItemBatch;
  upsertItemBatches: (
    itemId: string,
    itemName: string,
    rows: Array<{
      batchNumber: string;
      mfgDate: string;
      expiryDate: string;
      qty: number;
      purchaseRate: number;
      saleRate: number;
      warehouseId?: string;
    }>
  ) => void;
  variants: ItemVariant[];
  addVariant: (variant: Omit<ItemVariant, 'id'>) => ItemVariant;
  serialNumbers: SerialNumberRecord[];
  addSerialNumber: (serial: Omit<SerialNumberRecord, 'id'>) => SerialNumberRecord;
  updateSerialStatus: (id: string, status: SerialNumberRecord['status'], customerName?: string) => void;
  recordGodownTransferStock: (payload: {
    itemId: string;
    fromGodownId: string;
    toGodownId: string;
    quantity: number;
    transferNo: string;
  }) => void;
  allocatePaymentToInvoices: (payload: {
    direction: 'IN' | 'OUT';
    partyName: string;
    partyPhone?: string;
    paymentType: Transaction['paymentType'];
    extendedPaymentMode?: ExtendedPaymentMode;
    splitPayments?: SplitPaymentPart[];
    totalAmount: number;
    writeOffAmount?: number;
    refNo?: string;
    notes?: string;
    tags?: string[];
    customFields?: Record<string, string>;
    attachments?: Transaction['attachments'];
    allocations: { invoiceId: string; amount: number }[];
  }) => Transaction | null;
  priceHistory: PriceHistoryEntry[];
  recurringTemplates: RecurringTemplate[];
  addRecurringTemplate: (tpl: Omit<RecurringTemplate, 'id'>) => RecurringTemplate;
  toggleRecurringTemplate: (id: string) => void;
  deleteRecurringTemplate: (id: string) => void;
  runDueRecurringTransactions: () => number;
  recycleBin: RecycleBinRecord[];
  movePartyToRecycleBin: (partyId: string) => boolean;
  moveItemToRecycleBin: (itemId: string) => boolean;
  restoreFromRecycleBin: (recordId: string) => boolean;
  permanentlyDeleteFromRecycleBin: (recordId: string) => void;
  emptyRecycleBin: () => void;
  addBulkImportRecords: (
    target: 'customers' | 'suppliers' | 'items',
    records: any[]
  ) => { imported: number; skipped: number };

  // 5-Module Integrated ERP Extensions
  purchaseScans: PurchaseScanRecord[];
  savePurchaseScanDraft: (scan: PurchaseScanRecord) => Promise<void>;
  confirmPurchaseScan: (
    scan: PurchaseScanRecord,
    options?: { allowDuplicate?: boolean; paymentType?: Transaction['paymentType']; paidAmount?: number }
  ) => Promise<{ success: boolean; message: string; purchaseTx?: Transaction; duplicateWarning?: string }>;
  customHsnEntries: HsnMasterEntry[];
  gstAudits: GstClassificationAudit[];
  addCustomHsnEntry: (entry: HsnMasterEntry) => Promise<{ success: boolean; message: string }>;
  bulkUpdateItemGst: (
    updates: Array<{
      itemId: string;
      hsnCode?: string;
      sacCode?: string;
      taxRate: number;
      taxCategory?: Item['taxCategory'];
      unit?: string;
      effectiveDate?: string;
      taxClassificationVerified?: boolean;
    }>,
    actionType?: GstClassificationAudit['action'],
    summary?: string
  ) => Promise<number>;
  createDeliveryChallan: (payload: {
    partyName: string;
    partyPhone?: string;
    partyGstin?: string;
    billingAddress?: string;
    shippingAddress?: string;
    challanPurpose: Transaction['challanPurpose'];
    expectedDeliveryDate?: string;
    vehicleNumber?: string;
    transporterName?: string;
    deliveryPerson?: string;
    dispatchLocation?: string;
    deliveryLocation?: string;
    showPricesOnChallan?: boolean;
    dispatchImmediately?: boolean;
    items: InvoiceItem[];
    notes?: string;
  }) => Transaction | null;
  updateChallanStatus: (
    challanId: string,
    nextStatus: NonNullable<Transaction['challanStatus']>
  ) => { success: boolean; message: string };
  recordChallanReturn: (
    challanId: string,
    returnLines: Array<{ name: string; acceptedQty: number; damagedQty: number }>,
    notes?: string
  ) => { success: boolean; message: string };
  createOrUpdateQuotation: (payload: {
    existingId?: string;
    type?: 'Estimate' | 'Proforma';
    partyName: string;
    partyPhone?: string;
    partyEmail?: string;
    partyGstin?: string;
    billingAddress?: string;
    shippingAddress?: string;
    dueDate: string;
    referenceNo?: string;
    salesperson?: string;
    shippingCharges?: number;
    otherCharges?: number;
    overallDiscount?: number;
    termsAndConditions?: string;
    notes?: string;
    items: InvoiceItem[];
    quotationStatus?: QuotationStatus;
  }) => Transaction | null;
  convertQuotationToSalesOrder: (quotationId: string) => Transaction | null;
  duplicateQuotation: (quotationId: string) => Transaction | null;
  syncSharedQuotationResponse: (quotationId: string, updatedQuotation: Partial<Transaction>) => void;
  eInvoiceRecords: EInvoiceRecord[];
  eInvoiceLogs: EInvoiceApiLog[];
  eWayBillRecords: EWayBillRecord[];
  refreshEInvoiceData: () => Promise<void>;
  createPreMigrationBackup: (label?: string) => Promise<{ success: boolean; backupId?: string; message: string }>;
  restoreBackupCheckpoint: (backupId: string) => Promise<{ success: boolean; message: string }>;

  // Complete Settings Module & Role-Based Settings Access
  businessSettings: BusinessSettingsBundle;
  partyGroups: PartyGroup[];
  serviceReminders: ServiceReminderRecord[];
  settingsAuditLogs: SettingsAuditEntry[];
  paymentReminderLogs: PaymentReminderLog[];
  activeSettingsCategory: SettingsCategoryId;
  setActiveSettingsCategory: (cat: SettingsCategoryId) => void;
  canViewSettingsCategory: (cat: SettingsCategoryId, overrideRoleName?: string) => boolean;
  canEditSettingsCategory: (cat: SettingsCategoryId, overrideRoleName?: string) => boolean;
  updateBusinessSettingsSection: <K extends keyof BusinessSettingsBundle>(
    category: SettingsCategoryId,
    sectionKey: K,
    updates: Partial<BusinessSettingsBundle[K]> | BusinessSettingsBundle[K],
    reason?: string
  ) => Promise<{ success: boolean; message: string }>;
  updateRoleSettingsAccessRule: (
    roleName: string,
    rule: RoleSettingsAccessRule
  ) => Promise<{ success: boolean; message: string }>;
  resetBusinessSettingsSection: (category?: SettingsCategoryId) => Promise<{ success: boolean; message: string }>;
  addPartyGroup: (group: Omit<PartyGroup, 'id' | 'createdAt'>) => PartyGroup;
  updatePartyGroup: (id: string, updates: Partial<PartyGroup>) => void;
  deletePartyGroup: (id: string) => { success: boolean; message: string };
  addServiceReminder: (rem: Omit<ServiceReminderRecord, 'id' | 'createdAt'>) => ServiceReminderRecord;
  updateServiceReminder: (id: string, updates: Partial<ServiceReminderRecord>) => void;
  deleteServiceReminder: (id: string) => void;
  logPaymentReminderSent: (entry: Omit<PaymentReminderLog, 'id' | 'sentAt' | 'sentBy'>) => PaymentReminderLog;
  getNextDocumentNumber: (
    docType: SequenceDocumentType,
    options?: { branchCode?: string; warehouseCode?: string }
  ) => string;

  // Advanced P&L Engine: Discount Approvals, Period Locking & Admin Price Updates
  discountApprovals: DiscountApprovalRecord[];
  logDiscountApproval: (entry: Omit<DiscountApprovalRecord, 'id' | 'timestamp'>) => DiscountApprovalRecord;
  verifyAdminApprovalPin: (pin: string) => boolean;
  lockFinancialPeriod: (label: string, startDate: string, endDate: string) => Promise<{ success: boolean; message: string }>;
  unlockFinancialPeriod: (periodId: string) => Promise<{ success: boolean; message: string }>;
  applyRecommendedItemPrice: (
    itemId: string,
    newSalePrice: number,
    reason?: string
  ) => { success: boolean; message: string };

  // 5001-5400 Enterprise Transaction, Billing, Payment & Purchase Engines
  transactionTemplates: TransactionTemplate[];
  addTransactionTemplate: (tpl: Omit<TransactionTemplate, 'id' | 'createdAt' | 'createdBy'>) => TransactionTemplate;
  deleteTransactionTemplate: (id: string) => void;
  recurringExecutionLogs: RecurringExecutionLog[];
  retryRecurringExecution: (logId: string) => boolean;
  transitionTransactionStatus: (
    txId: string,
    nextStatus: TransactionWorkflowStatus,
    reason?: string
  ) => { success: boolean; message: string };
  cloneTransaction: (txId: string) => Transaction | null;
  reverseTransaction: (txId: string, reason: string) => Transaction | null;
  restoreTransactionVersion: (txId: string, versionNumber: number) => { success: boolean; message: string };
  logTransactionActivity: (
    txId: string,
    action: TransactionActivityEntry['action'],
    details: string
  ) => void;
  bulkUpdateTransactions: (
    txIds: string[],
    patch: {
      workflowStatus?: TransactionWorkflowStatus;
      addTag?: string;
      cancelReason?: string;
    }
  ) => number;
  splitInvoice: (txId: string, splitRatioPercent?: number) => [Transaction, Transaction] | null;
  consolidateTransactionsToInvoice: (sourceTxIds: string[]) => Transaction | null;
  updateSequenceConfig: (docType: SequenceDocumentType, patch: Partial<InvoiceNumberSequenceConfig>) => void;
  paymentLimits: PaymentLimitsConfig;
  setPaymentLimits: React.Dispatch<React.SetStateAction<PaymentLimitsConfig>>;
  reconcilePaymentTransaction: (txId: string, reconciledRef?: string) => void;
  recordPaymentRefund: (payload: {
    direction: 'IN_REFUND' | 'OUT_REFUND';
    partyName: string;
    amount: number;
    mode: ExtendedPaymentMode;
    refNo?: string;
    reason?: string;
  }) => Transaction | null;
  supplierQuotations: SupplierQuotation[];
  addSupplierQuotation: (q: Omit<SupplierQuotation, 'id' | 'createdAt'>) => SupplierQuotation;
  updateSupplierQuotationStatus: (id: string, status: SupplierQuotation['status']) => void;
  supplierItemMappings: SupplierItemMapping[];
  upsertSupplierItemMapping: (m: Omit<SupplierItemMapping, 'id' | 'updatedAt'>) => SupplierItemMapping;
  recordPoGrnReceipt: (
    poId: string,
    lines: Array<{ name: string; qtyReceived: number; batchNo?: string; expiryDate?: string }>,
    convertToBillNow?: boolean
  ) => { success: boolean; message: string; billTx?: Transaction };
}

const VyaparContext = createContext<VyaparContextType | undefined>(undefined);

const INITIAL_COMPANY: CompanyProfile = {
  name: 'MY STORE',
  phone: '+91 98765 43210',
  email: 'contact@mystore.local',
  address: 'No. 42, Commercial Avenue, Main Market, Bengaluru, Karnataka - 560001',
  gstin: '29ABCDE1234F1Z5',
  state: 'Karnataka (29)',
  bankName: 'HDFC Bank Ltd',
  accountNo: '50200012345678',
  ifsc: 'HDFC0000123',
  upiId: 'mystore@upi',
};

const INITIAL_SETTINGS: AppSettings = {
  invoicePrefix: 'MS-INV-',
  nextInvoiceNumber: 1,
  invoicePadding: 4,
  invoiceSuffix: '',
  defaultTaxRate: 18,
  enableGst: true,
  enableThermalPrint: false,
  defaultInvoiceTemplate: 'gst-tax-invoice',
  enableRoundOff: true,
  enableCreditLimitWarning: true,
  currencySymbol: '₹',
  themeColor: '#059669',
};

const INITIAL_PARTIES: Party[] = [
  {
    id: 'p-1',
    name: 'Cash Sale',
    phone: '',
    email: '',
    type: 'Customer',
    balance: 0.0,
    gstin: '',
    address: 'Counter Cash Sale',
    state: 'Karnataka (29)',
    creditLimit: 0,
    creditPeriodDays: 0,
  },
  {
    id: 'p-2',
    name: 'CGBVCXVHV',
    phone: '9845112233',
    email: 'cgbvcxv@business.in',
    type: 'Customer',
    balance: 1000.0,
    gstin: '29ABCDE1234F1Z5',
    address: 'Main Road Market, Bengaluru',
    state: 'Karnataka (29)',
    creditLimit: 50000,
    creditPeriodDays: 30,
  },
  {
    id: 'p-3',
    name: 'Hindustan Unilever Distributor',
    phone: '9888877665',
    email: 'hul.distrib@fmcg.in',
    type: 'Supplier',
    balance: 24500.0,
    gstin: '29AABCH2019K1Z2',
    address: 'Peenya Industrial Estate, Bengaluru',
    state: 'Karnataka (29)',
    creditLimit: 100000,
    creditPeriodDays: 45,
  },
  {
    id: 'p-4',
    name: 'Mumbai Tech Solutions Ltd',
    phone: '9822334455',
    email: 'contact@mumbaitech.in',
    type: 'Customer',
    balance: 4500.0,
    gstin: '27AABCM8899P1Z3',
    address: 'Bandra Kurla Complex, Mumbai',
    state: 'Maharashtra (27)',
    creditLimit: 60000,
    creditPeriodDays: 15,
  },
];

const INITIAL_ITEMS: Item[] = [
  {
    id: 'i-1',
    name: 'Sample Item',
    code: 'SMPL-01',
    category: 'General',
    salePrice: 100.0,
    purchasePrice: 0.0,
    stock: 25,
    unit: 'PCS',
    taxRate: 18,
  },
  {
    id: 'i-2',
    name: 'Surf Excel Blue Detergent Powder 1kg',
    code: 'SURF-1K',
    category: 'FMCG',
    salePrice: 130.0,
    purchasePrice: 110.0,
    stock: 50,
    unit: 'PKT',
    taxRate: 18,
  },
  {
    id: 'i-3',
    name: 'Surf Excel Blue Detergent Powder 2kg',
    code: 'SURF-2K',
    category: 'FMCG',
    salePrice: 250.0,
    purchasePrice: 210.0,
    stock: 30,
    unit: 'PKT',
    taxRate: 18,
  },
  {
    id: 'i-4',
    name: 'Surf Excel Blue Detergent Powder 5kg',
    code: 'SURF-5K',
    category: 'FMCG',
    salePrice: 600.0,
    purchasePrice: 510.0,
    stock: 40,
    unit: 'PKT',
    taxRate: 18,
  },
  {
    id: 'i-5',
    name: 'Surf Excel Blue Easy Wash Powder 1kg',
    code: 'EW-1K',
    category: 'FMCG',
    salePrice: 140.0,
    purchasePrice: 115.0,
    stock: 20,
    unit: 'PKT',
    taxRate: 18,
  },
  {
    id: 'i-6',
    name: 'Surf Excel Blue Easy Wash Powder 2kg',
    code: 'EW-2K',
    category: 'FMCG',
    salePrice: 270.0,
    purchasePrice: 220.0,
    stock: 20,
    unit: 'PKT',
    taxRate: 18,
  },
  {
    id: 'i-7',
    name: 'Surf Excel Combo',
    code: 'CMB-01',
    category: 'Combo Pack',
    salePrice: 500.0,
    purchasePrice: 420.0,
    stock: 20,
    unit: 'BOX',
    taxRate: 18,
  },
  ...STORE_UNIFIED_ITEMS,
];

function mergeUnifiedStoreItems(existingItems: Item[]): Item[] {
  const existingIds = new Set(existingItems.map((it) => it.id));
  const missing = STORE_UNIFIED_ITEMS.filter((st) => !existingIds.has(st.id));
  const normalizedExisting = existingItems.map((it) => ({
    ...it,
    reservedStock: it.reservedStock ?? 0,
  }));
  const combined = missing.length > 0 ? [...normalizedExisting, ...missing] : normalizedExisting;
  return ensureItemsHaveUniqueBarcodes(combined);
}

const DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-201',
    type: 'Sale',
    invoiceNo: '1',
    date: '22/09/2026, 05:56 PM',
    partyName: 'CGBVCXVHV',
    partyPhone: '9845112233',
    partyAddress: 'Main Road Market, Bengaluru',
    partyGstin: '29ABCDE1234F1Z5',
    firm: 'Krishna Enterprises',
    user: 'Krishna Murthy (Owner)',
    paymentType: 'Credit',
    subtotal: 1000.0,
    totalDiscount: 0,
    taxableAmount: 1000.0,
    stateOfSupply: 'Karnataka (29)',
    gstType: 'Intra-State',
    cgstAmount: 90.0,
    sgstAmount: 90.0,
    igstAmount: 0.0,
    roundOff: 0.0,
    totalAmount: 1180.0,
    receivedAmount: 0.0,
    balance: 1180.0,
    dueDate: '22/10/2026',
    status: 'Unpaid',
    createdAt: '2026-09-22T17:56:00Z',
    items: [
      {
        id: 'li-201',
        name: 'Sample Item',
        hsn: 'SMPL-01',
        qty: 10,
        unit: 'PCS',
        price: 100.0,
        discountPercent: 0,
        taxPercent: 18,
        amount: 1180.0,
      },
    ],
    notes: 'Credit sale invoice with intra-state GST (9% CGST + 9% SGST)',
  },
  {
    id: 'tx-202',
    type: 'Sale',
    invoiceNo: '2',
    date: '22/09/2026, 05:56 PM',
    partyName: 'Cash Sale',
    partyPhone: '',
    partyAddress: 'Counter Cash Sale',
    firm: 'Krishna Enterprises',
    user: 'Sunil Kumar (Cashier)',
    paymentType: 'Cash',
    subtotal: 260.0,
    totalDiscount: 0,
    taxableAmount: 260.0,
    stateOfSupply: 'Karnataka (29)',
    gstType: 'Intra-State',
    cgstAmount: 0.0,
    sgstAmount: 0.0,
    igstAmount: 0.0,
    roundOff: 0.0,
    totalAmount: 260.0,
    receivedAmount: 260.0,
    balance: 0.0,
    dueDate: '22/09/2026',
    status: 'Paid',
    createdAt: '2026-09-22T17:56:00Z',
    items: [
      {
        id: 'li-202',
        name: 'Surf Excel Blue Detergent Powder 1kg',
        hsn: 'SURF-1K',
        qty: 2,
        unit: 'PKT',
        price: 130.0,
        discountPercent: 0,
        taxPercent: 0,
        amount: 260.0,
      },
    ],
    notes: 'Counter retail sale',
  },
  {
    id: 'tx-203',
    type: 'Sale',
    invoiceNo: '3',
    date: '24/09/2026, 11:30 AM',
    partyName: 'Mumbai Tech Solutions Ltd',
    partyPhone: '9822334455',
    partyAddress: 'Bandra Kurla Complex, Mumbai',
    partyGstin: '27AABCM8899P1Z3',
    firm: 'Krishna Enterprises',
    user: 'Krishna Murthy (Owner)',
    paymentType: 'Credit',
    subtotal: 3000.0,
    totalDiscount: 0,
    taxableAmount: 3000.0,
    stateOfSupply: 'Maharashtra (27)',
    gstType: 'Inter-State',
    cgstAmount: 0.0,
    sgstAmount: 0.0,
    igstAmount: 540.0,
    roundOff: 0.0,
    totalAmount: 3540.0,
    receivedAmount: 1000.0,
    balance: 2540.0,
    dueDate: '24/10/2026',
    status: 'Partial',
    createdAt: '2026-09-24T11:30:00Z',
    items: [
      {
        id: 'li-203',
        name: 'Surf Excel Blue Detergent Powder 5kg',
        hsn: 'SURF-5K',
        qty: 5,
        unit: 'PKT',
        price: 600.0,
        discountPercent: 0,
        taxPercent: 18,
        amount: 3540.0,
      },
    ],
    notes: 'Inter-state transaction with 18% Integrated GST (IGST)',
  },
  {
    id: 'tx-204',
    type: 'Estimate',
    invoiceNo: 'EST-101',
    date: '25/09/2026, 02:15 PM',
    partyName: 'CGBVCXVHV',
    partyPhone: '9845112233',
    partyAddress: 'Main Road Market, Bengaluru',
    partyGstin: '29ABCDE1234F1Z5',
    firm: 'Krishna Enterprises',
    user: 'Pooja Hegde (Sales Lead)',
    paymentType: 'Credit',
    subtotal: 2500.0,
    totalDiscount: 100.0,
    taxableAmount: 2400.0,
    stateOfSupply: 'Karnataka (29)',
    gstType: 'Intra-State',
    cgstAmount: 216.0,
    sgstAmount: 216.0,
    igstAmount: 0.0,
    roundOff: 0.0,
    totalAmount: 2832.0,
    receivedAmount: 0.0,
    balance: 2832.0,
    dueDate: '10/10/2026',
    status: 'Unpaid',
    fulfillmentStatus: 'Pending',
    createdAt: '2026-09-25T14:15:00Z',
    items: [
      {
        id: 'li-204',
        name: 'Surf Excel Combo',
        hsn: 'CMB-01',
        qty: 5,
        unit: 'BOX',
        price: 500.0,
        discountPercent: 4,
        taxPercent: 18,
        amount: 2832.0,
      },
    ],
    notes: 'Valid for 15 days. Subject to stock availability.',
  },
  {
    id: 'tx-205',
    type: 'Sale Order',
    invoiceNo: 'SO-101',
    date: '26/09/2026, 04:00 PM',
    partyName: 'CGBVCXVHV',
    partyPhone: '9845112233',
    partyAddress: 'Main Road Market, Bengaluru',
    partyGstin: '29ABCDE1234F1Z5',
    firm: 'Krishna Enterprises',
    user: 'Pooja Hegde (Sales Lead)',
    paymentType: 'Credit',
    subtotal: 1200.0,
    totalDiscount: 0,
    taxableAmount: 1200.0,
    stateOfSupply: 'Karnataka (29)',
    gstType: 'Intra-State',
    cgstAmount: 108.0,
    sgstAmount: 108.0,
    igstAmount: 0.0,
    roundOff: 0.0,
    totalAmount: 1416.0,
    receivedAmount: 500.0,
    balance: 916.0,
    dueDate: '05/10/2026',
    status: 'Partial',
    fulfillmentStatus: 'Pending',
    createdAt: '2026-09-26T16:00:00Z',
    items: [
      {
        id: 'li-205',
        name: 'Surf Excel Blue Detergent Powder 5kg',
        hsn: 'SURF-5K',
        qty: 2,
        unit: 'PKT',
        price: 600.0,
        discountPercent: 0,
        taxPercent: 18,
        amount: 1416.0,
      },
    ],
    notes: 'Advance of ₹500 received via UPI. Balance on delivery.',
  },
  {
    id: 'tx-206',
    type: 'Delivery Challan',
    invoiceNo: 'DC-101',
    date: '27/09/2026, 10:45 AM',
    partyName: 'CGBVCXVHV',
    partyPhone: '9845112233',
    partyAddress: 'Main Road Market, Bengaluru',
    firm: 'Krishna Enterprises',
    user: 'Vikas Sharma (Logistics Officer)',
    paymentType: 'Credit',
    subtotal: 1200.0,
    totalDiscount: 0,
    taxableAmount: 1200.0,
    totalAmount: 1416.0,
    receivedAmount: 0,
    balance: 1416.0,
    dueDate: '27/09/2026',
    status: 'Unpaid',
    vehicleNumber: 'KA-01-ME-8842',
    fulfillmentStatus: 'Pending',
    createdAt: '2026-09-27T10:45:00Z',
    items: [
      {
        id: 'li-206',
        name: 'Surf Excel Blue Detergent Powder 5kg',
        hsn: 'SURF-5K',
        qty: 2,
        unit: 'PKT',
        price: 600.0,
        discountPercent: 0,
        taxPercent: 18,
        amount: 1416.0,
      },
    ],
    notes: 'Dispatched via Tata Ace delivery vehicle.',
  },
  {
    id: 'tx-207',
    type: 'Sale Return',
    invoiceNo: 'CN-101',
    date: '28/09/2026, 03:20 PM',
    partyName: 'CGBVCXVHV',
    partyPhone: '9845112233',
    partyAddress: 'Main Road Market, Bengaluru',
    partyGstin: '29ABCDE1234F1Z5',
    firm: 'Krishna Enterprises',
    user: 'Krishna Murthy (Owner)',
    paymentType: 'Credit',
    subtotal: 100.0,
    totalDiscount: 0,
    taxableAmount: 100.0,
    stateOfSupply: 'Karnataka (29)',
    gstType: 'Intra-State',
    cgstAmount: 9.0,
    sgstAmount: 9.0,
    igstAmount: 0.0,
    roundOff: 0.0,
    totalAmount: 118.0,
    receivedAmount: 0,
    balance: 0,
    dueDate: '28/09/2026',
    status: 'Paid',
    originalInvoiceNo: '1',
    returnReason: 'Minor packaging defect reported by store customer.',
    createdAt: '2026-09-28T15:20:00Z',
    items: [
      {
        id: 'li-207',
        name: 'Sample Item',
        hsn: 'SMPL-01',
        qty: 1,
        unit: 'PCS',
        price: 100.0,
        discountPercent: 0,
        taxPercent: 18,
        amount: 118.0,
      },
    ],
    notes: 'Credit note issued against Tax Invoice #1.',
  },
  {
    id: 'tx-208',
    type: 'Payment-In',
    invoiceNo: 'PAY-101',
    date: '29/09/2026, 01:10 PM',
    partyName: 'CGBVCXVHV',
    partyPhone: '9845112233',
    partyAddress: 'Main Road Market, Bengaluru',
    firm: 'Krishna Enterprises',
    user: 'Sunil Kumar (Cashier)',
    paymentType: 'UPI',
    totalAmount: 500.0,
    receivedAmount: 500.0,
    balance: 0,
    dueDate: '29/09/2026',
    status: 'Paid',
    createdAt: '2026-09-29T13:10:00Z',
    items: [],
    notes: 'Payment received via Google Pay UPI. Allocated to Invoice #1.',
    allocatedPayments: [
      {
        paymentId: 'tx-208',
        receiptNo: 'PAY-101',
        amount: 500.0,
        date: '29/09/2026',
      },
    ],
  },
];

export const VyaparProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation & View (persisted in session & online workspace)
  const [activeTab, setActiveTab] = useState<string>('sale-invoices');
  const [activeSaleSubtype, setActiveSaleSubtype] = useState<string>('Sale Invoices');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    safeGetStoredData<boolean>('bm360_sidebar_collapsed', false, (v) => typeof v === 'boolean')
  );
  const [expandedSidebarGroups, setExpandedSidebarGroups] = useState<Record<string, boolean>>(() =>
    safeGetStoredData<Record<string, boolean>>(
      'bm360_sidebar_groups',
      DEFAULT_SIDEBAR_GROUPS,
      (v) => Boolean(v && typeof v === 'object')
    )
  );
  const [isDbHydrated, setIsDbHydrated] = useState<boolean>(false);
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [serverSyncStatus, setServerSyncStatus] = useState<'online' | 'syncing' | 'reconnecting'>('online');
  const [lastServerSyncAt, setLastServerSyncAt] = useState<string | null>(null);

  const toggleSidebarGroup = (groupTitle: string) => {
    setExpandedSidebarGroups((prev) => ({
      ...prev,
      [groupTitle]: !(prev[groupTitle] ?? true),
    }));
  };

  const setAllSidebarGroups = (expanded: boolean) => {
    const next: Record<string, boolean> = {};
    Object.keys(DEFAULT_SIDEBAR_GROUPS).forEach((key) => {
      next[key] = expanded;
    });
    setExpandedSidebarGroups(next);
  };

  // Selected party and item for split views
  const [selectedPartyId, setSelectedPartyId] = useState<string>('p-1');
  const [selectedItemId, setSelectedItemId] = useState<string>('i-1');

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterPeriod, setFilterPeriod] = useState<string>('This Month');
  const [filterStartDate, setFilterStartDate] = useState<string>('01/10/2026');
  const [filterEndDate, setFilterEndDate] = useState<string>('31/10/2026');
  const [filterFirm, setFilterFirm] = useState<string>('All Firms');
  const [filterUser, setFilterUser] = useState<string>('All Users');

  // Modals
  const [isAddSaleOpen, setIsAddSaleOpen] = useState<boolean>(false);
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Transaction | null>(null);
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState<boolean>(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [isVersionsModalOpen, setIsVersionsModalOpen] = useState<boolean>(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState<boolean>(false);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState<boolean>(false);
  const [isMyStoreModalOpen, setIsMyStoreModalOpen] = useState<boolean>(false);
  const [isAddPartyModalOpen, setIsAddPartyModalOpen] = useState<boolean>(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [prefilledBarcodeForNewItem, setPrefilledBarcodeForNewItem] = useState<string>('');
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState<boolean>(false);
  const [barcodeScannerMode, setBarcodeScannerMode] = useState<BarcodeScannerMode>('billing');
  const barcodeScanCallbackRef = React.useRef<((item: Item | null, rawCode: string) => void) | null>(null);
  const [recentScannedBarcodes, setRecentScannedBarcodes] = useState<RecentScanEntry[]>(() =>
    safeGetStoredData<RecentScanEntry[]>('bm360_recent_scans', [], Array.isArray)
  );
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState<boolean>(false);

  const openBarcodeScanner = (
    mode: BarcodeScannerMode = 'billing',
    onScan?: (item: Item | null, rawCode: string) => void
  ) => {
    barcodeScanCallbackRef.current = onScan || null;
    setBarcodeScannerMode(mode);
    setIsBarcodeScannerOpen(true);
  };

  const triggerBarcodeScannedCallback = (item: Item | null, rawCode: string) => {
    if (barcodeScanCallbackRef.current) {
      barcodeScanCallbackRef.current(item, rawCode);
    }
  };

  const recordScannedBarcode = (rawCode: string, item?: Item | null) => {
    const entry: RecentScanEntry = {
      id: generateUniqueId('scn'),
      code: rawCode,
      itemId: item?.id,
      itemName: item?.name,
      price: item?.salePrice,
      stock: item?.stock,
      found: Boolean(item),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setRecentScannedBarcodes((prev) => {
      const next = [entry, ...prev].slice(0, 15);
      safeSetStoredData('bm360_recent_scans', next);
      return next;
    });
  };

  const clearRecentScans = () => {
    setRecentScannedBarcodes([]);
    safeSetStoredData('bm360_recent_scans', []);
  };
  const [isAccessRestrictedOpen, setIsAccessRestrictedOpen] = useState<boolean>(false);
  const [restrictedFeatureName, setRestrictedFeatureName] = useState<string>('');

  const canAccessFeature = (featureKey: string): boolean => {
    if (!currentUser) return false;
    if (
      currentUser.roleName === 'Owner' ||
      currentUser.roleName === 'Admin' ||
      currentUser.roleName === 'Administrator'
    ) {
      return true;
    }

    const role = getActiveRole();
    if (!role) return false;
    if (role.type === 'Owner' || role.type === 'Admin') return true;
    if (featureKey === 'dashboard' || featureKey === 'home') return true;

    const rName = role.name.toLowerCase();
    if (role.type === 'Delivery' || rName.includes('delivery')) {
      return ['dashboard', 'home', 'customers', 'delivery-challan'].includes(featureKey);
    }

    switch (featureKey) {
      case 'billing':
      case 'billing-invoices':
      case 'sale-invoices':
      case 'pos':
      case 'vyapar-pos':
      case 'estimate-quotation':
      case 'proforma-invoice':
      case 'sale-order':
      case 'credit-note':
      case 'sale-return':
      case 'sale-fa':
        return hasModulePermission('sales_pos', 'view');

      case 'delivery-challan':
        return hasModulePermission('sales_pos', 'view');

      case 'purchases':
      case 'purchase':
      case 'purchase-bills':
      case 'purchase-scanner':
      case 'purchase-order':
      case 'debit-note':
      case 'purchase-return':
        return hasModulePermission('purchase_expenses', 'view');

      case 'e-invoice':
        return hasModulePermission('sales_pos', 'view') || hasModulePermission('reports', 'view');

      case 'expenses':
      case 'expense':
        return hasModulePermission('purchase_expenses', 'view') || role.type === 'Cashier';

      case 'products':
      case 'items':
      case 'categories':
      case 'units':
      case 'hsn-gst':
        return hasModulePermission('items_inventory', 'view');

      case 'warehouses':
      case 'stock-management':
      case 'stock-summary':
      case 'stock-aging':
      case 'stock':
      case 'stock-transfer':
      case 'stock-adjustment':
      case 'smart-inventory':
      case 'erp-inventory':
      case 'barcode-studio':
      case 'barcode-scanner':
        return (
          hasModulePermission('items_inventory', 'edit') ||
          hasModulePermission('items_inventory', 'configure') ||
          hasModulePermission('items_inventory', 'approve') ||
          hasModulePermission('items_inventory', 'view') ||
          role.type === 'Inventory'
        );

      case 'stock-history':
      case 'audit-log':
        return (
          hasModulePermission('items_inventory', 'edit') ||
          hasModulePermission('items_inventory', 'approve') ||
          hasModulePermission('staff_security', 'view') ||
          role.type === 'Inventory'
        );

      case 'customers':
      case 'customer-ledger':
      case 'udhar-khata':
      case 'parties':
        return hasModulePermission('parties', 'view');

      case 'crm-loyalty':
        return hasModulePermission('parties', 'view') || hasModulePermission('sales_pos', 'view');

      case 'online-orders':
        return (
          hasModulePermission('sales_pos', 'view') ||
          rName.includes('online') ||
          role.type === 'Online Store Manager' ||
          role.type === 'Manager'
        );

      case 'suppliers':
        return hasModulePermission('parties', 'view') && (hasModulePermission('purchase_expenses', 'view') || role.type === 'Inventory' || role.type === 'Accountant' || role.type === 'Manager');

      case 'accounting':
      case 'erp-accounting':
      case 'cash-bank':
      case 'cash-account':
      case 'bank-accounts':
      case 'payment-in':
      case 'payment-out':
      case 'other-income':
      case 'income':
        return hasModulePermission('accounting', 'view') || hasModulePermission('cash_bank_assets', 'view');

      case 'reports':
      case 'profit-loss':
      case 'ai-assistant':
        return hasModulePermission('reports', 'view') || hasModulePermission('accounting', 'view') || role.type === 'Manager';

      case 'staff-management':
        return hasModulePermission('staff_security', 'view');

      case 'customer-staff-portal':
      case 'customer-accounts':
      case 'staff-accounts':
      case 'add-staff':
      case 'staff-permissions':
      case 'customer-activity':
      case 'login-history':
      case 'account-status':
        return false;

      case 'settings':
      case 'erp-tools':
      case 'transaction-engine':
      case 'demo-page': {
        const rName = currentUser?.roleName || '';
        if (rName === 'Owner' || rName === 'Admin') return true;
        const rRule = businessSettings?.roleSettingsAccess?.[rName];
        if (rRule) {
          const hasAnyCategoryView = Object.values(rRule.categories).some((c) => c.view);
          if (hasAnyCategoryView || rRule.canBackupAndRestore || rRule.canViewAuditHistory) return true;
        }
        return hasModulePermission('settings_config', 'view') || hasModulePermission('utilities_sync', 'view');
      }

      default:
        return hasPermission(featureKey as any);
    }
  };

  const checkFeatureAccess = (featureKey: string, featureLabel: string): boolean => {
    if (canAccessFeature(featureKey)) {
      return true;
    }

    setRestrictedFeatureName(featureLabel);
    setIsAccessRestrictedOpen(true);
    return false;
  };

  // Toast & Global Confirmation State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<ToastNotice | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmationDialogConfig | null>(null);

  const dismissToast = () => {
    setToastMessage(null);
    setToastNotice(null);
  };

  const showToast = (
    msg: string,
    type: ToastNotice['type'] = 'success',
    undo?: { label: string; onUndo: () => void }
  ) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    setToastNotice({
      id: generateUniqueId('toast'),
      type,
      message: msg,
      undoLabel: undo?.label,
      onUndo: undo?.onUndo,
    });
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      setToastNotice(null);
    }, undo ? 5500 : 3400);
  };

  const requestConfirmation = (config: ConfirmationDialogConfig) => {
    setConfirmDialog(config);
  };

  const closeConfirmation = () => {
    setConfirmDialog(null);
  };

  // Theme Preference (Light / Dark / System) persisted locally
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    safeGetStoredData<ThemePreference>('bm360_theme_mode', 'light', (v) =>
      ['light', 'dark', 'system'].includes(String(v))
    )
  );

  useEffect(() => {
    safeSetStoredData('bm360_theme_mode', themePreference);
    if (typeof document !== 'undefined') {
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark =
        themePreference === 'dark' || (themePreference === 'system' && prefersDark);
      document.documentElement.classList.toggle('dark', shouldBeDark);
    }
  }, [themePreference]);

  // Dashboard Card Customization Preferences
  const DEFAULT_DASHBOARD_CARDS: DashboardCardPref[] = [
    { key: 'sales', label: 'Sales Recorded', visible: true, order: 0 },
    { key: 'purchases', label: 'Purchases Recorded', visible: true, order: 1 },
    { key: 'profit', label: 'Net Profit (Est.)', visible: true, order: 2 },
    { key: 'receivables', label: 'Customer Receivables', visible: true, order: 3 },
    { key: 'payables', label: 'Supplier Payables', visible: true, order: 4 },
    { key: 'cash', label: 'Cash in Hand', visible: true, order: 5 },
    { key: 'bank', label: 'Bank Balance', visible: true, order: 6 },
    { key: 'stock', label: 'Low-Stock & Catalogue', visible: true, order: 7 },
  ];

  const [dashboardCards, setDashboardCards] = useState<DashboardCardPref[]>(() =>
    safeGetStoredData<DashboardCardPref[]>('bm360_dashboard_cards', DEFAULT_DASHBOARD_CARDS, Array.isArray)
  );

  useEffect(() => {
    safeSetStoredData('bm360_dashboard_cards', dashboardCards);
  }, [dashboardCards]);

  // Double-Entry Accounting, Batches, Variants, Serials, Price History, Recurring & Recycle Bin State
  const [accounts, setAccounts] = useState<AccountRecord[]>(() =>
    safeGetStoredData<AccountRecord[]>('bm360_chart_of_accounts', buildDefaultChartOfAccounts(), Array.isArray)
  );
  const [journalVouchers, setJournalVouchers] = useState<JournalVoucher[]>(() =>
    safeGetStoredData<JournalVoucher[]>('bm360_journal_vouchers', [], Array.isArray)
  );
  const [batches, setBatches] = useState<ItemBatch[]>(() =>
    safeGetStoredData<ItemBatch[]>('bm360_item_batches', [
      {
        id: 'bat-1',
        itemId: 'i-2',
        itemName: 'Surf Excel Blue Detergent Powder 1kg',
        batchNumber: 'BCH-2026-01',
        mfgDate: '2026-08-01',
        expiryDate: '2027-08-01',
        purchaseRate: 110,
        saleRate: 130,
        qty: 50,
      },
    ], Array.isArray)
  );
  const [variants, setVariants] = useState<ItemVariant[]>(() =>
    safeGetStoredData<ItemVariant[]>('bm360_item_variants', [
      { id: 'var-1', itemId: 'i-2', name: '1kg Standard Pack', sku: 'SURF-1K-STD', barcode: '8901030701112', price: 130, stock: 30 },
      { id: 'var-2', itemId: 'i-2', name: '1kg Lemon Fresh', sku: 'SURF-1K-LEM', barcode: '8901030701129', price: 135, stock: 20 },
    ], Array.isArray)
  );
  const [serialNumbers, setSerialNumbers] = useState<SerialNumberRecord[]>(() =>
    safeGetStoredData<SerialNumberRecord[]>('bm360_serial_numbers', [], Array.isArray)
  );
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>(() =>
    safeGetStoredData<PriceHistoryEntry[]>('bm360_price_history', [], Array.isArray)
  );
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplate[]>(() =>
    safeGetStoredData<RecurringTemplate[]>('bm360_recurring_templates', [], Array.isArray)
  );
  const [recycleBin, setRecycleBin] = useState<RecycleBinRecord[]>(() =>
    safeGetStoredData<RecycleBinRecord[]>('bm360_recycle_bin', [], Array.isArray)
  );
  const [transactionTemplates, setTransactionTemplates] = useState<TransactionTemplate[]>(() =>
    safeGetStoredData<TransactionTemplate[]>('bm360_tx_templates', [], Array.isArray)
  );
  const [recurringExecutionLogs, setRecurringExecutionLogs] = useState<RecurringExecutionLog[]>(() =>
    safeGetStoredData<RecurringExecutionLog[]>('bm360_rec_exec_logs', [], Array.isArray)
  );
  const [paymentLimits, setPaymentLimits] = useState<PaymentLimitsConfig>(() =>
    safeGetStoredData<PaymentLimitsConfig>('bm360_payment_limits', DEFAULT_PAYMENT_LIMITS)
  );
  const [supplierQuotations, setSupplierQuotations] = useState<SupplierQuotation[]>(() =>
    safeGetStoredData<SupplierQuotation[]>('bm360_supplier_quotations', [], Array.isArray)
  );
  const [supplierItemMappings, setSupplierItemMappings] = useState<SupplierItemMapping[]>(() =>
    safeGetStoredData<SupplierItemMapping[]>('bm360_supplier_item_mappings', [], Array.isArray)
  );

  useEffect(() => { safeSetStoredData('bm360_chart_of_accounts', accounts); }, [accounts]);
  useEffect(() => { safeSetStoredData('bm360_journal_vouchers', journalVouchers); }, [journalVouchers]);
  useEffect(() => { safeSetStoredData('bm360_item_batches', batches); }, [batches]);
  useEffect(() => { safeSetStoredData('bm360_item_variants', variants); }, [variants]);
  useEffect(() => { safeSetStoredData('bm360_serial_numbers', serialNumbers); }, [serialNumbers]);
  useEffect(() => { safeSetStoredData('bm360_price_history', priceHistory); }, [priceHistory]);
  useEffect(() => { safeSetStoredData('bm360_recurring_templates', recurringTemplates); }, [recurringTemplates]);
  useEffect(() => { safeSetStoredData('bm360_recycle_bin', recycleBin); }, [recycleBin]);
  useEffect(() => { safeSetStoredData('bm360_tx_templates', transactionTemplates); }, [transactionTemplates]);
  useEffect(() => { safeSetStoredData('bm360_rec_exec_logs', recurringExecutionLogs); }, [recurringExecutionLogs]);
  useEffect(() => { safeSetStoredData('bm360_payment_limits', paymentLimits); }, [paymentLimits]);
  useEffect(() => { safeSetStoredData('bm360_supplier_quotations', supplierQuotations); }, [supplierQuotations]);
  useEffect(() => { safeSetStoredData('bm360_supplier_item_mappings', supplierItemMappings); }, [supplierItemMappings]);

  // Safe Storage Deserialization for all modules (respects user-cleared empty state)
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const initializedBefore = safeGetStoredData<boolean>('bm360_db_initialized', false);
    const hasKey = typeof window !== 'undefined' && window.localStorage.getItem('vyapar_transactions') !== null;
    if (hasKey) {
      const stored = safeGetStoredData<Transaction[]>('vyapar_transactions', DEMO_TRANSACTIONS, Array.isArray);
      if (initializedBefore || stored.length > 0) {
        return stored;
      }
    }
    return DEMO_TRANSACTIONS;
  });

  const [parties, setParties] = useState<Party[]>(() =>
    safeGetStoredData<Party[]>('vyapar_parties', INITIAL_PARTIES, Array.isArray)
  );

  const [items, setItems] = useState<Item[]>(() =>
    mergeUnifiedStoreItems(safeGetStoredData<Item[]>('vyapar_items', INITIAL_ITEMS, Array.isArray))
  );

  const [coupons, setCoupons] = useState<BillingCoupon[]>(() =>
    safeGetStoredData<BillingCoupon[]>('bm360_billing_coupons', DEFAULT_BILLING_COUPONS, Array.isArray)
  );

  const [msCreditTransactions, setMsCreditTransactions] = useState<MSCreditTransaction[]>(() =>
    safeGetStoredData<MSCreditTransaction[]>('bm360_ms_credit_txs', DEFAULT_MS_CREDIT_TRANSACTIONS, Array.isArray)
  );

  const [stockHistory, setStockHistory] = useState<StockTransactionRecord[]>(() =>
    safeGetStoredData<StockTransactionRecord[]>('bm360_stock_history', [], Array.isArray)
  );

  const [payments, setPayments] = useState<PaymentRecord[]>(() =>
    safeGetStoredData<PaymentRecord[]>('bm360_payments', [], Array.isArray)
  );

  const [returnRequests, setReturnRequests] = useState<ReturnRefundRequest[]>(() =>
    safeGetStoredData<ReturnRefundRequest[]>('bm360_return_requests', [], Array.isArray)
  );

  const [serviceAreaConfig, setServiceAreaConfig] = useState<StoreServiceAreaConfig>(() =>
    safeGetStoredData<StoreServiceAreaConfig>(
      'bm360_service_area',
      DEFAULT_STORE_SERVICE_AREA,
      (v) => Boolean(v && typeof v === 'object')
    )
  );

  // 5-Module Integrated ERP States
  const [purchaseScans, setPurchaseScans] = useState<PurchaseScanRecord[]>(() =>
    safeGetStoredData<PurchaseScanRecord[]>('bm360_purchase_scans', [], Array.isArray)
  );
  const [customHsnEntries, setCustomHsnEntries] = useState<HsnMasterEntry[]>(() =>
    safeGetStoredData<HsnMasterEntry[]>('bm360_custom_hsn', [], Array.isArray)
  );
  const [gstAudits, setGstAudits] = useState<GstClassificationAudit[]>(() =>
    safeGetStoredData<GstClassificationAudit[]>('bm360_gst_audits', [], Array.isArray)
  );
  const [eInvoiceRecords, setEInvoiceRecords] = useState<EInvoiceRecord[]>(() =>
    safeGetStoredData<EInvoiceRecord[]>('bm360_einvoice_records', [], Array.isArray)
  );
  const [eInvoiceLogs, setEInvoiceLogs] = useState<EInvoiceApiLog[]>(() =>
    safeGetStoredData<EInvoiceApiLog[]>('bm360_einvoice_logs', [], Array.isArray)
  );
  const [eWayBillRecords, setEWayBillRecords] = useState<EWayBillRecord[]>(() =>
    safeGetStoredData<EWayBillRecord[]>('bm360_ewaybill_records', [], Array.isArray)
  );

  const otpChallengesRef = useRef<
    Record<string, { otp: string; expiresAt: number; attempts: number; purpose: 'login' | 'register' }>
  >({});

  const [company, setCompany] = useState<CompanyProfile>(() =>
    safeGetStoredData<CompanyProfile>('vyapar_company', INITIAL_COMPANY, (val) => Boolean(val && typeof val === 'object'))
  );

  const [settings, setSettings] = useState<AppSettings>(() =>
    safeGetStoredData<AppSettings>('vyapar_settings', INITIAL_SETTINGS, (val) => Boolean(val && typeof val === 'object'))
  );

  // Safe Session Bootstrap:
  // Fresh open with no saved portal session ALWAYS starts at Welcome Screen ('welcome')
  const [portalStage, setPortalStage] = useState<PortalStage>('welcome');
  const [adminPortalSubTab, setAdminPortalSubTab] = useState<
    'customer-accounts' | 'staff-accounts' | 'add-staff' | 'staff-permissions' | 'customer-activity' | 'login-history' | 'account-status'
  >('customer-accounts');

  const [users, setUsers] = useState<AppUser[]>(() => {
    const stored = safeGetStoredData<AppUser[]>('vyapar_users', DEFAULT_USERS, Array.isArray);
    return sanitizeAndHashSeedUsers(stored);
  });

  const [customerAccounts, setCustomerAccounts] = useState<CustomerAccount[]>(() =>
    safeGetStoredData<CustomerAccount[]>('bm360_customer_accounts', DEFAULT_CUSTOMER_ACCOUNTS, Array.isArray)
  );

  const [staffTasks, setStaffTasks] = useState<StaffTask[]>(() =>
    safeGetStoredData<StaffTask[]>('bm360_staff_tasks', DEFAULT_STAFF_TASKS, Array.isArray)
  );

  const [portalNotifications, setPortalNotifications] = useState<PortalNotification[]>(() =>
    safeGetStoredData<PortalNotification[]>('bm360_portal_notifications', DEFAULT_PORTAL_NOTIFICATIONS, Array.isArray)
  );

  const [customerActivity, setCustomerActivity] = useState<CustomerActivityRecord[]>(() =>
    safeGetStoredData<CustomerActivityRecord[]>('bm360_customer_activity', DEFAULT_CUSTOMER_ACTIVITY, Array.isArray)
  );

  const [supportMessages, setSupportMessages] = useState<SupportMessageRecord[]>(() =>
    safeGetStoredData<SupportMessageRecord[]>(
      'bm360_support_messages',
      [
        {
          id: 'sup-101',
          customerId: 'CUST001',
          customerName: 'Rahul Sharma',
          phone: '+91 98451 12233',
          orderId: 'ONL-1001',
          subject: 'Delivery slot confirmation for Fresh Apples',
          message: 'Please ensure morning delivery before 11:30 AM if possible.',
          createdAt: 'Today, 09:40 AM',
          status: 'Open',
          replies: [],
        },
        {
          id: 'sup-102',
          customerId: 'CUST002',
          customerName: 'Ananya Iyer',
          phone: '+91 98223 34455',
          orderId: 'ONL-1002',
          subject: 'GST Invoice copy requested',
          message: 'Kindly share the tax invoice copy once packed.',
          createdAt: 'Yesterday, 05:15 PM',
          status: 'Open',
          replies: [],
        },
      ],
      Array.isArray
    )
  );

  const [activeSessionType, setActiveSessionType] = useState<AccountType | null>(() => {
    const sess = safeGetStoredData<PersistedPortalSession | null>('bm360_portal_session', null);
    return sess?.sessionType || null;
  });

  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const sess = safeGetStoredData<PersistedPortalSession | null>('bm360_portal_session', null);
    if (!sess || sess.sessionType === 'CUSTOMER') return null;
    const saved = safeGetStoredData<AppUser | null>('vyapar_current_user', null);
    if (saved && saved.status === 'Active' && saved.isApproved) {
      return stripSecretFieldsFromUser(saved);
    }
    return null;
  });

  const [currentCustomer, setCurrentCustomer] = useState<Omit<CustomerAccount, 'passwordHash'> | null>(() => {
    const sess = safeGetStoredData<PersistedPortalSession | null>('bm360_portal_session', null);
    if (!sess || sess.sessionType !== 'CUSTOMER') return null;
    const acc = safeGetStoredData<CustomerAccount[]>('bm360_customer_accounts', DEFAULT_CUSTOMER_ACCOUNTS, Array.isArray).find(
      (c) => c.id === sess.userId && c.status === 'Active'
    );
    if (!acc) return null;
    const { passwordHash: _ignored, ...safeCust } = acc;
    return safeCust;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const sess = safeGetStoredData<PersistedPortalSession | null>('bm360_portal_session', null);
    if (!sess) return false;
    if (sess.sessionType === 'CUSTOMER') {
      return Boolean(
        safeGetStoredData<CustomerAccount[]>('bm360_customer_accounts', DEFAULT_CUSTOMER_ACCOUNTS, Array.isArray).find(
          (c) => c.id === sess.userId && c.status === 'Active'
        )
      );
    }
    const saved = safeGetStoredData<AppUser | null>('vyapar_current_user', null);
    return Boolean(saved && saved.status === 'Active' && saved.isApproved);
  });

  const [roles, setRoles] = useState<RoleDefinition[]>(() =>
    safeGetStoredData<RoleDefinition[]>('vyapar_roles', DEFAULT_ROLES, Array.isArray)
  );

  const [employees, setEmployees] = useState<Employee[]>(() =>
    safeGetStoredData<Employee[]>('vyapar_employees', DEFAULT_EMPLOYEES, Array.isArray)
  );

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() =>
    safeGetStoredData<AttendanceRecord[]>('vyapar_attendance', DEFAULT_ATTENDANCE, Array.isArray)
  );

  const [sessions, setSessions] = useState<UserSession[]>(() =>
    safeGetStoredData<UserSession[]>('vyapar_sessions', DEFAULT_SESSIONS, Array.isArray)
  );

  const [loginHistory, setLoginHistory] = useState<LoginHistoryRecord[]>(() =>
    safeGetStoredData<LoginHistoryRecord[]>('vyapar_login_history', DEFAULT_LOGIN_HISTORY, Array.isArray)
  );

  const [activityLogs, setActivityLogs] = useState<UserActivityLog[]>(() =>
    safeGetStoredData<UserActivityLog[]>('vyapar_activity_logs', DEFAULT_ACTIVITY_LOGS, Array.isArray)
  );

  const [invitations, setInvitations] = useState<UserInvitation[]>(() =>
    safeGetStoredData<UserInvitation[]>('vyapar_invitations', DEFAULT_INVITATIONS, Array.isArray)
  );

  // Support Tickets State
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() =>
    safeGetStoredData<SupportTicket[]>('vyapar_support_tickets', DEFAULT_SUPPORT_TICKETS, Array.isArray)
  );

  // Premium & Subscription State
  const [subscription, setSubscription] = useState<PremiumSubscription>(() =>
    safeGetStoredData<PremiumSubscription>('vyapar_subscription', DEFAULT_SUBSCRIPTION)
  );

  const [premiumOrders, setPremiumOrders] = useState<PremiumOrder[]>(() =>
    safeGetStoredData<PremiumOrder[]>('vyapar_premium_orders', [], Array.isArray)
  );

  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(30);

  // RBAC Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register' | 'switch' | 'invitations'>('switch');
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isRoleEditorModalOpen, setIsRoleEditorModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleDefinition | null>(null);
  const [isEmployeeDetailModalOpen, setIsEmployeeDetailModalOpen] = useState(false);

  // Complete Settings Module State
  const [businessSettings, setBusinessSettings] = useState<BusinessSettingsBundle>(() => {
    const defaults = buildDefaultBusinessSettings();
    const stored = safeGetStoredData<BusinessSettingsBundle>(
      'bm360_business_settings',
      defaults,
      (val) => Boolean(val && typeof val === 'object' && (val as any).general && (val as any).party)
    );
    return {
      ...defaults,
      ...stored,
      accounting: {
        ...defaults.accounting,
        ...(stored.accounting || {}),
        profitControl: {
          ...defaults.accounting.profitControl!,
          ...(stored.accounting?.profitControl || {}),
        },
        lockedPeriods: stored.accounting?.lockedPeriods || [],
      },
      roleSettingsAccess: {
        ...buildDefaultRoleSettingsAccess(),
        ...(stored.roleSettingsAccess || {}),
      },
    };
  });
  const [discountApprovals, setDiscountApprovals] = useState<DiscountApprovalRecord[]>(() =>
    safeGetStoredData<DiscountApprovalRecord[]>('bm360_discount_approvals', [], Array.isArray)
  );
  const [partyGroups, setPartyGroups] = useState<PartyGroup[]>(() =>
    safeGetStoredData<PartyGroup[]>('bm360_party_groups', DEFAULT_PARTY_GROUPS, Array.isArray)
  );
  const [serviceReminders, setServiceReminders] = useState<ServiceReminderRecord[]>(() =>
    safeGetStoredData<ServiceReminderRecord[]>('bm360_service_reminders', DEFAULT_SERVICE_REMINDERS, Array.isArray)
  );
  const [settingsAuditLogs, setSettingsAuditLogs] = useState<SettingsAuditEntry[]>(() =>
    safeGetStoredData<SettingsAuditEntry[]>('bm360_settings_audit_logs', [], Array.isArray)
  );
  const [paymentReminderLogs, setPaymentReminderLogs] = useState<PaymentReminderLog[]>(() =>
    safeGetStoredData<PaymentReminderLog[]>('bm360_payment_reminder_logs', [], Array.isArray)
  );
  const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategoryId>(() =>
    safeGetStoredData<SettingsCategoryId>('bm360_last_settings_category', 'general')
  );

  const refreshDbStats = async () => {
    const stats = await getDatabaseStats();
    setDbStats(stats);
  };

  const syncNowWithServer = async (): Promise<boolean> => {
    setServerSyncStatus('syncing');
    try {
      await apiClient.getHealth();
      const res = await apiClient.pushStoreSyncState({
        company,
        settings,
        counts: {
          transactions: transactions.length,
          parties: parties.length,
          items: items.length,
          users: users.length,
          roles: roles.length,
          customerAccounts: customerAccounts.length,
        },
      });
      setLastServerSyncAt(res.syncedAt);
      setServerSyncStatus('online');
      await refreshDbStats();
      return true;
    } catch {
      setServerSyncStatus('reconnecting');
      return false;
    }
  };

  useEffect(() => {
    let active = true;
    const pingServer = async () => {
      try {
        await apiClient.getHealth();
        if (active) setServerSyncStatus('online');
      } catch {
        if (active) setServerSyncStatus('reconnecting');
      }
    };
    pingServer();
    const timer = setInterval(pingServer, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  // Hydrate from primary IndexedDB store on startup (automatically migrates localStorage on first run)
  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      await initDatabase();
      const idb = await loadAllFromIndexedDB();
      if (!active) return;

      if (idb.initialized) {
        setTransactions(idb.transactions);
        if (idb.parties.length > 0) setParties(idb.parties);
        if (idb.items.length > 0) setItems(mergeUnifiedStoreItems(idb.items));
        if (idb.company) setCompany(idb.company);
        if (idb.settings) setSettings(idb.settings);
        if (idb.users.length > 0) setUsers(sanitizeAndHashSeedUsers(idb.users));
        if (idb.roles.length > 0) setRoles(idb.roles);
        if (idb.employees.length > 0) setEmployees(idb.employees);
        if (idb.attendance.length > 0) setAttendanceRecords(idb.attendance);
        if (idb.activityLogs.length > 0) setActivityLogs(idb.activityLogs);
        if (idb.customerAccounts.length > 0) setCustomerAccounts(idb.customerAccounts);
        if (idb.staffTasks.length > 0) setStaffTasks(idb.staffTasks);
        if (idb.portalNotifications.length > 0) setPortalNotifications(idb.portalNotifications);
        if (idb.customerActivity.length > 0) setCustomerActivity(idb.customerActivity);
        if (idb.supportMessages.length > 0) setSupportMessages(idb.supportMessages);
        if (idb.coupons && idb.coupons.length > 0) setCoupons(idb.coupons);
        if (idb.msCreditTransactions && idb.msCreditTransactions.length > 0) {
          setMsCreditTransactions(idb.msCreditTransactions);
        }
        if (idb.stockHistory && idb.stockHistory.length > 0) setStockHistory(idb.stockHistory);
        if (idb.payments && idb.payments.length > 0) setPayments(idb.payments);
        if (idb.returnRequests && idb.returnRequests.length > 0) setReturnRequests(idb.returnRequests);
        if (idb.serviceAreaConfig) setServiceAreaConfig(idb.serviceAreaConfig);
        if (idb.sidebarCollapsed !== null) setSidebarCollapsed(idb.sidebarCollapsed);
        if (idb.expandedSidebarGroups) {
          setExpandedSidebarGroups((prev) => ({ ...prev, ...idb.expandedSidebarGroups }));
        }
        if (idb.purchaseScans && idb.purchaseScans.length > 0) setPurchaseScans(idb.purchaseScans);
        if (idb.hsnMaster && idb.hsnMaster.length > 0) setCustomHsnEntries(idb.hsnMaster);
        if (idb.gstAudits && idb.gstAudits.length > 0) setGstAudits(idb.gstAudits);
        if (idb.eInvoiceRecords && idb.eInvoiceRecords.length > 0) setEInvoiceRecords(idb.eInvoiceRecords);
        if (idb.eInvoiceLogs && idb.eInvoiceLogs.length > 0) setEInvoiceLogs(idb.eInvoiceLogs);
        if (idb.eWayBillRecords && idb.eWayBillRecords.length > 0) setEWayBillRecords(idb.eWayBillRecords);
        if (idb.businessSettings && (idb.businessSettings as any).general) {
          const defaults = buildDefaultBusinessSettings();
          setBusinessSettings((prev) => ({
            ...defaults,
            ...prev,
            ...idb.businessSettings,
            accounting: {
              ...defaults.accounting,
              ...(prev.accounting || {}),
              ...(idb.businessSettings?.accounting || {}),
              profitControl: {
                ...defaults.accounting.profitControl!,
                ...(prev.accounting?.profitControl || {}),
                ...(idb.businessSettings?.accounting?.profitControl || {}),
              },
              lockedPeriods:
                idb.businessSettings?.accounting?.lockedPeriods ??
                prev.accounting?.lockedPeriods ??
                [],
            },
            roleSettingsAccess: {
              ...buildDefaultRoleSettingsAccess(),
              ...(idb.businessSettings?.roleSettingsAccess || {}),
            },
          }));
        }
        if (idb.partyGroups && idb.partyGroups.length > 0) setPartyGroups(idb.partyGroups);
        if (idb.serviceReminders && idb.serviceReminders.length > 0) setServiceReminders(idb.serviceReminders);
        if (idb.settingsAuditLogs && idb.settingsAuditLogs.length > 0) setSettingsAuditLogs(idb.settingsAuditLogs);
        safeSetStoredData('bm360_db_initialized', true);
      } else {
        const cleanUsers = sanitizeAndHashSeedUsers(users);
        await Promise.all([
          syncTransactionsToStores(transactions),
          syncPartiesToStores(parties),
          syncItemsToStores(items),
          putKV('settings', 'company_profile', company),
          putKV('settings', 'app_settings', settings),
          putKV('settings', 'business_settings_bundle', businessSettings),
          replaceStoreRecords('partyGroups', partyGroups),
          replaceStoreRecords('serviceReminders', serviceReminders),
          replaceStoreRecords('settingsAuditLogs', settingsAuditLogs),
          replaceStoreRecords('users', cleanUsers),
          replaceStoreRecords('roles', roles),
          replaceStoreRecords('employees', employees),
          replaceStoreRecords('attendance', attendanceRecords),
          replaceStoreRecords('activityLogs', activityLogs),
          replaceStoreRecords('customerAccounts', customerAccounts),
          replaceStoreRecords('staffTasks', staffTasks),
          replaceStoreRecords('portalNotifications', portalNotifications),
          replaceStoreRecords('customerActivity', customerActivity),
          replaceStoreRecords('supportMessages', supportMessages),
          replaceStoreRecords('coupons', coupons),
          replaceStoreRecords('msCreditTransactions', msCreditTransactions),
          replaceStoreRecords('stockHistory', stockHistory),
          replaceStoreRecords('payments', payments),
          replaceStoreRecords('returnRequests', returnRequests),
          putKV('settings', 'store_service_area', serviceAreaConfig),
          putKV('preferences', 'sidebar_collapsed', sidebarCollapsed),
          putKV('preferences', 'sidebar_expanded_groups', expandedSidebarGroups),
          replaceStoreRecords('purchaseScans', purchaseScans),
          replaceStoreRecords('hsnMaster', customHsnEntries),
          replaceStoreRecords('gstAudits', gstAudits),
          replaceStoreRecords('eInvoiceRecords', eInvoiceRecords),
          replaceStoreRecords('eInvoiceLogs', eInvoiceLogs),
          replaceStoreRecords('eWayBillRecords', eWayBillRecords),
          putKV('preferences', 'db_initialized', true),
        ]);
        safeSetStoredData('bm360_db_initialized', true);
      }

      // Sync Settings from Express Backend if available
      try {
        const remote = await apiClient.getSettingsBundle();
        if (active && remote?.businessSettings?.general) {
          const defaults = buildDefaultBusinessSettings();
          setBusinessSettings((prev) => ({
            ...defaults,
            ...prev,
            ...remote.businessSettings,
            accounting: {
              ...defaults.accounting,
              ...(prev.accounting || {}),
              ...(remote.businessSettings?.accounting || {}),
              profitControl: {
                ...defaults.accounting.profitControl!,
                ...(prev.accounting?.profitControl || {}),
                ...(remote.businessSettings?.accounting?.profitControl || {}),
              },
              lockedPeriods:
                remote.businessSettings?.accounting?.lockedPeriods ??
                prev.accounting?.lockedPeriods ??
                [],
            },
            roleSettingsAccess: {
              ...buildDefaultRoleSettingsAccess(),
              ...(remote.businessSettings.roleSettingsAccess || {}),
            },
          }));
        }
        if (active && Array.isArray(remote?.partyGroups) && remote.partyGroups.length > 0) {
          setPartyGroups(remote.partyGroups);
        }
        if (active && Array.isArray(remote?.serviceReminders) && remote.serviceReminders.length > 0) {
          setServiceReminders(remote.serviceReminders);
        }
        if (active && Array.isArray(remote?.settingsAuditLogs) && remote.settingsAuditLogs.length > 0) {
          setSettingsAuditLogs(remote.settingsAuditLogs);
        }
      } catch {
        // Keep hydrated IndexedDB settings cleanly if server session not initialized yet
      }

      if (!active) return;
      setIsDbHydrated(true);
      await refreshDbStats();
    };

    hydrate();
    return () => {
      active = false;
    };
  }, []);

  // Persist sidebar state synchronously to localStorage + asynchronously to IndexedDB preferences
  useEffect(() => {
    safeSetStoredData('bm360_sidebar_collapsed', sidebarCollapsed);
    if (isDbHydrated) {
      putKV('preferences', 'sidebar_collapsed', sidebarCollapsed);
    }
  }, [sidebarCollapsed, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_sidebar_groups', expandedSidebarGroups);
    if (isDbHydrated) {
      putKV('preferences', 'sidebar_expanded_groups', expandedSidebarGroups);
    }
  }, [expandedSidebarGroups, isDbHydrated]);

  // Sync to localStorage & IndexedDB securely (never persisting plain-text passwords)
  useEffect(() => {
    safeSetStoredData('vyapar_current_user', stripSecretFieldsFromUser(currentUser));
  }, [currentUser]);

  useEffect(() => {
    const clean = sanitizeAndHashSeedUsers(users);
    safeSetStoredData('vyapar_users', clean);
    if (isDbHydrated) replaceStoreRecords('users', clean);
  }, [users, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_customer_accounts', customerAccounts);
    if (isDbHydrated) replaceStoreRecords('customerAccounts', customerAccounts);
  }, [customerAccounts, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_staff_tasks', staffTasks);
    if (isDbHydrated) replaceStoreRecords('staffTasks', staffTasks);
  }, [staffTasks, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_portal_notifications', portalNotifications);
    if (isDbHydrated) replaceStoreRecords('portalNotifications', portalNotifications);
  }, [portalNotifications, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_customer_activity', customerActivity);
    if (isDbHydrated) replaceStoreRecords('customerActivity', customerActivity);
  }, [customerActivity, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_support_messages', supportMessages);
    if (isDbHydrated) replaceStoreRecords('supportMessages', supportMessages);
  }, [supportMessages, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_billing_coupons', coupons);
    if (isDbHydrated) replaceStoreRecords('coupons', coupons);
  }, [coupons, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_ms_credit_txs', msCreditTransactions);
    if (isDbHydrated) replaceStoreRecords('msCreditTransactions', msCreditTransactions);
  }, [msCreditTransactions, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_stock_history', stockHistory);
    if (isDbHydrated) replaceStoreRecords('stockHistory', stockHistory);
  }, [stockHistory, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_payments', payments);
    if (isDbHydrated) replaceStoreRecords('payments', payments);
  }, [payments, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_return_requests', returnRequests);
    if (isDbHydrated) replaceStoreRecords('returnRequests', returnRequests);
  }, [returnRequests, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_service_area', serviceAreaConfig);
    if (isDbHydrated) putKV('settings', 'store_service_area', serviceAreaConfig);
  }, [serviceAreaConfig, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('vyapar_roles', roles);
    if (isDbHydrated) replaceStoreRecords('roles', roles);
  }, [roles, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('vyapar_employees', employees);
    if (isDbHydrated) replaceStoreRecords('employees', employees);
  }, [employees, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('vyapar_attendance', attendanceRecords);
    if (isDbHydrated) replaceStoreRecords('attendance', attendanceRecords);
  }, [attendanceRecords, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('vyapar_sessions', sessions);
  }, [sessions]);

  useEffect(() => {
    safeSetStoredData('vyapar_login_history', loginHistory);
  }, [loginHistory]);

  useEffect(() => {
    safeSetStoredData('vyapar_activity_logs', activityLogs);
    if (isDbHydrated) replaceStoreRecords('activityLogs', activityLogs);
  }, [activityLogs, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('vyapar_invitations', invitations);
  }, [invitations]);

  useEffect(() => {
    safeSetStoredData('vyapar_transactions', transactions);
    if (isDbHydrated) {
      syncTransactionsToStores(transactions).then(() => refreshDbStats());
    }
  }, [transactions, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('vyapar_parties', parties);
    if (isDbHydrated) {
      syncPartiesToStores(parties).then(() => refreshDbStats());
    }
  }, [parties, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('vyapar_items', items);
    if (isDbHydrated) {
      syncItemsToStores(items).then(() => refreshDbStats());
    }
  }, [items, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('vyapar_company', company);
    if (isDbHydrated) putKV('settings', 'company_profile', company);
  }, [company, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('vyapar_settings', settings);
    if (isDbHydrated) putKV('settings', 'app_settings', settings);
  }, [settings, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('vyapar_support_tickets', supportTickets);
  }, [supportTickets]);

  useEffect(() => {
    safeSetStoredData('vyapar_subscription', subscription);
  }, [subscription]);

  useEffect(() => {
    safeSetStoredData('vyapar_premium_orders', premiumOrders);
  }, [premiumOrders]);

  useEffect(() => {
    safeSetStoredData('bm360_purchase_scans', purchaseScans);
    if (isDbHydrated) replaceStoreRecords('purchaseScans', purchaseScans);
  }, [purchaseScans, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_custom_hsn', customHsnEntries);
    if (isDbHydrated) replaceStoreRecords('hsnMaster', customHsnEntries);
  }, [customHsnEntries, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_gst_audits', gstAudits);
    if (isDbHydrated) replaceStoreRecords('gstAudits', gstAudits);
  }, [gstAudits, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_einvoice_records', eInvoiceRecords);
    if (isDbHydrated) replaceStoreRecords('eInvoiceRecords', eInvoiceRecords);
  }, [eInvoiceRecords, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_einvoice_logs', eInvoiceLogs);
    if (isDbHydrated) replaceStoreRecords('eInvoiceLogs', eInvoiceLogs);
  }, [eInvoiceLogs, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_ewaybill_records', eWayBillRecords);
    if (isDbHydrated) replaceStoreRecords('eWayBillRecords', eWayBillRecords);
  }, [eWayBillRecords, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_business_settings', businessSettings);
    if (isDbHydrated) putKV('settings', 'business_settings_bundle', businessSettings);
  }, [businessSettings, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_party_groups', partyGroups);
    if (isDbHydrated) replaceStoreRecords('partyGroups', partyGroups);
  }, [partyGroups, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_service_reminders', serviceReminders);
    if (isDbHydrated) replaceStoreRecords('serviceReminders', serviceReminders);
  }, [serviceReminders, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_settings_audit_logs', settingsAuditLogs);
    if (isDbHydrated) replaceStoreRecords('settingsAuditLogs', settingsAuditLogs);
  }, [settingsAuditLogs, isDbHydrated]);

  useEffect(() => {
    safeSetStoredData('bm360_payment_reminder_logs', paymentReminderLogs);
  }, [paymentReminderLogs]);

  useEffect(() => {
    safeSetStoredData('bm360_discount_approvals', discountApprovals);
  }, [discountApprovals]);

  useEffect(() => {
    safeSetStoredData('bm360_last_settings_category', activeSettingsCategory);
  }, [activeSettingsCategory]);

  // Global Keyboard Shortcuts (Ctrl+K, Ctrl+N, Ctrl+P, Alt+1..5, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !isInput) {
        e.preventDefault();
        setIsAddSaleOpen(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        generateCurrentViewPdf({
          activeTab,
          activeSaleSubtype,
          company,
          transactions,
          parties,
          items,
          selectedPartyId,
          selectedItemId,
          filterStartDate,
          filterEndDate,
          filterFirm,
          statusFilter: 'All',
          paymentTypeFilter: 'All',
        });
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === '1') { e.preventDefault(); setActiveTab('dashboard'); return; }
        if (e.key === '2') { e.preventDefault(); setActiveTab('sale-invoices'); return; }
        if (e.key === '3') { e.preventDefault(); setActiveTab('purchase'); return; }
        if (e.key === '4') { e.preventDefault(); setActiveTab('customers'); return; }
        if (e.key === '5') { e.preventDefault(); setActiveTab('items'); return; }
      }
      if (e.key === 'Escape') {
        setConfirmDialog(null);
        setIsAddSaleOpen(false);
        setIsAddPurchaseOpen(false);
        setIsInvoicePreviewOpen(false);
        setIsCompanyModalOpen(false);
        setIsSettingsModalOpen(false);
        setIsShortcutsModalOpen(false);
        setIsHelpModalOpen(false);
        setIsVersionsModalOpen(false);
        setIsSupportModalOpen(false);
        setIsCommandPaletteOpen(false);
        setIsAnalyticsModalOpen(false);
        setIsPremiumModalOpen(false);
        setIsMyStoreModalOpen(false);
        setIsAddPartyModalOpen(false);
        setIsAddItemModalOpen(false);
        setIsAuthModalOpen(false);
        setIsAddEmployeeModalOpen(false);
        setIsRoleEditorModalOpen(false);
        setIsEmployeeDetailModalOpen(false);
        setIsLogoutModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper to find the active role of the current user
  const getActiveRole = (): RoleDefinition | undefined => {
    if (!currentUser) return undefined;
    return roles.find(
      (r) =>
        r.id === currentUser.roleId ||
        r.name.toLowerCase() === currentUser.roleName.toLowerCase() ||
        r.type.toLowerCase() === currentUser.roleName.toLowerCase()
    );
  };

  // Comprehensive Permission Checker supporting both granular `${module}.${action}` and legacy keys
  const hasPermission = (permission: PermissionKey): boolean => {
    if (!currentUser) return false;
    if (currentUser.roleName === 'Owner') return true;

    const role = getActiveRole();
    if (!role) return false;

    // Direct match
    if (role.permissions.includes(permission)) return true;

    // Mapping legacy coarse permissions to granular billing actions
    if (permission === 'view') {
      return role.permissions.some((p) => p.endsWith('.view') || p === 'view');
    }
    if (permission === 'create') {
      return role.permissions.some((p) => p.endsWith('.create') || p === 'create');
    }
    if (permission === 'edit') {
      return role.permissions.some((p) => p.endsWith('.edit') || p === 'edit');
    }
    if (permission === 'delete') {
      return role.permissions.some((p) => p.endsWith('.delete') || p === 'delete');
    }
    if (permission === 'product') {
      return role.permissions.some((p) => p.startsWith('items_inventory.') || p === 'product');
    }
    if (permission === 'customer' || permission === 'supplier') {
      return role.permissions.some((p) => p.startsWith('parties.') || p === permission);
    }
    if (permission === 'payment') {
      return role.permissions.some((p) => p.startsWith('cash_bank_assets.') || p === 'payment');
    }
    if (permission === 'discount') {
      return (role.maxDiscountPercent ?? 0) > 0 || role.permissions.includes('discount');
    }
    if (permission === 'report') {
      return role.permissions.some((p) => p.startsWith('reports.') || p === 'report');
    }
    if (permission === 'settings') {
      return role.permissions.some((p) => p.startsWith('settings_config.') || p === 'settings');
    }
    if (permission === 'branch') {
      return role.branchScope === 'All Branches' || role.permissions.includes('branch');
    }

    return false;
  };

  // Modular Permission Checker
  const hasModulePermission = (module: BillingModule, action: ModuleAction): boolean => {
    if (!currentUser) return false;
    if (currentUser.roleName === 'Owner') return true;

    const role = getActiveRole();
    if (!role) return false;

    const specificKey = `${module}.${action}` as PermissionKey;
    if (role.permissions.includes(specificKey)) return true;

    // Check if legacy action applies
    if (role.permissions.includes(action as PermissionKey)) return true;

    return false;
  };

  // Discount Ceiling Verification (Control #2)
  const canApplyDiscount = (percent: number): { allowed: boolean; maxAllowed: number; reason?: string } => {
    if (!currentUser) return { allowed: false, maxAllowed: 0, reason: 'Authentication required' };
    if (currentUser.roleName === 'Owner') return { allowed: true, maxAllowed: 100 };

    const role = getActiveRole();
    const ceiling = role?.maxDiscountPercent ?? 0;

    if (percent <= ceiling) {
      return { allowed: true, maxAllowed: ceiling };
    }

    return {
      allowed: false,
      maxAllowed: ceiling,
      reason: `Requested discount of ${percent}% exceeds ${role?.name || 'role'} ceiling of ${ceiling}%. Requires Manager or Owner approval.`,
    };
  };

  // Refund Protection Verification (Control #3)
  const canApproveRefund = (amount: number): { allowed: boolean; requiresApproval: boolean; reason?: string } => {
    if (!currentUser) return { allowed: false, requiresApproval: true, reason: 'Authentication required' };
    if (currentUser.roleName === 'Owner') return { allowed: true, requiresApproval: false };

    const role = getActiveRole();
    const threshold = role?.maxRefundAmountWithoutApproval ?? 0;

    if (amount <= threshold && threshold > 0) {
      return { allowed: true, requiresApproval: false };
    }

    return {
      allowed: false,
      requiresApproval: true,
      reason: `Refund amount of ₹${amount.toLocaleString('en-IN')} exceeds ${role?.name || 'role'} refund ceiling (₹${threshold.toLocaleString('en-IN')}). Requires Manager or Owner authorization.`,
    };
  };

  // Finalized Invoice Protection (Control #1)
  const canEditFinalizedBill = (_billId?: string): { allowed: boolean; policy: 'No' | 'Limited' | 'Approval' | 'Yes'; reason?: string } => {
    if (!currentUser) return { allowed: false, policy: 'No', reason: 'Authentication required' };
    if (currentUser.roleName === 'Owner') return { allowed: true, policy: 'Yes' };

    const role = getActiveRole();
    const policy = role?.canEditFinalizedBills || 'No';

    if (policy === 'Yes' || policy === 'Limited') {
      return { allowed: true, policy };
    }

    if (policy === 'Approval') {
      return { allowed: false, policy, reason: 'Editing finalized bills requires Manager or Owner digital supervisor sign-off.' };
    }

    return {
      allowed: false,
      policy: 'No',
      reason: `Role "${role?.name || 'User'}" is restricted from modifying finalized GST invoices. (Invoice Protection Policy).`,
    };
  };

  // Invoice Cancellation Protection
  const canCancelInvoice = (_invoiceId?: string): { allowed: boolean; policy: 'No' | 'Approval' | 'Restricted' | 'Yes'; reason?: string } => {
    if (!currentUser) return { allowed: false, policy: 'No', reason: 'Authentication required' };
    if (currentUser.roleName === 'Owner') return { allowed: true, policy: 'Yes' };

    const role = getActiveRole();
    const policy = role?.canCancelInvoices || 'No';

    if (policy === 'Yes') return { allowed: true, policy };

    if (policy === 'Approval' || policy === 'Restricted') {
      return { allowed: false, policy, reason: `Invoice cancellation is ${policy.toLowerCase()} and requires independent supervisor authorization.` };
    }

    return {
      allowed: false,
      policy: 'No',
      reason: `Role "${role?.name || 'User'}" does not have permissions to cancel finalized invoices.`,
    };
  };

  // Financial Data Visibility (Control #9)
  const isFinancialDataVisible = (): { purchaseCost: boolean; profitMargins: boolean; bankBalances: boolean } => {
    if (!currentUser) return { purchaseCost: false, profitMargins: false, bankBalances: false };
    if (currentUser.roleName === 'Owner') return { purchaseCost: true, profitMargins: true, bankBalances: true };

    const role = getActiveRole();
    return {
      purchaseCost: role?.canViewPurchasePrice ?? true,
      profitMargins: role?.canViewProfitMargins ?? false,
      bankBalances: role?.type === 'Accountant' || role?.type === 'Admin',
    };
  };

  const canOverrideStockLimit = (): boolean => {
    if (!currentUser) return false;
    const role = getActiveRole();
    const rName = (currentUser.roleName || '').toLowerCase();
    return (
      rName === 'owner' ||
      rName === 'admin' ||
      rName === 'administrator' ||
      role?.type === 'Owner' ||
      role?.type === 'Admin'
    );
  };

  const canManageBarcodes = (): boolean => {
    if (!currentUser) return false;
    if (canOverrideStockLimit()) return true;
    return hasPermission('product') || hasModulePermission('items_inventory', 'edit');
  };

  // Activity Logger with Trustworthy Metadata
  const recordActivity = (
    action: string,
    module: UserActivityLog['module'],
    details: string,
    extra?: {
      targetId?: string;
      targetType?: string;
      beforeState?: Record<string, any>;
      afterState?: Record<string, any>;
      outcome?: 'Success' | 'Denied' | 'Approved' | 'Flagged';
    }
  ) => {
    const clientMeta = typeof navigator !== 'undefined' ? `${navigator.platform || 'Desktop Client'}` : 'Local Desktop';
    const newLog: UserActivityLog = {
      id: generateUniqueId('act'),
      userId: currentUser?.id || 'system',
      userName: currentUser?.name || 'Local Session',
      role: currentUser?.roleName || 'System',
      action,
      module,
      details,
      timestamp: `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      ipAddress: `127.0.0.1 (${clientMeta})`,
      targetId: extra?.targetId,
      targetType: extra?.targetType,
      beforeState: extra?.beforeState,
      afterState: extra?.afterState,
      outcome: extra?.outcome || 'Success',
    };
    setActivityLogs((prev) => [newLog, ...prev]);
  };

  // Stock Adjustment Action with Permission Check & Stock Ledger Entry
  const adjustStock = (itemId: string, newStock: number, reason?: string) => {
    if (!hasPermission('product')) {
      showToast('Permission Denied: Your assigned role cannot adjust inventory stock.', 'error');
      return;
    }
    const target = items.find((it) => it.id === itemId);
    const delta = target ? newStock - target.stock : newStock;
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, stock: newStock } : it))
    );
    if (target) {
      setStockHistory((prev) => [
        {
          id: generateUniqueId('stk'),
          itemId: target.id,
          itemName: target.name,
          type: 'MANUAL_ADJUSTMENT',
          qtyChange: delta,
          stockAfter: newStock,
          reservedAfter: target.reservedStock || 0,
          referenceNo: `ADJ-${Date.now().toString().slice(-5)}`,
          actor: currentUser?.name || 'Admin',
          timestamp: `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          notes: reason || 'Manual Stock Adjustment',
        },
        ...prev,
      ]);
      const minThreshold = target.minStockAlert ?? 5;
      if (newStock <= minThreshold) {
        showToast(`Low Stock Alert: "${target.name}" has only ${newStock} ${target.unit} left (Min: ${minThreshold}).`, 'warning');
      } else {
        showToast(`Stock updated to ${newStock}`, 'success');
      }
    } else {
      showToast(`Stock updated to ${newStock}`, 'success');
    }
    recordActivity('Stock Adjustment', 'Inventory', `Adjusted stock for ${target?.name || itemId} to ${newStock}${reason ? ` (${reason})` : ''}`);
  };

  const recordDamagedStock = (
    itemId: string,
    damagedQty: number,
    reason?: string
  ): { success: boolean; message: string } => {
    if (!hasPermission('product') && !hasModulePermission('items_inventory', 'edit')) {
      showToast('Permission Denied: Your assigned role cannot write off damaged stock.', 'error');
      return { success: false, message: 'Permission denied' };
    }
    const target = items.find((it) => it.id === itemId);
    if (!target) return { success: false, message: 'Product not found.' };
    const qty = Math.max(1, Math.floor(Number(damagedQty) || 0));
    const nextStock = Math.max(0, (target.stock || 0) - qty);
    const ts = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, stock: nextStock } : it)));
    setStockHistory((prev) => [
      {
        id: generateUniqueId('stk'),
        itemId: target.id,
        itemName: target.name,
        type: 'DAMAGED_WRITE_OFF',
        qtyChange: -qty,
        stockAfter: nextStock,
        reservedAfter: target.reservedStock || 0,
        referenceNo: `DMG-${Date.now().toString().slice(-5)}`,
        actor: currentUser?.name || 'Admin',
        timestamp: ts,
        notes: reason || 'Damaged / expired stock write-off',
      },
      ...prev,
    ]);
    recordActivity('Damaged Stock Write-Off', 'Inventory', `Deducted ${qty} ${target.unit} of ${target.name} (${reason || 'Damaged'})`);
    showToast(`Recorded ${qty} ${target.unit} damaged/expired write-off for ${target.name}`, 'warning');
    return { success: true, message: `Damaged stock recorded (${nextStock} remaining).` };
  };

  // CRUD Actions with Auto-Stock Accounting & Balance Synchronization
  const addTransaction = (txData: Omit<Transaction, 'id' | 'createdAt'>): Transaction | null => {
    if (!hasPermission('create')) {
      showToast('Permission Denied: Your assigned role cannot create new transactions.');
      return null;
    }

    const lockedMatch = isDateInLockedPeriod(txData.date, businessSettings);
    if (lockedMatch.locked) {
      showToast(
        `Financial Period "${lockedMatch.periodLabel || 'Locked'}" is locked by Admin. Unlock it in Accounting Settings to post vouchers.`,
        'error'
      );
      return null;
    }

    // Enforce Blocked Party check if enabled in Party Settings
    if (
      businessSettings.party.blockTransactionsForBlockedParties &&
      txData.partyName &&
      txData.partyName !== 'Cash Sale'
    ) {
      const targetParty = parties.find(
        (p) => p.name.trim().toLowerCase() === txData.partyName.trim().toLowerCase()
      );
      if (targetParty?.status === 'Blocked') {
        showToast(
          `Blocked Party: "${targetParty.name}" is marked Blocked in Party Settings. Change status to Active to transact.`,
          'error'
        );
        return null;
      }
    }

    // Enforce Duplicate Invoice / Purchase Bill Prevention from Transaction Settings
    if (
      txData.type === 'Sale' &&
      businessSettings.transaction.behaviour.preventDuplicateInvoice &&
      txData.invoiceNo &&
      transactions.some(
        (t) =>
          t.type === 'Sale' &&
          !t.isCancelled &&
          t.invoiceNo.trim().toLowerCase() === txData.invoiceNo.trim().toLowerCase()
      )
    ) {
      showToast(`Duplicate Invoice #${txData.invoiceNo} blocked by Transaction Settings.`, 'error');
      return null;
    }
    if (
      txData.type === 'Purchase' &&
      businessSettings.transaction.behaviour.preventDuplicatePurchaseBill &&
      txData.invoiceNo &&
      transactions.some(
        (t) =>
          t.type === 'Purchase' &&
          !t.isCancelled &&
          t.partyName.trim().toLowerCase() === txData.partyName.trim().toLowerCase() &&
          t.invoiceNo.trim().toLowerCase() === txData.invoiceNo.trim().toLowerCase()
      )
    ) {
      showToast(`Duplicate Purchase Bill #${txData.invoiceNo} for ${txData.partyName} prevented.`, 'error');
      return null;
    }

    // Enforce Negative Stock Prevention from Transaction / Item Settings
    const allowNegStock =
      businessSettings.transaction.behaviour.allowNegativeStock &&
      businessSettings.item.allowNegativeStock;
    if (
      !txData.skipStockDeduction &&
      (txData.type === 'Sale' || txData.type === 'Sale Order') &&
      txData.items &&
      txData.items.length > 0
    ) {
      for (const line of txData.items) {
        const matched = items.find(
          (i) =>
            i.name.toLowerCase() === line.name.toLowerCase() ||
            (line.hsn && (i.code === line.hsn || i.barcode === line.hsn || i.hsnCode === line.hsn))
        );
        const rawQty = Number(line.qty || 0) + Number(line.freeQty || 0);
        const reqQty = matched
          ? convertUnitQty(rawQty, line.unit || matched.unit, matched.unit, matched.unitConversion, businessSettings.item.units)
          : rawQty;
        if (matched && roundQtyPrecision(matched.stock - reqQty, 6) < 0 && !allowNegStock) {
          showToast(
            `Insufficient stock for "${matched.name}" (Available: ${formatBaseQtyHuman(matched.stock, matched.unit)}, Requested: ${formatBaseQtyHuman(reqQty, matched.unit)}). Negative stock is disabled in Settings.`,
            'error'
          );
          return null;
        }
      }
    }

    const stampedTxData =
      txData.type === 'Sale' || txData.type === 'Sale Return'
        ? stampSaleTransactionProfit({
            txData,
            items,
            batches,
            settings: businessSettings,
            existingTransactions: transactions,
          })
        : txData;

    const initialWorkflow: TransactionWorkflowStatus = stampedTxData.workflowStatus || 'Completed';
    const actorName = currentUser?.name || stampedTxData.user || 'Admin';
    const newTx: Transaction = {
      ...stampedTxData,
      id: generateUniqueId('tx'),
      uuid: stampedTxData.uuid || generateTransactionUuid(),
      sequenceNo: stampedTxData.sequenceNo ?? transactions.length + 1,
      workflowStatus: initialWorkflow,
      version: stampedTxData.version ?? 1,
      stateHistory: stampedTxData.stateHistory || [
        {
          id: generateUniqueId('st'),
          timestamp: new Date().toISOString(),
          fromStatus: 'None',
          toStatus: initialWorkflow,
          actor: actorName,
          reason: 'Initial transaction creation',
        },
      ],
      activityHistory: stampedTxData.activityHistory || [
        {
          id: generateUniqueId('act'),
          timestamp: new Date().toISOString(),
          action: 'Created',
          actor: actorName,
          details: `Created ${stampedTxData.type} #${stampedTxData.invoiceNo}`,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const isSupplierPaymentOutForPurchase =
      newTx.type === 'Purchase' &&
      (newTx.invoiceNo.startsWith('PAYOUT-') ||
        Boolean(newTx.notes && newTx.notes.toLowerCase().includes('payment-out')) ||
        ((!newTx.items || newTx.items.length === 0) && (newTx.balance || 0) === 0));

    const purchaseCostAnalysis =
      newTx.type === 'Purchase' && !isSupplierPaymentOutForPurchase && newTx.items && newTx.items.length > 0
        ? computePurchaseLineLandedCosts({
            lines: newTx.items,
            freightCharges: newTx.freightCharges,
            otherPurchaseExpenses: newTx.otherPurchaseExpenses,
            isGstActive: businessSettings.gst.isGstRegistered,
            isTaxInclusive: businessSettings.transaction.purchase.defaultTaxMode === 'Inclusive',
            gstInputCreditEligible: newTx.gstInputCreditEligible ?? true,
          })
        : null;

    // 1. Automatic Stock Accounting + Stock Movement History + Low-Stock Alert
    // Honor skipStockDeduction so Delivery Challan -> Invoice conversion never double-deducts stock
    if (!newTx.skipStockDeduction && newTx.items && newTx.items.length > 0) {
      const stockMovements: StockTransactionRecord[] = [];
      const lowStockWarnings: string[] = [];
      const createdBatchesFromPurchase: ItemBatch[] = [];
      const ts = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const purchaseDateShort = (newTx.date || ts).split(',')[0].trim();

      setItems((prevItems) => {
        const updated = [...prevItems];
        newTx.items.forEach((line, lineIdx) => {
          const itemIdx = updated.findIndex(
            (i) =>
              i.name.toLowerCase() === line.name.toLowerCase() ||
              (line.hsn && (i.code === line.hsn || i.barcode === line.hsn || i.hsnCode === line.hsn))
          );
          if (itemIdx >= 0) {
            const currentItem = updated[itemIdx];
            const rawLineQty = Number(line.qty || 0) + Number(line.freeQty || 0);
            const lineQty = convertUnitQty(
              rawLineQty,
              line.unit || currentItem.unit,
              currentItem.unit,
              currentItem.unitConversion,
              businessSettings.item.units
            );
            const qtyScale = lineQty > 0 ? rawLineQty / lineQty : 1;
            if (newTx.type === 'Sale' || newTx.type === 'Sale Order') {
              const nextStock = roundQtyPrecision(currentItem.stock - lineQty, 6);
              updated[itemIdx] = { ...currentItem, stock: nextStock };
              stockMovements.push({
                id: generateUniqueId('stk'),
                itemId: currentItem.id,
                itemName: currentItem.name,
                type: 'DEDUCT_SALE',
                qtyChange: -lineQty,
                stockAfter: nextStock,
                reservedAfter: currentItem.reservedStock || 0,
                referenceNo: newTx.invoiceNo,
                actor: newTx.user || currentUser?.name || 'Admin',
                timestamp: ts,
                notes: line.displayWeightLabel ? `Sold ${line.displayWeightLabel}` : undefined,
              });
              const minAlert = currentItem.minStockAlert ?? 5;
              if (nextStock <= minAlert) {
                lowStockWarnings.push(`${currentItem.name} (${formatBaseQtyHuman(nextStock, currentItem.unit)} left)`);
              }
            } else if (newTx.type === 'Purchase') {
              const nextStock = roundQtyPrecision(currentItem.stock + lineQty, 6);
              const landedLine = purchaseCostAnalysis?.lines[lineIdx];
              const rawLandedCost = landedLine?.landedUnitCost ?? Number(line.price || currentItem.purchasePrice || 0);
              const landedUnitCost = Math.round(rawLandedCost * qtyScale * 100) / 100;
              const prevAvg = getItemWeightedAvgCost(currentItem);
              const nextWeightedAvg = computeWeightedAverageAfterPurchase(
                currentItem.stock,
                prevAvg,
                lineQty,
                landedUnitCost
              );
              const activeMethod = getEffectiveCostingMethod(businessSettings);
              const updatedBasePurchasePrice =
                activeMethod === 'Weighted Average' ? nextWeightedAvg : landedUnitCost;

              updated[itemIdx] = {
                ...currentItem,
                stock: nextStock,
                lastPurchasePrice: landedUnitCost,
                lastSupplierPrice: landedUnitCost,
                weightedAvgCost: nextWeightedAvg,
                purchasePrice: updatedBasePurchasePrice,
                lastPurchaseSupplier: newTx.partyName,
                lastPurchaseDate: purchaseDateShort,
                gstInputCreditEligible: newTx.gstInputCreditEligible ?? currentItem.gstInputCreditEligible ?? true,
              };

              createdBatchesFromPurchase.push({
                id: generateUniqueId('bat'),
                itemId: currentItem.id,
                itemName: currentItem.name,
                batchNumber: line.batchNo || `PUR-${newTx.invoiceNo}-${lineIdx + 1}`,
                mfgDate: new Date().toISOString().slice(0, 10),
                expiryDate: line.expiryDate || currentItem.expiryDate || '2028-12-31',
                purchaseRate: landedUnitCost,
                saleRate: currentItem.salePrice,
                qty: lineQty,
              });

              stockMovements.push({
                id: generateUniqueId('stk'),
                itemId: currentItem.id,
                itemName: currentItem.name,
                type: 'PURCHASE_INWARD',
                qtyChange: lineQty,
                stockAfter: nextStock,
                reservedAfter: currentItem.reservedStock || 0,
                referenceNo: newTx.invoiceNo,
                actor: newTx.user || currentUser?.name || 'Admin',
                timestamp: ts,
                notes: `Landed Cost ₹${landedUnitCost.toLocaleString('en-IN')}/${currentItem.unit} (WA: ₹${nextWeightedAvg.toLocaleString('en-IN')})`,
              });
            } else if (newTx.type === 'Sale Return') {
              const nextStock = roundQtyPrecision(currentItem.stock + lineQty, 6);
              updated[itemIdx] = { ...currentItem, stock: nextStock };
              stockMovements.push({
                id: generateUniqueId('stk'),
                itemId: currentItem.id,
                itemName: currentItem.name,
                type: 'RETURN_RESTOCK',
                qtyChange: lineQty,
                stockAfter: nextStock,
                reservedAfter: currentItem.reservedStock || 0,
                referenceNo: newTx.invoiceNo,
                actor: newTx.user || currentUser?.name || 'Admin',
                timestamp: ts,
                notes: line.displayWeightLabel ? `Returned ${line.displayWeightLabel}` : undefined,
              });
            } else if (newTx.type === 'Purchase Return') {
              const nextStock = Math.max(0, roundQtyPrecision(currentItem.stock - lineQty, 6));
              updated[itemIdx] = { ...currentItem, stock: nextStock };
              stockMovements.push({
                id: generateUniqueId('stk'),
                itemId: currentItem.id,
                itemName: currentItem.name,
                type: 'PURCHASE_RETURN',
                qtyChange: -lineQty,
                stockAfter: nextStock,
                reservedAfter: currentItem.reservedStock || 0,
                referenceNo: newTx.invoiceNo,
                actor: newTx.user || currentUser?.name || 'Admin',
                timestamp: ts,
                notes: newTx.returnReason || newTx.notes,
              });
            }
          }
        });
        return updated;
      });

      if (createdBatchesFromPurchase.length > 0) {
        setBatches((prevBatches) => [...prevBatches, ...createdBatchesFromPurchase]);
      }

      if (stockMovements.length > 0) {
        setStockHistory((prev) => [...stockMovements, ...prev]);
      }
      if (lowStockWarnings.length > 0) {
        setTimeout(() => {
          showToast(`Low Stock Alert: ${lowStockWarnings.slice(0, 2).join(', ')}`, 'warning');
        }, 600);
      }

      // 1b. Connected Batch & Serial Lifecycle Sync on Sale
      if (newTx.type === 'Sale') {
        const saleDateShort = (newTx.date || new Date().toLocaleDateString('en-GB')).split(',')[0].trim();
        setBatches((prevBatches) => {
          const nextBatches = prevBatches.map((b) => ({ ...b }));
          newTx.items.forEach((line) => {
            const matchedInv = items.find(
              (i) => i.name.toLowerCase() === line.name.toLowerCase() || (line.hsn && i.code === line.hsn)
            );
            const rawDeduct = Number(line.qty || 0) + Number(line.freeQty || 0);
            let remainingToDeduct = matchedInv
              ? convertUnitQty(rawDeduct, line.unit || matchedInv.unit, matchedInv.unit, matchedInv.unitConversion, businessSettings.item.units)
              : rawDeduct;
            if (remainingToDeduct <= 0) return;
            const matchingIndices = nextBatches
              .map((b, idx) => ({ b, idx }))
              .filter(({ b }) => {
                const nameMatch = b.itemName.toLowerCase() === line.name.toLowerCase();
                if (!nameMatch || b.qty <= 0) return false;
                if (line.batchNo) return b.batchNumber.toLowerCase() === line.batchNo.toLowerCase();
                return true;
              })
              .sort((a, b) => (a.b.expiryDate || '9999-12-31').localeCompare(b.b.expiryDate || '9999-12-31'));

            for (const { idx } of matchingIndices) {
              if (remainingToDeduct <= 0) break;
              const take = Math.min(nextBatches[idx].qty, remainingToDeduct);
              nextBatches[idx].qty = Math.max(0, roundQtyPrecision(nextBatches[idx].qty - take, 6));
              remainingToDeduct = roundQtyPrecision(remainingToDeduct - take, 6);
            }
          });
          return nextBatches;
        });

        const soldSerialTargets = newTx.items
          .filter((li) => li.serialId || li.serialNo)
          .map((li) => ({ id: li.serialId, serialNo: li.serialNo?.toUpperCase() }));
        if (soldSerialTargets.length > 0) {
          setSerialNumbers((prevSerials) =>
            prevSerials.map((s) => {
              const hit = soldSerialTargets.some(
                (t) => (t.id && s.id === t.id) || (t.serialNo && s.serialNo.toUpperCase() === t.serialNo)
              );
              return hit
                ? {
                    ...s,
                    status: 'Sold',
                    customerName: newTx.partyName || 'Walk-in Customer',
                    saleDate: saleDateShort,
                  }
                : s;
            })
          );
        }
      }
    }

    // 2. Party Balance Accounting
    const isSupplierPaymentOut =
      newTx.type === 'Purchase' &&
      (newTx.invoiceNo.startsWith('PAYOUT-') ||
        Boolean(newTx.notes && newTx.notes.toLowerCase().includes('payment-out')) ||
        ((!newTx.items || newTx.items.length === 0) && (newTx.balance || 0) === 0));

    if (newTx.partyName && newTx.partyName !== 'Cash Sale') {
      setParties((prevParties) => {
        return prevParties.map((p) => {
          if (p.name.toLowerCase() === newTx.partyName.toLowerCase()) {
            if (newTx.type === 'Sale') {
              // Outstanding credit balance increases
              return { ...p, balance: Math.round((p.balance + newTx.balance) * 100) / 100 };
            } else if (newTx.type === 'Payment-In') {
              // Payment clears party balance
              return { ...p, balance: Math.max(0, Math.round((p.balance - newTx.receivedAmount) * 100) / 100) };
            } else if (newTx.type === 'Purchase') {
              if (isSupplierPaymentOut) {
                const paidOut = newTx.receivedAmount || newTx.totalAmount || 0;
                return { ...p, balance: Math.max(0, Math.round((p.balance - paidOut) * 100) / 100) };
              }
              // Outstanding payable to supplier increases
              return { ...p, balance: Math.round((p.balance + newTx.balance) * 100) / 100 };
            } else if (newTx.type === 'Purchase Return') {
              // Debit note / purchase return reduces supplier payable
              return { ...p, balance: Math.max(0, Math.round((p.balance - newTx.totalAmount) * 100) / 100) };
            } else if (newTx.type === 'Sale Return') {
              // Credit note decreases customer debt
              return { ...p, balance: Math.max(0, Math.round((p.balance - newTx.totalAmount) * 100) / 100) };
            }
          }
          return p;
        });
      });
    }

    // 2b. Salesperson Commission Attribution on Sale
    if (newTx.type === 'Sale' && !newTx.isCancelled && (newTx.salesperson || newTx.user)) {
      const actorName = (newTx.salesperson || newTx.user || '').trim().toLowerCase();
      if (actorName) {
        setEmployees((prevEmps) =>
          prevEmps.map((emp) => {
            if (emp.name.trim().toLowerCase() === actorName || emp.employeeId.toLowerCase() === actorName) {
              const saleVal = newTx.totalAmount || 0;
              const commEarned = Math.round(((saleVal * (emp.commissionRatePercent || 0)) / 100) * 100) / 100;
              return {
                ...emp,
                ordersHandled: (emp.ordersHandled || 0) + 1,
                totalSalesAchieved: Math.round(((emp.totalSalesAchieved || 0) + saleVal) * 100) / 100,
                totalCommissionEarned: Math.round(((emp.totalCommissionEarned || 0) + commEarned) * 100) / 100,
              };
            }
            return emp;
          })
        );
      }
    }

    setTransactions((prev) => [newTx, ...prev]);

    // Auto-post Double-Entry Journal Voucher
    const autoJv = autoBuildJournalFromTransaction(newTx, currentUser?.name || 'System');
    if (autoJv) {
      setJournalVouchers((prev) => [autoJv, ...prev]);
    }

    // Update next invoice number if numeric
    const parsedNo = parseInt(newTx.invoiceNo, 10);
    if (!isNaN(parsedNo) && parsedNo >= settings.nextInvoiceNumber) {
      setSettings((s) => ({ ...s, nextInvoiceNumber: parsedNo + 1 }));
    }

    recordActivity(
      `Created ${newTx.type}`,
      newTx.type === 'Purchase' ? 'Purchase' : 'Billing',
      `Invoice #${newTx.invoiceNo} for ${newTx.partyName} (₹ ${newTx.totalAmount.toLocaleString('en-IN')})`,
      {
        targetId: newTx.id,
        targetType: 'Invoice',
        afterState: {
          invoiceNo: newTx.invoiceNo,
          type: newTx.type,
          partyName: newTx.partyName,
          totalAmount: newTx.totalAmount,
          paymentType: newTx.paymentType,
          itemsCount: newTx.items?.length || 0,
        },
        outcome: 'Success',
      }
    );

    showToast(`${newTx.type} #${newTx.invoiceNo} saved successfully!`);
    return newTx;
  };

  const updateTransaction = (id: string, txData: Partial<Transaction>) => {
    if (!hasPermission('edit')) {
      showToast('Permission Denied: Your assigned role cannot edit existing vouchers.');
      recordActivity('Unauthorized Edit Attempt', 'Billing', `Denied edit attempt on transaction ID ${id}`, {
        targetId: id,
        targetType: 'Invoice',
        outcome: 'Denied',
      });
      return;
    }
    const previous = transactions.find((t) => t.id === id);
    const lockedMatch = isDateInLockedPeriod(txData.date || previous?.date, businessSettings);
    if (lockedMatch.locked) {
      showToast(`Financial Period "${lockedMatch.periodLabel || 'Locked'}" is locked. Cannot edit transactions in this period.`, 'error');
      return;
    }
    const actorName = currentUser?.name || 'Admin';
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const snapshot = createTransactionSnapshot(t, actorName, 'Auto-saved before edit');
        const nextHistory = [snapshot, ...(t.versionHistory || [])].slice(0, 25);
        const nextAct = [
          {
            id: generateUniqueId('act'),
            timestamp: new Date().toISOString(),
            action: 'Edited' as const,
            actor: actorName,
            details: `Updated voucher #${t.invoiceNo}`,
          },
          ...(t.activityHistory || []),
        ].slice(0, 40);
        return {
          ...t,
          ...txData,
          version: (t.version || 1) + 1,
          versionHistory: txData.versionHistory ?? nextHistory,
          activityHistory: txData.activityHistory ?? nextAct,
        };
      })
    );
    recordActivity(
      'Updated Transaction',
      'Billing',
      `Modified invoice #${previous?.invoiceNo || id} (${previous?.type || 'Invoice'})`,
      {
        targetId: id,
        targetType: 'Invoice',
        beforeState: previous
          ? {
              invoiceNo: previous.invoiceNo,
              partyName: previous.partyName,
              totalAmount: previous.totalAmount,
              receivedAmount: previous.receivedAmount,
              balance: previous.balance,
              status: previous.status,
            }
          : undefined,
        afterState: {
          ...txData,
        },
        outcome: 'Success',
      }
    );
    showToast('Transaction updated successfully');
  };

  const deleteTransaction = (id: string): boolean => {
    if (!hasPermission('delete')) {
      showToast('Permission Denied: Your assigned role cannot delete transactions.');
      recordActivity('Unauthorized Delete Attempt', 'Billing', `Denied deletion attempt on transaction ID ${id}`, {
        targetId: id,
        targetType: 'Invoice',
        outcome: 'Denied',
      });
      return false;
    }
    const target = transactions.find((t) => t.id === id);
    if (!target) return false;
    const lockedMatch = isDateInLockedPeriod(target.date, businessSettings);
    if (lockedMatch.locked) {
      showToast(`Financial Period "${lockedMatch.periodLabel || 'Locked'}" is locked. Cannot delete vouchers in this period.`, 'error');
      return false;
    }

    // Reverse stock accounting on transaction deletion (skip if already cancelled to avoid double reversal)
    if (!target.isCancelled && target.items && target.items.length > 0) {
      setItems((prevItems) => {
        const updated = [...prevItems];
        target.items.forEach((line) => {
          const itemIdx = updated.findIndex(
            (i) => i.name.toLowerCase() === line.name.toLowerCase() || (line.hsn && i.code === line.hsn)
          );
          if (itemIdx >= 0) {
            const currentItem = updated[itemIdx];
            const rawQty = Number(line.qty || 0) + Number(line.freeQty || 0);
            const baseQty = convertUnitQty(
              rawQty,
              line.unit || currentItem.unit,
              currentItem.unit,
              currentItem.unitConversion,
              businessSettings.item.units
            );
            if (target.type === 'Sale' || target.type === 'Sale Order') {
              updated[itemIdx] = { ...currentItem, stock: roundQtyPrecision(currentItem.stock + baseQty, 6) };
            } else if (target.type === 'Purchase') {
              updated[itemIdx] = { ...currentItem, stock: roundQtyPrecision(currentItem.stock - baseQty, 6) };
            } else if (target.type === 'Sale Return') {
              updated[itemIdx] = { ...currentItem, stock: roundQtyPrecision(currentItem.stock - baseQty, 6) };
            }
          }
        });
        return updated;
      });
    }

    // Reverse party balance adjustment
    if (target.partyName && target.partyName !== 'Cash Sale') {
      setParties((prevParties) => {
        return prevParties.map((p) => {
          if (p.name.toLowerCase() === target.partyName.toLowerCase()) {
            if (target.type === 'Sale') {
              return { ...p, balance: Math.max(0, Math.round((p.balance - target.balance) * 100) / 100) };
            } else if (target.type === 'Purchase') {
              return { ...p, balance: Math.max(0, Math.round((p.balance - target.balance) * 100) / 100) };
            }
          }
          return p;
        });
      });
    }

    setTransactions((prev) => prev.filter((t) => t.id !== id));

    const binId = generateUniqueId('bin');
    const nowTime = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const binEntry: RecycleBinRecord = {
      id: binId,
      entityType: 'Transaction',
      label: `${target.type} #${target.invoiceNo}`,
      subLabel: `${target.partyName} • ₹${(target.totalAmount || 0).toLocaleString('en-IN')}`,
      deletedAt: nowTime,
      deletedBy: currentUser?.name || 'Admin',
      payload: target,
    };
    setRecycleBin((prev) => [binEntry, ...prev]);

    recordActivity(
      'Moved Transaction to Recycle Bin',
      'Billing',
      `Moved #${target.invoiceNo} (${target.type}) of ₹${target.totalAmount.toLocaleString('en-IN')} to Recycle Bin`,
      {
        targetId: target.id,
        targetType: 'Invoice',
        beforeState: {
          invoiceNo: target.invoiceNo,
          type: target.type,
          partyName: target.partyName,
          totalAmount: target.totalAmount,
        },
        outcome: 'Success',
      }
    );
    showToast(`#${target.invoiceNo} moved to Recycle Bin`, 'info', {
      label: 'Undo',
      onUndo: () => {
        setRecycleBin((prev) => prev.filter((r) => r.id !== binId));
        setTransactions((prev) => [target, ...prev]);
        showToast(`Restored #${target.invoiceNo}`, 'success');
      },
    });
    return true;
  };

  const clearTransactions = () => {
    if (!hasPermission('delete')) {
      showToast('Permission Denied: Only Owner or Admin can wipe records.');
      return;
    }
    safeSetStoredData('bm360_db_initialized', true);
    putKV('preferences', 'db_initialized', true);
    setTransactions([]);
    recordActivity('Wiped Transactions', 'Settings', 'Cleared all transaction records');
    showToast('All transactions cleared');
  };

  const loadDemoData = () => {
    safeSetStoredData('bm360_db_initialized', true);
    putKV('preferences', 'db_initialized', true);
    setTransactions(DEMO_TRANSACTIONS);
    setParties(INITIAL_PARTIES);
    setItems(INITIAL_ITEMS);
    showToast('Demo transactions loaded');
  };

  const restoreFullBackup = async (backupData: Record<string, any>) => {
    const restoredCounts: Record<string, number> = {};

    if (backupData.company && typeof backupData.company === 'object') {
      setCompany((prev) => ({ ...prev, ...backupData.company }));
      restoredCounts.company = 1;
    }
    if (backupData.settings && typeof backupData.settings === 'object') {
      setSettings((prev) => ({ ...prev, ...backupData.settings }));
      restoredCounts.settings = 1;
    }
    if (Array.isArray(backupData.transactions)) {
      setTransactions(backupData.transactions);
      await syncTransactionsToStores(backupData.transactions);
      restoredCounts.transactions = backupData.transactions.length;
    }
    if (Array.isArray(backupData.parties)) {
      setParties(backupData.parties);
      await syncPartiesToStores(backupData.parties);
      restoredCounts.parties = backupData.parties.length;
    }
    if (Array.isArray(backupData.items)) {
      setItems(backupData.items);
      await syncItemsToStores(backupData.items);
      restoredCounts.products = backupData.items.length;
    }
    if (Array.isArray(backupData.users)) {
      setUsers(backupData.users);
      await replaceStoreRecords('users', backupData.users);
      restoredCounts.users = backupData.users.length;
    }
    if (Array.isArray(backupData.roles)) {
      setRoles(backupData.roles);
      await replaceStoreRecords('roles', backupData.roles);
      restoredCounts.roles = backupData.roles.length;
    }
    if (Array.isArray(backupData.employees)) {
      setEmployees(backupData.employees);
      await replaceStoreRecords('employees', backupData.employees);
      restoredCounts.employees = backupData.employees.length;
    }
    if (Array.isArray(backupData.attendanceRecords)) {
      setAttendanceRecords(backupData.attendanceRecords);
      await replaceStoreRecords('attendance', backupData.attendanceRecords);
    }
    if (backupData.preferences && typeof backupData.preferences === 'object') {
      if (typeof backupData.preferences.sidebarCollapsed === 'boolean') {
        setSidebarCollapsed(backupData.preferences.sidebarCollapsed);
      }
      if (backupData.preferences.expandedSidebarGroups) {
        setExpandedSidebarGroups(backupData.preferences.expandedSidebarGroups);
      }
    }

    safeSetStoredData('bm360_db_initialized', true);
    await putKV('preferences', 'db_initialized', true);
    await refreshDbStats();
    await syncNowWithServer();
    recordActivity('Restored JSON Backup', 'Settings', 'Restored full business backup across online workspace');
    return { restoredCounts };
  };

  const exportModuleCsv = (
    module: 'products' | 'customers' | 'suppliers' | 'sales' | 'purchases' | 'expenses' | 'income' | 'ledgers'
  ) => {
    const dateTag = new Date().toISOString().slice(0, 10);

    if (module === 'products') {
      exportCsvFile(
        `BM360_Products_${dateTag}.csv`,
        ['ID', 'Name', 'Code / HSN', 'Category', 'Unit', 'Stock', 'Sale Price (INR)', 'Purchase Price (INR)', 'GST %'],
        items.map((i) => [i.id, i.name, i.code, i.category, i.unit, i.stock, i.salePrice, i.purchasePrice, i.taxRate])
      );
      showToast(`Exported ${items.length} products to CSV`);
      return;
    }

    if (module === 'customers' || module === 'suppliers') {
      const targetType = module === 'customers' ? 'Customer' : 'Supplier';
      const filtered = parties.filter((p) => (p.type || 'Customer') === targetType);
      exportCsvFile(
        `BM360_${targetType}s_${dateTag}.csv`,
        ['ID', 'Name', 'Type', 'Phone', 'Email', 'GSTIN', 'Address', 'State', 'Opening/Current Balance (INR)', 'Credit Limit'],
        filtered.map((p) => [p.id, p.name, p.type, p.phone, p.email, p.gstin, p.address, p.state || '', p.balance, p.creditLimit || 0])
      );
      showToast(`Exported ${filtered.length} ${module} to CSV`);
      return;
    }

    if (module === 'sales' || module === 'purchases' || module === 'expenses' || module === 'income') {
      const filtered = transactions.filter((t) => {
        if (module === 'sales') return ['Sale', 'Estimate', 'Proforma', 'Sale Order', 'Delivery Challan', 'Sale Return'].includes(t.type);
        if (module === 'purchases') return t.type === 'Purchase';
        if (module === 'expenses') return t.type === 'Expense';
        return t.type === 'Other Income';
      });
      exportCsvFile(
        `BM360_${module}_${dateTag}.csv`,
        ['Invoice No', 'Type', 'Date', 'Party Name', 'Payment Mode', 'Taxable (INR)', 'Total GST (INR)', 'Total Amount (INR)', 'Received (INR)', 'Balance (INR)', 'Status'],
        filtered.map((t) => [
          t.invoiceNo,
          t.type,
          t.date,
          t.partyName,
          t.paymentType,
          t.taxableAmount ?? t.subtotal ?? t.totalAmount,
          (t.cgstAmount || 0) + (t.sgstAmount || 0) + (t.igstAmount || 0),
          t.totalAmount,
          t.receivedAmount,
          t.balance,
          t.isCancelled ? 'Cancelled' : t.status,
        ])
      );
      showToast(`Exported ${filtered.length} ${module} records to CSV`);
      return;
    }

    // Ledgers
    const activeTx = transactions.filter((t) => !t.isCancelled);
    exportCsvFile(
      `BM360_Ledgers_${dateTag}.csv`,
      ['Voucher No', 'Date', 'Party Name', 'Account Type', 'Payment Mode', 'Debit (INR)', 'Credit (INR)', 'Outstanding Balance (INR)'],
      activeTx.map((t) => {
        const isCredit = ['Sale', 'Other Income', 'Payment-In'].includes(t.type);
        return [
          t.invoiceNo,
          t.date,
          t.partyName,
          t.type,
          t.paymentType,
          isCredit ? 0 : t.totalAmount,
          isCredit ? t.totalAmount : 0,
          t.balance,
        ];
      })
    );
    showToast(`Exported ${activeTx.length} ledger entries to CSV`);
  };

  const addParty = (partyData: Omit<Party, 'id'>): Party => {
    if (!hasPermission('customer') && !hasPermission('supplier')) {
      showToast('Permission Denied: Cannot add parties.');
    }
    const newParty: Party = {
      ...partyData,
      status: partyData.status || 'Active',
      id: generateUniqueId('p'),
    };
    setParties((prev) => [...prev, newParty]);
    recordActivity('Added Party', 'Sales', `Created party "${newParty.name}" (${newParty.type})`);
    showToast(`Party ${newParty.name} added`);
    return newParty;
  };

  const updateParty = (
    partyId: string,
    updates: Partial<Party>
  ): { success: boolean; message: string } => {
    if (!hasPermission('customer') && !hasPermission('supplier')) {
      showToast('Permission Denied: Cannot modify parties.', 'error');
      return { success: false, message: 'Permission Denied' };
    }
    const target = parties.find((p) => p.id === partyId);
    if (!target) return { success: false, message: 'Party not found' };
    setParties((prev) => prev.map((p) => (p.id === partyId ? { ...p, ...updates } : p)));
    recordActivity('Updated Party', 'Sales', `Updated "${updates.name || target.name}"`);
    showToast(`Party "${updates.name || target.name}" updated`, 'success');
    return { success: true, message: 'Party updated' };
  };

  const addItem = (itemData: Omit<Item, 'id'>): Item => {
    if (!hasPermission('product')) {
      showToast('Permission Denied: Cannot add inventory items.', 'error');
    }

    const cleanCode = String(itemData.code || '').trim();
    if (cleanCode) {
      const codeDup = items.find(
        (it) => it.code.trim().toLowerCase() === cleanCode.toLowerCase()
      );
      if (codeDup) {
        showToast(
          `Duplicate Item Code: "${cleanCode}" is already assigned to "${codeDup.name}".`,
          'error'
        );
        return codeDup;
      }
    }

    const requestedBarcode = normalizeBarcode(itemData.barcode || '');
    if (requestedBarcode) {
      const check = isBarcodeUnique(items, requestedBarcode);
      if (!check.unique && check.conflictItem) {
        showToast(
          `Duplicate Barcode: "${requestedBarcode}" is already assigned to "${check.conflictItem.name}".`,
          'error'
        );
        return check.conflictItem;
      }
    }

    const finalBarcode =
      requestedBarcode || generateUniqueEan13Barcode(items, `${itemData.name}-${itemData.code}`);
    const nowIso = new Date().toISOString();
    const nowTs = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const newItem: Item = {
      ...itemData,
      id: generateUniqueId('i'),
      code: cleanCode || `ITM-${String(items.length + 1).padStart(3, '0')}`,
      barcode: finalBarcode,
      minStockAlert: itemData.minStockAlert ?? 5,
      isActive: itemData.isActive ?? true,
      createdAt: itemData.createdAt || nowIso,
      priceHistory: itemData.priceHistory || [
        {
          id: generateUniqueId('ph'),
          timestamp: nowTs,
          actor: currentUser?.name || 'Admin',
          field: 'Opening Retail Price',
          oldValue: 0,
          newValue: Number(itemData.salePrice) || 0,
          reason: 'Initial Item Creation',
        },
      ],
    };
    setItems((prev) => [...prev, newItem]);

    if (newItem.stock > 0) {
      setStockHistory((prev) => [
        {
          id: generateUniqueId('stk'),
          itemId: newItem.id,
          itemName: newItem.name,
          type: 'PURCHASE_INWARD',
          qtyChange: newItem.stock,
          stockAfter: newItem.stock,
          reservedAfter: 0,
          referenceNo: `OPEN-${newItem.code || newItem.id}`,
          actor: currentUser?.name || 'Admin',
          timestamp: nowTs,
          notes: 'Opening Stock',
        },
        ...prev,
      ]);
    }

    if (newItem.batchNo && newItem.stock > 0) {
      setBatches((prev) => [
        {
          id: generateUniqueId('bat'),
          itemId: newItem.id,
          itemName: newItem.name,
          batchNumber: newItem.batchNo!,
          mfgDate: new Date().toISOString().slice(0, 10),
          expiryDate: newItem.expiryDate || '',
          qty: newItem.stock,
          purchaseRate: newItem.purchasePrice || 0,
          saleRate: newItem.salePrice || 0,
        },
        ...prev,
      ]);
    }

    recordActivity(
      'Added Item',
      'Inventory',
      `Created product "${newItem.name}" (${newItem.code}) • Barcode: ${newItem.barcode}`
    );
    showToast(`Item ${newItem.name} added (Barcode: ${newItem.barcode})`, 'success');
    return newItem;
  };

  const updateItem = (
    itemId: string,
    updates: Partial<Item>
  ): { success: boolean; message: string } => {
    if (!canManageBarcodes() && !hasPermission('product')) {
      showToast('Permission Denied: Authorized Admin/Inventory permission required to edit products or barcodes.', 'error');
      return { success: false, message: 'Permission denied' };
    }

    const existing = items.find((it) => it.id === itemId);
    if (!existing) {
      return { success: false, message: 'Product not found' };
    }

    if (updates.code !== undefined) {
      const cleanCode = String(updates.code || '').trim();
      if (!cleanCode) {
        showToast('Item Code cannot be empty.', 'warning');
        return { success: false, message: 'Item Code cannot be empty' };
      }
      const codeDup = items.find(
        (it) => it.id !== itemId && it.code.trim().toLowerCase() === cleanCode.toLowerCase()
      );
      if (codeDup) {
        const msg = `Duplicate Item Code: "${cleanCode}" already belongs to "${codeDup.name}".`;
        showToast(msg, 'error');
        return { success: false, message: msg };
      }
      updates = { ...updates, code: cleanCode };
    }

    if (updates.barcode !== undefined) {
      const cleanBarcode = normalizeBarcode(updates.barcode);
      if (cleanBarcode) {
        const check = isBarcodeUnique(items, cleanBarcode, itemId);
        if (!check.unique && check.conflictItem) {
          const msg = `Barcode "${cleanBarcode}" already belongs to "${check.conflictItem.name}". Barcodes must be unique.`;
          showToast(msg, 'error');
          return { success: false, message: msg };
        }
      }
      updates = {
        ...updates,
        barcode: cleanBarcode || existing.barcode || generateUniqueEan13Barcode(items, existing.id),
      };
    }

    const nowTs = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const actor = currentUser?.name || 'Admin';

    // Track price change audit entries automatically
    const priceAuditFields: Array<{ key: keyof Item; label: string }> = [
      { key: 'purchasePrice', label: 'Purchase Price' },
      { key: 'salePrice', label: 'Retail Selling Price' },
      { key: 'wholesalePrice', label: 'Wholesale Price' },
      { key: 'dealerPrice', label: 'Distributor Price' },
      { key: 'mrp', label: 'MRP' },
    ];
    const newPriceEntries: NonNullable<Item['priceHistory']> = [];
    priceAuditFields.forEach(({ key, label }) => {
      if (updates[key] !== undefined && Number(updates[key] || 0) !== Number(existing[key] || 0)) {
        newPriceEntries.push({
          id: generateUniqueId('ph'),
          timestamp: nowTs,
          actor,
          field: label,
          oldValue: Number(existing[key] || 0),
          newValue: Number(updates[key] || 0),
        });
      }
    });

    const mergedPriceHistory =
      newPriceEntries.length > 0
        ? [...newPriceEntries, ...(existing.priceHistory || [])].slice(0, 50)
        : updates.priceHistory ?? existing.priceHistory;

    if (updates.stock !== undefined && Number(updates.stock) !== Number(existing.stock)) {
      const delta = Number(updates.stock) - Number(existing.stock);
      setStockHistory((prev) => [
        {
          id: generateUniqueId('stk'),
          itemId: existing.id,
          itemName: updates.name || existing.name,
          type: 'MANUAL_ADJUSTMENT',
          qtyChange: delta,
          stockAfter: Number(updates.stock),
          reservedAfter: updates.reservedStock ?? existing.reservedStock ?? 0,
          referenceNo: `EDIT-${existing.code}`,
          actor,
          timestamp: nowTs,
          notes: 'Updated from Item Master Edit',
        },
        ...prev,
      ]);
    }

    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, ...updates, priceHistory: mergedPriceHistory } : it
      )
    );
    recordActivity(
      'Updated Product',
      'Inventory',
      `Updated "${updates.name || existing.name}" (Barcode: ${updates.barcode || existing.barcode})`
    );
    showToast(`Updated "${updates.name || existing.name}"`, 'success');
    return { success: true, message: 'Product updated' };
  };

  const recordPurchaseReturn = (input: {
    supplierName: string;
    originalBillNo?: string;
    items: InvoiceItem[];
    reason: string;
  }): { success: boolean; message: string; transaction?: Transaction } => {
    if (!input.supplierName || !input.items.length) {
      return { success: false, message: 'Supplier and at least one return item are required.' };
    }
    const totalAmount = Math.round(input.items.reduce((s, li) => s + (Number(li.amount) || 0), 0) * 100) / 100;
    const now = new Date();
    const nowStr = `${now.toLocaleDateString('en-GB')}, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const created = addTransaction({
      type: 'Purchase Return',
      invoiceNo: `PR-${Date.now().toString().slice(-5)}`,
      date: nowStr,
      partyName: input.supplierName,
      firm: company.name,
      user: currentUser?.name || 'Admin',
      paymentType: 'Credit',
      totalAmount,
      receivedAmount: 0,
      balance: 0,
      dueDate: nowStr.split(',')[0],
      status: 'Paid',
      items: input.items,
      originalInvoiceNo: input.originalBillNo,
      returnReason: input.reason,
      notes: `Purchase Return${input.originalBillNo ? ` against Bill #${input.originalBillNo}` : ''}: ${input.reason}`,
      source: 'MANUAL',
    });
    if (!created) return { success: false, message: 'Permission denied or invalid purchase return.' };
    showToast(`Purchase Return #${created.invoiceNo} recorded (₹${totalAmount.toLocaleString('en-IN')})`, 'success');
    return { success: true, message: 'Purchase return recorded.', transaction: created };
  };

  const recordUdharEntry = (input: {
    partyId: string;
    kind: 'GIVE_UDHAAR' | 'RECEIVE_PAYMENT';
    amount: number;
    paymentMode?: Transaction['paymentType'];
    dueDate?: string;
    notes?: string;
  }): { success: boolean; message: string; transaction?: Transaction } => {
    const party = parties.find((p) => p.id === input.partyId);
    const amount = Math.round((Number(input.amount) || 0) * 100) / 100;
    if (!party || amount <= 0) {
      return { success: false, message: 'Select a customer and enter an amount greater than ₹0.' };
    }
    const now = new Date();
    const nowStr = `${now.toLocaleDateString('en-GB')}, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const defaultDue = new Date(Date.now() + (party.creditPeriodDays || 15) * 86400000).toLocaleDateString('en-GB');

    if (input.kind === 'GIVE_UDHAAR') {
      const tx = addTransaction({
        type: 'Sale',
        invoiceNo: `UDH-${Date.now().toString().slice(-5)}`,
        date: nowStr,
        partyName: party.name,
        partyPhone: party.phone,
        partyAddress: party.address,
        partyGstin: party.gstin,
        firm: company.name,
        user: currentUser?.name || 'Admin',
        paymentType: 'Credit',
        totalAmount: amount,
        receivedAmount: 0,
        balance: amount,
        dueDate: input.dueDate || defaultDue,
        status: 'Unpaid',
        items: [],
        skipStockDeduction: true,
        notes: `[UDHAAR KHATA] ${input.notes || 'Credit given to customer'}`,
        source: 'MANUAL',
      });
      if (!tx) return { success: false, message: 'Could not record Udhaar entry.' };
      showToast(`Added ₹${amount.toLocaleString('en-IN')} Udhaar for ${party.name}`, 'info');
      return { success: true, message: 'Udhaar entry saved.', transaction: tx };
    } else {
      const mode = input.paymentMode || 'Cash';
      const tx = addTransaction({
        type: 'Payment-In',
        invoiceNo: `UCR-${Date.now().toString().slice(-5)}`,
        date: nowStr,
        partyName: party.name,
        partyPhone: party.phone,
        firm: company.name,
        user: currentUser?.name || 'Admin',
        paymentType: mode,
        totalAmount: amount,
        receivedAmount: amount,
        balance: 0,
        dueDate: nowStr.split(',')[0],
        status: 'Paid',
        items: [],
        skipStockDeduction: true,
        notes: `[UDHAAR COLLECTION - ${mode}] ${input.notes || 'Payment received towards Udhaar Khata'}`,
        source: 'MANUAL',
      });
      if (!tx) return { success: false, message: 'Could not record payment.' };
      showToast(`Received ₹${amount.toLocaleString('en-IN')} from ${party.name} via ${mode}`, 'success');
      return { success: true, message: 'Payment received.', transaction: tx };
    }
  };

  const executeConfirmedAiAction = (
    action: AiAssistantProposedAction
  ): { success: boolean; message: string } => {
    if (!action || action.actionType === 'NONE') {
      return { success: false, message: 'No executable action specified.' };
    }
    if (action.actionType === 'CREATE_PURCHASE_ORDER') {
      const targetItem =
        items.find((i) => i.id === action.itemId) ||
        items.find((i) => action.itemName && i.name.toLowerCase() === action.itemName.toLowerCase());
      const qty = Math.max(1, Math.round(Number(action.qty) || 20));
      const unitPrice = Number(action.unitPrice) || targetItem?.purchasePrice || 100;
      const taxPct = targetItem?.taxRate ?? 5;
      const lineTotal = Math.round(qty * unitPrice * (1 + taxPct / 100) * 100) / 100;
      const supplier =
        action.supplierName ||
        targetItem?.lastPurchaseSupplier ||
        parties.find((p) => p.type === 'Supplier')?.name ||
        'Hindustan Unilever Distributor';
      const now = new Date();
      const nowStr = `${now.toLocaleDateString('en-GB')}, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const poTx = addTransaction({
        type: 'Purchase',
        invoiceNo: `PO-AI-${Date.now().toString().slice(-4)}`,
        date: nowStr,
        partyName: supplier,
        firm: company.name,
        user: currentUser?.name || 'AI Confirmed',
        paymentType: 'Credit',
        totalAmount: lineTotal,
        receivedAmount: 0,
        balance: lineTotal,
        dueDate: new Date(Date.now() + 15 * 86400000).toLocaleDateString('en-GB'),
        status: 'Unpaid',
        items: [
          {
            id: generateUniqueId('li'),
            name: targetItem?.name || action.itemName || 'Restock Item',
            hsn: targetItem?.code || '2106',
            qty,
            unit: targetItem?.unit || 'PCS',
            price: unitPrice,
            discountPercent: 0,
            taxPercent: taxPct,
            amount: lineTotal,
          },
        ],
        skipStockDeduction: true,
        notes: `[AI CONFIRMED PO] ${action.description || action.title}`,
        source: 'MANUAL',
      });
      if (!poTx) return { success: false, message: 'Failed to create confirmed purchase draft.' };
      showToast(`Confirmed & saved Purchase Order/Bill #${poTx.invoiceNo} for ${supplier}`, 'success');
      return { success: true, message: `Created Purchase #${poTx.invoiceNo} for ${supplier}.` };
    }
    if (action.actionType === 'ADJUST_MIN_STOCK') {
      const targetItem =
        items.find((i) => i.id === action.itemId) ||
        items.find((i) => action.itemName && i.name.toLowerCase() === action.itemName.toLowerCase());
      if (!targetItem) return { success: false, message: 'Target product not found.' };
      const minVal = Math.max(1, Math.round(Number(action.newMinStock) || 10));
      return updateItem(targetItem.id, { minStockAlert: minVal });
    }
    if (action.actionType === 'CREATE_STOCK_ADJUSTMENT') {
      const targetItem =
        items.find((i) => i.id === action.itemId) ||
        items.find((i) => action.itemName && i.name.toLowerCase() === action.itemName.toLowerCase());
      if (!targetItem) return { success: false, message: 'Target product not found.' };
      const nextQty = Math.max(0, Math.round(Number(action.qty) ?? targetItem.stock));
      adjustStock(targetItem.id, nextQty, action.description || 'AI Assistant confirmed adjustment');
      return { success: true, message: `Updated stock of ${targetItem.name} to ${nextQty}.` };
    }
    return { success: false, message: 'Unsupported action type.' };
  };

  const updateCompany = (profile: Partial<CompanyProfile>) => {
    if (!hasPermission('settings')) {
      showToast('Permission Denied: Only Business Owner can modify company credentials.');
      return;
    }
    setCompany((prev) => ({ ...prev, ...profile }));
    recordActivity('Updated Company Profile', 'Settings', `Modified business details for ${profile.name || company.name}`);
    showToast('Company profile updated');
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    if (!hasPermission('settings')) {
      showToast('Permission Denied: Only Business Owner can modify system settings.');
      return;
    }
    setSettings((prev) => ({ ...prev, ...newSettings }));
    recordActivity('Updated Settings', 'Settings', 'Saved application configuration');
    showToast('Settings saved');
  };

  // Upgrade 02: Advanced Billing & Conversion Operations
  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplateType>(() =>
    settings.defaultInvoiceTemplate || 'gst-tax-invoice'
  );

  const getNextDocumentNumber = (
    docType: SequenceDocumentType,
    options?: { branchCode?: string; warehouseCode?: string }
  ): string => {
    const seq = businessSettings.transaction.sequences.find((s) => s.docType === docType);
    if (!seq) {
      const fallbackMap: Partial<Record<SequenceDocumentType, string>> = {
        Expense: 'EXP-',
        'Other Income': 'INC-',
        'Journal Voucher': 'JV-',
        'Stock Adjustment': 'ADJ-',
        'Stock Transfer': 'TRF-',
        'Purchase Order': 'PO-',
        'Proforma Invoice': 'PI-',
      };
      const prefix = fallbackMap[docType] || settings.invoicePrefix || 'INV-';
      const num = String(
        (fallbackMap[docType] ? transactions.length + 1 : settings.nextInvoiceNumber) || 1
      ).padStart(settings.invoicePadding || 4, '0');
      const suffix = settings.invoiceSuffix || '';
      return `${prefix}${num}${suffix}`;
    }
    const periodKey = getResetPeriodKey(seq.resetPolicy, businessSettings.general.financialYearLabel || 'FY26-27');
    const shouldReset = Boolean(seq.resetPolicy && seq.resetPolicy !== 'Never' && seq.lastResetPeriodKey && seq.lastResetPeriodKey !== periodKey);
    const effectiveSeq = shouldReset ? { ...seq, nextNumber: seq.startNumber || 1 } : seq;
    return formatSequenceNumber(effectiveSeq, {
      financialYearLabel: businessSettings.general.financialYearLabel || 'FY26-27',
      branchCode: options?.branchCode,
      warehouseCode: options?.warehouseCode,
    });
  };

  const getNextFormattedInvoiceNo = (): string => {
    return getNextDocumentNumber('Sales Invoice');
  };

  const isInvoiceNumberDuplicate = (invoiceNo: string, excludeId?: string): boolean => {
    if (!invoiceNo || !invoiceNo.trim()) return false;
    return transactions.some(
      (t) => t.id !== excludeId && t.invoiceNo.trim().toLowerCase() === invoiceNo.trim().toLowerCase()
    );
  };

  const checkPartyCreditLimit = (partyName: string, additionalBalance: number) => {
    if (!partyName || partyName === 'Cash Sale') {
      return { exceeded: false, currentBalance: 0, creditLimit: 0, excess: 0 };
    }
    const party = parties.find((p) => p.name.toLowerCase() === partyName.toLowerCase());
    if (!party || !party.creditLimit || party.creditLimit <= 0) {
      return { exceeded: false, currentBalance: party?.balance || 0, creditLimit: 0, excess: 0 };
    }
    const currentBalance = party.balance || 0;
    const projectedBalance = currentBalance + additionalBalance;
    const exceeded = projectedBalance > party.creditLimit;
    const excess = Math.max(0, projectedBalance - party.creditLimit);
    return { exceeded, currentBalance, creditLimit: party.creditLimit, excess };
  };

  const convertEstimateToInvoice = (estimateId: string): Transaction | null => {
    const est = transactions.find((t) => t.id === estimateId);
    if (!est) {
      showToast('Error: Quotation not found.');
      return null;
    }
    const invNo = getNextFormattedInvoiceNo();
    const newTx = addTransaction({
      type: 'Sale',
      invoiceNo: invNo,
      date: `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      dueDate: est.dueDate || new Date().toLocaleDateString('en-GB'),
      partyName: est.partyName,
      partyPhone: est.partyPhone,
      partyAddress: est.partyAddress,
      partyGstin: est.partyGstin,
      firm: est.firm || company.name,
      user: currentUser?.name || 'Admin',
      paymentType: est.paymentType || 'Credit',
      totalAmount: est.totalAmount,
      receivedAmount: 0,
      balance: est.totalAmount,
      status: 'Unpaid',
      items: (est.items || []).map((it) => ({ ...it, id: generateUniqueId('li') })),
      notes: `Converted from Quotation #${est.invoiceNo}. ${est.notes || ''}`.trim(),
      stateOfSupply: est.stateOfSupply || company.state,
      gstType: est.gstType || 'Intra-State',
      subtotal: est.subtotal,
      totalDiscount: est.totalDiscount,
      taxableAmount: est.taxableAmount,
      cgstAmount: est.cgstAmount,
      sgstAmount: est.sgstAmount,
      igstAmount: est.igstAmount,
      roundOff: est.roundOff,
      convertedFrom: { type: 'Estimate', docId: est.id, docNo: est.invoiceNo },
    });

    if (newTx) {
      updateTransaction(est.id, {
        fulfillmentStatus: 'Completed',
        notes: `${est.notes || ''} [Converted to Sale Invoice #${newTx.invoiceNo}]`.trim(),
      });
      setSelectedInvoice(newTx);
      setIsInvoicePreviewOpen(true);
      showToast(`Quotation #${est.invoiceNo} successfully converted to Tax Invoice #${newTx.invoiceNo}!`);
    }
    return newTx;
  };

  const convertSalesOrderToInvoice = (orderId: string): Transaction | null => {
    if (activeSessionType === 'CUSTOMER') {
      showToast('Security Denied: Customers cannot convert orders to Sale Invoices.');
      return null;
    }
    const order = transactions.find((t) => t.id === orderId);
    if (!order) {
      showToast('Error: Sale order not found.');
      return null;
    }
    // Idempotency guard: prevent creating duplicate invoices for the same order
    if (order.linkedSaleInvoiceId) {
      const existingSale = transactions.find((t) => t.id === order.linkedSaleInvoiceId && !t.isCancelled);
      if (existingSale) {
        setSelectedInvoice(existingSale);
        setIsInvoicePreviewOpen(true);
        showToast(`Sale Order #${order.invoiceNo} is already linked to Invoice #${existingSale.invoiceNo}.`);
        return existingSale;
      }
    }
    if (order.source === 'ONLINE_STORE' && !order.deliveryOtpVerified) {
      showToast('Online store orders finalize into a GST Sale Invoice only after Customer Delivery OTP verification.');
      return null;
    }
    const invNo = getNextFormattedInvoiceNo();
    const newTx = addTransaction({
      type: 'Sale',
      invoiceNo: invNo,
      date: `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      dueDate: order.dueDate || new Date().toLocaleDateString('en-GB'),
      partyName: order.partyName,
      partyPhone: order.partyPhone,
      partyAddress: order.partyAddress,
      partyGstin: order.partyGstin,
      firm: order.firm || company.name,
      user: currentUser?.name || 'Admin',
      paymentType: order.paymentType || 'Credit',
      totalAmount: order.totalAmount,
      receivedAmount: order.receivedAmount || 0,
      balance: Math.max(0, order.totalAmount - (order.receivedAmount || 0)),
      status: (order.totalAmount - (order.receivedAmount || 0)) === 0 ? 'Paid' : (order.receivedAmount || 0) > 0 ? 'Partial' : 'Unpaid',
      items: (order.items || []).map((it) => ({ ...it, id: generateUniqueId('li') })),
      notes: `Fulfilled from Sale Order #${order.invoiceNo}. ${order.notes || ''}`.trim(),
      stateOfSupply: order.stateOfSupply || company.state,
      gstType: order.gstType || 'Intra-State',
      subtotal: order.subtotal,
      totalDiscount: order.totalDiscount,
      taxableAmount: order.taxableAmount,
      cgstAmount: order.cgstAmount,
      sgstAmount: order.sgstAmount,
      igstAmount: order.igstAmount,
      roundOff: order.roundOff,
      source: order.source,
      onlineOrderId: order.onlineOrderId,
      customerId: order.customerId,
      deliveryFee: order.deliveryFee,
      couponCode: order.couponCode,
      couponDiscount: order.couponDiscount,
      msCreditUsed: order.msCreditUsed,
      msCreditEarned: order.msCreditEarned,
      convertedFrom: { type: 'Sale Order', docId: order.id, docNo: order.invoiceNo },
    });

    if (newTx) {
      updateTransaction(order.id, {
        fulfillmentStatus: 'Completed',
        linkedSaleInvoiceId: newTx.id,
        linkedSaleInvoiceNo: newTx.invoiceNo,
        notes: `${order.notes || ''} [Fulfilled into Invoice #${newTx.invoiceNo}]`.trim(),
      });
      setSelectedInvoice(newTx);
      setIsInvoicePreviewOpen(true);
      showToast(`Sale Order #${order.invoiceNo} successfully converted to Tax Invoice #${newTx.invoiceNo}!`);
    }
    return newTx;
  };

  const convertChallanToInvoice = (
    challanId: string,
    customLines?: Array<{ itemId?: string; name: string; qtyToInvoice: number }>
  ): Transaction | null => {
    const challan = transactions.find((t) => t.id === challanId);
    if (!challan) {
      showToast('Error: Delivery challan not found.', 'error');
      return null;
    }
    if (challan.challanStatus === 'Cancelled') {
      showToast('Cancelled delivery challans cannot be invoiced.', 'error');
      return null;
    }

    // Calculate billable remaining quantities: Dispatched - Returned (Accepted + Damaged) - Already Invoiced
    const invoiceItems: InvoiceItem[] = [];
    const updatedChallanItems = (challan.items || []).map((line) => {
      const returnedTotal = (line.returnedQty || 0) + (line.damagedQty || 0);
      const alreadyInvoiced = line.invoicedQty || 0;
      const maxRemaining = Math.max(0, (line.qty || 0) - returnedTotal - alreadyInvoiced);
      const requested = customLines
        ? customLines.find((c) => c.name.toLowerCase() === line.name.toLowerCase())?.qtyToInvoice ?? 0
        : maxRemaining;
      const qtyToBill = Math.max(0, Math.min(maxRemaining, requested));

      if (qtyToBill > 0) {
        const lineBase = qtyToBill * line.price * (1 - (line.discountPercent || 0) / 100);
        const lineTax = (lineBase * (line.taxPercent || 0)) / 100;
        invoiceItems.push({
          ...line,
          id: generateUniqueId('li'),
          qty: qtyToBill,
          amount: Math.round((lineBase + lineTax) * 100) / 100,
        });
      }
      return {
        ...line,
        invoicedQty: alreadyInvoiced + qtyToBill,
      };
    });

    if (invoiceItems.length === 0) {
      showToast('No remaining unbilled items available on this Delivery Challan.', 'warning');
      return null;
    }

    const subtotal = invoiceItems.reduce((s, l) => s + l.qty * l.price, 0);
    const totalDiscount = invoiceItems.reduce(
      (s, l) => s + (l.qty * l.price * (l.discountPercent || 0)) / 100,
      0
    );
    const taxableAmount = subtotal - totalDiscount;
    const totalTax = invoiceItems.reduce((s, l) => s + (l.amount - l.qty * l.price * (1 - (l.discountPercent || 0) / 100)), 0);
    const totalAmount = Math.round((taxableAmount + totalTax) * 100) / 100;
    const isInter = challan.gstType === 'Inter-State';

    // Stock was already deducted if challan was Dispatched/Partially Returned/Pending Billing/Partially Invoiced
    const stockAlreadyDeducted =
      challan.challanStatus === 'Dispatched' ||
      challan.challanStatus === 'Partially Returned' ||
      challan.challanStatus === 'Pending Billing' ||
      challan.challanStatus === 'Partially Invoiced' ||
      !challan.challanStatus;

    const invNo = getNextFormattedInvoiceNo();
    const newTx = addTransaction({
      type: 'Sale',
      invoiceNo: invNo,
      date: `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      dueDate: challan.dueDate || new Date().toLocaleDateString('en-GB'),
      partyName: challan.partyName,
      partyPhone: challan.partyPhone,
      partyAddress: challan.shippingAddress || challan.partyAddress,
      partyGstin: challan.partyGstin,
      firm: challan.firm || company.name,
      user: currentUser?.name || 'Admin',
      paymentType: challan.paymentType || 'Credit',
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      taxableAmount: Math.round(taxableAmount * 100) / 100,
      cgstAmount: isInter ? 0 : Math.round((totalTax / 2) * 100) / 100,
      sgstAmount: isInter ? 0 : Math.round((totalTax / 2) * 100) / 100,
      igstAmount: isInter ? Math.round(totalTax * 100) / 100 : 0,
      gstType: challan.gstType || 'Intra-State',
      stateOfSupply: challan.stateOfSupply || company.state,
      totalAmount,
      receivedAmount: 0,
      balance: totalAmount,
      status: 'Unpaid',
      items: invoiceItems,
      notes: `Billed against Delivery Challan #${challan.invoiceNo} (Vehicle: ${challan.vehicleNumber || 'N/A'}). ${challan.notes || ''}`.trim(),
      challanNo: challan.invoiceNo,
      linkedChallanId: challan.id,
      vehicleNumber: challan.vehicleNumber,
      skipStockDeduction: stockAlreadyDeducted,
      convertedFrom: { type: 'Delivery Challan', docId: challan.id, docNo: challan.invoiceNo },
    });

    if (newTx) {
      const allBilled = updatedChallanItems.every(
        (it) => (it.invoicedQty || 0) + (it.returnedQty || 0) + (it.damagedQty || 0) >= (it.qty || 0)
      );
      updateTransaction(challan.id, {
        items: updatedChallanItems,
        fulfillmentStatus: allBilled ? 'Completed' : 'Partially Fulfilled',
        challanStatus: allBilled ? 'Converted' : 'Partially Invoiced',
        linkedSaleInvoiceId: newTx.id,
        linkedSaleInvoiceNo: newTx.invoiceNo,
        notes: `${challan.notes || ''} [${allBilled ? 'Fully' : 'Partially'} Invoiced as #${newTx.invoiceNo}]`.trim(),
      });
      setSelectedInvoice(newTx);
      setIsInvoicePreviewOpen(true);
      showToast(`Challan #${challan.invoiceNo} converted to Tax Invoice #${newTx.invoiceNo} without duplicate stock deduction!`);
    }
    return newTx;
  };

  const cancelInvoice = (invoiceId: string, reason: string): boolean => {
    if (!hasPermission('edit')) {
      showToast('Permission Denied: Cannot cancel invoice.');
      return false;
    }
    const tx = transactions.find((t) => t.id === invoiceId);
    if (!tx) return false;
    const lockedMatch = isDateInLockedPeriod(tx.date, businessSettings);
    if (lockedMatch.locked) {
      showToast(`Financial Period "${lockedMatch.periodLabel || 'Locked'}" is locked. Cannot cancel invoice in a locked period.`, 'error');
      return false;
    }
    if (tx.isCancelled) {
      showToast('This invoice has already been cancelled.');
      return false;
    }

    // Reverse stock movement (converting units cleanly to item's base unit)
    if (tx.items && tx.items.length > 0) {
      setItems((prevItems) => {
        const updated = [...prevItems];
        tx.items.forEach((line) => {
          const itemIdx = updated.findIndex(
            (i) => i.name.toLowerCase() === line.name.toLowerCase() || (line.hsn && i.code === line.hsn)
          );
          if (itemIdx >= 0) {
            const currentItem = updated[itemIdx];
            const rawQty = Number(line.qty || 0) + Number(line.freeQty || 0);
            const baseQty = convertUnitQty(
              rawQty,
              line.unit || currentItem.unit,
              currentItem.unit,
              currentItem.unitConversion,
              businessSettings.item.units
            );
            if (tx.type === 'Sale' || tx.type === 'Sale Order') {
              updated[itemIdx] = { ...currentItem, stock: roundQtyPrecision(currentItem.stock + baseQty, 6) };
            } else if (tx.type === 'Purchase') {
              updated[itemIdx] = { ...currentItem, stock: roundQtyPrecision(currentItem.stock - baseQty, 6) };
            } else if (tx.type === 'Sale Return') {
              updated[itemIdx] = { ...currentItem, stock: roundQtyPrecision(currentItem.stock - baseQty, 6) };
            }
          }
        });
        return updated;
      });
    }

    // Reverse party balance impact
    if (tx.partyName && tx.partyName !== 'Cash Sale') {
      setParties((prevParties) => {
        return prevParties.map((p) => {
          if (p.name.toLowerCase() === tx.partyName.toLowerCase()) {
            if (tx.type === 'Sale') {
              return { ...p, balance: Math.max(0, Math.round((p.balance - tx.balance) * 100) / 100) };
            } else if (tx.type === 'Purchase') {
              return { ...p, balance: Math.max(0, Math.round((p.balance - tx.balance) * 100) / 100) };
            } else if (tx.type === 'Sale Return') {
              return { ...p, balance: Math.round((p.balance + tx.totalAmount) * 100) / 100 };
            }
          }
          return p;
        });
      });
    }

    const cancellationTimestamp = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    updateTransaction(tx.id, {
      isCancelled: true,
      cancellationReason: reason,
      cancelledAt: cancellationTimestamp,
      cancelledBy: currentUser?.name || 'Admin',
      status: 'Unpaid',
      balance: 0,
      receivedAmount: 0,
    });

    recordActivity(
      'Cancelled Invoice',
      'Billing',
      `Cancelled ${tx.type} #${tx.invoiceNo}. Reason: "${reason}". Stock and balance reversed.`,
      {
        targetId: tx.id,
        targetType: 'Invoice',
        beforeState: {
          invoiceNo: tx.invoiceNo,
          type: tx.type,
          partyName: tx.partyName,
          totalAmount: tx.totalAmount,
          isCancelled: false,
        },
        afterState: {
          isCancelled: true,
          cancellationReason: reason,
          cancelledBy: currentUser?.name || 'Admin',
        },
        outcome: 'Flagged',
      }
    );
    showToast(`Invoice #${tx.invoiceNo} successfully cancelled.`);
    return true;
  };

  const allocatePaymentIn = (paymentId: string, allocations: { invoiceId: string; amount: number }[]): boolean => {
    const paymentTx = transactions.find((t) => t.id === paymentId);
    if (!paymentTx) return false;

    // Apply allocation to each targeted invoice
    setTransactions((prev) =>
      prev.map((t) => {
        const match = allocations.find((a) => a.invoiceId === t.id);
        if (!match) return t;
        const newReceived = Math.min(t.totalAmount, (t.receivedAmount || 0) + match.amount);
        const newBalance = Math.max(0, t.totalAmount - newReceived);
        const newStatus = newBalance === 0 ? 'Paid' : newReceived > 0 ? 'Partial' : 'Unpaid';
        const existingAllocations = t.allocatedPayments || [];
        return {
          ...t,
          receivedAmount: newReceived,
          balance: newBalance,
          status: newStatus,
          allocatedPayments: [
            ...existingAllocations,
            {
              paymentId: paymentTx.id,
              receiptNo: paymentTx.invoiceNo,
              amount: match.amount,
              date: paymentTx.date,
            },
          ],
        };
      })
    );

    recordActivity(
      'Payment Allocation',
      'Billing',
      `Allocated ₹${allocations.reduce((sum, a) => sum + a.amount, 0)} from Payment #${paymentTx.invoiceNo} across ${allocations.length} invoice(s)`
    );
    showToast(`Payment #${paymentTx.invoiceNo} allocated successfully across ${allocations.length} invoice(s)!`);
    return true;
  };

  // Filtered transactions calculation
  const filteredTransactions = transactions.filter((tx) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        tx.partyName.toLowerCase().includes(q) ||
        tx.invoiceNo.toLowerCase().includes(q) ||
        tx.totalAmount.toString().includes(q) ||
        tx.paymentType.toLowerCase().includes(q) ||
        tx.status.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filterFirm !== 'All Firms' && tx.firm !== filterFirm) {
      return false;
    }
    if (filterUser !== 'All Users' && tx.user !== filterUser) {
      return false;
    }
    return true;
  });

  // Calculate totals
  const totalSalesAmount = filteredTransactions
    .filter((tx) => tx.type === 'Sale' || tx.type === 'Sale Order')
    .reduce((acc, curr) => acc + curr.totalAmount, 0);

  const totalReceivedAmount = filteredTransactions
    .filter((tx) => tx.type === 'Sale' || tx.type === 'Sale Order')
    .reduce((acc, curr) => acc + curr.receivedAmount, 0);

  const totalBalanceAmount = filteredTransactions
    .filter((tx) => tx.type === 'Sale' || tx.type === 'Sale Order')
    .reduce((acc, curr) => acc + curr.balance, 0);

  const exportCurrentViewPdf = (options?: { title?: string; statusFilter?: string; paymentTypeFilter?: string }) => {
    if (!hasPermission('export')) {
      showToast('Permission Denied: Your assigned role cannot export financial reports.');
      return;
    }
    try {
      const reportName = generateCurrentViewPdf({
        activeTab,
        activeSaleSubtype,
        company,
        transactions,
        parties,
        items,
        selectedPartyId,
        selectedItemId,
        filterStartDate,
        filterEndDate,
        filterFirm,
        statusFilter: options?.statusFilter || 'All',
        paymentTypeFilter: options?.paymentTypeFilter || 'All',
        businessSettings,
      });
      recordActivity('Exported PDF Report', 'Billing', `Exported document "${reportName}"`);
      showToast(`Exported "${reportName}" as PDF document successfully!`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      showToast('Could not generate PDF document');
    }
  };

  const isAdminSession = (): boolean => {
    if (!currentUser || activeSessionType === 'CUSTOMER') return false;
    return (
      currentUser.roleName === 'Owner' ||
      currentUser.roleName === 'Admin' ||
      currentUser.roleName === 'Administrator' ||
      currentUser.accountType === 'ADMIN'
    );
  };

  const resolveUserAccountType = (u: AppUser): 'ADMIN' | 'STAFF' => {
    if (
      u.roleName === 'Owner' ||
      u.roleName === 'Admin' ||
      u.roleName === 'Administrator'
    ) {
      return 'ADMIN';
    }
    return 'STAFF';
  };

  // Async Hashed Authentication for Staff & Admin Portal
  const loginStaffOrAdmin = async (
    identifier: string,
    password: string
  ): Promise<{ success: boolean; message: string }> => {
    const q = identifier.toLowerCase().trim();
    if (!q || !password) {
      return { success: false, message: 'Please enter both Staff ID / Email and Password.' };
    }

    const targetUser = users.find(
      (u) =>
        u.email.toLowerCase() === q ||
        (u.employeeId && u.employeeId.toLowerCase() === q) ||
        u.id.toLowerCase() === q
    );

    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    if (!targetUser) {
      const failLog: LoginHistoryRecord = {
        id: generateUniqueId('lh'),
        userId: 'unregistered',
        userName: identifier,
        email: identifier,
        role: 'Staff/Admin Attempt',
        timestamp: nowStr,
        device: 'Business Manager 360 (Web)',
        ipAddress: 'Online Web Client',
        status: 'Failed - Incorrect Password',
        location: 'Online Portal',
      };
      setLoginHistory((prev) => [failLog, ...prev]);
      return { success: false, message: 'No staff or admin account found matching that ID or email.' };
    }

    const pwdOk = await verifyPassword(password, targetUser.passwordHash);
    if (!pwdOk) {
      const failLog: LoginHistoryRecord = {
        id: generateUniqueId('lh'),
        userId: targetUser.id,
        userName: targetUser.name,
        email: targetUser.email,
        role: targetUser.roleName,
        timestamp: nowStr,
        device: 'Business Manager 360 (Web)',
        ipAddress: 'Online Web Client',
        status: 'Failed - Incorrect Password',
        location: 'Online Portal',
      };
      setLoginHistory((prev) => [failLog, ...prev]);
      return { success: false, message: 'Incorrect password. Contact Store Admin if you need a reset.' };
    }

    if (targetUser.status === 'Blocked') {
      const blockedLog: LoginHistoryRecord = {
        id: generateUniqueId('lh'),
        userId: targetUser.id,
        userName: targetUser.name,
        email: targetUser.email,
        role: targetUser.roleName,
        timestamp: nowStr,
        device: 'Business Manager 360 (Web)',
        ipAddress: 'Online Web Client',
        status: 'Blocked Attempt',
        location: 'Online Portal',
      };
      setLoginHistory((prev) => [blockedLog, ...prev]);
      return { success: false, message: 'This staff account is deactivated. Contact your Administrator.' };
    }

    if (!targetUser.isApproved || targetUser.status === 'Pending Approval') {
      return { success: false, message: 'This staff account is pending Administrator activation.' };
    }

    const sessType = resolveUserAccountType(targetUser);
    const safeUser = stripSecretFieldsFromUser({ ...targetUser, lastLogin: nowStr });
    setCurrentCustomer(null);
    setCurrentUser(safeUser);
    setActiveSessionType(sessType);
    setIsAuthenticated(true);
    safeSetStoredData('bm360_portal_session', { sessionType: sessType, userId: targetUser.id });

    setUsers((prev) =>
      prev.map((u) => (u.id === targetUser.id ? { ...u, lastLogin: nowStr } : u))
    );

    const newLoginRecord: LoginHistoryRecord = {
      id: generateUniqueId('lh'),
      userId: targetUser.id,
      userName: targetUser.name,
      email: targetUser.email,
      role: `${targetUser.roleName} (${sessType})`,
      timestamp: nowStr,
      device: 'Business Manager 360 (Web)',
      ipAddress: 'Online Web Client',
      status: 'Success',
      location: 'Online Portal',
    };
    setLoginHistory((prev) => [newLoginRecord, ...prev]);
    recordActivity('Staff/Admin Logged In', 'Auth', `Authenticated as ${targetUser.name} (${targetUser.roleName})`);
    showToast(`Welcome back, ${targetUser.name}!`);
    return { success: true, message: 'Authenticated' };
  };

  // Async Hashed Customer Email Login (Strict Customer Isolation)
  const loginCustomerWithEmail = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, message: 'Please enter your email address and password.' };
    }

    const account = customerAccounts.find((c) => c.email.toLowerCase() === cleanEmail);
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    if (!account) {
      setLoginHistory((prev) => [
        {
          id: generateUniqueId('lh'),
          userId: 'unregistered-customer',
          userName: email,
          email,
          role: 'Customer',
          timestamp: nowStr,
          device: 'Customer Portal (Web)',
          ipAddress: 'Online Web Client',
          status: 'Failed - Incorrect Password',
          location: 'Online Portal',
        },
        ...prev,
      ]);
      return { success: false, message: 'No customer account registered with this email address.' };
    }

    const valid = await verifyPassword(password, account.passwordHash);
    if (!valid) {
      setLoginHistory((prev) => [
        {
          id: generateUniqueId('lh'),
          userId: account.id,
          userName: account.fullName,
          email: account.email,
          role: 'Customer',
          timestamp: nowStr,
          device: 'Customer Portal (Web)',
          ipAddress: 'Online Web Client',
          status: 'Failed - Incorrect Password',
          location: 'Online Portal',
        },
        ...prev,
      ]);
      return { success: false, message: 'Incorrect password. Try again or contact store support.' };
    }

    if (account.status !== 'Active') {
      return { success: false, message: `Your customer account is ${account.status.toLowerCase()}. Please contact the store.` };
    }

    const updatedAccount: CustomerAccount = { ...account, lastLogin: nowStr };
    setCustomerAccounts((prev) => prev.map((c) => (c.id === account.id ? updatedAccount : c)));

    const { passwordHash: _ignoredHash, ...safeCust } = updatedAccount;
    setCurrentUser(null);
    setCurrentCustomer(safeCust);
    setActiveSessionType('CUSTOMER');
    setIsAuthenticated(true);
    safeSetStoredData('bm360_portal_session', { sessionType: 'CUSTOMER', userId: account.id });

    setLoginHistory((prev) => [
      {
        id: generateUniqueId('lh'),
        userId: account.id,
        userName: account.fullName,
        email: account.email,
        role: `Customer (${account.customerId})`,
        timestamp: nowStr,
        device: 'Customer Portal (Web)',
        ipAddress: 'Online Web Client',
        status: 'Success',
        location: 'Online Portal',
      },
      ...prev,
    ]);

    setCustomerActivity((prev) => [
      {
        id: generateUniqueId('ca'),
        customerId: account.customerId,
        customerName: account.fullName,
        action: 'Customer Signed In',
        details: 'Verified online session via hashed email credentials',
        timestamp: nowStr,
        status: 'Success',
      },
      ...prev,
    ]);

    showToast(`Welcome back, ${account.fullName}!`);
    return { success: true, message: 'Logged in cleanly' };
  };

  // Customer Mobile OTP Request & Verification (Syncs with Express backend)
  const generate6DigitOtp = (): string => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return String(100000 + (buf[0] % 900000));
    }
    return String(Math.floor(100000 + Math.random() * 900000));
  };

  const requestCustomerMobileOtp = async (
    phone: string,
    purpose: 'login' | 'register'
  ): Promise<{ success: boolean; otpPreview?: string; message: string }> => {
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (digits.length < 10) {
      return { success: false, message: 'Please enter a valid 10-digit mobile number.' };
    }
    const existing = customerAccounts.find((c) => c.phone.replace(/\D/g, '').slice(-10) === digits);
    if (purpose === 'login' && !existing) {
      return {
        success: false,
        message: 'No customer account found for this mobile number. Please register first.',
      };
    }
    if (purpose === 'register' && existing) {
      return {
        success: false,
        message: 'This mobile number is already registered. Please sign in with Mobile OTP or Email.',
      };
    }

    const otp = generate6DigitOtp();
    otpChallengesRef.current[digits] = {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
      purpose,
    };

    try {
      await apiClient.requestCustomerOtp(digits, purpose, otp);
    } catch {
      return {
        success: false,
        message: 'Unable to reach OTP service. Please verify your internet connection and try again.',
      };
    }

    showToast(`OTP generated for +91 ${digits}`);
    return {
      success: true,
      otpPreview: otp,
      message: `6-digit OTP issued for +91 ${digits} (valid for 5 minutes).`,
    };
  };

  const verifyCustomerMobileOtpLogin = async (
    phone: string,
    enteredOtp: string
  ): Promise<{ success: boolean; message: string }> => {
    const digits = phone.replace(/\D/g, '').slice(-10);
    const cleanOtp = enteredOtp.trim();
    if (digits.length < 10 || cleanOtp.length !== 6) {
      return { success: false, message: 'Enter a valid 10-digit mobile number and 6-digit OTP.' };
    }
    const challenge = otpChallengesRef.current[digits];
    if (!challenge || challenge.purpose !== 'login') {
      return { success: false, message: 'No active OTP request found. Click Request OTP first.' };
    }
    if (Date.now() > challenge.expiresAt) {
      delete otpChallengesRef.current[digits];
      return { success: false, message: 'OTP expired. Please request a new 6-digit OTP.' };
    }
    if (challenge.attempts >= 5) {
      delete otpChallengesRef.current[digits];
      return { success: false, message: 'Too many invalid OTP attempts. Please request a fresh OTP.' };
    }
    challenge.attempts += 1;
    if (cleanOtp !== challenge.otp) {
      return { success: false, message: 'Invalid 6-digit OTP. Please check and try again.' };
    }

    const account = customerAccounts.find((c) => c.phone.replace(/\D/g, '').slice(-10) === digits);
    if (!account) {
      return { success: false, message: 'Customer account not found.' };
    }
    if (account.status !== 'Active') {
      return { success: false, message: `Your customer account is ${account.status.toLowerCase()}. Please contact the store.` };
    }

    delete otpChallengesRef.current[digits];
    try {
      await apiClient.verifyCustomerOtp(digits, cleanOtp);
    } catch {
      // Continue if challenge already validated against active session
    }

    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const updatedAccount: CustomerAccount = { ...account, lastLogin: nowStr };
    setCustomerAccounts((prev) => prev.map((c) => (c.id === account.id ? updatedAccount : c)));

    const { passwordHash: _ignoredHash, ...safeCust } = updatedAccount;
    setCurrentUser(null);
    setCurrentCustomer(safeCust);
    setActiveSessionType('CUSTOMER');
    setIsAuthenticated(true);
    safeSetStoredData('bm360_portal_session', { sessionType: 'CUSTOMER', userId: account.id });

    setLoginHistory((prev) => [
      {
        id: generateUniqueId('lh'),
        userId: account.id,
        userName: account.fullName,
        email: account.email,
        role: `Customer (${account.customerId})`,
        timestamp: nowStr,
        device: 'Customer Portal (Mobile OTP)',
        ipAddress: '127.0.0.1 (Local Client)',
        status: 'Success',
        location: 'Local Client',
      },
      ...prev,
    ]);

    setCustomerActivity((prev) => [
      {
        id: generateUniqueId('ca'),
        customerId: account.customerId,
        customerName: account.fullName,
        action: 'Customer Signed In via OTP',
        details: `Verified mobile OTP login (+91 ${digits})`,
        timestamp: nowStr,
        status: 'Success',
      },
      ...prev,
    ]);

    showToast(`Welcome back, ${account.fullName}!`);
    return { success: true, message: 'OTP verified & logged in cleanly' };
  };

  // Offline Customer Registration (Always assigns strictly CUSTOMER role; verifies OTP when provided)
  const registerCustomerAccount = async (input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    otp?: string;
  }): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanPhone = input.phone.trim();
    const cleanName = input.fullName.trim();
    const digits = cleanPhone.replace(/\D/g, '').slice(-10);

    if (!cleanName || !cleanEmail || !cleanPhone || input.password.length < 6) {
      return { success: false, message: 'All fields are required and password must be at least 6 characters.' };
    }

    if (input.otp !== undefined) {
      const challenge = otpChallengesRef.current[digits];
      if (!challenge || challenge.purpose !== 'register') {
        return { success: false, message: 'Please request a verification OTP first.' };
      }
      if (Date.now() > challenge.expiresAt) {
        delete otpChallengesRef.current[digits];
        return { success: false, message: 'Registration OTP expired. Request a new OTP.' };
      }
      if (input.otp.trim() !== challenge.otp) {
        return { success: false, message: 'Invalid 6-digit verification OTP.' };
      }
      delete otpChallengesRef.current[digits];
    }

    const exists = customerAccounts.some(
      (c) => c.email.toLowerCase() === cleanEmail || c.phone.replace(/\D/g, '').slice(-10) === digits
    );
    if (exists) {
      return { success: false, message: 'An account with this email or mobile number already exists.' };
    }

    const passwordHash = await hashPassword(input.password);
    const nextNum = String(customerAccounts.length + 1).padStart(3, '0');
    const customerId = `CUST${nextNum}`;
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const newAccount: CustomerAccount = {
      id: generateUniqueId('cust-acc'),
      customerId,
      fullName: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash,
      status: 'Active',
      authProvider: 'local',
      linkedPartyName: cleanName,
      addresses: [],
      createdAt: new Date().toLocaleDateString('en-GB'),
      lastLogin: nowStr,
      msCreditBalance: 0,
      msCreditEarnedTotal: 0,
      msCreditUsedTotal: 0,
    };

    setCustomerAccounts((prev) => [newAccount, ...prev]);

    // Ensure matching Customer Party exists in ERP store cleanly
    const existingParty = parties.find(
      (p) => p.name.toLowerCase() === cleanName.toLowerCase() || (p.email && p.email.toLowerCase() === cleanEmail)
    );
    if (!existingParty) {
      setParties((prev) => [
        ...prev,
        {
          id: generateUniqueId('p'),
          name: cleanName,
          phone: cleanPhone,
          email: cleanEmail,
          type: 'Customer',
          balance: 0,
          gstin: '',
          address: '',
          state: company.state,
          creditLimit: 25000,
          creditPeriodDays: 30,
        },
      ]);
    }

    setCustomerActivity((prev) => [
      {
        id: generateUniqueId('ca'),
        customerId,
        customerName: cleanName,
        action: 'Registered Customer Account',
        details: `Created online portal account (${customerId})`,
        timestamp: nowStr,
        status: 'Success',
      },
      ...prev,
    ]);

    setPortalNotifications((prev) => [
      {
        id: generateUniqueId('pn'),
        recipientType: 'CUSTOMER',
        recipientId: customerId,
        title: 'Welcome to Business Manager 360',
        message: `Your customer account ${customerId} is ready. You can now view invoices and track orders online.`,
        type: 'system',
        read: false,
        createdAt: nowStr,
      },
      ...prev,
    ]);

    const { passwordHash: _ignoredHash, ...safeCust } = newAccount;
    setCurrentUser(null);
    setCurrentCustomer(safeCust);
    setActiveSessionType('CUSTOMER');
    setIsAuthenticated(true);
    safeSetStoredData('bm360_portal_session', { sessionType: 'CUSTOMER', userId: newAccount.id });

    showToast(`Account ${customerId} created! Welcome, ${cleanName}.`);
    return { success: true, message: 'Customer account created' };
  };

  // Admin-Only Staff Management Operations (Protected by runtime assert)
  const adminCreateStaffAccount = async (input: {
    staffId?: string;
    name: string;
    email: string;
    phone: string;
    password: string;
    roleId: string;
    department: Employee['department'];
    designation: string;
    salary?: number;
  }): Promise<{ success: boolean; message: string; staffUser?: AppUser }> => {
    if (!isAdminSession()) {
      return { success: false, message: 'Security Violation: Only Store Admin or Owner can create staff accounts.' };
    }
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanName = input.name.trim();
    if (!cleanName || !cleanEmail || input.password.length < 6) {
      return { success: false, message: 'Name, valid email, and password (min 6 chars) are required.' };
    }

    const generatedId =
      (input.staffId && input.staffId.trim().toUpperCase()) ||
      `ST${String(users.filter((u) => (u.employeeId || '').startsWith('ST')).length + 2).padStart(3, '0')}`;

    const duplicate = users.some(
      (u) => u.email.toLowerCase() === cleanEmail || (u.employeeId && u.employeeId.toUpperCase() === generatedId)
    );
    if (duplicate) {
      return { success: false, message: 'Staff ID or email already exists.' };
    }

    const targetRole = roles.find((r) => r.id === input.roleId) || roles.find((r) => r.type === 'Cashier') || roles[2];
    const passwordHash = await hashPassword(input.password);
    const accountType: 'ADMIN' | 'STAFF' =
      targetRole.type === 'Owner' || targetRole.type === 'Admin' ? 'ADMIN' : 'STAFF';

    const newStaffUser: AppUser = {
      id: generateUniqueId('user-staff'),
      name: cleanName,
      email: cleanEmail,
      phone: input.phone.trim(),
      roleId: targetRole.id,
      roleName: targetRole.name,
      employeeId: generatedId,
      status: 'Active',
      isApproved: true,
      lastLogin: 'Never',
      passwordHash,
      accountType,
    };

    const newEmp: Employee = {
      id: generateUniqueId('emp'),
      employeeId: generatedId,
      name: cleanName,
      email: cleanEmail,
      phone: input.phone.trim(),
      department: input.department || 'Billing & Counter',
      designation: input.designation || targetRole.name,
      joiningDate: new Date().toLocaleDateString('en-GB'),
      status: 'Active',
      roleId: targetRole.id,
      roleName: targetRole.name,
      salary: Number(input.salary) || 25000,
      commissionRatePercent: 1.0,
      totalSalesAchieved: 0,
      totalCommissionEarned: 0,
      ordersHandled: 0,
      rating: 5.0,
      assignedBranch: 'Main Commercial Market, Bengaluru',
    };

    setUsers((prev) => [newStaffUser, ...prev]);
    setEmployees((prev) => [newEmp, ...prev]);
    recordActivity('Admin Created Staff Account', 'Employee', `Created ${generatedId} (${cleanName}) with role ${targetRole.name}`);
    showToast(`Staff account ${generatedId} created cleanly!`);
    return { success: true, message: `Staff ID ${generatedId} created.`, staffUser: stripSecretFieldsFromUser(newStaffUser)! };
  };

  const adminToggleStaffStatus = (userId: string): { success: boolean; message: string } => {
    if (!isAdminSession()) {
      return { success: false, message: 'Admin permission required.' };
    }
    if (currentUser && currentUser.id === userId) {
      return { success: false, message: 'Cannot deactivate your own active Admin account.' };
    }
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'Staff account not found.' };

    const nextStatus = target.status === 'Blocked' ? 'Active' : 'Blocked';
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u)));
    if (target.employeeId) {
      setEmployees((prev) =>
        prev.map((e) =>
          e.employeeId === target.employeeId
            ? { ...e, status: nextStatus === 'Active' ? 'Active' : 'Terminated' }
            : e
        )
      );
    }
    recordActivity('Toggled Staff Status', 'Security', `${target.name} (${target.employeeId || target.id}) set to ${nextStatus}`);
    return { success: true, message: `${target.name} is now ${nextStatus}.` };
  };

  const adminResetStaffPassword = async (
    userId: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!isAdminSession()) {
      return { success: false, message: 'Only Admin/Owner can reset staff passwords.' };
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters.' };
    }
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'Staff account not found.' };

    const newHash = await hashPassword(newPassword);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, passwordHash: newHash } : u))
    );
    recordActivity('Admin Reset Staff Password', 'Security', `Password reset for ${target.name} (${target.employeeId || target.id})`);
    showToast(`Password reset for ${target.name}`);
    return { success: true, message: 'Staff password updated securely.' };
  };

  const adminUpdateStaffRole = (userId: string, newRoleId: string): { success: boolean; message: string } => {
    if (!isAdminSession()) {
      return { success: false, message: 'Only Admin/Owner can modify staff permissions.' };
    }
    if (currentUser && currentUser.id === userId) {
      return { success: false, message: 'Security Rule: Users cannot modify their own role.' };
    }
    const role = roles.find((r) => r.id === newRoleId);
    const target = users.find((u) => u.id === userId);
    if (!role || !target) return { success: false, message: 'Invalid user or role.' };

    const nextType: 'ADMIN' | 'STAFF' = role.type === 'Owner' || role.type === 'Admin' ? 'ADMIN' : 'STAFF';
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, roleId: role.id, roleName: role.name, accountType: nextType } : u
      )
    );
    if (target.employeeId) {
      setEmployees((prev) =>
        prev.map((e) => (e.employeeId === target.employeeId ? { ...e, roleId: role.id, roleName: role.name } : e))
      );
    }
    recordActivity('Updated Staff Role', 'Roles', `Assigned role ${role.name} to ${target.name}`);
    showToast(`Updated ${target.name} to role ${role.name}`);
    return { success: true, message: `Updated role to ${role.name}.` };
  };

  const adminToggleCustomerStatus = (
    customerId: string,
    nextStatus: 'Active' | 'Inactive' | 'Suspended'
  ): { success: boolean; message: string } => {
    if (!isAdminSession()) {
      return { success: false, message: 'Only Admin/Owner can update customer account status.' };
    }
    const target = customerAccounts.find((c) => c.id === customerId || c.customerId === customerId);
    if (!target) return { success: false, message: 'Customer account not found.' };

    setCustomerAccounts((prev) =>
      prev.map((c) => (c.id === target.id ? { ...c, status: nextStatus } : c))
    );
    setCustomerActivity((prev) => [
      {
        id: generateUniqueId('ca'),
        customerId: target.customerId,
        customerName: target.fullName,
        action: `Account Status Changed -> ${nextStatus}`,
        details: `Updated by ${currentUser?.name || 'Admin'}`,
        timestamp: `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        status: nextStatus === 'Active' ? 'Success' : 'Alert',
      },
      ...prev,
    ]);
    recordActivity('Updated Customer Account Status', 'Security', `${target.fullName} (${target.customerId}) set to ${nextStatus}`);
    return { success: true, message: `Customer ${target.fullName} is now ${nextStatus}.` };
  };

  const adminResetCustomerPassword = async (
    customerId: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!isAdminSession()) {
      return { success: false, message: 'Only Admin/Owner can reset customer passwords.' };
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters.' };
    }
    const target = customerAccounts.find((c) => c.id === customerId || c.customerId === customerId);
    if (!target) return { success: false, message: 'Customer account not found.' };

    const newHash = await hashPassword(newPassword);
    setCustomerAccounts((prev) =>
      prev.map((c) => (c.id === target.id ? { ...c, passwordHash: newHash } : c))
    );
    setCustomerActivity((prev) => [
      {
        id: generateUniqueId('ca'),
        customerId: target.customerId,
        customerName: target.fullName,
        action: 'Password Reset by Admin',
        details: `Password updated securely by ${currentUser?.name || 'Admin'}`,
        timestamp: `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        status: 'Info',
      },
      ...prev,
    ]);
    showToast(`Password reset for ${target.fullName}`);
    return { success: true, message: 'Customer password updated cleanly.' };
  };

  const adminAssignStaffTask = (
    task: Omit<StaffTask, 'id' | 'createdAt' | 'assignedBy'>
  ): { success: boolean; message: string } => {
    if (!isAdminSession()) {
      return { success: false, message: 'Only Admin/Owner can assign tasks.' };
    }
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const created: StaffTask = {
      ...task,
      id: generateUniqueId('task'),
      assignedBy: currentUser?.name || 'Admin',
      createdAt: nowStr,
    };
    setStaffTasks((prev) => [created, ...prev]);
    setPortalNotifications((prev) => [
      {
        id: generateUniqueId('pn'),
        recipientType: 'STAFF',
        recipientId: task.staffId,
        title: `New Task Assigned: ${task.title}`,
        message: task.description || `Due ${task.dueDate}`,
        type: 'task',
        read: false,
        createdAt: nowStr,
      },
      ...prev,
    ]);
    showToast(`Assigned task to ${task.staffName}`);
    return { success: true, message: 'Task assigned.' };
  };

  // Customer Scoped Operations (Always enforce currentCustomer session)
  const updateCustomerProfile = (updates: { fullName?: string; phone?: string }): boolean => {
    if (activeSessionType !== 'CUSTOMER' || !currentCustomer) return false;
    setCustomerAccounts((prev) =>
      prev.map((c) =>
        c.id === currentCustomer.id
          ? {
              ...c,
              fullName: updates.fullName?.trim() || c.fullName,
              phone: updates.phone?.trim() || c.phone,
            }
          : c
      )
    );
    setCurrentCustomer((prev) =>
      prev
        ? {
            ...prev,
            fullName: updates.fullName?.trim() || prev.fullName,
            phone: updates.phone?.trim() || prev.phone,
          }
        : null
    );
    showToast('Customer profile updated.');
    return true;
  };

  const addCustomerAddress = (addr: Omit<CustomerAddress, 'id'>): boolean => {
    if (activeSessionType !== 'CUSTOMER' || !currentCustomer) return false;
    const newAddr: CustomerAddress = { ...addr, id: generateUniqueId('addr') };
    const updater = (list: CustomerAddress[]) => {
      const base = addr.isDefault ? list.map((a) => ({ ...a, isDefault: false })) : list;
      return [...base, newAddr];
    };
    setCustomerAccounts((prev) =>
      prev.map((c) => (c.id === currentCustomer.id ? { ...c, addresses: updater(c.addresses || []) } : c))
    );
    setCurrentCustomer((prev) => (prev ? { ...prev, addresses: updater(prev.addresses || []) } : null));
    showToast('Delivery address saved.');
    return true;
  };

  const deleteCustomerAddress = (addrId: string): boolean => {
    if (activeSessionType !== 'CUSTOMER' || !currentCustomer) return false;
    setCustomerAccounts((prev) =>
      prev.map((c) =>
        c.id === currentCustomer.id ? { ...c, addresses: (c.addresses || []).filter((a) => a.id !== addrId) } : c
      )
    );
    setCurrentCustomer((prev) =>
      prev ? { ...prev, addresses: (prev.addresses || []).filter((a) => a.id !== addrId) } : null
    );
    showToast('Address removed.');
    return true;
  };

  const setDefaultCustomerAddress = (addrId: string): boolean => {
    if (activeSessionType !== 'CUSTOMER' || !currentCustomer) return false;
    const mapper = (list: CustomerAddress[]) => list.map((a) => ({ ...a, isDefault: a.id === addrId }));
    setCustomerAccounts((prev) =>
      prev.map((c) => (c.id === currentCustomer.id ? { ...c, addresses: mapper(c.addresses || []) } : c))
    );
    setCurrentCustomer((prev) => (prev ? { ...prev, addresses: mapper(prev.addresses || []) } : null));
    showToast('Default delivery address updated.');
    return true;
  };

  const payCustomerPendingInvoice = (invoiceId: string, method: 'UPI' | 'Bank Transfer' | 'Cash'): boolean => {
    if (activeSessionType !== 'CUSTOMER' || !currentCustomer) return false;
    const tx = transactions.find((t) => t.id === invoiceId);
    if (!tx || tx.balance <= 0) return false;
    // Privacy guard: Verify invoice belongs to currentCustomer
    const custNameMatch =
      tx.partyName.toLowerCase() === currentCustomer.fullName.toLowerCase() ||
      tx.partyName.toLowerCase() === currentCustomer.linkedPartyName.toLowerCase() ||
      (tx.partyPhone && tx.partyPhone.replace(/\D/g, '') === currentCustomer.phone.replace(/\D/g, ''));
    if (!custNameMatch) {
      showToast('Access Denied: Invoice does not belong to your customer profile.');
      return false;
    }

    const amountPaid = tx.balance;
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const receiptNo = `PAY-${Date.now().toString().slice(-4)}`;
    const paymentTx: Transaction = {
      id: generateUniqueId('tx'),
      type: 'Payment-In',
      invoiceNo: receiptNo,
      date: nowStr,
      partyName: tx.partyName,
      partyPhone: currentCustomer.phone,
      firm: company.name,
      user: `Customer (${currentCustomer.customerId})`,
      paymentType: method,
      totalAmount: amountPaid,
      receivedAmount: amountPaid,
      balance: 0,
      dueDate: nowStr.split(',')[0],
      status: 'Paid',
      items: [],
      notes: `Online payment against Invoice #${tx.invoiceNo} via ${method}`,
      createdAt: new Date().toISOString(),
    };

    setTransactions((prev) => [
      paymentTx,
      ...prev.map((item) =>
        item.id === tx.id
          ? {
              ...item,
              receivedAmount: item.totalAmount,
              balance: 0,
              status: 'Paid' as const,
            }
          : item
      ),
    ]);

    setCustomerActivity((prev) => [
      {
        id: generateUniqueId('ca'),
        customerId: currentCustomer.customerId,
        customerName: currentCustomer.fullName,
        action: `Paid Invoice #${tx.invoiceNo}`,
        details: `Recorded ₹${amountPaid.toLocaleString('en-IN')} payment via ${method} (Receipt ${receiptNo})`,
        timestamp: nowStr,
        status: 'Success',
      },
      ...prev,
    ]);
    showToast(`Payment ₹${amountPaid.toLocaleString('en-IN')} recorded! Receipt #${receiptNo}`);
    return true;
  };

  const submitCustomerSupportMessage = (subject: string, message: string): boolean => {
    if (activeSessionType !== 'CUSTOMER' || !currentCustomer) return false;
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    setSupportMessages((prev) => [
      {
        id: generateUniqueId('sup'),
        customerId: currentCustomer.customerId,
        customerName: currentCustomer.fullName,
        phone: currentCustomer.phone,
        subject: subject.trim() || 'General Inquiry',
        message: message.trim(),
        createdAt: nowStr,
        status: 'Open',
      },
      ...prev,
    ]);
    setCustomerActivity((prev) => [
      {
        id: generateUniqueId('ca'),
        customerId: currentCustomer.customerId,
        customerName: currentCustomer.fullName,
        action: 'Contacted Store Support',
        details: subject.trim(),
        timestamp: nowStr,
        status: 'Info',
      },
      ...prev,
    ]);
    showToast('Your message has been saved for the Store Admin!');
    return true;
  };

  const markPortalNotificationRead = (notifId: string) => {
    setPortalNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)));
  };

  // --------------------------------------------------------------------------
  // UNIFIED MY STORE <-> BILLING <-> DELIVERY OTP <-> MS CREDIT WORKFLOW
  // --------------------------------------------------------------------------

  const validateDeliveryPincode = (
    pincode: string
  ): { serviceable: boolean; deliveryFee: number; outskirtFee: number; message: string } => {
    const cleanPin = (pincode || '').replace(/\D/g, '').slice(0, 6);
    if (!serviceAreaConfig.storeEnabled) {
      return {
        serviceable: false,
        deliveryFee: 0,
        outskirtFee: 0,
        message: 'Online store ordering is temporarily paused by Store Admin.',
      };
    }
    if (cleanPin.length !== 6) {
      return {
        serviceable: false,
        deliveryFee: serviceAreaConfig.standardDeliveryFee,
        outskirtFee: 0,
        message: 'Please enter a valid 6-digit PIN code.',
      };
    }
    const isAllowed = serviceAreaConfig.allowedPincodes.includes(cleanPin);
    if (!isAllowed) {
      return {
        serviceable: false,
        deliveryFee: 0,
        outskirtFee: 0,
        message: serviceAreaConfig.outOfAreaMessage,
      };
    }
    const isOutskirt = cleanPin === '302001' || cleanPin === '380001';
    return {
      serviceable: true,
      deliveryFee: serviceAreaConfig.standardDeliveryFee,
      outskirtFee: isOutskirt ? serviceAreaConfig.additionalOutskirtFee : 0,
      message: isOutskirt
        ? `Serviceable outskirt zone (+₹${serviceAreaConfig.additionalOutskirtFee} zone surcharge applied below free delivery threshold).`
        : `PIN ${cleanPin} is serviceable within ${serviceAreaConfig.maxRadiusKm} km store radius.`,
    };
  };

  const validateCouponForCustomer = (
    rawCode: string,
    cartSubtotal: number,
    cartCategories: string[] = [],
    customerIdArg?: string
  ): { valid: boolean; coupon?: BillingCoupon; discountAmount: number; message: string } => {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code) {
      return { valid: false, discountAmount: 0, message: 'Enter a coupon code.' };
    }
    const coupon = coupons.find((c) => c.code.toUpperCase() === code);
    if (!coupon) {
      return { valid: false, discountAmount: 0, message: `Coupon "${code}" does not exist.` };
    }
    if (!coupon.isActive) {
      return { valid: false, discountAmount: 0, message: `Coupon "${code}" is currently inactive.` };
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    if (coupon.expiryDate && coupon.expiryDate < todayStr) {
      return { valid: false, discountAmount: 0, message: `Coupon "${code}" expired on ${coupon.expiryDate}.` };
    }
    if (coupon.usedCount >= coupon.usageLimitTotal) {
      return { valid: false, discountAmount: 0, message: `Coupon "${code}" has reached total usage capacity.` };
    }
    const custId = customerIdArg || currentCustomer?.customerId || '';
    if (custId && coupon.usageLimitPerCustomer > 0) {
      const custUses = coupon.usedByCustomerIds.filter((id) => id === custId).length;
      if (custUses >= coupon.usageLimitPerCustomer) {
        return {
          valid: false,
          discountAmount: 0,
          message: `You have already used coupon "${code}" the maximum allowed (${coupon.usageLimitPerCustomer} time(s)).`,
        };
      }
    }
    if (cartSubtotal < coupon.minOrderValue) {
      return {
        valid: false,
        discountAmount: 0,
        message: `Minimum order value ₹${coupon.minOrderValue} required for ${coupon.code}.`,
      };
    }
    if (coupon.eligibleCategories && coupon.eligibleCategories.length > 0 && cartCategories.length > 0) {
      const hasMatch = cartCategories.some((cat) =>
        coupon.eligibleCategories!.some((el) => el.toLowerCase() === cat.toLowerCase())
      );
      if (!hasMatch) {
        return {
          valid: false,
          discountAmount: 0,
          message: `${coupon.code} applies only to ${coupon.eligibleCategories.join(', ')}.`,
        };
      }
    }

    const rawDiscount =
      coupon.discountType === 'flat'
        ? coupon.discountValue
        : Math.round((cartSubtotal * coupon.discountValue) / 100);
    const discountAmount = Math.min(
      cartSubtotal,
      coupon.maxDiscount ? Math.min(rawDiscount, coupon.maxDiscount) : rawDiscount
    );
    return {
      valid: true,
      coupon,
      discountAmount,
      message: `Coupon ${coupon.code} applied (-₹${discountAmount.toLocaleString('en-IN')}).`,
    };
  };

  const resetCustomerPassword = async (
    email: string,
    phone: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhoneDigits = (phone || '').replace(/\D/g, '').slice(-10);
    if (!cleanEmail || cleanPhoneDigits.length < 10) {
      return { success: false, message: 'Enter your registered email and 10-digit mobile number to verify identity.' };
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters.' };
    }
    const target = customerAccounts.find((c) => c.email.toLowerCase() === cleanEmail);
    if (!target) {
      return { success: false, message: 'No customer account found with this email.' };
    }
    const targetDigits = target.phone.replace(/\D/g, '').slice(-10);
    if (targetDigits !== cleanPhoneDigits) {
      return { success: false, message: 'Registered mobile number does not match this account.' };
    }
    const newHash = await hashPassword(newPassword);
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    setCustomerAccounts((prev) =>
      prev.map((c) => (c.id === target.id ? { ...c, passwordHash: newHash } : c))
    );
    setCustomerActivity((prev) => [
      {
        id: generateUniqueId('ca'),
        customerId: target.customerId,
        customerName: target.fullName,
        action: 'Self-Service Password Reset',
        details: 'Verified registered email + mobile number online',
        timestamp: nowStr,
        status: 'Success',
      },
      ...prev,
    ]);
    showToast('Password updated! You can now log in with your new password.');
    return { success: true, message: 'Password reset successfully. Please sign in.' };
  };

  const placeCustomerOnlineOrder = (orderInput: {
    items: {
      id: string;
      name: string;
      hsn: string;
      qty: number;
      unit: string;
      price: number;
      taxPercent: number;
      linkedItemId?: string;
    }[];
    subtotal: number;
    discount: number;
    deliveryFee: number;
    taxAmount: number;
    totalAmount: number;
    paymentMethod: 'UPI' | 'Cash' | 'Credit' | 'Bank Transfer';
    isPaid: boolean;
    deliveryAddressSummary: string;
    deliveryPincode?: string;
    hubName: string;
    promoCode?: string;
    msCreditToUse?: number;
    paymentRef?: string;
    notes?: string;
  }): { success: boolean; transaction?: Transaction; message: string } => {
    if (activeSessionType !== 'CUSTOMER' || !currentCustomer) {
      return { success: false, message: 'Customer sign-in required to place an order.' };
    }
    if (!orderInput.items || orderInput.items.length === 0) {
      return { success: false, message: 'Your shopping cart is empty.' };
    }

    // 1. Service Area PIN check
    const pinMatch =
      orderInput.deliveryPincode ||
      (orderInput.deliveryAddressSummary.match(/\b(\d{6})\b/)?.[1] || '');
    if (pinMatch) {
      const areaCheck = validateDeliveryPincode(pinMatch);
      if (!areaCheck.serviceable) {
        showToast(areaCheck.message);
        return { success: false, message: areaCheck.message };
      }
    }

    // 2. Live Stock & Authoritative Retail/Wholesale Pricing Check
    const nowDate = new Date();
    const nowStr = `${nowDate.toLocaleDateString('en-GB')}, ${nowDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const authoritativeCategories: string[] = [];
    let authoritativeSubtotal = 0;
    let authoritativeTax = 0;

    const invoiceItems: Transaction['items'] = [];
    for (const line of orderInput.items) {
      const qty = Math.max(1, Math.floor(Number(line.qty) || 1));
      const invItem = items.find(
        (i) =>
          (line.linkedItemId && i.id === line.linkedItemId) ||
          i.id === line.id ||
          i.name.toLowerCase() === line.name.toLowerCase()
      );
      const comboMatch = !invItem ? COMBO_PACKS.find((c) => c.id === line.id || c.title === line.name) : undefined;

      if (invItem) {
        const available = Math.max(0, (invItem.stock || 0) - (invItem.reservedStock || 0));
        if (qty > available) {
          const msg = `Only ${available} unit(s) available for "${invItem.name}" (${invItem.reservedStock || 0} reserved for active orders).`;
          showToast(msg);
          return { success: false, message: msg };
        }
        const wholesaleEligible =
          serviceAreaConfig.allowWholesalePricing &&
          invItem.wholesalePrice &&
          invItem.minWholesaleQty &&
          qty >= invItem.minWholesaleQty;
        const unitPrice = wholesaleEligible ? invItem.wholesalePrice! : invItem.salePrice;
        const lineTotal = Math.round(unitPrice * qty * 100) / 100;
        const rate = invItem.taxRate ?? line.taxPercent ?? 0;
        const gstPart = rate > 0 ? lineTotal - lineTotal / (1 + rate / 100) : 0;

        authoritativeSubtotal += lineTotal;
        authoritativeTax += gstPart;
        authoritativeCategories.push(invItem.category || 'Grocery');

        invoiceItems.push({
          id: generateUniqueId('li'),
          name: invItem.name,
          hsn: invItem.code || line.hsn || '2106',
          qty,
          unit: invItem.unit || line.unit || 'PCS',
          price: unitPrice,
          discountPercent: 0,
          taxPercent: rate,
          amount: lineTotal,
        });
      } else if (comboMatch) {
        const lineTotal = Math.round(comboMatch.price * qty * 100) / 100;
        const gstPart = comboMatch.gstRate > 0 ? lineTotal - lineTotal / (1 + comboMatch.gstRate / 100) : 0;
        authoritativeSubtotal += lineTotal;
        authoritativeTax += gstPart;
        authoritativeCategories.push('Combo Packs');

        invoiceItems.push({
          id: generateUniqueId('li'),
          name: comboMatch.title,
          hsn: comboMatch.hsn || '2106',
          qty,
          unit: 'BOX',
          price: comboMatch.price,
          discountPercent: 0,
          taxPercent: comboMatch.gstRate,
          amount: lineTotal,
        });
      } else {
        return { success: false, message: `Product "${line.name}" is unavailable in store catalog.` };
      }
    }

    authoritativeSubtotal = Math.round(authoritativeSubtotal * 100) / 100;
    authoritativeTax = Math.round(authoritativeTax * 100) / 100;

    // 2b. Minimum Order Value Check
    const minOrderVal = Number(serviceAreaConfig.minOrderValue || 0);
    if (minOrderVal > 0 && authoritativeSubtotal < minOrderVal) {
      const msg = `Minimum order value for online delivery is ₹${minOrderVal.toLocaleString('en-IN')}. Add ₹${(minOrderVal - authoritativeSubtotal).toLocaleString('en-IN')} more.`;
      showToast(msg, 'warning');
      return { success: false, message: msg };
    }

    // 3. Authoritative Coupon Verification
    let appliedCoupon: BillingCoupon | undefined;
    let couponDiscount = 0;
    if (orderInput.promoCode && orderInput.promoCode.trim()) {
      const couponRes = validateCouponForCustomer(
        orderInput.promoCode,
        authoritativeSubtotal,
        authoritativeCategories,
        currentCustomer.customerId
      );
      if (!couponRes.valid) {
        showToast(couponRes.message);
        return { success: false, message: couponRes.message };
      }
      appliedCoupon = couponRes.coupon;
      couponDiscount = couponRes.discountAmount;
    }

    // 4. Delivery Fee Calculation from StoreServiceAreaConfig
    const pinMeta = pinMatch ? validateDeliveryPincode(pinMatch) : { deliveryFee: serviceAreaConfig.standardDeliveryFee, outskirtFee: 0 };
    const deliveryFee =
      authoritativeSubtotal >= serviceAreaConfig.freeDeliveryThreshold
        ? 0
        : (pinMeta.deliveryFee || 0) + (pinMeta.outskirtFee || 0);

    // 5. MS Credit Wallet Redemption (1 MS Credit = ₹1, capped at current customer balance & order payable)
    const liveCustAcc = customerAccounts.find((c) => c.id === currentCustomer.id || c.customerId === currentCustomer.customerId);
    const availableMsCredits = Math.max(0, liveCustAcc?.msCreditBalance ?? currentCustomer.msCreditBalance ?? 0);
    const payableBeforeCredits = Math.max(0, authoritativeSubtotal - couponDiscount + deliveryFee);
    const requestedCredits = Math.max(0, Math.floor(Number(orderInput.msCreditToUse) || 0));
    const msCreditUsed = Math.min(requestedCredits, availableMsCredits, Math.floor(payableBeforeCredits));

    const grandTotal = Math.max(0, Math.round((payableBeforeCredits - msCreditUsed) * 100) / 100);
    const taxableAmount = Math.max(0, Math.round((grandTotal - authoritativeTax) * 100) / 100);
    const halfTax = Math.round((authoritativeTax / 2) * 100) / 100;

    // 6. Payment Status Rule: COD is ALWAYS Pending until Delivery + OTP verification
    const isCod = orderInput.paymentMethod === 'Cash';
    const hasPaymentRef = Boolean(orderInput.paymentRef && orderInput.paymentRef.trim().length >= 4);
    const paymentStatus: PaymentRecord['status'] =
      grandTotal === 0
        ? 'Completed'
        : isCod
        ? 'Pending'
        : orderInput.isPaid && hasPaymentRef
        ? 'Completed'
        : orderInput.isPaid
        ? 'Completed'
        : 'Pending Verification';

    const receivedNow = paymentStatus === 'Completed' ? grandTotal : 0;
    const balanceNow = Math.max(0, Math.round((grandTotal - receivedNow) * 100) / 100);

    // 7. Sequential Sale Order # (Does NOT create a Sale Invoice yet! Sale Invoice created ONLY after Delivery OTP)
    const existingOrderCount = transactions.filter((t) => t.type === 'Sale Order').length;
    const orderNo = `SO-${String(existingOrderCount + 101)}`;
    const onlineOrderId = `BM360-${nowDate.getFullYear()}-${String(settings.nextInvoiceNumber + existingOrderCount + 1000).padStart(4, '0')}`;
    const paymentId = generateUniqueId('pay');
    const paymentNo = `PAY-${Date.now().toString().slice(-6)}`;
    const txId = generateUniqueId('tx');

    const newOrderTx: Transaction = {
      id: txId,
      type: 'Sale Order',
      invoiceNo: orderNo,
      date: nowStr,
      partyName: currentCustomer.linkedPartyName || currentCustomer.fullName,
      partyPhone: currentCustomer.phone,
      partyAddress: orderInput.deliveryAddressSummary,
      firm: company.name,
      user: `Customer (${currentCustomer.customerId})`,
      customerId: currentCustomer.customerId,
      paymentType: orderInput.paymentMethod,
      totalAmount: grandTotal,
      receivedAmount: receivedNow,
      balance: balanceNow,
      dueDate: nowStr.split(',')[0],
      status: balanceNow === 0 ? 'Paid' : receivedNow > 0 ? 'Partial' : 'Unpaid',
      items: invoiceItems,
      notes:
        orderInput.notes ||
        `Online Order ${onlineOrderId} · Hub: ${orderInput.hubName}${appliedCoupon ? ` · Coupon: ${appliedCoupon.code}` : ''}${msCreditUsed > 0 ? ` · MS Credits Used: ${msCreditUsed}` : ''}`,
      createdAt: nowDate.toISOString(),
      source: 'ONLINE_STORE',
      onlineOrderId,
      subtotal: authoritativeSubtotal,
      totalDiscount: couponDiscount,
      taxableAmount,
      cgstAmount: halfTax,
      sgstAmount: Math.round((authoritativeTax - halfTax) * 100) / 100,
      gstType: 'Intra-State',
      fulfillmentStatus: 'Pending',
      orderWorkflowStatus: 'Pending Approval',
      deliveryFee,
      couponCode: appliedCoupon?.code,
      couponDiscount,
      msCreditUsed,
      paymentRecordId: paymentId,
      paymentRef: orderInput.paymentRef?.trim() || (isCod ? undefined : paymentNo),
      paymentStatus:
        paymentStatus === 'Completed'
          ? 'Paid'
          : paymentStatus === 'Pending Verification'
          ? 'Pending Verification'
          : 'Pending',
      orderTimeline: [
        {
          status: 'Pending Approval',
          timestamp: nowStr,
          actor: currentCustomer.fullName,
          note: `Order placed via Customer App (${orderInput.paymentMethod})`,
        },
      ],
    };

    // 8. Reserve Stock (Do NOT deduct physical stock until Delivery Boy verifies OTP!)
    const newStockRecords: StockTransactionRecord[] = [];
    setItems((prevItems) =>
      prevItems.map((invItem) => {
        const ordered = orderInput.items.find(
          (line) =>
            (line.linkedItemId && line.linkedItemId === invItem.id) ||
            line.id === invItem.id ||
            line.name.toLowerCase() === invItem.name.toLowerCase()
        );
        if (!ordered) return invItem;
        const qty = Math.max(1, Math.floor(Number(ordered.qty) || 1));
        const nextReserved = (invItem.reservedStock || 0) + qty;
        newStockRecords.push({
          id: generateUniqueId('stk'),
          itemId: invItem.id,
          itemName: invItem.name,
          type: 'RESERVE',
          qtyChange: qty,
          stockAfter: invItem.stock,
          reservedAfter: nextReserved,
          referenceNo: onlineOrderId,
          actor: currentCustomer.fullName,
          timestamp: nowStr,
        });
        return {
          ...invItem,
          reservedStock: nextReserved,
        };
      })
    );
    if (newStockRecords.length > 0) {
      setStockHistory((prev) => [...newStockRecords, ...prev]);
    }

    // 9. Mark Coupon Used
    if (appliedCoupon) {
      setCoupons((prev) =>
        prev.map((c) =>
          c.id === appliedCoupon!.id
            ? {
                ...c,
                usedCount: c.usedCount + 1,
                usedByCustomerIds: [...c.usedByCustomerIds, currentCustomer.customerId],
              }
            : c
        )
      );
    }

    // 10. Deduct Redeemed MS Credits
    if (msCreditUsed > 0 && liveCustAcc) {
      const nextBal = Math.max(0, availableMsCredits - msCreditUsed);
      setCustomerAccounts((prev) =>
        prev.map((c) =>
          c.id === liveCustAcc.id
            ? {
                ...c,
                msCreditBalance: nextBal,
                msCreditUsedTotal: (c.msCreditUsedTotal || 0) + msCreditUsed,
              }
            : c
        )
      );
      setCurrentCustomer((prev) =>
        prev
          ? {
              ...prev,
              msCreditBalance: nextBal,
              msCreditUsedTotal: (prev.msCreditUsedTotal || 0) + msCreditUsed,
            }
          : null
      );
      setMsCreditTransactions((prev) => [
        {
          id: generateUniqueId('msc'),
          customerId: currentCustomer.customerId,
          customerName: currentCustomer.fullName,
          type: 'REDEEM',
          amount: msCreditUsed,
          balanceAfter: nextBal,
          orderId: onlineOrderId,
          description: `Redeemed ${msCreditUsed} MS Credits (₹${msCreditUsed}) on Order ${onlineOrderId}`,
          createdAt: nowStr,
        },
        ...prev,
      ]);
    }

    // 11. Log Payment Record
    const paymentRecord: PaymentRecord = {
      id: paymentId,
      paymentNo,
      orderId: onlineOrderId,
      customerId: currentCustomer.customerId,
      partyName: newOrderTx.partyName,
      amount: grandTotal,
      method: isCod ? 'Cash on Delivery' : orderInput.paymentMethod === 'UPI' ? 'UPI' : 'Online Payment',
      status: paymentStatus,
      transactionRef: newOrderTx.paymentRef,
      refundStatus: 'None',
      createdAt: nowStr,
    };
    setPayments((prev) => [paymentRecord, ...prev]);

    setTransactions((prev) => [newOrderTx, ...prev]);

    // 12. Notify Customer & Billing Staff/Manager
    setPortalNotifications((prev) => [
      {
        id: generateUniqueId('pn'),
        recipientType: 'CUSTOMER',
        recipientId: currentCustomer.customerId,
        title: `Order Placed · ${onlineOrderId}`,
        message: `Order totaling ₹${grandTotal.toLocaleString('en-IN')} (${orderNo}) submitted for Store Manager approval.`,
        type: 'order',
        read: false,
        createdAt: nowStr,
      },
      {
        id: generateUniqueId('pn'),
        recipientType: 'STAFF',
        recipientId: 'ALL',
        title: `New Online Order · ${onlineOrderId}`,
        message: `${currentCustomer.fullName} placed Order ${onlineOrderId} (₹${grandTotal.toLocaleString('en-IN')}). Approve in Sales Orders -> Online Store Orders.`,
        type: 'order',
        read: false,
        createdAt: nowStr,
      },
      ...prev,
    ]);

    setCustomerActivity((prev) => [
      {
        id: generateUniqueId('ca'),
        customerId: currentCustomer.customerId,
        customerName: currentCustomer.fullName,
        action: `Placed Order ${onlineOrderId}`,
        details: `${invoiceItems.length} item(s) · ₹${grandTotal.toLocaleString('en-IN')} (${orderInput.paymentMethod}) · Pending Manager Approval`,
        timestamp: nowStr,
        status: 'Success',
      },
      ...prev,
    ]);

    // Fire-and-forget sync to Express backend when online
    void apiClient.createStoreOrder({
      order: newOrderTx,
      payment: paymentRecord,
      stockHistory: newStockRecords,
    }).catch(() => {});

    showToast(`Order ${onlineOrderId} placed! Sent to Store Billing for approval.`);
    return { success: true, transaction: newOrderTx, message: `Order ${onlineOrderId} placed and sent for approval.` };
  };

  const approveOnlineOrder = (orderId: string): { success: boolean; message: string } => {
    if (activeSessionType === 'CUSTOMER' || !currentUser) {
      return { success: false, message: 'Security Violation: Only Staff/Manager/Admin can approve orders.' };
    }
    const order = transactions.find((t) => t.id === orderId);
    if (!order) return { success: false, message: 'Order not found.' };
    if (order.isCancelled || order.orderWorkflowStatus === 'Cancelled') {
      return { success: false, message: 'Order is already cancelled.' };
    }
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === order.id
          ? {
              ...t,
              orderWorkflowStatus: 'Confirmed',
              orderTimeline: [
                ...(t.orderTimeline || []),
                {
                  status: 'Confirmed',
                  timestamp: nowStr,
                  actor: currentUser.name,
                  note: `Approved by ${currentUser.roleName}`,
                },
              ],
            }
          : t
      )
    );
    if (order.customerId) {
      setPortalNotifications((prev) => [
        {
          id: generateUniqueId('pn'),
          recipientType: 'CUSTOMER',
          recipientId: order.customerId!,
          title: `Order Confirmed · ${order.onlineOrderId || order.invoiceNo}`,
          message: `Your order has been approved by store manager ${currentUser.name} and queued for packing.`,
          type: 'order',
          read: false,
          createdAt: nowStr,
        },
        ...prev,
      ]);
    }
    recordActivity('Approved Online Order', 'Billing', `Approved online order ${order.onlineOrderId || order.invoiceNo}`);
    showToast(`Order ${order.onlineOrderId || order.invoiceNo} approved!`);
    return { success: true, message: 'Order approved for packing.' };
  };

  const packOnlineOrder = (
    orderId: string,
    customBagId?: string
  ): { success: boolean; bagId?: string; message: string } => {
    if (activeSessionType === 'CUSTOMER' || !currentUser) {
      return { success: false, message: 'Security Violation: Only Staff/Manager/Admin can pack orders.' };
    }
    const order = transactions.find((t) => t.id === orderId);
    if (!order) return { success: false, message: 'Order not found.' };
    if (order.isCancelled || order.orderWorkflowStatus === 'Cancelled') {
      return { success: false, message: 'Cannot pack a cancelled order.' };
    }
    const bagId = (customBagId && customBagId.trim().toUpperCase()) || `BAG-${Date.now().toString().slice(-4)}`;
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    setTransactions((prev) =>
      prev.map((t) =>
        t.id === order.id
          ? {
              ...t,
              orderWorkflowStatus: 'Packing',
              deliveryBagId: bagId,
              orderTimeline: [
                ...(t.orderTimeline || []),
                {
                  status: 'Packing',
                  timestamp: nowStr,
                  actor: currentUser.name,
                  note: `Packed in Delivery Bag ${bagId}`,
                },
              ],
            }
          : t
      )
    );

    if (order.customerId) {
      setPortalNotifications((prev) => [
        {
          id: generateUniqueId('pn'),
          recipientType: 'CUSTOMER',
          recipientId: order.customerId!,
          title: `Order Packed · ${order.onlineOrderId || order.invoiceNo}`,
          message: `Items sealed in Delivery Bag ${bagId}. Ready for rider assignment.`,
          type: 'order',
          read: false,
          createdAt: nowStr,
        },
        ...prev,
      ]);
    }
    recordActivity('Packed Online Order', 'Inventory', `Packed ${order.onlineOrderId || order.invoiceNo} into Bag ${bagId}`);
    showToast(`Packed in Bag ${bagId}`);
    return { success: true, bagId, message: `Order packed in ${bagId}.` };
  };

  const assignDeliveryBoyToOrder = (
    orderId: string,
    staffId?: string,
    staffName?: string,
    staffPhone?: string
  ): { success: boolean; otp?: string; message: string } => {
    if (activeSessionType === 'CUSTOMER' || !currentUser) {
      return { success: false, message: 'Security Violation: Only Staff/Manager/Admin can assign deliveries.' };
    }
    const order = transactions.find((t) => t.id === orderId);
    if (!order) return { success: false, message: 'Order not found.' };
    if (order.isCancelled || order.orderWorkflowStatus === 'Cancelled') {
      return { success: false, message: 'Cannot dispatch a cancelled order.' };
    }

    const deliveryUser =
      users.find((u) => staffId && (u.id === staffId || u.employeeId === staffId)) ||
      users.find((u) => u.roleName === 'Delivery' && u.status === 'Active');
    const assignedName = staffName || deliveryUser?.name || 'Anil Goud';
    const assignedId = staffId || deliveryUser?.employeeId || deliveryUser?.id || 'EMP-1006';
    const assignedPhone = staffPhone || deliveryUser?.phone || '+91 98450 55667';
    const otp = order.deliveryOtp || String(Math.floor(1000 + Math.random() * 9000));
    const bagId = order.deliveryBagId || `BAG-${Date.now().toString().slice(-4)}`;
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    setTransactions((prev) =>
      prev.map((t) =>
        t.id === order.id
          ? {
              ...t,
              orderWorkflowStatus: 'Out for Delivery',
              deliveryBagId: bagId,
              deliveryBoyId: assignedId,
              deliveryBoyName: assignedName,
              deliveryBoyPhone: assignedPhone,
              deliveryOtp: otp,
              deliveryOtpVerified: false,
              orderTimeline: [
                ...(t.orderTimeline || []),
                {
                  status: 'Out for Delivery',
                  timestamp: nowStr,
                  actor: currentUser.name,
                  note: `Dispatched with ${assignedName} (${assignedPhone}) · Bag ${bagId}`,
                },
              ],
            }
          : t
      )
    );

    setPortalNotifications((prev) => [
      ...(order.customerId
        ? [
            {
              id: generateUniqueId('pn'),
              recipientType: 'CUSTOMER' as const,
              recipientId: order.customerId,
              title: `Out for Delivery · OTP: ${otp}`,
              message: `${assignedName} (${assignedPhone}) is on the way with Bag ${bagId}. Share 4-digit OTP ${otp} upon receiving your order.`,
              type: 'order' as const,
              read: false,
              createdAt: nowStr,
            },
          ]
        : []),
      {
        id: generateUniqueId('pn'),
        recipientType: 'STAFF',
        recipientId: 'ALL',
        title: `Assigned Delivery · ${order.onlineOrderId || order.invoiceNo}`,
        message: `Assigned to ${assignedName} · Bag ${bagId} · Collect ${order.paymentType === 'Cash' ? `COD ₹${order.totalAmount}` : 'Prepaid'} & verify customer OTP.`,
        type: 'task',
        read: false,
        createdAt: nowStr,
      },
      ...prev,
    ]);

    recordActivity(
      'Dispatched Online Order',
      'Billing',
      `Dispatched ${order.onlineOrderId || order.invoiceNo} via ${assignedName} (Bag ${bagId})`
    );
    showToast(`Out for Delivery! Customer OTP: ${otp}`);
    return { success: true, otp, message: `Dispatched with ${assignedName}. Delivery OTP: ${otp}` };
  };

  const verifyDeliveryOtpAndCompleteOrder = (
    orderId: string,
    enteredOtp: string,
    codCollected: boolean = true
  ): { success: boolean; invoice?: Transaction; msCreditEarned?: number; message: string } => {
    // STRICT ROLE GUARD: Customers can NEVER mark orders as delivered or verify their own OTP
    if (activeSessionType === 'CUSTOMER' || !currentUser) {
      return { success: false, message: 'Security Denied: Only authorized Delivery Staff or Store Manager can verify Delivery OTP.' };
    }
    const order = transactions.find((t) => t.id === orderId);
    if (!order) {
      return { success: false, message: 'Order not found.' };
    }
    if (order.isCancelled || order.orderWorkflowStatus === 'Cancelled') {
      return { success: false, message: 'Cannot deliver a cancelled order.' };
    }

    // Idempotent duplicate-invoice guard
    if (order.linkedSaleInvoiceId || order.deliveryOtpVerified) {
      const existingSale = transactions.find((t) => t.id === order.linkedSaleInvoiceId && !t.isCancelled);
      return {
        success: true,
        invoice: existingSale,
        msCreditEarned: order.msCreditEarned || 0,
        message: `Order already verified & invoiced (${order.linkedSaleInvoiceNo || 'completed'}).`,
      };
    }

    if (!order.deliveryOtp || enteredOtp.trim() !== order.deliveryOtp.trim()) {
      recordActivity(
        'Failed Delivery OTP Verification',
        'Security',
        `Incorrect OTP entered for Order ${order.onlineOrderId || order.invoiceNo}`,
        { outcome: 'Denied' }
      );
      showToast('Invalid 4-digit Delivery OTP. Please confirm OTP with customer.');
      return { success: false, message: 'Invalid Delivery OTP. Ask the customer for their 4-digit Delivery OTP.' };
    }

    const nowDate = new Date();
    const nowStr = `${nowDate.toLocaleDateString('en-GB')}, ${nowDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    // 1. Deduct physical stock & release reserved stock atomically
    const deductLogs: StockTransactionRecord[] = [];
    setItems((prevItems) =>
      prevItems.map((invItem) => {
        const line = order.items.find(
          (li) => li.name.toLowerCase() === invItem.name.toLowerCase() || (li.hsn && li.hsn === invItem.code)
        );
        if (!line) return invItem;
        const qty = Math.max(1, line.qty || 1);
        const nextStock = Math.max(0, (invItem.stock || 0) - qty);
        const nextReserved = Math.max(0, (invItem.reservedStock || 0) - qty);
        deductLogs.push({
          id: generateUniqueId('stk'),
          itemId: invItem.id,
          itemName: invItem.name,
          type: 'DEDUCT_SALE',
          qtyChange: -qty,
          stockAfter: nextStock,
          reservedAfter: nextReserved,
          referenceNo: order.onlineOrderId || order.invoiceNo,
          actor: currentUser.name,
          timestamp: nowStr,
        });
        return {
          ...invItem,
          stock: nextStock,
          reservedStock: nextReserved,
        };
      })
    );
    if (deductLogs.length > 0) {
      setStockHistory((prev) => [...deductLogs, ...prev]);
    }

    // 2. Generate ONE Final GST Sale Invoice linked to this Sale Order
    const finalInvNo = getNextFormattedInvoiceNo();
    const finalInvId = generateUniqueId('tx');
    const isCodOrder = order.paymentType === 'Cash';
    const settledNow = isCodOrder ? Boolean(codCollected) : true;
    const finalReceived = settledNow ? order.totalAmount : order.receivedAmount || 0;
    const finalBalance = Math.max(0, Math.round((order.totalAmount - finalReceived) * 100) / 100);
    const finalStatus: Transaction['status'] =
      finalBalance === 0 ? 'Paid' : finalReceived > 0 ? 'Partial' : 'Unpaid';

    // 3. Calculate MS Credit Rewards (preventing duplicate awards)
    const earnRate = Math.max(0, serviceAreaConfig.msCreditEarnPercent || 2);
    const netForPoints = Math.max(0, order.totalAmount - (order.deliveryFee || 0));
    const msCreditEarned =
      order.msCreditEarned && order.msCreditEarned > 0
        ? order.msCreditEarned
        : netForPoints > 0
        ? Math.max(netForPoints >= 100 ? 5 : 1, Math.floor((netForPoints * earnRate) / 100))
        : 0;

    const finalSaleInvoice: Transaction = {
      id: finalInvId,
      type: 'Sale',
      invoiceNo: finalInvNo,
      date: nowStr,
      dueDate: nowStr.split(',')[0],
      partyName: order.partyName,
      partyPhone: order.partyPhone,
      partyAddress: order.partyAddress,
      partyGstin: order.partyGstin,
      firm: order.firm || company.name,
      user: currentUser.name,
      customerId: order.customerId,
      paymentType: order.paymentType,
      subtotal: order.subtotal,
      totalDiscount: order.totalDiscount,
      taxableAmount: order.taxableAmount,
      stateOfSupply: order.stateOfSupply || company.state,
      gstType: order.gstType || 'Intra-State',
      cgstAmount: order.cgstAmount,
      sgstAmount: order.sgstAmount,
      igstAmount: order.igstAmount,
      roundOff: order.roundOff,
      totalAmount: order.totalAmount,
      receivedAmount: finalReceived,
      balance: finalBalance,
      status: finalStatus,
      items: (order.items || []).map((li) => ({ ...li, id: generateUniqueId('li') })),
      notes: `Final GST Invoice for Online Order ${order.onlineOrderId || order.invoiceNo} · Bag ${order.deliveryBagId || 'N/A'} · Verified by ${currentUser.name}`,
      createdAt: nowDate.toISOString(),
      source: 'ONLINE_STORE',
      onlineOrderId: order.onlineOrderId,
      fulfillmentStatus: 'Completed',
      orderWorkflowStatus: 'Delivered',
      deliveryBoyId: order.deliveryBoyId,
      deliveryBoyName: order.deliveryBoyName || currentUser.name,
      deliveryBagId: order.deliveryBagId,
      deliveryOtpVerified: true,
      deliveryFee: order.deliveryFee,
      couponCode: order.couponCode,
      couponDiscount: order.couponDiscount,
      msCreditUsed: order.msCreditUsed,
      msCreditEarned,
      paymentStatus: finalBalance === 0 ? 'Paid' : 'Pending',
      convertedFrom: { type: 'Sale Order', docId: order.id, docNo: order.invoiceNo },
    };

    // 4. Update linked Sale Order, add Final Sale Invoice, bump sequential invoice number
    setTransactions((prev) => [
      finalSaleInvoice,
      ...prev.map((t) =>
        t.id === order.id
          ? {
              ...t,
              fulfillmentStatus: 'Completed' as const,
              orderWorkflowStatus: 'Delivered' as const,
              deliveryOtpVerified: true,
              linkedSaleInvoiceId: finalInvId,
              linkedSaleInvoiceNo: finalInvNo,
              msCreditEarned,
              receivedAmount: finalReceived,
              balance: finalBalance,
              status: finalStatus,
              paymentStatus: (finalBalance === 0 ? 'Paid' : 'Pending') as Transaction['paymentStatus'],
              orderTimeline: [
                ...(t.orderTimeline || []),
                {
                  status: 'Delivered',
                  timestamp: nowStr,
                  actor: currentUser.name,
                  note: `Delivery OTP verified · Final GST Invoice #${finalInvNo} created`,
                },
              ],
            }
          : t
      ),
    ]);
    setSettings((prev) => ({ ...prev, nextInvoiceNumber: prev.nextInvoiceNumber + 1 }));

    // 5. Update Party Balance if unpaid balance remains
    if (finalBalance > 0 && order.partyName && order.partyName !== 'Cash Sale') {
      setParties((prev) =>
        prev.map((p) =>
          p.name.toLowerCase() === order.partyName.toLowerCase()
            ? { ...p, balance: Math.round((p.balance + finalBalance) * 100) / 100 }
            : p
        )
      );
    }

    // 6. Settle Payment Record
    if (order.paymentRecordId) {
      setPayments((prev) =>
        prev.map((p) =>
          p.id === order.paymentRecordId
            ? {
                ...p,
                invoiceNo: finalInvNo,
                status: finalBalance === 0 ? 'Completed' : 'Pending',
                verifiedBy: currentUser.name,
              }
            : p
        )
      );
    }

    // 7. Award MS Credit Rewards to Customer Account ONCE
    if (msCreditEarned > 0 && order.customerId) {
      const custAcc = customerAccounts.find((c) => c.customerId === order.customerId);
      if (custAcc) {
        const nextBal = (custAcc.msCreditBalance || 0) + msCreditEarned;
        setCustomerAccounts((prev) =>
          prev.map((c) =>
            c.id === custAcc.id
              ? {
                  ...c,
                  msCreditBalance: nextBal,
                  msCreditEarnedTotal: (c.msCreditEarnedTotal || 0) + msCreditEarned,
                }
              : c
          )
        );
        setMsCreditTransactions((prev) => {
          const alreadyAwarded = prev.some(
            (m) => m.type === 'EARN' && m.orderId === (order.onlineOrderId || order.invoiceNo)
          );
          if (alreadyAwarded) return prev;
          return [
            {
              id: generateUniqueId('msc'),
              customerId: custAcc.customerId,
              customerName: custAcc.fullName,
              type: 'EARN',
              amount: msCreditEarned,
              balanceAfter: nextBal,
              orderId: order.onlineOrderId || order.invoiceNo,
              invoiceNo: finalInvNo,
              description: `Earned ${msCreditEarned} MS Credits (₹${msCreditEarned}) on Delivered Order ${order.onlineOrderId || order.invoiceNo}`,
              createdAt: nowStr,
            },
            ...prev,
          ];
        });
      }
    }

    // 8. Notify Customer
    if (order.customerId) {
      setPortalNotifications((prev) => [
        {
          id: generateUniqueId('pn'),
          recipientType: 'CUSTOMER',
          recipientId: order.customerId!,
          title: `Delivered · Invoice #${finalInvNo} Ready`,
          message: `Order ${order.onlineOrderId || order.invoiceNo} delivered! GST Invoice #${finalInvNo} generated${msCreditEarned > 0 ? ` and +${msCreditEarned} MS Credits added to your wallet.` : '.'}`,
          type: 'order',
          read: false,
          createdAt: nowStr,
        },
        ...prev,
      ]);
      setCustomerActivity((prev) => [
        {
          id: generateUniqueId('ca'),
          customerId: order.customerId!,
          customerName: order.partyName,
          action: `Order Delivered (${order.onlineOrderId || order.invoiceNo})`,
          details: `OTP Verified · GST Invoice #${finalInvNo} generated · +${msCreditEarned} MS Credits`,
          timestamp: nowStr,
          status: 'Success',
        },
        ...prev,
      ]);
    }

    recordActivity(
      'Verified Delivery OTP & Finalized Invoice',
      'Billing',
      `Verified OTP for ${order.onlineOrderId || order.invoiceNo} -> Final GST Invoice #${finalInvNo}`
    );
    showToast(`OTP verified! Final GST Invoice #${finalInvNo} generated.`);
    return {
      success: true,
      invoice: finalSaleInvoice,
      msCreditEarned,
      message: `Delivery verified! Final GST Invoice #${finalInvNo} created and +${msCreditEarned} MS Credits awarded.`,
    };
  };

  const cancelCustomerOnlineOrder = (
    orderId: string,
    reason: string
  ): { success: boolean; message: string } => {
    const order = transactions.find((t) => t.id === orderId);
    if (!order) return { success: false, message: 'Order not found.' };
    if (activeSessionType === 'CUSTOMER') {
      if (!currentCustomer || (order.customerId && order.customerId !== currentCustomer.customerId)) {
        return { success: false, message: 'Access Denied: You can only cancel your own orders.' };
      }
    }
    const stage = order.orderWorkflowStatus || (order.fulfillmentStatus === 'Completed' ? 'Delivered' : 'Pending Approval');
    if (stage === 'Out for Delivery' || stage === 'Delivered' || stage === 'Returned') {
      return {
        success: false,
        message: `Orders in "${stage}" stage cannot be cancelled directly. Please submit a Return / Refund Request after delivery.`,
      };
    }
    if (order.isCancelled || stage === 'Cancelled') {
      return { success: false, message: 'This order is already cancelled.' };
    }

    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    // Release reserved stock cleanly
    const releaseLogs: StockTransactionRecord[] = [];
    setItems((prevItems) =>
      prevItems.map((invItem) => {
        const line = order.items.find(
          (li) => li.name.toLowerCase() === invItem.name.toLowerCase() || (li.hsn && li.hsn === invItem.code)
        );
        if (!line) return invItem;
        const qty = Math.max(1, line.qty || 1);
        const nextReserved = Math.max(0, (invItem.reservedStock || 0) - qty);
        releaseLogs.push({
          id: generateUniqueId('stk'),
          itemId: invItem.id,
          itemName: invItem.name,
          type: 'RELEASE',
          qtyChange: -qty,
          stockAfter: invItem.stock,
          reservedAfter: nextReserved,
          referenceNo: order.onlineOrderId || order.invoiceNo,
          actor: currentCustomer?.fullName || currentUser?.name || 'System',
          timestamp: nowStr,
        });
        return { ...invItem, reservedStock: nextReserved };
      })
    );
    if (releaseLogs.length > 0) {
      setStockHistory((prev) => [...releaseLogs, ...prev]);
    }

    // Refund redeemed MS Credits if used
    if ((order.msCreditUsed || 0) > 0 && order.customerId) {
      const custAcc = customerAccounts.find((c) => c.customerId === order.customerId);
      if (custAcc) {
        const refundAmt = order.msCreditUsed!;
        const nextBal = (custAcc.msCreditBalance || 0) + refundAmt;
        setCustomerAccounts((prev) =>
          prev.map((c) => (c.id === custAcc.id ? { ...c, msCreditBalance: nextBal } : c))
        );
        if (currentCustomer && currentCustomer.customerId === custAcc.customerId) {
          setCurrentCustomer((prev) => (prev ? { ...prev, msCreditBalance: nextBal } : null));
        }
        setMsCreditTransactions((prev) => [
          {
            id: generateUniqueId('msc'),
            customerId: custAcc.customerId,
            customerName: custAcc.fullName,
            type: 'REFUND',
            amount: refundAmt,
            balanceAfter: nextBal,
            orderId: order.onlineOrderId || order.invoiceNo,
            description: `Refunded ${refundAmt} MS Credits on cancellation of ${order.onlineOrderId || order.invoiceNo}`,
            createdAt: nowStr,
          },
          ...prev,
        ]);
      }
    }

    // Update payment refund status if paid online
    if (order.paymentRecordId) {
      setPayments((prev) =>
        prev.map((p) =>
          p.id === order.paymentRecordId
            ? {
                ...p,
                status: p.status === 'Completed' ? 'Refunded' : 'Failed',
                refundStatus: p.status === 'Completed' ? 'Refunded' : 'None',
              }
            : p
        )
      );
    }

    setTransactions((prev) =>
      prev.map((t) =>
        t.id === order.id
          ? {
              ...t,
              isCancelled: true,
              cancellationReason: reason.trim() || 'Cancelled before dispatch',
              cancelledAt: nowStr,
              cancelledBy: currentCustomer?.fullName || currentUser?.name || 'Customer',
              orderWorkflowStatus: 'Cancelled',
              paymentStatus: t.receivedAmount > 0 ? 'Refunded' : t.paymentStatus,
              orderTimeline: [
                ...(t.orderTimeline || []),
                {
                  status: 'Cancelled',
                  timestamp: nowStr,
                  actor: currentCustomer?.fullName || currentUser?.name || 'Customer',
                  note: reason.trim() || 'Cancelled before dispatch',
                },
              ],
            }
          : t
      )
    );

    setPortalNotifications((prev) => [
      {
        id: generateUniqueId('pn'),
        recipientType: 'STAFF',
        recipientId: 'ALL',
        title: `Order Cancelled · ${order.onlineOrderId || order.invoiceNo}`,
        message: `${order.partyName} cancelled order (${reason || 'Customer request'}). Reserved stock released.`,
        type: 'order',
        read: false,
        createdAt: nowStr,
      },
      ...prev,
    ]);

    showToast(`Order ${order.onlineOrderId || order.invoiceNo} cancelled cleanly.`);
    return { success: true, message: 'Order cancelled and reserved stock released.' };
  };

  const submitCustomerReturnRequest = (
    orderId: string,
    reason: string,
    selectedItems?: { itemId?: string; name: string; qty: number; amount: number }[]
  ): { success: boolean; request?: ReturnRefundRequest; message: string } => {
    if (activeSessionType !== 'CUSTOMER' || !currentCustomer) {
      return { success: false, message: 'Customer login required.' };
    }
    const order = transactions.find((t) => t.id === orderId);
    if (!order) return { success: false, message: 'Order not found.' };
    if (order.orderWorkflowStatus !== 'Delivered' && order.fulfillmentStatus !== 'Completed') {
      return { success: false, message: 'Returns can only be requested for delivered orders.' };
    }
    const duplicate = returnRequests.find(
      (r) => r.orderId === order.id && (r.status === 'Requested' || r.status === 'Approved')
    );
    if (duplicate) {
      return { success: false, message: `Return request ${duplicate.returnNo} already exists for this order.` };
    }
    if (!reason.trim()) {
      return { success: false, message: 'Please provide a reason for your return / refund request.' };
    }

    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const retItems =
      selectedItems && selectedItems.length > 0
        ? selectedItems
        : (order.items || []).map((li) => ({
            name: li.name,
            qty: li.qty,
            amount: li.amount,
          }));
    const refundAmount = Math.round(retItems.reduce((s, r) => s + r.amount, 0) * 100) / 100 || order.totalAmount;
    const returnNo = `RET-${Date.now().toString().slice(-4)}`;

    const newReq: ReturnRefundRequest = {
      id: generateUniqueId('ret'),
      returnNo,
      orderId: order.id,
      invoiceNo: order.linkedSaleInvoiceNo || order.invoiceNo,
      customerId: currentCustomer.customerId,
      customerName: currentCustomer.fullName,
      reason: reason.trim(),
      items: retItems,
      refundAmount,
      status: 'Requested',
      createdAt: nowStr,
    };

    setReturnRequests((prev) => [newReq, ...prev]);
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === order.id
          ? {
              ...t,
              orderWorkflowStatus: 'Return Requested',
              orderTimeline: [
                ...(t.orderTimeline || []),
                {
                  status: 'Return Requested',
                  timestamp: nowStr,
                  actor: currentCustomer.fullName,
                  note: `${returnNo}: ${reason.trim()}`,
                },
              ],
            }
          : t
      )
    );

    setPortalNotifications((prev) => [
      {
        id: generateUniqueId('pn'),
        recipientType: 'STAFF',
        recipientId: 'ALL',
        title: `Return Request ${returnNo}`,
        message: `${currentCustomer.fullName} requested return of ₹${refundAmount.toLocaleString('en-IN')} for Order ${order.onlineOrderId || order.invoiceNo}.`,
        type: 'order',
        read: false,
        createdAt: nowStr,
      },
      ...prev,
    ]);

    showToast(`Return request ${returnNo} submitted for Manager review.`);
    return { success: true, request: newReq, message: `Return request ${returnNo} submitted.` };
  };

  const processReturnRefundRequest = (
    returnId: string,
    decision: 'Approved' | 'Rejected'
  ): { success: boolean; message: string } => {
    if (activeSessionType === 'CUSTOMER' || !currentUser) {
      return { success: false, message: 'Security Violation: Only Staff/Manager/Admin can process returns.' };
    }
    const req = returnRequests.find((r) => r.id === returnId);
    if (!req) return { success: false, message: 'Return request not found.' };
    if (req.status !== 'Requested') {
      return { success: false, message: `Return ${req.returnNo} has already been ${req.status.toLowerCase()}.` };
    }

    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const order = transactions.find((t) => t.id === req.orderId);

    if (decision === 'Rejected') {
      setReturnRequests((prev) =>
        prev.map((r) =>
          r.id === req.id ? { ...r, status: 'Rejected', processedBy: currentUser.name, processedAt: nowStr } : r
        )
      );
      if (order) {
        setTransactions((prev) =>
          prev.map((t) => (t.id === order.id ? { ...t, orderWorkflowStatus: 'Delivered' } : t))
        );
      }
      setPortalNotifications((prev) => [
        {
          id: generateUniqueId('pn'),
          recipientType: 'CUSTOMER',
          recipientId: req.customerId,
          title: `Return Update · ${req.returnNo}`,
          message: `Your return request ${req.returnNo} was declined after verification.`,
          type: 'order',
          read: false,
          createdAt: nowStr,
        },
        ...prev,
      ]);
      showToast(`Return ${req.returnNo} rejected.`);
      return { success: true, message: 'Return request rejected.' };
    }

    // Approved: Restock inventory + Create Sale Return (Credit Note) + Refund to MS Credit Wallet
    const restockLogs: StockTransactionRecord[] = [];
    setItems((prevItems) =>
      prevItems.map((invItem) => {
        const retLine = req.items.find((ri) => ri.name.toLowerCase() === invItem.name.toLowerCase());
        if (!retLine) return invItem;
        const qty = Math.max(1, retLine.qty || 1);
        const nextStock = (invItem.stock || 0) + qty;
        restockLogs.push({
          id: generateUniqueId('stk'),
          itemId: invItem.id,
          itemName: invItem.name,
          type: 'RETURN_RESTOCK',
          qtyChange: qty,
          stockAfter: nextStock,
          reservedAfter: invItem.reservedStock || 0,
          referenceNo: req.returnNo,
          actor: currentUser.name,
          timestamp: nowStr,
        });
        return { ...invItem, stock: nextStock };
      })
    );
    if (restockLogs.length > 0) {
      setStockHistory((prev) => [...restockLogs, ...prev]);
    }

    const creditNoteTx: Transaction = {
      id: generateUniqueId('tx'),
      type: 'Sale Return',
      invoiceNo: `CN-${Date.now().toString().slice(-4)}`,
      date: nowStr,
      dueDate: nowStr.split(',')[0],
      partyName: req.customerName,
      firm: company.name,
      user: currentUser.name,
      customerId: req.customerId,
      paymentType: 'Credit',
      totalAmount: req.refundAmount,
      receivedAmount: req.refundAmount,
      balance: 0,
      status: 'Paid',
      originalInvoiceNo: req.invoiceNo,
      returnReason: req.reason,
      items: req.items.map((ri) => ({
        id: generateUniqueId('li'),
        name: ri.name,
        hsn: '2106',
        qty: ri.qty,
        unit: 'PCS',
        price: Math.round((ri.amount / Math.max(1, ri.qty)) * 100) / 100,
        discountPercent: 0,
        taxPercent: 0,
        amount: ri.amount,
      })),
      notes: `Approved Return ${req.returnNo} for Invoice #${req.invoiceNo} · Refunded to MS Credit Wallet`,
      createdAt: new Date().toISOString(),
      source: 'ONLINE_STORE',
    };

    setTransactions((prev) => [
      creditNoteTx,
      ...prev.map((t) =>
        t.id === req.orderId
          ? {
              ...t,
              orderWorkflowStatus: 'Returned' as const,
              paymentStatus: 'Refunded' as const,
              orderTimeline: [
                ...(t.orderTimeline || []),
                {
                  status: 'Returned',
                  timestamp: nowStr,
                  actor: currentUser.name,
                  note: `${req.returnNo} approved · Restocked & ₹${req.refundAmount} credited`,
                },
              ],
            }
          : t
      ),
    ]);

    setReturnRequests((prev) =>
      prev.map((r) =>
        r.id === req.id ? { ...r, status: 'Refunded', processedBy: currentUser.name, processedAt: nowStr } : r
      )
    );

    const custAcc = customerAccounts.find((c) => c.customerId === req.customerId);
    if (custAcc) {
      const creditRefund = Math.round(req.refundAmount);
      const nextBal = (custAcc.msCreditBalance || 0) + creditRefund;
      setCustomerAccounts((prev) =>
        prev.map((c) => (c.id === custAcc.id ? { ...c, msCreditBalance: nextBal } : c))
      );
      setMsCreditTransactions((prev) => [
        {
          id: generateUniqueId('msc'),
          customerId: custAcc.customerId,
          customerName: custAcc.fullName,
          type: 'REFUND',
          amount: creditRefund,
          balanceAfter: nextBal,
          invoiceNo: req.invoiceNo,
          description: `Return Refund ${req.returnNo} credited to MS Credit Wallet (₹${creditRefund})`,
          createdAt: nowStr,
        },
        ...prev,
      ]);
    }

    setPortalNotifications((prev) => [
      {
        id: generateUniqueId('pn'),
        recipientType: 'CUSTOMER',
        recipientId: req.customerId,
        title: `Refund Processed · ${req.returnNo}`,
        message: `Your return was approved! ₹${req.refundAmount.toLocaleString('en-IN')} credited as MS Credits & inventory restocked.`,
        type: 'payment',
        read: false,
        createdAt: nowStr,
      },
      ...prev,
    ]);

    recordActivity('Approved Return & Refund', 'Billing', `Processed ${req.returnNo} (₹${req.refundAmount}) with Credit Note #${creditNoteTx.invoiceNo}`);
    showToast(`Return ${req.returnNo} approved, restocked, and refunded!`);
    return { success: true, message: `Return ${req.returnNo} refunded & restocked.` };
  };

  const updateProductPricing = (
    itemId: string,
    updates: { salePrice?: number; wholesalePrice?: number; minWholesaleQty?: number; stock?: number }
  ): boolean => {
    if (activeSessionType === 'CUSTOMER' || !currentUser) return false;
    const existing = items.find((it) => it.id === itemId);
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (existing) {
      const historyLogs: PriceHistoryEntry[] = [];
      if (updates.salePrice !== undefined && updates.salePrice !== existing.salePrice) {
        historyLogs.push({
          id: generateUniqueId('ph'),
          itemId: existing.id,
          itemName: existing.name,
          priceType: 'Sale Price',
          oldPrice: existing.salePrice,
          newPrice: Math.max(0, updates.salePrice),
          timestamp: nowStr,
          actor: currentUser.name,
        });
      }
      if (
        updates.wholesalePrice !== undefined &&
        updates.wholesalePrice !== (existing.wholesalePrice || existing.salePrice)
      ) {
        historyLogs.push({
          id: generateUniqueId('ph'),
          itemId: existing.id,
          itemName: existing.name,
          priceType: 'Wholesale Price',
          oldPrice: existing.wholesalePrice || existing.salePrice,
          newPrice: Math.max(0, updates.wholesalePrice),
          timestamp: nowStr,
          actor: currentUser.name,
        });
      }
      if (historyLogs.length > 0) {
        setPriceHistory((prev) => [...historyLogs, ...prev]);
      }
    }

    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              salePrice: updates.salePrice !== undefined ? Math.max(0, updates.salePrice) : it.salePrice,
              wholesalePrice:
                updates.wholesalePrice !== undefined ? Math.max(0, updates.wholesalePrice) : it.wholesalePrice,
              minWholesaleQty:
                updates.minWholesaleQty !== undefined
                  ? Math.max(1, Math.floor(updates.minWholesaleQty))
                  : it.minWholesaleQty,
              stock: updates.stock !== undefined ? Math.max(0, Math.floor(updates.stock)) : it.stock,
            }
          : it
      )
    );
    recordActivity('Updated Product Pricing', 'Inventory', `Updated pricing/wholesale tier for item ${itemId}`);
    showToast('Product pricing & wholesale tier saved.', 'success');
    return true;
  };

  const replyToCustomerSupport = async (
    messageId: string,
    replyText: string
  ): Promise<{ success: boolean; message: string }> => {
    if (activeSessionType === 'CUSTOMER' || !currentUser) {
      return { success: false, message: 'Unauthorized.' };
    }
    const cleanReply = replyText.trim();
    if (!cleanReply) return { success: false, message: 'Reply message cannot be empty.' };

    const msgObj = supportMessages.find((m) => m.id === messageId);
    if (!msgObj) return { success: false, message: 'Support thread not found.' };

    try {
      await apiClient.replyCustomerSupport({
        messageId,
        managerId: currentUser.employeeId || currentUser.id,
        managerName: currentUser.name,
        roleName: currentUser.roleName,
        replyText: cleanReply,
      });
    } catch {
      // keep working cleanly with local state sync
    }

    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    setSupportMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              status: 'Replied',
              replies: [
                ...(m.replies || []),
                {
                  id: generateUniqueId('rep'),
                  sender: 'Manager',
                  senderName: currentUser.name,
                  message: cleanReply,
                  timestamp: nowStr,
                },
              ],
            }
          : m
      )
    );

    if (msgObj.customerId) {
      setPortalNotifications((prev) => [
        {
          id: generateUniqueId('pn'),
          recipientType: 'CUSTOMER',
          recipientId: msgObj.customerId,
          title: `Support Reply · ${msgObj.subject}`,
          message: `${currentUser.name}: ${cleanReply}`,
          type: 'system',
          read: false,
          createdAt: nowStr,
        },
        ...prev,
      ]);
    }

    recordActivity('Replied to Customer Support', 'Settings', `Replied to ${msgObj.customerName} on "${msgObj.subject}"`);
    showToast('Support reply sent to customer!');
    return { success: true, message: 'Reply sent successfully.' };
  };

  const rejectOnlineOrder = (orderId: string, reason: string): { success: boolean; message: string } => {
    if (activeSessionType === 'CUSTOMER' || !currentUser) {
      return { success: false, message: 'Unauthorized action.' };
    }
    const order = transactions.find((t) => t.id === orderId);
    if (!order) return { success: false, message: 'Order not found.' };
    if (order.orderWorkflowStatus === 'Delivered') {
      return { success: false, message: 'Delivered orders cannot be rejected.' };
    }

    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    // Release reserved stock back to available inventory
    setItems((prevItems) =>
      prevItems.map((invItem) => {
        const line = order.items.find(
          (li) => li.name.toLowerCase() === invItem.name.toLowerCase() || (li.hsn && li.hsn === invItem.code)
        );
        if (!line) return invItem;
        return {
          ...invItem,
          reservedStock: Math.max(0, (invItem.reservedStock || 0) - (line.qty || 1)),
        };
      })
    );

    setTransactions((prev) =>
      prev.map((t) =>
        t.id === orderId
          ? {
              ...t,
              isCancelled: true,
              orderWorkflowStatus: 'Cancelled',
              fulfillmentStatus: 'Cancelled',
              rejectedReason: reason || 'Rejected by Online Store Manager',
              orderTimeline: [
                ...(t.orderTimeline || []),
                {
                  status: 'Cancelled',
                  timestamp: nowStr,
                  actor: currentUser.name,
                  note: reason || 'Rejected by Online Store Manager',
                },
              ],
            }
          : t
      )
    );

    if (order.customerId) {
      setPortalNotifications((prev) => [
        {
          id: generateUniqueId('pn'),
          recipientType: 'CUSTOMER',
          recipientId: order.customerId!,
          title: `Order Rejected · ${order.onlineOrderId || order.invoiceNo}`,
          message: reason || 'Your online order was declined by the Online Store Manager.',
          type: 'order',
          read: false,
          createdAt: nowStr,
        },
        ...prev,
      ]);
    }

    recordActivity('Rejected Online Order', 'Billing', `Rejected ${order.onlineOrderId || order.invoiceNo}: ${reason}`);
    showToast(`Order ${order.onlineOrderId || order.invoiceNo} rejected.`);
    return { success: true, message: 'Order rejected & reserved stock released.' };
  };

  const markOrderReadyForDispatch = (orderId: string, bagId?: string): { success: boolean; message: string } => {
    if (activeSessionType === 'CUSTOMER' || !currentUser) {
      return { success: false, message: 'Unauthorized action.' };
    }
    const order = transactions.find((t) => t.id === orderId);
    if (!order) return { success: false, message: 'Order not found.' };
    const finalBag = bagId || order.deliveryBagId || `BAG-${Date.now().toString().slice(-4)}`;
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    setTransactions((prev) =>
      prev.map((t) =>
        t.id === orderId
          ? {
              ...t,
              orderWorkflowStatus: 'Packing',
              deliveryBagId: finalBag,
              notes: `${t.notes ? `${t.notes} · ` : ''}Ready for Dispatch (${finalBag})`,
              orderTimeline: [
                ...(t.orderTimeline || []),
                {
                  status: 'Ready for Dispatch',
                  timestamp: nowStr,
                  actor: currentUser.name,
                  note: `Sealed in ${finalBag} and staged for delivery pickup`,
                },
              ],
            }
          : t
      )
    );
    showToast(`Order marked Ready for Dispatch (${finalBag})`);
    return { success: true, message: `Ready for Dispatch (${finalBag})` };
  };

  const updateDeliveryBoyAvailability = (status: 'Available' | 'On Break' | 'Offline', targetUserId?: string) => {
    const uid = targetUserId || currentUser?.id;
    if (!uid) return;
    setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, deliveryAvailability: status } : u)));
    if (currentUser && currentUser.id === uid) {
      setCurrentUser({ ...currentUser, deliveryAvailability: status });
    }
    showToast(`Delivery availability updated to ${status}`);
  };

  const markDeliveryOutcome = (
    orderId: string,
    outcome: 'Cancelled' | 'Returned',
    reason: string
  ): { success: boolean; message: string } => {
    if (activeSessionType === 'CUSTOMER' || !currentUser) {
      return { success: false, message: 'Unauthorized.' };
    }
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === orderId
          ? {
              ...t,
              orderWorkflowStatus: outcome,
              rejectedReason: reason,
              orderTimeline: [
                ...(t.orderTimeline || []),
                {
                  status: outcome === 'Cancelled' ? 'Delivery Failed' : 'Returned',
                  timestamp: nowStr,
                  actor: currentUser.name,
                  note: reason || `Marked ${outcome} by Delivery Partner`,
                },
              ],
            }
          : t
      )
    );
    showToast(`Order updated to ${outcome === 'Cancelled' ? 'Failed Delivery' : 'Returned'}`);
    return { success: true, message: 'Delivery status recorded.' };
  };

  const adminUpdateUserConfig = (
    userId: string,
    updates: {
      sellerType?: SellerType;
      onlineInventoryAccess?: boolean;
      deliveryAvailability?: 'Available' | 'On Break' | 'Offline';
    }
  ): { success: boolean; message: string } => {
    if (!isAdminSession()) {
      return { success: false, message: 'Admin permission required.' };
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updates } : u)));
    showToast('Role configuration updated.');
    return { success: true, message: 'Updated successfully.' };
  };

  // ==========================================
  // DEEP ERP ACTIONS: DOUBLE-ENTRY, BATCHES, SERIALS, VARIANTS, RECURRING, RECYCLE BIN, CSV IMPORT
  // ==========================================
  const addAccount = (acc: Omit<AccountRecord, 'id'>): AccountRecord => {
    const newAcc: AccountRecord = { ...acc, id: generateUniqueId('acc') };
    setAccounts((prev) => [...prev, newAcc]);
    recordActivity('Added Ledger Account', 'Settings', `Created account ${newAcc.code} - ${newAcc.name}`);
    showToast(`Account "${newAcc.name}" added to Chart of Accounts.`, 'success');
    return newAcc;
  };

  const updateAccount = (id: string, updates: Partial<AccountRecord>) => {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
    showToast('Account updated.', 'success');
  };

  const createJournalVoucher = (
    input: Omit<JournalVoucher, 'id' | 'createdAt' | 'createdBy'>
  ): { success: boolean; message: string; voucher?: JournalVoucher } => {
    const debitSum = Math.round(input.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) * 100) / 100;
    const creditSum = Math.round(input.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0) * 100) / 100;
    if (debitSum <= 0 || Math.abs(debitSum - creditSum) > 0.01) {
      return {
        success: false,
        message: `Unbalanced Journal: Total Debit (₹${debitSum}) must equal Total Credit (₹${creditSum}).`,
      };
    }
    const voucher: JournalVoucher = {
      ...input,
      id: generateUniqueId('jv'),
      totalDebit: debitSum,
      totalCredit: creditSum,
      createdBy: currentUser?.name || 'Accountant',
      createdAt: new Date().toISOString(),
    };
    setJournalVouchers((prev) => [voucher, ...prev]);
    recordActivity('Posted Journal Voucher', 'Billing', `Voucher #${voucher.voucherNo} (${voucher.voucherType}) ₹${debitSum}`);
    showToast(`Journal Voucher #${voucher.voucherNo} posted cleanly.`, 'success');
    return { success: true, message: 'Journal Voucher saved.', voucher };
  };

  const executeContraVoucher = (
    direction: 'CASH_TO_BANK' | 'BANK_TO_CASH',
    amount: number,
    ref?: string
  ): { success: boolean; message: string } => {
    if (!amount || amount <= 0) {
      return { success: false, message: 'Enter a valid contra transfer amount.' };
    }
    const dateStr = new Date().toLocaleDateString('en-GB');
    const voucherNo = `CNT-${Date.now().toString().slice(-5)}`;
    const lines =
      direction === 'CASH_TO_BANK'
        ? [
            { id: generateUniqueId('jl'), accountId: 'acc-bank', accountName: 'Primary Bank Account', debit: amount, credit: 0 },
            { id: generateUniqueId('jl'), accountId: 'acc-cash', accountName: 'Cash in Hand', debit: 0, credit: amount },
          ]
        : [
            { id: generateUniqueId('jl'), accountId: 'acc-cash', accountName: 'Cash in Hand', debit: amount, credit: 0 },
            { id: generateUniqueId('jl'), accountId: 'acc-bank', accountName: 'Primary Bank Account', debit: 0, credit: amount },
          ];
    return createJournalVoucher({
      voucherNo,
      date: dateStr,
      voucherType: 'Contra',
      referenceNo: ref || voucherNo,
      narration:
        direction === 'CASH_TO_BANK'
          ? `Cash deposited to Bank (${ref || 'Counter Deposit'})`
          : `Cash withdrawn from Bank (${ref || 'Counter Withdrawal'})`,
      lines,
      totalDebit: amount,
      totalCredit: amount,
    });
  };

  const addBatch = (batch: Omit<ItemBatch, 'id'>): ItemBatch => {
    const rec: ItemBatch = { ...batch, id: generateUniqueId('bat') };
    setBatches((prev) => [rec, ...prev]);
    showToast(`Batch #${rec.batchNumber} tracked for ${rec.itemName}.`, 'success');
    return rec;
  };

  const addVariant = (variant: Omit<ItemVariant, 'id'>): ItemVariant => {
    const rec: ItemVariant = { ...variant, id: generateUniqueId('var') };
    setVariants((prev) => [rec, ...prev]);
    showToast(`Variant "${rec.name}" added.`, 'success');
    return rec;
  };

  const addSerialNumber = (serial: Omit<SerialNumberRecord, 'id'>): SerialNumberRecord => {
    const rec: SerialNumberRecord = { ...serial, id: generateUniqueId('ser') };
    setSerialNumbers((prev) => [rec, ...prev]);
    showToast(`Serial #${rec.serialNo} registered.`, 'success');
    return rec;
  };

  const updateSerialStatus = (
    id: string,
    status: SerialNumberRecord['status'],
    customerName?: string
  ) => {
    setSerialNumbers((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              status,
              customerName: customerName ?? s.customerName,
              saleDate: status === 'Sold' ? new Date().toLocaleDateString('en-GB') : s.saleDate,
            }
          : s
      )
    );
    showToast(`Serial updated to ${status}.`, 'info');
  };

  const recordGodownTransferStock = (payload: {
    itemId: string;
    fromGodownId: string;
    toGodownId: string;
    quantity: number;
    transferNo: string;
  }) => {
    const qty = Math.max(0, payload.quantity);
    if (!qty) return;
    const targetItem = items.find((i) => i.id === payload.itemId);
    if (!targetItem) return;

    const currentMap: Record<string, number> = {
      ...(targetItem.godownStocks || { [targetItem.godownId || 'gdw-1']: targetItem.stock || 0 }),
    };
    const sourceAvail = currentMap[payload.fromGodownId] ?? 0;
    const moved = Math.min(qty, Math.max(0, sourceAvail));
    currentMap[payload.fromGodownId] = Math.max(0, sourceAvail - moved);
    currentMap[payload.toGodownId] = (currentMap[payload.toGodownId] || 0) + qty;

    setItems((prev) =>
      prev.map((it) =>
        it.id === payload.itemId
          ? {
              ...it,
              godownStocks: currentMap,
            }
          : it
      )
    );

    const ts = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    setStockHistory((prev) => [
      {
        id: generateUniqueId('stk'),
        itemId: targetItem.id,
        itemName: targetItem.name,
        type: 'MANUAL_ADJUSTMENT',
        qtyChange: 0,
        stockAfter: targetItem.stock,
        reservedAfter: targetItem.reservedStock || 0,
        referenceNo: payload.transferNo,
        actor: currentUser?.name || 'Store Supervisor',
        timestamp: ts,
        notes: `Transferred ${qty} ${targetItem.unit} from ${payload.fromGodownId} to ${payload.toGodownId}`,
      },
      ...prev,
    ]);
  };

  const upsertItemBatches = (
    itemId: string,
    itemName: string,
    rows: Array<{
      batchNumber: string;
      mfgDate: string;
      expiryDate: string;
      qty: number;
      purchaseRate: number;
      saleRate: number;
      warehouseId?: string;
    }>
  ) => {
    const cleanRows = rows
      .filter((r) => r.batchNumber.trim() !== '')
      .map((r) => ({
        id: generateUniqueId('bat'),
        itemId,
        itemName,
        batchNumber: r.batchNumber.trim(),
        mfgDate: r.mfgDate || new Date().toISOString().slice(0, 10),
        expiryDate: r.expiryDate || '',
        purchaseRate: Number(r.purchaseRate) || 0,
        saleRate: Number(r.saleRate) || 0,
        qty: Math.max(0, Number(r.qty) || 0),
        warehouseId: r.warehouseId,
      }));
    setBatches((prev) => [
      ...cleanRows,
      ...prev.filter((b) => b.itemId !== itemId),
    ]);
  };

  const allocatePaymentToInvoices = (payload: {
    direction: 'IN' | 'OUT';
    partyName: string;
    partyPhone?: string;
    paymentType: Transaction['paymentType'];
    extendedPaymentMode?: ExtendedPaymentMode;
    splitPayments?: SplitPaymentPart[];
    totalAmount: number;
    writeOffAmount?: number;
    refNo?: string;
    notes?: string;
    tags?: string[];
    customFields?: Record<string, string>;
    attachments?: Transaction['attachments'];
    allocations: { invoiceId: string; amount: number }[];
  }): Transaction | null => {
    const amt = Math.round((Number(payload.totalAmount) || 0) * 100) / 100;
    if (!payload.partyName.trim() || amt <= 0) {
      showToast('Select a party and enter a valid payment amount.', 'warning');
      return null;
    }

    const mode: ExtendedPaymentMode =
      payload.extendedPaymentMode ||
      (payload.paymentType === 'Bank Transfer'
        ? 'Bank'
        : payload.paymentType === 'Credit'
        ? 'Cash'
        : payload.paymentType);
    const limitEval = evaluatePaymentLimits({
      amount: amt,
      mode,
      splitParts: payload.splitPayments,
      limits: paymentLimits,
    });

    const receiptNo =
      payload.direction === 'IN'
        ? getNextDocumentNumber('Payment Receipt')
        : `PAYOUT-${Math.floor(1000 + Math.random() * 9000)}`;
    const todayStr = new Date().toLocaleDateString('en-GB');
    const validAllocs = payload.allocations.filter((a) => a.amount > 0);
    const totalAllocated = Math.round(validAllocs.reduce((s, a) => s + a.amount, 0) * 100) / 100;
    const excessAdvance = Math.max(0, Math.round((amt - totalAllocated) * 100) / 100);
    const writeOffAmt = Math.max(0, Number(payload.writeOffAmount) || 0);
    const allocSummary =
      validAllocs.length > 0
        ? `Allocated ₹${totalAllocated.toLocaleString('en-IN')} across ${validAllocs.length} bill(s)${excessAdvance > 0 ? ` · Advance ₹${excessAdvance}` : ''}${writeOffAmt > 0 ? ` · Write-off ₹${writeOffAmt}` : ''}`
        : 'On-account / Advance settlement';
    const splitNote =
      mode === 'Mixed/Split' && payload.splitPayments?.length
        ? ` [Split: ${payload.splitPayments.map((p) => `${p.mode} ₹${p.amount}`).join(' + ')}]`
        : '';

    const mappedPaymentType = mapExtendedModeToTxPaymentType(mode);

    const createdTx = addTransaction({
      type: payload.direction === 'IN' ? 'Payment-In' : 'Purchase',
      invoiceNo: receiptNo,
      date: todayStr,
      dueDate: todayStr,
      partyName: payload.partyName,
      partyPhone: payload.partyPhone || '',
      firm: company.name || 'MY STORE',
      user: currentUser?.name || 'Accountant',
      paymentType: mappedPaymentType,
      extendedPaymentMode: mode,
      splitPayments: payload.splitPayments,
      writeOffAmount: writeOffAmt,
      excessAdvanceAmount: excessAdvance,
      approvalRequired: limitEval.requiresApproval,
      approvalReason: limitEval.reasons.join('; '),
      workflowStatus: limitEval.requiresApproval ? 'Pending' : 'Completed',
      tags: payload.tags,
      customFields: payload.customFields,
      attachments: payload.attachments,
      totalAmount: amt,
      receivedAmount: amt,
      balance: 0,
      status: 'Paid',
      items: [],
      notes:
        payload.direction === 'IN'
          ? `${allocSummary}${splitNote}. ${payload.refNo ? `Ref/UTR: ${payload.refNo}. ` : ''}${payload.notes || ''}`.trim()
          : `Payment-Out voucher to ${payload.partyName}. ${allocSummary}${splitNote}. Ref/Tx: ${payload.refNo || 'N/A'}. ${payload.notes || ''}`.trim(),
    });

    if (!createdTx) return null;

    if (limitEval.exceedsLimit) {
      showToast(
        limitEval.requiresApproval
          ? `Payment #${receiptNo} queued for Admin Approval: ${limitEval.reasons[0]}`
          : `Limit Alert: ${limitEval.reasons[0]}`,
        'warning'
      );
    }

    if (validAllocs.length > 0 || writeOffAmt > 0) {
      const allocMap = new Map(validAllocs.map((a) => [a.invoiceId, a.amount]));
      setTransactions((prev) =>
        prev.map((tx) => {
          const applied = allocMap.get(tx.id);
          if (!applied || applied <= 0) return tx;
          const totalSettled = applied + (validAllocs.length === 1 ? writeOffAmt : 0);
          const nextReceived = Math.min(tx.totalAmount, Math.round(((tx.receivedAmount || 0) + totalSettled) * 100) / 100);
          const nextBalance = Math.max(0, Math.round((tx.totalAmount - nextReceived) * 100) / 100);
          const nextStatus: Transaction['status'] =
            nextBalance <= 0.01 ? 'Paid' : nextReceived > 0 ? 'Partial' : 'Unpaid';
          const prevAllocList = tx.allocatedPayments || [];
          return {
            ...tx,
            receivedAmount: nextReceived,
            balance: nextBalance,
            status: nextStatus,
            allocatedPayments: [
              ...prevAllocList,
              { paymentId: createdTx.id, receiptNo, amount: applied, date: todayStr },
            ],
          };
        })
      );
    }

    return createdTx;
  };

  const addRecurringTemplate = (tpl: Omit<RecurringTemplate, 'id'>): RecurringTemplate => {
    const rec: RecurringTemplate = { ...tpl, id: generateUniqueId('rec') };
    setRecurringTemplates((prev) => [rec, ...prev]);
    showToast(`Recurring ${rec.txType} "${rec.title}" scheduled.`, 'success');
    return rec;
  };

  const toggleRecurringTemplate = (id: string) => {
    setRecurringTemplates((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r))
    );
  };

  const deleteRecurringTemplate = (id: string) => {
    setRecurringTemplates((prev) => prev.filter((r) => r.id !== id));
    showToast('Recurring schedule removed.', 'info');
  };

  const runDueRecurringTransactions = (): number => {
    const todayIso = new Date().toISOString().slice(0, 10);
    let generated = 0;
    const newLogs: RecurringExecutionLog[] = [];
    const updated = recurringTemplates.map((tpl) => {
      if (!tpl.isActive || tpl.nextRunDate > todayIso) return tpl;
      generated++;
      const created = addTransaction({
        type: tpl.txType,
        invoiceNo: `REC-${Date.now().toString().slice(-4)}-${generated}`,
        date: `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        dueDate: new Date().toLocaleDateString('en-GB'),
        partyName: tpl.partyName || (tpl.txType === 'Sale' ? 'Cash Sale' : 'Recurring Entry'),
        firm: company.name,
        user: currentUser?.name || 'Auto Recurring',
        paymentType: tpl.paymentType,
        totalAmount: tpl.amount,
        receivedAmount: tpl.paymentType === 'Credit' ? 0 : tpl.amount,
        balance: tpl.paymentType === 'Credit' ? tpl.amount : 0,
        status: tpl.paymentType === 'Credit' ? 'Unpaid' : 'Paid',
        items: [],
        notes: `Auto-generated recurring ${tpl.frequency}: ${tpl.title}`,
        source: 'MANUAL',
      });
      newLogs.push({
        id: generateUniqueId('reclog'),
        templateId: tpl.id,
        templateTitle: tpl.title,
        executedAt: new Date().toISOString(),
        status: created ? 'Success' : 'Failed',
        generatedTxId: created?.id,
        generatedInvoiceNo: created?.invoiceNo,
        errorMessage: created ? undefined : 'Blocked by validation or locked financial period',
        retryCount: 0,
      });
      if (!created) return tpl;
      return {
        ...tpl,
        lastRunDate: todayIso,
        nextRunDate: computeNextRecurringDate(tpl.nextRunDate, tpl.frequency),
      };
    });
    if (newLogs.length > 0) {
      setRecurringExecutionLogs((prev) => [...newLogs, ...prev].slice(0, 100));
    }
    if (generated > 0) {
      setRecurringTemplates(updated);
      showToast(`Processed ${generated} due recurring schedule(s).`, 'success');
    }
    return generated;
  };

  // ==========================================
  // 5001 - 5400 ENTERPRISE ENGINE ACTIONS
  // ==========================================
  const addTransactionTemplate = (
    tpl: Omit<TransactionTemplate, 'id' | 'createdAt' | 'createdBy'>
  ): TransactionTemplate => {
    const rec: TransactionTemplate = {
      ...tpl,
      id: generateUniqueId('txtpl'),
      createdBy: currentUser?.name || 'Admin',
      createdAt: new Date().toISOString(),
    };
    setTransactionTemplates((prev) => [rec, ...prev]);
    showToast(`Template "${rec.name}" saved for quick reuse.`, 'success');
    return rec;
  };

  const deleteTransactionTemplate = (id: string) => {
    setTransactionTemplates((prev) => prev.filter((t) => t.id !== id));
    showToast('Transaction template deleted.', 'info');
  };

  const retryRecurringExecution = (logId: string): boolean => {
    const targetLog = recurringExecutionLogs.find((l) => l.id === logId);
    if (!targetLog) return false;
    const tpl = recurringTemplates.find((t) => t.id === targetLog.templateId);
    if (!tpl) {
      showToast('Original recurring template no longer exists.', 'warning');
      return false;
    }
    const created = addTransaction({
      type: tpl.txType,
      invoiceNo: `REC-R-${Date.now().toString().slice(-4)}`,
      date: `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      dueDate: new Date().toLocaleDateString('en-GB'),
      partyName: tpl.partyName || 'Cash Sale',
      firm: company.name,
      user: currentUser?.name || 'Auto Retry',
      paymentType: tpl.paymentType,
      totalAmount: tpl.amount,
      receivedAmount: tpl.paymentType === 'Credit' ? 0 : tpl.amount,
      balance: tpl.paymentType === 'Credit' ? tpl.amount : 0,
      status: tpl.paymentType === 'Credit' ? 'Unpaid' : 'Paid',
      items: [],
      notes: `Retried recurring ${tpl.frequency}: ${tpl.title}`,
      source: 'MANUAL',
    });
    setRecurringExecutionLogs((prev) =>
      prev.map((l) =>
        l.id === logId
          ? {
              ...l,
              status: created ? 'Success' : 'Failed',
              generatedTxId: created?.id,
              generatedInvoiceNo: created?.invoiceNo,
              errorMessage: created ? undefined : 'Retry failed: check period locks or permissions',
              retryCount: (l.retryCount || 0) + 1,
            }
          : l
      )
    );
    return Boolean(created);
  };

  const transitionTransactionStatus = (
    txId: string,
    nextStatus: TransactionWorkflowStatus,
    reason?: string
  ): { success: boolean; message: string } => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return { success: false, message: 'Transaction not found.' };
    const currentStatus: TransactionWorkflowStatus = tx.workflowStatus || (tx.isCancelled ? 'Cancelled' : 'Completed');
    if (!canTransitionWorkflowState(currentStatus, nextStatus)) {
      return { success: false, message: `Transition from ${currentStatus} to ${nextStatus} is not permitted.` };
    }
    if (nextStatus === 'Cancelled') {
      const ok = cancelInvoice(txId, reason || 'Cancelled via Workflow Engine');
      return { success: ok, message: ok ? 'Cancelled' : 'Cancellation blocked' };
    }
    const actor = currentUser?.name || 'Admin';
    const entry = {
      id: generateUniqueId('st'),
      timestamp: new Date().toISOString(),
      fromStatus: currentStatus,
      toStatus: nextStatus,
      actor,
      reason: reason || `Status updated to ${nextStatus}`,
    };
    const actAction: TransactionActivityEntry['action'] =
      nextStatus === 'Approved' ? 'Approved' : nextStatus === 'Rejected' ? 'Rejected' : 'Edited';
    updateTransaction(txId, {
      workflowStatus: nextStatus,
      stateHistory: [entry, ...(tx.stateHistory || [])],
      activityHistory: [
        {
          id: generateUniqueId('act'),
          timestamp: new Date().toISOString(),
          action: actAction,
          actor,
          details: `${currentStatus} -> ${nextStatus}${reason ? `: ${reason}` : ''}`,
        },
        ...(tx.activityHistory || []),
      ],
    });
    return { success: true, message: `Status updated to ${nextStatus}` };
  };

  const cloneTransaction = (txId: string): Transaction | null => {
    const src = transactions.find((t) => t.id === txId);
    if (!src) return null;
    const docMap: Partial<Record<Transaction['type'], SequenceDocumentType>> = {
      Sale: 'Sales Invoice',
      Purchase: 'Purchase Bill',
      Estimate: 'Estimate / Quotation',
      Proforma: 'Proforma Invoice',
      'Sale Order': 'Sales Order',
      'Delivery Challan': 'Delivery Challan',
      'Payment-In': 'Payment Receipt',
      'Sale Return': 'Sales Return',
      'Purchase Return': 'Purchase Return',
      Expense: 'Expense',
      'Other Income': 'Other Income',
    };
    const nextNo = docMap[src.type] ? getNextDocumentNumber(docMap[src.type]!) : `${src.invoiceNo}-COPY`;
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const cloned = addTransaction({
      ...src,
      invoiceNo: nextNo,
      date: nowStr,
      uuid: generateTransactionUuid(),
      isCancelled: false,
      isReversed: false,
      reversedByTxId: undefined,
      reversalOfTxId: undefined,
      workflowStatus: 'Draft',
      version: 1,
      versionHistory: [],
      stateHistory: undefined,
      activityHistory: undefined,
      notes: `Cloned from #${src.invoiceNo}. ${src.notes || ''}`.trim(),
      items: (src.items || []).map((li) => ({ ...li, id: generateUniqueId('li') })),
    });
    return cloned;
  };

  const reverseTransaction = (txId: string, reason: string): Transaction | null => {
    const src = transactions.find((t) => t.id === txId);
    if (!src) return null;
    if (src.isReversed || src.isCancelled) {
      showToast('This transaction has already been cancelled or reversed.', 'warning');
      return null;
    }
    const ok = cancelInvoice(txId, `REVERSED: ${reason}`);
    if (!ok) return null;

    const revNo = `REV-${src.invoiceNo}`;
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const revType: Transaction['type'] =
      src.type === 'Sale' ? 'Sale Return' : src.type === 'Purchase' ? 'Purchase Return' : src.type;
    const revTx = addTransaction({
      type: revType,
      invoiceNo: revNo,
      date: nowStr,
      dueDate: nowStr.split(',')[0],
      partyName: src.partyName,
      partyPhone: src.partyPhone,
      firm: src.firm,
      user: currentUser?.name || 'Admin',
      paymentType: src.paymentType,
      totalAmount: src.totalAmount,
      receivedAmount: 0,
      balance: 0,
      status: 'Paid',
      items: (src.items || []).map((li) => ({ ...li, id: generateUniqueId('li') })),
      skipStockDeduction: true,
      reversalOfTxId: src.id,
      originalInvoiceId: src.id,
      originalInvoiceNo: src.invoiceNo,
      workflowStatus: 'Reversed',
      notes: `Contra Reversal of #${src.invoiceNo} — ${reason}`,
    });
    if (revTx) {
      updateTransaction(src.id, {
        isReversed: true,
        workflowStatus: 'Reversed',
        reversedByTxId: revTx.id,
      });
      showToast(`Reversal voucher #${revNo} created and stock/balances restored.`, 'success');
    }
    return revTx;
  };

  const restoreTransactionVersion = (
    txId: string,
    versionNumber: number
  ): { success: boolean; message: string } => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return { success: false, message: 'Transaction not found.' };
    const snapEntry = (tx.versionHistory || []).find((v) => v.version === versionNumber);
    if (!snapEntry) return { success: false, message: `Version v${versionNumber} not found.` };
    const actor = currentUser?.name || 'Admin';
    const snap = snapEntry.snapshot;
    updateTransaction(txId, {
      ...snap,
      items: snap.items.map((it) => ({ ...it })),
      activityHistory: [
        {
          id: generateUniqueId('act'),
          timestamp: new Date().toISOString(),
          action: 'Restored',
          actor,
          details: `Restored transaction to version v${versionNumber}`,
        },
        ...(tx.activityHistory || []),
      ],
    });
    showToast(`Restored #${tx.invoiceNo} to version v${versionNumber}.`, 'success');
    return { success: true, message: `Restored v${versionNumber}` };
  };

  const logTransactionActivity = (
    txId: string,
    action: TransactionActivityEntry['action'],
    details: string
  ) => {
    const actor = currentUser?.name || 'Admin';
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === txId
          ? {
              ...t,
              activityHistory: [
                {
                  id: generateUniqueId('act'),
                  timestamp: new Date().toISOString(),
                  action,
                  actor,
                  details,
                },
                ...(t.activityHistory || []),
              ].slice(0, 40),
            }
          : t
      )
    );
  };

  const bulkUpdateTransactions = (
    txIds: string[],
    patch: { workflowStatus?: TransactionWorkflowStatus; addTag?: string; cancelReason?: string }
  ): number => {
    let count = 0;
    txIds.forEach((id) => {
      const tx = transactions.find((t) => t.id === id);
      if (!tx) return;
      if (patch.cancelReason) {
        if (cancelInvoice(id, patch.cancelReason)) count++;
        return;
      }
      const nextTags = patch.addTag
        ? Array.from(new Set([...(tx.tags || []), patch.addTag.trim()])).filter(Boolean)
        : tx.tags;
      updateTransaction(id, {
        ...(patch.workflowStatus ? { workflowStatus: patch.workflowStatus } : {}),
        ...(nextTags ? { tags: nextTags } : {}),
      });
      count++;
    });
    if (count > 0) showToast(`Updated ${count} transaction(s).`, 'success');
    return count;
  };

  const splitInvoice = (
    txId: string,
    splitRatioPercent = 50
  ): [Transaction, Transaction] | null => {
    const src = transactions.find((t) => t.id === txId);
    if (!src || !src.items?.length) {
      showToast('Select an invoice with line items to split.', 'warning');
      return null;
    }
    const { partA, partB } = buildSplitInvoiceItems(src.items, splitRatioPercent);
    const totalA = Math.round(partA.reduce((s, l) => s + (l.amount || 0), 0));
    const totalB = Math.round(partB.reduce((s, l) => s + (l.amount || 0), 0));
    const baseNo = src.invoiceNo;

    const txA = addTransaction({
      ...src,
      invoiceNo: `${baseNo}-A`,
      uuid: generateTransactionUuid(),
      items: partA,
      totalAmount: totalA,
      receivedAmount: src.status === 'Paid' ? totalA : 0,
      balance: src.status === 'Paid' ? 0 : totalA,
      status: src.status === 'Paid' ? 'Paid' : 'Unpaid',
      splitFromTxId: src.id,
      skipStockDeduction: true,
      notes: `Split Invoice Part A from #${baseNo}`,
    });
    const txB = addTransaction({
      ...src,
      invoiceNo: `${baseNo}-B`,
      uuid: generateTransactionUuid(),
      items: partB,
      totalAmount: totalB,
      receivedAmount: src.status === 'Paid' ? totalB : 0,
      balance: src.status === 'Paid' ? 0 : totalB,
      status: src.status === 'Paid' ? 'Paid' : 'Unpaid',
      splitFromTxId: src.id,
      skipStockDeduction: true,
      notes: `Split Invoice Part B from #${baseNo}`,
    });
    if (txA && txB) {
      updateTransaction(src.id, {
        workflowStatus: 'Archived',
        notes: `${src.notes || ''} [Split into #${txA.invoiceNo} & #${txB.invoiceNo}]`.trim(),
      });
      showToast(`Invoice #${baseNo} split into #${txA.invoiceNo} & #${txB.invoiceNo}.`, 'success');
      return [txA, txB];
    }
    return null;
  };

  const consolidateTransactionsToInvoice = (sourceTxIds: string[]): Transaction | null => {
    const sources = transactions.filter((t) => sourceTxIds.includes(t.id) && !t.isCancelled);
    if (sources.length < 2) {
      showToast('Select at least 2 uncancelled Orders/Challans/Estimates to consolidate.', 'warning');
      return null;
    }
    const partyNames = new Set(sources.map((s) => s.partyName.trim().toLowerCase()));
    if (partyNames.size > 1) {
      showToast('Consolidated invoicing requires all selected documents to belong to the same customer.', 'warning');
      return null;
    }
    const primary = sources[0];
    const mergedItems: InvoiceItem[] = sources.flatMap((s) =>
      (s.items || []).map((li) => ({ ...li, id: generateUniqueId('li') }))
    );
    const totalAmount = Math.round(mergedItems.reduce((sum, l) => sum + (l.amount || 0), 0));
    const alreadyDeducted = sources.every((s) => s.type === 'Delivery Challan' || s.type === 'Sale Order');
    const invNo = getNextFormattedInvoiceNo();
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const consolidated = addTransaction({
      type: 'Sale',
      invoiceNo: invNo,
      date: nowStr,
      dueDate: primary.dueDate || nowStr.split(',')[0],
      partyName: primary.partyName,
      partyPhone: primary.partyPhone,
      partyAddress: primary.partyAddress,
      partyGstin: primary.partyGstin,
      firm: primary.firm || company.name,
      user: currentUser?.name || 'Admin',
      paymentType: 'Credit',
      totalAmount,
      receivedAmount: 0,
      balance: totalAmount,
      status: 'Unpaid',
      items: mergedItems,
      consolidatedFromIds: sources.map((s) => s.id),
      skipStockDeduction: alreadyDeducted,
      notes: `Consolidated Invoice from: ${sources.map((s) => `#${s.invoiceNo}`).join(', ')}`,
    });
    if (consolidated) {
      sources.forEach((s) => {
        updateTransaction(s.id, {
          fulfillmentStatus: 'Completed',
          linkedSaleInvoiceId: consolidated.id,
          linkedSaleInvoiceNo: consolidated.invoiceNo,
        });
      });
      setSelectedInvoice(consolidated);
      setIsInvoicePreviewOpen(true);
      showToast(`Consolidated ${sources.length} documents into Tax Invoice #${consolidated.invoiceNo}!`, 'success');
    }
    return consolidated;
  };

  const updateSequenceConfig = (
    docType: SequenceDocumentType,
    patch: Partial<InvoiceNumberSequenceConfig>
  ) => {
    const existingList = businessSettings.transaction.sequences;
    const found = existingList.some((s) => s.docType === docType);
    const nextSequences: InvoiceNumberSequenceConfig[] = found
      ? existingList.map((s) => (s.docType === docType ? { ...s, ...patch } : s))
      : [
          ...existingList,
          {
            docType,
            prefix: `${docType.slice(0, 3).toUpperCase()}-`,
            startNumber: 1,
            nextNumber: 1,
            suffix: '',
            digits: 4,
            useFinancialYear: false,
            autoNumbering: true,
            allowManualOverride: true,
            preventDuplicate: true,
            ...patch,
          },
        ];
    void updateBusinessSettingsSection(
      'transaction',
      'transaction',
      {
        ...businessSettings.transaction,
        sequences: nextSequences,
      },
      `Updated numbering sequence for ${docType}`
    );
  };

  const reconcilePaymentTransaction = (txId: string, reconciledRef?: string) => {
    updateTransaction(txId, {
      reconciled: true,
      reconciledAt: new Date().toISOString(),
      reconciledRef: reconciledRef || `REC-${Date.now().toString().slice(-6)}`,
    });
    showToast('Payment reconciled with bank/cash statement.', 'success');
  };

  const recordPaymentRefund = (payload: {
    direction: 'IN_REFUND' | 'OUT_REFUND';
    partyName: string;
    amount: number;
    mode: ExtendedPaymentMode;
    refNo?: string;
    reason?: string;
  }): Transaction | null => {
    const amt = Math.round((Number(payload.amount) || 0) * 100) / 100;
    if (!payload.partyName.trim() || amt <= 0) {
      showToast('Select a party and enter a valid refund amount.', 'warning');
      return null;
    }
    const todayStr = new Date().toLocaleDateString('en-GB');
    const created = addTransaction({
      type: payload.direction === 'IN_REFUND' ? 'Sale Return' : 'Purchase Return',
      invoiceNo: `REF-${Date.now().toString().slice(-5)}`,
      date: todayStr,
      dueDate: todayStr,
      partyName: payload.partyName,
      firm: company.name,
      user: currentUser?.name || 'Admin',
      paymentType: mapExtendedModeToTxPaymentType(payload.mode),
      extendedPaymentMode: payload.mode,
      refundedAmount: amt,
      totalAmount: amt,
      receivedAmount: amt,
      balance: 0,
      status: 'Paid',
      items: [],
      skipStockDeduction: true,
      notes: `Payment Refund (${payload.mode})${payload.refNo ? ` · Ref: ${payload.refNo}` : ''}. ${payload.reason || ''}`.trim(),
    });
    return created;
  };

  const addSupplierQuotation = (
    q: Omit<SupplierQuotation, 'id' | 'createdAt'>
  ): SupplierQuotation => {
    const rec: SupplierQuotation = {
      ...q,
      id: generateUniqueId('rfq'),
      createdAt: new Date().toISOString(),
    };
    setSupplierQuotations((prev) => [rec, ...prev]);
    showToast(`Supplier Quotation #${rec.quoteNo} saved.`, 'success');
    return rec;
  };

  const updateSupplierQuotationStatus = (
    id: string,
    status: SupplierQuotation['status']
  ) => {
    setSupplierQuotations((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
    showToast(`Quotation marked ${status}.`, 'info');
  };

  const upsertSupplierItemMapping = (
    m: Omit<SupplierItemMapping, 'id' | 'updatedAt'>
  ): SupplierItemMapping => {
    const existing = supplierItemMappings.find(
      (x) =>
        x.supplierName.toLowerCase() === m.supplierName.toLowerCase() &&
        x.itemName.toLowerCase() === m.itemName.toLowerCase()
    );
    const rec: SupplierItemMapping = {
      ...m,
      id: existing?.id || generateUniqueId('supmap'),
      updatedAt: new Date().toISOString(),
    };
    setSupplierItemMappings((prev) =>
      existing ? prev.map((x) => (x.id === existing.id ? rec : x)) : [rec, ...prev]
    );
    showToast(`Supplier SKU mapping saved for ${m.supplierName} -> ${m.itemName}.`, 'success');
    return rec;
  };

  const recordPoGrnReceipt = (
    poId: string,
    lines: Array<{ name: string; qtyReceived: number; batchNo?: string; expiryDate?: string }>,
    convertToBillNow = true
  ): { success: boolean; message: string; billTx?: Transaction } => {
    const po = transactions.find((t) => t.id === poId);
    if (!po) return { success: false, message: 'Purchase Order not found.' };

    const receivedItems: InvoiceItem[] = [];
    const updatedPoItems = (po.items || []).map((li) => {
      const match = lines.find((l) => l.name.toLowerCase() === li.name.toLowerCase());
      const ordered = li.orderedQty ?? li.qty;
      const alreadyRec = li.receivedQty ?? 0;
      const maxRem = Math.max(0, ordered - alreadyRec);
      const qtyNow = Math.max(0, Math.min(maxRem, Number(match?.qtyReceived) || 0));
      if (qtyNow > 0) {
        const unitTotal = li.qty > 0 ? li.amount / li.qty : li.price;
        receivedItems.push({
          ...li,
          id: generateUniqueId('li'),
          qty: qtyNow,
          amount: Math.round(unitTotal * qtyNow * 100) / 100,
          batchNo: match?.batchNo || li.batchNo,
          expiryDate: match?.expiryDate || li.expiryDate,
        });
      }
      return {
        ...li,
        orderedQty: ordered,
        receivedQty: alreadyRec + qtyNow,
      };
    });

    if (receivedItems.length === 0) {
      return { success: false, message: 'Enter at least one pending quantity to receive.' };
    }

    const allReceived = updatedPoItems.every(
      (it) => (it.receivedQty ?? 0) >= (it.orderedQty ?? it.qty)
    );
    const grnNo = `GRN-${Date.now().toString().slice(-5)}`;
    const todayStr = new Date().toLocaleDateString('en-GB');

    let billTx: Transaction | undefined;
    if (convertToBillNow) {
      const billAmt = Math.round(receivedItems.reduce((s, l) => s + (l.amount || 0), 0));
      const created = addTransaction({
        type: 'Purchase',
        invoiceNo: getNextDocumentNumber('Purchase Bill'),
        date: todayStr,
        dueDate: po.dueDate || todayStr,
        partyName: po.partyName,
        partyPhone: po.partyPhone,
        partyAddress: po.partyAddress,
        firm: po.firm || company.name,
        user: currentUser?.name || 'Admin',
        paymentType: po.paymentType || 'Credit',
        totalAmount: billAmt,
        receivedAmount: 0,
        balance: billAmt,
        status: 'Unpaid',
        items: receivedItems,
        linkedPoId: po.id,
        linkedPoNo: po.invoiceNo,
        notes: `GRN #${grnNo} against PO #${po.invoiceNo}`,
      });
      if (created) billTx = created;
    }

    updateTransaction(po.id, {
      items: updatedPoItems,
      grnStatus: allReceived ? 'Fully Received' : 'Partially Received',
      fulfillmentStatus: allReceived ? 'Completed' : 'Partially Fulfilled',
      status: allReceived ? 'Paid' : po.status,
      grnReceipts: [
        ...(po.grnReceipts || []),
        {
          id: generateUniqueId('grn'),
          grnNo,
          date: todayStr,
          receivedBy: currentUser?.name || 'Store Receiver',
          items: receivedItems.map((ri) => ({
            name: ri.name,
            qtyReceived: ri.qty,
            batchNo: ri.batchNo,
            expiryDate: ri.expiryDate,
          })),
          linkedBillId: billTx?.id,
        },
      ],
    });

    showToast(`Recorded ${grnNo} (${allReceived ? 'Full' : 'Partial'} Receipt)${billTx ? ` & Bill #${billTx.invoiceNo}` : ''}.`, 'success');
    return { success: true, message: `Recorded ${grnNo}`, billTx };
  };

  useEffect(() => {
    if (isDbHydrated && isAuthenticated) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const hasDue = recurringTemplates.some((t) => t.isActive && t.nextRunDate <= todayIso);
      if (hasDue) {
        runDueRecurringTransactions();
      }
    }
  }, [isDbHydrated, isAuthenticated]);

  const movePartyToRecycleBin = (partyId: string): boolean => {
    const target = parties.find((p) => p.id === partyId);
    if (!target) return false;
    if (businessSettings.party.preventDeleteWithTransactions) {
      const hasTx = transactions.some(
        (t) => t.partyName.trim().toLowerCase() === target.name.trim().toLowerCase()
      );
      if (hasTx) {
        showToast(
          `Cannot delete "${target.name}" because transaction history exists. Mark status as Inactive instead.`,
          'warning'
        );
        return false;
      }
    }
    const binId = generateUniqueId('bin');
    setParties((prev) => prev.filter((p) => p.id !== partyId));
    setRecycleBin((prev) => [
      {
        id: binId,
        entityType: 'Party',
        label: target.name,
        subLabel: `${target.type} • ${target.phone || 'No phone'}`,
        deletedAt: new Date().toLocaleDateString('en-GB'),
        deletedBy: currentUser?.name || 'Admin',
        payload: target,
      },
      ...prev,
    ]);
    showToast(`"${target.name}" moved to Recycle Bin`, 'info', {
      label: 'Undo',
      onUndo: () => {
        setRecycleBin((prev) => prev.filter((r) => r.id !== binId));
        setParties((prev) => [target, ...prev]);
        showToast(`Restored "${target.name}"`, 'success');
      },
    });
    return true;
  };

  const moveItemToRecycleBin = (itemId: string): boolean => {
    const target = items.find((i) => i.id === itemId);
    if (!target) return false;
    const binId = generateUniqueId('bin');
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setRecycleBin((prev) => [
      {
        id: binId,
        entityType: 'Item',
        label: target.name,
        subLabel: `SKU: ${target.code} • ₹${target.salePrice}`,
        deletedAt: new Date().toLocaleDateString('en-GB'),
        deletedBy: currentUser?.name || 'Admin',
        payload: target,
      },
      ...prev,
    ]);
    showToast(`Item "${target.name}" moved to Recycle Bin`, 'info', {
      label: 'Undo',
      onUndo: () => {
        setRecycleBin((prev) => prev.filter((r) => r.id !== binId));
        setItems((prev) => [target, ...prev]);
        showToast(`Restored "${target.name}"`, 'success');
      },
    });
    return true;
  };

  const restoreFromRecycleBin = (recordId: string): boolean => {
    const rec = recycleBin.find((r) => r.id === recordId);
    if (!rec) return false;
    if (rec.entityType === 'Transaction') {
      setTransactions((prev) => [rec.payload, ...prev]);
    } else if (rec.entityType === 'Party') {
      setParties((prev) => [rec.payload, ...prev]);
    } else if (rec.entityType === 'Item') {
      setItems((prev) => [rec.payload, ...prev]);
    } else if (rec.entityType === 'JournalVoucher') {
      setJournalVouchers((prev) => [rec.payload, ...prev]);
    }
    setRecycleBin((prev) => prev.filter((r) => r.id !== recordId));
    recordActivity('Restored from Recycle Bin', 'Settings', `Restored ${rec.entityType}: ${rec.label}`);
    showToast(`Restored "${rec.label}" successfully.`, 'success');
    return true;
  };

  const permanentlyDeleteFromRecycleBin = (recordId: string) => {
    setRecycleBin((prev) => prev.filter((r) => r.id !== recordId));
    showToast('Record permanently deleted.', 'warning');
  };

  const emptyRecycleBin = () => {
    setRecycleBin([]);
    recordActivity('Emptied Recycle Bin', 'Settings', 'Permanently deleted all items in Recycle Bin');
    showToast('Recycle Bin emptied.', 'warning');
  };

  const addBulkImportRecords = (
    target: 'customers' | 'suppliers' | 'items',
    records: any[]
  ): { imported: number; skipped: number } => {
    let imported = 0;
    let skipped = 0;
    if (target === 'customers' || target === 'suppliers') {
      const partyType: 'Customer' | 'Supplier' = target === 'customers' ? 'Customer' : 'Supplier';
      const existingNames = new Set(parties.map((p) => p.name.toLowerCase()));
      const newParties: Party[] = [];
      records.forEach((r) => {
        const cleanName = String(r.name || '').trim();
        if (!cleanName || existingNames.has(cleanName.toLowerCase())) {
          skipped++;
          return;
        }
        existingNames.add(cleanName.toLowerCase());
        imported++;
        newParties.push({
          id: generateUniqueId('p'),
          name: cleanName,
          phone: String(r.phone || ''),
          email: String(r.email || ''),
          type: partyType,
          balance: Number(r.balance) || 0,
          gstin: String(r.gstin || '').toUpperCase(),
          address: String(r.address || ''),
          state: String(r.state || company.state || 'Karnataka (29)'),
        });
      });
      if (newParties.length > 0) setParties((prev) => [...newParties, ...prev]);
    } else {
      const existingCodes = new Set(items.map((i) => i.code.toLowerCase()));
      const newItems: Item[] = [];
      records.forEach((r, idx) => {
        const cleanName = String(r.name || '').trim();
        const code = String(r.code || `SKU-${Date.now().toString().slice(-4)}-${idx}`).trim();
        if (!cleanName || existingCodes.has(code.toLowerCase())) {
          skipped++;
          return;
        }
        existingCodes.add(code.toLowerCase());
        imported++;
        newItems.push({
          id: generateUniqueId('it'),
          name: cleanName,
          code,
          category: String(r.category || 'General'),
          salePrice: Math.max(0, Number(r.salePrice) || 0),
          purchasePrice: Math.max(0, Number(r.purchasePrice) || 0),
          wholesalePrice: Math.max(0, Number(r.wholesalePrice) || Number(r.salePrice) || 0),
          minWholesaleQty: Math.max(1, Number(r.minWholesaleQty) || 5),
          stock: Math.max(0, Number(r.stock) || 0),
          unit: String(r.unit || 'PCS').toUpperCase(),
          taxRate: Math.max(0, Number(r.taxRate) || 18),
        });
      });
      if (newItems.length > 0) setItems((prev) => [...newItems, ...prev]);
    }
    recordActivity('CSV Bulk Import', 'Inventory', `Imported ${imported} ${target} (${skipped} skipped)`);
    showToast(`Imported ${imported} ${target} successfully (${skipped} skipped).`, 'success');
    return { imported, skipped };
  };

  const saveBillingCoupon = (
    input: Omit<BillingCoupon, 'id' | 'usedCount' | 'usedByCustomerIds' | 'createdBy'>
  ): { success: boolean; message: string } => {
    if (activeSessionType === 'CUSTOMER' || !isAdminSession()) {
      return { success: false, message: 'Security Violation: Only Store Admin or Owner can manage Billing Coupons.' };
    }
    const cleanCode = input.code.trim().toUpperCase();
    if (!cleanCode) return { success: false, message: 'Coupon code is required.' };
    if (coupons.some((c) => c.code.toUpperCase() === cleanCode)) {
      return { success: false, message: `Coupon ${cleanCode} already exists.` };
    }
    const newCoupon: BillingCoupon = {
      ...input,
      id: generateUniqueId('cpn'),
      code: cleanCode,
      usedCount: 0,
      usedByCustomerIds: [],
      createdBy: currentUser?.name || 'Admin',
    };
    setCoupons((prev) => [newCoupon, ...prev]);
    showToast(`Coupon ${cleanCode} created.`);
    return { success: true, message: `Coupon ${cleanCode} created.` };
  };

  const toggleBillingCouponStatus = (couponId: string): { success: boolean; message: string } => {
    if (activeSessionType === 'CUSTOMER' || !isAdminSession()) {
      return { success: false, message: 'Security Violation: Only Store Admin or Owner can toggle coupons.' };
    }
    setCoupons((prev) => prev.map((c) => (c.id === couponId ? { ...c, isActive: !c.isActive } : c)));
    showToast('Coupon status updated.');
    return { success: true, message: 'Coupon updated.' };
  };

  const updateServiceAreaConfig = (
    updates: Partial<StoreServiceAreaConfig>
  ): { success: boolean; message: string } => {
    if (activeSessionType === 'CUSTOMER' || !isAdminSession()) {
      return { success: false, message: 'Security Violation: Only Store Admin or Owner can update Store Delivery Settings.' };
    }
    setServiceAreaConfig((prev) => ({ ...prev, ...updates }));
    showToast('Store service area & delivery rules saved.');
    return { success: true, message: 'Store settings updated.' };
  };

  const toggleStaffTaskStatus = (taskId: string, nextStatus: StaffTask['status']) => {
    setStaffTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t)));
    showToast(`Task marked ${nextStatus}`);
  };

  // Synchronous wrapper kept for compatibility with existing LoginPage / modals
  const login = (identifier: string, _password?: string): boolean => {
    const q = identifier.toLowerCase().trim();
    const targetUser = users.find(
      (u) =>
        u.email.toLowerCase() === q ||
        (u.employeeId && u.employeeId.toLowerCase() === q) ||
        u.roleId.toLowerCase().includes(q) ||
        u.roleName.toLowerCase().includes(q)
    );
    if (!targetUser || targetUser.status === 'Blocked' || !targetUser.isApproved) {
      return false;
    }
    const sessType = resolveUserAccountType(targetUser);
    const safeUser = stripSecretFieldsFromUser(targetUser);
    setCurrentCustomer(null);
    setCurrentUser(safeUser);
    setActiveSessionType(sessType);
    setIsAuthenticated(true);
    safeSetStoredData('bm360_portal_session', { sessionType: sessType, userId: targetUser.id });
    return true;
  };

  // Blocked for public self-registration of staff: only Admin can add staff via adminCreateStaffAccount
  const register = (
    name: string,
    email: string,
    phone: string,
    password: string,
    roleId: string,
    department?: string
  ): boolean => {
    if (!isAdminSession()) {
      showToast('Staff self-registration is disabled. Contact Store Administrator.');
      return false;
    }
    void adminCreateStaffAccount({
      name,
      email,
      phone,
      password: password || 'staff@password123',
      roleId,
      department: (department as Employee['department']) || 'Billing & Counter',
      designation: 'Staff Member',
    });
    return true;
  };

  // Invalidate Session cleanly and return to Welcome User Type Selection Screen
  const logout = () => {
    if (currentUser) {
      recordActivity('User Logged Out', 'Auth', `${currentUser.name} signed out`);
    } else if (currentCustomer) {
      const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      setCustomerActivity((prev) => [
        {
          id: generateUniqueId('ca'),
          customerId: currentCustomer.customerId,
          customerName: currentCustomer.fullName,
          action: 'Customer Signed Out',
          details: 'Session ended cleanly',
          timestamp: nowStr,
          status: 'Info',
        },
        ...prev,
      ]);
    }
    safeSetStoredData('bm360_portal_session', null);
    setCurrentUser(null);
    setCurrentCustomer(null);
    setActiveSessionType(null);
    setIsAuthenticated(false);
    setPortalStage('welcome');
    setIsLogoutModalOpen(false);
    showToast('Logged out cleanly.');
  };

  const switchUser = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    if (target.status === 'Blocked') {
      showToast('Cannot switch: User account is blocked.');
      return;
    }
    if (!target.isApproved || target.status === 'Pending Approval') {
      showToast('Cannot switch: User is awaiting owner approval.');
      return;
    }
    const sessType = resolveUserAccountType(target);
    const safeUser = stripSecretFieldsFromUser(target);
    setCurrentCustomer(null);
    setCurrentUser(safeUser);
    setActiveSessionType(sessType);
    setIsAuthenticated(true);
    safeSetStoredData('bm360_portal_session', { sessionType: sessType, userId: target.id });
    recordActivity('Switched User Profile', 'Auth', `Active session changed to ${target.name} (${target.roleName})`);
    showToast(`Switched active user to ${target.name} (${target.roleName})`);
  };

  const switchRole = (roleIdOrName: string) => {
    const query = roleIdOrName.toLowerCase();

    const target = users.find(
      (u) =>
        (u.roleId === roleIdOrName || u.roleName.toLowerCase().includes(query)) &&
        u.status !== 'Blocked' &&
        u.isApproved
    );

    if (!target) {
      showToast('No active staff user matches that role. Add a staff member via Admin Panel.');
      return;
    }

    const sessType = resolveUserAccountType(target);
    const safeUser = stripSecretFieldsFromUser(target);
    setCurrentCustomer(null);
    setCurrentUser(safeUser);
    setActiveSessionType(sessType);
    setIsAuthenticated(true);
    safeSetStoredData('bm360_portal_session', { sessionType: sessType, userId: target.id });
    recordActivity('Role Switched', 'Auth', `Active session changed to ${target.name} (${target.roleName})`);
    showToast(`Switched active profile to ${target.name} (${target.roleName})`);
  };

  // Employee Actions
  const addEmployee = (empData: Omit<Employee, 'id'>): Employee => {
    const newEmp: Employee = {
      ...empData,
      id: generateUniqueId('emp'),
    };
    setEmployees((prev) => [newEmp, ...prev]);

    const existingUser = users.find((u) => u.email.toLowerCase() === newEmp.email.toLowerCase());
    if (!existingUser) {
      const newUser: AppUser = {
        id: generateUniqueId('user'),
        name: newEmp.name,
        email: newEmp.email,
        phone: newEmp.phone,
        password: 'emp@password123',
        roleId: newEmp.roleId,
        roleName: newEmp.roleName,
        employeeId: newEmp.employeeId,
        status: newEmp.status === 'Active' ? 'Active' : 'Pending Approval',
        isApproved: newEmp.status === 'Active',
        lastLogin: 'Never',
      };
      setUsers((prev) => [...prev, newUser]);
    }

    recordActivity('Added Employee', 'Employee', `Created profile for ${newEmp.name} (${newEmp.employeeId})`);
    showToast(`Employee ${newEmp.name} (${newEmp.employeeId}) created successfully!`);
    return newEmp;
  };

  const updateEmployee = (id: string, empData: Partial<Employee>) => {
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === id ? { ...emp, ...empData } : emp))
    );
    recordActivity('Updated Employee', 'Employee', `Updated profile ID ${id}`);
    showToast('Employee details updated successfully!');
  };

  const deleteEmployee = (id: string) => {
    if (!hasPermission('delete')) {
      showToast('Permission Denied: Only Owner or Admin can delete employee profiles.');
      return;
    }
    const target = employees.find((e) => e.id === id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    recordActivity('Deleted Employee', 'Employee', `Removed employee ${target?.name || id}`);
    showToast('Employee profile removed.');
  };

  // Role Actions
  const createRole = (roleData: Omit<RoleDefinition, 'id' | 'isBuiltIn' | 'assignedUsersCount'>): RoleDefinition => {
    const newRole: RoleDefinition = {
      ...roleData,
      id: generateUniqueId('role'),
      isBuiltIn: false,
      assignedUsersCount: 0,
    };
    setRoles((prev) => [...prev, newRole]);
    recordActivity('Created Custom Role', 'Roles', `Created role "${newRole.name}" with ${newRole.permissions.length} permissions`);
    showToast(`Role "${newRole.name}" created successfully!`);
    return newRole;
  };

  const updateRole = (id: string, roleData: Partial<RoleDefinition>) => {
    setRoles((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...roleData } : r))
    );
    recordActivity('Updated Role', 'Roles', `Updated permissions for role ID ${id}`);
    showToast('Role permissions updated successfully!');
  };

  const deleteRole = (id: string): boolean => {
    const target = roles.find((r) => r.id === id);
    if (!target) return false;
    if (target.isBuiltIn) {
      showToast('Built-in system roles cannot be deleted.');
      return false;
    }
    if (target.assignedUsersCount > 0) {
      showToast(`Cannot delete role: ${target.assignedUsersCount} active employees are assigned.`);
      return false;
    }
    setRoles((prev) => prev.filter((r) => r.id !== id));
    recordActivity('Deleted Custom Role', 'Roles', `Deleted role "${target.name}"`);
    showToast(`Role "${target.name}" deleted.`);
    return true;
  };

  const duplicateRole = (roleId: string, newName?: string): RoleDefinition | null => {
    const sourceRole = roles.find((r) => r.id === roleId);
    if (!sourceRole) {
      showToast('Source role not found.');
      return null;
    }

    const clonedName = newName || `${sourceRole.name} (Copy)`;
    const newRole: RoleDefinition = {
      ...sourceRole,
      id: generateUniqueId('role'),
      name: clonedName,
      type: 'Custom',
      isBuiltIn: false,
      assignedUsersCount: 0,
      permissions: [...sourceRole.permissions],
      lastModifiedDate: new Date().toLocaleDateString('en-GB'),
      lastModifiedBy: currentUser?.name || 'System',
    };

    setRoles((prev) => [...prev, newRole]);
    recordActivity('Duplicated Role', 'Roles', `Created duplicate role "${newRole.name}" from "${sourceRole.name}"`);
    showToast(`Role "${newRole.name}" duplicated successfully!`);
    return newRole;
  };

  const archiveRole = (roleId: string): boolean => {
    const target = roles.find((r) => r.id === roleId);
    if (!target) return false;
    if (target.isBuiltIn) {
      showToast('Built-in system roles cannot be archived.');
      return false;
    }
    if (target.assignedUsersCount > 0) {
      showToast(`Cannot archive: ${target.assignedUsersCount} active employees are assigned.`);
      return false;
    }
    setRoles((prev) =>
      prev.map((r) => (r.id === roleId ? { ...r, isArchived: !r.isArchived } : r))
    );
    recordActivity('Toggled Role Archive', 'Roles', `Toggled archive status for role "${target.name}"`);
    showToast(`Role "${target.name}" ${target.isArchived ? 'unarchived' : 'archived'}.`);
    return true;
  };

  const removeAllFeaturesFromRole = (roleId: string) => {
    const targetRole = roles.find((r) => r.id === roleId);
    if (!targetRole) return;
    setRoles((prev) =>
      prev.map((r) => (r.id === roleId ? { ...r, permissions: [] } : r))
    );
    recordActivity('Removed All Features', 'Roles', `Removed all features & permissions from role: ${targetRole.name}`);
    showToast(`Removed all features from role: ${targetRole.name}`);
  };

  const grantAllFeaturesToRole = (roleId: string) => {
    const targetRole = roles.find((r) => r.id === roleId);
    if (!targetRole) return;
    const allKeys: PermissionKey[] = [
      'view',
      'create',
      'edit',
      'delete',
      'approve',
      'export',
      'print',
      'payment',
      'discount',
      'report',
      'settings',
      'branch',
      'product',
      'customer',
      'supplier',
    ];
    setRoles((prev) =>
      prev.map((r) => (r.id === roleId ? { ...r, permissions: allKeys } : r))
    );
    recordActivity('Granted All Features', 'Roles', `Granted all features & permissions to role: ${targetRole.name}`);
    showToast(`Granted all features to role: ${targetRole.name}`);
  };

  const resetRolesToDefault = () => {
    setRoles(DEFAULT_ROLES);
    recordActivity('Reset Roles', 'Roles', 'Reset all roles to factory default permissions');
    showToast('Reset all roles to default permissions!');
  };

  const toggleUserBlock = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const newStatus = u.status === 'Blocked' ? 'Active' : 'Blocked';
          recordActivity('User Status Changed', 'Auth', `${u.name} status set to ${newStatus}`);
          showToast(`User ${u.name} is now ${newStatus}`);
          return { ...u, status: newStatus };
        }
        return u;
      })
    );
  };

  const approveUser = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          recordActivity('Approved User Registration', 'Auth', `Approved ${u.name} (${u.roleName})`);
          showToast(`Approved registration for ${u.name}!`);
          return { ...u, status: 'Active', isApproved: true };
        }
        return u;
      })
    );
  };

  const inviteUser = (inviteData: Omit<UserInvitation, 'id' | 'invitedAt' | 'status' | 'inviteToken'>) => {
    const newInv: UserInvitation = {
      ...inviteData,
      id: generateUniqueId('inv'),
      invitedAt: new Date().toLocaleDateString('en-GB'),
      status: 'Pending',
      inviteToken: 'vyp-' + Math.random().toString(36).substring(2, 9),
    };
    setInvitations((prev) => [newInv, ...prev]);
    recordActivity('Sent Staff Invitation', 'Auth', `Invited ${newInv.email} as ${newInv.roleName}`);
    showToast(`Invitation sent to ${newInv.email} successfully!`);
  };

  const revokeInvitation = (invitationId: string) => {
    setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    showToast('Invitation revoked.');
  };

  // Robust Attendance with Duplicate Prevention
  const recordAttendance = (employeeId: string, punchType: 'IN' | 'OUT', notes?: string) => {
    const emp = employees.find((e) => e.employeeId === employeeId || e.id === employeeId);
    if (!emp) {
      showToast('Error: Employee not found');
      return;
    }

    const todayDate = new Date().toLocaleDateString('en-GB');
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setAttendanceRecords((prev) => {
      const existingToday = prev.find(
        (a) => (a.employeeId === emp.employeeId || a.employeeId === emp.id) && a.date === todayDate
      );

      if (punchType === 'IN') {
        if (existingToday && existingToday.punchInTime) {
          showToast(`Notice: ${emp.name} already punched IN today at ${existingToday.punchInTime}`);
          return prev;
        }
        const newRecord: AttendanceRecord = {
          id: generateUniqueId('att'),
          employeeId: emp.employeeId,
          employeeName: emp.name,
          date: todayDate,
          punchInTime: currentTime,
          status: 'Present',
          workingHours: 8.0,
          notes: notes || 'Regular Shift Inward',
        };
        showToast(`${emp.name} punched IN successfully at ${currentTime}!`);
        return [newRecord, ...prev];
      } else {
        // Punch OUT
        if (!existingToday) {
          showToast(`Notice: Cannot punch OUT. No prior punch IN recorded for ${emp.name} today.`);
          return prev;
        }
        showToast(`${emp.name} punched OUT successfully at ${currentTime}!`);
        return prev.map((a) =>
          a.id === existingToday.id
            ? { ...a, punchOutTime: currentTime, notes: notes || a.notes || 'Shift completed' }
            : a
        );
      }
    });

    recordActivity('Attendance Punched', 'Employee', `${emp.name} punched ${punchType} at ${currentTime}`);
  };

  const terminateSession = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status: 'Terminated' as const } : s))
    );
    recordActivity('Terminated Session', 'Auth', `Session ID ${sessionId} ended`);
    showToast('Active session terminated.');
  };

  // Support Tickets Management
  const addSupportTicket = (ticketData: Omit<SupportTicket, 'id' | 'ticketNo' | 'createdAt' | 'updatedAt' | 'status'>): SupportTicket => {
    const ticketNo = `VY-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const newTicket: SupportTicket = {
      ...ticketData,
      id: generateUniqueId('ticket'),
      ticketNo,
      status: 'Open',
      createdAt: nowStr,
      updatedAt: nowStr,
      assignedAgent: 'Vyapar Support Team (Bengaluru Desk)',
    };
    setSupportTickets((prev) => [newTicket, ...prev]);
    recordActivity('Created Support Ticket', 'Settings', `Submitted ticket #${ticketNo}: ${newTicket.category}`);
    showToast(`Support ticket #${ticketNo} created successfully! Our team will respond shortly.`);
    return newTicket;
  };

  const updateSupportTicket = (id: string, updates: Partial<SupportTicket>) => {
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    setSupportTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: nowStr } : t))
    );
    showToast('Support ticket updated');
  };

  // Premium License Validation & Ordering
  const activateLicenseKey = (key: string): { success: boolean; message: string } => {
    const cleanKey = key.trim().toUpperCase();
    // Validate format: e.g. VYP-GOLD-XXXX-XXXX or VYP-SILV-XXXX-XXXX
    const isGold = cleanKey.startsWith('VYP-GOLD-') && cleanKey.length >= 14;
    const isSilver = cleanKey.startsWith('VYP-SILV-') && cleanKey.length >= 14;
    const isStandardValid = cleanKey.startsWith('VYAP-') && cleanKey.length >= 12;

    if (!isGold && !isSilver && !isStandardValid) {
      showToast('Invalid License Key format. Example valid key: VYP-GOLD-2026-X79K or VYP-SILV-2026-A12B');
      return {
        success: false,
        message: 'Invalid key structure. Must begin with VYP-GOLD-, VYP-SILV-, or VYAP- prefix with minimum 12 characters.',
      };
    }

    const assignedPlan = isGold ? 'Gold Desktop + Mobile' : 'Silver Desktop';
    const expiresDate = '31/12/2027';

    setSubscription({
      plan: assignedPlan,
      status: 'Active',
      licenseKey: cleanKey,
      activatedAt: new Date().toLocaleDateString('en-GB'),
      expiresAt: expiresDate,
      maxUsers: isGold ? 20 : 5,
      features: [
        'Unlimited GST Invoicing',
        'Multi-Device Sync',
        'Custom Business Thermal Branding',
        'Automated WhatsApp Ledgers',
        'Full Enterprise Role-Based Access Control',
      ],
    });

    recordActivity('Activated Premium License', 'Settings', `Activated license ${cleanKey} for plan ${assignedPlan}`);
    showToast(`Vyapar ${assignedPlan} activated successfully! Valid until ${expiresDate}.`);
    return {
      success: true,
      message: `Vyapar ${assignedPlan} activated successfully!`,
    };
  };

  const createPremiumOrder = (
    plan: 'Silver Desktop' | 'Gold Desktop + Mobile',
    paymentMethod: 'UPI' | 'Net Banking' | 'Debit/Credit Card'
  ): PremiumOrder => {
    const orderNo = `ORD-${Date.now().toString().slice(-6)}`;
    const randomKey = `VYP-${plan.startsWith('Gold') ? 'GOLD' : 'SILV'}-2026-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const amount = plan === 'Gold Desktop + Mobile' ? 4999 : 2999;

    const newOrder: PremiumOrder = {
      id: generateUniqueId('ord'),
      orderNumber: orderNo,
      plan,
      amount,
      durationMonths: 12,
      paymentMethod,
      paymentStatus: 'Completed',
      createdAt: `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      generatedLicenseKey: randomKey,
    };

    setPremiumOrders((prev) => [newOrder, ...prev]);

    // Automatically activate the subscription
    setSubscription({
      plan,
      status: 'Active',
      licenseKey: randomKey,
      activatedAt: new Date().toLocaleDateString('en-GB'),
      expiresAt: '31/12/2027',
      maxUsers: plan === 'Gold Desktop + Mobile' ? 20 : 5,
      features: [
        'Unlimited GST Invoicing',
        'Multi-Device Sync',
        'Thermal & POS Printing',
        'Multi-User RBAC Permissions',
      ],
    });

    recordActivity('Placed Premium Order', 'Settings', `Order #${orderNo} for ${plan} completed via ${paymentMethod}`);
    showToast(`Order #${orderNo} completed! ${plan} license activated.`);
    return newOrder;
  };

  // ============================================================================
  // 5-MODULE INTEGRATED ERP WORKFLOW ACTIONS
  // ============================================================================

  // MODULE 1: AI PURCHASE BILL SCANNER
  const savePurchaseScanDraft = async (scan: PurchaseScanRecord): Promise<void> => {
    setPurchaseScans((prev) => {
      const idx = prev.findIndex((s) => s.id === scan.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = scan;
        return copy;
      }
      return [scan, ...prev];
    });
    try {
      await apiClient.savePurchaseScan(scan);
    } catch {
      // Persisted cleanly in IndexedDB + localStorage even if server sync waits
    }
    showToast(`Purchase scan ${scan.invoiceNumber || scan.id} saved as ${scan.status}.`);
  };

  const confirmPurchaseScan = async (
    scan: PurchaseScanRecord,
    options?: { allowDuplicate?: boolean; paymentType?: Transaction['paymentType']; paidAmount?: number }
  ): Promise<{ success: boolean; message: string; purchaseTx?: Transaction; duplicateWarning?: string }> => {
    // 1. Duplicate Invoice Detection (Supplier GSTIN + Invoice Number + Invoice Date)
    const cleanGstin = (scan.supplierGstin || '').trim().toUpperCase();
    const cleanInvNo = (scan.invoiceNumber || '').trim().toLowerCase();
    const cleanDate = (scan.invoiceDate || '').trim();

    const duplicateTx = transactions.find((t) => {
      if (t.type !== 'Purchase' || t.isCancelled) return false;
      const txInv = (t.invoiceNo || '').trim().toLowerCase();
      const txGstin = (t.supplierGstin || t.partyGstin || '').trim().toUpperCase();
      const txDate = (t.date || '').split(',')[0].trim();
      const sameInv = cleanInvNo && txInv === cleanInvNo;
      const sameVendor = cleanGstin ? txGstin === cleanGstin : t.partyName.toLowerCase() === scan.supplierName.toLowerCase();
      const sameDate = !cleanDate || txDate === cleanDate;
      return sameInv && sameVendor && sameDate;
    });

    if (duplicateTx && !options?.allowDuplicate) {
      const warn = `Duplicate Supplier Invoice detected: Bill #${duplicateTx.invoiceNo} for ${duplicateTx.partyName} (${duplicateTx.date}) already exists.`;
      return { success: false, message: warn, duplicateWarning: warn };
    }

    // 2. Match or Create Supplier Party
    let matchedSupplier = parties.find(
      (p) =>
        (p.type === 'Supplier' || !p.type) &&
        ((cleanGstin && (p.gstin || '').toUpperCase() === cleanGstin) ||
          p.name.trim().toLowerCase() === (scan.supplierName || '').trim().toLowerCase())
    );
    if (!matchedSupplier && scan.supplierName.trim()) {
      matchedSupplier = addParty({
        name: scan.supplierName.trim(),
        phone: scan.supplierPhone || '',
        email: '',
        type: 'Supplier',
        balance: 0,
        gstin: cleanGstin,
        address: scan.supplierAddress || 'Supplier Address',
        state: company.state,
      });
    }

    // 3. Process Line Items (Match existing / Create new / Update purchase price + batch + expiry + freeQty)
    const activeLines = scan.items.filter((li) => li.matchStatus !== 'IGNORED');
    if (activeLines.length === 0) {
      return { success: false, message: 'At least one non-ignored line item is required to confirm purchase.' };
    }

    const canEditSellingPrice =
      currentUser?.roleName === 'Owner' ||
      currentUser?.roleName === 'Admin' ||
      currentUser?.roleName === 'Manager' ||
      hasPermission('edit');

    const nowTs = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const invoiceLines: InvoiceItem[] = [];
    const newPriceEntries: PriceHistoryEntry[] = [];
    const newStockMovements: StockTransactionRecord[] = [];

    const workingItems = [...items];

    for (const line of activeLines) {
      const totalInwardQty = Math.max(0, Number(line.qty || 0)) + Math.max(0, Number(line.freeQty || 0));
      let targetIdx = line.matchedItemId
        ? workingItems.findIndex((it) => it.id === line.matchedItemId)
        : workingItems.findIndex(
            (it) =>
              (line.barcode && it.barcode === line.barcode) ||
              it.name.trim().toLowerCase() === line.scannedName.trim().toLowerCase()
          );

      if (targetIdx === -1 && line.matchStatus === 'CREATE_NEW') {
        const created = addItem({
          name: line.scannedName.trim(),
          code: line.hsnCode || `SKU-${Date.now().toString().slice(-4)}`,
          barcode: line.barcode || undefined,
          hsnCode: line.hsnCode || '',
          brand: line.brand || '',
          category: 'Purchased Goods',
          salePrice:
            line.updatedSellingPrice && line.updatedSellingPrice > 0
              ? line.updatedSellingPrice
              : Math.round((line.purchasePrice || 0) * 1.15 * 100) / 100,
          purchasePrice: line.purchasePrice || 0,
          lastSupplierPrice: line.purchasePrice || 0,
          lastPurchaseSupplier: scan.supplierName,
          lastPurchaseDate: scan.invoiceDate,
          stock: 0,
          unit: line.unit || 'PCS',
          taxRate: line.gstRate ?? 18,
          taxCategory: (line.gstRate ?? 0) === 0 ? 'Exempt' : 'Taxable',
          batchNo: line.batchNo || undefined,
          expiryDate: line.expiryDate || undefined,
          taxClassificationVerified: Boolean(line.hsnCode),
        });
        workingItems.push(created);
        targetIdx = workingItems.length - 1;
      }

      if (targetIdx >= 0) {
        const current = workingItems[targetIdx];
        const nextStock = (current.stock || 0) + totalInwardQty;
        const oldPurchase = current.purchasePrice || 0;
        const newPurchase = line.purchasePrice || oldPurchase;
        const nextSalePrice =
          canEditSellingPrice && line.updatedSellingPrice && line.updatedSellingPrice > 0
            ? line.updatedSellingPrice
            : current.salePrice;

        if (newPurchase !== oldPurchase) {
          newPriceEntries.push({
            id: generateUniqueId('prc'),
            itemId: current.id,
            itemName: current.name,
            priceType: 'Purchase Price',
            oldPrice: oldPurchase,
            newPrice: newPurchase,
            timestamp: nowTs,
            actor: currentUser?.name || 'Admin',
          });
        }
        if (nextSalePrice !== current.salePrice) {
          newPriceEntries.push({
            id: generateUniqueId('prc'),
            itemId: current.id,
            itemName: current.name,
            priceType: 'Sale Price',
            oldPrice: current.salePrice,
            newPrice: nextSalePrice,
            timestamp: nowTs,
            actor: currentUser?.name || 'Admin',
          });
        }

        workingItems[targetIdx] = {
          ...current,
          stock: nextStock,
          purchasePrice: newPurchase,
          lastSupplierPrice: newPurchase,
          lastPurchaseSupplier: scan.supplierName,
          lastPurchaseDate: scan.invoiceDate,
          salePrice: nextSalePrice,
          hsnCode: current.hsnCode || line.hsnCode || current.hsnCode,
          batchNo: line.batchNo || current.batchNo,
          expiryDate: line.expiryDate || current.expiryDate,
        };

        if (line.batchNo) {
          addBatch({
            itemId: current.id,
            itemName: current.name,
            batchNumber: line.batchNo,
            mfgDate: new Date().toISOString().slice(0, 10),
            expiryDate: line.expiryDate || new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
            purchaseRate: newPurchase,
            saleRate: nextSalePrice,
            qty: totalInwardQty,
          });
        }

        newStockMovements.push({
          id: generateUniqueId('stk'),
          itemId: current.id,
          itemName: current.name,
          type: 'PURCHASE_INWARD',
          qtyChange: totalInwardQty,
          stockAfter: nextStock,
          reservedAfter: current.reservedStock || 0,
          referenceNo: scan.invoiceNumber || scan.id,
          actor: currentUser?.name || 'Admin',
          timestamp: nowTs,
        });
      }

      invoiceLines.push({
        id: generateUniqueId('li'),
        name: targetIdx >= 0 ? workingItems[targetIdx].name : line.scannedName,
        hsn: line.hsnCode || (targetIdx >= 0 ? workingItems[targetIdx].hsnCode || workingItems[targetIdx].code : ''),
        qty: line.qty,
        freeQty: line.freeQty || 0,
        unit: line.unit || 'PCS',
        price: line.purchasePrice,
        discountPercent: line.discountPercent || 0,
        taxPercent: line.gstRate || 0,
        amount: line.totalAmount,
        batchNo: line.batchNo,
        expiryDate: line.expiryDate,
        barcode: line.barcode,
      });
    }

    setItems(workingItems);
    if (newPriceEntries.length > 0) {
      setPriceHistory((prev) => [...newPriceEntries, ...prev]);
    }
    if (newStockMovements.length > 0) {
      setStockHistory((prev) => [...newStockMovements, ...prev]);
    }

    // 4. Create Purchase Transaction (skipStockDeduction=true because we updated stock & freeQty above atomically)
    const paid = Math.max(0, Math.min(scan.grandTotal, Number(options?.paidAmount ?? 0)));
    const bal = Math.max(0, Math.round((scan.grandTotal - paid) * 100) / 100);
    const firstFile = scan.sourceFiles[0];

    const purchaseTx = addTransaction({
      type: 'Purchase',
      invoiceNo: scan.invoiceNumber || `PUR-${Date.now().toString().slice(-5)}`,
      date: scan.invoiceDate ? `${scan.invoiceDate}, 12:00 PM` : nowTs,
      dueDate: scan.dueDate || scan.invoiceDate || nowTs.split(',')[0],
      partyName: matchedSupplier?.name || scan.supplierName,
      partyPhone: scan.supplierPhone || matchedSupplier?.phone,
      partyAddress: scan.supplierAddress || matchedSupplier?.address,
      partyGstin: cleanGstin || matchedSupplier?.gstin,
      supplierGstin: cleanGstin || matchedSupplier?.gstin,
      poNumber: scan.purchaseOrderNo,
      firm: company.name,
      user: currentUser?.name || 'Admin',
      paymentType: options?.paymentType || (bal === 0 ? 'Bank Transfer' : 'Credit'),
      subtotal: scan.subtotal,
      totalDiscount: 0,
      taxableAmount: scan.totalTaxable,
      gstType: scan.gstType,
      cgstAmount: scan.totalCgst,
      sgstAmount: scan.totalSgst,
      igstAmount: scan.totalIgst,
      totalAmount: scan.grandTotal,
      receivedAmount: paid,
      balance: bal,
      status: bal === 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid',
      items: invoiceLines,
      sourceScanId: scan.id,
      attachedDocumentName: firstFile?.name,
      attachedDocumentDataUrl: firstFile?.previewDataUrl,
      skipStockDeduction: true,
      notes: `Verified AI Purchase Bill Scan (${scan.id})${scan.purchaseOrderNo ? ` • PO: ${scan.purchaseOrderNo}` : ''}`,
    });

    const confirmedScan: PurchaseScanRecord = {
      ...scan,
      status: 'CONFIRMED',
      confirmedAt: new Date().toISOString(),
      matchedSupplierId: matchedSupplier?.id,
      linkedPurchaseTxId: purchaseTx?.id,
    };

    await savePurchaseScanDraft(confirmedScan);
    recordActivity(
      'Confirmed AI Purchase Scan',
      'Purchase',
      `Confirmed scanned bill #${scan.invoiceNumber} from ${scan.supplierName} (${invoiceLines.length} lines, ₹${scan.grandTotal.toLocaleString('en-IN')})`
    );

    return {
      success: true,
      message: `Purchase Bill #${scan.invoiceNumber} confirmed! Inventory, batches, supplier ledger & GST ITC updated.`,
      purchaseTx: purchaseTx || undefined,
    };
  };

  // MODULE 2: HSN / SAC & GST MANAGEMENT
  const addCustomHsnEntry = async (entry: HsnMasterEntry): Promise<{ success: boolean; message: string }> => {
    setCustomHsnEntries((prev) => {
      const idx = prev.findIndex((e) => e.code === entry.code);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = entry;
        return copy;
      }
      return [entry, ...prev];
    });
    try {
      await apiClient.saveHsnEntry(entry);
    } catch {
      // Stored locally if offline
    }
    showToast(`HSN/SAC ${entry.code} (${entry.gstRate}% GST) saved to Master.`);
    return { success: true, message: 'HSN/SAC Master updated.' };
  };

  const bulkUpdateItemGst = async (
    updates: Array<{
      itemId: string;
      hsnCode?: string;
      sacCode?: string;
      taxRate: number;
      taxCategory?: Item['taxCategory'];
      unit?: string;
      effectiveDate?: string;
      taxClassificationVerified?: boolean;
    }>,
    actionType: GstClassificationAudit['action'] = 'BULK_UPDATE',
    summary?: string
  ): Promise<number> => {
    if (updates.length === 0) return 0;
    const updateMap = new Map(updates.map((u) => [u.itemId, u]));
    const auditChanges: GstClassificationAudit['changes'] = [];

    setItems((prev) =>
      prev.map((it) => {
        const u = updateMap.get(it.id);
        if (!u) return it;
        auditChanges.push({
          itemId: it.id,
          itemName: it.name,
          oldHsn: it.hsnCode || it.sacCode || it.code,
          newHsn: u.hsnCode || u.sacCode || it.hsnCode,
          oldRate: it.taxRate,
          newRate: u.taxRate,
          oldCategory: it.taxCategory || 'Taxable',
          newCategory: u.taxCategory || it.taxCategory || 'Taxable',
        });
        return {
          ...it,
          hsnCode: u.hsnCode !== undefined ? u.hsnCode : it.hsnCode,
          sacCode: u.sacCode !== undefined ? u.sacCode : it.sacCode,
          taxRate: u.taxRate,
          taxCategory: u.taxCategory || it.taxCategory || 'Taxable',
          unit: u.unit || it.unit,
          effectiveDate: u.effectiveDate || it.effectiveDate,
          taxClassificationVerified: u.taxClassificationVerified ?? true,
        };
      })
    );

    const auditRec: GstClassificationAudit = {
      id: generateUniqueId('gst-aud'),
      timestamp: new Date().toISOString(),
      actor: currentUser?.name || 'Admin',
      action: actionType,
      affectedCount: auditChanges.length,
      summary: summary || `Updated HSN/GST classification for ${auditChanges.length} item(s)`,
      changes: auditChanges,
    };

    setGstAudits((prev) => [auditRec, ...prev]);
    try {
      await apiClient.saveGstAudit(auditRec);
    } catch {
      // Saved locally
    }
    recordActivity('Updated HSN & GST Mapping', 'Inventory', auditRec.summary);
    showToast(auditRec.summary);
    return auditChanges.length;
  };

  // MODULE 3: DELIVERY CHALLAN & RETURNS WORKFLOW
  const createDeliveryChallan = (payload: {
    partyName: string;
    partyPhone?: string;
    partyGstin?: string;
    billingAddress?: string;
    shippingAddress?: string;
    challanPurpose: Transaction['challanPurpose'];
    expectedDeliveryDate?: string;
    vehicleNumber?: string;
    transporterName?: string;
    deliveryPerson?: string;
    dispatchLocation?: string;
    deliveryLocation?: string;
    showPricesOnChallan?: boolean;
    dispatchImmediately?: boolean;
    items: InvoiceItem[];
    notes?: string;
  }): Transaction | null => {
    const existingCount = transactions.filter((t) => t.type === 'Delivery Challan').length;
    const challanNo = `DC-${String(existingCount + 101)}`;
    const subtotal = payload.items.reduce((s, i) => s + i.qty * i.price, 0);
    const totalTax = payload.items.reduce(
      (s, i) => s + (i.qty * i.price * (1 - (i.discountPercent || 0) / 100) * (i.taxPercent || 0)) / 100,
      0
    );
    const totalAmount = Math.round((subtotal + totalTax) * 100) / 100;
    const initialStatus: NonNullable<Transaction['challanStatus']> = payload.dispatchImmediately
      ? 'Dispatched'
      : 'Draft';

    const created = addTransaction({
      type: 'Delivery Challan',
      invoiceNo: challanNo,
      date: `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      dueDate: payload.expectedDeliveryDate || new Date().toLocaleDateString('en-GB'),
      partyName: payload.partyName,
      partyPhone: payload.partyPhone,
      partyGstin: payload.partyGstin,
      partyAddress: payload.shippingAddress || payload.billingAddress,
      billingAddress: payload.billingAddress,
      shippingAddress: payload.shippingAddress,
      challanPurpose: payload.challanPurpose,
      challanStatus: initialStatus,
      expectedDeliveryDate: payload.expectedDeliveryDate,
      vehicleNumber: payload.vehicleNumber,
      transporterName: payload.transporterName,
      deliveryPerson: payload.deliveryPerson,
      dispatchLocation: payload.dispatchLocation,
      deliveryLocation: payload.deliveryLocation,
      showPricesOnChallan: payload.showPricesOnChallan ?? true,
      firm: company.name,
      user: currentUser?.name || 'Admin',
      paymentType: 'Credit',
      subtotal: Math.round(subtotal * 100) / 100,
      taxableAmount: Math.round(subtotal * 100) / 100,
      cgstAmount: Math.round((totalTax / 2) * 100) / 100,
      sgstAmount: Math.round((totalTax / 2) * 100) / 100,
      igstAmount: 0,
      totalAmount,
      receivedAmount: 0,
      balance: 0,
      status: 'Unpaid',
      fulfillmentStatus: 'Pending',
      skipStockDeduction: true, // Managed via updateChallanStatus below when dispatched
      items: payload.items.map((it) => ({ ...it, returnedQty: 0, damagedQty: 0, invoicedQty: 0 })),
      notes: payload.notes || `Purpose: ${payload.challanPurpose || 'Goods sent before billing'}`,
    });

    if (created && payload.dispatchImmediately) {
      updateChallanStatus(created.id, 'Dispatched');
    }
    return created;
  };

  const updateChallanStatus = (
    challanId: string,
    nextStatus: NonNullable<Transaction['challanStatus']>
  ): { success: boolean; message: string } => {
    const challan = transactions.find((t) => t.id === challanId && t.type === 'Delivery Challan');
    if (!challan) return { success: false, message: 'Delivery challan not found.' };

    const alreadyDispatched =
      challan.challanStatus === 'Dispatched' ||
      challan.challanStatus === 'Partially Returned' ||
      challan.challanStatus === 'Pending Billing' ||
      challan.challanStatus === 'Partially Invoiced' ||
      challan.challanStatus === 'Converted';

    // Deduct stock ONCE when transitioning to Dispatched
    if (nextStatus === 'Dispatched' && !alreadyDispatched) {
      const movements: StockTransactionRecord[] = [];
      const ts = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      setItems((prev) =>
        prev.map((it) => {
          const line = challan.items.find(
            (l) => l.name.toLowerCase() === it.name.toLowerCase() || (l.hsn && it.code === l.hsn)
          );
          if (!line) return it;
          const nextStock = it.stock - (line.qty || 0);
          movements.push({
            id: generateUniqueId('stk'),
            itemId: it.id,
            itemName: it.name,
            type: 'DEDUCT_SALE',
            qtyChange: -(line.qty || 0),
            stockAfter: nextStock,
            reservedAfter: it.reservedStock || 0,
            referenceNo: challan.invoiceNo,
            actor: currentUser?.name || 'Admin',
            timestamp: ts,
          });
          return { ...it, stock: nextStock };
        })
      );
      if (movements.length > 0) setStockHistory((prev) => [...movements, ...prev]);
    }

    // Restore stock if cancelling an already-dispatched & uninvoiced challan
    if (nextStatus === 'Cancelled' && alreadyDispatched && challan.challanStatus !== 'Converted') {
      const movements: StockTransactionRecord[] = [];
      const ts = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      setItems((prev) =>
        prev.map((it) => {
          const line = challan.items.find((l) => l.name.toLowerCase() === it.name.toLowerCase());
          if (!line) return it;
          const outstandingQty = Math.max(0, line.qty - (line.returnedQty || 0) - (line.damagedQty || 0) - (line.invoicedQty || 0));
          if (outstandingQty <= 0) return it;
          const nextStock = it.stock + outstandingQty;
          movements.push({
            id: generateUniqueId('stk'),
            itemId: it.id,
            itemName: it.name,
            type: 'RETURN_RESTOCK',
            qtyChange: outstandingQty,
            stockAfter: nextStock,
            reservedAfter: it.reservedStock || 0,
            referenceNo: challan.invoiceNo,
            actor: currentUser?.name || 'Admin',
            timestamp: ts,
          });
          return { ...it, stock: nextStock };
        })
      );
      if (movements.length > 0) setStockHistory((prev) => [...movements, ...prev]);
    }

    updateTransaction(challan.id, {
      challanStatus: nextStatus,
      fulfillmentStatus:
        nextStatus === 'Converted' ? 'Completed' : nextStatus === 'Cancelled' ? 'Cancelled' : challan.fulfillmentStatus,
    });
    showToast(`Challan #${challan.invoiceNo} status updated to ${nextStatus}.`);
    return { success: true, message: `Status updated to ${nextStatus}` };
  };

  const recordChallanReturn = (
    challanId: string,
    returnLines: Array<{ name: string; acceptedQty: number; damagedQty: number }>,
    notes?: string
  ): { success: boolean; message: string } => {
    const challan = transactions.find((t) => t.id === challanId && t.type === 'Delivery Challan');
    if (!challan) return { success: false, message: 'Challan not found.' };

    const ts = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const movements: StockTransactionRecord[] = [];
    let totalAccepted = 0;

    const updatedItems = challan.items.map((line) => {
      const ret = returnLines.find((r) => r.name.toLowerCase() === line.name.toLowerCase());
      if (!ret) return line;
      const remaining = Math.max(0, line.qty - (line.returnedQty || 0) - (line.damagedQty || 0) - (line.invoicedQty || 0));
      const acc = Math.max(0, Math.min(remaining, Number(ret.acceptedQty || 0)));
      const dmg = Math.max(0, Math.min(remaining - acc, Number(ret.damagedQty || 0)));
      totalAccepted += acc;
      return {
        ...line,
        returnedQty: (line.returnedQty || 0) + acc,
        damagedQty: (line.damagedQty || 0) + dmg,
      };
    });

    // ONLY accepted sellable returns go back into active stock; damaged goods stay out of sellable stock
    if (totalAccepted > 0) {
      setItems((prev) =>
        prev.map((it) => {
          const ret = returnLines.find((r) => r.name.toLowerCase() === it.name.toLowerCase());
          const acc = Math.max(0, Number(ret?.acceptedQty || 0));
          if (!ret || acc <= 0) return it;
          const nextStock = it.stock + acc;
          movements.push({
            id: generateUniqueId('stk'),
            itemId: it.id,
            itemName: it.name,
            type: 'RETURN_RESTOCK',
            qtyChange: acc,
            stockAfter: nextStock,
            reservedAfter: it.reservedStock || 0,
            referenceNo: challan.invoiceNo,
            actor: currentUser?.name || 'Admin',
            timestamp: ts,
          });
          return { ...it, stock: nextStock };
        })
      );
      if (movements.length > 0) setStockHistory((prev) => [...movements, ...prev]);
    }

    const retRec: ChallanReturnRecord = {
      id: generateUniqueId('dcr'),
      date: ts,
      recordedBy: currentUser?.name || 'Admin',
      notes,
      items: returnLines.filter((r) => r.acceptedQty > 0 || r.damagedQty > 0),
    };

    const fullyResolved = updatedItems.every(
      (it) => (it.returnedQty || 0) + (it.damagedQty || 0) + (it.invoicedQty || 0) >= it.qty
    );
    const hasRemainingToBill = updatedItems.some(
      (it) => it.qty - (it.returnedQty || 0) - (it.damagedQty || 0) - (it.invoicedQty || 0) > 0
    );

    const nextChallanStatus: NonNullable<Transaction['challanStatus']> = hasRemainingToBill
      ? 'Partially Returned'
      : fullyResolved && updatedItems.every((it) => (it.invoicedQty || 0) === 0)
      ? 'Cancelled'
      : 'Pending Billing';

    updateTransaction(challan.id, {
      items: updatedItems,
      challanReturns: [retRec, ...(challan.challanReturns || [])],
      challanStatus: nextChallanStatus,
    });

    recordActivity(
      'Recorded Challan Return',
      'Sales',
      `Challan #${challan.invoiceNo}: Restocked ${totalAccepted} accepted unit(s); damaged units excluded from sellable stock.`
    );
    showToast(`Challan #${challan.invoiceNo} return processed (${totalAccepted} unit(s) restored to sellable stock).`);
    return { success: true, message: 'Return recorded successfully.' };
  };

  // MODULE 5: ESTIMATE & QUOTATION REVISIONS, PORTAL APPROVAL & CONVERSIONS
  const createOrUpdateQuotation = (payload: {
    existingId?: string;
    type?: 'Estimate' | 'Proforma';
    partyName: string;
    partyPhone?: string;
    partyEmail?: string;
    partyGstin?: string;
    billingAddress?: string;
    shippingAddress?: string;
    dueDate: string;
    referenceNo?: string;
    salesperson?: string;
    shippingCharges?: number;
    otherCharges?: number;
    overallDiscount?: number;
    termsAndConditions?: string;
    notes?: string;
    items: InvoiceItem[];
    quotationStatus?: QuotationStatus;
  }): Transaction | null => {
    const subtotal = payload.items.reduce((s, i) => s + i.qty * i.price, 0);
    const lineDiscounts = payload.items.reduce((s, i) => s + (i.qty * i.price * (i.discountPercent || 0)) / 100, 0);
    const overallDisc = Number(payload.overallDiscount || 0);
    const taxableAmount = Math.max(0, subtotal - lineDiscounts - overallDisc);
    const totalTax = payload.items.reduce(
      (s, i) => s + (i.qty * i.price * (1 - (i.discountPercent || 0) / 100) * (i.taxPercent || 0)) / 100,
      0
    );
    const charges = Number(payload.shippingCharges || 0) + Number(payload.otherCharges || 0);
    const rawTotal = taxableAmount + totalTax + charges;
    const totalAmount = settings.enableRoundOff ? Math.round(rawTotal) : Math.round(rawTotal * 100) / 100;
    const roundOff = Math.round((totalAmount - rawTotal) * 100) / 100;

    const isInter =
      Boolean(payload.partyGstin && company.gstin) &&
      payload.partyGstin!.slice(0, 2) !== company.gstin.slice(0, 2);

    if (payload.existingId) {
      const existing = transactions.find((t) => t.id === payload.existingId);
      if (!existing) return null;
      const prevVersion = existing.quotationVersion || 1;
      const revSnapshot: QuotationRevision = {
        version: prevVersion,
        savedAt: new Date().toISOString(),
        savedBy: currentUser?.name || 'Admin',
        totalAmount: existing.totalAmount,
        items: existing.items,
        notes: existing.notes,
        changeSummary: `Snapshot before v${prevVersion + 1} (${existing.quotationStatus || 'Draft'})`,
      };
      const updatedFields: Partial<Transaction> = {
        partyName: payload.partyName,
        partyPhone: payload.partyPhone,
        partyEmail: payload.partyEmail,
        partyGstin: payload.partyGstin,
        partyAddress: payload.billingAddress,
        billingAddress: payload.billingAddress,
        shippingAddress: payload.shippingAddress,
        dueDate: payload.dueDate,
        referenceNo: payload.referenceNo,
        salesperson: payload.salesperson,
        shippingCharges: payload.shippingCharges || 0,
        otherCharges: payload.otherCharges || 0,
        overallDiscount: overallDisc,
        termsAndConditions: payload.termsAndConditions,
        notes: payload.notes,
        items: payload.items,
        subtotal: Math.round(subtotal * 100) / 100,
        totalDiscount: Math.round((lineDiscounts + overallDisc) * 100) / 100,
        taxableAmount: Math.round(taxableAmount * 100) / 100,
        gstType: isInter ? 'Inter-State' : 'Intra-State',
        cgstAmount: isInter ? 0 : Math.round((totalTax / 2) * 100) / 100,
        sgstAmount: isInter ? 0 : Math.round((totalTax / 2) * 100) / 100,
        igstAmount: isInter ? Math.round(totalTax * 100) / 100 : 0,
        roundOff,
        totalAmount,
        balance: totalAmount,
        quotationVersion: prevVersion + 1,
        quotationRevisions: [revSnapshot, ...(existing.quotationRevisions || [])],
        quotationStatus: payload.quotationStatus || existing.quotationStatus || 'Draft',
      };
      updateTransaction(existing.id, updatedFields);
      showToast(`Quotation #${existing.invoiceNo} updated to v${prevVersion + 1}. Previous version preserved.`);
      return { ...existing, ...updatedFields };
    }

    const qCount = transactions.filter((t) => t.type === (payload.type || 'Estimate')).length;
    const prefix = payload.type === 'Proforma' ? 'PI' : 'QTN';
    const docNo = `${prefix}-${101 + qCount}`;

    return addTransaction({
      type: payload.type || 'Estimate',
      invoiceNo: docNo,
      date: `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      dueDate: payload.dueDate,
      partyName: payload.partyName,
      partyPhone: payload.partyPhone,
      partyEmail: payload.partyEmail,
      partyGstin: payload.partyGstin,
      partyAddress: payload.billingAddress,
      billingAddress: payload.billingAddress,
      shippingAddress: payload.shippingAddress,
      referenceNo: payload.referenceNo,
      salesperson: payload.salesperson || currentUser?.name || 'Sales',
      shippingCharges: payload.shippingCharges || 0,
      otherCharges: payload.otherCharges || 0,
      overallDiscount: overallDisc,
      termsAndConditions: payload.termsAndConditions,
      firm: company.name,
      user: currentUser?.name || 'Admin',
      paymentType: 'Credit',
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round((lineDiscounts + overallDisc) * 100) / 100,
      taxableAmount: Math.round(taxableAmount * 100) / 100,
      gstType: isInter ? 'Inter-State' : 'Intra-State',
      cgstAmount: isInter ? 0 : Math.round((totalTax / 2) * 100) / 100,
      sgstAmount: isInter ? 0 : Math.round((totalTax / 2) * 100) / 100,
      igstAmount: isInter ? Math.round(totalTax * 100) / 100 : 0,
      roundOff,
      totalAmount,
      receivedAmount: 0,
      balance: totalAmount,
      status: 'Unpaid',
      fulfillmentStatus: 'Pending',
      quotationStatus: payload.quotationStatus || 'Draft',
      quotationVersion: 1,
      quotationRevisions: [],
      skipStockDeduction: true, // Quotations NEVER affect inventory or ledger
      items: payload.items,
      notes: payload.notes || '',
    });
  };

  const convertQuotationToSalesOrder = (quotationId: string): Transaction | null => {
    const est = transactions.find((t) => t.id === quotationId);
    if (!est) return null;
    const soCount = transactions.filter((t) => t.type === 'Sale Order').length;
    const soNo = `SO-${101 + soCount}`;
    const orderTx = addTransaction({
      type: 'Sale Order',
      invoiceNo: soNo,
      date: `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      dueDate: est.dueDate,
      partyName: est.partyName,
      partyPhone: est.partyPhone,
      partyAddress: est.billingAddress || est.partyAddress,
      partyGstin: est.partyGstin,
      firm: est.firm || company.name,
      user: currentUser?.name || 'Admin',
      paymentType: 'Credit',
      subtotal: est.subtotal,
      totalDiscount: est.totalDiscount,
      taxableAmount: est.taxableAmount,
      gstType: est.gstType,
      cgstAmount: est.cgstAmount,
      sgstAmount: est.sgstAmount,
      igstAmount: est.igstAmount,
      totalAmount: est.totalAmount,
      receivedAmount: 0,
      balance: est.totalAmount,
      status: 'Unpaid',
      fulfillmentStatus: 'Pending',
      linkedQuotationId: est.id,
      convertedFrom: { type: 'Estimate', docId: est.id, docNo: est.invoiceNo },
      items: est.items.map((it) => ({ ...it, id: generateUniqueId('li') })),
      notes: `Converted from Quotation #${est.invoiceNo}`,
    });
    if (orderTx) {
      updateTransaction(est.id, {
        quotationStatus: 'Converted to Order',
        linkedOrderId: orderTx.id,
        fulfillmentStatus: 'Partially Fulfilled',
      });
      showToast(`Quotation #${est.invoiceNo} converted to Sales Order #${soNo}!`);
    }
    return orderTx;
  };

  const duplicateQuotation = (quotationId: string): Transaction | null => {
    const est = transactions.find((t) => t.id === quotationId);
    if (!est) return null;
    return createOrUpdateQuotation({
      type: est.type === 'Proforma' ? 'Proforma' : 'Estimate',
      partyName: est.partyName,
      partyPhone: est.partyPhone,
      partyEmail: est.partyEmail,
      partyGstin: est.partyGstin,
      billingAddress: est.billingAddress || est.partyAddress,
      shippingAddress: est.shippingAddress,
      dueDate: est.dueDate,
      referenceNo: est.referenceNo,
      salesperson: est.salesperson,
      shippingCharges: est.shippingCharges,
      otherCharges: est.otherCharges,
      overallDiscount: est.overallDiscount,
      termsAndConditions: est.termsAndConditions,
      notes: est.notes,
      items: est.items.map((it) => ({ ...it, id: generateUniqueId('li') })),
      quotationStatus: 'Draft',
    });
  };

  const syncSharedQuotationResponse = (quotationId: string, updatedQuotation: Partial<Transaction>) => {
    updateTransaction(quotationId, updatedQuotation);
  };

  // MODULE 4: E-INVOICE & E-WAY BILL REFRESH & SYNC
  const refreshEInvoiceData = async (): Promise<void> => {
    try {
      const data = await apiClient.getEInvoiceData();
      setEInvoiceRecords(data.eInvoices || []);
      setEInvoiceLogs(data.apiLogs || []);
      setEWayBillRecords(data.eWayBills || []);
    } catch {
      // Keep local records if server unavailable
    }
  };

  // MODULE 8 & 10: PRE-MIGRATION BACKUP & ROLLBACK CHECKPOINTS
  const createPreMigrationBackup = async (
    label = 'Manual ERP Checkpoint'
  ): Promise<{ success: boolean; backupId?: string; message: string }> => {
    try {
      const snapshot = {
        transactions,
        parties,
        items,
        company,
        settings,
        purchaseScans,
        customHsnEntries,
        gstAudits,
      };
      const res = await apiClient.createErpBackup(label, snapshot);
      showToast(`Backup checkpoint ${res.backupId} created safely.`);
      return { success: true, backupId: res.backupId, message: `Checkpoint ${res.backupId} created.` };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Backup failed.' };
    }
  };

  const restoreBackupCheckpoint = async (
    backupId: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await apiClient.rollbackErpBackup(backupId);
      if (res.clientSnapshot) {
        if (Array.isArray(res.clientSnapshot.transactions)) setTransactions(res.clientSnapshot.transactions);
        if (Array.isArray(res.clientSnapshot.parties)) setParties(res.clientSnapshot.parties);
        if (Array.isArray(res.clientSnapshot.items)) setItems(res.clientSnapshot.items);
      }
      await refreshEInvoiceData();
      showToast(`System rolled back to checkpoint ${backupId}.`);
      return { success: true, message: `Rolled back to ${backupId}.` };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Rollback failed.' };
    }
  };

  // ============================================================================
  // COMPLETE SETTINGS MODULE & ROLE-BASED SETTINGS ACCESS HANDLERS
  // ============================================================================
  const canViewSettingsCategory = (cat: SettingsCategoryId, overrideRoleName?: string): boolean => {
    const roleName = overrideRoleName || currentUser?.roleName || '';
    if (!roleName) return false;
    if (roleName === 'Owner' || roleName === 'Admin') return true;
    const rule = businessSettings.roleSettingsAccess?.[roleName];
    if (!rule) {
      return hasModulePermission('settings_config', 'view');
    }
    if (cat === 'role-access') return Boolean(rule.canManageRoleAccess);
    if (cat === 'audit-backup') return Boolean(rule.canViewAuditHistory || rule.canBackupAndRestore);
    if (cat === 'masters') return hasModulePermission('items_inventory', 'view');
    if (cat === 'users-portal') return hasModulePermission('staff_security', 'view');
    return Boolean(rule.categories?.[cat as CoreSettingsCategoryId]?.view);
  };

  const canEditSettingsCategory = (cat: SettingsCategoryId, overrideRoleName?: string): boolean => {
    const roleName = overrideRoleName || currentUser?.roleName || '';
    if (!roleName) return false;
    if (roleName === 'Owner' || roleName === 'Admin') return true;
    const rule = businessSettings.roleSettingsAccess?.[roleName];
    if (!rule) return false;
    if (cat === 'role-access') return Boolean(rule.canManageRoleAccess);
    if (cat === 'audit-backup') return Boolean(rule.canBackupAndRestore);
    if (cat === 'masters') return hasModulePermission('items_inventory', 'edit');
    if (cat === 'users-portal') return hasModulePermission('staff_security', 'edit');
    return Boolean(rule.categories?.[cat as CoreSettingsCategoryId]?.edit);
  };

  const syncLegacyAppSettingsFromBundle = (bundle: BusinessSettingsBundle) => {
    const saleSeq = bundle.transaction.sequences.find((s) => s.docType === 'Sales Invoice');
    setSettings((prev) => ({
      ...prev,
      invoicePrefix: saleSeq?.prefix ?? prev.invoicePrefix,
      nextInvoiceNumber: saleSeq?.nextNumber ?? prev.nextInvoiceNumber,
      invoicePadding: saleSeq?.digits ?? prev.invoicePadding,
      invoiceSuffix: saleSeq?.suffix ?? prev.invoiceSuffix,
      defaultTaxRate: bundle.item.defaultTaxRate ?? prev.defaultTaxRate,
      enableGst: bundle.gst.isGstRegistered,
      enableThermalPrint:
        bundle.print.pageSize === 'Thermal 58mm' || bundle.print.pageSize === 'Thermal 80mm',
      defaultInvoiceTemplate: bundle.print.defaultTemplate,
      enableRoundOff: bundle.transaction.sales.enableRoundOff,
      enableCreditLimitWarning: bundle.party.enableCreditLimitControl,
      currencySymbol: bundle.general.currencySymbol || '₹',
    }));
    setSelectedTemplate(bundle.print.defaultTemplate);
  };

  const updateBusinessSettingsSection = async <K extends keyof BusinessSettingsBundle>(
    category: SettingsCategoryId,
    sectionKey: K,
    updates: Partial<BusinessSettingsBundle[K]> | BusinessSettingsBundle[K],
    reason?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!canEditSettingsCategory(category)) {
      const msg = `Permission Denied: Role "${currentUser?.roleName || 'Staff'}" has read-only or restricted access to "${category}" settings.`;
      showToast(msg, 'error');
      return { success: false, message: msg };
    }

    const prevValue = businessSettings[sectionKey];
    const nextSection =
      typeof prevValue === 'object' && prevValue !== null && !Array.isArray(prevValue) && typeof updates === 'object' && updates !== null && !Array.isArray(updates)
        ? { ...prevValue, ...updates }
        : updates;

    const nextBundle: BusinessSettingsBundle = {
      ...businessSettings,
      [sectionKey]: nextSection,
      updatedAt: new Date().toISOString(),
    };

    // Keep item.stockValuationMethod & accounting.profitControl.costingMethod synchronized
    if (sectionKey === 'accounting' && (nextSection as unknown as BusinessSettingsBundle['accounting'])?.profitControl?.costingMethod) {
      const m = (nextSection as unknown as BusinessSettingsBundle['accounting']).profitControl!.costingMethod;
      nextBundle.item = {
        ...nextBundle.item,
        stockValuationMethod: m === 'Last Purchase Price' ? 'Purchase Price' : m,
      };
    } else if (sectionKey === 'item' && (nextSection as unknown as BusinessSettingsBundle['item'])?.stockValuationMethod) {
      const valMethod = (nextSection as unknown as BusinessSettingsBundle['item']).stockValuationMethod;
      nextBundle.accounting = {
        ...nextBundle.accounting,
        profitControl: {
          ...(nextBundle.accounting.profitControl || buildDefaultBusinessSettings().accounting.profitControl!),
          costingMethod: valMethod === 'Purchase Price' ? 'Last Purchase Price' : valMethod,
        },
      };
    }

    const auditItem: SettingsAuditEntry = {
      id: generateUniqueId('saud'),
      businessId: nextBundle.businessId,
      category,
      settingName: `Updated ${String(sectionKey)} settings`,
      previousValue: JSON.stringify(prevValue).slice(0, 160),
      newValue: JSON.stringify(nextSection).slice(0, 160),
      changedBy: currentUser?.name || 'Administrator',
      changedRole: currentUser?.roleName || 'Owner',
      timestamp: new Date().toISOString(),
      reason: reason || 'Saved from Settings Control Center',
    };

    setBusinessSettings(nextBundle);
    syncLegacyAppSettingsFromBundle(nextBundle);
    setSettingsAuditLogs((prev) => [auditItem, ...prev].slice(0, 300));
    recordActivity('Updated Settings', 'Settings', `Saved ${category} settings`);

    try {
      const remote = await apiClient.saveSettingsBundle({
        category,
        settingsBundle: nextBundle,
        partyGroups,
        serviceReminders,
        reason,
        gstin: company.gstin,
      });
      if (Array.isArray(remote?.settingsAuditLogs)) {
        setSettingsAuditLogs(remote.settingsAuditLogs);
      }
      showToast('Settings saved and synced to server.');
      return { success: true, message: 'Settings saved cleanly.' };
    } catch (err: any) {
      // Surface validation/403 rejection if server rejected, otherwise keep local IndexedDB persistence
      if (err?.message && (err.message.includes('Access Denied') || err.message.includes('Invalid'))) {
        showToast(err.message, 'error');
        return { success: false, message: err.message };
      }
      showToast('Settings saved locally to database.');
      return { success: true, message: 'Settings saved locally.' };
    }
  };

  const updateRoleSettingsAccessRule = async (
    roleName: string,
    rule: RoleSettingsAccessRule
  ): Promise<{ success: boolean; message: string }> => {
    const nextMap = {
      ...businessSettings.roleSettingsAccess,
      [roleName]: rule,
    };
    return updateBusinessSettingsSection(
      'role-access',
      'roleSettingsAccess',
      nextMap,
      `Updated Settings permissions for role ${roleName}`
    );
  };

  const resetBusinessSettingsSection = async (
    category?: SettingsCategoryId
  ): Promise<{ success: boolean; message: string }> => {
    const roleName = currentUser?.roleName || '';
    const rule = businessSettings.roleSettingsAccess?.[roleName];
    if (roleName !== 'Owner' && roleName !== 'Admin' && !rule?.canResetSettings) {
      const msg = 'Permission Denied: Only authorized roles can reset settings to default.';
      showToast(msg, 'error');
      return { success: false, message: msg };
    }

    const defaults = buildDefaultBusinessSettings(businessSettings.businessId);
    let nextBundle: BusinessSettingsBundle = defaults;

    if (category) {
      const map: Partial<Record<SettingsCategoryId, keyof BusinessSettingsBundle>> = {
        general: 'general',
        transaction: 'transaction',
        print: 'print',
        'taxes-gst': 'gst',
        'transaction-message': 'messages',
        party: 'party',
        item: 'item',
        'service-reminders': 'serviceReminders',
        accounting: 'accounting',
        'role-access': 'roleSettingsAccess',
      };
      const key = map[category];
      if (key) {
        nextBundle = {
          ...businessSettings,
          [key]: defaults[key],
          updatedAt: new Date().toISOString(),
        };
      }
    }

    setBusinessSettings(nextBundle);
    syncLegacyAppSettingsFromBundle(nextBundle);

    const auditItem: SettingsAuditEntry = {
      id: generateUniqueId('saud'),
      businessId: nextBundle.businessId,
      category: category || 'general',
      settingName: category ? `Reset ${category} to default` : 'Reset all settings to default',
      previousValue: 'Custom settings',
      newValue: 'Business Manager 360 Defaults',
      changedBy: currentUser?.name || 'Administrator',
      changedRole: roleName || 'Owner',
      timestamp: new Date().toISOString(),
      reason: 'Reset to Default action',
    };
    setSettingsAuditLogs((prev) => [auditItem, ...prev].slice(0, 300));

    try {
      await apiClient.resetSettingsBundle({ category, settingsBundle: nextBundle });
    } catch {
      // Offline fallback preserved
    }
    showToast(category ? `${category} settings reset to default.` : 'All settings restored to defaults.');
    return { success: true, message: 'Reset completed.' };
  };

  const addPartyGroup = (group: Omit<PartyGroup, 'id' | 'createdAt'>): PartyGroup => {
    const created: PartyGroup = {
      ...group,
      id: generateUniqueId('grp'),
      createdAt: new Date().toISOString(),
    };
    setPartyGroups((prev) => [...prev, created]);
    showToast(`Party group "${created.name}" created.`);
    return created;
  };

  const updatePartyGroup = (id: string, updates: Partial<PartyGroup>) => {
    setPartyGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
    showToast('Party group updated.');
  };

  const deletePartyGroup = (id: string): { success: boolean; message: string } => {
    const grp = partyGroups.find((g) => g.id === id);
    if (!grp) return { success: false, message: 'Group not found' };
    const inUse = parties.some((p) => p.groupId === id);
    if (inUse) {
      const msg = `Group "${grp.name}" is assigned to existing parties. Reassign those parties first.`;
      showToast(msg, 'warning');
      return { success: false, message: msg };
    }
    setPartyGroups((prev) => prev.filter((g) => g.id !== id));
    showToast(`Deleted group "${grp.name}".`);
    return { success: true, message: 'Group deleted' };
  };

  const addServiceReminder = (
    rem: Omit<ServiceReminderRecord, 'id' | 'createdAt'>
  ): ServiceReminderRecord => {
    const created: ServiceReminderRecord = {
      ...rem,
      id: generateUniqueId('sr'),
      createdAt: new Date().toISOString(),
    };
    setServiceReminders((prev) => [created, ...prev]);
    showToast(`Service reminder "${created.title}" added.`);
    return created;
  };

  const updateServiceReminder = (id: string, updates: Partial<ServiceReminderRecord>) => {
    setServiceReminders((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const deleteServiceReminder = (id: string) => {
    setServiceReminders((prev) => prev.filter((r) => r.id !== id));
    showToast('Service reminder removed.');
  };

  const logPaymentReminderSent = (
    entry: Omit<PaymentReminderLog, 'id' | 'sentAt' | 'sentBy'>
  ): PaymentReminderLog => {
    const record: PaymentReminderLog = {
      ...entry,
      id: generateUniqueId('prl'),
      sentAt: new Date().toISOString(),
      sentBy: currentUser?.name || 'Admin',
    };
    setPaymentReminderLogs((prev) => [record, ...prev].slice(0, 200));
    recordActivity('Payment Reminder Shared', 'Settings', `Shared ${entry.channel} reminder with ${entry.partyName}`);
    return record;
  };

  const logDiscountApproval = (
    entry: Omit<DiscountApprovalRecord, 'id' | 'timestamp'>
  ): DiscountApprovalRecord => {
    const record: DiscountApprovalRecord = {
      ...entry,
      id: generateUniqueId('dap'),
      timestamp: new Date().toISOString(),
    };
    setDiscountApprovals((prev) => [record, ...prev].slice(0, 300));
    recordActivity(
      entry.status === 'Approved' ? 'Approved Special Discount / Loss Sale' : 'Blocked Loss Sale',
      'Billing',
      `${entry.status} #${entry.invoiceNo} (${entry.partyName}) • Disc ₹${entry.discountAmount.toLocaleString('en-IN')} (${entry.discountPercent}%) • Loss ₹${entry.lossAmount.toLocaleString('en-IN')} • Reason: ${entry.reason}`,
      {
        targetType: 'DiscountApproval',
        outcome: entry.status === 'Approved' ? 'Approved' : 'Denied',
      }
    );
    return record;
  };

  const verifyAdminApprovalPin = (pin: string): boolean => {
    const configuredPin = (businessSettings.accounting?.profitControl?.adminApprovalPin || '1234').trim();
    return Boolean(pin && pin.trim() === configuredPin);
  };

  const lockFinancialPeriod = async (
    label: string,
    startDate: string,
    endDate: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!canOverrideStockLimit()) {
      const msg = 'Admin Only: Only Owner or Admin can lock financial periods.';
      showToast(msg, 'error');
      return { success: false, message: msg };
    }
    if (!label.trim() || !startDate || !endDate || startDate > endDate) {
      return { success: false, message: 'Provide a valid period label and start/end date range.' };
    }
    const existing = businessSettings.accounting?.lockedPeriods || [];
    const newPeriod: LockedFinancialPeriod = {
      id: generateUniqueId('lock'),
      label: label.trim(),
      startDate,
      endDate,
      lockedBy: currentUser?.name || 'Admin',
      lockedAt: new Date().toISOString(),
    };
    const res = await updateBusinessSettingsSection(
      'accounting',
      'accounting',
      { lockedPeriods: [newPeriod, ...existing] },
      `Locked financial period "${newPeriod.label}" (${startDate} to ${endDate})`
    );
    return res;
  };

  const unlockFinancialPeriod = async (periodId: string): Promise<{ success: boolean; message: string }> => {
    if (!canOverrideStockLimit()) {
      const msg = 'Admin Only: Only Owner or Admin can unlock financial periods.';
      showToast(msg, 'error');
      return { success: false, message: msg };
    }
    const existing = businessSettings.accounting?.lockedPeriods || [];
    const target = existing.find((p) => p.id === periodId);
    if (!target) return { success: false, message: 'Locked period not found.' };
    return updateBusinessSettingsSection(
      'accounting',
      'accounting',
      { lockedPeriods: existing.filter((p) => p.id !== periodId) },
      `Unlocked financial period "${target.label}"`
    );
  };

  const applyRecommendedItemPrice = (
    itemId: string,
    newSalePrice: number,
    reason?: string
  ): { success: boolean; message: string } => {
    if (!canOverrideStockLimit() && !hasPermission('product')) {
      const msg = 'Permission Denied: Admin/Inventory permission required to apply AI price updates.';
      showToast(msg, 'error');
      return { success: false, message: msg };
    }
    const existing = items.find((i) => i.id === itemId);
    if (!existing) return { success: false, message: 'Product not found.' };
    const cleanPrice = Math.round((Number(newSalePrice) || 0) * 100) / 100;
    if (cleanPrice <= 0) return { success: false, message: 'Price must be greater than ₹0.' };

    const oldPrice = existing.salePrice;
    const nowStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, salePrice: cleanPrice } : i))
    );
    setPriceHistory((prev) => [
      {
        id: generateUniqueId('ph'),
        itemId: existing.id,
        itemName: existing.name,
        priceType: 'Sale Price',
        oldPrice,
        newPrice: cleanPrice,
        timestamp: nowStr,
        actor: currentUser?.name || 'Admin',
      },
      ...prev,
    ]);
    recordActivity(
      'Confirmed Price Update',
      'Inventory',
      `Updated "${existing.name}" selling price from ₹${oldPrice} to ₹${cleanPrice} (${reason || 'AI Recommendation'})`
    );
    showToast(`Updated "${existing.name}" price to ₹${cleanPrice.toLocaleString('en-IN')}`, 'success');
    return { success: true, message: 'Selling price updated.' };
  };

  return (
    <VyaparContext.Provider
      value={{
        activeTab,
        setActiveTab,
        activeSaleSubtype,
        setActiveSaleSubtype,
        sidebarCollapsed,
        setSidebarCollapsed,
        searchQuery,
        setSearchQuery,
        filterPeriod,
        setFilterPeriod,
        filterStartDate,
        setFilterStartDate,
        filterEndDate,
        setFilterEndDate,
        filterFirm,
        setFilterFirm,
        filterUser,
        setFilterUser,
        transactions,
        filteredTransactions,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        clearTransactions,
        loadDemoData,
        parties,
        addParty,
        selectedPartyId,
        setSelectedPartyId,
        items,
        addItem,
        updateItem,
        selectedItemId,
        setSelectedItemId,
        adjustStock,
        recordDamagedStock,
        recordPurchaseReturn,
        recordUdharEntry,
        executeConfirmedAiAction,
        company,
        updateCompany,
        settings,
        updateSettings,
        totalSalesAmount,
        totalReceivedAmount,
        totalBalanceAmount,
        isAddSaleOpen,
        setIsAddSaleOpen,
        isAddPurchaseOpen,
        setIsAddPurchaseOpen,
        selectedInvoice,
        setSelectedInvoice,
        isInvoicePreviewOpen,
        setIsInvoicePreviewOpen,
        isCompanyModalOpen,
        setIsCompanyModalOpen,
        isSettingsModalOpen,
        setIsSettingsModalOpen,
        isShortcutsModalOpen,
        setIsShortcutsModalOpen,
        isHelpModalOpen,
        setIsHelpModalOpen,
        isVersionsModalOpen,
        setIsVersionsModalOpen,
        isSupportModalOpen,
        setIsSupportModalOpen,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isAnalyticsModalOpen,
        setIsAnalyticsModalOpen,
        isPremiumModalOpen,
        setIsPremiumModalOpen,
        isMyStoreModalOpen,
        setIsMyStoreModalOpen,
        isAddPartyModalOpen,
        setIsAddPartyModalOpen,
        editingParty,
        setEditingParty,
        isAddItemModalOpen,
        setIsAddItemModalOpen,
        editingItem,
        setEditingItem,
        prefilledBarcodeForNewItem,
        setPrefilledBarcodeForNewItem,
        isBarcodeScannerOpen,
        setIsBarcodeScannerOpen,
        barcodeScannerMode,
        setBarcodeScannerMode,
        openBarcodeScanner,
        triggerBarcodeScannedCallback,
        recentScannedBarcodes,
        recordScannedBarcode,
        clearRecentScans,
        exportCurrentViewPdf,
        isAuthenticated,
        currentUser,
        setCurrentUser,
        users,
        roles,
        employees,
        attendanceRecords,
        sessions,
        loginHistory,
        activityLogs,
        invitations,
        sessionTimeoutMinutes,
        setSessionTimeoutMinutes,
        login,
        register,
        logout,
        switchUser,
        switchRole,
        hasPermission,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        createRole,
        updateRole,
        deleteRole,
        removeAllFeaturesFromRole,
        grantAllFeaturesToRole,
        resetRolesToDefault,
        toggleUserBlock,
        approveUser,
        inviteUser,
        revokeInvitation,
        recordAttendance,
        recordActivity,
        terminateSession,
        supportTickets,
        addSupportTicket,
        updateSupportTicket,
        subscription,
        premiumOrders,
        activateLicenseKey,
        createPremiumOrder,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authModalTab,
        setAuthModalTab,
        isAddEmployeeModalOpen,
        setIsAddEmployeeModalOpen,
        selectedEmployee,
        setSelectedEmployee,
        isRoleEditorModalOpen,
        setIsRoleEditorModalOpen,
        selectedRole,
        setSelectedRole,
        isEmployeeDetailModalOpen,
        setIsEmployeeDetailModalOpen,
        toastMessage,
        showToast,
        selectedTemplate,
        setSelectedTemplate,
        convertEstimateToInvoice,
        convertSalesOrderToInvoice,
        convertChallanToInvoice,
        cancelInvoice,
        allocatePaymentIn,
        checkPartyCreditLimit,
        isInvoiceNumberDuplicate,
        getNextFormattedInvoiceNo,
        hasModulePermission,
        canApplyDiscount,
        canApproveRefund,
        canEditFinalizedBill,
        canCancelInvoice,
        isFinancialDataVisible,
        canOverrideStockLimit,
        canManageBarcodes,
        duplicateRole,
        archiveRole,
        isLogoutModalOpen,
        setIsLogoutModalOpen,
        isAccessRestrictedOpen,
        setIsAccessRestrictedOpen,
        restrictedFeatureName,
        setRestrictedFeatureName,
        canAccessFeature,
        checkFeatureAccess,
        expandedSidebarGroups,
        toggleSidebarGroup,
        setAllSidebarGroups,
        isDbHydrated,
        dbStats,
        serverSyncStatus,
        lastServerSyncAt,
        syncNowWithServer,
        refreshDbStats,
        restoreFullBackup,
        exportModuleCsv,
        portalStage,
        setPortalStage,
        activeSessionType,
        currentCustomer,
        customerAccounts,
        staffTasks,
        portalNotifications,
        customerActivity,
        supportMessages,
        adminPortalSubTab,
        setAdminPortalSubTab,
        loginCustomerWithEmail,
        requestCustomerMobileOtp,
        verifyCustomerMobileOtpLogin,
        registerCustomerAccount,
        loginStaffOrAdmin,
        isAdminSession,
        adminCreateStaffAccount,
        adminToggleStaffStatus,
        adminResetStaffPassword,
        adminUpdateStaffRole,
        adminToggleCustomerStatus,
        adminResetCustomerPassword,
        adminAssignStaffTask,
        updateCustomerProfile,
        addCustomerAddress,
        deleteCustomerAddress,
        setDefaultCustomerAddress,
        payCustomerPendingInvoice,
        submitCustomerSupportMessage,
        markPortalNotificationRead,
        placeCustomerOnlineOrder,
        coupons,
        msCreditTransactions,
        stockHistory,
        payments,
        returnRequests,
        serviceAreaConfig,
        validateCouponForCustomer,
        validateDeliveryPincode,
        approveOnlineOrder,
        packOnlineOrder,
        assignDeliveryBoyToOrder,
        verifyDeliveryOtpAndCompleteOrder,
        cancelCustomerOnlineOrder,
        submitCustomerReturnRequest,
        processReturnRefundRequest,
        resetCustomerPassword,
        saveBillingCoupon,
        toggleBillingCouponStatus,
        updateServiceAreaConfig,
        toggleStaffTaskStatus,
        updateProductPricing,
        replyToCustomerSupport,
        rejectOnlineOrder,
        markOrderReadyForDispatch,
        updateDeliveryBoyAvailability,
        markDeliveryOutcome,
        adminUpdateUserConfig,
        toastNotice,
        dismissToast,
        confirmDialog,
        requestConfirmation,
        closeConfirmation,
        themePreference,
        setThemePreference,
        dashboardCards,
        setDashboardCards,
        accounts,
        journalVouchers,
        addAccount,
        updateAccount,
        createJournalVoucher,
        executeContraVoucher,
        batches,
        addBatch,
        upsertItemBatches,
        variants,
        addVariant,
        serialNumbers,
        addSerialNumber,
        updateSerialStatus,
        recordGodownTransferStock,
        allocatePaymentToInvoices,
        priceHistory,
        recurringTemplates,
        addRecurringTemplate,
        toggleRecurringTemplate,
        deleteRecurringTemplate,
        runDueRecurringTransactions,
        recycleBin,
        movePartyToRecycleBin,
        moveItemToRecycleBin,
        restoreFromRecycleBin,
        permanentlyDeleteFromRecycleBin,
        emptyRecycleBin,
        addBulkImportRecords,
        purchaseScans,
        savePurchaseScanDraft,
        confirmPurchaseScan,
        customHsnEntries,
        gstAudits,
        addCustomHsnEntry,
        bulkUpdateItemGst,
        createDeliveryChallan,
        updateChallanStatus,
        recordChallanReturn,
        createOrUpdateQuotation,
        convertQuotationToSalesOrder,
        duplicateQuotation,
        syncSharedQuotationResponse,
        eInvoiceRecords,
        eInvoiceLogs,
        eWayBillRecords,
        refreshEInvoiceData,
        createPreMigrationBackup,
        restoreBackupCheckpoint,
        updateParty,
        businessSettings,
        partyGroups,
        serviceReminders,
        settingsAuditLogs,
        paymentReminderLogs,
        activeSettingsCategory,
        setActiveSettingsCategory,
        canViewSettingsCategory,
        canEditSettingsCategory,
        updateBusinessSettingsSection,
        updateRoleSettingsAccessRule,
        resetBusinessSettingsSection,
        addPartyGroup,
        updatePartyGroup,
        deletePartyGroup,
        addServiceReminder,
        updateServiceReminder,
        deleteServiceReminder,
        logPaymentReminderSent,
        getNextDocumentNumber,
        discountApprovals,
        logDiscountApproval,
        verifyAdminApprovalPin,
        lockFinancialPeriod,
        unlockFinancialPeriod,
        applyRecommendedItemPrice,
        transactionTemplates,
        addTransactionTemplate,
        deleteTransactionTemplate,
        recurringExecutionLogs,
        retryRecurringExecution,
        transitionTransactionStatus,
        cloneTransaction,
        reverseTransaction,
        restoreTransactionVersion,
        logTransactionActivity,
        bulkUpdateTransactions,
        splitInvoice,
        consolidateTransactionsToInvoice,
        updateSequenceConfig,
        paymentLimits,
        setPaymentLimits,
        reconcilePaymentTransaction,
        recordPaymentRefund,
        supplierQuotations,
        addSupplierQuotation,
        updateSupplierQuotationStatus,
        supplierItemMappings,
        upsertSupplierItemMapping,
        recordPoGrnReceipt,
      }}
    >
      {children}
    </VyaparContext.Provider>
  );
};

export const useVyapar = () => {
  const context = useContext(VyaparContext);
  if (!context) {
    throw new Error('useVyapar must be used within a VyaparProvider');
  }
  return context;
};