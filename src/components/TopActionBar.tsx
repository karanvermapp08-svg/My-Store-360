import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Search,
  Menu,
  Building2,
  Calendar,
  Bell,
  Lock,
  Plus,
  ChevronDown,
  LogOut,
  AlertTriangle,
  RotateCcw,
  ShoppingBag,
  Receipt,
  ArrowDown,
  Package,
  Users,
  CheckCircle2,
  Settings,
  UserCheck,
  Sun,
  Moon,
  Monitor,
  FileText,
  ClipboardList,
  TrendingDown,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Wrench,
  Truck,
  Barcode,
  Clock,
  CalendarClock,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { ThemePreference } from '../types';
import { getDaysOverdue } from '../utils/erpEngine';

interface TopActionBarProps {
  onLockScreen?: () => void;
}

export const TopActionBar: React.FC<TopActionBarProps> = ({ onLockScreen }) => {
  const {
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    setActiveSaleSubtype,
    currentUser,
    company,
    transactions,
    items,
    batches,
    serviceReminders,
    returnRequests,
    filterFirm,
    setFilterFirm,
    filterPeriod,
    setFilterPeriod,
    sidebarCollapsed,
    setSidebarCollapsed,
    setIsCommandPaletteOpen,
    setIsAddSaleOpen,
    setIsAddPurchaseOpen,
    setIsAddItemModalOpen,
    setIsAddPartyModalOpen,
    setIsAuthModalOpen,
    setAuthModalTab,
    setIsLogoutModalOpen,
    themePreference,
    setThemePreference,
    openBarcodeScanner,
    showToast,
  } = useVyapar();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const quickAddRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) {
        setIsQuickAddOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cycleTheme = () => {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(themePreference) + 1) % order.length];
    setThemePreference(next);
    showToast(`Theme switched to ${next === 'system' ? 'System Auto' : next === 'dark' ? 'Dark Mode' : 'Light Mode'}`, 'info');
  };

  // Section label helper
  const getSectionTitle = () => {
    switch (activeTab) {
      case 'billing':
      case 'sale-invoices':
        return { main: 'Billing', sub: 'Invoices & Counter Sales' };
      case 'estimate-quotation':
        return { main: 'Estimate / Quotation', sub: 'Price quotes & proposals' };
      case 'proforma-invoice':
        return { main: 'Proforma Invoice', sub: 'Pre-billing proforma statements' };
      case 'sale-order':
        return { main: 'Sales Orders', sub: 'Customer order fulfillment' };
      case 'delivery-challan':
        return { main: 'Delivery Challan', sub: 'Dispatch manifests & deliveries' };
      case 'credit-note':
      case 'sale-return':
        return { main: 'Returns & Refunds', sub: 'Sales returns & credit notes' };
      case 'sale-fa':
        return { main: 'Fixed Assets', sub: 'Asset sales & depreciation' };
      case 'products':
      case 'items':
        return { main: 'Products', sub: 'Catalogue & Inventory' };
      case 'erp-inventory':
        return { main: 'Batches, Serials & Variants', sub: 'Expiry, IMEI warranties & Dead stock' };
      case 'categories':
        return { main: 'Categories', sub: 'Product groups & classifications' };
      case 'units':
        return { main: 'Units', sub: 'Measurement units & conversions' };
      case 'purchases':
      case 'purchase':
      case 'purchase-bills':
        return { main: 'Purchases', sub: 'Vendor bills & Inward orders' };
      case 'purchase-order':
        return { main: 'Purchase Orders', sub: 'Supplier procurement orders' };
      case 'debit-note':
      case 'purchase-return':
        return { main: 'Purchase Returns', sub: 'Debit notes & vendor returns' };
      case 'warehouses':
        return { main: 'Warehouses / Godowns', sub: 'Multi-location stock storage' };
      case 'stock-aging':
        return { main: 'Stock Aging & Reorders', sub: 'Low-stock alerts & slow movers' };
      case 'stock-transfer':
        return { main: 'Stock Transfer', sub: 'Inter-godown inventory movement' };
      case 'reports':
        return { main: 'Reports & Analytics', sub: 'Sales, GST & Profit statements' };
      case 'stock-management':
      case 'stock-summary':
      case 'stock':
        return { main: 'Stock Management', sub: 'Valuation & Real-time balance' };
      case 'stock-history':
      case 'audit-log':
        return { main: 'Stock History', sub: 'Audit trail & Movements' };
      case 'stock-adjustment':
        return { main: 'Stock Adjustment', sub: 'Physical count reconciliation' };
      case 'accounting':
      case 'cash-bank':
        return { main: 'Accounting & Ledger', sub: 'Cashbook, bank & contra entries' };
      case 'erp-accounting':
        return { main: 'Double-Entry Accounting', sub: 'Chart of Accounts, Journals, P&L & Aging' };
      case 'cash-account':
        return { main: 'Cash Register & Reconcile', sub: 'Counter cash drawer & vouchers' };
      case 'bank-accounts':
        return { main: 'Bank Reconciliation', sub: 'Bank accounts & UPI transactions' };
      case 'payment-in':
        return { main: 'Payment-In', sub: 'Customer receipts & allocations' };
      case 'payment-out':
        return { main: 'Payment-Out', sub: 'Supplier payouts & settlements' };
      case 'customers':
        return { main: 'Customers', sub: 'Directory & Receivables' };
      case 'parties':
      case 'customer-ledger':
        return { main: 'Customer Ledger', sub: 'Statements & Balances' };
      case 'suppliers':
        return { main: 'Suppliers', sub: 'Vendor directories & Payables' };
      case 'expenses':
      case 'expense':
        return { main: 'Expenses', sub: 'Overheads & Operating outgoings' };
      case 'other-income':
      case 'income':
        return { main: 'Other Income', sub: 'Non-operating & misc revenue' };
      case 'pos':
      case 'vyapar-pos':
        return { main: 'POS Advanced', sub: 'Fast barcode checkout' };
      case 'barcode-studio':
        return { main: 'Barcode Studio', sub: 'Label generator & printing' };
      case 'erp-tools':
        return { main: 'ERP Utilities', sub: 'Recycle Bin, Recurring, CSV Import & Integrity' };
      case 'staff-management':
        return { main: 'User & Role Management', sub: 'Staff accounts & RBAC permissions' };
      case 'customer-staff-portal':
        return { main: 'Customer & Staff Portal', sub: 'Accounts, Permissions & Activity' };
      case 'demo-page':
        return { main: 'Feature Showcase', sub: 'Interactive capability tour' };
      case 'smart-inventory':
        return { main: 'Smart Inventory', sub: 'Min/Max thresholds, Expiry, Damaged & Returns' };
      case 'udhar-khata':
        return { main: 'Udhaar Khata', sub: 'Customer Credit Ledger & Collections' };
      case 'profit-loss':
        return { main: 'Profit & Loss', sub: 'Gross vs Net Profit, COGS & GST Analytics' };
      case 'online-orders':
        return { main: 'Online Orders', sub: 'Storefront Visibility, Delivery & Coupons' };
      case 'ai-assistant':
        return { main: 'AI Assistant', sub: 'Grounded Insights & Confirmed Store Actions' };
      case 'crm-loyalty':
        return { main: 'CRM, Loyalty & Coupons', sub: 'Customer Segments, Promos, Campaigns & Feedback' };
      case 'accounting-erp':
        return { main: 'Double-Entry Accounting', sub: 'Chart of Accounts, Journals, P&L & Aging' };
      case 'gst-center':
      case 'hsn-gst':
        return { main: 'HSN / SAC & GST Hub', sub: 'Compliance, GSTR-1/2/3B & Tax Audits' };
      case 'backup':
        return { main: 'ERP Utilities & Backups', sub: 'Recycle Bin, Recurring, CSV Import & Checkpoints' };
      case 'settings-hub':
      case 'settings':
        return { main: 'Settings & Store Admin', sub: 'Profile, Masters, Users, Sync & Backups' };
      case 'dashboard':
      case 'home':
      default:
        return { main: 'Dashboard', sub: 'Business overview' };
    }
  };

  // Distinct firms present in transactions + primary configured company
  const firmOptions = useMemo(() => {
    const set = new Set<string>(['All Firms']);
    if (company?.name) set.add(company.name);
    transactions.forEach((tx) => {
      if (tx.firm && tx.firm.trim()) set.add(tx.firm.trim());
    });
    return Array.from(set);
  }, [company?.name, transactions]);

  // Live operational alerts for Bell popover
  const liveAlerts = useMemo(() => {
    const lowStock = items.filter((i) => (i.stock || 0) <= (i.minStockAlert || 5));
    const pendingReturns = returnRequests.filter((r) => r.status === 'Requested');
    const pendingOnlineOrders = transactions.filter(
      (t) =>
        t.type === 'Sale Order' &&
        !t.isCancelled &&
        t.orderWorkflowStatus &&
        t.orderWorkflowStatus !== 'Delivered' &&
        t.orderWorkflowStatus !== 'Cancelled' &&
        t.orderWorkflowStatus !== 'Returned'
    );
    const overdueInvoices = transactions.filter(
      (t) =>
        t.type === 'Sale' &&
        !t.isCancelled &&
        (t.balance || 0) > 0 &&
        getDaysOverdue(t.dueDate || t.date) > 0
    );
    const expiryCutoffMs = Date.now() + 30 * 86400000;
    const expiringBatches = batches.filter((b) => {
      if (!b.expiryDate || b.qty <= 0) return false;
      const ms = new Date(b.expiryDate).getTime();
      return !Number.isNaN(ms) && ms <= expiryCutoffMs;
    });
    const todayIso = new Date().toISOString().slice(0, 10);
    const dueServiceReminders = serviceReminders.filter(
      (sr) => sr.status !== 'Completed' && sr.status !== 'Cancelled' && sr.reminderDate <= todayIso
    );
    return {
      lowStock,
      pendingReturns,
      pendingOnlineOrders,
      overdueInvoices,
      expiringBatches,
      dueServiceReminders,
      totalCount:
        lowStock.length +
        pendingReturns.length +
        pendingOnlineOrders.length +
        overdueInvoices.length +
        expiringBatches.length +
        dueServiceReminders.length,
    };
  }, [items, returnRequests, transactions, batches, serviceReminders]);

  const { main, sub } = getSectionTitle();
  const userName = currentUser?.name || 'Administrator';
  const roleName = currentUser?.roleName || 'Owner';
  const initials = userName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex flex-col shrink-0 bg-white dark:bg-slate-900 select-none z-10">
      {/* Row 1: Top Utility Header */}
      <div className="min-h-[54px] bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Crimson Sidebar Toggle + Page Title + Branch Selector */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="w-9 h-9 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] active:scale-95 text-white flex items-center justify-center shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>

          <h1 className="text-[18px] font-bold text-slate-900 dark:text-white tracking-tight truncate">{main}</h1>

          <span className="hidden md:inline-block h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Branch / Firm Filter */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 transition-colors">
            <Building2 className="w-3.5 h-3.5 text-[#8B0D1E] dark:text-rose-400 shrink-0" />
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Branch:</span>
            <select
              aria-label="Filter by Branch or Firm"
              value={filterFirm}
              onChange={(e) => {
                setFilterFirm(e.target.value);
                showToast(`Filtered branch: ${e.target.value}`);
              }}
              className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer pr-1"
            >
              {firmOptions.map((firm) => (
                <option key={firm} value={firm} className="text-slate-900">
                  {firm}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Utility Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          {/* Period Filter */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 text-xs transition-colors">
            <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <select
              aria-label="Select Accounting Period"
              value={filterPeriod}
              onChange={(e) => {
                setFilterPeriod(e.target.value);
                showToast(`Period set to ${e.target.value}`);
              }}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-100 focus:outline-none cursor-pointer"
            >
              <option value="Today" className="text-slate-900">Today</option>
              <option value="This Week" className="text-slate-900">This Week</option>
              <option value="This Month" className="text-slate-900">This Month</option>
              <option value="FY 2026-2027" className="text-slate-900">FY 2026-2027</option>
              <option value="All Time" className="text-slate-900">All Time</option>
            </select>
          </div>

          {/* Theme Switcher (Light / Dark / System) */}
          <button
            type="button"
            onClick={cycleTheme}
            title={`Theme: ${themePreference} (Click to switch Light / Dark / System)`}
            aria-label="Switch Theme Mode"
            className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            {themePreference === 'dark' ? (
              <Moon className="w-4 h-4 text-amber-400" />
            ) : themePreference === 'system' ? (
              <Monitor className="w-4 h-4 text-blue-500" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
          </button>

          {/* Alerts / Notifications Bell */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setIsNotifOpen((prev) => !prev)}
              aria-label="Store Alerts & Notifications"
              title="Store Alerts & Notifications"
              className="relative w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {liveAlerts.totalCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C41E3A] text-white text-[10px] font-bold flex items-center justify-center shadow-xs tabular-nums">
                  {liveAlerts.totalCount > 99 ? '99+' : liveAlerts.totalCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                <div className="px-4 py-2.5 bg-[#8B0D1E] text-white flex items-center justify-between">
                  <span className="text-xs font-bold">Store Alerts</span>
                  <span className="text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded-full tabular-nums">
                    {liveAlerts.totalCount} active
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {liveAlerts.totalCount === 0 ? (
                    <div className="p-6 text-center text-slate-400">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                      <div className="font-semibold text-slate-700 dark:text-slate-200">All clear!</div>
                      <div className="text-[11px]">No pending stock alerts or return requests.</div>
                    </div>
                  ) : (
                    <>
                      {liveAlerts.pendingReturns.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsNotifOpen(false);
                            setActiveTab('credit-note');
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-rose-50/70 dark:hover:bg-rose-950/30 flex items-start gap-3 transition-colors cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                            <RotateCcw className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-100">
                              {liveAlerts.pendingReturns.length} Pending Return Request(s)
                            </div>
                            <div className="text-[11px] text-slate-500">Click to review & approve refunds</div>
                          </div>
                        </button>
                      )}
                      {liveAlerts.pendingOnlineOrders.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsNotifOpen(false);
                            setActiveTab('sale-order');
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-blue-50/70 dark:hover:bg-blue-950/30 flex items-start gap-3 transition-colors cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <ShoppingBag className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-100">
                              {liveAlerts.pendingOnlineOrders.length} Active Sales Order(s)
                            </div>
                            <div className="text-[11px] text-slate-500">Click to pack & dispatch orders</div>
                          </div>
                        </button>
                      )}
                      {liveAlerts.lowStock.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsNotifOpen(false);
                            setActiveTab('stock-aging');
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-amber-50/70 dark:hover:bg-amber-950/30 flex items-start gap-3 transition-colors cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-100">
                              {liveAlerts.lowStock.length} Low-Stock Product(s)
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {liveAlerts.lowStock.slice(0, 2).map((i) => i.name).join(', ')}
                              {liveAlerts.lowStock.length > 2 ? '…' : ''}
                            </div>
                          </div>
                        </button>
                      )}
                      {liveAlerts.overdueInvoices.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsNotifOpen(false);
                            setActiveTab('udhar-khata');
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-rose-50/70 dark:hover:bg-rose-950/30 flex items-start gap-3 transition-colors cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-100">
                              {liveAlerts.overdueInvoices.length} Overdue Invoice(s)
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Open Udhaar Khata to collect or send reminders
                            </div>
                          </div>
                        </button>
                      )}
                      {liveAlerts.expiringBatches.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsNotifOpen(false);
                            setActiveTab('erp-inventory');
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-amber-50/70 dark:hover:bg-amber-950/30 flex items-start gap-3 transition-colors cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-100">
                              {liveAlerts.expiringBatches.length} Batch(es) Expiring (&le;30d)
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Review expiry &amp; FEFO clearance in Batches
                            </div>
                          </div>
                        </button>
                      )}
                      {liveAlerts.dueServiceReminders.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsNotifOpen(false);
                            setActiveTab('crm-loyalty');
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-blue-50/70 dark:hover:bg-blue-950/30 flex items-start gap-3 transition-colors cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <CalendarClock className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-100">
                              {liveAlerts.dueServiceReminders.length} Service / CRM Follow-up(s) Due
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Open CRM &amp; Follow-ups to review &amp; complete
                            </div>
                          </div>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Screen Lock Trigger */}
          {onLockScreen && (
            <button
              type="button"
              onClick={onLockScreen}
              title="Lock Session Screen"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-900 dark:text-amber-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
              <span className="hidden lg:inline">Lock</span>
            </button>
          )}

          {/* User Switcher Pill */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {initials || 'AD'}
              </span>
              <span className="hidden lg:inline text-xs font-semibold text-slate-700 dark:text-slate-100 max-w-[160px] truncate">
                {userName} ({roleName})
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-xs">
                <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="font-bold text-slate-900 dark:text-white truncate">{userName}</div>
                  <div className="text-[11px] text-slate-500 truncate">{roleName}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setAuthModalTab('switch');
                    setIsAuthModalOpen(true);
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Switch User / Role</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setActiveTab('settings');
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                  <span>Settings & Store Admin</span>
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsLogoutModalOpen(true);
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-2 text-rose-700 dark:text-rose-400 font-semibold cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <button
            type="button"
            onClick={() => setIsLogoutModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] active:bg-[#5E0612] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Row 2: Breadcrumb + Search Bar + Full 13-Action Quick Add + User Avatar */}
      <div className="bg-[#f8fafc] dark:bg-slate-900/90 border-b border-slate-200/70 dark:border-slate-800 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Compact Context Breadcrumb */}
        <div className="hidden xl:flex items-center text-xs min-w-[180px]">
          <span className="font-bold text-slate-800 dark:text-slate-100">{main}</span>
          <span className="text-slate-400 font-normal ml-1.5">/ {sub}</span>
        </div>

        {/* Center: Search Pill with Ctrl+K Command Palette Button */}
        <div className="relative flex-1 min-w-[240px] max-w-md mx-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items, parties, invoices..."
            className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50/70 focus:bg-white dark:focus:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 pl-10 pr-20 py-2 rounded-full border border-slate-200 dark:border-slate-700 focus:border-[#8B0D1E] focus:outline-none transition-all placeholder:text-slate-400 shadow-2xs"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="text-[11px] text-slate-400 hover:text-slate-700 px-1 cursor-pointer"
              >
                ✕
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              title="Open Global Command Search (Ctrl+K)"
              className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-200 text-[10px] font-bold border border-slate-200 dark:border-slate-600 transition-colors cursor-pointer"
            >
              Ctrl+K
            </button>
          </div>
        </div>

        {/* Right: Scan Barcode + Global 13-Action + Quick Add Dropdown & Profile Badge */}
        <div className="flex items-center gap-2.5 ml-auto">
          <button
            type="button"
            onClick={() => openBarcodeScanner('lookup')}
            title="Scan Barcode (Camera / USB / Bluetooth)"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Barcode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Scan Barcode</span>
          </button>

          <div className="relative" ref={quickAddRef}>
            <button
              type="button"
              onClick={() => setIsQuickAddOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Quick Add</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            </button>

            {isQuickAddOpen && (
              <div className="absolute right-0 mt-2 w-64 max-h-[75vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-xs">
                <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Billing &amp; Orders
                </div>
                {[
                  {
                    label: 'New Sale',
                    icon: Receipt,
                    color: 'text-[#8B0D1E]',
                    onSelect: () => setIsAddSaleOpen(true),
                  },
                  {
                    label: 'New Purchase',
                    icon: ArrowDown,
                    color: 'text-blue-600',
                    onSelect: () => setIsAddPurchaseOpen(true),
                  },
                  {
                    label: 'New Estimate',
                    icon: FileText,
                    color: 'text-indigo-600',
                    onSelect: () => {
                      setActiveTab('estimate-quotation');
                      setActiveSaleSubtype('Estimate');
                    },
                  },
                  {
                    label: 'New Sales Order',
                    icon: ClipboardList,
                    color: 'text-amber-600',
                    onSelect: () => setActiveTab('sale-order'),
                  },
                  {
                    label: 'New Purchase Order',
                    icon: ClipboardList,
                    color: 'text-cyan-600',
                    onSelect: () => setActiveTab('purchase-order'),
                  },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => {
                        setIsQuickAddOpen(false);
                        action.onSelect();
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 text-slate-800 dark:text-slate-100 font-medium cursor-pointer"
                    >
                      <Icon className={`w-4 h-4 ${action.color}`} />
                      <span>{action.label}</span>
                    </button>
                  );
                })}

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Parties &amp; Inventory
                </div>
                {[
                  {
                    label: 'New Customer',
                    icon: Users,
                    color: 'text-amber-600',
                    onSelect: () => setIsAddPartyModalOpen(true),
                  },
                  {
                    label: 'New Supplier',
                    icon: Truck,
                    color: 'text-purple-600',
                    onSelect: () => {
                      setActiveTab('suppliers');
                      setIsAddPartyModalOpen(true);
                    },
                  },
                  {
                    label: 'New Item',
                    icon: Package,
                    color: 'text-emerald-600',
                    onSelect: () => setIsAddItemModalOpen(true),
                  },
                  {
                    label: 'Stock Adjustment',
                    icon: Wrench,
                    color: 'text-slate-600',
                    onSelect: () => setActiveTab('stock-adjustment'),
                  },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => {
                        setIsQuickAddOpen(false);
                        action.onSelect();
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 text-slate-800 dark:text-slate-100 font-medium cursor-pointer"
                    >
                      <Icon className={`w-4 h-4 ${action.color}`} />
                      <span>{action.label}</span>
                    </button>
                  );
                })}

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Payments &amp; Cashflow
                </div>
                {[
                  {
                    label: 'Receive Payment',
                    icon: ArrowDownLeft,
                    color: 'text-emerald-600',
                    onSelect: () => setActiveTab('payment-in'),
                  },
                  {
                    label: 'Make Payment',
                    icon: ArrowUpRight,
                    color: 'text-rose-600',
                    onSelect: () => setActiveTab('payment-out'),
                  },
                  {
                    label: 'New Expense',
                    icon: TrendingDown,
                    color: 'text-rose-600',
                    onSelect: () => setActiveTab('expenses'),
                  },
                  {
                    label: 'New Income',
                    icon: TrendingUp,
                    color: 'text-emerald-600',
                    onSelect: () => setActiveTab('other-income'),
                  },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => {
                        setIsQuickAddOpen(false);
                        action.onSelect();
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 text-slate-800 dark:text-slate-100 font-medium cursor-pointer"
                    >
                      <Icon className={`w-4 h-4 ${action.color}`} />
                      <span>{action.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#fce7e7] text-[#8B0D1E] border border-rose-200 flex items-center justify-center font-bold text-xs tracking-tight shrink-0">
              {initials || 'BM'}
            </div>
            <div className="text-left leading-tight hidden sm:block">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 max-w-[120px] truncate">{userName}</div>
              <div className="text-[11px] text-slate-400 truncate">{roleName}</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
