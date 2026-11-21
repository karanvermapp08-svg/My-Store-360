import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  Search,
  Download,
  FileSpreadsheet,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';

interface StockSummaryViewProps {
  initialFilter?: 'All' | 'LowStock' | 'OutOfStock';
}

export const StockSummaryView: React.FC<StockSummaryViewProps> = ({ initialFilter = 'All' }) => {
  const {
    items,
    setActiveTab,
    setIsAddItemModalOpen,
    setSelectedItemId,
    showToast,
    exportCurrentViewPdf,
  } = useVyapar();

  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'All' | 'LowStock' | 'OutOfStock'>(initialFilter);
  useEffect(() => {
    setFilterMode(initialFilter);
  }, [initialFilter]);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map((i) => i.category || 'General')));
    return ['All', ...cats];
  }, [items]);

  const stats = useMemo(() => {
    const totalItems = items.length;
    const totalQty = items.reduce((sum, i) => sum + (i.stock || 0), 0);
    const purchaseValuation = items.reduce((sum, i) => sum + (i.stock || 0) * (i.purchasePrice || 0), 0);
    const salesValuation = items.reduce((sum, i) => sum + (i.stock || 0) * (i.salePrice || 0), 0);
    const lowStockCount = items.filter((i) => (i.stock || 0) <= (i.minStockAlert || 10) && (i.stock || 0) > 0).length;
    const outOfStockCount = items.filter((i) => (i.stock || 0) <= 0).length;

    return { totalItems, totalQty, purchaseValuation, salesValuation, lowStockCount, outOfStockCount };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.code.toLowerCase().includes(search.toLowerCase()) ||
        (item.barcode && item.barcode.toLowerCase().includes(search.toLowerCase())) ||
        (item.category && item.category.toLowerCase().includes(search.toLowerCase()));

      const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;

      let matchesFilter = true;
      if (filterMode === 'LowStock') {
        matchesFilter = (item.stock || 0) <= (item.minStockAlert || 10) && (item.stock || 0) > 0;
      } else if (filterMode === 'OutOfStock') {
        matchesFilter = (item.stock || 0) <= 0;
      }

      return matchesSearch && matchesCat && matchesFilter;
    });
  }, [items, search, selectedCategory, filterMode]);

  const handleExportCsv = () => {
    if (filteredItems.length === 0) {
      showToast('No stock items to export', 'warning');
      return;
    }
    const headers = 'Item Code,Barcode,Product Name,Category,Purchase Rate,Sale Price,Available Stock,Unit,Valuation (Cost),Status\n';
    const rows = filteredItems
      .map((item) => {
        const isOut = (item.stock || 0) <= 0;
        const isLow = (item.stock || 0) <= (item.minStockAlert || 10) && !isOut;
        const status = isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Optimal';
        const val = (item.stock || 0) * (item.purchasePrice || 0);
        return `"${item.code}","${item.barcode || ''}","${item.name.replace(/"/g, '""')}","${item.category || 'General'}",${item.purchasePrice || 0},${item.salePrice || 0},${item.stock || 0},"${item.unit || 'PCS'}",${val},"${status}"`;
      })
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Stock_Summary_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Stock summary exported to CSV', 'success');
  };

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-slate-950 flex flex-col overflow-hidden select-none text-xs text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 flex items-center justify-center border border-purple-200 dark:border-purple-900">
            <Package className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 dark:text-white">
                Inventory Stock Summary &amp; Valuation
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                Live Inventory Ledger
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Detailed stock quantities, purchase cost valuation, retail sale value, and reorder warnings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => exportCurrentViewPdf({ title: 'Inventory Stock Valuation Report' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddItemModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Item</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-slate-100/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Total Products</span>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{stats.totalItems} SKUs</div>
          <span className="text-[10px] text-slate-400">{stats.totalQty} total units in stock</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/60 shadow-2xs">
          <span className="text-[11px] text-purple-700 dark:text-purple-400 font-medium">
            Stock Value (Purchase Cost)
          </span>
          <div className="text-xl font-bold text-purple-800 dark:text-purple-300 mt-0.5 tabular-nums">
            ₹ {stats.purchaseValuation.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-purple-600 dark:text-purple-400">Accounting inventory asset</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 shadow-2xs">
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
            Stock Value (Retail / Sale)
          </span>
          <div className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-0.5 tabular-nums">
            ₹ {stats.salesValuation.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Expected revenue potential</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 shadow-2xs">
          <span className="text-[11px] text-amber-800 dark:text-amber-400 font-medium">
            Low &amp; Out of Stock
          </span>
          <div className="text-xl font-bold text-amber-900 dark:text-amber-300 mt-0.5 tabular-nums">
            {stats.lowStockCount} Low / {stats.outOfStockCount} Out
          </div>
          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
            Immediate reorder required
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item name, code, barcode..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {(['All', 'LowStock', 'OutOfStock'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                filterMode === mode
                  ? mode === 'LowStock'
                    ? 'bg-amber-600 text-white'
                    : mode === 'OutOfStock'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-900 dark:bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {mode === 'All' ? 'All Stock' : mode === 'LowStock' ? 'Low Stock' : 'Out of Stock'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-4">Item Code</th>
              <th className="py-2.5 px-4">Product Name</th>
              <th className="py-2.5 px-4">Category</th>
              <th className="py-2.5 px-4 text-right">Purchase Rate</th>
              <th className="py-2.5 px-4 text-right">Sale Price</th>
              <th className="py-2.5 px-4 text-center">Available Stock</th>
              <th className="py-2.5 px-4 text-right">Valuation (Cost)</th>
              <th className="py-2.5 px-4 text-center">Stock Status</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
            {filteredItems.map((item) => {
              const isLow = (item.stock || 0) <= (item.minStockAlert || 10) && (item.stock || 0) > 0;
              const isOut = (item.stock || 0) <= 0;

              return (
                <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                    {item.code || '-'}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {item.category || 'General'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-medium text-slate-600 dark:text-slate-400 tabular-nums">
                    ₹ {(item.purchasePrice || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                    ₹ {(item.salePrice || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-4 text-center font-bold text-slate-900 dark:text-white tabular-nums">
                    {item.stock || 0} {item.unit || 'PCS'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-purple-700 dark:text-purple-400 tabular-nums">
                    ₹ {((item.stock || 0) * (item.purchasePrice || 0)).toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {isOut ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                        Out of Stock
                      </span>
                    ) : isLow ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                        Low Stock
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                        Optimal
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setActiveTab('items');
                        }}
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Item Card
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setActiveTab('stock-adjustment');
                        }}
                        title="Open Stock Adjustment"
                        className="px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1 hover:bg-amber-100 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Adjust</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
