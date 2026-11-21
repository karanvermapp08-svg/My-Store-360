import React, { useMemo, useState } from 'react';
import {
  Trash2,
  RotateCcw,
  Repeat,
  Upload,
  ShieldCheck,
  Play,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Download,
  Target,
  Calculator,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import {
  MY_STORE_DATA_VERSION,
  calculateRealProfitSummary,
  parseCsvText,
  validateBackupPayload,
  validateEmail,
  validateGSTIN,
  validatePhone,
} from '../utils/erpEngine';

type ToolsTab = 'recycle-bin' | 'recurring' | 'csv-import' | 'integrity' | 'targets' | 'calculators';

export const ErpToolsView: React.FC = () => {
  const {
    recycleBin,
    restoreFromRecycleBin,
    permanentlyDeleteFromRecycleBin,
    emptyRecycleBin,
    requestConfirmation,
    recurringTemplates,
    addRecurringTemplate,
    toggleRecurringTemplate,
    deleteRecurringTemplate,
    runDueRecurringTransactions,
    addBulkImportRecords,
    transactions,
    items,
    parties,
    journalVouchers,
    company,
    settings,
    restoreFullBackup,
    showToast,
  } = useVyapar();

  const [activeSubTab, setActiveSubTab] = useState<ToolsTab>('recycle-bin');

  // Recurring form
  const [recTitle, setRecTitle] = useState('');
  const [recType, setRecType] = useState<'Sale' | 'Expense' | 'Other Income'>('Expense');
  const [recParty, setRecParty] = useState('Shop Landlord / Maintenance');
  const [recAmount, setRecAmount] = useState('15000');
  const [recFreq, setRecFreq] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly'>('Monthly');
  const [recDate, setRecDate] = useState(() => new Date().toISOString().slice(0, 10));

  // CSV Import state
  const [importTarget, setImportTarget] = useState<'customers' | 'suppliers' | 'items'>('customers');
  const [csvRawText, setCsvRawText] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [colMap, setColMap] = useState<Record<string, number>>({});

  // Diagnostics trigger
  const [diagnosticsRunAt, setDiagnosticsRunAt] = useState<string | null>(null);

  // Persisted Targets & Budgets
  const [targets, setTargets] = useState<{
    salesTarget: number;
    purchaseBudget: number;
    expenseBudget: number;
    profitTarget: number;
  }>(() => {
    try {
      const raw = localStorage.getItem('bm360_targets_budgets');
      return raw
        ? JSON.parse(raw)
        : { salesTarget: 250000, purchaseBudget: 150000, expenseBudget: 35000, profitTarget: 65000 };
    } catch {
      return { salesTarget: 250000, purchaseBudget: 150000, expenseBudget: 35000, profitTarget: 65000 };
    }
  });

  const updateTargetField = (key: keyof typeof targets, val: number) => {
    setTargets((prev) => {
      const next = { ...prev, [key]: Math.max(0, val) };
      try {
        localStorage.setItem('bm360_targets_budgets', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Interactive Business Calculators state
  const [gstBaseAmount, setGstBaseAmount] = useState('1000');
  const [gstRate, setGstRate] = useState('18');
  const [gstMode, setGstMode] = useState<'exclusive' | 'inclusive'>('exclusive');
  const [calcCostPrice, setCalcCostPrice] = useState('800');
  const [calcSellPrice, setCalcSellPrice] = useState('1000');
  const [calcLoanAmt, setCalcLoanAmt] = useState('100000');
  const [calcInterestPct, setCalcInterestPct] = useState('10');
  const [calcTenureMonths, setCalcTenureMonths] = useState('12');

  const actualSummary = useMemo(
    () => calculateRealProfitSummary(transactions, items),
    [transactions, items]
  );

  const handleLoadSampleCsv = () => {
    const sample =
      importTarget === 'items'
        ? 'Item Name,SKU,Category,Sale Price,Purchase Price,Stock,Unit,GST%\nTata Salt 1kg,SALT-1K,Groceries,28,22,120,PKT,0\nAmul Taaza Milk 1L,MILK-1L,Dairy,72,64,45,PKT,5'
        : `${importTarget === 'suppliers' ? 'Supplier' : 'Customer'} Name,Phone,Email,GSTIN,Address,Balance\nRamesh Traders,9876543210,ramesh@traders.in,29ABCDE1234F1Z5,MG Road Bengaluru,1500`;
    setCsvRawText(sample);
    handleParseCsv(sample);
  };

  const handleParseCsv = (text: string) => {
    const { headers, rows } = parseCsvText(text);
    setCsvHeaders(headers);
    setCsvRows(rows);
    const autoMap: Record<string, number> = {};
    headers.forEach((h, idx) => {
      const lower = h.toLowerCase();
      if (lower.includes('name')) autoMap.name = idx;
      else if (lower.includes('phone') || lower.includes('mobile')) autoMap.phone = idx;
      else if (lower.includes('email')) autoMap.email = idx;
      else if (lower.includes('gst')) autoMap.gstin = idx;
      else if (lower.includes('address')) autoMap.address = idx;
      else if (lower.includes('balance')) autoMap.balance = idx;
      else if (lower.includes('sku') || lower.includes('code')) autoMap.code = idx;
      else if (lower.includes('cat')) autoMap.category = idx;
      else if (lower.includes('sale')) autoMap.salePrice = idx;
      else if (lower.includes('purchase') || lower.includes('cost')) autoMap.purchasePrice = idx;
      else if (lower.includes('stock') || lower.includes('qty')) autoMap.stock = idx;
      else if (lower.includes('unit')) autoMap.unit = idx;
      else if (lower.includes('tax')) autoMap.taxRate = idx;
    });
    setColMap(autoMap);
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || '');
      setCsvRawText(text);
      handleParseCsv(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const previewValidation = useMemo(() => {
    return csvRows.map((row, idx) => {
      const errors: string[] = [];
      const name = row[colMap.name ?? 0]?.trim() || '';
      if (!name) errors.push('Missing Name');

      if (importTarget === 'items') {
        const salePrice = Number(row[colMap.salePrice ?? 3]);
        if (Number.isNaN(salePrice) || salePrice < 0) errors.push('Invalid Sale Price');
        return {
          rowIndex: idx + 1,
          valid: errors.length === 0,
          errors,
          record: {
            name,
            code: row[colMap.code ?? 1] || `SKU-${idx + 1}`,
            category: row[colMap.category ?? 2] || 'General',
            salePrice: salePrice || 0,
            purchasePrice: Number(row[colMap.purchasePrice ?? 4]) || 0,
            stock: Number(row[colMap.stock ?? 5]) || 0,
            unit: row[colMap.unit ?? 6] || 'PCS',
            taxRate: Number(row[colMap.taxRate ?? 7]) || 0,
          },
        };
      } else {
        const phone = row[colMap.phone ?? 1]?.trim() || '';
        const email = row[colMap.email ?? 2]?.trim() || '';
        const gstin = row[colMap.gstin ?? 3]?.trim() || '';
        if (phone && !validatePhone(phone)) errors.push('Invalid Phone');
        if (email && !validateEmail(email)) errors.push('Invalid Email');
        if (gstin && !validateGSTIN(gstin)) errors.push('Invalid GSTIN');
        return {
          rowIndex: idx + 1,
          valid: errors.length === 0,
          errors,
          record: {
            name,
            phone,
            email,
            gstin,
            address: row[colMap.address ?? 4] || '',
            balance: Number(row[colMap.balance ?? 5]) || 0,
          },
        };
      }
    });
  }, [csvRows, colMap, importTarget]);

  const handleConfirmImport = () => {
    const validRecords = previewValidation.filter((r) => r.valid).map((r) => r.record);
    if (validRecords.length === 0) {
      showToast('No valid rows found to import.', 'warning');
      return;
    }
    addBulkImportRecords(importTarget, validRecords);
    setCsvRawText('');
    setCsvHeaders([]);
    setCsvRows([]);
  };

  // Integrity Check Diagnostics
  const integrityReport = useMemo(() => {
    const negativeStock = items.filter((i) => (i.stock || 0) < 0);
    const unbalancedVouchers = journalVouchers.filter(
      (jv) => Math.abs((jv.totalDebit || 0) - (jv.totalCredit || 0)) > 0.05
    );
    const seenInv = new Map<string, number>();
    const duplicates: string[] = [];
    transactions
      .filter((t) => !t.isCancelled)
      .forEach((t) => {
        const k = `${t.type}:${t.invoiceNo}`;
        seenInv.set(k, (seenInv.get(k) || 0) + 1);
        if (seenInv.get(k) === 2) duplicates.push(k);
      });
    const partyNames = new Set(parties.map((p) => p.name.toLowerCase()));
    const orphanRefs = transactions.filter(
      (t) => t.partyName && !partyNames.has(t.partyName.toLowerCase()) && t.type === 'Sale'
    );

    return {
      negativeStock,
      unbalancedVouchers,
      duplicates,
      orphanRefs,
      totalIssues:
        negativeStock.length + unbalancedVouchers.length + duplicates.length + orphanRefs.length,
    };
  }, [items, journalVouchers, transactions, parties, diagnosticsRunAt]);

  const handleCreateRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recTitle.trim()) {
      showToast('Enter recurring template title', 'warning');
      return;
    }
    addRecurringTemplate({
      title: recTitle.trim(),
      txType: recType,
      partyName: recParty.trim() || 'Cash Sale',
      amount: Math.max(1, Number(recAmount) || 0),
      paymentType: 'Bank Transfer',
      frequency: recFreq,
      nextRunDate: recDate,
      isActive: true,
    });
    setRecTitle('');
  };

  const handleExportMyStoreBackup = () => {
    const today = new Date().toISOString().slice(0, 10);
    const backup = {
      app: 'MY STORE',
      schemaVersion: MY_STORE_DATA_VERSION,
      exportDate: new Date().toISOString(),
      company,
      settings,
      transactions,
      parties,
      items,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `MY_STORE_BACKUP_${today}.json`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Downloaded MY_STORE_BACKUP_${today}.json`);
  };

  const handleValidatedRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || ''));
        const check = validateBackupPayload(parsed);
        if (!check.valid) {
          showToast(check.error || 'Backup validation failed', 'error');
          return;
        }
        await restoreFullBackup(parsed);
        showToast('Validated backup restored cleanly!', 'success');
      } catch {
        showToast('Invalid JSON backup file.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex-1 bg-[#f5f6fa] dark:bg-slate-950 flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-100 select-none">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8B0D1E] text-white flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">
              ERP Utilities: Recycle Bin, Recurring, CSV Import &amp; Integrity
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Soft-delete recovery, automated recurring bills, validated CSV bulk importer &amp; DB health check
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center gap-5 shrink-0 overflow-x-auto font-semibold">
        {(
          [
            { id: 'recycle-bin', label: `Recycle Bin (${recycleBin.length})`, icon: Trash2 },
            { id: 'recurring', label: `Recurring Bills (${recurringTemplates.length})`, icon: Repeat },
            { id: 'csv-import', label: 'CSV Bulk Import Center', icon: Upload },
            { id: 'integrity', label: 'Integrity & Backup Health', icon: ShieldCheck },
            { id: 'targets', label: 'Targets & Budgets', icon: Target },
            { id: 'calculators', label: 'GST & Margin Calculators', icon: Calculator },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`py-3 flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
                active
                  ? 'border-[#8B0D1E] text-[#8B0D1E] dark:text-rose-400 font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* 1. RECYCLE BIN */}
        {activeSubTab === 'recycle-bin' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Soft-Deleted Records (Safe Recovery)</h3>
                <p className="text-[11px] text-slate-500">
                  Deleted invoices, customers, suppliers, and items are stored here until restored or permanently purged.
                </p>
              </div>
              {recycleBin.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    requestConfirmation({
                      title: 'Empty Recycle Bin?',
                      message: `Permanently delete all ${recycleBin.length} record(s) from the Recycle Bin? This cannot be undone.`,
                      confirmLabel: 'Empty Permanently',
                      variant: 'danger',
                      onConfirm: emptyRecycleBin,
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                >
                  Empty Recycle Bin
                </button>
              )}
            </div>

            {recycleBin.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                Recycle Bin is empty. Deleted records can be recovered from here.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Record</th>
                    <th className="py-2.5 px-4">Details</th>
                    <th className="py-2.5 px-4">Deleted By</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recycleBin.map((rec) => (
                    <tr key={rec.id}>
                      <td className="py-2.5 px-4 font-bold">{rec.entityType}</td>
                      <td className="py-2.5 px-4 font-semibold">{rec.label}</td>
                      <td className="py-2.5 px-4 text-slate-500">{rec.subLabel}</td>
                      <td className="py-2.5 px-4 text-slate-500">{rec.deletedBy}</td>
                      <td className="py-2.5 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => restoreFromRecycleBin(rec.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> Restore
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            requestConfirmation({
                              title: 'Permanently Delete Record?',
                              message: `Permanently purge "${rec.label}"?`,
                              confirmLabel: 'Delete Forever',
                              variant: 'danger',
                              onConfirm: () => permanentlyDeleteFromRecycleBin(rec.id),
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Purge
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 2. RECURRING TRANSACTIONS */}
        {activeSubTab === 'recurring' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-sm">Scheduled Recurring Templates</h3>
                <button
                  type="button"
                  onClick={() => {
                    const count = runDueRecurringTransactions();
                    if (count === 0) showToast('No recurring schedules due today.', 'info');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" /> Run Due Now
                </button>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-2.5 px-4">Title</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Frequency</th>
                    <th className="py-2.5 px-4">Next Run</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recurringTemplates.map((tpl) => (
                    <tr key={tpl.id}>
                      <td className="py-2.5 px-4 font-bold">{tpl.title}</td>
                      <td className="py-2.5 px-4">{tpl.txType}</td>
                      <td className="py-2.5 px-4">{tpl.frequency}</td>
                      <td className="py-2.5 px-4 font-mono">{tpl.nextRunDate}</td>
                      <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                        ₹{tpl.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleRecurringTemplate(tpl.id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                            tpl.isActive
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {tpl.isActive ? 'Active' : 'Paused'}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            requestConfirmation({
                              title: 'Remove Recurring Schedule?',
                              message: `Delete "${tpl.title}"? Past posted transactions will remain untouched.`,
                              confirmLabel: 'Delete',
                              variant: 'warning',
                              onConfirm: () => deleteRecurringTemplate(tpl.id),
                            })
                          }
                          className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form
              onSubmit={handleCreateRecurring}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-3 h-fit"
            >
              <h3 className="font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                Add Recurring Schedule
              </h3>
              <div>
                <label className="block font-semibold mb-1">Template Title *</label>
                <input
                  type="text"
                  value={recTitle}
                  onChange={(e) => setRecTitle(e.target.value)}
                  placeholder="e.g. Monthly Store Rent"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Type</label>
                  <select
                    value={recType}
                    onChange={(e) => setRecType(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="Expense">Expense</option>
                    <option value="Sale">Sale</option>
                    <option value="Other Income">Other Income</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Frequency</label>
                  <select
                    value={recFreq}
                    onChange={(e) => setRecFreq(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Party / Payee</label>
                <input
                  type="text"
                  value={recParty}
                  onChange={(e) => setRecParty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min={1}
                    value={recAmount}
                    onChange={(e) => setRecAmount(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Next Run Date</label>
                  <input
                    type="date"
                    value={recDate}
                    onChange={(e) => setRecDate(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Save Recurring Rule
              </button>
            </form>
          </div>
        )}

        {/* 3. CSV BULK IMPORT CENTER */}
        {activeSubTab === 'csv-import' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold">Target Module:</span>
                {(['customers', 'suppliers', 'items'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setImportTarget(t);
                      setCsvHeaders([]);
                      setCsvRows([]);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold capitalize cursor-pointer ${
                      importTarget === t
                        ? 'bg-[#8B0D1E] text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadSampleCsv}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Load Sample CSV
                </button>
                <label className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer">
                  Upload .CSV File
                  <input type="file" accept=".csv,text/csv" onChange={handleCsvFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            <textarea
              value={csvRawText}
              onChange={(e) => {
                setCsvRawText(e.target.value);
                handleParseCsv(e.target.value);
              }}
              rows={4}
              placeholder="Paste CSV rows here (with header row) or upload a .csv file..."
              className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-[11px]"
            />

            {csvHeaders.length > 0 && (
              <div className="space-y-3">
                <div className="text-[11px] font-bold text-slate-500 uppercase">
                  Column Mapping ({csvRows.length} rows detected)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(importTarget === 'items'
                    ? ['name', 'code', 'category', 'salePrice', 'purchasePrice', 'stock', 'unit', 'taxRate']
                    : ['name', 'phone', 'email', 'gstin', 'address', 'balance']
                  ).map((field) => (
                    <div key={field} className="p-2 rounded border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">{field}</div>
                      <select
                        value={colMap[field] ?? ''}
                        onChange={(e) =>
                          setColMap((prev) => ({
                            ...prev,
                            [field]: e.target.value === '' ? -1 : Number(e.target.value),
                          }))
                        }
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-[11px]"
                      >
                        <option value="">-- Unmapped --</option>
                        {csvHeaders.map((h, i) => (
                          <option key={`${h}-${i}`} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[11px]">
                      <tr>
                        <th className="py-2 px-3">Row #</th>
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {previewValidation.slice(0, 15).map((r) => (
                        <tr key={r.rowIndex}>
                          <td className="py-2 px-3 font-mono">{r.rowIndex}</td>
                          <td className="py-2 px-3 font-bold">{r.record.name || '—'}</td>
                          <td className="py-2 px-3">
                            {r.valid ? (
                              <span className="text-emerald-600 font-bold">Valid</span>
                            ) : (
                              <span className="text-rose-600 font-bold">{r.errors.join(', ')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">
                    Valid: <strong>{previewValidation.filter((r) => r.valid).length}</strong> &bull; Errors:{' '}
                    <strong>{previewValidation.filter((r) => !r.valid).length}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                  >
                    Import Valid Records
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. DATA INTEGRITY & BACKUP HEALTH */}
        {activeSubTab === 'integrity' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">Database Health &amp; Integrity Check</h3>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] font-bold">
                    Schema v{MY_STORE_DATA_VERSION}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Scans for negative inventory balances, unbalanced journal vouchers, duplicate invoice numbers &amp; broken party refs.
                  {diagnosticsRunAt ? ` Last scanned: ${diagnosticsRunAt}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setDiagnosticsRunAt(new Date().toLocaleTimeString());
                    showToast(
                      integrityReport.totalIssues === 0
                        ? 'Integrity check passed: 0 anomalies found!'
                        : `Integrity check found ${integrityReport.totalIssues} item(s) to review.`,
                      integrityReport.totalIssues === 0 ? 'success' : 'warning'
                    );
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white font-bold cursor-pointer"
                >
                  Run Diagnostics
                </button>
                <button
                  type="button"
                  onClick={handleExportMyStoreBackup}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> MY_STORE_BACKUP.json
                </button>
                <label className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer">
                  Validated Restore
                  <input type="file" accept=".json" onChange={handleValidatedRestore} className="hidden" />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Negative Stock Items', count: integrityReport.negativeStock.length },
                { label: 'Unbalanced Journals', count: integrityReport.unbalancedVouchers.length },
                { label: 'Duplicate Invoices', count: integrityReport.duplicates.length },
                { label: 'Orphan Party Refs', count: integrityReport.orphanRefs.length },
              ].map((check) => (
                <div
                  key={check.label}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="text-[11px] text-slate-500 font-semibold">{check.label}</div>
                    <div className="text-xl font-extrabold tabular-nums mt-1">{check.count}</div>
                  </div>
                  {check.count === 0 ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-500" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. TARGETS & BUDGETS */}
        {activeSubTab === 'targets' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm">Monthly Financial Targets &amp; Budgets</h3>
                <p className="text-[11px] text-slate-500">
                  Track Sales Target, Purchase Budget, Expense Cap, and Profit Goal against live business actuals
                </p>
              </div>
              <button
                type="button"
                onClick={() => showToast('Targets & budgets saved locally.')}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
              >
                Save Goals
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  { key: 'salesTarget', label: 'Sales Target', actual: actualSummary.salesRevenue, isCap: false },
                  { key: 'profitTarget', label: 'Net Profit Target', actual: Math.max(0, actualSummary.netProfit), isCap: false },
                  { key: 'purchaseBudget', label: 'Purchase Budget Cap', actual: actualSummary.totalPurchases, isCap: true },
                  { key: 'expenseBudget', label: 'Operating Expense Budget', actual: actualSummary.totalExpenses, isCap: true },
                ] as const
              ).map((item) => {
                const targetVal = targets[item.key] || 1;
                const pct = Math.min(100, Math.round((item.actual / targetVal) * 100));
                const overBudget = item.isCap && item.actual > targetVal;
                return (
                  <div
                    key={item.key}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm">{item.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          overBudget
                            ? 'bg-rose-100 text-rose-700'
                            : pct >= 100 && !item.isCap
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {overBudget ? 'Over Budget' : `${pct}% Achieved`}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-center">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Target / Budget (₹)</label>
                        <input
                          type="number"
                          value={targets[item.key]}
                          onChange={(e) => updateTargetField(item.key, Number(e.target.value) || 0)}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold tabular-nums"
                        />
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Live Actual</div>
                        <div className="text-base font-extrabold tabular-nums">
                          ₹ {item.actual.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          overBudget ? 'bg-rose-500' : item.isCap ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="text-[11px] text-slate-500 flex justify-between">
                      <span>{item.isCap ? 'Remaining Budget' : 'Remaining to Goal'}</span>
                      <strong className="tabular-nums">
                        ₹ {Math.max(0, targetVal - item.actual).toLocaleString('en-IN')}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. BUSINESS CALCULATORS */}
        {activeSubTab === 'calculators' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* GST Inclusive / Exclusive Calculator */}
            {(() => {
              const amt = Math.max(0, Number(gstBaseAmount) || 0);
              const rate = Math.max(0, Number(gstRate) || 0);
              const taxable = gstMode === 'exclusive' ? amt : amt / (1 + rate / 100);
              const totalGst = gstMode === 'exclusive' ? (amt * rate) / 100 : amt - taxable;
              const grandTotal = taxable + totalGst;
              return (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
                  <h3 className="font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                    GST &amp; Reverse Tax Calculator
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGstMode('exclusive')}
                      className={`py-1.5 rounded-lg font-bold border cursor-pointer ${
                        gstMode === 'exclusive' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      Add GST (+Tax)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGstMode('inclusive')}
                      className={`py-1.5 rounded-lg font-bold border cursor-pointer ${
                        gstMode === 'inclusive' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      Remove GST (Reverse)
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold block mb-1">Amount (₹)</label>
                      <input
                        type="number"
                        value={gstBaseAmount}
                        onChange={(e) => setGstBaseAmount(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold block mb-1">GST Slab (%)</label>
                      <select
                        value={gstRate}
                        onChange={(e) => setGstRate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span>Taxable Base:</span>
                      <strong className="tabular-nums">₹ {taxable.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>CGST ({Number(gstRate) / 2}%) + SGST ({Number(gstRate) / 2}%):</span>
                      <strong className="tabular-nums">₹ {(totalGst / 2).toFixed(2)} + ₹ {(totalGst / 2).toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-700 text-sm font-extrabold text-emerald-600">
                      <span>Total Amount:</span>
                      <span className="tabular-nums">₹ {grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Profit, Margin & Markup Calculator */}
            {(() => {
              const cost = Math.max(0, Number(calcCostPrice) || 0);
              const sell = Math.max(0, Number(calcSellPrice) || 0);
              const profit = sell - cost;
              const markupPct = cost > 0 ? (profit / cost) * 100 : 0;
              const marginPct = sell > 0 ? (profit / sell) * 100 : 0;
              return (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
                  <h3 className="font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                    Profit, Margin &amp; Markup Calculator
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold block mb-1">Purchase / Cost (₹)</label>
                      <input
                        type="number"
                        value={calcCostPrice}
                        onChange={(e) => setCalcCostPrice(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold block mb-1">Selling Price (₹)</label>
                      <input
                        type="number"
                        value={calcSellPrice}
                        onChange={(e) => setCalcSellPrice(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                      />
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span>Net Profit / Unit:</span>
                      <strong className={`tabular-nums ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ₹ {profit.toFixed(2)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Profit Margin (% of Sale):</span>
                      <strong className="tabular-nums">{marginPct.toFixed(2)}%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Markup (% over Cost):</span>
                      <strong className="tabular-nums">{markupPct.toFixed(2)}%</strong>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* EMI / Working Capital Loan Calculator */}
            {(() => {
              const P = Math.max(0, Number(calcLoanAmt) || 0);
              const annualRate = Math.max(0, Number(calcInterestPct) || 0);
              const n = Math.max(1, Number(calcTenureMonths) || 1);
              const r = annualRate / 12 / 100;
              const emi = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
              const totalPay = emi * n;
              const totalInterest = totalPay - P;
              return (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
                  <h3 className="font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                    Business Loan &amp; EMI Calculator
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold block mb-1">Principal (₹)</label>
                      <input
                        type="number"
                        value={calcLoanAmt}
                        onChange={(e) => setCalcLoanAmt(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold block mb-1">Rate % p.a.</label>
                      <input
                        type="number"
                        value={calcInterestPct}
                        onChange={(e) => setCalcInterestPct(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold block mb-1">Months</label>
                      <input
                        type="number"
                        value={calcTenureMonths}
                        onChange={(e) => setCalcTenureMonths(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                      />
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 space-y-1.5 text-xs">
                    <div className="flex justify-between text-sm font-extrabold text-blue-600 dark:text-blue-400">
                      <span>Monthly EMI:</span>
                      <span className="tabular-nums">₹ {emi.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Interest:</span>
                      <strong className="tabular-nums">₹ {totalInterest.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Repayment:</span>
                      <strong className="tabular-nums">₹ {totalPay.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
