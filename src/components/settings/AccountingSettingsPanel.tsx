import React, { useState } from 'react';
import { BookOpen, Plus, Trash2, ExternalLink, ShieldCheck, Lock, Unlock } from 'lucide-react';
import {
  AccountRecord,
  BusinessSettingsBundle,
  CostingMethodType,
  LockedFinancialPeriod,
  ProfitControlSettings,
} from '../../types';
import { SettingsCard, ToggleSwitch, ReadOnlyBanner } from './SettingsUi';

interface AccountingSettingsPanelProps {
  draft: BusinessSettingsBundle;
  setDraft: React.Dispatch<React.SetStateAction<BusinessSettingsBundle>>;
  accounts: AccountRecord[];
  onAddAccount: (acc: Omit<AccountRecord, 'id'>) => AccountRecord;
  canEdit: boolean;
  onNavigateTab: (tab: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const DEFAULT_PROFIT_CFG: ProfitControlSettings = {
  costingMethod: 'Weighted Average',
  defaultDiscountType: 'percent',
  maxDiscountPercent: 15,
  minProfitMarginPercent: 3,
  targetProfitMarginPercent: 18,
  allowLossMakingSales: true,
  requireAdminPinForLoss: true,
  adminApprovalPin: '1234',
  gstBasisForProfit: 'Exclude Creditable GST',
  includeExpensesInNetProfit: true,
};

export const AccountingSettingsPanel: React.FC<AccountingSettingsPanelProps> = ({
  draft,
  setDraft,
  accounts,
  onAddAccount,
  canEdit,
  onNavigateTab,
  showToast,
}) => {
  const accCfg = draft.accounting;
  const profitCfg: ProfitControlSettings = {
    ...DEFAULT_PROFIT_CFG,
    ...(accCfg.profitControl || {}),
  };
  const lockedPeriods = accCfg.lockedPeriods || [];

  const [newExpCat, setNewExpCat] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccOpening, setNewAccOpening] = useState<number>(0);
  const [lockLabel, setLockLabel] = useState('');
  const [lockStart, setLockStart] = useState('');
  const [lockEnd, setLockEnd] = useState('');

  const updateAccCfg = <K extends keyof BusinessSettingsBundle['accounting']>(
    key: K,
    val: BusinessSettingsBundle['accounting'][K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      accounting: { ...prev.accounting, [key]: val },
    }));
  };

  const updateProfitCfg = <K extends keyof ProfitControlSettings>(
    key: K,
    val: ProfitControlSettings[K]
  ) => {
    setDraft((prev) => {
      const nextProfit: ProfitControlSettings = {
        ...DEFAULT_PROFIT_CFG,
        ...(prev.accounting.profitControl || {}),
        [key]: val,
      };
      const syncedValuation =
        key === 'costingMethod'
          ? val === 'Last Purchase Price'
            ? 'Purchase Price'
            : (val as 'Weighted Average' | 'FIFO')
          : prev.item.stockValuationMethod;

      return {
        ...prev,
        item: {
          ...prev.item,
          stockValuationMethod: syncedValuation,
        },
        accounting: {
          ...prev.accounting,
          profitControl: nextProfit,
        },
      };
    });
  };

  const handleAddLockedPeriod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!lockLabel.trim() || !lockStart || !lockEnd) {
      showToast('Enter period label, start date, and end date.', 'warning');
      return;
    }
    if (lockStart > lockEnd) {
      showToast('Start date must be on or before end date.', 'error');
      return;
    }
    const nextLock: LockedFinancialPeriod = {
      id: `lock-${Date.now()}`,
      label: lockLabel.trim(),
      startDate: lockStart,
      endDate: lockEnd,
      lockedBy: 'Admin',
      lockedAt: new Date().toISOString(),
    };
    updateAccCfg('lockedPeriods', [nextLock, ...lockedPeriods]);
    setLockLabel('');
    setLockStart('');
    setLockEnd('');
    showToast(`Added lock for "${nextLock.label}". Click Save Changes to enforce.`, 'info');
  };

  const handleRemoveLockedPeriod = (id: string) => {
    if (!canEdit) return;
    updateAccCfg(
      'lockedPeriods',
      lockedPeriods.filter((p) => p.id !== id)
    );
    showToast('Removed period lock from draft. Save Changes to apply.', 'info');
  };

  const handleAddExpCat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !newExpCat.trim()) return;
    if (accCfg.expenseCategories.some((c) => c.toLowerCase() === newExpCat.trim().toLowerCase())) {
      showToast('Expense category already exists.', 'warning');
      return;
    }
    updateAccCfg('expenseCategories', [...accCfg.expenseCategories, newExpCat.trim()]);
    setNewExpCat('');
  };

  const handleAddCashBankAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !newAccName.trim()) return;
    onAddAccount({
      code: `10${accounts.length + 10}`,
      name: newAccName.trim(),
      group: 'Assets',
      subType: 'Bank / Cash Account',
      openingBalance: Number(newAccOpening) || 0,
      normalBalance: 'Debit',
      isActive: true,
    });
    setNewAccName('');
    setNewAccOpening(0);
    showToast(`Added "${newAccName.trim()}" to Chart of Accounts.`);
  };

  const inputClass =
    'w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-100 dark:disabled:bg-slate-900';

  return (
    <div className="space-y-5">
      {!canEdit && <ReadOnlyBanner categoryLabel="Accounting" />}

      {/* 0. Profit Engine, Inventory Costing Method & Discount Protection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SettingsCard
          title="Profit & Loss Engine & Costing Rules"
          subtitle="Inventory valuation method, discount guardrails & GST basis for profit"
          rightSlot={<ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Inventory Costing Method (COGS &amp; Valuation)
              </label>
              <select
                value={profitCfg.costingMethod}
                disabled={!canEdit}
                onChange={(e) => updateProfitCfg('costingMethod', e.target.value as CostingMethodType)}
                className={inputClass}
              >
                <option value="Weighted Average">Weighted Average Cost (Recommended for Kirana)</option>
                <option value="FIFO">FIFO (First In First Out by Batch)</option>
                <option value="Last Purchase Price">Last Purchase Price (Latest Landed Cost)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Max Safe Discount (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={profitCfg.maxDiscountPercent}
                disabled={!canEdit}
                onChange={(e) =>
                  updateProfitCfg('maxDiscountPercent', Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                }
                className={`${inputClass} tabular-nums`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Min Profit Margin Alert (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={profitCfg.minProfitMarginPercent}
                disabled={!canEdit}
                onChange={(e) =>
                  updateProfitCfg('minProfitMarginPercent', Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                }
                className={`${inputClass} tabular-nums`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Margin (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={profitCfg.targetProfitMarginPercent}
                disabled={!canEdit}
                onChange={(e) =>
                  updateProfitCfg('targetProfitMarginPercent', Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                }
                className={`${inputClass} tabular-nums`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Admin Approval PIN
              </label>
              <input
                type="password"
                maxLength={12}
                value={profitCfg.adminApprovalPin}
                disabled={!canEdit}
                onChange={(e) => updateProfitCfg('adminApprovalPin', e.target.value)}
                placeholder="e.g. 1234"
                className={`${inputClass} tabular-nums`}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                GST Basis for Profit Calculation
              </label>
              <select
                value={profitCfg.gstBasisForProfit}
                disabled={!canEdit}
                onChange={(e) =>
                  updateProfitCfg(
                    'gstBasisForProfit',
                    e.target.value as 'Exclude Creditable GST' | 'Include All Tax'
                  )
                }
                className={inputClass}
              >
                <option value="Exclude Creditable GST">Exclude GST (Net Ex-GST Revenue − COGS)</option>
                <option value="Include All Tax">Include All Tax (Non-Creditable / Composition)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
            <ToggleSwitch
              checked={profitCfg.allowLossMakingSales}
              onChange={(v) => updateProfitCfg('allowLossMakingSales', v)}
              disabled={!canEdit}
              label="Allow Loss-Making Invoices (With Protection)"
              description="If disabled, billing & POS strictly block invoices below cost."
            />
            <ToggleSwitch
              checked={profitCfg.requireAdminPinForLoss}
              onChange={(v) => updateProfitCfg('requireAdminPinForLoss', v)}
              disabled={!canEdit}
              label="Require Admin PIN for Over-Discount or Loss Sales"
              description="Cashiers & staff must enter Admin PIN + reason to approve loss/low-margin bills."
            />
            <ToggleSwitch
              checked={profitCfg.includeExpensesInNetProfit}
              onChange={(v) => updateProfitCfg('includeExpensesInNetProfit', v)}
              disabled={!canEdit}
              label="Deduct Operating Expenses in Net Profit"
            />
          </div>
        </SettingsCard>

        <SettingsCard
          title="Financial Period Locking (Admin Only)"
          subtitle="Prevent backdated invoice creation, edits, or deletions in closed periods"
          rightSlot={<Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
        >
          <form onSubmit={handleAddLockedPeriod} className="grid grid-cols-12 gap-2">
            <input
              type="text"
              value={lockLabel}
              disabled={!canEdit}
              onChange={(e) => setLockLabel(e.target.value)}
              placeholder="Period label (e.g. FY 2025-26 Closed)"
              className={`${inputClass} col-span-12`}
            />
            <div className="col-span-5">
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Start Date</label>
              <input
                type="date"
                value={lockStart}
                disabled={!canEdit}
                onChange={(e) => setLockStart(e.target.value)}
                className={`${inputClass} tabular-nums`}
              />
            </div>
            <div className="col-span-5">
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">End Date</label>
              <input
                type="date"
                value={lockEnd}
                disabled={!canEdit}
                onChange={(e) => setLockEnd(e.target.value)}
                className={`${inputClass} tabular-nums`}
              />
            </div>
            <div className="col-span-2 flex items-end">
              <button
                type="submit"
                disabled={!canEdit}
                className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-45 text-white text-xs font-semibold cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg max-h-44 overflow-y-auto">
            {lockedPeriods.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                No financial periods locked yet. Add a date range above to protect closed GST quarters or FY books.
              </p>
            ) : (
              lockedPeriods.map((lp) => (
                <div key={lp.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{lp.label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {lp.startDate} to {lp.endDate}
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLockedPeriod(lp.id)}
                      title="Unlock period"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:border-rose-300 cursor-pointer"
                    >
                      <Unlock className="w-3 h-3" />
                      <span>Unlock</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </SettingsCard>
      </div>

      {/* 1. Accounting Basis & Default Ledgers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SettingsCard
          title="Ledger & Accounting Preferences"
          subtitle="Accounting basis, default settlement account & journal mapping heads"
          rightSlot={<BookOpen className="w-4 h-4 text-blue-600" />}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Accounting Basis
              </label>
              <select
                value={accCfg.accountingBasis}
                disabled={!canEdit}
                onChange={(e) =>
                  updateAccCfg('accountingBasis', e.target.value as 'Accrual' | 'Cash')
                }
                className={inputClass}
              >
                <option value="Accrual">Accrual (Standard GST)</option>
                <option value="Cash">Cash Basis</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ledger Display Mode
              </label>
              <select
                value={accCfg.displayMode}
                disabled={!canEdit}
                onChange={(e) =>
                  updateAccCfg('displayMode', e.target.value as 'Debit / Credit' | 'Plus / Minus')
                }
                className={inputClass}
              >
                <option value="Debit / Credit">Dr / Cr Format</option>
                <option value="Plus / Minus">+ / - Running Format</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Cash / Bank Settlement Account
              </label>
              <select
                value={accCfg.defaultPaymentAccountId}
                disabled={!canEdit}
                onChange={(e) => updateAccCfg('defaultPaymentAccountId', e.target.value)}
                className={inputClass}
              >
                {accounts
                  .filter((a) => a.group === 'Assets')
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Round Off Ledger Head
              </label>
              <input
                type="text"
                value={accCfg.roundOffAccountName}
                disabled={!canEdit}
                onChange={(e) => updateAccCfg('roundOffAccountName', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Discount Ledger Head
              </label>
              <input
                type="text"
                value={accCfg.discountAccountName}
                disabled={!canEdit}
                onChange={(e) => updateAccCfg('discountAccountName', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <ToggleSwitch
              checked={accCfg.protectBankDetailsByRole}
              onChange={(v) => updateAccCfg('protectBankDetailsByRole', v)}
              disabled={!canEdit}
              label="Protect Bank Balances & Financial Reports by Role"
              description="Hides bank balances and profit numbers from Cashier/Inventory roles."
            />
          </div>

          <div className="pt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('erp-accounting')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-blue-600 text-xs font-semibold cursor-pointer"
            >
              <span>Open Chart of Accounts &amp; Trial Balance</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('profit-loss')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-blue-600 text-xs font-semibold cursor-pointer"
            >
              <span>Open Profit &amp; Loss Engine</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </button>
          </div>
        </SettingsCard>

        {/* 2. Payment Methods & Bank / Cash Accounts */}
        <SettingsCard
          title="Payment Methods & Bank / Cash Accounts"
          subtitle="Toggle accepted settlement methods & add counter/bank ledgers"
        >
          <div className="space-y-2">
            {accCfg.paymentMethods.map((pm, idx) => (
              <div
                key={pm.id}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">{pm.name}</span>
                  <span className="text-[11px] text-slate-500 ml-2">({pm.type})</span>
                </div>
                <input
                  type="checkbox"
                  checked={pm.enabled}
                  disabled={!canEdit}
                  onChange={(e) =>
                    updateAccCfg(
                      'paymentMethods',
                      accCfg.paymentMethods.map((m, i) =>
                        i === idx ? { ...m, enabled: e.target.checked } : m
                      )
                    )
                  }
                  className="rounded text-blue-600 cursor-pointer"
                />
              </div>
            ))}
          </div>

          <form
            onSubmit={handleAddCashBankAccount}
            className="grid grid-cols-12 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800"
          >
            <input
              type="text"
              value={newAccName}
              disabled={!canEdit}
              onChange={(e) => setNewAccName(e.target.value)}
              placeholder="New Bank / Wallet Account Name"
              className={`${inputClass} col-span-6`}
            />
            <input
              type="number"
              value={newAccOpening}
              disabled={!canEdit}
              onChange={(e) => setNewAccOpening(Number(e.target.value))}
              placeholder="Opening ₹"
              className={`${inputClass} col-span-3 tabular-nums`}
            />
            <button
              type="submit"
              disabled={!canEdit}
              className="col-span-3 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Account</span>
            </button>
          </form>
        </SettingsCard>
      </div>

      {/* 3. Expense Categories Manager */}
      <SettingsCard
        title="Expense Categories"
        subtitle="Manage reusable expense heads for store operating costs & cash outflows"
      >
        <form onSubmit={handleAddExpCat} className="flex gap-2 max-w-md">
          <input
            type="text"
            value={newExpCat}
            disabled={!canEdit}
            onChange={(e) => setNewExpCat(e.target.value)}
            placeholder="Add expense category (e.g. Fuel, Marketing)..."
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {accCfg.expenseCategories.map((cat) => (
            <div
              key={cat}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between text-xs"
            >
              <span className="font-semibold truncate">{cat}</span>
              {canEdit && accCfg.expenseCategories.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    updateAccCfg(
                      'expenseCategories',
                      accCfg.expenseCategories.filter((c) => c !== cat)
                    )
                  }
                  className="p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
};

