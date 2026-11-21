import React from 'react';
import {
  Upload,
  Trash2,
  Download,
  RefreshCw,
  Globe,
  Sun,
  Moon,
  Monitor,
  CheckCircle2,
  Calendar,
  Keyboard,
} from 'lucide-react';
import { BusinessSettingsBundle, CompanyProfile, ThemePreference } from '../../types';
import { SettingsCard, ToggleSwitch, ReadOnlyBanner } from './SettingsUi';

interface GeneralSettingsPanelProps {
  draft: BusinessSettingsBundle;
  setDraft: React.Dispatch<React.SetStateAction<BusinessSettingsBundle>>;
  companyDraft: CompanyProfile;
  setCompanyDraft: React.Dispatch<React.SetStateAction<CompanyProfile>>;
  canEdit: boolean;
  canBackupAndRestore: boolean;
  themePreference: ThemePreference;
  onChangeTheme: (mode: ThemePreference) => void;
  onExportBackup: () => void;
  onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportModuleCsv: (
    mod: 'products' | 'customers' | 'suppliers' | 'sales' | 'purchases' | 'expenses' | 'income' | 'ledgers'
  ) => void;
  onSyncServer: () => void;
  serverSyncStatus: 'online' | 'syncing' | 'reconnecting';
  lastServerSyncAt: string | null;
  onOpenShortcuts: () => void;
  onOpenErpTools: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const INDIAN_STATES = [
  'Karnataka (29)',
  'Maharashtra (27)',
  'Delhi (07)',
  'Tamil Nadu (33)',
  'Gujarat (24)',
  'Uttar Pradesh (09)',
  'Telangana (36)',
  'West Bengal (19)',
  'Rajasthan (08)',
  'Kerala (32)',
  'Haryana (06)',
  'Andhra Pradesh (37)',
  'Madhya Pradesh (23)',
  'Punjab (03)',
  'Bihar (10)',
  'Odisha (21)',
];

export const GeneralSettingsPanel: React.FC<GeneralSettingsPanelProps> = ({
  draft,
  setDraft,
  companyDraft,
  setCompanyDraft,
  canEdit,
  canBackupAndRestore,
  themePreference,
  onChangeTheme,
  onExportBackup,
  onImportBackup,
  onExportModuleCsv,
  onSyncServer,
  serverSyncStatus,
  lastServerSyncAt,
  onOpenShortcuts,
  onOpenErpTools,
  showToast,
}) => {
  const g = draft.general;

  const updateGeneral = <K extends keyof BusinessSettingsBundle['general']>(
    key: K,
    value: BusinessSettingsBundle['general'][K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      general: { ...prev.general, [key]: value },
    }));
  };

  const updateCompanyField = <K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) => {
    setCompanyDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      showToast('Logo image must be smaller than 1.5 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateCompanyField('logoDataUrl', reader.result);
        showToast('Business logo staged. Click Save Changes to apply across invoices.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-500';

  return (
    <div className="space-y-5">
      {!canEdit && <ReadOnlyBanner categoryLabel="General" />}

      {/* 1. Business Profile & Logo */}
      <SettingsCard
        title="Business Profile & Identity"
        subtitle="Legal business identity, contact info, address & invoice letterhead logo"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-20 h-20 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
            {companyDraft.logoDataUrl ? (
              <img
                src={companyDraft.logoDataUrl}
                alt="Business Logo"
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <span className="text-[10px] font-bold text-slate-400 text-center px-2">NO LOGO</span>
            )}
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              Store / Company Logo
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Displayed on A4 GST Tax Invoices, Statements, Quotations &amp; Receipts (PNG/JPG up to 1.5 MB).
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <label
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-semibold ${
                  canEdit ? 'cursor-pointer' : 'opacity-50 pointer-events-none'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Upload Logo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoUpload}
                  disabled={!canEdit}
                  className="hidden"
                />
              </label>
              {companyDraft.logoDataUrl && canEdit && (
                <button
                  type="button"
                  onClick={() => updateCompanyField('logoDataUrl', '')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Business Display Name *
            </label>
            <input
              type="text"
              value={companyDraft.name || ''}
              disabled={!canEdit}
              onChange={(e) => updateCompanyField('name', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Legal Name
            </label>
            <input
              type="text"
              value={companyDraft.legalName || companyDraft.name || ''}
              disabled={!canEdit}
              onChange={(e) => updateCompanyField('legalName', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Owner / Proprietor Name
            </label>
            <input
              type="text"
              value={companyDraft.ownerName || ''}
              disabled={!canEdit}
              onChange={(e) => updateCompanyField('ownerName', e.target.value)}
              placeholder="e.g. Rajesh Gupta"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Business Type
            </label>
            <select
              value={companyDraft.businessType || 'Retail & Wholesale'}
              disabled={!canEdit}
              onChange={(e) => updateCompanyField('businessType', e.target.value as CompanyProfile['businessType'])}
              className={inputClass}
            >
              <option value="Retail">Retail Store</option>
              <option value="Wholesale">Wholesale Distributor</option>
              <option value="Retail & Wholesale">Retail &amp; Wholesale</option>
              <option value="Services">Services</option>
              <option value="Manufacturing">Manufacturing</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Business Category
            </label>
            <input
              type="text"
              value={companyDraft.businessCategory || ''}
              disabled={!canEdit}
              onChange={(e) => updateCompanyField('businessCategory', e.target.value)}
              placeholder="Kirana / General Store / FMCG"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              PAN Number
            </label>
            <input
              type="text"
              value={companyDraft.pan || ''}
              disabled={!canEdit}
              onChange={(e) => updateCompanyField('pan', e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              className={`${inputClass} font-mono uppercase`}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Primary Phone *
            </label>
            <input
              type="text"
              value={companyDraft.phone || ''}
              disabled={!canEdit}
              onChange={(e) => updateCompanyField('phone', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Alternate Phone
            </label>
            <input
              type="text"
              value={companyDraft.altPhone || ''}
              disabled={!canEdit}
              onChange={(e) => updateCompanyField('altPhone', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Business Email
            </label>
            <input
              type="email"
              value={companyDraft.email || ''}
              disabled={!canEdit}
              onChange={(e) => updateCompanyField('email', e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Website
            </label>
            <input
              type="text"
              value={companyDraft.website || ''}
              disabled={!canEdit}
              onChange={(e) => updateCompanyField('website', e.target.value)}
              placeholder="https://mystore.in"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Registration / Udyam No.
            </label>
            <input
              type="text"
              value={companyDraft.registrationNo || ''}
              disabled={!canEdit}
              onChange={(e) => updateCompanyField('registrationNo', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Opening / Established Date
            </label>
            <input
              type="date"
              value={companyDraft.openingDate || ''}
              disabled={!canEdit}
              onChange={(e) => updateCompanyField('openingDate', e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Registered Street Address
            </label>
            <textarea
              rows={2}
              value={companyDraft.address || ''}
              disabled={!canEdit}
              onChange={(e) => updateCompanyField('address', e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              City
            </label>
            <input
              type="text"
              value={companyDraft.city || ''}
              disabled={!canEdit}
              onChange={(e) => updateCompanyField('city', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              State &amp; GST Code
            </label>
            <select
              value={companyDraft.state || 'Karnataka (29)'}
              disabled={!canEdit}
              onChange={(e) => updateCompanyField('state', e.target.value)}
              className={inputClass}
            >
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pincode
              </label>
              <input
                type="text"
                value={companyDraft.pincode || ''}
                disabled={!canEdit}
                onChange={(e) => updateCompanyField('pincode', e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Country
              </label>
              <input
                type="text"
                value={companyDraft.country || 'India'}
                disabled={!canEdit}
                onChange={(e) => updateCompanyField('country', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Business Description / Tagline
            </label>
            <input
              type="text"
              value={companyDraft.description || ''}
              disabled={!canEdit}
              onChange={(e) => updateCompanyField('description', e.target.value)}
              placeholder="Trusted neighbourhood grocery, FMCG & wholesale supply center"
              className={inputClass}
            />
          </div>
        </div>
      </SettingsCard>

      {/* 2. Regional, Currency & Number Format */}
      <SettingsCard
        title="Regional, Currency & Formatting"
        subtitle="Indian Rupee formatting, date/time conventions & numeric precision"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Currency
            </label>
            <select
              value={g.currencyCode}
              disabled={!canEdit}
              onChange={(e) => {
                const code = e.target.value;
                updateGeneral('currencyCode', code);
                updateGeneral('currencySymbol', code === 'INR' ? '₹' : code === 'USD' ? '$' : '₹');
              }}
              className={inputClass}
            >
              <option value="INR">INR (₹ Indian Rupee)</option>
              <option value="USD">USD ($ US Dollar)</option>
              <option value="AED">AED (د.إ UAE Dirham)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Currency Symbol Position
            </label>
            <select
              value={g.currencyPosition}
              disabled={!canEdit}
              onChange={(e) => updateGeneral('currencyPosition', e.target.value as 'before' | 'after')}
              className={inputClass}
            >
              <option value="before">Before Amount (₹ 1,250.00)</option>
              <option value="after">After Amount (1,250.00 ₹)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Number Grouping
            </label>
            <select
              value={g.numberFormat}
              disabled={!canEdit}
              onChange={(e) =>
                updateGeneral(
                  'numberFormat',
                  e.target.value as BusinessSettingsBundle['general']['numberFormat']
                )
              }
              className={inputClass}
            >
              <option value="Indian (12,34,567.89)">Indian (12,34,567.89)</option>
              <option value="International (1,234,567.89)">International (1,234,567.89)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Decimal Precision
            </label>
            <select
              value={g.decimalPrecision}
              disabled={!canEdit}
              onChange={(e) => updateGeneral('decimalPrecision', Number(e.target.value))}
              className={inputClass}
            >
              <option value={0}>0 decimals (₹ 1,250)</option>
              <option value={2}>2 decimals (₹ 1,250.00)</option>
              <option value={3}>3 decimals (₹ 1,250.000)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Date Format
            </label>
            <select
              value={g.dateFormat}
              disabled={!canEdit}
              onChange={(e) =>
                updateGeneral('dateFormat', e.target.value as BusinessSettingsBundle['general']['dateFormat'])
              }
              className={inputClass}
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (India Standard)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Time Format
            </label>
            <select
              value={g.timeFormat}
              disabled={!canEdit}
              onChange={(e) => updateGeneral('timeFormat', e.target.value as '12-hour' | '24-hour')}
              className={inputClass}
            >
              <option value="12-hour">12-hour (AM / PM)</option>
              <option value="24-hour">24-hour</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Time Zone
            </label>
            <select
              value={g.timeZone}
              disabled={!canEdit}
              onChange={(e) => updateGeneral('timeZone', e.target.value)}
              className={inputClass}
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST UTC+5:30)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST UTC+4:00)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Display Language
            </label>
            <select
              value={g.language}
              disabled={!canEdit}
              onChange={(e) =>
                updateGeneral('language', e.target.value as BusinessSettingsBundle['general']['language'])
              }
              className={inputClass}
            >
              <option value="English (India)">English (India)</option>
              <option value="Hindi">Hindi (हिन्दी)</option>
              <option value="Kannada">Kannada (ಕನ್ನಡ)</option>
              <option value="Tamil">Tamil (தமிழ்)</option>
              <option value="Telugu">Telugu (తెలుగు)</option>
              <option value="Marathi">Marathi (मराठी)</option>
            </select>
          </div>
        </div>
      </SettingsCard>

      {/* 3. Financial Year & Business Preferences */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SettingsCard
          title="Financial Year Settings"
          subtitle="Active fiscal period & opening balance rollover controls"
          rightSlot={<Calendar className="w-4 h-4 text-blue-600" />}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Active Financial Year Label
              </label>
              <input
                type="text"
                value={g.financialYearLabel}
                disabled={!canEdit}
                onChange={(e) => updateGeneral('financialYearLabel', e.target.value)}
                className={`${inputClass} font-mono font-bold`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                FY Start Month
              </label>
              <select
                value={g.financialYearStartMonth}
                disabled={!canEdit}
                onChange={(e) => updateGeneral('financialYearStartMonth', Number(e.target.value))}
                className={inputClass}
              >
                <option value={4}>April (Indian Fiscal Year)</option>
                <option value={1}>January (Calendar Year)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={g.financialYearStartDate}
                disabled={!canEdit}
                onChange={(e) => updateGeneral('financialYearStartDate', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={g.financialYearEndDate}
                disabled={!canEdit}
                onChange={(e) => updateGeneral('financialYearEndDate', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
            <ToggleSwitch
              checked={g.enablePreviousYearViewing}
              onChange={(v) => updateGeneral('enablePreviousYearViewing', v)}
              disabled={!canEdit}
              label="Allow Previous Financial Year Viewing"
              description="Permit historical ledger & invoice filtering across prior FY records."
            />
            <ToggleSwitch
              checked={g.carryForwardOpeningBalance}
              onChange={(v) => updateGeneral('carryForwardOpeningBalance', v)}
              disabled={!canEdit}
              label="Carry Forward Party & Ledger Opening Balances"
              description="Preserve closing debit/credit balances when rolling into a new fiscal period."
            />
          </div>
        </SettingsCard>

        <SettingsCard
          title="Business Preferences & Appearance"
          subtitle="Default billing modes, stock alerts & interface theme"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Sales Type
              </label>
              <select
                value={g.defaultSalesType}
                disabled={!canEdit}
                onChange={(e) =>
                  updateGeneral('defaultSalesType', e.target.value as 'Retail' | 'Wholesale' | 'POS')
                }
                className={inputClass}
              >
                <option value="Retail">Retail</option>
                <option value="Wholesale">Wholesale</option>
                <option value="POS">POS Quick Bill</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Tax Mode
              </label>
              <select
                value={g.defaultTaxMode}
                disabled={!canEdit}
                onChange={(e) => updateGeneral('defaultTaxMode', e.target.value as 'Inclusive' | 'Exclusive')}
                className={inputClass}
              >
                <option value="Exclusive">Tax Exclusive</option>
                <option value="Inclusive">Tax Inclusive (MRP)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
            <ToggleSwitch
              checked={g.lowStockNotifications}
              onChange={(v) => updateGeneral('lowStockNotifications', v)}
              disabled={!canEdit}
              label="Low Stock Notifications"
              description="Alert staff and highlight products when stock drops below reorder alert level."
            />
            <ToggleSwitch
              checked={g.enableMultiBranch}
              onChange={(v) => updateGeneral('enableMultiBranch', v)}
              disabled={!canEdit}
              label="Multi-Branch / Multi-Godown Selector"
              description="Show branch and warehouse routing options in header and billing."
            />
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Workspace Theme
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'light', label: 'Light', icon: Sun },
                  { id: 'dark', label: 'Dark', icon: Moon },
                  { id: 'system', label: 'System', icon: Monitor },
                ] as const
              ).map((m) => {
                const Icon = m.icon;
                const active = themePreference === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeTheme(m.id)}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      active
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </SettingsCard>
      </div>

      {/* 4. Backup, Server Sync & Data Export */}
      <SettingsCard
        title="Online Sync, Manual Backup & Data Export"
        subtitle="Synchronize with cloud/Express database, create JSON backups, or export module CSVs"
        rightSlot={
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {serverSyncStatus === 'online'
                ? 'Server Connected'
                : serverSyncStatus === 'syncing'
                ? 'Syncing...'
                : 'Reconnecting'}
              {lastServerSyncAt ? ` (${lastServerSyncAt})` : ''}
            </span>
          </span>
        }
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onSyncServer}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${serverSyncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            <span>Sync Server Now</span>
          </button>

          <button
            type="button"
            disabled={!canBackupAndRestore}
            onClick={onExportBackup}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white text-xs font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Full JSON Backup</span>
          </button>

          <label
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-semibold ${
              canBackupAndRestore ? 'cursor-pointer' : 'opacity-45 pointer-events-none'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span>Restore JSON Backup</span>
            <input
              type="file"
              accept=".json,application/json"
              disabled={!canBackupAndRestore}
              onChange={onImportBackup}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={onOpenErpTools}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-slate-600" />
            <span>CSV Import &amp; Recycle Bin</span>
          </button>

          <button
            type="button"
            onClick={onOpenShortcuts}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
          >
            <Keyboard className="w-3.5 h-3.5 text-slate-600" />
            <span>Keyboard Shortcuts</span>
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-2">
            Quick Module CSV / Excel Exports
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'products', label: 'Products CSV' },
                { id: 'customers', label: 'Customers CSV' },
                { id: 'suppliers', label: 'Suppliers CSV' },
                { id: 'sales', label: 'Sales Register CSV' },
                { id: 'purchases', label: 'Purchase Register CSV' },
                { id: 'ledgers', label: 'Party Ledgers CSV' },
              ] as const
            ).map((csv) => (
              <button
                key={csv.id}
                type="button"
                onClick={() => onExportModuleCsv(csv.id)}
                className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-blue-500 hover:text-blue-600 text-[11px] font-semibold cursor-pointer"
              >
                {csv.label}
              </button>
            ))}
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};
