import React, { useState } from 'react';
import {
  Users,
  Shield,
  Clock,
  Award,
  Lock,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  UserX,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  Building2,
  DollarSign,
  TrendingUp,
  Monitor,
  Smartphone,
  LogOut,
  RefreshCw,
  MoreVertical,
  Edit2,
  Trash2,
  Key,
  ShieldCheck,
  ShieldAlert,
  Check,
  X,
  ChevronDown,
  ArrowRight,
  Send,
  FileDown,
  Printer,
  Copy,
  ArrowRightLeft,
  Archive,
  RotateCcw,
  Percent,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { Employee, RoleDefinition, PermissionKey } from '../types';
import { PERMISSION_GROUPS } from '../utils/rbacDefaults';
import { RoleComparisonModal } from './modals/RoleComparisonModal';

export const StaffManagementView: React.FC = () => {
  const {
    currentUser,
    setActiveTab,
    users,
    roles,
    employees,
    attendanceRecords,
    sessions,
    loginHistory,
    activityLogs,
    invitations,
    sessionTimeoutMinutes,
    setSessionTimeoutMinutes,
    switchUser,
    hasPermission,
    deleteEmployee,
    deleteRole,
    removeAllFeaturesFromRole,
    grantAllFeaturesToRole,
    resetRolesToDefault,
    duplicateRole,
    archiveRole,
    toggleUserBlock,
    approveUser,
    revokeInvitation,
    recordAttendance,
    terminateSession,
    setIsAuthModalOpen,
    setAuthModalTab,
    setIsAddEmployeeModalOpen,
    setSelectedEmployee,
    setIsRoleEditorModalOpen,
    setSelectedRole,
    setIsEmployeeDetailModalOpen,
    requestConfirmation,
    addTransaction,
    updateEmployee,
    company,
    showToast,
    exportCurrentViewPdf,
  } = useVyapar();

  const [activeSubTab, setActiveSubTab] = useState<'employees' | 'roles' | 'attendance' | 'performance' | 'security'>('employees');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<string>(roles[0]?.id || 'role-owner');
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareRoleIds, setCompareRoleIds] = useState<string[]>([]);
  const [roleSearchTerm, setRoleSearchTerm] = useState('');
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.designation.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.email.toLowerCase().includes(employeeSearch.toLowerCase());
    const matchesDept = departmentFilter === 'All' || emp.department === departmentFilter;
    const matchesStatus = statusFilter === 'All' || emp.status === statusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  // Performance calculations
  const totalPayroll = employees.reduce((sum, e) => sum + (e.salary || 0), 0);
  const totalSalesByStaff = employees.reduce((sum, e) => sum + (e.totalSalesAchieved || 0), 0);
  const totalCommission = employees.reduce((sum, e) => sum + (e.totalCommissionEarned || 0), 0);
  const activeStaffCount = employees.filter((e) => e.status === 'Active').length;

  const currentMatrixRole = roles.find((r) => r.id === selectedRoleForMatrix) || roles[0];

  return (
    <div className="flex-1 flex flex-col bg-[#f0f4f9] overflow-hidden select-none text-xs text-slate-800">
      {/* 1. Header with Role & Security Badges */}
      <div className="bg-white px-6 py-3.5 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0f172a] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-rose-600" />
              <span>Staff, Roles &amp; Security Hub</span>
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Role: <strong className="text-rose-600">{currentUser?.roleName || 'Owner'}</strong>
            </span>
            {currentUser?.roleName === 'Owner' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                FULL ACCESS (ROOT)
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            Role-based access control (RBAC), multi-user staff permissions, shift attendance &amp; audit trails
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Export PDF Button */}
          <button
            onClick={() => exportCurrentViewPdf()}
            title="Export Staff & Attendance Report as PDF"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>

          {/* Quick Role Switcher / User Login */}
          <button
            onClick={() => {
              setAuthModalTab('switch');
              setIsAuthModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            <Key className="w-3.5 h-3.5 text-blue-600" />
            <span>Switch User / Role</span>
          </button>

          {/* Audit Log Quick Link */}
          <button
            onClick={() => setActiveTab('audit-log')}
            title="Open Dedicated Invoice & Action Audit Trail"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs text-rose-700 bg-rose-50 border border-rose-300 hover:bg-rose-100 transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>Audit Trail &amp; Diffs</span>
          </button>

          {/* + Add Employee */}
          <button
            onClick={() => {
              if (!hasPermission('create') && currentUser?.roleName !== 'Owner') {
                showToast('Permission denied: You do not have "Create" permission.');
                return;
              }
              setSelectedEmployee(null);
              setIsAddEmployeeModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md font-semibold text-xs text-white bg-rose-600 hover:bg-rose-700 shadow-2xs transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* 2. Sub-tab Navigation */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 flex items-center gap-8 shrink-0 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveSubTab('employees')}
          className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeSubTab === 'employees'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Employees ({employees.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('roles')}
          className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeSubTab === 'roles'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Roles &amp; Permissions ({roles.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('attendance')}
          className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeSubTab === 'attendance'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Attendance &amp; Shifts</span>
        </button>

        <button
          onClick={() => setActiveSubTab('performance')}
          className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeSubTab === 'performance'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Commission &amp; Performance</span>
        </button>

        <button
          onClick={() => setActiveSubTab('security')}
          className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeSubTab === 'security'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Security, Sessions &amp; Audit ({activityLogs.length})</span>
        </button>
      </div>

      {/* 3. Sub-tab Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* ======================================================== */}
        {/* TAB 1: EMPLOYEES DIRECTORY */}
        {/* ======================================================== */}
        {activeSubTab === 'employees' && (
          <div className="space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-500 font-medium">Total Staff Members</span>
                <div className="text-2xl font-bold text-slate-900 mt-1">{employees.length}</div>
                <span className="text-[11px] text-emerald-600 mt-1 block font-medium">
                  {activeStaffCount} Active on Duty
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-500 font-medium">Monthly Payroll Base</span>
                <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                  ₹ {totalPayroll.toLocaleString('en-IN')}
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">Excluding commissions</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-500 font-medium">Total Staff Sales</span>
                <div className="text-2xl font-bold text-emerald-600 mt-1 tabular-nums">
                  ₹ {totalSalesByStaff.toLocaleString('en-IN')}
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">Attributed to staff</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-500 font-medium">Commissions Earned</span>
                <div className="text-2xl font-bold text-blue-600 mt-1 tabular-nums">
                  ₹ {totalCommission.toLocaleString('en-IN')}
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">Payout tracking</span>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="relative w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder="Search by ID, name, designation..."
                  className="w-full bg-[#f8fafc] border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="text-slate-400">Department:</span>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="bg-[#f8fafc] border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none"
                  >
                    <option value="All">All Departments</option>
                    <option value="Sales & Marketing">Sales &amp; Marketing</option>
                    <option value="Accounts & Finance">Accounts &amp; Finance</option>
                    <option value="Billing & Counter">Billing &amp; Counter</option>
                    <option value="Warehouse & Logistics">Warehouse &amp; Logistics</option>
                    <option value="Operations">Operations</option>
                    <option value="Procurement">Procurement</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="text-slate-400">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-[#f8fafc] border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none"
                  >
                    <option value="All">All Status</option>
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Probation">Probation</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </div>

                <button
                  onClick={() => {
                    setAuthModalTab('invitations');
                    setIsAuthModalOpen(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                >
                  <Send className="w-3 h-3" />
                  <span>Send Staff Invite</span>
                </button>
              </div>
            </div>

            {/* Employee Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                    <th className="py-2.5 px-4">Employee ID</th>
                    <th className="py-2.5 px-4">Employee Profile</th>
                    <th className="py-2.5 px-4">Role &amp; Department</th>
                    <th className="py-2.5 px-4">Designation</th>
                    <th className="py-2.5 px-4">Joining Date</th>
                    <th className="py-2.5 px-4 text-right">Base Salary</th>
                    <th className="py-2.5 px-4 text-right">Commission Rate</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No employees match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const matchedRole = roles.find((r) => r.id === emp.roleId);
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {emp.employeeId}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {emp.avatar ? (
                                <img
                                  src={emp.avatar}
                                  alt={emp.name}
                                  className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                                  {emp.name.charAt(0)}
                                </div>
                              )}
                              <div>
                                <div className="font-semibold text-slate-900">{emp.name}</div>
                                <div className="text-[11px] text-slate-400">{emp.phone}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold text-white tracking-wide"
                              style={{ backgroundColor: matchedRole?.color || '#0284c7' }}
                            >
                              {emp.roleName}
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">{emp.department}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-medium">{emp.designation}</td>
                          <td className="py-3 px-4 text-slate-500 tabular-nums">{emp.joiningDate}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                            ₹ {emp.salary.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-700 tabular-nums font-semibold">
                            {emp.commissionRatePercent}%
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                emp.status === 'Active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : emp.status === 'On Leave'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {emp.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* View Profile */}
                              <button
                                onClick={() => {
                                  setSelectedEmployee(emp);
                                  setIsEmployeeDetailModalOpen(true);
                                }}
                                title="View Employee Profile & Performance"
                                className="p-1 rounded text-blue-600 hover:bg-blue-50"
                              >
                                <Briefcase className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit Employee */}
                              <button
                                onClick={() => {
                                  if (!hasPermission('edit') && currentUser?.roleName !== 'Owner') {
                                    showToast('Permission denied: You do not have "Edit" permission.');
                                    return;
                                  }
                                  setSelectedEmployee(emp);
                                  setIsAddEmployeeModalOpen(true);
                                }}
                                title="Edit Employee Details"
                                className="p-1 rounded text-slate-500 hover:bg-slate-100"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Employee */}
                              <button
                                onClick={() => {
                                  if (!hasPermission('delete') && currentUser?.roleName !== 'Owner') {
                                    showToast('Permission denied: You do not have "Delete" permission.');
                                    return;
                                  }
                                  requestConfirmation({
                                    title: 'Remove Employee Profile',
                                    message: `Remove employee profile ${emp.name} (${emp.employeeId})?`,
                                    confirmLabel: 'Remove Employee',
                                    variant: 'danger',
                                    onConfirm: () => deleteEmployee(emp.id),
                                  });
                                }}
                                title="Delete Employee Profile"
                                className="p-1 rounded text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: ROLES & GRANULAR PERMISSIONS MATRIX */}
        {/* ======================================================== */}
        {activeSubTab === 'roles' && (
          <div className="space-y-6">
            {/* Top Info Banner & Actions */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-600" />
                  <span>Billing RBAC & Security Matrix (9 Core Roles + Custom)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Multi-tenant billing roles with configurable discount ceilings, refund authorization thresholds, invoice protection, and financial cost isolation.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search roles..."
                    value={roleSearchTerm}
                    onChange={(e) => setRoleSearchTerm(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500 w-44"
                  />
                </div>

                <button
                  onClick={() => {
                    setCompareRoleIds(['role-owner', 'role-cashier']);
                    setIsCompareModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 transition-colors shadow-2xs"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Compare Roles</span>
                </button>

                <button
                  onClick={resetRolesToDefault}
                  title="Restore default permissions and settings for all roles"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                  <span>Reset All to Defaults</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedRole(null);
                    setIsRoleEditorModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold text-xs text-white bg-purple-600 hover:bg-purple-700 shadow-2xs transition-colors"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Create Custom Role</span>
                </button>
              </div>
            </div>

            {/* Role Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {roles
                .filter(
                  (r) =>
                    !roleSearchTerm ||
                    r.name.toLowerCase().includes(roleSearchTerm.toLowerCase()) ||
                    r.description.toLowerCase().includes(roleSearchTerm.toLowerCase())
                )
                .map((role) => {
                  const isSelected = role.id === selectedRoleForMatrix;
                  const assignedCount = employees.filter((e) => e.role === role.name).length;
                  const riskTier = role.riskTier || 'Standard';

                  return (
                    <div
                      key={role.id}
                      onClick={() => setSelectedRoleForMatrix(role.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden flex flex-col justify-between ${
                        isSelected
                          ? 'bg-purple-50/40 border-purple-400 shadow-xs ring-1 ring-purple-300'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                      }`}
                    >
                      {/* Top Accent Strip */}
                      <div
                        className="absolute top-0 left-0 right-0 h-1"
                        style={{ backgroundColor: role.color }}
                      />

                      <div>
                        {/* Header: Role Name, Level & Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                              style={{ backgroundColor: role.color }}
                            />
                            <div>
                              <h3 className="font-bold text-sm text-slate-900 leading-tight">
                                {role.name}
                              </h3>
                              <span className="text-[10px] text-slate-400 font-medium">
                                Level {role.privilegeLevel || 1} Privilege
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Risk Tier Badge */}
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                riskTier === 'Critical'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : riskTier === 'High'
                                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                                  : riskTier === 'Moderate'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {riskTier}
                            </span>

                            {/* Built-in vs Custom Badge */}
                            {role.isBuiltIn ? (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                Built-in
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">
                                Custom
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                          {role.description}
                        </p>

                        {/* Metadata Grid */}
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <div>
                            <span className="text-slate-400 block">Assigned Staff</span>
                            <strong className="text-slate-800 font-bold">
                              {assignedCount} {assignedCount === 1 ? 'Employee' : 'Employees'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Branch Scope</span>
                            <strong className="text-slate-800 font-bold capitalize truncate block">
                              {(role.branchScope || 'assigned_branch_only').replace(/_/g, ' ')}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Max Discount</span>
                            <strong className="text-slate-800 font-bold">
                              {role.maxDiscountPercent !== undefined ? `${role.maxDiscountPercent}%` : '0%'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Refund Limit</span>
                            <strong className="text-slate-800 font-bold">
                              {role.maxRefundAmountWithoutApproval ? `₹${role.maxRefundAmountWithoutApproval.toLocaleString()}` : 'Approval Req.'}
                            </strong>
                          </div>
                        </div>

                        {/* Audit Stamp */}
                        <div className="mt-2 text-[9px] text-slate-400 flex items-center justify-between">
                          <span>
                            Modified: {role.lastModified || '2026-10-28'} by {role.modifiedBy || 'System'}
                          </span>
                          <span
                            className={
                              role.canViewPurchasePrice ? 'text-emerald-600 font-semibold' : 'text-slate-400'
                            }
                          >
                            {role.canViewPurchasePrice ? '• Cost Visible' : '• Cost Hidden'}
                          </span>
                        </div>
                      </div>

                      {/* Card Action Buttons Bar */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          {/* Active Features Count or Removed badge */}
                          {role.permissions.length === 0 ? (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              0 Features (Removed)
                            </span>
                          ) : (
                            <span className="text-slate-600 font-semibold text-[10px]">
                              {role.permissions.length} Features
                            </span>
                          )}

                          {/* Quick Toggle: Remove All / Grant All */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (role.permissions.length > 0) {
                                removeAllFeaturesFromRole(role.id);
                              } else {
                                grantAllFeaturesToRole(role.id);
                              }
                            }}
                            title={
                              role.permissions.length > 0
                                ? `Remove all features from ${role.name}`
                                : `Grant all features to ${role.name}`
                            }
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                              role.permissions.length === 0
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                            }`}
                          >
                            {role.permissions.length === 0 ? '+ Grant All' : 'Remove All'}
                          </button>
                        </div>

                        {/* Action Tools */}
                        <div className="flex items-center gap-1">
                          {/* Compare Action */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompareRoleIds([role.id, roles.find((r) => r.id !== role.id)?.id || '']);
                              setIsCompareModalOpen(true);
                            }}
                            title={`Compare ${role.name} with another role`}
                            className="p-1 rounded text-purple-600 hover:bg-purple-50 transition-colors"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>

                          {/* Duplicate Action */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateRole(role.id);
                            }}
                            title={`Duplicate ${role.name} into a custom role`}
                            className="p-1 rounded text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Action */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRole(role);
                              setIsRoleEditorModalOpen(true);
                            }}
                            title="Edit Role & Permissions"
                            className="p-1 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete or Archive if custom */}
                          {!role.isBuiltIn && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                requestConfirmation({
                                  title: 'Delete Custom Role',
                                  message: `Delete custom role "${role.name}"? Staff assigned to this role should be reassigned.`,
                                  confirmLabel: 'Delete Role',
                                  variant: 'danger',
                                  onConfirm: () => { deleteRole(role.id); },
                                });
                              }}
                              title="Delete Custom Role"
                              className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Detailed Permission Matrix for the Selected Role */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: currentMatrixRole.color }}
                  />
                  <h3 className="text-base font-bold text-slate-900">
                    Permissions for: {currentMatrixRole.name}
                  </h3>
                  <span className="text-xs text-slate-400">
                    ({currentMatrixRole.permissions.length} granted)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      requestConfirmation({
                        title: 'Revoke All Role Permissions',
                        message: `Remove all features and revoke all permissions from role "${currentMatrixRole.name}"?`,
                        confirmLabel: 'Remove All Features',
                        variant: 'danger',
                        onConfirm: () => removeAllFeaturesFromRole(currentMatrixRole.id),
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Remove All Features</span>
                  </button>

                  <button
                    onClick={() => grantAllFeaturesToRole(currentMatrixRole.id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Grant All Features</span>
                  </button>

                  <button
                    onClick={resetRolesToDefault}
                    title="Restore default permissions for all roles"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-semibold text-xs transition-colors"
                  >
                    ↺ Reset Roles
                  </button>

                  <button
                    onClick={() => {
                      setSelectedRole(currentMatrixRole);
                      setIsRoleEditorModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-semibold text-xs transition-colors"
                  >
                    Edit Role
                  </button>
                </div>
              </div>

              {currentMatrixRole.permissions.length === 0 && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <div>
                      <strong className="font-bold text-xs">All features have been removed for role "{currentMatrixRole.name}"!</strong>
                      <p className="text-[11px] text-rose-700">Staff assigned to this role currently have zero feature permissions.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => grantAllFeaturesToRole(currentMatrixRole.id)}
                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
                  >
                    Grant All Features Back
                  </button>
                </div>
              )}

              {/* Grouped Permission Checklist */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2.5">
                    <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                      <span>{group.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {group.permissions.filter((p) => currentMatrixRole.permissions.includes(p.key)).length} / {group.permissions.length}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">{group.description}</p>

                    <div className="space-y-1.5 pt-1">
                      {group.permissions.map((perm) => {
                        const hasPerm = currentMatrixRole.permissions.includes(perm.key);
                        return (
                          <div
                            key={perm.key}
                            className={`p-2 rounded border flex items-start gap-2 ${
                              hasPerm
                                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                : 'bg-white border-slate-200 text-slate-400'
                            }`}
                          >
                            <div className="mt-0.5">
                              {hasPerm ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-[11px]">{perm.label}</div>
                              <div className="text-[10px] opacity-80 leading-tight">
                                {perm.description}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: ATTENDANCE & DAILY SHIFTS */}
        {/* ======================================================== */}
        {activeSubTab === 'attendance' && (
          <div className="space-y-5">
            {/* Quick Punch Bar for Active User */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Live Shift Attendance Terminal
                  </h2>
                  <p className="text-xs text-slate-500">
                    Today: {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const emp = (currentUser && employees.find((e) => e.email.toLowerCase() === currentUser.email.toLowerCase())) || employees[0];
                    if (emp) recordAttendance(emp.employeeId, 'IN');
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs transition-colors"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Punch IN (Shift Start)</span>
                </button>

                <button
                  onClick={() => {
                    const emp = (currentUser && employees.find((e) => e.email.toLowerCase() === currentUser.email.toLowerCase())) || employees[0];
                    if (emp) recordAttendance(emp.employeeId, 'OUT');
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md font-semibold text-xs text-white bg-slate-700 hover:bg-slate-800 shadow-2xs transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Punch OUT (Shift End)</span>
                </button>
              </div>
            </div>

            {/* Attendance Roster Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase">
                  Daily Team Attendance Log ({attendanceRecords.length} Entries)
                </h3>
                <span className="text-[11px] text-slate-400">Automatic biometric &amp; POS shift sync</span>
              </div>

              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Employee ID</th>
                    <th className="py-2.5 px-4">Employee Name</th>
                    <th className="py-2.5 px-4">Punch In Time</th>
                    <th className="py-2.5 px-4">Punch Out Time</th>
                    <th className="py-2.5 px-4">Working Hours</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Shift Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceRecords.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-600 tabular-nums">{att.date}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{att.employeeId}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{att.employeeName}</td>
                      <td className="py-3 px-4 text-emerald-600 font-bold tabular-nums">
                        {att.punchInTime}
                      </td>
                      <td className="py-3 px-4 text-slate-700 tabular-nums">
                        {att.punchOutTime || (
                          <span className="text-amber-600 font-semibold italic">On Shift (Active)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 tabular-nums">{att.workingHours} hrs</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            att.status === 'Present'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : att.status === 'Late'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {att.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{att.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: COMMISSION & SALES PERFORMANCE */}
        {/* ======================================================== */}
        {activeSubTab === 'performance' && (
          <div className="space-y-5">
            {/* Top Leaderboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {employees
                .filter((e) => e.totalSalesAchieved > 0)
                .sort((a, b) => b.totalSalesAchieved - a.totalSalesAchieved)
                .slice(0, 3)
                .map((star, idx) => (
                  <div
                    key={star.id}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs relative overflow-hidden"
                  >
                    <div className="absolute top-2 right-2 text-2xl font-black text-slate-100">
                      #{idx + 1}
                    </div>
                    <div className="flex items-center gap-3">
                      {star.avatar ? (
                        <img
                          src={star.avatar}
                          alt={star.name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center">
                          {star.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-900">{star.name}</div>
                        <div className="text-[11px] text-slate-400">{star.designation}</div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Total Revenue</span>
                        <strong className="text-slate-900 font-bold tabular-nums">
                          ₹ {star.totalSalesAchieved.toLocaleString('en-IN')}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Commission ({star.commissionRatePercent}%)</span>
                        <strong className="text-emerald-600 font-bold tabular-nums">
                          ₹ {star.totalCommissionEarned.toLocaleString('en-IN')}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Performance Matrix Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase">
                  Staff Sales Performance &amp; Commission Ledger
                </h3>
                <span className="text-[11px] text-slate-400">Automatic incentive calculation on closed invoices</span>
              </div>

              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                    <th className="py-2.5 px-4">Staff Member</th>
                    <th className="py-2.5 px-4">Role / Dept</th>
                    <th className="py-2.5 px-4 text-center">Orders Handled</th>
                    <th className="py-2.5 px-4 text-right">Closed Sales Amount</th>
                    <th className="py-2.5 px-4 text-right">Commission Rate</th>
                    <th className="py-2.5 px-4 text-right">Total Commission</th>
                    <th className="py-2.5 px-4 text-center">Customer Rating</th>
                    <th className="py-2.5 px-4 text-right">Payout Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {emp.name}
                        <span className="block text-[10px] text-slate-400 font-normal">{emp.employeeId}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {emp.roleName}
                        <span className="block text-[10px] text-slate-400">{emp.department}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {emp.ordersHandled}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                        ₹ {emp.totalSalesAchieved.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 font-semibold">
                        {emp.commissionRatePercent}%
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 tabular-nums">
                        ₹ {emp.totalCommissionEarned.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">
                          ★ {emp.rating}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            const amount = Math.round((emp.totalCommissionEarned || 0) * 100) / 100;
                            if (amount <= 0) {
                              showToast(`No unpaid commission balance due for ${emp.name}.`, 'warning');
                              return;
                            }
                            requestConfirmation({
                              title: 'Settle Staff Commission Payout',
                              message: `Record an Expense payout voucher of ₹${amount.toLocaleString('en-IN')} to ${emp.name} (${emp.employeeId}) via Bank Transfer and clear pending commission balance?`,
                              confirmLabel: `Pay ₹${amount.toLocaleString('en-IN')}`,
                              variant: 'primary',
                              onConfirm: () => {
                                const todayStr = new Date().toLocaleDateString('en-GB');
                                addTransaction({
                                  type: 'Expense',
                                  invoiceNo: `COMM-${Date.now().toString().slice(-5)}`,
                                  date: todayStr,
                                  dueDate: todayStr,
                                  partyName: emp.name,
                                  partyPhone: emp.phone,
                                  firm: company.name || 'MY STORE',
                                  user: currentUser?.name || 'Admin',
                                  paymentType: 'Bank Transfer',
                                  totalAmount: amount,
                                  receivedAmount: amount,
                                  balance: 0,
                                  status: 'Paid',
                                  items: [
                                    {
                                      id: `comm-li-${Date.now()}`,
                                      name: `Staff Commission Payout — ${emp.name} (${emp.employeeId})`,
                                      hsn: '9985',
                                      qty: 1,
                                      unit: 'VOUCHER',
                                      price: amount,
                                      discountPercent: 0,
                                      taxPercent: 0,
                                      amount,
                                    },
                                  ],
                                  notes: `Commission settlement for ${emp.ordersHandled} handled order(s) @ ${emp.commissionRatePercent}%`,
                                });
                                updateEmployee(emp.id, { totalCommissionEarned: 0 });
                                showToast(`Commission payout of ₹${amount.toLocaleString('en-IN')} posted to Expenses & cleared for ${emp.name}.`, 'success');
                              },
                            });
                          }}
                          className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 font-semibold text-[11px] transition-colors cursor-pointer"
                        >
                          Settle Payout
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: SECURITY, SESSIONS & ACTIVITY AUDIT */}
        {/* ======================================================== */}
        {activeSubTab === 'security' && (
          <div className="space-y-6">
            {/* Session Timeout Settings Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Security &amp; Session Inactivity Timeout</h3>
                  <p className="text-xs text-slate-500">
                    Automatically lock POS &amp; desktop console after inactive period for cashier/terminal security
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">Lock console after:</span>
                <select
                  value={sessionTimeoutMinutes}
                  onChange={(e) => {
                    const mins = Number(e.target.value);
                    setSessionTimeoutMinutes(mins);
                    showToast(`Session timeout set to ${mins === 0 ? 'Never' : `${mins} minutes`}`);
                  }}
                  className="bg-[#f8fafc] border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-purple-500"
                >
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes (Recommended)</option>
                  <option value={60}>1 Hour</option>
                  <option value={240}>4 Hours</option>
                  <option value={480}>8 Hours (Full Shift)</option>
                  <option value={0}>Never (Keep Active)</option>
                </select>
              </div>
            </div>

            {/* Active Device Sessions */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase">
                  Active Device Logins &amp; Sessions ({sessions.length})
                </h3>
                <span className="text-[11px] text-slate-400">Multi-device real-time sync</span>
              </div>

              <div className="divide-y divide-slate-100">
                {sessions.map((sess) => (
                  <div key={sess.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                        {sess.device.includes('Android') ? (
                          <Smartphone className="w-4 h-4" />
                        ) : (
                          <Monitor className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                          <span>{sess.device}</span>
                          {sess.isCurrent && (
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                              THIS DEVICE
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          User: <strong className="text-slate-700">{sess.userName}</strong> | IP: {sess.ipAddress} | Location: {sess.location}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-right">
                        <span className="text-slate-400 text-[10px] block">Login Time</span>
                        <span className="text-slate-700 font-medium">{sess.loginTime}</span>
                      </div>

                      {sess.status === 'Active' ? (
                        <button
                          onClick={() => terminateSession(sess.id)}
                          className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-semibold text-[11px]"
                        >
                          Terminate
                        </button>
                      ) : (
                        <span className="text-slate-400 italic">Terminated</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* User Approvals & Blocking Management */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase">
                  User Accounts, Access Approvals &amp; Blocking
                </h3>
                <span className="text-[11px] text-slate-400">Control who can access the enterprise console</span>
              </div>

              <div className="divide-y divide-slate-100">
                {users.map((u) => (
                  <div key={u.id} className="p-3.5 px-5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <span>{u.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {u.roleName}
                        </span>
                        {u.status === 'Blocked' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            BLOCKED
                          </span>
                        )}
                        {!u.isApproved && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            PENDING APPROVAL
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {u.email} | Last Active: {u.lastLogin}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!u.isApproved && (
                        <button
                          onClick={() => approveUser(u.id)}
                          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors"
                        >
                          Approve Registration
                        </button>
                      )}

                      {u.roleName !== 'Owner' && (
                        <button
                          onClick={() => toggleUserBlock(u.id)}
                          className={`px-3 py-1 rounded font-semibold text-xs transition-colors ${
                            u.status === 'Blocked'
                              ? 'bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          {u.status === 'Blocked' ? 'Unblock User' : 'Block User'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit Trail: Activity Logs */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase">
                    Enterprise Audit Trail &amp; Activity Log
                  </h3>
                  <span className="text-[11px] text-slate-400">Tamper-evident system activity ledger</span>
                </div>
                <button
                  onClick={() => setActiveTab('audit-log')}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-rose-600" />
                  <span>Open Full Forensic View &amp; State Diffs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {activityLogs.map((log) => (
                  <div key={log.id} className="p-3 px-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900">
                          {log.action}
                          <span className="ml-2 font-normal text-[11px] text-slate-500">
                            in <strong className="text-slate-700">{log.module}</strong>
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">{log.details}</div>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-slate-400 shrink-0">
                      <div>By: <strong className="text-slate-700">{log.userName}</strong> ({log.role})</div>
                      <div>{log.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Role Comparison Modal */}
      <RoleComparisonModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        initialRoleIds={compareRoleIds}
      />
    </div>
  );
};
