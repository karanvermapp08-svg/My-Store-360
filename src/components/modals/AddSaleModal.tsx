import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Printer,
  Save,
  Check,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  HelpCircle,
  FileText,
  Barcode,
  ShieldCheck,
  Lock,
  Scale,
  Paperclip,
  Tag,
  Clock,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { InvoiceItem, Item, Transaction } from '../../types';
import { findItemByBarcode } from '../../utils/barcodeUtils';
import { analyzeSaleInvoiceProfit, getEffectiveCostingMethod } from '../../utils/profitEngine';
import {
  calculateAmountFromWeight,
  calculateWeightFromAmount,
  convertUnitQty,
  formatBaseQtyHuman,
  isLooseKiranaProduct,
  isWeightOrVolumeUnit,
  normalizeUnitCode,
  resolveEffectiveItemDiscountPercent,
  resolveEffectiveSellingRate,
  roundMoney,
  roundQtyPrecision,
} from '../../utils/kiranaBilling';

const INDIAN_STATES = [
  'Karnataka (29)',
  'Maharashtra (27)',
  'Delhi (07)',
  'Tamil Nadu (33)',
  'Gujarat (24)',
  'Uttar Pradesh (09)',
  'Telangana (36)',
  'West Bengal (19)',
  'Rajasthan (08)',
  'Kerala (32)',
  'Haryana (06)',
  'Andhra Pradesh (37)',
  'Madhya Pradesh (23)',
  'Punjab (03)',
  'Bihar (10)',
  'Odisha (21)',
  'Assam (18)',
  'Goa (30)',
];

export const AddSaleModal: React.FC = () => {
  const {
    isAddSaleOpen,
    setIsAddSaleOpen,
    selectedInvoice,
    setSelectedInvoice,
    addTransaction,
    updateTransaction,
    parties,
    items: inventoryItems,
    settings,
    company,
    currentUser,
    setIsInvoicePreviewOpen,
    showToast,
    checkPartyCreditLimit,
    isInvoiceNumberDuplicate,
    getNextFormattedInvoiceNo,
    getNextDocumentNumber,
    canApplyDiscount,
    canEditFinalizedBill,
    canApproveRefund,
    hasModulePermission,
    openBarcodeScanner,
    canOverrideStockLimit,
    recordScannedBarcode,
    businessSettings,
    employees,
    batches,
    serialNumbers,
    verifyAdminApprovalPin,
    logDiscountApproval,
  } = useVyapar();

  const isAuthorizedAdmin = canOverrideStockLimit();
  const [allowStockOverride, setAllowStockOverride] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [salesperson, setSalesperson] = useState('');

  const isEditing = Boolean(selectedInvoice);

  // Form states
  const [partyName, setPartyName] = useState('Cash Sale');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyAddress, setPartyAddress] = useState('');
  const [partyGstin, setPartyGstin] = useState('');
  const [stateOfSupply, setStateOfSupply] = useState(company.state || 'Karnataka (29)');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [date, setDate] = useState('02/10/2026');
  const [dueDate, setDueDate] = useState('02/10/2026');
  const [paymentType, setPaymentType] = useState<'Cash' | 'Cheque' | 'Bank Transfer' | 'UPI' | 'Credit'>('Cash');
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [notes, setNotes] = useState('Goods once sold will not be taken back or exchanged.');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [originalInvoiceNo, setOriginalInvoiceNo] = useState('');
  const [autoRoundOff, setAutoRoundOff] = useState(true);
  const [branchCode, setBranchCode] = useState('');
  const [warehouseCode, setWarehouseCode] = useState('');
  const [shippingCharges, setShippingCharges] = useState<number>(0);
  const [packagingCharges, setPackagingCharges] = useState<number>(0);
  const [otherCharges, setOtherCharges] = useState<number>(0);
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [creditApplied, setCreditApplied] = useState<number>(0);
  const [tagsInput, setTagsInput] = useState('');
  const [attachments, setAttachments] = useState<NonNullable<Transaction['attachments']>>([]);
  const [pendingRecoveryDraft, setPendingRecoveryDraft] = useState<any | null>(null);

  // Unsaved changes & validation state
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [creditLimitOverride, setCreditLimitOverride] = useState(false);
  const [invoiceDiscountMode, setInvoiceDiscountMode] = useState<'percent' | 'fixed'>(
    businessSettings.accounting?.profitControl?.defaultDiscountType || 'percent'
  );
  const [invoiceDiscountValue, setInvoiceDiscountValue] = useState<number>(0);
  const [pinModal, setPinModal] = useState<{
    open: boolean;
    andPrint: boolean;
    pin: string;
    reason: string;
    error: string;
  }>({ open: false, andPrint: false, pin: '', reason: '', error: '' });
  const [kiranaCalc, setKiranaCalc] = useState<{
    rowIdx: number | null;
    activeMode: 'amount' | 'weight';
    amountInput: string;
    weightInput: string;
    weightUnit: string;
  }>({ rowIdx: null, activeMode: 'weight', amountInput: '', weightInput: '', weightUnit: 'GM' });

  const [lineItems, setLineItems] = useState<InvoiceItem[]>([
    {
      id: 'li-1',
      name: '',
      hsn: '',
      qty: 1,
      unit: 'PCS',
      price: 0,
      discountPercent: 0,
      taxPercent: 18,
      amount: 0,
    },
  ]);

  // Load selected invoice data if editing, or set defaults
  useEffect(() => {
    if (isAddSaleOpen) {
      setIsDirty(false);
      setShowDiscardConfirm(false);
      setCreditLimitOverride(false);

      if (selectedInvoice) {
        setPartyName(selectedInvoice.partyName);
        setPartyPhone(selectedInvoice.partyPhone || '');
        setPartyAddress(selectedInvoice.partyAddress || '');
        setPartyGstin(selectedInvoice.partyGstin || '');
        setStateOfSupply(selectedInvoice.stateOfSupply || company.state || 'Karnataka (29)');
        setInvoiceNo(selectedInvoice.invoiceNo);
        setDate(selectedInvoice.date);
        setDueDate(selectedInvoice.dueDate);
        setPaymentType(selectedInvoice.paymentType);
        setReceivedAmount(selectedInvoice.receivedAmount);
        setNotes(selectedInvoice.notes || '');
        setVehicleNumber(selectedInvoice.vehicleNumber || '');
        setOriginalInvoiceNo(selectedInvoice.originalInvoiceNo || '');
        setSalesperson(selectedInvoice.salesperson || '');
        setInvoiceDiscountMode(selectedInvoice.invoiceDiscountMode || 'percent');
        setInvoiceDiscountValue(selectedInvoice.invoiceDiscountValue || 0);
        setBranchCode(selectedInvoice.branchId || '');
        setWarehouseCode(selectedInvoice.warehouseId || '');
        setShippingCharges(selectedInvoice.shippingCharges || 0);
        setPackagingCharges(selectedInvoice.packagingCharges || 0);
        setOtherCharges(selectedInvoice.otherCharges || 0);
        setAdjustmentAmount(selectedInvoice.adjustmentAmount || 0);
        setCreditApplied(selectedInvoice.creditApplied || 0);
        setTagsInput((selectedInvoice.tags || []).join(', '));
        setAttachments(selectedInvoice.attachments || []);
        setPendingRecoveryDraft(null);
        setLineItems(
          selectedInvoice.items && selectedInvoice.items.length > 0
            ? selectedInvoice.items
            : [
                {
                  id: 'li-1',
                  name: 'General Item',
                  hsn: '8471',
                  qty: 1,
                  unit: 'PCS',
                  price: selectedInvoice.totalAmount,
                  discountPercent: 0,
                  taxPercent: 18,
                  amount: selectedInvoice.totalAmount,
                },
              ]
        );
      } else {
        // New invoice defaults driven by Business Settings
        const salesCfg = businessSettings.transaction.sales;
        const payCfg = businessSettings.transaction.payment;
        setPartyName('Cash Sale');
        setPartyPhone('');
        setPartyAddress('');
        setPartyGstin('');
        setStateOfSupply(company.state || 'Karnataka (29)');
        setInvoiceNo(getNextFormattedInvoiceNo());
        const today = new Date();
        const dueDt = new Date(today);
        dueDt.setDate(dueDt.getDate() + (salesCfg.defaultDueDays || 0));
        const fmtDt = (dt: Date) =>
          `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
        setDate(fmtDt(today));
        setDueDate(fmtDt(dueDt));
        setPaymentType(
          salesCfg.defaultTransactionType === 'Credit'
            ? 'Credit'
            : ((payCfg.defaultPaymentMode as any) || 'Cash')
        );
        setAutoRoundOff(salesCfg.enableRoundOff);
        setNotes(salesCfg.defaultNotes || 'Goods once sold will not be taken back.');
        setVehicleNumber('');
        setOriginalInvoiceNo('');
        setSalesperson('');
        setInvoiceDiscountMode(businessSettings.accounting?.profitControl?.defaultDiscountType || 'percent');
        setInvoiceDiscountValue(0);
        setPinModal({ open: false, andPrint: false, pin: '', reason: '', error: '' });
        setKiranaCalc({ rowIdx: null, activeMode: 'weight', amountInput: '', weightInput: '', weightUnit: 'GM' });
        const isGstOn = businessSettings.gst.isGstRegistered;
        const starterItem = inventoryItems[0];
        const starterPrice = starterItem
          ? resolveEffectiveSellingRate(starterItem, 'Cash Sale', salesCfg.defaultSalePriceMode)
          : 1000;
        const starterTax = isGstOn ? (starterItem?.taxRate ?? businessSettings.item.defaultTaxRate ?? 18) : 0;
        const starterDisc = salesCfg.enableLineDiscount ? (salesCfg.defaultDiscountPercent || 0) : 0;
        const starterTotal = calculateItemAmount(1, starterPrice, starterDisc, starterTax);
        setLineItems([
          {
            id: 'li-' + Date.now(),
            itemId: starterItem?.id,
            brand: starterItem?.brand,
            name: starterItem?.name || 'Standard Product',
            hsn: starterItem?.code || '8471',
            qty: 1,
            unit: starterItem?.unit || 'PCS',
            baseUnit: starterItem?.unit || 'PCS',
            baseQty: 1,
            price: starterPrice,
            discountPercent: starterDisc,
            taxPercent: starterTax,
            amount: starterTotal,
          },
        ]);
        setReceivedAmount(
          salesCfg.defaultTransactionType === 'Credit'
            ? 0
            : salesCfg.enableRoundOff
            ? Math.round(starterTotal)
            : starterTotal
        );
        setBranchCode('');
        setWarehouseCode('');
        setShippingCharges(0);
        setPackagingCharges(0);
        setOtherCharges(0);
        setAdjustmentAmount(0);
        setCreditApplied(0);
        setTagsInput('');
        setAttachments([]);
        try {
          const savedRaw = localStorage.getItem('bm360_sale_draft_v2');
          setPendingRecoveryDraft(savedRaw ? JSON.parse(savedRaw) : null);
        } catch {
          setPendingRecoveryDraft(null);
        }
      }
    }
  }, [isAddSaleOpen, selectedInvoice]);

  // Auto-save active new invoice draft for crash recovery
  useEffect(() => {
    if (!isAddSaleOpen || isEditing || !isDirty) return;
    const handle = window.setTimeout(() => {
      try {
        localStorage.setItem(
          'bm360_sale_draft_v2',
          JSON.stringify({
            savedAt: new Date().toISOString(),
            partyName,
            partyPhone,
            partyAddress,
            partyGstin,
            stateOfSupply,
            date,
            dueDate,
            paymentType,
            receivedAmount,
            notes,
            vehicleNumber,
            shippingCharges,
            packagingCharges,
            otherCharges,
            adjustmentAmount,
            creditApplied,
            tagsInput,
            invoiceDiscountMode,
            invoiceDiscountValue,
            lineItems,
          })
        );
      } catch {
        // ignore storage quota errors
      }
    }, 600);
    return () => window.clearTimeout(handle);
  }, [
    isAddSaleOpen,
    isEditing,
    isDirty,
    partyName,
    partyPhone,
    partyAddress,
    partyGstin,
    stateOfSupply,
    date,
    dueDate,
    paymentType,
    receivedAmount,
    notes,
    vehicleNumber,
    shippingCharges,
    packagingCharges,
    otherCharges,
    adjustmentAmount,
    creditApplied,
    tagsInput,
    invoiceDiscountMode,
    invoiceDiscountValue,
    lineItems,
  ]);

  // When party changes, auto-populate details and refresh non-custom customer-specific rates
  const handlePartySelect = (selectedName: string) => {
    setPartyName(selectedName);
    setIsDirty(true);
    const matched = parties.find((p) => p.name.toLowerCase() === selectedName.toLowerCase());
    if (matched) {
      if (matched.phone) setPartyPhone(matched.phone);
      if (matched.address) setPartyAddress(matched.address);
      if (matched.gstin) setPartyGstin(matched.gstin);
      if (matched.state) setStateOfSupply(matched.state);
    }
    setLineItems((prev) =>
      prev.map((li) => {
        const inv = inventoryItems.find(
          (i) => i.id === li.itemId || i.name.toLowerCase() === li.name.toLowerCase()
        );
        if (!inv) return li;
        const effectiveRate = resolveEffectiveSellingRate(
          inv,
          selectedName,
          businessSettings.transaction.sales.defaultSalePriceMode
        );
        const unitRate =
          normalizeUnitCode(li.unit) !== normalizeUnitCode(inv.unit)
            ? roundMoney(effectiveRate * convertUnitQty(1, li.unit, inv.unit))
            : effectiveRate;
        return {
          ...li,
          price: unitRate,
          amount: calculateItemAmount(li.qty || 0, unitRate, li.discountPercent || 0, li.taxPercent || 0),
        };
      })
    );
  };

  // Determine GST Tax Type: Intra-State (CGST + SGST) vs Inter-State (IGST)
  const isIntraState = useMemo(() => {
    const compState = (company.state || '').trim().toLowerCase();
    const supplyState = (stateOfSupply || '').trim().toLowerCase();
    if (!supplyState || !compState) return true;
    return compState === supplyState || compState.includes(supplyState) || supplyState.includes(compState);
  }, [company.state, stateOfSupply]);

  const gstType: 'Intra-State' | 'Inter-State' = isIntraState ? 'Intra-State' : 'Inter-State';

  const isGstActive = businessSettings.gst.isGstRegistered;
  const isTaxInclusive = businessSettings.transaction.sales.taxMode === 'Inclusive';

  // Calculate line item totals respecting GST active status & Inclusive/Exclusive tax mode
  const calculateItemAmount = (qty: number, price: number, disc: number, tax: number) => {
    const base = qty * price;
    const discounted = base - (base * disc) / 100;
    const effectiveTax = isGstActive ? tax : 0;
    const total = isTaxInclusive ? discounted : discounted + (discounted * effectiveTax) / 100;
    return Math.round(total * 100) / 100;
  };

  const addScannedProductToInvoice = (product: Item) => {
    if (product.isActive === false) {
      showToast(`"${product.name}" is inactive and cannot be added to a new bill.`, 'error');
      return;
    }
    setIsDirty(true);
    const availStock = product.stock || 0;
    const existingIdx = lineItems.findIndex(
      (li) => li.itemId === product.id || li.name.toLowerCase() === product.name.toLowerCase() || (product.code && li.hsn === product.code)
    );
    const curBaseQty =
      existingIdx >= 0
        ? convertUnitQty(lineItems[existingIdx].qty || 0, lineItems[existingIdx].unit, product.unit)
        : 0;
    const desiredQty = curBaseQty + 1;

    if (
      desiredQty > availStock &&
      !businessSettings.transaction.behaviour.allowNegativeStock &&
      !(isAuthorizedAdmin && allowStockOverride)
    ) {
      showToast(
        availStock <= 0
          ? `Out of stock: "${product.name}" has 0 units available. Admin override required.`
          : `Stock limit reached: Only ${formatBaseQtyHuman(availStock, product.unit)} available for "${product.name}".`,
        'error'
      );
      return;
    }

    const salesCfg = businessSettings.transaction.sales;
    const linePrice = resolveEffectiveSellingRate(product, partyName, salesCfg.defaultSalePriceMode);
    const fallbackDisc = salesCfg.enableLineDiscount ? (salesCfg.defaultDiscountPercent || 0) : 0;
    const lineDisc = resolveEffectiveItemDiscountPercent(product, {
      qty: desiredQty,
      salePriceMode: salesCfg.defaultSalePriceMode,
      fallbackDefaultPercent: fallbackDisc,
    });
    const lineTax =
      isGstActive && product.gstApplicable !== false
        ? (product.taxRate ?? businessSettings.item.defaultTaxRate ?? 18)
        : 0;

    if (existingIdx >= 0) {
      const updated = [...lineItems];
      const cur = updated[existingIdx];
      const nextQty = roundQtyPrecision((cur.qty || 0) + 1, 3);
      const nextDisc = Math.max(cur.discountPercent || 0, lineDisc);
      updated[existingIdx] = {
        ...cur,
        qty: nextQty,
        discountPercent: nextDisc,
        displayWeightLabel: isWeightOrVolumeUnit(cur.unit) ? formatBaseQtyHuman(nextQty, cur.unit) : cur.displayWeightLabel,
        amount: calculateItemAmount(nextQty, cur.price, nextDisc, cur.taxPercent || 0),
      };
      setLineItems(updated);
      showToast(`Increased ${product.name} qty to ${formatBaseQtyHuman(nextQty, cur.unit)}`, 'success');
    } else if (lineItems.length === 1 && (!lineItems[0].name || lineItems[0].name === (inventoryItems[0]?.name || 'Standard Product')) && lineItems[0].qty === 1 && !scanInput) {
      const newLine: InvoiceItem = {
        id: 'li-' + Date.now(),
        itemId: product.id,
        brand: product.brand,
        name: product.name,
        hsn: product.code || '8471',
        qty: 1,
        unit: product.unit || businessSettings.item.defaultUnit || 'PCS',
        baseUnit: product.unit || 'PCS',
        baseQty: 1,
        displayWeightLabel: isWeightOrVolumeUnit(product.unit) ? formatBaseQtyHuman(1, product.unit) : undefined,
        price: linePrice,
        discountPercent: lineDisc,
        taxPercent: lineTax,
        amount: calculateItemAmount(1, linePrice, lineDisc, lineTax),
      };
      setLineItems([newLine]);
      showToast(`Added ${product.name} via barcode`, 'success');
    } else {
      const newLine: InvoiceItem = {
        id: 'li-' + Date.now(),
        itemId: product.id,
        brand: product.brand,
        name: product.name,
        hsn: product.code || '8471',
        qty: 1,
        unit: product.unit || businessSettings.item.defaultUnit || 'PCS',
        baseUnit: product.unit || 'PCS',
        baseQty: 1,
        displayWeightLabel: isWeightOrVolumeUnit(product.unit) ? formatBaseQtyHuman(1, product.unit) : undefined,
        price: linePrice,
        discountPercent: lineDisc,
        taxPercent: lineTax,
        amount: calculateItemAmount(1, linePrice, lineDisc, lineTax),
      };
      setLineItems((prev) => [...prev.filter((r) => r.name.trim() !== ''), newLine]);
      showToast(`Added ${product.name} to invoice`, 'success');
    }
  };

  const handleQuickBarcodeEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !scanInput.trim()) return;
    e.preventDefault();
    const raw = scanInput.trim();
    const matched =
      findItemByBarcode(inventoryItems, raw) ||
      inventoryItems.find((i) => i.name.toLowerCase().includes(raw.toLowerCase()));
    if (matched) {
      recordScannedBarcode(raw, matched);
      addScannedProductToInvoice(matched);
      setScanInput('');
    } else {
      recordScannedBarcode(raw, null);
      showToast(`No inventory product matches barcode "${raw}"`, 'warning');
    }
  };

  const openKiranaCalculatorForRow = (idx: number) => {
    const row = lineItems[idx];
    if (!row) return;
    const u = normalizeUnitCode(row.unit);
    const defaultSubUnit = u === 'LTR' || u === 'ML' ? 'ML' : 'GM';
    const currentAmount = row.amount > 0 ? String(roundMoney(row.amount)) : '';
    const subWeight = u === 'KG' || u === 'LTR' ? roundQtyPrecision((row.qty || 0) * 1000, 3) : roundQtyPrecision(row.qty || 0, 3);
    setKiranaCalc({
      rowIdx: idx,
      activeMode: 'weight',
      amountInput: currentAmount,
      weightInput: subWeight > 0 ? String(subWeight) : '',
      weightUnit: defaultSubUnit,
    });
  };

  const applyKiranaLineCalc = (
    idx: number,
    mode: 'amount' | 'weight',
    enteredValue: number,
    weightUnit: string
  ) => {
    const row = lineItems[idx];
    if (!row) return;
    const invMatch = inventoryItems.find(
      (i) => i.id === row.itemId || i.name.toLowerCase() === row.name.toLowerCase() || (row.hsn && i.code === row.hsn)
    );
    const baseUnit = invMatch?.unit || row.baseUnit || row.unit || 'KG';
    const ratePerBase =
      invMatch
        ? (normalizeUnitCode(row.unit) === normalizeUnitCode(baseUnit) && row.price > 0
            ? row.price
            : resolveEffectiveSellingRate(invMatch, partyName, businessSettings.transaction.sales.defaultSalePriceMode))
        : row.price || 0;

    let baseQty = 0;
    let displayWeightLabel = '';
    let gramsOrMl = 0;
    let totalAmount = 0;

    if (mode === 'amount') {
      const calc = calculateWeightFromAmount(enteredValue, ratePerBase, baseUnit);
      baseQty = calc.baseQty;
      displayWeightLabel = calc.displayLabel;
      gramsOrMl = calc.gramsOrMl;
      totalAmount = roundMoney(enteredValue);
    } else {
      const calc = calculateAmountFromWeight(enteredValue, weightUnit, ratePerBase, baseUnit);
      baseQty = calc.baseQty;
      displayWeightLabel = calc.displayLabel;
      gramsOrMl = calc.gramsOrMl;
      totalAmount = calc.amount;
    }

    if (
      invMatch &&
      baseQty > invMatch.stock &&
      !businessSettings.transaction.behaviour.allowNegativeStock &&
      !(isAuthorizedAdmin && allowStockOverride)
    ) {
      showToast(
        `Stock limit exceeded: Requested ${displayWeightLabel} exceeds available ${formatBaseQtyHuman(invMatch.stock, invMatch.unit)} of "${invMatch.name}".`,
        'error'
      );
      return;
    }

    setIsDirty(true);
    setLineItems((prev) =>
      prev.map((li, i) => {
        if (i !== idx) return li;
        const netAmount =
          mode === 'amount' && (li.discountPercent || 0) === 0 && (!isGstActive || isTaxInclusive || (li.taxPercent || 0) === 0)
            ? roundMoney(enteredValue)
            : calculateItemAmount(baseQty, ratePerBase, li.discountPercent || 0, li.taxPercent || 0);
        return {
          ...li,
          itemId: invMatch?.id || li.itemId,
          brand: invMatch?.brand || li.brand,
          qty: baseQty,
          unit: baseUnit,
          baseUnit,
          baseQty,
          price: ratePerBase,
          inputMode: mode,
          originalInputValue: enteredValue,
          normalizedWeightGrams: gramsOrMl,
          displayWeightLabel,
          amount: netAmount > 0 ? netAmount : totalAmount,
        };
      })
    );
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    setIsDirty(true);
    const updated = [...lineItems];
    const prevUnit = updated[index].unit;
    const current: InvoiceItem = { ...updated[index], [field]: value };

    // Auto-fill from inventory on name selection
    if (field === 'name') {
      const match = inventoryItems.find((i) => i.name.toLowerCase() === String(value).toLowerCase());
      if (match) {
        if (match.isActive === false) {
          showToast(`"${match.name}" is inactive and cannot be added to a new bill.`, 'error');
          return;
        }
        const salesCfg = businessSettings.transaction.sales;
        current.itemId = match.id;
        current.brand = match.brand;
        current.price = resolveEffectiveSellingRate(
          match,
          partyName,
          salesCfg.defaultSalePriceMode
        );
        current.hsn = match.code;
        current.unit = match.unit;
        current.baseUnit = match.unit;
        current.baseQty = current.qty;
        current.taxPercent = isGstActive && match.gstApplicable !== false ? match.taxRate : 0;
        current.discountPercent = resolveEffectiveItemDiscountPercent(match, {
          qty: current.qty || 1,
          salePriceMode: salesCfg.defaultSalePriceMode,
          fallbackDefaultPercent: salesCfg.enableLineDiscount ? (salesCfg.defaultDiscountPercent || 0) : 0,
        });
        current.unitCostAtSale = undefined;
        current.unitCostEdited = false;
        current.displayWeightLabel = isWeightOrVolumeUnit(match.unit)
          ? formatBaseQtyHuman(current.qty || 1, match.unit)
          : undefined;
      }
    }

    if (field === 'unit' && value !== prevUnit) {
      const invMatch = inventoryItems.find(
        (i) => i.id === current.itemId || i.name.toLowerCase() === current.name.toLowerCase() || (current.hsn && i.code === current.hsn)
      );
      const factor = convertUnitQty(1, String(value), prevUnit);
      if (factor !== 1 && factor > 0) {
        current.price = roundMoney((current.price || 0) * factor);
        if (current.unitCostEdited && current.unitCostAtSale !== undefined) {
          current.unitCostAtSale = roundMoney(current.unitCostAtSale * factor);
        }
      }
      if (invMatch) {
        const reqBaseQty = convertUnitQty(current.qty || 0, String(value), invMatch.unit);
        current.baseQty = reqBaseQty;
        current.baseUnit = invMatch.unit;
        if (
          reqBaseQty > invMatch.stock &&
          !businessSettings.transaction.behaviour.allowNegativeStock &&
          !(isAuthorizedAdmin && allowStockOverride)
        ) {
          showToast(
            `Stock limit exceeded: "${invMatch.name}" has only ${formatBaseQtyHuman(invMatch.stock, invMatch.unit)} available.`,
            'error'
          );
          return;
        }
      }
      current.displayWeightLabel = isWeightOrVolumeUnit(String(value))
        ? formatBaseQtyHuman(current.qty || 0, String(value))
        : undefined;
    }

    if (field === 'qty') {
      const nextQty = Math.max(0, Number(value) || 0);
      const invMatch = inventoryItems.find(
        (i) => i.id === current.itemId || i.name.toLowerCase() === current.name.toLowerCase() || (current.hsn && i.code === current.hsn)
      );
      if (invMatch) {
        const reqBaseQty = convertUnitQty(nextQty, current.unit || invMatch.unit, invMatch.unit);
        current.baseQty = reqBaseQty;
        current.baseUnit = invMatch.unit;
        if (
          reqBaseQty > invMatch.stock &&
          !businessSettings.transaction.behaviour.allowNegativeStock &&
          !(isAuthorizedAdmin && allowStockOverride)
        ) {
          showToast(
            `Stock limit exceeded: "${invMatch.name}" has only ${formatBaseQtyHuman(invMatch.stock, invMatch.unit)} available.`,
            'error'
          );
          return;
        }
        const autoDisc = resolveEffectiveItemDiscountPercent(invMatch, {
          qty: reqBaseQty,
          salePriceMode: businessSettings.transaction.sales.defaultSalePriceMode,
        });
        if (autoDisc > (current.discountPercent || 0)) {
          current.discountPercent = autoDisc;
        }
      }
      current.qty = nextQty;
      current.inputMode = 'qty';
      current.displayWeightLabel = isWeightOrVolumeUnit(current.unit)
        ? formatBaseQtyHuman(nextQty, current.unit)
        : undefined;
    }

    if (field === 'discountPercent') {
      const invMatch = inventoryItems.find(
        (i) => i.id === current.itemId || i.name.toLowerCase() === current.name.toLowerCase() || (current.hsn && i.code === current.hsn)
      );
      const requestedDisc = Math.max(0, Math.min(100, Number(value) || 0));
      if (
        invMatch?.maxDiscountLimitPercent !== undefined &&
        invMatch.maxDiscountLimitPercent >= 0 &&
        requestedDisc > invMatch.maxDiscountLimitPercent
      ) {
        showToast(
          `Discount capped at ${invMatch.maxDiscountLimitPercent}% for "${invMatch.name}".`,
          'warning'
        );
        current.discountPercent = invMatch.maxDiscountLimitPercent;
      } else {
        current.discountPercent = requestedDisc;
      }
    }

    if (field === 'unitCostAtSale') {
      current.unitCostAtSale = Math.max(0, Number(value) || 0);
      current.unitCostEdited = true;
    }

    current.amount = calculateItemAmount(
      current.qty || 0,
      current.price || 0,
      current.discountPercent || 0,
      current.taxPercent || 0
    );

    updated[index] = current;
    setLineItems(updated);
  };

  const addLine = () => {
    setIsDirty(true);
    setLineItems([
      ...lineItems,
      {
        id: 'li-' + Date.now(),
        name: '',
        hsn: '',
        qty: 1,
        unit: businessSettings.item.defaultUnit || 'PCS',
        price: 0,
        discountPercent: 0,
        taxPercent: isGstActive ? (businessSettings.item.defaultTaxRate ?? 18) : 0,
        amount: 0,
      },
    ]);
  };

  const removeLine = (idx: number) => {
    if (lineItems.length === 1) return;
    setIsDirty(true);
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  // Financial Breakdown calculations (includes item + invoice-level discount & GST)
  const grossSubtotal = useMemo(() => {
    return Math.round(lineItems.reduce((acc, curr) => acc + (curr.qty || 0) * (curr.price || 0), 0) * 100) / 100;
  }, [lineItems]);

  const itemLevelDiscount = useMemo(() => {
    return Math.round(
      lineItems.reduce((acc, curr) => {
        const base = (curr.qty || 0) * (curr.price || 0);
        return acc + (base * (curr.discountPercent || 0)) / 100;
      }, 0) * 100
    ) / 100;
  }, [lineItems]);

  const { taxableAmount, totalTaxAmount, invoiceDiscountAmount } = useMemo(() => {
    const preLines = lineItems.map((curr) => {
      const base = (curr.qty || 0) * (curr.price || 0);
      const discounted = Math.max(0, base - (base * (curr.discountPercent || 0)) / 100);
      const rate = isGstActive ? (curr.taxPercent || 0) : 0;
      const exTax = isTaxInclusive && rate > 0 ? discounted / (1 + rate / 100) : discounted;
      return { exTax, rate };
    });
    const exTaxSum = preLines.reduce((s, l) => s + l.exTax, 0);
    const invDisc =
      invoiceDiscountMode === 'fixed'
        ? Math.min(exTaxSum, Math.max(0, Number(invoiceDiscountValue) || 0))
        : (exTaxSum * Math.min(100, Math.max(0, Number(invoiceDiscountValue) || 0))) / 100;
    const invRatio = exTaxSum > 0 ? Math.max(0, (exTaxSum - invDisc) / exTaxSum) : 1;

    let taxableSum = 0;
    let taxSum = 0;
    for (const row of preLines) {
      const netEx = row.exTax * invRatio;
      taxableSum += netEx;
      taxSum += (netEx * row.rate) / 100;
    }
    return {
      taxableAmount: Math.round(taxableSum * 100) / 100,
      totalTaxAmount: Math.round(taxSum * 100) / 100,
      invoiceDiscountAmount: Math.round(invDisc * 100) / 100,
    };
  }, [lineItems, isGstActive, isTaxInclusive, invoiceDiscountMode, invoiceDiscountValue]);

  const totalDiscount = useMemo(
    () => Math.round((itemLevelDiscount + invoiceDiscountAmount) * 100) / 100,
    [itemLevelDiscount, invoiceDiscountAmount]
  );

  const profitCfg = businessSettings.accounting?.profitControl;
  const activeCostingMethod = getEffectiveCostingMethod(businessSettings);
  const activeProfitLines = useMemo(
    () => lineItems.filter((l) => l.name.trim().length > 0 && (l.qty || 0) > 0),
    [lineItems]
  );
  const profitAnalysis = useMemo(
    () =>
      analyzeSaleInvoiceProfit({
        lines: activeProfitLines,
        items: inventoryItems,
        batches,
        costingMethod: activeCostingMethod,
        isGstActive,
        isTaxInclusive,
        gstBasisForProfit: profitCfg?.gstBasisForProfit || 'Exclude Creditable GST',
        invoiceDiscountMode,
        invoiceDiscountValue,
        maxDiscountPercent: profitCfg?.maxDiscountPercent ?? 15,
        minProfitMarginPercent: profitCfg?.minProfitMarginPercent ?? 3,
        preserveHistoricalCost: false,
      }),
    [
      activeProfitLines,
      inventoryItems,
      batches,
      activeCostingMethod,
      isGstActive,
      isTaxInclusive,
      profitCfg?.gstBasisForProfit,
      profitCfg?.maxDiscountPercent,
      profitCfg?.minProfitMarginPercent,
      invoiceDiscountMode,
      invoiceDiscountValue,
    ]
  );

  const cgstAmount =
    isGstActive && isIntraState && businessSettings.gst.enableCgstSgst
      ? Math.round((totalTaxAmount / 2) * 100) / 100
      : 0;
  const sgstAmount =
    isGstActive && isIntraState && businessSettings.gst.enableCgstSgst
      ? Math.round((totalTaxAmount / 2) * 100) / 100
      : 0;
  const igstAmount =
    isGstActive && !isIntraState && businessSettings.gst.enableIgst
      ? totalTaxAmount
      : 0;

  const chargesTotal =
    (Number(shippingCharges) || 0) +
    (Number(packagingCharges) || 0) +
    (Number(otherCharges) || 0) +
    (Number(adjustmentAmount) || 0);
  const rawTotal = taxableAmount + totalTaxAmount + chargesTotal;
  const roundedTotal = autoRoundOff ? Math.round(rawTotal) : Math.round(rawTotal * 100) / 100;
  const roundOff = Math.round((roundedTotal - rawTotal) * 100) / 100;
  const grandTotal = Math.max(0, roundedTotal);

  const effectiveSettled = (Number(receivedAmount) || 0) + (Number(creditApplied) || 0);
  const changeReturned = Math.max(0, Math.round((effectiveSettled - grandTotal) * 100) / 100);
  const balance = Math.max(0, Math.round((grandTotal - effectiveSettled) * 100) / 100);

  // Credit Limit Check
  const creditCheck = useMemo(() => {
    return checkPartyCreditLimit(partyName, balance);
  }, [partyName, balance, checkPartyCreditLimit]);

  // Duplicate Invoice Number Check
  const isDuplicateNo = useMemo(() => {
    return isInvoiceNumberDuplicate(invoiceNo, selectedInvoice?.id);
  }, [invoiceNo, selectedInvoice, isInvoiceNumberDuplicate]);

  // Close with unsaved changes confirmation
  const handleRequestClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      setIsAddSaleOpen(false);
      setSelectedInvoice(null);
    }
  };

  const handleSave = (andPrint = false, asDraft = false) => {
    if (!partyName.trim()) {
      showToast('Please specify customer / party name');
      return;
    }
    if (grandTotal <= 0) {
      showToast('Invoice total must be greater than zero');
      return;
    }
    if (isDuplicateNo) {
      showToast(`Invoice #${invoiceNo} already exists. Please assign a unique invoice number.`);
      return;
    }
    if (creditCheck.exceeded && !creditLimitOverride) {
      showToast(`Customer credit limit exceeded by ₹${creditCheck.excess.toLocaleString('en-IN')}. Please confirm credit override.`);
      return;
    }

    // Require customer selection on credit bills if configured in Transaction -> Sales Settings
    if (
      businessSettings.transaction.sales.requireCustomerSelection &&
      balance > 0 &&
      partyName.trim().toLowerCase() === 'cash sale'
    ) {
      showToast('Please select a registered customer for Credit / unpaid balance bills per Transaction Settings.', 'warning');
      return;
    }

    // Blocked party enforcement from Party Settings
    if (businessSettings.party.blockTransactionsForBlockedParties) {
      const matchedParty = parties.find((p) => p.name.toLowerCase() === partyName.trim().toLowerCase());
      if (matchedParty?.status === 'Blocked') {
        showToast(`Transactions are blocked for "${matchedParty.name}". Change party status in Parties or Party Settings.`, 'error');
        return;
      }
    }

    // Available Stock Enforcement (fractional base-unit comparison)
    if (
      !isEditing &&
      !businessSettings.transaction.behaviour.allowNegativeStock &&
      !(isAuthorizedAdmin && allowStockOverride)
    ) {
      for (const li of lineItems) {
        const inv = inventoryItems.find(
          (i) => i.id === li.itemId || i.name.toLowerCase() === li.name.toLowerCase() || (li.hsn && i.code === li.hsn)
        );
        const reqBaseQty = inv ? convertUnitQty(li.qty || 0, li.unit || inv.unit, inv.unit) : li.qty || 0;
        if (inv && reqBaseQty > inv.stock + 0.0001) {
          showToast(
            `Cannot bill ${li.displayWeightLabel || formatBaseQtyHuman(li.qty, li.unit)} of "${inv.name}" — only ${formatBaseQtyHuman(inv.stock, inv.unit)} in stock.`,
            'error'
          );
          return;
        }
      }
    }

    // RBAC Security Guardrail 1: Invoice Protection
    if (isEditing && selectedInvoice && !canEditFinalizedBill(selectedInvoice.id)) {
      showToast('Invoice Protection: Your role is not authorized to modify finalized sales bills.');
      return;
    }

    // RBAC Security Guardrail 2: Discount Limits Ceiling
    const maxItemDisc = Math.max(...lineItems.map((li) => li.discountPercent || 0), 0);
    const overallDiscPercent = grossSubtotal > 0 ? (totalDiscount / grossSubtotal) * 100 : 0;
    const maxDiscountApplied = Math.max(maxItemDisc, overallDiscPercent);
    const discPerm = canApplyDiscount(maxDiscountApplied);
    if (!discPerm.allowed) {
      showToast(
        discPerm.reason || `Security Violation: Applied discount exceeds your role ceiling (${discPerm.maxAllowed}%).`,
        'error'
      );
      return;
    }

    // Smart Profit Protection: Block or require Admin PIN approval for loss-making / excessive discount bills
    const allowLoss = profitCfg?.allowLossMakingSales ?? true;
    const requirePin = profitCfg?.requireAdminPinForLoss ?? true;
    if (!allowLoss && (profitAnalysis.status === 'LOSS' || profitAnalysis.lossCausingItems.length > 0)) {
      logDiscountApproval({
        invoiceNo: invoiceNo || 'DRAFT',
        partyName,
        requestedBy: currentUser?.name || 'Staff',
        approvedBy: 'System Policy',
        discountAmount: totalDiscount,
        discountPercent: Math.round(overallDiscPercent * 100) / 100,
        lossAmount: profitAnalysis.lossAmount,
        reason: 'Blocked automatically: Loss-making sales are disabled in Accounting Settings',
        status: 'Blocked',
      });
      showToast(
        `Loss Sale Blocked (₹${profitAnalysis.lossAmount.toLocaleString('en-IN')} loss). Max safe discount is ₹${profitAnalysis.maxSafeInvoiceDiscountAmount.toLocaleString('en-IN')} (${profitAnalysis.maxSafeInvoiceDiscountPercent}%).`,
        'error'
      );
      return;
    }

    if (profitAnalysis.requiresAdminApproval && requirePin && !asDraft) {
      setPinModal({ open: true, andPrint, pin: '', reason: '', error: '' });
      return;
    }

    commitSaveTransaction(andPrint, undefined, asDraft);
  };

  const commitSaveTransaction = (
    andPrint: boolean,
    approvalMeta?: Transaction['discountApproval'],
    asDraft = false
  ) => {
    const netAppliedReceived = Math.min(grandTotal, Math.max(0, Number(receivedAmount) || 0));
    const txStatus = balance === 0 ? 'Paid' : effectiveSettled > 0 ? 'Partial' : 'Unpaid';
    const parsedTags = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    let createdOrUpdated: Transaction;

    if (isEditing && selectedInvoice) {
      const newRevision = {
        timestamp: `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        modifiedBy: currentUser?.name || 'Admin',
        changes: `Updated items. Total adjusted to ₹${grandTotal.toLocaleString('en-IN')}`,
        totalAmount: grandTotal,
      };
      const existingRevisions = selectedInvoice.revisionHistory || [];

      updateTransaction(selectedInvoice.id, {
        partyName,
        partyPhone,
        partyAddress,
        partyGstin,
        invoiceNo,
        date,
        dueDate,
        paymentType,
        totalAmount: grandTotal,
        receivedAmount: netAppliedReceived,
        balance,
        status: txStatus,
        items: lineItems,
        notes,
        stateOfSupply,
        gstType,
        subtotal: grossSubtotal,
        totalDiscount,
        invoiceDiscountMode,
        invoiceDiscountValue,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        roundOff,
        shippingCharges: Number(shippingCharges) || 0,
        packagingCharges: Number(packagingCharges) || 0,
        otherCharges: Number(otherCharges) || 0,
        adjustmentAmount: Number(adjustmentAmount) || 0,
        creditApplied: Number(creditApplied) || 0,
        changeReturned,
        branchId: branchCode || undefined,
        warehouseId: warehouseCode || undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        workflowStatus: asDraft ? 'Draft' : selectedInvoice.workflowStatus === 'Draft' ? 'Completed' : selectedInvoice.workflowStatus,
        vehicleNumber,
        originalInvoiceNo,
        salesperson: salesperson || undefined,
        discountApproval: approvalMeta || selectedInvoice.discountApproval,
        revisionHistory: [newRevision, ...existingRevisions],
      });

      createdOrUpdated = {
        ...selectedInvoice,
        partyName,
        partyPhone,
        partyAddress,
        partyGstin,
        invoiceNo,
        date,
        dueDate,
        paymentType,
        totalAmount: grandTotal,
        receivedAmount: netAppliedReceived,
        balance,
        status: txStatus,
        items: lineItems,
        notes,
        stateOfSupply,
        gstType,
        subtotal: grossSubtotal,
        totalDiscount,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        roundOff,
        shippingCharges: Number(shippingCharges) || 0,
        packagingCharges: Number(packagingCharges) || 0,
        otherCharges: Number(otherCharges) || 0,
        adjustmentAmount: Number(adjustmentAmount) || 0,
        creditApplied: Number(creditApplied) || 0,
        changeReturned,
        tags: parsedTags,
        attachments,
        vehicleNumber,
        originalInvoiceNo,
      };
    } else {
      const res = addTransaction({
        type: 'Sale',
        invoiceNo: invoiceNo || getNextDocumentNumber('Sales Invoice', { branchCode, warehouseCode }),
        date,
        dueDate,
        partyName,
        partyPhone,
        partyAddress,
        partyGstin,
        firm: company.name,
        user: currentUser?.name || 'Admin',
        paymentType,
        totalAmount: grandTotal,
        receivedAmount: netAppliedReceived,
        balance,
        status: txStatus,
        items: lineItems,
        notes,
        stateOfSupply,
        gstType,
        subtotal: grossSubtotal,
        totalDiscount,
        invoiceDiscountMode,
        invoiceDiscountValue,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        roundOff,
        shippingCharges: Number(shippingCharges) || 0,
        packagingCharges: Number(packagingCharges) || 0,
        otherCharges: Number(otherCharges) || 0,
        adjustmentAmount: Number(adjustmentAmount) || 0,
        creditApplied: Number(creditApplied) || 0,
        changeReturned,
        branchId: branchCode || undefined,
        warehouseId: warehouseCode || undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        workflowStatus: asDraft ? 'Draft' : 'Completed',
        skipStockDeduction: asDraft,
        vehicleNumber,
        originalInvoiceNo,
        salesperson: salesperson || undefined,
        discountApproval: approvalMeta,
      });
      if (!res) return;
      createdOrUpdated = res;
    }

    try {
      localStorage.removeItem('bm360_sale_draft_v2');
    } catch {
      // ignore
    }
    setPendingRecoveryDraft(null);
    setIsAddSaleOpen(false);
    setSelectedInvoice(null);
    setIsDirty(false);

    if ((andPrint || businessSettings.print.autoPrintOnSave) && !asDraft && createdOrUpdated) {
      setSelectedInvoice(createdOrUpdated);
      setIsInvoicePreviewOpen(true);
    }
  };

  const handleConfirmPinApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyAdminApprovalPin(pinModal.pin)) {
      setPinModal((prev) => ({ ...prev, error: 'Invalid Admin Approval PIN.' }));
      return;
    }
    if (!pinModal.reason.trim()) {
      setPinModal((prev) => ({ ...prev, error: 'Please enter a valid business reason for audit log.' }));
      return;
    }
    const overallDiscPercent = grossSubtotal > 0 ? Math.round((totalDiscount / grossSubtotal) * 10000) / 100 : 0;
    const approvalMeta: NonNullable<Transaction['discountApproval']> = {
      approvedBy: currentUser?.name || 'Admin',
      approvedRole: currentUser?.roleName || 'Admin',
      reason: pinModal.reason.trim(),
      approvedAt: new Date().toISOString(),
      lossAmount: profitAnalysis.lossAmount,
    };
    logDiscountApproval({
      invoiceNo: invoiceNo || 'NEW',
      partyName,
      requestedBy: currentUser?.name || 'Staff',
      approvedBy: approvalMeta.approvedBy,
      discountAmount: totalDiscount,
      discountPercent: overallDiscPercent,
      lossAmount: profitAnalysis.lossAmount,
      reason: approvalMeta.reason,
      status: 'Approved',
    });
    const shouldPrint = pinModal.andPrint;
    setPinModal({ open: false, andPrint: false, pin: '', reason: '', error: '' });
    commitSaveTransaction(shouldPrint, approvalMeta);
  };

  if (!isAddSaleOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-3 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden text-xs text-slate-800">
        {/* Modal Header */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-rose-400 shrink-0" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                {isEditing
                  ? `Edit ${isGstActive ? 'Tax Invoice' : 'Bill of Supply'} #${invoiceNo}`
                  : isGstActive
                  ? 'Create Professional GST Tax Invoice'
                  : 'Create Non-GST Bill of Supply'}
              </h2>
              <span className="text-[10px] text-slate-400">
                {isGstActive
                  ? `GST Compliant (${isTaxInclusive ? 'Tax Inclusive' : 'Tax Exclusive'}) • Real-time Tax Split`
                  : 'Non-GST Mode Active (0% Tax) • Stock & Ledger Synchronized'}
              </span>
            </div>
          </div>
          <button
            onClick={handleRequestClose}
            className="text-slate-400 hover:text-white p-1.5 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Crash Recovery Draft Banner */}
        {!isEditing && pendingRecoveryDraft && (
          <div className="bg-sky-50 border-b border-sky-200 px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 text-sky-900 font-medium">
              <Clock className="w-4 h-4 text-sky-600 shrink-0" />
              <span>
                Unsaved draft found for <strong>{pendingRecoveryDraft.partyName || 'Customer'}</strong> ({pendingRecoveryDraft.lineItems?.length || 1} items). Recover it?
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const d = pendingRecoveryDraft;
                  if (d.partyName) setPartyName(d.partyName);
                  if (d.partyPhone) setPartyPhone(d.partyPhone);
                  if (d.partyAddress) setPartyAddress(d.partyAddress);
                  if (d.partyGstin) setPartyGstin(d.partyGstin);
                  if (d.stateOfSupply) setStateOfSupply(d.stateOfSupply);
                  if (d.date) setDate(d.date);
                  if (d.dueDate) setDueDate(d.dueDate);
                  if (d.paymentType) setPaymentType(d.paymentType);
                  if (d.receivedAmount !== undefined) setReceivedAmount(d.receivedAmount);
                  if (d.notes) setNotes(d.notes);
                  if (d.vehicleNumber) setVehicleNumber(d.vehicleNumber);
                  if (d.shippingCharges !== undefined) setShippingCharges(d.shippingCharges);
                  if (d.packagingCharges !== undefined) setPackagingCharges(d.packagingCharges);
                  if (d.otherCharges !== undefined) setOtherCharges(d.otherCharges);
                  if (d.adjustmentAmount !== undefined) setAdjustmentAmount(d.adjustmentAmount);
                  if (d.creditApplied !== undefined) setCreditApplied(d.creditApplied);
                  if (d.tagsInput) setTagsInput(d.tagsInput);
                  if (Array.isArray(d.lineItems) && d.lineItems.length > 0) setLineItems(d.lineItems);
                  setPendingRecoveryDraft(null);
                  setIsDirty(true);
                  showToast('Recovered unsaved invoice draft.', 'info');
                }}
                className="px-3 py-1 rounded bg-sky-700 hover:bg-sky-800 text-white font-semibold cursor-pointer"
              >
                Recover Draft
              </button>
              <button
                type="button"
                onClick={() => {
                  try { localStorage.removeItem('bm360_sale_draft_v2'); } catch { /* ignore */ }
                  setPendingRecoveryDraft(null);
                }}
                className="px-2.5 py-1 rounded border border-sky-300 bg-white text-sky-800 font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Unsaved Changes Confirmation Modal */}
        {showDiscardConfirm && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between animate-in slide-in-from-top duration-150">
            <div className="flex items-center gap-2 text-amber-900 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>You have unsaved changes in this invoice. Are you sure you want to discard them?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDiscardConfirm(false)}
                className="px-3 py-1 rounded bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 font-medium"
              >
                Keep Editing
              </button>
              <button
                onClick={() => {
                  try { localStorage.removeItem('bm360_sale_draft_v2'); } catch { /* ignore */ }
                  setShowDiscardConfirm(false);
                  setIsDirty(false);
                  setIsAddSaleOpen(false);
                  setSelectedInvoice(null);
                }}
                className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium"
              >
                Discard Changes
              </button>
            </div>
          </div>
        )}

        {/* Credit Limit Alert Banner */}
        {creditCheck.exceeded && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-900">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <div>
                <strong>Credit Limit Warning:</strong> Customer credit limit is ₹{creditCheck.creditLimit.toLocaleString('en-IN')}.
                Current balance is ₹{creditCheck.currentBalance.toLocaleString('en-IN')}. This invoice will exceed limit by{' '}
                <strong className="text-rose-700">₹{creditCheck.excess.toLocaleString('en-IN')}</strong>.
              </div>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded border border-rose-300 text-rose-800 text-[11px] font-semibold">
              <input
                type="checkbox"
                checked={creditLimitOverride}
                onChange={(e) => setCreditLimitOverride(e.target.checked)}
                className="rounded border-rose-400 text-rose-600 focus:ring-0"
              />
              <span>Authorize Override</span>
            </label>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Top Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
            {/* Party Selection */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Customer / Party Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={partyName}
                  onChange={(e) => handlePartySelect(e.target.value)}
                  placeholder="Enter or select customer name"
                  list="parties-list"
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-medium focus:border-rose-500 focus:outline-none"
                />
                <datalist id="parties-list">
                  <option value="Cash Sale" />
                  {parties.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.phone ? `(${p.phone})` : ''} - Bal: ₹{p.balance}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Mobile Number
              </label>
              <input
                type="text"
                value={partyPhone}
                onChange={(e) => {
                  setPartyPhone(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="+91 9876543210"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
              />
            </div>

            {/* GSTIN */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Customer GSTIN
              </label>
              <input
                type="text"
                value={partyGstin}
                onChange={(e) => {
                  setPartyGstin(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="29ABCDE1234F1Z5"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono uppercase focus:border-rose-500 focus:outline-none"
              />
            </div>

            {/* State of Supply */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Place of Supply *</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${isIntraState ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                  {isIntraState ? 'CGST+SGST' : 'IGST'}
                </span>
              </label>
              <select
                value={stateOfSupply}
                onChange={(e) => {
                  setStateOfSupply(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Invoice No + Branch/Warehouse Series */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Invoice No. *</span>
                {isDuplicateNo && <span className="text-[10px] text-rose-600 font-bold">Duplicate!</span>}
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => {
                    setInvoiceNo(e.target.value);
                    setIsDirty(true);
                  }}
                  className={`w-full bg-white border rounded px-2.5 py-1.5 text-xs font-semibold focus:outline-none ${isDuplicateNo ? 'border-rose-500 bg-rose-50 text-rose-900' : 'border-slate-300'}`}
                />
                <button
                  type="button"
                  onClick={() => setInvoiceNo(getNextDocumentNumber('Sales Invoice', { branchCode: branchCode || undefined, warehouseCode: warehouseCode || undefined }))}
                  title="Generate next sequential number"
                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-slate-700 text-[10px] font-bold shrink-0 cursor-pointer"
                >
                  Next
                </button>
              </div>
              {!isEditing && (
                <div className="grid grid-cols-2 gap-1 mt-1">
                  <input
                    type="text"
                    value={branchCode}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase();
                      setBranchCode(v);
                      setInvoiceNo(getNextDocumentNumber('Sales Invoice', { branchCode: v || undefined, warehouseCode: warehouseCode || undefined }));
                    }}
                    placeholder="Branch (BR1)"
                    className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-mono uppercase"
                  />
                  <input
                    type="text"
                    value={warehouseCode}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase();
                      setWarehouseCode(v);
                      setInvoiceNo(getNextDocumentNumber('Sales Invoice', { branchCode: branchCode || undefined, warehouseCode: v || undefined }));
                    }}
                    placeholder="WH (MAIN)"
                    className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-mono uppercase"
                  />
                </div>
              )}
            </div>

            {/* Invoice Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Invoice Date
              </label>
              <input
                type="text"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="DD/MM/YYYY"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Payment Due Date
              </label>
              <input
                type="text"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="DD/MM/YYYY"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
              />
            </div>

            {/* Billing Address */}
            <div className="md:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Billing Address
              </label>
              <input
                type="text"
                value={partyAddress}
                onChange={(e) => {
                  setPartyAddress(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="Customer street address, city, pincode"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
              />
            </div>

            {/* Dispatch / Vehicle No */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Vehicle / Dispatch No.
              </label>
              <input
                type="text"
                value={vehicleNumber}
                onChange={(e) => {
                  setVehicleNumber(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="KA-01-AB-1234"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs uppercase focus:border-rose-500 focus:outline-none"
              />
            </div>

            {employees.length > 0 && (
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Salesperson (Commission Attribution)
                </label>
                <select
                  value={salesperson}
                  onChange={(e) => {
                    setSalesperson(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
                >
                  <option value="">-- Direct / Unassigned --</option>
                  {employees
                    .filter((emp) => emp.status === 'Active')
                    .map((emp) => (
                      <option key={emp.id} value={emp.name}>
                        {emp.name} ({emp.designation} • {emp.commissionRatePercent}% comm)
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Smart Barcode Scan Toolbar for Invoice */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50/70 border border-emerald-200 rounded-lg px-3.5 py-2.5">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <Barcode className="w-4 h-4 text-emerald-700 shrink-0" />
              <input
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={handleQuickBarcodeEnter}
                placeholder="Scan barcode (USB/BT) or type barcode / SKU & press Enter to add/increment..."
                className="flex-1 bg-white border border-emerald-300 rounded px-2.5 py-1.5 text-xs font-mono font-semibold focus:border-emerald-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  openBarcodeScanner('billing', (matched) => {
                    if (matched) addScannedProductToInvoice(matched);
                  })
                }
                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>Scan Barcode</span>
              </button>
            </div>

            {isAuthorizedAdmin && (
              <label className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-amber-300 text-amber-900 font-semibold text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowStockOverride}
                  onChange={(e) => setAllowStockOverride(e.target.checked)}
                  className="rounded text-rose-600"
                />
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Admin Stock Override</span>
              </label>
            )}
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-lg overflow-x-auto shadow-2xs">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px] font-semibold">
                  <th className="py-2.5 px-2.5 w-8">#</th>
                  <th className="py-2.5 px-2.5">Item Description</th>
                  <th className="py-2.5 px-2 w-18">HSN</th>
                  <th className="py-2.5 px-2 w-20 text-right">Qty / Wt</th>
                  <th className="py-2.5 px-2 w-18">Unit</th>
                  <th className="py-2.5 px-2 w-22 text-right">Cost (₹)</th>
                  <th className="py-2.5 px-2 w-24 text-right">Price (₹)</th>
                  <th className="py-2.5 px-2 w-16 text-right">Disc %</th>
                  <th className="py-2.5 px-2 w-22 text-right">Tax Rate</th>
                  <th className="py-2.5 px-2.5 w-26 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {lineItems.map((item, idx) => {
                  const invMatch = inventoryItems.find(
                    (i) => i.id === item.itemId || i.name.toLowerCase() === item.name.toLowerCase() || (item.hsn && i.code === item.hsn)
                  );
                  const lineProfit = profitAnalysis.lines.find((pl) => pl.lineId === item.id);
                  const isLineLoss = lineProfit && lineProfit.grossProfit < -0.01;
                  const reqBaseQty = invMatch
                    ? convertUnitQty(item.qty || 0, item.unit || invMatch.unit, invMatch.unit)
                    : item.qty || 0;
                  const isLooseRow = isLooseKiranaProduct(invMatch) || isWeightOrVolumeUnit(item.unit);
                  const displayCostValue =
                    item.unitCostEdited && item.unitCostAtSale !== undefined
                      ? item.unitCostAtSale
                      : lineProfit?.unitCost ?? invMatch?.purchasePrice ?? 0;

                  return (
                    <React.Fragment key={item.id}>
                      <tr className={isLineLoss ? 'bg-rose-50/70 hover:bg-rose-50' : 'hover:bg-slate-50/60'}>
                        <td className="py-2 px-2.5 text-slate-400 font-mono align-top">{idx + 1}</td>
                        <td className="py-2 px-2 align-top">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                              placeholder="Item name"
                              list={`inventory-items-${idx}`}
                              className="w-full bg-white border border-slate-200 rounded px-2 py-1 font-medium focus:border-rose-500 focus:outline-none"
                            />
                            {isLooseRow && (
                              <button
                                type="button"
                                onClick={() =>
                                  kiranaCalc.rowIdx === idx
                                    ? setKiranaCalc((p) => ({ ...p, rowIdx: null }))
                                    : openKiranaCalculatorForRow(idx)
                                }
                                title="Smart Weight ↔ Amount ₹ Calculator"
                                className={`shrink-0 px-2 py-1 rounded border text-[10px] font-semibold flex items-center gap-1 cursor-pointer ${
                                  kiranaCalc.rowIdx === idx
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                }`}
                              >
                                <Scale className="w-3 h-3" />
                                <span>Wt/₹</span>
                              </button>
                            )}
                          </div>
                          {invMatch && (
                            <div className="text-[10px] mt-1 flex flex-wrap items-center gap-2 text-slate-500 tabular-nums">
                              <span className={invMatch.stock < reqBaseQty ? 'text-rose-600 font-bold' : 'text-emerald-700 font-semibold'}>
                                Stock: {formatBaseQtyHuman(invMatch.stock, invMatch.unit)}
                              </span>
                              {item.displayWeightLabel && (
                                <span className="font-semibold text-slate-700">
                                  · Qty: {item.displayWeightLabel}
                                </span>
                              )}
                              {(invMatch.mrp ?? 0) > 0 && <span>· MRP ₹{invMatch.mrp}</span>}
                              {lineProfit && (
                                <span
                                  className={`font-semibold ${
                                    lineProfit.status === 'LOSS'
                                      ? 'text-rose-700'
                                      : lineProfit.status === 'BREAK_EVEN'
                                      ? 'text-amber-700'
                                      : 'text-emerald-700'
                                  }`}
                                >
                                  · GP ₹{lineProfit.grossProfit} ({lineProfit.profitMarginPercent}%) · Min ₹{lineProfit.minSafeSellingPrice}
                                </span>
                              )}
                            </div>
                          )}
                          {!invMatch && lineProfit && (
                            <div className="text-[10px] mt-1 text-slate-600 tabular-nums font-semibold">
                              GP ₹{lineProfit.grossProfit} ({lineProfit.profitMarginPercent}%)
                            </div>
                          )}
                          {(() => {
                            const itemBatches = batches.filter(
                              (b) =>
                                (b.itemId === invMatch?.id || b.itemName.toLowerCase() === item.name.toLowerCase()) &&
                                b.qty > 0
                            );
                            const availSerials = serialNumbers.filter(
                              (s) =>
                                (s.itemId === invMatch?.id || s.itemName.toLowerCase() === item.name.toLowerCase()) &&
                                s.status === 'Available'
                            );
                            if (itemBatches.length === 0 && availSerials.length === 0) return null;
                            return (
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {itemBatches.length > 0 && (
                                  <select
                                    value={item.batchNo || ''}
                                    onChange={(e) => {
                                      const bNo = e.target.value;
                                      const bObj = itemBatches.find((b) => b.batchNumber === bNo);
                                      setIsDirty(true);
                                      setLineItems((prev) =>
                                        prev.map((li, i) =>
                                          i === idx
                                            ? { ...li, batchNo: bNo || undefined, expiryDate: bObj?.expiryDate }
                                            : li
                                        )
                                      );
                                    }}
                                    className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[10px] font-mono"
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
                                    onChange={(e) => {
                                      const sId = e.target.value;
                                      const sObj = availSerials.find((s) => s.id === sId);
                                      setIsDirty(true);
                                      setLineItems((prev) =>
                                        prev.map((li, i) =>
                                          i === idx
                                            ? { ...li, serialId: sId || undefined, serialNo: sObj?.serialNo }
                                            : li
                                        )
                                      );
                                    }}
                                    className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[10px] font-mono"
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
                            );
                          })()}
                          <datalist id={`inventory-items-${idx}`}>
                            {inventoryItems
                              .filter((inv) => inv.isActive !== false)
                              .map((inv) => (
                                <option key={inv.id} value={inv.name}>
                                  Stock: {formatBaseQtyHuman(inv.stock, inv.unit)} • ₹{inv.salePrice}/{inv.unit}
                                </option>
                              ))}
                          </datalist>
                        </td>
                        <td className="py-2 px-2 align-top">
                          <input
                            type="text"
                            value={item.hsn}
                            onChange={(e) => handleItemChange(idx, 'hsn', e.target.value)}
                            placeholder="HSN"
                            className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-xs"
                          />
                        </td>
                        <td className="py-2 px-2 align-top">
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={item.qty}
                            onChange={(e) => handleItemChange(idx, 'qty', Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-right tabular-nums font-semibold"
                          />
                        </td>
                        <td className="py-2 px-2 align-top">
                          <select
                            value={item.unit}
                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-1 py-1"
                          >
                            {Array.from(
                              new Set([
                                ...businessSettings.item.units.map((u) => u.shortCode),
                                'PCS',
                                'BOX',
                                'KG',
                                'GM',
                                'LTR',
                                'ML',
                                'QTL',
                                'PKT',
                                item.unit,
                              ].filter(Boolean))
                            ).map((uCode) => (
                              <option key={uCode} value={uCode}>
                                {uCode}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2 align-top">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={displayCostValue}
                            title="Editable Purchase Price (₹) for live & saved bill profit calculation"
                            onChange={(e) => handleItemChange(idx, 'unitCostAtSale', Number(e.target.value))}
                            className={`w-full border rounded px-1.5 py-1 text-right tabular-nums text-xs ${
                              item.unitCostEdited
                                ? 'bg-amber-50 border-amber-400 font-semibold text-amber-900'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          />
                        </td>
                        <td className="py-2 px-2 align-top">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => handleItemChange(idx, 'price', Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-right tabular-nums font-semibold"
                          />
                        </td>
                        <td className="py-2 px-2 align-top">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            disabled={!businessSettings.transaction.sales.enableLineDiscount}
                            title={!businessSettings.transaction.sales.enableLineDiscount ? 'Line discount is disabled in Transaction Settings' : ''}
                            value={businessSettings.transaction.sales.enableLineDiscount ? item.discountPercent : 0}
                            onChange={(e) => handleItemChange(idx, 'discountPercent', Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-right tabular-nums disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                        <td className="py-2 px-2 align-top">
                          <select
                            value={isGstActive ? item.taxPercent : 0}
                            disabled={!isGstActive}
                            title={!isGstActive ? 'Business is configured as Non-GST in Taxes & GST Settings' : ''}
                            onChange={(e) => handleItemChange(idx, 'taxPercent', Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded px-1 py-1 text-right text-[11px] disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            {!isGstActive ? (
                              <option value="0">0% (Non-GST)</option>
                            ) : (
                              Array.from(new Set([...(businessSettings.gst.defaultTaxRates || [0, 5, 12, 18, 28]), item.taxPercent || 0]))
                                .sort((a, b) => a - b)
                                .map((rate) => (
                                  <option key={rate} value={rate}>
                                    {rate}% GST
                                  </option>
                                ))
                            )}
                          </select>
                        </td>
                        <td className="py-2 px-2.5 text-right font-semibold text-slate-900 tabular-nums align-top">
                          ₹{(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-2 text-center align-top">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            disabled={lineItems.length === 1}
                            className="text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                      {kiranaCalc.rowIdx === idx && (() => {
                        const baseU = normalizeUnitCode(invMatch?.unit || item.baseUnit || item.unit);
                        const isLiquid = baseU === 'LTR' || baseU === 'ML';
                        const weightUnitOpts = isLiquid ? ['ML', 'LTR'] : ['GM', 'KG', 'QTL'];
                        const activeWtUnit = weightUnitOpts.includes(kiranaCalc.weightUnit)
                          ? kiranaCalc.weightUnit
                          : isLiquid
                          ? 'ML'
                          : 'GM';
                        return (
                          <tr className="bg-emerald-50/70 border-b border-emerald-200">
                            <td colSpan={11} className="px-4 py-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="text-[11px] font-bold text-emerald-900">
                                    Smart Weight &amp; Amount Auto-Calc ({item.name || 'Item'} @ ₹{item.price}/{item.unit})
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <label className="text-[10px] font-semibold text-slate-600">Amount ₹</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={kiranaCalc.amountInput}
                                      onFocus={() => setKiranaCalc((p) => ({ ...p, activeMode: 'amount' }))}
                                      onChange={(e) => {
                                        const valStr = e.target.value;
                                        const amt = Math.max(0, Number(valStr) || 0);
                                        const calc = calculateWeightFromAmount(amt, item.price || 0, item.unit);
                                        setKiranaCalc((p) => ({
                                          ...p,
                                          activeMode: 'amount',
                                          amountInput: valStr,
                                          weightInput: String(roundQtyPrecision(calc.gramsOrMl, 3)),
                                          weightUnit: isLiquid ? 'ML' : 'GM',
                                        }));
                                        if (amt > 0) applyKiranaLineCalc(idx, 'amount', amt, isLiquid ? 'ML' : 'GM');
                                      }}
                                      placeholder="e.g. 10"
                                      className={`w-24 px-2 py-1 rounded border text-xs font-bold tabular-nums bg-white ${
                                        kiranaCalc.activeMode === 'amount' ? 'border-emerald-600 ring-1 ring-emerald-500' : 'border-slate-300'
                                      }`}
                                    />
                                  </div>
                                  <span className="text-slate-400 font-bold">↔</span>
                                  <div className="flex items-center gap-1.5">
                                    <label className="text-[10px] font-semibold text-slate-600">Weight</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={kiranaCalc.weightInput}
                                      onFocus={() => setKiranaCalc((p) => ({ ...p, activeMode: 'weight' }))}
                                      onChange={(e) => {
                                        const valStr = e.target.value;
                                        const wt = Math.max(0, Number(valStr) || 0);
                                        const calc = calculateAmountFromWeight(wt, activeWtUnit, item.price || 0, item.unit);
                                        setKiranaCalc((p) => ({
                                          ...p,
                                          activeMode: 'weight',
                                          weightInput: valStr,
                                          weightUnit: activeWtUnit,
                                          amountInput: String(calc.amount),
                                        }));
                                        if (wt > 0) applyKiranaLineCalc(idx, 'weight', wt, activeWtUnit);
                                      }}
                                      placeholder="e.g. 250"
                                      className={`w-24 px-2 py-1 rounded border text-xs font-bold tabular-nums bg-white ${
                                        kiranaCalc.activeMode === 'weight' ? 'border-emerald-600 ring-1 ring-emerald-500' : 'border-slate-300'
                                      }`}
                                    />
                                    <select
                                      value={activeWtUnit}
                                      onChange={(e) => {
                                        const nextU = e.target.value;
                                        const wt = Math.max(0, Number(kiranaCalc.weightInput) || 0);
                                        const calc = calculateAmountFromWeight(wt, nextU, item.price || 0, item.unit);
                                        setKiranaCalc((p) => ({
                                          ...p,
                                          activeMode: 'weight',
                                          weightUnit: nextU,
                                          amountInput: String(calc.amount),
                                        }));
                                        if (wt > 0) applyKiranaLineCalc(idx, 'weight', wt, nextU);
                                      }}
                                      className="px-2 py-1 rounded border border-slate-300 bg-white text-xs font-semibold"
                                    >
                                      {weightUnitOpts.map((wu) => (
                                        <option key={wu} value={wu}>
                                          {wu === 'GM' ? 'g' : wu === 'KG' ? 'kg' : wu === 'ML' ? 'ml' : wu === 'LTR' ? 'L' : wu}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {[5, 10, 20, 50].map((amtChip) => (
                                    <button
                                      key={amtChip}
                                      type="button"
                                      onClick={() => {
                                        const calc = calculateWeightFromAmount(amtChip, item.price || 0, item.unit);
                                        setKiranaCalc((p) => ({
                                          ...p,
                                          activeMode: 'amount',
                                          amountInput: String(amtChip),
                                          weightInput: String(roundQtyPrecision(calc.gramsOrMl, 3)),
                                          weightUnit: isLiquid ? 'ML' : 'GM',
                                        }));
                                        applyKiranaLineCalc(idx, 'amount', amtChip, isLiquid ? 'ML' : 'GM');
                                      }}
                                      className="px-2 py-1 rounded bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-[10px] font-bold tabular-nums cursor-pointer"
                                    >
                                      ₹{amtChip}
                                    </button>
                                  ))}
                                  {(isLiquid
                                    ? [
                                        { label: '100ml', v: 100, u: 'ML' },
                                        { label: '250ml', v: 250, u: 'ML' },
                                        { label: '500ml', v: 500, u: 'ML' },
                                        { label: '1L', v: 1, u: 'LTR' },
                                      ]
                                    : [
                                        { label: '100g', v: 100, u: 'GM' },
                                        { label: '250g', v: 250, u: 'GM' },
                                        { label: '500g', v: 500, u: 'GM' },
                                        { label: '1kg', v: 1, u: 'KG' },
                                      ]
                                  ).map((wtChip) => (
                                    <button
                                      key={wtChip.label}
                                      type="button"
                                      onClick={() => {
                                        const calc = calculateAmountFromWeight(wtChip.v, wtChip.u, item.price || 0, item.unit);
                                        setKiranaCalc((p) => ({
                                          ...p,
                                          activeMode: 'weight',
                                          weightInput: String(wtChip.v),
                                          weightUnit: wtChip.u,
                                          amountInput: String(calc.amount),
                                        }));
                                        applyKiranaLineCalc(idx, 'weight', wtChip.v, wtChip.u);
                                      }}
                                      className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-[10px] font-bold tabular-nums cursor-pointer"
                                    >
                                      {wtChip.label}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => setKiranaCalc((p) => ({ ...p, rowIdx: null }))}
                                    className="px-2 py-1 rounded bg-slate-900 text-white text-[10px] font-semibold cursor-pointer"
                                  >
                                    Done
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })()}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Add Row Button */}
            <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-rose-700 bg-rose-50 hover:bg-rose-100 font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Another Line Item</span>
              </button>

              <div className="text-[11px] text-slate-500">
                {lineItems.length} line item(s) listed
              </div>
            </div>
          </div>

          {/* Bottom Summary & Tax Calculation Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Notes & Payment Terms */}
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Payment Mode *
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {(['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Credit'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setPaymentType(mode);
                        setIsDirty(true);
                        if (mode === 'Cash' || mode === 'UPI') {
                          setReceivedAmount(grandTotal);
                        } else if (mode === 'Credit') {
                          setReceivedAmount(0);
                        }
                      }}
                      className={`py-1.5 px-2 rounded-md font-semibold text-[11px] border text-center transition-all ${
                        paymentType === mode
                          ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Terms &amp; Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setIsDirty(true);
                  }}
                  rows={2}
                  placeholder="Terms of delivery, payment conditions, or bank details..."
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 mb-1">
                    <Tag className="w-3 h-3 text-slate-500" />
                    <span>Invoice Tags (comma-separated)</span>
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => {
                      setTagsInput(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g. B2B, Priority, Festive"
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 mb-1">
                    <Paperclip className="w-3 h-3 text-slate-500" />
                    <span>Attach PO / Delivery Proof ({attachments.length})</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 600 * 1024) {
                        showToast('Attachment max size is 600KB.', 'warning');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        setAttachments((prev) => [
                          ...prev,
                          {
                            id: 'att-' + Date.now(),
                            name: file.name,
                            mimeType: file.type,
                            dataUrl: String(reader.result || ''),
                            uploadedAt: new Date().toISOString(),
                          },
                        ]);
                        setIsDirty(true);
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="w-full text-[11px] text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-200 file:text-slate-700 file:font-semibold"
                  />
                </div>
              </div>

              {/* Revision audit history if editing */}
              {isEditing && selectedInvoice?.revisionHistory && selectedInvoice.revisionHistory.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[10px] space-y-1">
                  <span className="font-bold text-slate-700 block uppercase tracking-wider">
                    Invoice Audit Revision History
                  </span>
                  {selectedInvoice.revisionHistory.map((rev, i) => (
                    <div key={i} className="text-slate-600 flex justify-between">
                      <span>• {rev.timestamp} by {rev.modifiedBy}: {rev.changes}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Calculations Box */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2.5">
              {/* Live Smart Profit & Discount Protection Guard */}
              {activeProfitLines.length > 0 && (
                <div
                  className={`p-3 rounded-lg border text-[11px] space-y-1.5 ${
                    profitAnalysis.status === 'LOSS'
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : profitAnalysis.status === 'BREAK_EVEN' || profitAnalysis.belowMinMargin || profitAnalysis.exceedsMaxDiscount
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>
                      {profitAnalysis.status === 'LOSS'
                        ? 'RED · LOSS INVOICE'
                        : profitAnalysis.status === 'BREAK_EVEN'
                        ? 'YELLOW · BREAK EVEN'
                        : 'GREEN · PROFITABLE BILL'}{' '}
                      ({activeCostingMethod})
                    </span>
                    <span className="tabular-nums">
                      GP: ₹{profitAnalysis.grossProfit.toLocaleString('en-IN')} ({profitAnalysis.profitMarginPercent}%)
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 text-[10px] opacity-90 tabular-nums">
                    <span>Net Ex-GST: ₹{profitAnalysis.netExGstRevenue.toLocaleString('en-IN')}</span>
                    <span>COGS: ₹{profitAnalysis.totalCost.toLocaleString('en-IN')}</span>
                    <span>
                      Max Safe Disc: ₹{profitAnalysis.maxSafeInvoiceDiscountAmount.toLocaleString('en-IN')} (
                      {profitAnalysis.maxSafeInvoiceDiscountPercent}%)
                    </span>
                  </div>
                  {profitAnalysis.lossCausingItems.length > 0 && (
                    <div className="text-[10px] font-semibold text-rose-700">
                      Loss SKUs: {profitAnalysis.lossCausingItems.map((l) => `${l.name} (₹${l.grossProfit})`).join(', ')}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center text-slate-600">
                <span>Gross Subtotal:</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  ₹{grossSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {itemLevelDiscount > 0 && (
                <div className="flex justify-between items-center text-emerald-700">
                  <span>Item Discounts:</span>
                  <span className="font-semibold tabular-nums">
                    - ₹{itemLevelDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center gap-2 text-slate-700">
                <span>Invoice Discount:</span>
                <div className="flex items-center gap-1">
                  <select
                    value={invoiceDiscountMode}
                    onChange={(e) => {
                      setInvoiceDiscountMode(e.target.value as 'percent' | 'fixed');
                      setIsDirty(true);
                    }}
                    className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-semibold"
                  >
                    <option value="percent">%</option>
                    <option value="fixed">₹</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={invoiceDiscountValue}
                    onChange={(e) => {
                      setInvoiceDiscountValue(Math.max(0, Number(e.target.value) || 0));
                      setIsDirty(true);
                    }}
                    className="w-20 bg-white border border-slate-300 rounded px-2 py-0.5 text-right font-semibold tabular-nums"
                  />
                  {invoiceDiscountAmount > 0 && (
                    <span className="text-[11px] text-emerald-700 font-semibold tabular-nums">
                      (-₹{invoiceDiscountAmount.toLocaleString('en-IN')})
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center text-slate-700 font-medium pt-1 border-t border-slate-200">
                <span>Taxable Amount {isGstActive && isTaxInclusive ? '(Back-calculated)' : ''}:</span>
                <span className="tabular-nums">
                  ₹{taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Intra vs Inter-state Tax Split */}
              {!isGstActive ? (
                <div className="flex justify-between items-center text-slate-500 text-[11px]">
                  <span>Tax Treatment (Non-GST Bill of Supply):</span>
                  <span className="font-semibold">₹0.00</span>
                </div>
              ) : isIntraState ? (
                <>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="flex items-center gap-1">
                      <span>CGST (Central Tax):</span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1 rounded">50%</span>
                    </span>
                    <span className="font-semibold tabular-nums">
                      ₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="flex items-center gap-1">
                      <span>SGST (State Tax):</span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1 rounded">50%</span>
                    </span>
                    <span className="font-semibold tabular-nums">
                      ₹{sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center text-slate-600">
                  <span className="flex items-center gap-1">
                    <span>IGST (Integrated Tax):</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-1 rounded">Inter-State</span>
                  </span>
                  <span className="font-semibold tabular-nums">
                    ₹{igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Extra Charges & Adjustments */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-slate-600">Shipping (₹):</span>
                  <input
                    type="number"
                    min="0"
                    value={shippingCharges}
                    onChange={(e) => { setShippingCharges(Math.max(0, Number(e.target.value) || 0)); setIsDirty(true); }}
                    className="w-20 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-right tabular-nums font-semibold"
                  />
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-slate-600">Packaging (₹):</span>
                  <input
                    type="number"
                    min="0"
                    value={packagingCharges}
                    onChange={(e) => { setPackagingCharges(Math.max(0, Number(e.target.value) || 0)); setIsDirty(true); }}
                    className="w-20 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-right tabular-nums font-semibold"
                  />
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-slate-600">Other Chg (₹):</span>
                  <input
                    type="number"
                    min="0"
                    value={otherCharges}
                    onChange={(e) => { setOtherCharges(Math.max(0, Number(e.target.value) || 0)); setIsDirty(true); }}
                    className="w-20 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-right tabular-nums font-semibold"
                  />
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-slate-600">Adj (+/- ₹):</span>
                  <input
                    type="number"
                    value={adjustmentAmount}
                    onChange={(e) => { setAdjustmentAmount(Number(e.target.value) || 0); setIsDirty(true); }}
                    className="w-20 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-right tabular-nums font-semibold"
                  />
                </div>
              </div>

              {/* Round Off */}
              <div className="flex justify-between items-center text-slate-600 text-[11px]">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRoundOff}
                    onChange={(e) => setAutoRoundOff(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Auto Round Off</span>
                </label>
                <span className="font-mono tabular-nums">
                  {roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                </span>
              </div>

              {/* Grand Total */}
              <div className="flex justify-between items-center pt-2 border-t-2 border-slate-300 text-slate-900 text-sm font-bold">
                <span>Grand Total (Net):</span>
                <span className="text-base text-rose-600 tabular-nums">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Received Amount & Credit Applied */}
              <div className="flex justify-between items-center pt-2 text-slate-700">
                <span className="font-semibold">Received / Tendered:</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={receivedAmount}
                    onChange={(e) => {
                      setReceivedAmount(Number(e.target.value));
                      setIsDirty(true);
                    }}
                    className="w-28 bg-white border border-slate-300 rounded px-2 py-1 text-right font-bold text-xs tabular-nums focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-slate-600 text-[11px]">
                <span>Advance / Credit Note Applied:</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={creditApplied}
                    onChange={(e) => { setCreditApplied(Math.max(0, Number(e.target.value) || 0)); setIsDirty(true); }}
                    className="w-24 bg-white border border-slate-300 rounded px-2 py-0.5 text-right font-semibold tabular-nums"
                  />
                </div>
              </div>

              {changeReturned > 0 && (
                <div className="flex justify-between items-center text-sky-700 font-bold text-[11px] bg-sky-50 px-2 py-1 rounded border border-sky-200">
                  <span>Change to Return:</span>
                  <span className="tabular-nums">₹{changeReturned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              {/* Balance Due */}
              <div className="flex justify-between items-center text-slate-900 font-semibold pt-1">
                <span>Balance Due:</span>
                <span className={`tabular-nums ${balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Bar */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-500">
              Tax Treatment: <strong className="text-slate-800">{gstType}</strong>
            </span>
            <span className="text-slate-500">
              State: <strong className="text-slate-800">{stateOfSupply}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleRequestClose}
              className="px-3.5 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleSave(false, true)}
              className="px-3.5 py-2 rounded-md border border-slate-400 bg-white hover:bg-slate-100 text-slate-800 font-semibold transition-colors cursor-pointer"
            >
              Save Draft
            </button>

            <button
              type="button"
              onClick={() => handleSave(false, false)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-900 active:bg-black text-white font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Invoice</span>
            </button>

            <button
              type="button"
              onClick={() => handleSave(true, false)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-md bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b] text-white font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Save &amp; Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Admin PIN Approval Modal for Over-Discount / Low-Margin / Loss Invoices */}
      {pinModal.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[70]">
          <form
            onSubmit={handleConfirmPinApproval}
            className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4 text-xs text-slate-800"
          >
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Admin PIN Approval Required</span>
            </div>
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 space-y-1 tabular-nums">
              <div className="flex justify-between font-semibold">
                <span>Gross Profit Impact:</span>
                <span className={profitAnalysis.grossProfit < 0 ? 'text-rose-700' : 'text-amber-700'}>
                  ₹{profitAnalysis.grossProfit.toLocaleString('en-IN')} ({profitAnalysis.profitMarginPercent}%)
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Max Safe Discount Allowed:</span>
                <span>
                  ₹{profitAnalysis.maxSafeInvoiceDiscountAmount.toLocaleString('en-IN')} (
                  {profitAnalysis.maxSafeInvoiceDiscountPercent}%)
                </span>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Admin Approval PIN *
              </label>
              <input
                type="password"
                autoFocus
                required
                value={pinModal.pin}
                onChange={(e) => setPinModal((p) => ({ ...p, pin: e.target.value, error: '' }))}
                placeholder="Enter Admin PIN"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Approval Reason (Logged in Audit Trail) *
              </label>
              <input
                type="text"
                required
                value={pinModal.reason}
                onChange={(e) => setPinModal((p) => ({ ...p, reason: e.target.value, error: '' }))}
                placeholder="e.g. Stock clearance / Loyal customer match"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:border-rose-500 focus:outline-none"
              />
            </div>
            {pinModal.error && (
              <p className="text-[11px] font-semibold text-rose-600">{pinModal.error}</p>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPinModal({ open: false, andPrint: false, pin: '', reason: '', error: '' })}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Approve &amp; Save Invoice
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
