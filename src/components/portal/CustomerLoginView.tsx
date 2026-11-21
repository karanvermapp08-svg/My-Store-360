import React, { useState } from 'react';
import {
  ArrowLeft,
  User,
  Mail,
  Smartphone,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Lock,
  UserPlus,
  Globe,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';

type AuthPanelMode = 'selector' | 'email' | 'mobile' | 'register';

export const CustomerLoginView: React.FC = () => {
  const {
    portalStage,
    setPortalStage,
    loginCustomerWithEmail,
    requestCustomerMobileOtp,
    verifyCustomerMobileOtpLogin,
    registerCustomerAccount,
    resetCustomerPassword,
  } = useVyapar();

  const [mode, setMode] = useState<AuthPanelMode>(
    portalStage === 'customer-register' ? 'register' : 'selector'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Mobile OTP state
  const [countryCode, setCountryCode] = useState('+91');
  const [mobileInput, setMobileInput] = useState('');
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [mobileOtpInput, setMobileOtpInput] = useState('');
  const [mobileNotice, setMobileNotice] = useState<string | null>(null);

  // Google OAuth notice state (transparent; never fakes Google sign-in)
  const [googleNotice, setGoogleNotice] = useState<string | null>(null);

  // Registration state + OTP verification
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regOtpSent, setRegOtpSent] = useState(false);
  const [regOtpInput, setRegOtpInput] = useState('');
  const [regOtpNotice, setRegOtpNotice] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Online Forgot Password flow
  const [showForgotForm, setShowForgotForm] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');

  const switchMode = (next: AuthPanelMode) => {
    setErrorMsg(null);
    setInfoMsg(null);
    setGoogleNotice(null);
    setMobileNotice(null);
    setMobileOtpSent(false);
    setMobileOtpInput('');
    setRegOtpSent(false);
    setRegOtpInput('');
    setRegOtpNotice(null);
    setShowForgotForm(false);
    setMode(next);
    if (next === 'register') {
      setPortalStage('customer-register');
    } else {
      setPortalStage('customer-login');
    }
  };

  const handleGoogleLogin = () => {
    setErrorMsg(null);
    const hasOAuthClient = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
    if (!hasOAuthClient) {
      setGoogleNotice(
        'Google Sign-In requires a configured Google OAuth Client ID (VITE_GOOGLE_CLIENT_ID). Please sign in or register using Email & Password or Mobile OTP below.'
      );
      return;
    }
    setGoogleNotice(
      'Google Sign-In requires a backend OAuth verification endpoint for multi-device customer profile sync.'
    );
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setIsSubmitting(true);
    try {
      const res = await loginCustomerWithEmail(email, password);
      if (!res.success) {
        setErrorMsg(res.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMobileOtpRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    if (!mobileOtpSent) {
      setIsSubmitting(true);
      try {
        const res = await requestCustomerMobileOtp(mobileInput, 'login');
        if (!res.success) {
          setErrorMsg(res.message);
          return;
        }
        setMobileOtpSent(true);
        setMobileNotice(
          `${res.message} Local verification code: ${res.otpPreview} (displayed locally when external SMS gateway is not connected).`
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const verifyRes = await verifyCustomerMobileOtpLogin(mobileInput, mobileOtpInput);
      if (!verifyRes.success) {
        setErrorMsg(verifyRes.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!regOtpSent) {
      setIsSubmitting(true);
      try {
        const otpRes = await requestCustomerMobileOtp(regPhone, 'register');
        if (!otpRes.success) {
          setErrorMsg(otpRes.message);
          return;
        }
        setRegOtpSent(true);
        setRegOtpNotice(
          `${otpRes.message} Local verification OTP: ${otpRes.otpPreview}. Enter it below to verify your mobile and activate your account.`
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerCustomerAccount({
        fullName: regName,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        otp: regOtpInput,
      });
      if (!res.success) {
        setErrorMsg(res.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemoCustomer = () => {
    switchMode('email');
    setEmail('rahul.customer@mystore.local');
    setPassword('customer@123');
    setInfoMsg('Demo customer credentials filled. Click Login to verify password hash.');
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
          Customer Portal — Business Manager 360
        </div>
      </div>

      {/* Center 2-Column Container matching Screen 2 */}
      <main className="flex-1 flex items-center justify-center px-6 py-6 z-10">
        <div className="w-full max-w-4xl bg-white/95 rounded-2xl shadow-xl shadow-rose-900/10 border border-rose-100 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left Column: Customer Auth Controls */}
          <div className="md:col-span-7 p-7 sm:p-10 flex flex-col justify-center">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-[#B91C1C] text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-rose-900/20">
                {mode === 'register' ? <UserPlus className="w-7 h-7" /> : <User className="w-7 h-7" />}
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {mode === 'register' ? 'Create Customer Account' : 'Customer Login'}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                {mode === 'register'
                  ? 'Register an online account to view your orders & invoices'
                  : 'Sign in to access your online account'}
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#B91C1C]" />
                <span>{errorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{infoMsg}</span>
              </div>
            )}

            {/* MODE 1: Selector matching Screen 2 options */}
            {mode === 'selector' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm flex items-center justify-center gap-3 shadow-2xs transition-all cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.31 0 3.25 2.69 1.27 6.61l3.66 2.84C5.8 6.86 8.65 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.7 2.87c2.16-1.99 3.72-4.92 3.72-8.69z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M4.93 14.55A7.24 7.24 0 0 1 4.55 12c0-.89.16-1.75.38-2.55L1.27 6.61A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l3.66-2.84z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.7-2.87c-1.08.72-2.45 1.16-4.23 1.16-3.35 0-6.2-1.86-7.07-4.45l-3.66 2.84C3.25 21.31 7.31 24 12 24z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
                <p className="text-center text-[11px] text-slate-400 -mt-1">
                  Requires internet connection
                </p>

                {googleNotice && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                    <Globe className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                    <div className="space-y-1.5">
                      <p>{googleNotice}</p>
                      <button
                        type="button"
                        onClick={() => switchMode('email')}
                        className="font-bold text-[#8B1E2D] underline cursor-pointer"
                      >
                        Use Email Login instead →
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 my-2">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[11px] font-bold text-slate-400">OR</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <button
                  type="button"
                  onClick={() => switchMode('email')}
                  className="w-full py-3 px-4 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-slate-800 font-semibold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                >
                  <Mail className="w-4 h-4 text-[#8B1E2D]" />
                  <span>Login with Email</span>
                </button>

                <button
                  type="button"
                  onClick={() => switchMode('mobile')}
                  className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 text-[#8B1E2D]" />
                  <span>Login with Mobile Number</span>
                </button>
              </div>
            )}

            {/* MODE 2: Email + Password Login (or Self-Service Password Reset) */}
            {mode === 'email' && !showForgotForm && (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#8B1E2D] bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#8B1E2D] bg-white"
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

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => switchMode('selector')}
                    className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                  >
                    ← Other login options
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setInfoMsg(null);
                      setForgotEmail(email);
                      setShowForgotForm(true);
                    }}
                    className="text-[#8B1E2D] hover:underline font-semibold cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-[#B91C1C] hover:bg-[#991B1B] disabled:opacity-60 text-white text-sm font-bold shadow-md shadow-rose-900/20 transition-all cursor-pointer"
                >
                  {isSubmitting ? 'Verifying...' : 'Login'}
                </button>
              </form>
            )}

            {mode === 'email' && showForgotForm && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setErrorMsg(null);
                  setInfoMsg(null);
                  setIsSubmitting(true);
                  try {
                    const res = await resetCustomerPassword(
                      forgotEmail,
                      forgotPhone,
                      forgotNewPassword
                    );
                    if (res.success) {
                      setInfoMsg(res.message);
                      setEmail(forgotEmail);
                      setPassword('');
                      setForgotPhone('');
                      setForgotNewPassword('');
                      setShowForgotForm(false);
                    } else {
                      setErrorMsg(res.message);
                    }
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="space-y-3"
              >
                <div className="text-xs font-bold text-slate-800">
                  Reset Password (Verify Registered Email &amp; Mobile)
                </div>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Registered Email"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#8B1E2D] bg-white"
                />
                <input
                  type="tel"
                  required
                  value={forgotPhone}
                  onChange={(e) => setForgotPhone(e.target.value)}
                  placeholder="Registered 10-digit Mobile Number"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#8B1E2D] bg-white"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  placeholder="New Password (min 6 characters)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#8B1E2D] bg-white"
                />
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotForm(false);
                      setErrorMsg(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    ← Back to Login
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-[#B91C1C] hover:bg-[#991B1B] text-white text-xs font-bold shadow-sm cursor-pointer"
                  >
                    {isSubmitting ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}

            {/* MODE 3: Mobile Number OTP Login */}
            {mode === 'mobile' && (
              <form onSubmit={handleMobileOtpRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Number
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      disabled={mobileOtpSent}
                      className="w-24 px-2.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#8B1E2D]"
                    >
                      <option value="+91">+91 IN</option>
                      <option value="+1">+1 US</option>
                      <option value="+44">+44 UK</option>
                      <option value="+971">+971 AE</option>
                    </select>
                    <input
                      type="tel"
                      required
                      disabled={mobileOtpSent}
                      value={mobileInput}
                      onChange={(e) => setMobileInput(e.target.value)}
                      placeholder="10-digit mobile (e.g. 9845112233)"
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#8B1E2D] disabled:bg-slate-50"
                    />
                  </div>
                </div>

                {mobileOtpSent && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Enter 6-Digit OTP
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileOtpSent(false);
                          setMobileOtpInput('');
                          setMobileNotice(null);
                        }}
                        className="text-[11px] font-semibold text-[#8B1E2D] hover:underline cursor-pointer"
                      >
                        Change number
                      </button>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={mobileOtpInput}
                      onChange={(e) => setMobileOtpInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit OTP"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm tracking-[0.25em] font-bold text-center bg-white focus:outline-none focus:border-[#8B1E2D]"
                    />
                  </div>
                )}

                {mobileNotice && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                    <span>{mobileNotice}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-[#B91C1C] hover:bg-[#991B1B] disabled:opacity-60 text-white text-sm font-bold shadow-md shadow-rose-900/20 transition-all cursor-pointer"
                >
                  {isSubmitting
                    ? 'Verifying...'
                    : mobileOtpSent
                    ? 'Verify OTP & Login'
                    : 'Send 6-Digit OTP'}
                </button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => switchMode('selector')}
                    className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                  >
                    ← Other login options
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('email')}
                    className="text-[#8B1E2D] font-semibold hover:underline cursor-pointer"
                  >
                    Sign in with Email instead
                  </button>
                </div>
              </form>
            )}

            {/* MODE 4: Customer Registration */}
            {mode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Rahul Sharma"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#8B1E2D]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="rahul@email.com"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#8B1E2D]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#8B1E2D]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#8B1E2D]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#8B1E2D]"
                    />
                  </div>
                </div>
                {regOtpSent && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Mobile Verification OTP (6 Digits)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={regOtpInput}
                      onChange={(e) => setRegOtpInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 6-digit OTP"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm tracking-[0.25em] font-bold text-center bg-white focus:outline-none focus:border-[#8B1E2D]"
                    />
                    {regOtpNotice && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                        <span>{regOtpNotice}</span>
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-[#B91C1C] hover:bg-[#991B1B] disabled:opacity-60 text-white text-sm font-bold shadow-md shadow-rose-900/20 transition-all cursor-pointer"
                >
                  {isSubmitting
                    ? 'Verifying...'
                    : regOtpSent
                    ? 'Verify OTP & Create Account'
                    : 'Send Verification OTP & Register'}
                </button>
              </form>
            )}

            {/* Bottom Toggle & Demo Test Helper */}
            <div className="mt-6 pt-4 border-t border-slate-100 text-center space-y-2.5">
              {mode === 'register' ? (
                <p className="text-xs text-slate-600">
                  Already have a customer account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('email')}
                    className="font-bold text-[#8B1E2D] hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </p>
              ) : (
                <p className="text-xs text-slate-600">
                  New Customer?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="font-bold text-[#8B1E2D] hover:underline cursor-pointer"
                  >
                    Create Account
                  </button>
                </p>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                <span>
                  Demo Account: <strong className="text-slate-800">CUST001</strong> (rahul.customer@mystore.local)
                </span>
                <button
                  type="button"
                  onClick={fillDemoCustomer}
                  className="px-2.5 py-1 rounded-lg bg-[#8B1E2D] text-white font-semibold hover:bg-[#731825] transition-colors cursor-pointer shrink-0"
                >
                  Fill Credentials
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Local Crimson Vector Illustration matching Screen 2 */}
          <div className="md:col-span-5 bg-gradient-to-br from-[#FFF5F5] to-[#FCE8EA] border-t md:border-t-0 md:border-l border-rose-100 p-8 flex flex-col items-center justify-center text-center">
            <svg
              viewBox="0 0 220 200"
              className="w-44 h-44 mb-4 drop-shadow-sm"
              aria-hidden="true"
            >
              <circle cx="110" cy="100" r="88" fill="#FEE2E2" />
              {/* Shopping Bag */}
              <path
                d="M52 72 H122 L128 158 C128 164 123 168 117 168 H57 C51 168 46 164 46 158 Z"
                fill="#B91C1C"
              />
              <path
                d="M68 72 V58 C68 47 77 38 87 38 C97 38 106 47 106 58 V72"
                fill="none"
                stroke="#8B1E2D"
                strokeWidth="7"
                strokeLinecap="round"
              />
              {/* Verified Invoice Card */}
              <rect x="92" y="84" width="76" height="92" rx="12" fill="#FFFFFF" stroke="#FECDD3" strokeWidth="2" />
              <circle cx="130" cy="116" r="18" fill="#10B981" />
              <path
                d="M122 116 L128 122 L139 110"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="106" y="144" width="48" height="6" rx="3" fill="#CBD5E1" />
              <rect x="112" y="156" width="36" height="6" rx="3" fill="#E2E8F0" />
            </svg>

            <h2 className="text-lg font-extrabold text-slate-900">Your Account</h2>
            <h3 className="text-lg font-extrabold text-[#8B1E2D] mb-2">Our Priority</h3>
            <p className="text-xs text-slate-600 max-w-[200px] leading-relaxed">
              Track orders, view GST &amp; Non-GST invoices, manage delivery addresses and pay balances online.
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
