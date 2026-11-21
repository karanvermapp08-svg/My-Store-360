import React, { useState } from 'react';
import {
  Shield,
  ShieldAlert,
  Users,
  Settings,
  Key,
  Lock,
  Plus,
  RefreshCw,
  Building2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UserCheck,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { StaffManagementView } from '../StaffManagementView';
import { AuditLogView } from '../AuditLogView';

export const AdminWorkspace: React.FC = () => {
  const {
    currentUser,
    users,
    roles,
    employees,
    sessions,
    activityLogs,
    sessionTimeoutMinutes,
    setSessionTimeoutMinutes,
    showToast,
  } = useVyapar();

  const [activeTab, setActiveTab] = useState<'staff_roles' | 'security_sessions' | 'branches_config' | 'audit_log'>('staff_roles');

  return (
    <div className="flex-1 flex flex-col bg-[#f0f4f9] overflow-hidden select-none text-xs text-slate-800">
      {/* 1. Admin Workspace Top Bar */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 text-purple-700 rounded-xl border border-purple-200">
            <Shield className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                System Administration &amp; Governance
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                Admin Console
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">
              Employee provisioning, 9-role authorization matrix, branch scopes, and security policy enforcement
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700">
            Active Sessions: <strong className="text-purple-700">{sessions.length}</strong>
          </div>
        </div>
      </div>

      {/* 2. Admin Workspace Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-8 shrink-0 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('staff_roles')}
          className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'staff_roles'
              ? 'border-purple-600 text-purple-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff &amp; Role Matrix ({roles.length} Roles)</span>
        </button>

        <button
          onClick={() => setActiveTab('security_sessions')}
          className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'security_sessions'
              ? 'border-purple-600 text-purple-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Security &amp; Session Policies</span>
        </button>

        <button
          onClick={() => setActiveTab('branches_config')}
          className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'branches_config'
              ? 'border-purple-600 text-purple-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Multi-Branch &amp; Warehouse Scopes</span>
        </button>

        <button
          onClick={() => setActiveTab('audit_log')}
          className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'audit_log'
              ? 'border-purple-600 text-purple-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          <span>Audit Log &amp; Forensics</span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
            AUDIT
          </span>
        </button>
      </div>

      {/* 3. Tab Contents */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'staff_roles' && <StaffManagementView />}
        {activeTab === 'audit_log' && <AuditLogView />}

        {activeTab === 'security_sessions' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 max-w-3xl">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-600" />
                <span>Session &amp; Authentication Safeguards</span>
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Auto Session Lockout Timeout (Minutes)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={sessionTimeoutMinutes}
                      onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value) || 15)}
                      className="w-32 bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs font-bold"
                    />
                    <span className="text-slate-500 text-[11px]">
                      Locks workstation after inactivity to prevent unattended cashier tampering.
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <h3 className="font-bold text-xs text-slate-800 mb-2">Active Authenticated Staff Sessions</h3>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {sessions.map((s) => (
                      <div key={s.id} className="p-3 bg-white flex items-center justify-between text-xs">
                        <div>
                          <strong className="text-slate-900">{s.userName}</strong>
                          <span className="text-slate-500 text-[11px] block">{s.device} • IP: {s.ipAddress}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Authenticated
                          </span>
                          <span className="text-slate-400 text-[10px] block mt-0.5">Active now</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'branches_config' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 max-w-4xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-purple-600" />
                    <span>Configured Business Branches &amp; Warehouses</span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Staff role scopes restrict POS and inventory data access to authorized locations only.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-blue-950">Bengaluru Flagship</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-200 text-blue-800">Main</span>
                  </div>
                  <p className="text-[11px] text-slate-600">MG Road, Bengaluru</p>
                  <div className="text-[10px] text-slate-500 pt-2 border-t border-blue-100">
                    Assigned: Manager Ananya Rao, Cashier Vikram Joshi
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">Hubballi Branch &amp; Depot</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">Regional</span>
                  </div>
                  <p className="text-[11px] text-slate-600">Station Road, Hubballi</p>
                  <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-100">
                    Assigned: Admin Rajesh Varma
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-amber-950">Central Distribution Warehouse</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-800">Depot</span>
                  </div>
                  <p className="text-[11px] text-slate-600">Peenya Industrial Area</p>
                  <div className="text-[10px] text-slate-500 pt-2 border-t border-amber-100">
                    Assigned: Inventory Ramesh Gowda, Purchase Manoj Kumar
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
