import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Sliders,
  ChevronDown,
  AlertTriangle,
  FileDown,
  Barcode,
  Printer,
  Edit3,
  Camera,
  CalendarClock,
  Tag,
  ShieldCheck,
  Copy,
  Trash2,
  GitMerge,
  Download,
  TrendingUp,
  Building2,
  X,
  Lock,
  Unlock,
  Package,
  Upload,
  Eye,
  Power,
  CheckCircle2,
  XCircle,
  Scale,
  FileSpreadsheet,
  BarChart3,
  Layers,
  History,
  AlertOctagon,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import {
  generateUniqueEan13Barcode,
  isBarcodeUnique,
  renderBarcodeToSvg,
} from '../utils/barcodeUtils';
import {
  calculateAmountFromWeight,
  calculateWeightFromAmount,
  formatBaseQtyHuman,
  roundMoney,
} from '../utils/kiranaBilling';
import { Godown, Item } from '../types';
import { safeGetStoredData } from '../utils/storage';
import { DEFAULT_GODOWNS } from './WarehousesView';

type ItemsSubTab =
  | 'PRODUCTS'
  | 'ITEM DETAILS'
  | 'BATCH & EXPIRY'
  | 'STOCK LEDGER'
  | 'IMPORT / EXPORT'
  | 'ITEM REPORTS'
  | 'CATEGORIES';

type SortField =
  | 'name-asc'
  | 'price-desc'
  | 'price-asc'
  | 'stock-asc'
  | 'stock-desc'
  | 'margin-desc'
  | 'recent-desc';

type ItemReportKey =
  | 'item-sales'
  | 'item-purchases'
  | 'item-profit'
  | 'stock-valuation'
  | 'low-stock'
  | 'out-of-stock'
  | 'fast-moving'
  | 'slow-moving'
  | 'dead-stock'
  | 'expiry-report'
  | 'category-sales'
  | 'highest-profit'
  | 'lowest-profit';

interface CsvImportRow {
  rowNum: number;
  name: string;
  code: string;
  barcode: string;
  sku: string;
  category: string;
  subcategory: string;
  brand: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  wholesalePrice: number;
  mrp: number;
  taxRate: number;
  stock: number;
  minStockAlert: number;
  errors: string[];
}

function parseTransactionDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const datePart = dateStr.split(',')[0].trim();
  const ddmmyyyy = datePart.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyy) {
    const d = new Date(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDaysUntilDate(dateStr?: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

const QuickLabelSvg: React.FC<{ value: string }> = ({ value }) => {
  const ref = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    renderBarcodeToSvg(ref.current, value, 'AUTO', {
      height: 34,
      width: 1.35,
      fontSize: 10,
      margin: 2,
      displayValue: true,
    });
  }, [value]);
  return <svg ref={ref} className="max-w-full h-auto mx-auto" />;
};

export const ItemsView: React.FC = () => {
  const {
    items,
    selectedItemId,
    setSelectedItemId,
    transactions,
    stockHistory,
    batches,
    priceHistory: globalPriceHistory,
    businessSettings,
    updateBusinessSettingsSection,
    setIsAddItemModalOpen,
    setEditingItem,
    addItem,
    updateItem,
    moveItemToRecycleBin,
    setPrefilledBarcodeForNewItem,
    adjustStock,
    recordDamagedStock,
    exportCurrentViewPdf,
    showToast,
    requestConfirmation,
    recordActivity,
    isFinancialDataVisible,
    openBarcodeScanner,
    setActiveTab,
    canManageBarcodes,
    company,
  } = useVyapar();

  const finVis = isFinancialDataVisible();
  const showCost = finVis.purchaseCost;
  const showMargin = finVis.profitMargins;

  const [activeSubTab, setActiveSubTab] = useState<ItemsSubTab>('PRODUCTS');
  const [searchItem, setSearchItem] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState<'All' | 'In Stock' | 'Low Stock' | 'Out of Stock'>('All');
  const [gstFilter, setGstFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [sortBy, setSortBy] = useState<SortField>('name-asc');

  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Detail pane sub-tabs & Kirana calculator
  const [detailHistoryTab, setDetailHistoryTab] = useState<'transactions' | 'stock' | 'price-audit'>('transactions');
  const [txSearch, setTxSearch] = useState('');
  const [ledgerScope, setLedgerScope] = useState<'selected' | 'all'>('all');
  const [calcMode, setCalcMode] = useState<'amount' | 'weight'>('weight');
  const [calcAmountInput, setCalcAmountInput] = useState('10');
  const [calcWeightInput, setCalcWeightInput] = useState('200');
  const [calcWeightUnit, setCalcWeightUnit] = useState('GM');

  // Expiry & Batch filter
  const [expiryBucketFilter, setExpiryBucketFilter] = useState<'all' | 'expired' | '7d' | '15d' | '30d'>('all');

  // Stock Adjustment & Damaged Stock modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustModalTarget, setAdjustModalTarget] = useState<Item | null>(null);
  const [adjustMode, setAdjustMode] = useState<'set' | 'damaged'>('set');
  const [newStockValue, setNewStockValue] = useState<number>(0);
  const [damagedQtyInput, setDamagedQtyInput] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState('Manual Stock Audit');

  // Merge SKU modal
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSourceItem, setMergeSourceItem] = useState<Item | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');

  // Bulk operation modals
  const [bulkModal, setBulkModal] = useState<'none' | 'price' | 'stock' | 'meta'>('none');
  const [bulkPriceField, setBulkPriceField] = useState<'salePrice' | 'wholesalePrice' | 'purchasePrice'>('salePrice');
  const [bulkPriceType, setBulkPriceType] = useState<'percent' | 'fixed'>('percent');
  const [bulkPriceDirection, setBulkPriceDirection] = useState<'increase' | 'decrease'>('increase');
  const [bulkPriceValue, setBulkPriceValue] = useState<number>(5);

  const [bulkStockAction, setBulkStockAction] = useState<'add' | 'reduce' | 'set'>('add');
  const [bulkStockQty, setBulkStockQty] = useState<number>(10);
  const [bulkStockReason, setBulkStockReason] = useState('Bulk Inventory Update');

  const [bulkMetaCategory, setBulkMetaCategory] = useState('');
  const [bulkMetaGst, setBulkMetaGst] = useState<string>('');
  const [bulkMetaActive, setBulkMetaActive] = useState<'keep' | 'active' | 'inactive'>('keep');

  // Single-item Quick Print Label Modal
  const [printLabelItem, setPrintLabelItem] = useState<Item | null>(null);
  const [printLabelCopies, setPrintLabelCopies] = useState<number>(6);

  // CSV Import state
  const [csvRawText, setCsvRawText] = useState('');
  const [csvPreviewRows, setCsvPreviewRows] = useState<CsvImportRow[]>([]);

  // 13 Item Reports state
  const [activeReport, setActiveReport] = useState<ItemReportKey>('item-sales');
  const [reportPeriod, setReportPeriod] = useState<'all' | 'today' | '7d' | '30d' | 'month'>('all');
  const [reportSearch, setReportSearch] = useState('');

  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
  const godowns = useMemo(
    () => safeGetStoredData<Godown[]>('mystore_godowns', DEFAULT_GODOWNS, Array.isArray),
    []
  );

  const selectedItem = items.find((i) => i.id === selectedItemId) || items[0] || null;

  const allowNegStock =
    Boolean(businessSettings.item.allowNegativeStock) &&
    Boolean(businessSettings.transaction.behaviour.allowNegativeStock);

  // Top Dashboard KPIs
  const dashboardStats = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    let totalItems = items.length;
    let activeCount = 0;
    let inactiveCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalQty = 0;
    let purchaseVal = 0;
    let sellingVal = 0;
    let recentlyAddedCount = 0;
    let expiringSoonCount = 0;

    items.forEach((it) => {
      if (it.isActive === false) inactiveCount += 1;
      else activeCount += 1;

      const minA = it.minStockAlert ?? 5;
      if (it.stock <= 0) outOfStockCount += 1;
      else if (it.stock <= minA) lowStockCount += 1;

      const posStock = Math.max(0, Number(it.stock) || 0);
      totalQty += posStock;
      purchaseVal += posStock * (Number(it.purchasePrice) || 0);
      sellingVal += posStock * (Number(it.salePrice) || 0);

      if (it.createdAt) {
        const createdMs = new Date(it.createdAt).getTime();
        if (!Number.isNaN(createdMs) && now - createdMs <= sevenDaysMs) {
          recentlyAddedCount += 1;
        }
      }

      const d = getDaysUntilDate(it.expiryDate);
      if (d !== null && d <= 30) {
        expiringSoonCount += 1;
      }
    });

    // Include batch expiry if any active batch expires <=30d and wasn't counted on item
    const batchExpiringSet = new Set<string>();
    batches.forEach((b) => {
      if (b.qty <= 0) return;
      const d = getDaysUntilDate(b.expiryDate);
      if (d !== null && d <= 30) {
        batchExpiringSet.add(`${b.itemId}-${b.batchNumber}`);
      }
    });

    return {
      totalItems,
      activeCount,
      inactiveCount,
      lowStockCount,
      outOfStockCount,
      totalQty: Math.round(totalQty * 100) / 100,
      purchaseVal: Math.round(purchaseVal * 100) / 100,
      sellingVal: Math.round(sellingVal * 100) / 100,
      potentialProfit: Math.round((sellingVal - purchaseVal) * 100) / 100,
      recentlyAddedCount,
      expiringSoonCount: Math.max(expiringSoonCount, batchExpiringSet.size),
    };
  }, [items, batches]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return ['All', ...Array.from(set).sort()];
  }, [items]);

  const uniqueBrands = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.brand) set.add(it.brand);
    });
    return ['All', ...Array.from(set).sort()];
  }, [items]);

  const filteredItems = useMemo(() => {
    const list = items.filter((it) => {
      const q = searchItem.trim().toLowerCase();
      const matchesSearch =
        !q ||
        it.name.toLowerCase().includes(q) ||
        it.code.toLowerCase().includes(q) ||
        (it.sku || '').toLowerCase().includes(q) ||
        (it.barcode || '').toLowerCase().includes(q) ||
        (it.extraBarcodes || []).some((b) => b.toLowerCase().includes(q)) ||
        (it.brand || '').toLowerCase().includes(q) ||
        (it.category || '').toLowerCase().includes(q) ||
        (it.subcategory || '').toLowerCase().includes(q) ||
        (it.tags || []).some((t) => t.toLowerCase().includes(q));
      if (!matchesSearch) return false;
      if (categoryFilter !== 'All' && (it.category || 'Uncategorized') !== categoryFilter) return false;
      if (brandFilter !== 'All' && (it.brand || '') !== brandFilter) return false;
      const minA = it.minStockAlert ?? 5;
      if (stockFilter === 'Out of Stock' && it.stock > 0) return false;
      if (stockFilter === 'Low Stock' && (it.stock <= 0 || it.stock > minA)) return false;
      if (stockFilter === 'In Stock' && it.stock <= 0) return false;

      if (gstFilter !== 'All') {
        const effGst = it.gstApplicable === false ? 0 : Number(it.taxRate) || 0;
        if (effGst !== Number(gstFilter)) return false;
      }

      if (statusFilter === 'Active' && it.isActive === false) return false;
      if (statusFilter === 'Inactive' && it.isActive !== false) return false;

      return true;
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'price-desc':
          return (b.salePrice || 0) - (a.salePrice || 0);
        case 'price-asc':
          return (a.salePrice || 0) - (b.salePrice || 0);
        case 'stock-asc':
          return (a.stock || 0) - (b.stock || 0);
        case 'stock-desc':
          return (b.stock || 0) - (a.stock || 0);
        case 'margin-desc': {
          const mA = a.salePrice > 0 ? ((a.salePrice - a.purchasePrice) / a.salePrice) * 100 : 0;
          const mB = b.salePrice > 0 ? ((b.salePrice - b.purchasePrice) / b.salePrice) * 100 : 0;
          return mB - mA;
        }
        case 'recent-desc':
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        case 'name-asc':
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return sorted;
  }, [items, searchItem, categoryFilter, brandFilter, stockFilter, gstFilter, statusFilter, sortBy]);

  useEffect(() => {
    if (selectedItem && activeSubTab === 'ITEM DETAILS' && (selectedItem.barcode || selectedItem.code)) {
      renderBarcodeToSvg(
        barcodeSvgRef.current,
        selectedItem.barcode || selectedItem.code,
        'AUTO',
        { height: 38, width: 1.5, fontSize: 11, margin: 3 }
      );
    }
  }, [selectedItem?.id, selectedItem?.barcode, selectedItem?.code, activeSubTab]);

  useEffect(() => {
    if (!selectedItem) return;
    const u = (selectedItem.unit || '').toUpperCase();
    setCalcWeightUnit(u === 'LTR' || u === 'ML' ? 'ML' : 'GM');
  }, [selectedItem?.id]);

  // Transactions involving selectedItem
  const itemTransactions = useMemo(
    () =>
      transactions
        .filter(
          (t) =>
            selectedItem &&
            t.items.some(
              (li) =>
                li.itemId === selectedItem.id ||
                li.id === selectedItem.id ||
                li.name.toLowerCase() === selectedItem.name.toLowerCase()
            )
        )
        .filter((t) => {
          const q = txSearch.trim().toLowerCase();
          if (!q) return true;
          return (
            t.invoiceNo.toLowerCase().includes(q) ||
            t.partyName.toLowerCase().includes(q) ||
            t.type.toLowerCase().includes(q)
          );
        }),
    [transactions, selectedItem, txSearch]
  );

  // Movements for ledger
  const itemMovements = useMemo(() => {
    const base =
      ledgerScope === 'all' && activeSubTab === 'STOCK LEDGER'
        ? stockHistory
        : stockHistory.filter(
            (m) =>
              selectedItem &&
              (m.itemId === selectedItem.id ||
                m.itemName.toLowerCase() === selectedItem.name.toLowerCase())
          );
    const q = txSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (m) =>
        m.itemName.toLowerCase().includes(q) ||
        m.referenceNo.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q) ||
        (m.notes || '').toLowerCase().includes(q)
    );
  }, [stockHistory, selectedItem, txSearch, ledgerScope, activeSubTab]);

  // Price audit entries for selectedItem
  const selectedPriceAudit = useMemo(() => {
    if (!selectedItem) return [];
    const fromItem = selectedItem.priceHistory || [];
    const fromGlobal = globalPriceHistory
      .filter((p) => p.itemId === selectedItem.id || p.itemName.toLowerCase() === selectedItem.name.toLowerCase())
      .map((p) => ({
        id: p.id,
        timestamp: p.timestamp,
        actor: p.actor,
        field: p.priceType || 'Sale Price',
        oldValue: p.oldPrice,
        newValue: p.newPrice,
        reason: 'Catalog Price Revision',
      }));
    const seen = new Set(fromItem.map((e) => e.id));
    return [...fromItem, ...fromGlobal.filter((g) => !seen.has(g.id))].sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
  }, [selectedItem, globalPriceHistory]);

  const itemProfitMetrics = useMemo(() => {
    if (!selectedItem) return { marginPct: 0, unitProfit: 0, soldUnits: 0, salesRevenue: 0, estTotalProfit: 0 };
    const salePrice = selectedItem.salePrice || 0;
    const costPrice = selectedItem.purchasePrice || 0;
    const unitProfit = salePrice - costPrice;
    const marginPct = salePrice > 0 ? Math.round((unitProfit / salePrice) * 1000) / 10 : 0;

    let soldUnits = 0;
    let salesRevenue = 0;
    let estTotalProfit = 0;

    transactions.forEach((tx) => {
      if (tx.type !== 'Sale' || tx.isCancelled) return;
      tx.items.forEach((li) => {
        if (li.itemId === selectedItem.id || li.id === selectedItem.id || li.name.toLowerCase() === selectedItem.name.toLowerCase()) {
          const qty = Number(li.qty) || 0;
          const lineAmt = Number(li.amount) || qty * (Number(li.price) || salePrice);
          const lineCost = li.unitCostAtSale !== undefined ? qty * li.unitCostAtSale : qty * costPrice;
          soldUnits += qty;
          salesRevenue += lineAmt;
          estTotalProfit += lineAmt - lineCost;
        }
      });
    });

    return {
      marginPct,
      unitProfit,
      soldUnits: Math.round(soldUnits * 1000) / 1000,
      salesRevenue: Math.round(salesRevenue * 100) / 100,
      estTotalProfit: Math.round(estTotalProfit * 100) / 100,
    };
  }, [selectedItem, transactions]);

  const selectedGodownBreakdown = useMemo(() => {
    if (!selectedItem) return [];
    const defaultGdwId = godowns.find((g) => g.isCentral)?.id || godowns[0]?.id || 'gdw-1';
    const stocksMap: Record<string, number> =
      selectedItem.godownStocks && Object.keys(selectedItem.godownStocks).length > 0
        ? selectedItem.godownStocks
        : { [selectedItem.godownId || defaultGdwId]: Math.max(0, selectedItem.stock || 0) };
    return Object.entries(stocksMap).map(([gdwId, qty]) => {
      const g = godowns.find((x) => x.id === gdwId);
      return {
        gdwId,
        name: g?.name || gdwId,
        qty: Number(qty) || 0,
      };
    });
  }, [selectedItem, godowns]);

  // Batch & Expiry combined monitor
  const batchExpiryRows = useMemo(() => {
    type BatchRow = {
      key: string;
      itemId: string;
      itemName: string;
      itemCode: string;
      unit: string;
      batchNumber: string;
      mfgDate: string;
      expiryDate: string;
      daysLeft: number | null;
      qty: number;
      purchaseRate: number;
      saleRate: number;
      stockValue: number;
      source: 'batch' | 'item';
    };
    const rows: BatchRow[] = [];
    const coveredItemIds = new Set<string>();

    batches.forEach((b) => {
      if (b.qty <= 0) return;
      const linked = items.find((i) => i.id === b.itemId || i.name.toLowerCase() === b.itemName.toLowerCase());
      if (linked) coveredItemIds.add(linked.id);
      rows.push({
        key: `bat-${b.id}`,
        itemId: linked?.id || b.itemId,
        itemName: linked?.name || b.itemName,
        itemCode: linked?.code || '—',
        unit: linked?.unit || 'PCS',
        batchNumber: b.batchNumber,
        mfgDate: b.mfgDate || '—',
        expiryDate: b.expiryDate || '',
        daysLeft: getDaysUntilDate(b.expiryDate),
        qty: b.qty,
        purchaseRate: b.purchaseRate,
        saleRate: b.saleRate,
        stockValue: Math.round(b.qty * b.purchaseRate * 100) / 100,
        source: 'batch',
      });
    });

    items.forEach((it) => {
      if (!it.expiryDate && !it.batchNo) return;
      if (coveredItemIds.has(it.id)) return;
      rows.push({
        key: `itm-${it.id}`,
        itemId: it.id,
        itemName: it.name,
        itemCode: it.code,
        unit: it.unit,
        batchNumber: it.batchNo || 'MAIN-STOCK',
        mfgDate: '—',
        expiryDate: it.expiryDate || '',
        daysLeft: getDaysUntilDate(it.expiryDate),
        qty: it.stock,
        purchaseRate: it.purchasePrice,
        saleRate: it.salePrice,
        stockValue: Math.round(Math.max(0, it.stock) * it.purchasePrice * 100) / 100,
        source: 'item',
      });
    });

    rows.sort((a, b) => (a.daysLeft ?? 99999) - (b.daysLeft ?? 99999));

    const summary = {
      expired: rows.filter((r) => r.daysLeft !== null && r.daysLeft < 0).length,
      within7: rows.filter((r) => r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 7).length,
      within15: rows.filter((r) => r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 15).length,
      within30: rows.filter((r) => r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 30).length,
      total: rows.length,
    };

    const filtered = rows.filter((r) => {
      if (expiryBucketFilter === 'expired') return r.daysLeft !== null && r.daysLeft < 0;
      if (expiryBucketFilter === '7d') return r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 7;
      if (expiryBucketFilter === '15d') return r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 15;
      if (expiryBucketFilter === '30d') return r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 30;
      return true;
    });

    return { summary, filtered };
  }, [batches, items, expiryBucketFilter]);

  // 13 Item Reports Analytics Engine
  const reportData = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const inPeriod = (dateStr?: string) => {
      if (reportPeriod === 'all') return true;
      const d = parseTransactionDate(dateStr);
      if (!d) return true;
      if (reportPeriod === 'today') return d >= startOfToday;
      if (reportPeriod === '7d') return now.getTime() - d.getTime() <= 7 * 86400000;
      if (reportPeriod === '30d') return now.getTime() - d.getTime() <= 30 * 86400000;
      if (reportPeriod === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return true;
    };

    const salesAgg = new Map<string, { qty: number; revenue: number; cost: number; profit: number }>();
    const purAgg = new Map<string, { qty: number; spend: number }>();

    transactions.forEach((tx) => {
      if (tx.isCancelled || !inPeriod(tx.date)) return;
      if (tx.type === 'Sale' || tx.type === 'Sale Return') {
        const sign = tx.type === 'Sale Return' ? -1 : 1;
        tx.items.forEach((li) => {
          const matched = items.find(
            (i) => i.id === li.itemId || i.id === li.id || i.name.toLowerCase() === li.name.toLowerCase() || (li.hsn && i.code === li.hsn)
          );
          const key = matched?.id || li.name.toLowerCase();
          const cur = salesAgg.get(key) || { qty: 0, revenue: 0, cost: 0, profit: 0 };
          const q = (Number(li.qty) || 0) * sign;
          const rev = (Number(li.amount) || (Number(li.qty) || 0) * (Number(li.price) || 0)) * sign;
          const c = (li.unitCostAtSale !== undefined ? (Number(li.qty) || 0) * li.unitCostAtSale : (Number(li.qty) || 0) * (matched?.purchasePrice || 0)) * sign;
          cur.qty += q;
          cur.revenue += rev;
          cur.cost += c;
          cur.profit += rev - c;
          salesAgg.set(key, cur);
        });
      } else if (tx.type === 'Purchase') {
        tx.items.forEach((li) => {
          const matched = items.find(
            (i) => i.id === li.itemId || i.id === li.id || i.name.toLowerCase() === li.name.toLowerCase() || (li.hsn && i.code === li.hsn)
          );
          const key = matched?.id || li.name.toLowerCase();
          const cur = purAgg.get(key) || { qty: 0, spend: 0 };
          cur.qty += Number(li.qty) || 0;
          cur.spend += Number(li.amount) || (Number(li.qty) || 0) * (Number(li.price) || 0);
          purAgg.set(key, cur);
        });
      }
    });

    const q = reportSearch.trim().toLowerCase();
    const matchSearch = (name: string, extra = '') =>
      !q || name.toLowerCase().includes(q) || extra.toLowerCase().includes(q);

    if (activeReport === 'category-sales') {
      const catMap = new Map<string, { category: string; itemsCount: number; qtySold: number; revenue: number; profit: number }>();
      items.forEach((it) => {
        const cat = it.category || 'General';
        const cur = catMap.get(cat) || { category: cat, itemsCount: 0, qtySold: 0, revenue: 0, profit: 0 };
        const agg = salesAgg.get(it.id) || salesAgg.get(it.name.toLowerCase());
        cur.itemsCount += 1;
        cur.qtySold += agg?.qty || 0;
        cur.revenue += agg?.revenue || 0;
        cur.profit += agg?.profit || 0;
        catMap.set(cat, cur);
      });
      const rows = Array.from(catMap.values())
        .filter((r) => matchSearch(r.category))
        .sort((a, b) => b.revenue - a.revenue);
      return {
        columns: ['Category', 'SKUs', 'Sold Qty', 'Sales Revenue', 'Gross Profit', 'Margin %'],
        rows: rows.map((r) => [
          r.category,
          String(r.itemsCount),
          String(Math.round(r.qtySold * 100) / 100),
          `₹ ${roundMoney(r.revenue).toLocaleString('en-IN')}`,
          showMargin ? `₹ ${roundMoney(r.profit).toLocaleString('en-IN')}` : '••••',
          showMargin ? `${r.revenue > 0 ? roundMoney((r.profit / r.revenue) * 100) : 0}%` : '••••',
        ]),
      };
    }

    if (activeReport === 'expiry-report') {
      const rows = batchExpiryRows.filtered.filter((r) => matchSearch(r.itemName, r.batchNumber));
      return {
        columns: ['Item Name', 'Batch No', 'Expiry Date', 'Days Left', 'Qty', 'Stock Value'],
        rows: rows.map((r) => [
          r.itemName,
          r.batchNumber,
          r.expiryDate || '—',
          r.daysLeft === null ? '—' : r.daysLeft < 0 ? `Expired (${Math.abs(r.daysLeft)}d ago)` : `${r.daysLeft} days`,
          `${r.qty} ${r.unit}`,
          showCost ? `₹ ${r.stockValue.toLocaleString('en-IN')}` : '••••',
        ]),
      };
    }

    const enriched = items
      .filter((it) => matchSearch(it.name, `${it.code} ${it.category} ${it.brand || ''}`))
      .map((it) => {
        const s = salesAgg.get(it.id) || salesAgg.get(it.name.toLowerCase()) || { qty: 0, revenue: 0, cost: 0, profit: 0 };
        const p = purAgg.get(it.id) || purAgg.get(it.name.toLowerCase()) || { qty: 0, spend: 0 };
        const posStock = Math.max(0, it.stock);
        const costVal = roundMoney(posStock * (it.purchasePrice || 0));
        const sellVal = roundMoney(posStock * (it.salePrice || 0));
        const unitMargin = it.salePrice > 0 ? roundMoney(((it.salePrice - it.purchasePrice) / it.salePrice) * 100) : 0;
        return { it, s, p, costVal, sellVal, unitMargin };
      });

    switch (activeReport) {
      case 'item-sales': {
        const rows = [...enriched].sort((a, b) => b.s.revenue - a.s.revenue);
        return {
          columns: ['Item Name', 'Code', 'Category', 'Sold Qty', 'Revenue', 'Current Stock'],
          rows: rows.map((r) => [
            r.it.name,
            r.it.code,
            r.it.category,
            `${roundMoney(r.s.qty)} ${r.it.unit}`,
            `₹ ${roundMoney(r.s.revenue).toLocaleString('en-IN')}`,
            `${r.it.stock} ${r.it.unit}`,
          ]),
        };
      }
      case 'item-purchases': {
        const rows = [...enriched].sort((a, b) => b.p.spend - a.p.spend);
        return {
          columns: ['Item Name', 'Code', 'Purchased Qty', 'Purchase Spend', 'Last Cost', 'Current Stock'],
          rows: rows.map((r) => [
            r.it.name,
            r.it.code,
            `${roundMoney(r.p.qty)} ${r.it.unit}`,
            showCost ? `₹ ${roundMoney(r.p.spend).toLocaleString('en-IN')}` : '••••',
            showCost ? `₹ ${(r.it.lastPurchasePrice ?? r.it.purchasePrice).toLocaleString('en-IN')}` : '••••',
            `${r.it.stock} ${r.it.unit}`,
          ]),
        };
      }
      case 'item-profit':
      case 'highest-profit':
      case 'lowest-profit': {
        const rows = [...enriched].sort((a, b) =>
          activeReport === 'lowest-profit' ? a.s.profit - b.s.profit : b.s.profit - a.s.profit
        );
        return {
          columns: ['Item Name', 'Brand', 'Sold Qty', 'Sales Revenue', 'Gross Profit', 'Margin %'],
          rows: rows.map((r) => [
            r.it.name,
            r.it.brand || '—',
            `${roundMoney(r.s.qty)} ${r.it.unit}`,
            `₹ ${roundMoney(r.s.revenue).toLocaleString('en-IN')}`,
            showMargin ? `₹ ${roundMoney(r.s.profit).toLocaleString('en-IN')}` : '••••',
            showMargin ? `${r.s.revenue > 0 ? roundMoney((r.s.profit / r.s.revenue) * 100) : r.unitMargin}%` : '••••',
          ]),
        };
      }
      case 'stock-valuation': {
        const rows = [...enriched].sort((a, b) => b.costVal - a.costVal);
        return {
          columns: ['Item Name', 'Code', 'Stock Qty', 'Purchase Value', 'Retail Value', 'Potential Profit'],
          rows: rows.map((r) => [
            r.it.name,
            r.it.code,
            `${r.it.stock} ${r.it.unit}`,
            showCost ? `₹ ${r.costVal.toLocaleString('en-IN')}` : '••••',
            `₹ ${r.sellVal.toLocaleString('en-IN')}`,
            showMargin ? `₹ ${roundMoney(r.sellVal - r.costVal).toLocaleString('en-IN')}` : '••••',
          ]),
        };
      }
      case 'low-stock': {
        const rows = enriched.filter((r) => r.it.stock > 0 && r.it.stock <= (r.it.minStockAlert ?? 5));
        return {
          columns: ['Item Name', 'Code', 'Category', 'Current Stock', 'Min Alert', 'Suggested Reorder'],
          rows: rows.map((r) => {
            const targetMax = r.it.maxStockLevel || Math.max(10, (r.it.minStockAlert ?? 5) * 3);
            return [
              r.it.name,
              r.it.code,
              r.it.category,
              `${r.it.stock} ${r.it.unit}`,
              `${r.it.minStockAlert ?? 5} ${r.it.unit}`,
              `${Math.max(1, targetMax - r.it.stock)} ${r.it.unit}`,
            ];
          }),
        };
      }
      case 'out-of-stock': {
        const rows = enriched.filter((r) => r.it.stock <= 0);
        return {
          columns: ['Item Name', 'Code', 'Preferred Supplier', 'Last Cost', 'Retail Price', 'Stock'],
          rows: rows.map((r) => [
            r.it.name,
            r.it.code,
            r.it.preferredSupplier || r.it.lastPurchaseSupplier || '—',
            showCost ? `₹ ${r.it.purchasePrice.toLocaleString('en-IN')}` : '••••',
            `₹ ${r.it.salePrice.toLocaleString('en-IN')}`,
            `${r.it.stock} ${r.it.unit}`,
          ]),
        };
      }
      case 'fast-moving': {
        const rows = enriched.filter((r) => r.s.qty > 0).sort((a, b) => b.s.qty - a.s.qty);
        return {
          columns: ['Item Name', 'Category', 'Units Sold', 'Sales Revenue', 'Remaining Stock', 'Turnover'],
          rows: rows.map((r) => [
            r.it.name,
            r.it.category,
            `${roundMoney(r.s.qty)} ${r.it.unit}`,
            `₹ ${roundMoney(r.s.revenue).toLocaleString('en-IN')}`,
            `${r.it.stock} ${r.it.unit}`,
            r.it.stock > 0 ? `${roundMoney(r.s.qty / r.it.stock)}x` : 'Sold Out',
          ]),
        };
      }
      case 'slow-moving': {
        const rows = enriched
          .filter((r) => r.it.stock > 0 && r.s.qty > 0 && r.s.qty <= 3)
          .sort((a, b) => a.s.qty - b.s.qty);
        return {
          columns: ['Item Name', 'Category', 'Units Sold', 'Stock Held', 'Stock Value', 'Retail Price'],
          rows: rows.map((r) => [
            r.it.name,
            r.it.category,
            `${roundMoney(r.s.qty)} ${r.it.unit}`,
            `${r.it.stock} ${r.it.unit}`,
            showCost ? `₹ ${r.costVal.toLocaleString('en-IN')}` : '••••',
            `₹ ${r.it.salePrice.toLocaleString('en-IN')}`,
          ]),
        };
      }
      case 'dead-stock':
      default: {
        const rows = enriched.filter((r) => r.it.stock > 0 && r.s.qty === 0).sort((a, b) => b.costVal - a.costVal);
        return {
          columns: ['Item Name', 'Code', 'Category', 'Idle Stock', 'Capital Locked', 'Rack / Shelf'],
          rows: rows.map((r) => [
            r.it.name,
            r.it.code,
            r.it.category,
            `${r.it.stock} ${r.it.unit}`,
            showCost ? `₹ ${r.costVal.toLocaleString('en-IN')}` : '••••',
            [r.it.rackNumber, r.it.shelfLocation].filter(Boolean).join(' / ') || '—',
          ]),
        };
      }
    }
  }, [activeReport, reportPeriod, reportSearch, transactions, items, batchExpiryRows.filtered, showCost, showMargin]);

  // Handlers
  const handleToggleNegativeStock = async () => {
    const nextVal = !allowNegStock;
    const res1 = await updateBusinessSettingsSection(
      'item',
      'item',
      { allowNegativeStock: nextVal },
      `Negative stock control set to ${nextVal ? 'Allowed' : 'Blocked'} from Items Hub`
    );
    if (res1.success) {
      await updateBusinessSettingsSection(
        'transaction',
        'transaction',
        {
          behaviour: {
            ...businessSettings.transaction.behaviour,
            allowNegativeStock: nextVal,
          },
        },
        `Synced transaction negative-stock policy to ${nextVal ? 'Allowed' : 'Blocked'}`
      );
    }
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setPrefilledBarcodeForNewItem('');
    setIsAddItemModalOpen(true);
  };

  const handleOpenEditModal = (target: Item) => {
    if (!canManageBarcodes()) {
      showToast('Permission Denied: Admin/Inventory role required to edit products & barcodes.', 'error');
      return;
    }
    setEditingItem(target);
    setPrefilledBarcodeForNewItem('');
    setIsAddItemModalOpen(true);
  };

  const handleDuplicateItem = (target: Item) => {
    let candidateCode = `${target.code}-COPY`;
    let suffix = 2;
    while (items.some((i) => i.code.toLowerCase() === candidateCode.toLowerCase())) {
      candidateCode = `${target.code}-COPY${suffix}`;
      suffix += 1;
    }
    const cloned = addItem({
      ...target,
      name: `${target.name} (Copy)`,
      code: candidateCode,
      barcode: generateUniqueEan13Barcode(items, `${target.id}-${Date.now()}`),
      extraBarcodes: undefined,
      stock: 0,
      godownStocks: undefined,
      priceHistory: undefined,
    });
    if (cloned) {
      setSelectedItemId(cloned.id);
      setEditingItem(cloned);
      setIsAddItemModalOpen(true);
    }
  };

  const handleToggleItemActive = (target: Item) => {
    const nextActive = target.isActive === false;
    const res = updateItem(target.id, { isActive: nextActive });
    if (res.success) {
      showToast(`"${target.name}" marked as ${nextActive ? 'Active' : 'Inactive'}.`, 'success');
    }
  };

  const handleDeleteItem = (target: Item) => {
    requestConfirmation({
      title: 'Delete Inventory Product?',
      message: `Move "${target.name}" (${target.code}) to the Recycle Bin? Historical invoices remain preserved and you can restore it later from Utilities.`,
      confirmLabel: 'Move to Recycle Bin',
      variant: 'danger',
      onConfirm: () => {
        const idx = items.findIndex((i) => i.id === target.id);
        const fallback = items[idx + 1] || items[idx - 1];
        moveItemToRecycleBin(target.id);
        setSelectedIds((prev) => prev.filter((id) => id !== target.id));
        if (fallback && selectedItemId === target.id) setSelectedItemId(fallback.id);
      },
    });
  };

  const handleOpenAdjustModal = (target: Item, mode: 'set' | 'damaged' = 'set') => {
    setAdjustModalTarget(target);
    setAdjustMode(mode);
    setNewStockValue(target.stock || 0);
    setDamagedQtyInput(1);
    setAdjustReason(mode === 'damaged' ? 'Damaged / Spoilage Write-off' : 'Manual Stock Audit');
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalTarget) return;
    if (adjustMode === 'damaged') {
      const res = recordDamagedStock(adjustModalTarget.id, damagedQtyInput, adjustReason);
      if (res.success) setIsAdjustModalOpen(false);
    } else {
      adjustStock(adjustModalTarget.id, newStockValue, adjustReason);
      setIsAdjustModalOpen(false);
    }
  };

  const handleOpenMergeModal = (target: Item) => {
    if (items.length < 2) {
      showToast('At least 2 products are required to merge SKUs.', 'warning');
      return;
    }
    setMergeSourceItem(target);
    const firstOther = items.find((i) => i.id !== target.id);
    setMergeTargetId(firstOther?.id || '');
    setIsMergeModalOpen(true);
  };

  const handleConfirmMerge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeSourceItem || !mergeTargetId || mergeTargetId === mergeSourceItem.id) {
      showToast('Select a different surviving target product to merge into.', 'warning');
      return;
    }
    const targetItem = items.find((i) => i.id === mergeTargetId);
    if (!targetItem) return;

    requestConfirmation({
      title: 'Merge Duplicate Products?',
      message: `Combine ${mergeSourceItem.stock} ${mergeSourceItem.unit} from "${mergeSourceItem.name}" (${mergeSourceItem.code}) into "${targetItem.name}" (${targetItem.code}), then archive "${mergeSourceItem.name}" into Recycle Bin?`,
      confirmLabel: 'Merge & Archive Duplicate',
      variant: 'warning',
      onConfirm: () => {
        const defaultGdwId = godowns.find((g) => g.isCentral)?.id || godowns[0]?.id || 'gdw-1';
        const mergedGodowns: Record<string, number> = {
          ...(targetItem.godownStocks || { [targetItem.godownId || defaultGdwId]: Math.max(0, targetItem.stock || 0) }),
        };
        const sourceGodowns: Record<string, number> =
          mergeSourceItem.godownStocks || { [mergeSourceItem.godownId || defaultGdwId]: Math.max(0, mergeSourceItem.stock || 0) };
        Object.entries(sourceGodowns).forEach(([gdwId, q]) => {
          mergedGodowns[gdwId] = (mergedGodowns[gdwId] || 0) + Math.max(0, Number(q) || 0);
        });

        const mergedTags = Array.from(new Set([...(targetItem.tags || []), ...(mergeSourceItem.tags || [])]));
        const combinedStock = Math.max(0, (targetItem.stock || 0) + (mergeSourceItem.stock || 0));

        updateItem(targetItem.id, {
          godownStocks: mergedGodowns,
          tags: mergedTags.length > 0 ? mergedTags : undefined,
          barcode: targetItem.barcode || mergeSourceItem.barcode,
          brand: targetItem.brand || mergeSourceItem.brand,
          hsnCode: targetItem.hsnCode || mergeSourceItem.hsnCode,
          dealerPrice: targetItem.dealerPrice || mergeSourceItem.dealerPrice,
          wholesalePrice: targetItem.wholesalePrice || mergeSourceItem.wholesalePrice,
          description: targetItem.description || mergeSourceItem.description,
          image: targetItem.image || mergeSourceItem.image,
        });

        adjustStock(
          targetItem.id,
          combinedStock,
          `Merged duplicate SKU "${mergeSourceItem.name}" (${mergeSourceItem.code}, +${mergeSourceItem.stock} ${mergeSourceItem.unit})`
        );

        moveItemToRecycleBin(mergeSourceItem.id);
        recordActivity(
          'Merged Inventory Items',
          'Inventory',
          `Merged "${mergeSourceItem.name}" (${mergeSourceItem.code}) into "${targetItem.name}" (${targetItem.code}). Combined stock: ${combinedStock}.`
        );
        setSelectedItemId(targetItem.id);
        setIsMergeModalOpen(false);
        showToast(`Merged "${mergeSourceItem.name}" into "${targetItem.name}" (${combinedStock} ${targetItem.unit}).`, 'success');
      },
    });
  };

  // Selection & Bulk Actions
  const allFilteredSelected =
    filteredItems.length > 0 && filteredItems.every((it) => selectedIds.includes(it.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map((i) => i.id));
    }
  };

  const toggleRowSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBulkPriceApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    let updatedCount = 0;
    selectedIds.forEach((id) => {
      const it = items.find((x) => x.id === id);
      if (!it) return;
      const base = Number(it[bulkPriceField]) || 0;
      const delta = bulkPriceType === 'percent' ? (base * bulkPriceValue) / 100 : bulkPriceValue;
      const next = Math.max(0, roundMoney(bulkPriceDirection === 'increase' ? base + delta : base - delta));
      updateItem(id, { [bulkPriceField]: next });
      updatedCount += 1;
    });
    setBulkModal('none');
    showToast(`Updated ${bulkPriceField} on ${updatedCount} selected item(s).`, 'success');
  };

  const handleBulkStockApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    let updatedCount = 0;
    selectedIds.forEach((id) => {
      const it = items.find((x) => x.id === id);
      if (!it) return;
      const cur = Number(it.stock) || 0;
      const target =
        bulkStockAction === 'set'
          ? bulkStockQty
          : bulkStockAction === 'add'
          ? cur + bulkStockQty
          : cur - bulkStockQty;
      const clamped = allowNegStock ? target : Math.max(0, target);
      adjustStock(id, clamped, bulkStockReason || 'Bulk Stock Adjustment');
      updatedCount += 1;
    });
    setBulkModal('none');
    showToast(`Adjusted stock for ${updatedCount} item(s).`, 'success');
  };

  const handleBulkMetaApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    let updatedCount = 0;
    selectedIds.forEach((id) => {
      const patch: Partial<Item> = {};
      if (bulkMetaCategory.trim()) patch.category = bulkMetaCategory.trim();
      if (bulkMetaGst !== '') {
        patch.taxRate = Number(bulkMetaGst);
        patch.gstApplicable = Number(bulkMetaGst) > 0;
      }
      if (bulkMetaActive !== 'keep') patch.isActive = bulkMetaActive === 'active';
      if (Object.keys(patch).length > 0) {
        updateItem(id, patch);
        updatedCount += 1;
      }
    });
    setBulkModal('none');
    showToast(`Updated attributes on ${updatedCount} selected item(s).`, 'success');
  };

  // CSV Export Helper
  const downloadCsv = (filename: string, header: string[], rows: (string | number)[][]) => {
    const csv = [
      header.join(','),
      ...rows.map((r) =>
        r
          .map((cell) => {
            const s = String(cell ?? '');
            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportItemsCsv = (targetList: Item[], label = 'inventory-items') => {
    const header = [
      'Item Name',
      'Item Code',
      'Barcode',
      'SKU',
      'Category',
      'Subcategory',
      'Brand',
      'Unit',
      'Purchase Price',
      'Retail Price',
      'Wholesale Price',
      'MRP',
      'GST %',
      'Opening Stock',
      'Min Stock Alert',
      'Status',
    ];
    const rows = targetList.map((it) => [
      it.name,
      it.code,
      it.barcode || '',
      it.sku || '',
      it.category || 'General',
      it.subcategory || '',
      it.brand || '',
      it.unit,
      it.purchasePrice || 0,
      it.salePrice || 0,
      it.wholesalePrice || 0,
      it.mrp || 0,
      it.gstApplicable === false ? 0 : it.taxRate || 0,
      it.stock,
      it.minStockAlert ?? 5,
      it.isActive === false ? 'Inactive' : 'Active',
    ]);
    downloadCsv(`${label}-${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
    showToast(`Exported ${targetList.length} products to CSV.`, 'success');
  };

  // CSV Import Parsing & Validation
  const validateCsvInput = (raw: string) => {
    setCsvRawText(raw);
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setCsvPreviewRows([]);
      return;
    }

    const firstCols = parseCsvLine(lines[0]).map((c) => c.toLowerCase());
    const hasHeader =
      firstCols.some((c) => c.includes('name') || c.includes('item')) &&
      firstCols.some((c) => c.includes('price') || c.includes('code') || c.includes('unit'));
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const seenCodes = new Set<string>();
    const seenBarcodes = new Set<string>();

    const parsed: CsvImportRow[] = dataLines.map((line, idx) => {
      const cols = parseCsvLine(line);
      const name = cols[0] || '';
      const code = cols[1] || '';
      const barcode = cols[2] || '';
      const sku = cols[3] || '';
      const category = cols[4] || 'General';
      const subcategory = cols[5] || '';
      const brand = cols[6] || '';
      const unit = (cols[7] || 'PCS').toUpperCase();
      const purchasePrice = Number(cols[8] ?? 0);
      const salePrice = Number(cols[9] ?? 0);
      const wholesalePrice = Number(cols[10] ?? 0);
      const mrp = Number(cols[11] ?? 0);
      const taxRate = Number(cols[12] ?? 0);
      const stock = Number(cols[13] ?? 0);
      const minStockAlert = Number(cols[14] ?? 5);

      const errors: string[] = [];
      if (!name.trim()) errors.push('Missing Item Name');
      if (!unit.trim()) errors.push('Missing Unit');
      if (Number.isNaN(purchasePrice) || purchasePrice < 0) errors.push('Invalid Purchase Price');
      if (Number.isNaN(salePrice) || salePrice <= 0) errors.push('Retail Price must be > 0');
      if (Number.isNaN(taxRate) || taxRate < 0 || taxRate > 40) errors.push('Invalid GST %');

      if (code.trim()) {
        const lowerCode = code.trim().toLowerCase();
        if (items.some((i) => i.code.trim().toLowerCase() === lowerCode)) {
          errors.push(`Duplicate Item Code "${code}" (exists in catalog)`);
        } else if (seenCodes.has(lowerCode)) {
          errors.push(`Duplicate Item Code "${code}" (repeated in CSV)`);
        }
        seenCodes.add(lowerCode);
      } else {
        errors.push('Missing Item Code');
      }

      if (barcode.trim()) {
        const bcCheck = isBarcodeUnique(items, barcode.trim());
        if (!bcCheck.unique) {
          errors.push(`Duplicate Barcode "${barcode}" (belongs to ${bcCheck.conflictItem?.name})`);
        } else if (seenBarcodes.has(barcode.trim())) {
          errors.push(`Duplicate Barcode "${barcode}" (repeated in CSV)`);
        }
        seenBarcodes.add(barcode.trim());
      }

      return {
        rowNum: idx + 1,
        name,
        code,
        barcode,
        sku,
        category,
        subcategory,
        brand,
        unit,
        purchasePrice: Number.isFinite(purchasePrice) ? purchasePrice : 0,
        salePrice: Number.isFinite(salePrice) ? salePrice : 0,
        wholesalePrice: Number.isFinite(wholesalePrice) ? wholesalePrice : 0,
        mrp: Number.isFinite(mrp) ? mrp : 0,
        taxRate: Number.isFinite(taxRate) ? taxRate : 0,
        stock: Number.isFinite(stock) ? stock : 0,
        minStockAlert: Number.isFinite(minStockAlert) ? minStockAlert : 5,
        errors,
      };
    });

    setCsvPreviewRows(parsed);
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      validateCsvInput(String(reader.result || ''));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadCsvTemplate = () => {
    const header = [
      'Item Name',
      'Item Code',
      'Barcode',
      'SKU',
      'Category',
      'Subcategory',
      'Brand',
      'Unit',
      'Purchase Price',
      'Retail Price',
      'Wholesale Price',
      'MRP',
      'GST %',
      'Opening Stock',
      'Min Stock Alert',
    ];
    const sample = [
      ['Basmati Rice Classic', 'ITM-901', '8901234567012', 'SKU-901', 'Grocery', 'Rice', 'India Gate', 'KG', 82, 110, 98, 125, 5, 50, 10],
      ['Refined Sunflower Oil 1L', 'ITM-902', '8901234567029', 'SKU-902', 'Grocery', 'Edible Oil', 'Fortune', 'LTR', 124, 150, 138, 165, 5, 30, 5],
    ];
    downloadCsv('BM360_Item_Import_Template.csv', header, sample);
    showToast('Downloaded CSV Import Template.', 'success');
  };

  const handleCommitCsvImport = () => {
    const validRows = csvPreviewRows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) {
      showToast('No valid rows ready to import. Fix validation errors first.', 'warning');
      return;
    }
    let importedCount = 0;
    validRows.forEach((r) => {
      addItem({
        name: r.name,
        code: r.code,
        barcode: r.barcode || undefined,
        sku: r.sku || r.code,
        category: r.category || 'General',
        subcategory: r.subcategory || undefined,
        brand: r.brand || undefined,
        unit: r.unit || 'PCS',
        purchasePrice: r.purchasePrice,
        lastPurchasePrice: r.purchasePrice,
        weightedAvgCost: r.purchasePrice,
        salePrice: r.salePrice,
        wholesalePrice: r.wholesalePrice > 0 ? r.wholesalePrice : undefined,
        mrp: r.mrp > 0 ? r.mrp : undefined,
        taxRate: r.taxRate,
        gstApplicable: r.taxRate > 0,
        stock: r.stock,
        minStockAlert: r.minStockAlert,
        isActive: true,
      });
      importedCount += 1;
    });
    setCsvRawText('');
    setCsvPreviewRows([]);
    setActiveSubTab('PRODUCTS');
    showToast(`Imported ${importedCount} item(s) successfully.`, 'success');
  };

  const handleScanLookup = () => {
    openBarcodeScanner('lookup', (matched) => {
      if (matched) {
        setSelectedItemId(matched.id);
        setSearchItem('');
        setActiveSubTab('ITEM DETAILS');
      }
    });
  };

  const categorySummary = useMemo(
    () =>
      Object.values(
        items.reduce<
          Record<
            string,
            {
              category: string;
              count: number;
              activeCount: number;
              totalUnits: number;
              costValue: number;
              sellValue: number;
              subcategories: string[];
            }
          >
        >((acc, it) => {
          const cat = it.category || 'Uncategorized';
          if (!acc[cat]) {
            acc[cat] = {
              category: cat,
              count: 0,
              activeCount: 0,
              totalUnits: 0,
              costValue: 0,
              sellValue: 0,
              subcategories: [],
            };
          }
          acc[cat].count += 1;
          if (it.isActive !== false) acc[cat].activeCount += 1;
          const posStock = Math.max(0, it.stock);
          acc[cat].totalUnits += posStock;
          acc[cat].costValue += posStock * (it.purchasePrice || 0);
          acc[cat].sellValue += posStock * (it.salePrice || 0);
          if (it.subcategory && !acc[cat].subcategories.includes(it.subcategory)) {
            acc[cat].subcategories.push(it.subcategory);
          }
          return acc;
        }, {})
      ).sort((a, b) => b.costValue - a.costValue),
    [items]
  );

  // Embedded calculator output for selectedItem
  const calcPreview = useMemo(() => {
    if (!selectedItem) return null;
    const rate = selectedItem.salePrice || 0;
    const baseUnit = selectedItem.unit || 'KG';
    if (calcMode === 'amount') {
      const amt = Math.max(0, Number(calcAmountInput) || 0);
      const res = calculateWeightFromAmount(amt, rate, baseUnit);
      return {
        primary: res.displayLabel,
        secondary: `${res.baseQty} ${baseUnit}`,
        amount: amt,
        cost: roundMoney(res.baseQty * (selectedItem.purchasePrice || 0)),
        profit: roundMoney(amt - res.baseQty * (selectedItem.purchasePrice || 0)),
      };
    } else {
      const wt = Math.max(0, Number(calcWeightInput) || 0);
      const res = calculateAmountFromWeight(wt, calcWeightUnit, rate, baseUnit);
      return {
        primary: `₹ ${res.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        secondary: `${res.displayLabel} (${res.baseQty} ${baseUnit})`,
        amount: res.amount,
        cost: roundMoney(res.baseQty * (selectedItem.purchasePrice || 0)),
        profit: roundMoney(res.amount - res.baseQty * (selectedItem.purchasePrice || 0)),
      };
    }
  }, [selectedItem, calcMode, calcAmountInput, calcWeightInput, calcWeightUnit]);

  const selectedStockValue = selectedItem ? Math.max(0, selectedItem.stock) * (selectedItem.purchasePrice || 0) : 0;
  const selectedIsLowStock = selectedItem ? selectedItem.stock <= (selectedItem.minStockAlert ?? 5) : false;
  const selectedDaysExpiry = getDaysUntilDate(selectedItem?.expiryDate);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden select-none text-xs text-slate-800 dark:text-slate-100">
      {/* Top Sub-Navigation Bar */}
      <div className="print:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto py-1.5">
          {(
            [
              { id: 'PRODUCTS', label: 'Items Dashboard' },
              { id: 'ITEM DETAILS', label: 'Item Details' },
              { id: 'BATCH & EXPIRY', label: `Batch & Expiry (${batchExpiryRows.summary.expired + batchExpiryRows.summary.within30})` },
              { id: 'STOCK LEDGER', label: 'Stock Ledger' },
              { id: 'IMPORT / EXPORT', label: 'Import / Export' },
              { id: 'ITEM REPORTS', label: 'Item Reports' },
              { id: 'CATEGORIES', label: 'Categories' },
            ] as Array<{ id: ItemsSubTab; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-3 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSubTab === tab.id
                  ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 py-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleNegativeStock}
            title="Toggle Negative-Stock Billing Allowance across POS & Sale Invoices"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
              allowNegStock
                ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {allowNegStock ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>Neg. Stock: {allowNegStock ? 'Allowed' : 'Blocked'}</span>
          </button>

          <button
            type="button"
            onClick={handleScanLookup}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Scan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('barcode-studio')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-600" />
            <span>Barcode Labels</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs text-white bg-amber-500 hover:bg-amber-600 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: ITEMS DASHBOARD + FULL 13-COLUMN TABLE            */}
      {/* ======================================================== */}
      {activeSubTab === 'PRODUCTS' && (
        <div className="flex-1 flex flex-col overflow-y-auto p-5 space-y-4 print:hidden">
          {/* KPI Dashboard Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            <button
              type="button"
              onClick={() => {
                setStockFilter('All');
                setStatusFilter('All');
              }}
              className="text-left p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 transition-colors cursor-pointer"
            >
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Items</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {dashboardStats.totalItems}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                {dashboardStats.activeCount} active · {dashboardStats.inactiveCount} inactive
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStockFilter('Low Stock')}
              className="text-left p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-400 transition-colors cursor-pointer"
            >
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Low Stock</div>
              <div className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-0.5">
                {dashboardStats.lowStockCount}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Click to filter alerts</div>
            </button>

            <button
              type="button"
              onClick={() => setStockFilter('Out of Stock')}
              className="text-left p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-400 transition-colors cursor-pointer"
            >
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Out of Stock</div>
              <div className="text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums mt-0.5">
                {dashboardStats.outOfStockCount}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Needs urgent purchase</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setExpiryBucketFilter('30d');
                setActiveSubTab('BATCH & EXPIRY');
              }}
              className="text-left p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-400 transition-colors cursor-pointer"
            >
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Expiring Soon</div>
              <div className="text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums mt-0.5">
                {dashboardStats.expiringSoonCount}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Within 30 days / expired</div>
            </button>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Stock Qty</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {dashboardStats.totalQty.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">All units on hand</div>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Purchase Value</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {showCost ? `₹${dashboardStats.purchaseVal.toLocaleString('en-IN')}` : '••••••'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Inventory at cost</div>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Selling Value</div>
              <div className="text-lg font-bold text-sky-700 dark:text-sky-400 tabular-nums mt-0.5">
                ₹{dashboardStats.sellingVal.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold tabular-nums mt-0.5">
                {showMargin ? `Profit: ₹${dashboardStats.potentialProfit.toLocaleString('en-IN')}` : 'Margin protected'}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSortBy('recent-desc')}
              className="text-left p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 transition-colors cursor-pointer"
            >
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Recently Added</div>
              <div className="text-lg font-bold text-indigo-700 dark:text-indigo-400 tabular-nums mt-0.5">
                {dashboardStats.recentlyAddedCount}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Last 7 days (click to sort)</div>
            </button>
          </div>

          {/* Search, Filter & Sort Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[230px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
                placeholder="Search item name, code, SKU, barcode, extra barcode, brand, tag..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-sky-500 focus:bg-white dark:focus:bg-slate-900"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            >
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>
                  {c === 'All' ? 'All Categories' : c}
                </option>
              ))}
            </select>

            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              aria-label="Filter by brand"
              className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            >
              {uniqueBrands.map((b) => (
                <option key={b} value={b}>
                  {b === 'All' ? 'All Brands' : b}
                </option>
              ))}
            </select>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              aria-label="Filter by stock status"
              className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            >
              <option value="All">All Stock</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>

            <select
              value={gstFilter}
              onChange={(e) => setGstFilter(e.target.value)}
              aria-label="Filter by GST rate"
              className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            >
              <option value="All">All GST %</option>
              <option value="0">0% / Exempt</option>
              <option value="5">5% GST</option>
              <option value="12">12% GST</option>
              <option value="18">18% GST</option>
              <option value="28">28% GST</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              aria-label="Filter by item status"
              className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            >
              <option value="All">All Status</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              aria-label="Sort items"
              className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            >
              <option value="name-asc">Sort: Name (A–Z)</option>
              <option value="price-desc">Sort: Price (High → Low)</option>
              <option value="price-asc">Sort: Price (Low → High)</option>
              <option value="stock-asc">Sort: Stock (Low → High)</option>
              <option value="stock-desc">Sort: Stock (High → Low)</option>
              <option value="margin-desc">Sort: Profit Margin %</option>
              <option value="recent-desc">Sort: Recently Added</option>
            </select>

            {(searchItem || categoryFilter !== 'All' || brandFilter !== 'All' || stockFilter !== 'All' || gstFilter !== 'All' || statusFilter !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setSearchItem('');
                  setCategoryFilter('All');
                  setBrandFilter('All');
                  setStockFilter('All');
                  setGstFilter('All');
                  setStatusFilter('All');
                }}
                className="px-2.5 py-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold cursor-pointer"
              >
                Reset
              </button>
            )}

            <button
              type="button"
              onClick={() => handleExportItemsCsv(filteredItems, 'bm360-items-filtered')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV ({filteredItems.length})</span>
            </button>
          </div>

          {/* Bulk Operations Bar */}
          {selectedIds.length > 0 && (
            <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-sky-900 dark:text-sky-200 tabular-nums">
                {selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} selected
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBulkModal('price')}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200 font-semibold hover:bg-sky-100 cursor-pointer"
                >
                  Bulk Price Update
                </button>
                <button
                  type="button"
                  onClick={() => setBulkModal('stock')}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200 font-semibold hover:bg-sky-100 cursor-pointer"
                >
                  Bulk Stock Adjust
                </button>
                <button
                  type="button"
                  onClick={() => setBulkModal('meta')}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200 font-semibold hover:bg-sky-100 cursor-pointer"
                >
                  Bulk Category / GST / Status
                </button>
                <button
                  type="button"
                  onClick={() => handleExportItemsCsv(items.filter((i) => selectedIds.includes(i.id)), 'bm360-selected-items')}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Export Selected
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Complete 13-Column Professional Item Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex-1 flex flex-col min-h-[340px]">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase">
                  <tr>
                    <th className="py-2.5 px-3 w-9">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all filtered items"
                        className="rounded text-sky-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-2 w-12">Image</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Item Name</th>
                    <th className="py-2.5 px-3">Item Code / Barcode</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Purchase Price</th>
                    <th className="py-2.5 px-3 text-right">Retail Price</th>
                    <th className="py-2.5 px-3 text-right">Wholesale</th>
                    <th className="py-2.5 px-3 text-right">Stock</th>
                    <th className="py-2.5 px-2">Unit</th>
                    <th className="py-2.5 px-2 text-right">GST</th>
                    <th className="py-2.5 px-3 text-right">Profit</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-16 text-center text-slate-500 dark:text-slate-400">
                        <Package className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                        <div className="font-semibold text-slate-700 dark:text-slate-200">
                          No items match your current search &amp; filters
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenAddModal}
                          className="mt-3 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold cursor-pointer"
                        >
                          Add New Item
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((it) => {
                      const isLow = it.stock > 0 && it.stock <= (it.minStockAlert ?? 5);
                      const isOut = it.stock <= 0;
                      const unitProfit = (it.salePrice || 0) - (it.purchasePrice || 0);
                      const marginPct = it.salePrice > 0 ? Math.round((unitProfit / it.salePrice) * 1000) / 10 : 0;
                      const isSelectedRow = it.id === selectedItem?.id;
                      const imgFailed = !it.image || brokenImages[it.id];

                      return (
                        <tr
                          key={it.id}
                          onClick={() => setSelectedItemId(it.id)}
                          className={`transition-colors ${
                            isSelectedRow
                              ? 'bg-sky-50/70 dark:bg-sky-950/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(it.id)}
                              onChange={() => toggleRowSelect(it.id)}
                              aria-label={`Select ${it.name}`}
                              className="rounded text-sky-600 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-2">
                            {imgFailed ? (
                              <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400">
                                <Package className="w-4 h-4" />
                              </div>
                            ) : (
                              <img
                                src={it.image}
                                alt={it.name}
                                referrerPolicy="no-referrer"
                                onError={() => setBrokenImages((prev) => ({ ...prev, [it.id]: true }))}
                                className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                              />
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItemId(it.id);
                                setActiveSubTab('ITEM DETAILS');
                              }}
                              className="text-left font-bold text-slate-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer"
                            >
                              {it.name}
                            </button>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[230px]">
                              {[it.brand, it.subcategory, it.itemType].filter(Boolean).join(' · ') || 'Standard Product'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{it.code}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {it.barcode || 'No barcode'}
                              {it.extraBarcodes && it.extraBarcodes.length > 0 ? ` (+${it.extraBarcodes.length})` : ''}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                            {it.category || 'General'}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                            {showCost ? `₹${(it.purchasePrice || 0).toLocaleString('en-IN')}` : '••••'}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                            <div>₹{(it.salePrice || 0).toLocaleString('en-IN')}</div>
                            {it.mrp && it.mrp > it.salePrice && (
                              <div className="text-[10px] font-normal text-slate-400 line-through">
                                MRP ₹{it.mrp.toLocaleString('en-IN')}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-indigo-700 dark:text-indigo-400 font-semibold">
                            {it.wholesalePrice ? `₹${it.wholesalePrice.toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            <div
                              className={`font-bold ${
                                isOut
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : isLow
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {it.stock} {isOut ? '(Out)' : isLow ? '(Low)' : ''}
                            </div>
                            {(it.rackNumber || it.shelfLocation) && (
                              <div className="text-[10px] text-slate-400">
                                {[it.rackNumber, it.shelfLocation].filter(Boolean).join('/')}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-slate-700 dark:text-slate-300">
                            <div>{it.unit}</div>
                            {it.unitConversion && (
                              <div className="text-[9px] text-slate-400 whitespace-nowrap">
                                1 {it.unitConversion.secondaryUnit}={it.unitConversion.rate}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                            {it.gstApplicable === false ? 'Exempt' : `${it.taxRate}%`}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {showMargin ? (
                              <div>
                                <div className={unitProfit < 0 ? 'font-bold text-rose-600' : 'font-bold text-emerald-700 dark:text-emerald-400'}>
                                  ₹{roundMoney(unitProfit).toLocaleString('en-IN')}
                                </div>
                                <div className="text-[10px] text-slate-500">{marginPct}%</div>
                              </div>
                            ) : (
                              '••••'
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {it.isActive === false ? (
                              <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 font-semibold">
                                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                                Inactive
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Active
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedItemId(it.id);
                                  setActiveSubTab('ITEM DETAILS');
                                }}
                                title="View Item Details & Calculator"
                                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(it)}
                                title="Edit Item"
                                className="p-1.5 rounded hover:bg-sky-50 dark:hover:bg-sky-950/50 text-sky-600 dark:text-sky-400 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenAdjustModal(it, 'set')}
                                title="Adjust Stock / Record Damaged Stock"
                                className="p-1.5 rounded hover:bg-cyan-50 dark:hover:bg-cyan-950/50 text-cyan-700 dark:text-cyan-400 cursor-pointer"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPrintLabelItem(it);
                                  setPrintLabelCopies(6);
                                }}
                                title="Print Barcode / Price Label"
                                className="p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateItem(it)}
                                title="Duplicate Item"
                                className="p-1.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleItemActive(it)}
                                title={it.isActive === false ? 'Activate Item' : 'Deactivate Item'}
                                className="p-1.5 rounded hover:bg-amber-50 dark:hover:bg-amber-950/50 text-amber-600 dark:text-amber-400 cursor-pointer"
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenMergeModal(it)}
                                title="Merge Duplicate SKU"
                                className="p-1.5 rounded hover:bg-violet-50 dark:hover:bg-violet-950/50 text-violet-600 dark:text-violet-400 cursor-pointer"
                              >
                                <GitMerge className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(it)}
                                title="Move to Recycle Bin"
                                className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
      )}

      {/* ======================================================== */}
      {/* TAB 2: ITEM DETAILS + CALCULATOR + HISTORY + PRICE AUDIT */}
      {/* ======================================================== */}
      {activeSubTab === 'ITEM DETAILS' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-5 print:hidden">
          {!selectedItem ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500">
              No inventory items available yet. Click Add Item to create your first product.
            </div>
          ) : (
            <>
              {/* Item Selector & Top Actions */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-[280px]">
                  {selectedItem.image && !brokenImages[selectedItem.id] ? (
                    <img
                      src={selectedItem.image}
                      alt={selectedItem.name}
                      referrerPolicy="no-referrer"
                      onError={() => setBrokenImages((prev) => ({ ...prev, [selectedItem.id]: true }))}
                      className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                      <Package className="w-7 h-7" />
                    </div>
                  )}

                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={selectedItem.id}
                        onChange={(e) => setSelectedItemId(e.target.value)}
                        aria-label="Select item to inspect"
                        className="text-base font-bold text-slate-900 dark:text-white bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 pr-2 pb-0.5 focus:outline-none focus:border-sky-500 cursor-pointer"
                      >
                        {items.map((it) => (
                          <option key={it.id} value={it.id} className="bg-white dark:bg-slate-900 text-sm">
                            {it.name} ({it.code})
                          </option>
                        ))}
                      </select>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {selectedItem.isActive === false ? '· Inactive' : '· Active'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>{selectedItem.category || 'General'}</span>
                      {selectedItem.subcategory && (
                        <>
                          <span aria-hidden="true">/</span>
                          <span>{selectedItem.subcategory}</span>
                        </>
                      )}
                      {selectedItem.brand && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{selectedItem.brand}</span>
                        </>
                      )}
                      {selectedItem.manufacturer && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{selectedItem.manufacturer}</span>
                        </>
                      )}
                      {selectedItem.itemType && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{selectedItem.itemType}</span>
                        </>
                      )}
                    </div>

                    {selectedItem.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300">{selectedItem.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs pt-1 tabular-nums">
                      <span>
                        Code: <strong className="font-mono text-slate-900 dark:text-white">{selectedItem.code}</strong>
                      </span>
                      <span>
                        SKU: <strong className="font-mono text-slate-900 dark:text-white">{selectedItem.sku || selectedItem.code}</strong>
                      </span>
                      <span>
                        HSN: <strong className="font-mono text-slate-900 dark:text-white">{selectedItem.hsnCode || '—'}</strong>
                      </span>
                      <span>
                        Barcode: <strong className="font-mono text-emerald-700 dark:text-emerald-400">{selectedItem.barcode || 'Pending'}</strong>
                      </span>
                      {selectedItem.extraBarcodes && selectedItem.extraBarcodes.length > 0 && (
                        <span>
                          Extra Barcodes:{' '}
                          <strong className="font-mono text-slate-800 dark:text-slate-200">
                            {selectedItem.extraBarcodes.join(', ')}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Barcode SVG + Actions */}
                <div className="flex flex-col items-end gap-2">
                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                    <svg ref={barcodeSvgRef} className="max-h-12 w-auto" />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(selectedItem)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 font-semibold cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-sky-600" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenAdjustModal(selectedItem, 'set')}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Adjust Stock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenAdjustModal(selectedItem, 'damaged')}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-semibold cursor-pointer"
                    >
                      <AlertOctagon className="w-3.5 h-3.5" />
                      <span>Record Damage</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrintLabelItem(selectedItem);
                        setPrintLabelCopies(6);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Label</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateItem(selectedItem)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Duplicate</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Commercial Tiers & Weight/Quantity Quick Calculator */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                    Pricing Tiers, Stock Valuation &amp; Warehouse Breakdown
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
                    <div>
                      <div className="text-[11px] text-slate-500">Purchase Cost</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        {showCost ? `₹${selectedItem.purchasePrice.toFixed(2)}` : '••••'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Retail Price</div>
                      <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        ₹{selectedItem.salePrice.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Wholesale Price</div>
                      <div className="text-sm font-bold text-indigo-700 dark:text-indigo-400">
                        {selectedItem.wholesalePrice ? `₹${selectedItem.wholesalePrice.toFixed(2)}` : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">MRP / Dealer</div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {selectedItem.mrp ? `₹${selectedItem.mrp.toFixed(2)}` : '—'}
                        {selectedItem.dealerPrice ? ` / ₹${selectedItem.dealerPrice.toFixed(2)}` : ''}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Current Stock</div>
                      <div className={`text-sm font-bold ${selectedIsLowStock ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        {formatBaseQtyHuman(selectedItem.stock, selectedItem.unit)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Stock Value (Cost)</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        {showCost ? `₹${selectedStockValue.toLocaleString('en-IN')}` : '••••'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">GST &amp; Tax Mode</div>
                      <div className="text-sm font-bold text-sky-700 dark:text-sky-400">
                        {selectedItem.gstApplicable === false
                          ? 'Exempt'
                          : `${selectedItem.taxRate}% (${selectedItem.gstTypePreference || 'Inclusive'})`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Lifetime Item Profit</div>
                      <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        {showMargin ? `₹${itemProfitMetrics.estTotalProfit.toLocaleString('en-IN')} (${itemProfitMetrics.marginPct}%)` : '••••'}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <span>
                      Min Alert: <strong>{selectedItem.minStockAlert ?? 5} {selectedItem.unit}</strong>
                    </span>
                    {selectedItem.maxStockLevel !== undefined && (
                      <span>
                        Max Level: <strong>{selectedItem.maxStockLevel} {selectedItem.unit}</strong>
                      </span>
                    )}
                    {(selectedItem.rackNumber || selectedItem.shelfLocation) && (
                      <span>
                        Location: <strong>{[selectedItem.rackNumber, selectedItem.shelfLocation].filter(Boolean).join(' / ')}</strong>
                      </span>
                    )}
                    {(selectedItem.damagedStock ?? 0) > 0 && (
                      <span className="text-amber-700 dark:text-amber-400">
                        Damaged Recorded: <strong>{selectedItem.damagedStock} {selectedItem.unit}</strong>
                      </span>
                    )}
                    {selectedItem.expiryDate && (
                      <span className={selectedDaysExpiry !== null && selectedDaysExpiry <= 30 ? 'text-rose-600 font-semibold' : ''}>
                        Expiry: <strong>{selectedItem.expiryDate}</strong>
                        {selectedDaysExpiry !== null ? ` (${selectedDaysExpiry < 0 ? 'Expired' : `${selectedDaysExpiry}d left`})` : ''}
                      </span>
                    )}
                    {selectedItem.unitConversion && (
                      <span>
                        Conversion: <strong>1 {selectedItem.unitConversion.secondaryUnit} = {selectedItem.unitConversion.rate} {selectedItem.unit}</strong>
                      </span>
                    )}
                  </div>

                  {/* Godown & Customer Pricing */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                    {selectedGodownBreakdown.map((gb) => (
                      <span key={gb.gdwId} className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {gb.name}: <strong className="tabular-nums">{gb.qty} {selectedItem.unit}</strong>
                      </span>
                    ))}
                  </div>

                  {selectedItem.customerPrices && Object.keys(selectedItem.customerPrices).length > 0 && (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                      <div className="text-[11px] font-bold text-slate-500 uppercase mb-1.5">Special Customer Pricing</div>
                      <div className="flex flex-wrap gap-3 text-xs tabular-nums">
                        {Object.entries(selectedItem.customerPrices).map(([cust, pr]) => (
                          <span key={cust} className="text-slate-700 dark:text-slate-200">
                            {cust}: <strong>₹{Number(pr).toFixed(2)}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Weight & Quantity Auto-Calculator */}
                <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-sky-600" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Weight &amp; Quantity Calculator
                      </h3>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 tabular-nums">
                      Rate: ₹{selectedItem.salePrice}/{selectedItem.unit}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setCalcMode('weight')}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                        calcMode === 'weight'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Weight / Qty → Amount (₹)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalcMode('amount')}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                        calcMode === 'amount'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Amount (₹) → Weight / Qty
                    </button>
                  </div>

                  {calcMode === 'weight' ? (
                    <div className="space-y-2.5">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={calcWeightInput}
                          onChange={(e) => setCalcWeightInput(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-sm tabular-nums"
                        />
                        <select
                          value={calcWeightUnit}
                          onChange={(e) => setCalcWeightUnit(e.target.value)}
                          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                        >
                          <option value="GM">g (Grams)</option>
                          <option value="KG">kg</option>
                          <option value="ML">ml</option>
                          <option value="LTR">L</option>
                          <option value="PCS">PCS</option>
                          <option value="CTN">CTN</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: '100g', val: '100', unit: 'GM' },
                          { label: '200g', val: '200', unit: 'GM' },
                          { label: '250g', val: '250', unit: 'GM' },
                          { label: '500g', val: '500', unit: 'GM' },
                          { label: '750g', val: '750', unit: 'GM' },
                          { label: '1kg', val: '1', unit: 'KG' },
                        ].map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => {
                              setCalcWeightInput(p.val);
                              setCalcWeightUnit(p.unit);
                            }}
                            className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-sky-400 font-semibold text-[11px] cursor-pointer"
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={calcAmountInput}
                        onChange={(e) => setCalcAmountInput(e.target.value)}
                        placeholder="Enter Rupees (e.g. 10, 20, 50)"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-sm tabular-nums"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {['5', '10', '20', '25', '50', '100'].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setCalcAmountInput(amt)}
                            className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-sky-400 font-semibold text-[11px] cursor-pointer"
                          >
                            ₹{amt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {calcPreview && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] text-slate-500">Calculated Value</div>
                        <div className="text-lg font-extrabold text-sky-700 dark:text-sky-400 tabular-nums">
                          {calcPreview.primary}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">{calcPreview.secondary}</div>
                      </div>
                      {showMargin && (
                        <div className="text-right tabular-nums">
                          <div className="text-[11px] text-slate-500">Est. Gross Profit</div>
                          <div className={`text-sm font-bold ${calcPreview.profit < 0 ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
                            ₹{calcPreview.profit.toLocaleString('en-IN')}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Detail History Tabs: Transactions / Stock Movements / Price Change Audit */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setDetailHistoryTab('transactions')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                        detailHistoryTab === 'transactions'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Purchase &amp; Sales History ({itemTransactions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailHistoryTab('stock')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                        detailHistoryTab === 'stock'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Stock Movement ({itemMovements.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailHistoryTab('price-audit')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                        detailHistoryTab === 'price-audit'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Price Change Audit ({selectedPriceAudit.length})
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative w-56">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={txSearch}
                        onChange={(e) => setTxSearch(e.target.value)}
                        placeholder="Filter history..."
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-2 py-1.5 text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => exportCurrentViewPdf({ title: `${selectedItem.name} - Item Ledger` })}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5 text-rose-600" />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-96">
                  {detailHistoryTab === 'transactions' && (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase text-slate-500">
                        <tr>
                          <th className="py-2.5 px-4">Type</th>
                          <th className="py-2.5 px-4">Invoice / Ref</th>
                          <th className="py-2.5 px-4">Party Name</th>
                          <th className="py-2.5 px-4">Date</th>
                          <th className="py-2.5 px-4 text-right">Qty</th>
                          <th className="py-2.5 px-4 text-right">Rate</th>
                          <th className="py-2.5 px-4 text-right">Line Total</th>
                          <th className="py-2.5 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {itemTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-10 text-center text-slate-400">
                              No sales or purchase vouchers recorded for {selectedItem.name} yet.
                            </td>
                          </tr>
                        ) : (
                          itemTransactions.map((tx) => {
                            const line = tx.items.find(
                              (li) =>
                                li.itemId === selectedItem.id ||
                                li.id === selectedItem.id ||
                                li.name.toLowerCase() === selectedItem.name.toLowerCase()
                            );
                            return (
                              <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="py-2.5 px-4 font-semibold">{tx.type}</td>
                                <td className="py-2.5 px-4 font-mono">{tx.invoiceNo}</td>
                                <td className="py-2.5 px-4 font-semibold">{tx.partyName}</td>
                                <td className="py-2.5 px-4 text-slate-500">{tx.date}</td>
                                <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                                  {line?.displayWeightLabel || `${line?.qty ?? 0} ${line?.unit || selectedItem.unit}`}
                                </td>
                                <td className="py-2.5 px-4 text-right tabular-nums">
                                  ₹{(line?.price ?? 0).toFixed(2)}
                                </td>
                                <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                                  ₹{(line?.amount ?? 0).toLocaleString('en-IN')}
                                </td>
                                <td className="py-2.5 px-4 font-semibold">{tx.status}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  )}

                  {detailHistoryTab === 'stock' && (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase text-slate-500">
                        <tr>
                          <th className="py-2.5 px-4">Movement Type</th>
                          <th className="py-2.5 px-4">Ref No</th>
                          <th className="py-2.5 px-4 text-right">Qty Change</th>
                          <th className="py-2.5 px-4 text-right">Balance After</th>
                          <th className="py-2.5 px-4">Actor</th>
                          <th className="py-2.5 px-4">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {itemMovements.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-10 text-center text-slate-400">
                              No stock movement entries recorded yet for {selectedItem.name}.
                            </td>
                          </tr>
                        ) : (
                          itemMovements.map((m) => (
                            <tr key={m.id}>
                              <td className="py-2.5 px-4 font-bold">
                                {m.type}
                                {m.notes && <div className="text-[10px] font-normal text-slate-400">{m.notes}</div>}
                              </td>
                              <td className="py-2.5 px-4 font-mono">{m.referenceNo}</td>
                              <td className={`py-2.5 px-4 text-right font-bold tabular-nums ${m.qtyChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {m.qtyChange >= 0 ? `+${m.qtyChange}` : m.qtyChange}
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                                {m.stockAfter} {selectedItem.unit}
                              </td>
                              <td className="py-2.5 px-4">{m.actor}</td>
                              <td className="py-2.5 px-4 text-slate-500">{m.timestamp}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {detailHistoryTab === 'price-audit' && (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase text-slate-500">
                        <tr>
                          <th className="py-2.5 px-4">Price Field</th>
                          <th className="py-2.5 px-4 text-right">Previous (₹)</th>
                          <th className="py-2.5 px-4 text-right">Updated (₹)</th>
                          <th className="py-2.5 px-4">Updated By</th>
                          <th className="py-2.5 px-4">Reason</th>
                          <th className="py-2.5 px-4">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {selectedPriceAudit.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-10 text-center text-slate-400">
                              No price changes recorded yet for {selectedItem.name}.
                            </td>
                          </tr>
                        ) : (
                          selectedPriceAudit.map((pa) => (
                            <tr key={pa.id}>
                              <td className="py-2.5 px-4 font-bold">{pa.field}</td>
                              <td className="py-2.5 px-4 text-right tabular-nums text-slate-500">
                                {showCost || !pa.field.toLowerCase().includes('purchase') ? `₹${pa.oldValue.toFixed(2)}` : '••••'}
                              </td>
                              <td className="py-2.5 px-4 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                                {showCost || !pa.field.toLowerCase().includes('purchase') ? `₹${pa.newValue.toFixed(2)}` : '••••'}
                              </td>
                              <td className="py-2.5 px-4">{pa.actor}</td>
                              <td className="py-2.5 px-4 text-slate-500">{pa.reason || 'Catalog Price Update'}</td>
                              <td className="py-2.5 px-4 text-slate-500">{pa.timestamp}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: BATCH & EXPIRY ALERTS (7d / 15d / 30d / Expired)  */}
      {/* ======================================================== */}
      {activeSubTab === 'BATCH & EXPIRY' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-4 print:hidden">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { id: 'all', label: 'All Tracked Batches', count: batchExpiryRows.summary.total, cls: 'text-slate-900 dark:text-white' },
              { id: 'expired', label: 'Already Expired', count: batchExpiryRows.summary.expired, cls: 'text-rose-600 dark:text-rose-400' },
              { id: '7d', label: 'Expiring ≤ 7 Days', count: batchExpiryRows.summary.within7, cls: 'text-rose-600 dark:text-rose-400' },
              { id: '15d', label: 'Expiring ≤ 15 Days', count: batchExpiryRows.summary.within15, cls: 'text-amber-600 dark:text-amber-400' },
              { id: '30d', label: 'Expiring ≤ 30 Days', count: batchExpiryRows.summary.within30, cls: 'text-sky-700 dark:text-sky-400' },
            ].map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setExpiryBucketFilter(b.id as any)}
                className={`text-left p-3.5 rounded-xl bg-white dark:bg-slate-900 border transition-colors cursor-pointer ${
                  expiryBucketFilter === b.id
                    ? 'border-sky-500 ring-1 ring-sky-500/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="text-[11px] font-medium text-slate-500">{b.label}</div>
                <div className={`text-xl font-bold tabular-nums mt-0.5 ${b.cls}`}>{b.count}</div>
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4">Item Name</th>
                    <th className="py-2.5 px-4">Batch Number</th>
                    <th className="py-2.5 px-4">Mfg Date</th>
                    <th className="py-2.5 px-4">Expiry Date</th>
                    <th className="py-2.5 px-4">Expiry Status</th>
                    <th className="py-2.5 px-4 text-right">Qty</th>
                    <th className="py-2.5 px-4 text-right">Batch Cost</th>
                    <th className="py-2.5 px-4 text-right">Stock Value</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {batchExpiryRows.filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <CalendarClock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        No batches or expiry dates fall into this alert window.
                      </td>
                    </tr>
                  ) : (
                    batchExpiryRows.filtered.map((row) => {
                      const d = row.daysLeft;
                      const linkedItem = items.find((i) => i.id === row.itemId);
                      return (
                        <tr key={row.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-4 font-bold">
                            {row.itemName}
                            <div className="text-[10px] font-mono font-normal text-slate-400">{row.itemCode}</div>
                          </td>
                          <td className="py-2.5 px-4 font-mono font-semibold">{row.batchNumber}</td>
                          <td className="py-2.5 px-4 text-slate-500">{row.mfgDate}</td>
                          <td className="py-2.5 px-4 font-semibold">{row.expiryDate || '—'}</td>
                          <td className="py-2.5 px-4">
                            {d === null ? (
                              <span className="text-slate-400">No Expiry Date</span>
                            ) : d < 0 ? (
                              <span className="inline-flex items-center gap-1 font-bold text-rose-600">
                                <AlertTriangle className="w-3.5 h-3.5" /> Expired ({Math.abs(d)}d ago)
                              </span>
                            ) : d <= 7 ? (
                              <span className="inline-flex items-center gap-1 font-bold text-rose-600">
                                <CalendarClock className="w-3.5 h-3.5" /> Critical ({d}d left)
                              </span>
                            ) : d <= 30 ? (
                              <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                                <CalendarClock className="w-3.5 h-3.5" /> Expiring ({d}d left)
                              </span>
                            ) : (
                              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{d} days left</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                            {row.qty} {row.unit}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            {showCost ? `₹${row.purchaseRate.toFixed(2)}` : '••••'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                            {showCost ? `₹${row.stockValue.toLocaleString('en-IN')}` : '••••'}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            {linkedItem && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(linkedItem)}
                                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                              >
                                Update
                              </button>
                            )}
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
      )}

      {/* ======================================================== */}
      {/* TAB 4: STOCK LEDGER (ALL OR SELECTED ITEM)               */}
      {/* ======================================================== */}
      {activeSubTab === 'STOCK LEDGER' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-4 print:hidden">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-sky-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Inventory Stock Movement Ledger ({itemMovements.length})
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setLedgerScope('all')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                    ledgerScope === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  All Products
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerScope('selected')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                    ledgerScope === 'selected' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {selectedItem ? selectedItem.name : 'Selected Item'}
                </button>
              </div>

              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="Search item, ref no, notes..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-2 py-1.5 text-xs"
                />
              </div>

              {selectedItem && (
                <button
                  type="button"
                  onClick={() => handleOpenAdjustModal(selectedItem, 'set')}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer"
                >
                  Adjust / Damage Entry
                </button>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4">Item Name</th>
                    <th className="py-2.5 px-4">Movement Type</th>
                    <th className="py-2.5 px-4">Ref No</th>
                    <th className="py-2.5 px-4 text-right">Qty Change</th>
                    <th className="py-2.5 px-4 text-right">Stock After</th>
                    <th className="py-2.5 px-4">Actor</th>
                    <th className="py-2.5 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {itemMovements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No stock movements match the current filter.
                      </td>
                    </tr>
                  ) : (
                    itemMovements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-bold">{m.itemName}</td>
                        <td className="py-2.5 px-4">
                          <span className="font-semibold">{m.type}</span>
                          {m.notes && <div className="text-[10px] text-slate-400">{m.notes}</div>}
                        </td>
                        <td className="py-2.5 px-4 font-mono">{m.referenceNo}</td>
                        <td className={`py-2.5 px-4 text-right font-bold tabular-nums ${m.qtyChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {m.qtyChange >= 0 ? `+${m.qtyChange}` : m.qtyChange}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold tabular-nums">{m.stockAfter}</td>
                        <td className="py-2.5 px-4">{m.actor}</td>
                        <td className="py-2.5 px-4 text-slate-500">{m.timestamp}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: CSV / EXCEL BULK IMPORT & EXPORT                  */}
      {/* ======================================================== */}
      {activeSubTab === 'IMPORT / EXPORT' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-5 print:hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Bulk CSV Import &amp; Validation
                </h2>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Download the CSV template, fill in products, and upload or paste rows below. Duplicate Item Codes, duplicate Barcodes, missing names/units, and negative prices are flagged before import.
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadCsvTemplate}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-sky-600" />
                  <span>Download CSV Template</span>
                </button>

                <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload CSV File</span>
                  <input type="file" accept=".csv,text/csv" onChange={handleCsvFileUpload} className="hidden" />
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Or Paste CSV Rows Here
                </label>
                <textarea
                  rows={7}
                  value={csvRawText}
                  onChange={(e) => validateCsvInput(e.target.value)}
                  placeholder="Item Name,Item Code,Barcode,SKU,Category,Subcategory,Brand,Unit,Purchase Price,Retail Price,Wholesale Price,MRP,GST %,Opening Stock,Min Stock Alert"
                  className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-[11px]"
                />
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                <div className="text-xs font-bold text-slate-800 dark:text-white">Quick Catalog Exports</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportItemsCsv(items, 'bm360-full-catalog')}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                  >
                    Export All Items ({items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportItemsCsv(items.filter((i) => i.stock <= (i.minStockAlert ?? 5)), 'bm360-low-stock-reorder')}
                    className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-semibold cursor-pointer"
                  >
                    Export Low Stock Reorder List
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Import Validation Preview ({csvPreviewRows.length} rows)
                  </h3>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    Valid: {csvPreviewRows.filter((r) => r.errors.length === 0).length} · Errors: {csvPreviewRows.filter((r) => r.errors.length > 0).length}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCommitCsvImport}
                  disabled={csvPreviewRows.filter((r) => r.errors.length === 0).length === 0}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold cursor-pointer"
                >
                  Import {csvPreviewRows.filter((r) => r.errors.length === 0).length} Valid Items
                </button>
              </div>

              <div className="flex-1 overflow-x-auto max-h-[420px]">
                {csvPreviewRows.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    Upload or paste CSV content on the left to validate before importing.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase text-slate-500">
                      <tr>
                        <th className="py-2 px-3">Row</th>
                        <th className="py-2 px-3">Item Name</th>
                        <th className="py-2 px-3">Code</th>
                        <th className="py-2 px-3 text-right">Purchase</th>
                        <th className="py-2 px-3 text-right">Retail</th>
                        <th className="py-2 px-3 text-right">Stock</th>
                        <th className="py-2 px-3">Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {csvPreviewRows.map((row) => (
                        <tr key={row.rowNum} className={row.errors.length > 0 ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''}>
                          <td className="py-2 px-3 font-mono">{row.rowNum}</td>
                          <td className="py-2 px-3 font-semibold">{row.name || '—'}</td>
                          <td className="py-2 px-3 font-mono">{row.code || '—'}</td>
                          <td className="py-2 px-3 text-right tabular-nums">₹{row.purchasePrice}</td>
                          <td className="py-2 px-3 text-right tabular-nums">₹{row.salePrice}</td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {row.stock} {row.unit}
                          </td>
                          <td className="py-2 px-3">
                            {row.errors.length === 0 ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Valid</span>
                            ) : (
                              <span className="text-rose-600 font-semibold">{row.errors.join('; ')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 6: 13 ITEM REPORTS WITH DATE FILTER & EXPORT         */}
      {/* ======================================================== */}
      {activeSubTab === 'ITEM REPORTS' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-4 print:hidden">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Item Analytics &amp; Reports</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={reportPeriod}
                  onChange={(e) => setReportPeriod(e.target.value as any)}
                  aria-label="Report period"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-xs"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="month">This Month</option>
                </select>

                <div className="relative w-52">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                    placeholder="Filter report rows..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-2 py-1.5 text-xs"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    downloadCsv(`bm360-${activeReport}-${new Date().toISOString().slice(0, 10)}.csv`, reportData.columns, reportData.rows);
                    showToast('Exported item report to CSV.', 'success');
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportCurrentViewPdf({ title: `Item Report - ${activeReport}` })}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {(
                [
                  { id: 'item-sales', label: 'Item-wise Sales' },
                  { id: 'item-purchases', label: 'Item-wise Purchases' },
                  { id: 'item-profit', label: 'Item-wise Profit' },
                  { id: 'stock-valuation', label: 'Stock Valuation' },
                  { id: 'low-stock', label: 'Low Stock' },
                  { id: 'out-of-stock', label: 'Out of Stock' },
                  { id: 'fast-moving', label: 'Fast Moving' },
                  { id: 'slow-moving', label: 'Slow Moving' },
                  { id: 'dead-stock', label: 'Dead Stock' },
                  { id: 'expiry-report', label: 'Expiry Report' },
                  { id: 'category-sales', label: 'Category-wise Sales' },
                  { id: 'highest-profit', label: 'Highest Profit' },
                  { id: 'lowest-profit', label: 'Lowest Profit' },
                ] as Array<{ id: ItemReportKey; label: string }>
              ).map((rep) => (
                <button
                  key={rep.id}
                  type="button"
                  onClick={() => setActiveReport(rep.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    activeReport === rep.id
                      ? 'bg-sky-600 text-white font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {rep.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase text-slate-500">
                  <tr>
                    {reportData.columns.map((col) => (
                      <th key={col} className="py-2.5 px-4">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reportData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={reportData.columns.length} className="py-12 text-center text-slate-400">
                        No records match this report and date period.
                      </td>
                    </tr>
                  ) : (
                    reportData.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`py-2.5 px-4 tabular-nums ${
                              cIdx === 0 ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 7: CATEGORIES & SUBCATEGORIES                        */}
      {/* ======================================================== */}
      {activeSubTab === 'CATEGORIES' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Categories &amp; Subcategories Overview
              </h2>
              <p className="text-xs text-slate-500">
                Inventory breakdown across {categorySummary.length} active categories
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('categories')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-sky-600" />
                <span>Manage Categories &amp; Subcategories</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('units')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span>Manage Units</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categorySummary.map((c) => (
              <div
                key={c.category}
                onClick={() => {
                  setCategoryFilter(c.category);
                  setActiveSubTab('PRODUCTS');
                }}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 cursor-pointer hover:border-sky-400 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{c.category}</span>
                  <span className="text-xs font-bold text-sky-700 dark:text-sky-400 tabular-nums">
                    {c.count} items
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {c.activeCount} active · {c.totalUnits} stock units
                </div>
                {c.subcategories.length > 0 && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Subcategories: {c.subcategories.join(', ')}
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs tabular-nums">
                  <span className="text-slate-500">
                    Cost: <strong>{showCost ? `₹${c.costValue.toLocaleString('en-IN')}` : '••••'}</strong>
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                    Retail: ₹{c.sellValue.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: STOCK ADJUSTMENT & DAMAGED STOCK                  */}
      {/* ======================================================== */}
      {isAdjustModalOpen && adjustModalTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Stock Control — {adjustModalTarget.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs font-mono text-slate-500">
              Code: {adjustModalTarget.code} · Current Stock: {adjustModalTarget.stock} {adjustModalTarget.unit}
            </div>

            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setAdjustMode('set');
                  setAdjustReason('Manual Stock Audit');
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                  adjustMode === 'set' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                Set Stock Level
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdjustMode('damaged');
                  setAdjustReason('Damaged / Spoilage Write-off');
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                  adjustMode === 'damaged' ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-400 shadow-xs' : 'text-slate-600'
                }`}
              >
                Record Damaged Stock
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-3">
              {adjustMode === 'set' ? (
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    New Physical Stock ({adjustModalTarget.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={allowNegStock ? undefined : 0}
                    value={newStockValue}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setNewStockValue(allowNegStock ? val : Math.max(0, val));
                    }}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-xs font-bold tabular-nums"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Damaged / Spoiled Quantity ({adjustModalTarget.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={damagedQtyInput}
                    onChange={(e) => setDamagedQtyInput(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-xs font-bold tabular-nums"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Reason / Audit Note
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 rounded-lg text-white text-xs font-bold cursor-pointer ${
                    adjustMode === 'damaged' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  {adjustMode === 'damaged' ? 'Write-off Damaged Stock' : 'Save Updated Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: MERGE DUPLICATE SKU                               */}
      {/* ======================================================== */}
      {isMergeModalOpen && mergeSourceItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
              <div className="flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-violet-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Merge Duplicate SKU</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmMerge} className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                Stock from <strong>{mergeSourceItem.name}</strong> ({mergeSourceItem.stock} {mergeSourceItem.unit}, SKU {mergeSourceItem.code}) will be added into the surviving product below, and this duplicate SKU will move to Recycle Bin.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Surviving Target Product *
                </label>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                >
                  {items
                    .filter((i) => i.id !== mergeSourceItem.id)
                    .map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.code} · Stock: {it.stock} {it.unit})
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMergeModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold cursor-pointer"
                >
                  Review &amp; Merge SKUs
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: BULK PRICE / STOCK / METADATA UPDATE              */}
      {/* ======================================================== */}
      {bulkModal !== 'none' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {bulkModal === 'price' && `Bulk Price Update (${selectedIds.length} items)`}
                {bulkModal === 'stock' && `Bulk Stock Adjustment (${selectedIds.length} items)`}
                {bulkModal === 'meta' && `Bulk Category / GST / Status (${selectedIds.length} items)`}
              </h3>
              <button type="button" onClick={() => setBulkModal('none')} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {bulkModal === 'price' && (
              <form onSubmit={handleBulkPriceApply} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Price Field</label>
                  <select
                    value={bulkPriceField}
                    onChange={(e) => setBulkPriceField(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="salePrice">Retail Selling Price</option>
                    <option value="wholesalePrice">Wholesale Price</option>
                    <option value="purchasePrice">Purchase Price</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Direction</label>
                    <select
                      value={bulkPriceDirection}
                      onChange={(e) => setBulkPriceDirection(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="increase">Increase (+)</option>
                      <option value="decrease">Decrease (-)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Mode</label>
                    <select
                      value={bulkPriceType}
                      onChange={(e) => setBulkPriceType(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="percent">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (₹)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Value ({bulkPriceType === 'percent' ? '%' : '₹'})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={bulkPriceValue}
                    onChange={(e) => setBulkPriceValue(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setBulkModal('none')} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold cursor-pointer">
                    Apply Price Update
                  </button>
                </div>
              </form>
            )}

            {bulkModal === 'stock' && (
              <form onSubmit={handleBulkStockApply} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Adjustment Type</label>
                  <select
                    value={bulkStockAction}
                    onChange={(e) => setBulkStockAction(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="add">Add Quantity to Current Stock</option>
                    <option value="reduce">Reduce Quantity from Current Stock</option>
                    <option value="set">Set Exact Stock Quantity</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={bulkStockQty}
                    onChange={(e) => setBulkStockQty(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Audit Reason</label>
                  <input
                    type="text"
                    value={bulkStockReason}
                    onChange={(e) => setBulkStockReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setBulkModal('none')} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold cursor-pointer">
                    Apply Stock Update
                  </button>
                </div>
              </form>
            )}

            {bulkModal === 'meta' && (
              <form onSubmit={handleBulkMetaApply} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Assign Category (leave blank to keep)</label>
                  <input
                    type="text"
                    value={bulkMetaCategory}
                    onChange={(e) => setBulkMetaCategory(e.target.value)}
                    placeholder="e.g. Grocery, Dairy, Personal Care"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Assign GST Rate</label>
                  <select
                    value={bulkMetaGst}
                    onChange={(e) => setBulkMetaGst(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="">Keep Existing GST</option>
                    <option value="0">0% / Exempt</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST</option>
                    <option value="28">28% GST</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Catalog Status</label>
                  <select
                    value={bulkMetaActive}
                    onChange={(e) => setBulkMetaActive(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="keep">Keep Existing Status</option>
                    <option value="active">Mark Active</option>
                    <option value="inactive">Mark Inactive</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setBulkModal('none')} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold cursor-pointer">
                    Apply Changes
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: SINGLE ITEM PRINTABLE BARCODE & PRICE LABEL       */}
      {/* ======================================================== */}
      {printLabelItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 print:static print:bg-white print:p-0">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl p-5 space-y-4 print:shadow-none print:border-0 print:max-w-none print:p-0">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 print:hidden">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Print Price &amp; Barcode Sticker — {printLabelItem.name}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Includes Store Name, Item Name, Retail Price, MRP, and Scannable Barcode
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPrintLabelItem(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold">Copies:</label>
                <input
                  type="number"
                  min="1"
                  max="48"
                  value={printLabelCopies}
                  onChange={(e) => setPrintLabelCopies(Math.max(1, Math.min(48, Number(e.target.value) || 1)))}
                  className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold tabular-nums"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItemId(printLabelItem.id);
                    setPrintLabelItem(null);
                    setActiveTab('barcode-studio');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Open Barcode Studio
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print {printLabelCopies} Stickers</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[55vh] overflow-y-auto print:max-h-none print:overflow-visible print:grid-cols-3">
              {Array.from({ length: printLabelCopies }).map((_, i) => (
                <div
                  key={i}
                  className="p-2.5 border border-dashed border-slate-300 rounded-lg bg-white text-slate-900 flex flex-col items-center text-center space-y-0.5 break-inside-avoid"
                >
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-700">
                    {company?.name || 'MY STORE'}
                  </div>
                  <div className="text-[11px] font-bold text-slate-900 truncate max-w-full">
                    {printLabelItem.name}
                  </div>
                  <div className="w-full py-0.5 flex items-center justify-center overflow-hidden">
                    <QuickLabelSvg value={printLabelItem.barcode || printLabelItem.code} />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-extrabold text-slate-900 tabular-nums">
                    <span>₹{printLabelItem.salePrice.toLocaleString('en-IN')}/{printLabelItem.unit}</span>
                    {printLabelItem.mrp && printLabelItem.mrp > 0 && (
                      <span className="text-slate-500 font-semibold">MRP ₹{printLabelItem.mrp}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
