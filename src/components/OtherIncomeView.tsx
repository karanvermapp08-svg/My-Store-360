import React, { useState } from 'react';
import {
  TrendingUp,
  Plus,
  Search,
  Filter,
  FileDown,
  Printer,
  Calendar,
  IndianRupee,
  Receipt,
  Trash2,
  X,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { Transaction } from '../types';

export const OtherIncomeView: React.FC = () => {
  const {
    transactions,
    addTransaction,
    deleteTransaction,
    hasPermission,
    requestConfirmation,
    showToast,
    company,
    exportCurrentViewPdf,
  } = useVyapar();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [isAddIncomeModalOpen, setIsAddIncomeModalOpen] = useState(false);

  // Modal form state
  const [sourceName, setSourceName] = useState('');
  const [category, setCategory] = useState('Commission Received');
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'Cash' | 'Cheque' | 'Bank Transfer' | 'UPI'>('Cash');
  const [notes, setNotes] = useState('');

  const otherIncomeCategories = [
    'Commission Received',
    'Rental Income',
    'Interest from Bank / FD',
    'Scrap & Packing Material Sales',
    'Bad Debts Recovered',
    'Sundry / Miscellaneous Income',
    'Cash Discount Received',
  ];

  // Filter other income transactions
  const incomeList = transactions.filter(
    (tx) => tx.type === 'Other Income' || (tx.notes && tx.notes.includes('Other Income'))
  );

  const filteredIncome = incomeList.filter((tx) => {
    if (selectedCategory !== 'All Categories') {
      const matchesCat = tx.notes?.includes(selectedCategory) || tx.partyName.includes(selectedCategory);
      if (!matchesCat) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        tx.partyName.toLowerCase().includes(q) ||
        tx.invoiceNo.toLowerCase().includes(q) ||
        tx.totalAmount.toString().includes(q) ||
        tx.paymentType.toLowerCase().includes(q) ||
        (tx.notes && tx.notes.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const totalOtherIncome = filteredIncome.reduce((acc, curr) => acc + curr.totalAmount, 0);

  const handleSaveIncome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission('create')) {
      showToast('Permission Denied: Your assigned role cannot create income entries.');
      return;
    }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      showToast('Please enter a valid income amount greater than 0');
      return;
    }
    if (!sourceName.trim()) {
      showToast('Please specify the income source or party name');
      return;
    }

    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}, ${today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const nextNo = 'INC-' + (incomeList.length + 101);

    addTransaction({
      type: 'Other Income',
      invoiceNo: nextNo,
      date: dateStr,
      partyName: sourceName.trim(),
      firm: company.name,
      user: 'Active User',
      paymentType,
      totalAmount: numAmount,
      receivedAmount: numAmount,
      balance: 0,
      dueDate: dateStr.split(',')[0],
      status: 'Paid',
      items: [
        {
          id: 'inc-item-1',
          name: category,
          hsn: '9983',
          qty: 1,
          unit: 'VOUCHER',
          price: numAmount,
          discountPercent: 0,
          taxPercent: 0,
          amount: numAmount,
        },
      ],
      notes: `[Other Income: ${category}] ${notes}`.trim(),
    });

    setIsAddIncomeModalOpen(false);
    setSourceName('');
    setAmount('');
    setNotes('');
    showToast(`Other Income of ₹ ${numAmount.toLocaleString('en-IN')} recorded successfully!`);
  };

  const handleDelete = (id: string, no: string) => {
    if (!hasPermission('delete')) {
      showToast('Permission Denied: Your assigned role cannot delete income entries.');
      return;
    }
    requestConfirmation({
      title: 'Delete Other Income Voucher',
      message: `Delete Other Income voucher #${no}? This will reverse the receipt and ledger entry.`,
      confirmLabel: 'Delete Voucher',
      variant: 'danger',
      onConfirm: () => {
        deleteTransaction(id);
        showToast(`Income voucher #${no} deleted`, 'info');
      },
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] text-slate-800 overflow-hidden">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Other Income &amp; Non-Operating Revenues</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
              Ledger
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Track secondary revenue streams, rent, interest, commissions, and non-sale business receipts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => exportCurrentViewPdf({ title: 'Other Income Statement' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 shadow-2xs"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-600" />
            <span>Export Statement</span>
          </button>

          <button
            onClick={() => setIsAddIncomeModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Other Income</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="p-6 pb-2 grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Total Other Income</div>
            <div className="text-xl font-bold text-emerald-600 mt-0.5">
              ₹ {totalOtherIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Cumulative non-operating cashflow</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Total Vouchers</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{filteredIncome.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Recorded receipts</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Average Receipt</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              ₹ {filteredIncome.length > 0 ? Math.round(totalOtherIncome / filteredIncome.length).toLocaleString('en-IN') : '0'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Per income transaction</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Active Firm</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5 truncate max-w-[150px]">{company.name}</div>
            <div className="text-[10px] text-emerald-600 font-medium mt-0.5">GSTIN: {company.gstin}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by source, voucher #..."
              className="w-full bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="All Categories">All Categories</option>
              {otherIncomeCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing {filteredIncome.length} of {incomeList.length} records
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 px-6 pb-6 overflow-hidden">
        <div className="bg-white border border-slate-200 rounded-lg shadow-2xs h-full flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Voucher No</th>
                  <th className="py-2.5 px-4">Party / Source</th>
                  <th className="py-2.5 px-4">Category &amp; Remarks</th>
                  <th className="py-2.5 px-4">Payment Mode</th>
                  <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredIncome.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <div className="font-semibold text-slate-600">No Other Income vouchers found</div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Click "+ Add Other Income" to record interest, rent, or commissions.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredIncome.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">{tx.date}</td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">{tx.invoiceNo}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{tx.partyName}</td>
                      <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate" title={tx.notes}>
                        {tx.notes || 'Other Income receipt'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {tx.paymentType}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-600 whitespace-nowrap">
                        ₹ {tx.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => handleDelete(tx.id, tx.invoiceNo)}
                          title="Delete voucher"
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Totals */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 shrink-0">
            <span>Total Filtered Income:</span>
            <span className="text-emerald-700 font-bold text-sm">
              ₹ {totalOtherIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Add Other Income Modal */}
      {isAddIncomeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md flex flex-col overflow-hidden text-xs text-slate-800">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold tracking-tight">Record Other Income Voucher</h2>
              </div>
              <button
                onClick={() => setIsAddIncomeModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveIncome} className="p-5 space-y-3.5">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Received From / Party Source *
                </label>
                <input
                  type="text"
                  required
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="e.g. HDFC Bank, Commercial Tenant, Scrap Buyer"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Income Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  {otherIncomeCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Q3 warehouse space sublease income received via NEFT."
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddIncomeModalOpen(false)}
                  className="px-4 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors shadow-2xs"
                >
                  Save Income Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
