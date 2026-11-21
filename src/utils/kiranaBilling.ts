import { Item } from '../types';

export interface CustomUnitDefinition {
  shortCode: string;
  baseFactor?: number;
}

export type KiranaInputMode = 'amount' | 'weight' | 'qty';
export type UnitFamily = 'weight' | 'volume' | 'count';

/**
 * Canonical conversion factor to the family's smallest SI base unit:
 * - weight family -> grams (g)
 * - volume family -> millilitres (ml)
 * - count family -> pieces (pcs)
 */
const WEIGHT_FACTORS_IN_GRAMS: Record<string, number> = {
  G: 1,
  GM: 1,
  GMS: 1,
  GRAM: 1,
  GRAMS: 1,
  KG: 1000,
  KGS: 1000,
  KILOGRAM: 1000,
  KILOGRAMS: 1000,
  QTL: 100000,
  QUINTAL: 100000,
  TON: 1000000,
  MT: 1000000,
};

const VOLUME_FACTORS_IN_ML: Record<string, number> = {
  ML: 1,
  MILLILITRE: 1,
  MILLILITRES: 1,
  L: 1000,
  LTR: 1000,
  LTRS: 1000,
  LITRE: 1000,
  LITRES: 1000,
  LITER: 1000,
  LITERS: 1000,
};

const COUNT_FACTORS_IN_PCS: Record<string, number> = {
  PCS: 1,
  PC: 1,
  PIECE: 1,
  PIECES: 1,
  NOS: 1,
  UNIT: 1,
  PKT: 1,
  PACKET: 1,
  PACKETS: 1,
  PACK: 1,
  BAG: 1,
  BTL: 1,
  SET: 1,
  ROLL: 1,
  BDL: 1,
  BUNDLE: 1,
  M: 1,
  MTR: 1,
  METRE: 1,
  METER: 1,
  DOZ: 12,
  DOZEN: 12,
  BOX: 12,
  CTN: 24,
  CARTON: 24,
};

export const normalizeUnitCode = (unit?: string): string => {
  const raw = (unit || 'PCS').trim().toUpperCase();
  if (raw === 'KGS' || raw === 'KILOGRAM' || raw === 'KILOGRAMS') return 'KG';
  if (raw === 'G' || raw === 'GMS' || raw === 'GRAM' || raw === 'GRAMS') return 'GM';
  if (raw === 'L' || raw === 'LTRS' || raw === 'LITRE' || raw === 'LITRES' || raw === 'LITER' || raw === 'LITERS') return 'LTR';
  if (raw === 'MILLILITRE' || raw === 'MILLILITRES') return 'ML';
  if (raw === 'QUINTAL') return 'QTL';
  return raw;
};

export const getUnitFamily = (unit?: string): UnitFamily => {
  const code = (unit || '').trim().toUpperCase();
  if (WEIGHT_FACTORS_IN_GRAMS[code] !== undefined) return 'weight';
  if (VOLUME_FACTORS_IN_ML[code] !== undefined) return 'volume';
  return 'count';
};

export const isWeightOrVolumeUnit = (unit?: string): boolean => {
  const fam = getUnitFamily(unit);
  return fam === 'weight' || fam === 'volume';
};

export const isLooseKiranaProduct = (item?: Partial<Item> | null): boolean => {
  if (!item) return false;
  if (item.productType === 'Loose') return true;
  if (item.productType === 'Packaged' || item.productType === 'Piece') return false;
  return isWeightOrVolumeUnit(item.unit);
};

export const roundQtyPrecision = (val: number, decimals = 6): number => {
  if (!Number.isFinite(val)) return 0;
  const factor = Math.pow(10, Math.max(0, Math.min(8, decimals)));
  return Math.round((val + Number.EPSILON) * factor) / factor;
};

export const roundMoney = (val: number, decimals = 2): number => {
  if (!Number.isFinite(val)) return 0;
  const factor = Math.pow(10, Math.max(0, Math.min(4, decimals)));
  return Math.round((val + Number.EPSILON) * factor) / factor;
};

export const convertUnitQty = (
  qty: number,
  fromUnit?: string,
  toUnit?: string,
  itemUnitConversion?: { secondaryUnit: string; rate: number },
  customUnits?: CustomUnitDefinition[]
): number => {
  const numericQty = Number(qty) || 0;
  if (numericQty === 0) return 0;

  const fromRaw = (fromUnit || 'PCS').trim().toUpperCase();
  const toRaw = (toUnit || fromRaw).trim().toUpperCase();
  if (normalizeUnitCode(fromRaw) === normalizeUnitCode(toRaw)) {
    return roundQtyPrecision(numericQty, 6);
  }

  // Weight <-> Weight (exact SI metric)
  const wFrom = WEIGHT_FACTORS_IN_GRAMS[fromRaw];
  const wTo = WEIGHT_FACTORS_IN_GRAMS[toRaw];
  if (wFrom !== undefined && wTo !== undefined) {
    return roundQtyPrecision((numericQty * wFrom) / wTo, 6);
  }

  // Volume <-> Volume (exact SI metric)
  const vFrom = VOLUME_FACTORS_IN_ML[fromRaw];
  const vTo = VOLUME_FACTORS_IN_ML[toRaw];
  if (vFrom !== undefined && vTo !== undefined) {
    return roundQtyPrecision((numericQty * vFrom) / vTo, 6);
  }

  // Item-level custom secondary unit conversion (e.g., 1 BOX = 24 PCS)
  if (itemUnitConversion && itemUnitConversion.rate > 0) {
    const sec = itemUnitConversion.secondaryUnit.trim().toUpperCase();
    if (fromRaw === sec) {
      return roundQtyPrecision(numericQty / itemUnitConversion.rate, 6);
    }
    if (toRaw === sec) {
      return roundQtyPrecision(numericQty * itemUnitConversion.rate, 6);
    }
  }

  // Custom units baseFactor fallback
  if (customUnits && customUnits.length > 0) {
    const fromDef = customUnits.find((u) => u.shortCode.toUpperCase() === fromRaw);
    const toDef = customUnits.find((u) => u.shortCode.toUpperCase() === toRaw);
    if (fromDef?.baseFactor && toDef?.baseFactor && toDef.baseFactor > 0) {
      return roundQtyPrecision((numericQty * fromDef.baseFactor) / toDef.baseFactor, 6);
    }
  }

  // Count factors (PCS <-> DOZ)
  const cFrom = COUNT_FACTORS_IN_PCS[fromRaw];
  const cTo = COUNT_FACTORS_IN_PCS[toRaw];
  if (cFrom !== undefined && cTo !== undefined) {
    return roundQtyPrecision((numericQty * cFrom) / cTo, 6);
  }

  return roundQtyPrecision(numericQty, 6);
};

export interface WeightFromAmountResult {
  amount: number;
  baseQty: number;
  baseUnit: string;
  normalizedSmallUnits: number; // grams or ml
  gramsOrMl: number;
  smallUnitLabel: 'g' | 'ml' | 'pcs';
  displayWeightQty: number;
  displayWeightUnit: string;
  displayWeightLabel: string;
  displayLabel: string;
}

export const formatBaseQtyHuman = (baseQty: number, baseUnit?: string): string => {
  const norm = normalizeUnitCode(baseUnit);
  const fam = getUnitFamily(norm);
  const cleanQty = roundQtyPrecision(baseQty, 6);

  if (fam === 'weight') {
    const grams = convertUnitQty(cleanQty, norm, 'GM');
    if (grams < 1000) {
      const gRounded = roundQtyPrecision(grams, 3);
      return `${Number.isInteger(gRounded) ? gRounded : gRounded.toFixed(gRounded % 1 === 0 ? 0 : 3).replace(/\.?0+$/, '')} g`;
    }
    const kg = roundQtyPrecision(grams / 1000, 3);
    return `${kg.toFixed(3).replace(/\.?0+$/, '')} kg`;
  }

  if (fam === 'volume') {
    const ml = convertUnitQty(cleanQty, norm, 'ML');
    if (ml < 1000) {
      const mlRounded = roundQtyPrecision(ml, 3);
      return `${Number.isInteger(mlRounded) ? mlRounded : mlRounded.toFixed(3).replace(/\.?0+$/, '')} ml`;
    }
    const ltr = roundQtyPrecision(ml / 1000, 3);
    return `${ltr.toFixed(3).replace(/\.?0+$/, '')} L`;
  }

  return `${cleanQty} ${(baseUnit || 'PCS').toLowerCase()}`;
};

export const formatRateLabel = (ratePerBaseUnit: number, baseUnit?: string): string => {
  const norm = normalizeUnitCode(baseUnit);
  const unitDisplay =
    norm === 'KG' ? 'kg' : norm === 'GM' ? 'g' : norm === 'LTR' ? 'L' : norm === 'ML' ? 'ml' : norm === 'QTL' ? 'quintal' : (baseUnit || 'unit').toLowerCase();
  return `₹${roundMoney(ratePerBaseUnit)}/${unitDisplay}`;
};

/**
 * MODE A: AMOUNT TO WEIGHT
 * Example: Sugar ₹50/kg, cashier enters ₹10 -> 0.2 kg (200 g).
 * Example: Toor Dal ₹120/kg, cashier enters ₹10 -> 0.083333 kg (83.333 g).
 */
export function calculateWeightFromAmount(params: {
  amount: number;
  ratePerBaseUnit: number;
  baseUnit?: string;
  decimalPrecision?: number;
}): WeightFromAmountResult;
export function calculateWeightFromAmount(
  amount: number,
  ratePerBaseUnit: number,
  baseUnit?: string,
  decimalPrecision?: number
): WeightFromAmountResult;
export function calculateWeightFromAmount(
  arg1:
    | number
    | {
        amount: number;
        ratePerBaseUnit: number;
        baseUnit?: string;
        decimalPrecision?: number;
      },
  rateArg?: number,
  baseUnitArg?: string,
  decimalPrecisionArg?: number
): WeightFromAmountResult {
  const params =
    typeof arg1 === 'number'
      ? {
          amount: arg1,
          ratePerBaseUnit: rateArg ?? 0,
          baseUnit: baseUnitArg,
          decimalPrecision: decimalPrecisionArg,
        }
      : arg1;
  const baseUnit = normalizeUnitCode(params.baseUnit || 'KG');
  const fam = getUnitFamily(baseUnit);
  const amount = Math.max(0, Number(params.amount) || 0);
  const rate = Math.max(0, Number(params.ratePerBaseUnit) || 0);
  const precision = params.decimalPrecision ?? 3;

  if (rate <= 0 || amount <= 0) {
    const zeroLabel = fam === 'volume' ? '0 ml' : fam === 'weight' ? '0 g' : '0';
    return {
      amount: roundMoney(amount),
      baseQty: 0,
      baseUnit,
      normalizedSmallUnits: 0,
      gramsOrMl: 0,
      smallUnitLabel: fam === 'volume' ? 'ml' : fam === 'weight' ? 'g' : 'pcs',
      displayWeightQty: 0,
      displayWeightUnit: baseUnit,
      displayWeightLabel: zeroLabel,
      displayLabel: zeroLabel,
    };
  }

  // Exact unrounded base quantity (e.g., 10 / 120 = 0.08333333 kg)
  const rawBaseQty = amount / rate;
  const baseQty = roundQtyPrecision(rawBaseQty, 6);

  if (fam === 'weight') {
    const gramsExact = convertUnitQty(rawBaseQty, baseUnit, 'GM');
    const gramsRounded = roundQtyPrecision(gramsExact, precision);
    const useKg = gramsRounded >= 1000;
    const displayWeightUnit = useKg ? 'KG' : 'GM';
    const displayWeightQty = useKg ? roundQtyPrecision(gramsExact / 1000, precision) : gramsRounded;
    const label = formatBaseQtyHuman(baseQty, baseUnit);
    return {
      amount: roundMoney(amount),
      baseQty,
      baseUnit,
      normalizedSmallUnits: gramsRounded,
      gramsOrMl: gramsRounded,
      smallUnitLabel: 'g',
      displayWeightQty,
      displayWeightUnit,
      displayWeightLabel: label,
      displayLabel: label,
    };
  }

  if (fam === 'volume') {
    const mlExact = convertUnitQty(rawBaseQty, baseUnit, 'ML');
    const mlRounded = roundQtyPrecision(mlExact, precision);
    const useLtr = mlRounded >= 1000;
    const displayWeightUnit = useLtr ? 'LTR' : 'ML';
    const displayWeightQty = useLtr ? roundQtyPrecision(mlExact / 1000, precision) : mlRounded;
    const label = formatBaseQtyHuman(baseQty, baseUnit);
    return {
      amount: roundMoney(amount),
      baseQty,
      baseUnit,
      normalizedSmallUnits: mlRounded,
      gramsOrMl: mlRounded,
      smallUnitLabel: 'ml',
      displayWeightQty,
      displayWeightUnit,
      displayWeightLabel: label,
      displayLabel: label,
    };
  }

  const countQty = roundQtyPrecision(rawBaseQty, precision);
  const countLabel = `${countQty} ${baseUnit}`;
  return {
    amount: roundMoney(amount),
    baseQty,
    baseUnit,
    normalizedSmallUnits: countQty,
    gramsOrMl: countQty,
    smallUnitLabel: 'pcs',
    displayWeightQty: countQty,
    displayWeightUnit: baseUnit,
    displayWeightLabel: countLabel,
    displayLabel: countLabel,
  };
}

export interface AmountFromWeightResult {
  weight: number;
  weightUnit: string;
  baseQty: number;
  baseUnit: string;
  normalizedSmallUnits: number;
  gramsOrMl: number;
  calculatedAmount: number;
  amount: number;
  displayWeightLabel: string;
  displayLabel: string;
}

/**
 * MODE B: WEIGHT TO AMOUNT
 * Example: Sugar ₹50/kg, cashier enters 250 g -> 0.25 kg -> ₹12.50.
 * Example: Rice ₹60/kg, cashier enters 500 g -> 0.5 kg -> ₹30.00.
 */
export function calculateAmountFromWeight(params: {
  weight: number;
  weightUnit: string;
  ratePerBaseUnit: number;
  baseUnit?: string;
}): AmountFromWeightResult;
export function calculateAmountFromWeight(
  weight: number,
  weightUnit: string,
  ratePerBaseUnit: number,
  baseUnit?: string
): AmountFromWeightResult;
export function calculateAmountFromWeight(
  arg1:
    | number
    | {
        weight: number;
        weightUnit: string;
        ratePerBaseUnit: number;
        baseUnit?: string;
      },
  weightUnitArg?: string,
  rateArg?: number,
  baseUnitArg?: string
): AmountFromWeightResult {
  const params =
    typeof arg1 === 'number'
      ? {
          weight: arg1,
          weightUnit: weightUnitArg || 'GM',
          ratePerBaseUnit: rateArg ?? 0,
          baseUnit: baseUnitArg,
        }
      : arg1;
  const baseUnit = normalizeUnitCode(params.baseUnit || 'KG');
  const weightUnit = normalizeUnitCode(params.weightUnit || baseUnit);
  const weight = Math.max(0, Number(params.weight) || 0);
  const rate = Math.max(0, Number(params.ratePerBaseUnit) || 0);

  const baseQty = convertUnitQty(weight, weightUnit, baseUnit);
  const fam = getUnitFamily(baseUnit);
  const smallTarget = fam === 'volume' ? 'ML' : fam === 'weight' ? 'GM' : baseUnit;
  const normalizedSmallUnits = convertUnitQty(baseQty, baseUnit, smallTarget);
  const calculatedAmount = roundMoney(baseQty * rate);
  const label = formatBaseQtyHuman(baseQty, baseUnit);

  return {
    weight,
    weightUnit,
    baseQty,
    baseUnit,
    normalizedSmallUnits,
    gramsOrMl: normalizedSmallUnits,
    calculatedAmount,
    amount: calculatedAmount,
    displayWeightLabel: label,
    displayLabel: label,
  };
}

/**
 * Resolves effective selling rate for an item, honoring customer-specific pricing first,
 * then wholesale pricing if applicable, then standard retail selling price.
 */
export function resolveEffectiveSellingRate(
  item: Item,
  options?: {
    customerId?: string;
    customerName?: string;
    salePriceMode?: 'MRP' | 'Retail' | 'Wholesale';
    qtyInBaseUnit?: number;
  }
): number;
export function resolveEffectiveSellingRate(
  item: Item,
  customerName?: string,
  salePriceMode?: 'MRP' | 'Retail' | 'Wholesale',
  qtyInBaseUnit?: number
): number;
export function resolveEffectiveSellingRate(
  item: Item,
  arg2?:
    | string
    | {
        customerId?: string;
        customerName?: string;
        salePriceMode?: 'MRP' | 'Retail' | 'Wholesale';
        qtyInBaseUnit?: number;
      },
  salePriceModeArg?: 'MRP' | 'Retail' | 'Wholesale',
  qtyInBaseUnitArg?: number
): number {
  const options =
    typeof arg2 === 'string'
      ? {
          customerName: arg2,
          salePriceMode: salePriceModeArg,
          qtyInBaseUnit: qtyInBaseUnitArg,
        }
      : arg2;

  if (item.customerPrices) {
    if (options?.customerId && item.customerPrices[options.customerId] !== undefined) {
      return Number(item.customerPrices[options.customerId]) || item.salePrice;
    }
    if (options?.customerName) {
      const key = Object.keys(item.customerPrices).find(
        (k) => k.trim().toLowerCase() === options.customerName!.trim().toLowerCase()
      );
      if (key && item.customerPrices[key] !== undefined) {
        return Number(item.customerPrices[key]) || item.salePrice;
      }
    }
  }

  if (options?.salePriceMode === 'MRP' && (item.mrp ?? 0) > 0) {
    return item.mrp!;
  }

  if (options?.salePriceMode === 'Wholesale' && (item.wholesalePrice ?? 0) > 0) {
    return item.wholesalePrice!;
  }

  if (
    item.wholesalePrice &&
    item.wholesalePrice > 0 &&
    item.minWholesaleQty &&
    (options?.qtyInBaseUnit || 0) >= item.minWholesaleQty
  ) {
    return item.wholesalePrice;
  }

  return item.salePrice || 0;
}

/**
 * Resolves effective item-level discount percentage combining quantity, wholesale, promotional,
 * and default item discounts, capped by maxDiscountLimitPercent if configured.
 */
export function resolveEffectiveItemDiscountPercent(
  item: Item,
  options?: {
    qty?: number;
    salePriceMode?: 'MRP' | 'Retail' | 'Wholesale';
    fallbackDefaultPercent?: number;
  }
): number {
  const qty = Number(options?.qty) || 1;
  let pct = Number(item.defaultDiscountPercent) || 0;
  if (
    item.qtyDiscountMinQty &&
    item.qtyDiscountMinQty > 0 &&
    qty >= item.qtyDiscountMinQty &&
    (item.qtyDiscountPercent ?? 0) > pct
  ) {
    pct = item.qtyDiscountPercent!;
  }
  if (options?.salePriceMode === 'Wholesale' && (item.wholesaleDiscountPercent ?? 0) > pct) {
    pct = item.wholesaleDiscountPercent!;
  }
  if ((item.promoDiscountPercent ?? 0) > 0) {
    pct = Math.max(pct, item.promoDiscountPercent!);
  }
  if (pct <= 0 && (item.defaultDiscountAmount ?? 0) > 0 && (item.salePrice ?? 0) > 0) {
    pct = Math.min(100, roundMoney(((item.defaultDiscountAmount || 0) / item.salePrice) * 100));
  }
  if (pct <= 0 && (options?.fallbackDefaultPercent ?? 0) > 0) {
    pct = options!.fallbackDefaultPercent!;
  }
  if (item.maxDiscountLimitPercent !== undefined && item.maxDiscountLimitPercent >= 0) {
    pct = Math.min(pct, item.maxDiscountLimitPercent);
  }
  return Math.max(0, Math.min(100, roundMoney(pct)));
}

export interface DiscountedLineCalculation {
  grossAmount: number;
  discountAmount: number;
  netAfterDiscount: number;
  taxableValue: number;
  taxAmount: number;
  finalAmount: number;
}

export const computeKiranaLineTotals = (params: {
  baseQty: number;
  ratePerBaseUnit: number;
  discountMode?: 'percent' | 'fixed';
  discountValue?: number;
  gstRatePercent?: number;
  isGstActive?: boolean;
  isTaxInclusive?: boolean;
}): DiscountedLineCalculation => {
  const gross = (Number(params.baseQty) || 0) * (Number(params.ratePerBaseUnit) || 0);
  const discVal = Math.max(0, Number(params.discountValue) || 0);
  const discountAmount =
    params.discountMode === 'fixed'
      ? Math.min(gross, discVal)
      : Math.min(gross, (gross * Math.min(100, discVal)) / 100);
  const netAfterDiscount = Math.max(0, gross - discountAmount);
  const effectiveTaxRate = params.isGstActive ? Math.max(0, Number(params.gstRatePercent) || 0) : 0;

  let taxableValue = netAfterDiscount;
  let taxAmount = 0;
  let finalAmount = netAfterDiscount;

  if (effectiveTaxRate > 0) {
    if (params.isTaxInclusive) {
      taxableValue = netAfterDiscount / (1 + effectiveTaxRate / 100);
      taxAmount = netAfterDiscount - taxableValue;
      finalAmount = netAfterDiscount;
    } else {
      taxableValue = netAfterDiscount;
      taxAmount = (netAfterDiscount * effectiveTaxRate) / 100;
      finalAmount = netAfterDiscount + taxAmount;
    }
  }

  return {
    grossAmount: roundMoney(gross),
    discountAmount: roundMoney(discountAmount),
    netAfterDiscount: roundMoney(netAfterDiscount),
    taxableValue: roundMoney(taxableValue),
    taxAmount: roundMoney(taxAmount),
    finalAmount: roundMoney(finalAmount),
  };
};
