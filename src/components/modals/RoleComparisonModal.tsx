import React, { useState } from 'react';
import { X, Shield, Check, Minus, ArrowRightLeft, Layers, Percent, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { RoleDefinition } from '../../types';
import { PERMISSION_GROUPS } from '../../utils/rbacDefaults';

interface RoleComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRoleIds?: string[];
}

export const RoleComparisonModal: React.FC<RoleComparisonModalProps> = ({
  isOpen,
  onClose,
  initialRoleIds = [],
}) => {
  const { roles, employees } = useVyapar();

  const [role1Id, setRole1Id] = useState<string>(initialRoleIds[0] || roles[0]?.id || 'role-owner');
  const [role2Id, setRole2Id] = useState<string>(initialRoleIds[1] || roles[1]?.id || roles[3]?.id || 'role-cashier');
  const [role3Id, setRole3Id] = useState<string>(initialRoleIds[2] || '');
  const [filterQuery, setFilterQuery] = useState('');

  if (!isOpen) return null;

  const role1 = roles.find((r) => r.id === role1Id) || roles[0];
  const role2 = roles.find((r) => r.id === role2Id) || roles[1];
  const role3 = role3Id ? roles.find((r) => r.id === role3Id) : undefined;

  const comparedRoles = [role1, role2, role3].filter((r): r is RoleDefinition => !!r);

  const getAssignedCount = (roleName: string) => {
    return employees.filter((e) => e.role === roleName).length;
  };

  const getRiskBadge = (riskTier?: string) => {
    switch (riskTier) {
      case 'Critical':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">Critical Risk</span>;
      case 'High':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-300">High Risk</span>;
      case 'Moderate':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Moderate</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Standard</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-6 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-5xl flex flex-col max-h-[92vh] overflow-hidden text-xs text-slate-800">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-400/30">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight flex items-center gap-2">
                Side-by-Side Role & Security Comparison
              </h2>
              <p className="text-[11px] text-slate-400">
                Compare authorization matrices, financial boundaries, refund limits, and branch scopes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Selectors Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Role 1 (Baseline)</label>
            <select
              value={role1Id}
              onChange={(e) => setRole1Id(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-purple-500"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.isBuiltIn ? 'Built-in' : 'Custom'} - L{r.privilegeLevel || 1})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Role 2 (Comparison)</label>
            <select
              value={role2Id}
              onChange={(e) => setRole2Id(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-purple-500"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.isBuiltIn ? 'Built-in' : 'Custom'} - L{r.privilegeLevel || 1})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Role 3 (Optional)</label>
            <select
              value={role3Id}
              onChange={(e) => setRole3Id(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-purple-500"
            >
              <option value="">-- None (2-way comparison) --</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.isBuiltIn ? 'Built-in' : 'Custom'} - L{r.privilegeLevel || 1})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Scrollable Comparison Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. High-Level Role Attributes Summary Cards */}
          <div className={`grid grid-cols-1 gap-4 ${comparedRoles.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            {comparedRoles.map((role) => (
              <div
                key={role.id}
                className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs relative overflow-hidden"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: role.color }}
                />
                <div className="flex items-start justify-between gap-2 mt-1">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: role.color }} />
                      {role.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">{role.description}</p>
                  </div>
                  {getRiskBadge(role.riskTier)}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Privilege Level</span>
                    <strong className="font-semibold text-slate-800">
                      Level {role.privilegeLevel || 1} / 5
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Branch Scope</span>
                    <strong className="font-semibold text-slate-800 capitalize">
                      {(role.branchScope || 'assigned_branch_only').replace(/_/g, ' ')}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Assigned Staff</span>
                    <strong className="font-semibold text-slate-800">
                      {getAssignedCount(role.name)} Employees
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Active Features</span>
                    <strong className="font-semibold text-slate-800">
                      {role.permissions.length} Permissions
                    </strong>
                  </div>
                </div>

                {/* Billing Controls Section */}
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Max Discount Ceiling:</span>
                    <span className="font-bold text-slate-800">
                      {role.maxDiscountPercent !== undefined ? `${role.maxDiscountPercent}%` : '0%'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Autonomous Refund Limit:</span>
                    <span className="font-bold text-slate-800">
                      {role.maxRefundAmountWithoutApproval ? `₹${role.maxRefundAmountWithoutApproval.toLocaleString()}` : 'Approval Required (₹0)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Purchase Cost Visibility:</span>
                    <span className={`font-semibold flex items-center gap-1 ${role.canViewPurchasePrice ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {role.canViewPurchasePrice ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {role.canViewPurchasePrice ? 'Visible' : 'Hidden'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Profit Margins Visibility:</span>
                    <span className={`font-semibold flex items-center gap-1 ${role.canViewProfitMargins ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {role.canViewProfitMargins ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {role.canViewProfitMargins ? 'Visible' : 'Hidden'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Edit Finalized Bills:</span>
                    <span className={`font-semibold ${role.canEditFinalizedBills ? 'text-amber-700' : 'text-slate-400'}`}>
                      {role.canEditFinalizedBills ? 'Permitted' : 'Locked'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Cancel Invoices:</span>
                    <span className={`font-semibold ${role.canCancelInvoices ? 'text-rose-700' : 'text-slate-400'}`}>
                      {role.canCancelInvoices ? 'Permitted' : 'Approval Required'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 2. Granular Permissions Comparison Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-600" />
                <h4 className="font-bold text-xs text-slate-800">Module & Action Permission Comparison</h4>
              </div>
              <input
                type="text"
                placeholder="Filter permission names..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-purple-500 w-56"
              />
            </div>

            <div className="divide-y divide-slate-200">
              {PERMISSION_GROUPS.map((group) => {
                const filteredPerms = group.permissions.filter(
                  (p) =>
                    p.label.toLowerCase().includes(filterQuery.toLowerCase()) ||
                    p.description.toLowerCase().includes(filterQuery.toLowerCase()) ||
                    group.name.toLowerCase().includes(filterQuery.toLowerCase())
                );

                if (filteredPerms.length === 0) return null;

                return (
                  <div key={group.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-xs text-purple-900 bg-purple-50 px-2 py-1 rounded inline-block">
                        {group.name}
                      </h5>
                      <span className="text-[10px] text-slate-400">{filteredPerms.length} capabilities</span>
                    </div>

                    <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 font-semibold w-1/2">Capability</th>
                          {comparedRoles.map((role) => (
                            <th key={role.id} className="py-2 px-3 text-center font-semibold">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color }} />
                                {role.name}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPerms.map((perm) => (
                          <tr key={perm.key} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3">
                              <div className="font-semibold text-slate-800">{perm.label}</div>
                              <div className="text-[10px] text-slate-400">{perm.description}</div>
                            </td>
                            {comparedRoles.map((role) => {
                              const hasPerm = role.permissions.includes(perm.key);
                              return (
                                <td key={role.id} className="py-2 px-3 text-center">
                                  {hasPerm ? (
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700">
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-50 text-rose-300">
                                      <Minus className="w-3 h-3 stroke-[2.5]" />
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-500">
            Comparing <strong className="text-slate-800">{comparedRoles.map((r) => r.name).join(' vs ')}</strong>
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
