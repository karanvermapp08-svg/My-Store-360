import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, MessageSquare, FileDown, Building2, Clock } from 'lucide-react';
import { apiClient } from '../../utils/apiClient';
import { CompanyProfile, Transaction } from '../../types';
import { exportQuotationPdf } from '../../utils/pdfExport';

interface CustomerQuotationPortalProps {
  token: string;
}

export const CustomerQuotationPortal: React.FC<CustomerQuotationPortalProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quotation, setQuotation] = useState<Transaction | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.getPublicQuotation(token);
        if (!active) return;
        setQuotation(res.quotation);
        setCompany(res.company);
        setCustomerName(res.quotation?.partyName || '');
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'Quotation link is invalid or expired.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const handleDecision = async (decision: 'Accepted' | 'Rejected' | 'Modification Requested') => {
    if (!quotation) return;
    setSubmitting(true);
    setStatusMsg('');
    try {
      const res = await apiClient.respondPublicQuotation(token, {
        decision,
        customerName: customerName.trim() || quotation.partyName,
        comment: comment.trim(),
      });
      setQuotation(res.quotation);
      setStatusMsg(`Thank you! Your response (${decision}) has been recorded.`);
    } catch (err: any) {
      setStatusMsg(err?.message || 'Unable to record response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-600 text-sm">
        Loading quotation details...
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 text-center space-y-3">
          <XCircle className="w-10 h-10 text-rose-600 mx-auto" />
          <h1 className="text-base font-bold text-slate-900">Quotation Unavailable</h1>
          <p className="text-xs text-slate-600">{error || 'This quotation link could not be found.'}</p>
        </div>
      </div>
    );
  }

  const approvalStatus = quotation.quotationApproval?.status;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 text-xs text-slate-800">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Top Company Header */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#8E0E20] text-white flex items-center justify-center font-extrabold text-sm">
              {(company?.name || 'BM').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span>{company?.name || 'Business Manager 360'}</span>
              </h1>
              <p className="text-[11px] text-slate-500">
                {company?.address} · GSTIN: {company?.gstin || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {company && (
              <button
                type="button"
                onClick={() => exportQuotationPdf(quotation, company)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-xs cursor-pointer whitespace-nowrap"
              >
                <FileDown className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* Quotation Details */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="text-[11px] font-semibold text-slate-500">Quotation Number</div>
              <div className="text-xl font-extrabold text-slate-900 font-mono">
                #{quotation.invoiceNo} (v{quotation.quotationVersion || 1})
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Prepared for <strong className="text-slate-900">{quotation.partyName}</strong>
                {quotation.partyPhone ? ` · ${quotation.partyPhone}` : ''}
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-[11px] text-slate-500">Current Status</div>
              <div className="text-sm font-bold text-slate-900">
                {quotation.quotationStatus || 'Sent'}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-end gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Valid Until: {quotation.dueDate}</span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3">HSN</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                  <th className="py-2.5 px-3 text-right">GST %</th>
                  <th className="py-2.5 px-3 text-right">Line Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(quotation.items || []).map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td className="py-2.5 px-3 text-slate-500">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{it.name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{it.hsn || '-'}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {it.qty} {it.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      ₹{it.price.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{it.taxPercent}%</td>
                    <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                      ₹{it.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex flex-wrap justify-between gap-4 pt-2">
            <div className="max-w-md space-y-1 text-[11px] text-slate-600">
              <div className="font-bold text-slate-900">Terms &amp; Conditions</div>
              <p className="whitespace-pre-line">
                {quotation.termsAndConditions || quotation.notes || 'Standard GST billing terms apply.'}
              </p>
            </div>
            <div className="w-64 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Taxable Value</span>
                <span className="font-semibold tabular-nums">
                  ₹{(quotation.taxableAmount || quotation.subtotal || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GST</span>
                <span className="font-semibold tabular-nums">
                  ₹
                  {(
                    (quotation.cgstAmount || 0) +
                    (quotation.sgstAmount || 0) +
                    (quotation.igstAmount || 0)
                  ).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-[#8E0E20] pt-2 border-t border-slate-200">
                <span>Grand Total</span>
                <span className="tabular-nums">
                  ₹{quotation.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Decision Box */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Customer Approval &amp; Feedback</h2>

          {approvalStatus && approvalStatus !== 'Pending' && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
              Recorded Response: <strong>{approvalStatus}</strong> by{' '}
              <strong>{quotation.quotationApproval?.customerName}</strong>
              {quotation.quotationApproval?.respondedAt
                ? ` on ${new Date(quotation.quotationApproval.respondedAt).toLocaleString('en-IN')}`
                : ''}
              {quotation.quotationApproval?.comment
                ? ` — "${quotation.quotationApproval.comment}"`
                : ''}
            </div>
          )}

          {statusMsg && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 font-semibold">
              {statusMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold mb-1">Your Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Comments / Requested Changes</label>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional note or modification request"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleDecision('Accepted')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Accept Quotation</span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleDecision('Modification Requested')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Request Modification</span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleDecision('Rejected')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              <span>Reject</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
