import React, { useState, useMemo, useEffect } from 'react';
import {
  Landmark,
  Wallet,
  ArrowRightLeft,
  Download,
  CheckCircle2,
  TrendingUp,
  Search,
  Calculator,
  Clock,
  FileCheck2,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  CreditCard,
  BarChart2,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { BankAccountRecord, ChequeRecord } from '../types';
import { safeGetStoredData, safeSetStoredData } from '../utils/storage';

interface CashBankViewProps {
  initialTab?: 'cash' | 'bank';
}

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 1] as const;

export const CashBankView: React.FC<CashBankViewProps> = ({ initialTab = 'cash' }) => {
  const {
    transactions,
    accounts,
    journalVouchers,
    company,
    executeContraVoucher,
    createJournalVoucher,
    showToast,
    exportCurrentViewPdf,
    requestConfirmation,
  } = useVyapar();

  const [activeTab, setActiveTab] = useState<'cash' | 'bank' | 'cheques' | 'cashflow' | 'reconcile' | 'contra'>(initialTab);
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferType, setTransferType] = useState<'CASH_TO_BANK' | 'BANK_TO_CASH'>('CASH_TO_BANK');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferRef, setTransferRef] = useState('');

  // Multiple Bank Accounts Manager
  const [bankAccounts, setBankAccounts] = useState<BankAccountRecord[]>(() =>
    safeGetStoredData<BankAccountRecord[]>(
      'bm360_bank_accounts',
      [
        {
          id: 'bnk-1',
          bankName: company.bankName || 'HDFC Bank Ltd',
          accountHolder: company.name || 'MY STORE',
          accountNumber: company.accountNo || '50200048291034',
          ifsc: company.ifsc || 'HDFC0001234',
          branch: 'Commercial Street Branch',
          accountType: 'Current',
          openingBalance: 184000,
          isPrimary: true,
        },
      ],
      Array.isArray
    )
  );
  const [revealedBankIds, setRevealedBankIds] = useState<Record<string, boolean>>({});
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bName, setBName] = useState('');
  const [bHolder, setBHolder] = useState(company.name || 'MY STORE');
  const [bAccNo, setBAccNo] = useState('');
  const [bIfsc, setBIfsc] = useState('');
  const [bBranch, setBBranch] = useState('');
  const [bType, setBType] = useState<BankAccountRecord['accountType']>('Current');
  const [bOpening, setBOpening] = useState('0');

  // Cheque Register
  const [cheques, setCheques] = useState<ChequeRecord[]>(() =>
    safeGetStoredData<ChequeRecord[]>('bm360_cheques_register', [], Array.isArray)
  );
  const [isChequeModalOpen, setIsChequeModalOpen] = useState(false);
  const [chNo, setChNo] = useState('');
  const [chDate, setChDate] = useState(new Date().toISOString().slice(0, 10));
  const [chParty, setChParty] = useState('');
  const [chBank, setChBank] = useState(company.bankName || 'HDFC Bank Ltd');
  const [chDir, setChDir] = useState<ChequeRecord['direction']>('Received (Inward)');
  const [chAmt, setChAmt] = useState('');

  // Denomination Counter state
  const [denomCounts, setDenomCounts] = useState<Record<number, number>>({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    1: 0,
  });

  // Persisted Bank Clearance status map
  const [clearedMap, setClearedMap] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('bm360_bank_cleared_map');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    safeSetStoredData('bm360_bank_accounts', bankAccounts);
  }, [bankAccounts]);

  useEffect(() => {
    safeSetStoredData('bm360_cheques_register', cheques);
  }, [cheques]);

  const toggleCleared = (txId: string) => {
    setClearedMap((prev) => {
      const next = { ...prev, [txId]: !prev[txId] };
      try {
        localStorage.setItem('bm360_bank_cleared_map', JSON.stringify(next));
      } catch {
        // ignore storage quota
      }
      return next;
    });
  };

  // Authoritative Cash & Bank Balances from Chart of Accounts + Double-Entry Journals
  const { cashBalance, bankBalance } = useMemo(() => {
    const getBal = (accId: string) => {
      const acc = accounts.find((a) => a.id === accId);
      const opening = acc?.openingBalance || 0;
      let delta = 0;
      journalVouchers.forEach((jv) => {
        jv.lines.forEach((l) => {
          if (l.accountId === accId) {
            delta += (l.debit || 0) - (l.credit || 0);
          }
        });
      });
      return opening + delta;
    };
    const secondaryBankOpening = bankAccounts
      .filter((b) => !b.isPrimary)
      .reduce((s, b) => s + (b.openingBalance || 0), 0);
    return {
      cashBalance: getBal('acc-cash'),
      bankBalance: getBal('acc-bank') + secondaryBankOpening,
    };
  }, [accounts, journalVouchers, bankAccounts]);

  // Cash transactions
  const cashTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((t) => {
      if (t.isCancelled || t.paymentType !== 'Cash') return false;
      if (!q) return true;
      return (
        t.invoiceNo.toLowerCase().includes(q) ||
        (t.partyName || '').toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q)
      );
    });
  }, [transactions, searchQuery]);

  // Bank transactions
  const bankTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((t) => {
      if (t.isCancelled) return false;
      if (!['Bank Transfer', 'UPI', 'Cheque'].includes(t.paymentType)) return false;
      if (!q) return true;
      return (
        t.invoiceNo.toLowerCase().includes(q) ||
        (t.partyName || '').toLowerCase().includes(q) ||
        t.paymentType.toLowerCase().includes(q)
      );
    });
  }, [transactions, searchQuery]);

  // Combined Cheque Register (transactions paid via Cheque + manually logged cheques)
  const combinedCheques = useMemo(() => {
    const fromTx: ChequeRecord[] = transactions
      .filter((t) => !t.isCancelled && t.paymentType === 'Cheque')
      .map((t) => ({
        id: `tx-chq-${t.id}`,
        chequeNo: t.invoiceNo,
        date: t.date,
        partyName: t.partyName,
        bankName: company.bankName || 'Primary Bank',
        direction:
          t.type === 'Sale' || t.type === 'Payment-In' || t.type === 'Other Income'
            ? 'Received (Inward)'
            : 'Issued (Outward)',
        amount: t.receivedAmount || t.totalAmount || 0,
        status: clearedMap[t.id] ? 'Cleared' : 'Pending',
        linkedTxId: t.id,
        notes: `${t.type} #${t.invoiceNo}`,
      }));
    return [...cheques, ...fromTx];
  }, [cheques, transactions, clearedMap, company.bankName]);

  // Cash Flow Statement Summary
  const cashFlowSummary = useMemo(() => {
    let operatingInflow = 0;
    let operatingOutflow = 0;
    transactions.forEach((t) => {
      if (t.isCancelled || t.paymentType === 'Credit') return;
      const amt =
        t.type === 'Payment-In' || t.type === 'Expense' || t.type === 'Other Income'
          ? t.totalAmount || 0
          : t.receivedAmount || 0;
      if (t.type === 'Sale' || t.type === 'Payment-In' || t.type === 'Other Income') {
        operatingInflow += amt;
      } else if (t.type === 'Purchase' || t.type === 'Expense') {
        operatingOutflow += amt;
      }
    });
    const contraVolume = journalVouchers
      .filter((jv) => jv.voucherType === 'Contra')
      .reduce((s, jv) => s + (jv.totalDebit || 0), 0);

    return {
      operatingInflow,
      operatingOutflow,
      netOperating: operatingInflow - operatingOutflow,
      contraVolume,
      closingLiquidity: cashBalance + bankBalance,
    };
  }, [transactions, journalVouchers, cashBalance, bankBalance]);

  const contraVouchers = useMemo(
    () => journalVouchers.filter((jv) => jv.voucherType === 'Contra'),
    [journalVouchers]
  );

  const countedCashTotal = useMemo(
    () => DENOMINATIONS.reduce((sum, d) => sum + d * (denomCounts[d] || 0), 0),
    [denomCounts]
  );
  const cashVariance = countedCashTotal - cashBalance;

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(transferAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid transfer amount', 'error');
      return;
    }

    const ok = executeContraVoucher(transferType, amt, transferRef.trim() || undefined);
    if (!ok.success) {
      showToast(ok.message || 'Transfer failed: please enter a positive amount.', 'error');
      return;
    }

    setIsTransferModalOpen(false);
    setTransferAmount('');
    setTransferRef('');
  };

  const handleAddBankAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bName.trim() || !bAccNo.trim()) {
      showToast('Bank Name and Account Number are required', 'warning');
      return;
    }
    const newBank: BankAccountRecord = {
      id: `bnk-${Date.now()}`,
      bankName: bName.trim(),
      accountHolder: bHolder.trim() || company.name || 'MY STORE',
      accountNumber: bAccNo.trim(),
      ifsc: bIfsc.trim().toUpperCase() || 'IFSC0000001',
      branch: bBranch.trim() || 'Main Branch',
      accountType: bType,
      openingBalance: Math.max(0, Number(bOpening) || 0),
      isPrimary: bankAccounts.length === 0,
    };
    setBankAccounts((prev) => [...prev, newBank]);
    setIsBankModalOpen(false);
    setBName('');
    setBAccNo('');
    setBIfsc('');
    setBBranch('');
    setBOpening('0');
    showToast(`Bank account "${newBank.bankName}" added.`, 'success');
  };

  const handleDeleteBank = (acc: BankAccountRecord) => {
    if (acc.isPrimary) {
      showToast('Primary settlement bank account cannot be deleted.', 'warning');
      return;
    }
    requestConfirmation({
      title: 'Remove Bank Account?',
      message: `Remove ${acc.bankName} (••••${acc.accountNumber.slice(-4)}) from active bank list?`,
      confirmLabel: 'Remove',
      variant: 'danger',
      onConfirm: () => {
        setBankAccounts((prev) => prev.filter((b) => b.id !== acc.id));
        showToast('Bank account removed.', 'info');
      },
    });
  };

  const handleAddCheque = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(chAmt) || 0;
    if (!chNo.trim() || !chParty.trim() || amt <= 0) {
      showToast('Cheque #, Party Name and positive Amount are required.', 'warning');
      return;
    }
    const rec: ChequeRecord = {
      id: `chq-${Date.now()}`,
      chequeNo: chNo.trim().toUpperCase(),
      date: chDate,
      partyName: chParty.trim(),
      bankName: chBank.trim() || 'HDFC Bank Ltd',
      direction: chDir,
      amount: amt,
      status: 'Pending',
    };
    setCheques((prev) => [rec, ...prev]);
    setIsChequeModalOpen(false);
    setChNo('');
    setChParty('');
    setChAmt('');
    showToast(`Cheque #${rec.chequeNo} added to register.`, 'success');
  };

  const updateChequeStatus = (rec: ChequeRecord, status: ChequeRecord['status']) => {
    if (rec.linkedTxId) {
      setClearedMap((prev) => {
        const next = { ...prev, [rec.linkedTxId!]: status === 'Cleared' };
        try {
          localStorage.setItem('bm360_bank_cleared_map', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    } else {
      setCheques((prev) => prev.map((c) => (c.id === rec.id ? { ...c, status } : c)));
    }
    showToast(`Cheque #${rec.chequeNo} marked ${status}.`, 'info');
  };

  const handlePostCashAdjustment = () => {
    if (cashVariance === 0) {
      showToast('Physical cash matches ledger balance exactly!', 'success');
      return;
    }
    const absDiff = Math.abs(cashVariance);
    const isExcess = cashVariance > 0;
    const res = createJournalVoucher({
      voucherNo: `JV-CASH-${Date.now().toString().slice(-4)}`,
      date: new Date().toLocaleDateString('en-GB'),
      voucherType: 'Journal',
      narration: `Physical Cash Drawer Reconciliation (${isExcess ? 'Excess' : 'Shortage'})`,
      referenceNo: `CASH-RECON-${Date.now().toString().slice(-4)}`,
      totalDebit: absDiff,
      totalCredit: absDiff,
      lines: isExcess
        ? [
            { id: 'cr-1', accountId: 'acc-cash', accountName: 'Cash in Hand', debit: absDiff, credit: 0 },
            { id: 'cr-2', accountId: 'acc-other-inc', accountName: 'Other Income', debit: 0, credit: absDiff },
          ]
        : [
            { id: 'cr-1', accountId: 'acc-exp', accountName: 'Operating Expenses', debit: absDiff, credit: 0 },
            { id: 'cr-2', accountId: 'acc-cash', accountName: 'Cash in Hand', debit: 0, credit: absDiff },
          ],
    });
    if (res.success) {
      showToast(`Posted cash adjustment voucher of ₹${absDiff.toLocaleString('en-IN')}.`);
    }
  };

  const unclearedCount = bankTransactions.filter((tx) => !clearedMap[tx.id]).length;
  const maskAcc = (num: string, revealed: boolean) =>
    revealed || num.length <= 4 ? num : `${'•'.repeat(Math.max(4, num.length - 4))}${num.slice(-4)}`;

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-slate-950 flex flex-col overflow-hidden select-none text-xs text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-900">
            <Landmark className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">Cash, Bank Accounts &amp; Liquidity</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Live Cash-in-hand, Multiple Bank Accounts, Cheque Register, Cash Flow &amp; Contra transfers
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search voucher or party..."
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsBankModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Bank A/C</span>
          </button>
          <button
            type="button"
            onClick={() => exportCurrentViewPdf({ title: 'Cash & Bank Statement' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={() => setIsTransferModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Bank Transfer / Contra</span>
          </button>
        </div>
      </div>

      {/* Liquidity Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-slate-100/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Physical Cash Balance</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
              ₹ {cashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">Live Double-Entry Ledger</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Wallet className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Combined Bank Balance ({bankAccounts.length} A/Cs)
            </span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
              ₹ {bankBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-blue-700 dark:text-blue-400 font-semibold">
              {bankAccounts[0]?.bankName || 'Primary Bank'} &bull; {unclearedCount} pending clearance
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Landmark className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-purple-200 dark:border-purple-900 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-purple-700 dark:text-purple-400 font-medium">Total Liquid Capital</span>
            <div className="text-xl font-bold text-purple-900 dark:text-purple-300 mt-0.5 tabular-nums">
              ₹ {(cashBalance + bankBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-purple-600 dark:text-purple-400">Cash + Bank net working funds</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center gap-6 shrink-0 text-xs font-semibold overflow-x-auto">
        {(
          [
            { id: 'cash', label: `Cash in Hand (${cashTransactions.length})`, icon: Wallet, border: 'border-emerald-600 text-emerald-700 dark:text-emerald-400' },
            { id: 'bank', label: `Bank Accounts & Ledger (${bankAccounts.length})`, icon: Landmark, border: 'border-blue-600 text-blue-700 dark:text-blue-400' },
            { id: 'cheques', label: `Cheque Register (${combinedCheques.length})`, icon: CreditCard, border: 'border-indigo-600 text-indigo-700 dark:text-indigo-400' },
            { id: 'cashflow', label: 'Cash Flow Statement', icon: BarChart2, border: 'border-teal-600 text-teal-700 dark:text-teal-400' },
            { id: 'reconcile', label: 'Denomination Counter', icon: Calculator, border: 'border-amber-600 text-amber-700 dark:text-amber-400' },
            { id: 'contra', label: `Contra Transfers (${contraVouchers.length})`, icon: ArrowRightLeft, border: 'border-purple-600 text-purple-700 dark:text-purple-400' },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 flex items-center gap-2 border-b-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                active ? `${tab.border} font-bold` : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      {(activeTab === 'cash' || activeTab === 'bank') && (
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
          {activeTab === 'bank' && (
            <div className="p-5 bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3">
              {bankAccounts.map((acc) => {
                const revealed = Boolean(revealedBankIds[acc.id]);
                return (
                  <div
                    key={acc.id}
                    className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{acc.bankName}</span>
                          {acc.isPrimary && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[9px] font-bold">
                              PRIMARY
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">{acc.accountType} &bull; {acc.branch}</div>
                      </div>
                      {!acc.isPrimary && (
                        <button
                          type="button"
                          onClick={() => handleDeleteBank(acc)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Delete Bank Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg">
                      <span>A/C: {maskAcc(acc.accountNumber, revealed)}</span>
                      <button
                        type="button"
                        onClick={() => setRevealedBankIds((p) => ({ ...p, [acc.id]: !p[acc.id] }))}
                        className="text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        title={revealed ? 'Hide Account Number' : 'Reveal Account Number'}
                      >
                        {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>IFSC: <strong className="font-mono text-slate-700 dark:text-slate-300">{acc.ifsc}</strong></span>
                      <span className="font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                        Open: ₹{acc.openingBalance.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Voucher / Invoice #</th>
                <th className="py-2.5 px-4">Party / Source</th>
                <th className="py-2.5 px-4">Transaction Type</th>
                <th className="py-2.5 px-4">Mode</th>
                <th className="py-2.5 px-4 text-right">Inflow (+)</th>
                <th className="py-2.5 px-4 text-right">Outflow (-)</th>
                {activeTab === 'bank' && <th className="py-2.5 px-4 text-center">Reconciliation</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
              {(activeTab === 'cash' ? cashTransactions : bankTransactions).map((tx) => {
                const isInflow = tx.type === 'Sale' || tx.type === 'Payment-In' || tx.type === 'Other Income';
                const amt =
                  tx.type === 'Payment-In' || tx.type === 'Expense' || tx.type === 'Other Income'
                    ? tx.totalAmount || 0
                    : tx.receivedAmount ?? tx.totalAmount ?? 0;
                const isCleared = Boolean(clearedMap[tx.id]);

                return (
                  <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 tabular-nums">{tx.date}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white">{tx.invoiceNo}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">{tx.partyName || 'Counter'}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{tx.paymentType}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {isInflow ? `+₹ ${amt.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      {!isInflow ? `-₹ ${amt.toLocaleString('en-IN')}` : '-'}
                    </td>
                    {activeTab === 'bank' && (
                      <td className="py-2.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleCleared(tx.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer transition-colors ${
                            isCleared
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          {isCleared ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          <span>{isCleared ? 'Cleared' : 'Pending'}</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Cheque Register */}
      {activeTab === 'cheques' && (
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
          <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Cheque Deposit &amp; Clearance Register</h3>
              <p className="text-[11px] text-slate-500">Track received &amp; issued cheques across Pending, Cleared, and Bounced states</p>
            </div>
            <button
              type="button"
              onClick={() => setIsChequeModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Cheque</span>
            </button>
          </div>
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
              <tr>
                <th className="py-2.5 px-4">Cheque #</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Party Name</th>
                <th className="py-2.5 px-4">Bank</th>
                <th className="py-2.5 px-4">Direction</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                <th className="py-2.5 px-4 text-center">Clearance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {combinedCheques.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No cheque entries recorded. Invoices/payments using Cheque mode appear here automatically.
                  </td>
                </tr>
              ) : (
                combinedCheques.map((ch) => (
                  <tr key={ch.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-4 font-mono font-bold">{ch.chequeNo}</td>
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums">{ch.date}</td>
                    <td className="py-2.5 px-4 font-semibold">{ch.partyName}</td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{ch.bankName}</td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{ch.direction}</td>
                    <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                      ₹ {ch.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <select
                        value={ch.status}
                        onChange={(e) => updateChequeStatus(ch, e.target.value as ChequeRecord['status'])}
                        className={`px-2 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                          ch.status === 'Cleared'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                            : ch.status === 'Bounced'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Cleared">Cleared</option>
                        {!ch.linkedTxId && <option value="Bounced">Bounced</option>}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Cash Flow Statement */}
      {activeTab === 'cashflow' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Cash Flow Summary Statement</h3>
              <p className="text-[11px] text-slate-500">Live operating inflows, supplier/expense outflows, and closing liquidity</p>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-medium text-slate-600 dark:text-slate-300">Operating Cash &amp; Bank Inflows (Sales, Payment-In, Other Income)</span>
                <span className="font-bold text-emerald-600 tabular-nums">
                  + ₹ {cashFlowSummary.operatingInflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-medium text-slate-600 dark:text-slate-300">Operating Cash &amp; Bank Outflows (Purchases, Payment-Out, Expenses)</span>
                <span className="font-bold text-rose-600 tabular-nums">
                  - ₹ {cashFlowSummary.operatingOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-900 dark:text-white">Net Operating Cash Flow</span>
                <span className={`font-extrabold tabular-nums ${cashFlowSummary.netOperating >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ₹ {cashFlowSummary.netOperating.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-medium text-slate-600 dark:text-slate-300">Internal Contra Transfers Volume (Cash ↔ Bank)</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                  ₹ {cashFlowSummary.contraVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between pt-2 text-sm font-extrabold text-blue-700 dark:text-blue-400">
                <span>Closing Liquid Funds (Cash + Bank Accounts)</span>
                <span className="tabular-nums">
                  ₹ {cashFlowSummary.closingLiquidity.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Drawer Denomination Counter */}
      {activeTab === 'reconcile' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Cash Drawer Denomination &amp; Shift Reconciliation</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Count currency notes &amp; coins in drawer and reconcile against system cash ledger
                </p>
              </div>
              <button
                type="button"
                onClick={handlePostCashAdjustment}
                className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Reconcile &amp; Post Adjustment</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DENOMINATIONS.map((d) => (
                <div key={d} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 dark:text-white">₹{d}</span>
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      = ₹{(d * (denomCounts[d] || 0)).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={denomCounts[d] || 0}
                    onChange={(e) =>
                      setDenomCounts((prev) => ({ ...prev, [d]: Math.max(0, parseInt(e.target.value, 10) || 0) }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold tabular-nums"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-bold text-slate-500 uppercase">System Expected Cash</div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
                  ₹ {cashBalance.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                <div className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase">Actual Counted Cash</div>
                <div className="text-base font-extrabold text-blue-900 dark:text-blue-300 tabular-nums mt-0.5">
                  ₹ {countedCashTotal.toLocaleString('en-IN')}
                </div>
              </div>
              <div
                className={`p-3 rounded-xl border ${
                  cashVariance === 0
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900'
                    : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
                }`}
              >
                <div className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300">
                  {cashVariance === 0 ? 'Matched' : cashVariance > 0 ? 'Cash Excess' : 'Cash Shortage'}
                </div>
                <div className="text-base font-extrabold tabular-nums mt-0.5">
                  {cashVariance >= 0 ? '+' : '-'}₹ {Math.abs(cashVariance).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contra Transfer History */}
      {activeTab === 'contra' && (
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
              <tr>
                <th className="py-2.5 px-4">Voucher #</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Narration</th>
                <th className="py-2.5 px-4">Reference</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {contraVouchers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    No contra transfers recorded yet. Click &quot;Bank Transfer / Contra&quot; to transfer between Cash &amp; Bank.
                  </td>
                </tr>
              ) : (
                contraVouchers.map((jv) => (
                  <tr key={jv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-4 font-mono font-bold">{jv.voucherNo}</td>
                    <td className="py-2.5 px-4 text-slate-500">{jv.date}</td>
                    <td className="py-2.5 px-4 font-semibold">{jv.narration}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{jv.referenceNo || '—'}</td>
                    <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                      ₹ {jv.totalDebit.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Contra Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">Inter-Account Bank / Cash Transfer</h3>
              <button type="button" onClick={() => setIsTransferModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleExecuteTransfer} className="p-5 space-y-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Transfer Direction *</label>
                <select
                  value={transferType}
                  onChange={(e) => setTransferType(e.target.value as 'CASH_TO_BANK' | 'BANK_TO_CASH')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 font-medium"
                >
                  <option value="CASH_TO_BANK">Deposit Cash to Bank Account (Cash → Bank)</option>
                  <option value="BANK_TO_CASH">Withdraw Cash from Bank (Bank → Cash in Hand)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Transfer Amount (₹) *</label>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  required
                  min="1"
                  step="0.01"
                  placeholder="e.g. 10000"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Cheque / Slip / Reference Number</label>
                <input
                  type="text"
                  value={transferRef}
                  onChange={(e) => setTransferRef(e.target.value)}
                  placeholder="e.g. SLIP-8921"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs cursor-pointer"
                >
                  Execute Contra Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Bank Account Modal */}
      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">Add Business Bank Account</h3>
              <button type="button" onClick={() => setIsBankModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleAddBankAccount} className="p-5 space-y-3">
              <div>
                <label className="block font-semibold mb-1">Bank Name *</label>
                <input
                  type="text"
                  required
                  value={bName}
                  onChange={(e) => setBName(e.target.value)}
                  placeholder="e.g. ICICI Bank Ltd"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Account Number *</label>
                  <input
                    type="text"
                    required
                    value={bAccNo}
                    onChange={(e) => setBAccNo(e.target.value)}
                    placeholder="Account #"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={bIfsc}
                    onChange={(e) => setBIfsc(e.target.value)}
                    placeholder="ICIC0000123"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono uppercase"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Account Type</label>
                  <select
                    value={bType}
                    onChange={(e) => setBType(e.target.value as BankAccountRecord['accountType'])}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="Current">Current Account</option>
                    <option value="Savings">Savings Account</option>
                    <option value="Overdraft / CC">Overdraft / CC</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={bOpening}
                    onChange={(e) => setBOpening(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 tabular-nums"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Account Holder</label>
                  <input
                    type="text"
                    value={bHolder}
                    onChange={(e) => setBHolder(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Branch</label>
                  <input
                    type="text"
                    value={bBranch}
                    onChange={(e) => setBBranch(e.target.value)}
                    placeholder="e.g. MG Road"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBankModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                >
                  Save Bank Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Cheque Modal */}
      {isChequeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">Log Cheque Entry</h3>
              <button type="button" onClick={() => setIsChequeModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleAddCheque} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Cheque Number *</label>
                  <input
                    type="text"
                    required
                    value={chNo}
                    onChange={(e) => setChNo(e.target.value)}
                    placeholder="e.g. 448102"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Cheque Date *</label>
                  <input
                    type="date"
                    value={chDate}
                    onChange={(e) => setChDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Party Name *</label>
                <input
                  type="text"
                  required
                  value={chParty}
                  onChange={(e) => setChParty(e.target.value)}
                  placeholder="Customer or Supplier Name"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Direction</label>
                  <select
                    value={chDir}
                    onChange={(e) => setChDir(e.target.value as ChequeRecord['direction'])}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="Received (Inward)">Received (Inward)</option>
                    <option value="Issued (Outward)">Issued (Outward)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={chAmt}
                    onChange={(e) => setChAmt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Bank Name</label>
                <input
                  type="text"
                  value={chBank}
                  onChange={(e) => setChBank(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsChequeModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
                >
                  Save Cheque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
