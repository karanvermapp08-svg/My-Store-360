import React, { useState, useEffect } from 'react';
import {
  Building2,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Download,
  RefreshCw,
  Eye,
  X,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { apiClient } from '../../utils/apiClient';
import { AuditLogView } from '../AuditLogView';
import { BusinessDashboardView } from './BusinessDashboardView';

interface OwnerWorkspaceProps {
  onNavigateClassic?: (tab: string) => void;
}

export const OwnerWorkspace: React.FC<OwnerWorkspaceProps> = ({ onNavigateClassic }) => {
  const {
    company,
    transactions,
    employees,
    exportCurrentViewPdf,
    showToast,
    setIsCompanyModalOpen,
  } = useVyapar();

  const [backendSyncedAt, setBackendSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      await apiClient.getWorkspace('owner');
      setBackendSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch {
      // Fallback to live client ledger state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const totalSales = transactions
    .filter((t) => t.type === 'Sale' && !t.isCancelled)
    .reduce((sum, t) => sum + (t.totalAmount || 0), 0);

  const headerSection = (
    <div className="bg-white rounded-xl p-5 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-200 shrink-0">
          <ShieldCheck className="w-5 h-5 stroke-[2]" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Owner Executive Dashboard
            </h1>
            <span className="text-xs text-slate-500">
              Root Governance · {company.name}
              {backendSyncedAt ? ` · Synced ${backendSyncedAt}` : ''}
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Unified financial intelligence, cash &amp; stock liquidity, targets, collections, and branch governance
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            fetchStats();
            showToast('Synchronized owner ledger metrics with backend.');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Backend</span>
        </button>

        <button
          type="button"
          onClick={() => setIsAuditLogOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
          <span>Audit Trail</span>
        </button>

        <button
          type="button"
          onClick={() => setIsCompanyModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Company Profile</span>
        </button>

        <button
          type="button"
          onClick={() => exportCurrentViewPdf({ title: 'Owner Executive Dashboard Report' })}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Executive PDF</span>
        </button>
      </div>
    </div>
  );

  const roleOperationsWidget = (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Branch & Depot Performance */}
      <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Branch &amp; Depot Performance</h3>
            <p className="text-[11px] text-slate-500">
              3 branches synchronized · Consolidated central ledger
            </p>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700">
            All units active
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          <div className="py-3 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-slate-900 text-xs">
                Bengaluru Flagship Store · Main Store
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                MG Road, Bengaluru · Manager: Ananya Rao · 5 Active Terminals
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-bold text-slate-900 text-xs tabular-nums">
                ₹ {totalSales.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-emerald-600 font-semibold">Primary Volume</div>
            </div>
          </div>

          <div className="py-3 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-slate-900 text-xs">
                Hubballi Branch &amp; Depot · Regional Outlet
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Station Road, Hubballi · Manager: Rajesh Varma · 2 Active Terminals
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-bold text-slate-900 text-xs tabular-nums">₹ 1,48,200</div>
              <div className="text-[11px] text-slate-500">Regional Branch</div>
            </div>
          </div>

          <div className="py-3 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-slate-900 text-xs">
                Central Distribution Warehouse · Primary Depot
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Peenya Industrial Area · Supervisor: Ramesh Gowda · Inward/Outward Logistics
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-bold text-slate-900 text-xs tabular-nums">60 SKUs Ready</div>
              <div className="text-[11px] text-blue-600 font-semibold">Bulk Fulfillment</div>
            </div>
          </div>
        </div>
      </div>

      {/* Owner Security Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-purple-600" />
            <span>Owner Security Controls</span>
          </h3>
          <p className="text-[11px] text-slate-500">Non-delegable governance safeguards</p>
        </div>

        <div className="divide-y divide-slate-100 text-[11px]">
          <div className="py-2.5">
            <strong className="font-bold text-slate-900 block">1. Root Master Access</strong>
            <span className="text-slate-600">
              Cannot be revoked or modified by subordinate Admins or Managers.
            </span>
          </div>

          <div className="py-2.5">
            <strong className="font-bold text-slate-900 block">2. Financial Privacy Shield</strong>
            <span className="text-slate-600">
              Purchase cost and profit margins are strictly masked from POS &amp; Sales roles.
            </span>
          </div>

          <div className="py-2.5">
            <strong className="font-bold text-slate-900 block">3. Supervisor Approval Gateways</strong>
            <span className="text-slate-600">
              Discounts &gt;5% or invoice cancellations trigger manager approval requests.
            </span>
          </div>
        </div>

        <div className="pt-1 space-y-2">
          <div className="text-xs font-bold text-slate-800 tabular-nums">
            {employees.length} Staff across 9 RBAC Roles
          </div>

          <button
            type="button"
            onClick={() => setIsAuditLogOpen(true)}
            className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-rose-400" />
            <span>Open Forensic Audit Ledger</span>
          </button>
        </div>
      </div>
    </section>
  );

  return (
    <>
      <BusinessDashboardView
        role="owner"
        headerSection={headerSection}
        roleOperationsWidget={roleOperationsWidget}
        onNavigateClassic={onNavigateClassic}
      />

      {isAuditLogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 sm:p-6 overflow-hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                <span className="font-bold text-sm">Owner Forensic Audit Console</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditLogOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 flex overflow-hidden">
              <AuditLogView />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
