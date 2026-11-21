import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  Shield,
  Activity,
  History,
  ToggleRight,
  Search,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  ClipboardPlus,
  MessageSquare,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { Employee, PermissionKey, SellerType } from '../../types';

type SubTabId =
  | 'customer-accounts'
  | 'staff-accounts'
  | 'add-staff'
  | 'staff-permissions'
  | 'customer-activity'
  | 'login-history'
  | 'account-status';

export const CustomerStaffManagementView: React.FC = () => {
  const {
    currentUser,
    isAdminSession,
    adminPortalSubTab,
    setAdminPortalSubTab,
    customerAccounts,
    users,
    roles,
    customerActivity,
    loginHistory,
    supportMessages,
    staffTasks,
    adminCreateStaffAccount,
    adminToggleStaffStatus,
    adminResetStaffPassword,
    adminUpdateStaffRole,
    adminToggleCustomerStatus,
    adminResetCustomerPassword,
    adminAssignStaffTask,
    adminUpdateUserConfig,
    updateRole,
  } = useVyapar();

  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Add Staff form
  const [newStaffId, setNewStaffId] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffPwd, setNewStaffPwd] = useState('');
  const [newStaffRoleId, setNewStaffRoleId] = useState(roles[2]?.id || 'role-cashier');
  const [newStaffDept, setNewStaffDept] = useState<Employee['department']>('Billing & Counter');
  const [newStaffDesig, setNewStaffDesig] = useState('Counter Staff');

  // Password reset inline modal
  const [resetTarget, setResetTarget] = useState<{
    type: 'STAFF' | 'CUSTOMER';
    id: string;
    name: string;
  } | null>(null);
  const [resetPwdInput, setResetPwdInput] = useState('');

  // Assign Task inline form
  const [taskStaffId, setTaskStaffId] = useState('ST001');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');

  if (!isAdminSession()) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12 bg-white rounded-2xl border border-rose-200 text-center shadow-sm">
        <AlertCircle className="w-10 h-10 text-[#B91C1C] mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">Administrator Access Only</h2>
        <p className="text-xs text-slate-500 mt-1">
          Only Store Owner or Administrator accounts can manage customer portals, staff IDs, and permissions.
        </p>
      </div>
    );
  }

  const activeSubTab = (adminPortalSubTab as SubTabId) || 'customer-accounts';

  const tabs: { id: SubTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'customer-accounts', label: 'Customer Accounts', icon: Users },
    { id: 'staff-accounts', label: 'Staff Accounts', icon: UserCheck },
    { id: 'add-staff', label: 'Add Staff', icon: UserPlus },
    { id: 'staff-permissions', label: 'Staff Permissions', icon: Shield },
    { id: 'customer-activity', label: 'Customer Activity', icon: Activity },
    { id: 'login-history', label: 'Login History', icon: History },
    { id: 'account-status', label: 'Account Status', icon: ToggleRight },
  ];

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await adminCreateStaffAccount({
      staffId: newStaffId || undefined,
      name: newStaffName,
      email: newStaffEmail,
      phone: newStaffPhone,
      password: newStaffPwd,
      roleId: newStaffRoleId,
      department: newStaffDept,
      designation: newStaffDesig,
    });
    setFeedback({ ok: res.success, msg: res.message });
    if (res.success) {
      setNewStaffId('');
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPhone('');
      setNewStaffPwd('');
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    const res =
      resetTarget.type === 'STAFF'
        ? await adminResetStaffPassword(resetTarget.id, resetPwdInput)
        : await adminResetCustomerPassword(resetTarget.id, resetPwdInput);
    setFeedback({ ok: res.success, msg: res.message });
    if (res.success) {
      setResetTarget(null);
      setResetPwdInput('');
    }
  };

  const handleAssignTask = (e: React.FormEvent) => {
    e.preventDefault();
    const targetStaff = users.find((u) => (u.employeeId || u.id) === taskStaffId);
    const res = adminAssignStaffTask({
      staffId: taskStaffId,
      staffName: targetStaff?.name || taskStaffId,
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      dueDate: new Date().toLocaleDateString('en-GB'),
      priority: taskPriority,
      status: 'Pending',
    });
    setFeedback({ ok: res.success, msg: res.message });
    if (res.success) {
      setTaskTitle('');
      setTaskDesc('');
    }
  };

  const toggleRolePerm = (roleId: string, perm: PermissionKey) => {
    const target = roles.find((r) => r.id === roleId);
    if (!target) return;
    if (target.type === 'Owner') {
      setFeedback({ ok: false, msg: 'Owner role retains permanent root permissions.' });
      return;
    }
    const exists = target.permissions.includes(perm);
    const updated = exists
      ? target.permissions.filter((p) => p !== perm)
      : [...target.permissions, perm];
    updateRole(roleId, { permissions: updated });
  };

  const q = search.toLowerCase().trim();

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#f8fafc]">
      {/* Header + Sub-Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Customer & Staff Management
            </h2>
            <p className="text-xs text-slate-500">
              Control Customer Portal accounts, Staff IDs, hashed password resets, permissions, and audit history.
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, name, or email..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#8B1E2D]"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeSubTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setFeedback(null);
                  setAdminPortalSubTab(t.id);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                  active
                    ? 'bg-[#8B1E2D] text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-rose-50 text-slate-700 border border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 font-semibold ${
            feedback.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* 1. CUSTOMER ACCOUNTS */}
      {activeSubTab === 'customer-accounts' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-3">Customer ID</th>
                <th className="py-2.5 px-3">Full Name</th>
                <th className="py-2.5 px-3">Email & Phone</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Last Login</th>
                <th className="py-2.5 px-3 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customerAccounts
                .filter(
                  (c) =>
                    !q ||
                    c.customerId.toLowerCase().includes(q) ||
                    c.fullName.toLowerCase().includes(q) ||
                    c.email.toLowerCase().includes(q)
                )
                .map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono font-bold text-[#8B1E2D]">{c.customerId}</td>
                    <td className="py-3 px-3 font-semibold text-slate-900">{c.fullName}</td>
                    <td className="py-3 px-3 text-slate-600">
                      <div>{c.email}</div>
                      <div className="text-[11px] text-slate-400">{c.phone}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          c.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-[#B91C1C]'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{c.lastLogin}</td>
                    <td className="py-3 px-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          setResetTarget({ type: 'CUSTOMER', id: c.id, name: c.fullName })
                        }
                        className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>Reset Password</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const res = adminToggleCustomerStatus(
                            c.id,
                            c.status === 'Active' ? 'Suspended' : 'Active'
                          );
                          setFeedback({ ok: res.success, msg: res.message });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-white font-semibold cursor-pointer ${
                          c.status === 'Active'
                            ? 'bg-[#B91C1C] hover:bg-[#991B1B]'
                            : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {c.status === 'Active' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. STAFF ACCOUNTS */}
      {activeSubTab === 'staff-accounts' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">Staff & Admin Directory</h3>
            <button
              type="button"
              onClick={() => setAdminPortalSubTab('add-staff')}
              className="px-3 py-1.5 rounded-xl bg-[#8B1E2D] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Staff Member</span>
            </button>
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-3">Staff ID</th>
                <th className="py-2.5 px-3">Name & Email</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Last Login</th>
                <th className="py-2.5 px-3 text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users
                .filter(
                  (u) =>
                    !q ||
                    (u.employeeId || '').toLowerCase().includes(q) ||
                    u.name.toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q)
                )
                .map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono font-bold text-[#8B1E2D]">
                        {u.employeeId || u.id}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">
                          {u.name}{' '}
                          {isSelf && (
                            <span className="text-[10px] text-emerald-700 font-bold">(You)</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">{u.email}</div>
                      </td>
                      <td className="py-3 px-3 space-y-1.5">
                        <select
                          disabled={isSelf}
                          value={u.roleId}
                          onChange={(e) => {
                            const res = adminUpdateStaffRole(u.id, e.target.value);
                            setFeedback({ ok: res.success, msg: res.message });
                          }}
                          className="px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white disabled:opacity-60 block"
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                        {(u.roleName === 'Seller' || u.roleId === 'role-seller') && (
                          <select
                            value={u.sellerType || 'Both Wholesaler + Retailer'}
                            onChange={(e) => {
                              const res = adminUpdateUserConfig(u.id, {
                                sellerType: e.target.value as SellerType,
                              });
                              setFeedback({ ok: res.success, msg: res.message });
                            }}
                            className="px-2 py-0.5 rounded-lg border border-blue-200 text-[11px] bg-blue-50 text-blue-800 font-semibold block"
                          >
                            <option value="Wholesaler Only">Wholesaler Only</option>
                            <option value="Retailer Only">Retailer Only</option>
                            <option value="Both Wholesaler + Retailer">Both Wholesaler + Retailer</option>
                          </select>
                        )}
                        {(u.roleName === 'Online Store Manager' || u.roleId === 'role-online-manager') && (
                          <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={u.onlineInventoryAccess !== false}
                              onChange={(e) => {
                                const res = adminUpdateUserConfig(u.id, {
                                  onlineInventoryAccess: e.target.checked,
                                });
                                setFeedback({ ok: res.success, msg: res.message });
                              }}
                            />
                            <span>Inventory Access</span>
                          </label>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            u.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-[#B91C1C]'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{u.lastLogin}</td>
                      <td className="py-3 px-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setResetTarget({ type: 'STAFF', id: u.id, name: u.name })
                          }
                          className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>Reset Password</span>
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => {
                              const res = adminToggleStaffStatus(u.id);
                              setFeedback({ ok: res.success, msg: res.message });
                            }}
                            className={`px-2.5 py-1 rounded-lg text-white font-semibold cursor-pointer ${
                              u.status === 'Blocked'
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : 'bg-[#B91C1C] hover:bg-[#991B1B]'
                            }`}
                          >
                            {u.status === 'Blocked' ? 'Activate' : 'Deactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. ADD STAFF */}
      {activeSubTab === 'add-staff' && (
        <div className="max-w-2xl bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <h3 className="text-base font-bold text-slate-900 mb-1">Create Staff Account</h3>
          <p className="text-xs text-slate-500 mb-5">
            Staff cannot self-register. Credentials generated here are hashed immediately with PBKDF2/SHA-256.
          </p>
          <form onSubmit={handleAddStaff} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Staff ID (optional — auto-generated if blank)
                </label>
                <input
                  type="text"
                  value={newStaffId}
                  onChange={(e) => setNewStaffId(e.target.value)}
                  placeholder="e.g. ST002"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="Amit Patel"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="amit.staff@mystore.local"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                  placeholder="+91 98450 22334"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Role *</label>
                <select
                  value={newStaffRoleId}
                  onChange={(e) => setNewStaffRoleId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <select
                  value={newStaffDept}
                  onChange={(e) => setNewStaffDept(e.target.value as Employee['department'])}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  <option value="Billing & Counter">Billing & Counter</option>
                  <option value="Operations">Operations</option>
                  <option value="Warehouse & Logistics">Warehouse & Logistics</option>
                  <option value="Accounts & Finance">Accounts & Finance</option>
                  <option value="Sales & Marketing">Sales & Marketing</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  value={newStaffDesig}
                  onChange={(e) => setNewStaffDesig(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Initial Password (min 6 characters) *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newStaffPwd}
                onChange={(e) => setNewStaffPwd(e.target.value)}
                placeholder="Assign staff password"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#8B1E2D] hover:bg-[#731825] text-white text-xs font-bold cursor-pointer"
            >
              Generate Staff ID & Create Account
            </button>
          </form>
        </div>
      )}

      {/* 4. STAFF PERMISSIONS */}
      {activeSubTab === 'staff-permissions' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs overflow-x-auto">
          <h3 className="text-sm font-bold text-slate-900 mb-3">
            Role Permission Matrix (Updates Locked/Unlocked Features Immediately)
          </h3>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-3">Role</th>
                {(['view', 'create', 'edit', 'delete', 'customer', 'product', 'report', 'export', 'settings'] as PermissionKey[]).map(
                  (perm) => (
                    <th key={perm} className="py-2.5 px-2 text-center uppercase text-[10px]">
                      {perm}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-bold text-slate-900">{r.name}</td>
                  {(['view', 'create', 'edit', 'delete', 'customer', 'product', 'report', 'export', 'settings'] as PermissionKey[]).map(
                    (perm) => {
                      const checked = r.permissions.includes(perm);
                      return (
                        <td key={perm} className="py-3 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={r.type === 'Owner'}
                            onChange={() => toggleRolePerm(r.id, perm)}
                            className="accent-[#8B1E2D] w-4 h-4 cursor-pointer"
                          />
                        </td>
                      );
                    }
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. CUSTOMER ACTIVITY & SUPPORT MESSAGES */}
      {activeSubTab === 'customer-activity' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Customer Portal Activity Log</h3>
            <div className="divide-y divide-slate-100">
              {customerActivity.map((act) => (
                <div key={act.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                  <div>
                    <div className="font-bold text-slate-900">
                      {act.customerName} <span className="font-mono text-[#8B1E2D]">({act.customerId})</span> — {act.action}
                    </div>
                    <div className="text-slate-600 mt-0.5">{act.details}</div>
                  </div>
                  <div className="text-[11px] text-slate-400 shrink-0">{act.timestamp}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#8B1E2D]" />
              <span>Customer Contact Shop Messages</span>
            </h3>
            {supportMessages.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No customer inquiries submitted yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {supportMessages.map((m) => (
                  <div key={m.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="text-xs font-bold text-slate-900">
                      {m.subject} — {m.customerName} ({m.customerId})
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{m.message}</p>
                    <div className="text-[10px] text-slate-400 mt-1">{m.createdAt}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. LOGIN HISTORY */}
      {activeSubTab === 'login-history' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs overflow-x-auto">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Authentication & Login History</h3>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-3">User / Account</th>
                <th className="py-2.5 px-3">Role / Portal</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Device / Origin</th>
                <th className="py-2.5 px-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loginHistory
                .filter(
                  (lh) =>
                    !q ||
                    lh.userName.toLowerCase().includes(q) ||
                    lh.email.toLowerCase().includes(q) ||
                    lh.role.toLowerCase().includes(q)
                )
                .map((lh) => (
                  <tr key={lh.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{lh.userName}</div>
                      <div className="text-[11px] text-slate-500">{lh.email}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-700">{lh.role}</td>
                    <td className="py-3 px-3 text-slate-500">{lh.timestamp}</td>
                    <td className="py-3 px-3 text-slate-500">{lh.device}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          lh.status === 'Success'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-[#B91C1C]'
                        }`}
                      >
                        {lh.status}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 7. ACCOUNT STATUS & TASK ASSIGNMENT */}
      {activeSubTab === 'account-status' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ClipboardPlus className="w-4 h-4 text-[#8B1E2D]" />
              <span>Assign Staff Task</span>
            </h3>
            <form onSubmit={handleAssignTask} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Staff Member</label>
                <select
                  value={taskStaffId}
                  onChange={(e) => setTaskStaffId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  {users
                    .filter((u) => u.status === 'Active')
                    .map((u) => (
                      <option key={u.id} value={u.employeeId || u.id}>
                        {u.employeeId || u.id} — {u.name} ({u.roleName})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Verify evening stock balance"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Check Aata & Rice stock counts before 7 PM"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as 'High' | 'Medium' | 'Low')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#8B1E2D] text-white text-xs font-bold cursor-pointer"
              >
                Assign Task
              </button>
            </form>
          </div>

          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Active Portal Account Summary</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-[11px] font-semibold text-emerald-700">Active Customers</div>
                <div className="text-xl font-extrabold text-slate-900">
                  {customerAccounts.filter((c) => c.status === 'Active').length} / {customerAccounts.length}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                <div className="text-[11px] font-semibold text-[#8B1E2D]">Active Staff & Admin</div>
                <div className="text-xl font-extrabold text-slate-900">
                  {users.filter((u) => u.status === 'Active').length} / {users.length}
                </div>
              </div>
            </div>
            <div className="pt-2">
              <div className="text-xs font-bold text-slate-800 mb-2">Recent Staff Tasks ({staffTasks.length})</div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {staffTasks.map((t) => (
                  <div key={t.id} className="p-2.5 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{t.title}</div>
                      <div className="text-[11px] text-slate-500">Assigned to {t.staffName} ({t.staffId})</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmResetPassword}
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900">
              Reset Password — {resetTarget.name}
            </h3>
            <p className="text-xs text-slate-500">
              The new password will be hashed immediately with PBKDF2/SHA-256 and saved locally.
            </p>
            <input
              type="password"
              required
              minLength={6}
              value={resetPwdInput}
              onChange={(e) => setResetPwdInput(e.target.value)}
              placeholder="Enter new password (min 6 chars)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setResetTarget(null);
                  setResetPwdInput('');
                }}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-[#8B1E2D] text-white text-xs font-bold cursor-pointer"
              >
                Save New Password
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
