import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  FileDown,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Layers,
  Calendar,
  Eye,
  FileText,
  RotateCcw,
  PlusCircle,
  Edit3,
  Trash2,
  Lock,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  AlertOctagon,
  Sparkles,
  Info,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { UserActivityLog } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const AuditLogView: React.FC = () => {
  const {
    activityLogs,
    currentUser,
    roles,
    company,
    recordActivity,
    showToast,
  } = useVyapar();

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [actionCategoryFilter, setActionCategoryFilter] = useState('All');
  const [outcomeFilter, setOutcomeFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState<'All' | 'Today' | '7Days'>('All');

  // Selected Log for Forensic Diff Modal
  const [selectedLog, setSelectedLog] = useState<UserActivityLog | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [viewFormat, setViewFormat] = useState<'visual' | 'json'>('visual');

  // Quick Action Simulation for Demo / Verification
  const handleSimulateInvoiceEdit = () => {
    recordActivity(
      'Modified Invoice #INV-2026-118',
      'Billing',
      'Changed billed total from Rs. 8,500 to Rs. 7,950; applied promotional coupon DISCOUNT10',
      {
        targetId: 'INV-2026-118',
        targetType: 'Invoice',
        outcome: 'Success',
        beforeState: {
          invoiceNo: 'INV-2026-118',
          partyName: 'Metro Electricals',
          totalAmount: 8500,
          balance: 8500,
          discount: 0,
          status: 'Unpaid',
          updatedAt: '02/10/2026, 02:00 PM',
        },
        afterState: {
          invoiceNo: 'INV-2026-118',
          partyName: 'Metro Electricals',
          totalAmount: 7950,
          balance: 7950,
          discount: 550,
          couponCode: 'DISCOUNT10',
          status: 'Unpaid',
          updatedAt: 'Just Now',
        },
      }
    );
    showToast('Simulated invoice modification audit log recorded');
  };

  const handleSimulateInvoiceDelete = () => {
    recordActivity(
      'Deleted Draft Invoice #INV-2026-119',
      'Billing',
      'Purged obsolete draft invoice for Rs. 3,200',
      {
        targetId: 'INV-2026-119',
        targetType: 'Invoice',
        outcome: 'Success',
        beforeState: {
          invoiceNo: 'INV-2026-119',
          partyName: 'Global Traders',
          totalAmount: 3200,
          balance: 3200,
          status: 'Draft',
          reason: 'Duplicate voucher entered by cashier',
        },
      }
    );
    showToast('Simulated invoice deletion audit log recorded');
  };

  const handleSimulateUnauthorizedAttempt = () => {
    recordActivity(
      'Unauthorized Invoice Deletion Attempt',
      'Billing',
      'Cashier attempted to delete finalized tax invoice without supervisor authorization key',
      {
        targetId: 'INV-2026-005',
        targetType: 'Invoice',
        outcome: 'Denied',
        beforeState: {
          invoiceNo: 'INV-2026-005',
          partyName: 'Balaji Hardware',
          totalAmount: 14200,
          status: 'Finalized',
          lockLevel: 'Protected',
        },
        afterState: {
          violation: 'Role "Cashier" lacks sales_pos.delete permission on finalized records',
          securityAction: 'Voucher locked; incident flagged in security audit',
        },
      }
    );
    showToast('Recorded security violation attempt in audit log');
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return activityLogs.filter((log) => {
      // Search
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        !search ||
        log.action.toLowerCase().includes(search) ||
        log.details.toLowerCase().includes(search) ||
        log.userName.toLowerCase().includes(search) ||
        log.role.toLowerCase().includes(search) ||
        log.ipAddress.toLowerCase().includes(search) ||
        (log.targetId && log.targetId.toLowerCase().includes(search)) ||
        (log.beforeState && JSON.stringify(log.beforeState).toLowerCase().includes(search)) ||
        (log.afterState && JSON.stringify(log.afterState).toLowerCase().includes(search));

      // Module
      const matchesModule = moduleFilter === 'All' || log.module === moduleFilter;

      // Action Category
      let matchesCategory = true;
      if (actionCategoryFilter === 'Deletions') {
        matchesCategory = log.action.toLowerCase().includes('delete');
      } else if (actionCategoryFilter === 'Modifications') {
        matchesCategory = log.action.toLowerCase().includes('modif') || log.action.toLowerCase().includes('edit') || log.action.toLowerCase().includes('update');
      } else if (actionCategoryFilter === 'Cancellations') {
        matchesCategory = log.action.toLowerCase().includes('cancel') || log.action.toLowerCase().includes('void');
      } else if (actionCategoryFilter === 'Creations') {
        matchesCategory = log.action.toLowerCase().includes('create') || log.action.toLowerCase().includes('add');
      } else if (actionCategoryFilter === 'Denied') {
        matchesCategory = log.outcome === 'Denied';
      } else if (actionCategoryFilter === 'Exports') {
        matchesCategory = log.action.toLowerCase().includes('export') || log.action.toLowerCase().includes('print');
      }

      // Outcome
      const matchesOutcome = outcomeFilter === 'All' || log.outcome === outcomeFilter;

      // Role
      const matchesRole = roleFilter === 'All' || log.role === roleFilter;

      // Date
      let matchesDate = true;
      if (dateFilter === 'Today') {
        matchesDate = log.timestamp.includes('Today') || log.timestamp.includes('02/10/2026');
      } else if (dateFilter === '7Days') {
        matchesDate = true;
      }

      return matchesSearch && matchesModule && matchesCategory && matchesOutcome && matchesRole && matchesDate;
    });
  }, [activityLogs, searchTerm, moduleFilter, actionCategoryFilter, outcomeFilter, roleFilter, dateFilter]);

  // Key KPI Metrics
  const stats = useMemo(() => {
    const total = activityLogs.length;
    const deletions = activityLogs.filter(
      (l) => l.action.toLowerCase().includes('delete') || (l.targetType === 'Invoice' && l.action.toLowerCase().includes('delete'))
    ).length;
    const modifications = activityLogs.filter(
      (l) => l.action.toLowerCase().includes('modif') || l.action.toLowerCase().includes('edit') || l.action.toLowerCase().includes('update')
    ).length;
    const denied = activityLogs.filter((l) => l.outcome === 'Denied').length;
    const cancellations = activityLogs.filter(
      (l) => l.action.toLowerCase().includes('cancel') || l.outcome === 'Flagged'
    ).length;
    const invoiceActions = activityLogs.filter(
      (l) => l.targetType === 'Invoice' || l.module === 'Billing' || l.module === 'Sales'
    ).length;

    return { total, deletions, modifications, denied, cancellations, invoiceActions };
  }, [activityLogs]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Event ID', 'Timestamp', 'User', 'Role', 'IP Address', 'Module', 'Action', 'Target ID', 'Outcome', 'Details'];
    const rows = filteredLogs.map((l) => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${l.userName}"`,
      `"${l.role}"`,
      `"${l.ipAddress}"`,
      `"${l.module}"`,
      `"${l.action.replace(/"/g, '""')}"`,
      `"${l.targetId || 'N/A'}"`,
      `"${l.outcome || 'Success'}"`,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Vyapar_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Audit Log exported to CSV successfully');
  };

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setFillColor(225, 29, 72); // rose-600 accent
    doc.rect(0, 27, pageWidth, 1.2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text((company.name || 'ENTERPRISE').toUpperCase(), 14, 11);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`${company.address || 'Business Address'} | GSTIN: ${company.gstin || 'Unregistered'}`, 14, 17);
    doc.text(`Official Forensic Audit Trail & Invoice Integrity Ledger`, 14, 23);

    doc.setTextColor(244, 63, 94);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('AUDIT LOG STATEMENT', pageWidth - 14, 13, { align: 'right' });

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - 14, 20, { align: 'right' });

    // Summary strip
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 32, pageWidth - 28, 12, 'F');
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Total Log Entries: ${filteredLogs.length}  |  Invoice Deletions: ${stats.deletions}  |  Modifications: ${stats.modifications}  |  Denied Attempts: ${stats.denied}  |  Cancellations: ${stats.cancellations}`,
      18,
      40
    );

    // Table
    const tableData = filteredLogs.map((l) => [
      l.timestamp,
      `${l.userName}\n(${l.role})`,
      l.ipAddress,
      l.module,
      l.action,
      l.targetId || '-',
      l.outcome || 'Success',
      l.details,
    ]);

    autoTable(doc, {
      startY: 48,
      head: [['Timestamp', 'Actor / Role', 'IP Address', 'Module', 'Action', 'Target ID', 'Outcome', 'Details & Forensics']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 7,
        cellPadding: 2.5,
        overflow: 'linebreak',
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 32 },
        2: { cellWidth: 22 },
        3: { cellWidth: 20 },
        4: { cellWidth: 42 },
        5: { cellWidth: 24 },
        6: { cellWidth: 18 },
        7: { cellWidth: 'auto' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          const val = String(data.cell.raw);
          if (val === 'Denied') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'Flagged') {
            data.cell.styles.textColor = [217, 119, 6];
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'Approved') {
            data.cell.styles.textColor = [37, 99, 235];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [22, 163, 74];
          }
        }
      },
    });

    doc.save(`Vyapar_Audit_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('Audit Report PDF downloaded');
  };

  const handleCopyJson = () => {
    if (!selectedLog) return;
    navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    showToast('Log JSON copied to clipboard');
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'owner':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'manager':
      case 'store manager':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cashier':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'accountant':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'sales executive':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'inventory manager':
      case 'inventory supervisor':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getOutcomeBadge = (outcome?: string) => {
    switch (outcome) {
      case 'Denied':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
            <XCircle className="w-3 h-3 text-rose-600" />
            Denied
          </span>
        );
      case 'Flagged':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Flagged
          </span>
        );
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            Approved
          </span>
        );
      case 'Success':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Success
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f0f4f9] overflow-hidden select-none text-xs text-slate-800">
      {/* 1. Top Forensic Header */}
      <div className="bg-white px-6 py-3.5 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-sm">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">Security Audit Trail &amp; Invoice Forensic Log</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                Tamper-Evident Ledger
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Enforced
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Authoritative log tracking all invoice creations, modifications, deletions, cancellations, and RBAC permission checks.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick simulation buttons for demo */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 p-1 rounded-md border border-slate-200 mr-2">
            <button
              onClick={handleSimulateInvoiceEdit}
              title="Record a test invoice modification with before/after state"
              className="px-2 py-1 rounded bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 border border-slate-200 shadow-xs flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3 text-amber-600" />
              Simulate Edit
            </button>
            <button
              onClick={handleSimulateInvoiceDelete}
              title="Record a test invoice deletion with snapshot"
              className="px-2 py-1 rounded bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 border border-slate-200 shadow-xs flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3 text-rose-600" />
              Simulate Delete
            </button>
            <button
              onClick={handleSimulateUnauthorizedAttempt}
              title="Record an unauthorized attempt blocked by security policy"
              className="px-2 py-1 rounded bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 border border-slate-200 shadow-xs flex items-center gap-1"
            >
              <Lock className="w-3 h-3 text-rose-600" />
              Simulate Blocked
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold shadow-xs transition-colors"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-rose-400" />
            <span>Export Audit PDF</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 shrink-0 bg-[#e9eff6] border-b border-[#cbd5e1]">
        {/* Total Actions */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="font-medium text-[11px]">Total Events</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{stats.invoiceActions} billing related</div>
        </div>

        {/* Invoice Deletions */}
        <div className="bg-white p-3 rounded-lg border border-rose-200 bg-rose-50/30 shadow-xs">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="font-bold text-[11px]">Invoice Deletions</span>
            <Trash2 className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-bold text-rose-700">{stats.deletions}</div>
          <div className="text-[10px] text-rose-600/90 mt-0.5 font-medium">Critical Security Focus</div>
        </div>

        {/* Invoice Modifications */}
        <div className="bg-white p-3 rounded-lg border border-amber-200 bg-amber-50/30 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="font-bold text-[11px]">Modifications / Diffs</span>
            <Edit3 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-amber-800">{stats.modifications}</div>
          <div className="text-[10px] text-amber-700/90 mt-0.5 font-medium">Tracked Before &amp; After</div>
        </div>

        {/* Denied / Blocked Attempts */}
        <div className="bg-white p-3 rounded-lg border border-red-300 bg-red-50/50 shadow-xs">
          <div className="flex items-center justify-between text-red-700 mb-1">
            <span className="font-bold text-[11px]">Denied / Violations</span>
            <AlertOctagon className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-xl font-bold text-red-800">{stats.denied}</div>
          <div className="text-[10px] text-red-600 mt-0.5 font-medium">Policy Violations Blocked</div>
        </div>

        {/* Cancellations */}
        <div className="bg-white p-3 rounded-lg border border-orange-200 shadow-xs">
          <div className="flex items-center justify-between text-orange-700 mb-1">
            <span className="font-medium text-[11px]">Cancellations</span>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-xl font-bold text-orange-800">{stats.cancellations}</div>
          <div className="text-[10px] text-orange-600 mt-0.5">Voided Vouchers</div>
        </div>

        {/* Filtered Count */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="font-medium text-[11px]">Active Results</span>
            <Filter className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-indigo-600">{filteredLogs.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Matching current filters</div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white px-4 py-2.5 border-b border-[#cbd5e1] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[240px] max-w-sm flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search invoice #, customer, user, details, IP..."
              className="w-full pl-8 pr-3 py-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/50 text-xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* Action Category Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Action:</span>
            <select
              value={actionCategoryFilter}
              onChange={(e) => setActionCategoryFilter(e.target.value)}
              className="py-1 px-2.5 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Actions</option>
              <option value="Deletions">Invoice Deletions</option>
              <option value="Modifications">Invoice Modifications</option>
              <option value="Cancellations">Invoice Cancellations</option>
              <option value="Creations">Invoice Creations</option>
              <option value="Denied">Access Denied &amp; Violations</option>
              <option value="Exports">Exports &amp; Reports</option>
            </select>
          </div>

          {/* Module Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Module:</span>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="py-1 px-2.5 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Modules</option>
              <option value="Billing">Billing &amp; Invoices</option>
              <option value="Sales">Sales &amp; POS</option>
              <option value="Purchase">Purchase &amp; Expenses</option>
              <option value="Inventory">Items &amp; Inventory</option>
              <option value="Roles">Staff &amp; Roles</option>
              <option value="Auth">Auth &amp; Sessions</option>
              <option value="Security">Security Policies</option>
            </select>
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="py-1 px-2.5 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Roles</option>
              <option value="Owner">Owner</option>
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
              <option value="Cashier">Cashier</option>
              <option value="Accountant">Accountant</option>
              <option value="Sales Executive">Sales Executive</option>
              <option value="Inventory Supervisor">Inventory Supervisor</option>
            </select>
          </div>

          {/* Outcome Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Outcome:</span>
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="py-1 px-2.5 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Outcomes</option>
              <option value="Success">Success</option>
              <option value="Denied">Denied (Security Alert)</option>
              <option value="Flagged">Flagged</option>
              <option value="Approved">Approved</option>
            </select>
          </div>
        </div>

        {/* Date / Reset Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-slate-300 rounded-md overflow-hidden bg-white">
            <button
              onClick={() => setDateFilter('All')}
              className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                dateFilter === 'All' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setDateFilter('Today')}
              className={`px-2.5 py-1 text-[11px] font-medium border-l border-slate-300 transition-colors ${
                dateFilter === 'Today' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateFilter('7Days')}
              className={`px-2.5 py-1 text-[11px] font-medium border-l border-slate-300 transition-colors ${
                dateFilter === '7Days' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Last 7 Days
            </button>
          </div>

          {(searchTerm || moduleFilter !== 'All' || actionCategoryFilter !== 'All' || outcomeFilter !== 'All' || roleFilter !== 'All' || dateFilter !== 'All') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setModuleFilter('All');
                setActionCategoryFilter('All');
                setOutcomeFilter('All');
                setRoleFilter('All');
                setDateFilter('All');
              }}
              title="Reset all filters"
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Table / Feed View */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#f8fafc] sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-4 w-36">Timestamp / IP</th>
              <th className="py-2.5 px-4 w-44">Actor &amp; Role</th>
              <th className="py-2.5 px-4 w-32">Module</th>
              <th className="py-2.5 px-4">Action &amp; Target</th>
              <th className="py-2.5 px-4">Details &amp; Audit Trail</th>
              <th className="py-2.5 px-4 w-28 text-center">Outcome</th>
              <th className="py-2.5 px-4 w-32 text-center">Forensics</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400">
                  <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">No audit records match your filters</p>
                  <p className="text-xs text-slate-400 mt-1">Try clearing search terms or resetting filters above.</p>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isDeletion = log.action.toLowerCase().includes('delete');
                const isModification =
                  log.action.toLowerCase().includes('modif') ||
                  log.action.toLowerCase().includes('edit') ||
                  log.action.toLowerCase().includes('update');
                const isDenied = log.outcome === 'Denied';
                const hasDiff = Boolean(log.beforeState || log.afterState);

                return (
                  <tr
                    key={log.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isDenied
                        ? 'bg-rose-50/40'
                        : isDeletion
                        ? 'bg-red-50/20'
                        : isModification
                        ? 'bg-amber-50/20'
                        : ''
                    }`}
                  >
                    {/* Timestamp & IP */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{log.timestamp}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono pl-4.5 mt-0.5">
                        {log.ipAddress}
                      </div>
                    </td>

                    {/* Actor & Role */}
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{log.userName}</span>
                      </div>
                      <div className="mt-0.5">
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold border ${getRoleBadgeColor(
                            log.role
                          )}`}
                        >
                          {log.role}
                        </span>
                      </div>
                    </td>

                    {/* Module */}
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {log.module}
                      </span>
                    </td>

                    {/* Action & Target */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isDenied ? (
                          <AlertOctagon className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        ) : isDeletion ? (
                          <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        ) : isModification ? (
                          <Edit3 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        )}
                        <span
                          className={`font-semibold ${
                            isDenied
                              ? 'text-red-700'
                              : isDeletion
                              ? 'text-rose-700'
                              : isModification
                              ? 'text-amber-800'
                              : 'text-slate-800'
                          }`}
                        >
                          {log.action}
                        </span>
                      </div>
                      {log.targetId && (
                        <div className="mt-0.5 text-[10px] font-mono text-slate-500 flex items-center gap-1">
                          <span className="text-slate-400">Target:</span>
                          <span className="font-bold text-slate-700 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
                            {log.targetId}
                          </span>
                          {log.targetType && (
                            <span className="text-slate-400 text-[9px]">({log.targetType})</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Details */}
                    <td className="py-2.5 px-4">
                      <p className="text-slate-600 text-[11px] leading-relaxed max-w-md line-clamp-2">
                        {log.details}
                      </p>
                    </td>

                    {/* Outcome Badge */}
                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                      {getOutcomeBadge(log.outcome)}
                    </td>

                    {/* Forensic Inspector Button */}
                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                      {hasDiff || log.targetId ? (
                        <button
                          onClick={() => {
                            setSelectedLog(log);
                            setViewFormat('visual');
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold shadow-2xs flex items-center gap-1 mx-auto transition-colors ${
                            isDeletion
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                              : isModification
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                              : isDenied
                              ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Diff</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedLog(log);
                            setViewFormat('visual');
                          }}
                          className="px-2 py-0.5 rounded text-[10px] text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                        >
                          Inspect
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Bottom Status / Compliance Strip */}
      <div className="bg-[#f8fafc] px-6 py-2 border-t border-[#e2e8f0] flex flex-wrap items-center justify-between text-[11px] text-slate-500 shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-slate-700">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Audit Persistence: In-Memory + Safe Local Enforced
          </span>
          <span className="hidden sm:inline-block text-slate-300">|</span>
          <span className="hidden sm:inline-block">SHA-256 State Hashing Active</span>
          <span className="hidden sm:inline-block text-slate-300">|</span>
          <span className="hidden sm:inline-block">GST Rule Compliance Section 35(1)</span>
        </div>
        <div className="text-slate-500">
          Showing <span className="font-bold text-slate-800">{filteredLogs.length}</span> of{' '}
          <span className="font-bold text-slate-800">{activityLogs.length}</span> events
        </div>
      </div>

      {/* 6. State Diff & Forensic Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    selectedLog.outcome === 'Denied'
                      ? 'bg-red-600'
                      : selectedLog.action.toLowerCase().includes('delete')
                      ? 'bg-rose-600'
                      : 'bg-blue-600'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold">Audit Forensic Details &amp; State Diff</h2>
                    {getOutcomeBadge(selectedLog.outcome)}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Event ID: <span className="font-mono text-white">{selectedLog.id}</span> | Time: {selectedLog.timestamp}
                  </p>
                </div>
              </div>

              {/* View Toggle (Visual vs JSON) */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-800 rounded-md p-0.5 border border-slate-700">
                  <button
                    onClick={() => setViewFormat('visual')}
                    className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors ${
                      viewFormat === 'visual' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Visual Diff
                  </button>
                  <button
                    onClick={() => setViewFormat('json')}
                    className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors ${
                      viewFormat === 'json' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Raw JSON
                  </button>
                </div>

                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Event Metadata Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Actor</span>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedLog.userName}</div>
                  <span
                    className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold border ${getRoleBadgeColor(
                      selectedLog.role
                    )}`}
                  >
                    {selectedLog.role}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">IP Address</span>
                  <div className="font-mono font-medium text-slate-800 mt-0.5">{selectedLog.ipAddress}</div>
                  <div className="text-[10px] text-slate-400">Local Area Network</div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Module &amp; Target</span>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedLog.module}</div>
                  <div className="text-[10px] text-slate-600 font-mono">
                    {selectedLog.targetId ? `${selectedLog.targetId} (${selectedLog.targetType || 'Record'})` : 'Global'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Action Performed</span>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedLog.action}</div>
                  <div className="text-[10px] text-slate-500">{selectedLog.timestamp}</div>
                </div>
              </div>

              {/* Action Details Note */}
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-blue-900 text-[11px]">Audit Summary:</span>
                    <p className="text-blue-800 text-[11px] mt-0.5">{selectedLog.details}</p>
                  </div>
                </div>
              </div>

              {/* Mode 1: Visual State Diff */}
              {viewFormat === 'visual' ? (
                <div className="space-y-4">
                  {/* Case A: Unauthorized Attempt / Denied */}
                  {selectedLog.outcome === 'Denied' && (
                    <div className="p-4 bg-rose-50 border border-rose-300 rounded-lg">
                      <div className="flex items-center gap-2 text-rose-800 font-bold mb-2">
                        <AlertOctagon className="w-4 h-4 text-rose-600" />
                        <span>Security Access Violation Prevented by Server</span>
                      </div>
                      <p className="text-rose-700 text-xs">
                        This operation was intercepted and prevented because the authenticated role (
                        <strong>{selectedLog.role}</strong>) does not have authoritative privileges to execute this transaction on finalized billing vouchers.
                      </p>
                      {selectedLog.afterState?.enforcedPolicy && (
                        <div className="mt-2.5 text-[11px] font-mono bg-white p-2 rounded border border-rose-200 text-rose-800">
                          <strong>Enforced Security Policy:</strong> {selectedLog.afterState.enforcedPolicy}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Case B: Permanent Deletion (Before State Snapshot) */}
                  {selectedLog.beforeState && !selectedLog.afterState && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Trash2 className="w-4 h-4 text-rose-600" />
                          <h3 className="font-bold text-slate-900 text-xs">
                            Deleted Record Snapshot (State at time of Purge)
                          </h3>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                          RECORD DELETED
                        </span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {Object.entries(selectedLog.beforeState).map(([key, val]) => (
                            <div key={key} className="bg-white p-2 rounded border border-slate-200">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase">{key}</span>
                              <div className="font-bold text-slate-800 text-xs mt-0.5">
                                {typeof val === 'number'
                                  ? key.toLowerCase().includes('amount') || key.toLowerCase().includes('balance')
                                    ? `Rs. ${val.toLocaleString('en-IN')}`
                                    : val
                                  : String(val)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Case C: Modification / Before & After Diff */}
                  {selectedLog.beforeState && selectedLog.afterState && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Edit3 className="w-4 h-4 text-amber-600" />
                          <h3 className="font-bold text-slate-900 text-xs">
                            Side-by-Side State Diff (Before vs After)
                          </h3>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          TRANSACTION MODIFIED
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Before State */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <div className="text-[11px] font-bold text-slate-700 mb-2 pb-1.5 border-b border-slate-200 flex items-center justify-between">
                            <span>Before State (Original)</span>
                            <span className="text-[9px] text-slate-400 font-mono">PRIOR</span>
                          </div>
                          <div className="space-y-1.5">
                            {Object.entries(selectedLog.beforeState).map(([key, val]) => {
                              const afterVal = selectedLog.afterState?.[key];
                              const isChanged = afterVal !== undefined && afterVal !== val;

                              return (
                                <div
                                  key={key}
                                  className={`p-1.5 rounded flex items-center justify-between text-[11px] ${
                                    isChanged ? 'bg-amber-100/60 font-semibold text-amber-900' : 'text-slate-700'
                                  }`}
                                >
                                  <span className="text-slate-500 font-mono text-[10px]">{key}:</span>
                                  <span className="font-bold">
                                    {typeof val === 'number' && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('balance'))
                                      ? `Rs. ${val.toLocaleString('en-IN')}`
                                      : String(val)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* After State */}
                        <div className="bg-emerald-50/40 border border-emerald-200 rounded-lg p-3">
                          <div className="text-[11px] font-bold text-emerald-800 mb-2 pb-1.5 border-b border-emerald-200 flex items-center justify-between">
                            <span>After State (Modified)</span>
                            <span className="text-[9px] text-emerald-600 font-mono">NEW COMMITTED</span>
                          </div>
                          <div className="space-y-1.5">
                            {Object.entries(selectedLog.afterState).map(([key, val]) => {
                              const beforeVal = selectedLog.beforeState?.[key];
                              const isChanged = beforeVal !== undefined && beforeVal !== val;

                              return (
                                <div
                                  key={key}
                                  className={`p-1.5 rounded flex items-center justify-between text-[11px] ${
                                    isChanged
                                      ? 'bg-emerald-100 font-bold text-emerald-950 border border-emerald-300'
                                      : 'text-slate-700'
                                  }`}
                                >
                                  <span className="text-slate-500 font-mono text-[10px]">{key}:</span>
                                  <span className="font-bold">
                                    {typeof val === 'number' && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('balance'))
                                      ? `Rs. ${val.toLocaleString('en-IN')}`
                                      : String(val)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Case D: Creation / Single After State */}
                  {!selectedLog.beforeState && selectedLog.afterState && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <h3 className="font-bold text-slate-900 text-xs">
                          Newly Created Record Attributes
                        </h3>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {Object.entries(selectedLog.afterState).map(([key, val]) => (
                          <div key={key} className="bg-white p-2 rounded border border-slate-200">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase">{key}</span>
                            <div className="font-bold text-slate-800 text-xs mt-0.5">
                              {typeof val === 'number' && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('balance') || key.toLowerCase().includes('received'))
                                ? `Rs. ${val.toLocaleString('en-IN')}`
                                : String(val)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Mode 2: Raw JSON Inspector */
                <div className="relative">
                  <pre className="bg-slate-900 text-slate-200 p-4 rounded-lg font-mono text-[11px] overflow-x-auto max-h-72">
                    {JSON.stringify(selectedLog, null, 2)}
                  </pre>
                  <button
                    onClick={handleCopyJson}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold border border-slate-700 flex items-center gap-1"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Audited under Vyapar System Governance Rule V-2026
              </span>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-md text-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
