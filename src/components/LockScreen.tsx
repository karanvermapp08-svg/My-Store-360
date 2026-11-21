import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, ArrowRight, AlertCircle, LogOut } from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';

interface LockScreenProps {
  onUnlock?: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const { currentUser, loginStaffOrAdmin, logout, showToast } = useVyapar();
  const [identifier, setIdentifier] = useState(currentUser?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your Staff ID / Email and password.');
      return;
    }

    setIsSubmitting(true);
    const result = await loginStaffOrAdmin(identifier.trim(), password);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.message || 'Invalid credentials or inactive account.');
      return;
    }

    showToast('Session unlocked');
    onUnlock?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md text-slate-100 flex flex-col items-center justify-center p-4 select-none font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#8B0D1E]/40 via-slate-900 to-slate-950 pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-900/95 rounded-2xl border border-slate-700/80 shadow-2xl p-7 text-xs flex flex-col space-y-5">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#8B0D1E] to-[#C41E3A] text-white flex items-center justify-center shadow-lg shadow-rose-950/50">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Business Manager 360</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Session Locked • Verify password to resume ({currentUser?.name || 'Admin'})
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
              Email or Staff ID
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter email or staff ID"
                className="w-full bg-slate-950/90 border border-slate-700 focus:border-[#C41E3A] rounded-lg pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-slate-950/90 border border-slate-700 focus:border-[#C41E3A] rounded-lg pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#8B0D1E] to-[#C41E3A] hover:from-[#9F1226] hover:to-[#D42342] text-white font-bold text-xs tracking-wide shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60"
          >
            <span>{isSubmitting ? 'Verifying...' : 'Unlock & Resume'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-[11px] text-slate-400">
          <span>Not {currentUser?.name || 'this user'}?</span>
          <button
            type="button"
            onClick={() => {
              onUnlock?.();
              logout();
            }}
            className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out to Portal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
