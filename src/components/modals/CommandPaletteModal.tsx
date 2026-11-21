import React, { useState } from 'react';
import {
  Search,
  FileText,
  Users,
  Package,
  ArrowRight,
  ShieldCheck,
  Truck,
  Receipt,
  ClipboardList,
  Wallet,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';

export const CommandPaletteModal: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    transactions,
    parties,
    items,
    employees,
    setActiveTab,
    setSelectedPartyId,
    setSelectedItemId,
    setIsAddSaleOpen,
    setIsAddPurchaseOpen,
    setIsAddPartyModalOpen,
    setIsAddItemModalOpen,
    setIsSettingsModalOpen,
    setIsAuthModalOpen,
    setAuthModalTab,
    setIsAddEmployeeModalOpen,
    setSelectedEmployee,
    setIsEmployeeDetailModalOpen,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    exportCurrentViewPdf,
    showToast,
  } = useVyapar();

  const [query, setQuery] = useState('');

  if (!isCommandPaletteOpen) return null;

  const q = query.trim().toLowerCase();

  const matchTx = (types: string[]) =>
    transactions.filter(
      (t) =>
        types.includes(t.type) &&
        (!q ||
          t.invoiceNo.toLowerCase().includes(q) ||
          t.partyName.toLowerCase().includes(q) ||
          t.type.toLowerCase().includes(q) ||
          (t.status || '').toLowerCase().includes(q))
    );

  const customers = parties.filter(
    (p) =>
      p.type !== 'Supplier' &&
      (!q || p.name.toLowerCase().includes(q) || (p.phone || '').includes(q))
  );
  const suppliers = parties.filter(
    (p) =>
      p.type === 'Supplier' &&
      (!q || p.name.toLowerCase().includes(q) || (p.phone || '').includes(q))
  );
  const filteredItems = items.filter(
    (i) =>
      !q ||
      i.name.toLowerCase().includes(q) ||
      (i.code || '').toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q)
  );
  const salesList = matchTx(['Sale']);
  const purchasesList = matchTx(['Purchase']);
  const estimatesList = matchTx(['Estimate', 'Proforma']);
  const ordersList = matchTx(['Sale Order', 'Delivery Challan']);
  const paymentsList = matchTx(['Payment-In']);
  const expensesList = matchTx(['Expense']);
  const incomeList = matchTx(['Other Income']);

  const filteredEmployees = employees.filter(
    (e) =>
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.employeeId.toLowerCase().includes(q) ||
      e.designation.toLowerCase().includes(q) ||
      e.roleName.toLowerCase().includes(q)
  );

  const allQuickActions = [
    {
      title: 'New Sale Invoice',
      subtitle: 'Create a GST invoice for a customer (Ctrl+N)',
      action: () => {
        setIsCommandPaletteOpen(false);
        setIsAddSaleOpen(true);
      },
    },
    {
      title: 'Record Purchase Bill',
      subtitle: 'Add vendor bill and stock inward',
      action: () => {
        setIsCommandPaletteOpen(false);
        setIsAddPurchaseOpen(true);
      },
    },
    {
      title: 'CRM, Loyalty & Coupons',
      subtitle: 'RFM segments, MS Loyalty credits, coupons, WhatsApp campaigns & feedback',
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveTab('crm-loyalty');
      },
    },
    {
      title: 'Cash, Bank Accounts & Cheques',
      subtitle: 'Multiple bank accounts, cheque register & cash flow statement',
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveTab('cash-bank');
      },
    },
    {
      title: 'Double-Entry Accounting & P&L',
      subtitle: 'Chart of Accounts, Journal Vouchers, Contra, Trial Balance & Aging',
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveTab('erp-accounting');
      },
    },
    {
      title: 'Warehouses, Godowns & Reorder Planner',
      subtitle: 'Multi-godown valuation, rack/bin locations & low-stock POs',
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveTab('warehouses');
      },
    },
    {
      title: 'Stock Transfer Between Godowns',
      subtitle: 'Move inventory across warehouses cleanly',
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveTab('stock-transfer');
      },
    },
    {
      title: 'Smart Inventory & Expiry Control',
      subtitle: 'Min/Max thresholds, expiring stock, damaged stock & customer returns',
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveTab('smart-inventory');
      },
    },
    {
      title: 'Batches, Serials, Variants & Bundles',
      subtitle: 'Expiry dates, SKU variants, IMEI warranties, combo bundles & Price History',
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveTab('erp-inventory');
      },
    },
    {
      title: 'Barcode Studio & Label Printing',
      subtitle: 'Generate, customize & print product barcode labels',
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveTab('barcode-studio');
      },
    },
    {
      title: 'Udhaar Khata (Customer Credit Ledger)',
      subtitle: 'Collect due balances & send WhatsApp payment reminders',
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveTab('udhar-khata');
      },
    },
    {
      title: 'Categories & Measurement Units',
      subtitle: 'Manage product categories, unit conversions & HS/SAC grouping',
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveTab('categories');
      },
    },
    {
      title: 'Online Orders & Storefront Admin',
      subtitle: 'Approve, pack, dispatch & verify delivery OTPs',
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveTab('online-orders');
      },
    },
    {
      title: 'Profit & Loss Analytics',
      subtitle: 'Gross vs Net Profit, COGS & GST summary dashboard',
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveTab('profit-loss');
      },
    },
    {
      title: 'AI Business Assistant',
      subtitle: 'Grounded insights & confirmed store actions',
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveTab('ai-assistant');
      },
    },
    {
      title: 'Recycle Bin, Recurring & Targets',
      subtitle: 'Restore deleted records, schedule recurring bills, targets or CSV import',
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveTab('erp-tools');
      },
    },
    {
      title: 'Audit Trail & Stock History',
      subtitle: 'Inspect user actions, data changes & stock logs',
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveTab('audit-log');
      },
    },
    {
      title: 'Add New Party (Customer / Supplier)',
      subtitle: 'Create customer or supplier ledger with GSTIN',
      action: () => {
        setIsCommandPaletteOpen(false);
        setIsAddPartyModalOpen(true);
      },
    },
    {
      title: 'Add New Inventory Item',
      subtitle: 'Add product, stock and price',
      action: () => {
        setIsCommandPaletteOpen(false);
        setIsAddItemModalOpen(true);
      },
    },
    {
      title: 'Staff, Roles & Security Hub',
      subtitle: 'Manage RBAC permissions, staff directory & commission payouts',
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveTab('staff-management');
      },
    },
    {
      title: 'Add New Employee',
      subtitle: 'Create employee profile with ID, department and role',
      action: () => {
        setIsCommandPaletteOpen(false);
        setSelectedEmployee(null);
        setIsAddEmployeeModalOpen(true);
      },
    },
    {
      title: 'Switch User / Login',
      subtitle: 'Switch between Owner, Manager, Cashier, Accountant etc.',
      action: () => {
        setIsCommandPaletteOpen(false);
        setAuthModalTab('switch');
        setIsAuthModalOpen(true);
      },
    },
    {
      title: 'Complete Settings Hub',
      subtitle: 'General, Transaction, Print, GST, Messages, Party, Item & Accounting',
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveTab('settings');
      },
    },
    {
      title: 'Invoice & Print Quick Modal',
      subtitle: 'Configure prefix, taxes and print',
      action: () => {
        setIsCommandPaletteOpen(false);
        setIsSettingsModalOpen(true);
      },
    },
    {
      title: 'Export Current View as PDF (Ctrl+P)',
      subtitle: 'Download official PDF for printing and record-keeping',
      action: () => {
        setIsCommandPaletteOpen(false);
        exportCurrentViewPdf();
      },
    },
  ];

  const quickActions = allQuickActions.filter(
    (qa) =>
      !q ||
      qa.title.toLowerCase().includes(q) ||
      qa.subtitle.toLowerCase().includes(q)
  );

  const txGroups = [
    { label: 'Sales', list: salesList, icon: Receipt, color: 'text-rose-500', tab: 'sale-invoices' },
    { label: 'Purchases', list: purchasesList, icon: FileText, color: 'text-blue-500', tab: 'purchase' },
    { label: 'Estimates', list: estimatesList, icon: FileText, color: 'text-indigo-500', tab: 'estimate-quotation' },
    { label: 'Orders', list: ordersList, icon: ClipboardList, color: 'text-amber-500', tab: 'sale-order' },
    { label: 'Payments', list: paymentsList, icon: Wallet, color: 'text-emerald-500', tab: 'payment-in' },
    { label: 'Expenses', list: expensesList, icon: TrendingDown, color: 'text-rose-600', tab: 'expenses' },
    { label: 'Income', list: incomeList, icon: TrendingUp, color: 'text-emerald-600', tab: 'other-income' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-start justify-center pt-16 p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-300 dark:border-slate-700 w-full max-w-2xl flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-100">
        {/* Search Input Box */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50 dark:bg-slate-950">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Global Search across Customers, Suppliers, Items, Sales, Purchases, Estimates, Orders, Payments, Expenses & Income..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(false)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
          >
            Esc
          </button>
        </div>

        {/* Shortcut Bar */}
        <div className="px-3 py-1.5 bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
          <span><strong>Ctrl+K</strong> Search</span>
          <span><strong>Ctrl+N</strong> New Sale</span>
          <span><strong>Ctrl+P</strong> Print</span>
          <span><strong>Alt+1..5</strong> Switch Modules</span>
          <span><strong>Esc</strong> Close</span>
        </div>

        {/* Results List */}
        <div className="max-h-[420px] overflow-y-auto p-2.5 space-y-3">
          {/* Quick Actions */}
          {quickActions.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                Quick Actions &amp; ERP Modules
              </div>
              <div className="space-y-0.5">
                {quickActions.slice(0, q ? 6 : 4).map((qa, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={qa.action}
                    className="w-full px-3 py-2 rounded-lg text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 flex items-center justify-between group transition-colors cursor-pointer"
                  >
                    <div>
                      <span className="font-semibold block">{qa.title}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {qa.subtitle}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-rose-600 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Customers */}
          {customers.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                Customers ({customers.length})
              </div>
              <div className="space-y-0.5">
                {customers.slice(0, 4).map((party) => (
                  <button
                    key={party.id}
                    type="button"
                    onClick={() => {
                      setIsCommandPaletteOpen(false);
                      setSelectedPartyId(party.id);
                      setActiveTab('customers');
                      showToast(`Opened customer ${party.name}`);
                    }}
                    className="w-full px-3 py-1.5 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[9px] font-bold">
                        Customer
                      </span>
                      <span className="font-semibold truncate">{party.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{party.phone}</span>
                    </div>
                    <span className="font-bold tabular-nums">₹{(party.balance || 0).toLocaleString('en-IN')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Suppliers */}
          {suppliers.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                Suppliers ({suppliers.length})
              </div>
              <div className="space-y-0.5">
                {suppliers.slice(0, 4).map((sup) => (
                  <button
                    key={sup.id}
                    type="button"
                    onClick={() => {
                      setIsCommandPaletteOpen(false);
                      setSelectedPartyId(sup.id);
                      setActiveTab('suppliers');
                      showToast(`Opened supplier ${sup.name}`);
                    }}
                    className="w-full px-3 py-1.5 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Truck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold">
                        Supplier
                      </span>
                      <span className="font-semibold truncate">{sup.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{sup.phone}</span>
                    </div>
                    <span className="font-bold tabular-nums">₹{(sup.balance || 0).toLocaleString('en-IN')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          {filteredItems.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                Items ({filteredItems.length})
              </div>
              <div className="space-y-0.5">
                {filteredItems.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setIsCommandPaletteOpen(false);
                      setSelectedItemId(item.id);
                      setActiveTab('items');
                      showToast(`Opened item ${item.name}`);
                    }}
                    className="w-full px-3 py-1.5 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold">
                        Item
                      </span>
                      <span className="font-semibold truncate">{item.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{item.code}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 tabular-nums">
                      <span className="text-[10px] text-slate-500">Stock: {item.stock} {item.unit}</span>
                      <span className="font-bold">₹{item.salePrice.toLocaleString('en-IN')}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Transactions across Sales, Purchases, Estimates, Orders, Payments, Expenses, Income */}
          {txGroups.map((grp) => {
            if (grp.list.length === 0) return null;
            const Icon = grp.icon;
            return (
              <div key={grp.label}>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                  {grp.label} ({grp.list.length})
                </div>
                <div className="space-y-0.5">
                  {grp.list.slice(0, 4).map((tx) => (
                    <button
                      key={tx.id}
                      type="button"
                      onClick={() => {
                        setIsCommandPaletteOpen(false);
                        setSelectedInvoice(tx);
                        setIsInvoicePreviewOpen(true);
                      }}
                      className="w-full px-3 py-1.5 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className={`w-3.5 h-3.5 ${grp.color} shrink-0`} />
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-bold">
                          {tx.type}
                        </span>
                        <span className="font-semibold truncate">
                          #{tx.invoiceNo} &bull; {tx.partyName}
                        </span>
                        <span className="text-[10px] text-slate-400 hidden sm:inline">{tx.date}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold">
                          {tx.status}
                        </span>
                        <span className="font-bold tabular-nums">
                          ₹{tx.totalAmount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Matching Employees */}
          {filteredEmployees.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                Staff &amp; Employees ({filteredEmployees.length})
              </div>
              <div className="space-y-0.5">
                {filteredEmployees.slice(0, 3).map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      setIsCommandPaletteOpen(false);
                      setSelectedEmployee(emp);
                      setIsEmployeeDetailModalOpen(true);
                    }}
                    className="w-full px-3 py-1.5 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                      <span className="font-medium">{emp.name}</span>
                      <span className="text-[10px] text-slate-400">({emp.employeeId} &bull; {emp.designation})</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                      {emp.roleName}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
