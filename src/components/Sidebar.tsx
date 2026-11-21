import React, { useState } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Monitor,
  Package,
  ShoppingBag,
  Layers,
  Wrench,
  BookOpen,
  Wallet,
  Landmark,
  TrendingDown,
  TrendingUp,
  Users,
  Truck,
  BarChart3,
  Settings,
  Lock,
  FileText,
  FileCheck,
  ClipboardList,
  RotateCcw,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronRight,
  Globe,
  LogOut,
  Barcode,
  ScanLine,
  FileCheck2,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Crown,
  Building2,
  ArrowLeftRight,
  Tag,
  Ruler,
  History,
  UserCog,
  Cpu,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activeMatch: (tab: string) => boolean;
  badge?: string | number;
  badgeVariant?: 'pro' | 'count';
  showChevron?: boolean;
  onClick: () => void;
}

interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

interface TooltipState {
  label: string;
  locked: boolean;
  badge?: string | number;
  top: number;
}

const SETTINGS_HOSTED_TABS = new Set(['settings', 'settings-hub']);

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    setActiveSaleSubtype,
    transactions,
    items,
    parties,
    canAccessFeature,
    checkFeatureAccess,
    sidebarCollapsed,
    setSidebarCollapsed,
    expandedSidebarGroups,
    toggleSidebarGroup,
    serverSyncStatus,
    syncNowWithServer,
    setIsLogoutModalOpen,
  } = useVyapar();

  const [hoveredTooltip, setHoveredTooltip] = useState<TooltipState | null>(null);

  const productsCount = items.length;
  const customersCount = parties.filter((p) => p.type === 'Customer' || !p.type).length;
  const pendingOnlineCount = transactions.filter(
    (t) =>
      t.type === 'Sale Order' &&
      (t.source === 'ONLINE_STORE' || Boolean(t.onlineOrderId)) &&
      !t.isCancelled &&
      t.orderWorkflowStatus !== 'Delivered' &&
      t.orderWorkflowStatus !== 'Cancelled'
  ).length;
  const lowStockCount = items.filter((i) => (i.stock || 0) <= (i.minStockAlert ?? 5)).length;

  const navigate = (featureKey: string, featureLabel: string, tabId: string, saleSubtype?: string) => {
    if (checkFeatureAccess(featureKey, featureLabel)) {
      setActiveTab(tabId);
      if (saleSubtype) {
        setActiveSaleSubtype(saleSubtype);
      }
    }
  };

  const navGroups: SidebarGroup[] = [
    {
      title: 'CORE ERP',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          activeMatch: (tab) => tab === 'dashboard' || tab === 'home',
          onClick: () => navigate('dashboard', 'Dashboard', 'dashboard'),
        },
        {
          id: 'pos',
          label: 'Billing / POS',
          icon: Monitor,
          activeMatch: (tab) => tab === 'pos' || tab === 'vyapar-pos' || tab === 'billing' || tab === 'sale-invoices',
          badge: 'POS',
          badgeVariant: 'pro',
          onClick: () => navigate('pos', 'Billing / POS', 'pos'),
        },
        {
          id: 'products',
          label: 'Products',
          icon: Package,
          activeMatch: (tab) => tab === 'products' || tab === 'items',
          badge: productsCount,
          badgeVariant: 'count',
          onClick: () => navigate('products', 'Products', 'items'),
        },
        {
          id: 'smart-inventory',
          label: 'Smart Inventory',
          icon: Layers,
          activeMatch: (tab) => tab === 'smart-inventory' || tab === 'stock-management' || tab === 'stock-summary' || tab === 'stock',
          badge: lowStockCount > 0 ? lowStockCount : undefined,
          badgeVariant: 'count',
          onClick: () => navigate('smart-inventory', 'Smart Inventory', 'smart-inventory'),
        },
        {
          id: 'barcode-studio',
          label: 'Barcode Scanner',
          icon: Barcode,
          activeMatch: (tab) => tab === 'barcode-studio',
          onClick: () => navigate('barcode-studio', 'Barcode Scanner & Labels', 'barcode-studio'),
        },
        {
          id: 'purchases',
          label: 'Purchase Management',
          icon: ShoppingBag,
          activeMatch: (tab) => tab === 'purchases' || tab === 'purchase' || tab === 'purchase-bills',
          onClick: () => navigate('purchases', 'Purchase Management', 'purchase'),
        },
        {
          id: 'suppliers',
          label: 'Suppliers',
          icon: Truck,
          activeMatch: (tab) => tab === 'suppliers',
          onClick: () => navigate('suppliers', 'Suppliers', 'suppliers'),
        },
        {
          id: 'customers',
          label: 'Customers',
          icon: Users,
          activeMatch: (tab) => tab === 'customers' || tab === 'customer-ledger' || tab === 'parties',
          badge: customersCount,
          badgeVariant: 'count',
          onClick: () => navigate('customers', 'Customers', 'customers'),
        },
        {
          id: 'udhar-khata',
          label: 'Udhaar Khata',
          icon: BookOpen,
          activeMatch: (tab) => tab === 'udhar-khata',
          onClick: () => navigate('udhar-khata', 'Udhaar Khata', 'udhar-khata'),
        },
        {
          id: 'crm-loyalty',
          label: 'CRM, Loyalty & Coupons',
          icon: Crown,
          activeMatch: (tab) => tab === 'crm-loyalty',
          onClick: () => navigate('crm-loyalty', 'CRM, Loyalty & Coupons', 'crm-loyalty'),
        },
        {
          id: 'online-orders',
          label: 'Online Orders',
          icon: Globe,
          activeMatch: (tab) => tab === 'online-orders',
          badge: pendingOnlineCount > 0 ? pendingOnlineCount : undefined,
          badgeVariant: 'count',
          onClick: () => navigate('online-orders', 'Online Orders & Storefront', 'online-orders'),
        },
        {
          id: 'expenses',
          label: 'Expenses',
          icon: TrendingDown,
          activeMatch: (tab) => tab === 'expenses' || tab === 'expense',
          onClick: () => navigate('expenses', 'Expenses', 'expenses'),
        },
        {
          id: 'profit-loss',
          label: 'Profit & Loss',
          icon: TrendingUp,
          activeMatch: (tab) => tab === 'profit-loss',
          onClick: () => navigate('profit-loss', 'Profit & Loss Dashboard', 'profit-loss'),
        },
        {
          id: 'reports',
          label: 'Reports',
          icon: BarChart3,
          activeMatch: (tab) => tab === 'reports',
          onClick: () => navigate('reports', 'Reports', 'reports'),
        },
        {
          id: 'ai-assistant',
          label: 'AI Assistant',
          icon: Sparkles,
          activeMatch: (tab) => tab === 'ai-assistant',
          badge: 'AI',
          badgeVariant: 'pro',
          onClick: () => navigate('ai-assistant', 'AI Business Assistant', 'ai-assistant'),
        },
        {
          id: 'staff-management',
          label: 'Staff Management',
          icon: UserCheck,
          activeMatch: (tab) => tab === 'staff-management',
          onClick: () => navigate('settings', 'Staff Management', 'staff-management'),
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: Settings,
          activeMatch: (tab) => SETTINGS_HOSTED_TABS.has(tab),
          onClick: () => navigate('settings', 'Settings', 'settings'),
        },
      ],
    },
    {
      title: 'MORE GST & ERP TOOLS',
      items: [
        {
          id: 'billing-invoices',
          label: 'Sale Invoices',
          icon: Receipt,
          activeMatch: (tab) => tab === 'sale-invoices',
          onClick: () => navigate('billing', 'Sale Invoices', 'sale-invoices', 'Sale Invoices'),
        },
        {
          id: 'purchase-scanner',
          label: 'AI Purchase Scanner',
          icon: ScanLine,
          activeMatch: (tab) => tab === 'purchase-scanner',
          onClick: () => navigate('purchase-scanner', 'AI Purchase Bill Scanner', 'purchase-scanner'),
        },
        {
          id: 'estimate-quotation',
          label: 'Estimate / Quotation',
          icon: FileText,
          activeMatch: (tab) => tab === 'estimate-quotation',
          onClick: () => navigate('estimate-quotation', 'Estimate / Quotation', 'estimate-quotation'),
        },
        {
          id: 'proforma-invoice',
          label: 'Proforma Invoice',
          icon: FileCheck,
          activeMatch: (tab) => tab === 'proforma-invoice',
          onClick: () => navigate('proforma-invoice', 'Proforma Invoice', 'proforma-invoice'),
        },
        {
          id: 'sale-order',
          label: 'Sales Orders',
          icon: ClipboardList,
          activeMatch: (tab) => tab === 'sale-order',
          onClick: () => navigate('sale-order', 'Sales Orders', 'sale-order'),
        },
        {
          id: 'purchase-order',
          label: 'Purchase Orders',
          icon: ClipboardList,
          activeMatch: (tab) => tab === 'purchase-order',
          onClick: () => navigate('purchase-order', 'Purchase Orders', 'purchase-order'),
        },
        {
          id: 'delivery-challan',
          label: 'Delivery Challan',
          icon: Truck,
          activeMatch: (tab) => tab === 'delivery-challan',
          onClick: () => navigate('delivery-challan', 'Delivery Challan', 'delivery-challan'),
        },
        {
          id: 'credit-note',
          label: 'Sales Return / Credit Note',
          icon: RotateCcw,
          activeMatch: (tab) => tab === 'credit-note' || tab === 'sale-return',
          onClick: () => navigate('credit-note', 'Sales Return / Credit Note', 'credit-note'),
        },
        {
          id: 'debit-note',
          label: 'Debit Note',
          icon: RotateCcw,
          activeMatch: (tab) => tab === 'debit-note' || tab === 'purchase-return',
          onClick: () => navigate('debit-note', 'Debit Note', 'debit-note'),
        },
        {
          id: 'e-invoice',
          label: 'E-Invoice & E-Way Bill',
          icon: FileCheck2,
          activeMatch: (tab) => tab === 'e-invoice',
          onClick: () => navigate('e-invoice', 'E-Invoice & E-Way Bill', 'e-invoice'),
        },
        {
          id: 'hsn-gst',
          label: 'HSN / SAC & GST Hub',
          icon: ShieldCheck,
          activeMatch: (tab) => tab === 'hsn-gst',
          onClick: () => navigate('hsn-gst', 'HSN / SAC & GST Hub', 'hsn-gst'),
        },
        {
          id: 'erp-inventory',
          label: 'Serials, Variants & Aging',
          icon: AlertTriangle,
          activeMatch: (tab) => tab === 'erp-inventory' || tab === 'stock-aging',
          onClick: () => navigate('stock-management', 'Serials, Variants & Aging', 'erp-inventory'),
        },
        {
          id: 'warehouses',
          label: 'Warehouses & Godowns',
          icon: Building2,
          activeMatch: (tab) => tab === 'warehouses',
          onClick: () => navigate('warehouses', 'Warehouses & Godowns', 'warehouses'),
        },
        {
          id: 'stock-transfer',
          label: 'Stock Transfer',
          icon: ArrowLeftRight,
          activeMatch: (tab) => tab === 'stock-transfer',
          onClick: () => navigate('stock-transfer', 'Stock Transfer', 'stock-transfer'),
        },
        {
          id: 'categories',
          label: 'Item Categories',
          icon: Tag,
          activeMatch: (tab) => tab === 'categories',
          onClick: () => navigate('categories', 'Item Categories', 'categories'),
        },
        {
          id: 'units',
          label: 'Measurement Units',
          icon: Ruler,
          activeMatch: (tab) => tab === 'units',
          onClick: () => navigate('units', 'Measurement Units', 'units'),
        },
        {
          id: 'stock-adjustment',
          label: 'Stock Adjustment',
          icon: Wrench,
          activeMatch: (tab) => tab === 'stock-adjustment',
          onClick: () => navigate('stock-adjustment', 'Stock Adjustment', 'stock-adjustment'),
        },
        {
          id: 'cash-bank',
          label: 'Cash, Bank & Cheques',
          icon: Wallet,
          activeMatch: (tab) => tab === 'cash-bank' || tab === 'cash-account' || tab === 'bank-accounts' || tab === 'accounting',
          onClick: () => navigate('cash-bank', 'Cash, Bank & Cheques', 'cash-bank'),
        },
        {
          id: 'erp-accounting',
          label: 'Double-Entry Accounting',
          icon: Landmark,
          activeMatch: (tab) => tab === 'erp-accounting' || tab === 'accounting-erp',
          onClick: () => navigate('accounting', 'Double-Entry Accounting', 'erp-accounting'),
        },
        {
          id: 'payment-in',
          label: 'Payment-In (Receipts)',
          icon: ArrowDownLeft,
          activeMatch: (tab) => tab === 'payment-in',
          onClick: () => navigate('payment-in', 'Payment-In (Receipts)', 'payment-in'),
        },
        {
          id: 'payment-out',
          label: 'Payment-Out (Payouts)',
          icon: ArrowUpRight,
          activeMatch: (tab) => tab === 'payment-out',
          onClick: () => navigate('payment-out', 'Payment-Out (Payouts)', 'payment-out'),
        },
        {
          id: 'other-income',
          label: 'Other Income',
          icon: Wallet,
          activeMatch: (tab) => tab === 'other-income' || tab === 'income',
          onClick: () => navigate('other-income', 'Other Income', 'other-income'),
        },
        {
          id: 'sale-fa',
          label: 'Fixed Assets',
          icon: Layers,
          activeMatch: (tab) => tab === 'sale-fa',
          onClick: () => navigate('sale-fa', 'Fixed Assets', 'sale-fa'),
        },
        {
          id: 'audit-log',
          label: 'Audit Trail & Logs',
          icon: History,
          activeMatch: (tab) => tab === 'audit-log' || tab === 'stock-history',
          onClick: () => navigate('audit-log', 'Audit Trail & Logs', 'audit-log'),
        },
        {
          id: 'customer-staff-portal',
          label: 'Customer & Staff Portal',
          icon: UserCog,
          activeMatch: (tab) => tab === 'customer-staff-portal',
          onClick: () => navigate('customer-staff-portal', 'Customer & Staff Portal', 'customer-staff-portal'),
        },
        {
          id: 'transaction-engine',
          label: 'Transaction & Numbering Engine',
          icon: Cpu,
          activeMatch: (tab) => tab === 'transaction-engine',
          badge: 'ERP',
          badgeVariant: 'pro',
          onClick: () => navigate('transaction-engine', 'Transaction & Numbering Engine', 'transaction-engine'),
        },
        {
          id: 'erp-tools',
          label: 'Recurring, Import & Recycle Bin',
          icon: RotateCcw,
          activeMatch: (tab) => tab === 'erp-tools' || tab === 'backup',
          onClick: () => navigate('settings', 'Recurring, Import & Recycle Bin', 'erp-tools'),
        },
      ],
    },
  ];

  const handleMouseEnterItem = (e: React.MouseEvent<HTMLButtonElement>, item: SidebarItem, locked: boolean) => {
    if (!sidebarCollapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredTooltip({
      label: item.label,
      locked,
      badge: item.badge,
      top: rect.top + rect.height / 2,
    });
  };

  return (
    <aside
      aria-label="Primary Sidebar Navigation"
      className={`${
        sidebarCollapsed ? 'w-[70px]' : 'w-60 md:w-64'
      } bg-gradient-to-b from-[#961123] via-[#840C1C] to-[#680714] text-white flex flex-col justify-between shrink-0 select-none z-20 shadow-2xl transition-all duration-200 ease-in-out relative overflow-hidden`}
    >
      {/* Decorative Crimson Curved Accents */}
      <svg
        viewBox="0 0 240 240"
        className="pointer-events-none absolute -bottom-8 -left-10 w-60 h-60 opacity-20 text-white"
        aria-hidden="true"
      >
        <path
          d="M0 140 C60 110, 120 175, 195 140 C220 128, 235 115, 240 105 L240 240 L0 240 Z"
          fill="currentColor"
        />
        <path
          d="M0 175 C70 145, 130 205, 220 170 L240 240 L0 240 Z"
          fill="currentColor"
          opacity="0.45"
        />
      </svg>

      {/* Top Brand Logo & Collapse Button */}
      <div
        className={`relative z-10 ${
          sidebarCollapsed ? 'px-2 py-3.5 flex-col gap-2.5' : 'px-4 py-4 justify-between'
        } flex items-center border-b border-white/10 shrink-0 transition-all duration-200`}
      >
        <button
          type="button"
          onClick={() => navigate('dashboard', 'Dashboard', 'dashboard')}
          className="flex items-center gap-3 min-w-0 text-left cursor-pointer group"
        >
          <div
            title="Business Manager 360"
            className="w-10 h-10 rounded-full bg-gradient-to-br from-[#EF233C] via-[#D90429] to-[#9B0D1F] ring-2 ring-white/25 flex items-center justify-center font-extrabold text-white text-[11px] tracking-tight shadow-lg shrink-0 group-hover:scale-105 transition-transform"
          >
            360
          </div>
          {!sidebarCollapsed && (
            <div className="leading-[1.15] truncate">
              <div className="font-bold text-[14px] text-white tracking-tight truncate">Business Manager</div>
              <div className="font-extrabold text-[14px] text-rose-100 tracking-tight">360</div>
            </div>
          )}
        </button>

        {sidebarCollapsed && (
          <button
            type="button"
            onClick={() => {
              setHoveredTooltip(null);
              setSidebarCollapsed(false);
            }}
            title="Expand Sidebar"
            aria-label="Expand Sidebar"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-rose-100 hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        {!sidebarCollapsed && (
          <button
            type="button"
            onClick={() => {
              setHoveredTooltip(null);
              setSidebarCollapsed(true);
            }}
            title="Collapse Sidebar"
            aria-label="Collapse Sidebar"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-rose-100 hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Scrollable Nav List */}
      <div
        onScroll={() => setHoveredTooltip(null)}
        className={`relative z-10 flex-1 overflow-y-auto overflow-x-hidden py-3 ${
          sidebarCollapsed ? 'px-2 space-y-2' : 'px-3 space-y-3.5'
        } no-scrollbar`}
      >
        {navGroups.map((group) => {
          const isGroupOpen =
            expandedSidebarGroups[group.title] ?? (group.title === 'CORE ERP');
          const visibleItems = sidebarCollapsed ? group.items : isGroupOpen ? group.items : [];

          return (
            <div key={group.title} className="space-y-1">
              {!sidebarCollapsed ? (
                <button
                  type="button"
                  onClick={() => toggleSidebarGroup(group.title)}
                  aria-expanded={isGroupOpen}
                  className="w-full flex items-center justify-between px-2.5 py-1 rounded text-[10px] font-bold text-rose-200/75 hover:text-white uppercase tracking-[0.09em] transition-colors cursor-pointer"
                >
                  <span className="truncate">{group.title}</span>
                  {isGroupOpen ? (
                    <ChevronDown className="w-3 h-3 shrink-0 opacity-70" />
                  ) : (
                    <ChevronRight className="w-3 h-3 shrink-0 opacity-70" />
                  )}
                </button>
              ) : (
                <div className="border-t border-white/10 mx-2 my-1 first:hidden" />
              )}

              {visibleItems.map((item) => {
                const isActive = item.activeMatch(activeTab);
                const Icon = item.icon;
                const locked = !canAccessFeature(item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    onMouseEnter={(e) => handleMouseEnterItem(e, item, locked)}
                    onMouseLeave={() => setHoveredTooltip(null)}
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-label={item.label}
                    className={`w-full flex items-center ${
                      sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'justify-between px-3 py-2'
                    } rounded-xl text-[12.5px] font-medium text-left transition-all cursor-pointer relative ${
                      isActive
                        ? 'bg-[#C41E3A] text-white font-semibold shadow-md ring-1 ring-white/15'
                        : locked
                        ? 'text-rose-100/50 hover:text-rose-100/80 hover:bg-white/5'
                        : 'text-rose-100/90 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2.5 truncate'}`}>
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-white' : locked ? 'text-rose-300/50' : 'text-rose-200/90'
                        }`}
                      />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!sidebarCollapsed && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.badge !== undefined && !locked && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold leading-none ${
                              item.badgeVariant === 'pro'
                                ? 'bg-emerald-500 text-white shadow-xs tracking-wide'
                                : isActive
                                ? 'bg-white/25 text-white font-mono tabular-nums'
                                : 'bg-white/12 text-rose-100 font-mono tabular-nums'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                        {item.showChevron && !locked && (
                          <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-rose-200/60'}`} />
                        )}
                        {locked && <Lock className="w-3.5 h-3.5 text-rose-300/80" />}
                      </div>
                    )}

                    {sidebarCollapsed && locked && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-300/75" />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Bottom Footer: Logout + Live Sync */}
      <div
        className={`relative z-10 px-3 py-3 border-t border-white/15 bg-[#5F0712]/80 backdrop-blur-xs shrink-0 text-xs flex items-center ${
          sidebarCollapsed ? 'flex-col gap-2 justify-center' : 'justify-between'
        }`}
      >
        <button
          type="button"
          onClick={() => setIsLogoutModalOpen(true)}
          title="Logout"
          className={`flex items-center gap-2 text-rose-100 hover:text-white font-semibold transition-colors cursor-pointer ${
            sidebarCollapsed ? 'p-1.5 rounded-lg hover:bg-white/10' : 'px-1.5 py-1 rounded-lg hover:bg-white/10'
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!sidebarCollapsed && <span>Logout</span>}
        </button>

        <button
          type="button"
          onClick={() => {
            void syncNowWithServer();
          }}
          title={
            serverSyncStatus === 'online'
              ? 'Online Connected — Click to sync now'
              : serverSyncStatus === 'syncing'
              ? 'Synchronizing with Online Server...'
              : 'Reconnecting to Online Server...'
          }
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-semibold text-rose-100 transition-colors cursor-pointer"
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              serverSyncStatus === 'reconnecting' ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
          />
          {!sidebarCollapsed && (
            <span className="flex items-center gap-1">
              <Globe className="w-2.5 h-2.5" />
              <span>
                {serverSyncStatus === 'syncing'
                  ? 'Syncing'
                  : serverSyncStatus === 'reconnecting'
                  ? 'Retry'
                  : 'Online'}
              </span>
            </span>
          )}
        </button>
      </div>

      {/* Fixed Hover Tooltip Portal for Collapsed Icon Mode */}
      {sidebarCollapsed && hoveredTooltip && (
        <div
          style={{ top: hoveredTooltip.top }}
          className="fixed left-[76px] -translate-y-1/2 z-50 pointer-events-none bg-slate-900 text-white px-2.5 py-1.5 rounded-lg shadow-xl border border-slate-700 text-xs font-semibold whitespace-nowrap flex items-center gap-2"
        >
          <span>{hoveredTooltip.label}</span>
          {hoveredTooltip.badge !== undefined && !hoveredTooltip.locked && (
            <span className="px-1.5 py-0.5 rounded bg-white/15 text-[10px] font-mono text-emerald-300">
              {hoveredTooltip.badge}
            </span>
          )}
          {hoveredTooltip.locked && <Lock className="w-3 h-3 text-rose-300" />}
        </div>
      )}
    </aside>
  );
};
