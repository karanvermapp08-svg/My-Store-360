import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Globe,
  Plus,
  FileDown
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';

export const HomeView: React.FC = () => {
  const {
    totalSalesAmount,
    totalBalanceAmount,
    setActiveTab,
    setActiveSaleSubtype,
    setIsPremiumModalOpen,
    setIsAddSaleOpen,
    setIsAddPurchaseOpen,
    exportCurrentViewPdf,
    showToast,
  } = useVyapar();

  const [period, setPeriod] = useState('This Month');
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);

  const dates = ['1 Oct', '4 Oct', '7 Oct', '10 Oct', '13 Oct', '16 Oct', '19 Oct', '22 Oct', '25 Oct', '28 Oct', '31 Oct'];

  return (
    <div className="flex-1 bg-[#f0f4f9] flex flex-col overflow-y-auto select-none text-xs text-slate-800">
      {/* 1. Pink Expiry Warning Banner from Screenshot 642 */}
      <div className="bg-[#fff1f2] border-b border-[#fecdd3] px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 text-slate-800">
          <div className="w-5 h-5 rounded-full border border-rose-400 flex items-center justify-center text-rose-600 bg-white">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs font-medium text-slate-900">
            <strong className="font-semibold text-slate-950">Your Free Plan has expired.</strong>{' '}
            To continue using Vyapar, upgrade to our Premium Plan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPremiumModalOpen(true)}
            className="px-4 py-1.5 rounded-md bg-[#e11d48] hover:bg-[#be123c] text-white font-semibold text-xs shadow-2xs transition-colors"
          >
            Buy Now
          </button>
          <button
            onClick={() => showToast('Free 1-on-1 demo booked. Our specialist will call you.')}
            className="px-4 py-1.5 rounded-md bg-white border border-[#fda4af] hover:bg-rose-50 text-[#e11d48] font-semibold text-xs transition-colors"
          >
            Get Free Demo
          </button>
        </div>
      </div>

      {/* 2. Main Dashboard Grid */}
      <div className="p-6 flex-1 flex flex-col lg:flex-row gap-6">
        {/* Left Column: Receivables, Payables, Chart, Reports */}
        <div className="flex-1 space-y-5">
          {/* Top Row: Total Receivable & Total Payable */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Total Receivable */}
            <div
              onClick={() => {
                setActiveTab('parties');
                showToast('Viewing receivables');
              }}
              className="bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs hover:border-slate-300 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs text-[#64748b] font-medium block">Total Receivable</span>
                  <div className="text-2xl font-bold text-[#0f172a] mt-1 tabular-nums">
                    ₹ 1,000
                  </div>
                </div>
                {/* Green circular down button */}
                <div className="w-9 h-9 rounded-full bg-[#dcfce7] text-[#16a34a] flex items-center justify-center">
                  <ArrowDown className="w-4 h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="mt-3 text-xs text-[#64748b]">
                From <strong className="font-semibold text-[#0f172a]">1 Party</strong>
              </div>
            </div>

            {/* Total Payable */}
            <div
              onClick={() => {
                setActiveTab('purchase');
                showToast('Viewing payables');
              }}
              className="bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs hover:border-slate-300 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs text-[#64748b] font-medium block">Total Payable</span>
                  <div className="text-2xl font-bold text-[#0f172a] mt-1 tabular-nums">
                    ₹ 0
                  </div>
                </div>
                {/* Light pink circular up button */}
                <div className="w-9 h-9 rounded-full bg-[#ffe4e6] text-[#f43f5e] flex items-center justify-center">
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="mt-3 text-xs text-[#64748b]">
                You don&apos;t have any payables as of now.
              </div>
            </div>
          </div>

          {/* Total Sale Line Chart Card */}
          <div className="bg-white rounded-lg border border-[#e2e8f0] p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-[#64748b] font-medium block">Total Sale</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl font-bold text-[#0f172a] tabular-nums">
                    ₹ {totalSalesAmount.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs font-semibold text-[#f43f5e]">
                    100% less than last month
                  </span>
                </div>
              </div>

              {/* This Month Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsPeriodOpen(!isPeriodOpen)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#cbd5e1] hover:border-[#94a3b8] bg-white text-xs font-medium text-[#334155]"
                >
                  <span>{period}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#64748b]" />
                </button>
                {isPeriodOpen && (
                  <div className="absolute right-0 top-8 w-32 bg-white border border-[#e2e8f0] rounded-lg shadow-md py-1 z-30 text-xs">
                    {['Today', 'This Week', 'This Month', 'Last Month', 'This Year'].map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          setPeriod(p);
                          setIsPeriodOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#f8fafc]"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Custom SVG Line Chart matching Screenshot 642 */}
            <div className="pt-2">
              <div className="h-44 w-full relative flex flex-col justify-between text-[11px] text-[#94a3b8] border-b border-[#e2e8f0]">
                {/* Horizontal grid lines */}
                {[1, 0.8, 0.6, 0.4, 0.2, 0].map((val) => (
                  <div key={val} className="w-full flex items-center gap-2">
                    <span className="w-5 text-right font-mono">{val}</span>
                    <div className="flex-1 border-b border-[#f1f5f9]" />
                  </div>
                ))}

                {/* Flat blue line at 0 on baseline */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none pl-7 pb-2"
                  preserveAspectRatio="none"
                >
                  <polyline
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    points="0,158 50,158 120,158 200,158 300,158 400,158 500,158 650,158 800,158"
                  />
                </svg>
              </div>

              {/* X-axis date labels */}
              <div className="flex justify-between text-[10px] text-[#94a3b8] pl-7 pt-2 font-mono">
                {dates.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Most Used Reports */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#0f172a]">Most Used Reports</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportCurrentViewPdf()}
                  title="Export Financial Executive Overview as PDF Document"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-semibold text-xs transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Export Financial PDF</span>
                </button>
                <button
                  onClick={() => showToast('Opening all 40+ Business Reports')}
                  className="text-xs text-[#0284c7] hover:underline font-semibold"
                >
                  View All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { title: 'Sale Report', tab: 'sale-invoices' },
                { title: 'All Transactions', tab: 'sale-invoices' },
                { title: 'Daybook Report', tab: 'sale-invoices' },
                { title: 'Party Statement', tab: 'parties' },
              ].map((rep, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setActiveTab(rep.tab);
                    showToast(`Opened ${rep.title}`);
                  }}
                  className="bg-white p-3.5 rounded-lg border border-[#e2e8f0] hover:border-[#cbd5e1] hover:shadow-2xs flex items-center justify-between cursor-pointer transition-all"
                >
                  <span className="font-semibold text-xs text-[#1e293b]">{rep.title}</span>
                  <ChevronRight className="w-4 h-4 text-[#0284c7]" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Add-ons & Widgets from Screenshot 642 */}
        <div className="w-full lg:w-76 space-y-4 shrink-0">
          {/* Card 1: WhatsApp Connect */}
          <div className="bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-[#0f172a]">
                <span className="text-[#10b981]">
                  <MessageCircle className="w-4 h-4 fill-emerald-500 text-white" />
                </span>
                <span>WhatsApp Connect</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ffe4e6] text-[#e11d48]">
                TRIAL EXPIRED
              </span>
            </div>

            <p className="text-xs text-[#64748b] leading-relaxed">
              👑 Purchase your license to continue sending invoices, reminders, and using WhatsApp Smart Connect.
            </p>

            <button
              onClick={() => setIsPremiumModalOpen(true)}
              className="text-xs text-[#0284c7] hover:underline font-bold flex items-center gap-1 pt-1"
            >
              <span>Buy Now</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 2: Google Profile Manager */}
          <div className="bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-[#0f172a]">
                <span className="text-[#ea4335] font-bold text-sm">G</span>
                <span>Google Profile Manager</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ffe4e6] text-[#e11d48]">
                TRIAL EXPIRED
              </span>
            </div>

            <p className="text-xs text-[#64748b] leading-relaxed">
              👑 Reply to negative reviews professionally to build trust
            </p>

            <button
              onClick={() => setIsPremiumModalOpen(true)}
              className="text-xs text-[#0284c7] hover:underline font-bold flex items-center gap-1 pt-1"
            >
              <span>Buy Now</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 3: Add Widget of Your Choice */}
          <div
            onClick={() => showToast('Select widgets: Top Customers, Expense Tracker, Cash Flow')}
            className="border-2 border-dashed border-[#cbd5e1] rounded-lg p-5 flex items-center justify-between text-[#64748b] hover:text-[#0f172a] hover:border-slate-400 cursor-pointer transition-colors"
          >
            <span className="text-xs font-medium">Add Widget of Your Choice</span>
            <Plus className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};
