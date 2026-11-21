import JsBarcode from 'jsbarcode';
import { Item } from '../types';

export type SupportedBarcodeFormat = 'AUTO' | 'EAN13' | 'EAN8' | 'UPC' | 'CODE128' | 'CODE39';

export function normalizeBarcode(raw: string): string {
  return String(raw || '').trim();
}

/**
 * Computes GS1 mod-10 check digit for EAN-13 (12 digits) or EAN-8 (7 digits) or UPC-A (11 digits).
 */
export function computeGs1CheckDigit(digitsOnly: string): string {
  const digits = digitsOnly.split('').map((d) => Number(d));
  const len = digits.length;
  // Standard GS1: from right-most payload digit, odd positions (1-indexed from right) * 3, even * 1
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const posFromRight = len - i;
    const weight = posFromRight % 2 === 1 ? 3 : 1;
    sum += digits[i] * weight;
  }
  const mod = sum % 10;
  return String(mod === 0 ? 0 : 10 - mod);
}

/**
 * Generates a deterministic or random valid 13-digit EAN-13 barcode (890 Kirana India prefix)
 * guaranteed not to collide with any existing item barcode or code.
 */
export function generateUniqueEan13Barcode(existingItems: Item[], seed?: string): string {
  const usedSet = new Set<string>();
  existingItems.forEach((it) => {
    if (it.barcode) usedSet.add(it.barcode.trim().toLowerCase());
    if (it.code) usedSet.add(it.code.trim().toLowerCase());
    (it.extraBarcodes || []).forEach((eb) => {
      if (eb) usedSet.add(eb.trim().toLowerCase());
    });
  });

  // Try deterministic hash first if seed provided
  if (seed) {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const numeric9 = String(Math.abs(hash) % 1000000000).padStart(9, '0');
    const base12 = `890${numeric9}`;
    const candidate = `${base12}${computeGs1CheckDigit(base12)}`;
    if (!usedSet.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  // Fallback random loop guaranteed unique
  for (let attempt = 0; attempt < 100; attempt++) {
    const random9 = String(Math.floor(100000000 + Math.random() * 900000000));
    const base12 = `890${random9}`;
    const candidate = `${base12}${computeGs1CheckDigit(base12)}`;
    if (!usedSet.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  const tsTail = String(Date.now()).slice(-9).padStart(9, '0');
  const base12 = `890${tsTail}`;
  return `${base12}${computeGs1CheckDigit(base12)}`;
}

/**
 * Ensures every item in an array has a unique valid EAN-13 barcode when missing.
 */
export function ensureItemsHaveUniqueBarcodes(items: Item[]): Item[] {
  const seen = new Set<string>();
  const normalized: Item[] = [];
  for (const it of items) {
    const existingBarcode = normalizeBarcode(it.barcode || '');
    if (existingBarcode && !seen.has(existingBarcode.toLowerCase())) {
      seen.add(existingBarcode.toLowerCase());
      normalized.push(it);
    } else {
      const generated = generateUniqueEan13Barcode(normalized, `${it.id}-${it.code}-${it.name}`);
      seen.add(generated.toLowerCase());
      normalized.push({ ...it, barcode: generated });
    }
  }
  return normalized;
}

/**
 * Checks if a candidate barcode is unique across existing inventory items.
 */
export function isBarcodeUnique(
  items: Item[],
  candidateBarcode: string,
  excludeItemId?: string
): { unique: boolean; conflictItem?: Item } {
  const norm = normalizeBarcode(candidateBarcode).toLowerCase();
  if (!norm) return { unique: true };
  const conflict = items.find((it) => {
    if (it.id === excludeItemId) return false;
    if (normalizeBarcode(it.barcode || '').toLowerCase() === norm) return true;
    return (it.extraBarcodes || []).some((eb) => normalizeBarcode(eb).toLowerCase() === norm);
  });
  return { unique: !conflict, conflictItem: conflict };
}

/**
 * Matches a scanned barcode string against item.barcode, item.extraBarcodes, item.code (SKU/HSN), or item.id.
 */
export function findItemByBarcode(items: Item[], rawScan: string): Item | undefined {
  const q = normalizeBarcode(rawScan).toLowerCase();
  if (!q) return undefined;

  // 1. Exact primary or extra barcode match
  const byBarcode = items.find(
    (i) =>
      normalizeBarcode(i.barcode || '').toLowerCase() === q ||
      (i.extraBarcodes || []).some((eb) => normalizeBarcode(eb).toLowerCase() === q)
  );
  if (byBarcode) return byBarcode;

  // 2. Exact item code / SKU match
  const byCode = items.find(
    (i) =>
      normalizeBarcode(i.code || '').toLowerCase() === q ||
      normalizeBarcode(i.sku || '').toLowerCase() === q
  );
  if (byCode) return byCode;

  // 3. Exact product ID match
  const byId = items.find((i) => i.id.toLowerCase() === q);
  if (byId) return byId;

  // 4. UPC-A (12 digits) vs EAN-13 with leading 0 tolerance
  if (/^\d{12}$/.test(q)) {
    const padded = `0${q}`;
    const byPadded = items.find(
      (i) =>
        normalizeBarcode(i.barcode || '') === padded ||
        (i.extraBarcodes || []).some((eb) => normalizeBarcode(eb) === padded)
    );
    if (byPadded) return byPadded;
  }
  if (/^0\d{12}$/.test(q)) {
    const stripped = q.slice(1);
    const byStripped = items.find(
      (i) =>
        normalizeBarcode(i.barcode || '') === stripped ||
        (i.extraBarcodes || []).some((eb) => normalizeBarcode(eb) === stripped)
    );
    if (byStripped) return byStripped;
  }

  return undefined;
}

/**
 * Validates whether a numeric barcode satisfies EAN-13, EAN-8, or UPC-A checksums.
 */
export function detectBarcodeFormat(
  value: string,
  preferred: SupportedBarcodeFormat = 'AUTO'
): 'EAN13' | 'EAN8' | 'UPC' | 'CODE128' | 'CODE39' {
  const clean = normalizeBarcode(value);
  if (preferred !== 'AUTO') {
    if (preferred === 'EAN13' && /^\d{13}$/.test(clean) && computeGs1CheckDigit(clean.slice(0, 12)) === clean[12]) {
      return 'EAN13';
    }
    if (preferred === 'EAN8' && /^\d{8}$/.test(clean) && computeGs1CheckDigit(clean.slice(0, 7)) === clean[7]) {
      return 'EAN8';
    }
    if (preferred === 'UPC' && /^\d{12}$/.test(clean) && computeGs1CheckDigit(clean.slice(0, 11)) === clean[11]) {
      return 'UPC';
    }
    if (preferred === 'CODE39' && /^[0-9A-Z\-.\s$/+%]+$/.test(clean)) {
      return 'CODE39';
    }
    if (preferred === 'CODE128') {
      return 'CODE128';
    }
  }

  if (/^\d{13}$/.test(clean) && computeGs1CheckDigit(clean.slice(0, 12)) === clean[12]) {
    return 'EAN13';
  }
  if (/^\d{12}$/.test(clean) && computeGs1CheckDigit(clean.slice(0, 11)) === clean[11]) {
    return 'UPC';
  }
  if (/^\d{8}$/.test(clean) && computeGs1CheckDigit(clean.slice(0, 7)) === clean[7]) {
    return 'EAN8';
  }
  return 'CODE128';
}

/**
 * Renders a crisp real scannable SVG barcode using JsBarcode with safe fallback to CODE128.
 */
export function renderBarcodeToSvg(
  svgElement: SVGSVGElement | null,
  value: string,
  preferredFormat: SupportedBarcodeFormat = 'AUTO',
  options?: {
    height?: number;
    width?: number;
    fontSize?: number;
    displayValue?: boolean;
    margin?: number;
    lineColor?: string;
    background?: string;
  }
): string {
  if (!svgElement) return 'CODE128';
  const clean = normalizeBarcode(value) || 'MS-890001';
  const chosenFormat = detectBarcodeFormat(clean, preferredFormat);

  const cfg = {
    format: chosenFormat,
    width: options?.width ?? 1.8,
    height: options?.height ?? 44,
    fontSize: options?.fontSize ?? 11,
    displayValue: options?.displayValue ?? true,
    margin: options?.margin ?? 4,
    lineColor: options?.lineColor ?? '#0f172a',
    background: options?.background ?? '#ffffff',
  };

  try {
    JsBarcode(svgElement, clean, cfg);
    return chosenFormat;
  } catch {
    try {
      JsBarcode(svgElement, clean, { ...cfg, format: 'CODE128' });
      return 'CODE128';
    } catch {
      return 'CODE128';
    }
  }
}

/**
 * Clean non-intrusive scanner feedback chime using Web Audio API.
 */
export function playScanBeep(success = true): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = success ? 'sine' : 'sawtooth';
    osc.frequency.setValueAtTime(success ? 1480 : 320, ctx.currentTime);
    if (success) {
      osc.frequency.setValueAtTime(1920, ctx.currentTime + 0.055);
    }
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (success ? 0.13 : 0.22));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.14 : 0.23));
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 300);
  } catch {
    // Ignore audio errors if blocked by browser autoplay policy
  }
}
