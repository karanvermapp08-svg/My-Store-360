import React, { useMemo, useState } from 'react';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Tag,
  MapPin,
  CreditCard,
  CheckCircle2,
  Download,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { CompanyProfile, CustomerAddress, Transaction } from '../../../types';
import {
  COMBO_PACKS,
  DeliveryHub,
  StoreProduct,
} from '../../../utils/customerStoreCatalog';
import { exportSingleInvoicePdf } from '../../../utils/pdfExport';
import { useVyapar } from '../../../context/VyaparContext';

export interface CartEntry {
  id: string;
  qty: number;
}

interface ResolvedCartLine {
  id: string;
  linkedItemId?: string;
  name: string;
  brand: string;
  subLabel: string;
  category: string;
  image: string;
  price: number;
  retailPrice: number;
  wholesaleApplied: boolean;
  availableStock: number;
  mrp: number;
  gstRate: number;
  hsn: string;
  qty: number;
}

interface CustomerCartViewProps {
  cart: CartEntry[];
  products: StoreProduct[];
  addresses: CustomerAddress[];
  selectedAddressId: string | null;
  activeHub: DeliveryHub;
  appliedPromoCode: string;
  company: CompanyProfile;
  onUpdateQty: (id: string, qty: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onApplyPromoCode: (code: string) => void;
  onOpenLocationModal: () => void;
  onSelectAddressId: (id: string) => void;
  onStartShopping: () => void;
  onViewMyOrders: () => void;
  onPlaceOrder: (orderInput: {
    items: {
      id: string;
      name: string;
      hsn: string;
      qty: number;
      unit: string;
      price: number;
      taxPercent: number;
      linkedItemId?: string;
    }[];
    subtotal: number;
    discount: number;
    deliveryFee: number;
    taxAmount: number;
    totalAmount: number;
    paymentMethod: 'UPI' | 'Cash' | 'Credit' | 'Bank Transfer';
    isPaid: boolean;
    deliveryAddressSummary: string;
    deliveryPincode?: string;
    hubName: string;
    promoCode?: string;
    msCreditToUse?: number;
    paymentRef?: string;
  }) => { success: boolean; transaction?: Transaction; message: string };
}

export const CustomerCartView: React.FC<CustomerCartViewProps> = ({
  cart,
  products,
  addresses,
  selectedAddressId,
  activeHub,
  appliedPromoCode,
  company,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onApplyPromoCode,
  onOpenLocationModal,
  onSelectAddressId,
  onStartShopping,
  onViewMyOrders,
  onPlaceOrder,
}) => {
  const {
    currentCustomer,
    coupons,
    serviceAreaConfig,
    validateCouponForCustomer,
    validateDeliveryPincode,
  } = useVyapar();

  const [promoInput, setPromoInput] = useState(appliedPromoCode);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [paymentOption, setPaymentOption] = useState<'UPI QR' | 'Cash on Delivery' | 'Credit/Debit Card' | 'Net Banking'>('UPI QR');
  const [paymentRefInput, setPaymentRefInput] = useState('');
  const [useMsCredits, setUseMsCredits] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);

  const resolvedLines: ResolvedCartLine[] = useMemo(() => {
    const out: ResolvedCartLine[] = [];
    for (const entry of cart) {
      if (entry.qty <= 0) continue;
      const prod = products.find((p) => p.id === entry.id);
      if (prod) {
        const wholesaleApplied = Boolean(
          serviceAreaConfig.allowWholesalePricing &&
            prod.wholesalePrice &&
            prod.minWholesaleQty &&
            entry.qty >= prod.minWholesaleQty
        );
        out.push({
          id: prod.id,
          linkedItemId: prod.linkedItemId,
          name: prod.name,
          brand: prod.brand,
          subLabel: prod.subLabel,
          category: prod.category,
          image: prod.image,
          price: wholesaleApplied ? prod.wholesalePrice! : prod.price,
          retailPrice: prod.price,
          wholesaleApplied,
          availableStock: prod.availableStock,
          mrp: prod.mrp,
          gstRate: prod.gstRate,
          hsn: prod.hsn,
          qty: entry.qty,
        });
        continue;
      }
      const combo = COMBO_PACKS.find((c) => c.id === entry.id);
      if (combo) {
        out.push({
          id: combo.id,
          name: combo.title,
          brand: 'Combo Bundle',
          subLabel: `${combo.includedChips.length}-Item Pack`,
          category: 'Combo Packs',
          image: combo.image,
          price: combo.price,
          retailPrice: combo.price,
          wholesaleApplied: false,
          availableStock: 99,
          mrp: combo.mrp,
          gstRate: combo.gstRate,
          hsn: combo.hsn,
          qty: entry.qty,
        });
      }
    }
    return out;
  }, [cart, products, serviceAreaConfig.allowWholesalePricing]);

  const subtotal = useMemo(
    () => Math.round(resolvedLines.reduce((sum, l) => sum + l.price * l.qty, 0) * 100) / 100,
    [resolvedLines]
  );

  const mrpTotal = useMemo(
    () => resolvedLines.reduce((sum, l) => sum + l.mrp * l.qty, 0),
    [resolvedLines]
  );

  const cartCategories = useMemo(() => resolvedLines.map((l) => l.category), [resolvedLines]);

  const couponValidation = useMemo(() => {
    if (!appliedPromoCode.trim()) return { valid: false, discountAmount: 0, message: '' };
    return validateCouponForCustomer(appliedPromoCode, subtotal, cartCategories, currentCustomer?.customerId);
  }, [appliedPromoCode, subtotal, cartCategories, currentCustomer?.customerId, validateCouponForCustomer]);

  const activeCoupon = couponValidation.valid ? couponValidation.coupon || null : null;
  const promoDiscount = couponValidation.valid ? couponValidation.discountAmount : 0;

  const chosenAddress =
    addresses.find((a) => a.id === selectedAddressId) || addresses.find((a) => a.isDefault) || addresses[0] || null;

  const activePincode = chosenAddress?.pincode || activeHub.pincode;
  const areaValidation = useMemo(
    () => validateDeliveryPincode(activePincode),
    [activePincode, validateDeliveryPincode]
  );

  const deliveryFee =
    subtotal === 0 || subtotal >= serviceAreaConfig.freeDeliveryThreshold
      ? 0
      : (areaValidation.deliveryFee || 0) + (areaValidation.outskirtFee || 0);

  // Tax included summary derived transparently per SKU GST rate
  const taxIncludedAmount = useMemo(() => {
    const raw = resolvedLines.reduce((sum, line) => {
      const lineTotal = line.price * line.qty;
      const gstFraction = line.gstRate > 0 ? lineTotal - lineTotal / (1 + line.gstRate / 100) : 0;
      return sum + gstFraction;
    }, 0);
    return Math.round(raw * 100) / 100;
  }, [resolvedLines]);

  const availableMsCredits = Math.max(0, currentCustomer?.msCreditBalance ?? 0);
  const payableBeforeCredits = Math.max(0, subtotal - promoDiscount + deliveryFee);
  const msCreditApplied = useMsCredits ? Math.min(availableMsCredits, Math.floor(payableBeforeCredits)) : 0;

  const grandTotal = Math.max(0, Math.round((payableBeforeCredits - msCreditApplied) * 100) / 100);
  const totalMrpSavings = Math.max(0, mrpTotal - subtotal + promoDiscount + msCreditApplied);

  const deliveryAddressSummary = chosenAddress
    ? `${chosenAddress.label}: ${chosenAddress.street}, ${chosenAddress.area || chosenAddress.city}, ${chosenAddress.city} - ${chosenAddress.pincode}`
    : `${activeHub.areaName} (${activeHub.pincode})`;

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = promoInput.trim().toUpperCase();
    if (!cleaned) {
      onApplyPromoCode('');
      setPromoMsg(null);
      return;
    }
    const res = validateCouponForCustomer(cleaned, subtotal, cartCategories, currentCustomer?.customerId);
    if (!res.valid) {
      setPromoMsg(res.message);
      return;
    }
    onApplyPromoCode(res.coupon!.code);
    setPromoMsg(res.message);
  };

  const handleCheckout = () => {
    setCheckoutError(null);
    if (resolvedLines.length === 0) return;
    if (!areaValidation.serviceable) {
      setCheckoutError(areaValidation.message);
      return;
    }

    const paymentMethodMap: Record<typeof paymentOption, 'UPI' | 'Cash' | 'Credit' | 'Bank Transfer'> = {
      'UPI QR': 'UPI',
      'Cash on Delivery': 'Cash',
      'Credit/Debit Card': 'Bank Transfer',
      'Net Banking': 'Bank Transfer',
    };

    const result = onPlaceOrder({
      items: resolvedLines.map((line) => ({
        id: line.id,
        name: line.name,
        hsn: line.hsn,
        qty: line.qty,
        unit: 'PCS',
        price: line.price,
        taxPercent: line.gstRate,
        linkedItemId: line.linkedItemId,
      })),
      subtotal,
      discount: promoDiscount,
      deliveryFee,
      taxAmount: taxIncludedAmount,
      totalAmount: grandTotal,
      paymentMethod: paymentMethodMap[paymentOption],
      isPaid: paymentOption !== 'Cash on Delivery',
      deliveryAddressSummary,
      deliveryPincode: activePincode,
      hubName: activeHub.hubName,
      promoCode: promoDiscount > 0 ? activeCoupon?.code : undefined,
      msCreditToUse: msCreditApplied,
      paymentRef: paymentOption !== 'Cash on Delivery' ? paymentRefInput.trim() : undefined,
    });

    if (result.success && result.transaction) {
      setCompletedTx(result.transaction);
      setPaymentRefInput('');
      setUseMsCredits(false);
      onClearCart();
      onApplyPromoCode('');
    } else {
      setCheckoutError(result.message);
    }
  };

  // Post-Checkout Order Confirmation Screen
  if (completedTx) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Order Placed · Sent for Store Approval</div>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
              {completedTx.onlineOrderId || `#${completedTx.invoiceNo}`}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Delivering to {deliveryAddressSummary} · Hub: {activeHub.hubName} ({activeHub.eta})
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-left space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Sale Order Reference</span>
              <span className="font-mono font-bold text-slate-900">#{completedTx.invoiceNo} ({completedTx.orderWorkflowStatus || 'Pending Approval'})</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Payment Mode</span>
              <span className="font-semibold text-slate-900">
                {completedTx.paymentType} ({completedTx.paymentStatus || completedTx.status})
              </span>
            </div>
            <div className="flex justify-between text-slate-800 font-bold pt-2 border-t border-slate-200 text-sm">
              <span>Total Amount</span>
              <span className="tabular-nums">₹{completedTx.totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => exportSingleInvoicePdf(completedTx, company)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#1D63ED]" />
              <span>Download Order Slip PDF</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCompletedTx(null);
                onViewMyOrders();
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Track Order</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setCompletedTx(null);
                onStartShopping();
              }}
              className="px-5 py-2.5 rounded-xl bg-[#1D63ED] hover:bg-[#1552CC] text-white text-xs font-bold cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty Cart View matching Screenshot 875
  if (resolvedLines.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs py-14 px-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#EEF4FF] text-[#1D63ED] flex items-center justify-center mb-5">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">Your shopping cart is empty</h2>
          <p className="text-xs text-slate-500 mt-2 max-w-md">
            Explore fresh groceries, dairy, daily essentials, and electronics curated for you.
          </p>
          <button
            type="button"
            onClick={onStartShopping}
            className="mt-6 px-6 py-2.5 rounded-xl bg-[#1D63ED] hover:bg-[#1552CC] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            Start Shopping
          </button>
        </div>
      </div>
    );
  }

  // Full Active Checkout Cart View
  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Shopping Cart ({resolvedLines.reduce((acc, i) => acc + i.qty, 0)} items)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Express dispatch from {activeHub.hubName} ({activeHub.eta})
          </p>
        </div>
        <button
          type="button"
          onClick={onStartShopping}
          className="text-xs font-bold text-[#1D63ED] hover:underline whitespace-nowrap cursor-pointer"
        >
          + Add More Items
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Items & Promo */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
            {resolvedLines.map((line) => (
              <div key={line.id} className="p-4 sm:p-5 flex items-center gap-4">
                <img
                  src={line.image}
                  alt={line.name}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-xl object-contain bg-slate-50 border border-slate-100 p-1.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-slate-500">
                    {line.brand} · {line.subLabel}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 truncate">{line.name}</h3>
                  <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                    <span className="text-sm font-extrabold text-slate-900 tabular-nums">
                      ₹{line.price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-slate-400 line-through tabular-nums">
                      ₹{line.mrp.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[11px] text-slate-400">GST {line.gstRate}%</span>
                    {line.wholesaleApplied && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Wholesale Rate
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(line.id, line.qty - 1)}
                      aria-label="Decrease quantity"
                      className="w-7 h-7 rounded-lg hover:bg-white text-slate-700 flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-extrabold text-slate-900 tabular-nums">
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      disabled={line.qty >= line.availableStock}
                      onClick={() => onUpdateQty(line.id, line.qty + 1)}
                      aria-label="Increase quantity"
                      className="w-7 h-7 rounded-lg hover:bg-white disabled:opacity-40 text-slate-700 flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="w-20 text-right font-extrabold text-sm text-slate-900 tabular-nums hidden sm:block">
                    ₹{(line.price * line.qty).toLocaleString('en-IN')}
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveItem(line.id)}
                    aria-label="Remove item"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Coupons */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Tag className="w-4 h-4 text-[#1D63ED]" />
              <span>Apply Store Coupon</span>
            </div>
            <form onSubmit={handleApplyPromo} className="flex gap-2">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                placeholder="Enter coupon code (e.g. WELCOME50, SAVE10, FRESH15)"
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs uppercase font-semibold focus:outline-none focus:border-[#1D63ED]"
              />
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
              >
                Apply
              </button>
            </form>
            {promoMsg && <div className="text-[11px] font-semibold text-[#1D63ED]">{promoMsg}</div>}
            <div className="flex flex-wrap gap-2 pt-1">
              {coupons
                .filter((c) => c.isActive)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setPromoInput(c.code);
                      const check = validateCouponForCustomer(c.code, subtotal, cartCategories, currentCustomer?.customerId);
                      if (check.valid) {
                        onApplyPromoCode(c.code);
                      }
                      setPromoMsg(check.message);
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-left text-[11px] transition-colors cursor-pointer ${
                      appliedPromoCode.toUpperCase() === c.code.toUpperCase()
                        ? 'border-[#1D63ED] bg-blue-50 text-[#1D63ED] font-bold'
                        : 'border-slate-200 hover:border-blue-300 text-slate-600'
                    }`}
                  >
                    <span className="font-mono font-bold">{c.code}</span> · {c.title}
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Right: Delivery + Payment + Summary */}
        <div className="lg:col-span-4 space-y-4">
          {/* Address Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <MapPin className="w-4 h-4 text-[#1D63ED]" />
                <span>Delivery Address</span>
              </div>
              <button
                type="button"
                onClick={onOpenLocationModal}
                className="text-xs font-bold text-[#1D63ED] hover:underline cursor-pointer"
              >
                Change
              </button>
            </div>
            {addresses.length > 0 ? (
              <div className="space-y-2">
                {addresses.map((addr) => {
                  const selected = chosenAddress?.id === addr.id;
                  return (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => onSelectAddressId(addr.id)}
                      className={`w-full p-2.5 rounded-xl border text-left text-[11px] transition-colors cursor-pointer ${
                        selected ? 'border-[#1D63ED] bg-blue-50/40' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-slate-900">
                        {addr.label} · {addr.pincode}
                      </div>
                      <div className="text-slate-600 truncate">
                        {addr.street}, {addr.area || addr.city}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                {deliveryAddressSummary}
              </div>
            )}
            {!areaValidation.serviceable && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] font-semibold text-rose-700">
                {areaValidation.message}
              </div>
            )}
          </div>

          {/* Payment & Totals Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <CreditCard className="w-4 h-4 text-[#1D63ED]" />
              <span>Payment Method</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(['UPI QR', 'Cash on Delivery', 'Credit/Debit Card', 'Net Banking'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentOption(mode)}
                  className={`px-3 py-2 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer ${
                    paymentOption === mode
                      ? 'border-[#1D63ED] bg-blue-50 text-[#1D63ED]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {paymentOption !== 'Cash on Delivery' && (
              <input
                type="text"
                value={paymentRefInput}
                onChange={(e) => setPaymentRefInput(e.target.value)}
                placeholder="UPI / Card Transaction Ref (Optional)"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[11px] text-slate-800 focus:outline-none focus:border-[#1D63ED]"
              />
            )}

            {/* MS Credit Wallet Toggle (1 MS Credit = ₹1, separate from Coupons) */}
            {availableMsCredits > 0 && (
              <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-blue-200 bg-blue-50/40 text-xs cursor-pointer">
                <div>
                  <div className="font-bold text-slate-900">Use MS Credit Wallet</div>
                  <div className="text-[11px] text-slate-600">
                    Available: <strong>{availableMsCredits}</strong> credits (₹{availableMsCredits})
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={useMsCredits}
                  onChange={(e) => setUseMsCredits(e.target.checked)}
                />
              </label>
            )}

            <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Item Subtotal</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  ₹{subtotal.toLocaleString('en-IN')}
                </span>
              </div>
              {promoDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Coupon ({activeCoupon?.code})</span>
                  <span className="tabular-nums">-₹{promoDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}
              {msCreditApplied > 0 && (
                <div className="flex justify-between text-[#1D63ED] font-semibold">
                  <span>MS Credit Redeemed ({msCreditApplied} pts)</span>
                  <span className="tabular-nums">-₹{msCreditApplied.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Delivery Fee</span>
                <span className={`font-semibold tabular-nums ${deliveryFee === 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                  {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                </span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Included GST Breakup</span>
                <span className="tabular-nums">₹{taxIncludedAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="border-t border-slate-100 pt-2.5 flex justify-between items-baseline">
                <span className="text-sm font-extrabold text-slate-900">Grand Total</span>
                <span className="text-lg font-extrabold text-slate-900 tabular-nums">
                  ₹{grandTotal.toLocaleString('en-IN')}
                </span>
              </div>
              {totalMrpSavings > 0 && (
                <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800 text-center">
                  You save ₹{totalMrpSavings.toLocaleString('en-IN')} on this order!
                </div>
              )}
            </div>

            {serviceAreaConfig.minOrderValue && serviceAreaConfig.minOrderValue > 0 && subtotal < serviceAreaConfig.minOrderValue && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800">
                Minimum order value is ₹{serviceAreaConfig.minOrderValue.toLocaleString('en-IN')}. Add ₹
                {(serviceAreaConfig.minOrderValue - subtotal).toLocaleString('en-IN')} more to checkout.
              </div>
            )}

            {checkoutError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] font-semibold text-rose-700">
                {checkoutError}
              </div>
            )}

            <button
              type="button"
              disabled={
                !areaValidation.serviceable ||
                Boolean(
                  serviceAreaConfig.minOrderValue &&
                    serviceAreaConfig.minOrderValue > 0 &&
                    subtotal < serviceAreaConfig.minOrderValue
                )
              }
              onClick={handleCheckout}
              className="w-full py-3 rounded-xl bg-[#1D63ED] hover:bg-[#1552CC] disabled:bg-slate-300 text-white text-xs font-extrabold shadow-xs transition-colors cursor-pointer"
            >
              Place Order · ₹{grandTotal.toLocaleString('en-IN')}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Stock reserved instantly · GST Invoice on OTP delivery</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
