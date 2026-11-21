import React from 'react';
import { ShoppingCart, User, Users, ArrowRight, ShieldCheck, Globe } from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';

export const WelcomePortalScreen: React.FC = () => {
  const { setPortalStage, company } = useVyapar();

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white via-[#FFF8F8] to-[#FCE8EA] flex flex-col justify-between relative overflow-x-hidden select-none font-sans">
      {/* Subtle Top Bar */}
      <header className="w-full max-w-6xl mx-auto px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-[#8B1E2D] text-white flex items-center justify-center font-bold text-xs shadow-sm">
            360
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 leading-tight">Business Manager 360</div>
            <div className="text-[11px] text-slate-500">{company.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium bg-white/90 border border-rose-100 px-3 py-1.5 rounded-lg shadow-2xs">
          <Globe className="w-3.5 h-3.5 text-emerald-600" />
          <span>Online Portal Connected</span>
        </div>
      </header>

      {/* Main Centered Welcome & Dual Portal Selection */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 z-10">
        <div className="w-full max-w-3xl text-center">
          {/* Brand Shopping Cart Emblem matching reference layout in Crimson/Maroon */}
          <div className="w-16 h-16 rounded-full bg-[#8B1E2D] text-white flex items-center justify-center mx-auto mb-5 shadow-lg shadow-rose-900/20">
            <ShoppingCart className="w-8 h-8" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
            Welcome to <span className="text-[#8B1E2D]">Business Manager 360</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mb-10">
            Select how you want to continue.
          </p>

          {/* Two Large Portal Selection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
            {/* CARD 1: CUSTOMER PORTAL */}
            <div className="bg-white/95 border border-rose-200/80 rounded-2xl p-7 shadow-lg shadow-rose-900/5 hover:shadow-xl hover:border-rose-300 transition-all flex flex-col items-center justify-between">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-rose-100 text-[#B91C1C] flex items-center justify-center mb-5 border border-rose-200">
                  <User className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Customer Portal</h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-7 max-w-[260px]">
                  Access your account, orders, invoices and profile.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPortalStage('customer-login')}
                className="w-full py-3 px-5 rounded-xl bg-[#B91C1C] hover:bg-[#991B1B] active:bg-[#7F1D1D] text-white text-sm font-semibold shadow-md shadow-rose-900/20 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Continue as Customer</span>
              </button>
            </div>

            {/* CARD 2: STAFF PORTAL */}
            <div className="bg-white/95 border border-rose-200/80 rounded-2xl p-7 shadow-lg shadow-rose-900/5 hover:shadow-xl hover:border-rose-300 transition-all flex flex-col items-center justify-between">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-[#FCE8EA] text-[#8B1E2D] flex items-center justify-center mb-5 border border-rose-200">
                  <Users className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Staff Portal</h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-7 max-w-[260px]">
                  Access your assigned work and staff dashboard.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPortalStage('staff-login')}
                className="w-full py-3 px-5 rounded-xl bg-[#8B1E2D] hover:bg-[#731825] active:bg-[#5E121D] text-white text-sm font-semibold shadow-md shadow-rose-900/20 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Continue as Staff</span>
              </button>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#8B1E2D]" />
              Role-gated authentication with hashed credentials (PBKDF2 / SHA-256)
            </span>
          </div>
        </div>
      </main>

      {/* Bottom Crimson Decorative Wave */}
      <div className="w-full overflow-hidden leading-none pointer-events-none">
        <svg
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          className="w-full h-16 sm:h-24 block"
        >
          <path
            d="M0,64 C320,120 620,10 960,54 C1200,84 1350,52 1440,32 L1440,120 L0,120 Z"
            fill="#8B1E2D"
            fillOpacity="0.16"
          />
          <path
            d="M0,88 C360,24 720,115 1120,62 C1280,40 1380,68 1440,80 L1440,120 L0,120 Z"
            fill="#8B1E2D"
            fillOpacity="0.28"
          />
        </svg>
      </div>
    </div>
  );
};
