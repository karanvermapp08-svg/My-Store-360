import React, { useState, useMemo } from 'react';
import {
  Truck,
  Plus,
  FileDown,
  Search,
  Eye,
  ArrowRight,
  Trash2,
  RotateCcw,
  FileText,
  Send,
  X,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { Transaction } from '../types';
import { DeliveryChallanModal } from './modals/DeliveryChallanModal';
import { exportDeliveryChallanPdf } from '../utils/pdfExport';

type ChallanTab =
  | 'All'
  | 'Draft'
  | 'Ready for Dispatch'
  | 'Dispatched'
  | 'Partially Returned'
  | 'Pending Billing'
  | 'Partially Invoiced'
  | 'Converted'
  | 'Cancelled';

export const DeliveryChallanView: React.FC = () => {
  const {
    transactions,
    company,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    updateChallanStatus,
    recordChallanReturn,
    convertChallanToInvoice,
    verifyDeliveryOtpAndCompleteOrder,
    deleteTransaction,
    requestConfirmation,
    exportCurrentViewPdf,
    showToast,
  } = useVyapar();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ChallanTab>('All');
  const [otpMap, setOtpMap] = useState<Record<string, string>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Return Goods Modal State
  const [returnTarget, setReturnTarget] = useState<Transaction | null>(null);
  const [returnDraft, setReturnDraft] = useState<
    Record<string, { acceptedQty: number; damagedQty: number }>
  >({});
  const [returnNotes, setReturnNotes] = useState('');

  // Partial / Full Convert-to-Invoice Modal State
  const [invoiceTarget, setInvoiceTarget] = useState<Transaction | null>(null);
  const [invoiceQtyDraft, setInvoiceQtyDraft] = useState<Record<string, number>>({});

  const pendingOnlineDispatches = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.type === 'Sale Order' &&
          t.source === 'ONLINE_STORE' &&
          !t.isCancelled &&
          t.orderWorkflowStatus === 'Out for Delivery'
      ),
    [transactions]
  );

  const allChallans = useMemo(
    () => transactions.filter((t) => t.type === 'Delivery Challan'),
    [transactions]
  );

  const getEffectiveStatus = (ch: Transaction): Exclude<ChallanTab, 'All'> => {
    if (ch.challanStatus) return ch.challanStatus;
    return ch.fulfillmentStatus === 'Completed' ? 'Converted' : 'Dispatched';
  };

  const challans = useMemo(() => {
    return allChallans.filter((t) => {
      const eff = getEffectiveStatus(t);
      if (statusFilter !== 'All' && eff !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          t.partyName.toLowerCase().includes(q) ||
          t.invoiceNo.toLowerCase().includes(q) ||
          (t.vehicleNumber && t.vehicleNumber.toLowerCase().includes(q)) ||
          (t.transporterName && t.transporterName.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [allChallans, statusFilter, search]);

  const kpis = useMemo(() => {
    let dispatched = 0;
    let pendingBilling = 0;
    let returned = 0;
    let converted = 0;
    allChallans.forEach((c) => {
      const st = getEffectiveStatus(c);
      if (st === 'Dispatched' || st === 'Pending Billing' || st === 'Partially Invoiced') {
        dispatched += 1;
        pendingBilling += 1;
      } else if (st === 'Partially Returned') {
        returned += 1;
        pendingBilling += 1;
      } else if (st === 'Converted') {
        converted += 1;
      }
    });
    return { total: allChallans.length, dispatched, pendingBilling, returned, converted };
  }, [allChallans]);

  const openReturnModal = (ch: Transaction) => {
    const initial: Record<string, { acceptedQty: number; damagedQty: number }> = {};
    (ch.items || []).forEach((it) => {
      initial[it.name] = { acceptedQty: 0, damagedQty: 0 };
    });
    setReturnDraft(initial);
    setReturnNotes('');
    setReturnTarget(ch);
  };

  const submitReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTarget) return;
    const lines = Object.entries(returnDraft).map(([name, val]) => ({
      name,
      acceptedQty: Number(val.acceptedQty || 0),
      damagedQty: Number(val.damagedQty || 0),
    }));
    const hasAny = lines.some((l) => l.acceptedQty > 0 || l.damagedQty > 0);
    if (!hasAny) {
      showToast('Enter at least 1 accepted or damaged return quantity.', 'warning');
      return;
    }
    const res = recordChallanReturn(returnTarget.id, lines, returnNotes.trim() || undefined);
    if (res.success) {
      setReturnTarget(null);
    } else {
      showToast(res.message, 'error');
    }
  };

  const openConvertInvoiceModal = (ch: Transaction) => {
    const initial: Record<string, number> = {};
    (ch.items || []).forEach((it) => {
      const remaining = Math.max(
        0,
        (it.qty || 0) - (it.returnedQty || 0) - (it.damagedQty || 0) - (it.invoicedQty || 0)
      );
      initial[it.name] = remaining;
    });
    setInvoiceQtyDraft(initial);
    setInvoiceTarget(ch);
  };

  const submitConvertInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceTarget) return;
    const customLines = (invoiceTarget.items || []).map((it) => ({
      name: it.name,
      qtyToInvoice: Number(invoiceQtyDraft[it.name] || 0),
    }));
    const created = convertChallanToInvoice(invoiceTarget.id, customLines);
    if (created) {
      setInvoiceTarget(null);
    }
  };

  const statusTone = (st: Exclude<ChallanTab, 'All'>) => {
    if (st === 'Converted') return 'text-emerald-700 dark:text-emerald-400';
    if (st === 'Cancelled') return 'text-rose-600 dark:text-rose-400';
    if (st === 'Partially Returned' || st === 'Partially Invoiced')
      return 'text-amber-600 dark:text-amber-400';
    if (st === 'Dispatched' || st === 'Pending Billing') return 'text-blue-600 dark:text-blue-400';
    return 'text-slate-600 dark:text-slate-400';
  };

  const filterTabs: ChallanTab[] = [
    'All',
    'Draft',
    'Ready for Dispatch',
    'Dispatched',
    'Partially Returned',
    'Partially Invoiced',
    'Converted',
    'Cancelled',
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#f5f6fa] dark:bg-slate-950 overflow-y-auto select-none text-xs text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <Truck className="w-5 h-5 text-[#8E0E20] dark:text-rose-400" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Delivery Challans &amp; Dispatch Lifecycle
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Manage goods dispatched before billing, partial returns with damaged-stock isolation, and invoice conversion
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportCurrentViewPdf()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Register PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-bold text-xs text-white bg-[#8E0E20] hover:bg-[#740918] shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Create Delivery Challan</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="px-6 pt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Total Challans</div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
            {kpis.total}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Pending Billing</div>
          <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums mt-0.5">
            {kpis.pendingBilling}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">With Returns</div>
          <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums mt-0.5">
            {kpis.returned}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Converted to Invoice</div>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
            {kpis.converted}
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="px-6 pt-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                statusFilter === tab
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search challan #, customer, vehicle..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#8E0E20]"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 flex-1 flex flex-col gap-4">
        {pendingOnlineDispatches.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900 p-4 space-y-3">
            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600" />
              <span>
                Online Store Orders Out for Delivery ({pendingOnlineDispatches.length}) — Enter Customer 4-Digit OTP
              </span>
            </div>
            <div className="space-y-2">
              {pendingOnlineDispatches.map((ord) => (
                <div
                  key={ord.id}
                  className="p-3 rounded-lg bg-emerald-50/40 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      {ord.onlineOrderId || `#${ord.invoiceNo}`} · {ord.partyName}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      Bag: {ord.deliveryBagId || 'N/A'} · Rider: {ord.deliveryBoyName || 'Delivery Staff'} · ₹
                      {ord.totalAmount.toLocaleString('en-IN')} ({ord.paymentType === 'Cash' ? 'COD Due' : 'Prepaid'})
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      value={otpMap[ord.id] || ''}
                      onChange={(e) => setOtpMap((p) => ({ ...p, [ord.id]: e.target.value.replace(/\D/g, '') }))}
                      placeholder="4-digit OTP"
                      className="w-24 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-center font-bold text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const res = verifyDeliveryOtpAndCompleteOrder(ord.id, otpMap[ord.id] || '', true);
                        if (res.success) setOtpMap((p) => ({ ...p, [ord.id]: '' }));
                      }}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer whitespace-nowrap"
                    >
                      Verify OTP &amp; Complete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {challans.length > 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                  <th className="py-3 px-4">Date &amp; Challan #</th>
                  <th className="py-3 px-4">Customer &amp; Purpose</th>
                  <th className="py-3 px-4">Logistics</th>
                  <th className="py-3 px-4 text-right">Qty (Disp / Ret / Bill)</th>
                  <th className="py-3 px-4 text-right">Est. Value</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {challans.map((ch) => {
                  const st = getEffectiveStatus(ch);
                  const totalQty = (ch.items || []).reduce((s, i) => s + (i.qty || 0), 0);
                  const retQty = (ch.items || []).reduce(
                    (s, i) => s + (i.returnedQty || 0) + (i.damagedQty || 0),
                    0
                  );
                  const invQty = (ch.items || []).reduce((s, i) => s + (i.invoicedQty || 0), 0);
                  const remainingQty = Math.max(0, totalQty - retQty - invQty);

                  return (
                    <tr key={ch.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">#{ch.invoiceNo}</div>
                        <div className="text-[11px] text-slate-500 tabular-nums">{ch.date}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{ch.partyName}</div>
                        <div className="text-[11px] text-slate-500">
                          {ch.challanPurpose || 'Goods sent before billing'}
                          {ch.partyPhone ? ` · ${ch.partyPhone}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                          {ch.vehicleNumber || 'Own Fleet'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                          {ch.transporterName || ch.deliveryLocation || 'Local Dispatch'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span className="font-bold text-slate-900 dark:text-white">{totalQty}</span>
                        <span className="text-slate-400"> / </span>
                        <span className="text-amber-600">{retQty}</span>
                        <span className="text-slate-400"> / </span>
                        <span className="text-emerald-600">{invQty}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                        ₹{(ch.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4">
                        <div className={`font-bold text-[11px] ${statusTone(st)}`}>{st}</div>
                        {ch.linkedSaleInvoiceNo && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Inv #{ch.linkedSaleInvoiceNo}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {st === 'Draft' && (
                            <button
                              type="button"
                              onClick={() => updateChallanStatus(ch.id, 'Ready for Dispatch')}
                              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-[11px] cursor-pointer whitespace-nowrap"
                            >
                              Mark Ready
                            </button>
                          )}
                          {(st === 'Draft' || st === 'Ready for Dispatch') && (
                            <button
                              type="button"
                              onClick={() => updateChallanStatus(ch.id, 'Dispatched')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] cursor-pointer whitespace-nowrap"
                            >
                              <Send className="w-3 h-3" />
                              <span>Dispatch</span>
                            </button>
                          )}

                          {remainingQty > 0 && st !== 'Draft' && st !== 'Ready for Dispatch' && st !== 'Cancelled' && (
                            <>
                              <button
                                type="button"
                                onClick={() => openReturnModal(ch)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-semibold text-[11px] cursor-pointer whitespace-nowrap"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Return</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openConvertInvoiceModal(ch)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] cursor-pointer whitespace-nowrap"
                              >
                                <span>Convert to Invoice</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => exportDeliveryChallanPdf(ch, company, true)}
                            title="Download A4 PDF with prices"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                          >
                            <FileText className="w-3 h-3" />
                            <span>PDF</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => exportDeliveryChallanPdf(ch, company, false)}
                            title="Download A4 PDF without prices (Gate Pass)"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                          >
                            <span>No-Price PDF</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(ch);
                              setIsInvoicePreviewOpen(true);
                            }}
                            title="Preview Challan"
                            className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {st !== 'Cancelled' && st !== 'Converted' && (
                            <button
                              type="button"
                              onClick={() =>
                                requestConfirmation({
                                  title: `Cancel Challan #${ch.invoiceNo}?`,
                                  message:
                                    'Cancelling a dispatched challan reverses unbilled stock and marks it Cancelled.',
                                  confirmLabel: 'Cancel Challan',
                                  variant: 'danger',
                                  onConfirm: () => {
                                    updateChallanStatus(ch.id, 'Cancelled');
                                  },
                                })
                              }
                              title="Cancel Challan"
                              className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              requestConfirmation({
                                title: `Move Challan #${ch.invoiceNo} to Recycle Bin?`,
                                message: 'You can restore this record from Utilities > Recycle Bin.',
                                confirmLabel: 'Move to Bin',
                                variant: 'danger',
                                onConfirm: () => {
                                  deleteTransaction(ch.id);
                                },
                              })
                            }
                            title="Delete Challan"
                            className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Truck className="w-8 h-8 text-[#8E0E20] dark:text-rose-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Delivery Challans Found</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mt-1 mb-5">
              Issue delivery challans for approval, returnable goods, or pre-billing dispatches and convert remaining items into GST invoices with zero duplicate stock deduction.
            </p>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="px-5 py-2 rounded-lg bg-[#8E0E20] hover:bg-[#740918] text-white font-bold text-xs cursor-pointer"
            >
              Create First Delivery Challan
            </button>
          </div>
        )}
      </div>

      {/* Create Challan Modal */}
      <DeliveryChallanModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />

      {/* Record Return Modal (Accepted vs Damaged) */}
      {returnTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Record Goods Return — Challan #{returnTarget.invoiceNo}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Accepted units are restored to sellable inventory; damaged units are logged separately and kept out of sellable stock.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReturnTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitReturn} className="space-y-4">
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px]">
                    <tr>
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-3 text-right">Remaining Qty</th>
                      <th className="py-2 px-3 text-right w-28">Accepted (Restock)</th>
                      <th className="py-2 px-3 text-right w-28">Damaged (Scrap)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(returnTarget.items || []).map((it) => {
                      const remaining = Math.max(
                        0,
                        (it.qty || 0) - (it.returnedQty || 0) - (it.damagedQty || 0) - (it.invoicedQty || 0)
                      );
                      const cur = returnDraft[it.name] || { acceptedQty: 0, damagedQty: 0 };
                      return (
                        <tr key={it.id || it.name}>
                          <td className="py-2 px-3 font-semibold">{it.name}</td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {remaining} {it.unit}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={0}
                              max={remaining}
                              value={cur.acceptedQty}
                              onChange={(e) =>
                                setReturnDraft((p) => ({
                                  ...p,
                                  [it.name]: {
                                    ...cur,
                                    acceptedQty: Math.max(0, Math.min(remaining, Number(e.target.value))),
                                  },
                                }))
                              }
                              className="w-full px-2 py-1 rounded border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-800 text-right tabular-nums font-bold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={0}
                              max={Math.max(0, remaining - cur.acceptedQty)}
                              value={cur.damagedQty}
                              onChange={(e) =>
                                setReturnDraft((p) => ({
                                  ...p,
                                  [it.name]: {
                                    ...cur,
                                    damagedQty: Math.max(
                                      0,
                                      Math.min(remaining - cur.acceptedQty, Number(e.target.value))
                                    ),
                                  },
                                }))
                              }
                              className="w-full px-2 py-1 rounded border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-800 text-right tabular-nums font-bold"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1">Return Inspection Notes</label>
                <input
                  type="text"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  placeholder="Condition notes / reason for return"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReturnTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
                >
                  Confirm Return &amp; Restock Accepted
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Partial / Full Convert-to-Invoice Modal */}
      {invoiceTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Convert Challan #{invoiceTarget.invoiceNo} to Tax Invoice
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Invoice all or partial remaining quantities. Stock already deducted on dispatch will NOT be deducted again.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInvoiceTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitConvertInvoice} className="space-y-4">
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px]">
                    <tr>
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-3 text-right">Unbilled Qty</th>
                      <th className="py-2 px-3 text-right w-32">Qty to Invoice</th>
                      <th className="py-2 px-3 text-right">Rate (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(invoiceTarget.items || []).map((it) => {
                      const remaining = Math.max(
                        0,
                        (it.qty || 0) - (it.returnedQty || 0) - (it.damagedQty || 0) - (it.invoicedQty || 0)
                      );
                      return (
                        <tr key={it.id || it.name}>
                          <td className="py-2 px-3 font-semibold">{it.name}</td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {remaining} {it.unit}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={0}
                              max={remaining}
                              value={invoiceQtyDraft[it.name] ?? 0}
                              onChange={(e) =>
                                setInvoiceQtyDraft((p) => ({
                                  ...p,
                                  [it.name]: Math.max(0, Math.min(remaining, Number(e.target.value))),
                                }))
                              }
                              className="w-full px-2 py-1 rounded border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-800 text-right tabular-nums font-bold"
                            />
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            ₹{it.price.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInvoiceTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  Generate Tax Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
