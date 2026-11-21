import React, { useState } from 'react';
import {
  ArrowLeft,
  Users,
  UserCheck,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';

export const StaffLoginView: React.FC = () => {
  const { setPortalStage, loginStaffOrAdmin } = useVyapar();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setForgotOpen(false);
    setIsSubmitting(true);
    try {
      const res = await loginStaffOrAdmin(identifier, password);
      if (!res.success) {
        setErrorMsg(res.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillCredential = (id: string, pwd: string) => {
    setErrorMsg(null);
    setIdentifier(id);
    setPassword(pwd);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white via-[#FFF8F8] to-[#FCE8EA] flex flex-col justify-between relative overflow-x-hidden select-none font-sans">
      {/* Top Bar Back Button */}
      <div className="w-full max-w-5xl mx-auto px-6 pt-5 flex items-center justify-between z-10">
        <button
          type="button"
          onClick={() => setPortalStage('welcome')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#8B1E2D] hover:text-[#68121E] px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <div className="text-xs font-medium text-slate-500">
          Staff & Admin Portal — Business Manager 360
        </div>
      </div>

      {/* Main 2-Column Card matching Screen 3 */}
      <main className="flex-1 flex items-center justify-center px-6 py-6 z-10">
        <div className="w-full max-w-4xl bg-white/95 rounded-2xl shadow-xl shadow-rose-900/10 border border-rose-100 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left Column: Staff Login Form */}
          <div className="md:col-span-7 p-7 sm:p-10 flex flex-col justify-center">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-[#8B1E2D] text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-rose-900/20">
                <Users className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Staff Login</h1>
              <p className="text-xs text-slate-500 mt-1">Sign in to your staff account</p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#B91C1C]" />
                <span>{errorMsg}</span>
              </div>
            )}

            {forgotOpen && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                <span>
                  Self-service staff password reset is disabled for security. Contact your Store Administrator to reset your credentials or reactivate your Staff ID.
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Staff ID or Email
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. ST001, OWNER-01, or email"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#8B1E2D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter staff password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#8B1E2D]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-[#8B1E2D] hover:bg-[#731825] disabled:opacity-60 text-white text-sm font-bold shadow-md shadow-rose-900/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>{isSubmitting ? 'Authenticating...' : 'Login'}</span>
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setForgotOpen((prev) => !prev)}
                  className="text-[#8B1E2D] hover:underline font-semibold cursor-pointer"
                >
                  Forgot Password?
                </button>
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#8B1E2D]" />
                  No public staff signup
                </span>
              </div>
            </form>

            {/* Quick Credential Fill Buttons for Testing (Never bypasses password hash verification) */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="text-[11px] font-semibold text-slate-500 mb-2">
                Fill Role Portal Credentials:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => fillCredential('OWNER-01', 'owner@password123')}
                  className="px-2.5 py-2 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-left transition-colors cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-[#8B1E2D]">OWNER-01</div>
                  <div className="text-[10px] text-slate-600 truncate">Store Admin</div>
                </button>
                <button
                  type="button"
                  onClick={() => fillCredential('DEL001', 'delivery@password123')}
                  className="px-2.5 py-2 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-100 text-left transition-colors cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-[#8B1E2D]">DEL001</div>
                  <div className="text-[10px] text-slate-600 truncate">Delivery Boy</div>
                </button>
                <button
                  type="button"
                  onClick={() => fillCredential('OMGR001', 'manager@password123')}
                  className="px-2.5 py-2 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-left transition-colors cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-[#1D63ED]">OMGR001</div>
                  <div className="text-[10px] text-slate-600 truncate">Online Manager</div>
                </button>
                <button
                  type="button"
                  onClick={() => fillCredential('SEL001', 'seller@password123')}
                  className="px-2.5 py-2 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-left transition-colors cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-[#1D63ED]">SEL001</div>
                  <div className="text-[10px] text-slate-600 truncate">Seller (Both)</div>
                </button>
                <button
                  type="button"
                  onClick={() => fillCredential('SEL002', 'seller@password123')}
                  className="px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-slate-800">SEL002</div>
                  <div className="text-[10px] text-slate-600 truncate">Wholesale Only</div>
                </button>
                <button
                  type="button"
                  onClick={() => fillCredential('SEL003', 'seller@password123')}
                  className="px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-slate-800">SEL003</div>
                  <div className="text-[10px] text-slate-600 truncate">Retail Only</div>
                </button>
                <button
                  type="button"
                  onClick={() => fillCredential('ST001', 'staff@password123')}
                  className="px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-slate-800">ST001</div>
                  <div className="text-[10px] text-slate-600 truncate">Neha (Staff)</div>
                </button>
                <button
                  type="button"
                  onClick={() => fillCredential('EMP-1003', 'cashier@password123')}
                  className="px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-slate-800">EMP-1003</div>
                  <div className="text-[10px] text-slate-600 truncate">Cashier</div>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Staff Access Badge Illustration matching Screen 3 */}
          <div className="md:col-span-5 bg-gradient-to-br from-[#FFF5F5] to-[#FCE8EA] border-t md:border-t-0 md:border-l border-rose-100 p-8 flex flex-col items-center justify-center text-center">
            <svg viewBox="0 0 200 200" className="w-44 h-44 mb-4" aria-hidden="true">
              <circle cx="100" cy="100" r="84" fill="#FEE2E2" />
              {/* Head */}
              <circle cx="96" cy="70" r="24" fill="#FDBA74" />
              <path
                d="M72 68 C72 48 120 48 120 68 C114 58 78 58 72 68 Z"
                fill="#1E293B"
              />
              {/* Suit Body */}
              <path
                d="M52 156 C52 122 72 108 96 108 C120 108 140 122 140 156 Z"
                fill="#8B1E2D"
              />
              <polygon points="96,108 86,128 96,154 106,128" fill="#FFFFFF" />
              <polygon points="96,112 91,126 96,144 101,126" fill="#B91C1C" />
              {/* Green Security Shield */}
              <path
                d="M144 106 L166 114 V134 C166 150 156 161 144 166 C132 161 122 150 122 134 V114 Z"
                fill="#10B981"
                stroke="#FFFFFF"
                strokeWidth="3"
              />
              <path
                d="M135 135 L142 142 L154 128"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <h2 className="text-lg font-extrabold text-slate-900">Staff Access Only</h2>
            <p className="text-xs font-semibold text-[#8B1E2D] mt-1">Authorized Personnel</p>
            <p className="text-[11px] text-slate-600 mt-3 max-w-[210px] leading-relaxed">
              Staff credentials are issued and managed exclusively by the Store Administrator.
            </p>
          </div>
        </div>
      </main>

      {/* Bottom Wave */}
      <div className="w-full overflow-hidden leading-none pointer-events-none">
        <svg viewBox="0 0 1440 90" preserveAspectRatio="none" className="w-full h-12 sm:h-16 block">
          <path
            d="M0,45 C420,95 920,10 1440,55 L1440,90 L0,90 Z"
            fill="#8B1E2D"
            fillOpacity="0.22"
          />
        </svg>
      </div>
    </div>
  );
};
