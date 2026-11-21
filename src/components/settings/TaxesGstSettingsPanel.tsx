import React from 'react';
import { ShieldCheck, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';
import { BusinessSettingsBundle, CompanyProfile } from '../../types';
import { SettingsCard, ToggleSwitch, ReadOnlyBanner } from './SettingsUi';

interface TaxesGstSettingsPanelProps {
  draft: BusinessSettingsBundle;
  setDraft: React.Dispatch<React.SetStateAction<BusinessSettingsBundle>>;
  companyDraft: CompanyProfile;
  setCompanyDraft: React.Dispatch<React.SetStateAction<CompanyProfile>>;
  canEdit: boolean;
  onNavigateTab: (tab: string) => void;
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const TaxesGstSettingsPanel: React.FC<TaxesGstSettingsPanelProps> = ({
  draft,
  setDraft,
  companyDraft,
  setCompanyDraft,
  canEdit,
  onNavigateTab,
}) => {
  const gst = draft.gst;
  const gstinVal = (companyDraft.gstin || '').trim().toUpperCase();
  const isGstinValid = !gst.isGstRegistered || gstinVal === '' || GSTIN_REGEX.test(gstinVal);

  const updateGst = <K extends keyof BusinessSettingsBundle['gst']>(
    key: K,
    val: BusinessSettingsBundle['gst'][K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      gst: { ...prev.gst, [key]: val },
    }));
  };

  const toggleRate = (rate: number) => {
    if (!canEdit) return;
    const exists = gst.defaultTaxRates.includes(rate);
    const updated = exists
      ? gst.defaultTaxRates.filter((r) => r !== rate)
      : [...gst.defaultTaxRates, rate].sort((a, b) => a - b);
    updateGst('defaultTaxRates', updated);
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-100';

  return (
    <div className="space-y-5">
      {!canEdit && <ReadOnlyBanner categoryLabel="Taxes & GST" />}

      {/* 1. Business GST Registration Profile */}
      <SettingsCard
        title="Business GST Profile"
        subtitle="GSTIN validation, registration scheme, state jurisdiction & verification status"
        rightSlot={
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${
              isGstinValid ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'
            }`}
          >
            {isGstinValid ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" />
            )}
            <span>
              {gst.isGstRegistered
                ? isGstinValid
                  ? 'Valid GSTIN Format'
                  : 'Invalid GSTIN Format (15 chars required)'
                : 'Unregistered / Non-GST Mode'}
            </span>
          </span>
        }
      >
        <ToggleSwitch
          checked={gst.isGstRegistered}
          onChange={(v) => {
            updateGst('isGstRegistered', v);
            updateGst('registrationType', v ? 'Regular' : 'Unregistered');
          }}
          disabled={!canEdit}
          label="Business is GST Registered"
          description="Enable GST tax invoices, CGST/SGST/IGST splits, HSN codes & GSTR reporting."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              GSTIN (15-Character Tax ID)
            </label>
            <input
              type="text"
              maxLength={15}
              value={companyDraft.gstin || ''}
              disabled={!canEdit || !gst.isGstRegistered}
              onChange={(e) => {
                const upper = e.target.value.toUpperCase();
                setCompanyDraft((prev) => ({ ...prev, gstin: upper }));
                if (upper.length >= 2) {
                  updateGst('stateCode', upper.slice(0, 2));
                }
              }}
              placeholder="29ABCDE1234F1Z5"
              className={`${inputClass} font-mono uppercase font-bold ${
                !isGstinValid ? 'border-rose-500 text-rose-700' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Registration Type
            </label>
            <select
              value={gst.registrationType}
              disabled={!canEdit || !gst.isGstRegistered}
              onChange={(e) =>
                updateGst(
                  'registrationType',
                  e.target.value as BusinessSettingsBundle['gst']['registrationType']
                )
              }
              className={inputClass}
            >
              <option value="Regular">Regular GST Taxpayer</option>
              <option value="Composition">Composition Scheme</option>
              <option value="SEZ">SEZ Developer / Unit</option>
              <option value="Casual">Casual Taxable Person</option>
              <option value="Unregistered">Unregistered Dealer</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              State Code &amp; Place of Business
            </label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                maxLength={2}
                value={gst.stateCode}
                disabled={!canEdit}
                onChange={(e) => updateGst('stateCode', e.target.value)}
                className={`${inputClass} font-mono text-center`}
              />
              <input
                type="text"
                value={gst.placeOfBusiness}
                disabled={!canEdit}
                onChange={(e) => updateGst('placeOfBusiness', e.target.value)}
                className={`${inputClass} col-span-2`}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              GST Legal Name
            </label>
            <input
              type="text"
              value={gst.legalName}
              disabled={!canEdit}
              onChange={(e) => updateGst('legalName', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              GST Trade Name
            </label>
            <input
              type="text"
              value={gst.tradeName}
              disabled={!canEdit}
              onChange={(e) => updateGst('tradeName', e.target.value)}
              className={inputClass}
            />
          </div>
          {gst.registrationType === 'Composition' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Composition Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={6}
                value={gst.compositionRatePercent}
                disabled={!canEdit}
                onChange={(e) => updateGst('compositionRatePercent', Number(e.target.value))}
                className={`${inputClass} tabular-nums`}
              />
            </div>
          )}
        </div>
      </SettingsCard>

      {/* 2. Tax Components & Slabs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SettingsCard
          title="Tax Components & GST Treatment"
          subtitle="Enable intrastate, interstate, UTGST, exempt & reverse-charge tax treatments"
        >
          <div className="space-y-1">
            <ToggleSwitch
              checked={gst.enableCgstSgst}
              onChange={(v) => updateGst('enableCgstSgst', v)}
              disabled={!canEdit}
              label="CGST + SGST (Intra-State Split)"
              description="Splits GST 50/50 when Place of Supply matches business state."
            />
            <ToggleSwitch
              checked={gst.enableIgst}
              onChange={(v) => updateGst('enableIgst', v)}
              disabled={!canEdit}
              label="IGST (Inter-State Integrated GST)"
              description="Applies full IGST when customer state differs from business state."
            />
            <ToggleSwitch
              checked={gst.enableUtgst}
              onChange={(v) => updateGst('enableUtgst', v)}
              disabled={!canEdit}
              label="UTGST (Union Territory GST)"
            />
            <ToggleSwitch
              checked={gst.enableExemptSupplies}
              onChange={(v) => updateGst('enableExemptSupplies', v)}
              disabled={!canEdit}
              label="Exempt Supplies (0% Essential Goods)"
            />
            <ToggleSwitch
              checked={gst.enableNilRated}
              onChange={(v) => updateGst('enableNilRated', v)}
              disabled={!canEdit}
              label="Nil-Rated & Zero-Rated Supplies"
            />
            <ToggleSwitch
              checked={gst.enableReverseCharge}
              onChange={(v) => updateGst('enableReverseCharge', v)}
              disabled={!canEdit}
              label="Reverse Charge Mechanism (RCM)"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Active GST Tax Slabs in Billing Dropdowns
            </div>
            <div className="flex flex-wrap gap-2">
              {[0, 0.25, 3, 5, 12, 18, 28].map((rate) => {
                const active = gst.defaultTaxRates.includes(rate);
                return (
                  <button
                    key={rate}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => toggleRate(rate)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold tabular-nums cursor-pointer transition-colors ${
                      active
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {rate}%
                  </button>
                );
              })}
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          title="HSN / SAC, Invoice Tax & E-Way Rules"
          subtitle="Control rounding, HSN validation & ₹50,000 E-Way Bill alert threshold"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tax Calculation Mode
              </label>
              <select
                value={gst.taxCalculationMode}
                disabled={!canEdit}
                onChange={(e) =>
                  updateGst('taxCalculationMode', e.target.value as 'Exclusive' | 'Inclusive')
                }
                className={inputClass}
              >
                <option value="Exclusive">Exclusive (+ GST on Net)</option>
                <option value="Inclusive">Inclusive (Reverse Calc from MRP)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tax Rounding Rule
              </label>
              <select
                value={gst.taxRounding}
                disabled={!canEdit}
                onChange={(e) =>
                  updateGst(
                    'taxRounding',
                    e.target.value as 'Nearest Rupee' | 'Exact Paise' | 'Round Up'
                  )
                }
                className={inputClass}
              >
                <option value="Exact Paise">Exact Paise (0.01)</option>
                <option value="Nearest Rupee">Nearest Rupee</option>
                <option value="Round Up">Round Up</option>
              </select>
            </div>
          </div>

          <div className="pt-2 space-y-1">
            <ToggleSwitch
              checked={gst.defaultHsnMandatory}
              onChange={(v) => updateGst('defaultHsnMandatory', v)}
              disabled={!canEdit}
              label="Require HSN/SAC Code on B2B Tax Invoices"
            />
            <ToggleSwitch
              checked={gst.flagUncertainHsnForReview}
              onChange={(v) => updateGst('flagUncertainHsnForReview', v)}
              disabled={!canEdit}
              label="Flag Missing or Unverified HSN Codes for Review"
            />
            <ToggleSwitch
              checked={gst.enableEInvoice}
              onChange={(v) => updateGst('enableEInvoice', v)}
              disabled={!canEdit}
              label="Enable GST E-Invoice (IRP / IRN) Queue"
            />
            <ToggleSwitch
              checked={gst.enableEWayBill}
              onChange={(v) => updateGst('enableEWayBill', v)}
              disabled={!canEdit}
              label="Enable E-Way Bill Threshold Prompt"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              E-Way Bill Mandatory Value Threshold (₹)
            </label>
            <input
              type="number"
              min={0}
              value={gst.eWayBillThreshold}
              disabled={!canEdit}
              onChange={(e) => updateGst('eWayBillThreshold', Number(e.target.value))}
              className={`${inputClass} tabular-nums font-bold`}
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('hsn-gst')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-blue-600 text-xs font-semibold cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Open HSN / SAC Manager</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('e-invoice')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-blue-600 text-xs font-semibold cursor-pointer"
            >
              <span>Open E-Invoice &amp; E-Way Bill Portal</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </button>
          </div>
        </SettingsCard>
      </div>
    </div>
  );
};
