import React, { useMemo, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Search,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Download,
  BookOpen,
  Edit3,
  CheckSquare,
  History,
  Plus,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import {
  INDIA_HSN_SAC_MASTER,
  isValidGstin,
  isValidHsnOrSac,
  searchHsnMaster,
} from '../data/hsnMasterIndia';
import { exportCsvFile } from '../database/indexedDb';
import { HsnMasterEntry, Item } from '../types';

type HsnTab = 'mapping' | 'master' | 'alerts' | 'reports' | 'audits';

export const HsnGstManagementView: React.FC = () => {
  const {
    items,
    transactions,
    customHsnEntries,
    gstAudits,
    addCustomHsnEntry,
    bulkUpdateItemGst,
    showToast,
  } = useVyapar();

  const [tab, setTab] = useState<HsnTab>('mapping');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Bulk Update Bar & Diff Preview
  const [bulkHsn, setBulkHsn] = useState('');
  const [bulkRate, setBulkRate] = useState<number>(18);
  const [bulkCategory, setBulkCategory] = useState<NonNullable<Item['taxCategory']>>('Taxable');
  const [bulkEffectiveDate, setBulkEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showBulkDiffModal, setShowBulkDiffModal] = useState(false);

  // Authoritative HSN Lookup Drawer
  const [lookupTargetItemId, setLookupTargetItemId] = useState<string | null>(null);
  const [hsnQuery, setHsnQuery] = useState('');

  // Custom Official HSN Addition Modal
  const [showAddHsnModal, setShowAddHsnModal] = useState(false);
  const [newHsnForm, setNewHsnForm] = useState<HsnMasterEntry>({
    code: '',
    type: 'HSN',
    description: '',
    category: 'General',
    gstRate: 18,
    taxCategory: 'Taxable',
    uqc: 'PCS',
    sourceRef: 'CBIC Notification',
    effectiveDate: new Date().toISOString().slice(0, 10),
  });

  // CSV Import Ref
  const csvInputRef = useRef<HTMLInputElement>(null);

  const masterResults = useMemo(
    () => searchHsnMaster(hsnQuery, customHsnEntries),
    [hsnQuery, customHsnEntries]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        !q ||
        i.name.toLowerCase().includes(q) ||
        (i.hsnCode || '').toLowerCase().includes(q) ||
        (i.code || '').toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  // Compliance Alerts (Missing HSN, Invalid HSN, Unverified Tax, Missing B2B GSTIN, Tax Mismatch)
  const complianceAlerts = useMemo(() => {
    const alerts: Array<{ id: string; severity: 'HIGH' | 'MEDIUM'; type: string; entity: string; detail: string }> = [];
    for (const item of items) {
      const code = (item.hsnCode || item.sacCode || '').trim();
      if (!code) {
        alerts.push({
          id: `alt-miss-${item.id}`,
          severity: 'HIGH',
          type: 'Missing HSN/SAC',
          entity: item.name,
          detail: 'Product has no mapped HSN/SAC code. Required for GST reporting & e-Invoicing.',
        });
      } else if (!isValidHsnOrSac(code)) {
        alerts.push({
          id: `alt-inv-${item.id}`,
          severity: 'HIGH',
          type: 'Invalid HSN/SAC Format',
          entity: `${item.name} (${code})`,
          detail: 'HSN/SAC must be 4, 6, or 8 numeric digits per CBIC specification.',
        });
      } else if (!item.taxClassificationVerified) {
        alerts.push({
          id: `alt-unv-${item.id}`,
          severity: 'MEDIUM',
          type: 'Unverified Tax Classification',
          entity: `${item.name} (${code})`,
          detail: 'Review and verify against official Indian GST Council HSN rate schedule.',
        });
      }
    }

    for (const tx of transactions.filter((t) => t.type === 'Sale' && !t.isCancelled)) {
      if (tx.partyGstin && !isValidGstin(tx.partyGstin)) {
        alerts.push({
          id: `alt-gstin-${tx.id}`,
          severity: 'HIGH',
          type: 'Invalid Party GSTIN',
          entity: `Invoice #${tx.invoiceNo} (${tx.partyName})`,
          detail: `Recorded GSTIN "${tx.partyGstin}" fails 15-character checksum format.`,
        });
      }
      if (tx.taxableAmount && tx.taxableAmount > 0 && tx.items.length > 0) {
        const expectedTax = tx.items.reduce(
          (s, l) => s + (l.qty * l.price * (1 - (l.discountPercent || 0) / 100) * (l.taxPercent || 0)) / 100,
          0
        );
        const actualTax = (tx.cgstAmount || 0) + (tx.sgstAmount || 0) + (tx.igstAmount || 0);
        if (Math.abs(expectedTax - actualTax) > 5) {
          alerts.push({
            id: `alt-mismatch-${tx.id}`,
            severity: 'MEDIUM',
            type: 'Tax Calculation Mismatch',
            entity: `Invoice #${tx.invoiceNo}`,
            detail: `Line-level GST ₹${expectedTax.toFixed(2)} differs from header tax ₹${actualTax.toFixed(2)}.`,
          });
        }
      }
    }
    return alerts;
  }, [items, transactions]);

  // HSN-Wise Sales & Purchase Summary + Rate-Wise Collection
  const gstReportData = useMemo(() => {
    const hsnSales = new Map<string, { hsn: string; qty: number; taxable: number; tax: number; total: number }>();
    const hsnPurchases = new Map<string, { hsn: string; qty: number; taxable: number; itc: number; total: number }>();
    const rateSummary = new Map<number, { rate: number; salesTaxable: number; outputTax: number; purchaseTaxable: number; inputTax: number }>();

    transactions
      .filter((t) => !t.isCancelled && (t.type === 'Sale' || t.type === 'Purchase'))
      .forEach((tx) => {
        (tx.items || []).forEach((line) => {
          const hsn = (line.hsn || 'UNMAPPED').trim() || 'UNMAPPED';
          const base = (line.qty || 0) * (line.price || 0) * (1 - (line.discountPercent || 0) / 100);
          const rate = line.taxPercent || 0;
          const tax = (base * rate) / 100;

          if (tx.type === 'Sale') {
            const prev = hsnSales.get(hsn) || { hsn, qty: 0, taxable: 0, tax: 0, total: 0 };
            prev.qty += line.qty || 0;
            prev.taxable += base;
            prev.tax += tax;
            prev.total += base + tax;
            hsnSales.set(hsn, prev);

            const rp = rateSummary.get(rate) || { rate, salesTaxable: 0, outputTax: 0, purchaseTaxable: 0, inputTax: 0 };
            rp.salesTaxable += base;
            rp.outputTax += tax;
            rateSummary.set(rate, rp);
          } else {
            const prev = hsnPurchases.get(hsn) || { hsn, qty: 0, taxable: 0, itc: 0, total: 0 };
            prev.qty += line.qty || 0;
            prev.taxable += base;
            prev.itc += tax;
            prev.total += base + tax;
            hsnPurchases.set(hsn, prev);

            const rp = rateSummary.get(rate) || { rate, salesTaxable: 0, outputTax: 0, purchaseTaxable: 0, inputTax: 0 };
            rp.purchaseTaxable += base;
            rp.inputTax += tax;
            rateSummary.set(rate, rp);
          }
        });
      });

    return {
      hsnSales: Array.from(hsnSales.values()).sort((a, b) => b.total - a.total),
      hsnPurchases: Array.from(hsnPurchases.values()).sort((a, b) => b.total - a.total),
      rates: Array.from(rateSummary.values()).sort((a, b) => b.rate - a.rate),
    };
  }, [transactions]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBulkConfirm = async () => {
    if (bulkHsn && !isValidHsnOrSac(bulkHsn)) {
      showToast('Invalid HSN/SAC code (must be 4, 6, or 8 digits).', 'error');
      return;
    }
    const updates = selectedIds.map((id) => ({
      itemId: id,
      hsnCode: bulkHsn ? bulkHsn : undefined,
      taxRate: bulkRate,
      taxCategory: bulkCategory,
      effectiveDate: bulkEffectiveDate,
      taxClassificationVerified: true,
    }));
    await bulkUpdateItemGst(updates, 'BULK_UPDATE', `Bulk updated ${updates.length} products to ${bulkRate}% (${bulkCategory})`);
    setShowBulkDiffModal(false);
    setSelectedIds([]);
  };

  const handleExportCsv = () => {
    exportCsvFile(
      `BM360_HSN_GST_Catalog_${new Date().toISOString().slice(0, 10)}.csv`,
      ['ItemID', 'ProductName', 'SKU', 'HSN_SAC', 'GSTRate', 'TaxCategory', 'Unit', 'Verified'],
      items.map((i) => [
        i.id,
        i.name,
        i.code,
        i.hsnCode || i.sacCode || '',
        i.taxRate,
        i.taxCategory || 'Taxable',
        i.unit,
        i.taxClassificationVerified ? 'YES' : 'NO',
      ])
    );
    showToast('Exported HSN/GST product catalog CSV.');
  };

  const handleCsvImport = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      showToast('CSV must contain a header row and at least one product row.', 'warning');
      return;
    }
    const updates: Parameters<typeof bulkUpdateItemGst>[0] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
      const [idOrName, , , hsn, rateStr, cat] = cols;
      const item =
        items.find((it) => it.id === idOrName || it.name.toLowerCase() === (cols[1] || idOrName).toLowerCase());
      if (!item) continue;
      if (hsn && !isValidHsnOrSac(hsn)) continue;
      const rate = Number(rateStr);
      updates.push({
        itemId: item.id,
        hsnCode: hsn || item.hsnCode,
        taxRate: Number.isNaN(rate) ? item.taxRate : rate,
        taxCategory: (['Taxable', 'Exempt', 'Zero-Rated', 'Nil Rated'].includes(cat) ? cat : item.taxCategory || 'Taxable') as Item['taxCategory'],
        taxClassificationVerified: Boolean(hsn),
      });
    }
    if (updates.length === 0) {
      showToast('No matching products with valid HSN codes found in CSV.', 'warning');
      return;
    }
    await bulkUpdateItemGst(updates, 'CSV_IMPORT', `CSV Import updated HSN/GST for ${updates.length} item(s)`);
  };

  const handleAddOfficialHsn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidHsnOrSac(newHsnForm.code)) {
      showToast('HSN/SAC must be 4, 6, or 8 digits.', 'error');
      return;
    }
    await addCustomHsnEntry(newHsnForm);
    setShowAddHsnModal(false);
    setNewHsnForm({
      code: '',
      type: 'HSN',
      description: '',
      category: 'General',
      gstRate: 18,
      taxCategory: 'Taxable',
      uqc: 'PCS',
      sourceRef: 'CBIC Notification',
      effectiveDate: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="flex-1 bg-[#f5f6fa] dark:bg-slate-950 overflow-y-auto px-4 sm:px-6 py-5 text-xs text-slate-800 dark:text-slate-100 space-y-5">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>HSN / SAC &amp; Indian GST Compliance Center</span>
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Official CBIC/GST Council HSN &amp; SAC rate schedule lookup, bulk product tax updates, compliance alerts, and HSN-wise GSTR reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => void handleCsvImport(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import HSN CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'mapping', label: `Product Tax Mapping (${items.length})` },
          { id: 'master', label: `Official CBIC HSN/SAC Schedule (${INDIA_HSN_SAC_MASTER.length + customHsnEntries.length})` },
          { id: 'alerts', label: `Validation Alerts (${complianceAlerts.length})` },
          { id: 'reports', label: 'HSN & Rate-Wise GST Reports' },
          { id: 'audits', label: `Audit History (${gstAudits.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as HsnTab)}
            className={`px-3.5 py-2 rounded-xl font-semibold border cursor-pointer transition-colors ${
              tab === t.id
                ? 'bg-[#8E0E20] text-white border-[#8E0E20] shadow-xs'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PRODUCT MAPPING + BULK UPDATE */}
      {tab === 'mapping' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products, SKU, or HSN..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl">
                <span className="font-bold text-[#8E0E20]">{selectedIds.length} Selected</span>
                <input
                  type="text"
                  value={bulkHsn}
                  onChange={(e) => setBulkHsn(e.target.value)}
                  placeholder="HSN/SAC (opt)"
                  className="w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                />
                <select
                  value={bulkRate}
                  onChange={(e) => setBulkRate(Number(e.target.value))}
                  className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                >
                  {[0, 5, 12, 18, 28].map((r) => (
                    <option key={r} value={r}>
                      {r}% GST
                    </option>
                  ))}
                </select>
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value as NonNullable<Item['taxCategory']>)}
                  className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="Taxable">Taxable</option>
                  <option value="Exempt">Exempt</option>
                  <option value="Zero-Rated">Zero-Rated</option>
                  <option value="Nil Rated">Nil Rated</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowBulkDiffModal(true)}
                  className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  Preview &amp; Apply Bulk Update
                </button>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={filteredItems.length > 0 && selectedIds.length === filteredItems.length}
                        onChange={(e) =>
                          setSelectedIds(e.target.checked ? filteredItems.map((i) => i.id) : [])
                        }
                      />
                    </th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">HSN / SAC</th>
                    <th className="py-3 px-4">Tax Category</th>
                    <th className="py-3 px-4 text-right">GST %</th>
                    <th className="py-3 px-4">Unit</th>
                    <th className="py-3 px-4">Verification</th>
                    <th className="py-3 px-4 text-right">Lookup</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredItems.map((item) => {
                    const code = item.hsnCode || item.sacCode || '';
                    const valid = code ? isValidHsnOrSac(code) : false;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={() => toggleSelect(item.id)}
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{item.name}</div>
                          <div className="text-[10px] text-slate-500">SKU: {item.code} • {item.category}</div>
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold">
                          {code ? (
                            <span className={valid ? 'text-slate-900 dark:text-white' : 'text-rose-600'}>
                              {code}
                            </span>
                          ) : (
                            <span className="text-rose-600 font-sans">Missing HSN</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">{item.taxCategory || 'Taxable'}</td>
                        <td className="py-2.5 px-4 text-right font-bold tabular-nums">{item.taxRate}%</td>
                        <td className="py-2.5 px-4">{item.unit}</td>
                        <td className="py-2.5 px-4">
                          {item.taxClassificationVerified && valid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5" /> Unverified
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setLookupTargetItemId(item.id);
                              setHsnQuery(item.name.split(' ')[0] || '');
                            }}
                            className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:border-[#8E0E20] font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-[#8E0E20]" />
                            <span>Map Official HSN</span>
                          </button>
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

      {/* TAB 2: AUTHORITATIVE CBIC HSN/SAC MASTER */}
      {tab === 'master' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={hsnQuery}
                onChange={(e) => setHsnQuery(e.target.value)}
                placeholder="Search CBIC HSN code, commodity, or SAC..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAddHsnModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-[#8E0E20] text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Verified HSN/SAC Entry</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Official Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">GST Rate</th>
                  <th className="py-3 px-4">Taxability</th>
                  <th className="py-3 px-4">UQC</th>
                  <th className="py-3 px-4">Source / Effective</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {masterResults.map((entry) => (
                  <tr key={entry.code} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-mono font-bold text-[#8E0E20]">{entry.code}</td>
                    <td className="py-2.5 px-4 font-semibold">{entry.type}</td>
                    <td className="py-2.5 px-4 font-medium">{entry.description}</td>
                    <td className="py-2.5 px-4 text-slate-500">{entry.category}</td>
                    <td className="py-2.5 px-4 text-right font-bold tabular-nums">{entry.gstRate}%</td>
                    <td className="py-2.5 px-4">{entry.taxCategory}</td>
                    <td className="py-2.5 px-4 font-mono">{entry.uqc}</td>
                    <td className="py-2.5 px-4 text-[10px] text-slate-500">
                      {entry.sourceRef} • {entry.effectiveDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: VALIDATION ALERTS */}
      {tab === 'alerts' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-sm">GST Validation &amp; Missing Classification Alerts</h2>
            <span className="text-[11px] font-semibold text-slate-500">{complianceAlerts.length} Issue(s)</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {complianceAlerts.length === 0 ? (
              <div className="p-10 text-center text-emerald-600 font-semibold">
                All products and GST invoices pass validation checks.
              </div>
            ) : (
              complianceAlerts.map((alt) => (
                <div key={alt.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        alt.severity === 'HIGH' ? 'text-rose-600' : 'text-amber-500'
                      }`}
                    />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {alt.type} — {alt.entity}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{alt.detail}</div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      alt.severity === 'HIGH' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {alt.severity}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: HSN & GST RATE REPORTS */}
      {tab === 'reports' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 font-bold text-sm">
              GST Rate-Wise Output &amp; Input Tax Summary
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-4">GST Slab</th>
                  <th className="py-2.5 px-4 text-right">Outward Taxable (Sales)</th>
                  <th className="py-2.5 px-4 text-right">Output GST</th>
                  <th className="py-2.5 px-4 text-right">Inward Taxable (Purchase)</th>
                  <th className="py-2.5 px-4 text-right">Input GST (ITC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {gstReportData.rates.map((r) => (
                  <tr key={r.rate}>
                    <td className="py-2.5 px-4 font-bold">{r.rate}% GST</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">₹{r.salesTaxable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-rose-600 tabular-nums">₹{r.outputTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">₹{r.purchaseTaxable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-600 tabular-nums">₹{r.inputTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
              <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 font-bold text-sm">
                HSN-Wise Sales Summary (GSTR-1 Table 12)
              </div>
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-2.5 px-4">HSN/SAC</th>
                    <th className="py-2.5 px-4 text-right">Qty</th>
                    <th className="py-2.5 px-4 text-right">Taxable</th>
                    <th className="py-2.5 px-4 text-right">Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {gstReportData.hsnSales.map((row) => (
                    <tr key={row.hsn}>
                      <td className="py-2.5 px-4 font-mono font-bold">{row.hsn}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{row.qty}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">₹{row.taxable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-4 text-right font-bold tabular-nums">₹{row.tax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
              <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 font-bold text-sm">
                HSN-Wise Purchase ITC Summary
              </div>
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-2.5 px-4">HSN/SAC</th>
                    <th className="py-2.5 px-4 text-right">Qty</th>
                    <th className="py-2.5 px-4 text-right">Taxable</th>
                    <th className="py-2.5 px-4 text-right">Input Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {gstReportData.hsnPurchases.map((row) => (
                    <tr key={row.hsn}>
                      <td className="py-2.5 px-4 font-mono font-bold">{row.hsn}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{row.qty}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">₹{row.taxable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-600 tabular-nums">₹{row.itc.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT HISTORY */}
      {tab === 'audits' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 font-bold text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-[#8E0E20]" />
            <span>HSN &amp; GST Classification Change Log</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {gstAudits.length === 0 ? (
              <div className="p-10 text-center text-slate-400">No HSN/GST changes logged yet.</div>
            ) : (
              gstAudits.map((aud) => (
                <div key={aud.id} className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{aud.summary}</span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {aud.actor} • {new Date(aud.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {aud.changes.slice(0, 5).map((c) => `${c.itemName}: ${c.oldHsn || '-'} (${c.oldRate}%) → ${c.newHsn || '-'} (${c.newRate}%)`).join(' | ')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Official CBIC HSN Lookup Modal for Single Item */}
      {lookupTargetItemId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                Map Official CBIC HSN/SAC for {items.find((i) => i.id === lookupTargetItemId)?.name}
              </h3>
              <button
                type="button"
                onClick={() => setLookupTargetItemId(null)}
                className="p-1 rounded hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <input
                type="text"
                value={hsnQuery}
                onChange={(e) => setHsnQuery(e.target.value)}
                placeholder="Search official HSN code or goods description (e.g., rice, detergent, soap, 1006, 3402)..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                {masterResults.map((entry) => (
                  <div
                    key={entry.code}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <div>
                      <div className="font-bold">
                        <span className="font-mono text-[#8E0E20] mr-2">{entry.code}</span>
                        <span>{entry.description}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {entry.gstRate}% GST ({entry.taxCategory}) • UQC: {entry.uqc} • {entry.sourceRef}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await bulkUpdateItemGst(
                          [
                            {
                              itemId: lookupTargetItemId,
                              hsnCode: entry.type === 'HSN' ? entry.code : undefined,
                              sacCode: entry.type === 'SAC' ? entry.code : undefined,
                              taxRate: entry.gstRate,
                              taxCategory: entry.taxCategory,
                              effectiveDate: entry.effectiveDate,
                              taxClassificationVerified: true,
                            },
                          ],
                          'SINGLE_UPDATE',
                          `Mapped official ${entry.type} ${entry.code} (${entry.gstRate}%)`
                        );
                        setLookupTargetItemId(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                    >
                      Apply Official Rate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Update Diff Preview Modal */}
      {showBulkDiffModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl p-5 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base">Confirm Bulk HSN &amp; GST Rate Update ({selectedIds.length} Items)</h3>
            <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 dark:bg-slate-800 font-bold">
                  <tr>
                    <th className="py-2 px-3">Product</th>
                    <th className="py-2 px-3">Old HSN / Rate</th>
                    <th className="py-2 px-3">New HSN / Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items
                    .filter((i) => selectedIds.includes(i.id))
                    .map((it) => (
                      <tr key={it.id}>
                        <td className="py-2 px-3 font-semibold">{it.name}</td>
                        <td className="py-2 px-3 text-slate-500">
                          {it.hsnCode || '-'} / {it.taxRate}% ({it.taxCategory || 'Taxable'})
                        </td>
                        <td className="py-2 px-3 font-bold text-emerald-700">
                          {bulkHsn || it.hsnCode || '-'} / {bulkRate}% ({bulkCategory})
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkDiffModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleBulkConfirm()}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
              >
                Confirm &amp; Log Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Verified Custom HSN Modal */}
      {showAddHsnModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAddOfficialHsn}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-5 space-y-3 shadow-2xl"
          >
            <h3 className="font-bold text-sm">Add Official CBIC HSN / SAC Record</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Code (4/6/8 digits)</label>
                <input
                  required
                  value={newHsnForm.code}
                  onChange={(e) => setNewHsnForm({ ...newHsnForm, code: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Type</label>
                <select
                  value={newHsnForm.type}
                  onChange={(e) => setNewHsnForm({ ...newHsnForm, type: e.target.value as 'HSN' | 'SAC' })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="HSN">HSN (Goods)</option>
                  <option value="SAC">SAC (Services)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Official Description</label>
              <input
                required
                value={newHsnForm.description}
                onChange={(e) => setNewHsnForm({ ...newHsnForm, description: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">GST Rate %</label>
                <select
                  value={newHsnForm.gstRate}
                  onChange={(e) => setNewHsnForm({ ...newHsnForm, gstRate: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {[0, 5, 12, 18, 28].map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Source Notification</label>
                <input
                  value={newHsnForm.sourceRef}
                  onChange={(e) => setNewHsnForm({ ...newHsnForm, sourceRef: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddHsnModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#8E0E20] text-white font-bold cursor-pointer"
              >
                Save to Master
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
