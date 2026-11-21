import React, { useState } from 'react';
import {
  TrendingUp,
  Award,
  Users,
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  Building2,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { EstimateQuotationView } from '../EstimateQuotationView';
import { SaleOrderView } from '../SaleOrderView';

export const SalesWorkspace: React.FC = () => {
  const { parties, transactions, setIsAddSaleOpen, showToast } = useVyapar();

  const [activeTab, setActiveTab] = useState<'quotations' | 'orders' | 'customers'>('quotations');

  const customerList = parties.filter((p) => p.type === 'Customer');
  const mySalesTotal = transactions
    .filter((t) => !t.isCancelled)
    .reduce((sum, t) => sum + t.totalAmount, 0);

  const monthlyTarget = 500000;
  const progressPercent = Math.min(100, Math.round((mySalesTotal / monthlyTarget) * 100));
  const commissionEarned = Math.round(mySalesTotal * 0.025); // 2.5% incentive

  return (
    <div className="flex-1 flex flex-col bg-[#f0f4f9] overflow-hidden select-none text-xs text-slate-800">
      {/* 1. Header & KPI Strip */}
      <div className="bg-white p-5 border-b border-slate-200 shrink-0 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
              <TrendingUp className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Sales Executive Workstation
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Sneha Patel (Sales)
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Client quotations, pipeline orders, customer accounts, and performance targets
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAddSaleOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Sale Quotation / Order</span>
          </button>
        </div>

        {/* Sales Performance Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500">Monthly Sales Target</span>
            <div className="flex items-baseline justify-between">
              <span className="text-base font-bold text-slate-900">₹ {mySalesTotal.toLocaleString('en-IN')}</span>
              <span className="text-[11px] text-slate-400 font-medium">/ ₹ 5,00,000 Target</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden mt-1">
              <div className="bg-emerald-600 h-1.5 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500">Commission Earned (2.5%)</span>
            <div className="text-base font-bold text-emerald-700">₹ {commissionEarned.toLocaleString('en-IN')}</div>
            <span className="text-[10px] text-slate-400">Direct incentive on closed invoices</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500">Assigned Client Accounts</span>
            <div className="text-base font-bold text-slate-900">{customerList.length} Customers</div>
            <span className="text-[10px] text-blue-600 font-medium">Within Bengaluru Region</span>
          </div>
        </div>
      </div>

      {/* 2. Sub-tab navigation */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-6 shrink-0 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('quotations')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'quotations' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-500'
          }`}
        >
          Quotations &amp; Estimates
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'orders' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-500'
          }`}
        >
          Sales Orders
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'customers' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-500'
          }`}
        >
          Assigned Customers &amp; CRM ({customerList.length})
        </button>
      </div>

      {/* 3. Tab contents */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'quotations' && <EstimateQuotationView type="Estimate/Quotation" />}
        {activeTab === 'orders' && <SaleOrderView />}
        {activeTab === 'customers' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customerList.map((c) => (
                <div key={c.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-xs text-slate-900">{c.name}</h3>
                      <span className="text-[10px] text-slate-400 font-mono">GSTIN: {c.gstin || 'Unregistered'}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Active Client
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{c.phone || '+91 9845012345'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span className="truncate">{c.address || 'Bengaluru'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Credit Limit:</span>
                    <strong className="text-slate-800 font-bold">₹ {c.creditLimit?.toLocaleString('en-IN') || '50,000'}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
