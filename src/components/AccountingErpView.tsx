import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Plus,
  ArrowLeftRight,
  Scale,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  FileSpreadsheet,
  Eye,
  X,
  Download,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { AccountGroupType, AccountRecord, JournalLine } from '../types';
import {
  calculateRealProfitSummary,
  getAgingBucket,
  getDaysOverdue,
} from '../utils/erpEngine';

type AccountingTab = 'accounts' | 'journals' | 'contra' | 'trial-balance' | 'statements' | 'aging';

export const AccountingErpView: React.FC = () => {
  const {
    accounts,
    journalVouchers,
    transactions,
    items,
    addAccount,
    updateAccount,
    createJournalVoucher,
    executeContraVoucher,
    showToast,
  } = useVyapar();

  const [activeSubTab, setActiveSubTab] = useState<AccountingTab>('accounts');

  // Add Account state
  const [accCode, setAccCode] = useState('');
  const [accName, setAccName] = useState('');
  const [accGroup, setAccGroup] = useState<AccountGroupType>('Expenses');
  const [accSubType, setAccSubType] = useState('Indirect Expense');
  const [accOpening, setAccOpening] = useState('0');

  // New Journal Voucher state
  const [jvDate, setJvDate] = useState(() => new Date().toLocaleDateString('en-GB'));
  const [jvNarration, setJvNarration] = useState('');
  const [jvRef, setJvRef] = useState('');
  const [jvLines, setJvLines] = useState<JournalLine[]>([
    { id: 'jl-new-1', accountId: 'acc-exp', accountName: 'Operating Expenses', debit: 0, credit: 0 },
    { id: 'jl-new-2', accountId: 'acc-cash', accountName: 'Cash in Hand', debit: 0, credit: 0 },
  ]);

  // Contra Voucher state
  const [contraDir, setContraDir] = useState<'CASH_TO_BANK' | 'BANK_TO_CASH'>('CASH_TO_BANK');
  const [contraAmount, setContraAmount] = useState('');
  const [contraRef, setContraRef] = useState('');

  // Aging filter
  const [agingType, setAgingType] = useState<'Receivables' | 'Payables'>('Receivables');
  // Account Ledger Drilldown
  const [ledgerAccountId, setLedgerAccountId] = useState<string | null>(null);

  const fmt = (n: number) =>
    '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Compute live account balances by applying journal vouchers over opening balances
  const accountBalances = useMemo(() => {
    const debitSum = new Map<string, number>();
    const creditSum = new Map<string, number>();

    journalVouchers.forEach((jv) => {
      jv.lines.forEach((line) => {
        debitSum.set(line.accountId, (debitSum.get(line.accountId) || 0) + (line.debit || 0));
        creditSum.set(line.accountId, (creditSum.get(line.accountId) || 0) + (line.credit || 0));
      });
    });

    return accounts.map((acc) => {
      const dr = debitSum.get(acc.id) || 0;
      const cr = creditSum.get(acc.id) || 0;
      const openingDr = acc.normalBalance === 'Debit' ? acc.openingBalance : 0;
      const openingCr = acc.normalBalance === 'Credit' ? acc.openingBalance : 0;
      const net =
        acc.normalBalance === 'Debit'
          ? openingDr + dr - (openingCr + cr)
          : openingCr + cr - (openingDr + dr);
      const closingDr = acc.normalBalance === 'Debit' && net >= 0 ? net : acc.normalBalance === 'Credit' && net < 0 ? Math.abs(net) : 0;
      const closingCr = acc.normalBalance === 'Credit' && net >= 0 ? net : acc.normalBalance === 'Debit' && net < 0 ? Math.abs(net) : 0;

      return {
        ...acc,
        periodDebit: dr,
        periodCredit: cr,
        netBalance: net,
        closingDr,
        closingCr,
      };
    });
  }, [accounts, journalVouchers]);

  const profitSummary = useMemo(
    () => calculateRealProfitSummary(transactions, items),
    [transactions, items]
  );

  const cashAccountBalance = accountBalances.find((a) => a.id === 'acc-cash')?.netBalance ?? 0;
  const bankAccountBalance = accountBalances.find((a) => a.id === 'acc-bank')?.netBalance ?? 0;

  const trialTotals = useMemo(() => {
    const totalDr = accountBalances.reduce((s, a) => s + a.closingDr, 0);
    const totalCr = accountBalances.reduce((s, a) => s + a.closingCr, 0);
    return {
      totalDr: Math.round(totalDr * 100) / 100,
      totalCr: Math.round(totalCr * 100) / 100,
      isBalanced: Math.abs(totalDr - totalCr) < 0.1,
    };
  }, [accountBalances]);

  const selectedAccountLedger = useMemo(() => {
    if (!ledgerAccountId) return null;
    const acc = accountBalances.find((a) => a.id === ledgerAccountId);
    if (!acc) return null;
    const entries: Array<{
      id: string;
      date: string;
      voucherNo: string;
      voucherType: string;
      narration: string;
      debit: number;
      credit: number;
      runningBalance: number;
    }> = [];
    let running = acc.normalBalance === 'Debit' ? acc.openingBalance : -acc.openingBalance;
    const matchingVouchers = [...journalVouchers].reverse();
    matchingVouchers.forEach((jv) => {
      jv.lines.forEach((line) => {
        if (line.accountId !== acc.id) return;
        const dr = Number(line.debit) || 0;
        const cr = Number(line.credit) || 0;
        running += dr - cr;
        const displayBal = acc.normalBalance === 'Debit' ? running : -running;
        entries.push({
          id: `${jv.id}-${line.id}`,
          date: jv.date,
          voucherNo: jv.voucherNo,
          voucherType: jv.voucherType,
          narration: line.narration || jv.narration,
          debit: dr,
          credit: cr,
          runningBalance: displayBal,
        });
      });
    });
    return { acc, entries: entries.reverse() };
  }, [ledgerAccountId, accountBalances, journalVouchers]);

  const handleExportAccountLedgerCsv = () => {
    if (!selectedAccountLedger) return;
    const { acc, entries } = selectedAccountLedger;
    const header = ['Date', 'Voucher #', 'Type', 'Narration', 'Debit (INR)', 'Credit (INR)', 'Running Balance (INR)'];
    const rows = entries.map((e) => [
      e.date,
      e.voucherNo,
      e.voucherType,
      `"${e.narration.replace(/"/g, '""')}"`,
      e.debit,
      e.credit,
      Math.round(e.runningBalance * 100) / 100,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-${acc.code}-${acc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ledger for ${acc.name} (${entries.length} entries).`, 'success');
  };

  // Outstanding Aging analysis
  const agingRows = useMemo(() => {
    const targetTxType = agingType === 'Receivables' ? 'Sale' : 'Purchase';
    return transactions
      .filter((t) => t.type === targetTxType && !t.isCancelled && (t.balance || 0) > 0)
      .map((tx) => {
        const overdueDays = getDaysOverdue(tx.dueDate || tx.date);
        const bucket = getAgingBucket(overdueDays);
        return {
          ...tx,
          overdueDays,
          bucket,
        };
      })
      .sort((a, b) => b.overdueDays - a.overdueDays);
  }, [transactions, agingType]);

  const agingBucketsSummary = useMemo(() => {
    const buckets: Record<'0-30 days' | '31-60 days' | '61-90 days' | '90+ days', number> = {
      '0-30 days': 0,
      '31-60 days': 0,
      '61-90 days': 0,
      '90+ days': 0,
    };
    agingRows.forEach((r) => {
      buckets[r.bucket] += r.balance || 0;
    });
    return buckets;
  }, [agingRows]);

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accCode.trim() || !accName.trim()) {
      showToast('Account code and name are required', 'warning');
      return;
    }
    const normalBalance: AccountRecord['normalBalance'] =
      accGroup === 'Assets' || accGroup === 'Expenses' ? 'Debit' : 'Credit';
    addAccount({
      code: accCode.trim(),
      name: accName.trim(),
      group: accGroup,
      subType: accSubType.trim() || accGroup,
      openingBalance: Math.max(0, Number(accOpening) || 0),
      normalBalance,
      isActive: true,
    });
    setAccCode('');
    setAccName('');
    setAccOpening('0');
  };

  const jvTotalDr = jvLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const jvTotalCr = jvLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const jvBalanced = jvTotalDr > 0 && Math.abs(jvTotalDr - jvTotalCr) < 0.01;

  const handleAddJvLine = () => {
    const fallbackAcc = accounts[0];
    setJvLines((prev) => [
      ...prev,
      {
        id: `jl-${Date.now()}-${prev.length}`,
        accountId: fallbackAcc?.id || 'acc-cash',
        accountName: fallbackAcc?.name || 'Cash in Hand',
        debit: 0,
        credit: 0,
      },
    ]);
  };

  const handleUpdateJvLine = (idx: number, patch: Partial<JournalLine>) => {
    setJvLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const next = { ...l, ...patch };
        if (patch.accountId) {
          const acc = accounts.find((a) => a.id === patch.accountId);
          if (acc) next.accountName = acc.name;
        }
        return next;
      })
    );
  };

  const handleCreateJv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jvBalanced) {
      showToast('Journal voucher must have equal Debit and Credit totals (> ₹0).', 'error');
      return;
    }
    const cleanedLines = jvLines.filter((l) => (l.debit || 0) > 0 || (l.credit || 0) > 0);
    const res = createJournalVoucher({
      voucherNo: `JV-${Date.now().toString().slice(-5)}`,
      date: jvDate || new Date().toLocaleDateString('en-GB'),
      voucherType: 'Journal',
      referenceNo: jvRef.trim() || undefined,
      narration: jvNarration.trim() || 'Manual Journal Adjustment',
      lines: cleanedLines,
      totalDebit: jvTotalDr,
      totalCredit: jvTotalCr,
    });
    if (res.success) {
      setJvNarration('');
      setJvRef('');
      setJvLines([
        { id: `jl-r1-${Date.now()}`, accountId: 'acc-exp', accountName: 'Operating Expenses', debit: 0, credit: 0 },
        { id: `jl-r2-${Date.now()}`, accountId: 'acc-cash', accountName: 'Cash in Hand', debit: 0, credit: 0 },
      ]);
    }
  };

  const handleContraSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(contraAmount) || 0;
    const res = executeContraVoucher(contraDir, amt, contraRef.trim() || undefined);
    if (res.success) {
      setContraAmount('');
      setContraRef('');
    }
  };

  // Group accounts for tree view
  const accountGroups: AccountGroupType[] = ['Assets', 'Liabilities', 'Capital', 'Income', 'Expenses'];

  const balanceSheetStats = useMemo(() => {
    const sumGroup = (grp: AccountGroupType) =>
      accountBalances
        .filter((a) => a.group === grp)
        .reduce((s, a) => s + a.netBalance, 0);
    const totalAssets = sumGroup('Assets');
    const totalLiabilities = sumGroup('Liabilities');
    const totalCapital = sumGroup('Capital');
    return {
      totalAssets,
      totalLiabilities,
      totalCapital,
      netEquityAndLiab: totalLiabilities + totalCapital + profitSummary.netProfit,
    };
  }, [accountBalances, profitSummary.netProfit]);

  return (
    <div className="flex-1 bg-[#f5f6fa] dark:bg-slate-950 flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-100 select-none">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8B0D1E] text-white flex items-center justify-center shadow-xs">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">
              Double-Entry Accounting &amp; Financial Statements
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Chart of Accounts, Auto-Posted Journals, Contra Transfers, Trial Balance, P&amp;L &amp; Aging
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-right">
            <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">Real Net Profit</div>
            <div className="font-extrabold text-sm text-emerald-800 dark:text-emerald-200 tabular-nums">
              {fmt(profitSummary.netProfit)}
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-right">
            <div className="text-[10px] font-semibold text-blue-700 dark:text-blue-300">Cash + Bank</div>
            <div className="font-extrabold text-sm text-blue-800 dark:text-blue-200 tabular-nums">
              {fmt(cashAccountBalance + bankAccountBalance)}
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center gap-5 shrink-0 overflow-x-auto font-semibold">
        {(
          [
            { id: 'accounts', label: 'Chart of Accounts', icon: BookOpen },
            { id: 'journals', label: `Journal Vouchers (${journalVouchers.length})`, icon: FileSpreadsheet },
            { id: 'contra', label: 'Contra (Cash ↔ Bank)', icon: ArrowLeftRight },
            { id: 'trial-balance', label: 'Trial Balance', icon: Scale },
            { id: 'statements', label: 'P&L & Balance Sheet', icon: TrendingUp },
            { id: 'aging', label: 'Outstanding & Aging', icon: Clock },
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

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* 1. CHART OF ACCOUNTS */}
        {activeSubTab === 'accounts' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              {accountGroups.map((grp) => {
                const grpAccs = accountBalances.filter((a) => a.group === grp);
                return (
                  <div
                    key={grp}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs"
                  >
                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        {grp} ({grpAccs.length})
                      </span>
                      <span className="text-[11px] font-bold text-slate-900 dark:text-white tabular-nums">
                        {fmt(grpAccs.reduce((s, a) => s + a.netBalance, 0))}
                      </span>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="py-2 px-4">Code</th>
                          <th className="py-2 px-4">Account Name</th>
                          <th className="py-2 px-4">Sub-Type</th>
                          <th className="py-2 px-4 text-right">Opening</th>
                          <th className="py-2 px-4 text-right">Current Balance</th>
                          <th className="py-2 px-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {grpAccs.map((acc) => (
                          <tr
                            key={acc.id}
                            onClick={() => setLedgerAccountId(acc.id)}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer"
                          >
                            <td className="py-2.5 px-4 font-mono text-slate-500 dark:text-slate-400">{acc.code}</td>
                            <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{acc.name}</span>
                              <Eye className="w-3 h-3 text-slate-400" />
                            </td>
                            <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">{acc.subType}</td>
                            <td className="py-2.5 px-4 text-right tabular-nums">{fmt(acc.openingBalance)}</td>
                            <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                              {fmt(acc.netBalance)} ({acc.normalBalance === 'Debit' ? 'Dr' : 'Cr'})
                            </td>
                            <td
                              className="py-2.5 px-4 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => updateAccount(acc.id, { isActive: !acc.isActive })}
                                className={`px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer ${
                                  acc.isActive
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900'
                                    : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                              >
                                {acc.isActive ? 'Active' : 'Inactive'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            {/* Add Account Form */}
            <form
              onSubmit={handleCreateAccount}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4 h-fit"
            >
              <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                Add New Ledger Account
              </h3>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Account Code *</label>
                <input
                  type="text"
                  value={accCode}
                  onChange={(e) => setAccCode(e.target.value)}
                  placeholder="e.g. 5201"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Account Name *</label>
                <input
                  type="text"
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  placeholder="e.g. Shop Electricity Expense"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Account Group</label>
                <select
                  value={accGroup}
                  onChange={(e) => setAccGroup(e.target.value as AccountGroupType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {accountGroups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Sub-Type</label>
                <input
                  type="text"
                  value={accSubType}
                  onChange={(e) => setAccSubType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Opening Balance (₹)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={accOpening}
                  onChange={(e) => setAccOpening(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Ledger Account</span>
              </button>
            </form>
          </div>
        )}

        {/* 2. JOURNAL VOUCHERS */}
        {activeSubTab === 'journals' && (
          <div className="space-y-5">
            {/* Manual Journal Entry Builder */}
            <form
              onSubmit={handleCreateJv}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Create Balanced Journal Voucher
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                    jvBalanced
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}
                >
                  {jvBalanced ? 'Balanced (Dr = Cr)' : `Difference: ${fmt(Math.abs(jvTotalDr - jvTotalCr))}`}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Voucher Date</label>
                  <input
                    type="text"
                    value={jvDate}
                    onChange={(e) => setJvDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Reference #</label>
                  <input
                    type="text"
                    value={jvRef}
                    onChange={(e) => setJvRef(e.target.value)}
                    placeholder="Optional ref no"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Narration *</label>
                  <input
                    type="text"
                    value={jvNarration}
                    onChange={(e) => setJvNarration(e.target.value)}
                    placeholder="e.g. Depreciation / Month-end adjustment"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2 px-3">Account</th>
                      <th className="py-2 px-3 text-right">Debit (₹)</th>
                      <th className="py-2 px-3 text-right">Credit (₹)</th>
                      <th className="py-2 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {jvLines.map((line, idx) => (
                      <tr key={line.id}>
                        <td className="py-2 px-3">
                          <select
                            value={line.accountId}
                            onChange={(e) => handleUpdateJvLine(idx, { accountId: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                          >
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.code} - {acc.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.debit}
                            onChange={(e) => handleUpdateJvLine(idx, { debit: Number(e.target.value) || 0, credit: 0 })}
                            className="w-32 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-right tabular-nums"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.credit}
                            onChange={(e) => handleUpdateJvLine(idx, { credit: Number(e.target.value) || 0, debit: 0 })}
                            className="w-32 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-right tabular-nums"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          {jvLines.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setJvLines((prev) => prev.filter((_, i) => i !== idx))}
                              className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-bold border-t border-slate-200 dark:border-slate-700">
                    <tr>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={handleAddJvLine}
                          className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                        >
                          + Add Row
                        </button>
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmt(jvTotalDr)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmt(jvTotalCr)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!jvBalanced}
                  className={`px-5 py-2 rounded-lg font-bold text-white cursor-pointer ${
                    jvBalanced ? 'bg-[#8B0D1E] hover:bg-[#740918]' : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
                  }`}
                >
                  Post Journal Voucher
                </button>
              </div>
            </form>

            {/* Journal Ledger Register */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 font-bold text-sm">
                Posted Journal Entries Register
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
                {journalVouchers.map((jv) => (
                  <div key={jv.id} className="p-4 space-y-2 hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{jv.voucherNo}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                          {jv.voucherType}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">{jv.date}</span>
                      </div>
                      <div className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        Dr {fmt(jv.totalDebit)} / Cr {fmt(jv.totalCredit)}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">{jv.narration}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      {jv.lines.map((l) => (
                        <div key={l.id} className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{l.accountName}</span>
                          <span className="font-mono tabular-nums">
                            {l.debit > 0 ? `Dr ${fmt(l.debit)}` : `Cr ${fmt(l.credit)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. CONTRA VOUCHERS */}
        {activeSubTab === 'contra' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <form
              onSubmit={handleContraSubmit}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4 h-fit"
            >
              <h3 className="font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                Cash ↔ Bank Contra Transfer
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">Cash in Hand</div>
                  <div className="text-base font-extrabold tabular-nums mt-0.5">{fmt(cashAccountBalance)}</div>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
                  <div className="text-[10px] text-blue-700 dark:text-blue-300 font-bold">Primary Bank</div>
                  <div className="text-base font-extrabold tabular-nums mt-0.5">{fmt(bankAccountBalance)}</div>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Transfer Direction</label>
                <select
                  value={contraDir}
                  onChange={(e) => setContraDir(e.target.value as 'CASH_TO_BANK' | 'BANK_TO_CASH')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="CASH_TO_BANK">Deposit Cash → Bank Account</option>
                  <option value="BANK_TO_CASH">Withdraw Bank → Cash Drawer</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  required
                  value={contraAmount}
                  onChange={(e) => setContraAmount(e.target.value)}
                  placeholder="Enter transfer amount"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Slip / UTR Reference</label>
                <input
                  type="text"
                  value={contraRef}
                  onChange={(e) => setContraRef(e.target.value)}
                  placeholder="Optional reference number"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white font-bold cursor-pointer"
              >
                Post Contra Voucher
              </button>
            </form>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-3">
              <h3 className="font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                Recent Contra Transfers
              </h3>
              {journalVouchers.filter((v) => v.voucherType === 'Contra').length === 0 ? (
                <div className="text-slate-400 py-8 text-center">No contra transfers recorded yet.</div>
              ) : (
                <div className="space-y-2">
                  {journalVouchers
                    .filter((v) => v.voucherType === 'Contra')
                    .map((v) => (
                      <div
                        key={v.id}
                        className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold">{v.narration}</div>
                          <div className="text-[11px] text-slate-500">
                            {v.voucherNo} &bull; {v.date}
                          </div>
                        </div>
                        <div className="font-extrabold tabular-nums text-blue-600 dark:text-blue-400">
                          {fmt(v.totalDebit)}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. TRIAL BALANCE */}
        {activeSubTab === 'trial-balance' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm">Trial Balance Summary</h3>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold ${
                  trialTotals.isBalanced
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {trialTotals.isBalanced ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Books Balanced
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" /> Variance: {fmt(Math.abs(trialTotals.totalDr - trialTotals.totalCr))}
                  </>
                )}
              </span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-2.5 px-4">Code</th>
                  <th className="py-2.5 px-4">Ledger Account</th>
                  <th className="py-2.5 px-4">Group</th>
                  <th className="py-2.5 px-4 text-right">Debit Closing (₹)</th>
                  <th className="py-2.5 px-4 text-right">Credit Closing (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {accountBalances.map((acc) => (
                  <tr
                    key={acc.id}
                    onClick={() => setLedgerAccountId(acc.id)}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer"
                  >
                    <td className="py-2.5 px-4 font-mono text-slate-500">{acc.code}</td>
                    <td className="py-2.5 px-4 font-semibold flex items-center gap-1.5">
                      <span>{acc.name}</span>
                      <Eye className="w-3 h-3 text-slate-400" />
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">{acc.group}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-medium">
                      {acc.closingDr > 0 ? fmt(acc.closingDr) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-medium">
                      {acc.closingCr > 0 ? fmt(acc.closingCr) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 dark:bg-slate-800 font-extrabold border-t-2 border-slate-300 dark:border-slate-700">
                <tr>
                  <td colSpan={3} className="py-3 px-4 text-right">GRAND TOTAL</td>
                  <td className="py-3 px-4 text-right tabular-nums">{fmt(trialTotals.totalDr)}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{fmt(trialTotals.totalCr)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 5. PROFIT & LOSS + BALANCE SHEET */}
        {activeSubTab === 'statements' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Trading & Profit & Loss */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-3">
              <h3 className="font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                Trading &amp; Profit &amp; Loss Statement (Real COGS)
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span>Net Sales Revenue (after Sale Returns)</span>
                  <span className="font-bold tabular-nums">{fmt(profitSummary.salesRevenue)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-rose-600 dark:text-rose-400">
                  <span>Less: Cost of Goods Sold (COGS)</span>
                  <span className="font-bold tabular-nums">- {fmt(profitSummary.cogs)}</span>
                </div>
                <div className="flex justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 font-bold">
                  <span>Gross Profit ({profitSummary.grossMarginPercent}% Margin)</span>
                  <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(profitSummary.grossProfit)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span>Add: Other Operating &amp; Misc Income</span>
                  <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">+ {fmt(profitSummary.otherIncome)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-rose-600 dark:text-rose-400">
                  <span>Less: Operating Expenses</span>
                  <span className="font-bold tabular-nums">- {fmt(profitSummary.totalExpenses)}</span>
                </div>
                <div className="flex justify-between py-3 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 font-extrabold text-sm">
                  <span>Net Profit / (Loss)</span>
                  <span className="tabular-nums text-emerald-700 dark:text-emerald-300">{fmt(profitSummary.netProfit)}</span>
                </div>
              </div>
            </div>

            {/* Balance Sheet */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-3">
              <h3 className="font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                Balance Sheet Snapshot
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">Assets</div>
                  {accountBalances
                    .filter((a) => a.group === 'Assets')
                    .map((a) => (
                      <div key={a.id} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span>{a.name}</span>
                        <span className="font-semibold tabular-nums">{fmt(a.netBalance)}</span>
                      </div>
                    ))}
                  <div className="flex justify-between py-2 font-bold text-blue-700 dark:text-blue-400">
                    <span>Total Assets</span>
                    <span className="tabular-nums">{fmt(balanceSheetStats.totalAssets)}</span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">Liabilities &amp; Owner Equity</div>
                  {accountBalances
                    .filter((a) => a.group === 'Liabilities' || a.group === 'Capital')
                    .map((a) => (
                      <div key={a.id} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span>{a.name}</span>
                        <span className="font-semibold tabular-nums">{fmt(a.netBalance)}</span>
                      </div>
                    ))}
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span>Current Period Net Profit</span>
                    <span className="font-semibold tabular-nums">{fmt(profitSummary.netProfit)}</span>
                  </div>
                  <div className="flex justify-between py-2 font-bold text-emerald-700 dark:text-emerald-400">
                    <span>Total Liabilities &amp; Equity</span>
                    <span className="tabular-nums">{fmt(balanceSheetStats.netEquityAndLiab)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. RECEIVABLES & PAYABLES AGING */}
        {activeSubTab === 'aging' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAgingType('Receivables')}
                  className={`px-4 py-2 rounded-lg font-bold cursor-pointer ${
                    agingType === 'Receivables'
                      ? 'bg-[#8B0D1E] text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  Customer Receivables Aging
                </button>
                <button
                  type="button"
                  onClick={() => setAgingType('Payables')}
                  className={`px-4 py-2 rounded-lg font-bold cursor-pointer ${
                    agingType === 'Payables'
                      ? 'bg-[#8B0D1E] text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  Supplier Payables Aging
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(Object.keys(agingBucketsSummary) as Array<keyof typeof agingBucketsSummary>).map((bucket) => (
                <div
                  key={bucket}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4"
                >
                  <div className="text-[11px] font-semibold text-slate-500">{bucket}</div>
                  <div className="text-lg font-extrabold tabular-nums mt-1">{fmt(agingBucketsSummary[bucket])}</div>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-2.5 px-4">Invoice #</th>
                    <th className="py-2.5 px-4">Party</th>
                    <th className="py-2.5 px-4">Bill Date</th>
                    <th className="py-2.5 px-4">Due Date</th>
                    <th className="py-2.5 px-4 text-right">Days Overdue</th>
                    <th className="py-2.5 px-4">Aging Bucket</th>
                    <th className="py-2.5 px-4 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {agingRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No open {agingType.toLowerCase()} balances found.
                      </td>
                    </tr>
                  ) : (
                    agingRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono font-bold">{row.invoiceNo}</td>
                        <td className="py-2.5 px-4 font-semibold">{row.partyName}</td>
                        <td className="py-2.5 px-4 text-slate-500">{row.date}</td>
                        <td className="py-2.5 px-4 text-slate-500">{row.dueDate || '—'}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-bold">
                          {row.overdueDays > 0 ? `${row.overdueDays} d` : 'Current'}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.overdueDays > 60
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                : row.overdueDays > 30
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}
                          >
                            {row.bucket}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
                          {fmt(row.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Account Ledger Drilldown Modal */}
      {selectedAccountLedger && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl max-h-[86vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
              <div>
                <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                  {selectedAccountLedger.acc.code} — {selectedAccountLedger.acc.name} (Ledger)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Group: {selectedAccountLedger.acc.group} &bull; Opening: {fmt(selectedAccountLedger.acc.openingBalance)} &bull; Closing:{' '}
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    {fmt(selectedAccountLedger.acc.netBalance)} ({selectedAccountLedger.acc.normalBalance === 'Debit' ? 'Dr' : 'Cr'})
                  </strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportAccountLedgerCsv}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerAccountId(null)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedAccountLedger.entries.length === 0 ? (
                <div className="p-10 text-center text-slate-400">
                  No journal entries posted to {selectedAccountLedger.acc.name} yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Voucher #</th>
                      <th className="py-2.5 px-4">Narration</th>
                      <th className="py-2.5 px-4 text-right">Debit (₹)</th>
                      <th className="py-2.5 px-4 text-right">Credit (₹)</th>
                      <th className="py-2.5 px-4 text-right">Running Bal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedAccountLedger.entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{entry.date}</td>
                        <td className="py-2.5 px-4 font-mono font-bold whitespace-nowrap">
                          {entry.voucherNo}
                          <div className="text-[10px] font-sans font-normal text-slate-400">{entry.voucherType}</div>
                        </td>
                        <td className="py-2.5 px-4">{entry.narration}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                          {entry.debit > 0 ? fmt(entry.debit) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                          {entry.credit > 0 ? fmt(entry.credit) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-bold">
                          {fmt(entry.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
