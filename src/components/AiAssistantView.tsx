import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  Send,
  AlertTriangle,
  Package,
  TrendingUp,
  Users,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  X,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { apiClient } from '../utils/apiClient';
import { AiAssistantProposedAction } from '../types';
import { calculateRealProfitSummary, parseAnyDate } from '../utils/erpEngine';
import {
  answerAiProfitQuestion,
  computeComprehensivePL,
} from '../utils/profitEngine';

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text: string;
  highlights?: Array<{ label: string; value: string }>;
  proposedAction?: AiAssistantProposedAction | null;
  actionExecuted?: boolean;
}

const QUICK_PROMPTS = [
  "What are today's total sales and profit?",
  'Which products are making loss?',
  'How much capital is stuck in dead stock?',
  "What is today's net profit?",
  'Forecast next 30 days sales and profit',
  'How did discounts affect profit?',
  'Which items are low in stock and need reordering?',
  'Who are my top 5 customers with pending udhaar?',
  'How much total GST did I collect this month?',
  'Which products give me the highest profit margin?',
];

export const AiAssistantView: React.FC = () => {
  const {
    items,
    transactions,
    parties,
    batches,
    journalVouchers,
    discountApprovals,
    businessSettings,
    currentUser,
    hasModulePermission,
    executeConfirmedAiAction,
    showToast,
  } = useVyapar();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [pendingActionModal, setPendingActionModal] = useState<{
    messageId?: string;
    action: AiAssistantProposedAction;
  } | null>(null);

  const canViewFinance =
    ['owner', 'admin', 'manager', 'accountant'].includes(
      (currentUser?.roleName || '').toLowerCase()
    ) || hasModulePermission('reports', 'view');

  const plReport = useMemo(
    () =>
      computeComprehensivePL({
        transactions,
        items,
        parties,
        batches,
        journalVouchers,
        discountApprovals,
        settings: businessSettings,
        period: 'All Time',
      }),
    [transactions, items, parties, batches, journalVouchers, discountApprovals, businessSettings]
  );

  // Grounded Live Database Snapshot & Deterministic Insight Cards
  const liveInsights = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-GB');
    const activeSales = transactions.filter((t) => t.type === 'Sale' && !t.isCancelled);
    const activeExpenses = transactions.filter(
      (t) => t.type === 'Expense' && !t.isCancelled && !t.invoiceNo.startsWith('DN-')
    );

    const todaySales = activeSales
      .filter((t) => t.date.startsWith(todayStr))
      .reduce((s, t) => s + (t.totalAmount || 0), 0);

    const profitSummary = calculateRealProfitSummary(transactions, items);

    // 30-day velocity
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);
    const recentSoldQty = new Map<string, number>();
    activeSales.forEach((tx) => {
      const dt = parseAnyDate(tx.date);
      if (dt && dt >= cutoff30) {
        (tx.items || []).forEach((l) => {
          const k = l.name.trim().toLowerCase();
          recentSoldQty.set(k, (recentSoldQty.get(k) || 0) + (l.qty || 1));
        });
      }
    });

    const reorderItems = items
      .filter((it) => (it.stock || 0) <= (it.minStockAlert ?? 5))
      .map((it) => ({
        item: it,
        recentQty: recentSoldQty.get(it.name.trim().toLowerCase()) || 0,
      }))
      .sort((a, b) => b.recentQty - a.recentQty);

    const deadStockItems = items.filter(
      (it) => (it.stock || 0) > 0 && !recentSoldQty.has(it.name.trim().toLowerCase())
    );

    const topUdhaar = parties
      .filter((p) => (p.type === 'Customer' || !p.type) && (p.balance || 0) > 0)
      .sort((a, b) => (b.balance || 0) - (a.balance || 0))
      .slice(0, 5);

    // Monthly comparison
    const now = new Date();
    const thisMonthIdx = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonthDate = new Date(thisYear, thisMonthIdx - 1, 1);

    let thisMonthExp = 0;
    let lastMonthExp = 0;
    let thisMonthSales = 0;
    let lastMonthSales = 0;
    let thisMonthGst = 0;

    activeSales.forEach((tx) => {
      const dt = parseAnyDate(tx.date);
      if (!dt) return;
      if (dt.getMonth() === thisMonthIdx && dt.getFullYear() === thisYear) {
        thisMonthSales += tx.totalAmount || 0;
        thisMonthGst += (tx.cgstAmount || 0) + (tx.sgstAmount || 0) + (tx.igstAmount || 0);
      } else if (
        dt.getMonth() === lastMonthDate.getMonth() &&
        dt.getFullYear() === lastMonthDate.getFullYear()
      ) {
        lastMonthSales += tx.totalAmount || 0;
      }
    });

    activeExpenses.forEach((tx) => {
      const dt = parseAnyDate(tx.date);
      if (!dt) return;
      if (dt.getMonth() === thisMonthIdx && dt.getFullYear() === thisYear) {
        thisMonthExp += tx.totalAmount || 0;
      } else if (
        dt.getMonth() === lastMonthDate.getMonth() &&
        dt.getFullYear() === lastMonthDate.getFullYear()
      ) {
        lastMonthExp += tx.totalAmount || 0;
      }
    });

    const expAnomalyPct =
      lastMonthExp > 0 ? Math.round(((thisMonthExp - lastMonthExp) / lastMonthExp) * 100) : 0;

    return {
      todayStr,
      todaySales,
      profitSummary,
      reorderItems,
      deadStockItems,
      topUdhaar,
      thisMonthExp,
      lastMonthExp,
      thisMonthSales,
      lastMonthSales,
      thisMonthGst,
      expAnomalyPct,
    };
  }, [items, transactions, parties]);

  // Compact grounded context snapshot sent to /api/ai/assistant
  const contextSnapshot = useMemo(() => {
    return {
      todayDate: liveInsights.todayStr,
      currency: 'INR',
      costingMethodUsed: plReport.costingMethodUsed,
      dataCoverage: plReport.dateCoverageLabel,
      totals: {
        totalItems: items.length,
        todaySales: Math.round(liveInsights.todaySales),
        thisMonthSales: Math.round(liveInsights.thisMonthSales),
        lastMonthSales: Math.round(liveInsights.lastMonthSales),
        thisMonthGstCollected: Math.round(liveInsights.thisMonthGst),
      },
      profitSummary: canViewFinance
        ? {
            netSalesExGst: plReport.tradingAndPL.netSalesExGst,
            cogs: plReport.tradingAndPL.cogs,
            grossProfit: plReport.tradingAndPL.grossProfit,
            grossMarginPercent: plReport.tradingAndPL.grossMarginPercent,
            netProfit: plReport.tradingAndPL.netProfit,
            netMarginPercent: plReport.tradingAndPL.netMarginPercent,
            totalExpenses: plReport.tradingAndPL.indirectExpensesTotal,
          }
        : undefined,
      lossMakingProducts: canViewFinance
        ? plReport.productRows
            .filter((p) => p.isLossMaking)
            .slice(0, 10)
            .map((p) => ({
              name: p.name,
              netSalesExGst: p.netSalesExGst,
              cogs: p.cogs,
              grossProfit: p.grossProfit,
            }))
        : undefined,
      discountAnalysis: canViewFinance ? plReport.discountAnalysis : undefined,
      deadStockSummary: {
        totalCapitalBlocked: plReport.deadStockAnalysis.totalCapitalBlocked,
        count30Days: plReport.deadStockAnalysis.count30Days,
        count60Days: plReport.deadStockAnalysis.count60Days,
        count90Days: plReport.deadStockAnalysis.count90Days,
      },
      priceRecommendationsSummary: canViewFinance
        ? plReport.priceRecommendations
            .filter((r) => r.status !== 'Healthy')
            .slice(0, 10)
            .map((r) => ({
              name: r.name,
              currentSalePrice: r.currentSalePrice,
              recommendedSalePrice: r.recommendedSalePrice,
              status: r.status,
            }))
        : undefined,
      salesForecast: plReport.salesForecast,
      businessHealthScore: canViewFinance ? plReport.businessHealth : undefined,
      expensesSummary: canViewFinance
        ? {
            thisMonthExpenses: Math.round(liveInsights.thisMonthExp),
            lastMonthExpenses: Math.round(liveInsights.lastMonthExp),
            changePercent: liveInsights.expAnomalyPct,
          }
        : undefined,
      lowStockItems: liveInsights.reorderItems.slice(0, 15).map(({ item, recentQty }) => ({
        id: item.id,
        name: item.name,
        stock: item.stock,
        minStockAlert: item.minStockAlert ?? 5,
        purchasePrice: item.purchasePrice,
        salePrice: item.salePrice,
        lastSupplier: item.lastPurchaseSupplier || '',
        soldLast30Days: recentQty,
      })),
      deadStockItems: liveInsights.deadStockItems.slice(0, 15).map((it) => ({
        id: it.id,
        name: it.name,
        stock: it.stock,
        stockValue: Math.round(it.stock * (it.purchasePrice || it.salePrice || 0)),
      })),
      topPendingUdhaarCustomers: liveInsights.topUdhaar.map((p) => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        pendingAmount: p.balance,
      })),
      highMarginProducts: items
        .filter((it) => (it.salePrice || 0) > 0)
        .map((it) => {
          const cost = it.purchasePrice || it.salePrice * 0.78;
          const marginPct = ((it.salePrice - cost) / it.salePrice) * 100;
          return {
            id: it.id,
            name: it.name,
            salePrice: it.salePrice,
            purchasePrice: cost,
            marginPercent: Number(marginPct.toFixed(1)),
          };
        })
        .sort((a, b) => b.marginPercent - a.marginPercent)
        .slice(0, 10),
      expiringBatchesCount: batches.length,
    };
  }, [liveInsights, items, batches.length, canViewFinance, plReport]);

  const sendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatEntry = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const historyPayload = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-6)
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          text: m.text,
        }));

      const res = await apiClient.askAiAssistant({
        message: trimmed,
        history: historyPayload,
        contextSnapshot,
      });

      const assistantMsg: ChatEntry = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: res.answer,
        highlights: res.highlights || [],
        proposedAction:
          res.proposedAction && res.proposedAction.actionType !== 'NONE'
            ? res.proposedAction
            : null,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const localRes = answerAiProfitQuestion({
        query: trimmed,
        report: plReport,
        items,
        parties,
        canViewFinance,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `a-local-${Date.now()}`,
          role: 'assistant',
          text: `${localRes.answer}\n\n(Computed directly from live Business Manager 360 database.)`,
          highlights: localRes.highlights,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmProposedAction = () => {
    if (!pendingActionModal) return;
    const { messageId, action } = pendingActionModal;
    const result = executeConfirmedAiAction(action);
    if (result.success) {
      if (messageId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, actionExecuted: true } : m))
        );
      }
      setPendingActionModal(null);
    } else {
      showToast(result.message, 'error');
    }
  };

  const firstReorder = liveInsights.reorderItems[0]?.item;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#8B0D1E]" />
            <span>AI Business Assistant</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Grounded strictly on live store records · {plReport.dateCoverageLabel} · Costing: {plReport.costingMethodUsed}
          </p>
        </div>
      </div>

      {/* Grounded Live Insights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900/60 p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
            <span>Reorder Suggestions</span>
            <Package className="w-4 h-4" />
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
            {liveInsights.reorderItems.length} Low-Stock SKUs
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {firstReorder
              ? `Top priority: ${firstReorder.name} (${firstReorder.stock} ${firstReorder.unit} left)`
              : 'All products are above minimum threshold.'}
          </p>
          {firstReorder && (
            <button
              type="button"
              onClick={() =>
                setPendingActionModal({
                  action: {
                    actionType: 'CREATE_PURCHASE_ORDER',
                    title: `Draft PO for ${firstReorder.name}`,
                    description: `Create Purchase Order for ${(firstReorder.minStockAlert ?? 5) * 3} ${firstReorder.unit} of ${firstReorder.name}.`,
                    itemId: firstReorder.id,
                    itemName: firstReorder.name,
                    supplierName: firstReorder.lastPurchaseSupplier || 'Wholesale Supplier',
                    qty: Math.max(10, (firstReorder.minStockAlert ?? 5) * 3),
                    unitPrice: firstReorder.purchasePrice || Math.round(firstReorder.salePrice * 0.78),
                  },
                })
              }
              className="px-3 py-1.5 rounded-lg bg-[#8B0D1E] text-white text-[11px] font-bold cursor-pointer"
            >
              Draft Purchase Order
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
            <span>Dead / Non-Selling (30d)</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
            {liveInsights.deadStockItems.length} Items
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {liveInsights.deadStockItems.length > 0
              ? liveInsights.deadStockItems
                  .slice(0, 2)
                  .map((i) => i.name)
                  .join(', ')
              : 'Every stocked item had movement in 30 days.'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-rose-600">
            <span>Top Pending Udhaar</span>
            <Users className="w-4 h-4" />
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
            {liveInsights.topUdhaar[0]
              ? `₹${liveInsights.topUdhaar[0].balance.toLocaleString('en-IN')}`
              : '₹0'}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {liveInsights.topUdhaar[0]
              ? `${liveInsights.topUdhaar[0].name} (+${Math.max(0, liveInsights.topUdhaar.length - 1)} others)`
              : 'No pending customer Udhaar'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-blue-600">
            <span>This Month vs Last Month</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
            ₹{Math.round(liveInsights.thisMonthSales).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {canViewFinance
              ? `Expenses: ₹${Math.round(liveInsights.thisMonthExp).toLocaleString('en-IN')} (${
                  liveInsights.expAnomalyPct >= 0 ? '+' : ''
                }${liveInsights.expAnomalyPct}% MoM)`
              : `Last Month Sales: ₹${Math.round(liveInsights.lastMonthSales).toLocaleString('en-IN')}`}
          </p>
        </div>
      </div>

      {/* Chat Workspace */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col min-h-[420px]">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void sendPrompt(q)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[420px]">
          {messages.length === 0 ? (
            <div className="py-12 text-center space-y-2 text-xs text-slate-400">
              <Sparkles className="w-8 h-8 text-[#8B0D1E] mx-auto opacity-80" />
              <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                Ask anything about your store&apos;s live sales, stock, Udhaar, GST, or profit
              </div>
              <p className="max-w-md mx-auto">
                Click any quick question above or type your own question below. All figures come directly from your authorized Business Manager 360 database.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-2xl rounded-xl p-3.5 text-xs space-y-2.5 ${
                    msg.role === 'user'
                      ? 'bg-[#8B0D1E] text-white'
                      : msg.role === 'error'
                      ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>

                  {msg.highlights && msg.highlights.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                      {msg.highlights.map((h, i) => (
                        <div
                          key={`${h.label}-${i}`}
                          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        >
                          <div className="text-[10px] text-slate-400">{h.label}</div>
                          <div className="font-extrabold text-slate-900 dark:text-white tabular-nums">
                            {h.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.proposedAction && (
                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                        <ShieldAlert className="w-4 h-4" />
                        <span>Proposed Store Action: {msg.proposedAction.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        {msg.proposedAction.description}
                      </p>
                      {msg.actionExecuted ? (
                        <div className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Action executed &amp; saved</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingActionModal({
                              messageId: msg.id,
                              action: msg.proposedAction!,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-[#8B0D1E] text-white font-bold cursor-pointer"
                        >
                          Review &amp; Confirm Action
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#8B0D1E]" />
              <span>Analyzing live store records with Gemini...</span>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendPrompt(input);
          }}
          className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2 bg-slate-50 dark:bg-slate-900/60"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about sales, low-stock items, Udhaar, GST, or profit..."
            className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:border-[#8B0D1E]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ask AI</span>
          </button>
        </form>
      </div>

      {/* Explicit Confirmation Modal Before Executing Any Mutating AI Action */}
      {pendingActionModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4"
          onClick={() => setPendingActionModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-5 space-y-4 shadow-2xl text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Confirm Database Action</span>
              </h3>
              <button
                type="button"
                onClick={() => setPendingActionModal(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white">
                {pendingActionModal.action.title}
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                {pendingActionModal.action.description}
              </p>
              {pendingActionModal.action.itemName && (
                <div>
                  Item: <strong>{pendingActionModal.action.itemName}</strong>
                </div>
              )}
              {pendingActionModal.action.qty && (
                <div>
                  Quantity: <strong className="tabular-nums">{pendingActionModal.action.qty}</strong>
                </div>
              )}
              {pendingActionModal.action.newMinStock !== undefined && (
                <div>
                  New Min Stock:{' '}
                  <strong className="tabular-nums">{pendingActionModal.action.newMinStock}</strong>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingActionModal(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmProposedAction}
                className="px-4 py-2 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white font-bold cursor-pointer"
              >
                Confirm &amp; Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
