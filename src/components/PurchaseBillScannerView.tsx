import React, { useMemo, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  RotateCw,
  Crop,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Trash2,
  Eye,
  Save,
  X,
  Plus,
  History,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { apiClient } from '../utils/apiClient';
import { generateUniqueId } from '../utils/storage';
import { Item, PurchaseScanItem, PurchaseScanRecord } from '../types';

interface UploadedBillFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  rotationDeg: number;
}

function matchScannedLineToItem(
  scanned: Partial<PurchaseScanItem>,
  items: Item[]
): {
  matchStatus: PurchaseScanItem['matchStatus'];
  matchedItemId?: string;
  matchedItemName?: string;
  matchConfidence: number;
  matchMethod?: PurchaseScanItem['matchMethod'];
  matchedItem?: Item;
} {
  const barcode = (scanned.barcode || '').trim();
  const hsn = (scanned.hsnCode || '').trim();
  const name = (scanned.scannedName || '').trim().toLowerCase();
  const brand = (scanned.brand || '').trim().toLowerCase();
  const pkg = (scanned.packageSize || '').trim().toLowerCase();

  if (barcode) {
    const byBarcode = items.find((i) => (i.barcode || '').trim() === barcode);
    if (byBarcode) {
      return {
        matchStatus: 'MATCHED',
        matchedItemId: byBarcode.id,
        matchedItemName: byBarcode.name,
        matchConfidence: 99,
        matchMethod: 'Barcode',
        matchedItem: byBarcode,
      };
    }
  }

  if (name) {
    const exactName = items.find((i) => i.name.trim().toLowerCase() === name);
    if (exactName) {
      return {
        matchStatus: 'MATCHED',
        matchedItemId: exactName.id,
        matchedItemName: exactName.name,
        matchConfidence: 96,
        matchMethod: 'Name',
        matchedItem: exactName,
      };
    }
  }

  if (brand && pkg) {
    const byBrandPkg = items.find(
      (i) =>
        i.name.toLowerCase().includes(brand) &&
        i.name.toLowerCase().includes(pkg)
    );
    if (byBrandPkg) {
      return {
        matchStatus: 'MATCHED',
        matchedItemId: byBrandPkg.id,
        matchedItemName: byBrandPkg.name,
        matchConfidence: 88,
        matchMethod: 'Brand+Size',
        matchedItem: byBrandPkg,
      };
    }
  }

  if (name) {
    const tokens = name.split(/\s+/).filter((t) => t.length >= 3);
    let best: Item | undefined;
    let bestScore = 0;
    for (const item of items) {
      const iName = item.name.toLowerCase();
      const hits = tokens.filter((tk) => iName.includes(tk)).length;
      const ratio = tokens.length > 0 ? hits / tokens.length : 0;
      if (ratio > bestScore && hits >= 2) {
        bestScore = ratio;
        best = item;
      }
    }
    if (best && bestScore >= 0.5) {
      return {
        matchStatus: 'MATCHED',
        matchedItemId: best.id,
        matchedItemName: best.name,
        matchConfidence: Math.round(bestScore * 90),
        matchMethod: 'Name',
        matchedItem: best,
      };
    }
  }

  if (hsn) {
    const byHsn = items.find((i) => (i.hsnCode || i.code || '').trim() === hsn);
    if (byHsn) {
      return {
        matchStatus: 'MATCHED',
        matchedItemId: byHsn.id,
        matchedItemName: byHsn.name,
        matchConfidence: 72,
        matchMethod: 'HSN',
        matchedItem: byHsn,
      };
    }
  }

  return {
    matchStatus: 'CREATE_NEW',
    matchConfidence: 0,
  };
}

export const PurchaseBillScannerView: React.FC = () => {
  const {
    items,
    transactions,
    purchaseScans,
    savePurchaseScanDraft,
    confirmPurchaseScan,
    currentUser,
    hasPermission,
    setActiveTab,
    showToast,
  } = useVyapar();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [activeSubTab, setActiveSubTab] = useState<'scanner' | 'history'>('scanner');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedBillFile[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [cropPreset, setCropPreset] = useState<'full' | 'trim10'>('full');

  const [draftScan, setDraftScan] = useState<PurchaseScanRecord | null>(null);
  const [paymentType, setPaymentType] = useState<'Credit' | 'Cash' | 'Bank Transfer' | 'UPI'>('Credit');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [previewDocModal, setPreviewDocModal] = useState<{ title: string; dataUrl: string; mimeType: string } | null>(null);

  const canEditSellingPrice =
    currentUser?.roleName === 'Owner' ||
    currentUser?.roleName === 'Admin' ||
    currentUser?.roleName === 'Manager' ||
    hasPermission('edit');

  const duplicateWarning = useMemo(() => {
    if (!draftScan) return null;
    const cleanGstin = (draftScan.supplierGstin || '').trim().toUpperCase();
    const cleanInv = (draftScan.invoiceNumber || '').trim().toLowerCase();
    const cleanDate = (draftScan.invoiceDate || '').trim();
    if (!cleanInv) return null;

    const dup = transactions.find((t) => {
      if (t.type !== 'Purchase' || t.isCancelled) return false;
      const tInv = (t.invoiceNo || '').trim().toLowerCase();
      const tGstin = (t.supplierGstin || t.partyGstin || '').trim().toUpperCase();
      const tDate = (t.date || '').split(',')[0].trim();
      const sameVendor = cleanGstin ? tGstin === cleanGstin : t.partyName.toLowerCase() === draftScan.supplierName.toLowerCase();
      return tInv === cleanInv && sameVendor && (!cleanDate || tDate === cleanDate);
    });

    return dup
      ? `Duplicate Bill Warning: Purchase #${dup.invoiceNo} from ${dup.partyName} (${dup.date}) is already recorded.`
      : null;
  }, [draftScan, transactions]);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const loaded: UploadedBillFile[] = [];
    for (const file of Array.from(fileList)) {
      if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
        showToast(`Unsupported file type: ${file.name}. Use JPG, PNG, or PDF.`, 'warning');
        continue;
      }
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });
      loaded.push({
        id: generateUniqueId('bfile'),
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        dataUrl,
        rotationDeg: 0,
      });
    }
    if (loaded.length > 0) {
      setUploadedFiles((prev) => [...prev, ...loaded]);
      setOcrError(null);
    }
  };

  const rotateActiveImage = async (deltaDeg: number) => {
    const file = uploadedFiles[selectedFileIndex];
    if (!file || file.mimeType === 'application/pdf') return;

    const img = new Image();
    img.src = file.dataUrl;
    await new Promise((res) => {
      img.onload = res;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rad = (deltaDeg * Math.PI) / 180;
    const swap = Math.abs(deltaDeg) % 180 === 90;
    canvas.width = swap ? img.height : img.width;
    canvas.height = swap ? img.width : img.height;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    const rotatedUrl = canvas.toDataURL('image/jpeg', 0.92);
    setUploadedFiles((prev) =>
      prev.map((f, i) =>
        i === selectedFileIndex ? { ...f, dataUrl: rotatedUrl, rotationDeg: (f.rotationDeg + deltaDeg) % 360 } : f
      )
    );
    showToast('Bill image rotated cleanly.');
  };

  const applyTrimCrop = async () => {
    const file = uploadedFiles[selectedFileIndex];
    if (!file || file.mimeType === 'application/pdf') return;

    const img = new Image();
    img.src = file.dataUrl;
    await new Promise((res) => {
      img.onload = res;
    });

    const marginX = Math.round(img.width * 0.05);
    const marginY = Math.round(img.height * 0.05);
    const w = Math.max(50, img.width - marginX * 2);
    const h = Math.max(50, img.height - marginY * 2);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, marginX, marginY, w, h, 0, 0, w, h);

    const croppedUrl = canvas.toDataURL('image/jpeg', 0.92);
    setUploadedFiles((prev) =>
      prev.map((f, i) => (i === selectedFileIndex ? { ...f, dataUrl: croppedUrl } : f))
    );
    setCropPreset('trim10');
    showToast('Cropped outer margin 5% for sharper OCR.');
  };

  const handleExtractWithAI = async () => {
    if (uploadedFiles.length === 0) {
      showToast('Upload or capture at least one supplier bill image/PDF first.', 'warning');
      return;
    }
    setIsExtracting(true);
    setOcrError(null);
    try {
      const payload = uploadedFiles.map((f) => ({
        name: f.name,
        mimeType: f.mimeType,
        base64Data: f.dataUrl,
      }));
      const res = await apiClient.extractPurchaseBill(payload);
      const ext = res.extracted || {};

      const mappedItems: PurchaseScanItem[] = (Array.isArray(ext.items) ? ext.items : []).map((raw: any) => {
        const match = matchScannedLineToItem(raw, items);
        const qty = Math.max(0, Number(raw.qty) || 0);
        const freeQty = Math.max(0, Number(raw.freeQty) || 0);
        const purchasePrice = Number(raw.purchasePrice) || 0;
        const discountPercent = Number(raw.discountPercent) || 0;
        const discountAmount = Number(raw.discountAmount) || 0;
        const gstRate = Number(raw.gstRate) || 0;
        const taxableValue =
          Number(raw.taxableValue) || Math.round(qty * purchasePrice * (1 - discountPercent / 100) * 100) / 100;
        const cgstAmount = Number(raw.cgstAmount) || 0;
        const sgstAmount = Number(raw.sgstAmount) || 0;
        const igstAmount = Number(raw.igstAmount) || 0;
        const totalAmount =
          Number(raw.totalAmount) || Math.round((taxableValue + cgstAmount + sgstAmount + igstAmount) * 100) / 100;

        return {
          id: generateUniqueId('sli'),
          scannedName: String(raw.scannedName || 'Unnamed Item'),
          brand: String(raw.brand || ''),
          hsnCode: String(raw.hsnCode || match.matchedItem?.hsnCode || ''),
          barcode: String(raw.barcode || ''),
          qty,
          freeQty,
          unit: String(raw.unit || match.matchedItem?.unit || 'PCS'),
          packageSize: String(raw.packageSize || ''),
          purchasePrice,
          discountPercent,
          discountAmount,
          taxableValue,
          gstRate,
          cgstAmount,
          sgstAmount,
          igstAmount,
          totalAmount,
          batchNo: String(raw.batchNo || ''),
          expiryDate: String(raw.expiryDate || ''),
          matchStatus: match.matchStatus,
          matchedItemId: match.matchedItemId,
          matchedItemName: match.matchedItemName,
          matchConfidence: match.matchConfidence,
          matchMethod: match.matchMethod,
          previousPurchasePrice: match.matchedItem?.purchasePrice,
          lastSupplierPrice: match.matchedItem?.lastSupplierPrice,
          currentSellingPrice: match.matchedItem?.salePrice,
          updatedSellingPrice: match.matchedItem?.salePrice,
        };
      });

      const scan: PurchaseScanRecord = {
        id: generateUniqueId('pscan'),
        status: 'VERIFIED',
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name || 'Admin',
        sourceFiles: uploadedFiles.map((f) => ({
          name: f.name,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          previewDataUrl: f.dataUrl,
        })),
        supplierName: String(ext.supplierName || ''),
        supplierGstin: String(ext.supplierGstin || '').toUpperCase(),
        supplierAddress: String(ext.supplierAddress || ''),
        supplierPhone: String(ext.supplierPhone || ''),
        invoiceNumber: String(ext.invoiceNumber || ''),
        invoiceDate: String(ext.invoiceDate || new Date().toLocaleDateString('en-GB')),
        dueDate: String(ext.dueDate || ''),
        purchaseOrderNo: String(ext.purchaseOrderNo || ''),
        gstType: String(ext.gstType || '').toLowerCase().includes('inter') ? 'Inter-State' : 'Intra-State',
        subtotal: Number(ext.subtotal) || mappedItems.reduce((s, l) => s + l.taxableValue, 0),
        totalTaxable: Number(ext.totalTaxable) || mappedItems.reduce((s, l) => s + l.taxableValue, 0),
        totalCgst: Number(ext.totalCgst) || mappedItems.reduce((s, l) => s + l.cgstAmount, 0),
        totalSgst: Number(ext.totalSgst) || mappedItems.reduce((s, l) => s + l.sgstAmount, 0),
        totalIgst: Number(ext.totalIgst) || mappedItems.reduce((s, l) => s + l.igstAmount, 0),
        grandTotal: Number(ext.grandTotal) || mappedItems.reduce((s, l) => s + l.totalAmount, 0),
        items: mappedItems,
      };

      setDraftScan(scan);
      setAllowDuplicate(false);
      showToast(`AI extracted ${mappedItems.length} item(s) from supplier bill. Please verify before confirming.`);
    } catch (err: any) {
      const msg = err?.message || 'AI OCR extraction failed.';
      setOcrError(msg);
      showToast(msg, 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  const initManualDraftFromFiles = () => {
    const scan: PurchaseScanRecord = {
      id: generateUniqueId('pscan'),
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || 'Admin',
      sourceFiles: uploadedFiles.map((f) => ({
        name: f.name,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        previewDataUrl: f.dataUrl,
      })),
      supplierName: '',
      supplierGstin: '',
      supplierAddress: '',
      supplierPhone: '',
      invoiceNumber: '',
      invoiceDate: new Date().toLocaleDateString('en-GB'),
      dueDate: '',
      purchaseOrderNo: '',
      gstType: 'Intra-State',
      subtotal: 0,
      totalTaxable: 0,
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 0,
      grandTotal: 0,
      items: [
        {
          id: generateUniqueId('sli'),
          scannedName: '',
          hsnCode: '',
          qty: 1,
          freeQty: 0,
          unit: 'PCS',
          purchasePrice: 0,
          discountPercent: 0,
          discountAmount: 0,
          taxableValue: 0,
          gstRate: 18,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          totalAmount: 0,
          matchStatus: 'CREATE_NEW',
        },
      ],
    };
    setDraftScan(scan);
  };

  const updateScanItem = (lineId: string, patch: Partial<PurchaseScanItem>) => {
    if (!draftScan) return;
    const nextItems = draftScan.items.map((line) => {
      if (line.id !== lineId) return line;
      const merged = { ...line, ...patch };
      const base = (Number(merged.qty) || 0) * (Number(merged.purchasePrice) || 0);
      const disc = (base * (Number(merged.discountPercent) || 0)) / 100;
      const taxable = Math.round((base - disc) * 100) / 100;
      const tax = Math.round(((taxable * (Number(merged.gstRate) || 0)) / 100) * 100) / 100;
      const isInter = draftScan.gstType === 'Inter-State';
      return {
        ...merged,
        discountAmount: Math.round(disc * 100) / 100,
        taxableValue: taxable,
        cgstAmount: isInter ? 0 : Math.round((tax / 2) * 100) / 100,
        sgstAmount: isInter ? 0 : Math.round((tax / 2) * 100) / 100,
        igstAmount: isInter ? tax : 0,
        totalAmount: Math.round((taxable + tax) * 100) / 100,
      };
    });

    const active = nextItems.filter((l) => l.matchStatus !== 'IGNORED');
    setDraftScan({
      ...draftScan,
      items: nextItems,
      subtotal: Math.round(active.reduce((s, l) => s + l.taxableValue, 0) * 100) / 100,
      totalTaxable: Math.round(active.reduce((s, l) => s + l.taxableValue, 0) * 100) / 100,
      totalCgst: Math.round(active.reduce((s, l) => s + l.cgstAmount, 0) * 100) / 100,
      totalSgst: Math.round(active.reduce((s, l) => s + l.sgstAmount, 0) * 100) / 100,
      totalIgst: Math.round(active.reduce((s, l) => s + l.igstAmount, 0) * 100) / 100,
      grandTotal: Math.round(active.reduce((s, l) => s + l.totalAmount, 0) * 100) / 100,
    });
  };

  const handleLinkExistingItem = (lineId: string, itemId: string) => {
    const matched = items.find((i) => i.id === itemId);
    if (!matched) {
      updateScanItem(lineId, {
        matchStatus: 'CREATE_NEW',
        matchedItemId: undefined,
        matchedItemName: undefined,
        previousPurchasePrice: undefined,
        lastSupplierPrice: undefined,
        currentSellingPrice: undefined,
      });
      return;
    }
    updateScanItem(lineId, {
      matchStatus: 'MATCHED',
      matchedItemId: matched.id,
      matchedItemName: matched.name,
      matchMethod: 'Manual',
      matchConfidence: 100,
      hsnCode: matched.hsnCode || undefined,
      previousPurchasePrice: matched.purchasePrice,
      lastSupplierPrice: matched.lastSupplierPrice,
      currentSellingPrice: matched.salePrice,
      updatedSellingPrice: matched.salePrice,
    });
  };

  const handleConfirmPurchase = async () => {
    if (!draftScan) return;
    if (!draftScan.supplierName.trim()) {
      showToast('Supplier name is required before confirming purchase.', 'warning');
      return;
    }
    if (!draftScan.invoiceNumber.trim()) {
      showToast('Supplier Invoice Number is required.', 'warning');
      return;
    }

    setIsConfirming(true);
    try {
      const res = await confirmPurchaseScan(draftScan, {
        allowDuplicate,
        paymentType,
        paidAmount,
      });
      if (!res.success) {
        showToast(res.message, 'error');
        return;
      }
      showToast(res.message, 'success');
      setDraftScan(null);
      setUploadedFiles([]);
      setActiveSubTab('history');
    } finally {
      setIsConfirming(false);
    }
  };

  const activeFile = uploadedFiles[selectedFileIndex] || null;

  return (
    <div className="flex-1 bg-[#f5f6fa] dark:bg-slate-950 overflow-y-auto px-4 sm:px-6 py-5 text-xs text-slate-800 dark:text-slate-100 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#8E0E20]" />
            <span>AI Purchase Bill Scanner &amp; Stock Inward</span>
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Upload JPG, PNG, or multi-page PDF supplier invoices. Verify extracted line items, purchase price changes, batch/expiry &amp; GST ITC before posting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('scanner')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold border cursor-pointer ${
              activeSubTab === 'scanner'
                ? 'bg-[#8E0E20] text-white border-[#8E0E20]'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            Bill Scanner
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('history')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold border cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'history'
                ? 'bg-[#8E0E20] text-white border-[#8E0E20]'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Scanned Bills ({purchaseScans.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('purchase')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer flex items-center gap-1"
          >
            <span>Purchase Register</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {activeSubTab === 'history' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-sm">Scanned Purchase Bills History &amp; Drafts</h2>
            <span className="text-[11px] text-slate-500">Original supplier bills remain attached for audit inspection</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Scan Date</th>
                  <th className="py-3 px-4">Invoice No</th>
                  <th className="py-3 px-4">Supplier / GSTIN</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {purchaseScans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No scanned purchase bills yet. Upload a supplier invoice in the Scanner tab.
                    </td>
                  </tr>
                ) : (
                  purchaseScans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {scan.invoiceDate || scan.createdAt.slice(0, 10)}
                      </td>
                      <td className="py-3 px-4 font-bold">{scan.invoiceNumber || '(Draft)'}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold">{scan.supplierName || 'Unnamed Supplier'}</div>
                        <div className="text-[10px] font-mono text-slate-500">{scan.supplierGstin || 'No GSTIN'}</div>
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums">{scan.items.length}</td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums">
                        ₹ {(scan.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            scan.status === 'CONFIRMED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : scan.status === 'CANCELLED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {scan.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {scan.sourceFiles[0]?.previewDataUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewDocModal({
                                  title: `Original Bill #${scan.invoiceNumber || scan.id}`,
                                  dataUrl: scan.sourceFiles[0].previewDataUrl!,
                                  mimeType: scan.sourceFiles[0].mimeType,
                                })
                              }
                              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Original Bill</span>
                            </button>
                          )}
                          {scan.status !== 'CONFIRMED' && (
                            <button
                              type="button"
                              onClick={() => {
                                setDraftScan(scan);
                                setActiveSubTab('scanner');
                              }}
                              className="px-2.5 py-1 rounded bg-[#8E0E20] text-white text-[11px] font-semibold cursor-pointer"
                            >
                              Resume Verify
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
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* LEFT: Upload & Image Crop/Rotate Preview (4 cols) */}
          <div className="xl:col-span-4 space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFilesSelected(e.dataTransfer.files);
              }}
              className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#8E0E20] rounded-2xl p-5 text-center space-y-3 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-[#8E0E20] mx-auto flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  Upload or Capture Supplier Purchase Bill
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Drag &amp; drop JPG, PNG, or multi-page PDF files (up to 6 pages/files per scan)
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleFilesSelected(e.target.files)}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => void handleFilesSelected(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-800"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Files / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-50"
                >
                  <Camera className="w-3.5 h-3.5 text-[#8E0E20]" />
                  <span>Camera Scan</span>
                </button>
              </div>
            </div>

            {/* Active Document Viewer + Rotate / Crop Toolbar */}
            {uploadedFiles.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60">
                  <span className="font-bold text-[11px] truncate">
                    Page {selectedFileIndex + 1} of {uploadedFiles.length}: {activeFile?.name}
                  </span>
                  <div className="flex items-center gap-1">
                    {activeFile?.mimeType !== 'application/pdf' && (
                      <>
                        <button
                          type="button"
                          onClick={() => void rotateActiveImage(90)}
                          title="Rotate 90° Clockwise"
                          className="p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 cursor-pointer"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void applyTrimCrop()}
                          title="Auto-Trim Margins 5%"
                          className={`p-1.5 rounded border cursor-pointer ${
                            cropPreset === 'trim10'
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100'
                          }`}
                        >
                          <Crop className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedFiles((prev) => prev.filter((_, i) => i !== selectedFileIndex));
                        setSelectedFileIndex(0);
                      }}
                      title="Remove Page"
                      className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {uploadedFiles.length > 1 && (
                  <div className="flex gap-1.5 p-2 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
                    {uploadedFiles.map((f, idx) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedFileIndex(idx)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold shrink-0 cursor-pointer ${
                          idx === selectedFileIndex
                            ? 'bg-[#8E0E20] text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Page {idx + 1}
                      </button>
                    ))}
                  </div>
                )}

                <div className="p-3 bg-slate-950/5 flex items-center justify-center max-h-[380px] overflow-auto">
                  {activeFile?.mimeType === 'application/pdf' ? (
                    <iframe
                      src={activeFile.dataUrl}
                      title={activeFile.name}
                      className="w-full h-[340px] rounded border border-slate-200"
                    />
                  ) : (
                    <img
                      src={activeFile?.dataUrl}
                      alt={activeFile?.name}
                      className="max-h-[340px] w-auto object-contain rounded border border-slate-200 shadow-xs"
                    />
                  )}
                </div>

                <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isExtracting}
                    onClick={() => void handleExtractWithAI()}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#8E0E20] to-[#B91C1C] hover:from-[#740918] hover:to-[#991b1b] text-white font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isExtracting ? 'Extracting Bill with AI...' : 'Scan & Extract Bill (AI)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={initManualDraftFromFiles}
                    className="px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Manual Entry
                  </button>
                </div>
              </div>
            )}

            {ocrError && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-3.5 text-rose-800 dark:text-rose-200 space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>AI Bill Extraction Notice</span>
                </div>
                <p className="text-[11px] leading-relaxed">{ocrError}</p>
                <button
                  type="button"
                  onClick={initManualDraftFromFiles}
                  className="px-3 py-1 rounded bg-rose-700 text-white font-semibold text-[11px] cursor-pointer"
                >
                  Open Side-by-Side Manual Bill Entry
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: Verification, Smart Item Matching & Price Intelligence (8 cols) */}
          <div className="xl:col-span-8 space-y-4">
            {!draftScan ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
                <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Upload a Supplier Bill to Begin Verification
                </h2>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">
                  Extracted supplier GSTIN, invoice date, free quantities, batches, expiry dates, and purchase price variance will appear here for one-click verification before updating stock &amp; supplier ledger.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {duplicateWarning && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <div className="font-bold">{duplicateWarning}</div>
                        <div className="text-[11px]">Duplicate protection blocks accidental double inward unless explicitly overridden.</div>
                      </div>
                    </div>
                    <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowDuplicate}
                        onChange={(e) => setAllowDuplicate(e.target.checked)}
                      />
                      <span>Override Duplicate Check</span>
                    </label>
                  </div>
                )}

                {/* Supplier & Invoice Header Verification */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm">1. Supplier &amp; Invoice Header</h3>
                    <span className="text-[11px] font-mono text-slate-500">{draftScan.id}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Supplier Name *</label>
                      <input
                        type="text"
                        value={draftScan.supplierName}
                        onChange={(e) => setDraftScan({ ...draftScan, supplierName: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Supplier GSTIN</label>
                      <input
                        type="text"
                        value={draftScan.supplierGstin}
                        onChange={(e) => setDraftScan({ ...draftScan, supplierGstin: e.target.value.toUpperCase() })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Invoice Number *</label>
                      <input
                        type="text"
                        value={draftScan.invoiceNumber}
                        onChange={(e) => setDraftScan({ ...draftScan, invoiceNumber: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Invoice Date</label>
                      <input
                        type="text"
                        value={draftScan.invoiceDate}
                        onChange={(e) => setDraftScan({ ...draftScan, invoiceDate: e.target.value })}
                        placeholder="DD/MM/YYYY"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">GST Mode</label>
                      <select
                        value={draftScan.gstType}
                        onChange={(e) =>
                          setDraftScan({
                            ...draftScan,
                            gstType: e.target.value as 'Intra-State' | 'Inter-State',
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      >
                        <option value="Intra-State">Intra-State (CGST + SGST)</option>
                        <option value="Inter-State">Inter-State (IGST)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Due Date</label>
                      <input
                        type="text"
                        value={draftScan.dueDate}
                        onChange={(e) => setDraftScan({ ...draftScan, dueDate: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">PO Number</label>
                      <input
                        type="text"
                        value={draftScan.purchaseOrderNo || ''}
                        onChange={(e) => setDraftScan({ ...draftScan, purchaseOrderNo: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Supplier Phone</label>
                      <input
                        type="text"
                        value={draftScan.supplierPhone}
                        onChange={(e) => setDraftScan({ ...draftScan, supplierPhone: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Line Items Verification & Smart Matching + Price Intelligence */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-sm">2. Line Items, Smart Inventory Matching &amp; Price Intelligence</h3>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftScan({
                          ...draftScan,
                          items: [
                            ...draftScan.items,
                            {
                              id: generateUniqueId('sli'),
                              scannedName: '',
                              hsnCode: '',
                              qty: 1,
                              freeQty: 0,
                              unit: 'PCS',
                              purchasePrice: 0,
                              discountPercent: 0,
                              discountAmount: 0,
                              taxableValue: 0,
                              gstRate: 18,
                              cgstAmount: 0,
                              sgstAmount: 0,
                              igstAmount: 0,
                              totalAmount: 0,
                              matchStatus: 'CREATE_NEW',
                            },
                          ],
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Line</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300">
                        <tr>
                          <th className="py-2.5 px-3">Scanned Item &amp; Match Action</th>
                          <th className="py-2.5 px-2">HSN</th>
                          <th className="py-2.5 px-2 w-16 text-right">Qty</th>
                          <th className="py-2.5 px-2 w-14 text-right">Free</th>
                          <th className="py-2.5 px-2 w-24 text-right">New Rate</th>
                          <th className="py-2.5 px-2">Price Intel (Prev / Sell)</th>
                          <th className="py-2.5 px-2 w-16 text-right">GST %</th>
                          <th className="py-2.5 px-2">Batch / Expiry</th>
                          <th className="py-2.5 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {draftScan.items.map((line) => {
                          const priceDiff =
                            line.previousPurchasePrice !== undefined && line.previousPurchasePrice > 0
                              ? line.purchasePrice - line.previousPurchasePrice
                              : 0;
                          const priceDiffPct =
                            line.previousPurchasePrice && line.previousPurchasePrice > 0
                              ? Math.round((priceDiff / line.previousPurchasePrice) * 1000) / 10
                              : 0;

                          return (
                            <tr
                              key={line.id}
                              className={line.matchStatus === 'IGNORED' ? 'opacity-45 bg-slate-50' : ''}
                            >
                              <td className="py-2.5 px-3 min-w-[230px] space-y-1.5">
                                <input
                                  type="text"
                                  value={line.scannedName}
                                  onChange={(e) => updateScanItem(line.id, { scannedName: e.target.value })}
                                  placeholder="Product name"
                                  className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                                />
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={
                                      line.matchStatus === 'IGNORED'
                                        ? '__IGNORE__'
                                        : line.matchedItemId || '__NEW__'
                                    }
                                    onChange={(e) => {
                                      if (e.target.value === '__IGNORE__') {
                                        updateScanItem(line.id, { matchStatus: 'IGNORED' });
                                      } else if (e.target.value === '__NEW__') {
                                        handleLinkExistingItem(line.id, '');
                                      } else {
                                        handleLinkExistingItem(line.id, e.target.value);
                                      }
                                    }}
                                    className="flex-1 px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[10px] font-semibold"
                                  >
                                    <option value="__NEW__">+ Create New Product</option>
                                    <option value="__IGNORE__">Ignore Line</option>
                                    {items.map((it) => (
                                      <option key={it.id} value={it.id}>
                                        Match: {it.name} (Stock: {it.stock})
                                      </option>
                                    ))}
                                  </select>
                                  {line.matchMethod && line.matchStatus === 'MATCHED' && (
                                    <span className="text-[10px] font-bold text-emerald-700">
                                      {line.matchMethod} ({line.matchConfidence}%)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-2">
                                <input
                                  type="text"
                                  value={line.hsnCode || ''}
                                  onChange={(e) => updateScanItem(line.id, { hsnCode: e.target.value })}
                                  className="w-16 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 font-mono"
                                />
                              </td>
                              <td className="py-2.5 px-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={line.qty}
                                  onChange={(e) => updateScanItem(line.id, { qty: Number(e.target.value) })}
                                  className="w-14 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-right tabular-nums"
                                />
                              </td>
                              <td className="py-2.5 px-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={line.freeQty}
                                  onChange={(e) => updateScanItem(line.id, { freeQty: Number(e.target.value) })}
                                  className="w-12 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-right tabular-nums"
                                />
                              </td>
                              <td className="py-2.5 px-2">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={line.purchasePrice}
                                  onChange={(e) => updateScanItem(line.id, { purchasePrice: Number(e.target.value) })}
                                  className="w-20 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-right tabular-nums font-bold"
                                />
                              </td>
                              <td className="py-2.5 px-2 min-w-[140px]">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 text-[10px] tabular-nums">
                                    <span className="text-slate-400">Prev:</span>
                                    <span className="font-semibold">₹{line.previousPurchasePrice ?? 0}</span>
                                    {priceDiff !== 0 && (
                                      <span
                                        className={`inline-flex items-center font-bold ${
                                          priceDiff > 0 ? 'text-rose-600' : 'text-emerald-600'
                                        }`}
                                      >
                                        {priceDiff > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                                        {priceDiff > 0 ? '+' : ''}
                                        {priceDiffPct}%
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-400">Sell:</span>
                                    <input
                                      type="number"
                                      disabled={!canEditSellingPrice}
                                      value={line.updatedSellingPrice ?? line.currentSellingPrice ?? 0}
                                      onChange={(e) =>
                                        updateScanItem(line.id, { updatedSellingPrice: Number(e.target.value) })
                                      }
                                      className="w-16 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-right text-[10px] tabular-nums disabled:opacity-50"
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-2">
                                <select
                                  value={line.gstRate}
                                  onChange={(e) => updateScanItem(line.id, { gstRate: Number(e.target.value) })}
                                  className="px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 tabular-nums"
                                >
                                  {[0, 5, 12, 18, 28].map((r) => (
                                    <option key={r} value={r}>
                                      {r}%
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2.5 px-2 min-w-[115px] space-y-1">
                                <input
                                  type="text"
                                  placeholder="Batch"
                                  value={line.batchNo || ''}
                                  onChange={(e) => updateScanItem(line.id, { batchNo: e.target.value })}
                                  className="w-full px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px]"
                                />
                                <input
                                  type="text"
                                  placeholder="Exp YYYY-MM-DD"
                                  value={line.expiryDate || ''}
                                  onChange={(e) => updateScanItem(line.id, { expiryDate: e.target.value })}
                                  className="w-full px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px]"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                                ₹{line.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Settlement & Action Footer */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Taxable Value</span>
                      <span className="text-sm font-bold tabular-nums">
                        ₹{draftScan.totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Total GST ITC</span>
                      <span className="text-sm font-bold text-emerald-600 tabular-nums">
                        ₹{(draftScan.totalCgst + draftScan.totalSgst + draftScan.totalIgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Grand Total</span>
                      <span className="text-lg font-extrabold text-[#8E0E20] tabular-nums">
                        ₹{draftScan.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-4">
                      <select
                        value={paymentType}
                        onChange={(e) => setPaymentType(e.target.value as typeof paymentType)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                      >
                        <option value="Credit">Credit (Payable)</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="UPI">UPI</option>
                        <option value="Cash">Cash</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(Number(e.target.value))}
                        placeholder="Paid ₹"
                        className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-right tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDraftScan(null);
                      }}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void savePurchaseScanDraft({ ...draftScan, status: 'DRAFT' })}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Draft</span>
                    </button>
                    <button
                      type="button"
                      disabled={isConfirming}
                      onClick={() => void handleConfirmPurchase()}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isConfirming ? 'Posting Purchase...' : 'Confirm Purchase & Update Stock'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Original Supplier Document Preview Modal */}
      {previewDocModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl overflow-hidden shadow-2xl">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm">{previewDocModal.title}</h3>
              <button
                type="button"
                onClick={() => setPreviewDocModal(null)}
                className="p-1 rounded hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 max-h-[75vh] overflow-auto flex justify-center bg-slate-100 dark:bg-slate-950">
              {previewDocModal.mimeType === 'application/pdf' ? (
                <iframe src={previewDocModal.dataUrl} title={previewDocModal.title} className="w-full h-[65vh]" />
              ) : (
                <img src={previewDocModal.dataUrl} alt={previewDocModal.title} className="max-h-[68vh] object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
