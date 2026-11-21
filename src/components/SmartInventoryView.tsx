import React, { useMemo, useState } from 'react';
import {
  Package,
  AlertTriangle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Search,
  Plus,
  RotateCcw,
  Wrench,
  History,
  CheckCircle2,
  X,
  ShoppingBag,
  Layers,
  Barcode,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { Item, InvoiceItem } from '../types';
import { parseAnyDate } from '../utils/erpEngine';

type SmartInvTab = 'stock' | 'batches' | 'adjustments' | 'returns' | 'history';
type StockFilterMode =
  | 'All'
  | 'Low Stock'
  | 'Out of Stock'
  | 'Overstocked'
  | 'Fast Moving'
  | 'Slow Moving'
  | 'Dead Stock';

export const SmartInventoryView: React.FC = () => {
  const {
    items,
    batches,
    transactions,
    parties,
    stockHistory,
    company,
    currentUser,
    updateItem,
    adjustStock,
    recordDamagedStock,
    recordPurchaseReturn,
    addBatch,
    addTransaction,
    openBarcodeScanner,
    showToast,
  } = useVyapar();

  const [activeSubTab, setActiveSubTab] = useState<SmartInvTab>('stock');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState<StockFilterMode>('All');
  const [expiryFilter, setExpiryFilter] = useState<'All' | 'Expired' | 'Expiring30'>('All');
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('All');

  // Inline item min/max/expiry edit state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editMinStock, setEditMinStock] = useState<number>(5);
  const [editMaxStock, setEditMaxStock] = useState<number>(100);
  const [editExpiryDate, setEditExpiryDate] = useState<string>('');

  // Quick Restock / Purchase modal
  const [restockItem, setRestockItem] = useState<Item | null>(null);
  const [restockSupplier, setRestockSupplier] = useState('');
  const [restockQty, setRestockQty] = useState<number>(20);
  const [restockRate, setRestockRate] = useState<number>(0);
  const [restockMode, setRestockMode] = useState<'Purchase' | 'Purchase Order'>('Purchase');

  // Add Batch form state
  const [batchItemId, setBatchItemId] = useState<string>(items[0]?.id || '');
  const [batchNo, setBatchNo] = useState('');
  const [batchMfg, setBatchMfg] = useState(new Date().toISOString().slice(0, 10));
  const [batchExp, setBatchExp] = useState('');
  const [batchQty, setBatchQty] = useState<number>(10);
  const [batchPurchaseRate, setBatchPurchaseRate] = useState<number>(0);

  // Stock Adjustment & Damaged Write-off form state
  const [adjItemId, setAdjItemId] = useState<string>(items[0]?.id || '');
  const [adjNewStock, setAdjNewStock] = useState<number>(0);
  const [adjReason, setAdjReason] = useState('Physical Count Audit');

  const [dmgItemId, setDmgItemId] = useState<string>(items[0]?.id || '');
  const [dmgQty, setDmgQty] = useState<number>(1);
  const [dmgReason, setDmgReason] = useState('Damaged / Expired Stock');

  // Purchase Return form state
  const suppliers = useMemo(
    () => parties.filter((p) => p.type === 'Supplier'),
    [parties]
  );
  const [prSupplier, setPrSupplier] = useState<string>(suppliers[0]?.name || '');
  const [prBillNo, setPrBillNo] = useState('');
  const [prReason, setPrReason] = useState('Damaged or Expired Goods');
  const [prItemId, setPrItemId] = useState<string>(items[0]?.id || '');
  const [prQty, setPrQty] = useState<number>(1);
  const [prLines, setPrLines] = useState<InvoiceItem[]>([]);

  // Movement velocity per item across past 30 days & overall
  const velocityMap = useMemo(() => {
    const map = new Map<string, { qtySold30: number; totalSold: number }>();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    transactions.forEach((tx) => {
      if (tx.type !== 'Sale' || tx.isCancelled) return;
      const dt = parseAnyDate(tx.date);
      const isRecent = dt ? dt >= cutoff : false;
      (tx.items || []).forEach((line) => {
        const key = line.name.trim().toLowerCase();
        const prev = map.get(key) || { qtySold30: 0, totalSold: 0 };
        prev.totalSold += Number(line.qty) || 0;
        if (isRecent) prev.qtySold30 += Number(line.qty) || 0;
        map.set(key, prev);
      });
    });
    return map;
  }, [transactions]);

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [items]);

  const getExpiryStatus = (expStr?: string) => {
    if (!expStr) return { status: 'none' as const, daysLeft: 9999 };
    const dt = parseAnyDate(expStr) || new Date(expStr);
    if (!dt || Number.isNaN(dt.getTime())) return { status: 'none' as const, daysLeft: 9999 };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dt.setHours(0, 0, 0, 0);
    const daysLeft = Math.floor((dt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { status: 'expired' as const, daysLeft };
    if (daysLeft <= 30) return { status: 'expiring' as const, daysLeft };
    return { status: 'ok' as const, daysLeft };
  };

  // Enriched items with classification
  const enrichedItems = useMemo(() => {
    return items.map((item) => {
      const vel = velocityMap.get(item.name.trim().toLowerCase()) || { qtySold30: 0, totalSold: 0 };
      const minAlert = item.minStockAlert ?? 5;
      const maxLevel = item.maxStockLevel ?? 0;
      const reserved = item.reservedStock || 0;
      const available = Math.max(0, (item.stock || 0) - reserved);
      const costVal = Math.max(0, item.stock || 0) * (item.purchasePrice || item.salePrice || 0);
      const retailVal = Math.max(0, item.stock || 0) * (item.salePrice || 0);

      let velocityTag: 'Fast Moving' | 'Slow Moving' | 'Dead Stock' = 'Slow Moving';
      if (vel.qtySold30 >= 8 || vel.totalSold >= 15) {
        velocityTag = 'Fast Moving';
      } else if (vel.totalSold === 0 && (item.stock || 0) > 0) {
        velocityTag = 'Dead Stock';
      }

      const expInfo = getExpiryStatus(item.expiryDate);
      const isOut = (item.stock || 0) <= 0;
      const isLow = !isOut && (item.stock || 0) <= minAlert;
      const isOverstocked = maxLevel > 0 && (item.stock || 0) > maxLevel;

      return {
        item,
        vel,
        minAlert,
        maxLevel,
        reserved,
        available,
        costVal,
        retailVal,
        velocityTag,
        expInfo,
        isOut,
        isLow,
        isOverstocked,
      };
    });
  }, [items, velocityMap]);

  // KPI metrics
  const kpis = useMemo(() => {
    const totalProducts = items.length;
    const totalCostValue = enrichedItems.reduce((s, e) => s + e.costVal, 0);
    const totalRetailValue = enrichedItems.reduce((s, e) => s + e.retailVal, 0);
    const lowStockCount = enrichedItems.filter((e) => e.isLow).length;
    const outOfStockCount = enrichedItems.filter((e) => e.isOut).length;
    const fastMovingCount = enrichedItems.filter((e) => e.velocityTag === 'Fast Moving').length;
    const slowDeadCount = enrichedItems.filter(
      (e) => e.velocityTag === 'Slow Moving' || e.velocityTag === 'Dead Stock'
    ).length;

    const itemExpiryCount = enrichedItems.filter(
      (e) => e.expInfo.status === 'expired' || e.expInfo.status === 'expiring'
    ).length;
    const batchExpiryCount = batches.filter((b) => {
      const st = getExpiryStatus(b.expiryDate).status;
      return st === 'expired' || st === 'expiring';
    }).length;

    return {
      totalProducts,
      totalCostValue,
      totalRetailValue,
      lowStockCount,
      outOfStockCount,
      expiringCount: itemExpiryCount + batchExpiryCount,
      fastMovingCount,
      slowDeadCount,
    };
  }, [items.length, enrichedItems, batches]);

  const filteredStockRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrichedItems.filter((row) => {
      if (categoryFilter !== 'All' && row.item.category !== categoryFilter) return false;
      if (stockFilter === 'Low Stock' && !row.isLow) return false;
      if (stockFilter === 'Out of Stock' && !row.isOut) return false;
      if (stockFilter === 'Overstocked' && !row.isOverstocked) return false;
      if (stockFilter === 'Fast Moving' && row.velocityTag !== 'Fast Moving') return false;
      if (stockFilter === 'Slow Moving' && row.velocityTag !== 'Slow Moving') return false;
      if (stockFilter === 'Dead Stock' && row.velocityTag !== 'Dead Stock') return false;
      if (!q) return true;
      return (
        row.item.name.toLowerCase().includes(q) ||
        row.item.code.toLowerCase().includes(q) ||
        (row.item.barcode || '').toLowerCase().includes(q) ||
        (row.item.batchNo || '').toLowerCase().includes(q)
      );
    });
  }, [enrichedItems, search, categoryFilter, stockFilter]);

  const expiryRows = useMemo(() => {
    const combined: Array<{
      id: string;
      source: 'Item' | 'Batch';
      itemName: string;
      sku: string;
      batchNo: string;
      mfgDate?: string;
      expiryDate: string;
      qty: number;
      unit: string;
      status: 'expired' | 'expiring' | 'ok' | 'none';
      daysLeft: number;
    }> = [];

    items.forEach((it) => {
      if (!it.expiryDate) return;
      const st = getExpiryStatus(it.expiryDate);
      combined.push({
        id: `it-${it.id}`,
        source: 'Item',
        itemName: it.name,
        sku: it.code,
        batchNo: it.batchNo || '-',
        expiryDate: it.expiryDate,
        qty: it.stock,
        unit: it.unit,
        status: st.status,
        daysLeft: st.daysLeft,
      });
    });

    batches.forEach((b) => {
      const st = getExpiryStatus(b.expiryDate);
      combined.push({
        id: `b-${b.id}`,
        source: 'Batch',
        itemName: b.itemName,
        sku: b.itemId,
        batchNo: b.batchNumber,
        mfgDate: b.mfgDate,
        expiryDate: b.expiryDate,
        qty: b.qty,
        unit: 'PCS',
        status: st.status,
        daysLeft: st.daysLeft,
      });
    });

    return combined
      .filter((r) => {
        if (expiryFilter === 'Expired') return r.status === 'expired';
        if (expiryFilter === 'Expiring30') return r.status === 'expiring';
        return true;
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [items, batches, expiryFilter]);

  const purchaseReturnHistory = useMemo(
    () =>
      transactions.filter(
        (t) =>
          (t.type === 'Purchase Return' ||
            (t.type === 'Expense' && t.invoiceNo.startsWith('DN-'))) &&
          !t.isCancelled
      ),
    [transactions]
  );

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return stockHistory.filter((rec) => {
      if (historyTypeFilter !== 'All' && rec.type !== historyTypeFilter) return false;
      if (!q) return true;
      return (
        rec.itemName.toLowerCase().includes(q) ||
        rec.referenceNo.toLowerCase().includes(q) ||
        (rec.notes || '').toLowerCase().includes(q)
      );
    });
  }, [stockHistory, historySearch, historyTypeFilter]);

  const handleSaveMinMax = (item: Item) => {
    const res = updateItem(item.id, {
      minStockAlert: Math.max(0, editMinStock),
      maxStockLevel: Math.max(0, editMaxStock),
      expiryDate: editExpiryDate.trim() || undefined,
    });
    if (res.success) {
      setEditingItemId(null);
      showToast(`Updated stock limits for ${item.name}`);
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleConfirmRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItem || restockQty <= 0) return;
    const rate = restockRate || restockItem.purchasePrice || Math.round(restockItem.salePrice * 0.78);
    const amount = Math.round(rate * restockQty * 100) / 100;
    const supplier = restockSupplier.trim() || restockItem.lastPurchaseSupplier || suppliers[0]?.name || 'Wholesale Supplier';
    const invNo = `${restockMode === 'Purchase' ? 'PUR' : 'PO'}-${Math.floor(10000 + Math.random() * 90000)}`;

    const line: InvoiceItem = {
      id: restockItem.id,
      name: restockItem.name,
      hsn: restockItem.hsnCode || '1001',
      qty: restockQty,
      unit: restockItem.unit || 'PCS',
      price: rate,
      discountPercent: 0,
      taxPercent: restockItem.taxRate || 0,
      amount,
      barcode: restockItem.barcode,
    };

    const created = addTransaction({
      type: 'Purchase',
      invoiceNo: invNo,
      date: new Date().toLocaleDateString('en-GB'),
      partyName: supplier,
      firm: company.name,
      user: currentUser?.name || 'Admin',
      paymentType: restockMode === 'Purchase' ? 'Cash' : 'Credit',
      totalAmount: amount,
      receivedAmount: restockMode === 'Purchase' ? amount : 0,
      balance: restockMode === 'Purchase' ? 0 : amount,
      dueDate: new Date().toLocaleDateString('en-GB'),
      status: restockMode === 'Purchase' ? 'Paid' : 'Unpaid',
      items: [line],
      notes:
        restockMode === 'Purchase Order'
          ? `[PURCHASE ORDER] Smart Inventory Restock for ${restockItem.name}`
          : `[PURCHASE BILL] Smart Inventory Restock for ${restockItem.name}`,
      skipStockDeduction: restockMode === 'Purchase Order',
    });

    if (created) {
      showToast(
        restockMode === 'Purchase'
          ? `Added +${restockQty} ${restockItem.unit} to ${restockItem.name}`
          : `Purchase Order #${invNo} created for ${restockItem.name}`
      );
      setRestockItem(null);
    }
  };

  const handleAddBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = items.find((i) => i.id === batchItemId);
    if (!target || !batchNo.trim() || !batchExp.trim()) {
      showToast('Select product, batch number & expiry date', 'warning');
      return;
    }
    addBatch({
      itemId: target.id,
      itemName: target.name,
      batchNumber: batchNo.trim(),
      mfgDate: batchMfg || new Date().toISOString().slice(0, 10),
      expiryDate: batchExp,
      purchaseRate: batchPurchaseRate || target.purchasePrice || 0,
      saleRate: target.salePrice || 0,
      qty: Math.max(1, batchQty),
    });
    updateItem(target.id, { batchNo: batchNo.trim(), expiryDate: batchExp });
    setBatchNo('');
    setBatchExp('');
    showToast(`Batch ${batchNo.trim()} added for ${target.name}`);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = items.find((i) => i.id === adjItemId);
    if (!target) return;
    adjustStock(target.id, Math.max(0, adjNewStock), adjReason);
  };

  const handleDamagedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmgItemId || dmgQty <= 0) return;
    const res = recordDamagedStock(dmgItemId, dmgQty, dmgReason);
    if (!res.success) {
      showToast(res.message, 'error');
    }
  };

  const handleAddPrLine = () => {
    const it = items.find((x) => x.id === prItemId);
    if (!it || prQty <= 0) return;
    const unitRate = it.purchasePrice || Math.round(it.salePrice * 0.78);
    const amt = Math.round(unitRate * prQty * 100) / 100;
    setPrLines((prev) => [
      ...prev,
      {
        id: it.id,
        name: it.name,
        hsn: it.hsnCode || '1001',
        qty: prQty,
        unit: it.unit || 'PCS',
        price: unitRate,
        discountPercent: 0,
        taxPercent: it.taxRate || 0,
        amount: amt,
        barcode: it.barcode,
      },
    ]);
  };

  const handleSubmitPurchaseReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prSupplier.trim()) {
      showToast('Select or enter supplier name', 'warning');
      return;
    }
    if (prLines.length === 0) {
      showToast('Add at least one item to return', 'warning');
      return;
    }
    const res = recordPurchaseReturn({
      supplierName: prSupplier.trim(),
      originalBillNo: prBillNo.trim() || undefined,
      items: prLines,
      reason: prReason.trim() || 'Damaged or Expired Stock',
    });
    if (res.success) {
      setPrLines([]);
      setPrBillNo('');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Smart Inventory Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time stock valuation, min/max thresholds, expiry batches, damaged write-offs &amp; purchase returns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openBarcodeScanner('lookup')}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Barcode className="w-4 h-4" />
            <span>Scan SKU / Barcode</span>
          </button>
        </div>
      </div>

      {/* 7 KPI Dashboard Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>Total Products</span>
            <Package className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
            {kpis.totalProducts}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Active SKUs</div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>Stock Value</span>
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
            ₹{Math.round(kpis.totalCostValue).toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
            Retail: ₹{Math.round(kpis.totalRetailValue).toLocaleString('en-IN')}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('stock');
            setStockFilter('Low Stock');
          }}
          className="text-left bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900/60 p-3.5 shadow-2xs hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            <span>Low-Stock</span>
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold text-amber-700 dark:text-amber-300 mt-1 tabular-nums">
            {kpis.lowStockCount}
          </div>
          <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">Below min alert</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('stock');
            setStockFilter('Out of Stock');
          }}
          className="text-left bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900/60 p-3.5 shadow-2xs hover:bg-rose-50/40 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-rose-700 dark:text-rose-400">
            <span>Out of Stock</span>
            <XCircle className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold text-rose-700 dark:text-rose-300 mt-1 tabular-nums">
            {kpis.outOfStockCount}
          </div>
          <div className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">Zero available</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('batches');
            setExpiryFilter('All');
          }}
          className="text-left bg-white dark:bg-slate-900 rounded-xl border border-orange-200 dark:border-orange-900/60 p-3.5 shadow-2xs hover:bg-orange-50/40 dark:hover:bg-orange-950/20 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-orange-700 dark:text-orange-400">
            <span>Expiring / Exp</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold text-orange-700 dark:text-orange-300 mt-1 tabular-nums">
            {kpis.expiringCount}
          </div>
          <div className="text-[10px] text-orange-600/80 dark:text-orange-400/80 mt-0.5">Within 30 days</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('stock');
            setStockFilter('Fast Moving');
          }}
          className="text-left bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/60 p-3.5 shadow-2xs hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <span>Fast-Moving</span>
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
            {kpis.fastMovingCount}
          </div>
          <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">High velocity</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('stock');
            setStockFilter('Dead Stock');
          }}
          className="text-left bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <span>Slow / Dead</span>
            <TrendingDown className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mt-1 tabular-nums">
            {kpis.slowDeadCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Review stock</div>
        </button>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'stock', label: 'Live Stock & Min/Max', icon: Package },
          { id: 'batches', label: 'Batches & Expiry', icon: Clock },
          { id: 'adjustments', label: 'Adjust & Damaged Write-off', icon: Wrench },
          { id: 'returns', label: 'Purchase Returns', icon: RotateCcw },
          { id: 'history', label: 'Movement History', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as SmartInvTab)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                active
                  ? 'bg-[#8B0D1E] text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: LIVE STOCK & MIN/MAX */}
      {activeSubTab === 'stock' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search item name, SKU code, barcode or batch..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#8B0D1E]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>

              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as StockFilterMode)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {(
                  [
                    'All',
                    'Low Stock',
                    'Out of Stock',
                    'Overstocked',
                    'Fast Moving',
                    'Slow Moving',
                    'Dead Stock',
                  ] as StockFilterMode[]
                ).map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                <tr>
                  <th className="px-4 py-3">Product / SKU</th>
                  <th className="px-4 py-3">Barcode / Batch</th>
                  <th className="px-4 py-3 text-right">Stock / Reserved</th>
                  <th className="px-4 py-3 text-right">Min / Max Alert</th>
                  <th className="px-4 py-3">Expiry</th>
                  <th className="px-4 py-3 text-right">Valuation</th>
                  <th className="px-4 py-3">Velocity</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStockRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                      No matching inventory items found.
                    </td>
                  </tr>
                ) : (
                  filteredStockRows.map(
                    ({
                      item,
                      vel,
                      minAlert,
                      maxLevel,
                      reserved,
                      available,
                      costVal,
                      velocityTag,
                      expInfo,
                      isOut,
                      isLow,
                      isOverstocked,
                    }) => {
                      const isEditing = editingItemId === item.id;
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {item.code} · {item.category || 'General'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                            <div>{item.barcode || 'No Barcode'}</div>
                            <div className="text-slate-400">{item.batchNo ? `Batch: ${item.batchNo}` : '—'}</div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            <div
                              className={`font-extrabold ${
                                isOut
                                  ? 'text-rose-600'
                                  : isLow
                                  ? 'text-amber-600'
                                  : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {item.stock} {item.unit}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Avail: {available} {reserved > 0 ? `(${reserved} res)` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  value={editMinStock}
                                  onChange={(e) => setEditMinStock(Number(e.target.value))}
                                  className="w-14 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-right"
                                  title="Min Stock"
                                />
                                <span>/</span>
                                <input
                                  type="number"
                                  value={editMaxStock}
                                  onChange={(e) => setEditMaxStock(Number(e.target.value))}
                                  className="w-14 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-right"
                                  title="Max Stock"
                                />
                              </div>
                            ) : (
                              <div>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  {minAlert} / {maxLevel > 0 ? maxLevel : '∞'}
                                </span>
                                {isOverstocked && (
                                  <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                    Overstocked
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                type="date"
                                value={editExpiryDate}
                                onChange={(e) => setEditExpiryDate(e.target.value)}
                                className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[11px]"
                              />
                            ) : item.expiryDate ? (
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                                  expInfo.status === 'expired'
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                    : expInfo.status === 'expiring'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {item.expiryDate}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">No expiry</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            <div className="font-bold text-slate-900 dark:text-white">
                              ₹{Math.round(costVal).toLocaleString('en-IN')}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Cost ₹{item.purchasePrice || 0} / Sale ₹{item.salePrice}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                                velocityTag === 'Fast Moving'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : velocityTag === 'Dead Stock'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {velocityTag} ({vel.totalSold} sold)
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {isEditing ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleSaveMinMax(item)}
                                  className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingItemId(null)}
                                  className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingItemId(item.id);
                                    setEditMinStock(minAlert);
                                    setEditMaxStock(maxLevel);
                                    setEditExpiryDate(item.expiryDate || '');
                                  }}
                                  className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold cursor-pointer"
                                >
                                  Thresholds
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRestockItem(item);
                                    setRestockQty(Math.max(10, (minAlert || 5) * 3));
                                    setRestockRate(item.purchasePrice || Math.round(item.salePrice * 0.78));
                                    setRestockSupplier(item.lastPurchaseSupplier || suppliers[0]?.name || '');
                                  }}
                                  className="px-2.5 py-1 rounded bg-[#8B0D1E] hover:bg-[#740918] text-white text-[11px] font-bold cursor-pointer"
                                >
                                  Restock
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BATCHES & EXPIRY */}
      {activeSubTab === 'batches' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#8B0D1E]" />
              <span>Register Product Batch &amp; Expiry</span>
            </h3>
            <form onSubmit={handleAddBatchSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Product</label>
                <select
                  value={batchItemId}
                  onChange={(e) => setBatchItemId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.stock} {it.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Batch Number</label>
                <input
                  type="text"
                  required
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  placeholder="e.g. B-2026-OCT"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Mfg Date</label>
                  <input
                    type="date"
                    value={batchMfg}
                    onChange={(e) => setBatchMfg(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={batchExp}
                    onChange={(e) => setBatchExp(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Batch Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={batchQty}
                    onChange={(e) => setBatchQty(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Purchase Rate (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={batchPurchaseRate}
                    onChange={(e) => setBatchPurchaseRate(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white font-bold cursor-pointer"
              >
                Save Batch &amp; Sync Expiry
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Expiry &amp; Batch Tracker ({expiryRows.length})
              </h3>
              <div className="flex gap-1.5 text-xs">
                {(['All', 'Expired', 'Expiring30'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setExpiryFilter(f)}
                    className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                      expiryFilter === f
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {f === 'Expiring30' ? 'Expiring ≤30d' : f}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Product</th>
                    <th className="px-4 py-2.5">Source / Batch</th>
                    <th className="px-4 py-2.5">Expiry Date</th>
                    <th className="px-4 py-2.5 text-right">Qty</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {expiryRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No batch or expiry records found. Add a batch on the left.
                      </td>
                    </tr>
                  ) : (
                    expiryRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">
                          {row.itemName}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {row.source} · {row.batchNo}
                        </td>
                        <td className="px-4 py-2.5 font-mono">{row.expiryDate}</td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                          {row.qty} {row.unit}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.status === 'expired'
                                ? 'bg-rose-100 text-rose-700'
                                : row.status === 'expiring'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {row.status === 'expired'
                              ? `Expired ${Math.abs(row.daysLeft)}d ago`
                              : row.status === 'expiring'
                              ? `Expiring in ${row.daysLeft}d`
                              : `Safe (${row.daysLeft}d)`}
                          </span>
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

      {/* TAB 3: ADJUSTMENTS & DAMAGED STOCK WRITE-OFF */}
      {activeSubTab === 'adjustments' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-600" />
              <span>Manual Stock Count Adjustment</span>
            </h3>
            <form onSubmit={handleAdjustSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Select Item</label>
                <select
                  value={adjItemId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setAdjItemId(id);
                    const found = items.find((i) => i.id === id);
                    if (found) setAdjNewStock(found.stock);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} (Current: {it.stock} {it.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">New Physical Stock Count</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={adjNewStock}
                  onChange={(e) => setAdjNewStock(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Reason / Audit Note</label>
                <input
                  type="text"
                  required
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-slate-900 dark:bg-blue-600 text-white font-bold cursor-pointer"
              >
                Apply Stock Count Adjustment
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900/60 p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Damaged / Expired Stock Write-Off</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Deducts broken, leaked, or expired units immediately and logs a permanent DAMAGED_WRITE_OFF audit trail.
            </p>
            <form onSubmit={handleDamagedSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Damaged Product</label>
                <select
                  value={dmgItemId}
                  onChange={(e) => setDmgItemId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} (Available: {it.stock} {it.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Damaged Quantity to Write Off</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={dmgQty}
                  onChange={(e) => setDmgQty(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Write-Off Reason</label>
                <input
                  type="text"
                  required
                  value={dmgReason}
                  onChange={(e) => setDmgReason(e.target.value)}
                  placeholder="e.g. Packet torn / Expired batch / Transit breakage"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
              >
                Record Damaged Stock Write-Off
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: PURCHASE RETURNS */}
      {activeSubTab === 'returns' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-[#8B0D1E]" />
              <span>Create Purchase Return to Supplier</span>
            </h3>
            <form onSubmit={handleSubmitPurchaseReturn} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Supplier</label>
                <input
                  list="smart-inv-suppliers"
                  required
                  value={prSupplier}
                  onChange={(e) => setPrSupplier(e.target.value)}
                  placeholder="Select or type supplier name"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <datalist id="smart-inv-suppliers">
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Original Bill No</label>
                  <input
                    type="text"
                    value={prBillNo}
                    onChange={(e) => setPrBillNo(e.target.value)}
                    placeholder="Optional ref"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Reason</label>
                  <input
                    type="text"
                    required
                    value={prReason}
                    onChange={(e) => setPrReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-slate-700 dark:text-slate-200">Add Return Item</div>
                <div className="flex gap-2">
                  <select
                    value={prItemId}
                    onChange={(e) => setPrItemId(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} (Stock: {it.stock})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={prQty}
                    onChange={(e) => setPrQty(Number(e.target.value))}
                    className="w-16 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddPrLine}
                    className="px-3 py-1.5 rounded bg-slate-900 dark:bg-blue-600 text-white font-bold cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {prLines.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                    {prLines.map((line, idx) => (
                      <div key={`${line.id}-${idx}`} className="flex items-center justify-between text-[11px]">
                        <span>
                          {line.name} × {line.qty}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold tabular-nums">₹{line.amount.toLocaleString('en-IN')}</span>
                          <button
                            type="button"
                            onClick={() => setPrLines((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-rose-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white font-bold cursor-pointer"
              >
                Submit Purchase Return &amp; Deduct Stock
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Purchase Return Register ({purchaseReturnHistory.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Ref No</th>
                    <th className="px-4 py-2.5">Supplier</th>
                    <th className="px-4 py-2.5">Items / Note</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {purchaseReturnHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No purchase returns recorded yet.
                      </td>
                    </tr>
                  ) : (
                    purchaseReturnHistory.map((tx) => (
                      <tr key={tx.id}>
                        <td className="px-4 py-2.5 whitespace-nowrap">{tx.date.split(',')[0]}</td>
                        <td className="px-4 py-2.5 font-mono font-bold">#{tx.invoiceNo}</td>
                        <td className="px-4 py-2.5 font-semibold">{tx.partyName}</td>
                        <td className="px-4 py-2.5 text-[11px] text-slate-500">
                          {(tx.items || []).map((i) => `${i.name} ×${i.qty}`).join(', ') || tx.notes}
                        </td>
                        <td className="px-4 py-2.5 text-right font-extrabold text-rose-600 tabular-nums">
                          ₹{tx.totalAmount.toLocaleString('en-IN')}
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

      {/* TAB 5: MOVEMENT HISTORY */}
      {activeSubTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search movement by product, reference or note..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
            <select
              value={historyTypeFilter}
              onChange={(e) => setHistoryTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
            >
              {[
                'All',
                'PURCHASE_INWARD',
                'DEDUCT_SALE',
                'MANUAL_ADJUSTMENT',
                'DAMAGED_WRITE_OFF',
                'PURCHASE_RETURN',
                'RESERVE',
                'RELEASE',
                'RETURN_RESTOCK',
              ].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-4 py-2.5">Movement Type</th>
                  <th className="px-4 py-2.5 text-right">Qty Change</th>
                  <th className="px-4 py-2.5 text-right">Stock After</th>
                  <th className="px-4 py-2.5">Ref / Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No inventory movements logged yet.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.slice(0, 120).map((rec) => (
                    <tr key={rec.id}>
                      <td className="px-4 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">
                        {rec.timestamp}
                      </td>
                      <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">
                        {rec.itemName}
                        {rec.notes && <div className="text-[10px] font-normal text-slate-400">{rec.notes}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rec.type === 'PURCHASE_INWARD' || rec.type === 'RETURN_RESTOCK'
                              ? 'bg-emerald-100 text-emerald-700'
                              : rec.type === 'DAMAGED_WRITE_OFF' || rec.type === 'PURCHASE_RETURN'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {rec.type}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-extrabold tabular-nums ${
                          rec.qtyChange >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {rec.qtyChange > 0 ? `+${rec.qtyChange}` : rec.qtyChange}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        {rec.stockAfter}
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-500">
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {rec.referenceNo}
                        </span>{' '}
                        · {rec.actor}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Restock / Purchase Modal */}
      {restockItem && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4"
          onClick={() => setRestockItem(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#8B0D1E]" />
                <span>Restock {restockItem.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setRestockItem(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmRestock} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                {(['Purchase', 'Purchase Order'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setRestockMode(m)}
                    className={`py-2 rounded-lg border font-bold cursor-pointer ${
                      restockMode === m
                        ? 'border-[#8B0D1E] bg-rose-50 dark:bg-rose-950/40 text-[#8B0D1E] dark:text-rose-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {m === 'Purchase' ? 'Direct Inward Bill' : 'Draft Purchase Order'}
                  </button>
                ))}
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Supplier</label>
                <input
                  list="restock-suppliers"
                  required
                  value={restockSupplier}
                  onChange={(e) => setRestockSupplier(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <datalist id="restock-suppliers">
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Qty ({restockItem.unit})
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={restockQty}
                    onChange={(e) => setRestockQty(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Unit Cost (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={restockRate}
                    onChange={(e) => setRestockRate(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 flex justify-between font-bold">
                <span>Estimated Total</span>
                <span className="tabular-nums">
                  ₹{Math.round(restockQty * restockRate).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockItem(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{restockMode === 'Purchase' ? 'Add Stock Now' : 'Create PO'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
