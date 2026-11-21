import React from 'react';
import { Hash, RotateCcw } from 'lucide-react';
import { BusinessSettingsBundle, InvoiceNumberSequenceConfig } from '../../types';
import { SettingsCard, ToggleSwitch, ReadOnlyBanner } from './SettingsUi';

interface TransactionSettingsPanelProps {
  draft: BusinessSettingsBundle;
  setDraft: React.Dispatch<React.SetStateAction<BusinessSettingsBundle>>;
  canEdit: boolean;
}

export const TransactionSettingsPanel: React.FC<TransactionSettingsPanelProps> = ({
  draft,
  setDraft,
  canEdit,
}) => {
  const tx = draft.transaction;
  const fySegment = (draft.general.financialYearLabel || 'FY26-27').replace(/\s+/g, '');

  const formatPreview = (seq: InvoiceNumberSequenceConfig) => {
    const padded = String(Math.max(1, seq.nextNumber)).padStart(Math.max(1, seq.digits), '0');
    const fyPart = seq.useFinancialYear ? `${fySegment}/` : '';
    return `${seq.prefix}${fyPart}${padded}${seq.suffix || ''}`;
  };

  const updateSequence = (idx: number, patch: Partial<InvoiceNumberSequenceConfig>) => {
    setDraft((prev) => ({
      ...prev,
      transaction: {
        ...prev.transaction,
        sequences: prev.transaction.sequences.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
      },
    }));
  };

  const updateSales = <K extends keyof BusinessSettingsBundle['transaction']['sales']>(
    key: K,
    val: BusinessSettingsBundle['transaction']['sales'][K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      transaction: { ...prev.transaction, sales: { ...prev.transaction.sales, [key]: val } },
    }));
  };

  const updatePurchase = <K extends keyof BusinessSettingsBundle['transaction']['purchase']>(
    key: K,
    val: BusinessSettingsBundle['transaction']['purchase'][K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      transaction: { ...prev.transaction, purchase: { ...prev.transaction.purchase, [key]: val } },
    }));
  };

  const updatePayment = <K extends keyof BusinessSettingsBundle['transaction']['payment']>(
    key: K,
    val: BusinessSettingsBundle['transaction']['payment'][K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      transaction: { ...prev.transaction, payment: { ...prev.transaction.payment, [key]: val } },
    }));
  };

  const updateSalesReturn = <K extends keyof BusinessSettingsBundle['transaction']['salesReturn']>(
    key: K,
    val: BusinessSettingsBundle['transaction']['salesReturn'][K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      transaction: {
        ...prev.transaction,
        salesReturn: { ...prev.transaction.salesReturn, [key]: val },
      },
    }));
  };

  const updatePurchaseReturn = <K extends keyof BusinessSettingsBundle['transaction']['purchaseReturn']>(
    key: K,
    val: BusinessSettingsBundle['transaction']['purchaseReturn'][K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      transaction: {
        ...prev.transaction,
        purchaseReturn: { ...prev.transaction.purchaseReturn, [key]: val },
      },
    }));
  };

  const updateBehaviour = <K extends keyof BusinessSettingsBundle['transaction']['behaviour']>(
    key: K,
    val: BusinessSettingsBundle['transaction']['behaviour'][K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      transaction: { ...prev.transaction, behaviour: { ...prev.transaction.behaviour, [key]: val } },
    }));
  };

  const inputClass =
    'w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-100 disabled:text-slate-500';

  const resetFinancialYearCounters = () => {
    if (!canEdit) return;
    setDraft((prev) => ({
      ...prev,
      transaction: {
        ...prev.transaction,
        sequences: prev.transaction.sequences.map((s) => ({
          ...s,
          nextNumber: s.startNumber || 1,
        })),
      },
    }));
  };

  return (
    <div className="space-y-5">
      {!canEdit && <ReadOnlyBanner categoryLabel="Transaction" />}

      {/* 1. Document Numbering Sequences */}
      <SettingsCard
        title="Document Numbering & Prefixes"
        subtitle="Configure prefixes, starting numbers, zero-padding, FY tags & duplicate protection for all 11 voucher types"
        rightSlot={
          <button
            type="button"
            disabled={!canEdit}
            onClick={resetFinancialYearCounters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-[11px] font-semibold disabled:opacity-45 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span>Reset All Counters to Start</span>
          </button>
        }
      >
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase">
                <th className="py-2 pr-3">Document Type</th>
                <th className="py-2 px-2">Prefix</th>
                <th className="py-2 px-2 w-20">Start #</th>
                <th className="py-2 px-2 w-20">Next #</th>
                <th className="py-2 px-2 w-20">Suffix</th>
                <th className="py-2 px-2 w-16">Digits</th>
                <th className="py-2 px-2 text-center">Incl. FY</th>
                <th className="py-2 px-2 text-center">Auto</th>
                <th className="py-2 px-2 text-center">No Dup.</th>
                <th className="py-2 pl-2">Live Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tx.sequences.map((seq, idx) => (
                <tr key={seq.docType} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 pr-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>{seq.docType}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={seq.prefix}
                      disabled={!canEdit}
                      onChange={(e) => updateSequence(idx, { prefix: e.target.value })}
                      className={`${inputClass} font-mono min-w-[82px]`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min={1}
                      value={seq.startNumber}
                      disabled={!canEdit}
                      onChange={(e) => updateSequence(idx, { startNumber: Math.max(1, Number(e.target.value)) })}
                      className={`${inputClass} tabular-nums font-mono`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min={1}
                      value={seq.nextNumber}
                      disabled={!canEdit}
                      onChange={(e) => updateSequence(idx, { nextNumber: Math.max(1, Number(e.target.value)) })}
                      className={`${inputClass} tabular-nums font-mono font-bold`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={seq.suffix}
                      disabled={!canEdit}
                      onChange={(e) => updateSequence(idx, { suffix: e.target.value })}
                      placeholder="Optional"
                      className={`${inputClass} font-mono`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={seq.digits}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateSequence(idx, { digits: Math.min(8, Math.max(1, Number(e.target.value))) })
                      }
                      className={`${inputClass} tabular-nums text-center`}
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={seq.useFinancialYear}
                      disabled={!canEdit}
                      onChange={(e) => updateSequence(idx, { useFinancialYear: e.target.checked })}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={seq.autoNumbering}
                      disabled={!canEdit}
                      onChange={(e) => updateSequence(idx, { autoNumbering: e.target.checked })}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={seq.preventDuplicate}
                      disabled={!canEdit}
                      onChange={(e) => updateSequence(idx, { preventDuplicate: e.target.checked })}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                  </td>
                  <td className="py-2 pl-2 font-mono font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap tabular-nums">
                    {formatPreview(seq)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>

      {/* 2. Sales & Purchase Defaults */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SettingsCard
          title="Sales Billing Preferences"
          subtitle="Default billing mode, discounts, round-off & invoice terms"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Transaction Type
              </label>
              <select
                value={tx.sales.defaultTransactionType}
                disabled={!canEdit}
                onChange={(e) =>
                  updateSales('defaultTransactionType', e.target.value as 'Cash' | 'Credit' | 'POS')
                }
                className={inputClass}
              >
                <option value="Cash">Cash</option>
                <option value="Credit">Credit</option>
                <option value="POS">POS Counter</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Sale Price Mode
              </label>
              <select
                value={tx.sales.defaultSalePriceMode}
                disabled={!canEdit}
                onChange={(e) =>
                  updateSales('defaultSalePriceMode', e.target.value as 'Retail' | 'Wholesale' | 'MRP')
                }
                className={inputClass}
              >
                <option value="Retail">Retail Rate</option>
                <option value="Wholesale">Wholesale Rate</option>
                <option value="MRP">MRP</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tax Mode
              </label>
              <select
                value={tx.sales.taxMode}
                disabled={!canEdit}
                onChange={(e) => updateSales('taxMode', e.target.value as 'Exclusive' | 'Inclusive')}
                className={inputClass}
              >
                <option value="Exclusive">Exclusive (+ GST)</option>
                <option value="Inclusive">Inclusive of GST</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Due Days
              </label>
              <input
                type="number"
                min={0}
                value={tx.sales.defaultDueDays}
                disabled={!canEdit}
                onChange={(e) => updateSales('defaultDueDays', Math.max(0, Number(e.target.value)))}
                className={`${inputClass} tabular-nums`}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
            <ToggleSwitch
              checked={tx.sales.enableRoundOff}
              onChange={(v) => updateSales('enableRoundOff', v)}
              disabled={!canEdit}
              label="Auto Round-Off Invoice Total"
            />
            <ToggleSwitch
              checked={tx.sales.enableLineDiscount}
              onChange={(v) => updateSales('enableLineDiscount', v)}
              disabled={!canEdit}
              label="Enable Item-Level Discount Column"
            />
            <ToggleSwitch
              checked={tx.sales.enableOverallDiscount}
              onChange={(v) => updateSales('enableOverallDiscount', v)}
              disabled={!canEdit}
              label="Enable Invoice-Level Overall Discount"
            />
            <ToggleSwitch
              checked={tx.sales.enableShippingCharges}
              onChange={(v) => updateSales('enableShippingCharges', v)}
              disabled={!canEdit}
              label="Enable Shipping / Freight Charges"
            />
            <ToggleSwitch
              checked={tx.sales.requireCustomerSelection}
              onChange={(v) => updateSales('requireCustomerSelection', v)}
              disabled={!canEdit}
              label="Require Customer Selection on Credit Bills"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Default Invoice Terms &amp; Conditions
            </label>
            <textarea
              rows={2}
              value={tx.sales.defaultTerms}
              disabled={!canEdit}
              onChange={(e) => updateSales('defaultTerms', e.target.value)}
              className={inputClass}
            />
          </div>
        </SettingsCard>

        <SettingsCard
          title="Purchase, Payment & Return Rules"
          subtitle="Supplier procurement validation, payment modes & credit note automation"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Purchase Tax Mode
              </label>
              <select
                value={tx.purchase.defaultTaxMode}
                disabled={!canEdit}
                onChange={(e) => updatePurchase('defaultTaxMode', e.target.value as 'Exclusive' | 'Inclusive')}
                className={inputClass}
              >
                <option value="Exclusive">Exclusive (+ Input GST)</option>
                <option value="Inclusive">Inclusive</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Payment Mode
              </label>
              <select
                value={tx.payment.defaultPaymentMode}
                disabled={!canEdit}
                onChange={(e) =>
                  updatePayment(
                    'defaultPaymentMode',
                    e.target.value as 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Card'
                  )
                }
                className={inputClass}
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Card">Card</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
            <ToggleSwitch
              checked={tx.purchase.requireSupplierInvoiceNo}
              onChange={(v) => updatePurchase('requireSupplierInvoiceNo', v)}
              disabled={!canEdit}
              label="Require Supplier Invoice Number on Purchase"
            />
            <ToggleSwitch
              checked={tx.purchase.enableFreightCharges}
              onChange={(v) => updatePurchase('enableFreightCharges', v)}
              disabled={!canEdit}
              label="Enable Freight & Landing Charges on Purchase"
            />
            <ToggleSwitch
              checked={tx.payment.allowPartialPayment}
              onChange={(v) => updatePayment('allowPartialPayment', v)}
              disabled={!canEdit}
              label="Allow Partial & Split Payments"
            />
            <ToggleSwitch
              checked={tx.salesReturn.autoCreateCreditNote}
              onChange={(v) => updateSalesReturn('autoCreateCreditNote', v)}
              disabled={!canEdit}
              label="Auto-Generate Credit Note on Sales Return"
            />
            <ToggleSwitch
              checked={tx.purchaseReturn.reverseInputTaxCredit}
              onChange={(v) => updatePurchaseReturn('reverseInputTaxCredit', v)}
              disabled={!canEdit}
              label="Reverse Input Tax Credit (ITC) on Purchase Return"
            />
          </div>
        </SettingsCard>
      </div>

      {/* 3. Live Stock & Duplicate Enforcement Behaviour */}
      <SettingsCard
        title="Inventory & Transaction Behaviour Guards"
        subtitle="Enforced live during billing, purchases, and invoice cancellation"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
          <ToggleSwitch
            checked={tx.behaviour.preventDuplicateInvoice}
            onChange={(v) => updateBehaviour('preventDuplicateInvoice', v)}
            disabled={!canEdit}
            label="Prevent Duplicate Sales Invoice Numbers"
            description="Blocks saving two active sales invoices with the same invoice number."
          />
          <ToggleSwitch
            checked={tx.behaviour.preventDuplicatePurchaseBill}
            onChange={(v) => updateBehaviour('preventDuplicatePurchaseBill', v)}
            disabled={!canEdit}
            label="Prevent Duplicate Purchase Bill Numbers"
            description="Warns and blocks duplicate supplier bill numbers."
          />
          <ToggleSwitch
            checked={tx.behaviour.allowNegativeStock}
            onChange={(v) => updateBehaviour('allowNegativeStock', v)}
            disabled={!canEdit}
            label="Allow Negative Stock Billing"
            description="When disabled, billing beyond available quantity is blocked unless overridden."
          />
          <ToggleSwitch
            checked={tx.behaviour.reverseStockOnCancellation}
            onChange={(v) => updateBehaviour('reverseStockOnCancellation', v)}
            disabled={!canEdit}
            label="Reverse Stock Automatically on Cancellation"
            description="Restores deducted inventory cleanly when an invoice is cancelled."
          />
        </div>
      </SettingsCard>
    </div>
  );
};
