import React, { useState } from 'react';
import {
  Scale,
  Plus,
  Download,
  Trash2,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { safeGetStoredData, safeSetStoredData } from '../utils/storage';

interface UnitItem {
  code: string;
  name: string;
  precision: number;
  conversionNote?: string;
}

const DEFAULT_UNITS: UnitItem[] = [
  { code: 'PCS', name: 'Pieces', precision: 0, conversionNote: '1 PCS = 1 unit' },
  { code: 'KG', name: 'Kilograms', precision: 3, conversionNote: '1 KG = 1000 G' },
  { code: 'GM', name: 'Grams', precision: 2, conversionNote: '1000 G = 1 KG' },
  { code: 'LTR', name: 'Litres', precision: 3, conversionNote: '1 L = 1000 ML' },
  { code: 'ML', name: 'Millilitres', precision: 0, conversionNote: '1000 ML = 1 L' },
  { code: 'MTR', name: 'Metres', precision: 2, conversionNote: '1 MTR = 100 CM' },
  { code: 'QTL', name: 'Quintal (100 kg)', precision: 2, conversionNote: '1 QTL = 100 KG' },
  { code: 'PKT', name: 'Packets', precision: 0, conversionNote: '24 PKT = 1 CTN' },
  { code: 'BOX', name: 'Box', precision: 0, conversionNote: '1 BOX = 12 PCS' },
  { code: 'DOZ', name: 'Dozens', precision: 0, conversionNote: '1 DOZ = 12 PCS' },
  { code: 'CTN', name: 'Carton', precision: 0, conversionNote: '1 CTN = 24 PKT' },
  { code: 'BDL', name: 'Bundle', precision: 0, conversionNote: 'Multi-pack bundle' },
  { code: 'BTL', name: 'Bottles', precision: 0, conversionNote: '1 BTL = 1 unit' },
  { code: 'SET', name: 'Sets', precision: 0, conversionNote: '1 SET = 1 unit' },
];

export const UnitsView: React.FC = () => {
  const {
    items,
    showToast,
    exportCurrentViewPdf,
    requestConfirmation,
    businessSettings,
    updateBusinessSettingsSection,
  } = useVyapar();

  const [units, setUnits] = useState<UnitItem[]>(() => {
    const saved = safeGetStoredData<UnitItem[]>('bm360_item_units', []);
    if (saved.length > 0) return saved;
    const fromSettings = (businessSettings?.item?.units || []).map((u) => ({
      code: u.shortCode.toUpperCase(),
      name: u.name,
      precision: 0,
    }));
    const merged = [...DEFAULT_UNITS];
    fromSettings.forEach((su) => {
      if (!merged.some((m) => m.code === su.code)) merged.push(su);
    });
    return merged;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [precision, setPrecision] = useState('0');

  const persistUnits = (next: UnitItem[]) => {
    setUnits(next);
    safeSetStoredData('bm360_item_units', next);
    updateBusinessSettingsSection(
      'item',
      'item',
      {
        units: next.map((u, idx) => ({
          id: `unit-${idx}-${u.code.toLowerCase()}`,
          name: u.name,
          shortCode: u.code,
          isDefault: idx === 0,
        })),
      },
      'Updated Units of Measurement from Units Master'
    );
  };

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    const normCode = code.trim().toUpperCase();
    if (units.some((u) => u.code.toUpperCase() === normCode)) {
      showToast('Unit code already exists', 'warning');
      return;
    }
    persistUnits([...units, { code: normCode, name: name.trim(), precision: parseInt(precision, 10) || 0 }]);
    setCode('');
    setName('');
    setPrecision('0');
    setIsModalOpen(false);
    showToast(`Unit of measurement ${normCode} added and synced.`, 'success');
  };

  const handleDeleteUnit = (u: UnitItem) => {
    requestConfirmation({
      title: 'Delete Unit of Measurement',
      message: `Remove unit "${u.code} (${u.name})"? Existing product rows using this unit will keep their current code.`,
      confirmLabel: 'Delete Unit',
      variant: 'danger',
      onConfirm: () => {
        persistUnits(units.filter((x) => x.code !== u.code));
        showToast(`Unit ${u.code} removed.`, 'info');
      },
    });
  };

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-slate-950 flex flex-col overflow-hidden select-none text-xs text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
            <Scale className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">
              Units of Measurement (UOM) ({units.length})
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Configure standard units of measurement, decimal precision, and packaging denominations synced with Item Settings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportCurrentViewPdf({ title: 'Units of Measurement' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Unit</span>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {units.map((u) => {
          const count = items.filter((i) => (i.unit || '').toUpperCase() === u.code.toUpperCase()).length;
          return (
            <div
              key={u.code}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs space-y-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-sm text-indigo-700 dark:text-indigo-400">{u.code}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                    {u.precision} Decimals
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteUnit(u)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    title={`Delete ${u.code}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="font-semibold text-slate-900 dark:text-white text-xs">{u.name}</div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Used in:</span>
                <strong className="text-slate-800 dark:text-slate-200 tabular-nums">{count} Items</strong>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">Add Unit of Measurement</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleAddUnit} className="p-5 space-y-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Unit Code (Short) *</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  placeholder="e.g. ROLL, BUNDLE"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Formal Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Rolls, Bundles"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Decimal Places</label>
                <select
                  value={precision}
                  onChange={(e) => setPrecision(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-950"
                >
                  <option value="0">0 (Whole numbers e.g. 1, 2, 3)</option>
                  <option value="2">2 (Decimals e.g. 1.25, 2.50)</option>
                  <option value="3">3 (High Precision e.g. 1.250)</option>
                </select>
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
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs cursor-pointer"
                >
                  Save Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
