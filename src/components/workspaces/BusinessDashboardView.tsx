import React, { useMemo, useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Wallet,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  AlertTriangle,
  PackageX,
  Plus,
  Target,
  BellRing,
  Send,
  CheckCircle2,
  SlidersHorizontal,
  Edit3,
  Eye,
  FileText,
  Users,
  Truck,
  Boxes,
  BarChart3,
  X,
  Receipt,
  Calendar,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { safeGetStoredData, safeSetStoredData } from '../../utils/storage';
import {
  computeDashboardMetrics,
  DashboardPeriod,
  DashboardTargets,
  PendingInvoiceEntry,
} from '../../utils/dashboardAnalytics';
import { DashboardChartsWidget } from './DashboardChartsWidget';
import {
  DashboardCustomizer,
  DashboardLayoutState,
  DashboardWidgetId,
  getDefaultLayoutForRole,
} from './DashboardCustomizer';

interface BusinessDashboardViewProps {
  role: 'owner' | 'manager';
  headerSection: React.ReactNode;
  roleOperationsWidget: React.ReactNode;
  onNavigateClassic?: (tab: string) => void;
}

interface ReminderRecord {
  sentAt: string;
  channel: 'WhatsApp' | 'SMS' | 'Email';
}

const PERIOD_OPTIONS: DashboardPeriod[] = [
  'Today',
  'This Week',
  'This Month',
  'This Quarter',
  'This Year',
  'All Time',
];

const DEFAULT_TARGETS: DashboardTargets = {
  salesTarget: 25000,
  purchaseTarget: 15000,
  profitTarget: 7500,
};

export const BusinessDashboardView: React.FC<BusinessDashboardViewProps> = ({
  role,
  headerSection,
  roleOperationsWidget,
  onNavigateClassic,
}) => {
  const {
    transactions,
    parties,
    items,
    settings,
    addTransaction,
    setIsAddSaleOpen,
    setIsAddPurchaseOpen,
    setIsAddPartyModalOpen,
    setIsAddItemModalOpen,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    showToast,
  } = useVyapar();

  const currency = settings.currencySymbol || '₹';
  const fmt = (val: number) =>
    `${currency}${Math.round(val).toLocaleString('en-IN')}`;

  // Period filter
  const [period, setPeriod] = useState<DashboardPeriod>('This Year');

  // Persisted Layout Customization
  const layoutStorageKey = `vyapar_dashboard_layout_${role}`;
  const [layout, setLayout] = useState<DashboardLayoutState>(() =>
    safeGetStoredData<DashboardLayoutState>(
      layoutStorageKey,
      getDefaultLayoutForRole(role),
      (v) =>
        Boolean(
          v &&
            typeof v === 'object' &&
            Array.isArray((v as DashboardLayoutState).order) &&
            (v as DashboardLayoutState).order.length > 0 &&
            Array.isArray((v as DashboardLayoutState).hidden)
        )
    )
  );
  useEffect(() => {
    safeSetStoredData(layoutStorageKey, layout);
  }, [layout, layoutStorageKey]);

  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  // Persisted Targets
  const targetStorageKey = `vyapar_dashboard_targets_${role}`;
  const [targets, setTargets] = useState<DashboardTargets>(() =>
    safeGetStoredData<DashboardTargets>(
      targetStorageKey,
      DEFAULT_TARGETS,
      (v) => Boolean(v && typeof v === 'object' && typeof (v as DashboardTargets).salesTarget === 'number')
    )
  );
  useEffect(() => {
    safeSetStoredData(targetStorageKey, targets);
  }, [targets, targetStorageKey]);

  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [draftTargets, setDraftTargets] = useState<DashboardTargets>(targets);

  // Persisted Payment Reminder Dispatch History
  const reminderStorageKey = `vyapar_payment_reminders_${role}`;
  const [reminderHistory, setReminderHistory] = useState<Record<string, ReminderRecord>>(() =>
    safeGetStoredData<Record<string, ReminderRecord>>(reminderStorageKey, {})
  );
  useEffect(() => {
    safeSetStoredData(reminderStorageKey, reminderHistory);
  }, [reminderHistory, reminderStorageKey]);

  // Collections filter tab
  const [collectionTab, setCollectionTab] = useState<'all_pending' | 'overdue'>('overdue');
  // Recent transactions filter
  const [txTypeFilter, setTxTypeFilter] = useState<'All' | 'Sale' | 'Purchase' | 'Expense' | 'Other Income'>('All');

  // Inline Quick Entry modal for Expense / Income
  const [quickEntryMode, setQuickEntryMode] = useState<'Expense' | 'Other Income' | null>(null);
  const [quickCategory, setQuickCategory] = useState('Rent');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickPayMode, setQuickPayMode] = useState<'Cash' | 'UPI' | 'Bank Transfer'>('Cash');
  const [quickNotes, setQuickNotes] = useState('');

  // Compute all 40 metrics live
  const metrics = useMemo(
    () =>
      computeDashboardMetrics({
        transactions,
        parties,
        items,
        period,
        targets,
      }),
    [transactions, parties, items, period, targets]
  );

  const handleSaveTargets = (e: React.FormEvent) => {
    e.preventDefault();
    const next: DashboardTargets = {
      salesTarget: Math.max(0, Number(draftTargets.salesTarget) || 0),
      purchaseTarget: Math.max(0, Number(draftTargets.purchaseTarget) || 0),
      profitTarget: Math.max(0, Number(draftTargets.profitTarget) || 0),
    };
    setTargets(next);
    setIsTargetModalOpen(false);
    showToast('Business targets updated and achievement % recalculated.');
  };

  const handleSendReminder = (entry: PendingInvoiceEntry, channel: 'WhatsApp' | 'SMS' | 'Email') => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setReminderHistory((prev) => ({
      ...prev,
      [entry.id]: { sentAt: timestamp, channel },
    }));
    showToast(
      `Payment reminder sent via ${channel} to ${entry.partyName} for #${entry.invoiceNo} (${fmt(entry.balance)})`
    );
  };

  const handleRemindAllOverdue = () => {
    if (metrics.overdueInvoices.length === 0) {
      showToast('No overdue invoices require reminders.');
      return;
    }
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updates: Record<string, ReminderRecord> = {};
    for (const inv of metrics.overdueInvoices) {
      updates[inv.id] = { sentAt: timestamp, channel: 'WhatsApp' };
    }
    setReminderHistory((prev) => ({ ...prev, ...updates }));
    showToast(`Dispatched ${metrics.overdueInvoices.length} overdue payment reminders via WhatsApp.`);
  };

  const handleQuickEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickEntryMode) return;
    const amt = parseFloat(quickAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid positive amount.');
      return;
    }
    const isExpense = quickEntryMode === 'Expense';
    const prefix = isExpense ? 'EXP' : 'INC';
    const todayStr = new Date().toLocaleDateString('en-GB');
    addTransaction({
      type: quickEntryMode,
      invoiceNo: `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: `${todayStr}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      partyName: quickCategory,
      firm: 'MY STORE',
      user: role === 'owner' ? 'Owner Console' : 'Store Manager',
      paymentType: quickPayMode,
      totalAmount: amt,
      receivedAmount: isExpense ? 0 : amt,
      balance: 0,
      dueDate: todayStr,
      status: 'Paid',
      items: [
        {
          id: `${prefix.toLowerCase()}-1`,
          name: `${quickEntryMode}: ${quickCategory}`,
          hsn: '9983',
          qty: 1,
          unit: 'NOS',
          price: amt,
          discountPercent: 0,
          taxPercent: 0,
          amount: amt,
        },
      ],
      notes: quickNotes || `${quickCategory} recorded from ${role} dashboard`,
    });
    setQuickEntryMode(null);
    setQuickAmount('');
    setQuickNotes('');
    showToast(`${quickEntryMode} of ${fmt(amt)} recorded for today.`);
  };

  const filteredRecentTx = useMemo(() => {
    if (txTypeFilter === 'All') return metrics.recentTransactions;
    return metrics.recentTransactions.filter((t) => t.type === txTypeFilter);
  }, [metrics.recentTransactions, txTypeFilter]);

  const displayedCollections =
    collectionTab === 'overdue' ? metrics.overdueInvoices : metrics.pendingPayments;

  const renderWidget = (widgetId: DashboardWidgetId) => {
    switch (widgetId) {
      // 38. Quick Actions
      case 'quick_actions':
        return (
          <section key={widgetId} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-xs font-bold text-slate-900">Quick Actions</h2>
                <p className="text-[11px] text-slate-500">
                  Instant billing, expense, stock &amp; directory triggers
                </p>
              </div>
              <span className="text-[11px] text-slate-400">
                Direct workspace controls
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              <button
                type="button"
                onClick={() => setIsAddSaleOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#e11d48] hover:bg-[#be123c] text-white font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Sale</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddPurchaseOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-orange-600" />
                <span>Add Purchase</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuickCategory('Rent');
                  setQuickEntryMode('Expense');
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                <span>Add Expense</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuickCategory('Consulting / Service Fee');
                  setQuickEntryMode('Other Income');
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>Add Income</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddPartyModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Add Party</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddItemModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <Package className="w-3.5 h-3.5 text-indigo-600" />
                <span>Add Item</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onNavigateClassic
                    ? onNavigateClassic('cash-bank')
                    : showToast('Open Classic Billing Suite for Cash & Bank transfer')
                }
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <Landmark className="w-3.5 h-3.5 text-slate-700" />
                <span>Cash &amp; Bank</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onNavigateClassic
                    ? onNavigateClassic('reports')
                    : showToast('Open Classic Billing Suite for Reports Hub')
                }
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
                <span>All Reports</span>
              </button>
            </div>
          </section>
        );

      // 2-6: Financial Summaries (Sales, Purchase, Profit, Expense, Income)
      case 'financial_summaries':
        return (
          <section key={widgetId} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900">
                Financial Summaries · {period}
              </h2>
              <span className="text-[11px] text-slate-500">
                Derived from live ledger entries
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Sales summary */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Sales Summary</span>
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-xl font-bold text-slate-900 tabular-nums">
                  {fmt(metrics.salesSummary)}
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {metrics.salesCount} sale invoices · Net of returns
                </div>
              </div>

              {/* Purchase summary */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Purchase Summary</span>
                  <ShoppingBag className="w-4 h-4 text-orange-600" />
                </div>
                <div className="text-xl font-bold text-slate-900 tabular-nums">
                  {fmt(metrics.purchaseSummary)}
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {metrics.purchaseCount} purchase bills recorded
                </div>
              </div>

              {/* Profit summary */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Profit Summary</span>
                  <DollarSign
                    className={`w-4 h-4 ${
                      metrics.profitSummary >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  />
                </div>
                <div
                  className={`text-xl font-bold tabular-nums ${
                    metrics.profitSummary >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {fmt(metrics.profitSummary)}
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {metrics.profitMarginPercent}% operating margin
                </div>
              </div>

              {/* Expense summary */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Expense Summary</span>
                  <TrendingDown className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-xl font-bold text-slate-900 tabular-nums">
                  {fmt(metrics.expenseSummary)}
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {metrics.expenseCount} overhead vouchers
                </div>
              </div>

              {/* Income summary */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Income Summary</span>
                  <Receipt className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-xl font-bold text-slate-900 tabular-nums">
                  {fmt(metrics.incomeSummary)}
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {metrics.incomeCount} non-sales income entries
                </div>
              </div>
            </div>
          </section>
        );

      // 7-13: Cash Balance, Bank Balance, Receivables, Payables, Stock Value, Low-Stock, Out-of-Stock
      case 'liquidity_inventory':
        return (
          <section key={widgetId} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900">
                Liquidity, Balances &amp; Inventory Health
              </h2>
              <span className="text-[11px] text-slate-500">
                Cash · Bank · Receivables · Payables · Stock Alerts
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
              {/* Cash balance */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                  <span>Cash Balance</span>
                  <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-lg font-bold text-slate-900 tabular-nums">
                  {fmt(metrics.cashBalance)}
                </div>
                <div className="text-[11px] text-slate-500">Cash in drawer</div>
              </div>

              {/* Bank balance */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                  <span>Bank Balance</span>
                  <Landmark className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="text-lg font-bold text-slate-900 tabular-nums">
                  {fmt(metrics.bankBalance)}
                </div>
                <div className="text-[11px] text-slate-500">Bank, UPI &amp; cheques</div>
              </div>

              {/* Receivables */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                  <span>Receivables</span>
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-lg font-bold text-emerald-700 tabular-nums">
                  {fmt(metrics.receivables)}
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  From {metrics.receivablesPartyCount} parties
                </div>
              </div>

              {/* Payables */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                  <span>Payables</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                </div>
                <div className="text-lg font-bold text-rose-700 tabular-nums">
                  {fmt(metrics.payables)}
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  To {metrics.payablesPartyCount} suppliers
                </div>
              </div>

              {/* Stock value */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                  <span>Stock Value</span>
                  <Boxes className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="text-lg font-bold text-slate-900 tabular-nums">
                  {fmt(metrics.stockValue)}
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {metrics.totalStockUnits.toLocaleString('en-IN')} units · {metrics.totalItemsCount} SKUs
                </div>
              </div>

              {/* Low-stock count */}
              <button
                type="button"
                onClick={() =>
                  onNavigateClassic
                    ? onNavigateClassic('stock-summary')
                    : showToast(`${metrics.lowStockCount} items below reorder threshold`)
                }
                className="bg-white rounded-xl border border-slate-200 hover:border-amber-300 p-4 space-y-1 text-left cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                  <span>Low-Stock Count</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="text-lg font-bold text-amber-700 tabular-nums">
                  {metrics.lowStockCount}
                </div>
                <div className="text-[11px] text-amber-700 font-medium">
                  {metrics.lowStockCount > 0 ? 'Reorder attention' : 'Healthy levels'}
                </div>
              </button>

              {/* Out-of-stock count */}
              <button
                type="button"
                onClick={() =>
                  onNavigateClassic
                    ? onNavigateClassic('stock-summary')
                    : showToast(`${metrics.outOfStockCount} items currently out of stock`)
                }
                className="bg-white rounded-xl border border-slate-200 hover:border-rose-300 p-4 space-y-1 text-left cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                  <span>Out-of-Stock Count</span>
                  <PackageX className="w-3.5 h-3.5 text-rose-600" />
                </div>
                <div className="text-lg font-bold text-rose-700 tabular-nums">
                  {metrics.outOfStockCount}
                </div>
                <div className="text-[11px] text-rose-700 font-medium">
                  {metrics.outOfStockCount > 0 ? 'Zero stock SKUs' : 'All SKUs stocked'}
                </div>
              </button>
            </div>
          </section>
        );

      // 14-18: Today's Sales, Purchases, Expenses, Income, Profit
      case 'today_pulse':
        return (
          <section key={widgetId} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-700" />
                <h2 className="text-sm font-bold text-slate-900">Today&apos;s Operations Snapshot</h2>
              </div>
              <span className="text-[11px] text-slate-500 tabular-nums">
                {new Date().toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-slate-500 font-medium block">Today&apos;s Sales</span>
                <span className="text-xl font-bold text-slate-900 tabular-nums block">
                  {fmt(metrics.todaySales)}
                </span>
                <span className="text-[11px] text-slate-400">Daily gross billing</span>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-500 font-medium block">Today&apos;s Purchases</span>
                <span className="text-xl font-bold text-slate-900 tabular-nums block">
                  {fmt(metrics.todayPurchases)}
                </span>
                <span className="text-[11px] text-slate-400">Vendor stock inward</span>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-500 font-medium block">Today&apos;s Expenses</span>
                <span className="text-xl font-bold text-rose-700 tabular-nums block">
                  {fmt(metrics.todayExpenses)}
                </span>
                <span className="text-[11px] text-slate-400">Daily overheads</span>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-500 font-medium block">Today&apos;s Income</span>
                <span className="text-xl font-bold text-purple-700 tabular-nums block">
                  {fmt(metrics.todayIncome)}
                </span>
                <span className="text-[11px] text-slate-400">Other receipts</span>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-500 font-medium block">Today&apos;s Profit</span>
                <span
                  className={`text-xl font-bold tabular-nums block ${
                    metrics.todayProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {fmt(metrics.todayProfit)}
                </span>
                <span className="text-[11px] text-slate-400">Net daily surplus</span>
              </div>
            </div>
          </section>
        );

      // 19-21: Monthly Sales, Monthly Purchases, Monthly Profit
      case 'monthly_pulse':
        return (
          <section key={widgetId} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Monthly Sales</span>
                <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                  {fmt(metrics.monthlySales)}
                </div>
                <span className="text-[11px] text-slate-400">Current calendar month</span>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-50 text-blue-700">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Monthly Purchases</span>
                <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                  {fmt(metrics.monthlyPurchases)}
                </div>
                <span className="text-[11px] text-slate-400">Current month procurement</span>
              </div>
              <div className="p-2.5 rounded-lg bg-orange-50 text-orange-700">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Monthly Profit</span>
                <div
                  className={`text-xl font-bold mt-1 tabular-nums ${
                    metrics.monthlyProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {fmt(metrics.monthlyProfit)}
                </div>
                <span className="text-[11px] text-slate-400">After COGS &amp; expenses</span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </section>
        );

      // 22-26: Unified Tabbed Chart + 5 Mini-Graphs
      case 'unified_graphs':
        return (
          <DashboardChartsWidget
            key={widgetId}
            graphs={metrics.graphs}
            currencySymbol={currency}
            periodLabel={period}
          />
        );

      // 34-37: Sales Target, Purchase Target, Profit Target, Achievement Percentage
      case 'targets_achievement':
        return (
          <section key={widgetId} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-rose-600" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Targets &amp; Achievement Percentage
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {period} actuals vs configured targets · Overall achievement{' '}
                    <strong className="text-slate-900 tabular-nums">
                      {metrics.overallAchievementPercent}%
                    </strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDraftTargets(targets);
                  setIsTargetModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Targets</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Sales Target */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Sales Target</span>
                  <span className="font-bold text-blue-700 tabular-nums">
                    {metrics.salesAchievementPercent}% achieved
                  </span>
                </div>
                <div className="flex items-baseline justify-between tabular-nums">
                  <span className="text-base font-bold text-slate-900">
                    {fmt(metrics.salesSummary)}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Goal {fmt(targets.salesTarget)}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, metrics.salesAchievementPercent))}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {metrics.salesSummary >= targets.salesTarget
                    ? `Target exceeded by ${fmt(metrics.salesSummary - targets.salesTarget)}`
                    : `${fmt(targets.salesTarget - metrics.salesSummary)} remaining`}
                </div>
              </div>

              {/* Purchase Target */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Purchase Target</span>
                  <span className="font-bold text-orange-700 tabular-nums">
                    {metrics.purchaseAchievementPercent}% achieved
                  </span>
                </div>
                <div className="flex items-baseline justify-between tabular-nums">
                  <span className="text-base font-bold text-slate-900">
                    {fmt(metrics.purchaseSummary)}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Budget {fmt(targets.purchaseTarget)}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, metrics.purchaseAchievementPercent))}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {metrics.purchaseSummary >= targets.purchaseTarget
                    ? `Budget utilized +${fmt(metrics.purchaseSummary - targets.purchaseTarget)}`
                    : `${fmt(targets.purchaseTarget - metrics.purchaseSummary)} budget left`}
                </div>
              </div>

              {/* Profit Target */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Profit Target</span>
                  <span className="font-bold text-emerald-700 tabular-nums">
                    {metrics.profitAchievementPercent}% achieved
                  </span>
                </div>
                <div className="flex items-baseline justify-between tabular-nums">
                  <span className="text-base font-bold text-slate-900">
                    {fmt(metrics.profitSummary)}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Goal {fmt(targets.profitTarget)}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, metrics.profitAchievementPercent))}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {metrics.profitSummary >= targets.profitTarget
                    ? `Surplus above target ${fmt(metrics.profitSummary - targets.profitTarget)}`
                    : `${fmt(Math.max(0, targets.profitTarget - metrics.profitSummary))} to goal`}
                </div>
              </div>
            </div>
          </section>
        );

      // 31-33: Pending Payments, Overdue Invoices, Payment Reminders
      case 'collections_reminders':
        return (
          <section key={widgetId} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-rose-600" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Pending Payments, Overdue Invoices &amp; Reminders
                  </h2>
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {metrics.pendingPayments.length} pending ({fmt(metrics.pendingTotalAmount)}) ·{' '}
                    {metrics.overdueInvoices.length} overdue ({fmt(metrics.overdueTotalAmount)})
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCollectionTab('overdue')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                      collectionTab === 'overdue'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Overdue ({metrics.overdueInvoices.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectionTab('all_pending')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                      collectionTab === 'all_pending'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Pending ({metrics.pendingPayments.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleRemindAllOverdue}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Remind All Overdue</span>
                </button>
              </div>
            </div>

            {displayedCollections.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                {collectionTab === 'overdue'
                  ? 'No overdue invoices right now. All due dates are current.'
                  : 'All invoices and bills are settled in full.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2.5 pr-3">Invoice</th>
                      <th className="py-2.5 px-3">Party</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3">State</th>
                      <th className="py-2.5 px-3 text-right">Balance Due</th>
                      <th className="py-2.5 pl-3 text-right">Payment Reminder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedCollections.map((entry) => {
                      const sent = reminderHistory[entry.id];
                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 pr-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                            #{entry.invoiceNo}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">{entry.partyName}</div>
                            <div className="text-[11px] text-slate-400 tabular-nums">
                              {entry.type} · {entry.partyPhone}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 tabular-nums text-slate-700 whitespace-nowrap">
                            {entry.dueDate}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {entry.isOverdue ? (
                              <span className="text-rose-700 font-semibold tabular-nums">
                                Overdue {entry.daysOverdue}d
                              </span>
                            ) : (
                              <span className="text-amber-700 font-semibold">
                                Pending ({entry.status})
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                            {fmt(entry.balance)}
                          </td>
                          <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {sent && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium mr-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>
                                    {sent.channel} · {sent.sentAt}
                                  </span>
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleSendReminder(entry, 'WhatsApp')}
                                className="px-2.5 py-1 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] cursor-pointer"
                              >
                                WhatsApp
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendReminder(entry, 'SMS')}
                                className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] cursor-pointer"
                              >
                                SMS
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );

      // 27-29: Top Customers, Top Suppliers, Top-Selling Items
      case 'leaderboards':
        return (
          <section key={widgetId} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Top Customers */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-900">Top Customers</h3>
                </div>
                <span className="text-[11px] text-slate-400">By total sales</span>
              </div>

              {metrics.topCustomers.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No customer invoices recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {metrics.topCustomers.map((cust, i) => (
                    <div key={cust.name} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {i + 1}. {cust.name}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {cust.invoiceCount} bills · Due {fmt(cust.pendingBalance)}
                        </div>
                      </div>
                      <div className="text-right font-bold text-slate-900 tabular-nums shrink-0">
                        {fmt(cust.totalSpent)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Suppliers */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-orange-600" />
                  <h3 className="text-xs font-bold text-slate-900">Top Suppliers</h3>
                </div>
                <span className="text-[11px] text-slate-400">By purchase volume</span>
              </div>

              {metrics.topSuppliers.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No supplier bills recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {metrics.topSuppliers.map((sup, i) => (
                    <div key={sup.name} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {i + 1}. {sup.name}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {sup.billCount} bills · Payable {fmt(sup.payableBalance)}
                        </div>
                      </div>
                      <div className="text-right font-bold text-slate-900 tabular-nums shrink-0">
                        {fmt(sup.totalPurchased)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top-Selling Items */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-900">Top-Selling Items</h3>
                </div>
                <span className="text-[11px] text-slate-400">By revenue &amp; qty</span>
              </div>

              {metrics.topSellingItems.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No item sales recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {metrics.topSellingItems.map((item, i) => (
                    <div key={item.name} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {i + 1}. {item.name}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {item.qtySold} {item.unit} sold · Stock {item.currentStock} {item.unit}
                        </div>
                      </div>
                      <div className="text-right font-bold text-slate-900 tabular-nums shrink-0">
                        {fmt(item.revenue)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        );

      // 30: Recent Transactions
      case 'recent_transactions':
        return (
          <section key={widgetId} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-700" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Recent Transactions</h2>
                  <p className="text-[11px] text-slate-500">
                    Click any transaction to preview or print the full voucher
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['All', 'Sale', 'Purchase', 'Expense', 'Other Income'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTxTypeFilter(t)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                      txTypeFilter === t
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {filteredRecentTx.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No {txTypeFilter === 'All' ? '' : txTypeFilter.toLowerCase()} transactions found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2.5 pr-3">Voucher #</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Party / Head</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Mode</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 pl-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecentTx.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pr-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          #{tx.invoiceNo}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium whitespace-nowrap">
                          {tx.type}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {tx.partyName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 tabular-nums whitespace-nowrap">
                          {tx.date}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {tx.paymentType}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              tx.status === 'Paid'
                                ? 'text-emerald-700'
                                : tx.status === 'Partial'
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          {fmt(tx.totalAmount)}
                        </td>
                        <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(tx);
                              setIsInvoicePreviewOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );

      // Role-specific Operations (Owner branch/security vs Manager Approval Queue)
      case 'role_operations':
        return <React.Fragment key={widgetId}>{roleOperationsWidget}</React.Fragment>;

      default:
        return null;
    }
  };

  const visibleWidgets = layout.order.filter((id) => !layout.hidden.includes(id));

  return (
    <div className="flex-1 flex flex-col bg-[#f0f4f9] overflow-y-auto select-none text-xs text-slate-800 p-6 space-y-5">
      {/* Role Workspace Header + Global Period & Customization Toolbar */}
      <div className="space-y-3">
        {headerSection}

        <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 mr-1">Period Scope:</span>
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    period === p
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 hidden sm:inline tabular-nums">
              {visibleWidgets.length} active widgets · Preset: {layout.preset}
            </span>
            <button
              type="button"
              onClick={() => setIsCustomizerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Customize Widgets</span>
            </button>
          </div>
        </div>
      </div>

      {/* Rendered Dashboard Widgets in Custom Order */}
      {visibleWidgets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
          <h3 className="text-sm font-bold text-slate-900">All Dashboard Widgets Hidden</h3>
          <p className="text-xs text-slate-500">
            Open the Widget Gallery to re-enable cards or apply a layout preset.
          </p>
          <button
            type="button"
            onClick={() => setIsCustomizerOpen(true)}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold text-xs cursor-pointer"
          >
            Open Widget Gallery
          </button>
        </div>
      ) : (
        <div className="space-y-5">{visibleWidgets.map((id) => renderWidget(id))}</div>
      )}

      {/* Widget Gallery & Customization Drawer */}
      <DashboardCustomizer
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        layout={layout}
        onChangeLayout={setLayout}
        role={role}
      />

      {/* Target Configuration Modal */}
      {isTargetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold">Configure {period} Business Targets</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTargetModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveTargets} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sales Target ({currency})
                </label>
                <input
                  type="number"
                  min={0}
                  value={draftTargets.salesTarget}
                  onChange={(e) =>
                    setDraftTargets({ ...draftTargets, salesTarget: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs tabular-nums focus:outline-none focus:border-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Purchase Budget / Target ({currency})
                </label>
                <input
                  type="number"
                  min={0}
                  value={draftTargets.purchaseTarget}
                  onChange={(e) =>
                    setDraftTargets({ ...draftTargets, purchaseTarget: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs tabular-nums focus:outline-none focus:border-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Net Profit Target ({currency})
                </label>
                <input
                  type="number"
                  min={0}
                  value={draftTargets.profitTarget}
                  onChange={(e) =>
                    setDraftTargets({ ...draftTargets, profitTarget: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs tabular-nums focus:outline-none focus:border-slate-900"
                  required
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTargetModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs cursor-pointer"
                >
                  Save Targets
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Expense / Other Income Entry Modal */}
      {quickEntryMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">
                Record {quickEntryMode === 'Expense' ? 'Operating Expense' : 'Other Income'}
              </h3>
              <button
                type="button"
                onClick={() => setQuickEntryMode(null)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleQuickEntrySubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={quickCategory}
                  onChange={(e) => setQuickCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:border-slate-900"
                >
                  {quickEntryMode === 'Expense' ? (
                    <>
                      <option value="Rent">Rent</option>
                      <option value="Electricity">Electricity</option>
                      <option value="Salary">Staff Salary</option>
                      <option value="Transport">Logistics &amp; Fuel</option>
                      <option value="Packaging">Packaging</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Miscellaneous">Miscellaneous</option>
                    </>
                  ) : (
                    <>
                      <option value="Consulting / Service Fee">Consulting / Service Fee</option>
                      <option value="Scrap / Waste Sales">Scrap / Waste Sales</option>
                      <option value="Bank Interest Received">Bank Interest Received</option>
                      <option value="Commission & Brokerage">Commission &amp; Brokerage</option>
                      <option value="Rental Income">Rental Income</option>
                      <option value="Discounts Received">Discounts Received</option>
                    </>
                  )}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount ({currency})
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    placeholder="0.00"
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs tabular-nums focus:outline-none focus:border-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={quickPayMode}
                    onChange={(e) =>
                      setQuickPayMode(e.target.value as 'Cash' | 'UPI' | 'Bank Transfer')
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:border-slate-900"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  placeholder="Voucher reference or details..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-slate-900"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickEntryMode(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#e11d48] hover:bg-[#be123c] text-white font-semibold text-xs cursor-pointer"
                >
                  Save {quickEntryMode}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
