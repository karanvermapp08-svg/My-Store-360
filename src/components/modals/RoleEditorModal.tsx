import React, { useState, useEffect } from 'react';
import { X, Shield, Check, CheckSquare, Square, Percent, IndianRupee, Eye, EyeOff, Lock, Unlock, Store, Search } from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { RoleDefinition, PermissionKey, PrivilegeLevel, RiskTier, BranchScope } from '../../types';
import { PERMISSION_GROUPS } from '../../utils/rbacDefaults';

export const RoleEditorModal: React.FC = () => {
  const {
    isRoleEditorModalOpen,
    setIsRoleEditorModalOpen,
    selectedRole,
    createRole,
    updateRole,
    showToast,
  } = useVyapar();

  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#7c3aed');
  const [privilegeLevel, setPrivilegeLevel] = useState<PrivilegeLevel>(2);
  const [riskTier, setRiskTier] = useState<RiskTier>('Standard');
  const [branchScope, setBranchScope] = useState<BranchScope>('assigned_branch_only');
  const [maxDiscountPercent, setMaxDiscountPercent] = useState<number>(5);
  const [maxRefundAmountWithoutApproval, setMaxRefundAmountWithoutApproval] = useState<number>(0);
  const [canViewPurchasePrice, setCanViewPurchasePrice] = useState<boolean>(false);
  const [canViewProfitMargins, setCanViewProfitMargins] = useState<boolean>(false);
  const [canEditFinalizedBills, setCanEditFinalizedBills] = useState<boolean>(false);
  const [canCancelInvoices, setCanCancelInvoices] = useState<boolean>(false);

  const [selectedPermissions, setSelectedPermissions] = useState<PermissionKey[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (selectedRole) {
      setRoleName(selectedRole.name);
      setDescription(selectedRole.description);
      setColor(selectedRole.color);
      setPrivilegeLevel(selectedRole.privilegeLevel || 2);
      setRiskTier(selectedRole.riskTier || 'Standard');
      setBranchScope(selectedRole.branchScope || 'assigned_branch_only');
      setMaxDiscountPercent(selectedRole.maxDiscountPercent ?? 5);
      setMaxRefundAmountWithoutApproval(selectedRole.maxRefundAmountWithoutApproval ?? 0);
      setCanViewPurchasePrice(selectedRole.canViewPurchasePrice ?? false);
      setCanViewProfitMargins(selectedRole.canViewProfitMargins ?? false);
      setCanEditFinalizedBills(
        selectedRole.canEditFinalizedBills === 'Yes' || selectedRole.canEditFinalizedBills === true
      );
      setCanCancelInvoices(
        selectedRole.canCancelInvoices === 'Yes' || selectedRole.canCancelInvoices === true
      );
      setSelectedPermissions([...selectedRole.permissions]);
    } else {
      setRoleName('');
      setDescription('');
      setColor('#7c3aed');
      setPrivilegeLevel(2);
      setRiskTier('Standard');
      setBranchScope('assigned_branch_only');
      setMaxDiscountPercent(5);
      setMaxRefundAmountWithoutApproval(0);
      setCanViewPurchasePrice(false);
      setCanViewProfitMargins(false);
      setCanEditFinalizedBills(false);
      setCanCancelInvoices(false);
      setSelectedPermissions([
        'sales_pos.view',
        'sales_pos.create',
        'items_inventory.view',
        'parties.view',
      ]);
    }
  }, [selectedRole]);

  if (!isRoleEditorModalOpen) return null;

  const togglePermission = (key: PermissionKey) => {
    if (selectedPermissions.includes(key)) {
      setSelectedPermissions(selectedPermissions.filter((k) => k !== key));
    } else {
      setSelectedPermissions([...selectedPermissions, key]);
    }
  };

  const selectAll = () => {
    const allKeys = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));
    setSelectedPermissions(Array.from(new Set(allKeys)));
  };

  const deselectAll = () => {
    setSelectedPermissions([]);
  };

  const toggleGroup = (groupKeys: PermissionKey[]) => {
    const allPresent = groupKeys.every((k) => selectedPermissions.includes(k));
    if (allPresent) {
      setSelectedPermissions(selectedPermissions.filter((k) => !groupKeys.includes(k)));
    } else {
      setSelectedPermissions(Array.from(new Set([...selectedPermissions, ...groupKeys])));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName) {
      showToast('Please enter a role name');
      return;
    }

    const payload: Partial<RoleDefinition> = {
      name: roleName,
      description,
      color,
      privilegeLevel,
      riskTier,
      branchScope,
      maxDiscountPercent: Number(maxDiscountPercent) || 0,
      maxRefundAmountWithoutApproval: Number(maxRefundAmountWithoutApproval) || 0,
      canViewPurchasePrice,
      canViewProfitMargins,
      canEditFinalizedBills: canEditFinalizedBills ? 'Yes' : 'No',
      canCancelInvoices: canCancelInvoices ? 'Yes' : 'Approval',
      permissions: selectedPermissions,
      lastModified: new Date().toISOString().split('T')[0],
      modifiedBy: 'Admin',
    };

    if (selectedRole) {
      updateRole(selectedRole.id, payload);
    } else {
      createRole({
        ...payload,
        name: roleName,
        type: 'Custom',
        description: description || 'Custom billing role',
        color,
        permissions: selectedPermissions,
      });
    }

    setIsRoleEditorModalOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-5 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-4xl flex flex-col max-h-[92vh] overflow-hidden text-xs text-slate-800">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-400/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                {selectedRole ? `Configure Role: ${selectedRole.name}` : 'Create Custom Billing Role'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Define scope, financial authority, discount ceilings, and module-specific permissions
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsRoleEditorModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {/* 1. Basic Metadata */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider text-[11px]">
              1. Role Identity & Scope
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">Role Name *</label>
                <input
                  type="text"
                  required
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g. Senior Cashier, Floor Manager, Regional Auditor"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Role Color Badge</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                  />
                  <span className="font-mono text-xs">{color}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Privilege Level</label>
                <select
                  value={privilegeLevel}
                  onChange={(e) => setPrivilegeLevel(Number(e.target.value) as PrivilegeLevel)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-purple-500"
                >
                  <option value={1}>L1 - Operational / Field Staff</option>
                  <option value={2}>L2 - Front Desk / Cashier</option>
                  <option value={3}>L3 - Department / Store Manager</option>
                  <option value={4}>L4 - General / Branch Administrator</option>
                  <option value={5}>L5 - Root Master / Executive</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Risk Tier</label>
                <select
                  value={riskTier}
                  onChange={(e) => setRiskTier(e.target.value as RiskTier)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-purple-500"
                >
                  <option value="Standard">Standard Risk</option>
                  <option value="Moderate">Moderate Risk</option>
                  <option value="High">High Risk</option>
                  <option value="Critical">Critical Risk</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Branch / Store Scope</label>
                <select
                  value={branchScope}
                  onChange={(e) => setBranchScope(e.target.value as BranchScope)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-purple-500"
                >
                  <option value="assigned_branch_only">Assigned Branch Only</option>
                  <option value="regional">Regional Outlets</option>
                  <option value="central_warehouse">Central Warehouse</option>
                  <option value="all">All Branches & Stores</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Description & Role Responsibilities</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Core responsibilities, shift schedule, authorized counters..."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* 2. Billing-Specific Financial & Security Controls */}
          <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-200 space-y-3">
            <h3 className="font-bold text-xs text-purple-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-purple-600" />
              <span>2. Billing Guardrails & Financial Privacy Controls</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Max Allowable Discount Ceiling (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={maxDiscountPercent}
                    onChange={(e) => setMaxDiscountPercent(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 font-bold">%</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Discounts exceeding this require manager approval.</p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Autonomous Refund Limit (₹)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={maxRefundAmountWithoutApproval}
                    onChange={(e) => setMaxRefundAmountWithoutApproval(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 font-bold">₹</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">₹0 means all refunds require independent supervisor approval.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-2.5 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-purple-300 transition-colors">
                <input
                  type="checkbox"
                  checked={canViewPurchasePrice}
                  onChange={(e) => setCanViewPurchasePrice(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-xs text-slate-800 block">View Supplier Purchase Costs</span>
                  <span className="text-[10px] text-slate-500">Hide purchase rates on POS and Item master for cashiers</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-purple-300 transition-colors">
                <input
                  type="checkbox"
                  checked={canViewProfitMargins}
                  onChange={(e) => setCanViewProfitMargins(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-xs text-slate-800 block">View Gross Profit Margins</span>
                  <span className="text-[10px] text-slate-500">Prevent operational staff from viewing cost margins</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-purple-300 transition-colors">
                <input
                  type="checkbox"
                  checked={canEditFinalizedBills}
                  onChange={(e) => setCanEditFinalizedBills(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-xs text-slate-800 block">Edit Finalized Sales Bills</span>
                  <span className="text-[10px] text-slate-500">Lock invoices to prevent silent edits post-printing</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-purple-300 transition-colors">
                <input
                  type="checkbox"
                  checked={canCancelInvoices}
                  onChange={(e) => setCanCancelInvoices(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-xs text-slate-800 block">Autonomous Invoice Cancellation</span>
                  <span className="text-[10px] text-slate-500">If unchecked, cancellation requires manager authorization</span>
                </div>
              </label>
            </div>
          </div>

          {/* 3. Granular 10-Module Permission Matrix */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <span>3. Granular Module Permissions</span>
                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold text-[10px]">
                    {selectedPermissions.length} Enabled
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Configure specific View, Create, Edit, Delete, Approve, Cancel, Print & Export actions
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search permissions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-purple-500 w-44"
                  />
                </div>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 font-bold text-[11px] flex items-center gap-1 transition-colors"
                >
                  <X className="w-3 h-3 text-rose-600" />
                  <span>Remove All</span>
                </button>
                <button
                  type="button"
                  onClick={selectAll}
                  className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-[11px] flex items-center gap-1 transition-colors"
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Grant All</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {PERMISSION_GROUPS.map((group) => {
                const groupKeys = group.permissions.map((p) => p.key);
                const activeInGroup = group.permissions.filter((p) => selectedPermissions.includes(p.key)).length;
                const isAllGroupSelected = groupKeys.length > 0 && activeInGroup === groupKeys.length;

                const filteredPermissions = group.permissions.filter(
                  (p) =>
                    p.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    group.name.toLowerCase().includes(searchTerm.toLowerCase())
                );

                if (filteredPermissions.length === 0) return null;

                return (
                  <div key={group.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                    <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{group.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({activeInGroup} / {group.permissions.length} active)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGroup(groupKeys)}
                        className="text-[11px] font-semibold text-purple-700 hover:underline"
                      >
                        {isAllGroupSelected ? 'Deselect Module' : 'Select All Module'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {filteredPermissions.map((perm) => {
                        const isChecked = selectedPermissions.includes(perm.key);
                        return (
                          <div
                            key={perm.key}
                            onClick={() => togglePermission(perm.key)}
                            className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2.5 transition-colors ${
                              isChecked
                                ? 'bg-purple-50/80 border-purple-300 text-purple-900 font-medium'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="mt-0.5 rounded text-purple-600 focus:ring-0 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold leading-tight text-slate-900 truncate">
                                {perm.label}
                              </div>
                              <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                                {perm.description}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Save / Cancel */}
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsRoleEditorModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors shadow-2xs"
            >
              {selectedRole ? 'Save Changes' : 'Create Custom Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
