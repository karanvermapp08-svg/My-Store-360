import React, { useState, useMemo } from 'react';
import {
  BarChart2,
  TrendingUp,
  ShoppingCart,
  Package,
  Scale,
  Landmark,
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  Layers,
  GitCompare,
  Table2,
  BookOpen,
  CalendarDays,
  UserCheck,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import {
  calculateRealProfitSummary,
  getAgingBucket,
  getDaysOverdue,
  parseAnyDate,
} from '../utils/erpEngine';
import {
  computeComprehensivePL,
  getIndianFinancialYearRange,
  PLPeriodFilter,
} from '../utils/profitEngine';
import { isValidHsnOrSac } from '../data/hsnMasterIndia';
import { formatBaseQtyHuman, isWeightOrVolumeUnit } from '../utils/kiranaBilling';

type ReportTab =
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'financial'
  | 'kirana-analytics'
  | 'customer-profit'
  | 'discount-impact'
  | 'gst'
  | 'outstanding'
  | 'party-statement'
  | 'day-book'
  | 'staff-commission'
  | 'comparison'
  | 'custom'
  | 'expenses'
  | 'income';

export const ReportsHubView: React.FC = () => {
  const {
    transactions,
    parties,
    items,
    batches,
    journalVouchers,
    discountApprovals,
    businessSettings,
    company,
    employees,
    setActiveTab,
    exportCurrentViewPdf,
    showToast,
  } = useVyapar();

  const [reportCategory, setReportCategory] = useState<ReportTab>('sales');
  const [selectedPartyStmtId, setSelectedPartyStmtId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<
    'All' | 'Today' | 'Last 7 Days' | 'This Month' | 'FY 2026-27' | 'FY 2025-26'
  >('All');

  // Custom Report Builder state
  const [customSource, setCustomSource] = useState<'sales' | 'purchases' | 'items' | 'customers' | 'suppliers'>('sales');
  const [hiddenCols, setHiddenCols] = useState<Record<string, boolean>>({});
  const [cpbFilter, setCpbFilter] = useState('');

  const fmt = (val: number | undefined | null) =>
    '₹ ' + (Number(val) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const dateFilteredTx = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const q = search.trim().toLowerCase();

    return transactions.filter((t) => {
      if (t.isCancelled) return false;
      if (q) {
        const match =
          (t.invoiceNo || '').toLowerCase().includes(q) ||
          (t.partyName || '').toLowerCase().includes(q) ||
          (t.paymentType || '').toLowerCase().includes(q) ||
          (t.notes || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (dateRange === 'All') return true;
      const dt = parseAnyDate(t.date);
      if (!dt) return false;
      if (dateRange === 'Today') return dt.toDateString() === todayStr;
      if (dateRange === 'Last 7 Days') {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);
        return dt >= weekAgo;
      }
      if (dateRange === 'This Month') {
        return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
      }
      if (dateRange === 'FY 2026-27') {
        const fy = getIndianFinancialYearRange(2026);
        return dt >= fy.start && dt <= fy.end;
      }
      if (dateRange === 'FY 2025-26') {
        const fy = getIndianFinancialYearRange(2025);
        return dt >= fy.start && dt <= fy.end;
      }
      return true;
    });
  }, [transactions, search, dateRange]);

  const salesTx = useMemo(() => dateFilteredTx.filter((t) => t.type === 'Sale'), [dateFilteredTx]);
  const purchaseTx = useMemo(() => dateFilteredTx.filter((t) => t.type === 'Purchase'), [dateFilteredTx]);
  const expenseTx = useMemo(() => dateFilteredTx.filter((t) => t.type === 'Expense'), [dateFilteredTx]);
  const incomeTx = useMemo(() => dateFilteredTx.filter((t) => t.type === 'Other Income'), [dateFilteredTx]);

  // Unified Profit & Loss Engine (ex-GST revenue, locked historical COGS & active costing method)
  const comprehensivePL = useMemo(() => {
    const periodMap: Record<typeof dateRange, PLPeriodFilter> = {
      All: 'All Time',
      Today: 'Today',
      'Last 7 Days': 'This Week',
      'This Month': 'This Month',
      'FY 2026-27': 'Financial Year',
      'FY 2025-26': 'Financial Year',
    };
    const fyYear = dateRange === 'FY 2025-26' ? 2025 : 2026;
    return computeComprehensivePL({
      transactions,
      items,
      parties,
      batches,
      journalVouchers,
      discountApprovals,
      settings: businessSettings,
      period: periodMap[dateRange],
      fyStartYear: fyYear,
    });
  }, [transactions, items, parties, batches, journalVouchers, discountApprovals, businessSettings, dateRange]);

  // Real COGS & Profitability Summary aligned with P&L Engine
  const profitSummary = useMemo(() => {
    const legacy = calculateRealProfitSummary(dateFilteredTx, items);
    const tpl = comprehensivePL.tradingAndPL;
    return {
      ...legacy,
      salesRevenue: tpl.netSalesExGst,
      cogs: tpl.cogs,
      grossProfit: tpl.grossProfit,
      grossMarginPercent: tpl.grossMarginPercent,
      totalPurchases: tpl.netPurchasesExGst,
      totalExpenses: tpl.indirectExpensesTotal,
      otherIncome: tpl.otherIncome,
      netProfit: tpl.netProfit,
    };
  }, [dateFilteredTx, items, comprehensivePL]);

  const avgInvoiceValue = salesTx.length > 0 ? profitSummary.salesRevenue / salesTx.length : 0;

  // Compute exact line-level GST slabs & HSN summary from real transactions
  const gstMetrics = useMemo(() => {
    const slabMap = new Map<number, { rate: number; taxable: number; cgst: number; sgst: number; igst: number; totalTax: number }>();
    const hsnMap = new Map<string, { hsn: string; qty: number; taxable: number; tax: number; total: number }>();

    let outputGst = 0;
    let inputGst = 0;

    const getTxTaxes = (tx: typeof salesTx[number]) => {
      if (tx.items && tx.items.length > 0) {
        return tx.items.map((l) => {
          const lineBase = l.qty * l.price * (1 - (l.discountPercent || 0) / 100);
          const taxAmt = (lineBase * (l.taxPercent || 0)) / 100;
          return { hsn: l.hsn || 'GENERAL', qty: l.qty, rate: l.taxPercent || 0, taxable: lineBase, taxAmt };
        });
      }
      const txTax = (tx.cgstAmount || 0) + (tx.sgstAmount || 0) + (tx.igstAmount || 0);
      const fallbackRate = txTax > 0 && tx.totalAmount > txTax
        ? Math.round((txTax / (tx.totalAmount - txTax)) * 100)
        : 0;
      const taxable = Math.max(0, (tx.totalAmount || 0) - txTax);
      return [{ hsn: 'GENERAL', qty: 1, rate: fallbackRate, taxable, taxAmt: txTax }];
    };

    salesTx.forEach((tx) => {
      const isInter = tx.gstType === 'Inter-State';
      getTxTaxes(tx).forEach((row) => {
        outputGst += row.taxAmt;
        const sPrev = slabMap.get(row.rate) || { rate: row.rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
        sPrev.taxable += row.taxable;
        if (isInter) sPrev.igst += row.taxAmt;
        else {
          sPrev.cgst += row.taxAmt / 2;
          sPrev.sgst += row.taxAmt / 2;
        }
        sPrev.totalTax += row.taxAmt;
        slabMap.set(row.rate, sPrev);

        const hPrev = hsnMap.get(row.hsn) || { hsn: row.hsn, qty: 0, taxable: 0, tax: 0, total: 0 };
        hPrev.qty += row.qty;
        hPrev.taxable += row.taxable;
        hPrev.tax += row.taxAmt;
        hPrev.total += row.taxable + row.taxAmt;
        hsnMap.set(row.hsn, hPrev);
      });
    });

    const hsnPurchaseMap = new Map<string, { hsn: string; qty: number; taxable: number; tax: number; total: number }>();

    purchaseTx.forEach((tx) => {
      getTxTaxes(tx).forEach((row) => {
        inputGst += row.taxAmt;
        const hp = hsnPurchaseMap.get(row.hsn) || { hsn: row.hsn, qty: 0, taxable: 0, tax: 0, total: 0 };
        hp.qty += row.qty;
        hp.taxable += row.taxable;
        hp.tax += row.taxAmt;
        hp.total += row.taxable + row.taxAmt;
        hsnPurchaseMap.set(row.hsn, hp);
      });
    });

    const missingHsnItemsCount = items.filter((it) => {
      const code = (it.hsnCode || it.sacCode || '').trim();
      return !code || !isValidHsnOrSac(code) || !it.taxClassificationVerified;
    }).length;

    return {
      outputGst,
      inputGst,
      netGstPayable: Math.max(0, outputGst - inputGst),
      slabs: Array.from(slabMap.values()).sort((a, b) => b.rate - a.rate),
      hsnList: Array.from(hsnMap.values()).sort((a, b) => b.total - a.total),
      hsnPurchases: Array.from(hsnPurchaseMap.values()).sort((a, b) => b.total - a.total),
      missingHsnItemsCount,
    };
  }, [salesTx, purchaseTx, items]);

  // Period Comparison Metrics (Today vs Yesterday, This Month vs Last Month)
  const comparisonData = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    const yestStr = yest.toDateString();

    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const prevMonthDate = new Date(curYear, curMonth - 1, 1);
    const prevMonth = prevMonthDate.getMonth();
    const prevYear = prevMonthDate.getFullYear();

    const calcSpan = (filterFn: (dt: Date) => boolean) => {
      const spanTx = transactions.filter((t) => {
        if (t.isCancelled) return false;
        const dt = parseAnyDate(t.date);
        return dt ? filterFn(dt) : false;
      });
      const prof = calculateRealProfitSummary(spanTx, items);
      return {
        sales: prof.salesRevenue,
        purchases: prof.totalPurchases,
        expenses: prof.totalExpenses,
        netProfit: prof.netProfit,
        bills: spanTx.filter((t) => t.type === 'Sale').length,
      };
    };

    return {
      today: calcSpan((d) => d.toDateString() === todayStr),
      yesterday: calcSpan((d) => d.toDateString() === yestStr),
      thisMonth: calcSpan((d) => d.getMonth() === curMonth && d.getFullYear() === curYear),
      lastMonth: calcSpan((d) => d.getMonth() === prevMonth && d.getFullYear() === prevYear),
    };
  }, [transactions, items]);

  // Item Profitability & Filtered Inventory
  const inventoryRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const soldMap = new Map<string, { qty: number; revenue: number }>();
    salesTx.forEach((tx) => {
      tx.items.forEach((l) => {
        const prev = soldMap.get(l.name) || { qty: 0, revenue: 0 };
        prev.qty += l.qty || 0;
        prev.revenue += l.amount || l.qty * l.price;
        soldMap.set(l.name, prev);
      });
    });

    return items
      .filter((i) => !q || i.name.toLowerCase().includes(q) || (i.code || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q))
      .map((i) => {
        const sold = soldMap.get(i.name) || { qty: 0, revenue: 0 };
        const costOfSold = sold.qty * (i.purchasePrice || 0);
        const estProfit = sold.revenue - costOfSold;
        return { ...i, soldQty: sold.qty, soldRevenue: sold.revenue, estProfit };
      });
  }, [items, salesTx, search]);

  // Custom Report Builder Dataset
  const customDataset = useMemo(() => {
    if (customSource === 'sales') {
      return {
        columns: ['Invoice #', 'Date', 'Customer', 'Mode', 'Tax', 'Amount', 'Status'],
        rows: salesTx.map((s) => {
          const tax = (s.cgstAmount || 0) + (s.sgstAmount || 0) + (s.igstAmount || 0);
          return [s.invoiceNo, s.date, s.partyName, s.paymentType, tax, s.totalAmount, s.status];
        }),
      };
    }
    if (customSource === 'purchases') {
      return {
        columns: ['Bill #', 'Date', 'Supplier', 'Mode', 'Amount', 'Status'],
        rows: purchaseTx.map((p) => [p.invoiceNo, p.date, p.partyName, p.paymentType, p.totalAmount, p.status]),
      };
    }
    if (customSource === 'items') {
      return {
        columns: ['SKU', 'Name', 'Category', 'Stock', 'Cost Price', 'Sale Price', 'Stock Value'],
        rows: inventoryRows.map((i) => [i.code, i.name, i.category || 'General', i.stock, i.purchasePrice || 0, i.salePrice, (i.stock || 0) * (i.purchasePrice || 0)]),
      };
    }
    const typeMatch = customSource === 'suppliers' ? 'Supplier' : 'Customer';
    const filteredParties = parties.filter((p) => (p.type || 'Customer') === typeMatch);
    return {
      columns: ['Name', 'Phone', 'Email', 'GSTIN', 'State', 'Outstanding'],
      rows: filteredParties.map((p) => [p.name, p.phone || '', p.email || '', p.gstin || '', p.state || '', p.balance || 0]),
    };
  }, [customSource, salesTx, purchaseTx, inventoryRows, parties]);

  // Party Statement Ledger
  const selectedPartyObj = useMemo(
    () => parties.find((p) => p.id === selectedPartyStmtId) || parties[0] || null,
    [parties, selectedPartyStmtId]
  );

  const partyStatementRows = useMemo(() => {
    if (!selectedPartyObj) return [];
    const targetName = selectedPartyObj.name.trim().toLowerCase();
    const isSup = selectedPartyObj.type === 'Supplier';
    const matching = dateFilteredTx
      .filter((t) => (t.partyName || '').trim().toLowerCase() === targetName)
      .slice()
      .sort((a, b) => {
        const da = parseAnyDate(a.date)?.getTime() || 0;
        const db = parseAnyDate(b.date)?.getTime() || 0;
        return da - db;
      });

    let running = 0;
    return matching.map((tx) => {
      const amt = Number(tx.totalAmount) || 0;
      let debit = 0;
      let credit = 0;
      const isPayOutVoucher =
        tx.type === 'Purchase' &&
        ((tx.invoiceNo || '').startsWith('PAY-OUT') || (tx.notes || '').startsWith('Payment-Out'));
      if (!isSup) {
        if (tx.type === 'Sale') debit = amt;
        else if (tx.type === 'Payment-In' || tx.type === 'Sale Return') credit = amt;
        running += debit - credit;
      } else {
        if (tx.type === 'Purchase' && !isPayOutVoucher) credit = amt;
        else if (isPayOutVoucher || tx.type === 'Purchase Return') debit = amt;
        running += credit - debit;
      }
      return {
        id: tx.id,
        date: tx.date,
        invoiceNo: tx.invoiceNo,
        type: isPayOutVoucher ? 'Payment-Out' : tx.type,
        paymentType: tx.paymentType,
        debit,
        credit,
        runningBalance: running,
      };
    });
  }, [selectedPartyObj, dateFilteredTx]);

  // Day Book Chronological Register
  const dayBookRows = useMemo(() => {
    return dateFilteredTx
      .slice()
      .sort((a, b) => {
        const da = parseAnyDate(a.date)?.getTime() || 0;
        const db = parseAnyDate(b.date)?.getTime() || 0;
        return db - da;
      })
      .map((tx) => {
        const isInflow =
          tx.type === 'Sale' || tx.type === 'Payment-In' || tx.type === 'Other Income' || tx.type === 'Purchase Return';
        const isOutflow =
          tx.type === 'Purchase' || tx.type === 'Expense' || tx.type === 'Sale Return';
        const inflow = isInflow ? tx.receivedAmount || (tx.type === 'Sale' ? 0 : tx.totalAmount) : 0;
        const outflow = isOutflow ? tx.totalAmount || 0 : 0;
        return { ...tx, inflow, outflow };
      });
  }, [dateFilteredTx]);

  // Staff Commission & Sales Leaderboard
  const staffCommissionRows = useMemo(() => {
    const map = new Map<string, { name: string; role: string; rate: number; bills: number; totalSales: number; commission: number }>();
    employees.forEach((emp) => {
      map.set(emp.name.trim().toLowerCase(), {
        name: emp.name,
        role: emp.roleName || emp.designation,
        rate: emp.commissionRatePercent || 0,
        bills: 0,
        totalSales: 0,
        commission: 0,
      });
    });
    salesTx.forEach((tx) => {
      const actor = (tx.salesperson || tx.user || 'Counter Staff').trim();
      const key = actor.toLowerCase();
      const existing = map.get(key) || {
        name: actor,
        role: 'Sales Staff',
        rate: 0,
        bills: 0,
        totalSales: 0,
        commission: 0,
      };
      existing.bills += 1;
      existing.totalSales += tx.totalAmount || 0;
      existing.commission = Math.round((existing.totalSales * existing.rate) / 100);
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.totalSales - a.totalSales);
  }, [employees, salesTx]);

  // Kirana Weight, Collection & Product-Brand Analytics
  const kiranaAnalytics = useMemo(() => {
    const returnTx = dateFilteredTx.filter((t) => t.type === 'Sale Return');
    const itemById = new Map(items.map((i) => [i.id, i]));
    const itemByName = new Map(items.map((i) => [i.name.trim().toLowerCase(), i]));

    const weightProdMap = new Map<
      string,
      {
        name: string;
        brand: string;
        unit: string;
        isLooseOrWeight: boolean;
        soldQty: number;
        returnedQty: number;
        netQty: number;
        billCount: number;
        grossSales: number;
        cogs: number;
        grossProfit: number;
      }
    >();

    const modeMap = new Map<string, { mode: string; count: number; amount: number; collected: number }>();
    let totalDiscounts = 0;

    salesTx.forEach((tx) => {
      const modeKey = (tx.paymentType || 'Cash').trim();
      const prevMode = modeMap.get(modeKey) || { mode: modeKey, count: 0, amount: 0, collected: 0 };
      prevMode.count += 1;
      prevMode.amount += Number(tx.totalAmount) || 0;
      prevMode.collected += Number(tx.receivedAmount) || 0;
      modeMap.set(modeKey, prevMode);

      totalDiscounts += Number(tx.totalDiscount) || Number(tx.invoiceDiscountValue) || 0;

      (tx.items || []).forEach((li) => {
        const master =
          (li.itemId ? itemById.get(li.itemId) : undefined) ||
          itemByName.get((li.name || '').trim().toLowerCase());
        const unit = master?.unit || li.unit || 'PCS';
        const key = (master?.name || li.name || 'Item').trim().toLowerCase();
        const isLooseOrWeight =
          master?.productType === 'Loose' || isWeightOrVolumeUnit(unit) || isWeightOrVolumeUnit(li.unit || '');
        const qty = Number(li.qty) || 0;
        const lineAmt = Number(li.amount) || qty * (Number(li.price) || 0);
        const lineCogs =
          typeof li.totalCost === 'number'
            ? li.totalCost
            : typeof li.unitCostAtSale === 'number'
            ? li.unitCostAtSale * qty
            : (master?.weightedAvgCost ?? master?.purchasePrice ?? 0) * qty;

        const prev = weightProdMap.get(key) || {
          name: master?.name || li.name,
          brand: master?.brand || 'General',
          unit,
          isLooseOrWeight,
          soldQty: 0,
          returnedQty: 0,
          netQty: 0,
          billCount: 0,
          grossSales: 0,
          cogs: 0,
          grossProfit: 0,
        };
        prev.soldQty += qty;
        prev.netQty += qty;
        prev.billCount += 1;
        prev.grossSales += lineAmt;
        prev.cogs += lineCogs;
        prev.grossProfit = prev.grossSales - prev.cogs;
        weightProdMap.set(key, prev);
      });
    });

    let totalReturnsValue = 0;
    returnTx.forEach((tx) => {
      totalReturnsValue += Number(tx.totalAmount) || 0;
      (tx.items || []).forEach((li) => {
        const master =
          (li.itemId ? itemById.get(li.itemId) : undefined) ||
          itemByName.get((li.name || '').trim().toLowerCase());
        const unit = master?.unit || li.unit || 'PCS';
        const key = (master?.name || li.name || 'Item').trim().toLowerCase();
        const qty = Number(li.qty) || 0;
        const lineAmt = Number(li.amount) || qty * (Number(li.price) || 0);
        const lineCogs =
          typeof li.totalCost === 'number'
            ? li.totalCost
            : typeof li.unitCostAtSale === 'number'
            ? li.unitCostAtSale * qty
            : (master?.weightedAvgCost ?? master?.purchasePrice ?? 0) * qty;
        const prev = weightProdMap.get(key) || {
          name: master?.name || li.name,
          brand: master?.brand || 'General',
          unit,
          isLooseOrWeight: master?.productType === 'Loose' || isWeightOrVolumeUnit(unit),
          soldQty: 0,
          returnedQty: 0,
          netQty: 0,
          billCount: 0,
          grossSales: 0,
          cogs: 0,
          grossProfit: 0,
        };
        prev.returnedQty += qty;
        prev.netQty = Math.max(0, prev.netQty - qty);
        prev.grossSales = Math.max(0, prev.grossSales - lineAmt);
        prev.cogs = Math.max(0, prev.cogs - lineCogs);
        prev.grossProfit = prev.grossSales - prev.cogs;
        weightProdMap.set(key, prev);
      });
    });

    const weightProducts = Array.from(weightProdMap.values()).sort((a, b) => b.grossSales - a.grossSales);
    const paymentModes = Array.from(modeMap.values()).sort((a, b) => b.amount - a.amount);

    const cashTotal = paymentModes
      .filter((m) => m.mode.toLowerCase().includes('cash'))
      .reduce((s, m) => s + m.collected, 0);
    const digitalTotal = paymentModes
      .filter((m) => ['upi', 'bank', 'card', 'online', 'neft', 'imps'].some((k) => m.mode.toLowerCase().includes(k)))
      .reduce((s, m) => s + m.collected, 0);
    const creditPending = paymentModes.reduce((s, m) => s + Math.max(0, m.amount - m.collected), 0);

    const lowOrOutStock = items
      .filter((i) => (i.stock ?? 0) <= (i.minStockAlert ?? 2))
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));

    return {
      weightProducts,
      paymentModes,
      cashTotal,
      digitalTotal,
      creditPending,
      totalDiscounts,
      totalReturnsValue,
      returnBillsCount: returnTx.length,
      lowOrOutStock,
    };
  }, [dateFilteredTx, salesTx, items]);

  const filteredCpbRows = useMemo(() => {
    const q = (cpbFilter || search).trim().toLowerCase();
    const rows = comprehensivePL.customerProductBrandRows || [];
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.partyName.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        r.brand.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
    );
  }, [comprehensivePL.customerProductBrandRows, cpbFilter, search]);

  const handleExportCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const metaRows = [
      ['Business Manager 360 Export', filename.replace(/_/g, ' ')],
      ['Business Name', company.name || 'MY STORE'],
      ['GSTIN', company.gstin || 'Unregistered'],
      ['Selected Period', dateRange],
      ['Costing Method', comprehensivePL.costingMethodUsed],
      ['Exported On', new Date().toLocaleString('en-IN')],
      [],
    ];
    const csvContent = [
      ...metaRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
      headers.join(','),
      ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`${filename} exported to CSV successfully`);
  };

  const handleExportJSON = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`${filename} exported to JSON`);
  };

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-slate-950 flex flex-col overflow-hidden select-none text-xs text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center">
            <BarChart2 className="w-5 h-5 stroke-[2.2] text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 dark:text-white">Enterprise Reports &amp; Financial Audits</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Real-COGS Analytics
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Live GST returns (GSTR-1/3B), HSN summary, COGS P&amp;L, Period Comparison &amp; Custom Report Builder
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter reports..."
              className="pl-8 pr-3 py-1.5 w-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none"
            />
          </div>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
          >
            <option value="All">All Dates</option>
            <option value="Today">Today</option>
            <option value="Last 7 Days">Last 7 Days</option>
            <option value="This Month">This Month</option>
            <option value="FY 2026-27">FY 2026-27 (Apr–Mar)</option>
            <option value="FY 2025-26">FY 2025-26 (Apr–Mar)</option>
          </select>

          <button
            type="button"
            onClick={() => exportCurrentViewPdf({ title: `${company.name} - ${reportCategory.toUpperCase()} (${dateRange})` })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 font-semibold text-slate-700 dark:text-slate-200 shadow-2xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportJSON(`MYSTORE_${reportCategory}_report`, { salesTx, purchaseTx, expenseTx, incomeTx })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Report Categories Navigation Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center gap-2 shrink-0 overflow-x-auto text-xs font-semibold py-2">
        {[
          { id: 'sales', label: 'Sales Register', icon: TrendingUp },
          { id: 'purchases', label: 'Purchase Register', icon: ShoppingCart },
          { id: 'inventory', label: 'Inventory & Item Profit', icon: Package },
          { id: 'financial', label: 'Real COGS P&L', icon: Scale },
          { id: 'kirana-analytics', label: 'Kirana Weight & Profit', icon: Scale },
          { id: 'customer-profit', label: 'Customer Profitability', icon: UserCheck },
          { id: 'discount-impact', label: 'Discount Impact', icon: Layers },
          { id: 'gst', label: 'GST & HSN Summary', icon: FileSpreadsheet },
          { id: 'outstanding', label: 'Aging & Overdue', icon: Landmark },
          { id: 'party-statement', label: 'Party Statement', icon: BookOpen },
          { id: 'day-book', label: 'Day Book', icon: CalendarDays },
          { id: 'staff-commission', label: 'Staff Commission', icon: UserCheck },
          { id: 'comparison', label: 'Period Comparison', icon: GitCompare },
          { id: 'custom', label: 'Custom Report Builder', icon: Table2 },
          { id: 'expenses', label: 'Expenses', icon: Layers },
          { id: 'income', label: 'Other Income', icon: TrendingUp },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = reportCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setReportCategory(tab.id as ReportTab)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400 dark:text-white' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Report Viewport */}
      <div className="flex-1 overflow-auto p-6">
        {/* 1. SALES REPORTS */}
        {reportCategory === 'sales' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Sales Register &amp; Summary ({salesTx.length} bills)</h2>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Total: {fmt(profitSummary.salesRevenue)} &bull; Avg Invoice Value: {fmt(avgInvoiceValue)}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleExportCSV(
                    'Sales_Register',
                    ['Invoice No', 'Date', 'Customer', 'Payment Mode', 'Taxable', 'GST', 'Total Amount', 'Status'],
                    salesTx.map((s) => {
                      const tax = (s.cgstAmount || 0) + (s.sgstAmount || 0) + (s.igstAmount || 0);
                      return [s.invoiceNo, s.date, s.partyName, s.paymentType, (s.totalAmount || 0) - tax, tax, s.totalAmount, s.status];
                    })
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Sales CSV</span>
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Invoice #</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Customer</th>
                    <th className="py-2.5 px-4">Payment Mode</th>
                    <th className="py-2.5 px-4 text-right">Taxable Amt</th>
                    <th className="py-2.5 px-4 text-right">GST</th>
                    <th className="py-2.5 px-4 text-right">Total Amount</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                  {salesTx.map((s) => {
                    const gstExplicit = (s.cgstAmount || 0) + (s.sgstAmount || 0) + (s.igstAmount || 0);
                    const gst = gstExplicit > 0 ? gstExplicit : s.items.reduce((sum, l) => sum + (l.qty * l.price * (l.taxPercent || 0)) / 100, 0);
                    const taxable = Math.max(0, (s.totalAmount || 0) - gst);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white">{s.invoiceNo}</td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">{s.date}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">{s.partyName}</td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{s.paymentType}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-slate-700 dark:text-slate-300">{fmt(taxable)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-slate-500 dark:text-slate-400">{fmt(gst)}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">{fmt(s.totalAmount)}</td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. PURCHASE REPORTS */}
        {reportCategory === 'purchases' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Purchase Bills Register ({purchaseTx.length} bills)</h2>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">Total Procurement: {fmt(profitSummary.totalPurchases)}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleExportCSV(
                    'Purchase_Register',
                    ['Bill No', 'Date', 'Supplier', 'Payment Mode', 'Total Amount', 'Status'],
                    purchaseTx.map((p) => [p.invoiceNo, p.date, p.partyName, p.paymentType, p.totalAmount, p.status])
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Purchase CSV</span>
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Bill #</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Supplier</th>
                    <th className="py-2.5 px-4">Mode</th>
                    <th className="py-2.5 px-4 text-right">Bill Amount</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                  {purchaseTx.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-4 font-mono font-bold text-indigo-700 dark:text-indigo-400">{p.invoiceNo}</td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">{p.date}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">{p.partyName}</td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{p.paymentType}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">{fmt(p.totalAmount)}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. INVENTORY & ITEM PROFITABILITY */}
        {reportCategory === 'inventory' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Inventory Valuation &amp; Product Profitability</h2>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Closing Stock Valuation: {fmt(items.reduce((s, it) => s + Math.max(0, it.stock || 0) * (it.purchasePrice || 0), 0))}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleExportCSV(
                    'Inventory_Profitability',
                    ['Code', 'Item Name', 'Category', 'Stock Qty', 'Cost Rate', 'Sale Price', 'Sold Qty', 'Est Profit', 'Stock Valuation'],
                    inventoryRows.map((i) => [i.code, i.name, i.category, i.stock, i.purchasePrice, i.salePrice, i.soldQty, i.estProfit, (i.stock || 0) * (i.purchasePrice || 0)])
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Inventory CSV</span>
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Item Code</th>
                    <th className="py-2.5 px-4">Name</th>
                    <th className="py-2.5 px-4 text-center">In Stock</th>
                    <th className="py-2.5 px-4 text-center">Sold Qty</th>
                    <th className="py-2.5 px-4 text-right">Cost Price</th>
                    <th className="py-2.5 px-4 text-right">Sale Price</th>
                    <th className="py-2.5 px-4 text-right">Est. Profit</th>
                    <th className="py-2.5 px-4 text-right">Stock Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                  {inventoryRows.map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">{i.code || '-'}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{i.name}</td>
                      <td className="py-2.5 px-4 text-center font-bold">
                        {i.stock || 0} {i.unit || 'PCS'}
                      </td>
                      <td className="py-2.5 px-4 text-center tabular-nums text-blue-600 dark:text-blue-400 font-bold">{i.soldQty}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-slate-600 dark:text-slate-400">{fmt(i.purchasePrice)}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-bold">{fmt(i.salePrice)}</td>
                      <td className={`py-2.5 px-4 text-right tabular-nums font-bold ${i.estProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                        {fmt(i.estProfit)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-purple-700 dark:text-purple-400 tabular-nums">
                        {fmt((i.stock || 0) * (i.purchasePrice || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. REAL COGS PROFIT & LOSS */}
        {reportCategory === 'financial' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Real COGS Trading &amp; Profit &amp; Loss Statement ({comprehensivePL.costingMethodUsed})
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Ex-GST net revenue, historical COGS locked at sale time, inventory valuation &amp; GST ITC separation
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleExportCSV(
                    'Trading_Profit_Loss',
                    ['Particulars', 'Amount (INR)'],
                    [
                      ['Opening Stock Valuation', comprehensivePL.tradingAndPL.openingStockValue],
                      ['Gross Sales (Ex-GST)', comprehensivePL.tradingAndPL.grossSalesExGst],
                      ['Less: Sales Returns', -comprehensivePL.tradingAndPL.salesReturnsExGst],
                      ['Net Sales (Ex-GST)', comprehensivePL.tradingAndPL.netSalesExGst],
                      ['Net Purchases (Ex-GST + Freight)', comprehensivePL.tradingAndPL.netPurchasesExGst],
                      ['Closing Stock Valuation', comprehensivePL.tradingAndPL.closingStockValue],
                      ['Cost of Goods Sold (COGS)', comprehensivePL.tradingAndPL.cogs],
                      ['Gross Profit', comprehensivePL.tradingAndPL.grossProfit],
                      ['Other Income', comprehensivePL.tradingAndPL.otherIncome],
                      ['Indirect Operating Expenses', -comprehensivePL.tradingAndPL.indirectExpensesTotal],
                      ['Net Operating Profit', comprehensivePL.tradingAndPL.netProfit],
                    ]
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export P&amp;L CSV</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4">
                <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between text-xs">
                  <span>Operating Revenues (Ex-GST)</span>
                  <span className="text-emerald-700 dark:text-emerald-400">Credit (Cr)</span>
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Gross Sales (Ex-GST)</span>
                    <strong className="tabular-nums">{fmt(comprehensivePL.tradingAndPL.grossSalesExGst)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Less: Sales Returns / Credit Notes</span>
                    <strong className="tabular-nums text-rose-600">
                      -{fmt(comprehensivePL.tradingAndPL.salesReturnsExGst)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Closing Stock Valuation</span>
                    <strong className="tabular-nums text-blue-600">{fmt(comprehensivePL.tradingAndPL.closingStockValue)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Other Operating Incomes</span>
                    <strong className="tabular-nums">{fmt(profitSummary.otherIncome)}</strong>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 font-bold text-emerald-700 dark:text-emerald-400">
                    <span>Net Sales + Other Income</span>
                    <span className="text-sm tabular-nums">{fmt(profitSummary.salesRevenue + profitSummary.otherIncome)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4">
                <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between text-xs">
                  <span>Cost of Goods Sold &amp; Operating Expenses</span>
                  <span className="text-rose-700 dark:text-rose-400">Debit (Dr)</span>
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Opening Stock Valuation</span>
                    <strong className="tabular-nums">{fmt(comprehensivePL.tradingAndPL.openingStockValue)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Real Historical COGS ({comprehensivePL.costingMethodUsed})</span>
                    <strong className="tabular-nums">{fmt(profitSummary.cogs)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Operating Expenses &amp; Overheads</span>
                    <strong className="tabular-nums">{fmt(profitSummary.totalExpenses)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Gross Profit ({profitSummary.grossMarginPercent.toFixed(1)}% Margin)</span>
                    <strong className="tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(profitSummary.grossProfit)}</strong>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 font-bold text-rose-700 dark:text-rose-400">
                    <span>Total Costs (COGS + Expenses)</span>
                    <span className="text-sm tabular-nums">{fmt(profitSummary.cogs + profitSummary.totalExpenses)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${profitSummary.netProfit >= 0 ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900' : 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900'}`}>
              <div>
                <span className={`text-xs font-semibold block ${profitSummary.netProfit >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'}`}>
                  {profitSummary.netProfit >= 0 ? 'Net Operating Profit' : 'Net Operating Loss'} (
                  {(profitSummary.salesRevenue > 0 ? (profitSummary.netProfit / profitSummary.salesRevenue) * 100 : 0).toFixed(1)}% Net Margin)
                </span>
                <span className={`text-xl font-bold tabular-nums ${profitSummary.netProfit >= 0 ? 'text-emerald-900 dark:text-emerald-200' : 'text-rose-900 dark:text-rose-200'}`}>
                  {fmt(profitSummary.netProfit)}
                </span>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-2xs ${profitSummary.netProfit >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                {profitSummary.netProfit >= 0 ? 'Profitable Operations' : 'Loss Alert'}
              </span>
            </div>
          </div>
        )}

        {/* 4A-KIRANA. KIRANA WEIGHT, COLLECTION & CUSTOMER-PRODUCT-BRAND PROFIT */}
        {reportCategory === 'kirana-analytics' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Kirana Weight-Wise Sales, Cash/Digital Collection &amp; Brand Profitability
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Fractional weight &amp; volume tracking (kg/g, L/ml), purchase cost vs selling price profit, and Customer × Product × Brand breakdown
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleExportCSV(
                      'Kirana_Weight_Wise_Sales',
                      ['Product', 'Brand', 'Unit', 'Loose/Weight', 'Sold Qty/Wt', 'Returned Qty/Wt', 'Net Qty/Wt', 'Gross Sales', 'COGS', 'Gross Profit'],
                      kiranaAnalytics.weightProducts.map((w) => [
                        w.name,
                        w.brand,
                        w.unit,
                        w.isLooseOrWeight ? 'Yes' : 'No',
                        formatBaseQtyHuman(w.soldQty, w.unit),
                        formatBaseQtyHuman(w.returnedQty, w.unit),
                        formatBaseQtyHuman(w.netQty, w.unit),
                        Math.round(w.grossSales * 100) / 100,
                        Math.round(w.cogs * 100) / 100,
                        Math.round(w.grossProfit * 100) / 100,
                      ])
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Weight Sales CSV</span>
                </button>
              </div>
            </div>

            {/* Summary KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Cash Collected</span>
                <div className="text-xl font-bold mt-1 tabular-nums text-emerald-700 dark:text-emerald-400">
                  {fmt(kiranaAnalytics.cashTotal)}
                </div>
                <span className="text-[11px] text-slate-400">Counter cash settlements</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Digital (UPI / Bank / Card)</span>
                <div className="text-xl font-bold mt-1 tabular-nums text-blue-700 dark:text-blue-400">
                  {fmt(kiranaAnalytics.digitalTotal)}
                </div>
                <span className="text-[11px] text-slate-400">Pending Udhaar: {fmt(kiranaAnalytics.creditPending)}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Discounts &amp; Sale Returns</span>
                <div className="text-xl font-bold mt-1 tabular-nums text-amber-700 dark:text-amber-400">
                  {fmt(kiranaAnalytics.totalDiscounts + kiranaAnalytics.totalReturnsValue)}
                </div>
                <span className="text-[11px] text-slate-400">
                  Disc: {fmt(kiranaAnalytics.totalDiscounts)} &bull; {kiranaAnalytics.returnBillsCount} Returns
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Low / Out-of-Stock Items</span>
                <div className="text-xl font-bold mt-1 tabular-nums text-rose-700 dark:text-rose-400">
                  {kiranaAnalytics.lowOrOutStock.length}
                </div>
                <span className="text-[11px] text-slate-400">Items at or below minimum stock</span>
              </div>
            </div>

            {/* Weight-wise & Amount-wise Product Sales Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Weight-Wise &amp; Purchase vs Selling Price Profit ({kiranaAnalytics.weightProducts.length} items)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Exact decimal weight sold, return deductions, COGS &amp; gross profit
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                    <tr>
                      <th className="py-2.5 px-4">Product</th>
                      <th className="py-2.5 px-4">Brand / Type</th>
                      <th className="py-2.5 px-4 text-right">Sold Qty / Wt</th>
                      <th className="py-2.5 px-4 text-right">Returned</th>
                      <th className="py-2.5 px-4 text-right">Net Qty / Wt</th>
                      <th className="py-2.5 px-4 text-right">Sales Value</th>
                      <th className="py-2.5 px-4 text-right">Purchase Cost</th>
                      <th className="py-2.5 px-4 text-right">Gross Profit</th>
                      <th className="py-2.5 px-4 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {kiranaAnalytics.weightProducts.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          No sales recorded in the selected date filter.
                        </td>
                      </tr>
                    ) : (
                      kiranaAnalytics.weightProducts.map((row) => {
                        const margin = row.grossSales > 0 ? (row.grossProfit / row.grossSales) * 100 : 0;
                        return (
                          <tr key={row.name} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">{row.name}</td>
                            <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                              {row.brand} &bull; {row.isLooseOrWeight ? 'Loose / Weight' : 'Unit'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold tabular-nums">
                              {formatBaseQtyHuman(row.soldQty, row.unit)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-rose-600">
                              {row.returnedQty > 0 ? formatBaseQtyHuman(row.returnedQty, row.unit) : '-'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                              {formatBaseQtyHuman(row.netQty, row.unit)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums">{fmt(row.grossSales)}</td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-slate-500">{fmt(row.cogs)}</td>
                            <td className={`py-2.5 px-4 text-right font-bold tabular-nums ${row.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                              {fmt(row.grossProfit)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-semibold">{margin.toFixed(1)}%</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Customer x Product x Brand x Item Profit Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Customer × Product × Brand × Item Profit ({filteredCpbRows.length} rows)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Granular profit matrix across each customer, brand, and product
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={cpbFilter}
                    onChange={(e) => setCpbFilter(e.target.value)}
                    placeholder="Filter customer, product, brand..."
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleExportCSV(
                        'Customer_Product_Brand_Profit',
                        ['Customer', 'Product', 'Brand', 'Category', 'Net Qty/Wt', 'Net Revenue (Ex-GST)', 'COGS', 'Gross Profit', 'Margin %'],
                        filteredCpbRows.map((r) => [
                          r.partyName,
                          r.productName,
                          r.brand,
                          r.category,
                          formatBaseQtyHuman(r.netQty, r.unit),
                          r.netRevenueExGst,
                          r.cogs,
                          r.grossProfit,
                          r.marginPercent,
                        ])
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Matrix CSV</span>
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                    <tr>
                      <th className="py-2.5 px-4">Customer</th>
                      <th className="py-2.5 px-4">Product</th>
                      <th className="py-2.5 px-4">Brand</th>
                      <th className="py-2.5 px-4 text-right">Net Qty / Wt</th>
                      <th className="py-2.5 px-4 text-right">Net Sales</th>
                      <th className="py-2.5 px-4 text-right">COGS</th>
                      <th className="py-2.5 px-4 text-right">Gross Profit</th>
                      <th className="py-2.5 px-4 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCpbRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No matching customer-product-brand sales found.
                        </td>
                      </tr>
                    ) : (
                      filteredCpbRows.map((r) => (
                        <tr key={r.key} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">{r.partyName}</td>
                          <td className="py-2.5 px-4 font-semibold">{r.productName}</td>
                          <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">{r.brand}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums">{formatBaseQtyHuman(r.netQty, r.unit)}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums">{fmt(r.netRevenueExGst)}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-slate-500">{fmt(r.cogs)}</td>
                          <td className={`py-2.5 px-4 text-right font-bold tabular-nums ${r.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                            {fmt(r.grossProfit)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-semibold">{r.marginPercent}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Mode Breakdown & Low Stock Watch */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">Payment Mode Collection Breakdown</h3>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                    <tr>
                      <th className="py-2 px-4">Mode</th>
                      <th className="py-2 px-4 text-right">Bills</th>
                      <th className="py-2 px-4 text-right">Billed</th>
                      <th className="py-2 px-4 text-right">Collected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {kiranaAnalytics.paymentModes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400">No payment data in range.</td>
                      </tr>
                    ) : (
                      kiranaAnalytics.paymentModes.map((m) => (
                        <tr key={m.mode}>
                          <td className="py-2 px-4 font-semibold">{m.mode}</td>
                          <td className="py-2 px-4 text-right tabular-nums">{m.count}</td>
                          <td className="py-2 px-4 text-right tabular-nums">{fmt(m.amount)}</td>
                          <td className="py-2 px-4 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">{fmt(m.collected)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Low &amp; Out-of-Stock Alert ({kiranaAnalytics.lowOrOutStock.length} items)
                  </h3>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                    <tr>
                      <th className="py-2 px-4">Item</th>
                      <th className="py-2 px-4 text-right">Available</th>
                      <th className="py-2 px-4 text-right">Min Stock</th>
                      <th className="py-2 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {kiranaAnalytics.lowOrOutStock.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400">All items above minimum stock level.</td>
                      </tr>
                    ) : (
                      kiranaAnalytics.lowOrOutStock.slice(0, 12).map((it) => (
                        <tr key={it.id}>
                          <td className="py-2 px-4 font-semibold">{it.name}</td>
                          <td className="py-2 px-4 text-right tabular-nums font-bold text-rose-600">
                            {formatBaseQtyHuman(it.stock || 0, it.unit)}
                          </td>
                          <td className="py-2 px-4 text-right tabular-nums text-slate-500">
                            {formatBaseQtyHuman(it.minStockAlert || 0, it.unit)}
                          </td>
                          <td className="py-2 px-4 text-right font-semibold text-xs">
                            {(it.stock || 0) <= 0 ? 'Out of Stock' : 'Low Stock'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4B. CUSTOMER-WISE PROFITABILITY */}
        {reportCategory === 'customer-profit' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Customer-Wise Profitability ({comprehensivePL.customerRows.length} customers)
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Net ex-GST revenue, discounts granted, returns, historical COGS &amp; gross profit per party
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleExportCSV(
                    'Customer_Profitability',
                    ['Customer', 'Bills', 'Gross Purchases', 'Discounts', 'Returns', 'Net Revenue (Ex-GST)', 'COGS', 'Gross Profit', 'Margin %', 'Outstanding'],
                    comprehensivePL.customerRows.map((c) => [
                      c.partyName,
                      c.invoiceCount,
                      c.grossPurchases,
                      c.discountsGiven,
                      c.returnsAmount,
                      c.netRevenueExGst,
                      c.cogs,
                      c.grossProfit,
                      c.marginPercent,
                      c.outstandingBalance,
                    ])
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Customer P&amp;L CSV</span>
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Customer</th>
                    <th className="py-2.5 px-4 text-right">Bills</th>
                    <th className="py-2.5 px-4 text-right">Discounts</th>
                    <th className="py-2.5 px-4 text-right">Returns</th>
                    <th className="py-2.5 px-4 text-right">Net Revenue (Ex-GST)</th>
                    <th className="py-2.5 px-4 text-right">COGS</th>
                    <th className="py-2.5 px-4 text-right">Gross Profit</th>
                    <th className="py-2.5 px-4 text-right">Margin %</th>
                    <th className="py-2.5 px-4 text-right">Udhaar Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {comprehensivePL.customerRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No customer sales found in selected period.
                      </td>
                    </tr>
                  ) : (
                    comprehensivePL.customerRows.map((c) => (
                      <tr key={c.partyName} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">{c.partyName}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{c.invoiceCount}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-amber-600">{fmt(c.discountsGiven)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-rose-600">{fmt(c.returnsAmount)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{fmt(c.netRevenueExGst)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-slate-500">{fmt(c.cogs)}</td>
                        <td className={`py-2.5 px-4 text-right font-bold tabular-nums ${c.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {fmt(c.grossProfit)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold tabular-nums">{c.marginPercent}%</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{fmt(c.outstandingBalance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4C. DISCOUNT IMPACT ANALYSIS */}
        {reportCategory === 'discount-impact' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Discount Impact &amp; Override Audit
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Measures product-level, invoice-level, and coupon discounts alongside Admin PIN loss-bill overrides
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleExportCSV(
                    'Discount_Impact_Audit',
                    ['Invoice No', 'Customer', 'Reason', 'Discount Amount', 'Discount %', 'Loss Impact', 'Approved By', 'Timestamp'],
                    discountApprovals.map((a) => [
                      a.invoiceNo,
                      a.partyName,
                      a.reason,
                      a.discountAmount,
                      a.discountPercent,
                      a.lossAmount > 0 ? -a.lossAmount : 0,
                      a.approvedBy,
                      a.timestamp,
                    ])
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Discount Audit CSV</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[11px] text-slate-500 font-medium">Total Discounts Given</span>
                <div className="text-xl font-bold mt-1 tabular-nums">{fmt(comprehensivePL.discountAnalysis.totalDiscountsGiven)}</div>
                <span className="text-[11px] text-slate-400">{comprehensivePL.discountAnalysis.discountToGrossSalesPercent}% of Gross Sales</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[11px] text-slate-500 font-medium">Product vs Invoice Discounts</span>
                <div className="text-sm font-bold mt-1.5 tabular-nums">
                  Line: {fmt(comprehensivePL.discountAnalysis.productLevelDiscounts)} / Inv: {fmt(comprehensivePL.discountAnalysis.invoiceLevelDiscounts)}
                </div>
                <span className="text-[11px] text-slate-400">Coupons: {fmt(comprehensivePL.discountAnalysis.couponDiscounts)}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-200 dark:border-rose-900 shadow-2xs">
                <span className="text-[11px] text-rose-600 font-medium">Loss Caused by Discounts</span>
                <div className="text-xl font-bold text-rose-600 mt-1 tabular-nums">{fmt(comprehensivePL.discountAnalysis.lossCausedByDiscounts)}</div>
                <span className="text-[11px] text-slate-400">{comprehensivePL.discountAnalysis.lossMakingInvoicesCount} loss bill(s)</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[11px] text-slate-500 font-medium">Discount / Gross Profit</span>
                <div className="text-xl font-bold mt-1 tabular-nums">{comprehensivePL.discountAnalysis.discountToGrossProfitPercent}%</div>
                <span className="text-[11px] text-slate-400">{discountApprovals.length} Admin PIN approvals</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Invoice #</th>
                    <th className="py-2.5 px-4">Customer</th>
                    <th className="py-2.5 px-4">Reason</th>
                    <th className="py-2.5 px-4 text-right">Discount</th>
                    <th className="py-2.5 px-4 text-right">Loss Impact</th>
                    <th className="py-2.5 px-4">Approved By</th>
                    <th className="py-2.5 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {discountApprovals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No Admin discount or loss-sale approvals logged yet.
                      </td>
                    </tr>
                  ) : (
                    discountApprovals.map((ap) => (
                      <tr key={ap.id}>
                        <td className="py-2.5 px-4 font-mono font-bold">{ap.invoiceNo}</td>
                        <td className="py-2.5 px-4">{ap.partyName}</td>
                        <td className="py-2.5 px-4 text-slate-500">{ap.reason}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{fmt(ap.discountAmount)} ({ap.discountPercent}%)</td>
                        <td className={`py-2.5 px-4 text-right font-bold tabular-nums ${ap.lossAmount <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {ap.lossAmount > 0 ? `-${fmt(ap.lossAmount)}` : '₹0 (Margin Cap)'}
                        </td>
                        <td className="py-2.5 px-4">{ap.approvedBy}</td>
                        <td className="py-2.5 px-4 tabular-nums text-slate-500">{new Date(ap.timestamp).toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. GST & HSN SUMMARY */}
        {reportCategory === 'gst' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Live GST &amp; HSN Tax Summary</h2>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">Computed directly from invoiced line items &amp; purchase bills</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Output GST (Sales)</span>
                <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">{fmt(gstMetrics.outputGst)}</div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Input Tax Credit (Purchases)</span>
                <div className="text-xl font-bold text-indigo-700 dark:text-indigo-400 mt-1 tabular-nums">{fmt(gstMetrics.inputGst)}</div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Net GST Liability (GSTR-3B)</span>
                <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{fmt(gstMetrics.netGstPayable)}</div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold">GSTR-1 Outward Supply Breakdown by Actual Tax Slab</div>
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  <tr>
                    <th className="py-2.5 px-4">GST Rate</th>
                    <th className="py-2.5 px-4 text-right">Taxable Value</th>
                    <th className="py-2.5 px-4 text-right">CGST</th>
                    <th className="py-2.5 px-4 text-right">SGST</th>
                    <th className="py-2.5 px-4 text-right">IGST</th>
                    <th className="py-2.5 px-4 text-right">Total Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {gstMetrics.slabs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">No taxed sales in selected range.</td>
                    </tr>
                  ) : (
                    gstMetrics.slabs.map((s) => (
                      <tr key={s.rate}>
                        <td className="py-2.5 px-4 font-bold">{s.rate}% GST</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{fmt(s.taxable)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{fmt(s.cgst)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{fmt(s.sgst)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{fmt(s.igst)}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-600 tabular-nums">{fmt(s.totalTax)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {gstMetrics.hsnList.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold">HSN / SAC Code Sales Summary</div>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                    <tr>
                      <th className="py-2.5 px-4">HSN / SKU</th>
                      <th className="py-2.5 px-4 text-right">Total Qty</th>
                      <th className="py-2.5 px-4 text-right">Taxable Value</th>
                      <th className="py-2.5 px-4 text-right">Total Tax</th>
                      <th className="py-2.5 px-4 text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {gstMetrics.hsnList.map((h) => (
                      <tr key={h.hsn}>
                        <td className="py-2.5 px-4 font-mono font-bold">{h.hsn}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{h.qty}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{fmt(h.taxable)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-emerald-600">{fmt(h.tax)}</td>
                        <td className="py-2.5 px-4 text-right font-bold tabular-nums">{fmt(h.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {gstMetrics.hsnPurchases.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold">
                  HSN / SAC Code Purchase ITC Summary
                </div>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                    <tr>
                      <th className="py-2.5 px-4">HSN / SKU</th>
                      <th className="py-2.5 px-4 text-right">Total Qty</th>
                      <th className="py-2.5 px-4 text-right">Taxable Value</th>
                      <th className="py-2.5 px-4 text-right">Input Tax Credit</th>
                      <th className="py-2.5 px-4 text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {gstMetrics.hsnPurchases.map((h) => (
                      <tr key={h.hsn}>
                        <td className="py-2.5 px-4 font-mono font-bold">{h.hsn}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{h.qty}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{fmt(h.taxable)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-indigo-600">{fmt(h.tax)}</td>
                        <td className="py-2.5 px-4 text-right font-bold tabular-nums">{fmt(h.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {gstMetrics.missingHsnItemsCount > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-amber-900 dark:text-amber-200">
                    {gstMetrics.missingHsnItemsCount} product(s) have missing, invalid, or unverified HSN/SAC codes
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    Resolve item classifications against the official CBIC tariff schedule before filing GSTR-1 / GSTR-3B.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('hsn-gst')}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer whitespace-nowrap"
                >
                  Open HSN / SAC Hub
                </button>
              </div>
            )}
          </div>
        )}

        {/* 6. OUTSTANDING & AGING */}
        {reportCategory === 'outstanding' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Party Aging &amp; Overdue Accounts</h2>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">Live overdue invoice aging (0–30, 31–60, 61–90, 90+ days)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold flex items-center justify-between">
                  <span>Customer Receivables</span>
                  <span className="text-emerald-600 font-semibold">Incoming</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parties
                    .filter((p) => (p.type === 'Customer' || !p.type) && p.balance > 0)
                    .map((c) => {
                      const inv = salesTx.find((s) => s.partyName === c.name && s.balance > 0);
                      const days = inv ? getDaysOverdue(inv.dueDate || inv.date) : 0;
                      return (
                        <div key={c.id} className="p-3.5 px-4 flex items-center justify-between">
                          <div>
                            <div className="font-bold">{c.name}</div>
                            <div className="text-[11px] text-slate-400">
                              Phone: {c.phone || 'N/A'} | Limit: ₹{(c.creditLimit || 0).toLocaleString('en-IN')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-emerald-600 tabular-nums">{fmt(c.balance)}</div>
                            <span className="text-[10px] text-amber-600 font-semibold">
                              {getAgingBucket(days)} {days > 0 ? `(${days}d overdue)` : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold flex items-center justify-between">
                  <span>Supplier Payables</span>
                  <span className="text-rose-600 font-semibold">Outgoing</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parties
                    .filter((p) => p.type === 'Supplier' && p.balance > 0)
                    .map((s) => (
                      <div key={s.id} className="p-3.5 px-4 flex items-center justify-between">
                        <div>
                          <div className="font-bold">{s.name}</div>
                          <div className="text-[11px] text-slate-400">Phone: {s.phone || 'N/A'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-rose-600 tabular-nums">{fmt(s.balance)}</div>
                          <span className="text-[10px] text-slate-400">Active Payable</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 7. PERIOD COMPARISON */}
        {reportCategory === 'comparison' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Period Comparison Analytics</h2>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">Compare Today vs Yesterday and This Month vs Last Month side-by-side</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[
                { title: 'Daily Comparison: Today vs Yesterday', aLabel: 'Today', a: comparisonData.today, bLabel: 'Yesterday', b: comparisonData.yesterday },
                { title: 'Monthly Comparison: This Month vs Last Month', aLabel: 'This Month', a: comparisonData.thisMonth, bLabel: 'Last Month', b: comparisonData.lastMonth },
              ].map((panel) => (
                <div key={panel.title} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-3">
                  <h3 className="font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">{panel.title}</h3>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-500 text-[11px] uppercase">
                        <th className="py-2">Metric</th>
                        <th className="py-2 text-right">{panel.aLabel}</th>
                        <th className="py-2 text-right">{panel.bLabel}</th>
                        <th className="py-2 text-right">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {[
                        { label: 'Sales Revenue', va: panel.a.sales, vb: panel.b.sales, isCount: false },
                        { label: 'Purchases', va: panel.a.purchases, vb: panel.b.purchases, isCount: false },
                        { label: 'Operating Expenses', va: panel.a.expenses, vb: panel.b.expenses, isCount: false },
                        { label: 'Net Profit', va: panel.a.netProfit, vb: panel.b.netProfit, isCount: false },
                        { label: 'Sale Bills Count', va: panel.a.bills, vb: panel.b.bills, isCount: true },
                      ].map((row) => {
                        const diff = row.va - row.vb;
                        return (
                          <tr key={row.label}>
                            <td className="py-2.5 font-semibold">{row.label}</td>
                            <td className="py-2.5 text-right font-bold tabular-nums">
                              {row.isCount ? row.va : fmt(row.va)}
                            </td>
                            <td className="py-2.5 text-right text-slate-500 tabular-nums">
                              {row.isCount ? row.vb : fmt(row.vb)}
                            </td>
                            <td className={`py-2.5 text-right font-bold tabular-nums ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {diff >= 0 ? '+' : ''}
                              {row.isCount ? diff : fmt(diff)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. CUSTOM REPORT BUILDER */}
        {reportCategory === 'custom' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Custom Report Builder</h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Choose a dataset, toggle visible columns, and export clean CSV or print-ready PDF
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={customSource}
                    onChange={(e) => {
                      setCustomSource(e.target.value as typeof customSource);
                      setHiddenCols({});
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                  >
                    <option value="sales">Sales Invoices</option>
                    <option value="purchases">Purchase Bills</option>
                    <option value="items">Items &amp; Valuation</option>
                    <option value="customers">Customers Master</option>
                    <option value="suppliers">Suppliers Master</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const visIdx = customDataset.columns
                        .map((_, idx) => idx)
                        .filter((idx) => !hiddenCols[customDataset.columns[idx]]);
                      handleExportCSV(
                        `Custom_${customSource}_Report`,
                        visIdx.map((i) => customDataset.columns[i]),
                        customDataset.rows.map((r) => visIdx.map((i) => r[i]))
                      );
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Built CSV</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500">Columns:</span>
                {customDataset.columns.map((col) => {
                  const visible = !hiddenCols[col];
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setHiddenCols((prev) => ({ ...prev, [col]: !prev[col] }))}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                        visible
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 line-through'
                      }`}
                    >
                      {col}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  <tr>
                    {customDataset.columns.map(
                      (col) => !hiddenCols[col] && <th key={col} className="py-2.5 px-4">{col}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {customDataset.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      {row.map(
                        (cell, cIdx) =>
                          !hiddenCols[customDataset.columns[cIdx]] && (
                            <td key={cIdx} className="py-2.5 px-4 tabular-nums">
                              {String(cell)}
                            </td>
                          )
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 9 & 10. EXPENSES & OTHER INCOME */}
        {(reportCategory === 'expenses' || reportCategory === 'income') && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {reportCategory === 'expenses' ? 'Expense Breakdown' : 'Other Income Summary'}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">Categorized operating cash flows</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs p-5">
              <div className="space-y-3">
                {(reportCategory === 'expenses' ? expenseTx : incomeTx).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
                  >
                    <div>
                      <div className="font-bold">{item.partyName || item.notes}</div>
                      <div className="text-[11px] text-slate-500">
                        {item.date} &bull; Voucher {item.invoiceNo}
                      </div>
                    </div>
                    <div className="font-bold text-sm tabular-nums">{fmt(item.totalAmount)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 11. PARTY STATEMENT */}
        {reportCategory === 'party-statement' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Party Ledger Statement</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Chronological bills, returns, receipts &amp; running balance per Customer / Supplier
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedPartyObj?.id || ''}
                  onChange={(e) => setSelectedPartyStmtId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                >
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type || 'Customer'})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    handleExportCSV(
                      `Party_Statement_${selectedPartyObj?.name || 'Party'}`,
                      ['Date', 'Voucher #', 'Type', 'Mode', 'Debit', 'Credit', 'Running Balance'],
                      partyStatementRows.map((r) => [
                        r.date,
                        r.invoiceNo,
                        r.type,
                        r.paymentType,
                        r.debit,
                        r.credit,
                        r.runningBalance,
                      ])
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Voucher #</th>
                    <th className="py-2.5 px-4">Transaction Type</th>
                    <th className="py-2.5 px-4">Mode</th>
                    <th className="py-2.5 px-4 text-right">Debit (₹)</th>
                    <th className="py-2.5 px-4 text-right">Credit (₹)</th>
                    <th className="py-2.5 px-4 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {partyStatementRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No ledger transactions recorded for this party in selected period.
                      </td>
                    </tr>
                  ) : (
                    partyStatementRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 tabular-nums text-slate-600 dark:text-slate-400">{row.date}</td>
                        <td className="py-2.5 px-4 font-mono font-bold">{row.invoiceNo}</td>
                        <td className="py-2.5 px-4 font-semibold">{row.type}</td>
                        <td className="py-2.5 px-4 text-slate-500">{row.paymentType}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-rose-600 font-semibold">
                          {row.debit > 0 ? fmt(row.debit) : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-emerald-600 font-semibold">
                          {row.credit > 0 ? fmt(row.credit) : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-bold">
                          {fmt(row.runningBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 12. DAY BOOK */}
        {reportCategory === 'day-book' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Chronological Day Book ({dayBookRows.length} entries)
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Unified daily register across Sales, Purchases, Payments, Returns, Expenses &amp; Incomes
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleExportCSV(
                    'Day_Book',
                    ['Date', 'Voucher #', 'Type', 'Party', 'Mode', 'Total Amount', 'Status'],
                    dayBookRows.map((d) => [d.date, d.invoiceNo, d.type, d.partyName, d.paymentType, d.totalAmount, d.status])
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Day Book CSV</span>
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Voucher #</th>
                    <th className="py-2.5 px-4">Voucher Type</th>
                    <th className="py-2.5 px-4">Party / Particulars</th>
                    <th className="py-2.5 px-4">Mode</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dayBookRows.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 tabular-nums text-slate-500">{tx.date}</td>
                      <td className="py-2.5 px-4 font-mono font-bold">{tx.invoiceNo}</td>
                      <td className="py-2.5 px-4 font-semibold">{tx.type}</td>
                      <td className="py-2.5 px-4">{tx.partyName}</td>
                      <td className="py-2.5 px-4 text-slate-500">{tx.paymentType}</td>
                      <td className="py-2.5 px-4 text-right font-bold tabular-nums">{fmt(tx.totalAmount)}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 13. STAFF COMMISSION REPORT */}
        {reportCategory === 'staff-commission' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Staff Sales &amp; Commission Statement
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Attributed invoiced sales and earned commission payouts per employee
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleExportCSV(
                    'Staff_Commission_Report',
                    ['Staff Name', 'Role', 'Bills Billed', 'Sales Volume', 'Commission Rate %', 'Earned Commission'],
                    staffCommissionRows.map((s) => [s.name, s.role, s.bills, s.totalSales, s.rate, s.commission])
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Commission CSV</span>
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Employee / Cashier</th>
                    <th className="py-2.5 px-4">Role</th>
                    <th className="py-2.5 px-4 text-center">Bills Count</th>
                    <th className="py-2.5 px-4 text-right">Billed Sales</th>
                    <th className="py-2.5 px-4 text-right">Comm %</th>
                    <th className="py-2.5 px-4 text-right">Earned Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {staffCommissionRows.map((row) => (
                    <tr key={row.name} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">{row.name}</td>
                      <td className="py-2.5 px-4 text-slate-500">{row.role}</td>
                      <td className="py-2.5 px-4 text-center tabular-nums font-semibold">{row.bills}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-bold">{fmt(row.totalSales)}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{row.rate}%</td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                        {fmt(row.commission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
