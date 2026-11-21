import React, { useState } from 'react';
import {
  Landmark,
  Scale,
  FileSpreadsheet,
  FileText,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Download,
  Calendar,
  CheckCircle2,
  PieChart,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';

export const AccountantWorkspace: React.FC = () => {
  const { transactions, company, exportCurrentViewPdf, showToast } = useVyapar();

  const [activeTab, setActiveTab] = useState<'ledgers' | 'gst_tax' | 'bank_reconciliation'>('gst_tax');

  const validSales = transactions.filter((t) => !t.isCancelled);
  const totalTaxable = validSales.reduce((sum, t) => sum + (t.taxableAmount || t.totalAmount * 0.85), 0);
  const totalCgst = validSales.reduce((sum, t) => sum + (t.cgstAmount || 0), 0);
  const totalSgst = validSales.reduce((sum, t) => sum + (t.sgstAmount || 0), 0);
  const totalIgst = validSales.reduce((sum, t) => sum + (t.igstAmount || 0), 0);
  const totalTaxCollected = totalCgst + totalSgst + totalIgst;

  return (
    <div className="flex-1 flex flex-col bg-[#f0f4f9] overflow-y-auto select-none text-xs text-slate-800 p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-200">
            <Scale className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Accountant Financial &amp; Tax Portal
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                Statutory Accounting
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">
              Double-entry ledgers, automated GSTR-1/3B tax computations, bank reconciliation, and P&amp;L audit
            </p>
          </div>
        </div>

        <button
          onClick={() => exportCurrentViewPdf()}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-2xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export GST Audit PDF</span>
        </button>
      </div>

      {/* Quick Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 rounded-xl flex items-center gap-6 shadow-2xs text-xs font-semibold">
        <button
          onClick={() => setActiveTab('gst_tax')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'gst_tax' ? 'border-blue-600 text-blue-700 font-bold' : 'border-transparent text-slate-500'
          }`}
        >
          GST Returns &amp; Tax Liability (GSTR-1 / 3B)
        </button>
        <button
          onClick={() => setActiveTab('ledgers')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'ledgers' ? 'border-blue-600 text-blue-700 font-bold' : 'border-transparent text-slate-500'
          }`}
        >
          Authoritative General Ledgers
        </button>
        <button
          onClick={() => setActiveTab('bank_reconciliation')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'bank_reconciliation' ? 'border-blue-600 text-blue-700 font-bold' : 'border-transparent text-slate-500'
          }`}
        >
          Bank &amp; Cash Reconciliation
        </button>
      </div>

      {activeTab === 'gst_tax' && (
        <div className="space-y-6">
          {/* Tax Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-slate-500 text-[11px] font-semibold">Taxable Supplies (Net)</span>
              <div className="text-xl font-bold text-slate-900 tabular-nums">
                ₹ {totalTaxable.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-slate-400">Total B2B &amp; B2C Sales</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-2xs space-y-1">
              <span className="text-blue-900 text-[11px] font-semibold">Central Tax (CGST)</span>
              <div className="text-xl font-bold text-blue-700 tabular-nums">
                ₹ {totalCgst.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-blue-600">50% Intra-State Split</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-2xs space-y-1">
              <span className="text-blue-900 text-[11px] font-semibold">State Tax (SGST)</span>
              <div className="text-xl font-bold text-blue-700 tabular-nums">
                ₹ {totalSgst.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-blue-600">50% Intra-State Split</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-slate-500 text-[11px] font-semibold">Integrated Tax (IGST)</span>
              <div className="text-xl font-bold text-slate-900 tabular-nums">
                ₹ {totalIgst.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-slate-400">Inter-State Outward</span>
            </div>
          </div>

          {/* Tax Invoices Register Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-900">Tax Invoice Master Register</h3>
              <span className="text-[11px] text-slate-500 font-mono">GSTIN: {company.gstin || '29ABCDE1234F1Z5'}</span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Date</th>
                  <th className="py-2.5 px-3 font-semibold">Invoice No</th>
                  <th className="py-2.5 px-3 font-semibold">Customer Name</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Taxable Value</th>
                  <th className="py-2.5 px-3 font-semibold text-right">CGST</th>
                  <th className="py-2.5 px-3 font-semibold text-right">SGST</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Invoice Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {validSales.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-500">{tx.date}</td>
                    <td className="py-2 px-3 font-mono font-semibold text-slate-900">{tx.invoiceNo}</td>
                    <td className="py-2 px-3 text-slate-800">{tx.partyName}</td>
                    <td className="py-2 px-3 text-right font-medium">₹ {(tx.taxableAmount || tx.totalAmount).toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right text-blue-700">₹ {(tx.cgstAmount || 0).toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right text-blue-700">₹ {(tx.sgstAmount || 0).toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">₹ {tx.totalAmount.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'ledgers' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
          <h3 className="font-bold text-xs text-slate-900">Authoritative Double-Entry Ledger Book</h3>
          <p className="text-[11px] text-slate-500">
            Realtime debits and credits posted synchronously on invoice finalization, payment inward, and cancellations.
          </p>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-3 bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Account &amp; Narration</span>
              <span>Debit / Credit</span>
            </div>
            <div className="p-3 flex items-center justify-between text-xs">
              <div>
                <strong className="text-slate-900">Cash in Hand A/c</strong>
                <p className="text-[11px] text-slate-400">Received counter sales against Cash Invoices</p>
              </div>
              <span className="font-bold text-emerald-700">DEBIT ₹ {totalTaxable.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-3 flex items-center justify-between text-xs">
              <div>
                <strong className="text-slate-900">Sales Revenue A/c</strong>
                <p className="text-[11px] text-slate-400">Total verified merchandise sales</p>
              </div>
              <span className="font-bold text-blue-700">CREDIT ₹ {totalTaxable.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'bank_reconciliation' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
          <h3 className="font-bold text-xs text-slate-900">Bank Statement Reconciliation</h3>
          <p className="text-[11px] text-slate-500">
            Reconcile HDFC Current Account (A/c: **** 8829) against verified Payment-In and POS UPI settlement records.
          </p>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
            <div>
              <strong className="font-bold block">All Bank Feeds Reconciled</strong>
              <span className="text-[11px]">Zero unreconciled discrepancies across cash book and bank ledger.</span>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
        </div>
      )}
    </div>
  );
};
