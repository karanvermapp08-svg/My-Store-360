import React, { useEffect, useMemo, useState } from 'react';
import { X, FileText, Plus, Trash2 } from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { InvoiceItem, QuotationStatus, Transaction } from '../../types';

interface QuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'Estimate' | 'Proforma';
  editingQuotation?: Transaction | null;
}

interface DraftQuoteLine {
  id: string;
  itemId: string;
  name: string;
  hsn: string;
  qty: number;
  unit: string;
  price: number;
  discountPercent: number;
  taxPercent: number;
}

export const QuotationModal: React.FC<QuotationModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'Estimate',
  editingQuotation = null,
}) => {
  const { parties, items, company, currentUser, createOrUpdateQuotation, showToast } = useVyapar();

  const customers = useMemo(
    () => parties.filter((p) => p.type === 'Customer' || !p.type),
    [parties]
  );

  const [docType, setDocType] = useState<'Estimate' | 'Proforma'>(defaultType);
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyEmail, setPartyEmail] = useState('');
  const [partyGstin, setPartyGstin] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
  );
  const [referenceNo, setReferenceNo] = useState('');
  const [salesperson, setSalesperson] = useState(currentUser?.name || 'Admin');
  const [shippingCharges, setShippingCharges] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [termsAndConditions, setTermsAndConditions] = useState(
    '1. Validity: 15 days from date of quotation.\n2. GST extra or inclusive as specified per line.\n3. Delivery within 2-3 working days of order confirmation.'
  );
  const [notes, setNotes] = useState('');
  const [quotationStatus, setQuotationStatus] = useState<QuotationStatus>('Draft');
  const [lines, setLines] = useState<DraftQuoteLine[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    if (editingQuotation) {
      setDocType(editingQuotation.type === 'Proforma' ? 'Proforma' : 'Estimate');
      setPartyName(editingQuotation.partyName || '');
      setPartyPhone(editingQuotation.partyPhone || '');
      setPartyEmail(editingQuotation.partyEmail || '');
      setPartyGstin(editingQuotation.partyGstin || '');
      setBillingAddress(editingQuotation.billingAddress || editingQuotation.partyAddress || '');
      setShippingAddress(editingQuotation.shippingAddress || '');
      setDueDate(
        editingQuotation.dueDate || new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
      );
      setReferenceNo(editingQuotation.referenceNo || '');
      setSalesperson(editingQuotation.salesperson || editingQuotation.user || currentUser?.name || 'Admin');
      setShippingCharges(editingQuotation.shippingCharges || 0);
      setOtherCharges(editingQuotation.otherCharges || 0);
      setOverallDiscount(editingQuotation.overallDiscount || 0);
      setTermsAndConditions(
        editingQuotation.termsAndConditions ||
          '1. Validity: 15 days from date of quotation.\n2. GST as applicable.'
      );
      setNotes(editingQuotation.notes || '');
      setQuotationStatus(editingQuotation.quotationStatus || 'Draft');
      setLines(
        (editingQuotation.items || []).map((it) => ({
          id: it.id || `ql-${Math.random().toString(36).slice(2, 7)}`,
          itemId: items.find((x) => x.name.toLowerCase() === it.name.toLowerCase())?.id || '',
          name: it.name,
          hsn: it.hsn || '',
          qty: it.qty || 1,
          unit: it.unit || 'PCS',
          price: it.price || 0,
          discountPercent: it.discountPercent || 0,
          taxPercent: it.taxPercent || 0,
        }))
      );
    } else {
      setDocType(defaultType);
      setPartyName('');
      setPartyPhone('');
      setPartyEmail('');
      setPartyGstin('');
      setBillingAddress('');
      setShippingAddress('');
      setDueDate(new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10));
      setReferenceNo('');
      setSalesperson(currentUser?.name || 'Admin');
      setShippingCharges(0);
      setOtherCharges(0);
      setOverallDiscount(0);
      setTermsAndConditions(
        '1. Validity: 15 days from date of quotation.\n2. GST extra or inclusive as specified per line.\n3. Delivery within 2-3 working days of order confirmation.'
      );
      setNotes('');
      setQuotationStatus('Draft');
      setLines([
        {
          id: `ql-${Date.now()}`,
          itemId: '',
          name: '',
          hsn: '',
          qty: 1,
          unit: 'PCS',
          price: 0,
          discountPercent: 0,
          taxPercent: 0,
        },
      ]);
    }
  }, [isOpen, editingQuotation, defaultType]);

  if (!isOpen) return null;

  const handleSelectCustomer = (name: string) => {
    setPartyName(name);
    const match = customers.find((c) => c.name === name);
    if (match) {
      setPartyPhone(match.phone || '');
      setPartyEmail(match.email || '');
      setPartyGstin(match.gstin || '');
      setBillingAddress(match.address || '');
      setShippingAddress(match.address || '');
    }
  };

  const handleSelectItem = (rowId: string, itemId: string) => {
    const it = items.find((x) => x.id === itemId);
    if (!it) return;
    setLines((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              itemId: it.id,
              name: it.name,
              hsn: it.hsnCode || '',
              unit: it.unit || 'PCS',
              price: it.salePrice || 0,
              taxPercent: it.taxRate || 0,
            }
          : row
      )
    );
  };

  const updateLine = (rowId: string, patch: Partial<DraftQuoteLine>) => {
    setLines((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `ql-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemId: '',
        name: '',
        hsn: '',
        qty: 1,
        unit: 'PCS',
        price: 0,
        discountPercent: 0,
        taxPercent: 0,
      },
    ]);
  };

  const removeLine = (rowId: string) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((r) => r.id !== rowId));
  };

  const computed = lines.map((l) => {
    const base = l.qty * l.price * (1 - (l.discountPercent || 0) / 100);
    const tax = (base * (l.taxPercent || 0)) / 100;
    return { ...l, base, tax, total: Math.round((base + tax) * 100) / 100 };
  });

  const taxableSum = Math.max(
    0,
    computed.reduce((s, r) => s + r.base, 0) - Number(overallDiscount || 0)
  );
  const gstSum = computed.reduce((s, r) => s + r.tax, 0);
  const isInter =
    Boolean(partyGstin && company.gstin) &&
    partyGstin.trim().slice(0, 2) !== company.gstin.trim().slice(0, 2);
  const rawGrand = taxableSum + gstSum + Number(shippingCharges || 0) + Number(otherCharges || 0);
  const grandTotal = Math.round(rawGrand);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName.trim()) {
      showToast('Please select or enter a Customer Name.', 'warning');
      return;
    }
    const valid = computed.filter((l) => l.name.trim() && l.qty > 0);
    if (valid.length === 0) {
      showToast('Add at least one item with quantity > 0.', 'warning');
      return;
    }

    const invoiceItems: InvoiceItem[] = valid.map((l) => ({
      id: l.id,
      name: l.name,
      hsn: l.hsn || '-',
      qty: Number(l.qty),
      unit: l.unit || 'PCS',
      price: Number(l.price),
      discountPercent: Number(l.discountPercent || 0),
      taxPercent: Number(l.taxPercent || 0),
      amount: l.total,
    }));

    const res = createOrUpdateQuotation({
      existingId: editingQuotation?.id,
      type: docType,
      partyName: partyName.trim(),
      partyPhone: partyPhone.trim() || undefined,
      partyEmail: partyEmail.trim() || undefined,
      partyGstin: partyGstin.trim().toUpperCase() || undefined,
      billingAddress: billingAddress.trim() || undefined,
      shippingAddress: shippingAddress.trim() || undefined,
      dueDate,
      referenceNo: referenceNo.trim() || undefined,
      salesperson: salesperson.trim() || undefined,
      shippingCharges: Number(shippingCharges || 0),
      otherCharges: Number(otherCharges || 0),
      overallDiscount: Number(overallDiscount || 0),
      termsAndConditions: termsAndConditions.trim() || undefined,
      notes: notes.trim() || undefined,
      items: invoiceItems,
      quotationStatus,
    });

    if (res) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-100">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#8E0E20] text-white flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingQuotation
                  ? `Create Revision v${(editingQuotation.quotationVersion || 1) + 1} — #${editingQuotation.invoiceNo}`
                  : `New ${docType === 'Proforma' ? 'Proforma Invoice' : 'Estimate / Quotation'}`}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Quotations never affect stock or accounting ledgers until converted to Sales Order or Tax Invoice
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold mb-1">Customer Name *</label>
              <input
                list="qtn-cust-list"
                value={partyName}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                placeholder="Select or enter customer"
              />
              <datalist id="qtn-cust-list">
                {customers.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Customer Phone</label>
              <input
                type="text"
                value={partyPhone}
                onChange={(e) => setPartyPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Customer Email</label>
              <input
                type="email"
                value={partyEmail}
                onChange={(e) => setPartyEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1">Customer GSTIN</label>
              <input
                type="text"
                maxLength={15}
                value={partyGstin}
                onChange={(e) => setPartyGstin(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Valid Until *</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Status</label>
              <select
                value={quotationStatus}
                onChange={(e) => setQuotationStatus(e.target.value as QuotationStatus)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
              >
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
                <option value="Expired">Expired</option>
                <option value="Modification Requested">Modification Requested</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1">Reference No / RFQ</label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Salesperson</label>
              <input
                type="text"
                value={salesperson}
                onChange={(e) => setSalesperson(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Billing Address</label>
              <input
                type="text"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="font-bold">Quoted Products &amp; Services</span>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white font-semibold text-[11px] cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-2 w-20">HSN</th>
                    <th className="py-2.5 px-2 w-20 text-right">Qty</th>
                    <th className="py-2.5 px-2 w-20">Unit</th>
                    <th className="py-2.5 px-2 w-24 text-right">Price (₹)</th>
                    <th className="py-2.5 px-2 w-16 text-right">Disc%</th>
                    <th className="py-2.5 px-2 w-16 text-right">GST%</th>
                    <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>
                    <th className="py-2.5 px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {computed.map((line) => (
                    <tr key={line.id}>
                      <td className="py-2 px-3 min-w-[210px]">
                        <select
                          value={line.itemId}
                          onChange={(e) => handleSelectItem(line.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                        >
                          <option value="">-- Select Product --</option>
                          {items.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name} (₹{it.salePrice})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={line.hsn}
                          onChange={(e) => updateLine(line.id, { hsn: e.target.value })}
                          className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-[11px]"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min={1}
                          step="any"
                          value={line.qty}
                          onChange={(e) => updateLine(line.id, { qty: Math.max(0, Number(e.target.value)) })}
                          className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-right tabular-nums font-bold"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={line.unit}
                          onChange={(e) => updateLine(line.id, { unit: e.target.value })}
                          className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={line.price}
                          onChange={(e) => updateLine(line.id, { price: Math.max(0, Number(e.target.value)) })}
                          className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-right tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="any"
                          value={line.discountPercent}
                          onChange={(e) =>
                            updateLine(line.id, { discountPercent: Math.max(0, Number(e.target.value)) })
                          }
                          className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-right tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min={0}
                          max={28}
                          step="any"
                          value={line.taxPercent}
                          onChange={(e) =>
                            updateLine(line.id, { taxPercent: Math.max(0, Number(e.target.value)) })
                          }
                          className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-right tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-bold tabular-nums">
                        ₹{line.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length <= 1}
                          className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charges, Terms & Tax Totals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1">Terms &amp; Conditions</label>
                <textarea
                  rows={3}
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Internal / Customer Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2.5">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold mb-1">Shipping (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={shippingCharges}
                    onChange={(e) => setShippingCharges(Math.max(0, Number(e.target.value)))}
                    className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-right tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold mb-1">Other Charges (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={otherCharges}
                    onChange={(e) => setOtherCharges(Math.max(0, Number(e.target.value)))}
                    className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-right tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold mb-1">Overall Disc (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={overallDiscount}
                    onChange={(e) => setOverallDiscount(Math.max(0, Number(e.target.value)))}
                    className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-right tabular-nums"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Taxable Subtotal</span>
                  <span className="font-semibold tabular-nums">₹{taxableSum.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {isInter ? 'IGST' : 'CGST + SGST'}
                  </span>
                  <span className="font-semibold tabular-nums">₹{gstSum.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-[#8E0E20] dark:text-rose-400 pt-1">
                  <span>Quoted Grand Total</span>
                  <span className="tabular-nums">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#8E0E20] hover:bg-[#740918] text-white font-bold cursor-pointer"
            >
              {editingQuotation ? 'Save New Revision' : 'Create Quotation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
