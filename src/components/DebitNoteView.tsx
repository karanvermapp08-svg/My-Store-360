import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  ArrowDownLeft,
  RotateCcw,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { Transaction } from '../types';

export const DebitNoteView: React.FC = () => {
  const {
    transactions,
    parties,
    addTransaction,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    showToast,
    exportCurrentViewPdf,
  } = useVyapar();

  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('Damaged goods returned to vendor');
  const [linkedBillNo, setLinkedBillNo] = useState('');

  const suppliers = parties.filter((p) => p.type === 'Supplier');

  // Filter debit notes
  const debitNotes = transactions.filter(
    (t) => t.type === 'Expense' && (t.notes?.toLowerCase().includes('debit note') || t.invoiceNo.startsWith('DN-'))
  );

  const handleCreateDebitNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !amount) {
      showToast('Please specify supplier and debit note amount');
      return;
    }

    addTransaction({
      type: 'Expense',
      invoiceNo: `DN-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toLocaleDateString('en-GB'),
      partyName: selectedSupplier,
      firm: 'MY STORE',
      user: 'Store Manager',
      paymentType: 'Cash',
      totalAmount: parseFloat(amount) || 0,
      receivedAmount: 0,
      balance: parseFloat(amount) || 0,
      dueDate: new Date().toLocaleDateString('en-GB'),
      status: 'Paid',
      items: [{
        id: 'dn-item',
        name: `Debit Note Adjustment: ${reason}`,
        hsn: '9983',
        qty: 1,
        unit: 'NOS',
        price: parseFloat(amount) || 0,
        discountPercent: 0,
        taxPercent: 0,
        amount: parseFloat(amount) || 0,
      }],
      notes: `Debit Note for ${selectedSupplier}. Ref Bill: ${linkedBillNo || 'Direct'}. Reason: ${reason}`,
    });

    setIsAddModalOpen(false);
    setSelectedSupplier('');
    setAmount('');
    showToast('Debit note recorded and supplier balance adjusted.');
  };

  return (
    <div className="flex-1 bg-[#f8fafc] flex flex-col overflow-hidden select-none text-xs text-slate-800">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200">
            <RotateCcw className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">Debit Notes (Purchase Returns)</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                Supplier Adjustments
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Record supplier debit notes for damaged stock returns, price discrepancies, and vendor rate corrections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCurrentViewPdf({ title: 'Debit Notes Register' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-2xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Debit Note</span>
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between gap-4 shrink-0">
        <div className="relative w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search debit note #, supplier..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-4">Debit Note #</th>
              <th className="py-2.5 px-4">Date</th>
              <th className="py-2.5 px-4">Supplier</th>
              <th className="py-2.5 px-4">Reason / Notes</th>
              <th className="py-2.5 px-4 text-right">Debit Amount</th>
              <th className="py-2.5 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {debitNotes.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <RotateCcw className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-600">No debit notes recorded</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Click "Create Debit Note" above to deduct amounts from supplier ledger.
                  </p>
                </td>
              </tr>
            ) : (
              debitNotes.map((dn) => (
                <tr key={dn.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-4 font-mono font-bold text-rose-700">{dn.invoiceNo}</td>
                  <td className="py-2.5 px-4 text-slate-600">{dn.date}</td>
                  <td className="py-2.5 px-4 font-semibold text-slate-800">{dn.partyName}</td>
                  <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate">{dn.notes}</td>
                  <td className="py-2.5 px-4 font-bold text-rose-700 text-right tabular-nums">
                    ₹ {(dn.totalAmount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <button
                      onClick={() => {
                        setSelectedInvoice(dn);
                        setIsInvoicePreviewOpen(true);
                      }}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px]"
                    >
                      Preview
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Debit Note Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <h3 className="font-bold text-sm">Issue Debit Note to Supplier</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateDebitNote} className="p-5 space-y-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Supplier *</label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name}>{s.name} (Balance: ₹{s.balance.toLocaleString('en-IN')})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Linked Purchase Bill # (Optional)</label>
                <input
                  type="text"
                  value={linkedBillNo}
                  onChange={(e) => setLinkedBillNo(e.target.value)}
                  placeholder="e.g. PUR-1024"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Debit Amount (₹) *</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  min="1"
                  step="0.01"
                  placeholder="e.g. 2450"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason for Return / Adjustment</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs"
                >
                  Record Debit Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
