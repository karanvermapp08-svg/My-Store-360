import React, { useState } from 'react';
import {
  X,
  Lock,
  User,
  Mail,
  Phone,
  Shield,
  Key,
  LogOut,
  Send,
  UserCheck,
  CheckCircle2,
  Building,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';

export const UserAuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    authModalTab,
    setAuthModalTab,
    currentUser,
    users,
    roles,
    login,
    register,
    logout,
    switchUser,
    inviteUser,
    showToast,
  } = useVyapar();

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [selectedLoginRole, setSelectedLoginRole] = useState(roles[0]?.name || 'Owner');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRoleId, setRegRoleId] = useState(roles[3]?.id || 'role-cashier');
  const [regDepartment, setRegDepartment] = useState('Billing & Counter');

  // Invite form state
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');
  const [invRoleId, setInvRoleId] = useState(roles[3]?.id || 'role-cashier');
  const [invDepartment, setInvDepartment] = useState('Billing & Counter');

  if (!isAuthModalOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      showToast('Please enter both email/username and password');
      return;
    }
    const success = login(loginEmail.trim(), loginPassword.trim(), selectedLoginRole);
    if (success) {
      setIsAuthModalOpen(false);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPhone.trim() || !regPassword.trim()) {
      showToast('Please fill all required registration fields including password');
      return;
    }
    const success = register(regName.trim(), regEmail.trim(), regPhone.trim(), regPassword.trim(), regRoleId, regDepartment);
    if (success) {
      setIsAuthModalOpen(false);
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invEmail || !invName) {
      showToast('Please provide invitee name and email address');
      return;
    }
    const role = roles.find((r) => r.id === invRoleId) || roles[3];
    inviteUser({
      name: invName,
      email: invEmail,
      roleId: role.id,
      roleName: role.name,
      department: invDepartment,
      invitedBy: `${currentUser?.name || 'Administrator'} (${currentUser?.roleName || 'Owner'})`,
    });
    setInvEmail('');
    setInvName('');
    setIsAuthModalOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg flex flex-col overflow-hidden text-xs text-slate-800">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-bold tracking-tight">Staff Authentication &amp; Role Access</h2>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Subtabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 flex items-center gap-3 text-xs font-semibold overflow-x-auto shrink-0">
          <button
            onClick={() => setAuthModalTab('switch')}
            className={`py-2.5 px-2 border-b-2 transition-colors ${
              authModalTab === 'switch'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Switch User Profile
          </button>

          <button
            onClick={() => setAuthModalTab('login')}
            className={`py-2.5 px-2 border-b-2 transition-colors ${
              authModalTab === 'login'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            User Login
          </button>

          <button
            onClick={() => setAuthModalTab('register')}
            className={`py-2.5 px-2 border-b-2 transition-colors ${
              authModalTab === 'register'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Register Staff
          </button>

          <button
            onClick={() => setAuthModalTab('invitations')}
            className={`py-2.5 px-2 border-b-2 transition-colors ${
              authModalTab === 'invitations'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Send Invitation
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto max-h-[75vh]">
          {/* 1. QUICK ROLE / USER SWITCHER */}
          {authModalTab === 'switch' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs">
                <strong>Current Active User:</strong> {currentUser?.name || 'Session Locked'} ({currentUser?.roleName || 'Guest'})
                <span className="block text-[11px] text-blue-700 mt-0.5">
                  Click any profile below to instantly switch session and test the respective permission matrix.
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {users.map((u) => {
                  const isCurrent = Boolean(currentUser && u.id === currentUser.id);
                  const roleObj = roles.find((r) => r.id === u.roleId || r.name === u.roleName);
                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        switchUser(u.id);
                        setIsAuthModalOpen(false);
                      }}
                      className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                        isCurrent
                          ? 'bg-rose-50/70 border-rose-400 font-semibold'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs"
                          style={{ backgroundColor: roleObj?.color || '#3b82f6' }}
                        >
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-slate-900 font-semibold flex items-center gap-2">
                            <span>{u.name}</span>
                            {isCurrent && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-200 text-rose-800">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {u.roleName} | {u.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {roleObj && roleObj.permissions.length === 0 ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                            0 Features (Revoked)
                          </span>
                        ) : (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded text-white"
                            style={{ backgroundColor: roleObj?.color || '#3b82f6' }}
                          >
                            {u.roleName}
                          </span>
                        )}
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <button
                  onClick={() => {
                    logout();
                    setIsAuthModalOpen(false);
                  }}
                  className="flex items-center gap-1.5 text-rose-600 hover:underline font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out Active Session</span>
                </button>

                <button
                  onClick={() => setIsAuthModalOpen(false)}
                  className="px-4 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* 2. USER LOGIN */}
          {authModalTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Email Address or Employee Username
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="e.g. sunil.pos@krishnaenterprises.com"
                    className="w-full bg-[#f8fafc] border border-slate-300 rounded pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#f8fafc] border border-slate-300 rounded pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Login Role</label>
                <select
                  value={selectedLoginRole}
                  onChange={(e) => setSelectedLoginRole(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} {r.isBuiltIn ? '(Built-in)' : '(Custom)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className="px-4 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* 3. REGISTER STAFF */}
          {authModalTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Legal Name *</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full bg-[#f8fafc] border border-slate-300 rounded pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Work Email *</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="ramesh@company.com"
                    className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Mobile Phone *</label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+91 98450 00000"
                    className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Create Password *</label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#f8fafc] border border-slate-300 rounded pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Assigned Role</label>
                  <select
                    value={regRoleId}
                    onChange={(e) => setRegRoleId(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Department</label>
                <select
                  value={regDepartment}
                  onChange={(e) => setRegDepartment(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none"
                >
                  <option value="Billing & Counter">Billing &amp; Counter</option>
                  <option value="Sales & Marketing">Sales &amp; Marketing</option>
                  <option value="Accounts & Finance">Accounts &amp; Finance</option>
                  <option value="Warehouse & Logistics">Warehouse &amp; Logistics</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>

              <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                <span className="font-bold text-amber-700">Notice:</span>
                <span>
                  New registrations require Owner or Administrator approval in the Staff &amp; Roles hub before the account can sign in.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className="px-4 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors"
                >
                  Register Staff Member
                </button>
              </div>
            </form>
          )}

          {/* 4. SEND INVITATION */}
          {authModalTab === 'invitations' && (
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                <strong>Email Staff Invitation:</strong> Send an official invitation token to join your Vyapar team with pre-configured role permissions.
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Invitee Full Name *</label>
                <input
                  type="text"
                  required
                  value={invName}
                  onChange={(e) => setInvName(e.target.value)}
                  placeholder="e.g. Anita Desai"
                  className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Invitee Email Address *</label>
                <input
                  type="email"
                  required
                  value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)}
                  placeholder="anita@example.com"
                  className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Role To Grant</label>
                  <select
                    value={invRoleId}
                    onChange={(e) => setInvRoleId(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Department</label>
                  <select
                    value={invDepartment}
                    onChange={(e) => setInvDepartment(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none"
                  >
                    <option value="Billing & Counter">Billing &amp; Counter</option>
                    <option value="Sales & Marketing">Sales &amp; Marketing</option>
                    <option value="Accounts & Finance">Accounts &amp; Finance</option>
                    <option value="Warehouse & Logistics">Warehouse &amp; Logistics</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className="px-4 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Invite</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
