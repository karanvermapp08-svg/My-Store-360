import React, { useState, useMemo } from 'react';
import {
  Plus,
  FileDown,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  ArrowRight,
  Trash2,
  ShoppingBag,
  Truck
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { Transaction } from '../types';

export const SaleOrderView: React.FC = () => {
  const {
    transactions,
    setIsAddSaleOpen,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    convertSalesOrderToInvoice,
    approveOnlineOrder,
    packOnlineOrder,
    assignDeliveryBoyToOrder,
    deleteTransaction,
    exportCurrentViewPdf,
    showToast,
  } = useVyapar();

  const [activeTab, setActiveTab] = useState<'SALE ORDERS' | 'ONLINE ORDERS'>('SALE ORDERS');
  const [search, setSearch] = useState('');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<'All' | 'Pending' | 'Completed'>('All');

  const onlineOrdersCount = useMemo(
    () => transactions.filter((t) => t.type === 'Sale Order' && t.source === 'ONLINE_STORE').length,
    [transactions]
  );

  const saleOrders = useMemo(() => {
    return transactions.filter((t) => {
      if (t.type !== 'Sale Order') return false;
      if (activeTab === 'ONLINE ORDERS' && t.source !== 'ONLINE_STORE') return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          t.partyName.toLowerCase().includes(q) ||
          t.invoiceNo.toLowerCase().includes(q) ||
          (t.onlineOrderId && t.onlineOrderId.toLowerCase().includes(q)) ||
          totalMatchStr(t).includes(q);
        if (!match) return false;
      }
      if (fulfillmentFilter === 'Completed' && t.fulfillmentStatus !== 'Completed') return false;
      if (fulfillmentFilter === 'Pending' && t.fulfillmentStatus === 'Completed') return false;
      return true;
    });
  }, [transactions, search, fulfillmentFilter, activeTab]);

  function totalMatchStr(t: Transaction) {
    return t.totalAmount.toString();
  }

  const totalOrdersAmount = useMemo(() => {
    return saleOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  }, [saleOrders]);

  const totalAdvanceReceived = useMemo(() => {
    return saleOrders.reduce((sum, o) => sum + (o.receivedAmount || 0), 0);
  }, [saleOrders]);

  const pendingOrdersCount = useMemo(() => {
    return saleOrders.filter((o) => o.fulfillmentStatus !== 'Completed').length;
  }, [saleOrders]);

  return (
    <div className="flex-1 flex flex-col bg-[#f0f4f9] overflow-y-auto select-none text-xs text-slate-800">
      {/* 1. Top Sub-tabs */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 flex items-center justify-between text-xs font-bold text-[#64748b] shrink-0">
        <div className="flex items-center gap-8 md:gap-16">
          <button
            onClick={() => setActiveTab('SALE ORDERS')}
            className={`py-3.5 tracking-wider transition-colors ${
              activeTab === 'SALE ORDERS'
                ? 'text-[#0284c7] border-b-2 border-[#0284c7]'
                : 'hover:text-[#0f172a]'
            }`}
          >
            SALE ORDERS
          </button>

          <button
            onClick={() => setActiveTab('ONLINE ORDERS')}
            className={`py-3.5 tracking-wider transition-colors ${
              activeTab === 'ONLINE ORDERS'
                ? 'text-[#0284c7] border-b-2 border-[#0284c7]'
                : 'hover:text-[#0f172a]'
            }`}
          >
            ONLINE STORE ORDERS{onlineOrdersCount > 0 ? ` (${onlineOrdersCount})` : ''}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCurrentViewPdf()}
            title="Export Sale Orders Register as PDF"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>

          <button
            onClick={() => {
              setIsAddSaleOpen(true);
              showToast('Create Sale Order');
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md font-semibold text-xs text-white bg-[#f59e0b] hover:bg-[#d97706] shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ Add Sale Order</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Toolbar */}
      <div className="bg-white px-6 py-2.5 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-slate-500 font-medium">Status Filter:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-full border border-slate-200 text-[11px]">
            {(['All', 'Pending', 'Completed'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFulfillmentFilter(st)}
                className={`px-3 py-0.5 rounded-full font-medium transition-colors ${
                  fulfillmentFilter === st ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sale orders..."
            className="w-full bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1 text-xs focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* 3. Summary Metric Cards */}
      <div className="px-6 pt-5 grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Total Booked Orders ({saleOrders.length})</span>
          <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
            ₹{totalOrdersAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs">
          <span className="text-xs text-emerald-700 font-medium">Advances Collected</span>
          <div className="mt-1 text-xl font-bold text-emerald-600 tabular-nums">
            ₹{totalAdvanceReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs">
          <span className="text-xs text-amber-700 font-medium">Pending Delivery / Dispatch</span>
          <div className="mt-1 text-xl font-bold text-amber-600 tabular-nums">
            {pendingOrdersCount} Order(s)
          </div>
        </div>
      </div>

      {/* 4. Table or Illustration */}
      <div className="p-6 flex-1 flex flex-col">
        {saleOrders.length > 0 ? (
          <div className="bg-white rounded-lg border border-[#e2e8f0] overflow-hidden shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 text-[11px] font-semibold">
                  <th className="py-3 px-4">Order Date</th>
                  <th className="py-3 px-4">Order No.</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Delivery Due</th>
                  <th className="py-3 px-4 text-right">Order Amount</th>
                  <th className="py-3 px-4 text-right">Advance Paid</th>
                  <th className="py-3 px-4 text-center">Fulfillment</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {saleOrders.map((order) => {
                  const isFulfilled = order.fulfillmentStatus === 'Completed';
                  const isOnline = order.source === 'ONLINE_STORE';
                  const stage = order.orderWorkflowStatus || (isFulfilled ? 'Delivered' : 'Pending Approval');
                  const linkedInv = order.linkedSaleInvoiceId
                    ? transactions.find((inv) => inv.id === order.linkedSaleInvoiceId)
                    : undefined;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{order.date}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                        <div>#{order.invoiceNo}</div>
                        {order.onlineOrderId && (
                          <div className="text-[10px] font-normal text-[#0284c7]">{order.onlineOrderId}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{order.partyName}</div>
                        {order.partyPhone && <div className="text-[10px] text-slate-500">{order.partyPhone}</div>}
                        {order.deliveryBagId && (
                          <div className="text-[10px] text-slate-500">
                            Bag: {order.deliveryBagId}{order.deliveryBoyName ? ` · ${order.deliveryBoyName}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{order.dueDate}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                        ₹{order.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-600 tabular-nums">
                        ₹{(order.receivedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {order.isCancelled || stage === 'Cancelled' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            Cancelled
                          </span>
                        ) : isFulfilled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{linkedInv ? `Inv #${linkedInv.invoiceNo}` : 'Delivered'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3" />
                            <span>{stage}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {!order.isCancelled && !isFulfilled && isOnline && stage === 'Pending Approval' && (
                            <button
                              onClick={() => approveOnlineOrder(order.id)}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] cursor-pointer"
                            >
                              Approve Order
                            </button>
                          )}
                          {!order.isCancelled && !isFulfilled && isOnline && stage === 'Confirmed' && (
                            <button
                              onClick={() => packOnlineOrder(order.id)}
                              className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[11px] cursor-pointer"
                            >
                              Pack &amp; Tag Bag
                            </button>
                          )}
                          {!order.isCancelled && !isFulfilled && isOnline && stage === 'Packing' && (
                            <button
                              onClick={() => assignDeliveryBoyToOrder(order.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#0284c7] hover:bg-[#0369a1] text-white font-semibold text-[11px] cursor-pointer"
                            >
                              <Truck className="w-3 h-3" />
                              <span>Dispatch Rider</span>
                            </button>
                          )}
                          {!order.isCancelled && !isFulfilled && isOnline && stage === 'Out for Delivery' && (
                            <span className="px-2 py-1 rounded bg-blue-50 text-[#0284c7] font-mono font-bold text-[10px] border border-blue-200">
                              Awaiting OTP ({order.deliveryOtp || '----'})
                            </span>
                          )}
                          {!order.isCancelled && !isFulfilled && !isOnline && (
                            <button
                              onClick={() => convertSalesOrderToInvoice(order.id)}
                              title="Convert Sale Order to Finalized Sale Invoice"
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#0284c7] hover:bg-[#0369a1] text-white font-semibold text-[11px] shadow-2xs transition-colors"
                            >
                              <span>Convert to Sale</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          {linkedInv && (
                            <button
                              onClick={() => {
                                setSelectedInvoice(linkedInv);
                                setIsInvoicePreviewOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[10px] cursor-pointer"
                            >
                              Invoice #{linkedInv.invoiceNo}
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedInvoice(order);
                              setIsInvoicePreviewOpen(true);
                            }}
                            title="Preview Order"
                            className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => deleteTransaction(order.id)}
                            title="Delete Order"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
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
          /* Empty Illustration */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-36 h-36 relative flex items-center justify-center mb-6">
              <div className="w-28 h-32 bg-white rounded-lg border-2 border-slate-800 shadow-md relative p-2 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 border-b border-slate-300 pb-1.5">
                  <div className="w-3 h-3 rounded-full bg-slate-800" />
                  <div className="w-12 h-1.5 bg-slate-400 rounded-full" />
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-slate-800 bg-[#38bdf8] flex items-center justify-center mx-auto my-1">
                  <div className="w-5 h-5 rounded-full bg-slate-800" />
                </div>
                <div className="space-y-1">
                  <div className="w-full h-1 bg-slate-300 rounded" />
                  <div className="w-3/4 h-1 bg-slate-300 rounded" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-[#fbbf24] border-2 border-slate-800 flex items-center justify-center font-bold text-slate-900 shadow">
                  %
                </div>
              </div>
            </div>

            <p className="text-slate-600 text-xs max-w-sm mb-5 leading-relaxed">
              Make &amp; share sale orders &amp; convert them to sale invoice instantly.
            </p>

            <button
              onClick={() => {
                setIsAddSaleOpen(true);
                showToast('Create Sale Order');
              }}
              className="px-6 py-2 rounded-md bg-[#f59e0b] hover:bg-[#d97706] active:bg-[#b45309] text-white font-semibold text-xs shadow-xs transition-transform active:scale-95"
            >
              Add Your First Sale Order
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
