import React, { useMemo, useState } from 'react';
import {
  Plus,
  Eye,
  Trash2,
  FileDown,
  Printer,
  ScanLine,
  FileImage,
  X,
  Search,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  Tags,
  BarChart3,
  Users,
  Receipt,
  CheckCircle2,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { Transaction } from '../types';
import { runPurchaseHealthCheck } from '../utils/transactionEngine';

type PurchaseTab = 'bills' | 'statement' | 'analytics';
type GroupByMode = 'None' | 'Supplier' | 'Status' | 'Payment Mode';

export const PurchaseView: React.FC = () => {
  const {
    transactions,
    parties,
    setActiveTab,
    setIsAddPurchaseOpen,
    deleteTransaction,
    reverseTransaction,
    bulkUpdateTransactions,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    exportCurrentViewPdf,
    showToast,
  } = useVyapar();

  const [subTab, setSubTab] = useState<PurchaseTab>('bills');
  const [billPreviewTx, setBillPreviewTx] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupByMode>('None');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [reverseTarget, setReverseTarget] = useState<Transaction | null>(null);
  const [reverseReason, setReverseReason] = useState('Goods returned to supplier');
  const [healthReport, setHealthReport] = useState<ReturnType<typeof runPurchaseHealthCheck> | null>(null);

  const purchaseTransactions = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.type === 'Purchase' &&
          !t.invoiceNo.startsWith('PAYOUT-') &&
          !t.invoiceNo.startsWith('PO-')
      ),
    [transactions]
  );

  const filteredPurchases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return purchaseTransactions;
    return purchaseTransactions.filter(
      (tx) =>
        tx.invoiceNo.toLowerCase().includes(q) ||
        tx.partyName.toLowerCase().includes(q) ||
        (tx.tags || []).some((tag) => tag.toLowerCase().includes(q)) ||
        (tx.notes || '').toLowerCase().includes(q)
    );
  }, [purchaseTransactions, searchQuery]);

  const groupedPurchases = useMemo(() => {
    if (groupBy === 'None') {
      return [{ groupLabel: 'All Purchase Bills', rows: filteredPurchases }];
    }
    const groups = new Map<string, Transaction[]>();
    filteredPurchases.forEach((tx) => {
      const key =
        groupBy === 'Supplier'
          ? tx.partyName || 'Unknown Supplier'
          : groupBy === 'Status'
          ? tx.isReversed
            ? 'Reversed'
            : tx.isCancelled
            ? 'Cancelled'
            : tx.status
          : tx.paymentType || 'Other';
      const arr = groups.get(key) || [];
      arr.push(tx);
      groups.set(key, arr);
    });
    return Array.from(groups.entries()).map(([groupLabel, rows]) => ({ groupLabel, rows }));
  }, [filteredPurchases, groupBy]);

  const totalPurchase = purchaseTransactions
    .filter((t) => !t.isCancelled && !t.isReversed)
    .reduce((acc, curr) => acc + curr.totalAmount, 0);
  const totalPayable = purchaseTransactions
    .filter((t) => !t.isCancelled && !t.isReversed)
    .reduce((acc, curr) => acc + (curr.balance || 0), 0);
  const totalItcCreditable = purchaseTransactions
    .filter((t) => !t.isCancelled && !t.isReversed && t.gstInputCreditEligible !== false)
    .reduce((acc, curr) => acc + (curr.cgstAmount || 0) + (curr.sgstAmount || 0) + (curr.igstAmount || 0), 0);

  // Supplier Statement & Payment Forecast
  const supplierStatements = useMemo(() => {
    const map = new Map<
      string,
      {
        supplier: string;
        billsCount: number;
        totalBilled: number;
        totalPaid: number;
        pendingPayable: number;
        nextDueDate: string;
      }
    >();
    purchaseTransactions
      .filter((t) => !t.isCancelled && !t.isReversed)
      .forEach((tx) => {
        const key = tx.partyName || 'Unknown Supplier';
        const cur = map.get(key) || {
          supplier: key,
          billsCount: 0,
          totalBilled: 0,
          totalPaid: 0,
          pendingPayable: 0,
          nextDueDate: tx.dueDate || tx.date,
        };
        cur.billsCount += 1;
        cur.totalBilled += tx.totalAmount || 0;
        cur.totalPaid += tx.receivedAmount || 0;
        cur.pendingPayable += tx.balance || 0;
        if ((tx.balance || 0) > 0 && tx.dueDate) {
          cur.nextDueDate = tx.dueDate;
        }
        map.set(key, cur);
      });
    return Array.from(map.values()).sort((a, b) => b.pendingPayable - a.pendingPayable);
  }, [purchaseTransactions]);

  // Monthly Spend Analytics
  const monthlySpend = useMemo(() => {
    const buckets = new Map<string, { month: string; bills: number; spend: number; freight: number; itc: number }>();
    purchaseTransactions
      .filter((t) => !t.isCancelled && !t.isReversed)
      .forEach((tx) => {
        const parts = (tx.date || '').split(',')[0].split('/');
        const label = parts.length === 3 ? `${parts[1]}/${parts[2]}` : tx.date.slice(0, 7);
        const cur = buckets.get(label) || { month: label, bills: 0, spend: 0, freight: 0, itc: 0 };
        cur.bills += 1;
        cur.spend += tx.totalAmount || 0;
        cur.freight += (tx.freightCharges || 0) + (tx.packagingCharges || 0);
        cur.itc += (tx.cgstAmount || 0) + (tx.sgstAmount || 0) + (tx.igstAmount || 0);
        buckets.set(label, cur);
      });
    return Array.from(buckets.values());
  }, [purchaseTransactions]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPurchases.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPurchases.map((t) => t.id));
    }
  };

  const handleBulkAddTag = () => {
    const clean = bulkTagInput.trim();
    if (!clean || selectedIds.length === 0) return;
    const count = bulkUpdateTransactions(selectedIds, { addTag: clean });
    showToast(`Tagged ${count} purchase bill(s) with "${clean}".`, 'success');
    setBulkTagInput('');
  };

  const handleBulkCancel = () => {
    if (selectedIds.length === 0) return;
    const count = bulkUpdateTransactions(selectedIds, { cancelReason: 'Bulk cancelled in Purchase Register' });
    showToast(`Cancelled ${count} purchase bill(s).`, 'info');
    setSelectedIds([]);
  };

  const handleConfirmReverse = () => {
    if (!reverseTarget) return;
    const res = reverseTransaction(reverseTarget.id, reverseReason.trim() || 'Supplier Purchase Return');
    if (res) {
      setReverseTarget(null);
    }
  };

  const handleRunHealthCheck = () => {
    const res = runPurchaseHealthCheck(transactions, parties);
    setHealthReport(res);
    showToast(
      res.healthy
        ? `Purchase Audit Passed (${res.totalBillsChecked} bills checked).`
        : `Found ${res.duplicateBills.length} duplicate bill(s) / ${res.zeroCostPurchasesCount} zero-cost bills.`,
      res.healthy ? 'success' : 'error'
    );
  };

  return (
    <div className="flex-1 bg-[#f0f4f9] dark:bg-slate-950 p-6 overflow-y-auto space-y-5 text-xs text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Purchase Bills, Payables &amp; Spend Audit</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Manage vendor bills, returns/reversals, supplier statements, GST ITC eligibility &amp; audit diagnostics
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('purchase-scanner')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold text-xs text-white bg-[#8E0E20] hover:bg-[#740918] shadow-xs cursor-pointer whitespace-nowrap"
          >
            <ScanLine className="w-4 h-4" />
            <span>AI Scan Bill</span>
          </button>

          <button
            type="button"
            onClick={() => exportCurrentViewPdf({ title: 'Purchase Bills Register' })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 cursor-pointer whitespace-nowrap"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddPurchaseOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add Purchase</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Net Purchase Spend</span>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            ₹ {totalPurchase.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">{purchaseTransactions.length} Recorded Bills</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Open Supplier Payables</span>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
            ₹ {totalPayable.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Across {supplierStatements.filter((s) => s.pendingPayable > 0).length} vendor(s)
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Creditable Input Tax (GST ITC)</span>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
            ₹ {totalItcCreditable.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Eligible GST Input Credit</span>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        {(
          [
            { id: 'bills', label: 'Purchase Bills Register', icon: Receipt },
            { id: 'statement', label: 'Supplier Statement & Forecast', icon: Users },
            { id: 'analytics', label: 'Spend Analytics & Health Check', icon: BarChart3 },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                active
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: PURCHASE BILLS REGISTER */}
      {subTab === 'bills' && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search bill #, supplier, tags..."
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupByMode)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-semibold"
              >
                <option value="None">Group: None</option>
                <option value="Supplier">Group: Supplier</option>
                <option value="Status">Group: Status</option>
                <option value="Payment Mode">Group: Payment Mode</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportCurrentViewPdf({ title: 'Purchase Bills Register' })}
                className="px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] font-bold cursor-pointer"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                title="Print Purchases"
                className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white rounded cursor-pointer"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="px-5 py-2.5 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800 flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-blue-800 dark:text-blue-200">
                {selectedIds.length} purchase bill(s) selected
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={bulkTagInput}
                  onChange={(e) => setBulkTagInput(e.target.value)}
                  placeholder="Tag name..."
                  className="bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={handleBulkAddTag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] cursor-pointer"
                >
                  <Tags className="w-3 h-3" />
                  <span>Add Tag</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportCurrentViewPdf({ title: `Selected Purchases (${selectedIds.length})` })}
                  className="px-2.5 py-1 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 font-bold text-[11px] cursor-pointer"
                >
                  Bulk PDF
                </button>
                <button
                  type="button"
                  onClick={handleBulkCancel}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] cursor-pointer"
                >
                  Bulk Cancel
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-[11px]">
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={filteredPurchases.length > 0 && selectedIds.length === filteredPurchases.length}
                      onChange={toggleSelectAll}
                      className="accent-blue-600"
                    />
                  </th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Bill No</th>
                  <th className="py-2.5 px-3">Vendor / Supplier</th>
                  <th className="py-2.5 px-3">Payment Mode</th>
                  <th className="py-2.5 px-3 text-right">Bill Amount</th>
                  <th className="py-2.5 px-3 text-right">Balance Due</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No purchase bills match your filter. Click &quot;AI Scan Bill&quot; or &quot;Add Purchase&quot; to record a bill.
                    </td>
                  </tr>
                ) : (
                  groupedPurchases.map((grp) => (
                    <React.Fragment key={grp.groupLabel}>
                      {groupBy !== 'None' && (
                        <tr className="bg-slate-100/80 dark:bg-slate-800/80">
                          <td colSpan={9} className="py-1.5 px-4 font-bold text-[11px] text-slate-700 dark:text-slate-200">
                            {grp.groupLabel} ({grp.rows.length}) — ₹
                            {grp.rows.reduce((s, r) => s + r.totalAmount, 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      )}
                      {grp.rows.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(tx.id)}
                              onChange={() => toggleSelect(tx.id)}
                              className="accent-blue-600"
                            />
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400 tabular-nums">{tx.date}</td>
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-white font-mono">
                            {tx.invoiceNo}
                            {tx.sourceScanId && (
                              <span className="ml-1.5 text-[10px] font-sans font-semibold text-blue-600">
                                AI Scanned
                              </span>
                            )}
                            {tx.linkedPoNo && (
                              <span className="ml-1.5 text-[10px] font-sans font-semibold text-indigo-600 dark:text-indigo-400">
                                GRN:{tx.linkedPoNo}
                              </span>
                            )}
                            {tx.tags && tx.tags.length > 0 && (
                              <div className="text-[10px] font-sans font-normal text-slate-400">
                                #{tx.tags.join(' #')}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-800 dark:text-slate-200 font-medium">{tx.partyName}</td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{tx.paymentType}</td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                            ₹ {tx.totalAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-rose-600 tabular-nums">
                            ₹ {tx.balance.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3">
                            {tx.isReversed ? (
                              <span className="font-bold text-[11px] text-amber-600">Reversed</span>
                            ) : tx.isCancelled ? (
                              <span className="font-bold text-[11px] text-slate-400">Cancelled</span>
                            ) : (
                              <span
                                className={`font-semibold text-[11px] ${
                                  tx.status === 'Paid' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'
                                }`}
                              >
                                {tx.status}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {tx.attachedDocumentDataUrl && (
                                <button
                                  type="button"
                                  onClick={() => setBillPreviewTx(tx)}
                                  title="View Original Attached Bill"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                                >
                                  <FileImage className="w-3.5 h-3.5" />
                                  <span>Bill</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedInvoice(tx);
                                  setIsInvoicePreviewOpen(true);
                                }}
                                title="Preview Bill Details"
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {!tx.isReversed && !tx.isCancelled && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReverseTarget(tx);
                                    setReverseReason('Purchase return / reversal');
                                  }}
                                  title="Purchase Return / Reverse Bill"
                                  className="p-1 text-slate-400 hover:text-amber-600 cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => deleteTransaction(tx.id)}
                                title="Delete Purchase"
                                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SUPPLIER STATEMENT & PAYABLES FORECAST */}
      {subTab === 'statement' && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase text-slate-900 dark:text-white">
              Supplier Statement &amp; Due Payment Forecast
            </h2>
            <span className="text-[11px] text-slate-500">
              {supplierStatements.length} active vendor ledger(s)
            </span>
          </div>
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="py-2.5 px-4">Supplier Name</th>
                <th className="py-2.5 px-4 text-right">Bills Count</th>
                <th className="py-2.5 px-4 text-right">Total Billed</th>
                <th className="py-2.5 px-4 text-right">Total Paid</th>
                <th className="py-2.5 px-4 text-right">Pending Payable</th>
                <th className="py-2.5 px-4">Next Due Forecast</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {supplierStatements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    No supplier bill ledger data available yet.
                  </td>
                </tr>
              ) : (
                supplierStatements.map((row) => (
                  <tr key={row.supplier} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-semibold">{row.supplier}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{row.billsCount}</td>
                    <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                      ₹ {row.totalBilled.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-4 text-right text-emerald-700 dark:text-emerald-400 tabular-nums">
                      ₹ {row.totalPaid.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-rose-600 tabular-nums">
                      ₹ {row.pendingPayable.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-4 tabular-nums text-slate-500">
                      {row.pendingPayable > 0 ? row.nextDueDate : 'Settled'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: SPEND ANALYTICS & PURCHASE HEALTH CHECK */}
      {subTab === 'analytics' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Purchase Ledger Health &amp; Duplicate Bill Audit</span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Scans for duplicate supplier invoice numbers, unlinked supplier profiles &amp; zero-cost bills
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunHealthCheck}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
              >
                Run Purchase Health Check
              </button>
            </div>

            {healthReport && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Bills Audited</div>
                  <div className="text-lg font-bold tabular-nums mt-0.5">{healthReport.totalBillsChecked}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Duplicate Supplier Bills</div>
                  <div
                    className={`text-lg font-bold tabular-nums mt-0.5 ${
                      healthReport.duplicateBills.length > 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {healthReport.duplicateBills.length}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Unlinked Suppliers</div>
                  <div className="text-lg font-bold tabular-nums mt-0.5 text-amber-600">
                    {healthReport.missingSupplierPartyCount}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Zero-Cost Bills</div>
                  <div className="text-lg font-bold tabular-nums mt-0.5">
                    {healthReport.zeroCostPurchasesCount}
                  </div>
                </div>
              </div>
            )}

            {healthReport && healthReport.duplicateBills.length > 0 && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Duplicate Supplier Bill Numbers Detected:</span>
                </div>
                {healthReport.duplicateBills.map((d) => (
                  <div key={`${d.supplier}-${d.billNo}`} className="text-[11px]">
                    • Supplier &quot;{d.supplier}&quot; — Bill #{d.billNo} appears {d.count} times
                  </div>
                ))}
              </div>
            )}

            {healthReport && healthReport.healthy && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>All {healthReport.totalBillsChecked} purchase bill(s) passed duplicate &amp; cost integrity checks.</span>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase text-slate-900 dark:text-white">
                Monthly Purchase Spend &amp; Freight Breakdown
              </h3>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-2.5 px-4">Period</th>
                  <th className="py-2.5 px-4 text-right">Bills</th>
                  <th className="py-2.5 px-4 text-right">Total Spend</th>
                  <th className="py-2.5 px-4 text-right">Freight &amp; Packaging</th>
                  <th className="py-2.5 px-4 text-right">GST ITC Claimable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {monthlySpend.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      No monthly spend records available yet.
                    </td>
                  </tr>
                ) : (
                  monthlySpend.map((m) => (
                    <tr key={m.month}>
                      <td className="py-2.5 px-4 font-bold">{m.month}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{m.bills}</td>
                      <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                        ₹ {m.spend.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">
                        ₹ {m.freight.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-4 text-right text-emerald-700 dark:text-emerald-400 font-semibold tabular-nums">
                        ₹ {m.itc.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Original Attached Bill Preview Modal */}
      {billPreviewTx && billPreviewTx.attachedDocumentDataUrl && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="font-bold text-sm">
                Original Supplier Bill — #{billPreviewTx.invoiceNo} ({billPreviewTx.partyName})
              </div>
              <button
                type="button"
                onClick={() => setBillPreviewTx(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-950">
              {billPreviewTx.attachedDocumentDataUrl.startsWith('data:application/pdf') ? (
                <iframe
                  src={billPreviewTx.attachedDocumentDataUrl}
                  title="Attached Supplier PDF"
                  className="w-full h-[70vh] rounded border border-slate-200"
                />
              ) : (
                <img
                  src={billPreviewTx.attachedDocumentDataUrl}
                  alt={billPreviewTx.attachedDocumentName || 'Supplier Bill'}
                  className="max-w-full max-h-[75vh] object-contain rounded"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reverse / Return Purchase Modal */}
      {reverseTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
              <RotateCcw className="w-4 h-4" />
              <span>Reverse / Return Purchase Bill {reverseTarget.invoiceNo}?</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Creates a linked reversal / purchase return entry preserving full audit history.
            </p>
            <input
              type="text"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              placeholder="Reason for purchase return / reversal"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReverseTarget(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReverse}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
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
