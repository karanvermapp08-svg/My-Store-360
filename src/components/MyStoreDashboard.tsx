import React, { useMemo, useState } from 'react';
import {
  ShoppingCart,
  Package,
  Users,
  AlertTriangle,
  Receipt,
  ArrowDown,
  PlusSquare,
  ChevronRight,
  BarChart2,
  Eye,
  FileSearch,
  ClipboardList,
  ArrowRight,
  CheckCircle2,
  SlidersHorizontal,
  ArrowUp,
  TrendingUp,
  Wallet,
  Landmark,
  ShoppingBag,
  Barcode,
  ScanLine,
  ShieldCheck,
  Truck,
  FileText,
  FileCheck2,
  DatabaseBackup,
  Bell,
  CalendarClock,
  MessageCircle,
  Settings2,
  Target,
  Clock,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { calculateRealProfitSummary, parseAnyDate } from '../utils/erpEngine';
import { DashboardCardKey } from '../types';
import { isValidHsnOrSac } from '../data/hsnMasterIndia';
import { interpolateMessageTemplate } from '../data/defaultSettings';

type ChartTimeframe = 'month' | 'week' | 'year';
type TxStatusFilter = 'All' | 'Paid' | 'Partial' | 'Unpaid';

export const MyStoreDashboard: React.FC = () => {
  const {
    filteredTransactions,
    parties,
    items,
    accounts,
    journalVouchers,
    dashboardCards,
    setDashboardCards,
    filterPeriod,
    setActiveTab,
    setActiveSaleSubtype,
    setIsAddSaleOpen,
    setIsAddPurchaseOpen,
    setIsAddItemModalOpen,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    openBarcodeScanner,
    purchaseScans,
    batches,
    eInvoiceRecords,
    createPreMigrationBackup,
    showToast,
    businessSettings,
    serviceReminders,
    updateServiceReminder,
    logPaymentReminderSent,
    setActiveSettingsCategory,
    company,
  } = useVyapar();

  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('month');
  const [txStatusFilter, setTxStatusFilter] = useState<TxStatusFilter>('All');
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  const profitStats = useMemo(
    () => calculateRealProfitSummary(filteredTransactions, items),
    [filteredTransactions, items]
  );

  // Authoritative live calculations from stored data (respecting firm/search filters cleanly)
  const stats = useMemo(() => {
    const salesTx = filteredTransactions.filter((t) => t.type === 'Sale' && !t.isCancelled);
    const totalSales = salesTx.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const salesCount = salesTx.length;

    const customers = parties.filter((p) => p.type === 'Customer' || !p.type);
    const suppliers = parties.filter((p) => p.type === 'Supplier');

    const totalProducts = items.length;
    const lowStockCount = items.filter((i) => (i.stock || 0) <= (i.minStockAlert || 5)).length;
    const totalStockUnits = items.reduce((sum, i) => sum + (i.stock || 0), 0);
    const stockValuation = items.reduce(
      (sum, i) => sum + Math.max(0, i.stock || 0) * (i.purchasePrice || i.salePrice * 0.75),
      0
    );

    const totalReceivables = customers.reduce((sum, p) => sum + Math.max(0, p.balance || 0), 0);
    const totalPayables = suppliers.reduce((sum, p) => sum + Math.max(0, p.balance || 0), 0);

    // Cash & Bank live net from accounts + journals
    const getAccBal = (id: string) => {
      const acc = accounts.find((a) => a.id === id);
      const opening = acc?.openingBalance || 0;
      let delta = 0;
      journalVouchers.forEach((jv) => {
        jv.lines.forEach((l) => {
          if (l.accountId === id) delta += (l.debit || 0) - (l.credit || 0);
        });
      });
      return opening + delta;
    };

    const cashBalance = getAccBal('acc-cash');
    const bankBalance = getAccBal('acc-bank');

    // Top Selling Items
    const itemSalesMap = new Map<string, { name: string; qty: number; revenue: number }>();
    salesTx.forEach((tx) => {
      tx.items.forEach((line) => {
        const key = line.name;
        const prev = itemSalesMap.get(key) || { name: line.name, qty: 0, revenue: 0 };
        prev.qty += line.qty || 0;
        prev.revenue += line.amount || line.price * line.qty;
        itemSalesMap.set(key, prev);
      });
    });
    const topItems = Array.from(itemSalesMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Top Customers
    const custMap = new Map<string, { name: string; bills: number; total: number }>();
    salesTx.forEach((tx) => {
      const prev = custMap.get(tx.partyName) || { name: tx.partyName, bills: 0, total: 0 };
      prev.bills += 1;
      prev.total += tx.totalAmount || 0;
      custMap.set(tx.partyName, prev);
    });
    const topCustomers = Array.from(custMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Top Suppliers
    const supMap = new Map<string, { name: string; bills: number; total: number }>();
    filteredTransactions
      .filter((t) => t.type === 'Purchase' && !t.isCancelled)
      .forEach((tx) => {
        const prev = supMap.get(tx.partyName) || { name: tx.partyName, bills: 0, total: 0 };
        prev.bills += 1;
        prev.total += tx.totalAmount || 0;
        supMap.set(tx.partyName, prev);
      });
    const topSuppliers = Array.from(supMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Today's Business Pulse
    const todayDateStr = new Date().toDateString();
    const todayTx = filteredTransactions.filter((t) => {
      if (t.isCancelled) return false;
      const dt = parseAnyDate(t.date);
      return dt ? dt.toDateString() === todayDateStr : false;
    });
    const todayProfit = calculateRealProfitSummary(todayTx, items);
    const todaySalesBills = todayTx.filter((t) => t.type === 'Sale').length;

    const pendingScannedBills = purchaseScans.filter(
      (s) => s.status !== 'CONFIRMED' && s.status !== 'CANCELLED'
    ).length;

    const missingHsnCount = items.filter((i) => {
      const code = (i.hsnCode || i.sacCode || '').trim();
      return !code || !isValidHsnOrSac(code);
    }).length;

    const openChallansCount = filteredTransactions.filter(
      (t) =>
        t.type === 'Delivery Challan' &&
        t.challanStatus !== 'Converted' &&
        t.challanStatus !== 'Cancelled' &&
        t.fulfillmentStatus !== 'Completed'
    ).length;

    const awaitingQuotationsCount = filteredTransactions.filter(
      (t) =>
        (t.type === 'Estimate' || t.type === 'Proforma') &&
        t.quotationStatus !== 'Converted to Invoice' &&
        t.quotationStatus !== 'Converted to Order' &&
        t.quotationStatus !== 'Rejected' &&
        t.fulfillmentStatus !== 'Completed'
    ).length;

    const b2bInvoices = filteredTransactions.filter(
      (t) => t.type === 'Sale' && !t.isCancelled && Boolean(t.partyGstin && t.partyGstin.trim().length >= 15)
    );
    const pendingOrFailedEInvCount = b2bInvoices.filter(
      (inv) => !eInvoiceRecords.some((r) => r.transactionId === inv.id && r.status === 'GENERATED')
    ).length;

    const cutoffMs = Date.now() + 60 * 86400000;
    const expiringBatchesCount = batches.filter((b) => {
      if (!b.expiryDate || b.qty <= 0) return false;
      const ms = new Date(b.expiryDate).getTime();
      return !Number.isNaN(ms) && ms <= cutoffMs;
    }).length;

    return {
      totalSales,
      salesCount,
      totalProducts,
      customerCount: customers.length,
      supplierCount: suppliers.length,
      lowStockCount,
      totalStockUnits,
      stockValuation,
      totalReceivables,
      totalPayables,
      cashBalance,
      bankBalance,
      topItems,
      topCustomers,
      topSuppliers,
      todayPulse: {
        sales: todayProfit.salesRevenue,
        purchases: todayProfit.totalPurchases,
        expenses: todayProfit.totalExpenses,
        netProfit: todayProfit.netProfit,
        salesBills: todaySalesBills,
      },
      pendingScannedBills,
      missingHsnCount,
      openChallansCount,
      awaitingQuotationsCount,
      pendingOrFailedEInvCount,
      expiringBatchesCount,
    };
  }, [filteredTransactions, parties, items, accounts, journalVouchers, purchaseScans, batches, eInvoiceRecords]);

  const targetBudgets = useMemo(() => {
    try {
      const raw = localStorage.getItem('bm360_targets_budgets');
      return raw
        ? (JSON.parse(raw) as { salesTarget: number; purchaseBudget: number; expenseBudget: number; profitTarget: number })
        : { salesTarget: 250000, purchaseBudget: 150000, expenseBudget: 35000, profitTarget: 65000 };
    } catch {
      return { salesTarget: 250000, purchaseBudget: 150000, expenseBudget: 35000, profitTarget: 65000 };
    }
  }, [filteredTransactions]);

  // Payment Due / Overdue & Service Reminders derived from live transactions + settings
  const reminderFeed = useMemo(() => {
    const parseDateLocal = (raw: string): Date | null => {
      if (!raw) return null;
      const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
      if (slash) {
        const d = Number(slash[1]);
        const m = Number(slash[2]) - 1;
        const y = slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3]);
        return new Date(y, m, d);
      }
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const paymentAlerts: Array<{
      txId: string;
      partyId: string;
      invoiceNo: string;
      partyName: string;
      phone: string;
      balance: number;
      dueDate: string;
      diffDays: number;
      bucket: 'Overdue' | 'Due Today' | 'Upcoming';
      whatsappUrl: string;
      messageText: string;
    }> = [];

    if (businessSettings.party.enablePaymentReminder) {
      const beforeDays = businessSettings.party.paymentReminderDaysBeforeDue ?? 3;
      const salesWithDue = filteredTransactions.filter(
        (t) => t.type === 'Sale' && !t.isCancelled && (t.balance || 0) > 0
      );

      for (const tx of salesWithDue) {
        const dueDt = parseDateLocal(tx.dueDate || tx.date);
        if (!dueDt) continue;
        dueDt.setHours(0, 0, 0, 0);
        const diffDays = Math.round((dueDt.getTime() - todayStart.getTime()) / 86400000);

        let bucket: 'Overdue' | 'Due Today' | 'Upcoming' | null = null;
        if (diffDays < 0 && businessSettings.party.remindAfterDueDate) {
          bucket = 'Overdue';
        } else if (diffDays === 0 && businessSettings.party.remindOnDueDate) {
          bucket = 'Due Today';
        } else if (diffDays > 0 && diffDays <= beforeDays) {
          bucket = 'Upcoming';
        }
        if (!bucket) continue;

        const partyObj = parties.find((p) => p.name.toLowerCase() === tx.partyName.toLowerCase());
        const phone = (tx.partyPhone || partyObj?.phone || '').replace(/\D/g, '');
        const msgTemplate =
          businessSettings.party.paymentReminderMessage ||
          'Dear {customer_name}, reminder from {business_name}: ₹{balance_amount} for Invoice #{invoice_number} is due on {due_date}.';
        const messageText = interpolateMessageTemplate(msgTemplate, {
          customer_name: tx.partyName,
          business_name: company.name,
          business_mobile: company.phone,
          invoice_number: tx.invoiceNo,
          invoice_date: tx.date,
          due_date: tx.dueDate || tx.date,
          total_amount: (tx.totalAmount || 0).toFixed(2),
          paid_amount: (tx.receivedAmount || 0).toFixed(2),
          balance_amount: (tx.balance || 0).toFixed(2),
        });
        const phoneWithCc = phone.length === 10 ? `91${phone}` : phone;
        const whatsappUrl = phoneWithCc
          ? `https://wa.me/${phoneWithCc}?text=${encodeURIComponent(messageText)}`
          : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

        paymentAlerts.push({
          txId: tx.id,
          partyId: partyObj?.id || tx.id,
          invoiceNo: tx.invoiceNo,
          partyName: tx.partyName,
          phone: tx.partyPhone || partyObj?.phone || '',
          balance: tx.balance || 0,
          dueDate: tx.dueDate || tx.date,
          diffDays,
          bucket,
          whatsappUrl,
          messageText,
        });
      }

      paymentAlerts.sort((a, b) => a.diffDays - b.diffDays);
    }

    const activeServices = businessSettings.serviceReminders.enabled && businessSettings.serviceReminders.showOnDashboard
      ? serviceReminders
          .filter((sr) => sr.status !== 'Completed')
          .sort((a, b) => a.reminderDate.localeCompare(b.reminderDate))
          .slice(0, 6)
      : [];

    return { paymentAlerts: paymentAlerts.slice(0, 6), activeServices };
  }, [filteredTransactions, parties, businessSettings, serviceReminders, company]);

  // Dynamic Sales Performance chart series derived from real sales transactions
  const chartData = useMemo(() => {
    const now = new Date();
    const salesOnly = filteredTransactions.filter((t) => t.type === 'Sale' && !t.isCancelled);

    const parseDate = (raw: string): Date | null => {
      if (!raw) return null;
      const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
      if (slash) {
        const d = Number(slash[1]);
        const m = Number(slash[2]) - 1;
        const y = slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3]);
        return new Date(y, m, d);
      }
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const buckets: { label: string; amount: number; count: number }[] = [];

    if (chartTimeframe === 'week') {
      for (let i = 6; i >= 0; i--) {
        const dt = new Date(now);
        dt.setDate(now.getDate() - i);
        const key = dt.toDateString();
        const label = i === 0 ? 'Today' : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const daySales = salesOnly.filter((tx) => {
          const d = parseDate(tx.date);
          return d && d.toDateString() === key;
        });
        buckets.push({
          label,
          amount: daySales.reduce((s, t) => s + (t.totalAmount || 0), 0),
          count: daySales.length,
        });
      }
    } else if (chartTimeframe === 'year') {
      for (let i = 5; i >= 0; i--) {
        const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = dt.toLocaleDateString('en-IN', { month: 'short' });
        const mSales = salesOnly.filter((tx) => {
          const d = parseDate(tx.date);
          return d && d.getFullYear() === dt.getFullYear() && d.getMonth() === dt.getMonth();
        });
        buckets.push({
          label,
          amount: mSales.reduce((s, t) => s + (t.totalAmount || 0), 0),
          count: mSales.length,
        });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const endDt = new Date(now);
        endDt.setDate(now.getDate() - i * 5);
        const startDt = new Date(endDt);
        startDt.setDate(endDt.getDate() - 4);
        startDt.setHours(0, 0, 0, 0);
        endDt.setHours(23, 59, 59, 999);
        const label = i === 0 ? 'Today' : endDt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        const spanSales = salesOnly.filter((tx) => {
          const d = parseDate(tx.date);
          return d && d >= startDt && d <= endDt;
        });
        buckets.push({
          label,
          amount: spanSales.reduce((s, t) => s + (t.totalAmount || 0), 0),
          count: spanSales.length,
        });
      }
    }

    const rawMax = Math.max(...buckets.map((b) => b.amount), 0);
    const niceMax = rawMax > 0 ? Math.ceil(rawMax / 100) * 100 : 100;
    const avgTarget = rawMax > 0 ? Math.round((buckets.reduce((s, b) => s + b.amount, 0) / buckets.length) * 1.1) : 0;

    return { buckets, niceMax, avgTarget, hasSales: rawMax > 0 };
  }, [filteredTransactions, chartTimeframe]);

  // SVG coordinates for smooth trend line
  const chartSvg = useMemo(() => {
    const width = 560;
    const height = 170;
    const padX = 20;
    const padTop = 18;
    const padBottom = 16;
    const usableW = width - padX * 2;
    const usableH = height - padTop - padBottom;

    const pts = chartData.buckets.map((b, idx) => {
      const x =
        chartData.buckets.length === 1
          ? width / 2
          : padX + (idx / (chartData.buckets.length - 1)) * usableW;
      const ratio = chartData.niceMax > 0 ? b.amount / chartData.niceMax : 0;
      const y = height - padBottom - ratio * usableH;
      return { x, y, ...b };
    });

    const buildSmoothPath = (points: typeof pts) => {
      if (points.length === 0) return '';
      if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cx = (p0.x + p1.x) / 2;
        d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
      }
      return d;
    };

    const linePath = buildSmoothPath(pts);
    const baselineY = height - padBottom;
    const areaPath =
      pts.length > 0
        ? `${linePath} L ${pts[pts.length - 1].x} ${baselineY} L ${pts[0].x} ${baselineY} Z`
        : '';

    const targetRatio = chartData.niceMax > 0 ? Math.min(1, chartData.avgTarget / chartData.niceMax) : 0;
    const targetY = height - padBottom - targetRatio * usableH;

    return { width, height, padX, padTop, baselineY, pts, linePath, areaPath, targetY };
  }, [chartData]);

  // Recent Transactions list with interactive status filter
  const recentTxList = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'Sale' || t.type === 'Purchase')
      .filter((t) => (txStatusFilter === 'All' ? true : t.status === txStatusFilter))
      .slice(0, 8);
  }, [filteredTransactions, txStatusFilter]);

  const fmt = (num: number) =>
    '₹' + (Number(num) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtCompact = (num: number) => {
    if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
    if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
    return `₹${Math.round(num)}`;
  };

  const toggleCardVisibility = (key: DashboardCardKey) => {
    setDashboardCards((prev) =>
      prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c))
    );
  };

  const moveCardOrder = (key: DashboardCardKey, dir: -1 | 1) => {
    setDashboardCards((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((c) => c.key === key);
      const swapIdx = idx + dir;
      if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const tmp = sorted[idx];
      sorted[idx] = sorted[swapIdx];
      sorted[swapIdx] = tmp;
      return sorted.map((c, i) => ({ ...c, order: i + 1 }));
    });
  };

  const orderedVisibleCards = useMemo(() => {
    const meta: Record<
      DashboardCardKey,
      {
        title: string;
        value: string;
        sub: string;
        icon: React.ComponentType<{ className?: string }>;
        tone: string;
        valTone: string;
        onClick: () => void;
      }
    > = {
      sales: {
        title: 'Total Sales Recorded',
        value: fmt(stats.totalSales),
        sub: `${stats.salesCount} sale ${stats.salesCount === 1 ? 'bill' : 'bills'} recorded`,
        icon: ShoppingCart,
        tone: 'to-rose-50/90 dark:to-rose-950/30 border-rose-100 dark:border-rose-900/50',
        valTone: 'text-[#D0192E] dark:text-rose-400',
        onClick: () => {
          setActiveTab('sale-invoices');
          setActiveSaleSubtype('Sale Invoices');
        },
      },
      purchases: {
        title: 'Total Purchases',
        value: fmt(profitStats.totalPurchases),
        sub: 'Inward stock procurement bills',
        icon: ShoppingBag,
        tone: 'to-blue-50/90 dark:to-blue-950/30 border-blue-100 dark:border-blue-900/50',
        valTone: 'text-blue-600 dark:text-blue-400',
        onClick: () => setActiveTab('purchase'),
      },
      profit: {
        title: 'Net Profit (Real COGS)',
        value: fmt(profitStats.netProfit),
        sub: `Gross Margin: ${profitStats.grossMarginPercent}%`,
        icon: TrendingUp,
        tone: 'to-emerald-50/90 dark:to-emerald-950/30 border-emerald-100 dark:border-emerald-900/50',
        valTone: 'text-emerald-600 dark:text-emerald-400',
        onClick: () => setActiveTab('erp-accounting'),
      },
      receivables: {
        title: 'Receivables (Customers)',
        value: fmt(stats.totalReceivables),
        sub: `${stats.customerCount} registered customers`,
        icon: Users,
        tone: 'to-amber-50/90 dark:to-amber-950/30 border-amber-100 dark:border-amber-900/50',
        valTone: 'text-amber-600 dark:text-amber-400',
        onClick: () => setActiveTab('customers'),
      },
      payables: {
        title: 'Payables (Suppliers)',
        value: fmt(stats.totalPayables),
        sub: `${stats.supplierCount} active suppliers`,
        icon: AlertTriangle,
        tone: 'to-rose-50/80 dark:to-rose-950/30 border-rose-100 dark:border-rose-900/50',
        valTone: 'text-rose-600 dark:text-rose-400',
        onClick: () => setActiveTab('suppliers'),
      },
      cash: {
        title: 'Cash Balance',
        value: fmt(stats.cashBalance),
        sub: 'Live counter cash ledger',
        icon: Wallet,
        tone: 'to-emerald-50/80 dark:to-emerald-950/30 border-emerald-100 dark:border-emerald-900/50',
        valTone: 'text-emerald-700 dark:text-emerald-300',
        onClick: () => setActiveTab('cash-account'),
      },
      bank: {
        title: 'Bank Balance',
        value: fmt(stats.bankBalance),
        sub: 'Primary bank + UPI account',
        icon: Landmark,
        tone: 'to-indigo-50/80 dark:to-indigo-950/30 border-indigo-100 dark:border-indigo-900/50',
        valTone: 'text-indigo-600 dark:text-indigo-400',
        onClick: () => setActiveTab('bank-accounts'),
      },
      stock: {
        title: 'Stock Valuation',
        value: fmt(stats.stockValuation),
        sub: `${stats.totalStockUnits} units • ${stats.lowStockCount} low-stock`,
        icon: Package,
        tone: 'to-sky-50/80 dark:to-sky-950/30 border-sky-100 dark:border-sky-900/50',
        valTone: 'text-sky-600 dark:text-sky-400',
        onClick: () => setActiveTab('stock-summary'),
      },
    };

    return [...dashboardCards]
      .sort((a, b) => a.order - b.order)
      .filter((c) => c.visible)
      .map((c) => ({ ...c, ...meta[c.key] }));
  }, [dashboardCards, stats, profitStats, setActiveTab, setActiveSaleSubtype]);

  return (
    <div className="flex-1 bg-[#f5f6fa] dark:bg-slate-950 overflow-y-auto px-4 sm:px-6 py-5 select-none text-slate-800 dark:text-slate-100 space-y-5">
      {/* Customization & Prominent Scan Barcode Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => openBarcodeScanner('lookup')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#8E0E20] to-[#B91C1C] hover:from-[#740918] hover:to-[#991b1b] text-white text-xs font-bold shadow-sm cursor-pointer transition-all active:scale-[0.99]"
          >
            <Barcode className="w-4 h-4 text-emerald-300" />
            <span>Scan Barcode</span>
          </button>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Showing {orderedVisibleCards.length} of {dashboardCards.length} customizable ERP KPI cards
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsCustomizeOpen((p) => !p)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#8B0D1E] text-xs font-semibold cursor-pointer shadow-2xs"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#8B0D1E] dark:text-rose-400" />
          <span>{isCustomizeOpen ? 'Done Customizing' : 'Customize Cards'}</span>
        </button>
      </div>

      {isCustomizeOpen && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-900 dark:text-white">
            Show / Hide &amp; Reorder Dashboard KPI Cards (Saved Automatically)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {[...dashboardCards]
              .sort((a, b) => a.order - b.order)
              .map((card, i, arr) => (
                <div
                  key={card.key}
                  className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-2 text-xs"
                >
                  <label className="flex items-center gap-2 cursor-pointer font-semibold truncate">
                    <input
                      type="checkbox"
                      checked={card.visible}
                      onChange={() => toggleCardVisibility(card.key)}
                      className="rounded text-[#8B0D1E]"
                    />
                    <span className="truncate">{card.label}</span>
                  </label>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => moveCardOrder(card.key, -1)}
                      className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-30 cursor-pointer"
                      title="Move Left / Up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={i === arr.length - 1}
                      onClick={() => moveCardOrder(card.key, 1)}
                      className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-30 cursor-pointer"
                      title="Move Right / Down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Today's Business Pulse Strip */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 px-4 py-3 shadow-xs grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Today&apos;s Sales ({stats.todayPulse.salesBills})</div>
            <div className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums truncate">
              {fmt(stats.todayPulse.sales)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Today&apos;s Purchases</div>
            <div className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums truncate">
              {fmt(stats.todayPulse.purchases)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Today&apos;s Expenses</div>
            <div className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums truncate">
              {fmt(stats.todayPulse.expenses)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Today&apos;s Net Profit</div>
            <div
              className={`text-sm font-extrabold tabular-nums truncate ${
                stats.todayPulse.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'
              }`}
            >
              {fmt(stats.todayPulse.netProfit)}
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Customizable KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {orderedVisibleCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              onClick={card.onClick}
              className={`text-left bg-gradient-to-br from-white via-white dark:from-slate-900 dark:via-slate-900 ${card.tone} border rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all group cursor-pointer`}
            >
              <div className="flex items-start gap-3.5 relative z-10">
                <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-slate-600 dark:text-slate-400 text-xs font-semibold truncate">
                    {card.title}
                  </div>
                  <div className={`text-2xl font-extrabold tracking-tight tabular-nums mt-0.5 truncate ${card.valTone}`}>
                    {card.value}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-medium mt-3 relative z-10">
                <BarChart2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{card.sub}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Row 2: 4 Quick Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => {
            setIsAddSaleOpen(true);
            showToast('Opening Create Sale Bill');
          }}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl px-4 py-3.5 flex items-center justify-between gap-3 shadow-2xs hover:shadow-sm hover:border-rose-200 cursor-pointer transition-all active:scale-[0.99] text-left group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-rose-100 text-[#B91C1C] flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white text-[13px] truncate">Create Sale Bill</div>
              <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate">Make a GST or non-GST invoice</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#8B0D1E] group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => {
            setIsAddPurchaseOpen(true);
            showToast('Opening Record Purchase');
          }}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl px-4 py-3.5 flex items-center justify-between gap-3 shadow-2xs hover:shadow-sm hover:border-blue-200 cursor-pointer transition-all active:scale-[0.99] text-left group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <ArrowDown className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white text-[13px] truncate">Record Purchase</div>
              <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate">Add stock from supplier</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => {
            setIsAddItemModalOpen(true);
            showToast('Opening Add New Item');
          }}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl px-4 py-3.5 flex items-center justify-between gap-3 shadow-2xs hover:shadow-sm hover:border-emerald-200 cursor-pointer transition-all active:scale-[0.99] text-left group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <PlusSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white text-[13px] truncate">Add New Item</div>
              <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate">Update product catalogue</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('erp-accounting');
            showToast('Opening Double-Entry Journals & P&L');
          }}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl px-4 py-3.5 flex items-center justify-between gap-3 shadow-2xs hover:shadow-sm hover:border-amber-200 cursor-pointer transition-all active:scale-[0.99] text-left group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center font-extrabold text-base shrink-0">
              ₹
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white text-[13px] truncate">Accounting &amp; P&amp;L</div>
              <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate">Journals, Trial Balance &amp; Aging</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>
      </div>

      {/* Row 3: Split Analytics Section (Sales Performance 2/3 + Business Snapshot 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Sales Performance */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
          {/* Crimson Header Bar */}
          <div className="bg-gradient-to-r from-[#8E0E20] to-[#740918] px-5 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-white">
              <BarChart2 className="w-4 h-4" />
              <h2 className="font-bold text-sm tracking-tight">Sales Performance</h2>
            </div>

            <select
              aria-label="Select chart timeframe"
              value={chartTimeframe}
              onChange={(e) => setChartTimeframe(e.target.value as ChartTimeframe)}
              className="px-3 py-1 rounded-lg bg-white/15 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="month" className="text-slate-900">
                This Month
              </option>
              <option value="week" className="text-slate-900">
                Last 7 Days
              </option>
              <option value="year" className="text-slate-900">
                Last 6 Months
              </option>
            </select>
          </div>

          {/* Chart Body */}
          <div className="p-5 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] text-slate-500">
                {chartData.hasSales
                  ? `Showing live invoiced sales (${stats.salesCount} total bills)`
                  : 'Create sale invoices to visualize live sales trend'}
              </div>
              <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span>Sales</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-300" />
                  <span>Avg Target</span>
                </span>
              </div>
            </div>

            <div className="relative flex gap-2 items-stretch pt-2">
              {/* Y-Axis Labels */}
              <div className="flex flex-col justify-between text-[10px] font-medium text-slate-400 tabular-nums pb-6 text-right min-w-[42px]">
                <span>{fmtCompact(chartData.niceMax)}</span>
                <span>{fmtCompact(chartData.niceMax * 0.75)}</span>
                <span>{fmtCompact(chartData.niceMax * 0.5)}</span>
                <span>{fmtCompact(chartData.niceMax * 0.25)}</span>
                <span>₹0</span>
              </div>

              {/* Chart SVG + X-Axis */}
              <div className="flex-1 flex flex-col min-w-0 relative">
                <svg
                  viewBox={`0 0 ${chartSvg.width} ${chartSvg.height}`}
                  className="w-full h-44 overflow-visible"
                >
                  <defs>
                    <linearGradient id="bmSalesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.24" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Gridlines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                    const y = chartSvg.padTop + step * (chartSvg.baselineY - chartSvg.padTop);
                    return (
                      <line
                        key={step}
                        x1={chartSvg.padX}
                        y1={y}
                        x2={chartSvg.width - chartSvg.padX}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeWidth="1"
                        strokeDasharray={step === 1 ? undefined : '3 3'}
                      />
                    );
                  })}

                  {/* Vertical Gridlines at checkpoints */}
                  {chartSvg.pts.map((pt) => (
                    <line
                      key={pt.label}
                      x1={pt.x}
                      y1={chartSvg.padTop}
                      x2={pt.x}
                      y2={chartSvg.baselineY}
                      stroke="#f1f5f9"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Target Dashed Reference Line */}
                  {chartData.hasSales && (
                    <line
                      x1={chartSvg.padX}
                      y1={chartSvg.targetY}
                      x2={chartSvg.width - chartSvg.padX}
                      y2={chartSvg.targetY}
                      stroke="#7dd3fc"
                      strokeWidth="1.5"
                      strokeDasharray="5 5"
                    />
                  )}

                  {/* Shaded Area */}
                  {chartSvg.areaPath && <path d={chartSvg.areaPath} fill="url(#bmSalesGradient)" />}

                  {/* Smooth Curve */}
                  {chartSvg.linePath && (
                    <path
                      d={chartSvg.linePath}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Interactive Data Nodes */}
                  {chartSvg.pts.map((pt, idx) => (
                    <g
                      key={pt.label}
                      onMouseEnter={() => setHoveredPointIdx(idx)}
                      onMouseLeave={() => setHoveredPointIdx(null)}
                      className="cursor-pointer"
                    >
                      <circle cx={pt.x} cy={pt.y} r="12" fill="transparent" />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={hoveredPointIdx === idx ? 5.5 : 4}
                        fill="#ffffff"
                        stroke="#2563eb"
                        strokeWidth="2.5"
                      />
                    </g>
                  ))}
                </svg>

                {/* Hover Tooltip */}
                {hoveredPointIdx !== null && chartSvg.pts[hoveredPointIdx] && (
                  <div
                    style={{
                      left: `${(chartSvg.pts[hoveredPointIdx].x / chartSvg.width) * 100}%`,
                      top: `${Math.max(4, chartSvg.pts[hoveredPointIdx].y - 44)}px`,
                    }}
                    className="absolute -translate-x-1/2 z-20 pointer-events-none bg-slate-900 text-white px-2.5 py-1.5 rounded-lg shadow-lg text-[11px] whitespace-nowrap"
                  >
                    <div className="font-bold">{chartSvg.pts[hoveredPointIdx].label}</div>
                    <div className="tabular-nums text-sky-300">
                      {fmt(chartSvg.pts[hoveredPointIdx].amount)} ({chartSvg.pts[hoveredPointIdx].count} bills)
                    </div>
                  </div>
                )}

              {/* Chart Footer Legend / Labels */}
              <div className="flex justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 px-2">
                  {chartSvg.pts.map((pt) => (
                    <span key={pt.label} className="truncate">
                      {pt.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Business Snapshot */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
          {/* Crimson Header Bar */}
          <div className="bg-gradient-to-r from-[#8E0E20] to-[#740918] px-5 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-white">
              <BarChart2 className="w-4 h-4" />
              <h2 className="font-bold text-sm tracking-tight">Business Snapshot</h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-lg bg-white/15 border border-white/20 text-white text-[11px] font-semibold">
              {filterPeriod}
            </span>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
            <div className="space-y-3">
              {/* Row 1: Products */}
              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">Products in catalogue</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">{stats.totalProducts}</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('items')}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-300 text-blue-600 dark:text-blue-400 text-[11px] font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>View</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Row 2: Customers */}
              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">Registered customers</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">{stats.customerCount}</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('customers')}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>View</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Row 3: Stock units in hand */}
              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">Stock units in hand</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {stats.totalStockUnits} Units
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('stock-summary')}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Check</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Financial Totals */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400">Receivables: </span>
                <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">{fmt(stats.totalReceivables)}</span>
              </div>
              <div>
                <span className="text-slate-400">Payables: </span>
                <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">{fmt(stats.totalPayables)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3.5: Enterprise Analytics Strip (Income vs Expense, Top Items, Top Customers) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: Income vs Expense & Real COGS Profit */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Income vs Expense</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Live revenue, purchases &amp; real COGS margin</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('erp-accounting')}
              className="text-[11px] font-bold text-[#8E0E20] dark:text-rose-400 hover:underline cursor-pointer"
            >
              P&amp;L →
            </button>
          </div>

          {(() => {
            const maxBar = Math.max(
              profitStats.salesRevenue + profitStats.otherIncome,
              profitStats.totalPurchases + profitStats.totalExpenses,
              1
            );
            const bars = [
              { label: 'Sales Revenue', value: profitStats.salesRevenue, color: 'bg-emerald-500' },
              { label: 'Purchases', value: profitStats.totalPurchases, color: 'bg-blue-500' },
              { label: 'Operating Expenses', value: profitStats.totalExpenses, color: 'bg-rose-500' },
              { label: 'Other Income', value: profitStats.otherIncome, color: 'bg-teal-500' },
            ];
            return (
              <div className="space-y-3">
                {bars.map((b) => {
                  const pct = Math.min(100, Math.round((b.value / maxBar) * 100));
                  return (
                    <div key={b.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600 dark:text-slate-300">{b.label}</span>
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums">{fmt(b.value)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className={`h-full rounded-full ${b.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400">Gross Profit: </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(profitStats.grossProfit)}</span>
            </div>
            <div>
              <span className="text-slate-400">Net Profit: </span>
              <span
                className={`font-extrabold tabular-nums ${
                  profitStats.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {fmt(profitStats.netProfit)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Top-Selling Items */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-blue-600" />
                <span>Top-Selling Items</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Ranked by invoiced sales revenue</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('erp-inventory')}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Stock Insights →
            </button>
          </div>

          {stats.topItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-8 text-center text-xs text-slate-400">
              Record sale bills to rank your fastest-selling items.
            </div>
          ) : (
            <div className="space-y-2.5 flex-1">
              {stats.topItems.map((it, idx) => {
                const topRev = stats.topItems[0]?.revenue || 1;
                const pct = Math.max(8, Math.round((it.revenue / topRev) * 100));
                return (
                  <div key={it.name} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {idx + 1}. {it.name}
                      </span>
                      <span className="text-[11px] font-bold text-slate-900 dark:text-white tabular-nums shrink-0">
                        {it.qty} qty &bull; {fmt(it.revenue)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Card 3: Top Customers */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-600" />
                <span>Top Customers</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Highest billing customers in current period</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('customers')}
              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              All Customers →
            </button>
          </div>

          {stats.topCustomers.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-8 text-center text-xs text-slate-400">
              Customer billing leaders will appear here as bills are recorded.
            </div>
          ) : (
            <div className="space-y-2.5 flex-1">
              {stats.topCustomers.map((c, idx) => (
                <div
                  key={c.name}
                  className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[11px] font-extrabold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{c.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{c.bills} bill(s)</div>
                    </div>
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums shrink-0">
                    {fmt(c.total)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 3.6: Targets & Budgets Achievement + Top Suppliers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Targets & Budget Progress */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-[#8E0E20] dark:text-rose-400" />
                <span>Targets &amp; Budget Achievement</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Live progress vs goals configured in ERP Tools &rarr; Targets &amp; Budgets
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('erp-tools')}
              className="text-[11px] font-bold text-[#8E0E20] dark:text-rose-400 hover:underline cursor-pointer shrink-0"
            >
              Configure Targets →
            </button>
          </div>

          <div className="space-y-3">
            {[
              {
                label: 'Sales Revenue Goal',
                actual: profitStats.salesRevenue,
                target: targetBudgets.salesTarget || 1,
                barColor: 'bg-emerald-500',
              },
              {
                label: 'Net Profit Goal',
                actual: Math.max(0, profitStats.netProfit),
                target: targetBudgets.profitTarget || 1,
                barColor: 'bg-blue-500',
              },
              {
                label: 'Purchase Spend Budget',
                actual: profitStats.totalPurchases,
                target: targetBudgets.purchaseBudget || 1,
                barColor: 'bg-amber-500',
              },
              {
                label: 'Operating Expense Cap',
                actual: profitStats.totalExpenses,
                target: targetBudgets.expenseBudget || 1,
                barColor: profitStats.totalExpenses > (targetBudgets.expenseBudget || 1) ? 'bg-rose-500' : 'bg-teal-500',
              },
            ].map((row) => {
              const pct = Math.min(100, Math.round((row.actual / Math.max(1, row.target)) * 100));
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{row.label}</span>
                    <span className="tabular-nums text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {fmtCompact(row.actual)} / {fmtCompact(row.target)} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className={`h-full rounded-full ${row.barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Suppliers Leaderboard */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-600" />
                <span>Top Suppliers Leaderboard</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Highest inward procurement suppliers in selected period
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('suppliers')}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer shrink-0"
            >
              All Suppliers →
            </button>
          </div>

          {stats.topSuppliers.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-8 text-center text-xs text-slate-400">
              Supplier purchase leaders will appear here as purchase bills are recorded.
            </div>
          ) : (
            <div className="space-y-2.5 flex-1">
              {stats.topSuppliers.map((sup, idx) => (
                <div
                  key={sup.name}
                  className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-extrabold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{sup.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{sup.bills} purchase bill(s)</div>
                    </div>
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums shrink-0">
                    {fmt(sup.total)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 3.75: Integrated Compliance & Workflow Pulse */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Integrated Compliance &amp; Workflow Pulse
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Live operational queues across AI Purchase OCR, HSN/GST Compliance, Challans, Quotations, E-Invoicing &amp; Batch Expiry
            </p>
          </div>
          <button
            type="button"
            onClick={() => void createPreMigrationBackup('Dashboard Manual Checkpoint')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-[#8E0E20] text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <DatabaseBackup className="w-3.5 h-3.5 text-[#8E0E20] dark:text-rose-400" />
            <span>Create Backup Checkpoint</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            {
              label: 'Pending Scanned Bills',
              count: stats.pendingScannedBills,
              icon: ScanLine,
              tab: 'purchase-scanner',
              tone: stats.pendingScannedBills > 0 ? 'text-blue-600' : 'text-slate-900 dark:text-white',
            },
            {
              label: 'Missing / Invalid HSN',
              count: stats.missingHsnCount,
              icon: ShieldCheck,
              tab: 'hsn-gst',
              tone: stats.missingHsnCount > 0 ? 'text-amber-600' : 'text-emerald-600',
            },
            {
              label: 'Open Challans (Unbilled)',
              count: stats.openChallansCount,
              icon: Truck,
              tab: 'delivery-challan',
              tone: stats.openChallansCount > 0 ? 'text-blue-600' : 'text-slate-900 dark:text-white',
            },
            {
              label: 'Quotations Pending',
              count: stats.awaitingQuotationsCount,
              icon: FileText,
              tab: 'estimate-quotation',
              tone: stats.awaitingQuotationsCount > 0 ? 'text-amber-600' : 'text-slate-900 dark:text-white',
            },
            {
              label: 'E-Invoice Queue',
              count: stats.pendingOrFailedEInvCount,
              icon: FileCheck2,
              tab: 'e-invoice',
              tone: stats.pendingOrFailedEInvCount > 0 ? 'text-rose-600' : 'text-emerald-600',
            },
            {
              label: 'Expiring Batches (60d)',
              count: stats.expiringBatchesCount,
              icon: AlertTriangle,
              tab: 'erp-inventory',
              tone: stats.expiringBatchesCount > 0 ? 'text-rose-600' : 'text-emerald-600',
            },
          ].map((tile) => {
            const TileIcon = tile.icon;
            return (
              <button
                key={tile.label}
                type="button"
                onClick={() => setActiveTab(tile.tab)}
                className="text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-[#8E0E20] transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <TileIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className={`text-xl font-extrabold tabular-nums mt-2 ${tile.tone}`}>
                  {tile.count}
                </div>
                <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                  {tile.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 3.9: Payment & Service Reminders Pulse */}
      {(businessSettings.party.enablePaymentReminder ||
        (businessSettings.serviceReminders.enabled && businessSettings.serviceReminders.showOnDashboard)) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Payment Due & Overdue Reminders */}
          {businessSettings.party.enablePaymentReminder && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between gap-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-rose-600" />
                    <span>Payment Due &amp; Overdue Reminders</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Alerting {businessSettings.party.paymentReminderDaysBeforeDue}d before due date &bull; Manual review enabled
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSettingsCategory('party');
                      setActiveTab('settings');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-blue-400 cursor-pointer"
                  >
                    <Settings2 className="w-3 h-3" />
                    <span>Rules</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('customers')}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Parties →
                  </button>
                </div>
              </div>

              {reminderFeed.paymentAlerts.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No invoices due within {businessSettings.party.paymentReminderDaysBeforeDue} days or overdue.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {reminderFeed.paymentAlerts.map((alert) => {
                    const badgeClass =
                      alert.bucket === 'Overdue'
                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        : alert.bucket === 'Due Today'
                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
                    return (
                      <div
                        key={alert.txId}
                        className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {alert.partyName}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${badgeClass}`}>
                              {alert.bucket === 'Overdue'
                                ? `${Math.abs(alert.diffDays)}d overdue`
                                : alert.bucket}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                            #{alert.invoiceNo} &bull; Due {alert.dueDate}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">
                            {fmt(alert.balance)}
                          </span>
                          {businessSettings.party.enableWhatsAppReminderShare && (
                            <a
                              href={alert.whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() =>
                                logPaymentReminderSent({
                                  partyId: alert.partyId,
                                  partyName: alert.partyName,
                                  amountDue: alert.balance,
                                  channel: 'WhatsApp',
                                  messagePreview: alert.messageText,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>Remind</span>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Service & Warranty Reminders */}
          {businessSettings.serviceReminders.enabled && businessSettings.serviceReminders.showOnDashboard && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between gap-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-blue-600" />
                    <span>Service &amp; AMC Follow-up Schedule</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Upcoming maintenance, warranty &amp; customer follow-up tasks
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSettingsCategory('service-reminders');
                    setActiveTab('settings');
                  }}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Manage All →
                </button>
              </div>

              {reminderFeed.activeServices.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  All service reminders are completed. Add schedules in Settings &rarr; Service Reminders.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {reminderFeed.activeServices.map((sr) => {
                    const statusTone =
                      sr.status === 'Overdue'
                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        : sr.status === 'Due Today'
                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800';
                    return (
                      <div
                        key={sr.id}
                        className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {sr.title}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${statusTone}`}>
                              {sr.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            {sr.customerName} &bull; {sr.category} &bull; {sr.reminderDate}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            updateServiceReminder(sr.id, { status: 'Completed' });
                            showToast(`Marked "${sr.title}" completed`, 'success');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold cursor-pointer shrink-0"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Complete</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Row 4: Recent Transactions Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Crimson Header Bar */}
        <div className="bg-gradient-to-r from-[#8E0E20] to-[#740918] px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white">
            <ClipboardList className="w-4 h-4" />
            <h2 className="font-bold text-sm tracking-tight">Recent Transactions</h2>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Filter recent transactions by status"
              value={txStatusFilter}
              onChange={(e) => setTxStatusFilter(e.target.value as TxStatusFilter)}
              className="px-3 py-1 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:outline-none cursor-pointer shadow-2xs"
            >
              <option value="All">All Bills</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Unpaid">Unpaid</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setActiveTab('sale-invoices');
                setActiveSaleSubtype('Sale Invoices');
              }}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>See All</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Payment Mode</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentTxList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 px-4 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <FileSearch className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                      <div className="font-bold text-slate-600 dark:text-slate-300 text-xs">No recent transactions found</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Transactions will appear here once you create bills.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                recentTxList.map((tx) => {
                  const statusBadge =
                    tx.status === 'Paid'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : tx.status === 'Partial'
                      ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white font-mono">{tx.invoiceNo}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 tabular-nums">{tx.date}</td>
                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-semibold">{tx.partyName}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{tx.paymentType}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                        {fmt(tx.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold ${statusBadge}`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoice(tx);
                            setIsInvoicePreviewOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:border-[#8B0D1E] text-slate-600 dark:text-slate-300 hover:text-[#8B0D1E] dark:hover:text-rose-400 text-[11px] font-semibold transition-colors cursor-pointer"
                          title="View & Print Invoice"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
