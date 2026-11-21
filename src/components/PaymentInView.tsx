import React, { useState, useMemo } from 'react';
import {
  Plus,
  ChevronDown,
  Calendar,
  Settings,
  FileDown,
  Search,
  Eye,
  Trash2,
  Receipt,
  X,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
  Sliders,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { ExtendedPaymentMode, SplitPaymentPart, Transaction } from '../types';
import {
  calculatePaymentAllocationBreakdown,
  detectDuplicateTransactionFingerprint,
  evaluatePaymentLimits,
  mapExtendedModeToTxPaymentType,
} from '../utils/transactionEngine';

const ALL_PAYMENT_MODES: ExtendedPaymentMode[] = [
  'Cash',
  'UPI',
  'Bank',
  'Card',
  'Cheque',
  'Demand Draft',
  'NEFT',
  'RTGS',
  'IMPS',
  'Wallet',
  'Other',
  'Mixed/Split',
];

type PaymentTab = 'register' | 'reports' | 'advance_refunds' | 'aging';

export const PaymentInView: React.FC = () => {
  const {
    transactions,
    parties,
    filterPeriod,
    setFilterPeriod,
    filterStartDate,
    filterEndDate,
    setIsSettingsModalOpen,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    deleteTransaction,
    allocatePaymentToInvoices,
    reconcilePaymentTransaction,
    recordPaymentRefund,
    paymentLimits,
    setPaymentLimits,
    exportCurrentViewPdf,
    showToast,
  } = useVyapar();

  const [activeTab, setActiveTab] = useState<PaymentTab>('register');
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<'All' | ExtendedPaymentMode>('All');

  // Multi-invoice + Split Payment Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [amount, setAmount] = useState('');
  const [extendedMode, setExtendedMode] = useState<ExtendedPaymentMode>('UPI');
  const [splitParts, setSplitParts] = useState<SplitPaymentPart[]>([
    { id: 'sp-1', mode: 'Cash', amount: 0, referenceNo: '' },
    { id: 'sp-2', mode: 'UPI', amount: 0, referenceNo: '' },
  ]);
  const [refNo, setRefNo] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [allocMap, setAllocMap] = useState<Record<string, number>>({});
  const [writeOffShortfall, setWriteOffShortfall] = useState(false);
  const [attachments, setAttachments] = useState<NonNullable<Transaction['attachments']>>([]);

  // Refund & Limits Modals
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundCustomer, setRefundCustomer] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMode, setRefundMode] = useState<ExtendedPaymentMode>('UPI');
  const [refundRef, setRefundRef] = useState('');
  const [refundReason, setRefundReason] = useState('Customer advance / excess payment refund');

  const [isLimitsModalOpen, setIsLimitsModalOpen] = useState(false);
  const [limitsDraft, setLimitsDraft] = useState(paymentLimits);

  const customers = useMemo(() => parties.filter((p) => p.type !== 'Supplier'), [parties]);

  const openCustomerInvoices = useMemo(() => {
    if (!selectedCustomer) return [];
    return transactions.filter(
      (t) =>
        t.type === 'Sale' &&
        !t.isCancelled &&
        t.partyName.toLowerCase() === selectedCustomer.toLowerCase() &&
        (t.balance || 0) > 0.01
    );
  }, [transactions, selectedCustomer]);

  const payments = useMemo(() => {
    return transactions.filter((t) => {
      if (t.type !== 'Payment-In' || t.isCancelled) return false;
      const effMode = t.extendedPaymentMode || t.paymentType;
      if (modeFilter !== 'All' && effMode !== modeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          t.partyName.toLowerCase().includes(q) ||
          t.invoiceNo.toLowerCase().includes(q) ||
          t.receivedAmount.toString().includes(q) ||
          String(effMode).toLowerCase().includes(q) ||
          (t.tags || []).some((tg) => tg.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [transactions, search, modeFilter]);

  const refundRecords = useMemo(
    () =>
      transactions.filter(
        (t) => (t.refundedAmount || 0) > 0 && t.type === 'Sale Return' && !t.isCancelled
      ),
    [transactions]
  );

  const overdueReceivables = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'Sale' && !t.isCancelled && (t.balance || 0) > 0.01)
        .sort((a, b) => (b.balance || 0) - (a.balance || 0)),
    [transactions]
  );

  const modeSummary = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    payments.forEach((p) => {
      const m = p.extendedPaymentMode || p.paymentType || 'Cash';
      const cur = map.get(m) || { count: 0, total: 0 };
      map.set(m, { count: cur.count + 1, total: cur.total + (p.receivedAmount || p.totalAmount || 0) });
    });
    return Array.from(map.entries()).map(([mode, stats]) => ({ mode, ...stats }));
  }, [payments]);

  const dailySummary = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    payments.forEach((p) => {
      const day = (p.date || '').split(',')[0].trim() || 'Unknown';
      const cur = map.get(day) || { count: 0, total: 0 };
      map.set(day, { count: cur.count + 1, total: cur.total + (p.receivedAmount || p.totalAmount || 0) });
    });
    return Array.from(map.entries()).map(([day, stats]) => ({ day, ...stats }));
  }, [payments]);

  const totalPaymentsReceived = useMemo(
    () => payments.reduce((sum, p) => sum + (p.receivedAmount || p.totalAmount || 0), 0),
    [payments]
  );

  const totalUnallocated = useMemo(
    () => payments.reduce((sum, p) => sum + (p.excessAdvanceAmount || 0), 0),
    [payments]
  );

  const splitSum = useMemo(
    () => splitParts.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [splitParts]
  );

  const effectiveAmountNum =
    extendedMode === 'Mixed/Split' ? Math.round(splitSum * 100) / 100 : Number(amount) || 0;

  const allocBreakdown = useMemo(() => {
    const rows = Object.entries(allocMap)
      .filter(([, amt]) => (Number(amt) || 0) > 0)
      .map(([invoiceId, amt]) => {
        const inv = openCustomerInvoices.find((i) => i.id === invoiceId);
        return {
          invoiceId,
          invoiceTotalPending: inv?.balance || 0,
          allocatedAmount: amt,
        };
      });
    return calculatePaymentAllocationBreakdown({
      paymentAmount: effectiveAmountNum,
      allocations: rows,
      writeOffShortfall,
    });
  }, [effectiveAmountNum, allocMap, openCustomerInvoices, writeOffShortfall]);

  const limitWarning = useMemo(
    () =>
      evaluatePaymentLimits({
        amount: effectiveAmountNum,
        mode: extendedMode,
        splitParts: extendedMode === 'Mixed/Split' ? splitParts : undefined,
        limits: paymentLimits,
      }),
    [effectiveAmountNum, extendedMode, splitParts, paymentLimits]
  );

  const duplicateCandidate = useMemo(() => {
    if (!selectedCustomer || effectiveAmountNum <= 0) return undefined;
    const todayStr = new Date().toLocaleDateString('en-GB');
    return detectDuplicateTransactionFingerprint(transactions, {
      type: 'Payment-In',
      partyName: selectedCustomer,
      totalAmount: effectiveAmountNum,
      date: todayStr,
    });
  }, [transactions, selectedCustomer, effectiveAmountNum]);

  const handleAutoAllocateFifo = () => {
    let remaining = Math.max(0, effectiveAmountNum);
    if (remaining <= 0) {
      const totalOpen = openCustomerInvoices.reduce((s, inv) => s + (inv.balance || 0), 0);
      remaining = totalOpen;
      setAmount(String(totalOpen));
    }
    const nextMap: Record<string, number> = {};
    for (const inv of openCustomerInvoices) {
      if (remaining <= 0) break;
      const take = Math.min(inv.balance || 0, remaining);
      nextMap[inv.id] = Math.round(take * 100) / 100;
      remaining = Math.round((remaining - take) * 100) / 100;
    }
    setAllocMap(nextMap);
  };

  const handleSavePaymentIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || effectiveAmountNum <= 0) {
      showToast('Select a customer and enter a valid payment amount.', 'warning');
      return;
    }
    const custObj = customers.find((c) => c.name === selectedCustomer);
    const allocations = Object.entries(allocMap)
      .filter(([, val]) => val > 0)
      .map(([invoiceId, amt]) => ({ invoiceId, amount: amt }));

    const created = allocatePaymentToInvoices({
      direction: 'IN',
      partyName: selectedCustomer,
      partyPhone: custObj?.phone,
      paymentType: mapExtendedModeToTxPaymentType(extendedMode),
      extendedPaymentMode: extendedMode,
      splitPayments: extendedMode === 'Mixed/Split' ? splitParts.filter((s) => s.amount > 0) : undefined,
      totalAmount: effectiveAmountNum,
      writeOffAmount: allocBreakdown.writeOffAmount,
      refNo,
      notes,
      tags: tagsInput.split(',').map((s) => s.trim()).filter(Boolean),
      attachments: attachments.length > 0 ? attachments : undefined,
      allocations,
    });

    if (created) {
      setIsModalOpen(false);
      setSelectedCustomer('');
      setAmount('');
      setRefNo('');
      setNotes('');
      setTagsInput('');
      setWriteOffShortfall(false);
      setAttachments([]);
      setAllocMap({});
    }
  };

  const handleSaveRefund = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(refundAmount) || 0;
    if (!refundCustomer || amt <= 0) {
      showToast('Select customer and enter refund amount.', 'warning');
      return;
    }
    const res = recordPaymentRefund({
      direction: 'IN_REFUND',
      partyName: refundCustomer,
      amount: amt,
      mode: refundMode,
      refNo: refundRef,
      reason: refundReason,
    });
    if (res) {
      showToast(`Refund voucher #${res.invoiceNo} of ₹${amt.toLocaleString('en-IN')} recorded.`, 'success');
      setIsRefundModalOpen(false);
      setRefundAmount('');
      setRefundRef('');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f0f4f9] dark:bg-slate-950 overflow-y-auto select-none text-xs text-slate-800 dark:text-slate-100">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">Payment-In &amp; Collection Engine</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            12 payment modes, split tenders, FIFO multi-invoice allocation, short write-offs, reconciliation &amp; refunds
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLimitsDraft(paymentLimits);
              setIsLimitsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md font-semibold text-xs text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Payment Limits</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRefundCustomer(customers[0]?.name || '');
              setIsRefundModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md font-semibold text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 hover:bg-amber-100 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Issue Refund</span>
          </button>

          <button
            type="button"
            onClick={() => exportCurrentViewPdf({ title: 'Payment-In Register' })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md font-semibold text-xs text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedCustomer(customers[0]?.name || '');
              setAllocMap({});
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md font-semibold text-xs text-white bg-[#dc2626] hover:bg-[#b91c1c] shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Payment-In</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="bg-white dark:bg-slate-900 px-6 pt-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 shrink-0 overflow-x-auto">
        {[
          { id: 'register', label: `Receipts Register (${payments.length})`, icon: Receipt },
          { id: 'reports', label: 'Mode & Daily Reports', icon: BarChart3 },
          { id: 'advance_refunds', label: `Advances & Refunds (${refundRecords.length})`, icon: RotateCcw },
          { id: 'aging', label: `Overdue Receivables (${overdueReceivables.length})`, icon: ShieldAlert },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as PaymentTab)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'border-rose-600 text-rose-700 dark:text-rose-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsPeriodOpen(!isPeriodOpen)}
              className="flex items-center gap-1.5 px-3 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium cursor-pointer"
            >
              <span>{filterPeriod}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {isPeriodOpen && (
              <div className="absolute left-0 top-8 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md py-1 z-30 text-xs">
                {['Today', 'This Week', 'This Month', 'Last Month', 'This Year'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setFilterPeriod(p);
                      setIsPeriodOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {filterStartDate} To {filterEndDate}
            </span>
          </div>

          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as any)}
            className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-xs"
          >
            <option value="All">All Modes</option>
            {ALL_PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search receipt #, party, tag..."
            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md pl-8 pr-3 py-1 text-xs focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="px-6 pt-5 grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
          <span className="text-[11px] text-slate-500 font-medium">Total Collected ({payments.length})</span>
          <div className="mt-1 text-xl font-bold text-emerald-600 tabular-nums">
            ₹{totalPaymentsReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
          <span className="text-[11px] text-slate-500 font-medium">Unallocated / Advances</span>
          <div className="mt-1 text-xl font-bold text-sky-600 tabular-nums">
            ₹{totalUnallocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
          <span className="text-[11px] text-slate-500 font-medium">Reconciled Receipts</span>
          <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white tabular-nums">
            {payments.filter((p) => p.reconciled).length} / {payments.length}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
          <span className="text-[11px] text-slate-500 font-medium">Overdue Customer Dues</span>
          <div className="mt-1 text-xl font-bold text-rose-600 tabular-nums">
            ₹{overdueReceivables.reduce((s, r) => s + (r.balance || 0), 0).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6 flex-1 flex flex-col">
        {activeTab === 'register' && (
          payments.length > 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Receipt #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Mode / Split</th>
                    <th className="py-3 px-4">Allocation &amp; Status</th>
                    <th className="py-3 px-4 text-right">Amount (₹)</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">{p.date}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white font-mono">
                        #{p.invoiceNo}
                        {p.approvalRequired && (
                          <span className="ml-1.5 text-[10px] font-sans text-amber-600 font-bold">Approval Req</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{p.partyName}</div>
                        {p.partyPhone && <div className="text-[10px] text-slate-500">{p.partyPhone}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {p.extendedPaymentMode || p.paymentType}
                        </div>
                        {p.splitPayments && p.splitPayments.length > 0 && (
                          <div className="text-[10px] text-slate-500 tabular-nums">
                            {p.splitPayments.map((sp) => `${sp.mode}: ₹${sp.amount}`).join(' + ')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        <div>{p.notes || 'Allocated against customer outstanding'}</div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px]">
                          {p.reconciled ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Reconciled ({p.reconciledRef})
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => reconcilePaymentTransaction(p.id)}
                              className="text-blue-600 hover:underline font-semibold cursor-pointer"
                            >
                              Mark Reconciled
                            </button>
                          )}
                          {(p.excessAdvanceAmount || 0) > 0 && (
                            <span className="text-sky-600 font-semibold tabular-nums">
                              Advance: ₹{p.excessAdvanceAmount!.toLocaleString('en-IN')}
                            </span>
                          )}
                          {(p.writeOffAmount || 0) > 0 && (
                            <span className="text-amber-600 font-semibold tabular-nums">
                              Write-off: ₹{p.writeOffAmount!.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 tabular-nums text-sm">
                        ₹{(p.receivedAmount || p.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(p);
                              setIsInvoicePreviewOpen(true);
                            }}
                            title="Preview Receipt"
                            className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTransaction(p.id)}
                            title="Delete Receipt"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <Receipt className="w-14 h-14 text-slate-300 mb-3" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Payment-In Receipts found</h3>
              <p className="text-xs text-slate-400 mt-1">
                Record customer collections using Cash, UPI, Split Tender, Cheque, Card, or Bank Transfer.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(customers[0]?.name || '');
                  setIsModalOpen(true);
                }}
                className="mt-4 px-5 py-2 rounded-md bg-[#dc2626] hover:bg-[#b91c1c] text-white font-semibold text-xs cursor-pointer"
              >
                + Add Payment-In Receipt
              </button>
            </div>
          )
        )}

        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3">Mode-Wise Collection Summary</h3>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
                    <th className="py-2">Payment Mode</th>
                    <th className="py-2 text-right">Receipts</th>
                    <th className="py-2 text-right">Total Collected (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {modeSummary.map((row) => (
                    <tr key={row.mode}>
                      <td className="py-2 font-semibold">{row.mode}</td>
                      <td className="py-2 text-right tabular-nums">{row.count}</td>
                      <td className="py-2 text-right font-bold text-emerald-600 tabular-nums">
                        ₹{row.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3">Daily Collection Trend</h3>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
                    <th className="py-2">Date</th>
                    <th className="py-2 text-right">Receipts</th>
                    <th className="py-2 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dailySummary.map((row) => (
                    <tr key={row.day}>
                      <td className="py-2 font-mono">{row.day}</td>
                      <td className="py-2 text-right tabular-nums">{row.count}</td>
                      <td className="py-2 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                        ₹{row.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'advance_refunds' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3">Unallocated / Customer Advances</h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.filter((p) => (p.excessAdvanceAmount || 0) > 0).length === 0 ? (
                  <p className="text-slate-400 py-4 text-center">No unallocated customer advance balances.</p>
                ) : (
                  payments
                    .filter((p) => (p.excessAdvanceAmount || 0) > 0)
                    .map((p) => (
                      <div key={p.id} className="py-2 flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{p.partyName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">#{p.invoiceNo} · {p.date}</div>
                        </div>
                        <span className="font-bold text-sky-600 tabular-nums">
                          ₹{p.excessAdvanceAmount!.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3">Customer Refund Vouchers</h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {refundRecords.length === 0 ? (
                  <p className="text-slate-400 py-4 text-center">No customer payment refunds recorded.</p>
                ) : (
                  refundRecords.map((rf) => (
                    <div key={rf.id} className="py-2 flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{rf.partyName}</div>
                        <div className="text-[10px] text-slate-500">{rf.invoiceNo} · {rf.notes}</div>
                      </div>
                      <span className="font-bold text-amber-600 tabular-nums">
                        -₹{(rf.refundedAmount || rf.totalAmount).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'aging' && (
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Due Date</th>
                  <th className="py-2.5 px-4 text-right">Bill Total (₹)</th>
                  <th className="py-2.5 px-4 text-right">Pending Balance (₹)</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {overdueReceivables.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-2.5 px-4 font-mono font-bold">#{inv.invoiceNo}</td>
                    <td className="py-2.5 px-4 font-semibold">{inv.partyName}</td>
                    <td className="py-2.5 px-4 text-slate-500">{inv.dueDate}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">₹{inv.totalAmount.toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-rose-600 tabular-nums">
                      ₹{inv.balance.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(inv.partyName);
                          setAmount(String(inv.balance));
                          setAllocMap({ [inv.id]: inv.balance });
                          setIsModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] cursor-pointer"
                      >
                        Collect Now
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Multi-Invoice & Split Payment-In Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-sm">Record Payment-In &amp; Multi-Invoice Allocation</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSavePaymentIn} className="p-5 space-y-4 overflow-y-auto">
              {(limitWarning.exceedsLimit || duplicateCandidate) && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[11px] space-y-1">
                  {limitWarning.exceedsLimit && (
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Limit Alert: {limitWarning.reasons.join('; ')}</span>
                    </div>
                  )}
                  {duplicateCandidate && (
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        Duplicate Payment Warning: Matching receipt #{duplicateCandidate.invoiceNo} for ₹
                        {duplicateCandidate.totalAmount.toLocaleString('en-IN')} already recorded today.
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Select Customer *</label>
                  <select
                    required
                    value={selectedCustomer}
                    onChange={(e) => {
                      setSelectedCustomer(e.target.value);
                      setAllocMap({});
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} (Due: ₹{(c.balance || 0).toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Amount Received (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    readOnly={extendedMode === 'Mixed/Split'}
                    value={extendedMode === 'Mixed/Split' ? splitSum : amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold tabular-nums read-only:bg-slate-100 dark:read-only:bg-slate-800/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Payment Mode (12 Channels)</label>
                  <select
                    value={extendedMode}
                    onChange={(e) => setExtendedMode(e.target.value as ExtendedPaymentMode)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                  >
                    {ALL_PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">UTR / Cheque / Card Ref #</label>
                  <input
                    type="text"
                    value={refNo}
                    onChange={(e) => setRefNo(e.target.value)}
                    placeholder="Optional reference"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="e.g. Verified, Advance"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
              </div>

              {/* Split Payment Builder */}
              {extendedMode === 'Mixed/Split' && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] uppercase text-slate-600 dark:text-slate-300">
                      Split Payment Tender Breakdown (Total: ₹{splitSum.toLocaleString('en-IN')})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSplitParts((prev) => [
                          ...prev,
                          { id: 'sp-' + Date.now(), mode: 'Card', amount: 0, referenceNo: '' },
                        ])
                      }
                      className="px-2 py-1 rounded bg-slate-800 text-white text-[10px] font-semibold cursor-pointer"
                    >
                      + Add Mode
                    </button>
                  </div>
                  {splitParts.map((part, i) => (
                    <div key={part.id} className="grid grid-cols-12 gap-2 items-center">
                      <select
                        value={part.mode}
                        onChange={(e) =>
                          setSplitParts((prev) =>
                            prev.map((p, idx) => (idx === i ? { ...p, mode: e.target.value as SplitPaymentPart['mode'] } : p))
                          )
                        }
                        className="col-span-4 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs"
                      >
                        {ALL_PAYMENT_MODES.filter((m) => m !== 'Mixed/Split').map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={part.amount}
                        onChange={(e) =>
                          setSplitParts((prev) =>
                            prev.map((p, idx) => (idx === i ? { ...p, amount: Math.max(0, Number(e.target.value) || 0) } : p))
                          )
                        }
                        placeholder="Amount"
                        className="col-span-3 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-right font-bold tabular-nums text-xs"
                      />
                      <input
                        type="text"
                        value={part.referenceNo || ''}
                        onChange={(e) =>
                          setSplitParts((prev) =>
                            prev.map((p, idx) => (idx === i ? { ...p, referenceNo: e.target.value } : p))
                          )
                        }
                        placeholder="Ref #"
                        className="col-span-4 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono text-xs"
                      />
                      <button
                        type="button"
                        disabled={splitParts.length <= 2}
                        onClick={() => setSplitParts((prev) => prev.filter((_, idx) => idx !== i))}
                        className="col-span-1 text-rose-600 disabled:opacity-30 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Open Invoices Allocation */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="font-bold text-[11px] uppercase text-slate-600 dark:text-slate-300">
                    Pending Invoices ({openCustomerInvoices.length})
                  </span>
                  {openCustomerInvoices.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAutoAllocateFifo}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                    >
                      Auto-Allocate (FIFO)
                    </button>
                  )}
                </div>
                {openCustomerInvoices.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-[11px]">
                    No unpaid invoices found for {selectedCustomer || 'this customer'}. Receipt will be recorded as Advance / On-Account.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/70 dark:bg-slate-800/60 text-[10px] text-slate-500 uppercase">
                      <tr>
                        <th className="py-2 px-3">Invoice #</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3 text-right">Pending Due</th>
                        <th className="py-2 px-3 text-right">Allocate Now (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {openCustomerInvoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="py-2 px-3 font-mono font-bold">{inv.invoiceNo}</td>
                          <td className="py-2 px-3 text-slate-500">{inv.date}</td>
                          <td className="py-2 px-3 text-right font-bold text-rose-600 tabular-nums">
                            ₹{(inv.balance || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              max={inv.balance || 0}
                              step="0.01"
                              value={allocMap[inv.id] ?? ''}
                              onChange={(e) =>
                                setAllocMap((prev) => ({
                                  ...prev,
                                  [inv.id]: Math.min(inv.balance || 0, Math.max(0, Number(e.target.value) || 0)),
                                }))
                              }
                              placeholder="0"
                              className="w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-right font-bold tabular-nums"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {effectiveAmountNum > 0 && (
                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-2 text-[11px]">
                    <span>Allocated: <strong className="text-emerald-600 tabular-nums">₹{allocBreakdown.totalAllocated.toLocaleString('en-IN')}</strong></span>
                    <span>Excess Advance: <strong className="text-sky-600 tabular-nums">₹{allocBreakdown.excessAdvance.toLocaleString('en-IN')}</strong></span>
                    {allocBreakdown.shortFall > 0 && (
                      <label className="flex items-center gap-1.5 cursor-pointer text-amber-700 dark:text-amber-300 font-semibold">
                        <input
                          type="checkbox"
                          checked={writeOffShortfall}
                          onChange={(e) => setWriteOffShortfall(e.target.checked)}
                          className="rounded text-amber-600"
                        />
                        <span>Write-off ₹{allocBreakdown.shortFall.toLocaleString('en-IN')} shortfall</span>
                      </label>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Remarks</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional note"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Upload Payment Proof ({attachments.length})</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f || f.size > 600 * 1024) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setAttachments((prev) => [
                          ...prev,
                          {
                            id: 'att-' + Date.now(),
                            name: f.name,
                            mimeType: f.type,
                            dataUrl: String(reader.result || ''),
                            uploadedAt: new Date().toISOString(),
                          },
                        ]);
                      };
                      reader.readAsDataURL(f);
                    }}
                    className="w-full text-[11px] text-slate-600"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#dc2626] hover:bg-[#b91c1c] text-white font-semibold shadow-xs cursor-pointer"
                >
                  Save Payment-In Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {isRefundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form onSubmit={handleSaveRefund} className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-sm">Record Customer Payment Refund</h3>
              <button type="button" onClick={() => setIsRefundModalOpen(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="block font-semibold mb-1">Customer *</label>
              <select value={refundCustomer} onChange={(e) => setRefundCustomer(e.target.value)} required className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
                {customers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">Refund Amount (₹) *</label>
                <input type="number" min="1" step="0.01" required value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold tabular-nums" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Refund Mode</label>
                <select value={refundMode} onChange={(e) => setRefundMode(e.target.value as ExtendedPaymentMode)} className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
                  {ALL_PAYMENT_MODES.filter((m) => m !== 'Mixed/Split').map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">Reference #</label>
              <input type="text" value={refundRef} onChange={(e) => setRefundRef(e.target.value)} className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Reason</label>
              <input type="text" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsRefundModalOpen(false)} className="px-3 py-1.5 rounded border border-slate-300 cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer">Save Refund</button>
            </div>
          </form>
        </div>
      )}

      {/* Payment Limits Settings Modal */}
      {isLimitsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-sm">Payment Governance &amp; Cash Limits</h3>
              <button type="button" onClick={() => setIsLimitsModalOpen(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2.5">
              <div>
                <label className="block font-semibold mb-1">Single Cash Tx Limit (₹)</label>
                <input type="number" min="0" value={limitsDraft.cashSingleTxLimit} onChange={(e) => setLimitsDraft((p) => ({ ...p, cashSingleTxLimit: Number(e.target.value) || 0 }))} className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 tabular-nums" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Single Bank / Digital Limit (₹)</label>
                <input type="number" min="0" value={limitsDraft.bankSingleTxLimit} onChange={(e) => setLimitsDraft((p) => ({ ...p, bankSingleTxLimit: Number(e.target.value) || 0 }))} className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 tabular-nums" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Daily User Payment Limit (₹)</label>
                <input type="number" min="0" value={limitsDraft.userDailyLimit} onChange={(e) => setLimitsDraft((p) => ({ ...p, userDailyLimit: Number(e.target.value) || 0 }))} className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 tabular-nums" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input type="checkbox" checked={limitsDraft.requireApprovalAboveLimit} onChange={(e) => setLimitsDraft((p) => ({ ...p, requireApprovalAboveLimit: e.target.checked }))} className="rounded text-rose-600" />
                <span>Require Admin approval if payment exceeds limits</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button type="button" onClick={() => setIsLimitsModalOpen(false)} className="px-3 py-1.5 rounded border border-slate-300 cursor-pointer">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  setPaymentLimits(limitsDraft);
                  setIsLimitsModalOpen(false);
                  showToast('Payment limits updated.', 'success');
                }}
                className="px-4 py-1.5 rounded bg-slate-900 text-white font-bold cursor-pointer"
              >
                Save Limits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
