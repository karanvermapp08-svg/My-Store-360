import React, { useMemo, useState } from 'react';
import {
  Users,
  Ticket,
  Megaphone,
  MessageSquareHeart,
  Crown,
  Sparkles,
  Search,
  Plus,
  CheckCircle2,
  X,
  Trash2,
  MessageCircle,
  CalendarClock,
  Star,
  ArrowRight,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { interpolateMessageTemplate } from '../data/defaultSettings';
import { safeGetStoredData, safeSetStoredData } from '../utils/storage';

type CrmSubTab = 'segments' | 'coupons' | 'campaigns' | 'feedback';
type SegmentFilter = 'All' | 'VIP' | 'Wholesale' | 'Regular' | 'At-Risk';

interface FeedbackEntry {
  id: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  rating: number;
  category: 'Product Quality' | 'Billing & Speed' | 'Delivery' | 'Pricing' | 'Customer Service';
  comment: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  resolutionNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

const DEFAULT_FEEDBACK: FeedbackEntry[] = [
  {
    id: 'fb-1',
    customerName: 'Ramesh Kirana Mart',
    customerPhone: '9845012345',
    rating: 5,
    category: 'Billing & Speed',
    comment: 'Quick WhatsApp GST bill delivery and clean wholesale rate tiers.',
    status: 'Resolved',
    resolutionNote: 'Thanked customer and tagged for festival bulk offers.',
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    resolvedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

export const CrmLoyaltyView: React.FC = () => {
  const {
    parties,
    transactions,
    coupons,
    msCreditTransactions,
    serviceReminders,
    businessSettings,
    company,
    saveBillingCoupon,
    toggleBillingCouponStatus,
    addServiceReminder,
    updateServiceReminder,
    logPaymentReminderSent,
    setSelectedPartyId,
    setActiveTab,
    requestConfirmation,
    showToast,
  } = useVyapar();

  const [subTab, setSubTab] = useState<CrmSubTab>('segments');
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('All');

  // Coupon creation modal
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [cpnCode, setCpnCode] = useState('');
  const [cpnTitle, setCpnTitle] = useState('');
  const [cpnDesc, setCpnDesc] = useState('');
  const [cpnType, setCpnType] = useState<'percent' | 'flat'>('percent');
  const [cpnValue, setCpnValue] = useState('10');
  const [cpnMaxDisc, setCpnMaxDisc] = useState('250');
  const [cpnMinOrder, setCpnMinOrder] = useState('499');
  const [cpnExpiry, setCpnExpiry] = useState(() => {
    const dt = new Date();
    dt.setDate(dt.getDate() + 30);
    return dt.toISOString().slice(0, 10);
  });
  const [cpnLimitTotal, setCpnLimitTotal] = useState('100');
  const [cpnLimitPerCust, setCpnLimitPerCust] = useState('2');

  // Campaign state
  const [campaignSegment, setCampaignSegment] = useState<SegmentFilter>('At-Risk');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    () => businessSettings.messages.templates[0]?.id || ''
  );
  const [campaignCouponCode, setCampaignCouponCode] = useState<string>(
    () => coupons.find((c) => c.isActive)?.code || ''
  );
  const [customCampaignNote, setCustomCampaignNote] = useState(
    'Special store offer just for you! Visit us or reply to order with home delivery.'
  );
  const [newFollowUpCustomer, setNewFollowUpCustomer] = useState('');
  const [newFollowUpTitle, setNewFollowUpTitle] = useState('');
  const [newFollowUpDate, setNewFollowUpDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });

  // Feedback state
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>(() =>
    safeGetStoredData<FeedbackEntry[]>('bm360_crm_feedback', DEFAULT_FEEDBACK, Array.isArray)
  );
  const [fbFilter, setFbFilter] = useState<'All' | 'Open' | 'Resolved'>('All');
  const [isFbModalOpen, setIsFbModalOpen] = useState(false);
  const [fbCustomerName, setFbCustomerName] = useState('');
  const [fbPhone, setFbPhone] = useState('');
  const [fbRating, setFbRating] = useState(5);
  const [fbCategory, setFbCategory] = useState<FeedbackEntry['category']>('Product Quality');
  const [fbComment, setFbComment] = useState('');

  const persistFeedback = (next: FeedbackEntry[]) => {
    setFeedbackList(next);
    safeSetStoredData('bm360_crm_feedback', next);
  };

  // Compute Customer RFM Segments & MS Loyalty balances from live store records
  const customerAnalytics = useMemo(() => {
    const customers = parties.filter((p) => p.type === 'Customer' || !p.type);
    const sales = transactions.filter((t) => t.type === 'Sale' && !t.isCancelled);
    const nowMs = Date.now();

    const loyaltyBalanceMap = new Map<string, number>();
    msCreditTransactions.forEach((tx) => {
      const key = (tx.customerId || tx.customerName).toLowerCase();
      loyaltyBalanceMap.set(key, tx.balanceAfter);
    });

    const rows = customers.map((c) => {
      const custSales = sales.filter(
        (s) => s.partyName.trim().toLowerCase() === c.name.trim().toLowerCase()
      );
      const totalSpent = custSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      const billCount = custSales.length;
      const avgOrder = billCount > 0 ? totalSpent / billCount : 0;

      let latestMs = 0;
      let latestDateStr = '';
      custSales.forEach((s) => {
        const dt = new Date(s.date);
        const ms = Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
        if (ms > latestMs) {
          latestMs = ms;
          latestDateStr = s.date;
        }
      });
      const daysSinceLast = latestMs > 0 ? Math.floor((nowMs - latestMs) / 86400000) : 999;

      let segment: Exclude<SegmentFilter, 'All'> = 'Regular';
      if (totalSpent >= 25000 || billCount >= 5) {
        segment = 'VIP';
      } else if (
        (c.groupName || '').toLowerCase().includes('wholesale') ||
        (c.groupName || '').toLowerCase().includes('dealer') ||
        avgOrder >= 5000
      ) {
        segment = 'Wholesale';
      } else if (daysSinceLast > 45) {
        segment = 'At-Risk';
      }

      const loyaltyCredits =
        loyaltyBalanceMap.get(c.id.toLowerCase()) ??
        loyaltyBalanceMap.get(c.name.trim().toLowerCase()) ??
        Math.floor(totalSpent * 0.01);

      return {
        ...c,
        totalSpent,
        billCount,
        avgOrder,
        latestDateStr,
        daysSinceLast,
        segment,
        loyaltyCredits,
      };
    });

    const summary = {
      total: rows.length,
      vip: rows.filter((r) => r.segment === 'VIP').length,
      wholesale: rows.filter((r) => r.segment === 'Wholesale').length,
      atRisk: rows.filter((r) => r.segment === 'At-Risk').length,
      totalCredits: rows.reduce((s, r) => s + r.loyaltyCredits, 0),
    };

    return { rows: rows.sort((a, b) => b.totalSpent - a.totalSpent), summary };
  }, [parties, transactions, msCreditTransactions]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customerAnalytics.rows.filter((r) => {
      if (segmentFilter !== 'All' && r.segment !== segmentFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.phone || '').includes(q) ||
        (r.groupName || '').toLowerCase().includes(q)
      );
    });
  }, [customerAnalytics.rows, segmentFilter, search]);

  const activeTemplates = businessSettings.messages.templates;
  const selectedTemplate =
    activeTemplates.find((t) => t.id === selectedTemplateId) || activeTemplates[0];

  const campaignTargets = useMemo(() => {
    return customerAnalytics.rows.filter((r) =>
      campaignSegment === 'All' ? true : r.segment === campaignSegment
    );
  }, [customerAnalytics.rows, campaignSegment]);

  const buildCampaignMessage = (custName: string, outstanding: number) => {
    const baseTpl = selectedTemplate?.body
      ? interpolateMessageTemplate(selectedTemplate.body, {
          customer_name: custName,
          business_name: company.name,
          business_mobile: company.phone,
          invoice_number: 'OFFER',
          invoice_date: new Date().toLocaleDateString('en-GB'),
          due_date: cpnExpiry,
          total_amount: '0.00',
          paid_amount: '0.00',
          balance_amount: outstanding.toFixed(2),
        })
      : `Hello ${custName}, greetings from ${company.name}!`;

    const cpnObj = coupons.find((c) => c.code === campaignCouponCode);
    const couponLine = cpnObj
      ? `\nUse code *${cpnObj.code}* for ${
          cpnObj.discountType === 'flat' ? `₹${cpnObj.discountValue} OFF` : `${cpnObj.discountValue}% OFF`
        } (Min order ₹${cpnObj.minOrderValue}).`
      : '';
    return `${baseTpl}\n${customCampaignNote}${couponLine}`.trim();
  };

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const res = saveBillingCoupon({
      code: cpnCode.trim().toUpperCase(),
      title: cpnTitle.trim() || `${cpnCode.trim().toUpperCase()} Offer`,
      description: cpnDesc.trim() || 'Store promotional discount coupon',
      discountType: cpnType,
      discountValue: Math.max(1, Number(cpnValue) || 10),
      maxDiscount: cpnType === 'percent' ? Math.max(0, Number(cpnMaxDisc) || 0) || undefined : undefined,
      minOrderValue: Math.max(0, Number(cpnMinOrder) || 0),
      expiryDate: cpnExpiry,
      usageLimitTotal: Math.max(1, Number(cpnLimitTotal) || 50),
      usageLimitPerCustomer: Math.max(1, Number(cpnLimitPerCust) || 1),
      isActive: true,
    });
    if (!res.success) {
      showToast(res.message, 'error');
      return;
    }
    setIsCouponModalOpen(false);
    setCpnCode('');
    setCpnTitle('');
    setCpnDesc('');
  };

  const handleCreateFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFollowUpCustomer.trim() || !newFollowUpTitle.trim()) {
      showToast('Select customer and enter follow-up title.', 'warning');
      return;
    }
    const matched = parties.find(
      (p) => p.name.toLowerCase() === newFollowUpCustomer.trim().toLowerCase()
    );
    addServiceReminder({
      category: 'Customer Follow-up',
      title: newFollowUpTitle.trim(),
      customerId: matched?.id,
      customerName: matched?.name || newFollowUpCustomer.trim(),
      customerPhone: matched?.phone || '',
      reminderDate: newFollowUpDate,
      repeatFrequency: 'None',
      message: customCampaignNote,
      priority: 'Medium',
      status: 'Upcoming',
    });
    setNewFollowUpTitle('');
    showToast('CRM follow-up scheduled in Service Reminders.', 'success');
  };

  const handleAddFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbCustomerName.trim() || !fbComment.trim()) {
      showToast('Enter customer name and feedback details.', 'warning');
      return;
    }
    const matched = parties.find(
      (p) => p.name.toLowerCase() === fbCustomerName.trim().toLowerCase()
    );
    const entry: FeedbackEntry = {
      id: `fb-${Date.now()}`,
      customerId: matched?.id,
      customerName: matched?.name || fbCustomerName.trim(),
      customerPhone: fbPhone.trim() || matched?.phone || '',
      rating: fbRating,
      category: fbCategory,
      comment: fbComment.trim(),
      status: 'Open',
      createdAt: new Date().toISOString(),
    };
    persistFeedback([entry, ...feedbackList]);
    setIsFbModalOpen(false);
    setFbCustomerName('');
    setFbPhone('');
    setFbComment('');
    setFbRating(5);
    showToast('Customer feedback logged.', 'success');
  };

  const handleResolveFeedback = (fb: FeedbackEntry) => {
    persistFeedback(
      feedbackList.map((row) =>
        row.id === fb.id
          ? {
              ...row,
              status: 'Resolved',
              resolutionNote: 'Addressed & closed by Store Team',
              resolvedAt: new Date().toISOString(),
            }
          : row
      )
    );
    showToast(`Marked feedback from ${fb.customerName} as resolved.`, 'success');
  };

  const handleDeleteFeedback = (fb: FeedbackEntry) => {
    requestConfirmation({
      title: 'Delete Feedback Entry?',
      message: `Remove feedback logged for "${fb.customerName}"?`,
      confirmLabel: 'Delete Entry',
      variant: 'danger',
      onConfirm: () => {
        persistFeedback(feedbackList.filter((r) => r.id !== fb.id));
        showToast('Feedback record deleted.', 'info');
      },
    });
  };

  const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-slate-950 flex flex-col overflow-hidden select-none text-xs text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-[#8E0E20] dark:text-rose-400" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              CRM, Loyalty &amp; Promotions Hub
            </h1>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            RFM customer segments, MS Loyalty Credits, POS promo coupons, WhatsApp campaigns &amp; feedback tracking
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, phone, code..."
              className="pl-8 pr-3 py-1.5 w-52 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:border-[#8E0E20]"
            />
          </div>
          {subTab === 'coupons' && (
            <button
              type="button"
              onClick={() => setIsCouponModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-[#8E0E20] hover:bg-[#740918] text-white font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Coupon</span>
            </button>
          )}
          {subTab === 'feedback' && (
            <button
              type="button"
              onClick={() => setIsFbModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-[#8E0E20] hover:bg-[#740918] text-white font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Feedback</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
        {[
          { id: 'segments', label: 'Customer Segments & Loyalty', icon: Users },
          { id: 'coupons', label: `Coupons & Offers (${coupons.length})`, icon: Ticket },
          { id: 'campaigns', label: 'Campaigns & Follow-Ups', icon: Megaphone },
          { id: 'feedback', label: `Feedback & Tickets (${feedbackList.filter((f) => f.status !== 'Resolved').length})`, icon: MessageSquareHeart },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id as CrmSubTab)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-slate-900 dark:bg-[#8E0E20] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* TAB 1: CUSTOMER SEGMENTS & LOYALTY */}
        {subTab === 'segments' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Active Customers</div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
                  {customerAnalytics.summary.total}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">VIP Buyers (₹25k+ / 5+ bills)</div>
                <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums mt-1">
                  {customerAnalytics.summary.vip}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">At-Risk Win-Back (&gt;45d)</div>
                <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 tabular-nums mt-1">
                  {customerAnalytics.summary.atRisk}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Loyalty Credits Balance</div>
                <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
                  {customerAnalytics.summary.totalCredits.toLocaleString('en-IN')} pts
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(['All', 'VIP', 'Wholesale', 'Regular', 'At-Risk'] as SegmentFilter[]).map((seg) => (
                  <button
                    key={seg}
                    type="button"
                    onClick={() => setSegmentFilter(seg)}
                    className={`px-3 py-1.5 rounded-lg border font-bold cursor-pointer whitespace-nowrap ${
                      segmentFilter === seg
                        ? 'bg-[#8E0E20] text-white border-[#8E0E20]'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {seg}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCampaignSegment(segmentFilter === 'All' ? 'At-Risk' : segmentFilter);
                  setSubTab('campaigns');
                }}
                className="px-3 py-1.5 rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>Launch Segment Campaign</span>
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Segment</th>
                    <th className="py-3 px-4 text-center">Bills</th>
                    <th className="py-3 px-4 text-right">Lifetime Spend</th>
                    <th className="py-3 px-4 text-right">Loyalty Credits</th>
                    <th className="py-3 px-4 text-right">Due Balance</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        No customers match this segment or search filter.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {c.phone || 'No phone'} {c.latestDateStr ? `• Last bill ${c.latestDateStr}` : '• No bills yet'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                              c.segment === 'VIP'
                                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : c.segment === 'Wholesale'
                                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                : c.segment === 'At-Risk'
                                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            }`}
                          >
                            {c.segment}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-semibold tabular-nums">{c.billCount}</td>
                        <td className="py-3 px-4 text-right font-bold tabular-nums">{fmt(c.totalSpent)}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {c.loyaltyCredits.toLocaleString('en-IN')} pts
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                          {fmt(c.balance || 0)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPartyId(c.id);
                              setActiveTab('customers');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:border-[#8E0E20] font-semibold cursor-pointer"
                          >
                            <span>Ledger</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: COUPONS & OFFERS */}
        {subTab === 'coupons' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {coupons
                .filter(
                  (c) =>
                    !search.trim() ||
                    c.code.toLowerCase().includes(search.toLowerCase()) ||
                    c.title.toLowerCase().includes(search.toLowerCase())
                )
                .map((c) => {
                  const pctUsed = Math.min(
                    100,
                    Math.round(((c.usedCount || 0) / Math.max(1, c.usageLimitTotal)) * 100)
                  );
                  return (
                    <div
                      key={c.id}
                      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-slate-900 dark:bg-slate-800 text-white font-mono font-bold text-xs tracking-wide">
                              {c.code}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-[10px]">
                              {c.discountType === 'flat' ? `₹${c.discountValue} OFF` : `${c.discountValue}% OFF`}
                            </span>
                          </div>
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-2">{c.title}</h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{c.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleBillingCouponStatus(c.id)}
                          className="text-slate-600 dark:text-slate-300 hover:text-[#8E0E20] cursor-pointer"
                          title={c.isActive ? 'Deactivate Coupon' : 'Activate Coupon'}
                        >
                          {c.isActive ? (
                            <ToggleRight className="w-6 h-6 text-emerald-600" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-slate-400" />
                          )}
                        </button>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                          <span>Min Order: ₹{c.minOrderValue}</span>
                          <span>Expires: {c.expiryDate}</span>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                            <span>Redemptions</span>
                            <span className="tabular-nums font-bold">
                              {c.usedCount} / {c.usageLimitTotal}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${pctUsed}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB 3: CAMPAIGNS & SERVICE FOLLOW-UPS */}
        {subTab === 'campaigns' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Broadcast & WhatsApp Composer */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#8E0E20]" />
                  <span>Segment Offer &amp; WhatsApp Share</span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Compose offers using your saved Transaction Message Templates and active promo codes
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Audience Segment</label>
                  <select
                    value={campaignSegment}
                    onChange={(e) => setCampaignSegment(e.target.value as SegmentFilter)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value="At-Risk">At-Risk Win-Back</option>
                    <option value="VIP">VIP Customers</option>
                    <option value="Wholesale">Wholesale</option>
                    <option value="Regular">Regular</option>
                    <option value="All">All Customers</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Message Template</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  >
                    {activeTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Attach Coupon</label>
                  <select
                    value={campaignCouponCode}
                    onChange={(e) => setCampaignCouponCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value="">No Coupon</option>
                    {coupons
                      .filter((c) => c.isActive)
                      .map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.code} ({c.discountType === 'flat' ? `₹${c.discountValue}` : `${c.discountValue}%`})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1">Custom Campaign Message</label>
                <textarea
                  rows={2}
                  value={customCampaignNote}
                  onChange={(e) => setCustomCampaignNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                {campaignTargets.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">No customers in this segment.</div>
                ) : (
                  campaignTargets.slice(0, 12).map((cust) => {
                    const msg = buildCampaignMessage(cust.name, cust.balance || 0);
                    const digits = (cust.phone || '').replace(/\D/g, '');
                    const phoneWithCc = digits.length === 10 ? `91${digits}` : digits;
                    const waUrl = phoneWithCc
                      ? `https://wa.me/${phoneWithCc}?text=${encodeURIComponent(msg)}`
                      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                    return (
                      <div key={cust.id} className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate">{cust.name}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {cust.phone || 'No Phone'} &bull; Spend {fmt(cust.totalSpent)}
                          </div>
                        </div>
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() =>
                            logPaymentReminderSent({
                              partyId: cust.id,
                              partyName: cust.name,
                              amountDue: cust.balance || 0,
                              channel: 'WhatsApp',
                              messagePreview: msg,
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shrink-0"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Send Offer</span>
                        </a>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Follow-up & Service Reminders Scheduler */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-blue-600" />
                  <span>Scheduled Customer Follow-Ups</span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Synced with Service &amp; Follow-up Reminders across Dashboard &amp; Alerts
                </p>
              </div>

              <form onSubmit={handleCreateFollowUp} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Customer name..."
                  value={newFollowUpCustomer}
                  onChange={(e) => setNewFollowUpCustomer(e.target.value)}
                  list="crm-cust-datalist"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
                <datalist id="crm-cust-datalist">
                  {customerAnalytics.rows.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
                <input
                  type="text"
                  placeholder="Follow-up topic (e.g. Monthly refill)"
                  value={newFollowUpTitle}
                  onChange={(e) => setNewFollowUpTitle(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
                <div className="flex gap-1.5">
                  <input
                    type="date"
                    value={newFollowUpDate}
                    onChange={(e) => setNewFollowUpDate(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-blue-600 text-white font-bold cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                </div>
              </form>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {serviceReminders.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">No follow-ups scheduled yet.</div>
                ) : (
                  serviceReminders.map((sr) => (
                    <div
                      key={sr.id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">{sr.title}</div>
                        <div className="text-[11px] text-slate-500">
                          {sr.customerName} &bull; {sr.reminderDate} &bull; {sr.status}
                        </div>
                      </div>
                      {sr.status !== 'Completed' && (
                        <button
                          type="button"
                          onClick={() => updateServiceReminder(sr.id, { status: 'Completed' })}
                          className="px-2.5 py-1 rounded border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Done</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: FEEDBACK & COMPLAINTS */}
        {subTab === 'feedback' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {(['All', 'Open', 'Resolved'] as const).map((statusOpt) => (
                <button
                  key={statusOpt}
                  type="button"
                  onClick={() => setFbFilter(statusOpt)}
                  className={`px-3 py-1.5 rounded-lg border font-bold cursor-pointer ${
                    fbFilter === statusOpt
                      ? 'bg-slate-900 dark:bg-[#8E0E20] text-white border-transparent'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {statusOpt}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {feedbackList
                .filter((f) =>
                  fbFilter === 'All'
                    ? true
                    : fbFilter === 'Resolved'
                    ? f.status === 'Resolved'
                    : f.status !== 'Resolved'
                )
                .map((fb) => (
                  <div
                    key={fb.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">{fb.customerName}</div>
                        <div className="text-[11px] text-slate-500">
                          {fb.category} &bull; {fb.customerPhone || 'Walk-in'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500">
                        {Array.from({ length: fb.rating }).map((_, idx) => (
                          <Star key={idx} className="w-3.5 h-3.5 fill-current" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{fb.comment}</p>
                    {fb.resolutionNote && (
                      <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[11px]">
                        Resolution: {fb.resolutionNote}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          fb.status === 'Resolved'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {fb.status}
                      </span>
                      <div className="flex items-center gap-2">
                        {fb.status !== 'Resolved' && (
                          <button
                            type="button"
                            onClick={() => handleResolveFeedback(fb)}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                          >
                            Mark Resolved
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteFeedback(fb)}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Delete Feedback"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create Coupon */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Create Promo Coupon</h3>
              <button
                type="button"
                onClick={() => setIsCouponModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCoupon} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Coupon Code *</label>
                  <input
                    type="text"
                    required
                    value={cpnCode}
                    onChange={(e) => setCpnCode(e.target.value.toUpperCase())}
                    placeholder="KIRANA10"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={cpnTitle}
                    onChange={(e) => setCpnTitle(e.target.value)}
                    placeholder="Festival Saver"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Description</label>
                <input
                  type="text"
                  value={cpnDesc}
                  onChange={(e) => setCpnDesc(e.target.value)}
                  placeholder="Valid on counter & online grocery bills"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Type</label>
                  <select
                    value={cpnType}
                    onChange={(e) => setCpnType(e.target.value as 'percent' | 'flat')}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="percent">% Off</option>
                    <option value="flat">Flat ₹</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Value</label>
                  <input
                    type="number"
                    min={1}
                    value={cpnValue}
                    onChange={(e) => setCpnValue(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Max Disc (₹)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={cpnType === 'flat'}
                    value={cpnMaxDisc}
                    onChange={(e) => setCpnMaxDisc(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums disabled:opacity-50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Min Order (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={cpnMinOrder}
                    onChange={(e) => setCpnMinOrder(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Total Limit</label>
                  <input
                    type="number"
                    min={1}
                    value={cpnLimitTotal}
                    onChange={(e) => setCpnLimitTotal(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={cpnExpiry}
                    onChange={(e) => setCpnExpiry(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCouponModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#8E0E20] hover:bg-[#740918] text-white font-bold cursor-pointer"
                >
                  Save Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Log Feedback */}
      {isFbModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Log Customer Feedback / Complaint</h3>
              <button
                type="button"
                onClick={() => setIsFbModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddFeedback} className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={fbCustomerName}
                  onChange={(e) => setFbCustomerName(e.target.value)}
                  list="crm-cust-datalist-modal"
                  placeholder="Enter or pick customer..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
                <datalist id="crm-cust-datalist-modal">
                  {customerAnalytics.rows.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Category</label>
                  <select
                    value={fbCategory}
                    onChange={(e) => setFbCategory(e.target.value as FeedbackEntry['category'])}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="Product Quality">Product Quality</option>
                    <option value="Billing & Speed">Billing &amp; Speed</option>
                    <option value="Delivery">Delivery</option>
                    <option value="Pricing">Pricing</option>
                    <option value="Customer Service">Customer Service</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Rating (1–5)</label>
                  <select
                    value={fbRating}
                    onChange={(e) => setFbRating(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} Star{n > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Phone (optional)</label>
                <input
                  type="text"
                  value={fbPhone}
                  onChange={(e) => setFbPhone(e.target.value)}
                  placeholder="98..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Details / Notes *</label>
                <textarea
                  rows={3}
                  required
                  value={fbComment}
                  onChange={(e) => setFbComment(e.target.value)}
                  placeholder="Describe feedback or complaint..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFbModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#8E0E20] hover:bg-[#740918] text-white font-bold cursor-pointer"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
