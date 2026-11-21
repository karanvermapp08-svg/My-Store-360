import React, { useMemo, useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  Download,
  ArrowRight,
  PackageCheck,
  FileSpreadsheet,
  Tags,
  Clock,
  CheckCircle2,
  X,
  RotateCcw,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { SupplierQuotation, Transaction } from '../types';
import { compareSupplierQuotations } from '../utils/transactionEngine';

type PoTab = 'orders' | 'rfq' | 'sku-mapping' | 'aging';

interface GrnLineDraft {
  name: string;
  ordered: number;
  alreadyReceived: number;
  pending: number;
  qtyReceived: number;
  batchNo: string;
  expiryDate: string;
}

export const PurchaseOrderView: React.FC = () => {
  const {
    transactions,
    parties,
    items,
    company,
    currentUser,
    setIsAddPurchaseOpen,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    addTransaction,
    reverseTransaction,
    getNextDocumentNumber,
    supplierQuotations,
    addSupplierQuotation,
    updateSupplierQuotationStatus,
    supplierItemMappings,
    upsertSupplierItemMapping,
    recordPoGrnReceipt,
    showToast,
    exportCurrentViewPdf,
  } = useVyapar();

  const [activeSubTab, setActiveSubTab] = useState<PoTab>('orders');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Completed'>('All');

  // GRN Modal state
  const [grnTargetPo, setGrnTargetPo] = useState<Transaction | null>(null);
  const [grnLines, setGrnLines] = useState<GrnLineDraft[]>([]);
  const [convertToBillNow, setConvertToBillNow] = useState(true);

  // Reverse PO inline modal
  const [reverseTargetPo, setReverseTargetPo] = useState<Transaction | null>(null);
  const [reverseReason, setReverseReason] = useState('Supplier cancelled / Order closed');

  // Add RFQ modal state
  const [isAddRfqOpen, setIsAddRfqOpen] = useState(false);
  const [rfqSupplier, setRfqSupplier] = useState('');
  const [rfqValidUntil, setRfqValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [rfqItemName, setRfqItemName] = useState('');
  const [rfqUnit, setRfqUnit] = useState('PCS');
  const [rfqQty, setRfqQty] = useState(10);
  const [rfqRate, setRfqRate] = useState(0);
  const [rfqTaxPercent, setRfqTaxPercent] = useState(18);
  const [rfqLeadDays, setRfqLeadDays] = useState(3);
  const [rfqNotes, setRfqNotes] = useState('');
  const [compareItemFilter, setCompareItemFilter] = useState('');

  // SKU Mapping form state
  const [mapSupplier, setMapSupplier] = useState('');
  const [mapItemId, setMapItemId] = useState('');
  const [mapSku, setMapSku] = useState('');
  const [mapAgreedPrice, setMapAgreedPrice] = useState(0);
  const [mapLeadDays, setMapLeadDays] = useState(3);
  const [mapMoq, setMapMoq] = useState(1);

  const suppliers = useMemo(() => parties.filter((p) => p.type === 'Supplier'), [parties]);

  const purchaseOrders = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.type === 'Purchase' &&
          !t.invoiceNo.startsWith('PAYOUT-') &&
          (t.invoiceNo.startsWith('PO-') ||
            t.grnStatus !== undefined ||
            t.fulfillmentStatus !== undefined ||
            t.notes?.toLowerCase().includes('purchase order'))
      ),
    [transactions]
  );

  const filteredOrders = useMemo(
    () =>
      purchaseOrders.filter((po) => {
        const matchesSearch =
          !search ||
          po.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
          po.partyName.toLowerCase().includes(search.toLowerCase());
        const isDone = po.grnStatus === 'Fully Received' || po.fulfillmentStatus === 'Completed' || po.isReversed || po.isCancelled;
        const matchesStatus =
          statusFilter === 'All' || (statusFilter === 'Pending' ? !isDone : isDone);
        return matchesSearch && matchesStatus;
      }),
    [purchaseOrders, search, statusFilter]
  );

  const openGrnModal = (po: Transaction) => {
    const lines: GrnLineDraft[] = (po.items || []).map((li) => {
      const ordered = li.orderedQty ?? li.qty;
      const alreadyReceived = li.receivedQty ?? 0;
      const pending = Math.max(0, Math.round((ordered - alreadyReceived) * 1000) / 1000);
      return {
        name: li.name,
        ordered,
        alreadyReceived,
        pending,
        qtyReceived: pending,
        batchNo: li.batchNo || '',
        expiryDate: li.expiryDate || '',
      };
    });
    setGrnTargetPo(po);
    setGrnLines(lines);
    setConvertToBillNow(true);
  };

  const handleSubmitGrn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grnTargetPo) return;
    const res = recordPoGrnReceipt(
      grnTargetPo.id,
      grnLines.map((l) => ({
        name: l.name,
        qtyReceived: Number(l.qtyReceived) || 0,
        batchNo: l.batchNo.trim() || undefined,
        expiryDate: l.expiryDate.trim() || undefined,
      })),
      convertToBillNow
    );
    if (!res.success) {
      showToast(res.message, 'error');
      return;
    }
    showToast(res.message, 'success');
    setGrnTargetPo(null);
  };

  const handleConfirmReversePo = () => {
    if (!reverseTargetPo) return;
    const rev = reverseTransaction(reverseTargetPo.id, reverseReason.trim() || 'PO Cancelled');
    if (rev) {
      setReverseTargetPo(null);
    }
  };

  const handleCreateRfq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rfqSupplier.trim() || !rfqItemName.trim() || rfqRate <= 0) {
      showToast('Select supplier, item name, and quoted rate > 0.', 'error');
      return;
    }
    const matchedItem = items.find((i) => i.name.toLowerCase() === rfqItemName.trim().toLowerCase());
    const matchedSup = suppliers.find((s) => s.name.toLowerCase() === rfqSupplier.trim().toLowerCase());
    const qty = Math.max(0.01, Number(rfqQty) || 1);
    const rate = Number(rfqRate) || 0;
    const tax = Number(rfqTaxPercent) || 0;
    const total = Math.round(qty * rate * (1 + tax / 100) * 100) / 100;

    addSupplierQuotation({
      quoteNo: `RFQ-${Date.now().toString().slice(-5)}`,
      date: new Date().toLocaleDateString('en-GB'),
      validUntil: rfqValidUntil,
      supplierName: rfqSupplier.trim(),
      supplierPhone: matchedSup?.phone || '',
      items: [
        {
          itemId: matchedItem?.id,
          itemName: rfqItemName.trim(),
          unit: rfqUnit || matchedItem?.unit || 'PCS',
          qty,
          quotedRate: rate,
          taxPercent: tax,
          leadTimeDays: Number(rfqLeadDays) || 3,
        },
      ],
      totalAmount: total,
      status: 'Open',
      notes: rfqNotes.trim() || undefined,
    });
    setCompareItemFilter(rfqItemName.trim());
    setIsAddRfqOpen(false);
    setRfqItemName('');
    setRfqRate(0);
    setRfqNotes('');
  };

  const handleConvertQuoteToPo = (q: SupplierQuotation) => {
    const poNo = getNextDocumentNumber('Purchase Order');
    const todayStr = new Date().toLocaleDateString('en-GB');
    addTransaction({
      type: 'Purchase',
      invoiceNo: poNo.startsWith('PO-') ? poNo : `PO-${poNo}`,
      date: todayStr,
      dueDate: q.validUntil || todayStr,
      partyName: q.supplierName,
      partyPhone: q.supplierPhone || '',
      firm: company.name,
      user: currentUser?.name || 'Admin',
      paymentType: 'Credit',
      totalAmount: q.totalAmount,
      receivedAmount: 0,
      balance: q.totalAmount,
      status: 'Unpaid',
      workflowStatus: 'Pending',
      grnStatus: 'Not Received',
      fulfillmentStatus: 'Pending',
      skipStockDeduction: true,
      items: q.items.map((li, idx) => ({
        id: `po-li-${Date.now()}-${idx}`,
        itemId: li.itemId,
        name: li.itemName,
        hsn: '',
        qty: li.qty,
        orderedQty: li.qty,
        receivedQty: 0,
        unit: li.unit,
        price: li.quotedRate,
        discountPercent: 0,
        taxPercent: li.taxPercent,
        amount: Math.round(li.qty * li.quotedRate * (1 + li.taxPercent / 100) * 100) / 100,
      })),
      notes: `Purchase Order from RFQ ${q.quoteNo}`,
    });
    updateSupplierQuotationStatus(q.id, 'Converted to PO');
    setActiveSubTab('orders');
    showToast(`RFQ ${q.quoteNo} converted to Purchase Order.`, 'success');
  };

  const handleSaveSkuMapping = (e: React.FormEvent) => {
    e.preventDefault();
    const item = items.find((i) => i.id === mapItemId);
    if (!mapSupplier.trim() || !item || !mapSku.trim()) {
      showToast('Select Supplier, Item, and enter Supplier SKU code.', 'error');
      return;
    }
    upsertSupplierItemMapping({
      supplierName: mapSupplier.trim(),
      itemId: item.id,
      itemName: item.name,
      supplierSku: mapSku.trim(),
      agreedPrice: Number(mapAgreedPrice) || item.purchasePrice || 0,
      lastQuotedPrice: Number(mapAgreedPrice) || item.purchasePrice || 0,
      leadTimeDays: Math.max(1, Number(mapLeadDays) || 3),
      moq: Math.max(1, Number(mapMoq) || 1),
    });
    setMapSku('');
  };

  // Price comparison calculation
  const rfqItemNames = useMemo(() => {
    const names = new Set<string>();
    supplierQuotations.forEach((q) => q.items.forEach((li) => names.add(li.itemName)));
    return Array.from(names);
  }, [supplierQuotations]);

  const activeCompareItem = compareItemFilter || rfqItemNames[0] || '';
  const priceComparison = useMemo(
    () => (activeCompareItem ? compareSupplierQuotations(supplierQuotations, activeCompareItem) : null),
    [supplierQuotations, activeCompareItem]
  );

  // PO Aging buckets
  const agingRows = useMemo(() => {
    const now = Date.now();
    return purchaseOrders
      .filter((po) => po.grnStatus !== 'Fully Received' && po.fulfillmentStatus !== 'Completed' && !po.isCancelled && !po.isReversed)
      .map((po) => {
        const createdMs = new Date(po.createdAt).getTime();
        const ageDays = Number.isNaN(createdMs) ? 0 : Math.max(0, Math.floor((now - createdMs) / 86400000));
        const orderedSum = (po.items || []).reduce((s, li) => s + (li.orderedQty ?? li.qty), 0);
        const receivedSum = (po.items || []).reduce((s, li) => s + (li.receivedQty ?? 0), 0);
        const pendingRatio = orderedSum > 0 ? Math.max(0, (orderedSum - receivedSum) / orderedSum) : 1;
        const pendingValue = Math.round(po.totalAmount * pendingRatio * 100) / 100;
        const bucket = ageDays <= 7 ? '0-7 Days' : ageDays <= 15 ? '8-15 Days' : ageDays <= 30 ? '16-30 Days' : '30+ Days';
        return { po, ageDays, orderedSum, receivedSum, pendingValue, bucket };
      });
  }, [purchaseOrders]);

  const agingSummary = useMemo(() => {
    const buckets: Record<string, number> = { '0-7 Days': 0, '8-15 Days': 0, '16-30 Days': 0, '30+ Days': 0 };
    agingRows.forEach((r) => {
      buckets[r.bucket] = (buckets[r.bucket] || 0) + r.pendingValue;
    });
    return buckets;
  }, [agingRows]);

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-slate-950 flex flex-col overflow-hidden select-none text-xs text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
            <ShoppingCart className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 dark:text-white">
                Procurement, GRN &amp; Purchase Orders
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                PO &rarr; GRN &rarr; Bill
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Manage Purchase Orders, Partial/Full GRN Receiving, Supplier RFQs, SKU Mapping &amp; PO Aging
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportCurrentViewPdf({ title: 'Purchase Orders & Procurement Summary' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddRfqOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Add RFQ</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddPurchaseOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create PO / Purchase</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center gap-1 overflow-x-auto shrink-0">
        {(
          [
            { id: 'orders', label: `Purchase Orders (${purchaseOrders.length})`, icon: ShoppingCart },
            { id: 'rfq', label: `Supplier Quotations / RFQ (${supplierQuotations.length})`, icon: FileSpreadsheet },
            { id: 'sku-mapping', label: `Supplier SKU Mapping (${supplierItemMappings.length})`, icon: Tags },
            { id: 'aging', label: `PO Aging (${agingRows.length} Open)`, icon: Clock },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: PURCHASE ORDERS & GRN */}
      {activeSubTab === 'orders' && (
        <>
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 shrink-0">
            <div className="relative w-80">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search PO #, supplier name..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Status:</span>
              {(['All', 'Pending', 'Completed'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    statusFilter === s
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">PO Number</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Supplier</th>
                  <th className="py-2.5 px-4">Receiving Progress</th>
                  <th className="py-2.5 px-4 text-right">Order Amount</th>
                  <th className="py-2.5 px-4 text-center">GRN Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <ShoppingCart className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="font-semibold text-slate-600 dark:text-slate-300">No purchase orders found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Create a Purchase Order or convert a Supplier RFQ to start GRN receiving.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((po) => {
                    const orderedQty = (po.items || []).reduce((s, li) => s + (li.orderedQty ?? li.qty), 0);
                    const receivedQty = (po.items || []).reduce((s, li) => s + (li.receivedQty ?? 0), 0);
                    const pct = orderedQty > 0 ? Math.min(100, Math.round((receivedQty / orderedQty) * 100)) : 0;
                    const grnStatus =
                      po.grnStatus || (po.fulfillmentStatus === 'Completed' ? 'Fully Received' : 'Not Received');
                    const isClosed = grnStatus === 'Fully Received' || po.isCancelled || po.isReversed;

                    return (
                      <tr key={po.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {po.invoiceNo}
                          {(po.grnReceipts?.length || 0) > 0 && (
                            <span className="ml-2 text-[10px] font-sans font-semibold text-emerald-700 dark:text-emerald-400">
                              ({po.grnReceipts?.length} GRN)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 tabular-nums">{po.date}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">{po.partyName}</td>
                        <td className="py-2.5 px-4">
                          <div className="w-36 space-y-1">
                            <div className="flex justify-between text-[10px] font-semibold tabular-nums text-slate-600 dark:text-slate-400">
                              <span>
                                {receivedQty} / {orderedQty} qty
                              </span>
                              <span>{pct}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className={`h-full ${
                                  pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-400'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white text-right tabular-nums">
                          ₹ {(po.totalAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {po.isReversed || po.isCancelled ? (
                            <span className="text-[11px] font-bold text-rose-600">Cancelled / Reversed</span>
                          ) : grnStatus === 'Fully Received' ? (
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                              Fully Received
                            </span>
                          ) : grnStatus === 'Partially Received' ? (
                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                              Partially Received
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              Pending GRN
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedInvoice(po);
                                setIsInvoicePreviewOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] cursor-pointer"
                            >
                              Preview
                            </button>
                            {!isClosed && (
                              <button
                                type="button"
                                onClick={() => openGrnModal(po)}
                                className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <PackageCheck className="w-3 h-3" />
                                <span>Receive GRN</span>
                              </button>
                            )}
                            {!po.isReversed && !po.isCancelled && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReverseTargetPo(po);
                                  setReverseReason('Supplier cancelled / PO closed');
                                }}
                                title="Reverse / Cancel PO"
                                className="p-1.5 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB 2: SUPPLIER QUOTATIONS (RFQ) */}
      {activeSubTab === 'rfq' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Rate Comparison Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                  Supplier Rate Comparison (Lowest Quote Finder)
                </h2>
              </div>
              {rfqItemNames.length > 0 && (
                <select
                  value={activeCompareItem}
                  onChange={(e) => setCompareItemFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold"
                >
                  {rfqItemNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {!priceComparison || priceComparison.quotes.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add supplier quotations for an item to compare vendor rates, lead time &amp; best supplier.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Best Supplier</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {priceComparison.bestSupplier}
                  </div>
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    ₹ {priceComparison.lowestRate.toLocaleString('en-IN')} (Lowest)
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Average Rate</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    ₹ {priceComparison.averageRate.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-400">{priceComparison.quotes.length} active quote(s)</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Highest Rate</div>
                  <div className="text-sm font-bold text-rose-600 mt-0.5 tabular-nums">
                    ₹ {priceComparison.highestRate.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Spread: ₹ {(priceComparison.highestRate - priceComparison.lowestRate).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Ranked Vendors</div>
                  <div className="mt-1 space-y-0.5">
                    {priceComparison.quotes.slice(0, 3).map((q, idx) => (
                      <div key={q.quoteNo} className="flex justify-between text-[11px] tabular-nums">
                        <span className="truncate font-medium">
                          {idx + 1}. {q.supplierName}
                        </span>
                        <span className="font-bold">₹{q.rate} ({q.leadTimeDays}d)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quotations Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-slate-900 dark:text-white">Supplier Quotations Register</h3>
              <button
                type="button"
                onClick={() => setIsAddRfqOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>New RFQ</span>
              </button>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-2.5 px-4">Quote #</th>
                  <th className="py-2.5 px-4">Supplier</th>
                  <th className="py-2.5 px-4">Items</th>
                  <th className="py-2.5 px-4">Valid Until</th>
                  <th className="py-2.5 px-4 text-right">Total Value</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {supplierQuotations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      No supplier quotations recorded yet. Click &quot;New RFQ&quot; to log vendor quotes.
                    </td>
                  </tr>
                ) : (
                  supplierQuotations.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono font-bold">{q.quoteNo}</td>
                      <td className="py-2.5 px-4 font-semibold">{q.supplierName}</td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                        {q.items.map((i) => `${i.itemName} (${i.qty} ${i.unit} @ ₹${i.quotedRate})`).join(', ')}
                      </td>
                      <td className="py-2.5 px-4 tabular-nums">{q.validUntil}</td>
                      <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                        ₹ {q.totalAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-[11px]">
                        <span
                          className={
                            q.status === 'Converted to PO'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : q.status === 'Expired'
                              ? 'text-rose-600'
                              : 'text-indigo-600 dark:text-indigo-400'
                          }
                        >
                          {q.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {q.status !== 'Converted to PO' && (
                            <button
                              type="button"
                              onClick={() => handleConvertQuoteToPo(q)}
                              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>Convert to PO</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          {q.status === 'Open' && (
                            <button
                              type="button"
                              onClick={() => updateSupplierQuotationStatus(q.id, 'Expired')}
                              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold cursor-pointer"
                            >
                              Expire
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SUPPLIER SKU MAPPING */}
      {activeSubTab === 'sku-mapping' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <form
            onSubmit={handleSaveSkuMapping}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
          >
            <h3 className="text-xs font-bold uppercase text-slate-900 dark:text-white">
              Bind Supplier Catalog SKU &amp; Agreed Rate
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Supplier *</label>
                <input
                  type="text"
                  list="po-supplier-list"
                  value={mapSupplier}
                  onChange={(e) => setMapSupplier(e.target.value)}
                  placeholder="Supplier name"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs"
                />
                <datalist id="po-supplier-list">
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Catalog Item *</label>
                <select
                  value={mapItemId}
                  onChange={(e) => {
                    setMapItemId(e.target.value);
                    const found = items.find((i) => i.id === e.target.value);
                    if (found) setMapAgreedPrice(found.purchasePrice || 0);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs"
                >
                  <option value="">Select Item...</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Supplier SKU *</label>
                <input
                  type="text"
                  value={mapSku}
                  onChange={(e) => setMapSku(e.target.value)}
                  placeholder="VEN-SKU-01"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Agreed Rate (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={mapAgreedPrice}
                  onChange={(e) => setMapAgreedPrice(Number(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Lead Time (Days) / MOQ</label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min="1"
                    value={mapLeadDays}
                    onChange={(e) => setMapLeadDays(Number(e.target.value) || 1)}
                    title="Lead Time Days"
                    className="w-1/2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs tabular-nums"
                  />
                  <input
                    type="number"
                    min="1"
                    value={mapMoq}
                    onChange={(e) => setMapMoq(Number(e.target.value) || 1)}
                    title="Min Order Qty"
                    className="w-1/2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs tabular-nums"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
                >
                  Save Mapping
                </button>
              </div>
            </div>
          </form>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-2.5 px-4">Supplier</th>
                  <th className="py-2.5 px-4">Item Name</th>
                  <th className="py-2.5 px-4">Supplier SKU</th>
                  <th className="py-2.5 px-4 text-right">Agreed Rate</th>
                  <th className="py-2.5 px-4 text-right">Lead Time</th>
                  <th className="py-2.5 px-4 text-right">MOQ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {supplierItemMappings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      No supplier SKU mappings configured yet.
                    </td>
                  </tr>
                ) : (
                  supplierItemMappings.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-semibold">{m.supplierName}</td>
                      <td className="py-2.5 px-4">{m.itemName}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {m.supplierSku}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                        ₹ {m.agreedPrice.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{m.leadTimeDays} days</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{m.moq}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PO AGING */}
      {activeSubTab === 'aging' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(agingSummary).map(([bucket, val]) => (
              <div
                key={bucket}
                className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800"
              >
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{bucket} Pending</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                  ₹ {val.toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-2.5 px-4">PO Number</th>
                  <th className="py-2.5 px-4">Supplier</th>
                  <th className="py-2.5 px-4 text-right">Age (Days)</th>
                  <th className="py-2.5 px-4 text-right">Received / Ordered</th>
                  <th className="py-2.5 px-4 text-right">Unreceived Value</th>
                  <th className="py-2.5 px-4">Bucket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {agingRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      All purchase orders are fully received.
                    </td>
                  </tr>
                ) : (
                  agingRows.map(({ po, ageDays, orderedSum, receivedSum, pendingValue, bucket }) => (
                    <tr key={po.id}>
                      <td className="py-2.5 px-4 font-mono font-bold">{po.invoiceNo}</td>
                      <td className="py-2.5 px-4 font-semibold">{po.partyName}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-bold">{ageDays}d</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">
                        {receivedSum} / {orderedSum}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                        ₹ {pendingValue.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-600 dark:text-slate-300">{bucket}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GRN RECEIVING MODAL */}
      {grnTargetPo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSubmitGrn}
            className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Receive Goods (GRN) — {grnTargetPo.invoiceNo} ({grnTargetPo.partyName})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setGrnTargetPo(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold">
                  <tr>
                    <th className="py-2 px-3">Item</th>
                    <th className="py-2 px-3 text-right">Ordered / Rec</th>
                    <th className="py-2 px-3 text-right">Receive Now</th>
                    <th className="py-2 px-3">Batch #</th>
                    <th className="py-2 px-3">Expiry Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {grnLines.map((line, idx) => (
                    <tr key={line.name}>
                      <td className="py-2 px-3 font-semibold">{line.name}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-500">
                        {line.ordered} / {line.alreadyReceived} (Pend: {line.pending})
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          max={line.pending}
                          step="any"
                          value={line.qtyReceived}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(line.pending, Number(e.target.value) || 0));
                            setGrnLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, qtyReceived: val } : l))
                            );
                          }}
                          className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-right font-bold tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={line.batchNo}
                          onChange={(e) =>
                            setGrnLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, batchNo: e.target.value } : l))
                            )
                          }
                          placeholder="Optional Batch"
                          className="w-28 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono text-[11px]"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="date"
                          value={line.expiryDate}
                          onChange={(e) =>
                            setGrnLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, expiryDate: e.target.value } : l))
                            )
                          }
                          className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-[11px]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <label className="flex items-center gap-2 pt-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={convertToBillNow}
                  onChange={(e) => setConvertToBillNow(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600"
                />
                <span>Convert Received Quantities directly into a Purchase Bill (updates Inventory &amp; Payables)</span>
              </label>
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setGrnTargetPo(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm GRN Receipt</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD RFQ MODAL */}
      {isAddRfqOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateRfq}
            className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-bold text-sm">Record Supplier Quotation (RFQ)</span>
              <button
                type="button"
                onClick={() => setIsAddRfqOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Supplier *</label>
                  <input
                    type="text"
                    list="rfq-sup-list"
                    required
                    value={rfqSupplier}
                    onChange={(e) => setRfqSupplier(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5"
                  />
                  <datalist id="rfq-sup-list">
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Valid Until *</label>
                  <input
                    type="date"
                    required
                    value={rfqValidUntil}
                    onChange={(e) => setRfqValidUntil(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Item Name *</label>
                  <input
                    type="text"
                    list="rfq-item-list"
                    required
                    value={rfqItemName}
                    onChange={(e) => {
                      setRfqItemName(e.target.value);
                      const m = items.find((it) => it.name.toLowerCase() === e.target.value.toLowerCase());
                      if (m) {
                        setRfqUnit(m.unit || 'PCS');
                        setRfqTaxPercent(m.taxRate || 0);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5"
                  />
                  <datalist id="rfq-item-list">
                    {items.map((it) => (
                      <option key={it.id} value={it.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Unit &amp; Qty</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={rfqQty}
                      onChange={(e) => setRfqQty(Number(e.target.value) || 1)}
                      className="w-2/3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 tabular-nums"
                    />
                    <input
                      type="text"
                      value={rfqUnit}
                      onChange={(e) => setRfqUnit(e.target.value)}
                      className="w-1/3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Quoted Rate (₹) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={rfqRate}
                    onChange={(e) => setRfqRate(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">GST %</label>
                  <input
                    type="number"
                    min="0"
                    max="28"
                    value={rfqTaxPercent}
                    onChange={(e) => setRfqTaxPercent(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={rfqLeadDays}
                    onChange={(e) => setRfqLeadDays(Number(e.target.value) || 1)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Notes</label>
                <input
                  type="text"
                  value={rfqNotes}
                  onChange={(e) => setRfqNotes(e.target.value)}
                  placeholder="Delivery terms / freight notes"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5"
                />
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddRfqOpen(false)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
              >
                Save Quotation
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REVERSE PO MODAL */}
      {reverseTargetPo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Reverse / Cancel PO {reverseTargetPo.invoiceNo}?</span>
            </div>
            <input
              type="text"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              placeholder="Cancellation reason"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReverseTargetPo(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Keep PO
              </button>
              <button
                type="button"
                onClick={handleConfirmReversePo}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
