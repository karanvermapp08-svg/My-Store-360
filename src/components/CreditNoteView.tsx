import React, { useState, useMemo } from 'react';
import {
  Plus,
  ChevronDown,
  Search,
  FileSpreadsheet,
  Printer,
  FileDown,
  Eye,
  Trash2,
  Undo2
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { Transaction } from '../types';

export const CreditNoteView: React.FC = () => {
  const {
    transactions,
    returnRequests,
    processReturnRefundRequest,
    filterPeriod,
    setFilterPeriod,
    filterStartDate,
    filterEndDate,
    filterFirm,
    filterUser,
    setIsAddSaleOpen,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    deleteTransaction,
    exportCurrentViewPdf,
    showToast,
  } = useVyapar();

  const [periodOpen, setPeriodOpen] = useState(false);
  const [creditType, setCreditType] = useState('Credit Note');
  const [paymentType, setPaymentType] = useState('All Payment');
  const [search, setSearch] = useState('');

  // Filter credit note transactions
  const creditNotes = useMemo(() => {
    return transactions.filter((t) => {
      if (t.type !== 'Sale Return') return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          t.partyName.toLowerCase().includes(q) ||
          t.invoiceNo.toLowerCase().includes(q) ||
          (t.originalInvoiceNo && t.originalInvoiceNo.toLowerCase().includes(q)) ||
          t.totalAmount.toString().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [transactions, search]);

  const totalReturnAmount = useMemo(() => {
    return creditNotes.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
  }, [creditNotes]);

  return (
    <div className="flex-1 flex flex-col bg-[#f0f4f9] overflow-hidden select-none text-xs text-slate-800">
      {/* 1. Top Filter Row */}
      <div className="bg-white px-6 py-2.5 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Dropdown */}
          <div className="relative">
            <button
              onClick={() => setPeriodOpen(!periodOpen)}
              className="flex items-center gap-1.5 text-base font-bold text-[#0f172a] hover:text-[#dc2626] transition-colors"
            >
              <span>{filterPeriod}</span>
              <ChevronDown className="w-4 h-4 text-[#64748b]" />
            </button>
            {periodOpen && (
              <div className="absolute left-0 top-8 w-36 bg-white border border-[#e2e8f0] rounded-lg shadow-md py-1 z-30 text-xs font-normal">
                {['Today', 'This Week', 'This Month', 'Last Month', 'This Year'].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setFilterPeriod(p);
                      setPeriodOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#f8fafc]"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date pill */}
          <div className="flex items-center gap-1 px-3 py-1 rounded bg-[#f1f5f9] border border-[#cbd5e1] text-[#334155] font-medium text-xs">
            <span className="text-[#64748b]">Between</span>
            <span>{filterStartDate} To {filterEndDate}</span>
          </div>

          <div className="flex items-center gap-1 px-3 py-1 rounded border border-[#cbd5e1] bg-white text-[#334155] uppercase font-semibold text-[11px]">
            <span>{filterFirm}</span>
          </div>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-4 text-xs font-medium text-[#475569]">
          <button
            onClick={() => exportCurrentViewPdf()}
            title="Export Credit Notes & Returns as PDF"
            className="flex flex-col items-center hover:text-[#0f172a]"
          >
            <span className="text-rose-600 font-bold text-sm">pdf</span>
            <span className="text-[10px]">PDF Report</span>
          </button>

          <button
            onClick={() => {
              if (creditNotes.length === 0) {
                showToast('No credit notes to export', 'warning');
                return;
              }
              const headers = 'Date,Credit Note No,Original Invoice,Party Name,Return Reason,Taxable Amount,Total Amount\n';
              const rows = creditNotes
                .map(
                  (cn) =>
                    `"${cn.date}","${cn.invoiceNo}","${cn.originalInvoiceNo || ''}","${cn.partyName.replace(/"/g, '""')}","${(cn.returnReason || cn.notes || 'Goods Return').replace(/"/g, '""')}",${cn.taxableAmount || cn.totalAmount},${cn.totalAmount}`
                )
                .join('\n');
              const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `Credit_Notes_Report_${new Date().toISOString().slice(0, 10)}.csv`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              showToast('Credit notes exported to CSV', 'success');
            }}
            className="flex flex-col items-center hover:text-[#0f172a] cursor-pointer"
          >
            <span className="text-emerald-600 font-bold text-sm">xls</span>
            <span className="text-[10px]">Excel Report</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex flex-col items-center hover:text-[#0f172a]"
          >
            <Printer className="w-4 h-4 text-[#64748b]" />
            <span className="text-[10px]">Print</span>
          </button>
        </div>
      </div>

      {/* 2. Secondary Filter Row */}
      <div className="bg-white px-6 py-2 border-b border-[#e2e8f0] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded border border-[#cbd5e1] bg-white text-[#334155] font-medium">
            <span>{creditType}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded border border-[#cbd5e1] bg-white text-[#334155] font-medium">
            <span>{paymentType}</span>
          </div>
        </div>

        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search return by party, credit note #..."
            className="w-full bg-white border border-[#cbd5e1] rounded pl-8 pr-3 py-1 text-xs focus:outline-none focus:border-[#0284c7]"
          />
        </div>

        <button
          onClick={() => {
            setIsAddSaleOpen(true);
            showToast('Add Credit Note / Sale Return');
          }}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md font-semibold text-xs text-white bg-[#0284c7] hover:bg-[#0369a1] shadow-2xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ Add Credit Note</span>
        </button>
      </div>

      {/* 3. Pending Online Return Requests + Credit Notes Table */}
      <div className="flex-1 bg-white flex flex-col justify-between overflow-hidden">
        {returnRequests.some((r) => r.status === 'Requested') && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 space-y-2 shrink-0">
            <div className="text-xs font-bold text-amber-900">
              Pending Customer Return &amp; Refund Requests ({returnRequests.filter((r) => r.status === 'Requested').length})
            </div>
            <div className="space-y-1.5">
              {returnRequests
                .filter((r) => r.status === 'Requested')
                .map((req) => (
                  <div
                    key={req.id}
                    className="p-2.5 rounded bg-white border border-amber-200 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-900">
                        {req.returnNo}{req.invoiceNo ? ` · Inv #${req.invoiceNo}` : ''}
                      </span>
                      <span className="mx-2 text-slate-400">·</span>
                      <span className="font-semibold text-slate-800">{req.customerName}</span>
                      <span className="mx-2 text-slate-400">·</span>
                      <span className="font-bold text-rose-700">₹{req.refundAmount.toLocaleString('en-IN')}</span>
                      <div className="text-[11px] text-slate-500">Reason: {req.reason}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => processReturnRefundRequest(req.id, 'Rejected')}
                        className="px-2.5 py-1 rounded border border-rose-200 text-rose-700 font-bold hover:bg-rose-50 cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => processReturnRefundRequest(req.id, 'Approved')}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                      >
                        Approve, Restock &amp; Issue Credit Note
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
        {creditNotes.length > 0 ? (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-[#e2e8f0] text-[#64748b] font-semibold text-[11px] uppercase sticky top-0 bg-white">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Credit Note #</th>
                  <th className="py-2.5 px-3">Original Invoice</th>
                  <th className="py-2.5 px-3">Party Name</th>
                  <th className="py-2.5 px-3">Return Reason</th>
                  <th className="py-2.5 px-3 text-right">Taxable</th>
                  <th className="py-2.5 px-3 text-right">Total (₹)</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {creditNotes.map((cn, idx) => (
                  <tr key={cn.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{cn.date}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 font-mono">#{cn.invoiceNo}</td>
                    <td className="py-2.5 px-3 text-[#0284c7] font-semibold">
                      {cn.originalInvoiceNo ? `Invoice #${cn.originalInvoiceNo}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{cn.partyName}</td>
                    <td className="py-2.5 px-3 text-slate-600 italic">{cn.returnReason || cn.notes || 'Goods Return'}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                      ₹{(cn.taxableAmount || cn.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-600 tabular-nums">
                      ₹{cn.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedInvoice(cn);
                            setIsInvoicePreviewOpen(true);
                          }}
                          title="Preview Credit Note"
                          className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteTransaction(cn.id)}
                          title="Delete Credit Note"
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
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
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-24 h-24 mb-4 opacity-40 flex items-center justify-center">
              <Undo2 className="w-16 h-16 text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-[#0f172a]">
              No data is available for Credit Note.
            </h3>
            <p className="text-xs text-[#94a3b8] mt-1">
              Record sales returns and issue credit notes with automatic stock and GST reversal.
            </p>
          </div>
        )}

        {/* Bottom bar with totals */}
        <div className="px-6 py-2.5 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-between text-xs text-[#475569] font-medium shrink-0">
          <div>
            Total Credit Returns: <strong className="text-[#0f172a] tabular-nums font-semibold">₹{totalReturnAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
          <div>
            Count: <strong className="text-[#0f172a] tabular-nums font-semibold">{creditNotes.length} Record(s)</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
