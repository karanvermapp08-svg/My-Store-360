import React, { useState } from 'react';
import {
  ShoppingCart,
  Truck,
  Building2,
  FileCheck,
  Plus,
  Search,
  DollarSign,
  Calendar,
  AlertTriangle,
  FileDown,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { PurchaseView } from '../PurchaseView';

export const PurchaseWorkspace: React.FC = () => {
  const { parties, items, setIsAddPurchaseOpen, exportCurrentViewPdf, showToast } = useVyapar();

  const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers' | 'grn'>('purchases');

  const suppliers = parties.filter((p) => p.type === 'Supplier');
  const lowStockItems = items.filter((i) => i.stock <= (i.minStockAlert || 10));

  return (
    <div className="flex-1 flex flex-col bg-[#f0f4f9] overflow-hidden select-none text-xs text-slate-800">
      {/* 1. Header */}
      <div className="bg-white p-5 border-b border-slate-200 shrink-0 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 text-orange-700 rounded-xl border border-orange-200">
              <Truck className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Purchase &amp; Procurement Workstation
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
                  Manoj Kumar (Purchase)
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Vendor management, purchase orders, material receiving (GRN), and supplier invoicing
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAddPurchaseOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-2xs transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create Purchase Order / Bill</span>
          </button>
        </div>

        {/* Quick Procurement Alerts */}
        {lowStockItems.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>{lowStockItems.length} Products</strong> have dropped below reorder threshold. Generate purchase orders promptly.
              </span>
            </div>
            <button
              onClick={() => showToast('Opening Reorder Planning')}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg shadow-2xs"
            >
              Quick Reorder
            </button>
          </div>
        )}
      </div>

      {/* 2. Sub-tab navigation */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-6 shrink-0 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('purchases')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'purchases' ? 'border-orange-600 text-orange-700 font-bold' : 'border-transparent text-slate-500'
          }`}
        >
          Purchase Bills &amp; Inward Register
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'suppliers' ? 'border-orange-600 text-orange-700 font-bold' : 'border-transparent text-slate-500'
          }`}
        >
          Suppliers Directory ({suppliers.length})
        </button>

        <button
          onClick={() => setActiveTab('grn')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'grn' ? 'border-orange-600 text-orange-700 font-bold' : 'border-transparent text-slate-500'
          }`}
        >
          Goods Receipt Notes (GRN)
        </button>
      </div>

      {/* 3. Tab contents */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'purchases' && <PurchaseView />}

        {activeTab === 'suppliers' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suppliers.map((s) => (
                <div key={s.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-xs text-slate-900">{s.name}</h3>
                      <span className="text-[10px] text-slate-400 font-mono">GSTIN: {s.gstin || '29XYZAB8899C1Z9'}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200">
                      Authorized Vendor
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600">{s.address || 'Peenya Industrial Area, Bengaluru'}</p>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Current Payable:</span>
                    <strong className="text-rose-600 font-bold">₹ {s.balance?.toLocaleString('en-IN') || '35,000'}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'grn' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <h3 className="font-bold text-xs text-slate-900">Goods Receipt Verification (GRN)</h3>
              <p className="text-[11px] text-slate-500">
                Matches physical material inward quantities against PO lines before accounting approval.
              </p>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-xs">GRN #9021 - TechFlow Distributors</div>
                  <div className="text-[11px] text-slate-500">60 thermal rolls received &amp; inspected at Central Warehouse</div>
                </div>
                <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">
                  Verified &amp; Inwarded
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
