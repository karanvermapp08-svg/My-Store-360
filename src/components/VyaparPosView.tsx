import React, { useState } from 'react';
import { ShoppingCart, Plus, Minus, Printer, Search, FileDown, Scale, X } from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { InvoiceItem, Item } from '../types';
import {
  calculateAmountFromWeight,
  calculateWeightFromAmount,
  convertUnitQty,
  formatBaseQtyHuman,
  formatRateLabel,
  isLooseKiranaProduct,
  isWeightOrVolumeUnit,
  normalizeUnitCode,
  resolveEffectiveItemDiscountPercent,
  resolveEffectiveSellingRate,
  roundMoney,
  roundQtyPrecision,
} from '../utils/kiranaBilling';

export const VyaparPosView: React.FC = () => {
  const { items, addTransaction, company, businessSettings, exportCurrentViewPdf, showToast } = useVyapar();

  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [customerName, setCustomerName] = useState('Counter Walk-in Customer');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Bank Transfer'>('Cash');
  const [search, setSearch] = useState('');
  const [kiranaModal, setKiranaModal] = useState<{
    product: Item | null;
    activeMode: 'amount' | 'weight';
    amountInput: string;
    weightInput: string;
    weightUnit: string;
  }>({ product: null, activeMode: 'weight', amountInput: '', weightInput: '250', weightUnit: 'GM' });

  const isGstActive = businessSettings.gst.isGstRegistered;

  const openWeightModal = (product: Item) => {
    const u = normalizeUnitCode(product.unit);
    const isLiquid = u === 'LTR' || u === 'ML';
    const wtUnit = isLiquid ? 'ML' : 'GM';
    const effRate = resolveEffectiveSellingRate(product, customerName);
    const calc = calculateAmountFromWeight(250, wtUnit, effRate, product.unit);
    setKiranaModal({
      product,
      activeMode: 'weight',
      amountInput: String(calc.amount),
      weightInput: '250',
      weightUnit: wtUnit,
    });
  };

  const handleConfirmKirana = (e: React.FormEvent) => {
    e.preventDefault();
    const product = kiranaModal.product;
    if (!product) return;
    const effRate = resolveEffectiveSellingRate(product, customerName);
    const baseUnit = product.unit || 'KG';
    const isAmt = kiranaModal.activeMode === 'amount';
    const calc = isAmt
      ? calculateWeightFromAmount(Number(kiranaModal.amountInput) || 0, effRate, baseUnit)
      : calculateAmountFromWeight(Number(kiranaModal.weightInput) || 0, kiranaModal.weightUnit, effRate, baseUnit);
    if (calc.baseQty <= 0) {
      showToast('Enter a valid positive weight or amount', 'warning');
      return;
    }
    if (calc.baseQty > (product.stock || 0) + 0.0001 && !businessSettings.transaction.behaviour.allowNegativeStock) {
      showToast(`Only ${formatBaseQtyHuman(product.stock || 0, baseUnit)} in stock for ${product.name}`, 'error');
      return;
    }
    const taxPct = isGstActive && product.gstApplicable !== false ? product.taxRate : 0;
    const discPct = resolveEffectiveItemDiscountPercent(product, { qty: calc.baseQty });
    const netUnitFactor = 1 - discPct / 100;
    const amt =
      isAmt && taxPct === 0 && discPct === 0
        ? roundMoney(Number(kiranaModal.amountInput) || 0)
        : roundMoney(calc.baseQty * effRate * netUnitFactor * (1 + taxPct / 100));
    setCart((prev) => [
      ...prev,
      {
        id: 'pos-' + Date.now(),
        itemId: product.id,
        brand: product.brand,
        name: product.name,
        hsn: product.code,
        qty: calc.baseQty,
        unit: baseUnit,
        baseUnit,
        baseQty: calc.baseQty,
        price: effRate,
        discountPercent: discPct,
        taxPercent: taxPct,
        amount: amt,
        inputMode: kiranaModal.activeMode,
        originalInputValue: Number(isAmt ? kiranaModal.amountInput : kiranaModal.weightInput) || 0,
        normalizedWeightGrams: calc.gramsOrMl,
        displayWeightLabel: calc.displayLabel,
      },
    ]);
    setKiranaModal((p) => ({ ...p, product: null }));
    showToast(`Added ${product.name} (${calc.displayLabel}) to POS Cart`, 'success');
  };

  const addToCart = (product: typeof items[0]) => {
    if (product.isActive === false) {
      showToast(`"${product.name}" is inactive and cannot be billed.`, 'error');
      return;
    }
    if (isLooseKiranaProduct(product)) {
      openWeightModal(product);
      return;
    }
    const effRate = resolveEffectiveSellingRate(product, customerName);
    const existing = cart.find((c) => c.itemId === product.id || c.name === product.name);
    const nextQty = (existing?.qty || 0) + 1;
    if (nextQty > (product.stock || 0) + 0.0001 && !businessSettings.transaction.behaviour.allowNegativeStock) {
      showToast(`Only ${formatBaseQtyHuman(product.stock || 0, product.unit)} in stock for ${product.name}`, 'error');
      return;
    }
    const taxPct = isGstActive && product.gstApplicable !== false ? product.taxRate : 0;
    const discPct = resolveEffectiveItemDiscountPercent(product, { qty: nextQty });
    if (existing) {
      setCart(
        cart.map((c) =>
          c.id === existing.id
            ? {
                ...c,
                qty: c.qty + 1,
                baseQty: c.qty + 1,
                discountPercent: Math.max(c.discountPercent || 0, discPct),
                amount: roundMoney(
                  (c.qty + 1) * c.price * (1 - Math.max(c.discountPercent || 0, discPct) / 100) * (1 + taxPct / 100)
                ),
              }
            : c
        )
      );
    } else {
      setCart([
        ...cart,
        {
          id: 'pos-' + Date.now(),
          itemId: product.id,
          brand: product.brand,
          name: product.name,
          hsn: product.code,
          qty: 1,
          unit: product.unit,
          baseUnit: product.unit,
          baseQty: 1,
          price: effRate,
          discountPercent: discPct,
          taxPercent: taxPct,
          amount: roundMoney(effRate * (1 - discPct / 100) * (1 + taxPct / 100)),
        },
      ]);
    }
    showToast(`Added ${product.name} to POS Cart`);
  };

  const updateQty = (idx: number, delta: number) => {
    const updated = [...cart];
    const line = updated[idx];
    const inv = items.find((i) => i.id === line.itemId || i.name === line.name);
    const step = isLooseKiranaProduct(inv) || isWeightOrVolumeUnit(line.unit) ? 0.25 : 1;
    const newQty = roundQtyPrecision(line.qty + delta * step, 3);
    if (newQty <= 0) {
      setCart(updated.filter((_, i) => i !== idx));
      return;
    }
    if (
      inv &&
      convertUnitQty(newQty, line.unit, inv.unit) > (inv.stock || 0) + 0.0001 &&
      !businessSettings.transaction.behaviour.allowNegativeStock
    ) {
      showToast(`Stock limit reached (${formatBaseQtyHuman(inv.stock, inv.unit)})`, 'error');
      return;
    }
    updated[idx] = {
      ...line,
      qty: newQty,
      baseQty: inv ? convertUnitQty(newQty, line.unit, inv.unit) : newQty,
      displayWeightLabel: isWeightOrVolumeUnit(line.unit) ? formatBaseQtyHuman(newQty, line.unit) : line.displayWeightLabel,
      amount: roundMoney(newQty * line.price * (1 + (isGstActive ? line.taxPercent : 0) / 100)),
    };
    setCart(updated);
  };

  const totalCartAmount = Math.round(cart.reduce((a, b) => a + b.amount, 0));

  const handleCheckout = () => {
    if (cart.length === 0) {
      showToast('POS Cart is empty');
      return;
    }

    const created = addTransaction({
      type: 'Sale',
      invoiceNo: `POS-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toLocaleDateString('en-GB'),
      dueDate: new Date().toLocaleDateString('en-GB'),
      partyName: customerName,
      firm: company.name,
      user: 'Admin',
      paymentType: paymentMode,
      totalAmount: totalCartAmount,
      receivedAmount: totalCartAmount,
      balance: 0,
      status: 'Paid',
      items: cart,
      notes: 'Quick POS Counter Sale',
    });
    if (!created) return;

    setCart([]);
    showToast('POS Bill generated and marked as Paid!');
  };

  const filteredItems = items.filter((i) => {
    if (i.isActive === false) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      i.name.toLowerCase().includes(q) ||
      i.code.toLowerCase().includes(q) ||
      (i.barcode || '').toLowerCase().includes(q) ||
      (i.extraBarcodes || []).some((b) => b.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 bg-[#f0f4f9] flex overflow-hidden text-xs text-slate-800">
      {/* Left Item Selector Grid */}
      <div className="flex-1 p-5 flex flex-col space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Quick POS Terminal</h1>
            <p className="text-slate-500 text-xs">One-click retail &amp; Kirana loose weight counter billing</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Scan Barcode / Search product..."
                className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              onClick={() => exportCurrentViewPdf()}
              title="Export POS Register & Sales Report as PDF"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors shrink-0 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {filteredItems.map((prod) => (
            <div
              key={prod.id}
              onClick={() => addToCart(prod)}
              className="p-3 bg-white rounded-lg border border-slate-200 hover:border-cyan-500 cursor-pointer transition-colors flex flex-col justify-between min-h-28"
            >
              <div>
                <div className="font-bold text-slate-900 line-clamp-2">{prod.name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {prod.code}{isLooseKiranaProduct(prod) ? ' · Loose Wt/₹' : ''}
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <span className="font-bold text-cyan-700 text-sm tabular-nums">
                  {formatRateLabel(resolveEffectiveSellingRate(prod, customerName), prod.unit)}
                </span>
                <span className="text-[10px] text-slate-500 tabular-nums">
                  {formatBaseQtyHuman(prod.stock, prod.unit)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Checkout Panel */}
      <div className="w-80 bg-white border-l border-slate-200 flex flex-col justify-between shrink-0 p-4 shadow-sm">
        <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-bold text-slate-900 text-sm">Cart ({cart.length} items)</span>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-rose-600 hover:underline text-[11px] cursor-pointer"
              >
                Clear Cart
              </button>
            )}
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Customer Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
            />
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1">
            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Click products to add to cart
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={item.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="max-w-[130px]">
                    <div className="font-semibold text-slate-900 truncate">{item.name}</div>
                    <div className="text-[10px] text-slate-400 tabular-nums">
                      {formatRateLabel(item.price, item.unit)} × {item.displayWeightLabel || formatBaseQtyHuman(item.qty, item.unit)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQty(idx, -1)}
                      className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-1 text-center font-bold tabular-nums text-[10px] whitespace-nowrap">
                      {item.displayWeightLabel || formatBaseQtyHuman(item.qty, item.unit)}
                    </span>
                    <button
                      onClick={() => updateQty(idx, 1)}
                      className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="font-bold text-slate-900 text-right tabular-nums">
                    ₹{item.amount.toLocaleString('en-IN')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bottom Payment and Submit */}
        <div className="pt-3 border-t border-slate-200 space-y-3">
          <div className="flex justify-between items-center text-base font-bold text-slate-900">
            <span>Payable Amount:</span>
            <span className="text-cyan-700 text-lg tabular-nums">
              ₹ {totalCartAmount.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {(['Cash', 'UPI', 'Bank Transfer'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setPaymentMode(mode)}
                className={`py-1 text-center rounded border font-semibold text-[11px] cursor-pointer ${
                  paymentMode === mode ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-50'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Charge &amp; Print Slip (F8)</span>
          </button>
        </div>
      </div>

      {kiranaModal.product && (() => {
        const prod = kiranaModal.product;
        const baseU = normalizeUnitCode(prod.unit);
        const isLiquid = baseU === 'LTR' || baseU === 'ML';
        const wtOpts = isLiquid ? ['ML', 'LTR'] : ['GM', 'KG', 'QTL'];
        const activeWtUnit = wtOpts.includes(kiranaModal.weightUnit) ? kiranaModal.weightUnit : isLiquid ? 'ML' : 'GM';
        const effRate = resolveEffectiveSellingRate(prod, customerName);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
            <form onSubmit={handleConfirmKirana} className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="font-bold text-sm flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-emerald-600" />
                  <span>{prod.name} ({formatRateLabel(effRate, prod.unit)})</span>
                </div>
                <button type="button" onClick={() => setKiranaModal((p) => ({ ...p, product: null }))} className="text-slate-400 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Amount ₹</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={kiranaModal.amountInput}
                    onFocus={() => setKiranaModal((p) => ({ ...p, activeMode: 'amount' }))}
                    onChange={(e) => {
                      const val = e.target.value;
                      const c = calculateWeightFromAmount(Number(val) || 0, effRate, prod.unit);
                      setKiranaModal((p) => ({
                        ...p,
                        activeMode: 'amount',
                        amountInput: val,
                        weightInput: String(roundQtyPrecision(c.gramsOrMl, 3)),
                        weightUnit: isLiquid ? 'ML' : 'GM',
                      }));
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Weight</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      autoFocus
                      value={kiranaModal.weightInput}
                      onFocus={() => setKiranaModal((p) => ({ ...p, activeMode: 'weight' }))}
                      onChange={(e) => {
                        const val = e.target.value;
                        const c = calculateAmountFromWeight(Number(val) || 0, activeWtUnit, effRate, prod.unit);
                        setKiranaModal((p) => ({
                          ...p,
                          activeMode: 'weight',
                          weightInput: val,
                          weightUnit: activeWtUnit,
                          amountInput: String(c.amount),
                        }));
                      }}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded font-bold tabular-nums"
                    />
                    <select
                      value={activeWtUnit}
                      onChange={(e) => {
                        const nu = e.target.value;
                        const c = calculateAmountFromWeight(Number(kiranaModal.weightInput) || 0, nu, effRate, prod.unit);
                        setKiranaModal((p) => ({ ...p, activeMode: 'weight', weightUnit: nu, amountInput: String(c.amount) }));
                      }}
                      className="px-1.5 py-1.5 border border-slate-300 rounded font-semibold"
                    >
                      {wtOpts.map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setKiranaModal((p) => ({ ...p, product: null }))} className="px-3 py-1.5 border border-slate-300 rounded font-semibold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-emerald-600 text-white rounded font-bold cursor-pointer">
                  Add to Cart
                </button>
              </div>
            </form>
          </div>
        );
      })()}
    </div>
  );
};
