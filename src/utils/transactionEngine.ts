import {
  BusinessSettingsBundle,
  ExtendedPaymentMode,
  InvoiceItem,
  InvoiceNumberSequenceConfig,
  Item,
  NumberResetPolicy,
  Party,
  PaymentLimitsConfig,
  SequenceDocumentType,
  SplitPaymentPart,
  SupplierQuotation,
  Transaction,
  TransactionVersionSnapshot,
  TransactionWorkflowStatus,
} from '../types';
import { validateGSTIN } from './erpEngine';

// ==========================================
// 5,001 - 5,100: ADVANCED TRANSACTION ENGINE
// ==========================================

export function generateTransactionUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const seg = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${seg()}${seg()}-${seg()}-4${seg().slice(1)}-${((8 + Math.floor(Math.random() * 4)).toString(16))}${seg().slice(1)}-${seg()}${seg()}${seg()}`;
}

export function getResetPeriodKey(policy: NumberResetPolicy | undefined, financialYearLabel: string, now = new Date()): string {
  if (!policy || policy === 'Never') return 'NEVER';
  if (policy === 'Financial Year') return `FY:${financialYearLabel || 'FY26-27'}`;
  if (policy === 'Monthly') return `M:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (policy === 'Yearly') return `Y:${now.getFullYear()}`;
  return 'NEVER';
}

export function formatSequenceNumber(
  seq: InvoiceNumberSequenceConfig,
  options?: {
    financialYearLabel?: string;
    branchCode?: string;
    warehouseCode?: string;
    overrideSequenceNumber?: number;
  }
): string {
  const fyLabel = (options?.financialYearLabel || 'FY26-27').replace(/\s+/g, '');
  const branchSeg = options?.branchCode
    ? `${seq.branchPrefixes?.[options.branchCode] || options.branchCode}/`
    : '';
  const whSeg = options?.warehouseCode
    ? `${seq.warehousePrefixes?.[options.warehouseCode] || options.warehouseCode}/`
    : '';
  const fySegment = seq.useFinancialYear ? `${fyLabel}/` : '';
  const numVal = options?.overrideSequenceNumber ?? seq.nextNumber ?? seq.startNumber ?? 1;
  const numStr = String(Math.max(1, numVal)).padStart(Math.max(1, seq.digits || 4), '0');
  return `${seq.prefix}${branchSeg}${whSeg}${fySegment}${numStr}${seq.suffix || ''}`;
}

export function detectDuplicateNumber(
  transactions: Transaction[],
  invoiceNo: string,
  txType: Transaction['type'],
  excludeId?: string
): Transaction | undefined {
  const clean = invoiceNo.trim().toLowerCase();
  if (!clean) return undefined;
  return transactions.find(
    (t) =>
      t.id !== excludeId &&
      !t.isCancelled &&
      t.type === txType &&
      t.invoiceNo.trim().toLowerCase() === clean
  );
}

export function detectDuplicateTransactionFingerprint(
  transactions: Transaction[],
  candidate: {
    type: Transaction['type'];
    partyName: string;
    totalAmount: number;
    date: string;
    invoiceNo?: string;
  },
  excludeId?: string
): Transaction | undefined {
  const targetDate = (candidate.date || '').split(',')[0].trim();
  const targetParty = (candidate.partyName || '').trim().toLowerCase();
  const targetAmt = Math.round((Number(candidate.totalAmount) || 0) * 100) / 100;
  return transactions.find((t) => {
    if (t.id === excludeId || t.isCancelled || t.isReversed) return false;
    if (t.type !== candidate.type) return false;
    const tDate = (t.date || '').split(',')[0].trim();
    const tParty = (t.partyName || '').trim().toLowerCase();
    const tAmt = Math.round((Number(t.totalAmount) || 0) * 100) / 100;
    return tDate === targetDate && tParty === targetParty && Math.abs(tAmt - targetAmt) < 0.01;
  });
}

export interface TransactionValidationIssue {
  code: string;
  severity: 'error' | 'warning';
  field: string;
  message: string;
}

export function validateTransactionIntegrity(
  tx: Partial<Transaction>,
  context: {
    items: Item[];
    parties: Party[];
    existingTransactions: Transaction[];
    settings: BusinessSettingsBundle;
    excludeId?: string;
  }
): { valid: boolean; issues: TransactionValidationIssue[] } {
  const issues: TransactionValidationIssue[] = [];

  if (!tx.invoiceNo || !tx.invoiceNo.trim()) {
    issues.push({ code: 'REQ_DOC_NO', severity: 'error', field: 'invoiceNo', message: 'Document number is required.' });
  }
  if (!tx.date || !tx.date.trim()) {
    issues.push({ code: 'REQ_DATE', severity: 'error', field: 'date', message: 'Transaction date is required.' });
  }
  if (!tx.partyName || !tx.partyName.trim()) {
    issues.push({ code: 'REQ_PARTY', severity: 'error', field: 'partyName', message: 'Party / Account name is required.' });
  }

  const totalAmt = Number(tx.totalAmount ?? 0);
  if (Number.isNaN(totalAmt) || totalAmt < 0) {
    issues.push({ code: 'NUM_TOTAL', severity: 'error', field: 'totalAmount', message: 'Total amount must be a valid non-negative number.' });
  }
  const recAmt = Number(tx.receivedAmount ?? 0);
  if (Number.isNaN(recAmt) || recAmt < 0) {
    issues.push({ code: 'NUM_PAID', severity: 'error', field: 'receivedAmount', message: 'Paid/received amount cannot be negative.' });
  }

  if (tx.partyGstin && !validateGSTIN(tx.partyGstin)) {
    issues.push({ code: 'INVALID_GSTIN', severity: 'warning', field: 'partyGstin', message: `GSTIN "${tx.partyGstin}" does not match standard 15-character format.` });
  }

  if (tx.partyName && tx.partyName !== 'Cash Sale') {
    const matchedParty = context.parties.find((p) => p.name.toLowerCase() === tx.partyName!.toLowerCase());
    if (matchedParty?.status === 'Blocked') {
      issues.push({ code: 'PARTY_BLOCKED', severity: 'error', field: 'partyName', message: `Party "${matchedParty.name}" is Blocked.` });
    }
    if (matchedParty?.status === 'Inactive') {
      issues.push({ code: 'PARTY_INACTIVE', severity: 'warning', field: 'partyName', message: `Party "${matchedParty.name}" is marked Inactive.` });
    }
  }

  if (tx.invoiceNo && tx.type) {
    const dupNo = detectDuplicateNumber(context.existingTransactions, tx.invoiceNo, tx.type, context.excludeId);
    if (dupNo) {
      issues.push({ code: 'DUP_NUMBER', severity: 'warning', field: 'invoiceNo', message: `Document #${tx.invoiceNo} already exists for ${tx.type}.` });
    }
  }

  if (tx.items && tx.items.length > 0) {
    tx.items.forEach((line, idx) => {
      if (!line.name || !line.name.trim()) {
        issues.push({ code: 'REQ_ITEM_NAME', severity: 'error', field: `items[${idx}].name`, message: `Line ${idx + 1}: Item name is required.` });
      }
      if ((Number(line.qty) || 0) <= 0) {
        issues.push({ code: 'INVALID_QTY', severity: 'error', field: `items[${idx}].qty`, message: `Line ${idx + 1}: Quantity must be greater than 0.` });
      }
      if ((Number(line.price) || 0) < 0) {
        issues.push({ code: 'INVALID_RATE', severity: 'error', field: `items[${idx}].price`, message: `Line ${idx + 1}: Rate cannot be negative.` });
      }
      if ((Number(line.discountPercent) || 0) < 0 || (Number(line.discountPercent) || 0) > 100) {
        issues.push({ code: 'INVALID_DISC', severity: 'error', field: `items[${idx}].discountPercent`, message: `Line ${idx + 1}: Discount % must be between 0 and 100.` });
      }
      if ((Number(line.taxPercent) || 0) < 0 || (Number(line.taxPercent) || 0) > 50) {
        issues.push({ code: 'INVALID_TAX', severity: 'warning', field: `items[${idx}].taxPercent`, message: `Line ${idx + 1}: Unusual GST rate (${line.taxPercent}%).` });
      }
    });
  }

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    issues,
  };
}

export const WORKFLOW_TRANSITIONS: Record<TransactionWorkflowStatus, TransactionWorkflowStatus[]> = {
  Draft: ['Pending', 'Approved', 'Completed', 'Cancelled', 'Archived'],
  Pending: ['Approved', 'Rejected', 'Draft', 'Completed', 'Cancelled'],
  Approved: ['Completed', 'Cancelled', 'Reversed', 'Archived'],
  Rejected: ['Draft', 'Pending', 'Archived'],
  Completed: ['Reversed', 'Cancelled', 'Archived'],
  Cancelled: ['Draft', 'Archived'],
  Reversed: ['Archived'],
  Archived: ['Draft'],
};

export function canTransitionWorkflowState(
  from: TransactionWorkflowStatus,
  to: TransactionWorkflowStatus
): boolean {
  if (from === to) return true;
  return (WORKFLOW_TRANSITIONS[from] || []).includes(to);
}

export function createTransactionSnapshot(
  tx: Transaction,
  actor: string,
  reason: string
): TransactionVersionSnapshot {
  return {
    version: (tx.version || 1),
    timestamp: new Date().toISOString(),
    actor,
    reason,
    snapshot: {
      invoiceNo: tx.invoiceNo,
      date: tx.date,
      partyName: tx.partyName,
      paymentType: tx.paymentType,
      totalAmount: tx.totalAmount,
      receivedAmount: tx.receivedAmount,
      balance: tx.balance,
      status: tx.status,
      workflowStatus: tx.workflowStatus || 'Completed',
      items: (tx.items || []).map((it) => ({ ...it })),
      notes: tx.notes,
      subtotal: tx.subtotal,
      totalDiscount: tx.totalDiscount,
      shippingCharges: tx.shippingCharges,
      packagingCharges: tx.packagingCharges,
      otherCharges: tx.otherCharges,
      adjustmentAmount: tx.adjustmentAmount,
    },
  };
}

export function diffTransactionVersions(
  vA: TransactionVersionSnapshot['snapshot'],
  vB: TransactionVersionSnapshot['snapshot']
): Array<{ field: string; before: string; after: string }> {
  const diffs: Array<{ field: string; before: string; after: string }> = [];
  const check = (field: string, a: unknown, b: unknown) => {
    const sA = String(a ?? '');
    const sB = String(b ?? '');
    if (sA !== sB) diffs.push({ field, before: sA, after: sB });
  };
  check('Invoice No', vA.invoiceNo, vB.invoiceNo);
  check('Date', vA.date, vB.date);
  check('Party', vA.partyName, vB.partyName);
  check('Payment Mode', vA.paymentType, vB.paymentType);
  check('Total Amount (₹)', vA.totalAmount, vB.totalAmount);
  check('Received Amount (₹)', vA.receivedAmount, vB.receivedAmount);
  check('Balance (₹)', vA.balance, vB.balance);
  check('Status', vA.status, vB.status);
  check('Workflow', vA.workflowStatus || 'Completed', vB.workflowStatus || 'Completed');
  check('Items Count', vA.items?.length || 0, vB.items?.length || 0);
  check('Shipping (₹)', vA.shippingCharges || 0, vB.shippingCharges || 0);
  check('Packaging (₹)', vA.packagingCharges || 0, vB.packagingCharges || 0);
  check('Adjustment (₹)', vA.adjustmentAmount || 0, vB.adjustmentAmount || 0);
  return diffs;
}

// ==========================================
// 5,101 - 5,200: INVOICE & BILLING HELPERS
// ==========================================

export function buildSplitInvoiceItems(
  items: InvoiceItem[],
  splitRatioPercent = 50
): { partA: InvoiceItem[]; partB: InvoiceItem[] } {
  const ratio = Math.min(90, Math.max(10, splitRatioPercent)) / 100;
  const partA: InvoiceItem[] = [];
  const partB: InvoiceItem[] = [];

  if (items.length >= 2 && splitRatioPercent === 50) {
    const mid = Math.ceil(items.length / 2);
    return {
      partA: items.slice(0, mid).map((i, idx) => ({ ...i, id: `${i.id}-a-${idx}` })),
      partB: items.slice(mid).map((i, idx) => ({ ...i, id: `${i.id}-b-${idx}` })),
    };
  }

  items.forEach((it, idx) => {
    const qtyA = Math.max(0.001, Math.round(it.qty * ratio * 1000) / 1000);
    const qtyB = Math.max(0.001, Math.round((it.qty - qtyA) * 1000) / 1000);
    const unitAmt = it.qty > 0 ? it.amount / it.qty : it.price;
    partA.push({ ...it, id: `${it.id}-sa-${idx}`, qty: qtyA, amount: Math.round(unitAmt * qtyA * 100) / 100 });
    partB.push({ ...it, id: `${it.id}-sb-${idx}`, qty: qtyB, amount: Math.round(unitAmt * qtyB * 100) / 100 });
  });
  return { partA, partB };
}

export function buildUpiPaymentQrPayload(params: {
  upiId: string;
  payeeName: string;
  amount: number;
  invoiceNo: string;
}): string {
  const vpa = params.upiId?.trim() || 'merchant@upi';
  const pn = encodeURIComponent(params.payeeName || 'Business Manager 360');
  const am = Math.max(0, Number(params.amount) || 0).toFixed(2);
  const tn = encodeURIComponent(`Invoice ${params.invoiceNo}`);
  return `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
}

// ==========================================
// 5,201 - 5,300: ADVANCED PAYMENT ENGINE
// ==========================================

export const DEFAULT_PAYMENT_LIMITS: PaymentLimitsConfig = {
  cashSingleTxLimit: 200000, // Section 269ST IT Act default ₹2L awareness
  bankSingleTxLimit: 5000000,
  userDailyLimit: 500000,
  branchDailyLimit: 1500000,
  requireApprovalAboveLimit: true,
};

export function evaluatePaymentLimits(params: {
  amount: number;
  mode: ExtendedPaymentMode;
  splitParts?: SplitPaymentPart[];
  limits: PaymentLimitsConfig;
  userDailyTotalSoFar?: number;
}): { exceedsLimit: boolean; requiresApproval: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const amt = Number(params.amount) || 0;
  const parts =
    params.mode === 'Mixed/Split' && params.splitParts?.length
      ? params.splitParts
      : [{ id: 'single', mode: params.mode === 'Mixed/Split' ? 'Cash' : params.mode, amount: amt }];

  const cashAmt = parts.filter((p) => p.mode === 'Cash').reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const bankAmt = parts.filter((p) => p.mode !== 'Cash').reduce((s, p) => s + (Number(p.amount) || 0), 0);

  if (params.limits.cashSingleTxLimit > 0 && cashAmt > params.limits.cashSingleTxLimit) {
    reasons.push(`Cash component (₹${cashAmt.toLocaleString('en-IN')}) exceeds cash limit of ₹${params.limits.cashSingleTxLimit.toLocaleString('en-IN')}`);
  }
  if (params.limits.bankSingleTxLimit > 0 && bankAmt > params.limits.bankSingleTxLimit) {
    reasons.push(`Bank/Digital component (₹${bankAmt.toLocaleString('en-IN')}) exceeds limit of ₹${params.limits.bankSingleTxLimit.toLocaleString('en-IN')}`);
  }
  const projectedDaily = (params.userDailyTotalSoFar || 0) + amt;
  if (params.limits.userDailyLimit > 0 && projectedDaily > params.limits.userDailyLimit) {
    reasons.push(`Daily user payment total (₹${projectedDaily.toLocaleString('en-IN')}) exceeds ₹${params.limits.userDailyLimit.toLocaleString('en-IN')}`);
  }

  return {
    exceedsLimit: reasons.length > 0,
    requiresApproval: reasons.length > 0 && params.limits.requireApprovalAboveLimit,
    reasons,
  };
}

export function calculatePaymentAllocationBreakdown(params: {
  paymentAmount: number;
  allocations: Array<{ invoiceId: string; invoiceTotalPending: number; allocatedAmount: number }>;
  writeOffShortfall?: boolean;
}) {
  const paid = Math.max(0, Number(params.paymentAmount) || 0);
  const totalAllocated = params.allocations.reduce((s, a) => s + Math.max(0, Number(a.allocatedAmount) || 0), 0);
  const totalPendingOnSelected = params.allocations.reduce((s, a) => s + Math.max(0, Number(a.invoiceTotalPending) || 0), 0);
  const excessAdvance = Math.max(0, Math.round((paid - totalAllocated) * 100) / 100);
  const shortFall = Math.max(0, Math.round((totalPendingOnSelected - paid) * 100) / 100);
  const writeOffAmount = params.writeOffShortfall ? shortFall : 0;

  return {
    paid: Math.round(paid * 100) / 100,
    totalAllocated: Math.round(totalAllocated * 100) / 100,
    excessAdvance,
    shortFall,
    writeOffAmount,
  };
}

export function mapExtendedModeToTxPaymentType(mode: ExtendedPaymentMode): Transaction['paymentType'] {
  if (mode === 'Cash') return 'Cash';
  if (mode === 'UPI' || mode === 'Wallet') return 'UPI';
  if (mode === 'Cheque' || mode === 'Demand Draft') return 'Cheque';
  return 'Bank Transfer';
}

// ==========================================
// 5,301 - 5,400: ADVANCED PURCHASE SYSTEM
// ==========================================

export function compareSupplierQuotations(
  quotations: SupplierQuotation[],
  itemName: string
): {
  itemName: string;
  quotes: Array<{ supplierName: string; quoteNo: string; rate: number; leadTimeDays: number; date: string }>;
  lowestRate: number;
  highestRate: number;
  averageRate: number;
  bestSupplier: string | null;
} {
  const target = itemName.trim().toLowerCase();
  const matchedQuotes: Array<{ supplierName: string; quoteNo: string; rate: number; leadTimeDays: number; date: string }> = [];

  quotations.forEach((q) => {
    if (q.status === 'Expired') return;
    q.items.forEach((line) => {
      if (line.itemName.trim().toLowerCase() === target) {
        matchedQuotes.push({
          supplierName: q.supplierName,
          quoteNo: q.quoteNo,
          rate: Number(line.quotedRate) || 0,
          leadTimeDays: Number(line.leadTimeDays) || 3,
          date: q.date,
        });
      }
    });
  });

  if (matchedQuotes.length === 0) {
    return { itemName, quotes: [], lowestRate: 0, highestRate: 0, averageRate: 0, bestSupplier: null };
  }

  matchedQuotes.sort((a, b) => a.rate - b.rate);
  const sum = matchedQuotes.reduce((s, q) => s + q.rate, 0);
  return {
    itemName,
    quotes: matchedQuotes,
    lowestRate: matchedQuotes[0].rate,
    highestRate: matchedQuotes[matchedQuotes.length - 1].rate,
    averageRate: Math.round((sum / matchedQuotes.length) * 100) / 100,
    bestSupplier: matchedQuotes[0].supplierName,
  };
}

export function runPurchaseHealthCheck(transactions: Transaction[], parties: Party[]) {
  const purchases = transactions.filter((t) => t.type === 'Purchase' && !t.isCancelled && !t.invoiceNo.startsWith('PAYOUT-') && !t.invoiceNo.startsWith('PO-'));
  const duplicateBills: Array<{ billNo: string; supplier: string; count: number }> = [];
  const seen = new Map<string, number>();

  purchases.forEach((p) => {
    const key = `${p.partyName.trim().toLowerCase()}::${p.invoiceNo.trim().toLowerCase()}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  });
  seen.forEach((count, key) => {
    if (count > 1) {
      const [supplier, billNo] = key.split('::');
      duplicateBills.push({ supplier, billNo, count });
    }
  });

  const missingSupplierParty = purchases.filter(
    (p) => !parties.some((party) => party.name.trim().toLowerCase() === p.partyName.trim().toLowerCase())
  );

  const zeroCostPurchases = purchases.filter((p) => (p.totalAmount || 0) <= 0);

  return {
    totalBillsChecked: purchases.length,
    duplicateBills,
    missingSupplierPartyCount: missingSupplierParty.length,
    zeroCostPurchasesCount: zeroCostPurchases.length,
    healthy: duplicateBills.length === 0 && zeroCostPurchases.length === 0,
  };
}
