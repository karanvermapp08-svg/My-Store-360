import React, { useState, useEffect } from 'react';
import {
  Truck,
  Navigation,
  CheckCircle2,
  Phone,
  MapPin,
  DollarSign,
  PackageCheck,
  AlertCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { apiClient } from '../../utils/apiClient';

export const DeliveryWorkspace: React.FC = () => {
  const { transactions, verifyDeliveryOtpAndCompleteOrder, showToast } = useVyapar();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [codCollectedMap, setCodCollectedMap] = useState<Record<string, boolean>>({});

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getDeliveryOrders();
      setOrders(res.orders || []);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusChange = async (id: string, status: string, codCollected?: boolean) => {
    try {
      await apiClient.updateDeliveryStatus(id, status, codCollected);
      showToast(`Shipment status updated to: ${status}`);
      loadOrders();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const liveOnlineDeliveries = transactions.filter(
    (t) =>
      t.type === 'Sale Order' &&
      t.source === 'ONLINE_STORE' &&
      !t.isCancelled &&
      (t.orderWorkflowStatus === 'Out for Delivery' || t.orderWorkflowStatus === 'Delivered')
  );

  const pendingOnlineCount = liveOnlineDeliveries.filter((o) => o.orderWorkflowStatus !== 'Delivered').length;
  const pendingCount = pendingOnlineCount + orders.filter((o) => o.deliveryStatus !== 'Delivered').length;
  const codPendingTotal =
    liveOnlineDeliveries
      .filter((o) => o.paymentType === 'Cash' && o.orderWorkflowStatus !== 'Delivered')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0) +
    orders
      .filter((o) => o.paymentMethod === 'Cash on Delivery' && !o.codCollected)
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  return (
    <div className="flex-1 flex flex-col bg-[#f0f4f9] overflow-y-auto select-none text-xs text-slate-800 p-6 space-y-6">
      {/* 1. Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-50 text-teal-700 rounded-xl border border-teal-200">
            <Truck className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Delivery Agent Dispatch &amp; COD Portal
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
                Kavita Hegde (Delivery)
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">
              Assigned route deliveries, proof of delivery verification, and Cash-on-Delivery (COD) reconciliation
            </p>
          </div>
        </div>

        <button
          onClick={loadOrders}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-semibold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Deliveries</span>
        </button>
      </div>

      {/* 2. Quick Route Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 text-[11px] font-semibold">Active Route Orders</span>
          <div className="text-xl font-bold text-slate-900 tabular-nums">{pendingCount} Deliveries</div>
          <span className="text-[10px] text-teal-700 font-semibold">Bengaluru Metro Zone 1</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 text-[11px] font-semibold">COD Amount to Collect</span>
          <div className="text-xl font-bold text-teal-700 tabular-nums">₹ {codPendingTotal.toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-slate-400">Cash on Delivery collections</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 text-[11px] font-semibold">Completed Shipments</span>
          <div className="text-xl font-bold text-slate-900 tabular-nums">
            {orders.filter((o) => o.deliveryStatus === 'Delivered').length} Delivered
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold">100% On-Time Performance</span>
        </div>
      </div>

      {/* 3. Dispatch Delivery Orders Queue */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Navigation className="w-4 h-4 text-teal-600" />
          <span>Assigned Deliveries Queue</span>
        </h3>

        <div className="space-y-3">
          {liveOnlineDeliveries.map((ord) => {
            const isDelivered = ord.orderWorkflowStatus === 'Delivered' || ord.deliveryOtpVerified;
            const isCod = ord.paymentType === 'Cash';
            const codCollected = codCollectedMap[ord.id] ?? true;

            return (
              <div
                key={ord.id}
                className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 transition-all ${
                  isDelivered
                    ? 'bg-slate-50/70 border-slate-200 opacity-85'
                    : 'bg-teal-50/40 border-teal-300 shadow-2xs'
                }`}
              >
                <div className="space-y-1.5 max-w-lg">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-xs">
                      {ord.onlineOrderId || `#${ord.invoiceNo}`}
                    </span>
                    <span className="font-semibold text-slate-800 text-xs">• {ord.partyName}</span>
                    {ord.deliveryBagId && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                        {ord.deliveryBagId}
                      </span>
                    )}
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                        isDelivered ? 'bg-emerald-100 text-emerald-800' : 'bg-teal-100 text-teal-800'
                      }`}
                    >
                      {ord.orderWorkflowStatus}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{ord.partyAddress || 'Store Delivery Zone'}</span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{ord.partyPhone || 'N/A'}</span>
                    </span>
                    <span>• {ord.items.length} Item(s)</span>
                    <strong className="text-slate-800">
                      ₹ {ord.totalAmount.toLocaleString('en-IN')} ({isCod ? 'Cash on Delivery' : ord.paymentType})
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {!isDelivered ? (
                    <>
                      {isCod && (
                        <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-teal-300 bg-white text-[11px] font-bold text-teal-900 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={codCollected}
                            onChange={(e) =>
                              setCodCollectedMap((prev) => ({ ...prev, [ord.id]: e.target.checked }))
                            }
                          />
                          <span>COD ₹{ord.totalAmount} Collected</span>
                        </label>
                      )}
                      <input
                        type="text"
                        maxLength={4}
                        value={otpInputs[ord.id] || ''}
                        onChange={(e) =>
                          setOtpInputs((prev) => ({
                            ...prev,
                            [ord.id]: e.target.value.replace(/\D/g, ''),
                          }))
                        }
                        placeholder="4-Digit OTP"
                        className="w-28 px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs text-center font-bold focus:outline-none focus:border-teal-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const res = verifyDeliveryOtpAndCompleteOrder(
                            ord.id,
                            otpInputs[ord.id] || '',
                            isCod ? codCollected : true
                          );
                          if (res.success) {
                            setOtpInputs((prev) => ({ ...prev, [ord.id]: '' }));
                          }
                        }}
                        className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span>Verify OTP &amp; Deliver</span>
                      </button>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        OTP Verified{ord.linkedSaleInvoiceNo ? ` · Inv #${ord.linkedSaleInvoiceNo}` : ''}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {orders.map((ord) => {
            const isDelivered = ord.deliveryStatus === 'Delivered';
            return (
              <div
                key={ord.id}
                className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 transition-all ${
                  isDelivered
                    ? 'bg-slate-50/70 border-slate-200 opacity-80'
                    : 'bg-teal-50/40 border-teal-300 shadow-2xs'
                }`}
              >
                <div className="space-y-1.5 max-w-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">Order #{ord.invoiceNo}</span>
                    <span className="font-semibold text-slate-800 text-xs">• {ord.customerName}</span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                        isDelivered
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-teal-100 text-teal-800'
                      }`}
                    >
                      {ord.deliveryStatus}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{ord.address}</span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{ord.phone}</span>
                    </span>
                    <span>• {ord.itemsCount} Parcels</span>
                    <strong className="text-slate-800">₹ {ord.totalAmount} ({ord.paymentMethod})</strong>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {!isDelivered ? (
                    <>
                      {ord.paymentMethod === 'Cash on Delivery' && !ord.codCollected && (
                        <button
                          onClick={() => handleStatusChange(ord.id, ord.deliveryStatus, true)}
                          className="px-3 py-1.5 rounded-lg border border-teal-400 bg-white hover:bg-teal-50 text-teal-800 font-bold text-xs"
                        >
                          Collect Cash (₹{ord.totalAmount})
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusChange(ord.id, 'Delivered', true)}
                        className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1.5"
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span>Confirm Delivery (POD)</span>
                      </button>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Delivered at {ord.deliveredAt || '10:15 AM'}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
