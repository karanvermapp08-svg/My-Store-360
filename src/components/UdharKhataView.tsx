import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  ArrowDownLeft,
  AlertTriangle,
  MessageCircle,
  Printer,
  Calendar,
  Copy,
  CheckCircle2,
  X,
  UserPlus,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { Party, Transaction } from '../types';
import { exportPartyStatementPdf } from '../utils/pdfExport';
import { getDaysOverdue } from '../utils/erpEngine';

export const UdharKhataView: React.FC = () => {
  const {
    parties,
    transactions,
    company,
    businessSettings,
    recordUdharEntry,
    updateParty,
    setIsAddPartyModalOpen,
    logPaymentReminderSent,
    showToast,
  } = useVyapar();

  const [modeTab, setModeTab] = useState<'ledger' | 'collection'>('ledger');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Due' | 'Overdue' | 'Settled'>('All');

  const customers = useMemo(
    () => parties.filter((p) => p.type === 'Customer' || !p.type),
    [parties]
  );

  const [selectedId, setSelectedId] = useState<string>(customers[0]?.id || '');
  const selectedParty: Party | undefined =
    customers.find((p) => p.id === selectedId) || customers[0];

  // Modals: Give Udhaar / Receive Payment / Edit Limit
  const [entryModalKind, setEntryModalKind] = useState<'GIVE_UDHAAR' | 'RECEIVE_PAYMENT' | null>(null);
  const [entryAmount, setEntryAmount] = useState('');
  const [entryMode, setEntryMode] = useState<Transaction['paymentType']>('Cash');
  const [entryDueDate, setEntryDueDate] = useState('');
  const [entryNotes, setEntryNotes] = useState('');

  const [isEditingTerms, setIsEditingTerms] = useState(false);
  const [editCreditLimit, setEditCreditLimit] = useState<number>(0);
  const [editCreditDays, setEditCreditDays] = useState<number>(15);

  const todayStr = new Date().toLocaleDateString('en-GB');

  // Compute per-customer overdue days & totals
  const customerMetrics = useMemo(() => {
    const map = new Map<
      string,
      { overdueDays: number; totalCreditGiven: number; totalReceived: number; txs: Transaction[] }
    >();

    customers.forEach((p) => {
      const pTxs = transactions.filter(
        (t) =>
          !t.isCancelled &&
          t.partyName.trim().toLowerCase() === p.name.trim().toLowerCase()
      );
      let maxOverdue = 0;
      let creditGiven = 0;
      let received = 0;

      pTxs.forEach((tx) => {
        if (tx.type === 'Sale' || tx.type === 'Sale Order') {
          creditGiven += tx.totalAmount || 0;
          received += tx.receivedAmount || 0;
          if ((tx.balance || 0) > 0 && tx.dueDate) {
            maxOverdue = Math.max(maxOverdue, getDaysOverdue(tx.dueDate));
          }
        } else if (tx.type === 'Payment-In') {
          received += tx.totalAmount || 0;
        }
      });

      map.set(p.id, {
        overdueDays: (p.balance || 0) > 0 ? maxOverdue : 0,
        totalCreditGiven: creditGiven,
        totalReceived: received,
        txs: pTxs,
      });
    });
    return map;
  }, [customers, transactions]);

  const summary = useMemo(() => {
    const totalReceivable = customers.reduce((s, p) => s + Math.max(0, p.balance || 0), 0);
    const overdueParties = customers.filter(
      (p) => (p.balance || 0) > 0 && (customerMetrics.get(p.id)?.overdueDays || 0) > 0
    );

    const todaysReceipts = transactions.filter(
      (t) =>
        !t.isCancelled &&
        t.date.startsWith(todayStr) &&
        (t.type === 'Payment-In' || (t.type === 'Sale' && (t.receivedAmount || 0) > 0))
    );
    const collectedToday = todaysReceipts.reduce(
      (s, t) => s + (t.type === 'Payment-In' ? t.totalAmount || 0 : t.receivedAmount || 0),
      0
    );

    const creditToday = transactions
      .filter(
        (t) =>
          !t.isCancelled &&
          t.type === 'Sale' &&
          t.date.startsWith(todayStr) &&
          (t.balance || 0) > 0
      )
      .reduce((s, t) => s + (t.balance || 0), 0);

    return {
      totalReceivable,
      overdueCount: overdueParties.length,
      overdueParties,
      collectedToday,
      creditToday,
      todaysReceipts,
    };
  }, [customers, customerMetrics, transactions, todayStr]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((p) => {
      const bal = p.balance || 0;
      const overdue = customerMetrics.get(p.id)?.overdueDays || 0;
      if (filterType === 'Due' && bal <= 0) return false;
      if (filterType === 'Overdue' && overdue <= 0) return false;
      if (filterType === 'Settled' && bal > 0) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.phone || '').toLowerCase().includes(q);
    });
  }, [customers, customerMetrics, filterType, search]);

  const activePartyMeta = selectedParty
    ? customerMetrics.get(selectedParty.id) || {
        overdueDays: 0,
        totalCreditGiven: 0,
        totalReceived: 0,
        txs: [],
      }
    : null;

  // Compute Closing Balance Formula breakdown for selected customer
  const formulaBreakdown = useMemo(() => {
    if (!selectedParty || !activePartyMeta) return null;
    const closing = selectedParty.balance || 0;
    const newUdhaar = activePartyMeta.totalCreditGiven;
    const paymentsReceived = activePartyMeta.totalReceived;
    const opening = Math.round((closing - (newUdhaar - paymentsReceived)) * 100) / 100;
    return {
      opening,
      newUdhaar,
      paymentsReceived,
      closing,
    };
  }, [selectedParty, activePartyMeta]);

  const buildWhatsappUrl = (party: Party) => {
    const digits = (party.phone || '').replace(/\D/g, '');
    const phoneWithCountry = digits.length === 10 ? `91${digits}` : digits;
    const dueAmt = Math.max(0, party.balance || 0).toLocaleString('en-IN');
    const text = `Namaste ${party.name},\nThis is a friendly payment reminder from *${company.name}*.\nPending Udhaar Balance: *₹${dueAmt}*\n${
      company.upiId ? `UPI ID: ${company.upiId}\n` : ''
    }Please settle at your convenience. Thank you!`;
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`;
  };

  const handleOpenEntryModal = (kind: 'GIVE_UDHAAR' | 'RECEIVE_PAYMENT') => {
    setEntryModalKind(kind);
    setEntryAmount(
      kind === 'RECEIVE_PAYMENT' && selectedParty && selectedParty.balance > 0
        ? String(selectedParty.balance)
        : ''
    );
    setEntryMode(kind === 'GIVE_UDHAAR' ? 'Credit' : 'UPI');
    setEntryDueDate('');
    setEntryNotes('');
  };

  const handleSubmitEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty || !entryModalKind) return;
    const amt = parseFloat(entryAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Enter a valid amount greater than ₹0', 'warning');
      return;
    }
    const res = recordUdharEntry({
      partyId: selectedParty.id,
      kind: entryModalKind,
      amount: amt,
      paymentMode: entryMode,
      dueDate: entryDueDate.trim() || undefined,
      notes: entryNotes.trim() || undefined,
    });
    if (res.success) {
      setEntryModalKind(null);
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleSaveTerms = () => {
    if (!selectedParty) return;
    const res = updateParty(selectedParty.id, {
      creditLimit: Math.max(0, editCreditLimit),
      creditPeriodDays: Math.max(0, editCreditDays),
    });
    if (res.success) {
      setIsEditingTerms(false);
      showToast(`Credit terms updated for ${selectedParty.name}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Udhaar Khata — Customer Credit Ledger
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Digital Bahi Khata with partial payments, credit limits, overdue alerts &amp; WhatsApp reminders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddPartyModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Overdue Alert Banner */}
      {summary.overdueCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{summary.overdueCount} customer(s)</strong> have overdue Udhaar past their due date:{' '}
              {summary.overdueParties
                .slice(0, 3)
                .map((p) => `${p.name} (₹${p.balance.toLocaleString('en-IN')})`)
                .join(', ')}
              {summary.overdueCount > 3 ? '…' : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setModeTab('ledger');
              setFilterType('Overdue');
            }}
            className="px-3 py-1 rounded-lg bg-amber-600 text-white font-bold cursor-pointer"
          >
            View Overdue Accounts
          </button>
        </div>
      )}

      {/* 4 Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Total Market Udhaar (Receivable)
          </div>
          <div className="text-2xl font-extrabold text-rose-600 mt-1 tabular-nums">
            ₹{Math.round(summary.totalReceivable).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Across {customers.filter((p) => (p.balance || 0) > 0).length} customers
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Today&apos;s Collection
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1 tabular-nums">
            ₹{Math.round(summary.collectedToday).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {summary.todaysReceipts.length} receipts today
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Udhaar Given Today
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
            ₹{Math.round(summary.creditToday).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Today ({todayStr})</div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Overdue Accounts
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-1 tabular-nums">
            {summary.overdueCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Requires follow-up</div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setModeTab('ledger')}
          className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
            modeTab === 'ledger'
              ? 'bg-[#8B0D1E] text-white'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Customer Khata Ledger</span>
        </button>
        <button
          type="button"
          onClick={() => setModeTab('collection')}
          className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
            modeTab === 'collection'
              ? 'bg-[#8B0D1E] text-white'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Daily Collection Report ({summary.todaysReceipts.length})</span>
        </button>
      </div>

      {modeTab === 'ledger' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Customer Directory */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customer or phone..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>
              <div className="flex gap-1 text-[11px]">
                {(['All', 'Due', 'Overdue', 'Settled'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilterType(f)}
                    className={`flex-1 py-1 rounded font-bold cursor-pointer ${
                      filterType === f
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCustomers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No customers match filter.</div>
              ) : (
                filteredCustomers.map((p) => {
                  const meta = customerMetrics.get(p.id);
                  const active = selectedParty?.id === p.id;
                  const limit = p.creditLimit || 0;
                  const pct = limit > 0 ? Math.min(100, Math.round(((p.balance || 0) / limit) * 100)) : 0;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(p.id);
                        setIsEditingTerms(false);
                      }}
                      className={`w-full px-3.5 py-3 text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-rose-50/70 dark:bg-rose-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-slate-400">{p.phone || 'No mobile'}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={`text-xs font-extrabold tabular-nums ${
                              (p.balance || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            ₹{Math.abs(p.balance || 0).toLocaleString('en-IN')}
                          </div>
                          {(meta?.overdueDays || 0) > 0 && (
                            <span className="text-[10px] font-bold text-amber-600">
                              {meta?.overdueDays}d overdue
                            </span>
                          )}
                        </div>
                      </div>
                      {limit > 0 && (
                        <div className="mt-2">
                          <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${pct >= 90 ? 'bg-rose-600' : 'bg-blue-600'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Detail Khata Ledger */}
          <div className="lg:col-span-8 space-y-4">
            {selectedParty && formulaBreakdown && activePartyMeta ? (
              <>
                {/* Customer Card & Actions */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                          {selectedParty.name}
                        </h3>
                        {activePartyMeta.overdueDays > 0 && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Overdue {activePartyMeta.overdueDays}d
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {selectedParty.phone || 'No mobile'} · {selectedParty.address || 'Local Customer'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEntryModal('GIVE_UDHAAR')}
                        className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Give Udhaar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEntryModal('RECEIVE_PAYMENT')}
                        className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        <span>Receive Payment</span>
                      </button>
                      {!selectedParty.reminderOptOut && (selectedParty.balance || 0) > 0 && selectedParty.phone && (
                        <a
                          href={buildWhatsappUrl(selectedParty)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            logPaymentReminderSent({
                              partyId: selectedParty.id,
                              partyName: selectedParty.name,
                              channel: 'WhatsApp',
                              amountDue: selectedParty.balance,
                              messagePreview: `Udhaar reminder for ₹${selectedParty.balance}`,
                            });
                          }}
                          className="px-3.5 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp Reminder</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          exportPartyStatementPdf(
                            selectedParty,
                            activePartyMeta.txs,
                            company,
                            'Udhaar Khata Statement',
                            businessSettings
                          );
                          showToast(`Downloaded statement PDF for ${selectedParty.name}`);
                        }}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Statement</span>
                      </button>
                    </div>
                  </div>

                  {/* Closing Balance Formula Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">Opening Balance</div>
                      <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mt-0.5 tabular-nums">
                        ₹{formulaBreakdown.opening.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">+ New Udhaar</div>
                      <div className="text-sm font-extrabold text-rose-600 mt-0.5 tabular-nums">
                        +₹{formulaBreakdown.newUdhaar.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">− Payments Received</div>
                      <div className="text-sm font-extrabold text-emerald-600 mt-0.5 tabular-nums">
                        −₹{formulaBreakdown.paymentsReceived.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">= Closing Balance</div>
                      <div
                        className={`text-base font-extrabold mt-0.5 tabular-nums ${
                          formulaBreakdown.closing > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        ₹{formulaBreakdown.closing.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Credit Limit & Due Period Settings */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                    <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
                      <span>
                        Credit Limit:{' '}
                        <strong className="tabular-nums">
                          {selectedParty.creditLimit ? `₹${selectedParty.creditLimit.toLocaleString('en-IN')}` : 'No Limit'}
                        </strong>
                      </span>
                      <span>
                        Payment Terms:{' '}
                        <strong>{selectedParty.creditPeriodDays ?? 15} Days</strong>
                      </span>
                    </div>
                    {isEditingTerms ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editCreditLimit}
                          onChange={(e) => setEditCreditLimit(Number(e.target.value))}
                          placeholder="Limit ₹"
                          className="w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                        />
                        <input
                          type="number"
                          value={editCreditDays}
                          onChange={(e) => setEditCreditDays(Number(e.target.value))}
                          placeholder="Days"
                          className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleSaveTerms}
                          className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const msg = `Reminder from ${company.name}: Pending Udhaar balance is ₹${Math.max(
                              0,
                              selectedParty.balance || 0
                            ).toLocaleString('en-IN')}.`;
                            navigator.clipboard?.writeText(msg);
                            showToast('Copied reminder message to clipboard');
                          }}
                          className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy Reminder</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditCreditLimit(selectedParty.creditLimit || 0);
                            setEditCreditDays(selectedParty.creditPeriodDays ?? 15);
                            setIsEditingTerms(true);
                          }}
                          className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                        >
                          Edit Limit / Due Days
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Customer Khata Entries Table */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      Khata Ledger History ({activePartyMeta.txs.length} entries)
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Date</th>
                          <th className="px-4 py-2.5">Type / Ref</th>
                          <th className="px-4 py-2.5">Mode / Note</th>
                          <th className="px-4 py-2.5 text-right">Udhaar (Dr)</th>
                          <th className="px-4 py-2.5 text-right">Received (Cr)</th>
                          <th className="px-4 py-2.5 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {activePartyMeta.txs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                              No Udhaar or Payment entries recorded yet for {selectedParty.name}.
                            </td>
                          </tr>
                        ) : (
                          activePartyMeta.txs.map((tx) => {
                            const isCharge = tx.type === 'Sale' || tx.type === 'Sale Order';
                            const dr = isCharge ? tx.totalAmount : 0;
                            const cr = tx.type === 'Payment-In' ? tx.totalAmount : tx.receivedAmount || 0;
                            return (
                              <tr key={tx.id}>
                                <td className="px-4 py-2.5 whitespace-nowrap">{tx.date.split(',')[0]}</td>
                                <td className="px-4 py-2.5">
                                  <span className="font-bold text-slate-800 dark:text-slate-100">
                                    {tx.type}
                                  </span>{' '}
                                  <span className="font-mono text-slate-400">#{tx.invoiceNo}</span>
                                </td>
                                <td className="px-4 py-2.5 text-[11px] text-slate-500">
                                  {tx.paymentType}
                                  {tx.notes ? ` · ${tx.notes}` : ''}
                                </td>
                                <td className="px-4 py-2.5 text-right font-bold text-rose-600 tabular-nums">
                                  {dr > 0 ? `₹${dr.toLocaleString('en-IN')}` : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-right font-bold text-emerald-600 tabular-nums">
                                  {cr > 0 ? `₹${cr.toLocaleString('en-IN')}` : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-right font-extrabold tabular-nums">
                                  ₹{(tx.balance || 0).toLocaleString('en-IN')}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center text-xs text-slate-400">
                Select a customer from the left directory or add a new customer to open their Khata.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Daily Collection Report */
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Daily Collection Report — {todayStr}
              </h3>
              <p className="text-xs text-slate-500">
                Total Collected Today: ₹{Math.round(summary.collectedToday).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Receipt / Inv</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Payment Mode</th>
                  <th className="px-4 py-2.5">Note</th>
                  <th className="px-4 py-2.5 text-right">Amount Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {summary.todaysReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No payments collected today ({todayStr}) yet.
                    </td>
                  </tr>
                ) : (
                  summary.todaysReceipts.map((tx) => {
                    const amt = tx.type === 'Payment-In' ? tx.totalAmount : tx.receivedAmount;
                    return (
                      <tr key={tx.id}>
                        <td className="px-4 py-2.5 font-mono font-bold">#{tx.invoiceNo}</td>
                        <td className="px-4 py-2.5 font-semibold">{tx.partyName}</td>
                        <td className="px-4 py-2.5">{tx.paymentType}</td>
                        <td className="px-4 py-2.5 text-[11px] text-slate-500">{tx.notes || tx.type}</td>
                        <td className="px-4 py-2.5 text-right font-extrabold text-emerald-600 tabular-nums">
                          ₹{(amt || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Give Udhaar / Receive Payment Modal */}
      {entryModalKind && selectedParty && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4"
          onClick={() => setEntryModalKind(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {entryModalKind === 'GIVE_UDHAAR'
                  ? `Give Udhaar to ${selectedParty.name}`
                  : `Receive Payment from ${selectedParty.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setEntryModalKind(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitEntry} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  required
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(e.target.value)}
                  placeholder="Enter amount (supports partial payments)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold"
                />
                {entryModalKind === 'RECEIVE_PAYMENT' && selectedParty.balance > 0 && (
                  <div className="text-[11px] text-slate-500 mt-1">
                    Current Pending Udhaar: ₹{selectedParty.balance.toLocaleString('en-IN')}
                  </div>
                )}
              </div>

              {entryModalKind === 'RECEIVE_PAYMENT' ? (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Mode</label>
                  <select
                    value={entryMode}
                    onChange={(e) => setEntryMode(e.target.value as Transaction['paymentType'])}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Due Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={entryDueDate}
                    onChange={(e) => setEntryDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Note / Reference</label>
                <input
                  type="text"
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  placeholder="e.g. Monthly Ration Khata / Partial UPI settlement"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEntryModalKind(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-lg text-white font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                    entryModalKind === 'GIVE_UDHAAR'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{entryModalKind === 'GIVE_UDHAAR' ? 'Record Udhaar' : 'Save Receipt'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
