import React from 'react';
import { Calendar, Layers, Plus, Sparkles, Trash2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Godown } from '../../types';

export interface BatchDraftRow {
  id: string;
  batchNumber: string;
  mfgDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  qty: number;
  purchaseRate: number;
  saleRate: number;
  warehouseId?: string;
}

export interface BatchValidationResult {
  valid: boolean;
  errorsByRowId: Record<string, string[]>;
  globalError: string | null;
  totalBatchQty: number;
}

export function getBatchExpiryStatus(
  expiryDate: string,
  warningDays = 30
): { status: 'None' | 'Expired' | 'Expiring Soon' | 'Healthy'; daysLeft: number | null } {
  if (!expiryDate || !expiryDate.trim()) {
    return { status: 'None', daysLeft: null };
  }
  const exp = new Date(`${expiryDate}T00:00:00`);
  if (Number.isNaN(exp.getTime())) {
    return { status: 'None', daysLeft: null };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { status: 'Expired', daysLeft: diffDays };
  if (diffDays <= warningDays) return { status: 'Expiring Soon', daysLeft: diffDays };
  return { status: 'Healthy', daysLeft: diffDays };
}

export function validateBatchEntries(
  rows: BatchDraftRow[],
  options?: {
    requireAtLeastOneBatch?: boolean;
    requireExpiry?: boolean;
    itemStock?: number;
  }
): BatchValidationResult {
  const errorsByRowId: Record<string, string[]> = {};
  let globalError: string | null = null;
  const seenBatchNumbers = new Map<string, string>();
  let totalBatchQty = 0;

  const activeRows = rows.filter(
    (r) =>
      r.batchNumber.trim() !== '' ||
      r.mfgDate.trim() !== '' ||
      r.expiryDate.trim() !== '' ||
      Number(r.qty) > 0
  );

  if (options?.requireAtLeastOneBatch && activeRows.length === 0) {
    globalError = 'At least one batch number is required when Batch Tracking is active.';
  }

  for (const row of activeRows) {
    const errs: string[] = [];
    const cleanBatch = row.batchNumber.trim();

    if (!cleanBatch) {
      errs.push('Batch Number is required');
    } else {
      const normalized = cleanBatch.toLowerCase();
      if (seenBatchNumbers.has(normalized)) {
        errs.push(`Duplicate batch number "${cleanBatch}"`);
      } else {
        seenBatchNumbers.set(normalized, row.id);
      }
    }

    if (row.mfgDate && row.expiryDate && row.expiryDate < row.mfgDate) {
      errs.push('Expiry Date must be on or after Manufacturing Date');
    }

    if (options?.requireExpiry && !row.expiryDate.trim()) {
      errs.push('Expiry Date is required when Expiry Tracking is enabled');
    }

    const qtyNum = Number(row.qty);
    if (Number.isNaN(qtyNum) || qtyNum < 0) {
      errs.push('Batch quantity cannot be negative');
    } else {
      totalBatchQty += qtyNum;
    }

    if (Number(row.purchaseRate) < 0 || Number(row.saleRate) < 0) {
      errs.push('Batch rates cannot be negative');
    }

    if (errs.length > 0) {
      errorsByRowId[row.id] = errs;
    }
  }

  if (
    !globalError &&
    activeRows.length > 0 &&
    typeof options?.itemStock === 'number' &&
    options.itemStock > 0 &&
    Math.abs(totalBatchQty - options.itemStock) > 0.001
  ) {
    // Soft guidance handled in UI, not blocking unless stock mismatch needed
  }

  return {
    valid: !globalError && Object.keys(errorsByRowId).length === 0,
    errorsByRowId,
    globalError,
    totalBatchQty: Math.round(totalBatchQty * 1000) / 1000,
  };
}

interface ItemBatchEditorProps {
  rows: BatchDraftRow[];
  onChange: (nextRows: BatchDraftRow[]) => void;
  unit: string;
  defaultPurchaseRate: number;
  defaultSaleRate: number;
  defaultWarehouseId: string;
  godowns: Godown[];
  itemStock: number;
  enableBatchTracking: boolean;
  enableExpiryTracking: boolean;
  expiryWarningDays: number;
  validation: BatchValidationResult;
  onSyncStockToBatches?: (totalBatchQty: number) => void;
}

export const ItemBatchEditor: React.FC<ItemBatchEditorProps> = ({
  rows,
  onChange,
  unit,
  defaultPurchaseRate,
  defaultSaleRate,
  defaultWarehouseId,
  godowns,
  itemStock,
  enableBatchTracking,
  enableExpiryTracking,
  expiryWarningDays,
  validation,
  onSyncStockToBatches,
}) => {
  const handleAddRow = () => {
    const seq = rows.length + 1;
    const today = new Date().toISOString().slice(0, 10);
    const nextBatch: BatchDraftRow = {
      id: `bat-draft-${Date.now()}-${seq}`,
      batchNumber: `BAT-${new Date().getFullYear().toString().slice(-2)}${String(
        new Date().getMonth() + 1
      ).padStart(2, '0')}-${String(seq).padStart(2, '0')}`,
      mfgDate: today,
      expiryDate: '',
      qty: rows.length === 0 ? Math.max(0, itemStock) : 0,
      purchaseRate: defaultPurchaseRate || 0,
      saleRate: defaultSaleRate || 0,
      warehouseId: defaultWarehouseId,
    };
    onChange([...rows, nextBatch]);
  };

  const handleUpdateRow = (id: string, patch: Partial<BatchDraftRow>) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleRemoveRow = (id: string) => {
    onChange(rows.filter((r) => r.id !== id));
  };

  const handleAutoGenerateBatchNo = (id: string, idx: number) => {
    const stamp = `${new Date().getFullYear().toString().slice(-2)}${String(
      new Date().getMonth() + 1
    ).padStart(2, '0')}`;
    const gen = `BAT-${stamp}-${String(idx + 1).padStart(3, '0')}`;
    handleUpdateRow(id, { batchNumber: gen });
  };

  const qtyMismatch =
    rows.length > 0 && Math.abs(validation.totalBatchQty - (Number(itemStock) || 0)) > 0.001;

  return (
    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h3 className="text-[11px] font-bold text-slate-900 dark:text-white">
              Batch Numbers, Manufacturing &amp; Expiry Tracking
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {enableBatchTracking || enableExpiryTracking
                ? 'Active batch & expiry ledger tracking enabled — track multiple lot expiry dates & stock'
                : 'Optional batch lots with Manufacturing Date (Mfg) and Expiry Date validation'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rows.length > 0 && (
            <span className="text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
              Batch Qty Sum: {validation.totalBatchQty} {unit}
            </span>
          )}
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Batch Lot</span>
          </button>
        </div>
      </div>

      {validation.globalError && (
        <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{validation.globalError}</span>
        </div>
      )}

      {qtyMismatch && onSyncStockToBatches && (
        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-800 dark:text-amber-300">
          <span>
            Batch total ({validation.totalBatchQty} {unit}) differs from Item Current Stock ({itemStock} {unit}).
          </span>
          <button
            type="button"
            onClick={() => onSyncStockToBatches(validation.totalBatchQty)}
            className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] cursor-pointer"
          >
            Sync Current Stock to {validation.totalBatchQty} {unit}
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="p-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 text-center space-y-1.5">
          <Calendar className="w-5 h-5 text-slate-400 mx-auto" />
          <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
            No batch lots added yet. Click &quot;Add Batch Lot&quot; to record Batch #, Mfg Date &amp; Expiry Date.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, idx) => {
            const rowErrors = validation.errorsByRowId[row.id] || [];
            const expiryInfo = getBatchExpiryStatus(row.expiryDate, expiryWarningDays);

            return (
              <div
                key={row.id}
                className={`p-3 rounded-lg border bg-white dark:bg-slate-900 space-y-2 ${
                  rowErrors.length > 0
                    ? 'border-rose-400 dark:border-rose-700'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-slate-500">
                      LOT #{idx + 1}
                    </span>
                    {expiryInfo.status === 'Expired' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                        <AlertCircle className="w-3 h-3" />
                        Expired ({Math.abs(expiryInfo.daysLeft || 0)}d ago)
                      </span>
                    )}
                    {expiryInfo.status === 'Expiring Soon' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        <Clock className="w-3 h-3" />
                        Expiring in {expiryInfo.daysLeft}d
                      </span>
                    )}
                    {expiryInfo.status === 'Healthy' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Valid ({expiryInfo.daysLeft}d left)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(row.id)}
                    title="Remove batch row"
                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                  <div className="col-span-2 sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                        Batch Number *
                      </label>
                      <button
                        type="button"
                        onClick={() => handleAutoGenerateBatchNo(row.id, idx)}
                        className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        Auto
                      </button>
                    </div>
                    <input
                      type="text"
                      value={row.batchNumber}
                      onChange={(e) => handleUpdateRow(row.id, { batchNumber: e.target.value })}
                      placeholder="e.g. BAT-2611-01"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 font-mono text-[11px] font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Mfg Date
                    </label>
                    <input
                      type="date"
                      value={row.mfgDate}
                      onChange={(e) => handleUpdateRow(row.id, { mfgDate: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-[11px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Expiry Date {enableExpiryTracking ? '*' : ''}
                    </label>
                    <input
                      type="date"
                      value={row.expiryDate}
                      min={row.mfgDate || undefined}
                      onChange={(e) => handleUpdateRow(row.id, { expiryDate: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-[11px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Lot Qty ({unit})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.qty}
                      onChange={(e) => handleUpdateRow(row.id, { qty: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-[11px] font-bold tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Warehouse
                    </label>
                    <select
                      value={row.warehouseId || defaultWarehouseId}
                      onChange={(e) => handleUpdateRow(row.id, { warehouseId: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-[11px]"
                    >
                      {godowns.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {rowErrors.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                    {rowErrors.map((err, i) => (
                      <span key={i} className="inline-flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {err}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
