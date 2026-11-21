import React, { useState } from 'react';
import { Package, Plus, Trash2, Barcode } from 'lucide-react';
import { BusinessSettingsBundle, CustomFieldDefinition, CustomFieldType } from '../../types';
import { SettingsCard, ToggleSwitch, ReadOnlyBanner } from './SettingsUi';

interface ItemSettingsPanelProps {
  draft: BusinessSettingsBundle;
  setDraft: React.Dispatch<React.SetStateAction<BusinessSettingsBundle>>;
  canEdit: boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const FIELD_TYPES: CustomFieldType[] = ['Text', 'Number', 'Date', 'Dropdown', 'Email', 'Phone', 'URL'];

export const ItemSettingsPanel: React.FC<ItemSettingsPanelProps> = ({
  draft,
  setDraft,
  canEdit,
  showToast,
}) => {
  const it = draft.item;
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitCode, setNewUnitCode] = useState('');
  const [newCatName, setNewCatName] = useState('');

  const updateItemCfg = <K extends keyof BusinessSettingsBundle['item']>(
    key: K,
    val: BusinessSettingsBundle['item'][K]
  ) => {
    setDraft((prev) => {
      const nextAccounting =
        key === 'stockValuationMethod'
          ? {
              ...prev.accounting,
              profitControl: {
                costingMethod:
                  val === 'Purchase Price'
                    ? ('Last Purchase Price' as const)
                    : (val as 'Weighted Average' | 'FIFO'),
                defaultDiscountType: prev.accounting.profitControl?.defaultDiscountType ?? 'percent',
                maxDiscountPercent: prev.accounting.profitControl?.maxDiscountPercent ?? 15,
                minProfitMarginPercent: prev.accounting.profitControl?.minProfitMarginPercent ?? 3,
                targetProfitMarginPercent: prev.accounting.profitControl?.targetProfitMarginPercent ?? 18,
                allowLossMakingSales: prev.accounting.profitControl?.allowLossMakingSales ?? true,
                requireAdminPinForLoss: prev.accounting.profitControl?.requireAdminPinForLoss ?? true,
                adminApprovalPin: prev.accounting.profitControl?.adminApprovalPin ?? '1234',
                gstBasisForProfit: prev.accounting.profitControl?.gstBasisForProfit ?? 'Exclude Creditable GST',
                includeExpensesInNetProfit: prev.accounting.profitControl?.includeExpensesInNetProfit ?? true,
              },
            }
          : prev.accounting;

      return {
        ...prev,
        item: { ...prev.item, [key]: val },
        accounting: nextAccounting,
      };
    });
  };

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!newUnitName.trim() || !newUnitCode.trim()) {
      showToast('Enter unit name and short code.', 'warning');
      return;
    }
    const cleanCode = newUnitCode.trim().toUpperCase();
    if (it.units.some((u) => u.shortCode.toUpperCase() === cleanCode)) {
      showToast(`Unit "${cleanCode}" already exists.`, 'warning');
      return;
    }
    updateItemCfg('units', [
      ...it.units,
      { id: `u-${Date.now()}`, name: newUnitName.trim(), shortCode: cleanCode, baseFactor: 1 },
    ]);
    setNewUnitName('');
    setNewUnitCode('');
  };

  const handleDeleteUnit = (id: string) => {
    if (!canEdit || it.units.length <= 1) return;
    updateItemCfg(
      'units',
      it.units.filter((u) => u.id !== id)
    );
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !newCatName.trim()) return;
    if (it.categories.some((c) => c.name.toLowerCase() === newCatName.trim().toLowerCase())) {
      showToast('Category already exists.', 'warning');
      return;
    }
    updateItemCfg('categories', [
      ...it.categories,
      { id: `cat-${Date.now()}`, name: newCatName.trim(), subCategories: [] },
    ]);
    setNewCatName('');
  };

  const handleDeleteCategory = (id: string) => {
    if (!canEdit || it.categories.length <= 1) return;
    updateItemCfg(
      'categories',
      it.categories.filter((c) => c.id !== id)
    );
  };

  const updateAdditionalField = (idx: number, patch: Partial<CustomFieldDefinition>) => {
    setDraft((prev) => ({
      ...prev,
      item: {
        ...prev.item,
        additionalFields: prev.item.additionalFields.map((f, i) =>
          i === idx ? { ...f, ...patch } : f
        ),
      },
    }));
  };

  const inputClass =
    'w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-100';

  return (
    <div className="space-y-5">
      {!canEdit && <ReadOnlyBanner categoryLabel="Item" />}

      {/* 1. Creation Defaults & Pricing Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SettingsCard
          title="Product Defaults & Pricing Rules"
          subtitle="Defaults pre-filled whenever staff add a new product or service"
          rightSlot={<Package className="w-4 h-4 text-blue-600" />}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Item Type
              </label>
              <select
                value={it.defaultItemType}
                disabled={!canEdit}
                onChange={(e) =>
                  updateItemCfg('defaultItemType', e.target.value as 'Product' | 'Service')
                }
                className={inputClass}
              >
                <option value="Product">Physical Product</option>
                <option value="Service">Service / Non-Inventory</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Unit
              </label>
              <select
                value={it.defaultUnit}
                disabled={!canEdit}
                onChange={(e) => updateItemCfg('defaultUnit', e.target.value)}
                className={inputClass}
              >
                {it.units.map((u) => (
                  <option key={u.id} value={u.shortCode}>
                    {u.shortCode} ({u.name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Category
              </label>
              <select
                value={it.defaultCategory}
                disabled={!canEdit}
                onChange={(e) => updateItemCfg('defaultCategory', e.target.value)}
                className={inputClass}
              >
                {it.categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default GST Tax Rate (%)
              </label>
              <select
                value={it.defaultTaxRate}
                disabled={!canEdit}
                onChange={(e) => updateItemCfg('defaultTaxRate', Number(e.target.value))}
                className={inputClass}
              >
                <option value={0}>0% (Exempt)</option>
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18%</option>
                <option value={28}>28%</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Low Stock Alert Qty
              </label>
              <input
                type="number"
                min={0}
                value={it.defaultMinStockAlert}
                disabled={!canEdit}
                onChange={(e) => updateItemCfg('defaultMinStockAlert', Math.max(0, Number(e.target.value)))}
                className={`${inputClass} tabular-nums`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Price Tax Mode
              </label>
              <select
                value={it.priceTaxMode}
                disabled={!canEdit}
                onChange={(e) => updateItemCfg('priceTaxMode', e.target.value as 'Inclusive' | 'Exclusive')}
                className={inputClass}
              >
                <option value="Exclusive">Exclusive of GST</option>
                <option value="Inclusive">Inclusive of GST</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
            <ToggleSwitch
              checked={it.enableWholesalePricing}
              onChange={(v) => updateItemCfg('enableWholesalePricing', v)}
              disabled={!canEdit}
              label="Enable Wholesale Pricing Tier"
            />
            <ToggleSwitch
              checked={it.enableMrpValidation}
              onChange={(v) => updateItemCfg('enableMrpValidation', v)}
              disabled={!canEdit}
              label="Validate Selling Price Against MRP"
            />
          </div>
        </SettingsCard>

        {/* 2. Barcode & Inventory Tracking */}
        <SettingsCard
          title="Barcode, Batch, Expiry & Inventory Rules"
          subtitle="Barcode generator rules, negative stock guards & valuation"
          rightSlot={<Barcode className="w-4 h-4 text-blue-600" />}
        >
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Barcode Format
              </label>
              <select
                value={it.barcodeFormat}
                disabled={!canEdit}
                onChange={(e) =>
                  updateItemCfg(
                    'barcodeFormat',
                    e.target.value as BusinessSettingsBundle['item']['barcodeFormat']
                  )
                }
                className={inputClass}
              >
                <option value="EAN-13">EAN-13</option>
                <option value="Code 128">Code 128</option>
                <option value="EAN-8">EAN-8</option>
                <option value="UPC-A">UPC-A</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sticker Size
              </label>
              <select
                value={it.barcodeLabelSize}
                disabled={!canEdit}
                onChange={(e) =>
                  updateItemCfg(
                    'barcodeLabelSize',
                    e.target.value as BusinessSettingsBundle['item']['barcodeLabelSize']
                  )
                }
                className={inputClass}
              >
                <option value="50x25mm">50x25mm Thermal</option>
                <option value="38x25mm">38x25mm Compact</option>
                <option value="A4 24-Grid">A4 24-Label Grid</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Valuation Method
              </label>
              <select
                value={it.stockValuationMethod}
                disabled={!canEdit}
                onChange={(e) =>
                  updateItemCfg(
                    'stockValuationMethod',
                    e.target.value as BusinessSettingsBundle['item']['stockValuationMethod']
                  )
                }
                className={inputClass}
              >
                <option value="Weighted Average">Weighted Average</option>
                <option value="FIFO">FIFO</option>
                <option value="Purchase Price">Last Purchase Price</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
            <ToggleSwitch
              checked={it.enableBarcodeAutoGen}
              onChange={(v) => updateItemCfg('enableBarcodeAutoGen', v)}
              disabled={!canEdit}
              label="Auto-Generate Unique Barcode on New Product"
            />
            <ToggleSwitch
              checked={it.preventDuplicateBarcode}
              onChange={(v) => updateItemCfg('preventDuplicateBarcode', v)}
              disabled={!canEdit}
              label="Prevent Duplicate Barcodes Across Inventory"
            />
            <ToggleSwitch
              checked={it.enableBatchTracking}
              onChange={(v) => updateItemCfg('enableBatchTracking', v)}
              disabled={!canEdit}
              label="Enable Batch & Lot Number Tracking"
            />
            <ToggleSwitch
              checked={it.enableExpiryTracking}
              onChange={(v) => updateItemCfg('enableExpiryTracking', v)}
              disabled={!canEdit}
              label={`Track Expiry Dates (Warn ${it.expiryWarningDays} days ahead)`}
            />
          </div>
        </SettingsCard>
      </div>

      {/* 3. Unit Manager & Category Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SettingsCard title="Unit Settings (PCS, KG, BOX, LTR)" subtitle="Manage available measurement units">
          <form onSubmit={handleAddUnit} className="grid grid-cols-12 gap-2">
            <input
              type="text"
              value={newUnitName}
              disabled={!canEdit}
              onChange={(e) => setNewUnitName(e.target.value)}
              placeholder="Unit Name (e.g. Carton)"
              className={`${inputClass} col-span-6`}
            />
            <input
              type="text"
              value={newUnitCode}
              disabled={!canEdit}
              onChange={(e) => setNewUnitCode(e.target.value.toUpperCase())}
              placeholder="Code (CTN)"
              className={`${inputClass} col-span-4 font-mono uppercase`}
            />
            <button
              type="submit"
              disabled={!canEdit}
              className="col-span-2 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg max-h-48 overflow-y-auto">
            {it.units.map((u) => (
              <div key={u.id} className="px-3 py-2 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{u.shortCode}</span>
                  <span className="text-slate-500 ml-2">{u.name}</span>
                </div>
                {canEdit && it.units.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteUnit(u.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </SettingsCard>

        <SettingsCard title="Item Category Manager" subtitle="Manage product categories for forms & reporting">
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              type="text"
              value={newCatName}
              disabled={!canEdit}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="New Category (e.g. Beverages)"
              className={inputClass}
            />
            <button
              type="submit"
              disabled={!canEdit}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white text-xs font-semibold shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg max-h-48 overflow-y-auto">
            {it.categories.map((c) => (
              <div key={c.id} className="px-3 py-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900 dark:text-white">{c.name}</span>
                {canEdit && it.categories.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(c.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </SettingsCard>
      </div>

      {/* 4. Item Additional Fields */}
      <SettingsCard
        title="Item Additional Fields (Custom Fields)"
        subtitle="Enable custom fields on Add/Edit Product forms & printed documents"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {it.additionalFields.map((field, idx) => (
            <div
              key={field.id}
              className={`p-3 rounded-xl border ${
                field.enabled
                  ? 'border-blue-200 dark:border-blue-900/60 bg-blue-50/25 dark:bg-blue-950/15'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={field.enabled}
                    disabled={!canEdit}
                    onChange={(e) => updateAdditionalField(idx, { enabled: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>{field.name || `Item Field ${idx + 1}`}</span>
                </label>
                <div className="flex items-center gap-2.5 text-[11px]">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.required}
                      disabled={!canEdit || !field.enabled}
                      onChange={(e) => updateAdditionalField(idx, { required: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span>Req.</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-blue-700 dark:text-blue-400 font-semibold">
                    <input
                      type="checkbox"
                      checked={field.showInPrint}
                      disabled={!canEdit || !field.enabled}
                      onChange={(e) => updateAdditionalField(idx, { showInPrint: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span>Show in Print</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={field.name}
                  disabled={!canEdit}
                  onChange={(e) => updateAdditionalField(idx, { name: e.target.value })}
                  className={inputClass}
                />
                <select
                  value={field.fieldType}
                  disabled={!canEdit}
                  onChange={(e) =>
                    updateAdditionalField(idx, { fieldType: e.target.value as CustomFieldType })
                  }
                  className={inputClass}
                >
                  {FIELD_TYPES.map((ft) => (
                    <option key={ft} value={ft}>
                      {ft}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
};
