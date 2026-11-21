import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Barcode,
  Search,
  Printer,
  Package,
  Sparkles,
  Check,
  Camera,
  Save,
  Trash2,
  CheckSquare,
  Square,
  Plus,
  Minus,
  Layers,
  ShieldAlert,
  FileSpreadsheet,
  Wand2,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { Item } from '../types';
import {
  SupportedBarcodeFormat,
  findItemByBarcode,
  generateUniqueEan13Barcode,
  isBarcodeUnique,
  renderBarcodeToSvg,
} from '../utils/barcodeUtils';

interface BarcodeSvgProps {
  value: string;
  format: SupportedBarcodeFormat;
  height?: number;
  width?: number;
}

const BarcodeSvg: React.FC<BarcodeSvgProps> = ({ value, format, height = 38, width = 1.45 }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    renderBarcodeToSvg(svgRef.current, value, format, {
      height,
      width,
      fontSize: 10,
      margin: 2,
      displayValue: true,
    });
  }, [value, format, height, width]);

  return <svg ref={svgRef} className="max-w-full h-auto mx-auto" />;
};

interface PrintLabelItem {
  key: string;
  name: string;
  code: string;
  brand?: string;
  category?: string;
  barcode: string;
  salePrice: number;
  mrp?: number;
  batchNo?: string;
  expiryDate?: string;
}

export const BarcodeStudioView: React.FC = () => {
  const {
    items,
    company,
    businessSettings,
    selectedItemId,
    setSelectedItemId,
    updateItem,
    openBarcodeScanner,
    canManageBarcodes,
    requestConfirmation,
    recordActivity,
    showToast,
  } = useVyapar();

  const initialItem = items.find((i) => i.id === selectedItemId) || items[0];
  const [activeItemId, setActiveItemId] = useState(initialItem?.id || '');
  const [customBarcodeText, setCustomBarcodeText] = useState(
    initialItem?.barcode || initialItem?.code || '8901000000012'
  );
  const [barcodeFormat, setBarcodeFormat] = useState<SupportedBarcodeFormat>('AUTO');
  const [singleLabelQty, setSingleLabelQty] = useState(12);
  const [singleProductSearch, setSingleProductSearch] = useState('');
  const [mode, setMode] = useState<'SINGLE' | 'BULK'>('SINGLE');
  const [bulkCounts, setBulkCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    items.slice(0, 6).forEach((it) => {
      initial[it.id] = 4;
    });
    return initial;
  });
  const [catalogFilter, setCatalogFilter] = useState('');
  const [includeStoreName, setIncludeStoreName] = useState(true);
  const [includePrice, setIncludePrice] = useState(true);
  const [includeMrp, setIncludeMrp] = useState(true);
  const [includeSku, setIncludeSku] = useState(false);
  const [includeBrand, setIncludeBrand] = useState(false);
  const [includeExpiry, setIncludeExpiry] = useState(false);
  const [labelPreset, setLabelPreset] = useState<'GRID' | 'THERMAL_50X25'>('GRID');
  const [labelDensity, setLabelDensity] = useState<'3-col' | '4-col' | '2-col'>('3-col');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [scannedResult, setScannedResult] = useState<Item | null>(null);

  const selectedItem = items.find((i) => i.id === activeItemId) || items[0];
  const canEditBarcodes = canManageBarcodes();

  const itemsMissingBarcodes = useMemo(
    () => items.filter((it) => !it.barcode || !it.barcode.trim()),
    [items]
  );

  const singleSelectItems = useMemo(() => {
    const q = singleProductSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.barcode || '').toLowerCase().includes(q) ||
        (i.extraBarcodes || []).some((b) => b.toLowerCase().includes(q)) ||
        (i.sku || '').toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q) ||
        (i.brand || '').toLowerCase().includes(q)
    );
  }, [items, singleProductSearch]);

  useEffect(() => {
    if (selectedItem) {
      setCustomBarcodeText(selectedItem.barcode || selectedItem.code || '');
    }
  }, [selectedItem?.id]);

  const handleSelectProduct = (item: Item) => {
    setActiveItemId(item.id);
    setSelectedItemId(item.id);
    setCustomBarcodeText(item.barcode || item.code || '');
  };

  const handleGenerateNewEan13 = () => {
    const generated = generateUniqueEan13Barcode(
      items,
      `${selectedItem?.name || 'ITEM'}-${Date.now()}`
    );
    setCustomBarcodeText(generated);
    showToast(`Generated unique EAN-13 barcode: ${generated}`, 'info');
  };

  const handleSaveBarcodeToProduct = () => {
    if (!selectedItem) return;
    if (!canEditBarcodes) {
      showToast('Permission Denied: Only Admin/Inventory staff can update product barcodes.', 'error');
      return;
    }
    const clean = customBarcodeText.trim();
    if (!clean) {
      showToast('Barcode value cannot be empty.', 'error');
      return;
    }
    if (businessSettings?.item?.preventDuplicateBarcode) {
      const check = isBarcodeUnique(items, clean, selectedItem.id);
      if (!check.unique && check.conflictItem) {
        showToast(
          `Duplicate barcode blocked: "${clean}" is already assigned to "${check.conflictItem.name}".`,
          'error'
        );
        return;
      }
    }
    updateItem(selectedItem.id, { barcode: clean });
    showToast(`Saved barcode ${clean} to "${selectedItem.name}".`, 'success');
  };

  const handleBatchAutoAssignMissing = () => {
    if (!canEditBarcodes) {
      showToast('Permission Denied: Only Admin/Inventory staff can batch assign barcodes.', 'error');
      return;
    }
    if (itemsMissingBarcodes.length === 0) {
      showToast('All catalog products already have assigned barcodes.', 'info');
      return;
    }
    requestConfirmation({
      title: 'Auto-Assign Missing Barcodes',
      message: `Generate and save unique EAN-13 barcodes for ${itemsMissingBarcodes.length} product(s) that currently have no barcode?`,
      confirmLabel: `Assign ${itemsMissingBarcodes.length} Barcodes`,
      variant: 'primary',
      onConfirm: () => {
        const snapshot = [...items];
        let updatedCount = 0;
        itemsMissingBarcodes.forEach((it, idx) => {
          const generated = generateUniqueEan13Barcode(snapshot, `${it.id}-${it.name}-${idx}`);
          snapshot.push({ ...it, barcode: generated });
          updateItem(it.id, { barcode: generated });
          updatedCount += 1;
        });
        recordActivity(
          'Batch Barcode Assignment',
          'Inventory',
          `Auto-generated unique EAN-13 barcodes for ${updatedCount} products.`
        );
        showToast(`Assigned unique EAN-13 barcodes to ${updatedCount} products.`, 'success');
      },
    });
  };

  const handleScanWithModal = () => {
    openBarcodeScanner('lookup', (matched, rawCode) => {
      if (matched) {
        setScannedResult(matched);
        handleSelectProduct(matched);
        setBarcodeSearch(rawCode);
      } else {
        setBarcodeSearch(rawCode);
      }
    });
  };

  const handleInlineBarcodeLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const q = barcodeSearch.trim();
    if (!q) return;
    const found =
      findItemByBarcode(items, q) ||
      items.find((i) => i.name.toLowerCase().includes(q.toLowerCase()));
    if (found) {
      setScannedResult(found);
      handleSelectProduct(found);
      showToast(`Scan matched product: ${found.name}`, 'success');
    } else {
      setScannedResult(null);
      showToast(`No product matched "${q}"`, 'warning');
    }
  };

  const toggleBulkItem = (itemId: string) => {
    setBulkCounts((prev) => {
      const next = { ...prev };
      if (next[itemId] && next[itemId] > 0) {
        delete next[itemId];
      } else {
        next[itemId] = 4;
      }
      return next;
    });
  };

  const updateBulkCount = (itemId: string, count: number) => {
    setBulkCounts((prev) => {
      const next = { ...prev };
      if (count <= 0) {
        delete next[itemId];
      } else {
        next[itemId] = Math.min(60, count);
      }
      return next;
    });
  };

  const queueAllProducts = () => {
    const next: Record<string, number> = {};
    items.forEach((it) => {
      next[it.id] = 2;
    });
    setBulkCounts(next);
    setMode('BULK');
    showToast(`Queued ${items.length} products (2 labels each) for bulk printing.`, 'info');
  };

  const queueLowStockProducts = () => {
    const next: Record<string, number> = {};
    const low = items.filter((it) => it.stock <= (it.minStockAlert ?? 5));
    low.forEach((it) => {
      next[it.id] = 4;
    });
    setBulkCounts(next);
    setMode('BULK');
    showToast(
      low.length > 0
        ? `Queued ${low.length} low-stock products for label printing.`
        : 'No low-stock products currently detected.',
      'info'
    );
  };

  const filteredCatalog = useMemo(() => {
    const q = catalogFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        (it.barcode || '').toLowerCase().includes(q) ||
        (it.extraBarcodes || []).some((b) => b.toLowerCase().includes(q)) ||
        (it.sku || '').toLowerCase().includes(q) ||
        it.code.toLowerCase().includes(q) ||
        (it.brand || '').toLowerCase().includes(q)
    );
  }, [items, catalogFilter]);

  const printableLabels: PrintLabelItem[] = useMemo(() => {
    if (mode === 'SINGLE') {
      const count = Math.max(1, Math.min(singleLabelQty, 96));
      return Array.from({ length: count }).map((_, idx) => ({
        key: `single-${selectedItem?.id || 'custom'}-${idx}`,
        name: selectedItem?.name || 'Store Product',
        code: selectedItem?.code || 'SKU',
        brand: selectedItem?.brand,
        category: selectedItem?.category,
        barcode: customBarcodeText.trim() || selectedItem?.barcode || selectedItem?.code || '8901000000012',
        salePrice: selectedItem?.salePrice || 0,
        mrp: selectedItem?.mrp,
        batchNo: selectedItem?.batchNo,
        expiryDate: selectedItem?.expiryDate,
      }));
    }

    const list: PrintLabelItem[] = [];
    items.forEach((it) => {
      const copies = bulkCounts[it.id] || 0;
      for (let c = 0; c < copies; c++) {
        list.push({
          key: `bulk-${it.id}-${c}`,
          name: it.name,
          code: it.code,
          brand: it.brand,
          category: it.category,
          barcode: it.barcode || it.code,
          salePrice: it.salePrice,
          mrp: it.mrp,
          batchNo: it.batchNo,
          expiryDate: it.expiryDate,
        });
      }
    });
    return list;
  }, [mode, singleLabelQty, selectedItem, customBarcodeText, items, bulkCounts]);

  const handlePrintLabels = () => {
    if (printableLabels.length === 0) {
      showToast('Select at least 1 label to print.', 'warning');
      return;
    }
    window.print();
    showToast(`Print dialog opened for ${printableLabels.length} barcode labels.`, 'success');
  };

  const handleExportLabelsCsv = () => {
    if (printableLabels.length === 0) {
      showToast('No labels queued to export.', 'warning');
      return;
    }
    // Group identical labels for cleaner thermal printer manifest
    const grouped = new Map<string, { item: PrintLabelItem; copies: number }>();
    printableLabels.forEach((lbl) => {
      const mapKey = `${lbl.code}-${lbl.barcode}-${lbl.salePrice}`;
      const existing = grouped.get(mapKey);
      if (existing) {
        existing.copies += 1;
      } else {
        grouped.set(mapKey, { item: lbl, copies: 1 });
      }
    });
    const headers = 'Store Name,Product Name,SKU Code,Barcode,Brand,Category,Sale Price,MRP,Batch No,Expiry Date,Copies\n';
    const rows = Array.from(grouped.values())
      .map(
        ({ item, copies }) =>
          `"${storeHeader.replace(/"/g, '""')}","${item.name.replace(/"/g, '""')}","${item.code}","${item.barcode}","${item.brand || ''}","${item.category || ''}",${item.salePrice},${item.mrp || ''},"${item.batchNo || ''}","${item.expiryDate || ''}",${copies}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Barcode_Label_Manifest_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported label manifest (${printableLabels.length} total stickers).`, 'success');
  };

  const storeHeader = company?.name?.trim() || 'MY STORE';

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-slate-950 flex flex-col overflow-hidden select-none text-xs text-slate-800 dark:text-slate-100">
      {/* Header (hidden during print) */}
      <div className="print:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center">
            <Barcode className="w-5 h-5 text-emerald-400 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 dark:text-white">
                Barcode Generator &amp; Label Studio
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                EAN-13 / UPC / Code-128 / Code-39
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Auto-generate unique scannable barcodes, test with camera/USB scanner, and bulk print product stickers
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => setMode('SINGLE')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                mode === 'SINGLE'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Single Product ({singleLabelQty})
            </button>
            <button
              type="button"
              onClick={() => setMode('BULK')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                mode === 'BULK'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Bulk Multi-Product ({Object.values(bulkCounts).reduce((a, b) => a + b, 0)})
            </button>
          </div>

          {itemsMissingBarcodes.length > 0 && canEditBarcodes && (
            <button
              type="button"
              onClick={handleBatchAutoAssignMissing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Auto-Fill Missing ({itemsMissingBarcodes.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportLabelsCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>CSV Manifest</span>
          </button>

          <button
            type="button"
            onClick={handleScanWithModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Scan Barcode</span>
          </button>

          <button
            type="button"
            onClick={handlePrintLabels}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-400 dark:text-white" />
            <span>Print {printableLabels.length} Labels</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 print:p-0 print:block">
        {/* Left Column Controls (hidden when printing) */}
        <div className="lg:col-span-5 space-y-5 print:hidden">
          {/* Quick Lookup & Scanner Box */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Search className="w-4 h-4 text-emerald-600" />
                <span>Barcode Lookup &amp; Scanner Test</span>
              </h3>
              <button
                type="button"
                onClick={handleScanWithModal}
                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Camera className="w-3 h-3" /> Open Camera / USB
              </button>
            </div>

            <form onSubmit={handleInlineBarcodeLookup} className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={barcodeSearch}
                  onChange={(e) => setBarcodeSearch(e.target.value)}
                  placeholder="Scan USB/Bluetooth barcode or type SKU..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                Find
              </button>
            </form>

            {scannedResult && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-emerald-950 dark:text-emerald-200 text-xs">
                    {scannedResult.name}
                  </div>
                  <div className="text-[11px] text-emerald-800 dark:text-emerald-400 font-mono">
                    Barcode: {scannedResult.barcode || scannedResult.code} &bull; ₹{scannedResult.salePrice}
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded bg-white dark:bg-slate-900 border font-bold text-[10px] ${
                    scannedResult.stock <= 0
                      ? 'border-rose-300 text-rose-700'
                      : 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  Stock: {scannedResult.stock} {scannedResult.unit}
                </span>
              </div>
            )}
          </div>

          {mode === 'SINGLE' ? (
            /* Single Product Label Editor */
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Single Product Barcode Generator
                  </h3>
                  <p className="text-[11px] text-slate-400">Assign unique barcode &amp; configure label sheet</p>
                </div>
                {!canEditBarcodes && (
                  <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Read-Only
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Filter &amp; Select Product
                  </label>
                  <input
                    type="text"
                    value={singleProductSearch}
                    onChange={(e) => setSingleProductSearch(e.target.value)}
                    placeholder="Quick filter products by name or SKU..."
                    className="w-full px-3 py-1.5 mb-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800"
                  />
                  <select
                    value={selectedItem?.id || ''}
                    onChange={(e) => {
                      const it = items.find((i) => i.id === e.target.value);
                      if (it) handleSelectProduct(it);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 font-semibold"
                  >
                    {singleSelectItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} — [{i.barcode || i.code}] (₹{i.salePrice} &bull; Stock: {i.stock})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Barcode Number
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={customBarcodeText}
                      onChange={(e) => setCustomBarcodeText(e.target.value)}
                      disabled={!canEditBarcodes}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold disabled:bg-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateNewEan13}
                      disabled={!canEditBarcodes}
                      title="Generate Unique EAN-13"
                      className="px-2.5 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Auto</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveBarcodeToProduct}
                      disabled={!canEditBarcodes}
                      title="Save Barcode to Product"
                      className="px-2.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Symbology Format
                    </label>
                    <select
                      value={barcodeFormat}
                      onChange={(e) => setBarcodeFormat(e.target.value as SupportedBarcodeFormat)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 font-semibold"
                    >
                      <option value="AUTO">Auto Detect (EAN/UPC/C128)</option>
                      <option value="EAN13">EAN-13 (13 digits)</option>
                      <option value="EAN8">EAN-8 (8 digits)</option>
                      <option value="UPC">UPC-A (12 digits)</option>
                      <option value="CODE128">Code 128</option>
                      <option value="CODE39">Code 39</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Sticker Copies
                    </label>
                    <input
                      type="number"
                      value={singleLabelQty}
                      onChange={(e) =>
                        setSingleLabelQty(Math.max(1, Math.min(96, parseInt(e.target.value, 10) || 1)))
                      }
                      min="1"
                      max="96"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Bulk Multi-Product Label Selector */
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span>Bulk Product Sticker Queue</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Pick multiple products &amp; sticker counts to print on 1 sheet
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkCounts({})}
                  className="text-[11px] text-rose-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={queueAllProducts}
                  className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[11px] cursor-pointer"
                >
                  + Queue All Products (&times;2)
                </button>
                <button
                  type="button"
                  onClick={queueLowStockProducts}
                  className="px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-bold text-[11px] cursor-pointer"
                >
                  + Queue Low Stock (&times;4)
                </button>
              </div>

              <input
                type="text"
                value={catalogFilter}
                onChange={(e) => setCatalogFilter(e.target.value)}
                placeholder="Filter catalog by name, brand, or barcode..."
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900"
              />

              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                {filteredCatalog.map((it) => {
                  const qty = bulkCounts[it.id] || 0;
                  const checked = qty > 0;
                  const isLowOrOut = it.stock <= (it.minStockAlert ?? 5);
                  return (
                    <div
                      key={it.id}
                      className={`px-3 py-2 flex items-center justify-between gap-2 ${
                        checked
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleBulkItem(it.id)}
                        className="flex items-center gap-2 text-left min-w-0 flex-1 cursor-pointer"
                      >
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                            <span className="truncate">{it.name}</span>
                            {isLowOrOut && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 shrink-0">
                                Stock: {it.stock}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                            {it.barcode || it.code} &bull; ₹{it.salePrice}
                          </div>
                        </div>
                      </button>

                      {checked && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateBulkCount(it.id, qty - 1)}
                            className="w-6 h-6 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center hover:bg-slate-100 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-7 text-center font-bold tabular-nums">{qty}</span>
                          <button
                            type="button"
                            onClick={() => updateBulkCount(it.id, qty + 1)}
                            className="w-6 h-6 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center hover:bg-slate-100 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Label Layout Options */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
              Sticker Content &amp; Sheet Layout
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeStoreName}
                  onChange={(e) => setIncludeStoreName(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span>Store Header ({storeHeader})</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePrice}
                  onChange={(e) => setIncludePrice(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span>Show Selling Price</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMrp}
                  onChange={(e) => setIncludeMrp(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span>Show MRP (if set)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSku}
                  onChange={(e) => setIncludeSku(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span>Show SKU / Item Code</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeBrand}
                  onChange={(e) => setIncludeBrand(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span>Show Brand / Category</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeExpiry}
                  onChange={(e) => setIncludeExpiry(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span>Show Batch / Expiry</span>
              </label>
              <div>
                <select
                  value={labelPreset}
                  onChange={(e) => setLabelPreset(e.target.value as 'GRID' | 'THERMAL_50X25')}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-[11px] font-semibold bg-white dark:bg-slate-800"
                >
                  <option value="GRID">A4 Laser / Inkjet Sheet</option>
                  <option value="THERMAL_50X25">50&times;25mm Thermal Roll Strip</option>
                </select>
              </div>
              <div>
                <select
                  value={labelDensity}
                  onChange={(e) => setLabelDensity(e.target.value as '2-col' | '3-col' | '4-col')}
                  disabled={labelPreset === 'THERMAL_50X25'}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-[11px] font-semibold bg-white dark:bg-slate-800 disabled:opacity-50"
                >
                  <option value="2-col">Large Labels (2 per row)</option>
                  <option value="3-col">Standard Labels (3 per row)</option>
                  <option value="4-col">Compact Labels (4 per row)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Scannable Sticker Print Sheet */}
        <div className="lg:col-span-7 space-y-4 print:w-full">
          <div className="flex items-center justify-between print:hidden">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600" />
              <span>Print Sheet Preview ({printableLabels.length} Scannable Stickers)</span>
            </h3>
            <span className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" /> Rendered with JsBarcode (ISO Scannable)
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs max-h-[76vh] overflow-y-auto print:border-0 print:shadow-none print:max-h-none print:overflow-visible print:p-2">
            {printableLabels.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Barcode className="w-10 h-10 mx-auto text-slate-300" />
                <div className="font-bold text-slate-600">No barcode labels queued</div>
                <div className="text-[11px]">
                  Select products on the left or switch to Single Product mode.
                </div>
              </div>
            ) : (
              <div
                className={
                  labelPreset === 'THERMAL_50X25'
                    ? 'flex flex-col items-center gap-3 print:gap-2'
                    : `grid gap-3 ${
                        labelDensity === '2-col'
                          ? 'grid-cols-1 sm:grid-cols-2 print:grid-cols-2'
                          : labelDensity === '4-col'
                          ? 'grid-cols-2 sm:grid-cols-4 print:grid-cols-4'
                          : 'grid-cols-2 sm:grid-cols-3 print:grid-cols-3'
                      }`
                }
              >
                {printableLabels.map((lbl) => (
                  <div
                    key={lbl.key}
                    className={`p-2.5 border border-dashed border-slate-300 rounded-lg bg-white text-slate-900 flex flex-col items-center justify-center text-center space-y-0.5 break-inside-avoid hover:border-emerald-400 transition-colors ${
                      labelPreset === 'THERMAL_50X25' ? 'w-56' : ''
                    }`}
                  >
                    {includeStoreName && (
                      <div className="text-[9px] font-black tracking-widest text-slate-800 uppercase truncate max-w-full">
                        {storeHeader}
                      </div>
                    )}

                    <div className="text-[10.5px] font-bold text-slate-900 truncate max-w-full px-1">
                      {lbl.name}
                    </div>

                    {(includeSku || includeBrand) && (
                      <div className="text-[9px] text-slate-500 font-semibold truncate max-w-full">
                        {[
                          includeSku ? `SKU: ${lbl.code}` : '',
                          includeBrand ? lbl.brand || lbl.category || '' : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}

                    <div className="w-full py-0.5 flex items-center justify-center overflow-hidden">
                      <BarcodeSvg
                        value={lbl.barcode}
                        format={barcodeFormat}
                        height={labelDensity === '4-col' && labelPreset === 'GRID' ? 30 : 38}
                        width={labelDensity === '4-col' && labelPreset === 'GRID' ? 1.25 : 1.45}
                      />
                    </div>

                    {(includePrice || includeMrp) && (
                      <div className="flex items-center justify-center gap-2 text-[10px] font-extrabold text-slate-900">
                        {includePrice && <span>Price: ₹{lbl.salePrice.toLocaleString('en-IN')}</span>}
                        {includeMrp && lbl.mrp !== undefined && lbl.mrp > 0 && (
                          <span className="text-slate-500 font-semibold">
                            MRP: ₹{lbl.mrp.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    )}

                    {includeExpiry && (lbl.batchNo || lbl.expiryDate) && (
                      <div className="text-[8.5px] font-mono text-slate-600">
                        {lbl.batchNo ? `B:${lbl.batchNo} ` : ''}
                        {lbl.expiryDate ? `EXP:${lbl.expiryDate}` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
