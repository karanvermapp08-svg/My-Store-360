import React, { useState, useRef, useEffect } from 'react';
import {
  ShoppingCart,
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  CreditCard,
  QrCode,
  DollarSign,
  Percent,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { apiClient } from '../../utils/apiClient';

export const CashierPosWorkspace: React.FC = () => {
  const { items, addTransaction, company, showToast, canApplyDiscount } = useVyapar();

  const [cart, setCart] = useState<any[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [customerName, setCustomerName] = useState('Counter Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalReason, setApprovalReason] = useState('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Focus barcode scanner on mount
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const matched = items.find(
      (it) =>
        it.code.toLowerCase() === barcodeInput.trim().toLowerCase() ||
        it.name.toLowerCase().includes(barcodeInput.trim().toLowerCase())
    );

    if (matched) {
      addToCart(matched);
      setBarcodeInput('');
    } else {
      showToast(`No item found for barcode / search: "${barcodeInput}"`);
    }
  };

  const addToCart = (product: typeof items[0]) => {
    const existing = cart.find((c) => c.name === product.name);
    if (existing) {
      setCart(
        cart.map((c) =>
          c.name === product.name
            ? {
                ...c,
                qty: c.qty + 1,
                amount: Math.round((c.qty + 1) * c.price * (1 + c.taxPercent / 100)),
              }
            : c
        )
      );
    } else {
      setCart([
        ...cart,
        {
          id: 'pos-' + Date.now(),
          name: product.name,
          hsn: product.code,
          qty: 1,
          unit: product.unit,
          price: product.salePrice,
          discountPercent: 0,
          taxPercent: product.taxRate,
          amount: Math.round(product.salePrice * (1 + product.taxRate / 100)),
        },
      ]);
    }
    showToast(`Added ${product.name} to POS Cart`);
  };

  const updateQty = (idx: number, delta: number) => {
    const updated = [...cart];
    const newQty = updated[idx].qty + delta;
    if (newQty <= 0) {
      setCart(updated.filter((_, i) => i !== idx));
    } else {
      updated[idx].qty = newQty;
      updated[idx].amount = Math.round(
        newQty * updated[idx].price * (1 + updated[idx].taxPercent / 100)
      );
      setCart(updated);
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const taxable = subtotal - discountAmount;
  const taxAmount = Math.round(taxable * 0.18);
  const totalAmount = taxable + taxAmount;
  const changeDue = Math.max(0, (cashTendered || totalAmount) - totalAmount);

  // Discount ceiling enforcement
  const handleDiscountChange = (val: number) => {
    if (val > 5) {
      // Exceeds cashier limit
      setShowApprovalModal(true);
      return;
    }
    setDiscountPercent(val);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast('POS Cart is empty');
      return;
    }

    try {
      // Post to authoritative backend
      const res = await apiClient.createInvoice({
        partyName: customerName,
        paymentType: paymentMode,
        receivedAmount: totalAmount,
        discountPercent,
        items: cart.map((c) => ({
          name: c.name,
          qty: c.qty,
          price: c.price,
          taxPercent: c.taxPercent,
        })),
      });

      // Also sync local storage
      addTransaction({
        type: 'Sale',
        invoiceNo: res.invoice.invoiceNo,
        date: new Date().toLocaleDateString('en-GB'),
        dueDate: new Date().toLocaleDateString('en-GB'),
        partyName: customerName,
        partyPhone: customerPhone,
        firm: company.name || 'Krishna Enterprises',
        user: 'Cashier (Vikram Joshi)',
        totalAmount,
        receivedAmount: totalAmount,
        balance: 0,
        status: 'Paid',
        paymentType: paymentMode === 'Card' ? 'Bank Transfer' : paymentMode,
        items: cart,
        subtotal,
        totalDiscount: discountAmount,
        taxableAmount: taxable,
        cgstAmount: Math.round(taxAmount / 2),
        sgstAmount: Math.round(taxAmount / 2),
        igstAmount: 0,
        roundOff: 0,
      });

      showToast(`Sale Invoice #${res.invoice.invoiceNo} generated successfully!`);
      setCart([]);
      setCashTendered(0);
      setDiscountPercent(0);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 flex bg-[#f0f4f9] overflow-hidden select-none text-xs text-slate-800">
      {/* Left: Product Lookup & Catalog */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden border-r border-slate-200">
        {/* Top Barcode Input with instant submit */}
        <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2 mb-4 shrink-0">
          <div className="relative flex-1">
            <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan Barcode or Search Item Name (Press Enter)..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-rose-500 shadow-2xs"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-2xs transition-colors shrink-0"
          >
            Add Item
          </button>
        </form>

        {/* Product Quick-Touch Grid */}
        <div className="flex-1 overflow-y-auto">
          <h3 className="font-bold text-slate-700 mb-2.5 text-xs">Fast Touch Product Catalog</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((it) => (
              <div
                key={it.id}
                onClick={() => addToCart(it)}
                className="p-3 bg-white rounded-xl border border-slate-200 hover:border-rose-400 hover:shadow-xs cursor-pointer transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="font-bold text-slate-900 text-xs line-clamp-1">{it.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">Code: {it.code}</div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="font-bold text-emerald-700 text-xs">₹ {it.salePrice}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Stock: {it.stock}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Cart, Customer & Checkout */}
      <div className="w-96 bg-white flex flex-col border-l border-slate-200 shadow-lg shrink-0">
        {/* Customer Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 text-xs">Active POS Cart</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {cart.length} Items
            </span>
          </div>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Customer Name..."
            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs"
          />
        </div>

        {/* Cart Item Rows */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <span>Cart is currently empty.</span>
              <p className="text-[10px] mt-1">Scan an item or click a product tile.</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div
                key={item.id}
                className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 truncate">{item.name}</div>
                  <div className="text-[10px] text-slate-500">₹{item.price} each</div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => updateQty(idx, -1)}
                    className="w-6 h-6 rounded bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="w-6 text-center font-bold tabular-nums">{item.qty}</span>
                  <button
                    onClick={() => updateQty(idx, 1)}
                    className="w-6 h-6 rounded bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>

                <div className="text-right font-bold tabular-nums text-slate-900 min-w-14">
                  ₹{item.amount}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pricing Summary & Tender */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3 shrink-0">
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="tabular-nums font-semibold">₹ {subtotal.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1">
                <span>Discount (%):</span>
                <span className="text-[9px] text-rose-600 font-bold">(Max 5% Cashier Limit)</span>
              </span>
              <input
                type="number"
                min="0"
                max="100"
                value={discountPercent}
                onChange={(e) => handleDiscountChange(Number(e.target.value))}
                className="w-14 bg-white border border-slate-300 rounded px-1 text-right text-xs font-bold"
              />
            </div>

            <div className="flex justify-between text-slate-600">
              <span>GST (18%):</span>
              <span className="tabular-nums font-semibold">₹ {taxAmount.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between text-slate-900 font-bold text-sm pt-2 border-t border-slate-200">
              <span>Total Payable:</span>
              <span className="tabular-nums text-rose-700">₹ {totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Payment Type Tabs */}
          <div className="grid grid-cols-3 gap-1 pt-1">
            {(['Cash', 'UPI', 'Card'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setPaymentMode(mode)}
                className={`py-1.5 rounded-lg font-bold text-xs transition-colors ${
                  paymentMode === mode
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {paymentMode === 'Cash' && (
            <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
              <span className="text-slate-600 font-semibold">Cash Tendered:</span>
              <input
                type="number"
                placeholder={`₹ ${totalAmount}`}
                value={cashTendered || ''}
                onChange={(e) => setCashTendered(Number(e.target.value))}
                className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-right font-bold text-xs"
              />
              <span className="text-emerald-700 font-bold">Return: ₹{changeDue}</span>
            </div>
          )}

          {/* Checkout & Print Action */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            <span>Complete Checkout (₹{totalAmount})</span>
          </button>
        </div>
      </div>

      {/* Approval Required Modal when discount exceeds 5% */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4 border border-amber-300 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-700">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">Manager Authorization Required</h3>
                <p className="text-[11px] text-slate-500">
                  Cashier role discount is capped at 5%. Discounts above 5% require Store Manager approval.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Reason for discount request</label>
              <input
                type="text"
                placeholder="e.g. VIP Customer, bulk purchase, damaged outer box..."
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  showToast('Approval ticket sent to Store Manager queue!');
                  setShowApprovalModal(false);
                }}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
