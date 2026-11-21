import React, { useMemo, useState } from 'react';
import {
  Plus,
  Minus,
  Search,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  RotateCcw,
  Barcode,
  X,
  ShieldAlert,
  Package,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { findItemByBarcode } from '../utils/barcodeUtils';

export const StockAdjustmentView: React.FC = () => {
  const {
    items,
    stockHistory,
    businessSettings,
    adjustStock,
    recordDamagedStock,
    showToast,
    exportCurrentViewPdf,
    openBarcodeScanner,
    recordScannedBarcode,
  } = useVyapar();

  const [selectedItemId, setSelectedItemId] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'ADD' | 'REDUCE'>('ADD');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('Physical Stock Audit Reconciliation');
  const [customReason, setCustomReason] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [ledgerScope, setLedgerScope] = useState<'ADJUSTMENTS' | 'ALL'>('ADJUSTMENTS');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  const allowNegativeStock =
    Boolean(businessSettings?.item?.allowNegativeStock) &&
    Boolean(businessSettings?.transaction?.behaviour?.allowNegativeStock);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedItemId) || null,
    [items, selectedItemId]
  );

  const parsedQty = Math.max(0, Math.floor(Number(qty) || 0));
  const projectedStock = useMemo(() => {
    if (!selectedItem) return 0;
    const cur = selectedItem.stock || 0;
    return adjustmentType === 'ADD' ? cur + parsedQty : cur - parsedQty;
  }, [selectedItem, adjustmentType, parsedQty]);

  const adjustmentRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stockHistory.filter((rec) => {
      if (
        ledgerScope === 'ADJUSTMENTS' &&
        rec.type !== 'MANUAL_ADJUSTMENT' &&
        rec.type !== 'DAMAGED_WRITE_OFF'
      ) {
        return false;
      }
      if (directionFilter === 'IN' && rec.qtyChange <= 0) return false;
      if (directionFilter === 'OUT' && rec.qtyChange >= 0) return false;
      if (!q) return true;
      return (
        rec.itemName.toLowerCase().includes(q) ||
        rec.referenceNo.toLowerCase().includes(q) ||
        rec.actor.toLowerCase().includes(q) ||
        (rec.notes || '').toLowerCase().includes(q) ||
        rec.type.toLowerCase().includes(q)
      );
    });
  }, [stockHistory, ledgerScope, directionFilter, search]);

  const summary = useMemo(() => {
    const adjRows = stockHistory.filter(
      (r) => r.type === 'MANUAL_ADJUSTMENT' || r.type === 'DAMAGED_WRITE_OFF'
    );
    const addedUnits = adjRows
      .filter((r) => r.qtyChange > 0)
      .reduce((s, r) => s + r.qtyChange, 0);
    const reducedUnits = adjRows
      .filter((r) => r.qtyChange < 0)
      .reduce((s, r) => s + Math.abs(r.qtyChange), 0);
    const damagedCount = adjRows.filter((r) => r.type === 'DAMAGED_WRITE_OFF').length;
    return {
      totalCount: adjRows.length,
      addedUnits,
      reducedUnits,
      damagedCount,
    };
  }, [stockHistory]);

  const handleApplyAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const item = items.find((i) => i.id === selectedItemId);
    const adjustQty = Math.floor(Number(qty) || 0);

    if (!item || adjustQty <= 0) {
      showToast('Please select an item and enter a valid positive quantity', 'warning');
      return;
    }

    const currentStock = item.stock || 0;
    const rawNewStock = adjustmentType === 'ADD' ? currentStock + adjustQty : currentStock - adjustQty;

    if (adjustmentType === 'REDUCE' && rawNewStock < 0 && !allowNegativeStock) {
      showToast(
        `Negative stock blocked: "${item.name}" only has ${currentStock} ${item.unit} available.`,
        'error'
      );
      return;
    }

    const finalReason =
      reason === 'Custom Reason' ? customReason.trim() || 'Manual Physical Audit' : reason;

    if (
      adjustmentType === 'REDUCE' &&
      rawNewStock >= 0 &&
      (finalReason.toLowerCase().includes('damaged') || finalReason.toLowerCase().includes('expired'))
    ) {
      const res = recordDamagedStock(item.id, adjustQty, finalReason);
      if (!res.success) return;
    } else {
      adjustStock(item.id, rawNewStock, finalReason);
    }

    setIsModalOpen(false);
    setSelectedItemId('');
    setQty('');
    setCustomReason('');
  };

  const handleExportCsv = () => {
    if (adjustmentRecords.length === 0) {
      showToast('No stock adjustment entries to export', 'warning');
      return;
    }
    const headers = 'Timestamp,Ref No,Product Name,Movement Type,Qty Change,Stock After,Actor,Reason/Notes\n';
    const rows = adjustmentRecords
      .map(
        (r) =>
          `"${r.timestamp}","${r.referenceNo}","${r.itemName.replace(/"/g, '""')}","${r.type}",${r.qtyChange},${r.stockAfter},"${r.actor.replace(/"/g, '""')}","${(r.notes || '').replace(/"/g, '""')}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Stock_Adjustment_Ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Stock adjustment ledger exported to CSV', 'success');
  };

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-slate-950 flex flex-col overflow-hidden select-none text-xs text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-900">
            <RotateCcw className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 dark:text-white">
                Stock Adjustment &amp; Physical Audit
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                Live Ledger
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Reconcile physical floor stock with persistent audit trail (+/-) &bull; Negative Stock:{' '}
              <strong className={allowNegativeStock ? 'text-emerald-600' : 'text-rose-600'}>
                {allowNegativeStock ? 'Allowed' : 'Blocked'}
              </strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              openBarcodeScanner('adjustment', (matched) => {
                if (matched) {
                  setSelectedItemId(matched.id);
                  setIsModalOpen(true);
                }
              })
            }
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Barcode className="w-4 h-4" />
            <span>Scan Barcode to Adjust</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => exportCurrentViewPdf({ title: 'Stock Adjustment Log' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Stock Adjustment</span>
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 bg-slate-100/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-500">Audit Adjustments</span>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
            {summary.totalCount} Entries
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60">
          <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
            Total Added (+)
          </span>
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums">
            +{summary.addedUnits} Units
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-rose-200 dark:border-rose-900/60">
          <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400">
            Reduced / Write-Off (-)
          </span>
          <div className="text-lg font-bold text-rose-700 dark:text-rose-400 mt-0.5 tabular-nums">
            -{summary.reducedUnits} Units
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-amber-200 dark:border-amber-900/60">
          <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
            Damaged / Expired
          </span>
          <div className="text-lg font-bold text-amber-800 dark:text-amber-300 mt-0.5 tabular-nums">
            {summary.damagedCount} Write-Offs
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item, ref #, actor, or reason..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>

          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => setLedgerScope('ADJUSTMENTS')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                ledgerScope === 'ADJUSTMENTS'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Adjustments &amp; Write-Offs
            </button>
            <button
              type="button"
              onClick={() => setLedgerScope('ALL')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                ledgerScope === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All Stock Movements
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {(['ALL', 'IN', 'OUT'] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => setDirectionFilter(dir)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                directionFilter === dir
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {dir === 'ALL' ? 'All (+/-)' : dir === 'IN' ? 'Inward (+)' : 'Outward (-)'}
            </button>
          ))}
        </div>
      </div>

      {/* Adjustment Log Table */}
      <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-4">Date &amp; Time</th>
              <th className="py-2.5 px-4">Ref #</th>
              <th className="py-2.5 px-4">Product Name</th>
              <th className="py-2.5 px-4">Movement Type</th>
              <th className="py-2.5 px-4 text-center">Adjusted Qty</th>
              <th className="py-2.5 px-4 text-center">Stock After</th>
              <th className="py-2.5 px-4">Actor</th>
              <th className="py-2.5 px-4">Reason / Audit Remark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
            {adjustmentRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-14 text-center text-slate-400">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-600 dark:text-slate-300">
                    No stock adjustment entries match your filter
                  </p>
                  <p className="text-[11px] mt-1">
                    Click &quot;New Stock Adjustment&quot; above to record physical audit counts or write-offs.
                  </p>
                </td>
              </tr>
            ) : (
              adjustmentRecords.map((adj) => {
                const isAdd = adj.qtyChange >= 0;
                return (
                  <tr key={adj.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                      {adj.timestamp}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {adj.referenceNo}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                      {adj.itemName}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          adj.type === 'DAMAGED_WRITE_OFF'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                            : isAdd
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {isAdd ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {adj.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td
                      className={`py-2.5 px-4 text-center font-bold tabular-nums ${
                        isAdd ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {isAdd ? `+${adj.qtyChange}` : adj.qtyChange}
                    </td>
                    <td className="py-2.5 px-4 text-center font-bold text-slate-900 dark:text-white tabular-nums">
                      {adj.stockAfter} units
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">{adj.actor}</td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                      {adj.notes || 'Physical inventory update'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">Record Stock Adjustment</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleApplyAdjustment} className="p-5 space-y-4">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Quick Barcode Scan Lookup
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const matched = findItemByBarcode(items, barcodeInput);
                        if (matched) {
                          setSelectedItemId(matched.id);
                          recordScannedBarcode(barcodeInput, matched);
                          setBarcodeInput('');
                          showToast(`Selected ${matched.name}`, 'success');
                        } else {
                          showToast(`Barcode "${barcodeInput}" not found`, 'warning');
                        }
                      }
                    }}
                    placeholder="Scan barcode & press Enter..."
                    className="flex-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-xs font-mono bg-white dark:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      openBarcodeScanner('adjustment', (matched) => {
                        if (matched) setSelectedItemId(matched.id);
                      })
                    }
                    className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Barcode className="w-3.5 h-3.5" />
                    <span>Scan</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Select Item *
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800"
                >
                  <option value="">-- Choose Item --</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} [{i.barcode || i.code}] (Stock: {i.stock} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Adjustment Type *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('ADD')}
                    className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                      adjustmentType === 'ADD'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Stock (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('REDUCE')}
                    className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                      adjustmentType === 'REDUCE'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span>Reduce Stock (-)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Quantity to Adjust *
                </label>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  required
                  min="1"
                  placeholder="e.g. 5"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold tabular-nums"
                />
                {selectedItem && parsedQty > 0 && (
                  <div
                    className={`mt-1.5 text-[11px] flex items-center gap-1.5 font-semibold ${
                      projectedStock < 0 && !allowNegativeStock
                        ? 'text-rose-600'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {projectedStock < 0 && !allowNegativeStock ? (
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                    )}
                    <span>
                      Current: {selectedItem.stock} {selectedItem.unit} &rarr; Projected:{' '}
                      <strong>
                        {projectedStock} {selectedItem.unit}
                      </strong>
                      {projectedStock < 0 && !allowNegativeStock ? ' (Blocked: Neg. stock disabled)' : ''}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Adjustment Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800"
                >
                  <option value="Physical Stock Audit Reconciliation">Physical Stock Audit Reconciliation</option>
                  <option value="Damaged / Broken in Godown">Damaged / Broken in Godown</option>
                  <option value="Expired Product Write-off">Expired Product Write-off</option>
                  <option value="Supplier Sample / Promotional">Supplier Sample / Promotional</option>
                  <option value="Correction of Entry Error">Correction of Entry Error</option>
                  <option value="Custom Reason">Custom Reason...</option>
                </select>
                {reason === 'Custom Reason' && (
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter detailed audit remark..."
                    required
                    className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs cursor-pointer"
                >
                  Apply Stock Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
