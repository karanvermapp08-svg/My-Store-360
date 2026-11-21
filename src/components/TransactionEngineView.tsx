import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Copy,
  GitBranch,
  History,
  Layers,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import {
  NumberResetPolicy,
  SequenceDocumentType,
  Transaction,
  TransactionWorkflowStatus,
} from '../types';
import {
  detectDuplicateTransactionFingerprint,
  diffTransactionVersions,
  formatSequenceNumber,
  validateTransactionIntegrity,
  WORKFLOW_TRANSITIONS,
} from '../utils/transactionEngine';

type EngineTab = 'numbering' | 'workflow' | 'versions' | 'templates';

const ALL_DOC_TYPES: SequenceDocumentType[] = [
  'Sales Invoice',
  'Payment Receipt',
  'Payment Out',
  'Purchase Bill',
  'Sales Return',
  'Purchase Return',
  'Estimate / Quotation',
  'Proforma Invoice',
  'Sales Order',
  'Purchase Order',
  'Delivery Challan',
  'Credit Note',
  'Debit Note',
  'Expense',
  'Other Income',
  'Journal Voucher',
  'Stock Adjustment',
  'Stock Transfer',
];

export const TransactionEngineView: React.FC = () => {
  const {
    transactions,
    items,
    parties,
    businessSettings,
    company,
    updateSequenceConfig,
    transitionTransactionStatus,
    cloneTransaction,
    reverseTransaction,
    restoreTransactionVersion,
    transactionTemplates,
    addTransactionTemplate,
    deleteTransactionTemplate,
    addTransaction,
    recurringExecutionLogs,
    retryRecurringExecution,
    runDueRecurringTransactions,
    getNextDocumentNumber,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    showToast,
    requestConfirmation,
  } = useVyapar();

  const [activeTab, setActiveTab] = useState<EngineTab>('numbering');
  const [branchPreviewCode, setBranchPreviewCode] = useState('');
  const [warehousePreviewCode, setWarehousePreviewCode] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState<'All' | TransactionWorkflowStatus>('All');
  const [selectedTxId, setSelectedTxId] = useState<string>(transactions[0]?.id || '');
  const [compareVersionA, setCompareVersionA] = useState<number>(1);
  const [tplName, setTplName] = useState('');
  const [tplType, setTplType] = useState<Transaction['type']>('Sale');
  const [tplParty, setTplParty] = useState('Cash Sale');
  const [tplAmount, setTplAmount] = useState<number>(1000);
  const [tplMode, setTplMode] = useState<Transaction['paymentType']>('UPI');

  const fyLabel = businessSettings.general.financialYearLabel || 'FY26-27';

  const integrityAudit = useMemo(() => {
    const flagged: Array<{ tx: Transaction; issuesCount: number; errors: string[]; warnings: string[] }> = [];
    let duplicateFingerprints = 0;

    transactions.slice(0, 250).forEach((tx) => {
      const check = validateTransactionIntegrity(tx, {
        items,
        parties,
        existingTransactions: transactions,
        settings: businessSettings,
        excludeId: tx.id,
      });
      const fpDup = detectDuplicateTransactionFingerprint(transactions, tx, tx.id);
      if (fpDup) duplicateFingerprints++;
      if (check.issues.length > 0 || fpDup) {
        flagged.push({
          tx,
          issuesCount: check.issues.length + (fpDup ? 1 : 0),
          errors: check.issues.filter((i) => i.severity === 'error').map((i) => i.message),
          warnings: [
            ...check.issues.filter((i) => i.severity === 'warning').map((i) => i.message),
            ...(fpDup ? [`Possible duplicate transaction matching #${fpDup.invoiceNo}`] : []),
          ],
        });
      }
    });

    return {
      totalScanned: transactions.length,
      flagged,
      duplicateFingerprints,
    };
  }, [transactions, items, parties, businessSettings]);

  const filteredWorkflowTxs = useMemo(() => {
    return transactions.filter((t) => {
      const wf: TransactionWorkflowStatus = t.workflowStatus || (t.isCancelled ? 'Cancelled' : 'Completed');
      if (workflowFilter === 'All') return true;
      return wf === workflowFilter;
    });
  }, [transactions, workflowFilter]);

  const pendingQueueCount = useMemo(
    () =>
      transactions.filter((t) => (t.workflowStatus || 'Completed') === 'Pending' || t.workflowStatus === 'Draft').length,
    [transactions]
  );

  const selectedTx = useMemo(
    () => transactions.find((t) => t.id === selectedTxId) || transactions[0] || null,
    [transactions, selectedTxId]
  );

  const linkedDocuments = useMemo(() => {
    if (!selectedTx) return [];
    const list: Array<{ relation: string; doc: Transaction }> = [];
    transactions.forEach((other) => {
      if (other.id === selectedTx.id) return;
      if (selectedTx.convertedFrom?.docId === other.id || other.linkedSaleInvoiceId === selectedTx.id) {
        list.push({ relation: 'Parent Source Document', doc: other });
      }
      if (other.convertedFrom?.docId === selectedTx.id || selectedTx.linkedSaleInvoiceId === other.id) {
        list.push({ relation: 'Converted Child Document', doc: other });
      }
      if (selectedTx.reversedByTxId === other.id || other.reversalOfTxId === selectedTx.id) {
        list.push({ relation: 'Reversal / Contra Voucher', doc: other });
      }
      if (selectedTx.splitFromTxId === other.id || other.splitFromTxId === selectedTx.id) {
        list.push({ relation: 'Split Invoice Sibling/Parent', doc: other });
      }
      if (selectedTx.originalInvoiceId === other.id || other.originalInvoiceId === selectedTx.id) {
        list.push({ relation: 'Return / Adjustment Reference', doc: other });
      }
    });
    return list;
  }, [selectedTx, transactions]);

  const versionDiffs = useMemo(() => {
    if (!selectedTx || !selectedTx.versionHistory?.length) return [];
    const targetSnap = selectedTx.versionHistory.find((v) => v.version === compareVersionA) || selectedTx.versionHistory[0];
    return diffTransactionVersions(targetSnap.snapshot, {
      invoiceNo: selectedTx.invoiceNo,
      date: selectedTx.date,
      partyName: selectedTx.partyName,
      paymentType: selectedTx.paymentType,
      totalAmount: selectedTx.totalAmount,
      receivedAmount: selectedTx.receivedAmount,
      balance: selectedTx.balance,
      status: selectedTx.status,
      workflowStatus: selectedTx.workflowStatus,
      items: selectedTx.items,
      notes: selectedTx.notes,
      subtotal: selectedTx.subtotal,
      totalDiscount: selectedTx.totalDiscount,
      shippingCharges: selectedTx.shippingCharges,
      packagingCharges: selectedTx.packagingCharges,
      otherCharges: selectedTx.otherCharges,
      adjustmentAmount: selectedTx.adjustmentAmount,
    });
  }, [selectedTx, compareVersionA]);

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim() || tplAmount <= 0) {
      showToast('Template name and positive amount are required.', 'warning');
      return;
    }
    addTransactionTemplate({
      name: tplName.trim(),
      txType: tplType,
      partyName: tplParty.trim() || 'Cash Sale',
      paymentType: tplMode,
      items: [
        {
          id: `tli-${Date.now()}`,
          name: tplName.trim(),
          hsn: '9983',
          qty: 1,
          unit: 'PCS',
          price: Number(tplAmount),
          discountPercent: 0,
          taxPercent: 0,
          amount: Number(tplAmount),
        },
      ],
      notes: `Template: ${tplName.trim()}`,
    });
    setTplName('');
  };

  const handleExecuteTemplate = (tplId: string) => {
    const tpl = transactionTemplates.find((t) => t.id === tplId);
    if (!tpl) return;
    const docTypeMap: Partial<Record<Transaction['type'], SequenceDocumentType>> = {
      Sale: 'Sales Invoice',
      Purchase: 'Purchase Bill',
      Expense: 'Expense',
      'Other Income': 'Other Income',
    };
    const nextNo = docTypeMap[tpl.txType] ? getNextDocumentNumber(docTypeMap[tpl.txType]!) : `TPL-${Date.now().toString().slice(-4)}`;
    const total = Math.round(tpl.items.reduce((s, i) => s + (i.amount || 0), 0));
    const todayStr = `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    addTransaction({
      type: tpl.txType,
      invoiceNo: nextNo,
      date: todayStr,
      dueDate: todayStr.split(',')[0],
      partyName: tpl.partyName || 'Cash Sale',
      firm: company.name,
      user: 'Template Engine',
      paymentType: tpl.paymentType,
      totalAmount: total,
      receivedAmount: tpl.paymentType === 'Credit' ? 0 : total,
      balance: tpl.paymentType === 'Credit' ? total : 0,
      status: tpl.paymentType === 'Credit' ? 'Unpaid' : 'Paid',
      items: tpl.items.map((i, idx) => ({ ...i, id: `li-${Date.now()}-${idx}` })),
      tags: tpl.tags,
      notes: tpl.notes || `Executed from template "${tpl.name}"`,
    });
  };

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-slate-950 flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Advanced Transaction Engine &amp; Governance
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            UUID sequences, multi-series numbering, approval workflow, version diff &amp; restore, dependency graph &amp; scheduled retries
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => runDueRecurringTransactions()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white font-semibold hover:opacity-90 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run Scheduled Jobs</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="px-6 py-3 bg-white/60 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 font-medium">Total Tracked Vouchers</div>
          <div className="text-lg font-bold tabular-nums mt-0.5">{transactions.length}</div>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 font-medium">Draft / Approval Queue</div>
          <div className="text-lg font-bold text-amber-600 tabular-nums mt-0.5">{pendingQueueCount}</div>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 font-medium">Integrity Flags / Duplicates</div>
          <div className="text-lg font-bold text-rose-600 tabular-nums mt-0.5">
            {integrityAudit.flagged.length} ({integrityAudit.duplicateFingerprints} dup)
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 font-medium">Saved Templates &amp; Logs</div>
          <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 tabular-nums mt-0.5">
            {transactionTemplates.length} tpl · {recurringExecutionLogs.length} runs
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-6 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0">
        {[
          { id: 'numbering', label: '1. Numbering Series Studio', icon: Sparkles },
          { id: 'workflow', label: '2. Lifecycle, Approvals & Integrity', icon: ShieldCheck },
          { id: 'versions', label: '3. Version Diff, Restore & Links', icon: History },
          { id: 'templates', label: '4. Templates & Retry Queue', icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as EngineTab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-[#8B0D1E] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* TAB 1: NUMBERING STUDIO */}
        {activeTab === 'numbering' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  All-Voucher Sequence &amp; Prefix Configuration ({fyLabel})
                </h2>
                <p className="text-[11px] text-slate-500">
                  Configure prefix, suffix, zero-padding, reset policy (FY/Monthly/Yearly), and preview branch/warehouse series codes.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={branchPreviewCode}
                  onChange={(e) => setBranchPreviewCode(e.target.value.toUpperCase())}
                  placeholder="Branch code e.g. BLR"
                  className="w-36 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-[11px]"
                />
                <input
                  type="text"
                  value={warehousePreviewCode}
                  onChange={(e) => setWarehousePreviewCode(e.target.value.toUpperCase())}
                  placeholder="Warehouse e.g. WH1"
                  className="w-36 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-2.5 px-3">Document Type</th>
                    <th className="py-2.5 px-3">Prefix</th>
                    <th className="py-2.5 px-3">Suffix</th>
                    <th className="py-2.5 px-3">Padding</th>
                    <th className="py-2.5 px-3">Next #</th>
                    <th className="py-2.5 px-3">FY Segment</th>
                    <th className="py-2.5 px-3">Reset Policy</th>
                    <th className="py-2.5 px-3">Live Preview</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ALL_DOC_TYPES.map((docType) => {
                    const existing = businessSettings.transaction.sequences.find((s) => s.docType === docType);
                    const seq = existing || {
                      docType,
                      prefix: `${docType.slice(0, 3).toUpperCase()}-`,
                      startNumber: 1,
                      nextNumber: 1,
                      suffix: '',
                      digits: 4,
                      useFinancialYear: false,
                      autoNumbering: true,
                      allowManualOverride: true,
                      preventDuplicate: true,
                      resetPolicy: 'Financial Year' as NumberResetPolicy,
                    };
                    const preview = formatSequenceNumber(seq, {
                      financialYearLabel: fyLabel,
                      branchCode: branchPreviewCode.trim() || undefined,
                      warehouseCode: warehousePreviewCode.trim() || undefined,
                    });

                    return (
                      <tr key={docType} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-semibold">{docType}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={seq.prefix}
                            onChange={(e) => updateSequenceConfig(docType, { prefix: e.target.value })}
                            className="w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[11px]"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={seq.suffix}
                            onChange={(e) => updateSequenceConfig(docType, { suffix: e.target.value })}
                            className="w-20 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[11px]"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min={1}
                            max={8}
                            value={seq.digits}
                            onChange={(e) =>
                              updateSequenceConfig(docType, { digits: Math.max(1, Math.min(8, Number(e.target.value) || 4)) })
                            }
                            className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 tabular-nums text-[11px]"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min={1}
                            value={seq.nextNumber}
                            onChange={(e) =>
                              updateSequenceConfig(docType, { nextNumber: Math.max(1, Number(e.target.value) || 1) })
                            }
                            className="w-20 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 tabular-nums text-[11px]"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="checkbox"
                            checked={seq.useFinancialYear}
                            onChange={(e) => updateSequenceConfig(docType, { useFinancialYear: e.target.checked })}
                            className="rounded text-rose-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={seq.resetPolicy || 'Never'}
                            onChange={(e) =>
                              updateSequenceConfig(docType, { resetPolicy: e.target.value as NumberResetPolicy })
                            }
                            className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]"
                          >
                            <option value="Never">Never</option>
                            <option value="Financial Year">Financial Year</option>
                            <option value="Monthly">Monthly</option>
                            <option value="Yearly">Yearly</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {preview}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: WORKFLOW, APPROVAL QUEUE & INTEGRITY */}
        {activeTab === 'workflow' && (
          <div className="space-y-5">
            {/* Integrity Scanner Summary */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-sm font-bold">Real-Time Transaction Integrity &amp; Duplicate Audit</h2>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                  Scanned {integrityAudit.totalScanned} transactions · {integrityAudit.flagged.length} item(s) flagged
                </span>
              </div>
              {integrityAudit.flagged.length === 0 ? (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>All transactions passed required-field, GSTIN, party, numeric, and duplicate-fingerprint integrity checks.</span>
                </div>
              ) : (
                <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                  {integrityAudit.flagged.slice(0, 12).map(({ tx, errors, warnings }) => (
                    <div key={tx.id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div>
                        <span className="font-mono font-bold">#{tx.invoiceNo}</span>
                        <span className="mx-1.5 text-slate-400">·</span>
                        <span className="font-semibold">{tx.partyName}</span>
                        <div className="text-rose-600 dark:text-rose-400">
                          {[...errors, ...warnings].join(' | ')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInvoice(tx);
                          setIsInvoicePreviewOpen(true);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-semibold cursor-pointer"
                      >
                        Inspect
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Workflow Status Filter & Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-sm">Transaction Lifecycle &amp; Approval Queue</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['All', 'Draft', 'Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled', 'Reversed', 'Archived'] as const).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setWorkflowFilter(st)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                          workflowFilter === st
                            ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-3">Voucher # / UUID</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Party</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3">Lifecycle State</th>
                      <th className="py-2.5 px-3">Transition</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredWorkflowTxs.slice(0, 60).map((tx) => {
                      const wf: TransactionWorkflowStatus =
                        tx.workflowStatus || (tx.isCancelled ? 'Cancelled' : 'Completed');
                      const allowedNext = WORKFLOW_TRANSITIONS[wf] || [];
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3">
                            <div className="font-mono font-bold">#{tx.invoiceNo}</div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {tx.uuid ? `${tx.uuid.slice(0, 12)}...` : tx.id} · v{tx.version || 1}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">{tx.type}</td>
                          <td className="py-2.5 px-3 font-medium">
                            {tx.partyName}
                            {tx.approvalReason && (
                              <div className="text-[10px] text-amber-600">{tx.approvalReason}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                            ₹{(tx.totalAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 font-bold">
                            <span
                              className={
                                wf === 'Completed' || wf === 'Approved'
                                  ? 'text-emerald-600'
                                  : wf === 'Pending' || wf === 'Draft'
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                              }
                            >
                              {wf}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={wf}
                              onChange={(e) => {
                                const res = transitionTransactionStatus(
                                  tx.id,
                                  e.target.value as TransactionWorkflowStatus
                                );
                                showToast(res.message, res.success ? 'success' : 'error');
                              }}
                              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]"
                            >
                              <option value={wf}>{wf}</option>
                              {allowedNext.map((nextSt) => (
                                <option key={nextSt} value={nextSt}>
                                  -&gt; {nextSt}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {wf === 'Pending' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => transitionTransactionStatus(tx.id, 'Approved', 'Approved by Admin')}
                                    title="Approve"
                                    className="px-2 py-1 rounded bg-emerald-600 text-white font-semibold text-[10px] cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => transitionTransactionStatus(tx.id, 'Rejected', 'Rejected by Admin')}
                                    title="Reject"
                                    className="px-2 py-1 rounded bg-rose-600 text-white font-semibold text-[10px] cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => cloneTransaction(tx.id)}
                                title="Clone Transaction"
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              {!tx.isReversed && !tx.isCancelled && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    requestConfirmation({
                                      title: `Reverse #${tx.invoiceNo}?`,
                                      message:
                                        'Creates a contra reversal voucher and restores inventory stock & party ledger balance.',
                                      confirmLabel: 'Reverse Voucher',
                                      variant: 'warning',
                                      onConfirm: () => {
                                        reverseTransaction(tx.id, 'Manual reversal from Transaction Engine');
                                      },
                                    })
                                  }
                                  title="Reverse Transaction"
                                  className="p-1 rounded hover:bg-amber-50 text-amber-600 cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTxId(tx.id);
                                  setActiveTab('versions');
                                }}
                                title="View Versions & Links"
                                className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-[10px] font-semibold cursor-pointer"
                              >
                                Versions
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: VERSION HISTORY, DIFF & DEPENDENCY LINKS */}
        {activeTab === 'versions' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Selector */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <label className="block font-bold text-slate-800 dark:text-white">
                Inspect Transaction Versions &amp; Dependencies
              </label>
              <select
                value={selectedTx?.id || ''}
                onChange={(e) => setSelectedTxId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
              >
                {transactions.slice(0, 120).map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.invoiceNo} ({t.type}) — {t.partyName} [v{t.version || 1}]
                  </option>
                ))}
              </select>

              {selectedTx && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">UUID:</span>
                    <span className="font-mono">{selectedTx.uuid || selectedTx.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Current Version:</span>
                    <span className="font-bold">v{selectedTx.version || 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Workflow State:</span>
                    <span className="font-bold">{selectedTx.workflowStatus || 'Completed'}</span>
                  </div>
                </div>
              )}

              {/* Dependency Graph */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <GitBranch className="w-4 h-4 text-indigo-600" />
                  <span>Document Dependency Graph ({linkedDocuments.length})</span>
                </div>
                {linkedDocuments.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    No parent/child conversions, split siblings, or contra reversals linked to this document.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {linkedDocuments.map(({ relation, doc }) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setSelectedTxId(doc.id)}
                        className="w-full text-left p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <div className="text-[10px] font-bold text-indigo-600">{relation}</div>
                        <div className="font-mono font-bold">
                          #{doc.invoiceNo} · ₹{(doc.totalAmount || 0).toLocaleString('en-IN')}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Version History & Diff */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <h3 className="text-sm font-bold">
                  Version History &amp; Comparison ({selectedTx?.versionHistory?.length || 0} snapshots)
                </h3>
                {!selectedTx?.versionHistory?.length ? (
                  <p className="text-slate-400 py-4 text-center">
                    No prior edits recorded yet. Editing or changing workflow status automatically saves immutable version snapshots.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">Compare Snapshot:</span>
                      <select
                        value={compareVersionA}
                        onChange={(e) => setCompareVersionA(Number(e.target.value))}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      >
                        {selectedTx.versionHistory.map((v) => (
                          <option key={v.version} value={v.version}>
                            v{v.version} — {new Date(v.timestamp).toLocaleString()} ({v.actor})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => restoreTransactionVersion(selectedTx.id, compareVersionA)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                      >
                        Restore v{compareVersionA}
                      </button>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 dark:bg-slate-800 font-bold">
                          <tr>
                            <th className="py-2 px-3">Field</th>
                            <th className="py-2 px-3">Snapshot v{compareVersionA}</th>
                            <th className="py-2 px-3">Current v{selectedTx.version || 1}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {versionDiffs.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="py-4 text-center text-slate-400">
                                No field differences between v{compareVersionA} and current version.
                              </td>
                            </tr>
                          ) : (
                            versionDiffs.map((d) => (
                              <tr key={d.field}>
                                <td className="py-2 px-3 font-semibold">{d.field}</td>
                                <td className="py-2 px-3 text-rose-600 font-mono">{d.before}</td>
                                <td className="py-2 px-3 text-emerald-600 font-mono font-bold">{d.after}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* State History & Activity Log */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                <h3 className="text-sm font-bold">State Transitions &amp; Activity Log</h3>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {(selectedTx?.stateHistory || []).map((st) => (
                    <div key={st.id} className="py-2 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="font-bold">
                          {st.fromStatus} -&gt; {st.toStatus}
                        </span>
                        <span className="text-slate-500 ml-2">{st.reason}</span>
                      </div>
                      <span className="text-slate-400 font-mono">
                        {st.actor} · {new Date(st.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {(selectedTx?.activityHistory || []).map((act) => (
                    <div key={act.id} className="py-2 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="font-semibold text-indigo-600">[{act.action}]</span>{' '}
                        <span>{act.details}</span>
                      </div>
                      <span className="text-slate-400 font-mono">
                        {act.actor} · {new Date(act.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TEMPLATES & SCHEDULED RETRY LOG */}
        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <h3 className="text-sm font-bold">Reusable Transaction Templates</h3>
              <form onSubmit={handleCreateTemplate} className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="Template Name (e.g. Monthly Shop Rent)"
                  className="col-span-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
                <select
                  value={tplType}
                  onChange={(e) => setTplType(e.target.value as Transaction['type'])}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="Sale">Sale Invoice</option>
                  <option value="Purchase">Purchase Bill</option>
                  <option value="Expense">Expense Voucher</option>
                  <option value="Other Income">Other Income</option>
                </select>
                <input
                  type="text"
                  value={tplParty}
                  onChange={(e) => setTplParty(e.target.value)}
                  placeholder="Party / Vendor Name"
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
                <input
                  type="number"
                  min={1}
                  value={tplAmount}
                  onChange={(e) => setTplAmount(Number(e.target.value))}
                  placeholder="Amount ₹"
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
                />
                <select
                  value={tplMode}
                  onChange={(e) => setTplMode(e.target.value as Transaction['paymentType'])}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit">Credit</option>
                </select>
                <button
                  type="submit"
                  className="col-span-2 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white font-bold cursor-pointer"
                >
                  Save Transaction Template
                </button>
              </form>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800 pt-2">
                {transactionTemplates.length === 0 ? (
                  <p className="text-slate-400 py-4 text-center">No templates saved yet.</p>
                ) : (
                  transactionTemplates.map((tpl) => {
                    const tot = tpl.items.reduce((s, i) => s + (i.amount || 0), 0);
                    return (
                      <div key={tpl.id} className="py-2 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold">{tpl.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {tpl.txType} · {tpl.partyName} · ₹{tot.toLocaleString('en-IN')} ({tpl.paymentType})
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleExecuteTemplate(tpl.id)}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                          >
                            Execute Now
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTransactionTemplate(tpl.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Scheduled Execution &amp; Retry Log</h3>
                <button
                  type="button"
                  onClick={() => runDueRecurringTransactions()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 text-white font-bold text-[10px] cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Check Due Jobs</span>
                </button>
              </div>
              {recurringExecutionLogs.length === 0 ? (
                <p className="text-slate-400 py-6 text-center">
                  No scheduled execution runs logged yet. Due recurring transactions log results and failure retries here.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                  {recurringExecutionLogs.map((log) => (
                    <div key={log.id} className="py-2 flex items-center justify-between gap-2 text-[11px]">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold">
                          {log.status === 'Success' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          )}
                          <span>{log.templateTitle}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(log.executedAt).toLocaleString()} · Retries: {log.retryCount}
                          {log.generatedInvoiceNo ? ` · Created #${log.generatedInvoiceNo}` : ''}
                        </div>
                        {log.errorMessage && (
                          <div className="text-[10px] text-rose-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>{log.errorMessage}</span>
                          </div>
                        )}
                      </div>
                      {log.status === 'Failed' && (
                        <button
                          type="button"
                          onClick={() => retryRecurringExecution(log.id)}
                          className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] cursor-pointer"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
