import React, { useMemo, useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  Download,
  MapPin,
  Phone,
  User,
  Package,
  Edit2,
  Trash2,
  Star,
  X,
  AlertTriangle,
  ShoppingCart,
  Grid3X3,
  ArrowRight,
  CheckCircle2,
  BookOpen,
  Boxes,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { Godown, StockTransfer } from '../types';
import { safeGetStoredData, safeSetStoredData } from '../utils/storage';

export const DEFAULT_GODOWNS: Godown[] = [
  {
    id: 'gdw-1',
    name: 'Central Godown (Hub 1)',
    location: 'Plot 45, Peenya Industrial Area, Phase 1',
    manager: 'Venkatesh Rao',
    contact: '+91 98450 11223',
    capacitySqFt: 5000,
    isCentral: true,
    totalStockValue: 0,
  },
  {
    id: 'gdw-2',
    name: 'South City Retail Depot',
    location: '12th Main, Jayanagar 4th Block',
    manager: 'Anand Kumar',
    contact: '+91 97410 44556',
    capacitySqFt: 1800,
    isCentral: false,
    totalStockValue: 0,
  },
  {
    id: 'gdw-3',
    name: 'Airport Road Dispatch Center',
    location: 'Behind Cargo Terminal, Devanahalli',
    manager: 'Suresh Patil',
    contact: '+91 99000 77889',
    capacitySqFt: 3500,
    isCentral: false,
    totalStockValue: 0,
  },
];

type WarehouseSubTab = 'directory' | 'ledger' | 'transfers' | 'sales-purchases';

export const WarehousesView: React.FC = () => {
  const {
    items,
    parties,
    transactions,
    stockHistory,
    company,
    currentUser,
    addTransaction,
    showToast,
    exportCurrentViewPdf,
    requestConfirmation,
    setActiveTab,
  } = useVyapar();

  const [activeSubTab, setActiveSubTab] = useState<WarehouseSubTab>('directory');
  const [godowns, setGodowns] = useState<Godown[]>(() =>
    safeGetStoredData<Godown[]>('mystore_godowns', DEFAULT_GODOWNS, Array.isArray)
  );
  const [binsByGodown, setBinsByGodown] = useState<
    Record<string, Array<{ id: string; code: string; zone: string; notes?: string }>>
  >(() =>
    safeGetStoredData<Record<string, Array<{ id: string; code: string; zone: string; notes?: string }>>>(
      'bm360_warehouse_bins',
      {
        'gdw-1': [
          { id: 'bin-1', code: 'A1-R1', zone: 'Dry Staples & Grains', notes: 'Ground aisle' },
          { id: 'bin-2', code: 'B2-C1', zone: 'Beverages & Dairy', notes: 'Cold rack' },
        ],
      },
      (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
    )
  );

  const stockTransfers = useMemo(
    () => safeGetStoredData<StockTransfer[]>('mystore_stock_transfers', [], Array.isArray),
    [activeSubTab]
  );

  const [search, setSearch] = useState('');
  const [facilityFilter, setFacilityFilter] = useState<'ALL' | 'CENTRAL' | 'BRANCH'>('ALL');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [ledgerSkuSearch, setLedgerSkuSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGodown, setEditingGodown] = useState<Godown | null>(null);
  const [inspectGodownId, setInspectGodownId] = useState<string | null>(null);
  const [newBinCode, setNewBinCode] = useState('');
  const [newBinZone, setNewBinZone] = useState('');
  const [isReorderOpen, setIsReorderOpen] = useState(false);
  const [reorderSupplierName, setReorderSupplierName] = useState('');
  const [reorderQtyMap, setReorderQtyMap] = useState<Record<string, number>>({});

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [manager, setManager] = useState('');
  const [contact, setContact] = useState('');
  const [capacity, setCapacity] = useState('2500');

  const primaryGodownId = useMemo(
    () => godowns.find((g) => g.isCentral)?.id || godowns[0]?.id || 'gdw-1',
    [godowns]
  );

  // Resolve which godown a product primarily sits in
  const itemGodownMap = useMemo(() => {
    const m = new Map<string, string>();
    items.forEach((it) => {
      m.set(it.id, it.godownId || primaryGodownId);
      m.set(it.name.toLowerCase(), it.godownId || primaryGodownId);
    });
    return m;
  }, [items, primaryGodownId]);

  // Compute live stock quantity, reserved, available, SKU count, and valuation per godown
  const godownAnalytics = useMemo(() => {
    const map = new Map<
      string,
      {
        skuCount: number;
        totalUnits: number;
        reservedUnits: number;
        availableUnits: number;
        stockValue: number;
        itemsList: {
          id: string;
          name: string;
          code: string;
          qty: number;
          reserved: number;
          available: number;
          unit: string;
          value: number;
        }[];
      }
    >();

    godowns.forEach((g) => {
      map.set(g.id, {
        skuCount: 0,
        totalUnits: 0,
        reservedUnits: 0,
        availableUnits: 0,
        stockValue: 0,
        itemsList: [],
      });
    });

    items.forEach((item) => {
      const stocksMap: Record<string, number> =
        item.godownStocks && Object.keys(item.godownStocks).length > 0
          ? item.godownStocks
          : { [item.godownId || primaryGodownId]: Math.max(0, item.stock || 0) };

      const itemPrimaryGdw = item.godownId || primaryGodownId;
      const itemReserved = Math.max(0, item.reservedStock || 0);

      Object.entries(stocksMap).forEach(([gdwId, qty]) => {
        const targetBucket = map.get(gdwId) || map.get(primaryGodownId);
        if (!targetBucket) return;
        const safeQty = Math.max(0, Number(qty) || 0);
        if (safeQty <= 0 && !item.godownStocks) return;
        const reserved = gdwId === itemPrimaryGdw ? Math.min(safeQty, itemReserved) : 0;
        const available = Math.max(0, safeQty - reserved);
        const val = safeQty * (item.purchasePrice || item.salePrice * 0.75 || 0);
        targetBucket.skuCount += 1;
        targetBucket.totalUnits += safeQty;
        targetBucket.reservedUnits += reserved;
        targetBucket.availableUnits += available;
        targetBucket.stockValue += val;
        targetBucket.itemsList.push({
          id: item.id,
          name: item.name,
          code: item.code,
          qty: safeQty,
          reserved,
          available,
          unit: item.unit || 'PCS',
          value: val,
        });
      });
    });

    return map;
  }, [godowns, items, primaryGodownId]);

  // Warehouse Opening, Inward, Outward, Closing Stock Ledger
  const warehouseLedgerRows = useMemo(() => {
    const q = ledgerSkuSearch.trim().toLowerCase();
    const rows: Array<{
      key: string;
      godownId: string;
      godownName: string;
      itemId: string;
      itemName: string;
      sku: string;
      unit: string;
      openingStock: number;
      inward: number;
      outward: number;
      closingStock: number;
      reserved: number;
      available: number;
      valuation: number;
    }> = [];

    items.forEach((item) => {
      const stocksMap: Record<string, number> =
        item.godownStocks && Object.keys(item.godownStocks).length > 0
          ? item.godownStocks
          : { [item.godownId || primaryGodownId]: Math.max(0, item.stock || 0) };

      Object.entries(stocksMap).forEach(([gdwId, closing]) => {
        if (selectedWarehouseId !== 'ALL' && gdwId !== selectedWarehouseId) return;
        if (q && !item.name.toLowerCase().includes(q) && !item.code.toLowerCase().includes(q)) return;

        const godownName = godowns.find((g) => g.id === gdwId)?.name || gdwId;
        const closingQty = Math.max(0, Number(closing) || 0);
        const transfersIn = stockTransfers
          .filter((t) => t.toGodownId === gdwId && t.itemId === item.id)
          .reduce((s, t) => s + (t.quantity || 0), 0);
        const transfersOut = stockTransfers
          .filter((t) => t.fromGodownId === gdwId && t.itemId === item.id)
          .reduce((s, t) => s + (t.quantity || 0), 0);

        const itemHistoryForGdw = (item.godownId || primaryGodownId) === gdwId
          ? stockHistory.filter((h) => h.itemId === item.id)
          : [];
        const histIn = itemHistoryForGdw
          .filter((h) => h.qtyChange > 0)
          .reduce((s, h) => s + h.qtyChange, 0);
        const histOut = itemHistoryForGdw
          .filter((h) => h.qtyChange < 0)
          .reduce((s, h) => s + Math.abs(h.qtyChange), 0);

        const inward = transfersIn + histIn;
        const outward = transfersOut + histOut;
        const openingStock = Math.max(0, closingQty - inward + outward);
        const reserved = (item.godownId || primaryGodownId) === gdwId ? Math.min(closingQty, item.reservedStock || 0) : 0;
        const available = Math.max(0, closingQty - reserved);
        const valuation = closingQty * (item.purchasePrice || item.salePrice * 0.75 || 0);

        rows.push({
          key: `${gdwId}-${item.id}`,
          godownId: gdwId,
          godownName,
          itemId: item.id,
          itemName: item.name,
          sku: item.code,
          unit: item.unit || 'PCS',
          openingStock,
          inward,
          outward,
          closingStock: closingQty,
          reserved,
          available,
          valuation,
        });
      });
    });

    return rows;
  }, [items, godowns, stockTransfers, stockHistory, selectedWarehouseId, ledgerSkuSearch, primaryGodownId]);

  // Warehouse-wise Sales & Purchases breakdown
  const warehouseTradeSummary = useMemo(() => {
    const resolveTxGodownId = (tx: typeof transactions[number]) => {
      if (tx.dispatchLocation) {
        const matched = godowns.find((g) => g.id === tx.dispatchLocation || g.name.toLowerCase() === tx.dispatchLocation?.toLowerCase());
        if (matched) return matched.id;
      }
      const firstLine = tx.items?.[0];
      if (firstLine) {
        return itemGodownMap.get(firstLine.id) || itemGodownMap.get(firstLine.name.toLowerCase()) || primaryGodownId;
      }
      return primaryGodownId;
    };

    const byGdw = new Map<
      string,
      {
        godownId: string;
        godownName: string;
        salesCount: number;
        salesAmount: number;
        purchaseCount: number;
        purchaseAmount: number;
      }
    >();

    godowns.forEach((g) => {
      byGdw.set(g.id, {
        godownId: g.id,
        godownName: g.name,
        salesCount: 0,
        salesAmount: 0,
        purchaseCount: 0,
        purchaseAmount: 0,
      });
    });

    const tradeVouchers: Array<{
      id: string;
      invoiceNo: string;
      date: string;
      type: string;
      partyName: string;
      godownId: string;
      godownName: string;
      totalAmount: number;
      status: string;
    }> = [];

    transactions.forEach((tx) => {
      if (tx.isCancelled) return;
      if (tx.type !== 'Sale' && tx.type !== 'Purchase') return;
      if (tx.invoiceNo.startsWith('PAY-OUT') || tx.invoiceNo.startsWith('PAYOUT')) return;

      const gdwId = resolveTxGodownId(tx);
      const bucket = byGdw.get(gdwId) || byGdw.get(primaryGodownId);
      if (bucket) {
        if (tx.type === 'Sale') {
          bucket.salesCount += 1;
          bucket.salesAmount += tx.totalAmount || 0;
        } else {
          bucket.purchaseCount += 1;
          bucket.purchaseAmount += tx.totalAmount || 0;
        }
      }

      if (selectedWarehouseId === 'ALL' || gdwId === selectedWarehouseId) {
        tradeVouchers.push({
          id: tx.id,
          invoiceNo: tx.invoiceNo,
          date: tx.date,
          type: tx.invoiceNo.startsWith('PO-') ? 'Purchase Order' : tx.type,
          partyName: tx.partyName,
          godownId: gdwId,
          godownName: godowns.find((g) => g.id === gdwId)?.name || 'Primary Hub',
          totalAmount: tx.totalAmount || 0,
          status: tx.status,
        });
      }
    });

    return {
      summaries: Array.from(byGdw.values()),
      vouchers: tradeVouchers,
    };
  }, [transactions, godowns, itemGodownMap, primaryGodownId, selectedWarehouseId]);

  const persistGodowns = (next: Godown[]) => {
    setGodowns(next);
    safeSetStoredData('mystore_godowns', next);
  };

  const persistBins = (next: typeof binsByGodown) => {
    setBinsByGodown(next);
    safeSetStoredData('bm360_warehouse_bins', next);
  };

  const suppliers = useMemo(() => parties.filter((p) => p.type === 'Supplier'), [parties]);

  const lowStockItems = useMemo(
    () =>
      items
        .filter((it) => (it.stock || 0) <= (it.minStockAlert ?? 5))
        .sort((a, b) => (a.stock || 0) - (b.stock || 0)),
    [items]
  );

  const getSuggestedReorderQty = (itemId: string, currentStock: number, maxLevel?: number) => {
    if (reorderQtyMap[itemId] !== undefined) return reorderQtyMap[itemId];
    return Math.max(10, (maxLevel || 25) - Math.max(0, currentStock));
  };

  const handleAddBin = (godownId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newBinCode.trim()) {
      showToast('Enter a Rack / Bin code (e.g. A1-R2).', 'warning');
      return;
    }
    const existing = binsByGodown[godownId] || [];
    const next = {
      ...binsByGodown,
      [godownId]: [
        ...existing,
        {
          id: `bin-${Date.now()}`,
          code: newBinCode.trim().toUpperCase(),
          zone: newBinZone.trim() || 'General Storage Zone',
        },
      ],
    };
    persistBins(next);
    setNewBinCode('');
    setNewBinZone('');
    showToast(`Added bin ${newBinCode.trim().toUpperCase()}.`, 'success');
  };

  const handleDeleteBin = (godownId: string, binId: string, binCode: string) => {
    requestConfirmation({
      title: 'Remove Rack / Bin?',
      message: `Remove rack/bin "${binCode}" from this warehouse?`,
      confirmLabel: 'Remove Bin',
      variant: 'danger',
      onConfirm: () => {
        const next = {
          ...binsByGodown,
          [godownId]: (binsByGodown[godownId] || []).filter((b) => b.id !== binId),
        };
        persistBins(next);
        showToast(`Removed bin ${binCode}.`, 'info');
      },
    });
  };

  const handleGenerateLowStockPo = () => {
    if (lowStockItems.length === 0) {
      showToast('All SKUs are above minimum stock levels.', 'info');
      return;
    }
    const supName = reorderSupplierName || suppliers[0]?.name || 'Primary Store Supplier';
    const poLines = lowStockItems
      .map((it) => {
        const qty = Math.max(0, getSuggestedReorderQty(it.id, it.stock || 0, it.maxStockLevel));
        if (qty <= 0) return null;
        const rate = it.purchasePrice || Math.round((it.salePrice || 100) * 0.75);
        const taxPct = it.taxRate || 0;
        const amount = Math.round(qty * rate * (1 + taxPct / 100) * 100) / 100;
        return {
          id: `po-line-${it.id}-${Date.now()}`,
          name: it.name,
          hsn: it.hsnCode || it.code || '8471',
          qty,
          unit: it.unit || 'PCS',
          price: rate,
          discountPercent: 0,
          taxPercent: taxPct,
          amount,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (poLines.length === 0) {
      showToast('Set at least 1 item reorder quantity > 0.', 'warning');
      return;
    }
    const totalAmount = Math.round(poLines.reduce((s, l) => s + l.amount, 0));
    const poNo = `PO-${Math.floor(1000 + Math.random() * 9000)}`;
    addTransaction({
      type: 'Purchase',
      invoiceNo: poNo,
      date: new Date().toLocaleDateString('en-GB'),
      partyName: supName,
      partyPhone: suppliers.find((s) => s.name === supName)?.phone || '',
      firm: company.name || 'MY STORE',
      user: currentUser?.name || 'Admin',
      paymentType: 'Credit',
      totalAmount,
      receivedAmount: 0,
      balance: totalAmount,
      dueDate: new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-GB'),
      status: 'Unpaid',
      fulfillmentStatus: 'Pending',
      skipStockDeduction: true,
      items: poLines,
      notes: `Purchase Order auto-generated from Warehouse Low-Stock Reorder Planner (${poLines.length} SKUs).`,
    });
    setIsReorderOpen(false);
    showToast(`Created Purchase Order ${poNo} for ${supName} (₹${totalAmount.toLocaleString('en-IN')}).`, 'success');
    setActiveTab('purchase-order');
  };

  const handleExportWarehouseLedgerCsv = () => {
    const header = [
      'Warehouse',
      'SKU',
      'Product Name',
      'Opening Stock',
      'Inward',
      'Outward',
      'Closing Stock',
      'Reserved Stock',
      'Available Stock',
      'Unit',
      'Cost Valuation (INR)',
    ];
    const rows = warehouseLedgerRows.map((r) => [
      `"${r.godownName.replace(/"/g, '""')}"`,
      r.sku,
      `"${r.itemName.replace(/"/g, '""')}"`,
      r.openingStock,
      r.inward,
      r.outward,
      r.closingStock,
      r.reserved,
      r.available,
      r.unit,
      Math.round(r.valuation * 100) / 100,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warehouse-stock-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${warehouseLedgerRows.length} warehouse stock rows to CSV.`, 'success');
  };

  const openAddModal = () => {
    setEditingGodown(null);
    setName('');
    setLocation('');
    setManager('');
    setContact('');
    setCapacity('2500');
    setIsModalOpen(true);
  };

  const openEditModal = (g: Godown) => {
    setEditingGodown(g);
    setName(g.name);
    setLocation(g.location);
    setManager(g.manager);
    setContact(g.contact);
    setCapacity(String(g.capacitySqFt || 2500));
    setIsModalOpen(true);
  };

  const handleSaveGodown = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !location.trim()) {
      showToast('Please enter godown name and location', 'warning');
      return;
    }

    if (editingGodown) {
      const updated = godowns.map((g) =>
        g.id === editingGodown.id
          ? {
              ...g,
              name: name.trim(),
              location: location.trim(),
              manager: manager.trim() || 'Store Keeper',
              contact: contact.trim() || '+91 98450 11223',
              capacitySqFt: parseInt(capacity, 10) || 2000,
            }
          : g
      );
      persistGodowns(updated);
      showToast(`Updated godown "${name.trim()}".`, 'success');
    } else {
      const newGodown: Godown = {
        id: `gdw-${Date.now()}`,
        name: name.trim(),
        location: location.trim(),
        manager: manager.trim() || 'Store Keeper',
        contact: contact.trim() || '+91 98450 11223',
        capacitySqFt: parseInt(capacity, 10) || 2000,
        isCentral: godowns.length === 0,
        totalStockValue: 0,
      };
      persistGodowns([...godowns, newGodown]);
      showToast(`Godown "${name.trim()}" created successfully.`, 'success');
    }

    setIsModalOpen(false);
  };

  const handleSetPrimary = (id: string) => {
    const updated = godowns.map((g) => ({ ...g, isCentral: g.id === id }));
    persistGodowns(updated);
    const chosen = updated.find((g) => g.id === id);
    showToast(`${chosen?.name || 'Godown'} set as Primary Hub.`, 'success');
  };

  const handleDeleteGodown = (g: Godown) => {
    if (godowns.length <= 1) {
      showToast('At least one active godown must remain.', 'warning');
      return;
    }
    requestConfirmation({
      title: 'Delete Warehouse / Godown?',
      message: `Remove "${g.name}"? Stock tracked against it will fall back to your primary hub.`,
      confirmLabel: 'Delete Warehouse',
      variant: 'danger',
      onConfirm: () => {
        const remaining = godowns.filter((x) => x.id !== g.id);
        if (g.isCentral && remaining.length > 0) {
          remaining[0] = { ...remaining[0], isCentral: true };
        }
        persistGodowns(remaining);
        showToast(`Warehouse "${g.name}" deleted.`, 'info');
      },
    });
  };

  const filteredGodowns = godowns.filter((g) => {
    if (facilityFilter === 'CENTRAL' && !g.isCentral) return false;
    if (facilityFilter === 'BRANCH' && g.isCentral) return false;
    return (
      !search.trim() ||
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.location.toLowerCase().includes(search.toLowerCase()) ||
      g.manager.toLowerCase().includes(search.toLowerCase())
    );
  });

  const filteredTransfers = useMemo(
    () =>
      stockTransfers.filter(
        (t) =>
          selectedWarehouseId === 'ALL' ||
          t.fromGodownId === selectedWarehouseId ||
          t.toGodownId === selectedWarehouseId
      ),
    [stockTransfers, selectedWarehouseId]
  );

  const inspectedGodown = godowns.find((g) => g.id === inspectGodownId);
  const inspectedStats = inspectGodownId ? godownAnalytics.get(inspectGodownId) : undefined;
  const totalCombinedValuation = Array.from(godownAnalytics.values()).reduce((s, v) => s + v.stockValue, 0);

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-slate-950 flex flex-col overflow-hidden select-none text-xs text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Godowns &amp; Warehouses
            </h1>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {godowns.length} Facilities &bull; Total Valuation ₹{Math.round(totalCombinedValuation).toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Multi-godown stock allocation, Opening/Closing warehouse ledger, transfer history &amp; branch sales/purchases
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsReorderOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-800 dark:text-amber-300 font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Reorder Planner ({lowStockItems.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stock-transfer')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Boxes className="w-4 h-4 text-emerald-600" />
            <span>Transfer Stock</span>
          </button>

          <button
            type="button"
            onClick={() => exportCurrentViewPdf({ title: 'Godowns & Warehouses Report' })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Godown</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between gap-4 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-6 font-semibold">
          {(
            [
              { id: 'directory', label: `Godown Directory (${godowns.length})`, icon: Building2 },
              { id: 'ledger', label: 'Opening / Closing Stock Ledger', icon: BookOpen },
              { id: 'transfers', label: `Transfer History (${stockTransfers.length})`, icon: Boxes },
              { id: 'sales-purchases', label: 'Warehouse Sales & Purchases', icon: TrendingUp },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`py-3 flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
                  active
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeSubTab !== 'directory' && (
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            aria-label="Filter by warehouse"
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
          >
            <option value="ALL">All Warehouses ({godowns.length})</option>
            {godowns.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* TAB 1: GODOWN DIRECTORY */}
        {activeSubTab === 'directory' && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search godown name, city, or manager..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-1.5">
                {(['ALL', 'CENTRAL', 'BRANCH'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFacilityFilter(f)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer ${
                      facilityFilter === f
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {f === 'ALL' ? 'All Facilities' : f === 'CENTRAL' ? 'Primary Hub' : 'Branch Depots'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredGodowns.map((g: Godown) => {
                const stats = godownAnalytics.get(g.id) || {
                  skuCount: 0,
                  totalUnits: 0,
                  reservedUnits: 0,
                  availableUnits: 0,
                  stockValue: 0,
                  itemsList: [],
                };
                return (
                  <div
                    key={g.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug truncate">
                            {g.name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] mt-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="line-clamp-1">{g.location}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {g.isCentral ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              PRIMARY HUB
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(g.id)}
                              title="Make Primary Hub"
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-1"
                            >
                              <Star className="w-2.5 h-2.5" /> Set Primary
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 dark:border-slate-800 my-3 bg-slate-50/60 dark:bg-slate-800/50 rounded-lg px-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Avail / Res</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-xs tabular-nums">
                            {stats.availableUnits} / {stats.reservedUnits}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Capacity</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs tabular-nums">
                            {(g.capacitySqFt || 2000).toLocaleString()} Sq.Ft
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Live Value</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs tabular-nums">
                            ₹ {Math.round(stats.stockValue).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Manager: <strong>{g.manager}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>Contact: {g.contact}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Grid3X3 className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Racks / Bins: <strong>{(binsByGodown[g.id] || []).length} configured</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(g)}
                          className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
                          title="Edit Warehouse"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {godowns.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteGodown(g)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                            title="Delete Warehouse"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setInspectGodownId(g.id)}
                        className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 cursor-pointer"
                      >
                        Stock &amp; Bins ({stats.skuCount}) &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* TAB 2: OPENING / CLOSING STOCK LEDGER */}
        {activeSubTab === 'ledger' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                  Warehouse Opening, Reserved, Available &amp; Closing Stock Ledger ({warehouseLedgerRows.length} rows)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Real-time godown stock reconciliation combining transfers &amp; stock movement logs
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={ledgerSkuSearch}
                    onChange={(e) => setLedgerSkuSearch(e.target.value)}
                    placeholder="Filter product or SKU..."
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExportWarehouseLedgerCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Warehouse</th>
                    <th className="py-2.5 px-4">Product / SKU</th>
                    <th className="py-2.5 px-4 text-right">Opening</th>
                    <th className="py-2.5 px-4 text-right">Inward</th>
                    <th className="py-2.5 px-4 text-right">Outward</th>
                    <th className="py-2.5 px-4 text-right">Closing</th>
                    <th className="py-2.5 px-4 text-right">Reserved</th>
                    <th className="py-2.5 px-4 text-right">Available</th>
                    <th className="py-2.5 px-4 text-right">Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {warehouseLedgerRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400">
                        No stock records match this warehouse filter.
                      </td>
                    </tr>
                  ) : (
                    warehouseLedgerRows.map((row) => (
                      <tr key={row.key} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-medium text-slate-700 dark:text-slate-300">{row.godownName}</td>
                        <td className="py-2.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{row.itemName}</div>
                          <div className="text-[10px] font-mono text-slate-400">{row.sku}</div>
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-slate-600 dark:text-slate-300">{row.openingStock}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-emerald-600 font-semibold">+{row.inward}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-rose-600 font-semibold">-{row.outward}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-bold">{row.closingStock} {row.unit}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-amber-600">{row.reserved}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-extrabold text-emerald-700 dark:text-emerald-400">
                          {row.available}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-bold">
                          ₹{Math.round(row.valuation).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: TRANSFER HISTORY */}
        {activeSubTab === 'transfers' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                  Inter-Warehouse Stock Transfer History ({filteredTransfers.length})
                </h2>
                <p className="text-[11px] text-slate-500">All inward &amp; outward movements logged across your godowns</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('stock-transfer')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Stock Transfer</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Transfer #</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Origin Godown</th>
                    <th className="py-2.5 px-4 text-center">Flow</th>
                    <th className="py-2.5 px-4">Destination Godown</th>
                    <th className="py-2.5 px-4">Product</th>
                    <th className="py-2.5 px-4 text-right">Quantity</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        No inter-warehouse stock transfers logged for the selected filter yet.
                      </td>
                    </tr>
                  ) : (
                    filteredTransfers.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono font-bold">{st.transferNo}</td>
                        <td className="py-2.5 px-4 text-slate-500">{st.date}</td>
                        <td className="py-2.5 px-4 font-medium">{st.fromGodownName}</td>
                        <td className="py-2.5 px-4 text-center">
                          <ArrowRight className="w-3.5 h-3.5 mx-auto text-emerald-600" />
                        </td>
                        <td className="py-2.5 px-4 font-medium">{st.toGodownName}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">{st.itemName}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-600 tabular-nums">
                          {st.quantity} {st.unit}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            {st.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: WAREHOUSE-WISE SALES & PURCHASES */}
        {activeSubTab === 'sales-purchases' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {warehouseTradeSummary.summaries.map((sum) => (
                <div
                  key={sum.godownId}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs space-y-2.5"
                >
                  <div className="font-bold text-sm text-slate-900 dark:text-white truncate">{sum.godownName}</div>
                  <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Warehouse Sales ({sum.salesCount})</div>
                      <div className="text-base font-extrabold text-emerald-600 tabular-nums">
                        ₹{Math.round(sum.salesAmount).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Warehouse Purchases ({sum.purchaseCount})</div>
                      <div className="text-base font-extrabold text-blue-600 tabular-nums">
                        ₹{Math.round(sum.purchaseAmount).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-sm">Warehouse Sales &amp; Purchase Vouchers ({warehouseTradeSummary.vouchers.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-4">Voucher #</th>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Warehouse</th>
                      <th className="py-2.5 px-4">Party</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {warehouseTradeSummary.vouchers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400">
                          No sales or purchase vouchers mapped to this warehouse yet.
                        </td>
                      </tr>
                    ) : (
                      warehouseTradeSummary.vouchers.slice(0, 120).map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-4 font-mono font-bold">{v.invoiceNo}</td>
                          <td className="py-2.5 px-4 text-slate-500">{v.date}</td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                v.type === 'Sale'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              }`}
                            >
                              {v.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-medium">{v.godownName}</td>
                          <td className="py-2.5 px-4 font-semibold">{v.partyName}</td>
                          <td className="py-2.5 px-4 text-right font-extrabold tabular-nums">
                            ₹{v.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-600 dark:text-slate-300">{v.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: View Godown Inventory & Bins */}
      {inspectedGodown && inspectedStats && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/70">
              <div className="flex items-center gap-2.5">
                <Package className="w-4 h-4 text-emerald-600" />
                <div>
                  <h2 className="font-bold text-sm text-slate-900 dark:text-white">{inspectedGodown.name} — Stock Sheet</h2>
                  <p className="text-[11px] text-slate-500">
                    {inspectedStats.skuCount} SKUs &bull; {inspectedStats.availableUnits} Available ({inspectedStats.reservedUnits} Reserved) &bull; Valuation ₹
                    {Math.round(inspectedStats.stockValue).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectGodownId(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {inspectedStats.itemsList.length === 0 ? (
                <div className="p-10 text-center text-slate-400">
                  No inventory currently allocated to {inspectedGodown.name}. Transfer stock from another godown to populate it.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-4">SKU</th>
                      <th className="py-2.5 px-4">Product Name</th>
                      <th className="py-2.5 px-4 text-right">Available / Res</th>
                      <th className="py-2.5 px-4 text-right">Total Qty</th>
                      <th className="py-2.5 px-4 text-right">Cost Valuation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {inspectedStats.itemsList.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono text-slate-500">{row.code}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">{row.name}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-slate-500">
                          {row.available} / {row.reserved}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                          {row.qty} {row.unit}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          ₹ {Math.round(row.value).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Rack / Bin Locations Section */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Grid3X3 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Rack &amp; Bin Locations ({(binsByGodown[inspectedGodown.id] || []).length})</span>
                  </div>
                </div>
                <form
                  onSubmit={(e) => handleAddBin(inspectedGodown.id, e)}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    type="text"
                    value={newBinCode}
                    onChange={(e) => setNewBinCode(e.target.value)}
                    placeholder="Bin Code (e.g. A1-R2)"
                    className="w-36 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono uppercase"
                  />
                  <input
                    type="text"
                    value={newBinZone}
                    onChange={(e) => setNewBinZone(e.target.value)}
                    placeholder="Zone / Shelf Note (e.g. Dry Grains)"
                    className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                  >
                    + Add Bin
                  </button>
                </form>
                <div className="flex flex-wrap gap-2">
                  {(binsByGodown[inspectedGodown.id] || []).map((bin) => (
                    <div
                      key={bin.id}
                      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px]"
                    >
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{bin.code}</span>
                      <span className="text-slate-500">{bin.zone}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteBin(inspectedGodown.id, bin.id, bin.code)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Remove Bin"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setInspectGodownId(null);
                  setActiveTab('stock-transfer');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
              >
                Transfer Stock Between Godowns
              </button>
              <button
                type="button"
                onClick={() => setInspectGodownId(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Low-Stock Reorder Planner */}
      {isReorderOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-amber-600" />
                <div>
                  <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                    Low-Stock Reorder Planner ({lowStockItems.length} SKUs)
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Review quantities below min stock and generate a live Purchase Order
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReorderOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Target Supplier:</span>
              <select
                value={reorderSupplierName}
                onChange={(e) => setReorderSupplierName(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              >
                <option value="">{suppliers[0]?.name || 'Primary Store Supplier'}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.phone || 'Supplier'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto">
              {lowStockItems.length === 0 ? (
                <div className="p-10 text-center text-slate-400">
                  All inventory items are adequately stocked above their minimum thresholds.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-4">Product</th>
                      <th className="py-2.5 px-4 text-center">Current / Min</th>
                      <th className="py-2.5 px-4 text-right">Est Cost</th>
                      <th className="py-2.5 px-4 text-right">Order Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {lowStockItems.map((it) => {
                      const orderQty = getSuggestedReorderQty(it.id, it.stock || 0, it.maxStockLevel);
                      return (
                        <tr key={it.id}>
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{it.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{it.code}</div>
                          </td>
                          <td className="py-2.5 px-4 text-center tabular-nums">
                            <span className="font-bold text-rose-600">{it.stock || 0}</span> /{' '}
                            <span className="text-slate-500">{it.minStockAlert ?? 5}</span> {it.unit}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            ₹{(it.purchasePrice || Math.round((it.salePrice || 100) * 0.75)).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <input
                              type="number"
                              min={0}
                              value={orderQty}
                              onChange={(e) =>
                                setReorderQtyMap((prev) => ({
                                  ...prev,
                                  [it.id]: Math.max(0, Number(e.target.value) || 0),
                                }))
                              }
                              className="w-20 px-2 py-1 text-right rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold tabular-nums"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReorderOpen(false)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={lowStockItems.length === 0}
                onClick={handleGenerateLowStockPo}
                className="px-4 py-1.5 rounded-lg bg-[#8E0E20] hover:bg-[#740918] disabled:opacity-50 text-white font-bold cursor-pointer"
              >
                Generate Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Godown */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                {editingGodown ? `Edit Godown — ${editingGodown.name}` : 'Add New Godown / Warehouse'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveGodown} className="p-5 space-y-3.5">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-[11px]">
                  Godown Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. West Zone Storage Depot"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-[11px]">
                  Location Address *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Street, Industrial Area, City"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-[11px]">
                    Site Manager
                  </label>
                  <input
                    type="text"
                    placeholder="Name"
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-[11px]">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+91 ..."
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-[11px]">
                  Total Capacity (Sq.Ft)
                </label>
                <input
                  type="number"
                  placeholder="2500"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
                >
                  {editingGodown ? 'Update Godown' : 'Save Godown'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
