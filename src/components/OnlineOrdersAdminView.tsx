import React, { useMemo, useState } from 'react';
import {
  ShoppingBag,
  Package,
  Truck,
  Tag,
  Settings,
  Users,
  CheckCircle2,
  XCircle,
  Eye,
  MessageCircle,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { Transaction } from '../types';

type AdminOnlineTab = 'orders' | 'products' | 'delivery' | 'coupons' | 'customers';

export const OnlineOrdersAdminView: React.FC = () => {
  const {
    transactions,
    items,
    coupons,
    serviceAreaConfig,
    customerAccounts,
    users,
    returnRequests,
    company,
    approveOnlineOrder,
    rejectOnlineOrder,
    packOnlineOrder,
    assignDeliveryBoyToOrder,
    verifyDeliveryOtpAndCompleteOrder,
    processReturnRefundRequest,
    updateItem,
    saveBillingCoupon,
    toggleBillingCouponStatus,
    updateServiceAreaConfig,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    showToast,
  } = useVyapar();

  const [activeTab, setActiveTab] = useState<AdminOnlineTab>('orders');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [productSearch, setProductSearch] = useState('');

  // Reject / OTP inline inputs
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Out of stock for delivery slot');
  const [otpTargetId, setOtpTargetId] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [selectedRiderMap, setSelectedRiderMap] = useState<Record<string, string>>({});

  // Delivery & Store Settings form
  const [storeEnabled, setStoreEnabled] = useState(serviceAreaConfig.storeEnabled);
  const [minOrderValue, setMinOrderValue] = useState(serviceAreaConfig.minOrderValue ?? 0);
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(
    serviceAreaConfig.freeDeliveryThreshold
  );
  const [standardDeliveryFee, setStandardDeliveryFee] = useState(
    serviceAreaConfig.standardDeliveryFee
  );
  const [outskirtFee, setOutskirtFee] = useState(serviceAreaConfig.additionalOutskirtFee);
  const [allowedPincodesText, setAllowedPincodesText] = useState(
    (serviceAreaConfig.allowedPincodes || []).join(', ')
  );
  const [maxRadiusKm, setMaxRadiusKm] = useState(serviceAreaConfig.maxRadiusKm);
  const [allowWholesale, setAllowWholesale] = useState(serviceAreaConfig.allowWholesalePricing);

  // Create Coupon form
  const [couponCode, setCouponCode] = useState('');
  const [couponTitle, setCouponTitle] = useState('');
  const [couponType, setCouponType] = useState<'percent' | 'flat'>('percent');
  const [couponValue, setCouponValue] = useState<number>(10);
  const [couponMinOrder, setCouponMinOrder] = useState<number>(299);
  const [couponExpiry, setCouponExpiry] = useState('2027-03-31');

  const onlineOrders = useMemo(
    () =>
      transactions.filter(
        (t) => t.type === 'Sale Order' && (t.source === 'ONLINE_STORE' || Boolean(t.onlineOrderId))
      ),
    [transactions]
  );

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'All') return onlineOrders;
    return onlineOrders.filter(
      (o) => (o.orderWorkflowStatus || 'Pending Approval') === statusFilter
    );
  }, [onlineOrders, statusFilter]);

  const deliveryRiders = useMemo(
    () =>
      users.filter(
        (u) =>
          (u.roleName || '').toLowerCase().includes('delivery') ||
          u.roleId === 'role-delivery'
      ),
    [users]
  );

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return items.filter(
      (i) =>
        !q ||
        i.name.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q)
    );
  }, [items, productSearch]);

  const orderKpis = useMemo(() => {
    const pending = onlineOrders.filter(
      (o) => (o.orderWorkflowStatus || 'Pending Approval') === 'Pending Approval'
    ).length;
    const active = onlineOrders.filter((o) =>
      ['Confirmed', 'Packing', 'Out for Delivery'].includes(o.orderWorkflowStatus || '')
    ).length;
    const delivered = onlineOrders.filter((o) => o.orderWorkflowStatus === 'Delivered').length;
    const onlineRevenue = onlineOrders
      .filter((o) => !o.isCancelled)
      .reduce((s, o) => s + (o.totalAmount || 0), 0);
    return { pending, active, delivered, onlineRevenue };
  }, [onlineOrders]);

  const buildWhatsappOrderLink = (order: Transaction) => {
    const digits = (order.partyPhone || '').replace(/\D/g, '');
    const phoneWithCountry = digits.length === 10 ? `91${digits}` : digits;
    const text = `Hello ${order.partyName},\nUpdate from *${company.name}* on your Online Order *${
      order.onlineOrderId || `#${order.invoiceNo}`
    }*:\nStatus: *${order.orderWorkflowStatus || 'Confirmed'}*\nTotal: *₹${order.totalAmount.toLocaleString(
      'en-IN'
    )}*\n${order.deliveryOtp ? `Delivery OTP: *${order.deliveryOtp}*\n` : ''}Thank you for shopping with us!`;
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`;
  };

  const handleSaveDeliverySettings = (e: React.FormEvent) => {
    e.preventDefault();
    const pincodes = allowedPincodesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const res = updateServiceAreaConfig({
      storeEnabled,
      minOrderValue: Math.max(0, minOrderValue),
      freeDeliveryThreshold: Math.max(0, freeDeliveryThreshold),
      standardDeliveryFee: Math.max(0, standardDeliveryFee),
      additionalOutskirtFee: Math.max(0, outskirtFee),
      allowedPincodes: pincodes,
      maxRadiusKm: Math.max(1, maxRadiusKm),
      allowWholesalePricing: allowWholesale,
    });
    if (res.success) {
      showToast('Online Store & Delivery settings updated');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim() || !couponTitle.trim()) return;
    const res = saveBillingCoupon({
      code: couponCode.trim().toUpperCase(),
      title: couponTitle.trim(),
      description: `${couponType === 'percent' ? `${couponValue}% OFF` : `₹${couponValue} OFF`} on orders ₹${couponMinOrder}+`,
      discountType: couponType,
      discountValue: Math.max(1, couponValue),
      minOrderValue: Math.max(0, couponMinOrder),
      expiryDate: couponExpiry,
      usageLimitTotal: 500,
      usageLimitPerCustomer: 3,
      isActive: true,
    });
    if (res.success) {
      setCouponCode('');
      setCouponTitle('');
    } else {
      showToast(res.message, 'error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Online Store &amp; Customer Ordering
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Accept/reject online orders, control online product visibility, delivery charges, zones, coupons &amp; customer history
          </p>
        </div>
        <span
          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
            serviceAreaConfig.storeEnabled
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
          }`}
        >
          Storefront: {serviceAreaConfig.storeEnabled ? 'Live & Accepting Orders' : 'Paused'}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">Pending Approval</div>
          <div className="text-2xl font-extrabold text-amber-600 mt-1 tabular-nums">
            {orderKpis.pending}
          </div>
          <div className="text-[10px] text-slate-400">Stock reserved awaiting approval</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">In Packing / Delivery</div>
          <div className="text-2xl font-extrabold text-blue-600 mt-1 tabular-nums">
            {orderKpis.active}
          </div>
          <div className="text-[10px] text-slate-400">Active fulfillment pipeline</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">Delivered Orders</div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1 tabular-nums">
            {orderKpis.delivered}
          </div>
          <div className="text-[10px] text-slate-400">OTP verified deliveries</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">Online Order Volume</div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
            ₹{Math.round(orderKpis.onlineRevenue).toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400">{onlineOrders.length} total orders</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'orders', label: `Orders Queue (${onlineOrders.length})`, icon: ShoppingBag },
          { id: 'products', label: 'Online Products & Visibility', icon: Package },
          { id: 'delivery', label: 'Delivery, Zones & Min Order', icon: Settings },
          { id: 'coupons', label: `Coupons (${coupons.length})`, icon: Tag },
          { id: 'customers', label: `Customer History (${customerAccounts.length})`, icon: Users },
        ].map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as AdminOnlineTab)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                active
                  ? 'bg-[#8B0D1E] text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ORDERS QUEUE */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {[
              'All',
              'Pending Approval',
              'Confirmed',
              'Packing',
              'Out for Delivery',
              'Delivered',
              'Cancelled',
            ].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  statusFilter === st
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center text-xs text-slate-400">
              No online customer orders in &ldquo;{statusFilter}&rdquo;.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const stage = order.orderWorkflowStatus || 'Pending Approval';
                const chosenRiderId =
                  selectedRiderMap[order.id] || deliveryRiders[0]?.id || '';
                const chosenRider = deliveryRiders.find((r) => r.id === chosenRiderId);

                return (
                  <div
                    key={order.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-2xs text-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {order.onlineOrderId || `#${order.invoiceNo}`}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              stage === 'Delivered'
                                ? 'bg-emerald-100 text-emerald-700'
                                : stage === 'Cancelled'
                                ? 'bg-rose-100 text-rose-700'
                                : stage === 'Out for Delivery'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {stage}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Customer: <strong>{order.partyName}</strong> ({order.partyPhone || 'N/A'}) ·{' '}
                          {order.date}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Address: {order.partyAddress || 'Store Pickup'} · Payment:{' '}
                          <strong>{order.paymentType}</strong> ({order.paymentStatus || order.status})
                          {order.paymentRef ? ` · Ref: ${order.paymentRef}` : ''}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                          ₹{order.totalAmount.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {order.items.length} item(s)
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 text-[11px] text-slate-600 dark:text-slate-300">
                      {order.items.map((i) => `${i.name} × ${i.qty} (₹${i.amount})`).join(' · ')}
                    </div>

                    {rejectingId === order.id && (
                      <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex flex-wrap gap-2">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason for rejecting order..."
                          className="flex-1 min-w-[200px] px-3 py-1.5 rounded border border-rose-200 bg-white dark:bg-slate-900 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            rejectOnlineOrder(order.id, rejectReason);
                            setRejectingId(null);
                          }}
                          className="px-3 py-1.5 rounded bg-rose-600 text-white font-bold cursor-pointer"
                        >
                          Confirm Reject &amp; Release Stock
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingId(null)}
                          className="px-3 py-1.5 rounded border border-slate-200 bg-white dark:bg-slate-800 font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {otpTargetId === order.id && (
                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex flex-wrap items-center gap-2">
                        <span className="font-bold">
                          Expected OTP: <span className="font-mono">{order.deliveryOtp}</span>
                        </span>
                        <input
                          type="text"
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value)}
                          placeholder="Enter 4-digit customer OTP"
                          className="w-44 px-3 py-1.5 rounded border border-blue-200 bg-white dark:bg-slate-900 text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const res = verifyDeliveryOtpAndCompleteOrder(
                              order.id,
                              otpInput,
                              order.paymentType === 'Cash'
                            );
                            if (res.success) {
                              setOtpTargetId(null);
                              setOtpInput('');
                            } else {
                              showToast(res.message, 'error');
                            }
                          }}
                          className="px-3 py-1.5 rounded bg-emerald-600 text-white font-bold cursor-pointer"
                        >
                          Verify OTP &amp; Generate Final GST Invoice
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      {stage === 'Pending Approval' && (
                        <>
                          <button
                            type="button"
                            onClick={() => approveOnlineOrder(order.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Accept Order</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectingId(order.id)}
                            className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}

                      {stage === 'Confirmed' && (
                        <button
                          type="button"
                          onClick={() => packOnlineOrder(order.id)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Package className="w-3.5 h-3.5" />
                          <span>Mark Packed</span>
                        </button>
                      )}

                      {stage === 'Packing' && (
                        <div className="inline-flex items-center gap-1.5">
                          <select
                            value={chosenRiderId}
                            onChange={(e) =>
                              setSelectedRiderMap((prev) => ({
                                ...prev,
                                [order.id]: e.target.value,
                              }))
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                          >
                            {deliveryRiders.length > 0 ? (
                              deliveryRiders.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))
                            ) : (
                              <option value="">Store Rider</option>
                            )}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              assignDeliveryBoyToOrder(
                                order.id,
                                chosenRider?.id,
                                chosenRider?.name || 'Store Rider',
                                chosenRider?.phone || company.phone
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Dispatch &amp; Generate OTP</span>
                          </button>
                        </div>
                      )}

                      {stage === 'Out for Delivery' && (
                        <button
                          type="button"
                          onClick={() => {
                            setOtpTargetId(order.id);
                            setOtpInput(order.deliveryOtp || '');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                        >
                          Verify Delivery OTP
                        </button>
                      )}

                      {order.partyPhone && (
                        <a
                          href={buildWhatsappOrderLink(order)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white font-bold inline-flex items-center gap-1"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp Update</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInvoice(order);
                          setIsInvoicePreviewOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Order</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Return & Refund Requests Section */}
          {returnRequests.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <span>Customer Return / Refund Requests ({returnRequests.length})</span>
              </h3>
              <div className="space-y-2 text-xs">
                {returnRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold">
                        {req.returnNo} · {req.customerName} · ₹{req.refundAmount.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-slate-500">{req.reason}</div>
                    </div>
                    {req.status === 'Requested' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => processReturnRefundRequest(req.id, 'Approved')}
                          className="px-3 py-1 rounded bg-emerald-600 text-white font-bold cursor-pointer"
                        >
                          Approve &amp; Restock
                        </button>
                        <button
                          type="button"
                          onClick={() => processReturnRefundRequest(req.id, 'Rejected')}
                          className="px-3 py-1 rounded bg-rose-600 text-white font-bold cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold">
                        {req.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ONLINE PRODUCTS & VISIBILITY */}
      {activeTab === 'products' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search products to toggle online visibility..."
              className="w-full max-w-md px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
            <span className="text-xs text-slate-500">
              Online Visible: <strong>{items.filter((i) => i.isOnlineAvailable !== false).length}</strong> /{' '}
              {items.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-4 py-2.5 text-right">Live Available</th>
                  <th className="px-4 py-2.5 text-right">Sale Price</th>
                  <th className="px-4 py-2.5 text-right">Wholesale Price</th>
                  <th className="px-4 py-2.5 text-right">Online Discount %</th>
                  <th className="px-4 py-2.5 text-center">Online Store Visibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProducts.map((it) => {
                  const visible = it.isOnlineAvailable !== false;
                  const available = Math.max(0, (it.stock || 0) - (it.reservedStock || 0));
                  return (
                    <tr key={it.id}>
                      <td className="px-4 py-2.5">
                        <div className="font-bold text-slate-900 dark:text-white">{it.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {it.code} · {it.category}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold">
                        {available} {it.unit}
                        {(it.reservedStock || 0) > 0 && (
                          <div className="text-[10px] text-amber-600">{it.reservedStock} reserved</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold">
                        ₹{it.salePrice.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {it.wholesalePrice ? `₹${it.wholesalePrice.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        <input
                          type="number"
                          min={0}
                          max={90}
                          value={it.onlineDiscountPercent ?? 0}
                          onChange={(e) =>
                            updateItem(it.id, {
                              onlineDiscountPercent: Math.max(0, Math.min(90, Number(e.target.value))),
                            })
                          }
                          className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-right text-xs"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            updateItem(it.id, { isOnlineAvailable: !visible });
                            showToast(
                              `${it.name} is now ${!visible ? 'Visible' : 'Hidden'} on Customer Storefront`
                            );
                          }}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                            visible
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {visible ? 'Published Online' : 'Hidden'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DELIVERY CHARGES, ZONES & MIN ORDER VALUE */}
      {activeTab === 'delivery' && (
        <form
          onSubmit={handleSaveDeliverySettings}
          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 max-w-2xl space-y-4 text-xs shadow-2xs"
        >
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
            Online Storefront, Delivery Fees &amp; Service Zones
          </h3>

          <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
            <div>
              <div className="font-bold text-slate-900 dark:text-white">Enable Customer Online Storefront</div>
              <div className="text-[11px] text-slate-500">Allow online browsing and customer checkout</div>
            </div>
            <input
              type="checkbox"
              checked={storeEnabled}
              onChange={(e) => setStoreEnabled(e.target.checked)}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Minimum Order Value (₹)
              </label>
              <input
                type="number"
                min={0}
                value={minOrderValue}
                onChange={(e) => setMinOrderValue(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Free Delivery Above (₹)
              </label>
              <input
                type="number"
                min={0}
                value={freeDeliveryThreshold}
                onChange={(e) => setFreeDeliveryThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Standard Delivery Charge (₹)
              </label>
              <input
                type="number"
                min={0}
                value={standardDeliveryFee}
                onChange={(e) => setStandardDeliveryFee(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Outskirt / Extended Zone Fee (₹)
              </label>
              <input
                type="number"
                min={0}
                value={outskirtFee}
                onChange={(e) => setOutskirtFee(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Serviceable Delivery PIN Codes (comma separated)
              </label>
              <input
                type="text"
                value={allowedPincodesText}
                onChange={(e) => setAllowedPincodesText(e.target.value)}
                placeholder="400001, 400002, 560001"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Max Radius (km)</label>
              <input
                type="number"
                min={1}
                value={maxRadiusKm}
                onChange={(e) => setMaxRadiusKm(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowWholesale}
              onChange={(e) => setAllowWholesale(e.target.checked)}
            />
            <span className="font-semibold">Apply automatic wholesale pricing on bulk online quantities</span>
          </label>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white font-bold cursor-pointer"
          >
            Save Store &amp; Delivery Configuration
          </button>
        </form>
      )}

      {/* TAB 4: COUPONS & DISCOUNTS */}
      {activeTab === 'coupons' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 text-xs">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-[#8B0D1E]" />
              <span>Create Storefront Coupon</span>
            </h3>
            <form onSubmit={handleCreateCoupon} className="space-y-3">
              <input
                type="text"
                required
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Coupon Code (e.g. KIRANA50)"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 uppercase font-mono font-bold"
              />
              <input
                type="text"
                required
                value={couponTitle}
                onChange={(e) => setCouponTitle(e.target.value)}
                placeholder="Offer Title (e.g. Weekend Grocery Offer)"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={couponType}
                  onChange={(e) => setCouponType(e.target.value as 'percent' | 'flat')}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="percent">% Discount</option>
                  <option value="flat">Flat ₹ Off</option>
                </select>
                <input
                  type="number"
                  min={1}
                  value={couponValue}
                  onChange={(e) => setCouponValue(Number(e.target.value))}
                  placeholder="Value"
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  value={couponMinOrder}
                  onChange={(e) => setCouponMinOrder(Number(e.target.value))}
                  placeholder="Min Order ₹"
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <input
                  type="date"
                  value={couponExpiry}
                  onChange={(e) => setCouponExpiry(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#8B0D1E] text-white font-bold cursor-pointer"
              >
                Publish Coupon
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-extrabold text-sm">
              Active &amp; Scheduled Coupons
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {coupons.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      <span className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 mr-2">
                        {c.code}
                      </span>
                      {c.title}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {c.description} · Min Order: ₹{c.minOrderValue} · Expires: {c.expiryDate} · Used:{' '}
                      {c.usedCount}/{c.usageLimitTotal}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleBillingCouponStatus(c.id)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                      c.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {c.isActive ? 'Active' : 'Paused'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CUSTOMER ORDER HISTORY */}
      {activeTab === 'customers' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Phone / Email</th>
                  <th className="px-4 py-2.5 text-right">Online Orders</th>
                  <th className="px-4 py-2.5 text-right">Total Spent</th>
                  <th className="px-4 py-2.5 text-right">MS Credit Wallet</th>
                  <th className="px-4 py-2.5">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customerAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No registered online customers yet.
                    </td>
                  </tr>
                ) : (
                  customerAccounts.map((cust) => {
                    const custOrders = onlineOrders.filter(
                      (o) =>
                        o.customerId === cust.customerId ||
                        o.partyName.toLowerCase() === cust.fullName.toLowerCase()
                    );
                    const totalSpend = custOrders
                      .filter((o) => !o.isCancelled)
                      .reduce((s, o) => s + (o.totalAmount || 0), 0);
                    return (
                      <tr key={cust.id}>
                        <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">
                          {cust.fullName}
                          <div className="text-[10px] font-mono text-slate-400">{cust.customerId}</div>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                          {cust.phone}
                          <div className="text-[11px] text-slate-400">{cust.email}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                          {custOrders.length}
                        </td>
                        <td className="px-4 py-2.5 text-right font-extrabold tabular-nums">
                          ₹{Math.round(totalSpend).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-blue-600 tabular-nums">
                          ₹{cust.msCreditBalance ?? 0}
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-slate-500">{cust.lastLogin}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
