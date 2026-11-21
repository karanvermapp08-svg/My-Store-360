import React from 'react';
import { X, BarChart3, TrendingUp, DollarSign, PieChart, Users } from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';

export const AnalyticsModal: React.FC = () => {
  const {
    isAnalyticsModalOpen,
    setIsAnalyticsModalOpen,
    transactions,
    totalSalesAmount,
    totalReceivedAmount,
    totalBalanceAmount,
  } = useVyapar();

  if (!isAnalyticsModalOpen) return null;

  const totalInvoices = transactions.filter((t) => t.type === 'Sale').length;
  const cashSales = transactions
    .filter((t) => t.paymentType === 'Cash')
    .reduce((acc, curr) => acc + curr.totalAmount, 0);
  const upiSales = transactions
    .filter((t) => t.paymentType === 'UPI')
    .reduce((acc, curr) => acc + curr.totalAmount, 0);
  const bankSales = transactions
    .filter((t) => t.paymentType === 'Bank Transfer' || t.paymentType === 'Cheque')
    .reduce((acc, curr) => acc + curr.totalAmount, 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-xs text-slate-800">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-rose-400" />
            <h2 className="text-sm font-bold tracking-tight">Sales Analytics &amp; Reports</h2>
          </div>
          <button
            onClick={() => setIsAnalyticsModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 font-medium text-[11px] block">Total Invoiced</span>
              <div className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
                ₹ {totalSalesAmount.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold">{totalInvoices} Invoices</span>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="text-emerald-700 font-medium text-[11px] block">Cash &amp; Bank Collected</span>
              <div className="text-lg font-bold text-emerald-800 mt-1 tabular-nums">
                ₹ {totalReceivedAmount.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-emerald-700">Realized Revenue</span>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <span className="text-rose-700 font-medium text-[11px] block">Outstanding Receivables</span>
              <div className="text-lg font-bold text-rose-800 mt-1 tabular-nums">
                ₹ {totalBalanceAmount.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-rose-700">Pending Collection</span>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-3">
            <h4 className="font-bold text-slate-900 text-xs">Payment Collection Modes</h4>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[11px] text-slate-700 mb-1">
                  <span>UPI / QR Code</span>
                  <span className="font-semibold tabular-nums">₹ {upiSales.toLocaleString('en-IN')}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-sky-500 h-2 rounded-full"
                    style={{
                      width: totalSalesAmount > 0 ? `${(upiSales / totalSalesAmount) * 100}%` : '0%',
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-700 mb-1">
                  <span>Cash Payments</span>
                  <span className="font-semibold tabular-nums">₹ {cashSales.toLocaleString('en-IN')}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full"
                    style={{
                      width: totalSalesAmount > 0 ? `${(cashSales / totalSalesAmount) * 100}%` : '0%',
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-700 mb-1">
                  <span>Bank Transfer / NEFT / Cheque</span>
                  <span className="font-semibold tabular-nums">₹ {bankSales.toLocaleString('en-IN')}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full"
                    style={{
                      width: totalSalesAmount > 0 ? `${(bankSales / totalSalesAmount) * 100}%` : '0%',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={() => setIsAnalyticsModalOpen(false)}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-900 text-white font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
