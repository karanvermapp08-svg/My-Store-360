import React, { useState, useMemo } from 'react';
import {
  Plus,
  FileDown,
  Search,
  Eye,
  ArrowRight,
  Trash2,
  Share2,
  History,
  Copy,
  Edit3,
  RefreshCw,
  ShoppingCart,
  FileText,
  X,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { QuotationStatus, Transaction } from '../types';
import { QuotationModal } from './modals/QuotationModal';
import { exportQuotationPdf } from '../utils/pdfExport';
import { apiClient } from '../utils/apiClient';

interface EstimateQuotationViewProps {
  type: 'Estimate/Quotation' | 'Proforma Invoice';
}

const ALL_STATUSES: Array<'All' | QuotationStatus> = [
  'All',
  'Draft',
  'Sent',
  'Viewed',
  'Accepted',
  'Rejected',
  'Expired',
  'Modification Requested',
  'Converted to Order',
  'Converted to Invoice',
];

export const EstimateQuotationView: React.FC<EstimateQuotationViewProps> = ({ type }) => {
  const {
    transactions,
    company,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    convertEstimateToInvoice,
    convertQuotationToSalesOrder,
    duplicateQuotation,
    syncSharedQuotationResponse,
    deleteTransaction,
    requestConfirmation,
    exportCurrentViewPdf,
    showToast,
  } = useVyapar();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | QuotationStatus>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Transaction | null>(null);
  const [revisionQuote, setRevisionQuote] = useState<Transaction | null>(null);
  const [shareInfo, setShareInfo] = useState<{ quote: Transaction; url: string } | null>(null);
  const [syncingToken, setSyncingToken] = useState<string | null>(null);

  const targetType = type === 'Estimate/Quotation' ? 'Estimate' : 'Proforma';

  const getEffectiveStatus = (q: Transaction): QuotationStatus => {
    if (q.quotationStatus) return q.quotationStatus;
    return q.fulfillmentStatus === 'Completed' ? 'Converted to Invoice' : 'Draft';
  };

  const allQuotes = useMemo(
    () => transactions.filter((t) => t.type === targetType),
    [transactions, targetType]
  );

  const quotes = useMemo(() => {
    return allQuotes.filter((t) => {
      const eff = getEffectiveStatus(t);
      if (statusFilter !== 'All' && eff !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          t.partyName.toLowerCase().includes(q) ||
          t.invoiceNo.toLowerCase().includes(q) ||
          t.totalAmount.toString().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allQuotes, statusFilter, search]);

  const metrics = useMemo(() => {
    const total = allQuotes.reduce((s, q) => s + (q.totalAmount || 0), 0);
    const accepted = allQuotes
      .filter((q) => getEffectiveStatus(q) === 'Accepted')
      .reduce((s, q) => s + (q.totalAmount || 0), 0);
    const converted = allQuotes
      .filter((q) => {
        const st = getEffectiveStatus(q);
        return st === 'Converted to Invoice' || st === 'Converted to Order';
      })
      .reduce((s, q) => s + (q.totalAmount || 0), 0);
    const pendingCount = allQuotes.filter((q) => {
      const st = getEffectiveStatus(q);
      return st === 'Draft' || st === 'Sent' || st === 'Viewed' || st === 'Modification Requested';
    }).length;
    return { total, accepted, converted, pendingCount };
  }, [allQuotes]);

  const handleShareQuotation = async (q: Transaction) => {
    try {
      const res = await apiClient.shareQuotation(q, company);
      const url = `${window.location.origin}${window.location.pathname}?quoteToken=${encodeURIComponent(
        res.token
      )}`;
      syncSharedQuotationResponse(q.id, {
        quotationShareToken: res.token,
        quotationStatus: q.quotationStatus === 'Draft' || !q.quotationStatus ? 'Sent' : q.quotationStatus,
      });
      setShareInfo({ quote: { ...q, quotationShareToken: res.token }, url });
    } catch (err: any) {
      showToast(err?.message || 'Unable to generate share link.', 'error');
    }
  };

  const handleRefreshApproval = async (q: Transaction) => {
    if (!q.quotationShareToken) {
      showToast('Share this quotation first to track customer portal responses.', 'info');
      return;
    }
    setSyncingToken(q.id);
    try {
      const res = await apiClient.getPublicQuotation(q.quotationShareToken);
      if (res.quotation) {
        syncSharedQuotationResponse(q.id, {
          quotationStatus: res.quotation.quotationStatus,
          quotationApproval: res.quotation.quotationApproval,
        });
        showToast(
          `Synced status for #${q.invoiceNo}: ${res.quotation.quotationStatus || 'Viewed'}`,
          'success'
        );
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not fetch approval status.', 'error');
    } finally {
      setSyncingToken(null);
    }
  };

  const statusTone = (st: QuotationStatus) => {
    if (st === 'Accepted' || st === 'Converted to Invoice' || st === 'Converted to Order')
      return 'text-emerald-700 dark:text-emerald-400';
    if (st === 'Rejected' || st === 'Expired') return 'text-rose-600 dark:text-rose-400';
    if (st === 'Modification Requested') return 'text-amber-600 dark:text-amber-400';
    if (st === 'Sent' || st === 'Viewed') return 'text-blue-600 dark:text-blue-400';
    return 'text-slate-600 dark:text-slate-400';
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f5f6fa] dark:bg-slate-950 overflow-y-auto select-none text-xs text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <FileText className="w-5 h-5 text-[#8E0E20] dark:text-rose-400" />
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">{type}</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Manage revisions, shareable customer approval links, and conversions to Sales Order or GST Invoice
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
            onClick={() => {
              setEditingQuote(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-bold text-xs text-white bg-[#8E0E20] hover:bg-[#740918] shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{type === 'Estimate/Quotation' ? 'New Quotation' : 'New Proforma'}</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="px-6 pt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <span className="text-[11px] text-slate-500 font-medium">Total Quoted ({allQuotes.length})</span>
          <div className="mt-0.5 text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            ₹{metrics.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <span className="text-[11px] text-slate-500 font-medium">Customer Accepted</span>
          <div className="mt-0.5 text-xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
            ₹{metrics.accepted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <span className="text-[11px] text-slate-500 font-medium">Converted Value</span>
          <div className="mt-0.5 text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
            ₹{metrics.converted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <span className="text-[11px] text-slate-500 font-medium">Awaiting Response</span>
          <div className="mt-0.5 text-xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
            {metrics.pendingCount}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="px-6 pt-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-w-full">
          {ALL_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quote #, customer..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#8E0E20]"
          />
        </div>
      </div>

      {/* Table / Empty State */}
      <div className="p-6 flex-1 flex flex-col">
        {quotes.length > 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                  <th className="py-3 px-4">Quote # &amp; Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Valid Until</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {quotes.map((est) => {
                  const st = getEffectiveStatus(est);
                  const isConverted = st === 'Converted to Invoice' || st === 'Converted to Order';

                  return (
                    <tr key={est.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          #{est.invoiceNo} · v{est.quotationVersion || 1}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">{est.date}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{est.partyName}</div>
                        <div className="text-[11px] text-slate-500">
                          {est.partyPhone || est.partyEmail || 'No contact info'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 tabular-nums">
                        {est.dueDate || '15 Days'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                        ₹{est.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4">
                        <div className={`font-bold text-[11px] ${statusTone(st)}`}>{st}</div>
                        {est.quotationApproval?.comment && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                            Note: {est.quotationApproval.comment}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => void handleShareQuotation(est)}
                            title="Share Approval Portal Link"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-semibold text-[11px] cursor-pointer whitespace-nowrap"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>Share</span>
                          </button>

                          {est.quotationShareToken && (
                            <button
                              type="button"
                              disabled={syncingToken === est.id}
                              onClick={() => void handleRefreshApproval(est)}
                              title="Sync Customer Approval Response"
                              className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 cursor-pointer"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${syncingToken === est.id ? 'animate-spin' : ''}`}
                              />
                            </button>
                          )}

                          {!isConverted && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingQuote(est);
                                  setIsModalOpen(true);
                                }}
                                title="Edit / Create New Revision"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-[11px] cursor-pointer whitespace-nowrap"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Revise</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => convertQuotationToSalesOrder(est.id)}
                                title="Convert Quotation to Sales Order"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 font-semibold text-[11px] cursor-pointer whitespace-nowrap"
                              >
                                <ShoppingCart className="w-3 h-3" />
                                <span>To Order</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => convertEstimateToInvoice(est.id)}
                                title="Convert directly to Tax Invoice"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#8E0E20] hover:bg-[#740918] text-white font-semibold text-[11px] cursor-pointer whitespace-nowrap"
                              >
                                <span>To Invoice</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => setRevisionQuote(est)}
                            title="View Revision History"
                            className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => duplicateQuotation(est.id)}
                            title="Duplicate Quotation"
                            className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => exportQuotationPdf(est, company)}
                            title="Download A4 Quotation PDF"
                            className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(est);
                              setIsInvoicePreviewOpen(true);
                            }}
                            title="Preview Quotation"
                            className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              requestConfirmation({
                                title: `Move Quotation #${est.invoiceNo} to Recycle Bin?`,
                                message: 'You can restore deleted quotations anytime from Utilities.',
                                confirmLabel: 'Move to Bin',
                                variant: 'danger',
                                onConfirm: () => {
                                  deleteTransaction(est.id);
                                },
                              })
                            }
                            title="Delete Quotation"
                            className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
              <FileText className="w-8 h-8 text-[#8E0E20] dark:text-rose-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Quotations Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-5">
              Create professional GST quotations with revision history, send customer approval links, and convert accepted quotes into Sales Orders or Tax Invoices.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingQuote(null);
                setIsModalOpen(true);
              }}
              className="px-5 py-2 rounded-lg bg-[#8E0E20] hover:bg-[#740918] text-white font-bold text-xs cursor-pointer"
            >
              Create First {type === 'Estimate/Quotation' ? 'Quotation' : 'Proforma'}
            </button>
          </div>
        )}
      </div>

      {/* Create / Revise Modal */}
      <QuotationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingQuote(null);
        }}
        defaultType={targetType}
        editingQuotation={editingQuote}
      />

      {/* Revision History Modal */}
      {revisionQuote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">
                Revision History — #{revisionQuote.invoiceNo} (Current: v{revisionQuote.quotationVersion || 1})
              </h3>
              <button
                type="button"
                onClick={() => setRevisionQuote(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/30 flex items-center justify-between">
                <div>
                  <div className="font-bold">
                    Version {revisionQuote.quotationVersion || 1} (Current Active)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {revisionQuote.items.length} line item(s) · Status: {getEffectiveStatus(revisionQuote)}
                  </div>
                </div>
                <div className="font-extrabold tabular-nums">
                  ₹{revisionQuote.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {(revisionQuote.quotationRevisions || []).length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  No earlier versions archived yet. Editing this quotation automatically preserves prior versions here.
                </div>
              ) : (
                (revisionQuote.quotationRevisions || []).map((rev) => {
                  const delta = revisionQuote.totalAmount - rev.totalAmount;
                  return (
                    <div
                      key={rev.version}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold">Version {rev.version}</div>
                        <div className="text-[11px] text-slate-500">
                          {rev.changeSummary} · By {rev.savedBy}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold tabular-nums">
                          ₹{rev.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-500 tabular-nums">
                          Diff vs current: {delta >= 0 ? '+' : ''}₹{delta.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share Quotation Modal */}
      {shareInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Share Quotation #{shareInfo.quote.invoiceNo}</h3>
                <p className="text-[11px] text-slate-500">
                  Customers can view, download PDF, and Accept / Reject / Request Modification without logging in
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShareInfo(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareInfo.url}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-[11px]"
              />
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(shareInfo.url);
                  showToast('Customer approval link copied to clipboard.', 'success');
                }}
                className="px-3.5 py-2 rounded-lg bg-slate-900 text-white font-bold text-xs cursor-pointer whitespace-nowrap"
              >
                Copy Link
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href={`https://wa.me/${(shareInfo.quote.partyPhone || '').replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Hello ${shareInfo.quote.partyName}, please review Quotation #${shareInfo.quote.invoiceNo} (₹${shareInfo.quote.totalAmount}) from ${company.name}: ${shareInfo.url}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs whitespace-nowrap"
              >
                Send on WhatsApp
              </a>
              <a
                href={`mailto:${shareInfo.quote.partyEmail || ''}?subject=${encodeURIComponent(
                  `Quotation #${shareInfo.quote.invoiceNo} from ${company.name}`
                )}&body=${encodeURIComponent(
                  `Dear ${shareInfo.quote.partyName},\n\nPlease review and approve your quotation here:\n${shareInfo.url}\n\nRegards,\n${company.name}`
                )}`}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs whitespace-nowrap"
              >
                Send via Email
              </a>
              <button
                type="button"
                onClick={() => exportQuotationPdf(shareInfo.quote, company)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs cursor-pointer whitespace-nowrap"
              >
                Download A4 PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
