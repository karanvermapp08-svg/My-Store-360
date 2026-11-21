import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Plus,
  Search,
  Download,
  Eye,
  Trash2,
  X,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  BarChart3,
  ShieldAlert,
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
  'Bank',
  'NEFT',
  'RTGS',
  'IMPS',
  'UPI',
  'Cash',
  'Cheque',
  'Demand Draft',
  'Card',
  'Wallet',
  'Other',
  'Mixed/Split',
];

type PayOutTab = 'register' | 'reports' | 'refunds' | 'overdue';

export const PaymentOutView: React.FC = () => {
  const {
    transactions,
    parties,
    allocatePaymentToInvoices,
    reconcilePaymentTransaction,
    recordPaymentRefund,
    paymentLimits,
    deleteTransaction,
    showToast,
    exportCurrentViewPdf,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
  } = useVyapar();

  const [activeTab, setActiveTab] = useState<PayOutTab>('register');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [amount, setAmount] = useState('');
  const [extendedMode, setExtendedMode] = useState<ExtendedPaymentMode>('Bank');
  const [splitParts, setSplitParts] = useState<SplitPaymentPart[]>([
    { id: 'spo-1', mode: 'Bank', amount: 0, referenceNo: '' },
    { id: 'spo-2', mode: 'Cash', amount: 0, referenceNo: '' },
  ]);
  const [refNumber, setRefNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [writeOffShortfall, setWriteOffShortfall] = useState(false);
  const [allocMap, setAllocMap] = useState<Record<string, number>>({});

  // Supplier Refund Modal
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundSupplier, setRefundSupplier] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMode, setRefundMode] = useState<ExtendedPaymentMode>('NEFT');
  const [refundReason, setRefundReason] = useState('Supplier credit / excess payout refund received');

  const suppliers = useMemo(() => parties.filter((p) => p.type === 'Supplier'), [parties]);

  const openSupplierBills = useMemo(() => {
    if (!selectedSupplier) return [];
    return transactions.filter(
      (t) =>
        t.type === 'Purchase' &&
        !t.isCancelled &&
        !t.invoiceNo.startsWith('PAYOUT-') &&
        t.partyName.toLowerCase() === selectedSupplier.toLowerCase() &&
        (t.balance || 0) > 0.01
    );
  }, [transactions, selectedSupplier]);

  const overduePayables = useMemo(
    () =>
      transactions
        .filter(
          (t) =>
            t.type === 'Purchase' &&
            !t.isCancelled &&
            !t.invoiceNo.startsWith('PAYOUT-') &&
            (t.balance || 0) > 0.01
        )
        .sort((a, b) => (b.balance || 0) - (a.balance || 0)),
    [transactions]
  );

  const paymentOutList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (t.isCancelled) return false;
      const isPayOut =
        (t.type === 'Purchase' && t.items?.length === 0) ||
        t.notes?.toLowerCase().includes('payment-out') ||
        t.invoiceNo.startsWith('PAYOUT-');
      if (!isPayOut) return false;
      if (!q) return true;
      return (
        t.invoiceNo.toLowerCase().includes(q) ||
        t.partyName.toLowerCase().includes(q) ||
        String(t.extendedPaymentMode || t.paymentType).toLowerCase().includes(q) ||
        (t.tags || []).some((tg) => tg.toLowerCase().includes(q))
      );
    });
  }, [transactions, search]);

  const refundList = useMemo(
    () =>
      transactions.filter(
        (t) => t.type === 'Purchase Return' && (t.refundedAmount || 0) > 0 && !t.isCancelled
      ),
    [transactions]
  );

  const modeSummary = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    paymentOutList.forEach((p) => {
      const m = p.extendedPaymentMode || p.paymentType || 'Bank';
      const cur = map.get(m) || { count: 0, total: 0 };
      map.set(m, { count: cur.count + 1, total: cur.total + (p.totalAmount || 0) });
    });
    return Array.from(map.entries()).map(([mode, stats]) => ({ mode, ...stats }));
  }, [paymentOutList]);

  const splitSum = useMemo(
    () => splitParts.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [splitParts]
  );

  const effectiveAmountNum =
    extendedMode === 'Mixed/Split' ? Math.round(splitSum * 100) / 100 : parseFloat(amount) || 0;

  const allocBreakdown = useMemo(() => {
    const rows = Object.entries(allocMap)
      .filter(([, amt]) => (Number(amt) || 0) > 0)
      .map(([invoiceId, amt]) => {
        const bill = openSupplierBills.find((b) => b.id === invoiceId);
        return {
          invoiceId,
          invoiceTotalPending: bill?.balance || 0,
          allocatedAmount: amt,
        };
      });
    return calculatePaymentAllocationBreakdown({
      paymentAmount: effectiveAmountNum,
      allocations: rows,
      writeOffShortfall,
    });
  }, [effectiveAmountNum, allocMap, openSupplierBills, writeOffShortfall]);

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
    if (!selectedSupplier || effectiveAmountNum <= 0) return undefined;
    return detectDuplicateTransactionFingerprint(transactions, {
      type: 'Purchase',
      partyName: selectedSupplier,
      totalAmount: effectiveAmountNum,
      date: new Date().toLocaleDateString('en-GB'),
    });
  }, [transactions, selectedSupplier, effectiveAmountNum]);

  const handleAutoAllocateFifo = () => {
    let remaining = Math.max(0, effectiveAmountNum);
    if (remaining <= 0) {
      const totalOpen = openSupplierBills.reduce((s, b) => s + (b.balance || 0), 0);
      remaining = totalOpen;
      setAmount(String(totalOpen));
    }
    const nextMap: Record<string, number> = {};
    for (const bill of openSupplierBills) {
      if (remaining <= 0) break;
      const take = Math.min(bill.balance || 0, remaining);
      nextMap[bill.id] = Math.round(take * 100) / 100;
      remaining = Math.round((remaining - take) * 100) / 100;
    }
    setAllocMap(nextMap);
  };

  const handleRecordPaymentOut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || effectiveAmountNum <= 0) {
      showToast('Please select supplier and enter a valid payment amount', 'warning');
      return;
    }

    const supObj = suppliers.find((s) => s.name === selectedSupplier);
    const allocations = Object.entries(allocMap)
      .filter(([, val]) => val > 0)
      .map(([invoiceId, amt]) => ({ invoiceId, amount: amt }));

    const created = allocatePaymentToInvoices({
      direction: 'OUT',
      partyName: selectedSupplier,
      partyPhone: supObj?.phone,
      paymentType: mapExtendedModeToTxPaymentType(extendedMode),
      extendedPaymentMode: extendedMode,
      splitPayments: extendedMode === 'Mixed/Split' ? splitParts.filter((s) => s.amount > 0) : undefined,
      totalAmount: effectiveAmountNum,
      writeOffAmount: allocBreakdown.writeOffAmount,
      refNo: refNumber,
      notes,
      tags: tagsInput.split(',').map((s) => s.trim()).filter(Boolean),
      allocations,
    });

    if (created) {
      setIsModalOpen(false);
      setSelectedSupplier('');
      setAmount('');
      setRefNumber('');
      setNotes('');
      setTagsInput('');
      setWriteOffShortfall(false);
      setAllocMap({});
    }
  };

  const handleSaveRefund = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(refundAmount) || 0;
    if (!refundSupplier || amt <= 0) {
      showToast('Select supplier and enter refund amount.', 'warning');
      return;
    }
    const res = recordPaymentRefund({
      direction: 'OUT_REFUND',
      partyName: refundSupplier,
      amount: amt,
      mode: refundMode,
      reason: refundReason,
    });
    if (res) {
      showToast(`Supplier refund #${res.invoiceNo} of ₹${amt.toLocaleString('en-IN')} logged.`, 'success');
      setIsRefundModalOpen(false);
      setRefundAmount('');
    }
  };

  const totalPaidOut = paymentOutList.reduce((s, p) => s + (p.totalAmount || 0), 0);

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-slate-950 flex flex-col overflow-hidden select-none text-xs text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-900">
            <ArrowUpRight className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
              Make Payment (Payment-Out) &bull; Total ₹{totalPaidOut.toLocaleString('en-IN')}
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Settle supplier payables via 12 modes, split payouts, reconciliation, write-offs &amp; supplier refunds
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRefundSupplier(suppliers[0]?.name || '');
              setIsRefundModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Supplier Refund</span>
          </button>
          <button
            type="button"
            onClick={() => exportCurrentViewPdf({ title: 'Payment-Out Register' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedSupplier(suppliers[0]?.name || '');
              setAllocMap({});
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment-Out</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-2 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2">
          {[
            { id: 'register', label: `Payout Register (${paymentOutList.length})`, icon: ArrowUpRight },
            { id: 'reports', label: 'Channel Summary', icon: BarChart3 },
            { id: 'refunds', label: `Supplier Refunds (${refundList.length})`, icon: RotateCcw },
            { id: 'overdue', label: `Open Payables (${overduePayables.length})`, icon: ShieldAlert },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as PayOutTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs cursor-pointer ${
                  active ? 'bg-slate-900 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search voucher #, supplier, mode..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
        {activeTab === 'register' && (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Voucher #</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Paid To (Supplier)</th>
                <th className="py-2.5 px-4">Payment Channel</th>
                <th className="py-2.5 px-4">Reference / Reconciliation</th>
                <th className="py-2.5 px-4 text-right">Amount Paid</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
              {paymentOutList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <ArrowUpRight className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">No payment-out vouchers recorded</p>
                  </td>
                </tr>
              ) : (
                paymentOutList.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white">{po.invoiceNo}</td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">{po.date}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">{po.partyName}</td>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {po.extendedPaymentMode || po.paymentType}
                      </span>
                      {po.splitPayments && po.splitPayments.length > 0 && (
                        <div className="text-[10px] text-slate-500">
                          {po.splitPayments.map((s) => `${s.mode}: ₹${s.amount}`).join(' + ')}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px] max-w-xs">
                      <div className="truncate">{po.notes || '-'}</div>
                      {po.reconciled ? (
                        <span className="text-emerald-600 font-bold inline-flex items-center gap-1 text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> Reconciled ({po.reconciledRef})
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => reconcilePaymentTransaction(po.id)}
                          className="text-blue-600 hover:underline text-[10px] font-semibold cursor-pointer"
                        >
                          Mark Reconciled
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-rose-700 dark:text-rose-400 text-right tabular-nums">
                      ₹ {(po.totalAmount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoice(po);
                            setIsInvoicePreviewOpen(true);
                          }}
                          title="Preview Payment Voucher"
                          className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTransaction(po.id)}
                          title="Delete Payment Voucher"
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'reports' && (
          <div className="p-6">
            <h3 className="font-bold text-sm mb-3">Payment-Out Channel Breakdown</h3>
            <table className="w-full max-w-xl text-left border border-slate-200 dark:border-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800 text-[11px]">
                <tr>
                  <th className="py-2 px-3">Channel</th>
                  <th className="py-2 px-3 text-right">Vouchers</th>
                  <th className="py-2 px-3 text-right">Total Disbursed (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {modeSummary.map((m) => (
                  <tr key={m.mode}>
                    <td className="py-2 px-3 font-semibold">{m.mode}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{m.count}</td>
                    <td className="py-2 px-3 text-right font-bold text-rose-600 tabular-nums">
                      ₹{m.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'refunds' && (
          <div className="p-6">
            <h3 className="font-bold text-sm mb-3">Supplier Refunds Received</h3>
            {refundList.length === 0 ? (
              <p className="text-slate-400">No supplier refunds recorded.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-w-2xl border border-slate-200 dark:border-slate-700 rounded-lg">
                {refundList.map((rf) => (
                  <div key={rf.id} className="p-3 flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{rf.partyName}</div>
                      <div className="text-[10px] text-slate-500">{rf.invoiceNo} · {rf.notes}</div>
                    </div>
                    <span className="font-bold text-emerald-600 tabular-nums">+₹{(rf.refundedAmount || rf.totalAmount).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'overdue' && (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold">
              <tr>
                <th className="py-2.5 px-4">Bill #</th>
                <th className="py-2.5 px-4">Supplier</th>
                <th className="py-2.5 px-4">Due Date</th>
                <th className="py-2.5 px-4 text-right">Pending Payable (₹)</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {overduePayables.map((b) => (
                <tr key={b.id}>
                  <td className="py-2.5 px-4 font-mono font-bold">#{b.invoiceNo}</td>
                  <td className="py-2.5 px-4 font-semibold">{b.partyName}</td>
                  <td className="py-2.5 px-4 text-slate-500">{b.dueDate}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-rose-600 tabular-nums">₹{b.balance.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSupplier(b.partyName);
                        setAmount(String(b.balance));
                        setAllocMap({ [b.id]: b.balance });
                        setIsModalOpen(true);
                      }}
                      className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] cursor-pointer"
                    >
                      Pay Bill
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Record Payment-Out Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-sm">Disburse Payment to Supplier &amp; Settle Bills</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRecordPaymentOut} className="p-5 space-y-4 overflow-y-auto">
              {(limitWarning.exceedsLimit || duplicateCandidate) && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 text-amber-900 dark:text-amber-200 text-[11px] space-y-1">
                  {limitWarning.exceedsLimit && (
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Limit Alert: {limitWarning.reasons.join('; ')}</span>
                    </div>
                  )}
                  {duplicateCandidate && (
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Matching voucher #{duplicateCandidate.invoiceNo} already exists today.</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Select Supplier *</label>
                  <select
                    value={selectedSupplier}
                    onChange={(e) => {
                      setSelectedSupplier(e.target.value);
                      setAllocMap({});
                    }}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800"
                  >
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} (Payable: ₹{s.balance.toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Payment Amount (₹) *</label>
                  <input
                    type="number"
                    value={extendedMode === 'Mixed/Split' ? splitSum : amount}
                    readOnly={extendedMode === 'Mixed/Split'}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    min="1"
                    step="0.01"
                    placeholder="e.g. 15000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold tabular-nums read-only:bg-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Payment Channel *</label>
                  <select
                    value={extendedMode}
                    onChange={(e) => setExtendedMode(e.target.value as ExtendedPaymentMode)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 font-semibold"
                  >
                    {ALL_PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Ref / UTR / Cheque #</label>
                  <input
                    type="text"
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                    placeholder="e.g. UTR-9823412039"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Tags</label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="Optional tags"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
              </div>

              {extendedMode === 'Mixed/Split' && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] uppercase">Split Payout Total: ₹{splitSum.toLocaleString('en-IN')}</span>
                    <button
                      type="button"
                      onClick={() => setSplitParts((p) => [...p, { id: 'spo-' + Date.now(), mode: 'UPI', amount: 0, referenceNo: '' }])}
                      className="px-2 py-1 rounded bg-slate-800 text-white text-[10px] font-semibold cursor-pointer"
                    >
                      + Add Mode
                    </button>
                  </div>
                  {splitParts.map((part, i) => (
                    <div key={part.id} className="grid grid-cols-12 gap-2 items-center">
                      <select
                        value={part.mode}
                        onChange={(e) => setSplitParts((p) => p.map((x, idx) => (idx === i ? { ...x, mode: e.target.value as SplitPaymentPart['mode'] } : x)))}
                        className="col-span-4 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                      >
                        {ALL_PAYMENT_MODES.filter((m) => m !== 'Mixed/Split').map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={part.amount}
                        onChange={(e) => setSplitParts((p) => p.map((x, idx) => (idx === i ? { ...x, amount: Number(e.target.value) || 0 } : x)))}
                        className="col-span-4 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-right font-bold tabular-nums"
                      />
                      <input
                        type="text"
                        value={part.referenceNo || ''}
                        onChange={(e) => setSplitParts((p) => p.map((x, idx) => (idx === i ? { ...x, referenceNo: e.target.value } : x)))}
                        placeholder="Ref #"
                        className="col-span-3 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono"
                      />
                      <button
                        type="button"
                        disabled={splitParts.length <= 2}
                        onClick={() => setSplitParts((p) => p.filter((_, idx) => idx !== i))}
                        className="col-span-1 text-rose-600 disabled:opacity-30 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Open Supplier Purchase Bills */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="font-bold text-[11px] uppercase text-slate-600 dark:text-slate-300">
                    Open Supplier Bills ({openSupplierBills.length})
                  </span>
                  {openSupplierBills.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAutoAllocateFifo}
                      className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] cursor-pointer"
                    >
                      Auto-Allocate (FIFO)
                    </button>
                  )}
                </div>
                {openSupplierBills.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-[11px]">
                    No pending purchase bills for {selectedSupplier || 'this supplier'}. Payment will reduce overall supplier balance.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/70 dark:bg-slate-800/60 text-[10px] text-slate-500 uppercase">
                      <tr>
                        <th className="py-2 px-3">Bill #</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3 text-right">Pending Payable</th>
                        <th className="py-2 px-3 text-right">Settle Now (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {openSupplierBills.map((bill) => (
                        <tr key={bill.id}>
                          <td className="py-2 px-3 font-mono font-bold">{bill.invoiceNo}</td>
                          <td className="py-2 px-3 text-slate-500">{bill.date}</td>
                          <td className="py-2 px-3 text-right font-bold text-rose-600 tabular-nums">
                            ₹{(bill.balance || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              max={bill.balance || 0}
                              step="0.01"
                              value={allocMap[bill.id] ?? ''}
                              onChange={(e) =>
                                setAllocMap((prev) => ({
                                  ...prev,
                                  [bill.id]: Math.min(bill.balance || 0, Math.max(0, Number(e.target.value) || 0)),
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
                {effectiveAmountNum > 0 && allocBreakdown.shortFall > 0 && (
                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between text-[11px]">
                    <span>Settled: ₹{allocBreakdown.totalAllocated.toLocaleString('en-IN')}</span>
                    <label className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold cursor-pointer">
                      <input type="checkbox" checked={writeOffShortfall} onChange={(e) => setWriteOffShortfall(e.target.checked)} className="rounded text-amber-600" />
                      <span>Supplier discount / write-off ₹{allocBreakdown.shortFall.toLocaleString('en-IN')}</span>
                    </label>
                  </div>
                )}
              </div>

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

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs cursor-pointer"
                >
                  Save Payment-Out
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Refund Modal */}
      {isRefundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form onSubmit={handleSaveRefund} className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-sm">Record Supplier Refund</h3>
              <button type="button" onClick={() => setIsRefundModalOpen(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="block font-semibold mb-1">Supplier *</label>
              <select value={refundSupplier} onChange={(e) => setRefundSupplier(e.target.value)} required className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
                {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">Refund Amount (₹) *</label>
                <input type="number" min="1" step="0.01" required value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold tabular-nums" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Mode</label>
                <select value={refundMode} onChange={(e) => setRefundMode(e.target.value as ExtendedPaymentMode)} className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
                  {ALL_PAYMENT_MODES.filter((m) => m !== 'Mixed/Split').map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
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
    </div>
  );
};
