import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Check,
  X,
  Store,
  RefreshCw,
  Download,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { apiClient } from '../../utils/apiClient';
import { AuditLogView } from '../AuditLogView';
import { BusinessDashboardView } from './BusinessDashboardView';

interface ManagerWorkspaceProps {
  onNavigateClassic?: (tab: string) => void;
}

export const ManagerWorkspace: React.FC<ManagerWorkspaceProps> = ({ onNavigateClassic }) => {
  const {
    employees,
    returnRequests,
    processReturnRefundRequest,
    exportCurrentViewPdf,
    showToast,
  } = useVyapar();

  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getApprovals();
      setApprovals(res.approvals || []);
    } catch {
      showToast('Unable to refresh approvals from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const handleDecision = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      await apiClient.decideApproval(id, decision);
      showToast(`Approval ticket ${decision === 'APPROVED' ? 'Approved' : 'Rejected'} successfully.`);
      loadApprovals();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const pendingReturnsCount = returnRequests.filter((r) => r.status === 'Requested').length;
  const pendingCount = approvals.filter((a) => a.status === 'PENDING').length + pendingReturnsCount;
  const activeDutyStaff = employees.filter((e) => e.status === 'Active').length;

  const headerSection = (
    <div className="bg-white rounded-xl p-5 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 shrink-0">
          <Store className="w-5 h-5 stroke-[2]" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Store Manager Operations Dashboard
            </h1>
            <span className="text-xs text-slate-500 tabular-nums">
              Bengaluru Flagship Store · {activeDutyStaff} Active Staff · {pendingCount} Pending Approvals
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Daily sales, purchases, expenses, stock alerts, customer collections, and supervisor authorization queue
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            loadApprovals();
            showToast('Refreshed supervisor approval queue.');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>

        <button
          type="button"
          onClick={() => setIsAuditLogOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
          <span>Branch Audit Log</span>
        </button>

        <button
          type="button"
          onClick={() => exportCurrentViewPdf({ title: 'Store Manager Operations Report' })}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export PDF</span>
        </button>
      </div>
    </div>
  );

  const roleOperationsWidget = (
    <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Supervisor Authorization Queue</span>
          </h3>
          <p className="text-[11px] text-slate-500">
            Discount overrides, invoice cancellations, and refund approvals · {pendingCount} pending
          </p>
        </div>
        <span className="text-xs font-semibold text-amber-700 tabular-nums">
          {pendingCount} Pending Requests
        </span>
      </div>

      {approvals.length === 0 ? (
        <div className="py-6 text-center text-slate-400 text-xs">
          No pending approval requests at this moment.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {approvals.map((appr) => {
            const isPending = appr.status === 'PENDING';
            return (
              <div
                key={appr.id}
                className="py-3.5 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-amber-800">
                      {appr.requestType.replace(/_/g, ' ')}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="font-bold text-slate-900">{appr.details}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    Requested by <strong className="text-slate-700">{appr.requestedBy}</strong> ·{' '}
                    {new Date(appr.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isPending ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDecision(appr.id, 'REJECTED')}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5 text-rose-600" />
                        <span>Reject</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecision(appr.id, 'APPROVED')}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Authorize</span>
                      </button>
                    </>
                  ) : (
                    <span
                      className={`text-xs font-semibold ${
                        appr.status === 'APPROVED' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {appr.status} by {appr.reviewedBy || 'Manager'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {returnRequests.length > 0 && (
        <div className="pt-3 border-t border-slate-200 space-y-2.5">
          <div className="text-xs font-bold text-slate-800">
            Online Store Customer Return &amp; Refund Requests ({pendingReturnsCount} pending)
          </div>
          <div className="divide-y divide-slate-100">
            {returnRequests.map((req) => (
              <div key={req.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5 max-w-xl">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-amber-800">
                      {req.returnNo}{req.invoiceNo ? ` · #${req.invoiceNo}` : ''}
                    </span>
                    <span className="font-bold text-slate-900">{req.customerName}</span>
                    <span className="text-slate-600">· ₹{req.refundAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Reason: {req.reason} · Refund: MS Credit Wallet
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {req.status === 'Requested' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => processReturnRefundRequest(req.id, 'Rejected')}
                        className="px-3 py-1 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 font-semibold text-xs cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => processReturnRefundRequest(req.id, 'Approved')}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer"
                      >
                        Approve &amp; Restock
                      </button>
                    </>
                  ) : (
                    <span
                      className={`text-xs font-semibold ${
                        req.status === 'Rejected' ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {req.status} {req.processedBy ? `by ${req.processedBy}` : ''}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );

  return (
    <>
      <BusinessDashboardView
        role="manager"
        headerSection={headerSection}
        roleOperationsWidget={roleOperationsWidget}
        onNavigateClassic={onNavigateClassic}
      />

      {isAuditLogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 sm:p-6 overflow-hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <span className="font-bold text-sm">Store Manager Branch Audit &amp; Forensic Log</span>
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
