import React, { useState, useMemo } from 'react';
import {
  TrendingDown,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  Layers,
  Repeat,
  DollarSign
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { Transaction } from '../types';

export const ExpensesView: React.FC = () => {
  const {
    transactions,
    addTransaction,
    showToast,
    exportCurrentViewPdf,
    businessSettings,
  } = useVyapar();

  const categories = useMemo(() => {
    const configured = businessSettings.accounting.expenseCategories || [];
    return configured.length > 0
      ? configured
      : [
          'Rent',
          'Electricity',
          'Salary',
          'Transport',
          'Telephone',
          'Internet',
          'Advertising',
          'Repairs',
          'Office Supplies',
          'Packaging',
          'Miscellaneous',
        ];
  }, [businessSettings.accounting.expenseCategories]);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [expenseCategory, setExpenseCategory] = useState(categories[0] || 'Rent');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Bank Transfer' | 'UPI'>('Cash');
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  const expenseList = useMemo(() => {
    return transactions.filter(
      (t) => t.type === 'Expense' && !t.invoiceNo.startsWith('DN-')
    );
  }, [transactions]);

  const filteredExpenses = expenseList.filter((e) => {
    const matchesSearch =
      !search ||
      e.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
      e.partyName.toLowerCase().includes(search.toLowerCase()) ||
      (e.notes && e.notes.toLowerCase().includes(search.toLowerCase()));

    const matchesCat =
      selectedCategory === 'All' ||
      e.partyName.toLowerCase() === selectedCategory.toLowerCase() ||
      (e.notes && e.notes.toLowerCase().includes(selectedCategory.toLowerCase()));

    return matchesSearch && matchesCat;
  });

  const totalExpenseSum = filteredExpenses.reduce((sum, e) => sum + (e.totalAmount || 0), 0);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid expense amount');
      return;
    }

    addTransaction({
      type: 'Expense',
      invoiceNo: `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toLocaleDateString('en-GB'),
      partyName: expenseCategory,
      firm: 'MY STORE',
      user: 'Cashier / Admin',
      paymentType: paymentMode,
      totalAmount: amt,
      receivedAmount: 0,
      balance: 0,
      dueDate: new Date().toLocaleDateString('en-GB'),
      status: 'Paid',
      items: [{
        id: 'exp-item',
        name: `Operating Expense: ${expenseCategory}`,
        hsn: '9983',
        qty: 1,
        unit: 'NOS',
        price: amt,
        discountPercent: 0,
        taxPercent: 0,
        amount: amt,
      }],
      notes: `${expenseCategory} Expense. ${isRecurring ? '(Recurring Monthly Expense). ' : ''}${notes}`,
    });

    setIsModalOpen(false);
    setExpenseAmount('');
    setNotes('');
    setIsRecurring(false);
    showToast(`Expense of ₹${amt.toLocaleString('en-IN')} recorded under ${expenseCategory}.`);
  };

  return (
    <div className="flex-1 bg-[#f8fafc] flex flex-col overflow-hidden select-none text-xs text-slate-800">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200">
            <TrendingDown className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">Expenses &amp; Operating Overheads</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                Cost Centers
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Track business running costs (Rent, Salaries, Electricity, Transport) with category breakdowns
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCurrentViewPdf({ title: 'Operating Expenses Report' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-2xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search voucher #, category, description..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium"
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="text-right">
          <span className="text-[11px] text-slate-500 mr-2">Total Expenses:</span>
          <span className="text-sm font-bold text-rose-700 tabular-nums">
            ₹ {totalExpenseSum.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-4">Voucher #</th>
              <th className="py-2.5 px-4">Date</th>
              <th className="py-2.5 px-4">Expense Category</th>
              <th className="py-2.5 px-4">Payment Mode</th>
              <th className="py-2.5 px-4">Description / Notes</th>
              <th className="py-2.5 px-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <TrendingDown className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-600">No expenses recorded</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Click "Record Expense" above to add business overheads.
                  </p>
                </td>
              </tr>
            ) : (
              filteredExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{exp.invoiceNo}</td>
                  <td className="py-2.5 px-4 text-slate-600">{exp.date}</td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      {exp.partyName || 'Operating Cost'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">{exp.paymentType}</td>
                  <td className="py-2.5 px-4 text-slate-500 max-w-sm truncate">{exp.notes}</td>
                  <td className="py-2.5 px-4 font-bold text-rose-700 text-right tabular-nums">
                    ₹ {(exp.totalAmount || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">Record Business Expense</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleAddExpense} className="p-5 space-y-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Expense Category *</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-medium"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Expense Amount (₹) *</label>
                <input
                  type="number"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  required
                  min="1"
                  step="0.01"
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Payment Channel</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  <option value="Cash">Cash in Hand</option>
                  <option value="Bank Transfer">Bank Transfer (HDFC Bank)</option>
                  <option value="UPI">UPI (QR / VPA)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Expense Description / Vendor</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. October shop rent paid to landlord"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600"
                />
                <label htmlFor="recurring" className="text-slate-700 text-xs select-none">
                  Recurring Monthly Overhead (Remind me on 1st of month)
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
