import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Settings,
  ChevronDown,
  Calendar,
  Search,
  BarChart3,
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Share2,
  CheckCircle2,
  ArrowUpDown,
  Download,
  FileDown,
  Barcode,
  Split,
  Layers,
  Tag,
  Copy,
  X,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { Transaction, TransactionWorkflowStatus } from '../types';
import { exportTransactionsPdf, exportSingleInvoicePdf } from '../utils/pdfExport';

export const SaleInvoicesView: React.FC = () => {
  const {
    setActiveTab,
    activeSaleSubtype,
    setActiveSaleSubtype,
    filteredTransactions,
    transactions,
    employees,
    company,
    totalSalesAmount,
    totalReceivedAmount,
    totalBalanceAmount,
    filterPeriod,
    setFilterPeriod,
    filterStartDate,
    setFilterStartDate,
    filterEndDate,
    setFilterEndDate,
    filterFirm,
    setFilterFirm,
    filterUser,
    setFilterUser,
    setIsAddSaleOpen,
    setIsSettingsModalOpen,
    setIsAnalyticsModalOpen,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    deleteTransaction,
    updateTransaction,
    loadDemoData,
    clearTransactions,
    showToast,
    canEditFinalizedBill,
    canCancelInvoice,
    openBarcodeScanner,
    bulkUpdateTransactions,
    splitInvoice,
    cloneTransaction,
    consolidateTransactionsToInvoice,
    requestConfirmation,
  } = useVyapar();

  // Dropdown states
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const [isFirmDropdownOpen, setIsFirmDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Sorting, Search, Group-By, Bulk Select & Consolidate states
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<'none' | 'party' | 'status' | 'paymentType' | 'workflow'>('none');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [showConsolidateModal, setShowConsolidateModal] = useState(false);
  const [consolidateSelectedIds, setConsolidateSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<keyof Transaction | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [activeFunnel, setActiveFunnel] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Unpaid' | 'Partial'>('All');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('All');

  const funnelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (funnelRef.current && !funnelRef.current.contains(e.target as Node)) {
        setActiveFunnel(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saleTypes = [
    'Sale Invoices',
    'Estimate/ Quotation',
    'Proforma Invoice',
    'Payment-In',
    'Sale Order',
    'Delivery Challan',
    'Sale Return/ Credit Note',
    'Sale FA',
    'Other Income',
  ];

  const periods = [
    'Today',
    'Yesterday',
    'This Week',
    'This Month',
    'Last Month',
    'This Quarter',
    'This Year',
    'All Time',
  ];

  const firms = Array.from(
    new Set([
      'All Firms',
      ...(company?.name ? [company.name] : []),
      ...transactions.map((t) => t.firm).filter(Boolean),
    ])
  );
  const users = Array.from(
    new Set([
      'All Users',
      'Admin',
      ...employees.map((e) => e.name).filter(Boolean),
      ...transactions.map((t) => t.user).filter(Boolean),
    ])
  );

  const monthDelta = (() => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const prevDate = new Date(curYear, curMonth - 1, 1);
    const prevMonth = prevDate.getMonth();
    const prevYear = prevDate.getFullYear();
    let curTotal = 0;
    let prevTotal = 0;
    transactions.forEach((tx) => {
      if (tx.type !== 'Sale' || tx.isCancelled) return;
      const parts = (tx.date || '').split(',')[0].trim().split('/');
      if (parts.length !== 3) return;
      const m = Number(parts[1]) - 1;
      const y = Number(parts[2]);
      if (m === curMonth && y === curYear) curTotal += tx.totalAmount || 0;
      else if (m === prevMonth && y === prevYear) prevTotal += tx.totalAmount || 0;
    });
    if (prevTotal <= 0) return curTotal > 0 ? '+100%' : '0%';
    const pct = Math.round(((curTotal - prevTotal) / prevTotal) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  })();

  // Handle Sort
  const handleSort = (field: keyof Transaction) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    showToast(`Sorted by ${field} ${sortAsc ? 'descending' : 'ascending'}`);
  };

  // Process rows with sorting, search and filters
  const displayedRows = [...filteredTransactions]
    .filter((tx) => {
      if (statusFilter !== 'All' && tx.status !== statusFilter) return false;
      if (paymentTypeFilter !== 'All' && tx.paymentType !== paymentTypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hit =
          tx.invoiceNo.toLowerCase().includes(q) ||
          tx.partyName.toLowerCase().includes(q) ||
          (tx.notes || '').toLowerCase().includes(q) ||
          (tx.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (!sortField) return 0;
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

  const consolidatableDocs = transactions.filter(
    (t) =>
      !t.isCancelled &&
      !t.linkedSaleInvoiceId &&
      (t.type === 'Sale Order' || t.type === 'Delivery Challan' || t.type === 'Estimate')
  );

  const groupedSections: Array<{ label: string; rows: Transaction[] }> = (() => {
    if (groupBy === 'none') return [{ label: '', rows: displayedRows }];
    const map = new Map<string, Transaction[]>();
    displayedRows.forEach((tx) => {
      const key =
        groupBy === 'party'
          ? tx.partyName
          : groupBy === 'status'
          ? (tx.isCancelled ? 'Cancelled' : tx.status)
          : groupBy === 'paymentType'
          ? tx.paymentType
          : tx.workflowStatus || 'Completed';
      map.set(key, [...(map.get(key) || []), tx]);
    });
    return Array.from(map.entries()).map(([label, rows]) => ({ label, rows }));
  })();

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === displayedRows.length) setSelectedIds([]);
    else setSelectedIds(displayedRows.map((r) => r.id));
  };

  // Export to Excel / CSV
  const handleExportExcel = () => {
    if (displayedRows.length === 0) {
      showToast('No transactions to export');
      return;
    }

    const headers = 'Date,Invoice No,Party Name,Transaction,Payment Type,Amount,Balance,Due Date,Status\n';
    const rows = displayedRows.map((t) =>
      `"${t.date}","${t.invoiceNo}","${t.partyName}","${t.type}","${t.paymentType}",${t.totalAmount},${t.balance},"${t.dueDate}","${t.status}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Vyapar_Sale_Invoices_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Transactions exported to Excel/CSV successfully!');
  };

  // Export current view data as PDF Document
  const handleExportPdf = () => {
    if (displayedRows.length === 0) {
      showToast('No transactions to export as PDF');
      return;
    }
    exportTransactionsPdf(
      displayedRows,
      company,
      `${activeSaleSubtype} Statement`,
      `${filterStartDate} To ${filterEndDate}`
    );
    showToast('PDF document generated and downloaded successfully!');
  };

  // Print transactions list
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f0f4f9] overflow-y-auto">
      {/* 1. Header Bar: Title with dropdown, Add Sale button, and Settings */}
      <div className="bg-[#ffffff] px-6 py-3 border-b border-[#e2e8f0] flex items-center justify-between shrink-0">
        {/* Title dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
            className="flex items-center gap-2 text-xl font-bold text-[#0f172a] hover:text-[#dc2626] transition-colors"
          >
            <span>{activeSaleSubtype}</span>
            <ChevronDown className="w-5 h-5 text-[#64748b]" />
          </button>

          {isTypeDropdownOpen && (
            <div className="absolute left-0 top-9 w-60 bg-white border border-[#e2e8f0] rounded-lg shadow-lg py-1 z-30 text-xs text-[#334155]">
              {saleTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setActiveSaleSubtype(type);
                    setIsTypeDropdownOpen(false);
                    const tabMap: Record<string, string> = {
                      'Sale Invoices': 'sale-invoices',
                      'Estimate/ Quotation': 'estimate-quotation',
                      'Proforma Invoice': 'proforma-invoice',
                      'Payment-In': 'payment-in',
                      'Sale Order': 'sale-order',
                      'Delivery Challan': 'delivery-challan',
                      'Sale Return/ Credit Note': 'sale-return',
                      'Sale FA': 'sale-fa',
                      'Other Income': 'sale-invoices',
                    };
                    if (tabMap[type]) {
                      setActiveTab(tabMap[type]);
                    }
                    showToast(`Switched view to ${type}`);
                  }}
                  className={`w-full px-3 py-2 text-left hover:bg-[#fff1f2] hover:text-[#dc2626] transition-colors ${
                    activeSaleSubtype === type ? 'font-bold bg-[#fff1f2] text-[#dc2626]' : ''
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Action: Consolidate, Scan Barcode, Red Add Sale Button & Settings Cog */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setConsolidateSelectedIds([]);
              setShowConsolidateModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md font-semibold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Consolidate ({consolidatableDocs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => openBarcodeScanner('billing', () => setIsAddSaleOpen(true))}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-md font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-colors cursor-pointer"
          >
            <Barcode className="w-4 h-4" />
            <span>Scan Barcode</span>
          </button>

          <button
            onClick={() => setIsAddSaleOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md font-semibold text-xs text-white bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b] shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Sale</span>
          </button>

          <button
            onClick={() => setIsSettingsModalOpen(true)}
            title="Invoice & Transaction Settings"
            className="w-8 h-8 rounded-md flex items-center justify-center text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-[#ffffff] px-6 py-2.5 border-b border-[#e2e8f0] flex flex-wrap items-center gap-2.5 text-xs shrink-0 select-none">
        <span className="text-[#64748b] font-medium mr-1">Filter by :</span>

        {/* Period Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#cbd5e1] hover:border-[#94a3b8] bg-white text-[#334155] font-medium transition-colors"
          >
            <span>{filterPeriod}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#64748b]" />
          </button>

          {isPeriodDropdownOpen && (
            <div className="absolute left-0 top-8 w-36 bg-white border border-[#e2e8f0] rounded-lg shadow-md py-1 z-30 text-xs">
              {periods.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setFilterPeriod(p);
                    setIsPeriodDropdownOpen(false);
                    showToast(`Period set to ${p}`);
                  }}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[#f8fafc] ${
                    filterPeriod === p ? 'font-semibold text-[#dc2626]' : 'text-[#334155]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date Range Display & Picker */}
        <div className="relative">
          <button
            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#cbd5e1] hover:border-[#94a3b8] bg-white text-[#334155] font-medium transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 text-[#64748b]" />
            <span>
              {filterStartDate} To {filterEndDate}
            </span>
          </button>

          {isDatePickerOpen && (
            <div className="absolute left-0 top-8 w-64 bg-white border border-[#e2e8f0] rounded-lg shadow-lg p-3 z-30 text-xs space-y-3">
              <div className="font-semibold text-slate-800">Select Custom Date Range</div>
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Start Date</label>
                  <input
                    type="text"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="w-full px-2 py-1 border rounded text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">End Date</label>
                  <input
                    type="text"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="w-full px-2 py-1 border rounded text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1 border-t">
                <button
                  onClick={() => setIsDatePickerOpen(false)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setIsDatePickerOpen(false);
                    showToast('Date range applied');
                  }}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Firm Filter Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsFirmDropdownOpen(!isFirmDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#cbd5e1] hover:border-[#94a3b8] bg-white text-[#334155] font-medium transition-colors"
          >
            <span>{filterFirm}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#64748b]" />
          </button>

          {isFirmDropdownOpen && (
            <div className="absolute left-0 top-8 w-44 bg-white border border-[#e2e8f0] rounded-lg shadow-md py-1 z-30 text-xs">
              {firms.map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setFilterFirm(f);
                    setIsFirmDropdownOpen(false);
                    showToast(`Firm filter: ${f}`);
                  }}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[#f8fafc] ${
                    filterFirm === f ? 'font-semibold text-[#dc2626]' : 'text-[#334155]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Users Filter Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#cbd5e1] hover:border-[#94a3b8] bg-white text-[#334155] font-medium transition-colors"
          >
            <span>{filterUser}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#64748b]" />
          </button>

          {isUserDropdownOpen && (
            <div className="absolute left-0 top-8 w-40 bg-white border border-[#e2e8f0] rounded-lg shadow-md py-1 z-30 text-xs">
              {users.map((u) => (
                <button
                  key={u}
                  onClick={() => {
                    setFilterUser(u);
                    setIsUserDropdownOpen(false);
                    showToast(`User filter: ${u}`);
                  }}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[#f8fafc] ${
                    filterUser === u ? 'font-semibold text-[#dc2626]' : 'text-[#334155]'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Demo Data toggle bar on far right */}
        <div className="ml-auto flex items-center gap-2">
          {displayedRows.length === 0 ? (
            <button
              onClick={loadDemoData}
              title="Populate realistic sample invoices"
              className="text-[11px] font-medium px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              + Load Sample Demo Invoices
            </button>
          ) : (
            <button
              onClick={clearTransactions}
              title="Clear all transactions back to empty state"
              className="text-[11px] text-slate-500 hover:text-red-600 underline"
            >
              Clear Transactions (Show Empty State)
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Content: Sales Summary Card + Transactions Table */}
      <div className="p-6 space-y-5">
        {/* Total Sales Amount Summary Card from Screenshot */}
        <div className="w-full max-w-sm bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748b] font-medium">Total Sales Amount</span>
            <div className="flex items-center gap-1 text-[11px] text-[#64748b]">
              <span className="font-semibold text-[#0f172a]">{monthDelta}</span>
              <span>vs last month</span>
            </div>
          </div>

          {/* Big Currency Value */}
          <div className="mt-2 text-2xl font-bold text-[#0f172a] tabular-nums">
            ₹ {totalSalesAmount.toLocaleString('en-IN')}
          </div>

          {/* Bottom row: Received & Balance */}
          <div className="mt-3 pt-3 border-t border-[#f1f5f9] flex items-center gap-6 text-xs text-[#475569]">
            <div>
              <span className="text-[#64748b]">Received: </span>
              <strong className="font-semibold text-[#0f172a] tabular-nums">
                ₹ {totalReceivedAmount.toLocaleString('en-IN')}
              </strong>
            </div>
            <div>
              <span className="text-[#64748b]">Balance: </span>
              <strong className="font-semibold text-[#0f172a] tabular-nums">
                ₹ {totalBalanceAmount.toLocaleString('en-IN')}
              </strong>
            </div>
          </div>
        </div>

        {/* Transactions Table Section */}
        <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-2xs overflow-hidden">
          {/* Table Header Bar */}
          <div className="px-5 py-3 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-[#0f172a]">Transactions</h2>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-[11px] font-semibold text-slate-700"
                title="Group transactions by"
              >
                <option value="none">Group: None</option>
                <option value="party">Group by Party</option>
                <option value="status">Group by Payment Status</option>
                <option value="paymentType">Group by Payment Mode</option>
                <option value="workflow">Group by Workflow</option>
              </select>
            </div>

            {/* Right Tools: Search, Bar Graph, Excel XLS, Print */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search #, party, tag..."
                  className="bg-slate-50 border border-slate-300 rounded-md pl-7 pr-2.5 py-1 text-xs w-48 focus:outline-none focus:border-rose-500"
                />
              </div>

              <button
                onClick={() => setIsAnalyticsModalOpen(true)}
                title="Sales Visual Analytics & Graphs"
                className="w-7 h-7 flex items-center justify-center text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] rounded transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
              </button>

              {/* Green XLS Excel export button from screenshot */}
              <button
                onClick={handleExportExcel}
                title="Export Transactions to Excel (.xls / .csv)"
                className="flex items-center justify-center px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold tracking-tight transition-colors"
              >
                <span>xls</span>
              </button>

              {/* Red PDF Export Document button */}
              <button
                onClick={handleExportPdf}
                title="Export Current View Data as PDF Document"
                className="flex items-center justify-center px-1.5 py-0.5 rounded bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100 text-[11px] font-bold tracking-tight transition-colors"
              >
                <span>pdf</span>
              </button>

              <button
                onClick={handlePrint}
                title="Print Transactions List"
                className="w-7 h-7 flex items-center justify-center text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] rounded transition-colors"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bulk Operations Toolbar */}
          {selectedIds.length > 0 && (
            <div className="px-5 py-2 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-2 font-semibold">
                <span>{selectedIds.length} invoice(s) selected</span>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-slate-300 hover:text-white underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={bulkTagInput}
                    onChange={(e) => setBulkTagInput(e.target.value)}
                    placeholder="Tag name..."
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-[11px] w-28 text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!bulkTagInput.trim()) return;
                      bulkUpdateTransactions(selectedIds, { addTag: bulkTagInput.trim() });
                      setBulkTagInput('');
                    }}
                    className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <Tag className="w-3 h-3" />
                    <span>Tag</span>
                  </button>
                </div>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const wf = e.target.value as TransactionWorkflowStatus;
                    if (!wf) return;
                    bulkUpdateTransactions(selectedIds, { workflowStatus: wf });
                    e.target.value = '';
                  }}
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-white"
                >
                  <option value="">Set Workflow...</option>
                  <option value="Draft">Draft</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Completed">Completed</option>
                  <option value="Archived">Archived</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const selectedRows = displayedRows.filter((r) => selectedIds.includes(r.id));
                    exportTransactionsPdf(selectedRows, company, 'Selected Invoices Bulk Export', `${filterStartDate} To ${filterEndDate}`);
                    showToast(`Exported ${selectedRows.length} selected invoice(s).`);
                  }}
                  className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                >
                  Bulk PDF
                </button>
                <button
                  type="button"
                  onClick={() =>
                    requestConfirmation({
                      title: 'Bulk Cancel Selected Invoices',
                      message: `Cancel ${selectedIds.length} selected invoice(s) and reverse their stock & balances?`,
                      variant: 'danger',
                      confirmLabel: 'Cancel All Selected',
                      onConfirm: () => {
                        bulkUpdateTransactions(selectedIds, { cancelReason: 'Bulk cancelled from Invoices Register' });
                        setSelectedIds([]);
                      },
                    })
                  }
                  className="px-2.5 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer"
                >
                  Bulk Cancel
                </button>
              </div>
            </div>
          )}

          {/* Table Header Columns with Funnel ∇ Filter Icons */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#ffffff] border-b border-[#e2e8f0] text-[#64748b] font-medium">
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={displayedRows.length > 0 && selectedIds.length === displayedRows.length}
                      onChange={toggleSelectAll}
                      className="rounded text-rose-600"
                    />
                  </th>
                  {/* Date ∇ */}
                  <th className="py-2.5 px-4 font-medium whitespace-nowrap">
                    <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSort('date')}>
                      <span>Date</span>
                      <Filter className="w-3 h-3 text-[#94a3b8] hover:text-[#0f172a]" />
                    </div>
                  </th>

                  {/* Invoice no ∇ */}
                  <th className="py-2.5 px-4 font-medium whitespace-nowrap">
                    <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSort('invoiceNo')}>
                      <span>Invoice no</span>
                      <Filter className="w-3 h-3 text-[#94a3b8] hover:text-[#0f172a]" />
                    </div>
                  </th>

                  {/* Party Name ∇ */}
                  <th className="py-2.5 px-4 font-medium whitespace-nowrap">
                    <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSort('partyName')}>
                      <span>Party Name</span>
                      <Filter className="w-3 h-3 text-[#94a3b8] hover:text-[#0f172a]" />
                    </div>
                  </th>

                  {/* Transaction ∇ */}
                  <th className="py-2.5 px-4 font-medium whitespace-nowrap">
                    <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSort('type')}>
                      <span>Transaction</span>
                      <Filter className="w-3 h-3 text-[#94a3b8] hover:text-[#0f172a]" />
                    </div>
                  </th>

                  {/* Payment Type ∇ */}
                  <th className="py-2.5 px-4 font-medium whitespace-nowrap">
                    <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSort('paymentType')}>
                      <span>Payment Type</span>
                      <Filter className="w-3 h-3 text-[#94a3b8] hover:text-[#0f172a]" />
                    </div>
                  </th>

                  {/* Amount ∇ */}
                  <th className="py-2.5 px-4 font-medium whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1 cursor-pointer" onClick={() => handleSort('totalAmount')}>
                      <span>Amount</span>
                      <Filter className="w-3 h-3 text-[#94a3b8] hover:text-[#0f172a]" />
                    </div>
                  </th>

                  {/* Balance ∇ */}
                  <th className="py-2.5 px-4 font-medium whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1 cursor-pointer" onClick={() => handleSort('balance')}>
                      <span>Balance</span>
                      <Filter className="w-3 h-3 text-[#94a3b8] hover:text-[#0f172a]" />
                    </div>
                  </th>

                  {/* Due date ∇ */}
                  <th className="py-2.5 px-4 font-medium whitespace-nowrap">
                    <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSort('dueDate')}>
                      <span>Due date</span>
                      <Filter className="w-3 h-3 text-[#94a3b8] hover:text-[#0f172a]" />
                    </div>
                  </th>

                  {/* Status ∇ */}
                  <th className="py-2.5 px-4 font-medium whitespace-nowrap">
                    <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSort('status')}>
                      <span>Status</span>
                      <Filter className="w-3 h-3 text-[#94a3b8] hover:text-[#0f172a]" />
                    </div>
                  </th>

                  {/* Actions */}
                  <th className="py-2.5 px-4 font-medium whitespace-nowrap text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody>
                {displayedRows.length === 0 ? (
                  // Empty State from screenshot!
                  <tr>
                    <td colSpan={11} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        {/* Red Triangle Warning outline icon */}
                        <div className="w-12 h-12 flex items-center justify-center text-rose-500 mb-2">
                          <AlertTriangle className="w-8 h-8 stroke-[1.5]" />
                        </div>
                        <h3 className="text-sm font-semibold text-[#1e293b]">
                          No Transaction Found
                        </h3>
                        <p className="text-xs text-[#94a3b8] mt-1">
                          We could not find any transactions.
                        </p>
                        <button
                          onClick={() => setIsAddSaleOpen(true)}
                          className="mt-4 px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create First Invoice</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  groupedSections.map((group) => (
                    <React.Fragment key={group.label || 'all'}>
                      {group.label && (
                        <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                          <td colSpan={11} className="py-1.5 px-4">
                            {group.label} ({group.rows.length}) — ₹{group.rows.reduce((s, r) => s + r.totalAmount, 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      )}
                      {group.rows.map((tx) => (
                        <tr
                          key={tx.id}
                          className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors group"
                        >
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(tx.id)}
                              onChange={() => toggleSelectRow(tx.id)}
                              className="rounded text-rose-600"
                            />
                          </td>
                          <td className="py-3 px-4 font-medium text-[#334155] whitespace-nowrap">
                            {tx.date}
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#0f172a] whitespace-nowrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono">{tx.invoiceNo}</span>
                              {tx.workflowStatus === 'Draft' && (
                                <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 text-[9px] font-bold">
                                  DRAFT
                                </span>
                              )}
                              {tx.isCancelled && (
                                <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 text-[9px] font-bold">
                                  CANCELLED
                                </span>
                              )}
                              {tx.convertedFrom && (
                                <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 text-[9px] font-bold">
                                  From {tx.convertedFrom.type}
                                </span>
                              )}
                              {tx.tags && tx.tags.map((tg) => (
                                <span key={tg} className="px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 text-[9px] font-semibold">
                                  {tg}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[#1e293b] font-medium whitespace-nowrap">
                            <div>
                              <span>{tx.partyName}</span>
                              {tx.stateOfSupply && (
                                <span className="block text-[10px] text-slate-400">
                                  {tx.stateOfSupply.split(' ')[0]} • {tx.gstType || 'Intra-State'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[#475569] whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                              {tx.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#475569] whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                              {tx.paymentType}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-[#0f172a] tabular-nums whitespace-nowrap">
                            <span className={tx.isCancelled ? 'line-through text-slate-400' : ''}>
                              ₹ {tx.totalAmount.toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium tabular-nums whitespace-nowrap text-[#e11d48]">
                            ₹ {tx.balance.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-[#64748b] whitespace-nowrap">
                            {tx.dueDate}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {tx.isCancelled ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">
                                Cancelled
                              </span>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  tx.status === 'Paid'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : tx.status === 'Partial'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {tx.status}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100">
                              <button
                                onClick={() => {
                                  setSelectedInvoice(tx);
                                  setIsInvoicePreviewOpen(true);
                                }}
                                title="View / Print Tax Invoice"
                                className="p-1 text-[#0284c7] hover:bg-sky-50 rounded cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  exportSingleInvoicePdf(tx, company);
                                  showToast(`Invoice #${tx.invoiceNo} PDF downloaded`);
                                }}
                                title="Download Invoice as PDF"
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              >
                                <FileDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  cloneTransaction(tx.id);
                                  showToast(`Cloned #${tx.invoiceNo} as new draft.`);
                                }}
                                title="Duplicate Invoice"
                                className="p-1 text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              {!tx.isCancelled && (tx.items?.length || 0) > 0 && (
                                <button
                                  onClick={() => splitInvoice(tx.id, 50)}
                                  title="Split Invoice into 2 Bills"
                                  className="p-1 text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer"
                                >
                                  <Split className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (!canEditFinalizedBill(tx.id)) {
                                    showToast('Invoice Protection: Your role is not authorized to edit finalized bills.');
                                    return;
                                  }
                                  setSelectedInvoice(tx);
                                  setIsAddSaleOpen(true);
                                }}
                                title="Edit Invoice"
                                className="p-1 text-[#64748b] hover:bg-slate-100 rounded cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (!canCancelInvoice(tx.id)) {
                                    showToast('Cancellation Protection: Manager approval required to cancel or delete invoices.');
                                    return;
                                  }
                                  deleteTransaction(tx.id);
                                  showToast(`Invoice #${tx.invoiceNo} deleted`);
                                }}
                                title="Delete Invoice"
                                className="p-1 text-[#dc2626] hover:bg-rose-50 rounded cursor-pointer"
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

          {/* Table Footer with Counts & Quick Summary */}
          {displayedRows.length > 0 && (
            <div className="px-5 py-2.5 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-between text-xs text-[#64748b]">
              <span>Showing {displayedRows.length} transactions</span>
              <div className="flex items-center gap-4">
                <span>
                  Total Amount:{' '}
                  <strong className="text-[#0f172a] font-semibold">
                    ₹ {displayedRows.reduce((a, b) => a + b.totalAmount, 0).toLocaleString('en-IN')}
                  </strong>
                </span>
                <span>
                  Total Balance:{' '}
                  <strong className="text-[#e11d48] font-semibold">
                    ₹ {displayedRows.reduce((a, b) => a + b.balance, 0).toLocaleString('en-IN')}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Consolidate Pending Orders / Challans Modal */}
      {showConsolidateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden text-xs">
            <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
              <div className="font-bold text-sm">Consolidate Orders / Challans into Single Invoice</div>
              <button type="button" onClick={() => setShowConsolidateModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              <p className="text-[11px] text-slate-600">
                Select 2 or more open Sale Orders, Delivery Challans, or Estimates belonging to the same customer to merge into one Tax Invoice.
              </p>
              {consolidatableDocs.length === 0 ? (
                <div className="p-6 text-center text-slate-400 border border-dashed border-slate-300 rounded-lg">
                  No open Sale Orders, Challans, or Estimates available for consolidation.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {consolidatableDocs.map((doc) => (
                    <label key={doc.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={consolidateSelectedIds.includes(doc.id)}
                          onChange={() =>
                            setConsolidateSelectedIds((prev) =>
                              prev.includes(doc.id) ? prev.filter((x) => x !== doc.id) : [...prev, doc.id]
                            )
                          }
                          className="rounded text-rose-600"
                        />
                        <div>
                          <span className="font-mono font-bold text-slate-900">#{doc.invoiceNo}</span>
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{doc.type}</span>
                          <span className="ml-2 font-semibold text-slate-700">{doc.partyName}</span>
                        </div>
                      </div>
                      <span className="font-bold tabular-nums text-slate-900">₹{doc.totalAmount.toLocaleString('en-IN')}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConsolidateModal(false)}
                className="px-3.5 py-1.5 rounded border border-slate-300 bg-white font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={consolidateSelectedIds.length < 2}
                onClick={() => {
                  const res = consolidateTransactionsToInvoice(consolidateSelectedIds);
                  if (res) setShowConsolidateModal(false);
                }}
                className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold cursor-pointer"
              >
                Consolidate ({consolidateSelectedIds.length}) into Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
