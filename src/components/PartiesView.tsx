import React, { useMemo, useState } from 'react';
import {
  Plus,
  Settings,
  ChevronDown,
  Search,
  Printer,
  Filter,
  Edit2,
  MessageCircle,
  Clock,
  BookOpen,
  ChevronRight,
  Trash2,
  Copy,
  ExternalLink,
  X,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { interpolateMessageTemplate } from '../data/defaultSettings';

interface PartiesViewProps {
  typeFilter?: 'Customer' | 'Supplier' | 'All';
}

export const PartiesView: React.FC<PartiesViewProps> = ({ typeFilter = 'All' }) => {
  const {
    parties,
    partyGroups,
    transactions,
    selectedPartyId,
    setSelectedPartyId,
    setEditingParty,
    setIsAddPartyModalOpen,
    updateParty,
    movePartyToRecycleBin,
    setActiveTab,
    setActiveSettingsCategory,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    exportCurrentViewPdf,
    businessSettings,
    company,
    logPaymentReminderSent,
    showToast,
  } = useVyapar();

  const partyCfg = businessSettings.party;

  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [showTxSearch, setShowTxSearch] = useState(false);
  const [reminderPreviewOpen, setReminderPreviewOpen] = useState(false);

  const scopedParties = parties.filter((p) => {
    if (typeFilter === 'Customer') return p.type === 'Customer' || !p.type;
    if (typeFilter === 'Supplier') return p.type === 'Supplier';
    return true;
  });

  const filteredParties = scopedParties.filter((p) => {
    const matchName =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.phone || '').includes(searchQuery);
    if (!matchName) return false;
    if (partyCfg.enablePartyGrouping && groupFilter !== 'All') {
      if ((p.groupId || '') !== groupFilter) return false;
    }
    if (partyCfg.enablePartyStatus && statusFilter !== 'All') {
      if ((p.status || 'Active') !== statusFilter) return false;
    }
    return true;
  });

  const selectedParty =
    scopedParties.find((p) => p.id === selectedPartyId) ||
    filteredParties[0] ||
    scopedParties[0] ||
    parties[0];

  const partyTransactions = useMemo(
    () =>
      transactions.filter((t) =>
        selectedParty ? t.partyName.toLowerCase() === selectedParty.name.toLowerCase() : true
      ),
    [transactions, selectedParty]
  );

  const displayedTransactions = partyTransactions.filter((t) =>
    txSearchQuery
      ? t.invoiceNo.toLowerCase().includes(txSearchQuery.toLowerCase()) ||
        t.type.toLowerCase().includes(txSearchQuery.toLowerCase())
      : true
  );

  const latestDueTx = useMemo(
    () =>
      partyTransactions.find((t) => !t.isCancelled && (t.balance || 0) > 0) ||
      partyTransactions[0],
    [partyTransactions]
  );

  const reminderMessageText = useMemo(() => {
    if (!selectedParty) return '';
    return interpolateMessageTemplate(partyCfg.paymentReminderMessage, {
      business_name: company.name || 'MY STORE',
      customer_name: selectedParty.name,
      invoice_number: latestDueTx?.invoiceNo || 'Account Statement',
      due_date: latestDueTx?.dueDate || new Date().toLocaleDateString('en-GB'),
      balance_amount: (selectedParty.balance || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
      }),
      business_mobile: company.phone || '',
    });
  }, [selectedParty, partyCfg.paymentReminderMessage, company, latestDueTx]);

  const phoneDigits = (selectedParty?.phone || '').replace(/\D/g, '').slice(-10);
  const waHref = phoneDigits
    ? `https://wa.me/91${phoneDigits}?text=${encodeURIComponent(reminderMessageText)}`
    : `https://wa.me/?text=${encodeURIComponent(reminderMessageText)}`;

  const enabledProfileFields = partyCfg.additionalFields.filter(
    (f) => f.enabled && f.showInProfile
  );

  const handleOpenAdd = () => {
    setEditingParty(null);
    setIsAddPartyModalOpen(true);
  };

  const handleOpenEdit = () => {
    if (!selectedParty) return;
    setEditingParty(selectedParty);
    setIsAddPartyModalOpen(true);
  };

  const handleOpenPartySettings = () => {
    setActiveSettingsCategory('party');
    setActiveTab('settings');
  };

  const handleToggleStatus = () => {
    if (!selectedParty) return;
    const nextStatus = selectedParty.status === 'Inactive' ? 'Active' : 'Inactive';
    updateParty(selectedParty.id, { status: nextStatus });
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f0f4f9] dark:bg-slate-950 overflow-hidden select-none text-xs text-slate-800 dark:text-slate-100">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 px-6 py-3 border-b border-[#e2e8f0] dark:border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-[#0f172a] dark:text-white">
            {typeFilter === 'Customer'
              ? 'Customers'
              : typeFilter === 'Supplier'
              ? 'Suppliers & Vendors'
              : 'Parties'}
          </span>
          <ChevronDown className="w-5 h-5 text-[#64748b]" />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => exportCurrentViewPdf()}
            title="Export Parties Statement / Balances Report as PDF"
            className="flex items-center gap-1 px-3 py-2 rounded-md font-semibold text-xs text-[#dc2626] bg-[#fff1f2] border border-[#fecdd3] hover:bg-[#ffe4e6] transition-colors cursor-pointer"
          >
            <span>PDF Statement</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md font-semibold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Party</span>
          </button>

          <button
            type="button"
            onClick={handleOpenPartySettings}
            title="Party Settings"
            className="w-8 h-8 rounded-md flex items-center justify-center text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Split Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Search, Filters & Party List */}
        <div className="w-72 md:w-80 bg-white dark:bg-slate-900 border-r border-[#e2e8f0] dark:border-slate-800 flex flex-col justify-between shrink-0">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-[#f1f5f9] dark:border-slate-800 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Party Name or Mobile"
                  className="w-full bg-[#f8fafc] dark:bg-slate-800 border border-[#cbd5e1] dark:border-slate-700 rounded-full pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {(partyCfg.enablePartyGrouping || partyCfg.enablePartyStatus) && (
                <div className="grid grid-cols-2 gap-1.5">
                  {partyCfg.enablePartyGrouping && (
                    <select
                      value={groupFilter}
                      onChange={(e) => setGroupFilter(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[11px]"
                    >
                      <option value="All">All Groups</option>
                      {partyGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {partyCfg.enablePartyStatus && (
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[11px]"
                    >
                      <option value="All">All Status</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Blocked">Blocked</option>
                    </select>
                  )}
                </div>
              )}
            </div>

            <div className="px-4 py-2 bg-white dark:bg-slate-900 border-b border-[#f1f5f9] dark:border-slate-800 flex items-center justify-between text-[#64748b] font-medium text-xs">
              <div className="flex items-center gap-1">
                <span>Party Name</span>
                <Filter className="w-3 h-3 text-[#94a3b8]" />
              </div>
              <span>Amount</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#f8fafc] dark:divide-slate-800">
              {filteredParties.map((party) => {
                const isSelected = party.id === selectedParty?.id;
                const status = party.status || 'Active';
                return (
                  <div
                    key={party.id}
                    onClick={() => setSelectedPartyId(party.id)}
                    className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-blue-950/30 border-l-4 border-blue-600 font-semibold text-[#0f172a] dark:text-white'
                        : 'hover:bg-[#f8fafc] dark:hover:bg-slate-800/50 text-[#334155] dark:text-slate-300'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="truncate flex items-center gap-1.5">
                        <span className="truncate">{party.name}</span>
                        {status !== 'Active' && (
                          <span
                            className={`text-[9px] font-bold uppercase ${
                              status === 'Blocked' ? 'text-rose-600' : 'text-slate-400'
                            }`}
                          >
                            ({status})
                          </span>
                        )}
                      </div>
                      {party.groupName && (
                        <div className="text-[10px] text-slate-400 truncate">{party.groupName}</div>
                      )}
                    </div>
                    <span
                      className={`tabular-nums font-semibold shrink-0 ${
                        party.balance > 0 ? 'text-[#16a34a]' : 'text-[#64748b]'
                      }`}
                    >
                      {party.balance > 0
                        ? party.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })
                        : '0.00'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 border-t border-[#e2e8f0] dark:border-slate-800">
            <div
              onClick={handleOpenAdd}
              className="bg-[#ecfdf5] dark:bg-emerald-950/30 border border-[#a7f3d0] dark:border-emerald-900 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-[#d1fae5] transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-[#10b981] text-white flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs text-[#065f46] dark:text-emerald-300 leading-tight">
                Add new <strong className="font-bold">Customer or Supplier</strong> with custom fields
              </div>
              <ChevronRight className="w-4 h-4 text-[#10b981] shrink-0" />
            </div>
          </div>
        </div>

        {/* Right Pane */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
          {selectedParty && (
            <>
              <div className="px-6 py-3.5 border-b border-[#e2e8f0] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-[#0f172a] dark:text-white">
                      {selectedParty.name}
                    </h2>
                    {selectedParty.groupName && (
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                        • {selectedParty.groupName}
                      </span>
                    )}
                    {partyCfg.enablePartyStatus && (
                      <span
                        className={`text-[10px] font-bold uppercase ${
                          selectedParty.status === 'Blocked'
                            ? 'text-rose-600'
                            : selectedParty.status === 'Inactive'
                            ? 'text-slate-400'
                            : 'text-emerald-600'
                        }`}
                      >
                        [{selectedParty.status || 'Active'}]
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenEdit}
                      title="Edit Party Details"
                      className="text-blue-600 hover:text-blue-700 p-1 rounded hover:bg-blue-50 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {selectedParty.phone && <span>Ph: {selectedParty.phone}</span>}
                    {selectedParty.gstin && (
                      <span className="font-mono">GSTIN: {selectedParty.gstin}</span>
                    )}
                    {selectedParty.shippingAddress && partyCfg.enableShippingAddress && (
                      <span>Ship To: {selectedParty.shippingAddress}</span>
                    )}
                    {enabledProfileFields.map((f) => {
                      const val = selectedParty.customFields?.[f.id];
                      if (!val) return null;
                      return (
                        <span key={f.id}>
                          <strong>{f.name}:</strong> {val}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Action Icons */}
                <div className="flex items-center gap-2 shrink-0">
                  {partyCfg.enablePaymentReminder && (
                    <button
                      type="button"
                      onClick={() => setReminderPreviewOpen((v) => !v)}
                      title="Open Payment Reminder"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 text-[11px] font-semibold cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Payment Reminder</span>
                    </button>
                  )}

                  {partyCfg.enableWhatsAppReminderShare && (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        logPaymentReminderSent({
                          partyId: selectedParty.id,
                          partyName: selectedParty.name,
                          channel: 'WhatsApp',
                          amountDue: selectedParty.balance || 0,
                          messagePreview: reminderMessageText,
                        });
                      }}
                      title="Send WhatsApp Message"
                      className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center hover:bg-emerald-100"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {partyCfg.enablePartyStatus && (
                    <button
                      type="button"
                      onClick={handleToggleStatus}
                      className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {selectedParty.status === 'Inactive' ? 'Mark Active' : 'Mark Inactive'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => movePartyToRecycleBin(selectedParty.id)}
                    title="Delete / Archive Party"
                    className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Payment Reminder Drawer */}
              {reminderPreviewOpen && (
                <div className="px-6 py-3 bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900 space-y-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-amber-900 dark:text-amber-200">
                      Payment Reminder Preview (Configured in Party Settings)
                    </span>
                    <button
                      type="button"
                      onClick={() => setReminderPreviewOpen(false)}
                      className="text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 p-2.5 rounded border border-amber-200 dark:border-slate-700">
                    {reminderMessageText}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(reminderMessageText);
                        logPaymentReminderSent({
                          partyId: selectedParty.id,
                          partyName: selectedParty.name,
                          channel: 'Manual',
                          amountDue: selectedParty.balance || 0,
                          messagePreview: reminderMessageText,
                        });
                        showToast('Payment reminder copied & logged.');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] font-semibold cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy &amp; Log</span>
                    </button>
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        logPaymentReminderSent({
                          partyId: selectedParty.id,
                          partyName: selectedParty.name,
                          channel: 'WhatsApp',
                          amountDue: selectedParty.balance || 0,
                          messagePreview: reminderMessageText,
                        })
                      }
                      className="inline-flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Send via WhatsApp</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Transactions Sub-header */}
              <div className="px-6 py-2.5 border-b border-[#e2e8f0] dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-bold text-[#0f172a] dark:text-white">Transactions</h3>
                  {showTxSearch && (
                    <input
                      type="text"
                      value={txSearchQuery}
                      onChange={(e) => setTxSearchQuery(e.target.value)}
                      placeholder="Filter invoice # or type..."
                      className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs w-48"
                    />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTxSearch((v) => !v)}
                    className="w-7 h-7 flex items-center justify-center text-[#64748b] hover:text-[#0f172a] rounded cursor-pointer"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-7 h-7 flex items-center justify-center text-[#64748b] hover:text-[#0f172a] rounded cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCurrentViewPdf()}
                    title="Export Party Statement as PDF Document"
                    className="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100 text-[11px] font-bold cursor-pointer"
                  >
                    pdf
                  </button>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-white dark:bg-slate-900 border-b border-[#e2e8f0] dark:border-slate-800 text-[#64748b] font-medium text-[11px]">
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Number</th>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4 text-right">Total</th>
                      <th className="py-2.5 px-4 text-right">Balance/ Unused</th>
                      <th className="py-2.5 px-4">Due Date</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f8fafc] dark:divide-slate-800">
                    {displayedTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-[#94a3b8]">
                          No transactions found for this party.
                        </td>
                      </tr>
                    ) : (
                      displayedTransactions.map((tx) => (
                        <tr
                          key={tx.id}
                          onClick={() => {
                            setSelectedInvoice(tx);
                            setIsInvoicePreviewOpen(true);
                          }}
                          className="hover:bg-[#f8fafc] dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4 font-medium text-[#0f172a] dark:text-white whitespace-nowrap">
                            {tx.type}
                          </td>
                          <td className="py-3 px-4 text-[#334155] dark:text-slate-300 whitespace-nowrap font-mono">
                            {tx.invoiceNo}
                          </td>
                          <td className="py-3 px-4 text-[#64748b] whitespace-nowrap">{tx.date}</td>
                          <td className="py-3 px-4 text-right font-semibold text-[#0f172a] dark:text-white tabular-nums whitespace-nowrap">
                            ₹ {tx.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right text-[#64748b] tabular-nums whitespace-nowrap">
                            ₹ {tx.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-[#64748b] whitespace-nowrap">{tx.dueDate || '-'}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`font-semibold text-xs ${
                                tx.status === 'Paid'
                                  ? 'text-[#16a34a]'
                                  : tx.status === 'Partial'
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
