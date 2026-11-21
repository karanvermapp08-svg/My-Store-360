import {
  AccountRecord,
  Item,
  JournalLine,
  JournalVoucher,
  PaymentTermsType,
  RecurringTemplate,
  Transaction,
} from '../types';

export const MY_STORE_DATA_VERSION = 3;

export interface TaxLineInput {
  price: number;
  qty: number;
  discountMode?: 'percent' | 'fixed';
  discountValue?: number;
  taxRate?: number;
  cessRate?: number;
  taxInclusive?: boolean;
}

export interface InvoiceCalcInput {
  lines: TaxLineInput[];
  invoiceDiscountMode?: 'percent' | 'fixed';
  invoiceDiscountValue?: number;
  additionalCharges?: number;
  companyState?: string;
  supplyState?: string;
  enableGst?: boolean;
  enableRoundOff?: boolean;
  paidAmount?: number;
}

export interface InvoiceCalcResult {
  subtotal: number;
  totalLineDiscounts: number;
  invoiceDiscount: number;
  taxableAmount: number;
  gstType: 'Intra-State' | 'Inter-State';
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalTax: number;
  additionalCharges: number;
  rawTotal: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  lineResults: Array<{
    taxable: number;
    discount: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    total: number;
  }>;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function calculateInvoiceTotals(input: InvoiceCalcInput): InvoiceCalcResult {
  const enableGst = input.enableGst !== false;
  const cState = (input.companyState || 'Karnataka (29)').trim().toLowerCase();
  const sState = (input.supplyState || cState).trim().toLowerCase();
  const isInterState = Boolean(sState && cState && sState !== cState);
  const gstType: 'Intra-State' | 'Inter-State' = isInterState ? 'Inter-State' : 'Intra-State';

  let subtotal = 0;
  let totalLineDiscounts = 0;
  const lineBaseValues: Array<{
    taxableBeforeInvDisc: number;
    taxRate: number;
    cessRate: number;
    discount: number;
  }> = [];

  for (const line of input.lines) {
    const qty = Math.max(0, Number(line.qty) || 0);
    const unitPrice = Math.max(0, Number(line.price) || 0);
    const taxRate = enableGst ? Math.max(0, Number(line.taxRate) || 0) : 0;
    const cessRate = enableGst ? Math.max(0, Number(line.cessRate) || 0) : 0;
    const rawGross = unitPrice * qty;
    const lineDiscRaw =
      line.discountMode === 'fixed'
        ? Math.min(rawGross, Math.max(0, Number(line.discountValue) || 0))
        : rawGross * (Math.min(100, Math.max(0, Number(line.discountValue) || 0)) / 100);

    const afterDisc = Math.max(0, rawGross - lineDiscRaw);
    let taxableBeforeInvDisc = afterDisc;

    if (line.taxInclusive && taxRate + cessRate > 0) {
      taxableBeforeInvDisc = afterDisc / (1 + (taxRate + cessRate) / 100);
    }

    subtotal += rawGross;
    totalLineDiscounts += lineDiscRaw;
    lineBaseValues.push({
      taxableBeforeInvDisc,
      taxRate,
      cessRate,
      discount: lineDiscRaw,
    });
  }

  const preInvTaxableSum = lineBaseValues.reduce((s, l) => s + l.taxableBeforeInvDisc, 0);
  const invDisc =
    input.invoiceDiscountMode === 'fixed'
      ? Math.min(preInvTaxableSum, Math.max(0, Number(input.invoiceDiscountValue) || 0))
      : preInvTaxableSum * (Math.min(100, Math.max(0, Number(input.invoiceDiscountValue) || 0)) / 100);

  const invDiscRatio = preInvTaxableSum > 0 ? Math.max(0, (preInvTaxableSum - invDisc) / preInvTaxableSum) : 1;

  let taxableAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let cessAmount = 0;

  const lineResults = lineBaseValues.map((lb) => {
    const taxable = lb.taxableBeforeInvDisc * invDiscRatio;
    const gst = taxable * (lb.taxRate / 100);
    const cess = taxable * (lb.cessRate / 100);
    const cgst = isInterState ? 0 : gst / 2;
    const sgst = isInterState ? 0 : gst / 2;
    const igst = isInterState ? gst : 0;

    taxableAmount += taxable;
    cgstAmount += cgst;
    sgstAmount += sgst;
    igstAmount += igst;
    cessAmount += cess;

    return {
      taxable: r2(taxable),
      discount: r2(lb.discount),
      cgst: r2(cgst),
      sgst: r2(sgst),
      igst: r2(igst),
      cess: r2(cess),
      total: r2(taxable + gst + cess),
    };
  });

  const additionalCharges = Math.max(0, Number(input.additionalCharges) || 0);
  const totalTax = r2(cgstAmount + sgstAmount + igstAmount + cessAmount);
  const rawTotal = r2(taxableAmount + totalTax + additionalCharges);
  const grandTotal = input.enableRoundOff !== false ? Math.round(rawTotal) : rawTotal;
  const roundOff = r2(grandTotal - rawTotal);
  const paidAmount = Math.min(grandTotal, Math.max(0, Number(input.paidAmount) || 0));
  const balanceAmount = r2(Math.max(0, grandTotal - paidAmount));

  return {
    subtotal: r2(subtotal),
    totalLineDiscounts: r2(totalLineDiscounts),
    invoiceDiscount: r2(invDisc),
    taxableAmount: r2(taxableAmount),
    gstType,
    cgstAmount: r2(cgstAmount),
    sgstAmount: r2(sgstAmount),
    igstAmount: r2(igstAmount),
    cessAmount: r2(cessAmount),
    totalTax,
    additionalCharges: r2(additionalCharges),
    rawTotal,
    roundOff,
    grandTotal,
    paidAmount,
    balanceAmount,
    lineResults,
  };
}

export function parseAnyDate(raw?: string): Date | null {
  if (!raw) return null;
  const trimmed = raw.split(',')[0].trim();
  const slash = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slash) {
    const d = Number(slash[1]);
    const m = Number(slash[2]) - 1;
    const y = slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3]);
    const dt = new Date(y, m, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(trimmed);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function calculateDueDateFromTerms(invoiceDateStr: string, terms: PaymentTermsType, customDays = 0): string {
  const base = parseAnyDate(invoiceDateStr) || new Date();
  const daysMap: Record<PaymentTermsType, number> = {
    'Due on Receipt': 0,
    'Net 7': 7,
    'Net 15': 15,
    'Net 30': 30,
    'Net 45': 45,
    'Net 60': 60,
    Custom: Math.max(0, customDays),
  };
  const d = new Date(base);
  d.setDate(d.getDate() + (daysMap[terms] ?? 0));
  return d.toLocaleDateString('en-GB');
}

export function getDaysOverdue(dueDateStr?: string): number {
  const due = parseAnyDate(dueDateStr);
  if (!due) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function getAgingBucket(daysOverdue: number): '0-30 days' | '31-60 days' | '61-90 days' | '90+ days' {
  if (daysOverdue <= 30) return '0-30 days';
  if (daysOverdue <= 60) return '31-60 days';
  if (daysOverdue <= 90) return '61-90 days';
  return '90+ days';
}

export function calculateRealProfitSummary(transactions: Transaction[], items: Item[]) {
  const itemCostMap = new Map<string, number>();
  items.forEach((it) => {
    itemCostMap.set(
      it.name.toLowerCase(),
      Number(it.weightedAvgCost ?? it.purchasePrice ?? it.lastPurchasePrice) || 0
    );
  });

  const activeSales = transactions.filter((t) => t.type === 'Sale' && !t.isCancelled);
  const activeReturns = transactions.filter((t) => t.type === 'Sale Return' && !t.isCancelled);
  const activePurchases = transactions.filter((t) => t.type === 'Purchase' && !t.isCancelled);
  const activePurchaseReturns = transactions.filter((t) => t.type === 'Purchase Return' && !t.isCancelled);
  const activeExpenses = transactions.filter(
    (t) => t.type === 'Expense' && !t.isCancelled && !t.invoiceNo.startsWith('DN-')
  );
  const activeIncome = transactions.filter((t) => t.type === 'Other Income' && !t.isCancelled);

  const getExGstAmount = (tx: Transaction) => {
    const tot = Number(tx.totalAmount) || 0;
    const tax = (Number(tx.cgstAmount) || 0) + (Number(tx.sgstAmount) || 0) + (Number(tx.igstAmount) || 0);
    if (tax > 0) return Math.max(0, tot - tax);
    if (typeof tx.taxableAmount === 'number' && tx.taxableAmount >= 0 && tx.taxableAmount <= tot) {
      return tx.taxableAmount;
    }
    return tot;
  };

  const getTxCogs = (tx: Transaction) => {
    if (typeof tx.totalCostOfGoodsSold === 'number' && tx.totalCostOfGoodsSold >= 0) {
      return tx.totalCostOfGoodsSold;
    }
    if (tx.items && tx.items.length > 0) {
      return tx.items.reduce((acc, line) => {
        const qty = line.qty || 1;
        if (typeof line.totalCost === 'number' && line.totalCost >= 0) return acc + line.totalCost;
        if (typeof line.unitCostAtSale === 'number' && line.unitCostAtSale >= 0) {
          return acc + line.unitCostAtSale * qty;
        }
        const unitCost = itemCostMap.get(line.name.toLowerCase()) ?? line.price * 0.78;
        return acc + unitCost * qty;
      }, 0);
    }
    if (tx.notes && tx.notes.includes('[UDHAAR KHATA]')) return 0;
    return getExGstAmount(tx) * 0.78;
  };

  const salesRevenue = activeSales.reduce((s, t) => s + getExGstAmount(t), 0);
  const returnDeductions = activeReturns.reduce((s, t) => s + getExGstAmount(t), 0);
  const netSalesRevenue = Math.max(0, salesRevenue - returnDeductions);

  const salesCogs = activeSales.reduce((s, t) => s + getTxCogs(t), 0);
  const returnCogs = activeReturns.reduce((s, t) => s + getTxCogs(t), 0);
  const cogs = Math.max(0, salesCogs - returnCogs);

  const grossProfit = r2(netSalesRevenue - cogs);
  const totalPurchases = Math.max(
    0,
    activePurchases.reduce((s, t) => s + (t.totalAmount || 0), 0) -
      activePurchaseReturns.reduce((s, t) => s + (t.totalAmount || 0), 0)
  );
  const totalExpenses = activeExpenses.reduce((s, t) => s + (t.totalAmount || 0), 0);
  const otherIncome = activeIncome.reduce((s, t) => s + (t.totalAmount || 0), 0);
  const netProfit = r2(grossProfit + otherIncome - totalExpenses);
  const grossMarginPercent = netSalesRevenue > 0 ? r2((grossProfit / netSalesRevenue) * 100) : 0;

  return {
    salesRevenue: r2(netSalesRevenue),
    cogs: r2(cogs),
    grossProfit,
    totalPurchases: r2(totalPurchases),
    totalExpenses: r2(totalExpenses),
    otherIncome: r2(otherIncome),
    netProfit,
    grossMarginPercent,
  };
}

export function buildDefaultChartOfAccounts(): AccountRecord[] {
  return [
    { id: 'acc-cash', code: '1001', name: 'Cash in Hand', group: 'Assets', subType: 'Current Asset', openingBalance: 35000, normalBalance: 'Debit', isActive: true, isSystem: true },
    { id: 'acc-bank', code: '1002', name: 'Primary Bank Account', group: 'Assets', subType: 'Current Asset', openingBalance: 184000, normalBalance: 'Debit', isActive: true, isSystem: true },
    { id: 'acc-ar', code: '1101', name: 'Accounts Receivable (Customers)', group: 'Assets', subType: 'Current Asset', openingBalance: 0, normalBalance: 'Debit', isActive: true, isSystem: true },
    { id: 'acc-inv', code: '1201', name: 'Inventory Asset', group: 'Assets', subType: 'Current Asset', openingBalance: 0, normalBalance: 'Debit', isActive: true, isSystem: true },
    { id: 'acc-ap', code: '2001', name: 'Accounts Payable (Suppliers)', group: 'Liabilities', subType: 'Current Liability', openingBalance: 0, normalBalance: 'Credit', isActive: true, isSystem: true },
    { id: 'acc-gst-out', code: '2101', name: 'GST Output Tax Payable', group: 'Liabilities', subType: 'Tax Liability', openingBalance: 0, normalBalance: 'Credit', isActive: true, isSystem: true },
    { id: 'acc-gst-in', code: '1301', name: 'GST Input Tax Credit', group: 'Assets', subType: 'Tax Asset', openingBalance: 0, normalBalance: 'Debit', isActive: true, isSystem: true },
    { id: 'acc-cap', code: '3001', name: 'Owner Capital', group: 'Capital', subType: 'Equity', openingBalance: 250000, normalBalance: 'Credit', isActive: true, isSystem: true },
    { id: 'acc-sales', code: '4001', name: 'Sales Revenue', group: 'Income', subType: 'Operating Income', openingBalance: 0, normalBalance: 'Credit', isActive: true, isSystem: true },
    { id: 'acc-other-inc', code: '4101', name: 'Other Income', group: 'Income', subType: 'Non-Operating Income', openingBalance: 0, normalBalance: 'Credit', isActive: true, isSystem: true },
    { id: 'acc-cogs', code: '5001', name: 'Purchases & Cost of Goods', group: 'Expenses', subType: 'Direct Expense', openingBalance: 0, normalBalance: 'Debit', isActive: true, isSystem: true },
    { id: 'acc-exp', code: '5101', name: 'Operating Expenses', group: 'Expenses', subType: 'Indirect Expense', openingBalance: 0, normalBalance: 'Debit', isActive: true, isSystem: true },
  ];
}

export function autoBuildJournalFromTransaction(tx: Transaction, actor: string): JournalVoucher | null {
  const amt = r2(tx.totalAmount || 0);
  if (amt <= 0 || tx.isCancelled) return null;

  const datePart = (tx.date || new Date().toLocaleDateString('en-GB')).split(',')[0].trim();
  const isCash = tx.paymentType === 'Cash';
  const settleAccountId = isCash ? 'acc-cash' : 'acc-bank';
  const settleAccountName = isCash ? 'Cash in Hand' : 'Primary Bank Account';
  const taxAmt = r2((tx.cgstAmount || 0) + (tx.sgstAmount || 0) + (tx.igstAmount || 0));
  const netBase = r2(Math.max(0, amt - taxAmt));

  const lines: JournalLine[] = [];
  let voucherType: JournalVoucher['voucherType'] = 'Journal';

  if (tx.type === 'Sale') {
    voucherType = 'Sales';
    const received = r2(Math.min(amt, tx.receivedAmount || 0));
    const bal = r2(Math.max(0, amt - received));
    if (received > 0) {
      lines.push({ id: `jl-1-${tx.id}`, accountId: settleAccountId, accountName: settleAccountName, debit: received, credit: 0 });
    }
    if (bal > 0) {
      lines.push({ id: `jl-2-${tx.id}`, accountId: 'acc-ar', accountName: 'Accounts Receivable (Customers)', debit: bal, credit: 0 });
    }
    lines.push({ id: `jl-3-${tx.id}`, accountId: 'acc-sales', accountName: 'Sales Revenue', debit: 0, credit: netBase });
    if (taxAmt > 0) {
      lines.push({ id: `jl-4-${tx.id}`, accountId: 'acc-gst-out', accountName: 'GST Output Tax Payable', debit: 0, credit: taxAmt });
    }
  } else if (tx.type === 'Payment-In') {
    voucherType = 'Receipt';
    lines.push({ id: `jl-1-${tx.id}`, accountId: settleAccountId, accountName: settleAccountName, debit: amt, credit: 0 });
    lines.push({ id: `jl-2-${tx.id}`, accountId: 'acc-ar', accountName: 'Accounts Receivable (Customers)', debit: 0, credit: amt });
  } else if (tx.type === 'Purchase') {
    const isPaymentOut =
      tx.invoiceNo.startsWith('PAYOUT-') ||
      Boolean(tx.notes && tx.notes.toLowerCase().includes('payment-out')) ||
      ((!tx.items || tx.items.length === 0) && (tx.balance || 0) === 0);
    if (isPaymentOut) {
      voucherType = 'Payment';
      lines.push({ id: `jl-1-${tx.id}`, accountId: 'acc-ap', accountName: 'Accounts Payable (Suppliers)', debit: amt, credit: 0 });
      lines.push({ id: `jl-2-${tx.id}`, accountId: settleAccountId, accountName: settleAccountName, debit: 0, credit: amt });
    } else {
      voucherType = 'Purchase';
      const paid = r2(Math.min(amt, tx.receivedAmount || 0));
      const bal = r2(Math.max(0, amt - paid));
      lines.push({ id: `jl-1-${tx.id}`, accountId: 'acc-cogs', accountName: 'Purchases & Cost of Goods', debit: netBase, credit: 0 });
      if (taxAmt > 0) {
        lines.push({ id: `jl-2-${tx.id}`, accountId: 'acc-gst-in', accountName: 'GST Input Tax Credit', debit: taxAmt, credit: 0 });
      }
      if (paid > 0) {
        lines.push({ id: `jl-3-${tx.id}`, accountId: settleAccountId, accountName: settleAccountName, debit: 0, credit: paid });
      }
      if (bal > 0) {
        lines.push({ id: `jl-4-${tx.id}`, accountId: 'acc-ap', accountName: 'Accounts Payable (Suppliers)', debit: 0, credit: bal });
      }
    }
  } else if (tx.type === 'Expense') {
    voucherType = 'Payment';
    lines.push({ id: `jl-1-${tx.id}`, accountId: 'acc-exp', accountName: 'Operating Expenses', debit: amt, credit: 0 });
    lines.push({ id: `jl-2-${tx.id}`, accountId: settleAccountId, accountName: settleAccountName, debit: 0, credit: amt });
  } else if (tx.type === 'Other Income') {
    voucherType = 'Receipt';
    lines.push({ id: `jl-1-${tx.id}`, accountId: settleAccountId, accountName: settleAccountName, debit: amt, credit: 0 });
    lines.push({ id: `jl-2-${tx.id}`, accountId: 'acc-other-inc', accountName: 'Other Income', debit: 0, credit: amt });
  } else {
    return null;
  }

  const totalDebit = r2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = r2(lines.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > 0.05) return null;

  return {
    id: `jv-auto-${tx.id}`,
    voucherNo: `JV-${tx.invoiceNo}`,
    date: datePart,
    voucherType,
    referenceNo: tx.invoiceNo,
    narration: `Auto-posted ${tx.type} #${tx.invoiceNo} (${tx.partyName})`,
    lines,
    totalDebit,
    totalCredit,
    createdBy: actor,
    createdAt: tx.createdAt || new Date().toISOString(),
  };
}

export function parseCsvText(rawText: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const text = rawText.replace(/^\uFEFF/, '');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      field = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    if (row.some((c) => c !== '')) rows.push(row);
  }
  const headers = rows[0] || [];
  return { headers, rows: rows.slice(1) };
}

export function validateBackupPayload(payload: any): { valid: boolean; error?: string } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Backup file is not a valid JSON object.' };
  }
  const validAppNames = ['Business Manager 360', 'MY STORE', 'MY STORE 360'];
  if (payload.app && !validAppNames.includes(String(payload.app))) {
    return { valid: false, error: `Unrecognized backup application identifier: "${payload.app}".` };
  }
  if (!Array.isArray(payload.transactions) && !Array.isArray(payload.items) && !Array.isArray(payload.parties)) {
    return { valid: false, error: 'Backup is missing core business arrays (transactions, items, or parties).' };
  }
  if (payload.schemaVersion !== undefined && typeof payload.schemaVersion !== 'number') {
    return { valid: false, error: 'Invalid schemaVersion metadata in backup file.' };
  }
  return { valid: true };
}

export function computeNextRecurringDate(currentDateStr: string, freq: RecurringTemplate['frequency']): string {
  const dt = new Date(currentDateStr || new Date().toISOString().slice(0, 10));
  if (Number.isNaN(dt.getTime())) return new Date().toISOString().slice(0, 10);
  if (freq === 'Daily') dt.setDate(dt.getDate() + 1);
  else if (freq === 'Weekly') dt.setDate(dt.getDate() + 7);
  else if (freq === 'Monthly') dt.setMonth(dt.getMonth() + 1);
  else if (freq === 'Quarterly') dt.setMonth(dt.getMonth() + 3);
  else if (freq === 'Yearly') dt.setFullYear(dt.getFullYear() + 1);
  return dt.toISOString().slice(0, 10);
}

export function validateGSTIN(gstin: string): boolean {
  if (!gstin.trim()) return true; // optional
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(gstin.trim());
}

export function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

export function validateEmail(email: string): boolean {
  if (!email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
