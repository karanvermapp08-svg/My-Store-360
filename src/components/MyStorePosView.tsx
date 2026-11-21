import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Minus,
  Printer,
  Search,
  Barcode,
  Pause,
  Play,
  User,
  Camera,
  ShieldCheck,
  Clock,
  Receipt,
  X,
  Ticket,
  Lock,
  Scale,
  Pencil,
  Package,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { InvoiceItem, Item, Transaction } from '../types';
import { findItemByBarcode } from '../utils/barcodeUtils';
import { analyzeSaleInvoiceProfit, getEffectiveCostingMethod } from '../utils/profitEngine';
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

interface HeldCart {
  id: string;
  time: string;
  customer: string;
  customerId: string;
  discountPercent: number;
  items: InvoiceItem[];
}

export const MyStorePosView: React.FC = () => {
  const {
    items,
    parties,
    transactions,
    batches,
    serialNumbers,
    employees,
    currentUser,
    addTransaction,
    company,
    openBarcodeScanner,
    canOverrideStockLimit,
    recordScannedBarcode,
    validateCouponForCustomer,
    coupons,
    businessSettings,
    verifyAdminApprovalPin,
    logDiscountApproval,
    showToast,
  } = useVyapar();

  const [posPinModal, setPosPinModal] = useState<{ open: boolean; pin: string; reason: string; error: string }>({
    open: false,
    pin: '',
    reason: '',
    error: '',
  });

  const isAuthorizedAdmin = canOverrideStockLimit();
  const [allowStockOverride, setAllowStockOverride] = useState(false);
  const [salesperson, setSalesperson] = useState('');
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [openingFloatInput, setOpeningFloatInput] = useState(() => {
    try {
      const saved = localStorage.getItem('bm360_pos_shift');
      if (saved) {
        const parsed = JSON.parse(saved);
        return String(parsed.openingFloat ?? 1000);
      }
    } catch {
      // ignore
    }
    return '1000';
  });

  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card' | 'Split'>('Cash');
  const [search, setSearch] = useState('');
  const [kiranaModal, setKiranaModal] = useState<{
    product: Item | null;
    editCartIdx: number | null;
    activeMode: 'amount' | 'weight';
    amountInput: string;
    weightInput: string;
    weightUnit: string;
  }>({ product: null, editCartIdx: null, activeMode: 'weight', amountInput: '', weightInput: '250', weightUnit: 'GM' });
  const [editingCartIdx, setEditingCartIdx] = useState<number | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number; title?: string } | null>(null);
  const [cashTendered, setCashTendered] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>(() => {
    try {
      const raw = localStorage.getItem('bm360_pos_held_carts');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showReceiptModal, setShowReceiptModal] = useState<{
    invoiceNo: string;
    date: string;
    customer: string;
    items: InvoiceItem[];
    subtotal: number;
    discount: number;
    tax: number;
    cgst: number;
    sgst: number;
    total: number;
    couponCode?: string;
    couponDiscount?: number;
    paymentMode: string;
    changeDue: number;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('bm360_pos_held_carts', JSON.stringify(heldCarts));
    } catch {
      // ignore
    }
  }, [heldCarts]);

  // Consume bundle handoff from Enterprise Inventory -> Bundles & Combos
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bm360_pos_bundle_handoff');
      if (!raw) return;
      localStorage.removeItem('bm360_pos_bundle_handoff');
      const parsed = JSON.parse(raw) as {
        bundleName?: string;
        bundlePrice?: number;
        components?: Array<{ itemId: string; itemName: string; qty: number; unitPrice: number }>;
      };
      if (parsed?.components && parsed.components.length > 0) {
        const newLines: InvoiceItem[] = parsed.components.map((comp, idx) => {
          const matched = items.find((i) => i.id === comp.itemId || i.name === comp.itemName);
          const price = matched?.salePrice ?? comp.unitPrice ?? 0;
          const taxPct = matched?.taxRate ?? 0;
          const qty = Math.max(1, comp.qty || 1);
          return {
            id: `pos-bnd-${Date.now()}-${idx}`,
            name: matched?.name || comp.itemName,
            hsn: matched?.code || '8471',
            qty,
            unit: matched?.unit || 'PCS',
            price,
            discountPercent: 0,
            taxPercent: taxPct,
            amount: Math.round(qty * price * (1 + taxPct / 100) * 100) / 100,
          };
        });
        setCart((prev) => [...prev, ...newLines]);
        showToast(`Loaded combo "${parsed.bundleName || 'Bundle'}" into POS cart`, 'success');
      }
    } catch {
      // ignore
    }
  }, [items]);

  const customers = useMemo(() => parties.filter((p) => p.type === 'Customer' || !p.type), [parties]);
  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(items.map((i) => i.category || 'General')))];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (item.isActive === false) return false;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.sku || '').toLowerCase().includes(q) ||
        (item.barcode || '').toLowerCase().includes(q) ||
        (item.extraBarcodes || []).some((b) => b.toLowerCase().includes(q));
      const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [items, search, selectedCategory]);

  const selectedCustomerName = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId)?.name || 'Walk-in Cash Customer',
    [customers, selectedCustomerId]
  );

  const isGstActive = businessSettings.gst.isGstRegistered;

  const computeLineTotal = (qty: number, price: number, discPct: number, taxPct: number) => {
    const effTax = isGstActive ? taxPct : 0;
    const base = qty * price;
    const afterDisc = base - (base * discPct) / 100;
    return Math.round(afterDisc * (1 + effTax / 100) * 100) / 100;
  };

  const handleCustomerChange = (nextCustId: string) => {
    setSelectedCustomerId(nextCustId);
    const custName = customers.find((c) => c.id === nextCustId)?.name || 'Walk-in Cash Customer';
    setCart((prev) =>
      prev.map((line) => {
        const inv = items.find((i) => i.id === line.itemId || i.name === line.name);
        if (!inv) return line;
        const rate = resolveEffectiveSellingRate(inv, custName, businessSettings.transaction.sales.defaultSalePriceMode);
        return {
          ...line,
          price: rate,
          amount: computeLineTotal(line.qty, rate, line.discountPercent || 0, line.taxPercent || 0),
        };
      })
    );
  };

  const openKiranaWeightModal = (product: Item, editCartIdx: number | null = null) => {
    const u = normalizeUnitCode(product.unit);
    const isLiquid = u === 'LTR' || u === 'ML';
    const existingLine = editCartIdx !== null ? cart[editCartIdx] : null;
    const effRate = resolveEffectiveSellingRate(product, selectedCustomerName, businessSettings.transaction.sales.defaultSalePriceMode);
    const defaultWt = existingLine
      ? u === 'KG' || u === 'LTR'
        ? roundQtyPrecision(existingLine.qty * 1000, 3)
        : existingLine.qty
      : 250;
    const wtUnit = isLiquid ? 'ML' : 'GM';
    const calc = calculateAmountFromWeight(defaultWt, wtUnit, effRate, product.unit);
    setKiranaModal({
      product,
      editCartIdx,
      activeMode: 'weight',
      amountInput: String(existingLine ? roundMoney(existingLine.amount) : calc.amount),
      weightInput: String(defaultWt),
      weightUnit: wtUnit,
    });
  };

  const handleConfirmKiranaModal = (e: React.FormEvent) => {
    e.preventDefault();
    const product = kiranaModal.product;
    if (!product) return;
    const effRate = resolveEffectiveSellingRate(product, selectedCustomerName, businessSettings.transaction.sales.defaultSalePriceMode);
    const baseUnit = product.unit || 'KG';

    let baseQty = 0;
    let displayWeightLabel = '';
    let gramsOrMl = 0;
    let lineAmount = 0;
    let originalInputValue = 0;

    if (kiranaModal.activeMode === 'amount') {
      const amt = Math.max(0, Number(kiranaModal.amountInput) || 0);
      if (amt <= 0) {
        showToast('Enter a valid amount in ₹', 'warning');
        return;
      }
      const calc = calculateWeightFromAmount(amt, effRate, baseUnit);
      baseQty = calc.baseQty;
      displayWeightLabel = calc.displayLabel;
      gramsOrMl = calc.gramsOrMl;
      lineAmount = roundMoney(amt);
      originalInputValue = amt;
    } else {
      const wt = Math.max(0, Number(kiranaModal.weightInput) || 0);
      if (wt <= 0) {
        showToast('Enter a valid weight or volume', 'warning');
        return;
      }
      const calc = calculateAmountFromWeight(wt, kiranaModal.weightUnit, effRate, baseUnit);
      baseQty = calc.baseQty;
      displayWeightLabel = calc.displayLabel;
      gramsOrMl = calc.gramsOrMl;
      lineAmount = calc.amount;
      originalInputValue = wt;
    }

    const existingQtyExcludingTarget = cart.reduce((sum, c, i) => {
      if (kiranaModal.editCartIdx === i) return sum;
      if (c.itemId === product.id || c.name === product.name) {
        return sum + convertUnitQty(c.qty, c.unit, baseUnit);
      }
      return sum;
    }, 0);
    const totalReqBase = roundQtyPrecision(existingQtyExcludingTarget + baseQty, 6);

    if (
      totalReqBase > (product.stock || 0) + 0.0001 &&
      !businessSettings.transaction.behaviour.allowNegativeStock &&
      !(isAuthorizedAdmin && allowStockOverride)
    ) {
      showToast(
        `Stock limit exceeded: Only ${formatBaseQtyHuman(product.stock || 0, baseUnit)} available for "${product.name}".`,
        'error'
      );
      return;
    }

    const taxRate = isGstActive && product.gstApplicable !== false ? (product.taxRate ?? 0) : 0;
    const discPct = resolveEffectiveItemDiscountPercent(product, {
      qty: baseQty,
      salePriceMode: businessSettings.transaction.sales.defaultSalePriceMode,
    });
    const computedFinalAmount =
      kiranaModal.activeMode === 'amount' && taxRate === 0 && discPct === 0
        ? lineAmount
        : computeLineTotal(baseQty, effRate, discPct, taxRate);

    const fefoBatch = batches
      .filter((b) => (b.itemId === product.id || b.itemName.toLowerCase() === product.name.toLowerCase()) && b.qty > 0)
      .sort((a, b) => (a.expiryDate || '9999-12-31').localeCompare(b.expiryDate || '9999-12-31'))[0];

    if (kiranaModal.editCartIdx !== null) {
      const targetIdx = kiranaModal.editCartIdx;
      setCart((prev) =>
        prev.map((c, i) =>
          i === targetIdx
            ? {
                ...c,
                qty: baseQty,
                unit: baseUnit,
                baseUnit,
                baseQty,
                price: effRate,
                inputMode: kiranaModal.activeMode,
                originalInputValue,
                normalizedWeightGrams: gramsOrMl,
                displayWeightLabel,
                amount: computedFinalAmount,
              }
            : c
        )
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          id: `pos-${product.id}-${Date.now()}`,
          itemId: product.id,
          brand: product.brand,
          name: product.name,
          hsn: product.code || '8471',
          qty: baseQty,
          unit: baseUnit,
          baseUnit,
          baseQty,
          price: effRate,
          discountPercent: 0,
          taxPercent: taxRate,
          amount: computedFinalAmount,
          inputMode: kiranaModal.activeMode,
          originalInputValue,
          normalizedWeightGrams: gramsOrMl,
          displayWeightLabel,
          batchNo: fefoBatch?.batchNumber,
          expiryDate: fefoBatch?.expiryDate,
        },
      ]);
    }
    setKiranaModal((p) => ({ ...p, product: null, editCartIdx: null }));
    showToast(`Added ${product.name} (${displayWeightLabel}) — ₹${computedFinalAmount}`, 'success');
  };

  const addToCart = (product: Item, skipWeightPrompt = false) => {
    if (product.isActive === false) {
      showToast(`"${product.name}" is inactive and cannot be billed.`, 'error');
      return;
    }
    if (!skipWeightPrompt && isLooseKiranaProduct(product)) {
      openKiranaWeightModal(product, null);
      return;
    }

    const availStock = product.stock || 0;
    const existing = cart.find((c) => c.itemId === product.id || c.name === product.name);
    const curBaseQty = existing ? convertUnitQty(existing.qty, existing.unit, product.unit) : 0;
    const desiredQty = curBaseQty + 1;

    if (
      desiredQty > availStock + 0.0001 &&
      !businessSettings.transaction.behaviour.allowNegativeStock &&
      !(isAuthorizedAdmin && allowStockOverride)
    ) {
      showToast(
        availStock <= 0
          ? `Out of stock: "${product.name}" has 0 available. Authorized Admin override required.`
          : `Stock limit reached: Only ${formatBaseQtyHuman(availStock, product.unit || 'PCS')} available for "${product.name}".`,
        'error'
      );
      return;
    }

    const effPrice = resolveEffectiveSellingRate(product, selectedCustomerName, businessSettings.transaction.sales.defaultSalePriceMode);
    const taxRate = isGstActive && product.gstApplicable !== false ? (product.taxRate ?? 0) : 0;
    const discPct = resolveEffectiveItemDiscountPercent(product, {
      qty: desiredQty,
      salePriceMode: businessSettings.transaction.sales.defaultSalePriceMode,
    });
    const fefoBatch = batches
      .filter((b) => (b.itemId === product.id || b.itemName.toLowerCase() === product.name.toLowerCase()) && b.qty > 0)
      .sort((a, b) => (a.expiryDate || '9999-12-31').localeCompare(b.expiryDate || '9999-12-31'))[0];

    if (existing) {
      setCart((prev) =>
        prev.map((c) =>
          c.id === existing.id
            ? {
                ...c,
                qty: roundQtyPrecision(c.qty + 1, 3),
                baseQty: roundQtyPrecision((c.baseQty ?? c.qty) + 1, 3),
                discountPercent: Math.max(c.discountPercent || 0, discPct),
                displayWeightLabel: isWeightOrVolumeUnit(c.unit) ? formatBaseQtyHuman(c.qty + 1, c.unit) : c.displayWeightLabel,
                amount: computeLineTotal(c.qty + 1, c.price, Math.max(c.discountPercent || 0, discPct), c.taxPercent),
              }
            : c
        )
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          id: `pos-${product.id}-${Date.now()}`,
          itemId: product.id,
          brand: product.brand,
          name: product.name,
          hsn: product.code || '8471',
          qty: 1,
          unit: product.unit || 'PCS',
          baseUnit: product.unit || 'PCS',
          baseQty: 1,
          price: effPrice,
          discountPercent: discPct,
          taxPercent: taxRate,
          amount: computeLineTotal(1, effPrice, discPct, taxRate),
          batchNo: fefoBatch?.batchNumber,
          expiryDate: fefoBatch?.expiryDate,
        },
      ]);
    }
  };

  const updateCartLineBatch = (idx: number, batchNumber: string) => {
    const line = cart[idx];
    if (!line) return;
    const matchedBatch = batches.find((b) => b.batchNumber === batchNumber && b.itemName.toLowerCase() === line.name.toLowerCase());
    setCart((prev) =>
      prev.map((c, i) =>
        i === idx
          ? {
              ...c,
              batchNo: batchNumber || undefined,
              expiryDate: matchedBatch?.expiryDate,
            }
          : c
      )
    );
  };

  const updateCartLineSerial = (idx: number, serialId: string) => {
    const matchedSerial = serialNumbers.find((s) => s.id === serialId);
    setCart((prev) =>
      prev.map((c, i) =>
        i === idx
          ? {
              ...c,
              serialId: serialId || undefined,
              serialNo: matchedSerial?.serialNo,
            }
          : c
      )
    );
  };

  // Global USB / Bluetooth keyboard-wedge barcode listener when POS is active
  useEffect(() => {
    let buffer = '';
    let lastTime = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const now = Date.now();
      if (now - lastTime > 120) {
        buffer = '';
      }
      lastTime = now;

      if (e.key === 'Enter' && buffer.length >= 4) {
        const scanned = findItemByBarcode(items, buffer);
        if (scanned) {
          addToCart(scanned);
          recordScannedBarcode(buffer, scanned);
          showToast(`USB/BT Scan: Added ${scanned.name}`, 'success');
        } else {
          recordScannedBarcode(buffer, null);
          showToast(`Barcode "${buffer}" not found in inventory`, 'warning');
        }
        buffer = '';
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [items, cart, isAuthorizedAdmin, allowStockOverride]);

  const handleBarcodeSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !search.trim()) return;
    e.preventDefault();
    const raw = search.trim();
    const exactMatch = findItemByBarcode(items, raw) || items.find((i) => i.name.toLowerCase() === raw.toLowerCase());
    const target = exactMatch || (filteredItems.length === 1 ? filteredItems[0] : null);
    if (target) {
      addToCart(target);
      recordScannedBarcode(raw, target);
      setSearch('');
      showToast(`Scanned: ${target.name} (+1)`, 'success');
    } else {
      recordScannedBarcode(raw, null);
      showToast(`No product found matching barcode/SKU "${search}"`, 'warning');
    }
  };

  const updateQty = (idx: number, delta: number) => {
    const updated = [...cart];
    const current = updated[idx];
    const invMatch = items.find(
      (i) => i.id === current.itemId || i.name.toLowerCase() === current.name.toLowerCase() || (current.hsn && i.code === current.hsn)
    );
    const step = isLooseKiranaProduct(invMatch) || isWeightOrVolumeUnit(current.unit) ? 0.25 : 1;
    const newQty = roundQtyPrecision(current.qty + delta * step, 3);
    if (newQty <= 0) {
      setCart(updated.filter((_, i) => i !== idx));
      return;
    }

    const availStock = invMatch?.stock ?? Infinity;
    const reqBase = invMatch ? convertUnitQty(newQty, current.unit, invMatch.unit) : newQty;
    if (
      delta > 0 &&
      reqBase > availStock + 0.0001 &&
      !businessSettings.transaction.behaviour.allowNegativeStock &&
      !(isAuthorizedAdmin && allowStockOverride)
    ) {
      showToast(
        `Cannot exceed available stock (${formatBaseQtyHuman(availStock, invMatch?.unit || current.unit)}) for "${current.name}".`,
        'error'
      );
      return;
    }

    updated[idx] = {
      ...current,
      qty: newQty,
      baseQty: reqBase,
      displayWeightLabel: isWeightOrVolumeUnit(current.unit) ? formatBaseQtyHuman(newQty, current.unit) : current.displayWeightLabel,
      amount: computeLineTotal(newQty, current.price, current.discountPercent || 0, current.taxPercent),
    };
    setCart(updated);
  };

  const updateCartLineEdit = (
    idx: number,
    patch: { unitCostAtSale?: number; discountMode?: 'percent' | 'fixed'; discountValue?: number }
  ) => {
    setCart((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const next = { ...c };
        if (patch.unitCostAtSale !== undefined) {
          next.unitCostAtSale = Math.max(0, patch.unitCostAtSale);
          next.unitCostEdited = true;
        }
        if (patch.discountMode !== undefined || patch.discountValue !== undefined) {
          const mode = patch.discountMode ?? c.discountMode ?? 'percent';
          const gross = (c.qty || 0) * (c.price || 0);
          const rawVal = Math.max(0, patch.discountValue ?? 0);
          let discPct =
            mode === 'fixed'
              ? gross > 0
                ? Math.min(100, roundMoney((rawVal / gross) * 100))
                : 0
              : Math.min(100, rawVal);
          const invMatch = items.find((it) => it.id === c.itemId || it.name === c.name);
          if (invMatch?.maxDiscountLimitPercent !== undefined && discPct > invMatch.maxDiscountLimitPercent) {
            discPct = invMatch.maxDiscountLimitPercent;
            showToast(`Discount capped at ${invMatch.maxDiscountLimitPercent}% for "${invMatch.name}".`, 'warning');
          }
          next.discountMode = mode;
          next.discountPercent = discPct;
          next.amount = computeLineTotal(c.qty, c.price, discPct, c.taxPercent);
        }
        return next;
      })
    );
  };

  const removeItem = (idx: number) => {
    setCart(cart.filter((_, i) => i !== idx));
    if (editingCartIdx === idx) setEditingCartIdx(null);
  };

  // Dynamic per-item GST & bill discount calculation (no hardcoded tax rates)
  const totals = useMemo(() => {
    const grossSubtotal = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
    const discountAmount = Math.round(((grossSubtotal * discountPercent) / 100) * 100) / 100;
    const discountFactor = 1 - discountPercent / 100;
    const taxAmount = cart.reduce((sum, item) => {
      const lineBase = item.qty * item.price * (1 - (item.discountPercent || 0) / 100) * discountFactor;
      return sum + (lineBase * (item.taxPercent || 0)) / 100;
    }, 0);
    const roundedTax = Math.round(taxAmount * 100) / 100;
    const taxable = Math.round((grossSubtotal - discountAmount) * 100) / 100;
    const preCouponTotal = Math.round(taxable + roundedTax);
    const couponDiscount = appliedCoupon
      ? Math.min(preCouponTotal, Math.max(0, appliedCoupon.discountAmount))
      : 0;
    const grandTotal = Math.max(0, Math.round(preCouponTotal - couponDiscount));
    return {
      subtotal: Math.round(grossSubtotal * 100) / 100,
      discountAmount,
      couponDiscount,
      taxable,
      tax: roundedTax,
      cgst: Math.round((roundedTax / 2) * 100) / 100,
      sgst: Math.round((roundedTax / 2) * 100) / 100,
      grandTotal,
    };
  }, [cart, discountPercent, appliedCoupon]);

  const posProfitCfg = businessSettings.accounting?.profitControl;
  const posCostingMethod = getEffectiveCostingMethod(businessSettings);
  const posProfitAnalysis = useMemo(
    () =>
      analyzeSaleInvoiceProfit({
        lines: cart,
        items,
        batches,
        costingMethod: posCostingMethod,
        isGstActive: businessSettings.gst.isGstRegistered,
        isTaxInclusive: businessSettings.transaction.sales.taxMode === 'Inclusive',
        gstBasisForProfit: posProfitCfg?.gstBasisForProfit || 'Exclude Creditable GST',
        invoiceDiscountMode: 'fixed',
        invoiceDiscountValue: totals.discountAmount + totals.couponDiscount,
        maxDiscountPercent: posProfitCfg?.maxDiscountPercent ?? 15,
        minProfitMarginPercent: posProfitCfg?.minProfitMarginPercent ?? 3,
      }),
    [
      cart,
      items,
      batches,
      posCostingMethod,
      businessSettings.gst.isGstRegistered,
      businessSettings.transaction.sales.taxMode,
      posProfitCfg?.gstBasisForProfit,
      posProfitCfg?.maxDiscountPercent,
      posProfitCfg?.minProfitMarginPercent,
      totals.discountAmount,
      totals.couponDiscount,
    ]
  );

  const handleApplyCoupon = (overrideCode?: string) => {
    const raw = (overrideCode ?? couponCodeInput).trim().toUpperCase();
    if (!raw) {
      showToast('Enter a coupon code to apply.', 'warning');
      return;
    }
    if (cart.length === 0) {
      showToast('Add items to cart before applying a coupon.', 'warning');
      return;
    }
    const cartCats = cart.map((c) => {
      const m = items.find((i) => i.name === c.name);
      return m?.category || 'General';
    });
    const res = validateCouponForCustomer(raw, totals.subtotal, cartCats, selectedCustomerId || undefined);
    if (!res.valid || !res.coupon) {
      showToast(res.message, 'warning');
      return;
    }
    setCouponCodeInput(res.coupon.code);
    setAppliedCoupon({
      code: res.coupon.code,
      discountAmount: res.discountAmount,
      title: res.coupon.title,
    });
    showToast(res.message, 'success');
  };

  const splitCashNum = Math.min(totals.grandTotal, Math.max(0, Number(splitCash) || 0));
  const splitDigitalNum = Math.max(0, totals.grandTotal - splitCashNum);
  const cashTenderedNum = Number(cashTendered) || 0;
  const changeDue = paymentMode === 'Cash' && cashTenderedNum > totals.grandTotal ? cashTenderedNum - totals.grandTotal : 0;

  const handleHoldSale = () => {
    if (cart.length === 0) return;
    const cust = customers.find((c) => c.id === selectedCustomerId)?.name || 'Walk-in Counter';
    const held: HeldCart = {
      id: `HOLD-${Date.now()}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customer: cust,
      customerId: selectedCustomerId,
      discountPercent,
      items: [...cart],
    };
    setHeldCarts((prev) => [...prev, held]);
    setCart([]);
    setDiscountPercent(0);
    showToast(`Order held for ${cust}. You can resume it anytime.`);
  };

  const handleResumeSale = (holdId: string) => {
    const held = heldCarts.find((h) => h.id === holdId);
    if (!held) return;
    setCart(held.items);
    setSelectedCustomerId(held.customerId || '');
    setDiscountPercent(held.discountPercent || 0);
    setHeldCarts((prev) => prev.filter((h) => h.id !== holdId));
    showToast(`Resumed held order for ${held.customer}`);
  };

  const executeCompletePosSale = (approvalMeta?: Transaction['discountApproval']) => {
    const customerObj = customers.find((c) => c.id === selectedCustomerId);
    const invoiceNo = `POS-${Math.floor(1000 + Math.random() * 9000)}`;
    const modeLabel =
      paymentMode === 'Split'
        ? `Split (Cash ₹${splitCashNum} + UPI/Card ₹${splitDigitalNum})`
        : paymentMode;

    const created = addTransaction({
      type: 'Sale',
      invoiceNo,
      date: new Date().toLocaleDateString('en-GB'),
      partyName: customerObj?.name || 'Walk-in Counter Customer',
      partyPhone: customerObj?.phone || '',
      partyAddress: customerObj?.address || 'Counter Sale',
      firm: company.name || 'MY STORE',
      user: currentUser?.name || 'POS Cashier',
      salesperson: salesperson || currentUser?.name || undefined,
      paymentType: paymentMode === 'Card' ? 'Bank Transfer' : paymentMode === 'Split' ? 'Cash' : paymentMode,
      totalAmount: totals.grandTotal,
      receivedAmount: totals.grandTotal,
      balance: 0,
      dueDate: new Date().toLocaleDateString('en-GB'),
      status: 'Paid',
      subtotal: totals.subtotal,
      totalDiscount: totals.discountAmount + totals.couponDiscount,
      invoiceDiscountMode: 'fixed',
      invoiceDiscountValue: totals.discountAmount + totals.couponDiscount,
      couponCode: appliedCoupon?.code,
      couponDiscount: totals.couponDiscount,
      taxableAmount: totals.taxable,
      cgstAmount: totals.cgst,
      sgstAmount: totals.sgst,
      items: cart,
      discountApproval: approvalMeta,
      notes: `POS Counter Sale. Mode: ${modeLabel}. Discount: ${discountPercent}%.${
        appliedCoupon ? ` Coupon: ${appliedCoupon.code} (-₹${totals.couponDiscount}).` : ''
      }`,
      source: 'POS',
    });

    if (!created) return;

    setShowReceiptModal({
      invoiceNo,
      date: new Date().toLocaleString('en-GB'),
      customer: customerObj?.name || 'Walk-in Customer',
      items: [...cart],
      subtotal: totals.subtotal,
      discount: totals.discountAmount,
      couponCode: appliedCoupon?.code,
      couponDiscount: totals.couponDiscount,
      tax: totals.tax,
      cgst: totals.cgst,
      sgst: totals.sgst,
      total: totals.grandTotal,
      paymentMode: modeLabel,
      changeDue,
    });

    setCart([]);
    setDiscountPercent(0);
    setAppliedCoupon(null);
    setCouponCodeInput('');
    setCashTendered('');
    setSplitCash('');
    showToast(`Billed ₹${totals.grandTotal.toLocaleString('en-IN')} successfully!`);
  };

  const handleCompleteSale = () => {
    if (cart.length === 0) {
      showToast('Cart is empty. Add products to bill.', 'warning');
      return;
    }

    const allowLoss = posProfitCfg?.allowLossMakingSales ?? true;
    const requirePin = posProfitCfg?.requireAdminPinForLoss ?? true;
    const customerObj = customers.find((c) => c.id === selectedCustomerId);
    const totalDiscPct = totals.subtotal > 0 ? Math.round(((totals.discountAmount + totals.couponDiscount) / totals.subtotal) * 10000) / 100 : 0;

    if (!allowLoss && (posProfitAnalysis.status === 'LOSS' || posProfitAnalysis.lossCausingItems.length > 0)) {
      logDiscountApproval({
        invoiceNo: 'POS-DRAFT',
        partyName: customerObj?.name || 'Walk-in Counter Customer',
        requestedBy: currentUser?.name || 'POS Cashier',
        approvedBy: 'System Policy',
        discountAmount: totals.discountAmount + totals.couponDiscount,
        discountPercent: totalDiscPct,
        lossAmount: posProfitAnalysis.lossAmount,
        reason: 'Blocked automatically in POS: Loss-making sales disabled in Settings',
        status: 'Blocked',
      });
      showToast(
        `POS Loss Sale Blocked (₹${posProfitAnalysis.lossAmount.toLocaleString('en-IN')} loss). Reduce discount below ${posProfitAnalysis.maxSafeInvoiceDiscountPercent}%.`,
        'error'
      );
      return;
    }

    if (posProfitAnalysis.requiresAdminApproval && requirePin) {
      setPosPinModal({ open: true, pin: '', reason: '', error: '' });
      return;
    }

    executeCompletePosSale();
  };

  const handleConfirmPosPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyAdminApprovalPin(posPinModal.pin)) {
      setPosPinModal((p) => ({ ...p, error: 'Invalid Admin Approval PIN.' }));
      return;
    }
    if (!posPinModal.reason.trim()) {
      setPosPinModal((p) => ({ ...p, error: 'Enter a valid reason for approval.' }));
      return;
    }
    const customerObj = customers.find((c) => c.id === selectedCustomerId);
    const totalDiscPct = totals.subtotal > 0 ? Math.round(((totals.discountAmount + totals.couponDiscount) / totals.subtotal) * 10000) / 100 : 0;
    const approvalMeta: NonNullable<Transaction['discountApproval']> = {
      approvedBy: currentUser?.name || 'Admin',
      approvedRole: currentUser?.roleName || 'Admin',
      reason: posPinModal.reason.trim(),
      approvedAt: new Date().toISOString(),
      lossAmount: posProfitAnalysis.lossAmount,
    };
    logDiscountApproval({
      invoiceNo: 'POS-BILL',
      partyName: customerObj?.name || 'Walk-in Counter Customer',
      requestedBy: currentUser?.name || 'POS Cashier',
      approvedBy: approvalMeta.approvedBy,
      discountAmount: totals.discountAmount + totals.couponDiscount,
      discountPercent: totalDiscPct,
      lossAmount: posProfitAnalysis.lossAmount,
      reason: approvalMeta.reason,
      status: 'Approved',
    });
    setPosPinModal({ open: false, pin: '', reason: '', error: '' });
    executeCompletePosSale(approvalMeta);
  };

  return (
    <div className="flex-1 bg-[#f1f5f9] dark:bg-slate-950 flex flex-col md:flex-row overflow-hidden select-none text-xs text-slate-800 dark:text-slate-100">
      {/* LEFT: Product Catalog & Fast Grid */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-200 dark:border-slate-800">
        {/* Top Search & Category Filter */}
        <div className="bg-white dark:bg-slate-900 p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-3 shrink-0 shadow-2xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleBarcodeSearchKeyDown}
                placeholder="Scan Barcode (USB/BT) / Enter SKU & press Enter, or search item..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                openBarcodeScanner('pos', (matchedItem) => {
                  if (matchedItem) addToCart(matchedItem);
                })
              }
              className="px-3.5 py-2 rounded-xl bg-[#8E0E20] hover:bg-[#740918] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
            >
              <Camera className="w-4 h-4 text-emerald-300" />
              <span>Scan Barcode</span>
            </button>

            <button
              type="button"
              onClick={() => setIsShiftModalOpen(true)}
              className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Clock className="w-3.5 h-3.5 text-sky-600" />
              <span>Shift &amp; Bills</span>
            </button>

            {isAuthorizedAdmin && (
              <label
                title="Admin permission only: allow billing quantities beyond available stock"
                className="px-2.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <input
                  type="checkbox"
                  checked={allowStockOverride}
                  onChange={(e) => setAllowStockOverride(e.target.checked)}
                  className="rounded text-[#8E0E20]"
                />
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Admin Stock Override</span>
              </label>
            )}

            {heldCarts.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {heldCarts.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => handleResumeSale(h.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 text-amber-900 dark:text-amber-300 font-bold text-[11px] flex items-center gap-1 border border-amber-300 dark:border-amber-800 cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>Resume ({h.customer})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 bg-slate-100 dark:bg-slate-950">
          {filteredItems.map((item) => {
            const stock = item.stock || 0;
            const lowStock = stock > 0 && stock <= (item.minStockAlert || 5);
            const outOfStock = stock <= 0;
            const loose = isLooseKiranaProduct(item);
            const effRate = resolveEffectiveSellingRate(item, selectedCustomerName, businessSettings.transaction.sales.defaultSalePriceMode);
            const hasValidImage = Boolean(item.image && !brokenImages[item.id]);

            return (
              <div
                key={item.id}
                onClick={() => addToCart(item)}
                className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 cursor-pointer transition-colors flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start gap-2.5">
                    {hasValidImage ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        onError={() => setBrokenImages((prev) => ({ ...prev, [item.id]: true }))}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300">
                        {loose ? <Scale className="w-4 h-4 text-emerald-600" /> : <Package className="w-4 h-4 text-slate-500" />}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors line-clamp-2">
                        {item.name}
                      </span>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {item.brand ? `${item.brand} · ` : ''}
                        {loose ? 'Loose' : item.productType || 'Packaged'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2 text-[10px] tabular-nums">
                    <span className="text-slate-400 font-mono">{item.code}</span>
                    <span
                      className={`font-semibold ${
                        outOfStock
                          ? 'text-rose-600 dark:text-rose-400'
                          : lowStock
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {outOfStock ? 'Out of stock' : formatBaseQtyHuman(stock, item.unit || 'PCS')}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block">
                      {isGstActive ? `GST ${item.taxRate ?? 0}%` : 'Non-GST'}
                    </span>
                    <span className="font-black text-slate-900 dark:text-white text-sm tabular-nums">
                      {formatRateLabel(effRate, item.unit)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {loose && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openKiranaWeightModal(item, null);
                        }}
                        title="Enter Weight or Amount ₹"
                        className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Scale className="w-3 h-3" />
                        <span>Wt/₹</span>
                      </button>
                    )}
                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-600 group-hover:text-white text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors">
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Live POS Cart & Checkout */}
      <div className="w-full md:w-96 lg:w-[420px] bg-white dark:bg-slate-900 flex flex-col justify-between border-l border-slate-200 dark:border-slate-800 shrink-0 shadow-lg">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              <h2 className="font-black text-slate-900 dark:text-white text-sm">Counter Cart ({cart.length})</h2>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-[11px] text-rose-600 hover:underline font-semibold cursor-pointer"
              >
                Clear Cart
              </button>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 font-medium"
              >
                <option value="">Walk-in Cash Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone || 'No Phone'})
                  </option>
                ))}
              </select>
            </div>
            {employees.length > 0 && (
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">Cashier / Salesperson:</span>
                <select
                  value={salesperson}
                  onChange={(e) => setSalesperson(e.target.value)}
                  className="flex-1 py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] bg-slate-50 dark:bg-slate-800 font-medium"
                >
                  <option value="">{currentUser?.name || 'POS Cashier'} (Default)</option>
                  {employees
                    .filter((e) => e.status === 'Active')
                    .map((emp) => (
                      <option key={emp.id} value={emp.name}>
                        {emp.name} ({emp.commissionRatePercent}% comm)
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <Search className="w-10 h-10 stroke-[1.5] text-slate-300 dark:text-slate-700 mb-2" />
              <p className="font-semibold text-slate-500 dark:text-slate-400">Cart is empty</p>
              <p className="text-[11px] text-slate-400">Click products or scan barcodes to begin sale</p>
            </div>
          ) : (
            cart.map((item, idx) => {
              const invItem = items.find(
                (i) => i.id === item.itemId || i.name.toLowerCase() === item.name.toLowerCase() || (item.hsn && i.code === item.hsn)
              );
              const stockAvail = invItem?.stock ?? 0;
              const reqBase = invItem ? convertUnitQty(item.qty, item.unit, invItem.unit) : item.qty;
              const lineProfit = posProfitAnalysis.lines.find((l) => l.lineId === item.id);
              const itemBatches = batches.filter(
                (b) => (b.itemId === invItem?.id || b.itemName.toLowerCase() === item.name.toLowerCase()) && b.qty > 0
              );
              const availSerials = serialNumbers.filter(
                (s) =>
                  (s.itemId === invItem?.id || s.itemName.toLowerCase() === item.name.toLowerCase()) &&
                  s.status === 'Available'
              );
              const qtyLabel = item.displayWeightLabel || formatBaseQtyHuman(item.qty, item.unit);
              const isLooseLine = isLooseKiranaProduct(invItem) || isWeightOrVolumeUnit(item.unit);

              return (
              <div
                key={item.id}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white truncate">{item.name}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {formatRateLabel(item.price, item.unit)} × <strong className="text-slate-800 dark:text-slate-200">{qtyLabel}</strong>
                      {isGstActive ? ` · GST ${item.taxPercent}%` : ''} ·{' '}
                      <span className={stockAvail < reqBase ? 'text-rose-600 font-bold' : 'text-emerald-600 font-semibold'}>
                        Stock: {formatBaseQtyHuman(stockAvail, invItem?.unit || item.unit)}
                      </span>
                    </div>
                    {lineProfit && (
                      <div className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                        Cost ₹{lineProfit.unitCost} · GP{' '}
                        <span className={lineProfit.grossProfit >= 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                          ₹{lineProfit.grossProfit}
                        </span>
                        {(item.discountPercent || 0) > 0 && ` · Disc ${item.discountPercent}%`}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => updateQty(idx, -1)}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-bold text-[11px] px-1 text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                      {qtyLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(idx, 1)}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="text-right min-w-[72px]">
                    <div className="font-black text-slate-900 dark:text-white tabular-nums">₹ {(item.amount || 0).toLocaleString('en-IN')}</div>
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      {isLooseLine && invItem && (
                        <button
                          type="button"
                          onClick={() => openKiranaWeightModal(invItem, idx)}
                          title="Edit Weight or Amount ₹"
                          className="text-[10px] text-emerald-600 hover:underline font-semibold cursor-pointer"
                        >
                          Wt/₹
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingCartIdx(editingCartIdx === idx ? null : idx)}
                        title="Edit Purchase Cost or Discount"
                        className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-[10px] text-rose-500 hover:text-rose-700 cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>

                {editingCartIdx === idx && (
                  <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-700 text-[10px]">
                    <div>
                      <label className="block text-slate-500 mb-0.5">Purchase Cost (₹/{item.unit})</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitCostEdited && item.unitCostAtSale !== undefined ? item.unitCostAtSale : lineProfit?.unitCost ?? invItem?.purchasePrice ?? 0}
                        onChange={(e) => updateCartLineEdit(idx, { unitCostAtSale: Number(e.target.value) })}
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-semibold tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-0.5">Line Discount ({item.discountMode === 'fixed' ? '₹' : '%'})</label>
                      <div className="flex gap-1">
                        <select
                          value={item.discountMode || 'percent'}
                          onChange={(e) => updateCartLineEdit(idx, { discountMode: e.target.value as 'percent' | 'fixed', discountValue: 0 })}
                          className="px-1 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-semibold"
                        >
                          <option value="percent">%</option>
                          <option value="fixed">₹</option>
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={
                            item.discountMode === 'fixed'
                              ? roundMoney(((item.qty * item.price) * (item.discountPercent || 0)) / 100)
                              : item.discountPercent || 0
                          }
                          onChange={(e) =>
                            updateCartLineEdit(idx, {
                              discountMode: item.discountMode || 'percent',
                              discountValue: Number(e.target.value),
                            })
                          }
                          className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-semibold tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {(itemBatches.length > 0 || availSerials.length > 0) && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/70 dark:border-slate-700/70">
                    {itemBatches.length > 0 && (
                      <select
                        value={item.batchNo || ''}
                        onChange={(e) => updateCartLineBatch(idx, e.target.value)}
                        className="flex-1 min-w-[120px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] font-mono"
                      >
                        <option value="">Auto FEFO Batch</option>
                        {itemBatches.map((b) => (
                          <option key={b.id} value={b.batchNumber}>
                            {b.batchNumber} (Exp {b.expiryDate} • {b.qty})
                          </option>
                        ))}
                      </select>
                    )}
                    {availSerials.length > 0 && (
                      <select
                        value={item.serialId || ''}
                        onChange={(e) => updateCartLineSerial(idx, e.target.value)}
                        className="flex-1 min-w-[120px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] font-mono"
                      >
                        <option value="">Select Serial/IMEI</option>
                        {availSerials.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.serialNo}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
              );
            })
          )}
        </div>

        {/* Calculation & Payment Modes */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 space-y-3">
          {/* Promo Coupon Apply Bar */}
          <div className="space-y-1.5 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Ticket className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={couponCodeInput}
                  onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                  placeholder="Promo coupon code..."
                  className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-mono uppercase"
                />
              </div>
              {appliedCoupon ? (
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponCodeInput('');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-bold text-[11px] cursor-pointer"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleApplyCoupon()}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
                >
                  Apply
                </button>
              )}
            </div>
            {!appliedCoupon && coupons.some((c) => c.isActive) && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {coupons
                  .filter((c) => c.isActive)
                  .slice(0, 3)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleApplyCoupon(c.code)}
                      className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold whitespace-nowrap cursor-pointer"
                    >
                      {c.code}
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-800 dark:text-white">₹ {totals.subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Bill Discount (%):</span>
              <input
                type="number"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Math.min(50, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                min="0"
                max="50"
                className="w-14 px-1.5 py-0.5 text-right font-bold border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
              />
            </div>
            {totals.couponDiscount > 0 && appliedCoupon && (
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                <span>Coupon ({appliedCoupon.code}):</span>
                <span className="tabular-nums">-₹ {totals.couponDiscount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Total GST (Item-wise):</span>
              <span className="font-semibold text-slate-800 dark:text-white">₹ {totals.tax.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-base font-black text-slate-900 dark:text-white">
              <span>Total Payable:</span>
              <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">₹ {totals.grandTotal.toLocaleString('en-IN')}</span>
            </div>
            {cart.length > 0 && (
              <div
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center justify-between gap-2 tabular-nums ${
                  posProfitAnalysis.status === 'LOSS'
                    ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                    : posProfitAnalysis.status === 'BREAK_EVEN' || posProfitAnalysis.belowMinMargin || posProfitAnalysis.exceedsMaxDiscount
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                }`}
              >
                <span className="font-bold">
                  {posProfitAnalysis.status === 'LOSS'
                    ? 'LOSS'
                    : posProfitAnalysis.status === 'BREAK_EVEN'
                    ? 'BREAK EVEN'
                    : 'PROFIT'}{' '}
                  ({posProfitAnalysis.profitMarginPercent}%)
                </span>
                <span className="font-bold">
                  GP ₹{posProfitAnalysis.grossProfit.toLocaleString('en-IN')} • Max Disc {posProfitAnalysis.maxSafeInvoiceDiscountPercent}%
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {(['Cash', 'UPI', 'Card', 'Split'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPaymentMode(mode)}
                className={`py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  paymentMode === mode
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white border-slate-900 dark:border-emerald-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {paymentMode === 'Cash' && cart.length > 0 && (
            <div className="flex items-center justify-between gap-2 text-xs bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="font-semibold">Cash Tendered (₹):</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder={String(totals.grandTotal)}
                  className="w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-right font-bold"
                />
                {changeDue > 0 && (
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    Change: ₹{changeDue.toLocaleString('en-IN')}
                  </span>
                )}
              </div>
            </div>
          )}

          {paymentMode === 'Split' && cart.length > 0 && (
            <div className="grid grid-cols-2 gap-2 text-xs bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-[10px] text-slate-500 block">Cash Part (₹)</span>
                <input
                  type="number"
                  value={splitCash}
                  onChange={(e) => setSplitCash(e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-bold"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">UPI / Card Balance</span>
                <div className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-900 font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  ₹ {splitDigitalNum.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={handleHoldSale}
              disabled={cart.length === 0}
              className="py-2.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-900 dark:text-amber-300 font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Hold</span>
            </button>
            <button
              type="button"
              onClick={handleCompleteSale}
              disabled={cart.length === 0}
              className="col-span-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Checkout &amp; Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Instant Thermal Receipt Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-slate-200 text-slate-800">
            <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3 font-mono">
              <h2 className="text-base font-black uppercase tracking-widest">{company.name || 'MY STORE'}</h2>
              <p className="text-[10px] text-slate-500">{company.address || 'Commercial Market'}</p>
              <p className="text-[10px] text-slate-500">GSTIN: {company.gstin || '29ABCDE1234F1Z5'}</p>
              <div className="text-[11px] font-bold text-slate-900 pt-1">RECEIPT: {showReceiptModal.invoiceNo}</div>
              <div className="text-[10px] text-slate-400">
                {showReceiptModal.date} &bull; {showReceiptModal.customer}
              </div>
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              {showReceiptModal.items.map((i, idx) => (
                <div key={idx} className="flex justify-between gap-2">
                  <span>
                    {i.name} · {i.displayWeightLabel || formatBaseQtyHuman(i.qty, i.unit)} @ ₹{i.price}/{i.unit}
                  </span>
                  <span className="font-bold tabular-nums">₹{i.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 font-mono text-xs">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{showReceiptModal.subtotal}</span>
              </div>
              {showReceiptModal.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span>-₹{showReceiptModal.discount}</span>
                </div>
              )}
              {(showReceiptModal.couponDiscount || 0) > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Coupon ({showReceiptModal.couponCode}):</span>
                  <span>-₹{showReceiptModal.couponDiscount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>CGST + SGST:</span>
                <span>₹{showReceiptModal.tax}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-slate-950 pt-1 border-t border-slate-200">
                <span>TOTAL:</span>
                <span>₹{showReceiptModal.total}</span>
              </div>
              {showReceiptModal.changeDue > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Change Returned:</span>
                  <span>₹{showReceiptModal.changeDue}</span>
                </div>
              )}
              <div className="text-[10px] text-center pt-2 text-slate-400">
                Paid via {showReceiptModal.paymentMode} &bull; Thank you!
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowReceiptModal(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                  setShowReceiptModal(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Thermal Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Counter Shift Register & Today's POS Bills Modal */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-100">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm">Counter Shift Summary &amp; Recent POS Bills</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const todayStr = new Date().toLocaleDateString('en-GB');
              const posBills = transactions.filter(
                (t) =>
                  t.type === 'Sale' &&
                  !t.isCancelled &&
                  (t.source === 'POS' || t.invoiceNo.startsWith('POS-'))
              );
              const todayBills = posBills.filter((t) => (t.date || '').startsWith(todayStr));
              const cashSales = todayBills
                .filter((t) => t.paymentType === 'Cash')
                .reduce((s, t) => s + t.totalAmount, 0);
              const upiSales = todayBills
                .filter((t) => t.paymentType === 'UPI')
                .reduce((s, t) => s + t.totalAmount, 0);
              const cardSales = todayBills
                .filter((t) => t.paymentType === 'Bank Transfer')
                .reduce((s, t) => s + t.totalAmount, 0);
              const openingFloat = Math.max(0, Number(openingFloatInput) || 0);
              const expectedDrawer = openingFloat + cashSales;

              return (
                <div className="p-5 overflow-y-auto space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Opening Cash Float</span>
                      <input
                        type="number"
                        min={0}
                        value={openingFloatInput}
                        onChange={(e) => {
                          setOpeningFloatInput(e.target.value);
                          try {
                            localStorage.setItem(
                              'bm360_pos_shift',
                              JSON.stringify({ openingFloat: Number(e.target.value) || 0, updatedAt: new Date().toISOString() })
                            );
                          } catch {
                            // ignore
                          }
                        }}
                        className="mt-1 w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold tabular-nums"
                      />
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-emerald-50/60 dark:bg-emerald-950/30">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Today Cash Sales</span>
                      <div className="text-sm font-black text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                        ₹{cashSales.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-sky-50/60 dark:bg-sky-950/30">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Today UPI + Card</span>
                      <div className="text-sm font-black text-sky-700 dark:text-sky-400 tabular-nums mt-1">
                        ₹{(upiSales + cardSales).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-amber-50/60 dark:bg-amber-950/30">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Expected Cash Drawer</span>
                      <div className="text-sm font-black text-amber-800 dark:text-amber-300 tabular-nums mt-1">
                        ₹{expectedDrawer.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between font-bold">
                      <span>Recent POS Bills ({posBills.length})</span>
                      <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                        Today: {todayBills.length} bills
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {posBills.length === 0 ? (
                        <div className="py-8 text-center text-slate-400">No POS bills recorded yet.</div>
                      ) : (
                        posBills.slice(0, 20).map((bill) => (
                          <div key={bill.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                            <div>
                              <div className="font-mono font-bold text-slate-900 dark:text-white">
                                {bill.invoiceNo}{' '}
                                <span className="font-sans font-semibold text-slate-600 dark:text-slate-300">
                                  • {bill.partyName}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                {bill.date} • {bill.paymentType} • {bill.items.length} item(s)
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                                ₹{bill.totalAmount.toLocaleString('en-IN')}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsShiftModalOpen(false);
                                  setShowReceiptModal({
                                    invoiceNo: bill.invoiceNo,
                                    date: bill.date,
                                    customer: bill.partyName,
                                    items: bill.items,
                                    subtotal: bill.subtotal || bill.totalAmount,
                                    discount: bill.totalDiscount || 0,
                                    tax: (bill.cgstAmount || 0) + (bill.sgstAmount || 0) + (bill.igstAmount || 0),
                                    cgst: bill.cgstAmount || 0,
                                    sgst: bill.sgstAmount || 0,
                                    total: bill.totalAmount,
                                    paymentMode: bill.paymentType,
                                    changeDue: 0,
                                  });
                                }}
                                className="px-2.5 py-1 rounded bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                <Printer className="w-3 h-3" />
                                <span>Reprint</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* POS Admin PIN Approval Modal */}
      {posPinModal.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <form
            onSubmit={handleConfirmPosPin}
            className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-sm w-full p-5 space-y-3.5 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-100"
          >
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Admin PIN Approval Required</span>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 tabular-nums space-y-1">
              <div className="flex justify-between font-bold">
                <span>Cart Gross Profit:</span>
                <span>
                  ₹{posProfitAnalysis.grossProfit.toLocaleString('en-IN')} ({posProfitAnalysis.profitMarginPercent}%)
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span>Max Safe Discount:</span>
                <span>
                  ₹{posProfitAnalysis.maxSafeInvoiceDiscountAmount.toLocaleString('en-IN')} (
                  {posProfitAnalysis.maxSafeInvoiceDiscountPercent}%)
                </span>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Admin PIN *</label>
              <input
                type="password"
                autoFocus
                required
                value={posPinModal.pin}
                onChange={(e) => setPosPinModal((p) => ({ ...p, pin: e.target.value, error: '' }))}
                placeholder="Enter Admin PIN"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Reason *</label>
              <input
                type="text"
                required
                value={posPinModal.reason}
                onChange={(e) => setPosPinModal((p) => ({ ...p, reason: e.target.value, error: '' }))}
                placeholder="e.g. Promotional / clearance discount"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            {posPinModal.error && <p className="text-[11px] font-semibold text-rose-600">{posPinModal.error}</p>}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPosPinModal({ open: false, pin: '', reason: '', error: '' })}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
              >
                Approve &amp; Bill
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Smart Kirana Weight & Amount Auto-Calculation Modal */}
      {kiranaModal.product && (() => {
        const prod = kiranaModal.product;
        const baseU = normalizeUnitCode(prod.unit);
        const isLiquid = baseU === 'LTR' || baseU === 'ML';
        const effRate = resolveEffectiveSellingRate(prod, selectedCustomerName, businessSettings.transaction.sales.defaultSalePriceMode);
        const wtOpts = isLiquid ? ['ML', 'LTR'] : ['GM', 'KG', 'QTL'];
        const activeWtUnit = wtOpts.includes(kiranaModal.weightUnit) ? kiranaModal.weightUnit : isLiquid ? 'ML' : 'GM';
        const preview =
          kiranaModal.activeMode === 'amount'
            ? calculateWeightFromAmount(Number(kiranaModal.amountInput) || 0, effRate, prod.unit)
            : calculateAmountFromWeight(Number(kiranaModal.weightInput) || 0, activeWtUnit, effRate, prod.unit);

        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4">
            <form
              onSubmit={handleConfirmKiranaModal}
              className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-100"
            >
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Scale className="w-4 h-4 text-emerald-600" />
                    <span>{prod.name}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                    Rate: {formatRateLabel(effRate, prod.unit)} · Stock: {formatBaseQtyHuman(prod.stock || 0, prod.unit)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setKiranaModal((p) => ({ ...p, product: null, editCartIdx: null }))}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl border ${kiranaModal.activeMode === 'amount' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Amount in ₹
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={kiranaModal.amountInput}
                    onFocus={() => setKiranaModal((p) => ({ ...p, activeMode: 'amount' }))}
                    onChange={(e) => {
                      const valStr = e.target.value;
                      const amt = Math.max(0, Number(valStr) || 0);
                      const calc = calculateWeightFromAmount(amt, effRate, prod.unit);
                      setKiranaModal((p) => ({
                        ...p,
                        activeMode: 'amount',
                        amountInput: valStr,
                        weightInput: String(roundQtyPrecision(calc.gramsOrMl, 3)),
                        weightUnit: isLiquid ? 'ML' : 'GM',
                      }));
                    }}
                    placeholder="e.g. 10"
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-black text-base tabular-nums"
                  />
                </div>

                <div className={`p-3 rounded-xl border ${kiranaModal.activeMode === 'weight' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Weight / Volume
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      autoFocus
                      value={kiranaModal.weightInput}
                      onFocus={() => setKiranaModal((p) => ({ ...p, activeMode: 'weight' }))}
                      onChange={(e) => {
                        const valStr = e.target.value;
                        const wt = Math.max(0, Number(valStr) || 0);
                        const calc = calculateAmountFromWeight(wt, activeWtUnit, effRate, prod.unit);
                        setKiranaModal((p) => ({
                          ...p,
                          activeMode: 'weight',
                          weightInput: valStr,
                          weightUnit: activeWtUnit,
                          amountInput: String(calc.amount),
                        }));
                      }}
                      placeholder="e.g. 250"
                      className="w-full px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-black text-base tabular-nums"
                    />
                    <select
                      value={activeWtUnit}
                      onChange={(e) => {
                        const nextU = e.target.value;
                        const wt = Math.max(0, Number(kiranaModal.weightInput) || 0);
                        const calc = calculateAmountFromWeight(wt, nextU, effRate, prod.unit);
                        setKiranaModal((p) => ({
                          ...p,
                          activeMode: 'weight',
                          weightUnit: nextU,
                          amountInput: String(calc.amount),
                        }));
                      }}
                      className="px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-xs"
                    >
                      {wtOpts.map((wu) => (
                        <option key={wu} value={wu}>
                          {wu === 'GM' ? 'g' : wu === 'KG' ? 'kg' : wu === 'ML' ? 'ml' : wu === 'LTR' ? 'L' : wu}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {[5, 10, 20, 50, 100].map((amtChip) => (
                    <button
                      key={amtChip}
                      type="button"
                      onClick={() => {
                        const calc = calculateWeightFromAmount(amtChip, effRate, prod.unit);
                        setKiranaModal((p) => ({
                          ...p,
                          activeMode: 'amount',
                          amountInput: String(amtChip),
                          weightInput: String(roundQtyPrecision(calc.gramsOrMl, 3)),
                          weightUnit: isLiquid ? 'ML' : 'GM',
                        }));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold tabular-nums cursor-pointer"
                    >
                      ₹{amtChip}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(isLiquid
                    ? [
                        { label: '100 ml', v: 100, u: 'ML' },
                        { label: '250 ml', v: 250, u: 'ML' },
                        { label: '500 ml', v: 500, u: 'ML' },
                        { label: '1 L', v: 1, u: 'LTR' },
                      ]
                    : [
                        { label: '100 g', v: 100, u: 'GM' },
                        { label: '250 g', v: 250, u: 'GM' },
                        { label: '500 g', v: 500, u: 'GM' },
                        { label: '1 kg', v: 1, u: 'KG' },
                      ]
                  ).map((wtChip) => (
                    <button
                      key={wtChip.label}
                      type="button"
                      onClick={() => {
                        const calc = calculateAmountFromWeight(wtChip.v, wtChip.u, effRate, prod.unit);
                        setKiranaModal((p) => ({
                          ...p,
                          activeMode: 'weight',
                          weightInput: String(wtChip.v),
                          weightUnit: wtChip.u,
                          amountInput: String(calc.amount),
                        }));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold tabular-nums cursor-pointer"
                    >
                      {wtChip.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between tabular-nums">
                <div>
                  <div className="text-[10px] text-slate-500">Calculated Weight / Qty</div>
                  <div className="font-black text-sm text-slate-900 dark:text-white">{preview.displayLabel}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500">Line Total</div>
                  <div className="font-black text-base text-emerald-600 dark:text-emerald-400">
                    ₹{(kiranaModal.activeMode === 'amount' ? Number(kiranaModal.amountInput) || 0 : (preview as any).amount || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setKiranaModal((p) => ({ ...p, product: null, editCartIdx: null }))}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  {kiranaModal.editCartIdx !== null ? 'Update Cart Item' : 'Add to Bill'}
                </button>
              </div>
            </form>
          </div>
        );
      })()}
    </div>
  );
};
