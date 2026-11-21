import React, { useMemo, useState } from 'react';
import {
  Layers,
  CalendarClock,
  Tags,
  Cpu,
  History,
  TrendingDown,
  Plus,
  AlertTriangle,
  Package,
  Trash2,
  ShoppingCart,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { ProductBundle, SerialNumberRecord } from '../types';
import { safeGetStoredData, safeSetStoredData } from '../utils/storage';

type InvTab = 'batches' | 'variants' | 'serials' | 'price-history' | 'dead-stock' | 'bundles';

export const InventoryEnterpriseView: React.FC = () => {
  const {
    items,
    transactions,
    batches,
    addBatch,
    variants,
    addVariant,
    serialNumbers,
    addSerialNumber,
    updateSerialStatus,
    priceHistory,
    updateProductPricing,
    requestConfirmation,
    setActiveTab,
    showToast,
  } = useVyapar();

  const [activeSubTab, setActiveSubTab] = useState<InvTab>('batches');
  const [batchFilter, setBatchFilter] = useState<'All' | 'ExpiringSoon' | 'Expired'>('All');
  const [serialFilter, setSerialFilter] = useState<'All' | SerialNumberRecord['status']>('All');

  // Batch form
  const [bItemId, setBItemId] = useState(items[0]?.id || '');
  const [bNo, setBNo] = useState('');
  const [bMfg, setBMfg] = useState(new Date().toISOString().slice(0, 10));
  const [bExp, setBExp] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().slice(0, 10);
  });
  const [bQty, setBQty] = useState('10');

  // Variant form
  const [vItemId, setVItemId] = useState(items[0]?.id || '');
  const [vName, setVName] = useState('');
  const [vSku, setVSku] = useState('');
  const [vBarcode, setVBarcode] = useState('');
  const [vPrice, setVPrice] = useState('');
  const [vStock, setVStock] = useState('10');

  // Serial form
  const [sItemId, setSItemId] = useState(items[0]?.id || '');
  const [sSerialNo, setSSerialNo] = useState('');
  const [sWarranty, setSWarranty] = useState('12');

  // Quick Price Editor
  const [pItemId, setPItemId] = useState(items[0]?.id || '');
  const [pNewSale, setPNewSale] = useState('');
  const [pNewWholesale, setPNewWholesale] = useState('');

  // Bundles & Combos
  const [bundles, setBundles] = useState<ProductBundle[]>(() => {
    const saved = safeGetStoredData<ProductBundle[]>('bm360_product_bundles', []);
    if (saved.length > 0) return saved;
    if (items.length >= 2) {
      const a = items[0];
      const b = items[1];
      const sum = (a.salePrice || 0) + (b.salePrice || 0);
      return [
        {
          id: 'bnd-starter-1',
          name: 'Starter Store Value Combo',
          sku: 'COMBO-STARTER-01',
          bundlePrice: Math.max(1, Math.round(sum * 0.9)),
          components: [
            { itemId: a.id, itemName: a.name, qty: 1, unitPrice: a.salePrice || 0 },
            { itemId: b.id, itemName: b.name, qty: 1, unitPrice: b.salePrice || 0 },
          ],
          isActive: true,
        },
      ];
    }
    return [];
  });
  const [bndName, setBndName] = useState('');
  const [bndSku, setBndSku] = useState('');
  const [bndPrice, setBndPrice] = useState('');
  const [bndPickItemId, setBndPickItemId] = useState(items[0]?.id || '');
  const [bndPickQty, setBndPickQty] = useState('1');
  const [bndComponents, setBndComponents] = useState<ProductBundle['components']>([]);

  const persistBundles = (next: ProductBundle[]) => {
    setBundles(next);
    safeSetStoredData('bm360_product_bundles', next);
  };

  const handleAddBundleComponent = () => {
    const prod = items.find((i) => i.id === bndPickItemId) || items[0];
    if (!prod) return;
    const qty = Math.max(1, Number(bndPickQty) || 1);
    setBndComponents((prev) => {
      const idx = prev.findIndex((c) => c.itemId === prod.id);
      if (idx >= 0) {
        return prev.map((c, i) => (i === idx ? { ...c, qty: c.qty + qty } : c));
      }
      return [
        ...prev,
        { itemId: prod.id, itemName: prod.name, qty, unitPrice: prod.salePrice || 0 },
      ];
    });
  };

  const handleCreateBundle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bndName.trim() || bndComponents.length === 0) {
      showToast('Enter a bundle name and add at least one product component', 'warning');
      return;
    }
    const retailSum = bndComponents.reduce((s, c) => s + c.qty * c.unitPrice, 0);
    const price = Number(bndPrice) > 0 ? Number(bndPrice) : Math.round(retailSum * 0.9);
    const newBnd: ProductBundle = {
      id: `bnd-${Date.now()}`,
      name: bndName.trim(),
      sku: (bndSku.trim() || `COMBO-${Date.now().toString().slice(-4)}`).toUpperCase(),
      bundlePrice: price,
      components: bndComponents,
      isActive: true,
    };
    persistBundles([newBnd, ...bundles]);
    setBndName('');
    setBndSku('');
    setBndPrice('');
    setBndComponents([]);
    showToast(`Combo Bundle "${newBnd.name}" saved`, 'success');
  };

  const handleSendBundleToPos = (bnd: ProductBundle) => {
    try {
      localStorage.setItem(
        'bm360_pos_bundle_handoff',
        JSON.stringify({
          bundleName: bnd.name,
          bundlePrice: bnd.bundlePrice,
          components: bnd.components,
        })
      );
    } catch {
      // ignore
    }
    setActiveTab('pos');
  };

  const fmt = (n: number) =>
    '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getBatchStatus = (expDateStr: string) => {
    const exp = new Date(expDateStr);
    const now = new Date();
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (Number.isNaN(diffDays)) return 'Available';
    if (diffDays < 0) return 'Expired';
    if (diffDays <= 30) return 'Expiring Soon';
    return 'Available';
  };

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const st = getBatchStatus(b.expiryDate);
      if (batchFilter === 'Expired') return st === 'Expired';
      if (batchFilter === 'ExpiringSoon') return st === 'Expiring Soon';
      return true;
    });
  }, [batches, batchFilter]);

  const filteredSerials = useMemo(() => {
    return serialNumbers.filter((s) => (serialFilter === 'All' ? true : s.status === serialFilter));
  }, [serialNumbers, serialFilter]);

  // Fast / Slow / Dead Stock Analysis
  const velocityAnalysis = useMemo(() => {
    const qtySoldMap = new Map<string, number>();
    transactions
      .filter((t) => t.type === 'Sale' && !t.isCancelled)
      .forEach((tx) => {
        tx.items.forEach((line) => {
          const key = line.name.toLowerCase();
          qtySoldMap.set(key, (qtySoldMap.get(key) || 0) + (line.qty || 0));
        });
      });

    return items.map((item) => {
      const soldQty = qtySoldMap.get(item.name.toLowerCase()) || 0;
      const classification: 'Fast Moving' | 'Slow Moving' | 'Dead Stock' =
        soldQty >= 5 ? 'Fast Moving' : soldQty > 0 ? 'Slow Moving' : 'Dead Stock';
      const tiedUpValue = (item.stock || 0) * (item.purchasePrice || item.salePrice * 0.75);
      return {
        ...item,
        soldQty,
        classification,
        tiedUpValue,
      };
    });
  }, [items, transactions]);

  const handleAddBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const item = items.find((i) => i.id === bItemId) || items[0];
    if (!item || !bNo.trim()) {
      showToast('Select an item and enter batch number', 'warning');
      return;
    }
    addBatch({
      itemId: item.id,
      itemName: item.name,
      batchNumber: bNo.trim().toUpperCase(),
      mfgDate: bMfg,
      expiryDate: bExp,
      purchaseRate: item.purchasePrice || 0,
      saleRate: item.salePrice || 0,
      qty: Math.max(0, Number(bQty) || 0),
    });
    setBNo('');
  };

  const handleAddVariant = (e: React.FormEvent) => {
    e.preventDefault();
    const item = items.find((i) => i.id === vItemId) || items[0];
    if (!item || !vName.trim() || !vSku.trim()) {
      showToast('Variant name and SKU are required', 'warning');
      return;
    }
    addVariant({
      itemId: item.id,
      name: vName.trim(),
      sku: vSku.trim().toUpperCase(),
      barcode: vBarcode.trim() || `BAR-${Date.now().toString().slice(-6)}`,
      price: Number(vPrice) || item.salePrice,
      stock: Math.max(0, Number(vStock) || 0),
    });
    setVName('');
    setVSku('');
    setVBarcode('');
    setVPrice('');
  };

  const handleAddSerial = (e: React.FormEvent) => {
    e.preventDefault();
    const item = items.find((i) => i.id === sItemId) || items[0];
    if (!item || !sSerialNo.trim()) {
      showToast('Select product and enter Serial Number / IMEI', 'warning');
      return;
    }
    const months = Math.max(0, Number(sWarranty) || 0);
    const today = new Date();
    const warrantyEnd = new Date(today);
    warrantyEnd.setMonth(warrantyEnd.getMonth() + months);

    addSerialNumber({
      serialNo: sSerialNo.trim().toUpperCase(),
      itemId: item.id,
      itemName: item.name,
      purchaseDate: today.toISOString().slice(0, 10),
      warrantyMonths: months,
      warrantyEndDate: months > 0 ? warrantyEnd.toISOString().slice(0, 10) : undefined,
      status: 'Available',
    });
    setSSerialNo('');
  };

  const handleQuickPriceUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const item = items.find((i) => i.id === pItemId);
    if (!item) return;
    const updates: { salePrice?: number; wholesalePrice?: number } = {};
    if (pNewSale) updates.salePrice = Number(pNewSale);
    if (pNewWholesale) updates.wholesalePrice = Number(pNewWholesale);
    if (Object.keys(updates).length === 0) {
      showToast('Enter a new sale or wholesale price', 'warning');
      return;
    }
    updateProductPricing(item.id, updates);
    setPNewSale('');
    setPNewWholesale('');
  };

  return (
    <div className="flex-1 bg-[#f5f6fa] dark:bg-slate-950 flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-100 select-none">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8B0D1E] text-white flex items-center justify-center shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">
              Enterprise Inventory: Batches, Serials, Variants &amp; Aging
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Expiry tracking, SKU/Size variants, IMEI/Serial warranties, Price History audit &amp; Dead Stock detection
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center gap-5 shrink-0 overflow-x-auto font-semibold">
        {(
          [
            { id: 'batches', label: `Batches & Expiry (${batches.length})`, icon: CalendarClock },
            { id: 'variants', label: `Item Variants (${variants.length})`, icon: Tags },
            { id: 'serials', label: `Serials & Warranty (${serialNumbers.length})`, icon: Cpu },
            { id: 'price-history', label: `Price History (${priceHistory.length})`, icon: History },
            { id: 'dead-stock', label: 'Fast / Slow / Dead Stock', icon: TrendingDown },
            { id: 'bundles', label: `Bundles & Combos (${bundles.length})`, icon: Package },
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
                  ? 'border-[#8B0D1E] text-[#8B0D1E] dark:text-rose-400 font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* 1. BATCHES & EXPIRY */}
        {activeSubTab === 'batches' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                {(['All', 'ExpiringSoon', 'Expired'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setBatchFilter(f)}
                    className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                      batchFilter === f
                        ? 'bg-[#8B0D1E] text-white'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {f === 'ExpiringSoon' ? 'Expiring Soon (≤30d)' : f}
                  </button>
                ))}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-4">Product</th>
                      <th className="py-2.5 px-4">Batch #</th>
                      <th className="py-2.5 px-4">Mfg Date</th>
                      <th className="py-2.5 px-4">Expiry Date</th>
                      <th className="py-2.5 px-4 text-right">Qty</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredBatches.map((b) => {
                      const st = getBatchStatus(b.expiryDate);
                      return (
                        <tr key={b.id}>
                          <td className="py-2.5 px-4 font-bold">{b.itemName}</td>
                          <td className="py-2.5 px-4 font-mono">{b.batchNumber}</td>
                          <td className="py-2.5 px-4 text-slate-500">{b.mfgDate}</td>
                          <td className="py-2.5 px-4 font-mono">{b.expiryDate}</td>
                          <td className="py-2.5 px-4 text-right font-bold tabular-nums">{b.qty}</td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                st === 'Expired'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                  : st === 'Expiring Soon'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              }`}
                            >
                              {st}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <form
              onSubmit={handleAddBatch}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-3 h-fit"
            >
              <h3 className="font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                Add Product Batch
              </h3>
              <div>
                <label className="block font-semibold mb-1">Product *</label>
                <select
                  value={bItemId}
                  onChange={(e) => setBItemId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Batch Number *</label>
                <input
                  type="text"
                  value={bNo}
                  onChange={(e) => setBNo(e.target.value)}
                  placeholder="e.g. B-2026-11"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono uppercase"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Mfg Date</label>
                  <input
                    type="date"
                    value={bMfg}
                    onChange={(e) => setBMfg(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={bExp}
                    onChange={(e) => setBExp(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Batch Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={bQty}
                  onChange={(e) => setBQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Save Batch</span>
              </button>
            </form>
          </div>
        )}

        {/* 2. ITEM VARIANTS */}
        {activeSubTab === 'variants' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-2.5 px-4">Base Item</th>
                    <th className="py-2.5 px-4">Variant Name</th>
                    <th className="py-2.5 px-4">SKU</th>
                    <th className="py-2.5 px-4">Barcode</th>
                    <th className="py-2.5 px-4 text-right">Price</th>
                    <th className="py-2.5 px-4 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {variants.map((v) => {
                    const parent = items.find((i) => i.id === v.itemId);
                    return (
                      <tr key={v.id}>
                        <td className="py-2.5 px-4 text-slate-500">{parent?.name || v.itemId}</td>
                        <td className="py-2.5 px-4 font-bold">{v.name}</td>
                        <td className="py-2.5 px-4 font-mono">{v.sku}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-500">{v.barcode}</td>
                        <td className="py-2.5 px-4 text-right font-bold tabular-nums">{fmt(v.price)}</td>
                        <td className="py-2.5 px-4 text-right font-bold tabular-nums">{v.stock}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <form
              onSubmit={handleAddVariant}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-3 h-fit"
            >
              <h3 className="font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                Add Item Variant
              </h3>
              <div>
                <label className="block font-semibold mb-1">Parent Product</label>
                <select
                  value={vItemId}
                  onChange={(e) => setVItemId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Variant Label (Size / Color / Pack) *</label>
                <input
                  type="text"
                  value={vName}
                  onChange={(e) => setVName(e.target.value)}
                  placeholder="e.g. 500g Economy Pack"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">SKU *</label>
                  <input
                    type="text"
                    value={vSku}
                    onChange={(e) => setVSku(e.target.value)}
                    placeholder="SKU-500G"
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Barcode</label>
                  <input
                    type="text"
                    value={vBarcode}
                    onChange={(e) => setVBarcode(e.target.value)}
                    placeholder="890123456"
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={vPrice}
                    onChange={(e) => setVPrice(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Stock</label>
                  <input
                    type="number"
                    min={0}
                    value={vStock}
                    onChange={(e) => setVStock(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white font-bold cursor-pointer"
              >
                Create Variant
              </button>
            </form>
          </div>
        )}

        {/* 3. SERIALS & WARRANTY */}
        {activeSubTab === 'serials' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {(['All', 'Available', 'Sold', 'Returned', 'Damaged'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSerialFilter(st)}
                    className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                      serialFilter === st
                        ? 'bg-[#8B0D1E] text-white'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-4">Serial / IMEI</th>
                      <th className="py-2.5 px-4">Item</th>
                      <th className="py-2.5 px-4">Warranty</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Update Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredSerials.map((sn) => (
                      <tr key={sn.id}>
                        <td className="py-2.5 px-4 font-mono font-bold">{sn.serialNo}</td>
                        <td className="py-2.5 px-4">{sn.itemName}</td>
                        <td className="py-2.5 px-4 text-slate-500">
                          {sn.warrantyMonths}m {sn.warrantyEndDate ? `(until ${sn.warrantyEndDate})` : ''}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sn.status === 'Available'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                : sn.status === 'Sold'
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {sn.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <select
                            aria-label={`Change status for ${sn.serialNo}`}
                            value={sn.status}
                            onChange={(e) =>
                              updateSerialStatus(sn.id, e.target.value as SerialNumberRecord['status'])
                            }
                            className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-[11px] font-semibold cursor-pointer"
                          >
                            <option value="Available">Available</option>
                            <option value="Sold">Sold</option>
                            <option value="Returned">Returned</option>
                            <option value="Damaged">Damaged</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <form
              onSubmit={handleAddSerial}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-3 h-fit"
            >
              <h3 className="font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                Register Serial / Warranty Unit
              </h3>
              <div>
                <label className="block font-semibold mb-1">Product</label>
                <select
                  value={sItemId}
                  onChange={(e) => setSItemId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Serial / IMEI Number *</label>
                <input
                  type="text"
                  value={sSerialNo}
                  onChange={(e) => setSSerialNo(e.target.value)}
                  placeholder="e.g. SN-9948271-IN"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Warranty Period (Months)</label>
                <input
                  type="number"
                  min={0}
                  value={sWarranty}
                  onChange={(e) => setSWarranty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white font-bold cursor-pointer"
              >
                Register Serial Unit
              </button>
            </form>
          </div>
        )}

        {/* 4. PRICE HISTORY */}
        {activeSubTab === 'price-history' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 font-bold text-sm">
                Automated Price Change Audit Trail
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-2.5 px-4">Item</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4 text-right">Old Price</th>
                    <th className="py-2.5 px-4 text-right">New Price</th>
                    <th className="py-2.5 px-4">Changed By</th>
                    <th className="py-2.5 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {priceHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Update any product price on the right to see live audit history.
                      </td>
                    </tr>
                  ) : (
                    priceHistory.map((ph) => (
                      <tr key={ph.id}>
                        <td className="py-2.5 px-4 font-bold">{ph.itemName}</td>
                        <td className="py-2.5 px-4">{ph.priceType}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-slate-500">{fmt(ph.oldPrice)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                          {fmt(ph.newPrice)}
                        </td>
                        <td className="py-2.5 px-4">{ph.actor}</td>
                        <td className="py-2.5 px-4 text-slate-500">{ph.timestamp}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <form
              onSubmit={handleQuickPriceUpdate}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-3 h-fit"
            >
              <h3 className="font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                Update Item Price (Logs Automatically)
              </h3>
              <div>
                <label className="block font-semibold mb-1">Product</label>
                <select
                  value={pItemId}
                  onChange={(e) => setPItemId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} (Current: ₹{it.salePrice})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">New Retail Sale Price (₹)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={pNewSale}
                  onChange={(e) => setPNewSale(e.target.value)}
                  placeholder="Leave blank to keep unchanged"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">New Wholesale Price (₹)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={pNewWholesale}
                  onChange={(e) => setPNewWholesale(e.target.value)}
                  placeholder="Leave blank to keep unchanged"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white font-bold cursor-pointer"
              >
                Update &amp; Log Price Change
              </button>
            </form>
          </div>
        )}

        {/* 5. DEAD / FAST / SLOW STOCK */}
        {activeSubTab === 'dead-stock' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="font-bold text-sm">Inventory Movement &amp; Dead Stock Intelligence</div>
              <div className="flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>
                  Dead Stock Value:{' '}
                  <strong className="tabular-nums">
                    {fmt(
                      velocityAnalysis
                        .filter((v) => v.classification === 'Dead Stock')
                        .reduce((s, v) => s + v.tiedUpValue, 0)
                    )}
                  </strong>
                </span>
              </div>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-2.5 px-4">Item</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4 text-right">Stock On Hand</th>
                  <th className="py-2.5 px-4 text-right">Units Sold</th>
                  <th className="py-2.5 px-4 text-right">Tied-Up Cost</th>
                  <th className="py-2.5 px-4 text-center">Movement Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {velocityAnalysis.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2.5 px-4 font-bold">{row.name}</td>
                    <td className="py-2.5 px-4 text-slate-500">{row.category}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-semibold">
                      {row.stock} {row.unit}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-bold">{row.soldQty}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{fmt(row.tiedUpValue)}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.classification === 'Fast Moving'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : row.classification === 'Slow Moving'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {row.classification}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. BUNDLES & COMBOS */}
        {activeSubTab === 'bundles' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-3">
              {bundles.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center text-slate-400">
                  No combo bundles configured yet. Use the form on the right to group products into a discounted pack.
                </div>
              ) : (
                bundles.map((bnd) => {
                  const retailSum = bnd.components.reduce((s, c) => s + c.qty * c.unitPrice, 0);
                  const savings = Math.max(0, retailSum - bnd.bundlePrice);
                  const savingsPct = retailSum > 0 ? Math.round((savings / retailSum) * 100) : 0;
                  return (
                    <div
                      key={bnd.id}
                      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">{bnd.name}</span>
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {bnd.sku}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                bnd.isActive
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {bnd.isActive ? 'Active' : 'Paused'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            Component MRP Sum: <span className="line-through tabular-nums">{fmt(retailSum)}</span> &rarr; Combo Price:{' '}
                            <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">{fmt(bnd.bundlePrice)}</strong>
                            {savings > 0 && (
                              <span className="ml-2 font-bold text-rose-600 dark:text-rose-400">
                                (Save {fmt(savings)} / {savingsPct}%)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendBundleToPos(bnd)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>Bill in POS</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              persistBundles(
                                bundles.map((b) => (b.id === bnd.id ? { ...b, isActive: !b.isActive } : b))
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-[11px] hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            {bnd.isActive ? 'Pause' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              requestConfirmation({
                                title: 'Delete Combo Bundle',
                                message: `Remove "${bnd.name}" from Bundles & Combos? Component inventory items will not be deleted.`,
                                confirmLabel: 'Delete Bundle',
                                variant: 'danger',
                                onConfirm: () => persistBundles(bundles.filter((b) => b.id !== bnd.id)),
                              })
                            }
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                        {bnd.components.map((c, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-800/60"
                          >
                            <span className="font-medium truncate">
                              {c.qty} &times; {c.itemName}
                            </span>
                            <span className="font-mono text-slate-500 tabular-nums shrink-0">
                              {fmt(c.qty * c.unitPrice)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={handleCreateBundle}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-3 h-fit"
            >
              <h3 className="font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                Create Product Bundle / Combo
              </h3>
              <div>
                <label className="block font-semibold mb-1">Combo Pack Name *</label>
                <input
                  type="text"
                  value={bndName}
                  onChange={(e) => setBndName(e.target.value)}
                  placeholder="e.g. Monthly Grocery Saver Pack"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Combo SKU</label>
                  <input
                    type="text"
                    value={bndSku}
                    onChange={(e) => setBndSku(e.target.value)}
                    placeholder="COMBO-01"
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Combo Price (₹)</label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    value={bndPrice}
                    onChange={(e) => setBndPrice(e.target.value)}
                    placeholder="Auto 10% off"
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <label className="block font-semibold">Add Component Items</label>
                <div className="flex items-center gap-2">
                  <select
                    value={bndPickItemId}
                    onChange={(e) => setBndPickItemId(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} (₹{it.salePrice})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={bndPickQty}
                    onChange={(e) => setBndPickQty(e.target.value)}
                    className="w-16 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-right tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={handleAddBundleComponent}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white font-bold cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {bndComponents.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {bndComponents.map((c) => (
                      <div key={c.itemId} className="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded">
                        <span>
                          {c.qty} &times; {c.itemName}
                        </span>
                        <button
                          type="button"
                          onClick={() => setBndComponents((prev) => prev.filter((x) => x.itemId !== c.itemId))}
                          className="text-rose-600 font-bold cursor-pointer"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    <div className="text-[11px] text-slate-500 pt-1">
                      Component Total:{' '}
                      <strong className="tabular-nums">
                        {fmt(bndComponents.reduce((s, c) => s + c.qty * c.unitPrice, 0))}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Save Product Bundle</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
