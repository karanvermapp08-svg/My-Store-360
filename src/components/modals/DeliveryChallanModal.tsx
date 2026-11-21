import React, { useMemo, useState } from 'react';
import { X, Truck, Plus, Trash2, AlertTriangle, Package } from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { InvoiceItem, Transaction } from '../../types';

interface DeliveryChallanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DraftLine {
  id: string;
  itemId: string;
  name: string;
  hsn: string;
  batchNo: string;
  expiryDate: string;
  qty: number;
  unit: string;
  price: number;
  discountPercent: number;
  taxPercent: number;
}

export const DeliveryChallanModal: React.FC<DeliveryChallanModalProps> = ({ isOpen, onClose }) => {
  const { parties, items, company, createDeliveryChallan, showToast } = useVyapar();

  const customers = useMemo(
    () => parties.filter((p) => p.type === 'Customer' || !p.type),
    [parties]
  );

  const [partyName, setPartyName] = useState('Cash Sale');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyGstin, setPartyGstin] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [challanPurpose, setChallanPurpose] =
    useState<NonNullable<Transaction['challanPurpose']>>('Goods sent before billing');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
  );
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [deliveryPerson, setDeliveryPerson] = useState('');
  const [dispatchLocation, setDispatchLocation] = useState(company.address || 'Main Store');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [showPricesOnChallan, setShowPricesOnChallan] = useState(true);
  const [dispatchImmediately, setDispatchImmediately] = useState(true);
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<DraftLine[]>([
    {
      id: `dcl-${Date.now()}`,
      itemId: '',
      name: '',
      hsn: '',
      batchNo: '',
      expiryDate: '',
      qty: 1,
      unit: 'PCS',
      price: 0,
      discountPercent: 0,
      taxPercent: 0,
    },
  ]);

  if (!isOpen) return null;

  const handleSelectCustomer = (name: string) => {
    setPartyName(name);
    const match = customers.find((c) => c.name === name);
    if (match) {
      setPartyPhone(match.phone || '');
      setPartyGstin(match.gstin || '');
      setBillingAddress(match.address || '');
      setShippingAddress(match.address || '');
      setDeliveryLocation(match.address || '');
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
              batchNo: it.batchNo || '',
              expiryDate: it.expiryDate || '',
              unit: it.unit || 'PCS',
              price: it.salePrice || 0,
              taxPercent: it.taxRate || 0,
            }
          : row
      )
    );
  };

  const updateLine = (rowId: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `dcl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemId: '',
        name: '',
        hsn: '',
        batchNo: '',
        expiryDate: '',
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

  const lineSummary = lines.map((l) => {
    const itemRef = items.find((x) => x.id === l.itemId || x.name.toLowerCase() === l.name.toLowerCase());
    const availableStock = itemRef ? itemRef.stock : null;
    const base = l.qty * l.price * (1 - (l.discountPercent || 0) / 100);
    const tax = (base * (l.taxPercent || 0)) / 100;
    const total = Math.round((base + tax) * 100) / 100;
    return { ...l, availableStock, total };
  });

  const grandTotal = lineSummary.reduce((s, r) => s + r.total, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lineSummary.filter((l) => l.name.trim() && l.qty > 0);
    if (validLines.length === 0) {
      showToast('Please select at least one item with quantity > 0.', 'warning');
      return;
    }

    if (dispatchImmediately) {
      const insufficient = validLines.find(
        (l) => l.availableStock !== null && l.qty > l.availableStock
      );
      if (insufficient) {
        showToast(
          `Insufficient stock for ${insufficient.name} (Available: ${insufficient.availableStock} ${insufficient.unit}). Save as Draft or adjust quantity.`,
          'error'
        );
        return;
      }
    }

    const invoiceItems: InvoiceItem[] = validLines.map((l) => ({
      id: l.id,
      name: l.name,
      hsn: l.hsn || '-',
      qty: Number(l.qty),
      unit: l.unit || 'PCS',
      price: Number(l.price),
      discountPercent: Number(l.discountPercent || 0),
      taxPercent: Number(l.taxPercent || 0),
      amount: l.total,
      batchNo: l.batchNo || undefined,
      expiryDate: l.expiryDate || undefined,
    }));

    const created = createDeliveryChallan({
      partyName: partyName.trim() || 'Walk-in Customer',
      partyPhone: partyPhone.trim() || undefined,
      partyGstin: partyGstin.trim().toUpperCase() || undefined,
      billingAddress: billingAddress.trim() || undefined,
      shippingAddress: shippingAddress.trim() || undefined,
      challanPurpose,
      expectedDeliveryDate,
      vehicleNumber: vehicleNumber.trim() || undefined,
      transporterName: transporterName.trim() || undefined,
      deliveryPerson: deliveryPerson.trim() || undefined,
      dispatchLocation: dispatchLocation.trim() || undefined,
      deliveryLocation: deliveryLocation.trim() || undefined,
      showPricesOnChallan,
      dispatchImmediately,
      items: invoiceItems,
      notes: notes.trim() || undefined,
    });

    if (created) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#8E0E20] text-white flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Create Delivery Challan</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Dispatch goods before invoicing, track returns/damage, and convert without duplicate stock deduction
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Customer & Challan Meta */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Customer Name *
              </label>
              <input
                list="dc-customer-list"
                value={partyName}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                placeholder="Select or type customer name"
              />
              <datalist id="dc-customer-list">
                {customers.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Customer Phone
              </label>
              <input
                type="text"
                value={partyPhone}
                onChange={(e) => setPartyPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                placeholder="+91 98..."
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Customer GSTIN (Optional)
              </label>
              <input
                type="text"
                value={partyGstin}
                onChange={(e) => setPartyGstin(e.target.value.toUpperCase())}
                maxLength={15}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono uppercase"
                placeholder="29ABCDE1234F1Z5"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Challan Purpose *
              </label>
              <select
                value={challanPurpose}
                onChange={(e) => setChallanPurpose(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
              >
                <option value="Goods sent before billing">Goods sent before billing</option>
                <option value="Approval">Sent on Approval</option>
                <option value="Returnable goods">Returnable Goods</option>
                <option value="Job work">Job Work</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Expected Delivery Date
              </label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Vehicle Number
              </label>
              <input
                type="text"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono uppercase"
                placeholder="KA01AB1234"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Transporter / Carrier Name
              </label>
              <input
                type="text"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                placeholder="Own Fleet / Porter / VRL"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Delivery Person / Driver
              </label>
              <input
                type="text"
                value={deliveryPerson}
                onChange={(e) => setDeliveryPerson(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                placeholder="Driver Name"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Dispatch Location
              </label>
              <input
                type="text"
                value={dispatchLocation}
                onChange={(e) => setDispatchLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Billing Address
              </label>
              <input
                type="text"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                placeholder="Customer billing address"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Shipping / Delivery Location
              </label>
              <input
                type="text"
                value={shippingAddress}
                onChange={(e) => {
                  setShippingAddress(e.target.value);
                  setDeliveryLocation(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                placeholder="Site / godown / customer address"
              />
            </div>

            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={showPricesOnChallan}
                  onChange={(e) => setShowPricesOnChallan(e.target.checked)}
                  className="rounded text-[#8E0E20]"
                />
                <span>Show item prices on challan PDF</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={dispatchImmediately}
                  onChange={(e) => setDispatchImmediately(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span>Dispatch immediately &amp; deduct stock</span>
              </label>
            </div>
          </div>

          {/* Line Items */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-[#8E0E20]" />
                <span>Challan Goods &amp; Batches</span>
              </div>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white font-semibold text-[11px] hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900">
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-2 w-20">HSN</th>
                    <th className="py-2.5 px-2 w-24">Batch</th>
                    <th className="py-2.5 px-2 w-24 text-right">Stock</th>
                    <th className="py-2.5 px-2 w-20 text-right">Qty</th>
                    <th className="py-2.5 px-2 w-20">Unit</th>
                    <th className="py-2.5 px-2 w-24 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-2 w-16 text-right">GST%</th>
                    <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>
                    <th className="py-2.5 px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lineSummary.map((line) => {
                    const lowStockWarn =
                      dispatchImmediately && line.availableStock !== null && line.qty > line.availableStock;
                    return (
                      <tr key={line.id} className="bg-white dark:bg-slate-900">
                        <td className="py-2 px-3 min-w-[200px]">
                          <select
                            value={line.itemId}
                            onChange={(e) => handleSelectItem(line.id, e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                          >
                            <option value="">-- Select Product --</option>
                            {items.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.name} (Stock: {it.stock} {it.unit})
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
                            placeholder="HSN"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={line.batchNo}
                            onChange={(e) => updateLine(line.id, { batchNo: e.target.value })}
                            className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]"
                            placeholder="Batch"
                          />
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {line.availableStock !== null ? (
                            <span className={lowStockWarn ? 'text-rose-600 font-bold' : 'text-slate-600 dark:text-slate-400'}>
                              {line.availableStock} {line.unit}
                              {lowStockWarn && <AlertTriangle className="inline w-3 h-3 ml-1" />}
                            </span>
                          ) : (
                            '-'
                          )}
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
                            max={28}
                            step="any"
                            value={line.taxPercent}
                            onChange={(e) => updateLine(line.id, { taxPercent: Math.max(0, Number(e.target.value)) })}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes & Total */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Dispatch Remarks / Gate Pass Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                placeholder="Optional instructions for receiver or driver"
              />
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-right">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Estimated Challan Value {showPricesOnChallan ? '(Shown on PDF)' : '(Hidden on PDF)'}
              </div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
                ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#8E0E20] hover:bg-[#740918] text-white font-bold cursor-pointer whitespace-nowrap"
            >
              {dispatchImmediately ? 'Save & Dispatch Challan' : 'Save as Draft Challan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
