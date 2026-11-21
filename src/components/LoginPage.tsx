import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';

export const LoginPage: React.FC = () => {
  const { login, users, showToast } = useVyapar();
  const [roleIdInput, setRoleIdInput] = useState('OWNER-01');
  const [passwordInput, setPasswordInput] = useState('owner@password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleIdInput.trim()) {
      showToast('Please enter Role ID / Employee ID or email');
      return;
    }
    const success = login(roleIdInput.trim(), passwordInput);
    if (!success) {
      // If direct login failed, try matching against users by roleId or email
      const matched = users.find(
        (u) =>
          u.employeeId?.toLowerCase() === roleIdInput.trim().toLowerCase() ||
          u.email.toLowerCase() === roleIdInput.trim().toLowerCase() ||
          u.roleId.toLowerCase() === roleIdInput.trim().toLowerCase()
      );
      if (matched) {
        login(matched.email, matched.password || passwordInput);
      }
    }
  };

  const handleQuickDemoLogin = (id: string, pwd: string, roleName: string) => {
    setRoleIdInput(id);
    setPasswordInput(pwd);
    const success = login(id, pwd);
    if (success) {
      showToast(`Logged in as ${roleName}`);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-900 select-none overflow-hidden font-sans">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200 m-4">
        {/* Left Branding Panel */}
        <div className="w-full md:w-5/12 bg-gradient-to-br from-[#8B1E2D] via-[#961c28] to-[#5a111a] p-8 flex flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-16 -top-16 w-64 h-64 bg-black/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-pink-500 flex items-center justify-center font-bold text-white text-sm shadow-lg">
              360
            </div>
            <div>
              <div className="font-bold text-base tracking-tight">Business Manager 360</div>
              <div className="text-xs text-rose-200">Desktop Enterprise Suite</div>
            </div>
          </div>

          <div className="my-12 relative z-10 text-center">
            <div className="w-24 h-24 rounded-full bg-white/10 mx-auto flex items-center justify-center mb-6 border border-white/20 shadow-2xl backdrop-blur-sm">
              <span className="text-3xl font-black text-amber-300">360</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-2">Manage. Grow. Succeed.</h2>
            <p className="text-xs text-rose-100 max-w-xs mx-auto leading-relaxed">
              Professional GST billing, inventory control, and multi-user role security for Indian enterprises.
            </p>
          </div>

          <div className="text-[11px] text-rose-200/80 text-center relative z-10 flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Secure 256-bit encrypted session</span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="w-full md:w-7/12 p-8 md:p-12 flex flex-col justify-center bg-white">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Login</h1>
            <p className="text-xs text-slate-500">Welcome back! Please login with your Role ID & password.</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Role ID / Employee ID / Email</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={roleIdInput}
                  onChange={(e) => setRoleIdInput(e.target.value)}
                  placeholder="e.g. OWNER-01 or EMP-1001"
                  required
                  className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white text-xs text-slate-800 pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-[#8B1E2D] focus:ring-2 focus:ring-[#8B1E2D]/20 focus:outline-none transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">Password</label>
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    showToast('Contact Store Administrator to reset your password.');
                  }}
                  className="text-[11px] font-semibold text-[#8B1E2D] hover:underline"
                >
                  Forgot Password?
                </a>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white text-xs text-slate-800 pl-10 pr-10 py-3 rounded-xl border border-slate-200 focus:border-[#8B1E2D] focus:ring-2 focus:ring-[#8B1E2D]/20 focus:outline-none transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#8B1E2D] focus:ring-[#8B1E2D]"
                />
                <span className="text-xs text-slate-600 font-medium">Remember Me</span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full bg-[#8B1E2D] hover:bg-[#731825] active:bg-[#5a111a] text-white py-3.5 rounded-xl text-xs font-bold shadow-lg shadow-rose-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Login to Business Manager 360</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Login Pill Bar */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Role Logins:</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('OWNER-01', 'owner@password123', 'Owner')}
                className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all text-left flex flex-col cursor-pointer"
              >
                <span className="text-[10px] text-slate-400 font-mono">OWNER-01</span>
                <span>Owner</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('EMP-1001', 'manager@password123', 'Store Manager')}
                className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all text-left flex flex-col cursor-pointer"
              >
                <span className="text-[10px] text-slate-400 font-mono">EMP-1001</span>
                <span>Manager</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('EMP-1003', 'cashier@password123', 'Cashier')}
                className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all text-left flex flex-col cursor-pointer"
              >
                <span className="text-[10px] text-slate-400 font-mono">EMP-1003</span>
                <span>Cashier</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('EMP-1006', 'delivery@password123', 'Delivery')}
                className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all text-left flex flex-col cursor-pointer"
              >
                <span className="text-[10px] text-slate-400 font-mono">EMP-1006</span>
                <span>Delivery</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
