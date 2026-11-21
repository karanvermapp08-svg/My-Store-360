import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Save, Barcode, Paperclip, Tag, Sparkles } from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { InvoiceItem, Item, Transaction } from '../../types';
import { findItemByBarcode } from '../../utils/barcodeUtils';
import { computePurchaseLineLandedCosts } from '../../utils/profitEngine';
import { compareSupplierQuotations } from '../../utils/transactionEngine';

export const AddPurchaseModal: React.FC = () => {
  const {
    isAddPurchaseOpen,
    setIsAddPurchaseOpen,
    addTransaction,
    parties,
    items: inventoryItems,
    company,
    openBarcodeScanner,
    recordScannedBarcode,
    showToast,
    businessSettings,
    getNextDocumentNumber,
    transactions,
    supplierQuotations,
    supplierItemMappings,
  } = useVyapar();

  const isGstActive = businessSettings.gst.isGstRegistered;
  const isTaxInclusive = businessSettings.transaction.purchase.defaultTaxMode === 'Inclusive';

  const [scanInput, setScanInput] = useState('');
  const [partyName, setPartyName] = useState('Apex Wholesale Hub');
  const [billNo, setBillNo] = useState(() => getNextDocumentNumber('Purchase Bill'));
  const [date, setDate] = useState('02/10/2026');
  const [dueDate, setDueDate] = useState('16/10/2026');
  const [paymentType, setPaymentType] = useState<'Cash' | 'Cheque' | 'Bank Transfer' | 'UPI' | 'Credit'>(
    (businessSettings.transaction.payment.defaultPaymentMode as any) || 'Bank Transfer'
  );
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [freightCharges, setFreightCharges] = useState<number>(0);
  const [packagingCharges, setPackagingCharges] = useState<number>(0);
  const [otherPurchaseExpenses, setOtherPurchaseExpenses] = useState<number>(0);
  const [gstInputCreditEligible, setGstInputCreditEligible] = useState<boolean>(true);
  const [notes, setNotes] = useState('Raw material purchase');
  const [tagsInput, setTagsInput] = useState('');
  const [attachments, setAttachments] = useState<NonNullable<Transaction['attachments']>>([]);

  const showBatchCols =
    businessSettings.item.enableBatchTracking || businessSettings.item.enableExpiryTracking;

  const [lineItems, setLineItems] = useState<InvoiceItem[]>([
    {
      id: 'pli-1',
      name: inventoryItems[0]?.name || 'Stock In Item',
      hsn: inventoryItems[0]?.code || '8471',
      qty: 10,
      unit: inventoryItems[0]?.unit || businessSettings.item.defaultUnit || 'PCS',
      price: inventoryItems[0]?.purchasePrice || 800,
      discountPercent: 0,
      taxPercent: isGstActive ? (inventoryItems[0]?.taxRate ?? businessSettings.item.defaultTaxRate ?? 18) : 0,
      amount: (inventoryItems[0]?.purchasePrice || 800) * 10 * (isGstActive && !isTaxInclusive ? 1.18 : 1),
      batchNo: '',
      expiryDate: '',
    },
  ]);

  const landedAnalysis = useMemo(
    () =>
      computePurchaseLineLandedCosts({
        lines: lineItems,
        freightCharges,
        otherPurchaseExpenses: (Number(otherPurchaseExpenses) || 0) + (Number(packagingCharges) || 0),
        isGstActive,
        isTaxInclusive,
        gstInputCreditEligible,
      }),
    [lineItems, freightCharges, packagingCharges, otherPurchaseExpenses, isGstActive, isTaxInclusive, gstInputCreditEligible]
  );

  if (!isAddPurchaseOpen) return null;

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = [...lineItems];
    const current = { ...updated[index], [field]: value };
    const base = (current.qty || 1) * (current.price || 0);
    const disc = base - (base * (current.discountPercent || 0)) / 100;
    const rate = isGstActive ? (current.taxPercent || 0) : 0;
    current.amount = isTaxInclusive
      ? Math.round(disc * 100) / 100
      : Math.round((disc + (disc * rate) / 100) * 100) / 100;
    updated[index] = current;
    setLineItems(updated);
  };

  const addLine = () => {
    setLineItems([
      ...lineItems,
      {
        id: 'pli-' + Date.now(),
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
  };

  const removeLine = (idx: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const addScannedPurchaseItem = (product: Item) => {
    const idx = lineItems.findIndex(
      (li) => li.name.toLowerCase() === product.name.toLowerCase() || (product.code && li.hsn === product.code)
    );
    if (idx >= 0) {
      const updated = [...lineItems];
      const cur = updated[idx];
      const nextQty = cur.qty + 1;
      const base = nextQty * (cur.price || 0);
      const disc = base - (base * (cur.discountPercent || 0)) / 100;
      const rate = isGstActive ? (cur.taxPercent || 0) : 0;
      updated[idx] = {
        ...cur,
        qty: nextQty,
        amount: isTaxInclusive
          ? Math.round(disc * 100) / 100
          : Math.round((disc + (disc * rate) / 100) * 100) / 100,
      };
      setLineItems(updated);
      showToast(`Purchase qty increased: ${product.name} (${nextQty})`, 'success');
    } else {
      const rate = product.lastPurchasePrice ?? product.purchasePrice ?? product.salePrice ?? 0;
      const taxPct =
        isGstActive && product.gstApplicable !== false
          ? (product.purchaseTaxRate ?? product.taxRate ?? 18)
          : 0;
      const purDiscPct = product.purchaseDiscountPercent || 0;
      const discounted = rate * (1 - purDiscPct / 100);
      const newLine: InvoiceItem = {
        id: 'pli-' + Date.now(),
        name: product.name,
        hsn: product.code || '8471',
        qty: 1,
        unit: product.purchaseUnit || product.unit || 'PCS',
        price: rate,
        discountPercent: purDiscPct,
        taxPercent: taxPct,
        amount: isTaxInclusive
          ? Math.round(discounted * 100) / 100
          : Math.round(discounted * (1 + taxPct / 100) * 100) / 100,
      };
      setLineItems((prev) => [...prev, newLine]);
      showToast(`Added ${product.name} to purchase inward`, 'success');
    }
  };

  const handlePurchaseBarcodeEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !scanInput.trim()) return;
    e.preventDefault();
    const raw = scanInput.trim();
    const matched = findItemByBarcode(inventoryItems, raw);
    if (matched) {
      recordScannedBarcode(raw, matched);
      addScannedPurchaseItem(matched);
      setScanInput('');
    } else {
      recordScannedBarcode(raw, null);
      showToast(`Barcode "${raw}" not found in catalog`, 'warning');
    }
  };

  const linesTotal = lineItems.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalAmount = Math.round(
    linesTotal + (Number(freightCharges) || 0) + (Number(packagingCharges) || 0) + (Number(otherPurchaseExpenses) || 0)
  );
  const balance = Math.max(0, totalAmount - (paidAmount || 0));

  const handleSave = (mode: 'bill' | 'draft' | 'po' = 'bill') => {
    if (!partyName.trim()) {
      showToast('Please specify a vendor/supplier name');
      return;
    }
    if (mode === 'bill' && businessSettings.transaction.purchase.requireSupplierInvoiceNo && !billNo.trim()) {
      showToast('Supplier bill / invoice number is required per Transaction -> Purchase Settings.', 'warning');
      return;
    }
    if (
      mode === 'bill' &&
      businessSettings.transaction.behaviour.preventDuplicatePurchaseBill &&
      transactions.some(
        (t) =>
          t.type === 'Purchase' &&
          !t.isCancelled &&
          t.invoiceNo.trim().toLowerCase() === billNo.trim().toLowerCase() &&
          t.partyName.trim().toLowerCase() === partyName.trim().toLowerCase()
      )
    ) {
      showToast(`Duplicate purchase bill #${billNo} for "${partyName}" is blocked in Transaction Settings.`, 'error');
      return;
    }
    if (businessSettings.party.blockTransactionsForBlockedParties) {
      const matched = parties.find((p) => p.name.toLowerCase() === partyName.trim().toLowerCase());
      if (matched?.status === 'Blocked') {
        showToast(`Purchases are blocked for "${matched.name}" (Status: Blocked).`, 'error');
        return;
      }
    }
    const status = balance === 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Unpaid';
    const parsedTags = tagsInput.split(',').map((s) => s.trim()).filter(Boolean);
    const effectiveNo =
      mode === 'po' && !billNo.startsWith('PO-')
        ? getNextDocumentNumber('Purchase Order')
        : billNo;
    const mappedLines = lineItems.map((li) => {
      const supMap = supplierItemMappings.find(
        (m) => m.supplierName.toLowerCase() === partyName.toLowerCase() && m.itemName.toLowerCase() === li.name.toLowerCase()
      );
      return {
        ...li,
        supplierSku: li.supplierSku || supMap?.supplierSku,
        ...(mode === 'po' ? { orderedQty: li.qty, receivedQty: 0 } : {}),
      };
    });

    const res = addTransaction({
      type: 'Purchase',
      invoiceNo: effectiveNo,
      date,
      dueDate,
      partyName,
      firm: company.name,
      user: 'Admin',
      paymentType,
      totalAmount,
      receivedAmount: mode === 'po' ? 0 : paidAmount,
      balance: mode === 'po' ? totalAmount : balance,
      status: mode === 'po' ? 'Unpaid' : status,
      items: mappedLines,
      freightCharges: Number(freightCharges) || 0,
      packagingCharges: Number(packagingCharges) || 0,
      otherPurchaseExpenses: Number(otherPurchaseExpenses) || 0,
      gstInputCreditEligible,
      taxableAmount: landedAnalysis.lines.reduce((s, l) => s + l.baseExTaxAmount, 0),
      workflowStatus: mode === 'draft' ? 'Draft' : mode === 'po' ? 'Pending' : 'Completed',
      fulfillmentStatus: mode === 'po' ? 'Pending' : 'Completed',
      grnStatus: mode === 'po' ? 'Not Received' : undefined,
      skipStockDeduction: mode === 'draft' || mode === 'po',
      tags: parsedTags.length > 0 ? parsedTags : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      notes: mode === 'po' ? `Purchase Order: ${notes}` : notes,
    });

    if (!res) return;

    setIsAddPurchaseOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-xs text-slate-800">
        <div className="px-5 py-3.5 bg-blue-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <h2 className="text-sm font-bold tracking-tight">Record Purchase Bill</h2>
          </div>
          <button
            onClick={() => setIsAddPurchaseOpen(false)}
            className="text-slate-300 hover:text-white p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Vendor / Supplier Name *
              </label>
              <input
                type="text"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                placeholder="Supplier name"
                list="suppliers-list"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
              />
              <datalist id="suppliers-list">
                {parties.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Bill / Ref No.
              </label>
              <input
                type="text"
                value={billNo}
                onChange={(e) => setBillNo(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Bill Date
              </label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Scan Barcode for Inward Purchase */}
          <div className="flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <Barcode className="w-4 h-4 text-blue-700 shrink-0" />
            <input
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handlePurchaseBarcodeEnter}
              placeholder="Scan barcode (USB/BT) or enter SKU & press Enter to add stock..."
              className="flex-1 min-w-[200px] bg-white border border-blue-300 rounded px-2.5 py-1.5 text-xs font-mono font-semibold focus:outline-none focus:border-blue-600"
            />
            <button
              type="button"
              onClick={() =>
                openBarcodeScanner('purchase', (matched) => {
                  if (matched) addScannedPurchaseItem(matched);
                })
              }
              className="px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>Scan Barcode</span>
            </button>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px] font-semibold">
                  <th className="py-2 px-3 w-8">#</th>
                  <th className="py-2 px-3">Item Name</th>
                  <th className="py-2 px-2 w-16 text-right">Qty</th>
                  <th className="py-2 px-2 w-20">Unit</th>
                  <th className="py-2 px-2 w-24 text-right">Rate (₹)</th>
                  <th className="py-2 px-2 w-16 text-right">Disc %</th>
                  <th className="py-2 px-2 w-20 text-right">Tax %</th>
                  {showBatchCols && <th className="py-2 px-2 w-28">Batch / Exp</th>}
                  <th className="py-2 px-2 w-24 text-right">Landed/U</th>
                  <th className="py-2 px-3 w-28 text-right">Amount (₹)</th>
                  <th className="py-2 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {lineItems.map((item, idx) => {
                  const landedLine = landedAnalysis.lines[idx];
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={item.name}
                          list="purchase-inventory-names"
                          onChange={(e) => {
                            const nextName = e.target.value;
                            const found = inventoryItems.find(
                              (inv) => inv.name.toLowerCase() === nextName.toLowerCase()
                            );
                            if (found) {
                              const updated = [...lineItems];
                              const mapped = supplierItemMappings.find(
                                (m) => m.supplierName.toLowerCase() === partyName.toLowerCase() && m.itemName.toLowerCase() === found.name.toLowerCase()
                              );
                              const rate = mapped?.agreedPrice ?? mapped?.lastQuotedPrice ?? found.lastPurchasePrice ?? found.purchasePrice ?? 0;
                              const taxPct =
                                isGstActive && found.gstApplicable !== false
                                  ? (found.purchaseTaxRate ?? found.taxRate ?? 18)
                                  : 0;
                              const purDisc = found.purchaseDiscountPercent ?? updated[idx].discountPercent ?? 0;
                              const cur = {
                                ...updated[idx],
                                name: found.name,
                                hsn: found.code || updated[idx].hsn,
                                supplierSku: mapped?.supplierSku,
                                unit: found.purchaseUnit || found.unit || updated[idx].unit,
                                price: rate,
                                discountPercent: purDisc,
                                taxPercent: taxPct,
                              };
                              const base = (cur.qty || 1) * rate;
                              const disc = base - (base * (cur.discountPercent || 0)) / 100;
                              cur.amount = isTaxInclusive
                                ? Math.round(disc * 100) / 100
                                : Math.round((disc + (disc * taxPct) / 100) * 100) / 100;
                              updated[idx] = cur;
                              setLineItems(updated);
                            } else {
                              handleItemChange(idx, 'name', nextName);
                            }
                          }}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1"
                        />
                        {item.name && (() => {
                          const cmp = compareSupplierQuotations(supplierQuotations, item.name);
                          if (cmp.quotes.length === 0) return null;
                          return (
                            <div className="text-[9px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Best RFQ: ₹{cmp.lowestRate} ({cmp.bestSupplier})</span>
                            </div>
                          );
                        })()}
                        <datalist id="purchase-inventory-names">
                          {inventoryItems.map((inv) => (
                            <option key={inv.id} value={inv.name} />
                          ))}
                        </datalist>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => handleItemChange(idx, 'qty', Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-right tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-2">
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
                              item.unit,
                            ].filter(Boolean))
                          ).map((uCode) => (
                            <option key={uCode} value={uCode}>{uCode}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => handleItemChange(idx, 'price', Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-right tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={item.discountPercent || 0}
                          onChange={(e) => handleItemChange(idx, 'discountPercent', Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-right tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={isGstActive ? item.taxPercent : 0}
                          disabled={!isGstActive}
                          onChange={(e) => handleItemChange(idx, 'taxPercent', Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded px-1 py-1 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {!isGstActive ? (
                            <option value={0}>0% (Non-GST)</option>
                          ) : (
                            Array.from(new Set([...(businessSettings.gst.defaultTaxRates || [0, 5, 12, 18, 28]), item.taxPercent || 0]))
                              .sort((a, b) => a - b)
                              .map((rate) => (
                                <option key={rate} value={rate}>{rate}%</option>
                              ))
                          )}
                        </select>
                      </td>
                      {showBatchCols && (
                        <td className="py-2 px-2 space-y-1">
                          <input
                            type="text"
                            placeholder="Batch #"
                            value={item.batchNo || ''}
                            onChange={(e) => handleItemChange(idx, 'batchNo', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px]"
                          />
                          <input
                            type="date"
                            value={item.expiryDate || ''}
                            onChange={(e) => handleItemChange(idx, 'expiryDate', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-[10px]"
                          />
                        </td>
                      )}
                      <td className="py-2 px-2 text-right font-semibold text-emerald-700 tabular-nums">
                        ₹ {(landedLine?.landedUnitCost ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900 tabular-nums">
                        ₹ {item.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={() => removeLine(idx)}
                          disabled={lineItems.length === 1}
                          className="text-slate-400 hover:text-rose-600 disabled:opacity-30 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="p-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={addLine}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 tabular-nums">
                <span>Eligible ITC: <strong className="text-emerald-700">₹ {landedAnalysis.totalItcCreditable.toLocaleString('en-IN')}</strong></span>
                <span>Extra Allocated: <strong>₹ {landedAnalysis.totalExtraExpenses.toLocaleString('en-IN')}</strong></span>
                <span>Landed Inventory Cost: <strong className="text-slate-900">₹ {landedAnalysis.totalPurchaseCost.toLocaleString('en-IN')}</strong></span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Freight / Transport (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={freightCharges}
                    onChange={(e) => setFreightCharges(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Packaging (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={packagingCharges}
                    onChange={(e) => setPackagingCharges(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Loading / Other Exp (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={otherPurchaseExpenses}
                    onChange={(e) => setOtherPurchaseExpenses(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs tabular-nums"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 mb-1">
                    <Tag className="w-3 h-3" />
                    <span>Tags</span>
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="e.g. RawMaterial, Urgent"
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 mb-1">
                    <Paperclip className="w-3 h-3" />
                    <span>Attach Bill Copy ({attachments.length})</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f || f.size > 600 * 1024) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setAttachments((p) => [
                          ...p,
                          { id: 'patt-' + Date.now(), name: f.name, mimeType: f.type, dataUrl: String(reader.result || ''), uploadedAt: new Date().toISOString() },
                        ]);
                      };
                      reader.readAsDataURL(f);
                    }}
                    className="w-full text-[10px] text-slate-600"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gstInputCreditEligible}
                  onChange={(e) => setGstInputCreditEligible(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>GST Input Tax Credit (ITC) Eligible (Uncheck if non-creditable GST adds to cost)</span>
              </label>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['Bank Transfer', 'Cheque', 'UPI', 'Cash'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentType(m)}
                      className={`py-1.5 text-center text-xs rounded border ${
                        paymentType === m ? 'bg-blue-50 border-blue-500 font-bold text-blue-700' : 'bg-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 tabular-nums">
                <span>Items Total:</span>
                <span>₹ {Math.round(linesTotal).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-600 tabular-nums">
                <span>Freight, Packaging &amp; Expenses:</span>
                <span>₹ {landedAnalysis.totalExtraExpenses.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-200">
                <span>Total Purchase Amount:</span>
                <span className="text-blue-700 tabular-nums">₹ {totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Amount Paid Now:</span>
                <input
                  type="number"
                  min="0"
                  max={totalAmount}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                  className="w-24 bg-white border border-slate-300 rounded px-2 py-0.5 text-right font-semibold tabular-nums"
                />
              </div>
              <div className="flex justify-between font-semibold text-rose-600">
                <span>Balance to Pay:</span>
                <span className="tabular-nums">₹ {balance.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsAddPurchaseOpen(false)}
            className="px-3.5 py-1.5 rounded text-slate-600 hover:bg-slate-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave('draft')}
            className="px-3.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold cursor-pointer"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSave('po')}
            className="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
          >
            Save as Purchase Order
          </button>
          <button
            type="button"
            onClick={() => handleSave('bill')}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Purchase Bill</span>
          </button>
        </div>
      </div>
    </div>
  );
};
