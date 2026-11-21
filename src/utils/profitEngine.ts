import {
  BusinessSettingsBundle,
  CostingMethodType,
  DiscountApprovalRecord,
  InvoiceItem,
  Item,
  ItemBatch,
  JournalVoucher,
  Party,
  Transaction,
} from '../types';
import { parseAnyDate } from './erpEngine';
import { convertUnitQty, normalizeUnitCode } from './kiranaBilling';

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function getEffectiveCostingMethod(settings?: BusinessSettingsBundle): CostingMethodType {
  const configured = settings?.accounting?.profitControl?.costingMethod;
  if (configured === 'Weighted Average' || configured === 'FIFO' || configured === 'Last Purchase Price') {
    return configured;
  }
  const legacy = settings?.item?.stockValuationMethod;
  if (legacy === 'FIFO') return 'FIFO';
  if (legacy === 'Purchase Price') return 'Last Purchase Price';
  return 'Weighted Average';
}

export function getItemLastPurchasePrice(item?: Item): number {
  if (!item) return 0;
  return r2(item.lastPurchasePrice ?? item.lastSupplierPrice ?? item.purchasePrice ?? 0);
}

export function getItemWeightedAvgCost(item?: Item): number {
  if (!item) return 0;
  return r2(item.weightedAvgCost ?? item.purchasePrice ?? item.lastPurchasePrice ?? 0);
}

export function computeWeightedAverageAfterPurchase(
  currentQty: number,
  currentAvgCost: number,
  purchaseQty: number,
  landedUnitCost: number
): number {
  const qIn = Math.max(0, Number(purchaseQty) || 0);
  const cIn = Math.max(0, Number(landedUnitCost) || 0);
  if (qIn <= 0) return r2(currentAvgCost);
  const qPrev = Math.max(0, Number(currentQty) || 0);
  const cPrev = Math.max(0, Number(currentAvgCost) || 0);
  if (qPrev <= 0) return r2(cIn);
  return r2((qPrev * cPrev + qIn * cIn) / (qPrev + qIn));
}

export function resolveUnitCostForSale(
  item: Item | undefined,
  qty: number,
  method: CostingMethodType,
  batches: ItemBatch[],
  explicitBatchNo?: string
): { unitCost: number; totalCost: number; methodUsed: CostingMethodType } {
  const safeQty = Math.max(0, Number(qty) || 0);
  if (!item || safeQty <= 0) {
    return { unitCost: 0, totalCost: 0, methodUsed: method };
  }

  if (explicitBatchNo) {
    const matchedBatch = batches.find(
      (b) =>
        b.batchNumber.toLowerCase() === explicitBatchNo.toLowerCase() &&
        (b.itemId === item.id || b.itemName.toLowerCase() === item.name.toLowerCase())
    );
    if (matchedBatch && matchedBatch.purchaseRate > 0) {
      const uc = r2(matchedBatch.purchaseRate);
      return { unitCost: uc, totalCost: r2(uc * safeQty), methodUsed: method };
    }
  }

  if (method === 'Last Purchase Price') {
    const uc = getItemLastPurchasePrice(item);
    return { unitCost: uc, totalCost: r2(uc * safeQty), methodUsed: method };
  }

  if (method === 'FIFO') {
    const itemBatches = batches
      .filter(
        (b) =>
          (b.itemId === item.id || b.itemName.toLowerCase() === item.name.toLowerCase()) &&
          (b.qty || 0) > 0 &&
          (b.purchaseRate || 0) > 0
      )
      .sort((a, b) => {
        const dateA = a.mfgDate || a.expiryDate || a.id;
        const dateB = b.mfgDate || b.expiryDate || b.id;
        return dateA.localeCompare(dateB);
      });

    if (itemBatches.length > 0) {
      let remaining = safeQty;
      let totalCost = 0;
      for (const batch of itemBatches) {
        if (remaining <= 0) break;
        const take = Math.min(batch.qty, remaining);
        totalCost += take * batch.purchaseRate;
        remaining -= take;
      }
      if (remaining > 0) {
        totalCost += remaining * getItemWeightedAvgCost(item);
      }
      const uc = r2(totalCost / safeQty);
      return { unitCost: uc, totalCost: r2(totalCost), methodUsed: method };
    }
  }

  const uc = getItemWeightedAvgCost(item);
  return { unitCost: uc, totalCost: r2(uc * safeQty), methodUsed: method };
}

export interface PurchaseLandedCostLine {
  lineId: string;
  name: string;
  qty: number;
  baseExTaxAmount: number;
  taxAmount: number;
  allocatedExtraExpense: number;
  nonCreditableTax: number;
  totalLandedCost: number;
  landedUnitCost: number;
}

export function computePurchaseLineLandedCosts(params: {
  lines: InvoiceItem[];
  freightCharges?: number;
  otherPurchaseExpenses?: number;
  isGstActive?: boolean;
  isTaxInclusive?: boolean;
  gstInputCreditEligible?: boolean;
}): {
  lines: PurchaseLandedCostLine[];
  totalExtraExpenses: number;
  totalItcCreditable: number;
  totalNonCreditableTax: number;
  totalPurchaseCost: number;
} {
  const {
    lines,
    freightCharges = 0,
    otherPurchaseExpenses = 0,
    isGstActive = true,
    isTaxInclusive = false,
    gstInputCreditEligible = true,
  } = params;

  const extra = Math.max(0, Number(freightCharges) || 0) + Math.max(0, Number(otherPurchaseExpenses) || 0);
  const rawParsed = lines.map((l) => {
    const qty = Math.max(1, Number(l.qty) || 1);
    const gross = qty * Math.max(0, Number(l.price) || 0);
    const discAmt = l.discountAmount !== undefined ? Math.min(gross, Math.max(0, l.discountAmount)) : (gross * Math.max(0, l.discountPercent || 0)) / 100;
    const afterDisc = Math.max(0, gross - discAmt);
    const taxPct = isGstActive ? Math.max(0, Number(l.taxPercent) || 0) : 0;
    let baseExTax = afterDisc;
    let taxAmt = 0;
    if (taxPct > 0) {
      if (isTaxInclusive) {
        baseExTax = afterDisc / (1 + taxPct / 100);
        taxAmt = afterDisc - baseExTax;
      } else {
        baseExTax = afterDisc;
        taxAmt = (afterDisc * taxPct) / 100;
      }
    }
    return { l, qty, baseExTax, taxAmt };
  });

  const totalBase = rawParsed.reduce((s, r) => s + r.baseExTax, 0);
  const totalQty = rawParsed.reduce((s, r) => s + r.qty, 0);

  let totalItcCreditable = 0;
  let totalNonCreditableTax = 0;
  let totalPurchaseCost = 0;

  const resultLines: PurchaseLandedCostLine[] = rawParsed.map((row) => {
    const share =
      totalBase > 0
        ? row.baseExTax / totalBase
        : totalQty > 0
        ? row.qty / totalQty
        : 1 / Math.max(1, rawParsed.length);
    const allocExtra = r2(extra * share);
    const nonCreditTax = gstInputCreditEligible ? 0 : r2(row.taxAmt);
    if (gstInputCreditEligible) totalItcCreditable += row.taxAmt;
    else totalNonCreditableTax += row.taxAmt;

    const totalLandedCost = r2(row.baseExTax + allocExtra + nonCreditTax);
    const landedUnitCost = r2(totalLandedCost / row.qty);
    totalPurchaseCost += totalLandedCost;

    return {
      lineId: row.l.id,
      name: row.l.name,
      qty: row.qty,
      baseExTaxAmount: r2(row.baseExTax),
      taxAmount: r2(row.taxAmt),
      allocatedExtraExpense: allocExtra,
      nonCreditableTax: nonCreditTax,
      totalLandedCost,
      landedUnitCost,
    };
  });

  return {
    lines: resultLines,
    totalExtraExpenses: r2(extra),
    totalItcCreditable: r2(totalItcCreditable),
    totalNonCreditableTax: r2(totalNonCreditableTax),
    totalPurchaseCost: r2(totalPurchaseCost),
  };
}

export type ProfitIndicatorStatus = 'PROFIT' | 'BREAK_EVEN' | 'LOSS';

export interface SaleLineProfitAnalysis {
  lineId: string;
  name: string;
  qty: number;
  mrp: number;
  unitSellingPrice: number;
  unitExGstPrice: number;
  unitCost: number;
  totalCost: number;
  lineDiscountAmount: number;
  allocatedInvoiceDiscount: number;
  netExGstRevenue: number;
  gstAmount: number;
  grossProfit: number;
  profitMarginPercent: number;
  minSafeSellingPrice: number;
  maxSafeDiscountAmount: number;
  maxSafeDiscountPercent: number;
  status: ProfitIndicatorStatus;
  costingMethodUsed: CostingMethodType;
}

export interface SaleInvoiceProfitAnalysis {
  lines: SaleLineProfitAnalysis[];
  grossSubtotal: number;
  totalItemDiscounts: number;
  invoiceDiscountAmount: number;
  totalDiscounts: number;
  netExGstRevenue: number;
  totalGstExcludedFromProfit: number;
  totalCost: number;
  grossProfit: number;
  profitMarginPercent: number;
  status: ProfitIndicatorStatus;
  lossAmount: number;
  exceedsMaxDiscount: boolean;
  belowMinMargin: boolean;
  requiresAdminApproval: boolean;
  maxSafeInvoiceDiscountAmount: number;
  maxSafeInvoiceDiscountPercent: number;
  lossCausingItems: SaleLineProfitAnalysis[];
}

export function analyzeSaleInvoiceProfit(params: {
  lines: InvoiceItem[];
  items: Item[];
  batches: ItemBatch[];
  costingMethod?: CostingMethodType;
  isGstActive?: boolean;
  isTaxInclusive?: boolean;
  gstBasisForProfit?: 'Exclude Creditable GST' | 'Include All Tax';
  invoiceDiscountMode?: 'percent' | 'fixed';
  invoiceDiscountValue?: number;
  maxDiscountPercent?: number;
  minProfitMarginPercent?: number;
  preserveHistoricalCost?: boolean;
}): SaleInvoiceProfitAnalysis {
  const {
    lines,
    items,
    batches,
    costingMethod = 'Weighted Average',
    isGstActive = true,
    isTaxInclusive = false,
    gstBasisForProfit = 'Exclude Creditable GST',
    invoiceDiscountMode = 'percent',
    invoiceDiscountValue = 0,
    maxDiscountPercent = 15,
    minProfitMarginPercent = 3,
    preserveHistoricalCost = false,
  } = params;

  const itemMap = new Map<string, Item>();
  items.forEach((it) => {
    itemMap.set(it.name.trim().toLowerCase(), it);
    if (it.code) itemMap.set(`code:${it.code.trim().toLowerCase()}`, it);
  });

  const preLines = lines.map((line) => {
    const qty = Math.max(0, Number(line.qty) || 0);
    const price = Math.max(0, Number(line.price) || 0);
    const taxPct = isGstActive ? Math.max(0, Number(line.taxPercent) || 0) : 0;
    const matchedItem =
      itemMap.get((line.name || '').trim().toLowerCase()) ||
      (line.hsn ? itemMap.get(`code:${line.hsn.trim().toLowerCase()}`) : undefined);

    const gross = qty * price;
    const itemDiscAmt =
      line.discountAmount !== undefined && line.discountAmount > 0 && !(line.discountPercent > 0)
        ? Math.min(gross, Math.max(0, Number(line.discountAmount) || 0))
        : (gross * Math.min(100, Math.max(0, Number(line.discountPercent) || 0))) / 100;

    const afterItemDisc = Math.max(0, gross - itemDiscAmt);
    const exGstBeforeInvDisc =
      isTaxInclusive && taxPct > 0 ? afterItemDisc / (1 + taxPct / 100) : afterItemDisc;

    let unitCost = 0;
    let totalCost = 0;
    let methodUsed = costingMethod;
    const baseQtyForItem = matchedItem
      ? convertUnitQty(qty, line.unit || matchedItem.unit, matchedItem.unit, matchedItem.unitConversion)
      : qty;
    const unitScale = qty > 0 ? baseQtyForItem / qty : 1;

    if ((line.unitCostEdited || preserveHistoricalCost) && line.unitCostAtSale !== undefined && line.unitCostAtSale >= 0) {
      unitCost = r2(line.unitCostAtSale);
      totalCost = r2(unitCost * qty);
      methodUsed = line.costingMethodUsed || costingMethod;
    } else {
      const resolved = resolveUnitCostForSale(
        matchedItem,
        baseQtyForItem > 0 ? baseQtyForItem : qty,
        costingMethod,
        batches,
        line.batchNo
      );
      unitCost = r2(resolved.unitCost * unitScale);
      totalCost = r2(resolved.totalCost);
      methodUsed = resolved.methodUsed;
    }

    const unitExGstPrice =
      isTaxInclusive && taxPct > 0 ? price / (1 + taxPct / 100) : price;
    const minSafeSellingPrice =
      isTaxInclusive && taxPct > 0 ? r2(unitCost * (1 + taxPct / 100)) : r2(unitCost);

    return {
      line,
      matchedItem,
      qty,
      price,
      taxPct,
      gross,
      itemDiscAmt,
      exGstBeforeInvDisc,
      unitCost,
      totalCost,
      unitExGstPrice,
      minSafeSellingPrice,
      methodUsed,
    };
  });

  const preInvExGstSum = preLines.reduce((s, p) => s + p.exGstBeforeInvDisc, 0);
  const invDiscAmt =
    invoiceDiscountMode === 'fixed'
      ? Math.min(preInvExGstSum, Math.max(0, Number(invoiceDiscountValue) || 0))
      : preInvExGstSum * (Math.min(100, Math.max(0, Number(invoiceDiscountValue) || 0)) / 100);
  const invDiscRatio = preInvExGstSum > 0 ? Math.max(0, (preInvExGstSum - invDiscAmt) / preInvExGstSum) : 1;

  let grossSubtotal = 0;
  let totalItemDiscounts = 0;
  let netExGstRevenue = 0;
  let totalGstExcluded = 0;
  let totalCost = 0;

  const analyzedLines: SaleLineProfitAnalysis[] = preLines.map((p) => {
    const netExGst = p.exGstBeforeInvDisc * invDiscRatio;
    const allocInvDisc = Math.max(0, p.exGstBeforeInvDisc - netExGst);
    const gstAmount = (netExGst * p.taxPct) / 100;
    const revenueUsedForProfit =
      gstBasisForProfit === 'Include All Tax' ? netExGst + gstAmount : netExGst;
    const gp = revenueUsedForProfit - p.totalCost;
    const marginPct =
      revenueUsedForProfit > 0 ? (gp / revenueUsedForProfit) * 100 : gp < 0 ? -100 : 0;

    const status: ProfitIndicatorStatus =
      gp < -0.01 ? 'LOSS' : Math.abs(gp) <= 0.01 ? 'BREAK_EVEN' : 'PROFIT';

    const grossExGst = p.qty * p.unitExGstPrice;
    const maxSafeDiscountAmount = Math.max(0, r2(grossExGst - p.totalCost));
    const maxSafeDiscountPercent =
      grossExGst > 0 ? r2((maxSafeDiscountAmount / grossExGst) * 100) : 0;

    grossSubtotal += p.gross;
    totalItemDiscounts += p.itemDiscAmt;
    netExGstRevenue += revenueUsedForProfit;
    totalGstExcluded += gstAmount;
    totalCost += p.totalCost;

    return {
      lineId: p.line.id,
      name: p.line.name,
      qty: p.qty,
      mrp: Number(p.line.mrp ?? p.matchedItem?.mrp ?? p.price) || 0,
      unitSellingPrice: r2(p.price),
      unitExGstPrice: r2(p.unitExGstPrice),
      unitCost: p.unitCost,
      totalCost: r2(p.totalCost),
      lineDiscountAmount: r2(p.itemDiscAmt),
      allocatedInvoiceDiscount: r2(allocInvDisc),
      netExGstRevenue: r2(revenueUsedForProfit),
      gstAmount: r2(gstAmount),
      grossProfit: r2(gp),
      profitMarginPercent: r2(marginPct),
      minSafeSellingPrice: p.minSafeSellingPrice,
      maxSafeDiscountAmount,
      maxSafeDiscountPercent,
      status,
      costingMethodUsed: p.methodUsed,
    };
  });

  const grossProfit = r2(netExGstRevenue - totalCost);
  const profitMarginPercent =
    netExGstRevenue > 0 ? r2((grossProfit / netExGstRevenue) * 100) : grossProfit < 0 ? -100 : 0;
  const status: ProfitIndicatorStatus =
    grossProfit < -0.01 ? 'LOSS' : Math.abs(grossProfit) <= 0.01 ? 'BREAK_EVEN' : 'PROFIT';
  const lossAmount = grossProfit < 0 ? r2(Math.abs(grossProfit)) : 0;

  const totalDiscounts = r2(totalItemDiscounts + invDiscAmt);
  const overallDiscPct = grossSubtotal > 0 ? (totalDiscounts / grossSubtotal) * 100 : 0;
  const anyLineExceedsDisc = lines.some((l) => (Number(l.discountPercent) || 0) > maxDiscountPercent);
  const exceedsMaxDiscount = overallDiscPct > maxDiscountPercent || anyLineExceedsDisc;
  const belowMinMargin = netExGstRevenue > 0 && profitMarginPercent < minProfitMarginPercent;
  const lossCausingItems = analyzedLines.filter((l) => l.grossProfit < -0.01);

  const maxSafeInvoiceDiscountAmount = Math.max(0, r2(preInvExGstSum - totalCost));
  const maxSafeInvoiceDiscountPercent =
    preInvExGstSum > 0 ? r2((maxSafeInvoiceDiscountAmount / preInvExGstSum) * 100) : 0;

  return {
    lines: analyzedLines,
    grossSubtotal: r2(grossSubtotal),
    totalItemDiscounts: r2(totalItemDiscounts),
    invoiceDiscountAmount: r2(invDiscAmt),
    totalDiscounts,
    netExGstRevenue: r2(netExGstRevenue),
    totalGstExcludedFromProfit: r2(totalGstExcluded),
    totalCost: r2(totalCost),
    grossProfit,
    profitMarginPercent,
    status,
    lossAmount,
    exceedsMaxDiscount,
    belowMinMargin,
    requiresAdminApproval: status === 'LOSS' || exceedsMaxDiscount || belowMinMargin || lossCausingItems.length > 0,
    maxSafeInvoiceDiscountAmount,
    maxSafeInvoiceDiscountPercent,
    lossCausingItems,
  };
}

export function stampSaleTransactionProfit(params: {
  txData: Omit<Transaction, 'id' | 'createdAt'>;
  items: Item[];
  batches: ItemBatch[];
  settings?: BusinessSettingsBundle;
  existingTransactions?: Transaction[];
}): Omit<Transaction, 'id' | 'createdAt'> {
  const { txData, items, batches, settings, existingTransactions = [] } = params;
  const method = getEffectiveCostingMethod(settings);
  const profitCfg = settings?.accounting?.profitControl;
  const isGstActive = settings?.gst?.isGstRegistered ?? true;
  const isTaxInclusive = settings?.transaction?.sales?.taxMode === 'Inclusive';

  if (txData.type === 'Sale' && txData.items && txData.items.length > 0) {
    const analysis = analyzeSaleInvoiceProfit({
      lines: txData.items,
      items,
      batches,
      costingMethod: method,
      isGstActive,
      isTaxInclusive,
      gstBasisForProfit: profitCfg?.gstBasisForProfit || 'Exclude Creditable GST',
      invoiceDiscountMode: txData.invoiceDiscountMode || 'percent',
      invoiceDiscountValue: txData.invoiceDiscountValue || 0,
      maxDiscountPercent: profitCfg?.maxDiscountPercent ?? 15,
      minProfitMarginPercent: profitCfg?.minProfitMarginPercent ?? 3,
      preserveHistoricalCost: false,
    });

    const stampedItems: InvoiceItem[] = txData.items.map((line, idx) => {
      const a = analysis.lines[idx];
      if (!a) return line;
      return {
        ...line,
        mrp: line.mrp ?? a.mrp,
        discountAmount: line.discountAmount ?? a.lineDiscountAmount,
        unitCostAtSale: line.unitCostEdited && line.unitCostAtSale !== undefined ? line.unitCostAtSale : (line.unitCostAtSale ?? a.unitCost),
        totalCost: line.unitCostEdited ? a.totalCost : (line.totalCost ?? a.totalCost),
        grossProfit: a.grossProfit,
        profitMarginPercent: a.profitMarginPercent,
        costingMethodUsed: a.costingMethodUsed,
      };
    });

    return {
      ...txData,
      items: stampedItems,
      totalCostOfGoodsSold: analysis.totalCost,
      grossProfit: analysis.grossProfit,
      netProfit: analysis.grossProfit,
      profitMarginPercent: analysis.profitMarginPercent,
      isLossInvoice: analysis.status === 'LOSS',
      totalDiscount: txData.totalDiscount ?? analysis.totalDiscounts,
    };
  }

  if (txData.type === 'Sale Return' && txData.items && txData.items.length > 0) {
    const orig = existingTransactions.find(
      (t) =>
        (txData.originalInvoiceId && t.id === txData.originalInvoiceId) ||
        (txData.originalInvoiceNo && t.invoiceNo.toLowerCase() === txData.originalInvoiceNo.toLowerCase())
    );
    let totalReturnCost = 0;
    const stampedReturnItems: InvoiceItem[] = txData.items.map((line) => {
      const origLine = orig?.items?.find(
        (ol) => ol.name.toLowerCase() === line.name.toLowerCase() || (line.hsn && ol.hsn === line.hsn)
      );
      const matchedItem = items.find(
        (it) => it.name.toLowerCase() === line.name.toLowerCase() || (line.hsn && it.code === line.hsn)
      );
      const qty = Math.max(0, Number(line.qty) || 0);
      const baseQtyForItem = matchedItem
        ? convertUnitQty(qty, line.unit || matchedItem.unit, matchedItem.unit, matchedItem.unitConversion)
        : qty;
      const unitCost =
        line.unitCostAtSale ??
        origLine?.unitCostAtSale ??
        resolveUnitCostForSale(matchedItem, baseQtyForItem > 0 ? baseQtyForItem : qty, method, batches, line.batchNo).unitCost;
      const totalCost = r2(unitCost * qty);
      totalReturnCost += totalCost;
      return {
        ...line,
        unitCostAtSale: unitCost,
        totalCost,
        costingMethodUsed: origLine?.costingMethodUsed || method,
      };
    });

    return {
      ...txData,
      items: stampedReturnItems,
      totalCostOfGoodsSold: r2(totalReturnCost),
    };
  }

  return txData;
}

export function isDateInLockedPeriod(
  dateStr: string | undefined,
  settings?: BusinessSettingsBundle
): { locked: boolean; periodLabel?: string } {
  const locks = settings?.accounting?.lockedPeriods || [];
  if (locks.length === 0) return { locked: false };
  const parsed = parseAnyDate(dateStr) || new Date();
  const isoDay = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  const hit = locks.find((lp) => isoDay >= lp.startDate && isoDay <= lp.endDate);
  return hit ? { locked: true, periodLabel: hit.label } : { locked: false };
}

export function getIndianFinancialYearRange(fyStartYear: number): { label: string; start: Date; end: Date } {
  return {
    label: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
    start: new Date(fyStartYear, 3, 1, 0, 0, 0, 0),
    end: new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999),
  };
}

export type PLPeriodFilter =
  | 'Today'
  | 'Yesterday'
  | 'This Week'
  | 'This Month'
  | 'This Quarter'
  | 'This Year'
  | 'Financial Year'
  | 'Custom'
  | 'All Time';

export interface PeriodSnapshotMetrics {
  label: string;
  netSales: number;
  grossSales: number;
  cogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  expenses: number;
  otherIncome: number;
  netProfit: number;
  netMarginPercent: number;
  totalDiscounts: number;
  invoiceCount: number;
}

export interface ProductPLRow {
  itemId?: string;
  name: string;
  category: string;
  qtySold: number;
  returnedQty: number;
  netQty: number;
  grossSales: number;
  discountsGiven: number;
  returnsValue: number;
  netSalesExGst: number;
  cogs: number;
  grossProfit: number;
  marginPercent: number;
  isLossMaking: boolean;
  performanceScore: number;
  performanceTier: 'High Profit' | 'Profitable' | 'Average' | 'Low Margin' | 'Loss-Making';
}

export interface CustomerPLRow {
  partyName: string;
  invoiceCount: number;
  grossPurchases: number;
  discountsGiven: number;
  returnsAmount: number;
  netRevenueExGst: number;
  cogs: number;
  grossProfit: number;
  marginPercent: number;
  outstandingBalance: number;
}

export interface CustomerProductBrandItemPLRow {
  key: string;
  partyName: string;
  itemId?: string;
  productName: string;
  brand: string;
  category: string;
  unit: string;
  qtySold: number;
  returnedQty: number;
  netQty: number;
  grossSales: number;
  discountsGiven: number;
  returnsValue: number;
  netRevenueExGst: number;
  cogs: number;
  grossProfit: number;
  marginPercent: number;
}

export interface DailyForecastHistoryPoint {
  dateIso: string;
  label: string;
  revenue: number;
  grossProfit: number;
}

export interface Projected30DayPoint {
  dayOffset: number;
  dateIso: string;
  label: string;
  projectedRevenue: number;
  revenueLower: number;
  revenueUpper: number;
  projectedGrossProfit: number;
  grossProfitLower: number;
  grossProfitUpper: number;
}

export interface PriceRecommendationRow {
  itemId: string;
  name: string;
  category: string;
  currentPurchasePrice: number;
  weightedAvgCost: number;
  currentSalePrice: number;
  currentGrossProfitPerUnit: number;
  currentMarginPercent: number;
  minProfitablePrice: number;
  recommendedSalePrice: number;
  targetMarginPercent: number;
  status: 'Loss-Making' | 'Below Target' | 'Healthy';
  reason: string;
}

export interface DeadStockBucketRow {
  itemId: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  unitCost: number;
  capitalBlocked: number;
  daysSinceLastSale: number | null;
  bucket: '90+ Days Dead' | '60-89 Days Dead' | '30-59 Days Slow' | 'Overstocked' | 'Expiring Soon';
  recommendation: string;
}

export interface ReconciliationCheck {
  id: string;
  area: string;
  status: 'Matched' | 'Variance' | 'Review Needed';
  expectedValue: number;
  actualValue: number;
  difference: number;
  detail: string;
  targetTab: string;
}

export interface ProfitAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  metricValue: string;
}

export interface HealthScoreFactor {
  factor: string;
  weightPercent: number;
  scoreOutOf100: number;
  weightedPoints: number;
  observedMetric: string;
}

export interface ComprehensivePLReport {
  dateCoverageLabel: string;
  costingMethodUsed: CostingMethodType;
  tradingAndPL: {
    openingStockValue: number;
    grossSalesExGst: number;
    salesReturnsExGst: number;
    totalDiscounts: number;
    netSalesExGst: number;
    grossPurchasesExGst: number;
    purchaseReturnsExGst: number;
    directPurchaseExpenses: number;
    netPurchasesExGst: number;
    closingStockValue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPercent: number;
    otherIncome: number;
    indirectExpensesTotal: number;
    expenseByCategory: Array<{ category: string; amount: number; sharePercent: number }>;
    netProfit: number;
    netMarginPercent: number;
    gstCollectedOutput: number;
    gstInputEligible: number;
    gstInputNonCreditable: number;
    netGstLiability: number;
  };
  discountAnalysis: {
    totalDiscountsGiven: number;
    productLevelDiscounts: number;
    invoiceLevelDiscounts: number;
    couponDiscounts: number;
    discountToGrossSalesPercent: number;
    discountToGrossProfitPercent: number;
    lossCausedByDiscounts: number;
    lossMakingInvoicesCount: number;
    overDiscountedInvoicesCount: number;
    totalApprovalsCount: number;
  };
  cashVsAccrual: {
    cashSales: number;
    upiAndBankSales: number;
    creditSales: number;
    cashReceivedFromCollections: number;
    totalCashAndBankInflow: number;
    customerReceivables: number;
    supplierPayables: number;
    operatingCashFlow: number;
    accrualNetProfit: number;
    cashProfitGapNote: string;
  };
  comparisons: {
    todayVsYesterday: { current: PeriodSnapshotMetrics; previous: PeriodSnapshotMetrics; salesGrowthPct: number; profitGrowthPct: number };
    weekVsLastWeek: { current: PeriodSnapshotMetrics; previous: PeriodSnapshotMetrics; salesGrowthPct: number; profitGrowthPct: number };
    monthVsLastMonth: { current: PeriodSnapshotMetrics; previous: PeriodSnapshotMetrics; salesGrowthPct: number; profitGrowthPct: number };
    yearVsLastYear: { current: PeriodSnapshotMetrics; previous: PeriodSnapshotMetrics; salesGrowthPct: number; profitGrowthPct: number };
  };
  trendSeries: Array<{ label: string; sales: number; cogs: number; expenses: number; grossProfit: number; netProfit: number }>;
  productRows: ProductPLRow[];
  categoryRows: Array<{ category: string; netQty: number; netSales: number; cogs: number; grossProfit: number; marginPercent: number }>;
  customerRows: CustomerPLRow[];
  customerProductBrandRows: CustomerProductBrandItemPLRow[];
  reconciliationChecks: ReconciliationCheck[];
  priceRecommendations: PriceRecommendationRow[];
  deadStockAnalysis: {
    totalCapitalBlocked: number;
    count30Days: number;
    count60Days: number;
    count90Days: number;
    rows: DeadStockBucketRow[];
  };
  salesForecast: {
    sampleActiveDays: number;
    avgDailyRevenue: number;
    avgDailyGrossProfit: number;
    next7DaysRevenue: number;
    next7DaysGrossProfit: number;
    next30DaysRevenue: number;
    next30DaysGrossProfit: number;
    next30DaysRevenueLower: number;
    next30DaysRevenueUpper: number;
    next30DaysGrossProfitLower: number;
    next30DaysGrossProfitUpper: number;
    confidence: 'High' | 'Moderate' | 'Low';
    notice: string;
    dailyHistorySeries: DailyForecastHistoryPoint[];
    projected30DaysSeries: Projected30DayPoint[];
  };
  expenseOptimizer: {
    expenseToSalesRatioPct: number;
    thisMonthExpenses: number;
    lastMonthExpenses: number;
    momChangePct: number;
    topCategory: string;
    insights: string[];
  };
  businessHealth: {
    overallScore: number;
    grade: 'Excellent' | 'Good' | 'Watch' | 'At Risk';
    factors: HealthScoreFactor[];
  };
  alerts: ProfitAlert[];
}

function getTxDate(tx: Transaction): Date | null {
  return parseAnyDate(tx.date) || (tx.createdAt ? new Date(tx.createdAt) : null);
}

function getTxExGstSalesValue(tx: Transaction, includeTaxInProfit = false): number {
  const total = Number(tx.totalAmount) || 0;
  if (includeTaxInProfit) return total;
  const tax = (Number(tx.cgstAmount) || 0) + (Number(tx.sgstAmount) || 0) + (Number(tx.igstAmount) || 0);
  if (tax > 0) return Math.max(0, total - tax);
  if (typeof tx.taxableAmount === 'number' && tx.taxableAmount >= 0 && tx.taxableAmount <= total) {
    return tx.taxableAmount;
  }
  // Compute from lines if available
  if (tx.items && tx.items.length > 0) {
    const lineTax = tx.items.reduce((s, li) => {
      const rate = Number(li.taxPercent) || 0;
      const amt = Number(li.amount) || (li.qty || 1) * (li.price || 0) * (1 - (li.discountPercent || 0) / 100);
      if (rate <= 0) return s;
      return s + (amt - amt / (1 + rate / 100));
    }, 0);
    return Math.max(0, total - lineTax);
  }
  return total;
}

function getTxHistoricalCogs(
  tx: Transaction,
  itemByName: Map<string, Item>,
  costingMethod: CostingMethodType,
  batches: ItemBatch[]
): number {
  if (typeof tx.totalCostOfGoodsSold === 'number' && tx.totalCostOfGoodsSold >= 0) {
    return tx.totalCostOfGoodsSold;
  }
  if (!tx.items || tx.items.length === 0) {
    if (tx.notes && tx.notes.includes('[UDHAAR KHATA]')) return 0;
    return r2(getTxExGstSalesValue(tx) * 0.78);
  }
  let sum = 0;
  for (const li of tx.items) {
    const qty = Math.max(0, Number(li.qty) || 0);
    if (qty <= 0) continue;
    if (typeof li.totalCost === 'number' && li.totalCost >= 0) {
      sum += li.totalCost;
    } else if (typeof li.unitCostAtSale === 'number' && li.unitCostAtSale >= 0) {
      sum += li.unitCostAtSale * qty;
    } else {
      const matched = itemByName.get((li.name || '').trim().toLowerCase());
      if (matched) {
        const baseQty = convertUnitQty(qty, li.unit || matched.unit, matched.unit, matched.unitConversion);
        sum += resolveUnitCostForSale(matched, baseQty, costingMethod, batches, li.batchNo).totalCost;
      } else {
        sum += (li.price || 0) * qty * 0.78;
      }
    }
  }
  return r2(sum);
}

function computeSnapshotMetrics(
  label: string,
  txs: Transaction[],
  itemByName: Map<string, Item>,
  costingMethod: CostingMethodType,
  batches: ItemBatch[],
  includeTaxInProfit: boolean
): PeriodSnapshotMetrics {
  const sales = txs.filter((t) => t.type === 'Sale' && !t.isCancelled);
  const returns = txs.filter((t) => t.type === 'Sale Return' && !t.isCancelled);
  const expenses = txs.filter((t) => t.type === 'Expense' && !t.isCancelled && !t.invoiceNo.startsWith('DN-'));
  const incomes = txs.filter((t) => t.type === 'Other Income' && !t.isCancelled);

  const grossSales = sales.reduce((s, t) => s + getTxExGstSalesValue(t, includeTaxInProfit), 0);
  const retSales = returns.reduce((s, t) => s + getTxExGstSalesValue(t, includeTaxInProfit), 0);
  const netSales = Math.max(0, grossSales - retSales);

  const salesCogs = sales.reduce((s, t) => s + getTxHistoricalCogs(t, itemByName, costingMethod, batches), 0);
  const returnCogs = returns.reduce((s, t) => s + getTxHistoricalCogs(t, itemByName, costingMethod, batches), 0);
  const cogs = Math.max(0, salesCogs - returnCogs);

  const grossProfit = netSales - cogs;
  const expTotal = expenses.reduce((s, t) => s + (t.totalAmount || 0), 0);
  const incTotal = incomes.reduce((s, t) => s + (t.totalAmount || 0), 0);
  const netProfit = grossProfit + incTotal - expTotal;

  return {
    label,
    netSales: r2(netSales),
    grossSales: r2(grossSales),
    cogs: r2(cogs),
    grossProfit: r2(grossProfit),
    grossMarginPercent: netSales > 0 ? r2((grossProfit / netSales) * 100) : 0,
    expenses: r2(expTotal),
    otherIncome: r2(incTotal),
    netProfit: r2(netProfit),
    netMarginPercent: netSales > 0 ? r2((netProfit / netSales) * 100) : 0,
    totalDiscounts: r2(sales.reduce((s, t) => s + (t.totalDiscount || 0), 0)),
    invoiceCount: sales.length,
  };
}

export function computeComprehensivePL(params: {
  transactions: Transaction[];
  items: Item[];
  parties: Party[];
  batches: ItemBatch[];
  journalVouchers?: JournalVoucher[];
  discountApprovals?: DiscountApprovalRecord[];
  settings?: BusinessSettingsBundle;
  period?: PLPeriodFilter;
  customStartDate?: string;
  customEndDate?: string;
  fyStartYear?: number;
  now?: Date;
}): ComprehensivePLReport {
  const {
    transactions,
    items,
    parties,
    batches,
    journalVouchers = [],
    discountApprovals = [],
    settings,
    period = 'All Time',
    customStartDate,
    customEndDate,
    fyStartYear,
    now = new Date(),
  } = params;

  const costingMethod = getEffectiveCostingMethod(settings);
  const profitCfg = settings?.accounting?.profitControl;
  const includeTaxInProfit = profitCfg?.gstBasisForProfit === 'Include All Tax';
  const targetMarginPct = profitCfg?.targetProfitMarginPercent ?? 18;
  const maxDiscountPct = profitCfg?.maxDiscountPercent ?? 15;
  const minMarginPct = profitCfg?.minProfitMarginPercent ?? 3;

  const itemByName = new Map<string, Item>();
  items.forEach((it) => {
    itemByName.set(it.name.trim().toLowerCase(), it);
    if (it.code) itemByName.set(`code:${it.code.trim().toLowerCase()}`, it);
  });

  // Determine range
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(todayEnd);
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

  let rangeStart: Date | null = null;
  let rangeEnd: Date | null = null;
  let dateCoverageLabel = 'All Recorded Transactions';

  if (period === 'Today') {
    rangeStart = todayStart;
    rangeEnd = todayEnd;
    dateCoverageLabel = `Today (${todayStart.toLocaleDateString('en-IN')})`;
  } else if (period === 'Yesterday') {
    rangeStart = yesterdayStart;
    rangeEnd = yesterdayEnd;
    dateCoverageLabel = `Yesterday (${yesterdayStart.toLocaleDateString('en-IN')})`;
  } else if (period === 'This Week') {
    const s = new Date(todayStart);
    s.setDate(s.getDate() - 6);
    rangeStart = s;
    rangeEnd = todayEnd;
    dateCoverageLabel = `Last 7 Days (${s.toLocaleDateString('en-IN')} – ${todayEnd.toLocaleDateString('en-IN')})`;
  } else if (period === 'This Month') {
    rangeStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    rangeEnd = todayEnd;
    dateCoverageLabel = `This Month (${now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })})`;
  } else if (period === 'This Quarter') {
    const qStartM = Math.floor(now.getMonth() / 3) * 3;
    rangeStart = new Date(now.getFullYear(), qStartM, 1, 0, 0, 0, 0);
    rangeEnd = todayEnd;
    dateCoverageLabel = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
  } else if (period === 'This Year') {
    rangeStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    rangeEnd = todayEnd;
    dateCoverageLabel = `Calendar Year ${now.getFullYear()}`;
  } else if (period === 'Financial Year') {
    const defaultFyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fy = getIndianFinancialYearRange(fyStartYear ?? defaultFyStart);
    rangeStart = fy.start;
    rangeEnd = fy.end;
    dateCoverageLabel = `${fy.label} (01 Apr ${fyStartYear ?? defaultFyStart} – 31 Mar ${(fyStartYear ?? defaultFyStart) + 1})`;
  } else if (period === 'Custom') {
    if (customStartDate) rangeStart = new Date(`${customStartDate}T00:00:00`);
    if (customEndDate) rangeEnd = new Date(`${customEndDate}T23:59:59`);
    dateCoverageLabel = `Custom (${customStartDate || 'Start'} – ${customEndDate || 'Today'})`;
  }

  const activeAll = transactions.filter((t) => !t.isCancelled);
  const periodTx = activeAll.filter((tx) => {
    if (!rangeStart && !rangeEnd) return true;
    const dt = getTxDate(tx);
    if (!dt || Number.isNaN(dt.getTime())) return false;
    if (rangeStart && dt < rangeStart) return false;
    if (rangeEnd && dt > rangeEnd) return false;
    return true;
  });

  const sales = periodTx.filter((t) => t.type === 'Sale');
  const saleReturns = periodTx.filter((t) => t.type === 'Sale Return');
  const purchases = periodTx.filter(
    (t) =>
      t.type === 'Purchase' &&
      !t.invoiceNo.startsWith('PAYOUT-') &&
      !(t.notes && t.notes.toLowerCase().includes('payment-out'))
  );
  const purchaseReturns = periodTx.filter((t) => t.type === 'Purchase Return');
  const expenses = periodTx.filter((t) => t.type === 'Expense' && !t.invoiceNo.startsWith('DN-'));
  const otherIncomes = periodTx.filter((t) => t.type === 'Other Income');
  const paymentsIn = periodTx.filter((t) => t.type === 'Payment-In');

  // Trading & P&L figures
  const grossSalesExGst = sales.reduce((s, t) => s + getTxExGstSalesValue(t, includeTaxInProfit), 0);
  const salesReturnsExGst = saleReturns.reduce((s, t) => s + getTxExGstSalesValue(t, includeTaxInProfit), 0);
  const totalDiscounts = sales.reduce((s, t) => s + (t.totalDiscount || 0), 0);
  const netSalesExGst = Math.max(0, grossSalesExGst - salesReturnsExGst);

  const grossPurchasesExGst = purchases.reduce((s, t) => s + getTxExGstSalesValue(t, false), 0);
  const purchaseReturnsExGst = purchaseReturns.reduce((s, t) => s + getTxExGstSalesValue(t, false), 0);
  const directPurchaseExpenses = purchases.reduce(
    (s, t) => s + (Number(t.freightCharges) || 0) + (Number(t.otherPurchaseExpenses) || 0),
    0
  );
  const netPurchasesExGst = Math.max(0, grossPurchasesExGst - purchaseReturnsExGst + directPurchaseExpenses);

  // Closing Stock Value using selected costing method
  const closingStockValue = items.reduce((s, it) => {
    const qty = Math.max(0, Number(it.stock) || 0);
    if (qty <= 0) return s;
    const costInfo = resolveUnitCostForSale(it, qty, costingMethod, batches);
    return s + costInfo.totalCost;
  }, 0);

  const explicitOpeningSum = items.reduce((s, it) => {
    const op = Number(it.openingStock);
    if (!Number.isFinite(op) || op <= 0) return s;
    const cost = getItemWeightedAvgCost(it);
    return s + op * cost;
  }, 0);

  let cogs = 0;
  const prodAcc = new Map<
    string,
    {
      itemId?: string;
      name: string;
      category: string;
      qtySold: number;
      returnedQty: number;
      grossSales: number;
      discountsGiven: number;
      returnsValue: number;
      netSalesExGst: number;
      cogs: number;
    }
  >();

  let productLevelDiscounts = 0;
  let invoiceLevelDiscounts = 0;
  let couponDiscounts = 0;
  let lossCausedByDiscounts = 0;
  let lossMakingInvoicesCount = 0;
  let overDiscountedInvoicesCount = 0;

  const custProdAcc = new Map<
    string,
    {
      key: string;
      partyName: string;
      itemId?: string;
      productName: string;
      brand: string;
      category: string;
      unit: string;
      qtySold: number;
      returnedQty: number;
      grossSales: number;
      discountsGiven: number;
      returnsValue: number;
      netRevenueExGst: number;
      cogs: number;
    }
  >();

  sales.forEach((tx) => {
    const txCogs = getTxHistoricalCogs(tx, itemByName, costingMethod, batches);
    cogs += txCogs;

    const txExGst = getTxExGstSalesValue(tx, includeTaxInProfit);
    const txGrossProfit = txExGst - txCogs;
    const txTotalDisc = Number(tx.totalDiscount) || 0;

    if (txGrossProfit < -0.01 || tx.isLossInvoice) {
      lossMakingInvoicesCount += 1;
      if (txTotalDisc > 0) {
        lossCausedByDiscounts += Math.abs(txGrossProfit);
      }
    }

    const txGrossSubtotal = Number(tx.subtotal) || tx.items.reduce((s, li) => s + (li.qty || 0) * (li.price || 0), 0);
    if (txGrossSubtotal > 0 && (txTotalDisc / txGrossSubtotal) * 100 > maxDiscountPct) {
      overDiscountedInvoicesCount += 1;
    }

    couponDiscounts += Number(tx.couponDiscount) || 0;

    if (tx.items && tx.items.length > 0) {
      const lineDiscTotal = tx.items.reduce((s, li) => {
        const g = (li.qty || 0) * (li.price || 0);
        return s + (li.discountAmount ?? (g * (li.discountPercent || 0)) / 100);
      }, 0);
      productLevelDiscounts += lineDiscTotal;
      invoiceLevelDiscounts += Math.max(0, txTotalDisc - lineDiscTotal - (Number(tx.couponDiscount) || 0));

      const lineTotalAmountSum = tx.items.reduce((s, li) => s + (li.amount || (li.qty || 0) * (li.price || 0)), 0);
      const partyLabel = (tx.partyName || 'Cash Sale').trim();

      tx.items.forEach((li) => {
        const key = (li.name || '').trim().toLowerCase();
        const matched = itemByName.get(key) || (li.hsn ? itemByName.get(`code:${li.hsn.trim().toLowerCase()}`) : undefined);
        const qty = Math.max(0, Number(li.qty) || 0);
        const targetUnit = normalizeUnitCode(matched?.unit || li.unit || 'PCS');
        const normalizedQty = matched
          ? convertUnitQty(qty, li.unit || matched.unit, matched.unit, matched.unitConversion)
          : qty;
        const gross = qty * (Number(li.price) || 0);
        const disc = li.discountAmount ?? (gross * (li.discountPercent || 0)) / 100;
        const lineShare = lineTotalAmountSum > 0 ? (li.amount || gross - disc) / lineTotalAmountSum : 1 / tx.items.length;
        const lineExGst = txExGst * lineShare;
        const lineCost =
          typeof li.totalCost === 'number'
            ? li.totalCost
            : typeof li.unitCostAtSale === 'number'
            ? li.unitCostAtSale * qty
            : matched
            ? resolveUnitCostForSale(matched, normalizedQty, costingMethod, batches, li.batchNo).totalCost
            : lineExGst * 0.78;

        const prev = prodAcc.get(key) || {
          itemId: matched?.id,
          name: matched?.name || li.name,
          category: matched?.category || 'General',
          qtySold: 0,
          returnedQty: 0,
          grossSales: 0,
          discountsGiven: 0,
          returnsValue: 0,
          netSalesExGst: 0,
          cogs: 0,
        };
        prev.qtySold += normalizedQty;
        prev.grossSales += gross;
        prev.discountsGiven += disc;
        prev.netSalesExGst += lineExGst;
        prev.cogs += lineCost;
        prodAcc.set(key, prev);

        const brandName = (li.brand || matched?.brand || 'Unbranded').trim() || 'Unbranded';
        const prodName = matched?.name || li.name;
        const cpKey = `${partyLabel.toLowerCase()}::${prodName.toLowerCase()}::${brandName.toLowerCase()}`;
        const prevCp = custProdAcc.get(cpKey) || {
          key: cpKey,
          partyName: partyLabel,
          itemId: li.itemId || matched?.id,
          productName: prodName,
          brand: brandName,
          category: matched?.category || 'General',
          unit: targetUnit,
          qtySold: 0,
          returnedQty: 0,
          grossSales: 0,
          discountsGiven: 0,
          returnsValue: 0,
          netRevenueExGst: 0,
          cogs: 0,
        };
        prevCp.qtySold += normalizedQty;
        prevCp.grossSales += gross;
        prevCp.discountsGiven += disc;
        prevCp.netRevenueExGst += lineExGst;
        prevCp.cogs += lineCost;
        custProdAcc.set(cpKey, prevCp);
      });
    } else {
      invoiceLevelDiscounts += Math.max(0, txTotalDisc - (Number(tx.couponDiscount) || 0));
    }
  });

  // Subtract returned COGS & quantities on Sale Return
  saleReturns.forEach((tx) => {
    const retCogs = getTxHistoricalCogs(tx, itemByName, costingMethod, batches);
    cogs = Math.max(0, cogs - retCogs);
    const retExGst = getTxExGstSalesValue(tx, includeTaxInProfit);
    const totalLineAmt = tx.items.reduce((s, li) => s + (li.amount || (li.qty || 0) * (li.price || 0)), 0);
    const partyLabel = (tx.partyName || 'Cash Sale').trim();

    (tx.items || []).forEach((li) => {
      const key = (li.name || '').trim().toLowerCase();
      const matched = itemByName.get(key);
      const qty = Math.max(0, Number(li.qty) || 0);
      const targetUnit = normalizeUnitCode(matched?.unit || li.unit || 'PCS');
      const normalizedQty = matched
        ? convertUnitQty(qty, li.unit || matched.unit, matched.unit, matched.unitConversion)
        : qty;
      const lineShare = totalLineAmt > 0 ? (li.amount || qty * (li.price || 0)) / totalLineAmt : 1 / Math.max(1, tx.items.length);
      const lineRetExGst = retExGst * lineShare;
      const lineRetCost =
        typeof li.totalCost === 'number'
          ? li.totalCost
          : typeof li.unitCostAtSale === 'number'
          ? li.unitCostAtSale * qty
          : matched
          ? resolveUnitCostForSale(matched, normalizedQty, costingMethod, batches, li.batchNo).totalCost
          : lineRetExGst * 0.78;

      const prev = prodAcc.get(key) || {
        itemId: matched?.id,
        name: matched?.name || li.name,
        category: matched?.category || 'General',
        qtySold: 0,
        returnedQty: 0,
        grossSales: 0,
        discountsGiven: 0,
        returnsValue: 0,
        netSalesExGst: 0,
        cogs: 0,
      };
      prev.returnedQty += normalizedQty;
      prev.returnsValue += lineRetExGst;
      prev.netSalesExGst = Math.max(0, prev.netSalesExGst - lineRetExGst);
      prev.cogs = Math.max(0, prev.cogs - lineRetCost);
      prodAcc.set(key, prev);

      const brandName = (li.brand || matched?.brand || 'Unbranded').trim() || 'Unbranded';
      const prodName = matched?.name || li.name;
      const cpKey = `${partyLabel.toLowerCase()}::${prodName.toLowerCase()}::${brandName.toLowerCase()}`;
      const prevCp = custProdAcc.get(cpKey) || {
        key: cpKey,
        partyName: partyLabel,
        itemId: li.itemId || matched?.id,
        productName: prodName,
        brand: brandName,
        category: matched?.category || 'General',
        unit: targetUnit,
        qtySold: 0,
        returnedQty: 0,
        grossSales: 0,
        discountsGiven: 0,
        returnsValue: 0,
        netRevenueExGst: 0,
        cogs: 0,
      };
      prevCp.returnedQty += normalizedQty;
      prevCp.returnsValue += lineRetExGst;
      prevCp.netRevenueExGst = Math.max(0, prevCp.netRevenueExGst - lineRetExGst);
      prevCp.cogs = Math.max(0, prevCp.cogs - lineRetCost);
      custProdAcc.set(cpKey, prevCp);
    });
  });

  const openingStockValue = explicitOpeningSum > 0 ? explicitOpeningSum : Math.max(0, closingStockValue + cogs - netPurchasesExGst);

  const grossProfit = netSalesExGst - cogs;
  const grossMarginPercent = netSalesExGst > 0 ? (grossProfit / netSalesExGst) * 100 : 0;

  const indirectExpensesTotal = expenses.reduce((s, t) => s + (t.totalAmount || 0), 0);
  const otherIncome = otherIncomes.reduce((s, t) => s + (t.totalAmount || 0), 0);
  const includeExp = profitCfg?.includeExpensesInNetProfit !== false;
  const netProfit = grossProfit + otherIncome - (includeExp ? indirectExpensesTotal : 0);
  const netMarginPercent = netSalesExGst > 0 ? (netProfit / netSalesExGst) * 100 : 0;

  // Expenses by category
  const expCatMap = new Map<string, number>();
  expenses.forEach((e) => {
    const cat = (e.expenseCategory || e.partyName || 'Other Expenses').trim();
    expCatMap.set(cat, (expCatMap.get(cat) || 0) + (e.totalAmount || 0));
  });
  const expenseByCategory = Array.from(expCatMap.entries())
    .map(([category, amount]) => ({
      category,
      amount: r2(amount),
      sharePercent: indirectExpensesTotal > 0 ? r2((amount / indirectExpensesTotal) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // GST summary (with ITC eligibility)
  const gstCollectedOutput =
    sales.reduce((s, t) => s + (t.cgstAmount || 0) + (t.sgstAmount || 0) + (t.igstAmount || 0), 0) -
    saleReturns.reduce((s, t) => s + (t.cgstAmount || 0) + (t.sgstAmount || 0) + (t.igstAmount || 0), 0);

  let gstInputEligible = 0;
  let gstInputNonCreditable = 0;
  purchases.forEach((p) => {
    const tax = (p.cgstAmount || 0) + (p.sgstAmount || 0) + (p.igstAmount || 0);
    if (p.gstInputCreditEligible === false) gstInputNonCreditable += tax;
    else gstInputEligible += tax;
  });
  purchaseReturns.forEach((pr) => {
    const tax = (pr.cgstAmount || 0) + (pr.sgstAmount || 0) + (pr.igstAmount || 0);
    gstInputEligible = Math.max(0, gstInputEligible - tax);
  });
  const netGstLiability = Math.max(0, gstCollectedOutput - gstInputEligible);

  // Cash vs Accrual Analysis
  const cashSales = sales.filter((t) => t.paymentType === 'Cash').reduce((s, t) => s + (t.receivedAmount || 0), 0);
  const upiAndBankSales = sales
    .filter((t) => t.paymentType === 'UPI' || t.paymentType === 'Bank Transfer' || t.paymentType === 'Cheque')
    .reduce((s, t) => s + (t.receivedAmount || 0), 0);
  const creditSales = sales.reduce((s, t) => s + (t.balance || 0), 0);
  const cashReceivedFromCollections = paymentsIn.reduce((s, t) => s + (t.receivedAmount || t.totalAmount || 0), 0);
  const totalCashAndBankInflow = cashSales + upiAndBankSales + cashReceivedFromCollections;
  const totalCashOutflowPurchases = purchases.reduce((s, t) => s + (t.receivedAmount || 0), 0);
  const operatingCashFlow = totalCashAndBankInflow - totalCashOutflowPurchases - indirectExpensesTotal;

  const customerReceivables = parties
    .filter((p) => (p.type === 'Customer' || !p.type) && (p.balance || 0) > 0)
    .reduce((s, p) => s + p.balance, 0);
  const supplierPayables = parties
    .filter((p) => p.type === 'Supplier' && (p.balance || 0) > 0)
    .reduce((s, p) => s + p.balance, 0);

  // Period Comparisons
  const filterRange = (start: Date, end: Date) =>
    activeAll.filter((tx) => {
      const dt = getTxDate(tx);
      return Boolean(dt && dt >= start && dt <= end);
    });

  const calcGrowth = (curr: number, prev: number) =>
    prev !== 0 ? r2(((curr - prev) / Math.abs(prev)) * 100) : curr > 0 ? 100 : 0;

  const todaySnap = computeSnapshotMetrics('Today', filterRange(todayStart, todayEnd), itemByName, costingMethod, batches, includeTaxInProfit);
  const yestSnap = computeSnapshotMetrics('Yesterday', filterRange(yesterdayStart, yesterdayEnd), itemByName, costingMethod, batches, includeTaxInProfit);

  const wStart = new Date(todayStart);
  wStart.setDate(wStart.getDate() - 6);
  const lwStart = new Date(wStart);
  lwStart.setDate(lwStart.getDate() - 7);
  const lwEnd = new Date(wStart.getTime() - 1);
  const thisWeekSnap = computeSnapshotMetrics('This Week', filterRange(wStart, todayEnd), itemByName, costingMethod, batches, includeTaxInProfit);
  const lastWeekSnap = computeSnapshotMetrics('Last Week', filterRange(lwStart, lwEnd), itemByName, costingMethod, batches, includeTaxInProfit);

  const mStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const thisMonthSnap = computeSnapshotMetrics('This Month', filterRange(mStart, todayEnd), itemByName, costingMethod, batches, includeTaxInProfit);
  const lastMonthSnap = computeSnapshotMetrics('Last Month', filterRange(lmStart, lmEnd), itemByName, costingMethod, batches, includeTaxInProfit);

  const yStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const lyStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
  const lyEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  const thisYearSnap = computeSnapshotMetrics('This Year', filterRange(yStart, todayEnd), itemByName, costingMethod, batches, includeTaxInProfit);
  const lastYearSnap = computeSnapshotMetrics('Last Year', filterRange(lyStart, lyEnd), itemByName, costingMethod, batches, includeTaxInProfit);

  // Trend series
  const trendMap = new Map<string, { label: string; sortKey: number; sales: number; cogs: number; expenses: number }>();
  const dailyBucket = period === 'Today' || period === 'Yesterday' || period === 'This Week';
  periodTx.forEach((tx) => {
    if (tx.type !== 'Sale' && tx.type !== 'Expense') return;
    const dt = getTxDate(tx);
    if (!dt) return;
    const label = dailyBucket
      ? dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      : dt.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    const sortKey = dailyBucket
      ? new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime()
      : new Date(dt.getFullYear(), dt.getMonth(), 1).getTime();

    const cur = trendMap.get(label) || { label, sortKey, sales: 0, cogs: 0, expenses: 0 };
    if (tx.type === 'Sale') {
      cur.sales += getTxExGstSalesValue(tx, includeTaxInProfit);
      cur.cogs += getTxHistoricalCogs(tx, itemByName, costingMethod, batches);
    } else if (tx.type === 'Expense' && !tx.invoiceNo.startsWith('DN-')) {
      cur.expenses += tx.totalAmount || 0;
    }
    trendMap.set(label, cur);
  });

  const trendSeries = Array.from(trendMap.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(-10)
    .map((b) => {
      const gp = b.sales - b.cogs;
      return {
        label: b.label,
        sales: r2(b.sales),
        cogs: r2(b.cogs),
        expenses: r2(b.expenses),
        grossProfit: r2(gp),
        netProfit: r2(gp - b.expenses),
      };
    });

  // Product P&L + Performance Score
  const productRows: ProductPLRow[] = Array.from(prodAcc.values()).map((p) => {
    const gp = p.netSalesExGst - p.cogs;
    const marginPct = p.netSalesExGst > 0 ? (gp / p.netSalesExGst) * 100 : gp < 0 ? -100 : 0;
    const netQty = Math.max(0, p.qtySold - p.returnedQty);
    const returnRate = p.qtySold > 0 ? p.returnedQty / p.qtySold : 0;
    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (marginPct < 0 ? 15 : Math.min(60, marginPct * 2.2)) +
            Math.min(30, netQty * 2.5) +
            Math.max(0, 10 - returnRate * 40)
        )
      )
    );
    const performanceTier: ProductPLRow['performanceTier'] =
      gp < -0.01
        ? 'Loss-Making'
        : marginPct >= targetMarginPct
        ? 'High Profit'
        : marginPct >= 10
        ? 'Profitable'
        : marginPct >= minMarginPct
        ? 'Average'
        : 'Low Margin';

    return {
      itemId: p.itemId,
      name: p.name,
      category: p.category,
      qtySold: p.qtySold,
      returnedQty: p.returnedQty,
      netQty,
      grossSales: r2(p.grossSales),
      discountsGiven: r2(p.discountsGiven),
      returnsValue: r2(p.returnsValue),
      netSalesExGst: r2(p.netSalesExGst),
      cogs: r2(p.cogs),
      grossProfit: r2(gp),
      marginPercent: r2(marginPct),
      isLossMaking: gp < -0.01,
      performanceScore: score,
      performanceTier,
    };
  });

  // Category P&L
  const catAcc = new Map<string, { category: string; netQty: number; netSales: number; cogs: number; grossProfit: number }>();
  productRows.forEach((pr) => {
    const prev = catAcc.get(pr.category) || { category: pr.category, netQty: 0, netSales: 0, cogs: 0, grossProfit: 0 };
    prev.netQty += pr.netQty;
    prev.netSales += pr.netSalesExGst;
    prev.cogs += pr.cogs;
    prev.grossProfit += pr.grossProfit;
    catAcc.set(pr.category, prev);
  });
  const categoryRows = Array.from(catAcc.values())
    .map((c) => ({
      category: c.category,
      netQty: c.netQty,
      netSales: r2(c.netSales),
      cogs: r2(c.cogs),
      grossProfit: r2(c.grossProfit),
      marginPercent: c.netSales > 0 ? r2((c.grossProfit / c.netSales) * 100) : 0,
    }))
    .sort((a, b) => b.grossProfit - a.grossProfit);

  // Customer-wise P&L
  const custAcc = new Map<
    string,
    {
      partyName: string;
      invoiceCount: number;
      grossPurchases: number;
      discountsGiven: number;
      returnsAmount: number;
      netRevenueExGst: number;
      cogs: number;
    }
  >();
  sales.forEach((tx) => {
    const key = (tx.partyName || 'Cash Sale').trim();
    const prev = custAcc.get(key) || {
      partyName: key,
      invoiceCount: 0,
      grossPurchases: 0,
      discountsGiven: 0,
      returnsAmount: 0,
      netRevenueExGst: 0,
      cogs: 0,
    };
    prev.invoiceCount += 1;
    prev.grossPurchases += tx.totalAmount || 0;
    prev.discountsGiven += tx.totalDiscount || 0;
    prev.netRevenueExGst += getTxExGstSalesValue(tx, includeTaxInProfit);
    prev.cogs += getTxHistoricalCogs(tx, itemByName, costingMethod, batches);
    custAcc.set(key, prev);
  });
  saleReturns.forEach((tx) => {
    const key = (tx.partyName || 'Cash Sale').trim();
    const prev = custAcc.get(key) || {
      partyName: key,
      invoiceCount: 0,
      grossPurchases: 0,
      discountsGiven: 0,
      returnsAmount: 0,
      netRevenueExGst: 0,
      cogs: 0,
    };
    const retExGst = getTxExGstSalesValue(tx, includeTaxInProfit);
    const retCogs = getTxHistoricalCogs(tx, itemByName, costingMethod, batches);
    prev.returnsAmount += tx.totalAmount || 0;
    prev.netRevenueExGst = Math.max(0, prev.netRevenueExGst - retExGst);
    prev.cogs = Math.max(0, prev.cogs - retCogs);
    custAcc.set(key, prev);
  });
  const customerRows: CustomerPLRow[] = Array.from(custAcc.values())
    .map((c) => {
      const party = parties.find((p) => p.name.trim().toLowerCase() === c.partyName.toLowerCase());
      const gp = c.netRevenueExGst - c.cogs;
      return {
        partyName: c.partyName,
        invoiceCount: c.invoiceCount,
        grossPurchases: r2(c.grossPurchases),
        discountsGiven: r2(c.discountsGiven),
        returnsAmount: r2(c.returnsAmount),
        netRevenueExGst: r2(c.netRevenueExGst),
        cogs: r2(c.cogs),
        grossProfit: r2(gp),
        marginPercent: c.netRevenueExGst > 0 ? r2((gp / c.netRevenueExGst) * 100) : 0,
        outstandingBalance: r2(party?.balance || 0),
      };
    })
    .sort((a, b) => b.grossProfit - a.grossProfit);

  const customerProductBrandRows: CustomerProductBrandItemPLRow[] = Array.from(custProdAcc.values())
    .map((cp) => {
      const gp = cp.netRevenueExGst - cp.cogs;
      const netQty = Math.max(0, Math.round((cp.qtySold - cp.returnedQty) * 1000) / 1000);
      return {
        key: cp.key,
        partyName: cp.partyName,
        itemId: cp.itemId,
        productName: cp.productName,
        brand: cp.brand,
        category: cp.category,
        unit: cp.unit,
        qtySold: Math.round(cp.qtySold * 1000) / 1000,
        returnedQty: Math.round(cp.returnedQty * 1000) / 1000,
        netQty,
        grossSales: r2(cp.grossSales),
        discountsGiven: r2(cp.discountsGiven),
        returnsValue: r2(cp.returnsValue),
        netRevenueExGst: r2(cp.netRevenueExGst),
        cogs: r2(cp.cogs),
        grossProfit: r2(gp),
        marginPercent: cp.netRevenueExGst > 0 ? r2((gp / cp.netRevenueExGst) * 100) : 0,
      };
    })
    .sort((a, b) => b.grossProfit - a.grossProfit);

  // Reconciliation Checks
  const allSalesGross = activeAll.filter((t) => t.type === 'Sale').reduce((s, t) => s + (t.totalAmount || 0), 0);
  const postedSaleJvs = journalVouchers
    .filter((jv) => jv.voucherType === 'Sales')
    .reduce((s, jv) => s + (jv.totalDebit || 0), 0);
  const saleJvDiff = r2(allSalesGross - postedSaleJvs);

  const allPurchasesGross = activeAll
    .filter((t) => t.type === 'Purchase' && !t.invoiceNo.startsWith('PAYOUT-') && !(t.notes && t.notes.toLowerCase().includes('payment-out')))
    .reduce((s, t) => s + (t.totalAmount || 0), 0);
  const postedPurJvs = journalVouchers
    .filter((jv) => jv.voucherType === 'Purchase')
    .reduce((s, jv) => s + (jv.totalDebit || 0), 0);
  const purJvDiff = r2(allPurchasesGross - postedPurJvs);

  const negativeStockItems = items.filter((i) => (i.stock || 0) < 0);
  const unverifiedHsnItems = items.filter((i) => (i.taxRate || 0) > 0 && !(i.hsnCode || i.code));
  const missingCostItems = items.filter((i) => (i.purchasePrice || 0) <= 0 && (i.lastPurchasePrice || 0) <= 0 && (i.weightedAvgCost || 0) <= 0);

  const reconciliationChecks: ReconciliationCheck[] = [
    {
      id: 'rec-sales-jv',
      area: 'Sales Invoices vs Sales Ledger Vouchers',
      status: Math.abs(saleJvDiff) <= 1 ? 'Matched' : 'Variance',
      expectedValue: r2(allSalesGross),
      actualValue: r2(postedSaleJvs),
      difference: saleJvDiff,
      detail:
        Math.abs(saleJvDiff) <= 1
          ? 'All active sales invoices are synchronized with Double-Entry Sales Journal Vouchers.'
          : `₹${Math.abs(saleJvDiff).toLocaleString('en-IN')} difference between Sales Register and posted Sales JVs (legacy or unposted vouchers).`,
      targetTab: 'sale-invoices',
    },
    {
      id: 'rec-pur-jv',
      area: 'Purchase Bills vs Purchase Ledger Vouchers',
      status: Math.abs(purJvDiff) <= 1 ? 'Matched' : 'Variance',
      expectedValue: r2(allPurchasesGross),
      actualValue: r2(postedPurJvs),
      difference: purJvDiff,
      detail:
        Math.abs(purJvDiff) <= 1
          ? 'All supplier purchase bills reconcile cleanly with Purchase Journal Vouchers.'
          : `₹${Math.abs(purJvDiff).toLocaleString('en-IN')} variance between Purchase Register and Purchase JVs.`,
      targetTab: 'purchase-bills',
    },
    {
      id: 'rec-inv-cost',
      area: 'Inventory Valuation & Product Cost Completeness',
      status: negativeStockItems.length === 0 && missingCostItems.length === 0 ? 'Matched' : 'Review Needed',
      expectedValue: items.length,
      actualValue: items.length - missingCostItems.length - negativeStockItems.length,
      difference: missingCostItems.length + negativeStockItems.length,
      detail:
        negativeStockItems.length + missingCostItems.length === 0
          ? `All ${items.length} products have valid positive cost & non-negative stock under ${costingMethod}.`
          : `${missingCostItems.length} item(s) missing purchase cost; ${negativeStockItems.length} item(s) have negative stock.`,
      targetTab: 'items',
    },
    {
      id: 'rec-gst-itc',
      area: 'GST Output Tax vs Eligible Input Tax Credit',
      status: unverifiedHsnItems.length === 0 ? 'Matched' : 'Review Needed',
      expectedValue: r2(gstCollectedOutput),
      actualValue: r2(gstInputEligible),
      difference: r2(netGstLiability),
      detail: `Output GST ₹${r2(gstCollectedOutput).toLocaleString('en-IN')} − Eligible ITC ₹${r2(gstInputEligible).toLocaleString('en-IN')} = Net Payable ₹${r2(netGstLiability).toLocaleString('en-IN')}. ${unverifiedHsnItems.length} taxed item(s) need HSN verification.`,
      targetTab: 'reports',
    },
  ];

  // Smart Selling Price Recommendations (Admin review only, never auto-modified)
  const priceRecommendations: PriceRecommendationRow[] = items
    .map((it) => {
      const currentCost = getItemLastPurchasePrice(it);
      const waCost = getItemWeightedAvgCost(it);
      const effectiveCost = costingMethod === 'Last Purchase Price' ? currentCost : waCost;
      const sale = Number(it.salePrice) || 0;
      const taxPct = Number(it.taxRate) || 0;
      const exGstSale = it.taxInclusive && taxPct > 0 ? sale / (1 + taxPct / 100) : sale;
      const gp = exGstSale - effectiveCost;
      const margin = exGstSale > 0 ? (gp / exGstSale) * 100 : 0;
      const itemTargetMargin = it.targetMarginPercent ?? targetMarginPct;
      const denom = Math.max(0.05, 1 - itemTargetMargin / 100);
      const recommendedExGst = effectiveCost / denom;
      const recommendedDisplay = it.taxInclusive && taxPct > 0 ? recommendedExGst * (1 + taxPct / 100) : recommendedExGst;
      const minProfitDisplay = it.taxInclusive && taxPct > 0 ? effectiveCost * (1 + taxPct / 100) : effectiveCost;

      const status: PriceRecommendationRow['status'] =
        gp < 0 ? 'Loss-Making' : margin < itemTargetMargin ? 'Below Target' : 'Healthy';

      return {
        itemId: it.id,
        name: it.name,
        category: it.category || 'General',
        currentPurchasePrice: r2(currentCost),
        weightedAvgCost: r2(waCost),
        currentSalePrice: r2(sale),
        currentGrossProfitPerUnit: r2(gp),
        currentMarginPercent: r2(margin),
        minProfitablePrice: Math.ceil(minProfitDisplay),
        recommendedSalePrice: Math.ceil(recommendedDisplay),
        targetMarginPercent: itemTargetMargin,
        status,
        reason:
          status === 'Loss-Making'
            ? `Selling below cost by ₹${r2(Math.abs(gp))}/unit`
            : status === 'Below Target'
            ? `Margin ${r2(margin)}% is below ${itemTargetMargin}% target`
            : `Healthy ${r2(margin)}% margin`,
      };
    })
    .filter((r) => r.currentPurchasePrice > 0 || r.weightedAvgCost > 0)
    .sort((a, b) => a.currentMarginPercent - b.currentMarginPercent);

  // Dead Stock Analyzer (30 / 60 / 90 days)
  const lastSaleDateByItem = new Map<string, Date>();
  activeAll
    .filter((t) => t.type === 'Sale')
    .forEach((tx) => {
      const dt = getTxDate(tx);
      if (!dt) return;
      (tx.items || []).forEach((li) => {
        const k = li.name.trim().toLowerCase();
        const prev = lastSaleDateByItem.get(k);
        if (!prev || dt > prev) lastSaleDateByItem.set(k, dt);
      });
    });

  const deadRows: DeadStockBucketRow[] = [];
  let count30Days = 0;
  let count60Days = 0;
  let count90Days = 0;
  let totalCapitalBlocked = 0;

  items.forEach((it) => {
    const stock = Math.max(0, Number(it.stock) || 0);
    if (stock <= 0) return;
    const unitCost = resolveUnitCostForSale(it, stock, costingMethod, batches).unitCost;
    const capital = r2(stock * unitCost);
    const lastDt = lastSaleDateByItem.get(it.name.trim().toLowerCase());
    const daysSince = lastDt ? Math.floor((now.getTime() - lastDt.getTime()) / 86400000) : null;

    // Check expiring batches
    const expSoonBatch = batches.find((b) => {
      if (b.qty <= 0 || !b.expiryDate) return false;
      if (b.itemId !== it.id && b.itemName.toLowerCase() !== it.name.toLowerCase()) return false;
      const expDt = new Date(b.expiryDate);
      const diff = (expDt.getTime() - now.getTime()) / 86400000;
      return !Number.isNaN(diff) && diff <= 30;
    });

    if (daysSince === null || daysSince >= 90) {
      count90Days += 1;
      totalCapitalBlocked += capital;
      deadRows.push({
        itemId: it.id,
        name: it.name,
        category: it.category || 'General',
        stock,
        unit: it.unit || 'PCS',
        unitCost,
        capitalBlocked: capital,
        daysSinceLastSale: daysSince,
        bucket: '90+ Days Dead',
        recommendation: 'Run combo bundle or clearance promo above min safe price; pause reorders.',
      });
    } else if (daysSince >= 60) {
      count60Days += 1;
      totalCapitalBlocked += capital;
      deadRows.push({
        itemId: it.id,
        name: it.name,
        category: it.category || 'General',
        stock,
        unit: it.unit || 'PCS',
        unitCost,
        capitalBlocked: capital,
        daysSinceLastSale: daysSince,
        bucket: '60-89 Days Dead',
        recommendation: 'Feature at POS checkout counter with safe 5% bundle discount.',
      });
    } else if (daysSince >= 30) {
      count30Days += 1;
      totalCapitalBlocked += capital;
      deadRows.push({
        itemId: it.id,
        name: it.name,
        category: it.category || 'General',
        stock,
        unit: it.unit || 'PCS',
        unitCost,
        capitalBlocked: capital,
        daysSinceLastSale: daysSince,
        bucket: '30-59 Days Slow',
        recommendation: 'Monitor velocity; avoid fresh purchase until stock dips below threshold.',
      });
    } else if (expSoonBatch) {
      deadRows.push({
        itemId: it.id,
        name: it.name,
        category: it.category || 'General',
        stock,
        unit: it.unit || 'PCS',
        unitCost,
        capitalBlocked: capital,
        daysSinceLastSale: daysSince,
        bucket: 'Expiring Soon',
        recommendation: `Prioritize batch ${expSoonBatch.batchNumber} (Exp ${expSoonBatch.expiryDate}) via FEFO.`,
      });
    } else if (it.maxStockLevel && stock > it.maxStockLevel) {
      deadRows.push({
        itemId: it.id,
        name: it.name,
        category: it.category || 'General',
        stock,
        unit: it.unit || 'PCS',
        unitCost,
        capitalBlocked: capital,
        daysSinceLastSale: daysSince,
        bucket: 'Overstocked',
        recommendation: `Stock (${stock}) exceeds max level (${it.maxStockLevel}). Freeze reorders.`,
      });
    }
  });
  deadRows.sort((a, b) => b.capitalBlocked - a.capitalBlocked);

  // AI Sales Forecasting (historical active daily trend + 30-day projection with confidence intervals)
  const dailyMap = new Map<string, { revenue: number; gp: number }>();
  activeAll
    .filter((t) => t.type === 'Sale')
    .forEach((tx) => {
      const dt = getTxDate(tx);
      if (!dt) return;
      const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const rev = getTxExGstSalesValue(tx, includeTaxInProfit);
      const c = getTxHistoricalCogs(tx, itemByName, costingMethod, batches);
      const prev = dailyMap.get(k) || { revenue: 0, gp: 0 };
      prev.revenue += rev;
      prev.gp += rev - c;
      dailyMap.set(k, prev);
    });

  const sortedDailyEntries = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const dailyHistorySeries: DailyForecastHistoryPoint[] = sortedDailyEntries
    .slice(-30)
    .map(([dateIso, val]) => {
      const d = new Date(`${dateIso}T00:00:00`);
      return {
        dateIso,
        label: Number.isNaN(d.getTime()) ? dateIso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        revenue: r2(val.revenue),
        grossProfit: r2(val.gp),
      };
    });

  const sampleActiveDays = sortedDailyEntries.length;
  const dailyVals = sortedDailyEntries.map((e) => e[1]);
  const avgDailyRevenue =
    sampleActiveDays > 0 ? dailyVals.reduce((s, d) => s + d.revenue, 0) / sampleActiveDays : 0;
  const avgDailyGrossProfit =
    sampleActiveDays > 0 ? dailyVals.reduce((s, d) => s + d.gp, 0) / sampleActiveDays : 0;

  // Compute linear trend slope & standard deviation for 80% confidence interval band
  const calcLinearAndStd = (series: number[]) => {
    const n = series.length;
    if (n === 0) return { intercept: 0, slope: 0, stdErr: 0 };
    const meanY = series.reduce((s, v) => s + v, 0) / n;
    if (n === 1) return { intercept: meanY, slope: 0, stdErr: Math.max(meanY * 0.2, 50) };
    const meanX = (n - 1) / 2;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - meanX) * (series[i] - meanY);
      den += (i - meanX) * (i - meanX);
    }
    const rawSlope = den > 0 ? num / den : 0;
    // Dampen extreme slopes on sparse history so projections remain grounded
    const maxDailyStep = Math.max(meanY * 0.03, 1);
    const slope = Math.max(-maxDailyStep, Math.min(maxDailyStep, rawSlope * 0.45));
    const intercept = meanY - slope * meanX;
    let sqErr = 0;
    for (let i = 0; i < n; i++) {
      const pred = intercept + slope * i;
      sqErr += (series[i] - pred) * (series[i] - pred);
    }
    const variance = n > 2 ? sqErr / (n - 2) : sqErr / Math.max(1, n - 1);
    const stdErr = Math.max(Math.sqrt(variance), meanY * 0.12);
    return { intercept, slope, stdErr };
  };

  const revSeries = dailyHistorySeries.map((d) => d.revenue);
  const gpSeries = dailyHistorySeries.map((d) => d.grossProfit);
  const revModel = calcLinearAndStd(revSeries);
  const gpModel = calcLinearAndStd(gpSeries);
  const baseAnchorDate =
    sortedDailyEntries.length > 0
      ? new Date(`${sortedDailyEntries[sortedDailyEntries.length - 1][0]}T00:00:00`)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const zScore = 1.28; // ~80% prediction confidence interval
  const projected30DaysSeries: Projected30DayPoint[] = [];
  for (let h = 1; h <= 30; h++) {
    const futureDt = new Date(baseAnchorDate);
    futureDt.setDate(futureDt.getDate() + h);
    const dateIso = `${futureDt.getFullYear()}-${String(futureDt.getMonth() + 1).padStart(2, '0')}-${String(futureDt.getDate()).padStart(2, '0')}`;
    const label = futureDt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const horizonIdx = Math.max(0, revSeries.length - 1) + h;
    const horizonSpread = Math.sqrt(1 + h / 18);

    const revCenter = Math.max(0, revModel.intercept + revModel.slope * horizonIdx);
    const revBand = revModel.stdErr * zScore * horizonSpread;
    const gpCenter = gpModel.intercept + gpModel.slope * horizonIdx;
    const gpBand = gpModel.stdErr * zScore * horizonSpread;

    projected30DaysSeries.push({
      dayOffset: h,
      dateIso,
      label,
      projectedRevenue: r2(revCenter),
      revenueLower: r2(Math.max(0, revCenter - revBand)),
      revenueUpper: r2(revCenter + revBand),
      projectedGrossProfit: r2(gpCenter),
      grossProfitLower: r2(gpCenter - gpBand),
      grossProfitUpper: r2(gpCenter + gpBand),
    });
  }

  const next7DaysRevenue = projected30DaysSeries.slice(0, 7).reduce((s, p) => s + p.projectedRevenue, 0);
  const next7DaysGrossProfit = projected30DaysSeries.slice(0, 7).reduce((s, p) => s + p.projectedGrossProfit, 0);
  const next30DaysRevenue = projected30DaysSeries.reduce((s, p) => s + p.projectedRevenue, 0);
  const next30DaysGrossProfit = projected30DaysSeries.reduce((s, p) => s + p.projectedGrossProfit, 0);
  const next30DaysRevenueLower = projected30DaysSeries.reduce((s, p) => s + p.revenueLower, 0);
  const next30DaysRevenueUpper = projected30DaysSeries.reduce((s, p) => s + p.revenueUpper, 0);
  const next30DaysGrossProfitLower = projected30DaysSeries.reduce((s, p) => s + p.grossProfitLower, 0);
  const next30DaysGrossProfitUpper = projected30DaysSeries.reduce((s, p) => s + p.grossProfitUpper, 0);

  const confidence: 'High' | 'Moderate' | 'Low' =
    sampleActiveDays >= 21 ? 'High' : sampleActiveDays >= 7 ? 'Moderate' : 'Low';
  const forecastNotice =
    sampleActiveDays === 0
      ? 'No completed sales history found yet to compute a forecast.'
      : sampleActiveDays < 14
      ? `Based on ${sampleActiveDays} active sale day(s) — confidence is ${confidence} until at least 14 days of history accumulate.`
      : `Calculated from ${sampleActiveDays} active trading days using ex-GST revenue and ${costingMethod} COGS with 80% confidence interval bands.`;

  // Expense Optimizer
  const momChangePct =
    lastMonthSnap.expenses > 0
      ? r2(((thisMonthSnap.expenses - lastMonthSnap.expenses) / lastMonthSnap.expenses) * 100)
      : thisMonthSnap.expenses > 0
      ? 100
      : 0;
  const expenseToSalesRatioPct = netSalesExGst > 0 ? r2((indirectExpensesTotal / netSalesExGst) * 100) : 0;
  const expenseInsights: string[] = [];
  if (momChangePct > 20) {
    expenseInsights.push(`Monthly expenses increased by ${momChangePct}% vs last month (₹${thisMonthSnap.expenses.toLocaleString('en-IN')} vs ₹${lastMonthSnap.expenses.toLocaleString('en-IN')}).`);
  }
  if (expenseToSalesRatioPct > 15) {
    expenseInsights.push(`Operating expenses consume ${expenseToSalesRatioPct}% of net sales (target < 12% for Kirana retail).`);
  }
  if (expenseByCategory[0]) {
    expenseInsights.push(`Highest overhead head: "${expenseByCategory[0].category}" at ₹${expenseByCategory[0].amount.toLocaleString('en-IN')} (${expenseByCategory[0].sharePercent}% of expenses).`);
  }
  if (expenseInsights.length === 0) {
    expenseInsights.push('Operating expense ratio is healthy and within disciplined retail bounds.');
  }

  // Business Health Scorecard (transparent weighted metrics)
  const f1Score = Math.max(0, Math.min(100, Math.round((grossMarginPercent / Math.max(1, targetMarginPct)) * 85)));
  const f2Score = netProfit > 0 ? Math.max(20, Math.min(100, Math.round(50 + netMarginPercent * 3))) : 15;
  const totalLiquidityBase = Math.max(1, netSalesExGst);
  const f3Score = Math.max(10, Math.min(100, Math.round(100 - (customerReceivables / totalLiquidityBase) * 60)));
  const deadStockRatio = closingStockValue > 0 ? totalCapitalBlocked / closingStockValue : 0;
  const f4Score = Math.max(10, Math.min(100, Math.round(100 - deadStockRatio * 100)));
  const discRate = grossSalesExGst > 0 ? (totalDiscounts / grossSalesExGst) * 100 : 0;
  const f5Score = Math.max(10, Math.min(100, Math.round(100 - (discRate / Math.max(1, maxDiscountPct)) * 45 - lossMakingInvoicesCount * 10)));

  const healthFactors: HealthScoreFactor[] = [
    {
      factor: 'Gross Margin Quality',
      weightPercent: 25,
      scoreOutOf100: f1Score,
      weightedPoints: r2(f1Score * 0.25),
      observedMetric: `${r2(grossMarginPercent)}% vs ${targetMarginPct}% target`,
    },
    {
      factor: 'Net Operating Profitability',
      weightPercent: 25,
      scoreOutOf100: f2Score,
      weightedPoints: r2(f2Score * 0.25),
      observedMetric: `${r2(netMarginPercent)}% net margin`,
    },
    {
      factor: 'Receivables & Cash Liquidity',
      weightPercent: 20,
      scoreOutOf100: f3Score,
      weightedPoints: r2(f3Score * 0.2),
      observedMetric: `₹${r2(customerReceivables).toLocaleString('en-IN')} receivables`,
    },
    {
      factor: 'Inventory Velocity & Dead Stock',
      weightPercent: 15,
      scoreOutOf100: f4Score,
      weightedPoints: r2(f4Score * 0.15),
      observedMetric: `${r2(deadStockRatio * 100)}% capital in slow/dead stock`,
    },
    {
      factor: 'Discount Protection Discipline',
      weightPercent: 15,
      scoreOutOf100: f5Score,
      weightedPoints: r2(f5Score * 0.15),
      observedMetric: `${r2(discRate)}% avg discount · ${lossMakingInvoicesCount} loss bills`,
    },
  ];
  const overallScore = Math.round(healthFactors.reduce((s, f) => s + f.weightedPoints, 0));
  const grade: ComprehensivePLReport['businessHealth']['grade'] =
    overallScore >= 80 ? 'Excellent' : overallScore >= 65 ? 'Good' : overallScore >= 45 ? 'Watch' : 'At Risk';

  // Automatic Profit Alerts
  const alerts: ProfitAlert[] = [];
  if (lossMakingInvoicesCount > 0) {
    alerts.push({
      id: 'al-loss-inv',
      severity: 'critical',
      title: `${lossMakingInvoicesCount} Loss-Making Invoice(s) Recorded`,
      detail: `Discounting or below-cost pricing caused ₹${r2(lossCausedByDiscounts).toLocaleString('en-IN')} in gross losses.`,
      metricValue: `₹${r2(lossCausedByDiscounts).toLocaleString('en-IN')} loss`,
    });
  }
  const lossProducts = productRows.filter((p) => p.isLossMaking);
  if (lossProducts.length > 0) {
    alerts.push({
      id: 'al-loss-sku',
      severity: 'critical',
      title: `${lossProducts.length} Product(s) Sold at Negative Profit`,
      detail: `Top offender: ${lossProducts[0].name} (₹${lossProducts[0].grossProfit.toLocaleString('en-IN')}). Review selling prices.`,
      metricValue: `${lossProducts.length} SKUs`,
    });
  }
  if (totalCapitalBlocked > 0) {
    alerts.push({
      id: 'al-dead-stk',
      severity: 'warning',
      title: `Capital Blocked in Slow/Dead Stock`,
      detail: `${count90Days + count60Days + count30Days} stocked item(s) haven't sold in 30+ days.`,
      metricValue: `₹${r2(totalCapitalBlocked).toLocaleString('en-IN')}`,
    });
  }
  if (momChangePct > 20) {
    alerts.push({
      id: 'al-exp-spike',
      severity: 'warning',
      title: `Monthly Expenses Spiked +${momChangePct}%`,
      detail: `Expenses jumped from ₹${lastMonthSnap.expenses.toLocaleString('en-IN')} to ₹${thisMonthSnap.expenses.toLocaleString('en-IN')}.`,
      metricValue: `+${momChangePct}%`,
    });
  }
  if (overDiscountedInvoicesCount > 0) {
    alerts.push({
      id: 'al-disc-ceil',
      severity: 'info',
      title: `${overDiscountedInvoicesCount} Bill(s) Exceeded ${maxDiscountPct}% Discount Cap`,
      detail: `Audit Discount Approvals register to review override reasons.`,
      metricValue: `${overDiscountedInvoicesCount} bills`,
    });
  }

  return {
    dateCoverageLabel,
    costingMethodUsed: costingMethod,
    tradingAndPL: {
      openingStockValue: r2(openingStockValue),
      grossSalesExGst: r2(grossSalesExGst),
      salesReturnsExGst: r2(salesReturnsExGst),
      totalDiscounts: r2(totalDiscounts),
      netSalesExGst: r2(netSalesExGst),
      grossPurchasesExGst: r2(grossPurchasesExGst),
      purchaseReturnsExGst: r2(purchaseReturnsExGst),
      directPurchaseExpenses: r2(directPurchaseExpenses),
      netPurchasesExGst: r2(netPurchasesExGst),
      closingStockValue: r2(closingStockValue),
      cogs: r2(cogs),
      grossProfit: r2(grossProfit),
      grossMarginPercent: r2(grossMarginPercent),
      otherIncome: r2(otherIncome),
      indirectExpensesTotal: r2(indirectExpensesTotal),
      expenseByCategory,
      netProfit: r2(netProfit),
      netMarginPercent: r2(netMarginPercent),
      gstCollectedOutput: r2(gstCollectedOutput),
      gstInputEligible: r2(gstInputEligible),
      gstInputNonCreditable: r2(gstInputNonCreditable),
      netGstLiability: r2(netGstLiability),
    },
    discountAnalysis: {
      totalDiscountsGiven: r2(totalDiscounts),
      productLevelDiscounts: r2(productLevelDiscounts),
      invoiceLevelDiscounts: r2(invoiceLevelDiscounts),
      couponDiscounts: r2(couponDiscounts),
      discountToGrossSalesPercent: grossSalesExGst > 0 ? r2((totalDiscounts / grossSalesExGst) * 100) : 0,
      discountToGrossProfitPercent: grossProfit > 0 ? r2((totalDiscounts / grossProfit) * 100) : 0,
      lossCausedByDiscounts: r2(lossCausedByDiscounts),
      lossMakingInvoicesCount,
      overDiscountedInvoicesCount,
      totalApprovalsCount: discountApprovals.length,
    },
    cashVsAccrual: {
      cashSales: r2(cashSales),
      upiAndBankSales: r2(upiAndBankSales),
      creditSales: r2(creditSales),
      cashReceivedFromCollections: r2(cashReceivedFromCollections),
      totalCashAndBankInflow: r2(totalCashAndBankInflow),
      customerReceivables: r2(customerReceivables),
      supplierPayables: r2(supplierPayables),
      operatingCashFlow: r2(operatingCashFlow),
      accrualNetProfit: r2(netProfit),
      cashProfitGapNote:
        creditSales > 0
          ? `₹${r2(creditSales).toLocaleString('en-IN')} in Credit/Udhaar sales are counted in Accrual profit but excluded from Cash Received until collected.`
          : 'All sales in this period were settled immediately via Cash/UPI/Bank.',
    },
    comparisons: {
      todayVsYesterday: {
        current: todaySnap,
        previous: yestSnap,
        salesGrowthPct: calcGrowth(todaySnap.netSales, yestSnap.netSales),
        profitGrowthPct: calcGrowth(todaySnap.netProfit, yestSnap.netProfit),
      },
      weekVsLastWeek: {
        current: thisWeekSnap,
        previous: lastWeekSnap,
        salesGrowthPct: calcGrowth(thisWeekSnap.netSales, lastWeekSnap.netSales),
        profitGrowthPct: calcGrowth(thisWeekSnap.netProfit, lastWeekSnap.netProfit),
      },
      monthVsLastMonth: {
        current: thisMonthSnap,
        previous: lastMonthSnap,
        salesGrowthPct: calcGrowth(thisMonthSnap.netSales, lastMonthSnap.netSales),
        profitGrowthPct: calcGrowth(thisMonthSnap.netProfit, lastMonthSnap.netProfit),
      },
      yearVsLastYear: {
        current: thisYearSnap,
        previous: lastYearSnap,
        salesGrowthPct: calcGrowth(thisYearSnap.netSales, lastYearSnap.netSales),
        profitGrowthPct: calcGrowth(thisYearSnap.netProfit, lastYearSnap.netProfit),
      },
    },
    trendSeries,
    productRows: productRows.sort((a, b) => b.grossProfit - a.grossProfit),
    categoryRows,
    customerRows,
    customerProductBrandRows,
    reconciliationChecks,
    priceRecommendations,
    deadStockAnalysis: {
      totalCapitalBlocked: r2(totalCapitalBlocked),
      count30Days,
      count60Days,
      count90Days,
      rows: deadRows,
    },
    salesForecast: {
      sampleActiveDays,
      avgDailyRevenue: r2(avgDailyRevenue),
      avgDailyGrossProfit: r2(avgDailyGrossProfit),
      next7DaysRevenue: r2(next7DaysRevenue),
      next7DaysGrossProfit: r2(next7DaysGrossProfit),
      next30DaysRevenue: r2(next30DaysRevenue),
      next30DaysGrossProfit: r2(next30DaysGrossProfit),
      next30DaysRevenueLower: r2(next30DaysRevenueLower),
      next30DaysRevenueUpper: r2(next30DaysRevenueUpper),
      next30DaysGrossProfitLower: r2(next30DaysGrossProfitLower),
      next30DaysGrossProfitUpper: r2(next30DaysGrossProfitUpper),
      confidence,
      notice: forecastNotice,
      dailyHistorySeries,
      projected30DaysSeries,
    },
    expenseOptimizer: {
      expenseToSalesRatioPct,
      thisMonthExpenses: thisMonthSnap.expenses,
      lastMonthExpenses: lastMonthSnap.expenses,
      momChangePct,
      topCategory: expenseByCategory[0]?.category || 'None',
      insights: expenseInsights,
    },
    businessHealth: {
      overallScore,
      grade,
      factors: healthFactors,
    },
    alerts,
  };
}

export function answerAiProfitQuestion(params: {
  query: string;
  report: ComprehensivePLReport;
  items: Item[];
  parties: Party[];
  canViewFinance: boolean;
}): { answer: string; highlights: Array<{ label: string; value: string }> } {
  const { query, report, items, parties, canViewFinance } = params;
  const q = query.toLowerCase();
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  if (q.includes('loss') || q.includes('negative')) {
    const lossSkus = report.productRows.filter((p) => p.isLossMaking);
    const lowRecs = report.priceRecommendations.filter((p) => p.status === 'Loss-Making');
    if (lossSkus.length === 0 && lowRecs.length === 0) {
      return {
        answer: `Good news — based on ${report.dateCoverageLabel}, zero products were sold at a loss, and all catalog items are priced at or above cost.`,
        highlights: [
          { label: 'Loss-Making Invoices', value: String(report.discountAnalysis.lossMakingInvoicesCount) },
          { label: 'Gross Margin %', value: `${report.tradingAndPL.grossMarginPercent}%` },
        ],
      };
    }
    const listText = (lossSkus.length > 0 ? lossSkus.map((s) => `• ${s.name}: Net Sales ${fmt(s.netSalesExGst)}, COGS ${fmt(s.cogs)}, Loss ${fmt(Math.abs(s.grossProfit))}`) : lowRecs.map((r) => `• ${r.name}: Cost ${fmt(r.weightedAvgCost)} vs Sale ${fmt(r.currentSalePrice)}`)).slice(0, 5).join('\n');
    return {
      answer: `Found ${Math.max(lossSkus.length, lowRecs.length)} loss-making product(s) (${report.dateCoverageLabel}):\n${listText}`,
      highlights: [
        { label: 'Loss-Making SKUs', value: String(Math.max(lossSkus.length, lowRecs.length)) },
        { label: 'Loss Caused by Discounts', value: fmt(report.discountAnalysis.lossCausedByDiscounts) },
      ],
    };
  }

  if (q.includes('dead') || q.includes('slow') || q.includes('blocked') || q.includes('not sold')) {
    const topDead = report.deadStockAnalysis.rows.slice(0, 5);
    return {
      answer: `Capital blocked in 30+ day non-moving stock is ${fmt(report.deadStockAnalysis.totalCapitalBlocked)} across ${topDead.length > 0 ? report.deadStockAnalysis.rows.length : 0} SKU(s) (90+d: ${report.deadStockAnalysis.count90Days}, 60–89d: ${report.deadStockAnalysis.count60Days}, 30–59d: ${report.deadStockAnalysis.count30Days}).\n${
        topDead.length > 0
          ? topDead.map((d) => `• ${d.name} (${d.stock} ${d.unit}) — ${fmt(d.capitalBlocked)} [${d.bucket}]`).join('\n')
          : 'No slow or dead inventory detected.'
      }`,
      highlights: [
        { label: 'Blocked Capital', value: fmt(report.deadStockAnalysis.totalCapitalBlocked) },
        { label: '90+ Days Dead', value: String(report.deadStockAnalysis.count90Days) },
        { label: '30–59 Days Slow', value: String(report.deadStockAnalysis.count30Days) },
      ],
    };
  }

  if (q.includes('today') && (q.includes('profit') || q.includes('sale'))) {
    const t = report.comparisons.todayVsYesterday.current;
    return {
      answer: `Today's live snapshot (excluding GST from profit, ${report.costingMethodUsed} costing):\n• Net Sales (Ex-GST): ${fmt(t.netSales)} across ${t.invoiceCount} bill(s)\n• COGS: ${fmt(t.cogs)}\n• Gross Profit: ${canViewFinance ? fmt(t.grossProfit) : 'Restricted'} (${t.grossMarginPercent}%)\n• Expenses: ${fmt(t.expenses)}\n• Net Profit: ${canViewFinance ? fmt(t.netProfit) : 'Restricted'}`,
      highlights: [
        { label: 'Today Sales', value: fmt(t.netSales) },
        { label: 'Today Gross Profit', value: canViewFinance ? fmt(t.grossProfit) : 'Hidden' },
        { label: 'Today Net Profit', value: canViewFinance ? fmt(t.netProfit) : 'Hidden' },
      ],
    };
  }

  if (q.includes('forecast') || q.includes('predict') || q.includes('next 7') || q.includes('next 30')) {
    const f = report.salesForecast;
    return {
      answer: `AI Revenue & Profit Forecast (${f.confidence} confidence — ${f.notice}):\n• Next 7 Days Projected Sales: ${fmt(f.next7DaysRevenue)} (Est. Gross Profit: ${fmt(f.next7DaysGrossProfit)})\n• Next 30 Days Projected Sales: ${fmt(f.next30DaysRevenue)} (Est. Gross Profit: ${fmt(f.next30DaysGrossProfit)})`,
      highlights: [
        { label: '7-Day Sales Est.', value: fmt(f.next7DaysRevenue) },
        { label: '30-Day Sales Est.', value: fmt(f.next30DaysRevenue) },
        { label: 'Confidence', value: f.confidence },
      ],
    };
  }

  if (q.includes('discount')) {
    const d = report.discountAnalysis;
    return {
      answer: `Discount Impact Summary (${report.dateCoverageLabel}):\n• Total Discounts Given: ${fmt(d.totalDiscountsGiven)} (${d.discountToGrossSalesPercent}% of gross sales)\n• Product-level: ${fmt(d.productLevelDiscounts)} · Invoice-level: ${fmt(d.invoiceLevelDiscounts)} · Coupons: ${fmt(d.couponDiscounts)}\n• Loss-making invoices: ${d.lossMakingInvoicesCount} (loss amount: ${fmt(d.lossCausedByDiscounts)})`,
      highlights: [
        { label: 'Total Discounts', value: fmt(d.totalDiscountsGiven) },
        { label: 'Discount / Profit', value: `${d.discountToGrossProfitPercent}%` },
        { label: 'Loss Bills', value: String(d.lossMakingInvoicesCount) },
      ],
    };
  }

  if (q.includes('expense') || q.includes('month')) {
    const m = report.comparisons.monthVsLastMonth;
    return {
      answer: `Month-over-Month Expense & Sales Comparison:\n• This Month Sales: ${fmt(m.current.netSales)} (Last Month: ${fmt(m.previous.netSales)}, ${m.salesGrowthPct >= 0 ? '+' : ''}${m.salesGrowthPct}%)\n• This Month Expenses: ${fmt(m.current.expenses)} (Last Month: ${fmt(m.previous.expenses)}, ${report.expenseOptimizer.momChangePct >= 0 ? '+' : ''}${report.expenseOptimizer.momChangePct}%)\n• Top Expense Head: ${report.expenseOptimizer.topCategory}`,
      highlights: [
        { label: 'This Month Exp.', value: fmt(m.current.expenses) },
        { label: 'Last Month Exp.', value: fmt(m.previous.expenses) },
        { label: 'Exp/Sales Ratio', value: `${report.expenseOptimizer.expenseToSalesRatioPct}%` },
      ],
    };
  }

  if (q.includes('gst')) {
    const pl = report.tradingAndPL;
    return {
      answer: `GST Summary (${report.dateCoverageLabel}):\n• Output GST Collected: ${fmt(pl.gstCollectedOutput)}\n• Eligible Input Tax Credit (ITC): ${fmt(pl.gstInputEligible)}\n• Non-Creditable Input Tax (added to product cost): ${fmt(pl.gstInputNonCreditable)}\n• Net GST Payable: ${fmt(pl.netGstLiability)}`,
      highlights: [
        { label: 'Output GST', value: fmt(pl.gstCollectedOutput) },
        { label: 'Eligible ITC', value: fmt(pl.gstInputEligible) },
        { label: 'Net GST Liability', value: fmt(pl.netGstLiability) },
      ],
    };
  }

  if (q.includes('udhaar') || q.includes('receivable') || q.includes('customer')) {
    const topCust = parties
      .filter((p) => (p.type === 'Customer' || !p.type) && (p.balance || 0) > 0)
      .sort((a, b) => (b.balance || 0) - (a.balance || 0))
      .slice(0, 5);
    return {
      answer:
        topCust.length > 0
          ? `Top pending customer Udhaar balances:\n${topCust.map((c) => `• ${c.name}: ${fmt(c.balance)} (${c.phone || 'No phone'})`).join('\n')}`
          : 'No pending customer Udhaar balances found.',
      highlights: [
        { label: 'Total Receivables', value: fmt(report.cashVsAccrual.customerReceivables) },
        { label: 'Accounts Pending', value: String(topCust.length) },
      ],
    };
  }

  if (q.includes('low') || q.includes('reorder') || q.includes('purchase order')) {
    const low = items.filter((it) => (it.stock || 0) <= (it.minStockAlert ?? 5)).slice(0, 6);
    return {
      answer:
        low.length > 0
          ? `${low.length} item(s) are at or below minimum stock alert:\n${low.map((i) => `• ${i.name}: ${i.stock} ${i.unit} left (Min: ${i.minStockAlert ?? 5}) · Last Cost ${fmt(getItemLastPurchasePrice(i))}`).join('\n')}`
          : 'All inventory items are currently above minimum stock thresholds.',
      highlights: [
        { label: 'Low-Stock SKUs', value: String(low.length) },
        { label: 'Closing Stock Value', value: fmt(report.tradingAndPL.closingStockValue) },
      ],
    };
  }

  if (q.includes('margin') || q.includes('highest')) {
    const topProd = [...report.productRows].sort((a, b) => b.marginPercent - a.marginPercent).slice(0, 5);
    return {
      answer:
        topProd.length > 0
          ? `Highest profit margin products (${report.dateCoverageLabel}):\n${topProd.map((p) => `• ${p.name}: ${p.marginPercent}% margin (${fmt(p.grossProfit)} gross profit)`).join('\n')}`
          : 'No product sales recorded yet to rank margins.',
      highlights: [
        { label: 'Avg Gross Margin', value: `${report.tradingAndPL.grossMarginPercent}%` },
        { label: 'Business Health', value: `${report.businessHealth.overallScore}/100 (${report.businessHealth.grade})` },
      ],
    };
  }

  return {
    answer: `Live P&L Executive Summary (${report.dateCoverageLabel}, Costing: ${report.costingMethodUsed}):\n• Net Sales (Ex-GST): ${fmt(report.tradingAndPL.netSalesExGst)}\n• COGS: ${fmt(report.tradingAndPL.cogs)} | Gross Profit: ${fmt(report.tradingAndPL.grossProfit)} (${report.tradingAndPL.grossMarginPercent}%)\n• Net Profit: ${fmt(report.tradingAndPL.netProfit)} (${report.tradingAndPL.netMarginPercent}%)\n• Business Health Score: ${report.businessHealth.overallScore}/100 (${report.businessHealth.grade})`,
    highlights: [
      { label: 'Net Sales (Ex-GST)', value: fmt(report.tradingAndPL.netSalesExGst) },
      { label: 'Gross Profit', value: fmt(report.tradingAndPL.grossProfit) },
      { label: 'Net Profit', value: fmt(report.tradingAndPL.netProfit) },
    ],
  };
}
