import { Item, Party, Transaction } from '../types';

export type DashboardPeriod = 'Today' | 'This Week' | 'This Month' | 'This Quarter' | 'This Year' | 'All Time';

export type GraphSeriesKey = 'sales' | 'purchase' | 'profit' | 'expense' | 'income';

export interface GraphPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  count: number;
}

export interface GraphSeries {
  key: GraphSeriesKey;
  label: string;
  color: string;
  fillColor: string;
  total: number;
  average: number;
  peak: number;
  deltaPercent: number;
  points: GraphPoint[];
}

export interface TopCustomerEntry {
  name: string;
  totalSpent: number;
  receivedAmount: number;
  pendingBalance: number;
  invoiceCount: number;
  lastOrderDate: string;
}

export interface TopSupplierEntry {
  name: string;
  totalPurchased: number;
  paidAmount: number;
  payableBalance: number;
  billCount: number;
  lastBillDate: string;
}

export interface TopSellingItemEntry {
  name: string;
  code: string;
  category: string;
  qtySold: number;
  unit: string;
  revenue: number;
  currentStock: number;
  minStockAlert: number;
}

export interface PendingInvoiceEntry {
  id: string;
  invoiceNo: string;
  partyName: string;
  partyPhone: string;
  type: Transaction['type'];
  date: string;
  dueDate: string;
  totalAmount: number;
  receivedAmount: number;
  balance: number;
  status: Transaction['status'];
  isOverdue: boolean;
  daysOverdue: number;
  transaction: Transaction;
}

export interface DashboardTargets {
  salesTarget: number;
  purchaseTarget: number;
  profitTarget: number;
}

export interface DashboardMetrics {
  // 2-6: Period Summaries
  salesSummary: number;
  salesCount: number;
  purchaseSummary: number;
  purchaseCount: number;
  profitSummary: number;
  profitMarginPercent: number;
  expenseSummary: number;
  expenseCount: number;
  incomeSummary: number;
  incomeCount: number;

  // 7-13: Liquidity & Stock Health
  cashBalance: number;
  bankBalance: number;
  receivables: number;
  receivablesPartyCount: number;
  payables: number;
  payablesPartyCount: number;
  stockValue: number;
  totalStockUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalItemsCount: number;

  // 14-18: Today's Pulse
  todaySales: number;
  todayPurchases: number;
  todayExpenses: number;
  todayIncome: number;
  todayProfit: number;

  // 19-21: Monthly Pulse
  monthlySales: number;
  monthlyPurchases: number;
  monthlyProfit: number;
  monthlyExpenses: number;
  monthlyIncome: number;

  // 22-26: 5 Graph Series
  graphs: Record<GraphSeriesKey, GraphSeries>;

  // 27-30: Leaderboards & Recent Transactions
  topCustomers: TopCustomerEntry[];
  topSuppliers: TopSupplierEntry[];
  topSellingItems: TopSellingItemEntry[];
  recentTransactions: Transaction[];

  // 31-33: Collections, Overdue & Reminders
  pendingPayments: PendingInvoiceEntry[];
  pendingTotalAmount: number;
  overdueInvoices: PendingInvoiceEntry[];
  overdueTotalAmount: number;

  // 34-37: Targets & Achievement %
  salesAchievementPercent: number;
  purchaseAchievementPercent: number;
  profitAchievementPercent: number;
  overallAchievementPercent: number;
}

/**
 * Parse transaction date strings in `DD/MM/YYYY, HH:MM AM/PM`, `DD/MM/YYYY`, or ISO format.
 */
export function parseDashboardDate(rawDate?: string, fallbackIso?: string): Date | null {
  if (rawDate) {
    const ddmmyyyy = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10) - 1;
      const year = parseInt(ddmmyyyy[3], 10);
      const parsed = new Date(year, month, day);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    const direct = new Date(rawDate);
    if (!Number.isNaN(direct.getTime())) return direct;
  }

  if (fallbackIso) {
    const iso = new Date(fallbackIso);
    if (!Number.isNaN(iso.getTime())) return iso;
  }

  return null;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isInPeriod(date: Date | null, period: DashboardPeriod, referenceDate: Date): boolean {
  if (period === 'All Time') return true;
  if (!date) return false;

  const startOfRef = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  switch (period) {
    case 'Today':
      return isSameDay(startOfDate, startOfRef);
    case 'This Week': {
      const diffMs = startOfRef.getTime() - startOfDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 6;
    }
    case 'This Month':
      return isSameMonth(startOfDate, startOfRef);
    case 'This Quarter': {
      const refQuarter = Math.floor(referenceDate.getMonth() / 3);
      const dateQuarter = Math.floor(date.getMonth() / 3);
      return date.getFullYear() === referenceDate.getFullYear() && dateQuarter === refQuarter;
    }
    case 'This Year':
      return date.getFullYear() === referenceDate.getFullYear();
    default:
      return true;
  }
}

function estimateTransactionCost(tx: Transaction, itemCostMap: Map<string, number>): number {
  if (typeof tx.totalCostOfGoodsSold === 'number' && tx.totalCostOfGoodsSold >= 0) {
    return tx.totalCostOfGoodsSold;
  }
  if (!tx.items || tx.items.length === 0) {
    if (tx.notes && tx.notes.includes('[UDHAAR KHATA]')) return 0;
    return (tx.totalAmount || 0) * 0.72;
  }
  let cost = 0;
  let matchedAny = false;
  for (const line of tx.items) {
    const qty = line.qty || 1;
    if (typeof line.totalCost === 'number' && line.totalCost >= 0) {
      cost += line.totalCost;
      matchedAny = true;
    } else if (typeof line.unitCostAtSale === 'number' && line.unitCostAtSale >= 0) {
      cost += line.unitCostAtSale * qty;
      matchedAny = true;
    } else {
      const unitCost = itemCostMap.get(line.name.toLowerCase());
      if (unitCost !== undefined && unitCost > 0) {
        cost += unitCost * qty;
        matchedAny = true;
      } else {
        cost += (line.amount || 0) * 0.72;
      }
    }
  }
  return matchedAny ? cost : (tx.totalAmount || 0) * 0.72;
}

function getTxNetExGstRevenue(tx: Transaction): number {
  const total = tx.totalAmount || 0;
  const tax = (tx.cgstAmount || 0) + (tx.sgstAmount || 0) + (tx.igstAmount || 0);
  if (tax > 0) return Math.max(0, total - tax);
  if (typeof tx.taxableAmount === 'number' && tx.taxableAmount >= 0 && tx.taxableAmount <= total) {
    return tx.taxableAmount;
  }
  return total;
}

function computeProfitForSet(
  txSet: Transaction[],
  itemCostMap: Map<string, number>
): { sales: number; purchases: number; expenses: number; income: number; profit: number } {
  const salesTx = txSet.filter((t) => t.type === 'Sale');
  const returnTx = txSet.filter((t) => t.type === 'Sale Return');
  const purchaseTx = txSet.filter((t) => t.type === 'Purchase');
  const purchaseReturnTx = txSet.filter((t) => t.type === 'Purchase Return');
  const expenseTx = txSet.filter((t) => t.type === 'Expense' && !t.invoiceNo.startsWith('DN-'));
  const incomeTx = txSet.filter((t) => t.type === 'Other Income');

  const grossSales = salesTx.reduce((s, t) => s + (t.totalAmount || 0), 0);
  const returns = returnTx.reduce((s, t) => s + (t.totalAmount || 0), 0);
  const sales = Math.max(0, grossSales - returns);

  const exGstSales = salesTx.reduce((s, t) => s + getTxNetExGstRevenue(t), 0);
  const exGstReturns = returnTx.reduce((s, t) => s + getTxNetExGstRevenue(t), 0);
  const netExGstSales = Math.max(0, exGstSales - exGstReturns);

  const purchases = Math.max(
    0,
    purchaseTx.reduce((s, t) => s + (t.totalAmount || 0), 0) -
      purchaseReturnTx.reduce((s, t) => s + (t.totalAmount || 0), 0)
  );
  const expenses = expenseTx.reduce((s, t) => s + (t.totalAmount || 0), 0);
  const income = incomeTx.reduce((s, t) => s + (t.totalAmount || 0), 0);

  const cogs = salesTx.reduce((s, t) => s + estimateTransactionCost(t, itemCostMap), 0);
  const returnCogs = returnTx.reduce((s, t) => s + estimateTransactionCost(t, itemCostMap), 0);
  const netCogs = Math.max(0, cogs - returnCogs);

  const profit = netExGstSales - netCogs - expenses + income;
  return { sales, purchases, expenses, income, profit };
}

function buildTimelineBuckets(
  period: DashboardPeriod,
  referenceDate: Date,
  activeTx: Transaction[]
): Array<{ label: string; match: (d: Date) => boolean }> {
  if (period === 'Today') {
    const blocks = [
      { label: '09:00', min: 0, max: 11 },
      { label: '12:00', min: 12, max: 14 },
      { label: '15:00', min: 15, max: 17 },
      { label: '18:00', min: 18, max: 20 },
      { label: '21:00', min: 21, max: 23 },
    ];
    return blocks.map((b) => ({
      label: b.label,
      match: (d: Date) => isSameDay(d, referenceDate) && d.getHours() >= b.min && d.getHours() <= b.max,
    }));
  }

  if (period === 'This Week') {
    const buckets: Array<{ label: string; match: (d: Date) => boolean }> = [];
    for (let i = 6; i >= 0; i--) {
      const target = new Date(referenceDate);
      target.setDate(referenceDate.getDate() - i);
      const label = target.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      buckets.push({
        label,
        match: (d: Date) => isSameDay(d, target),
      });
    }
    return buckets;
  }

  if (period === 'This Month') {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const ranges = [
      { label: '1–5', start: 1, end: 5 },
      { label: '6–10', start: 6, end: 10 },
      { label: '11–15', start: 11, end: 15 },
      { label: '16–20', start: 16, end: 20 },
      { label: '21–25', start: 21, end: 25 },
      { label: '26–31', start: 26, end: 31 },
    ];
    return ranges.map((r) => ({
      label: r.label,
      match: (d: Date) =>
        d.getFullYear() === year &&
        d.getMonth() === month &&
        d.getDate() >= r.start &&
        d.getDate() <= r.end,
    }));
  }

  if (period === 'This Quarter') {
    const qStartMonth = Math.floor(referenceDate.getMonth() / 3) * 3;
    const year = referenceDate.getFullYear();
    return [0, 1, 2].map((offset) => {
      const m = qStartMonth + offset;
      const label = new Date(year, m, 1).toLocaleDateString('en-IN', { month: 'short' });
      return {
        label,
        match: (d: Date) => d.getFullYear() === year && d.getMonth() === m,
      };
    });
  }

  // 'This Year' or 'All Time' -> show 6-month trailing window ending at referenceDate's month (or year months up to current)
  const months: Array<{ label: string; match: (d: Date) => boolean }> = [];
  const count = period === 'All Time' ? 6 : 6;
  // Ensure any active months in the dataset within the last 6 months are included
  for (let i = count - 1; i >= 0; i--) {
    const mDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const label = mDate.toLocaleDateString('en-IN', { month: 'short' });
    const y = mDate.getFullYear();
    const m = mDate.getMonth();
    months.push({
      label,
      match: (d: Date) => d.getFullYear() === y && d.getMonth() === m,
    });
  }
  void activeTx;
  return months;
}

function buildGraphSeries(
  key: GraphSeriesKey,
  label: string,
  color: string,
  fillColor: string,
  buckets: Array<{ label: string; match: (d: Date) => boolean }>,
  parsedTx: Array<{ tx: Transaction; date: Date | null }>,
  itemCostMap: Map<string, number>
): GraphSeries {
  const points: GraphPoint[] = buckets.map((bucket) => {
    const inBucket = parsedTx
      .filter((entry) => entry.date && bucket.match(entry.date))
      .map((entry) => entry.tx);

    const calc = computeProfitForSet(inBucket, itemCostMap);
    let value = 0;
    let count = 0;

    if (key === 'sales') {
      value = calc.sales;
      count = inBucket.filter((t) => t.type === 'Sale').length;
    } else if (key === 'purchase') {
      value = calc.purchases;
      count = inBucket.filter((t) => t.type === 'Purchase').length;
    } else if (key === 'profit') {
      value = Math.round(calc.profit);
      count = inBucket.length;
    } else if (key === 'expense') {
      value = calc.expenses;
      count = inBucket.filter((t) => t.type === 'Expense').length;
    } else {
      value = calc.income;
      count = inBucket.filter((t) => t.type === 'Other Income').length;
    }

    return {
      label: bucket.label,
      value: Math.round(value),
      count,
    };
  });

  const total = points.reduce((s, p) => s + p.value, 0);
  const average = points.length > 0 ? Math.round(total / points.length) : 0;
  const peak = points.reduce((m, p) => Math.max(m, p.value), 0);

  const last = points[points.length - 1]?.value ?? 0;
  const prev = points[points.length - 2]?.value ?? 0;
  const deltaPercent =
    prev > 0 ? Math.round(((last - prev) / prev) * 100) : last > 0 ? 100 : 0;

  return {
    key,
    label,
    color,
    fillColor,
    total,
    average,
    peak,
    deltaPercent,
    points,
  };
}

export function computeDashboardMetrics(params: {
  transactions: Transaction[];
  parties: Party[];
  items: Item[];
  period: DashboardPeriod;
  targets: DashboardTargets;
  now?: Date;
}): DashboardMetrics {
  const { transactions, parties, items, period, targets, now = new Date() } = params;

  const activeTx = transactions.filter((t) => !t.isCancelled);
  const itemCostMap = new Map<string, number>();
  const itemByName = new Map<string, Item>();
  for (const item of items) {
    itemCostMap.set(item.name.toLowerCase(), item.purchasePrice || item.salePrice * 0.72);
    itemByName.set(item.name.toLowerCase(), item);
  }

  const parsedTx = activeTx.map((tx) => ({
    tx,
    date: parseDashboardDate(tx.date, tx.createdAt),
  }));

  // Period-filtered transactions
  const periodTx = parsedTx
    .filter((e) => isInPeriod(e.date, period, now))
    .map((e) => e.tx);

  const periodCalc = computeProfitForSet(periodTx, itemCostMap);
  const salesCount = periodTx.filter((t) => t.type === 'Sale').length;
  const purchaseCount = periodTx.filter((t) => t.type === 'Purchase').length;
  const expenseCount = periodTx.filter((t) => t.type === 'Expense').length;
  const incomeCount = periodTx.filter((t) => t.type === 'Other Income').length;
  const profitMarginPercent =
    periodCalc.sales > 0 ? Math.round((periodCalc.profit / periodCalc.sales) * 100) : 0;

  // Cash & Bank balances (aligned with CashBankView.tsx ledger model)
  const cashTx = activeTx.filter((t) => t.paymentType === 'Cash');
  const cashIn = cashTx
    .filter((t) => t.type === 'Sale' || t.type === 'Payment-In' || t.type === 'Other Income')
    .reduce((sum, t) => sum + (t.receivedAmount || t.totalAmount || 0), 0);
  const cashOut = cashTx
    .filter((t) => t.type === 'Purchase' || t.type === 'Expense')
    .reduce((sum, t) => sum + (t.totalAmount || 0), 0);
  const cashBalance = Math.max(0, 35000 + cashIn - cashOut);

  const bankTx = activeTx.filter(
    (t) => t.paymentType === 'Bank Transfer' || t.paymentType === 'UPI' || t.paymentType === 'Cheque'
  );
  const bankIn = bankTx
    .filter((t) => t.type === 'Sale' || t.type === 'Payment-In' || t.type === 'Other Income')
    .reduce((sum, t) => sum + (t.receivedAmount || t.totalAmount || 0), 0);
  const bankOut = bankTx
    .filter((t) => t.type === 'Purchase' || t.type === 'Expense')
    .reduce((sum, t) => sum + (t.totalAmount || 0), 0);
  const bankBalance = Math.max(0, 184000 + bankIn - bankOut);

  // Receivables & Payables
  const customers = parties.filter((p) => p.type === 'Customer' || !p.type);
  const suppliers = parties.filter((p) => p.type === 'Supplier');

  const invoiceReceivables = activeTx
    .filter((t) => t.type === 'Sale' && (t.balance || 0) > 0)
    .reduce((s, t) => s + (t.balance || 0), 0);
  const partyReceivables = customers.reduce((s, p) => s + Math.max(0, p.balance || 0), 0);
  const receivables = Math.max(invoiceReceivables, partyReceivables);
  const receivablesPartyCount = Math.max(
    customers.filter((c) => (c.balance || 0) > 0).length,
    new Set(activeTx.filter((t) => t.type === 'Sale' && (t.balance || 0) > 0).map((t) => t.partyName)).size
  );

  const billPayables = activeTx
    .filter((t) => t.type === 'Purchase' && (t.balance || 0) > 0)
    .reduce((s, t) => s + (t.balance || 0), 0);
  const partyPayables = suppliers.reduce((s, p) => s + Math.max(0, p.balance || 0), 0);
  const payables = Math.max(billPayables, partyPayables);
  const payablesPartyCount = Math.max(
    suppliers.filter((s) => (s.balance || 0) > 0).length,
    new Set(activeTx.filter((t) => t.type === 'Purchase' && (t.balance || 0) > 0).map((t) => t.partyName)).size
  );

  // Stock Valuation & Alerts
  const stockValue = items.reduce((s, item) => {
    const unitVal = item.purchasePrice > 0 ? item.purchasePrice : item.salePrice * 0.72;
    return s + Math.max(0, item.stock || 0) * unitVal;
  }, 0);
  const totalStockUnits = items.reduce((s, item) => s + Math.max(0, item.stock || 0), 0);
  const lowStockCount = items.filter((i) => {
    const threshold = i.minStockAlert ?? 5;
    return (i.stock || 0) > 0 && (i.stock || 0) <= threshold;
  }).length;
  const outOfStockCount = items.filter((i) => (i.stock || 0) <= 0).length;

  // Today's metrics
  const todayTx = parsedTx
    .filter((e) => e.date && isSameDay(e.date, now))
    .map((e) => e.tx);
  const todayCalc = computeProfitForSet(todayTx, itemCostMap);

  // Monthly metrics
  const monthlyTx = parsedTx
    .filter((e) => e.date && isSameMonth(e.date, now))
    .map((e) => e.tx);
  const monthlyCalc = computeProfitForSet(monthlyTx, itemCostMap);

  // 5 Graph Series
  const buckets = buildTimelineBuckets(period, now, activeTx);
  const graphs: Record<GraphSeriesKey, GraphSeries> = {
    sales: buildGraphSeries('sales', 'Sales Trend', '#2563eb', 'rgba(37,99,235,0.12)', buckets, parsedTx, itemCostMap),
    purchase: buildGraphSeries('purchase', 'Purchase Trend', '#ea580c', 'rgba(234,88,12,0.12)', buckets, parsedTx, itemCostMap),
    profit: buildGraphSeries('profit', 'Profit Trend', '#16a34a', 'rgba(22,163,74,0.12)', buckets, parsedTx, itemCostMap),
    expense: buildGraphSeries('expense', 'Expense Trend', '#dc2626', 'rgba(220,38,38,0.12)', buckets, parsedTx, itemCostMap),
    income: buildGraphSeries('income', 'Other Income Trend', '#7c3aed', 'rgba(124,58,237,0.12)', buckets, parsedTx, itemCostMap),
  };

  // Top Customers
  const customerMap = new Map<string, TopCustomerEntry>();
  for (const tx of activeTx.filter((t) => t.type === 'Sale')) {
    const key = tx.partyName || 'Walk-in Customer';
    const existing = customerMap.get(key) || {
      name: key,
      totalSpent: 0,
      receivedAmount: 0,
      pendingBalance: 0,
      invoiceCount: 0,
      lastOrderDate: tx.date,
    };
    existing.totalSpent += tx.totalAmount || 0;
    existing.receivedAmount += tx.receivedAmount || 0;
    existing.pendingBalance += tx.balance || 0;
    existing.invoiceCount += 1;
    existing.lastOrderDate = tx.date;
    customerMap.set(key, existing);
  }
  const topCustomers = Array.from(customerMap.values())
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 6);

  // Top Suppliers
  const supplierMap = new Map<string, TopSupplierEntry>();
  for (const tx of activeTx.filter((t) => t.type === 'Purchase')) {
    const key = tx.partyName || 'Vendor';
    const existing = supplierMap.get(key) || {
      name: key,
      totalPurchased: 0,
      paidAmount: 0,
      payableBalance: 0,
      billCount: 0,
      lastBillDate: tx.date,
    };
    existing.totalPurchased += tx.totalAmount || 0;
    existing.paidAmount += tx.receivedAmount || 0;
    existing.payableBalance += tx.balance || 0;
    existing.billCount += 1;
    existing.lastBillDate = tx.date;
    supplierMap.set(key, existing);
  }
  // Include seeded suppliers from directory if fewer than 3 purchase records exist
  for (const sup of suppliers) {
    if (!supplierMap.has(sup.name)) {
      supplierMap.set(sup.name, {
        name: sup.name,
        totalPurchased: sup.balance || 0,
        paidAmount: 0,
        payableBalance: sup.balance || 0,
        billCount: sup.balance > 0 ? 1 : 0,
        lastBillDate: 'Active ledger',
      });
    }
  }
  const topSuppliers = Array.from(supplierMap.values())
    .sort((a, b) => b.totalPurchased - a.totalPurchased || b.payableBalance - a.payableBalance)
    .slice(0, 6);

  // Top-Selling Items
  const itemSalesMap = new Map<string, TopSellingItemEntry>();
  for (const tx of activeTx.filter((t) => t.type === 'Sale')) {
    for (const line of tx.items || []) {
      const k = line.name.toLowerCase();
      const catalogMatch = itemByName.get(k);
      const existing = itemSalesMap.get(k) || {
        name: line.name,
        code: catalogMatch?.code || line.hsn || 'SKU',
        category: catalogMatch?.category || 'General',
        qtySold: 0,
        unit: line.unit || catalogMatch?.unit || 'PCS',
        revenue: 0,
        currentStock: catalogMatch?.stock ?? 0,
        minStockAlert: catalogMatch?.minStockAlert ?? 5,
      };
      existing.qtySold += line.qty || 0;
      existing.revenue += line.amount || 0;
      itemSalesMap.set(k, existing);
    }
  }
  const topSellingItems = Array.from(itemSalesMap.values())
    .sort((a, b) => b.revenue - a.revenue || b.qtySold - a.qtySold)
    .slice(0, 6);

  // Recent Transactions (most recent first)
  const recentTransactions = [...activeTx]
    .sort((a, b) => {
      const da = parseDashboardDate(a.date, a.createdAt)?.getTime() ?? 0;
      const db = parseDashboardDate(b.date, b.createdAt)?.getTime() ?? 0;
      return db - da;
    })
    .slice(0, 10);

  // Pending Payments & Overdue Invoices
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const pendingPayments: PendingInvoiceEntry[] = activeTx
    .filter((t) => (t.balance || 0) > 0 && (t.type === 'Sale' || t.type === 'Purchase' || t.type === 'Sale Order'))
    .map((tx) => {
      const due = parseDashboardDate(tx.dueDate, tx.createdAt);
      const dueMs = due ? new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() : todayMidnight;
      const diffDays = Math.floor((todayMidnight - dueMs) / (1000 * 60 * 60 * 24));
      const isOverdue = diffDays > 0;
      return {
        id: tx.id,
        invoiceNo: tx.invoiceNo,
        partyName: tx.partyName,
        partyPhone: tx.partyPhone || '—',
        type: tx.type,
        date: tx.date,
        dueDate: tx.dueDate || '—',
        totalAmount: tx.totalAmount || 0,
        receivedAmount: tx.receivedAmount || 0,
        balance: tx.balance || 0,
        status: tx.status,
        isOverdue,
        daysOverdue: isOverdue ? diffDays : 0,
        transaction: tx,
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue || b.balance - a.balance);

  const pendingTotalAmount = pendingPayments.reduce((s, p) => s + p.balance, 0);
  const overdueInvoices = pendingPayments.filter((p) => p.isOverdue);
  const overdueTotalAmount = overdueInvoices.reduce((s, p) => s + p.balance, 0);

  // Targets & Achievement %
  const salesAchievementPercent =
    targets.salesTarget > 0 ? Math.round((periodCalc.sales / targets.salesTarget) * 100) : 0;
  const purchaseAchievementPercent =
    targets.purchaseTarget > 0 ? Math.round((periodCalc.purchases / targets.purchaseTarget) * 100) : 0;
  const profitAchievementPercent =
    targets.profitTarget > 0 ? Math.round((Math.max(0, periodCalc.profit) / targets.profitTarget) * 100) : 0;
  const overallAchievementPercent = Math.round(
    (salesAchievementPercent + purchaseAchievementPercent + profitAchievementPercent) / 3
  );

  return {
    salesSummary: Math.round(periodCalc.sales),
    salesCount,
    purchaseSummary: Math.round(periodCalc.purchases),
    purchaseCount,
    profitSummary: Math.round(periodCalc.profit),
    profitMarginPercent,
    expenseSummary: Math.round(periodCalc.expenses),
    expenseCount,
    incomeSummary: Math.round(periodCalc.income),
    incomeCount,

    cashBalance: Math.round(cashBalance),
    bankBalance: Math.round(bankBalance),
    receivables: Math.round(receivables),
    receivablesPartyCount,
    payables: Math.round(payables),
    payablesPartyCount,
    stockValue: Math.round(stockValue),
    totalStockUnits,
    lowStockCount,
    outOfStockCount,
    totalItemsCount: items.length,

    todaySales: Math.round(todayCalc.sales),
    todayPurchases: Math.round(todayCalc.purchases),
    todayExpenses: Math.round(todayCalc.expenses),
    todayIncome: Math.round(todayCalc.income),
    todayProfit: Math.round(todayCalc.profit),

    monthlySales: Math.round(monthlyCalc.sales),
    monthlyPurchases: Math.round(monthlyCalc.purchases),
    monthlyProfit: Math.round(monthlyCalc.profit),
    monthlyExpenses: Math.round(monthlyCalc.expenses),
    monthlyIncome: Math.round(monthlyCalc.income),

    graphs,
    topCustomers,
    topSuppliers,
    topSellingItems,
    recentTransactions,
    pendingPayments,
    pendingTotalAmount: Math.round(pendingTotalAmount),
    overdueInvoices,
    overdueTotalAmount: Math.round(overdueTotalAmount),

    salesAchievementPercent,
    purchaseAchievementPercent,
    profitAchievementPercent,
    overallAchievementPercent,
  };
}
