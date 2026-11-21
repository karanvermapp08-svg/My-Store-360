import React from 'react';
import { Printer, FileText } from 'lucide-react';
import {
  BusinessSettingsBundle,
  CompanyProfile,
  InvoiceTemplateType,
  PrintableDocumentType,
  PrintSettingsConfig,
} from '../../types';
import { SettingsCard, ToggleSwitch, ReadOnlyBanner } from './SettingsUi';

interface PrintSettingsPanelProps {
  draft: BusinessSettingsBundle;
  setDraft: React.Dispatch<React.SetStateAction<BusinessSettingsBundle>>;
  companyDraft: CompanyProfile;
  canEdit: boolean;
}

const PRINT_DOC_TYPES: PrintableDocumentType[] = [
  'Sales Invoice',
  'Purchase Bill',
  'Estimate / Quotation',
  'Sales Order',
  'Delivery Challan',
  'Payment Receipt',
  'Payment Out',
  'Sales Return',
  'Purchase Return',
  'Credit Note',
  'Debit Note',
];

export const PrintSettingsPanel: React.FC<PrintSettingsPanelProps> = ({
  draft,
  setDraft,
  companyDraft,
  canEdit,
}) => {
  const p = draft.print;

  const updatePrint = <K extends keyof PrintSettingsConfig>(
    key: K,
    val: PrintSettingsConfig[K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      print: { ...prev.print, [key]: val },
    }));
  };

  const updateDocTitle = (docType: PrintableDocumentType, title: string) => {
    setDraft((prev) => ({
      ...prev,
      print: {
        ...prev.print,
        documentTitles: { ...prev.print.documentTitles, [docType]: title },
      },
    }));
  };

  const activeDocTitle =
    p.documentTitles?.[p.activeDocumentType] || p.activeDocumentType.toUpperCase();

  const enabledPartyPrintFields = draft.party.additionalFields.filter(
    (f) => f.enabled && f.showInPrint
  );

  const inputClass =
    'w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-100';

  return (
    <div className="space-y-5">
      {!canEdit && <ReadOnlyBanner categoryLabel="Print" />}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left 7 Cols: Print Controls */}
        <div className="xl:col-span-7 space-y-5">
          <SettingsCard
            title="Page Layout & Paper Format"
            subtitle="Configure default paper size, template style, margins & typography for PDF/Print"
            rightSlot={<Printer className="w-4 h-4 text-blue-600" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Document Type Being Configured
                </label>
                <select
                  value={p.activeDocumentType}
                  onChange={(e) =>
                    updatePrint('activeDocumentType', e.target.value as PrintableDocumentType)
                  }
                  className={inputClass}
                >
                  {PRINT_DOC_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Printed Document Title
                </label>
                <input
                  type="text"
                  value={activeDocTitle}
                  disabled={!canEdit}
                  onChange={(e) => updateDocTitle(p.activeDocumentType, e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Invoice Layout Template
                </label>
                <select
                  value={p.defaultTemplate}
                  disabled={!canEdit}
                  onChange={(e) => updatePrint('defaultTemplate', e.target.value as InvoiceTemplateType)}
                  className={inputClass}
                >
                  <option value="gst-tax-invoice">GST Tax Invoice (Official)</option>
                  <option value="modern">Modern Business</option>
                  <option value="classic">Minimalist Classic</option>
                  <option value="thermal-3">POS Thermal 80mm</option>
                  <option value="thermal-2">POS Thermal 58mm</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Page Size
                </label>
                <select
                  value={p.pageSize}
                  disabled={!canEdit}
                  onChange={(e) =>
                    updatePrint('pageSize', e.target.value as PrintSettingsConfig['pageSize'])
                  }
                  className={inputClass}
                >
                  <option value="A4 Portrait">A4 Portrait</option>
                  <option value="A4 Landscape">A4 Landscape</option>
                  <option value="A5">A5 Half-Page</option>
                  <option value="Thermal 80mm">Thermal 80mm (3&quot;)</option>
                  <option value="Thermal 58mm">Thermal 58mm (2&quot;)</option>
                  <option value="Custom">Custom Size</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Margins (mm)
                </label>
                <input
                  type="number"
                  min={4}
                  max={30}
                  value={p.marginMm}
                  disabled={!canEdit}
                  onChange={(e) => updatePrint('marginMm', Number(e.target.value))}
                  className={`${inputClass} tabular-nums`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Font Size (pt)
                </label>
                <input
                  type="number"
                  min={7}
                  max={14}
                  value={p.fontSizePt}
                  disabled={!canEdit}
                  onChange={(e) => updatePrint('fontSizePt', Number(e.target.value))}
                  className={`${inputClass} tabular-nums`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Row Spacing
                </label>
                <select
                  value={p.tableRowSpacing}
                  disabled={!canEdit}
                  onChange={(e) =>
                    updatePrint('tableRowSpacing', e.target.value as PrintSettingsConfig['tableRowSpacing'])
                  }
                  className={inputClass}
                >
                  <option value="Compact">Compact</option>
                  <option value="Standard">Standard</option>
                  <option value="Relaxed">Relaxed</option>
                </select>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Header Branding & Company Info"
            subtitle="Choose which store details and notes appear on printed documents"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              <ToggleSwitch checked={p.showLogo} onChange={(v) => updatePrint('showLogo', v)} disabled={!canEdit} label="Show Business Logo" />
              <ToggleSwitch checked={p.showBusinessName} onChange={(v) => updatePrint('showBusinessName', v)} disabled={!canEdit} label="Show Business Name" />
              <ToggleSwitch checked={p.showBusinessAddress} onChange={(v) => updatePrint('showBusinessAddress', v)} disabled={!canEdit} label="Show Business Address" />
              <ToggleSwitch checked={p.showContactInfo} onChange={(v) => updatePrint('showContactInfo', v)} disabled={!canEdit} label="Show Phone & Email" />
              <ToggleSwitch checked={p.showGstin} onChange={(v) => updatePrint('showGstin', v)} disabled={!canEdit} label="Show Business GSTIN" />
              <ToggleSwitch checked={p.showPan} onChange={(v) => updatePrint('showPan', v)} disabled={!canEdit} label="Show PAN Number" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Custom Header Tagline
                </label>
                <input
                  type="text"
                  value={p.customHeaderNote}
                  disabled={!canEdit}
                  onChange={(e) => updatePrint('customHeaderNote', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Custom Footer Message
                </label>
                <input
                  type="text"
                  value={p.customFooterNote}
                  disabled={!canEdit}
                  onChange={(e) => updatePrint('customFooterNote', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Item Table Columns & Print Behavior"
            subtitle="Toggle item table columns, party details, signatures & Delivery Challan price visibility"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {(
                [
                  { k: 'showSerialNo', label: 'Sr. No.' },
                  { k: 'showItemName', label: 'Item Name' },
                  { k: 'showItemDescription', label: 'Description' },
                  { k: 'showBarcode', label: 'Barcode' },
                  { k: 'showHsnSac', label: 'HSN / SAC' },
                  { k: 'showQty', label: 'Quantity' },
                  { k: 'showUnit', label: 'Unit' },
                  { k: 'showFreeQty', label: 'Free Qty' },
                  { k: 'showRate', label: 'Unit Rate' },
                  { k: 'showDiscountCol', label: 'Discount' },
                  { k: 'showTaxableValue', label: 'Taxable Value' },
                  { k: 'showGstPercent', label: 'GST %' },
                  { k: 'showCgst', label: 'CGST' },
                  { k: 'showSgst', label: 'SGST' },
                  { k: 'showIgst', label: 'IGST' },
                  { k: 'showAmount', label: 'Line Amount' },
                ] as const
              ).map((col) => (
                <label
                  key={col.k}
                  className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(p[col.k])}
                    disabled={!canEdit}
                    onChange={(e) => updatePrint(col.k, e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="font-medium text-[11px]">{col.label}</span>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 pt-3 border-t border-slate-100 dark:border-slate-800">
              <ToggleSwitch checked={p.showCustomerAddress} onChange={(v) => updatePrint('showCustomerAddress', v)} disabled={!canEdit} label="Print Customer Billing Address" />
              <ToggleSwitch checked={p.showShippingAddress} onChange={(v) => updatePrint('showShippingAddress', v)} disabled={!canEdit} label="Print Shipping / Delivery Address" />
              <ToggleSwitch checked={p.showCustomerGstin} onChange={(v) => updatePrint('showCustomerGstin', v)} disabled={!canEdit} label="Print Customer GSTIN" />
              <ToggleSwitch checked={p.showAuthorizedSignature} onChange={(v) => updatePrint('showAuthorizedSignature', v)} disabled={!canEdit} label="Authorized Signatory Box" />
              <ToggleSwitch checked={p.showQrCode} onChange={(v) => updatePrint('showQrCode', v)} disabled={!canEdit} label="Print UPI Payment / IRN QR Slot" />
              <ToggleSwitch checked={p.showPricesOnChallan} onChange={(v) => updatePrint('showPricesOnChallan', v)} disabled={!canEdit} label="Show Prices on Delivery Challan" />
              <ToggleSwitch checked={p.showAdditionalCustomFields} onChange={(v) => updatePrint('showAdditionalCustomFields', v)} disabled={!canEdit} label="Print Enabled Party & Item Custom Fields" />
              <ToggleSwitch checked={p.autoPrintOnSave} onChange={(v) => updatePrint('autoPrintOnSave', v)} disabled={!canEdit} label="Auto-Open Print Preview After Saving Bill" />
            </div>
          </SettingsCard>
        </div>

        {/* Right 5 Cols: Live Interactive Print Preview */}
        <div className="xl:col-span-5 xl:sticky xl:top-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-bold">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Live Print Preview ({p.pageSize})</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{p.defaultTemplate}</span>
            </div>

            <div className="p-4 bg-slate-100 dark:bg-slate-950 flex justify-center">
              <div
                style={{ fontSize: `${Math.max(8, Math.min(11, p.fontSizePt - 1))}px` }}
                className={`bg-white text-slate-900 border border-slate-300 shadow-sm p-4 space-y-3 transition-all ${
                  p.pageSize.startsWith('Thermal') ? 'w-64 font-mono' : 'w-full'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-300">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {p.showLogo && companyDraft.logoDataUrl && (
                      <img
                        src={companyDraft.logoDataUrl}
                        alt="Logo"
                        className="w-10 h-10 object-contain rounded border border-slate-200 p-0.5 shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      {p.showBusinessName && (
                        <div className="font-extrabold text-sm text-slate-900 truncate">
                          {companyDraft.name || 'MY STORE'}
                        </div>
                      )}
                      {p.showBusinessAddress && (
                        <div className="text-[10px] text-slate-600 line-clamp-2">
                          {companyDraft.address || 'Main Market Road, Bengaluru'}
                        </div>
                      )}
                      {p.showContactInfo && (
                        <div className="text-[10px] text-slate-600">
                          {companyDraft.phone} {p.showWebsiteEmail && companyDraft.email ? `• ${companyDraft.email}` : ''}
                        </div>
                      )}
                      {p.showGstin && (
                        <div className="text-[10px] font-bold text-slate-800">
                          GSTIN: {companyDraft.gstin || '29ABCDE1234F1Z5'}
                          {p.showPan && companyDraft.pan ? ` | PAN: ${companyDraft.pan}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-extrabold text-xs uppercase text-blue-700">{activeDocTitle}</div>
                    <div className="text-[10px] font-mono text-slate-600">#MS-INV-0042</div>
                    {p.showInvoiceDate && <div className="text-[10px] text-slate-500">14/10/2026</div>}
                  </div>
                </div>

                {/* Party & Custom Fields Preview */}
                <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 p-2 rounded border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-500 uppercase text-[9px]">Bill To</div>
                    <div className="font-bold text-slate-900">Ramesh General Traders</div>
                    {p.showCustomerAddress && <div className="text-slate-600">MG Road, Bengaluru</div>}
                    {p.showCustomerGstin && <div className="font-mono text-slate-700">GSTIN: 29XYZAB1234C1Z2</div>}
                  </div>
                  <div>
                    {p.showShippingAddress && (
                      <>
                        <div className="font-bold text-slate-500 uppercase text-[9px]">Ship To</div>
                        <div className="text-slate-600">Warehouse Gate 2, Peenya</div>
                      </>
                    )}
                    {p.showAdditionalCustomFields && enabledPartyPrintFields.length > 0 && (
                      <div className="mt-1 text-[9px] text-blue-800">
                        {enabledPartyPrintFields.slice(0, 2).map((f) => (
                          <div key={f.id}>
                            <strong>{f.name}:</strong> {f.defaultValue || 'Sample'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sample Item Table */}
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      {p.showSerialNo && <th className="py-1 px-1.5 text-left">#</th>}
                      {p.showItemName && <th className="py-1 px-1.5 text-left">Item</th>}
                      {p.showHsnSac && <th className="py-1 px-1 text-center">HSN</th>}
                      {p.showQty && <th className="py-1 px-1 text-right">Qty</th>}
                      {p.showRate && <th className="py-1 px-1 text-right">Rate</th>}
                      {p.showGstPercent && <th className="py-1 px-1 text-right">GST</th>}
                      {p.showAmount && <th className="py-1 px-1.5 text-right">Total</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      {p.showSerialNo && <td className="py-1 px-1.5">1</td>}
                      {p.showItemName && <td className="py-1 px-1.5 font-semibold">Tata Salt 1kg</td>}
                      {p.showHsnSac && <td className="py-1 px-1 text-center font-mono">2501</td>}
                      {p.showQty && <td className="py-1 px-1 text-right tabular-nums">10 {p.showUnit ? 'PKT' : ''}</td>}
                      {p.showRate && <td className="py-1 px-1 text-right tabular-nums">₹24.00</td>}
                      {p.showGstPercent && <td className="py-1 px-1 text-right tabular-nums">0%</td>}
                      {p.showAmount && <td className="py-1 px-1.5 text-right font-bold tabular-nums">₹240.00</td>}
                    </tr>
                  </tbody>
                </table>

                {/* Footer */}
                <div className="flex items-end justify-between pt-2 border-t border-slate-200 text-[10px]">
                  <div className="text-slate-500 max-w-[55%]">
                    {p.showTermsAndConditions && <div>Subject to Bengaluru jurisdiction.</div>}
                    <div className="font-semibold text-slate-700 mt-0.5">{p.customFooterNote}</div>
                  </div>
                  {p.showAuthorizedSignature && (
                    <div className="text-right">
                      <div className="h-5" />
                      <div className="border-t border-slate-400 pt-0.5 font-bold text-slate-800">
                        Authorized Signatory
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
