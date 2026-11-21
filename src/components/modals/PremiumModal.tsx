import React, { useState } from 'react';
import {
  X,
  Zap,
  Check,
  ShieldCheck,
  Key,
  CreditCard,
  QrCode,
  Building,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';

export const PremiumModal: React.FC = () => {
  const {
    isPremiumModalOpen,
    setIsPremiumModalOpen,
    subscription,
    premiumOrders,
    activateLicenseKey,
    createPremiumOrder,
    showToast,
  } = useVyapar();

  const [activeTab, setActiveTab] = useState<'plans' | 'orders' | 'activate'>('plans');
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);

  // Order checkout state
  const [checkoutPlan, setCheckoutPlan] = useState<'Silver Desktop' | 'Gold Desktop + Mobile' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Net Banking' | 'Debit/Credit Card'>('UPI');
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [completedOrderKey, setCompletedOrderKey] = useState<string | null>(null);

  if (!isPremiumModalOpen) return null;

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError(null);
    if (!licenseKeyInput.trim()) {
      setKeyError('Please enter a valid license key.');
      return;
    }

    const res = activateLicenseKey(licenseKeyInput);
    if (!res.success) {
      setKeyError(res.message);
    } else {
      setLicenseKeyInput('');
      setActiveTab('plans');
    }
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutPlan) return;
    setIsProcessingOrder(true);

    setTimeout(() => {
      const order = createPremiumOrder(checkoutPlan, paymentMethod);
      setIsProcessingOrder(false);
      setCompletedOrderKey(order.generatedLicenseKey);
      setCheckoutPlan(null);
    }, 700);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-xs text-slate-800">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-amber-500 via-rose-600 to-rose-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-200 fill-amber-200" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Vyapar Desktop Premium Licensing</h2>
              <p className="text-[10px] text-rose-100">Official Indian Business GST Billing &amp; Accounting License</p>
            </div>
          </div>
          <button
            onClick={() => setIsPremiumModalOpen(false)}
            className="text-white/80 hover:text-white p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-5 flex items-center gap-4 text-xs font-semibold shrink-0">
          <button
            onClick={() => {
              setActiveTab('plans');
              setCheckoutPlan(null);
              setCompletedOrderKey(null);
            }}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'plans'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Subscription Plans
          </button>

          <button
            onClick={() => {
              setActiveTab('activate');
              setCheckoutPlan(null);
              setCompletedOrderKey(null);
            }}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'activate'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Activate License Key
          </button>

          <button
            onClick={() => {
              setActiveTab('orders');
              setCheckoutPlan(null);
            }}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'orders'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Order History ({premiumOrders.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Active Subscription Banner */}
          <div className="p-3.5 rounded-lg border bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shadow-2xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                  {subscription.status === 'Active' ? 'ACTIVATED' : 'TRIAL MODE'}
                </span>
                <span className="font-bold text-sm text-white">{subscription.plan}</span>
              </div>
              <div className="text-[11px] text-slate-300 mt-1 flex items-center gap-3">
                <span>Valid until: <strong className="text-white">{subscription.expiresAt}</strong></span>
                {subscription.licenseKey && (
                  <span className="font-mono text-emerald-400">Key: {subscription.licenseKey}</span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">Maximum Allowed Staff</span>
              <span className="text-sm font-bold text-white">{subscription.maxUsers} Users</span>
            </div>
          </div>

          {/* Success Notification after Order */}
          {completedOrderKey && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Order Successful! License Activated</span>
              </div>
              <p className="text-xs text-emerald-800">
                Your payment was verified. An authentic license has been generated and applied to this device.
              </p>
              <div className="bg-white p-2.5 rounded border border-emerald-200 font-mono text-xs font-bold text-slate-900 flex items-center justify-between">
                <span>License Key: {completedOrderKey}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(completedOrderKey);
                    showToast('License key copied to clipboard');
                  }}
                  className="px-2 py-1 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[10px]"
                >
                  Copy Key
                </button>
              </div>
            </div>
          )}

          {/* Checkout Drawer when a plan is selected */}
          {checkoutPlan ? (
            <div className="border border-rose-200 rounded-xl p-5 bg-rose-50/30 space-y-4">
              <div className="flex items-center justify-between border-b border-rose-200 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Order Checkout: {checkoutPlan}</h3>
                  <p className="text-xs text-slate-600">Select payment method to complete purchase and receive license key.</p>
                </div>
                <button
                  onClick={() => setCheckoutPlan(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <span className="block font-semibold text-slate-700">Choose Payment Method:</span>
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    paymentMethod === 'UPI' ? 'border-rose-500 bg-white font-semibold shadow-2xs' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'UPI'}
                      onChange={() => setPaymentMethod('UPI')}
                    />
                    <QrCode className="w-4 h-4 text-emerald-600" />
                    <span>Instant UPI / QR (PhonePe / GPay)</span>
                  </label>

                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    paymentMethod === 'Net Banking' ? 'border-rose-500 bg-white font-semibold shadow-2xs' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'Net Banking'}
                      onChange={() => setPaymentMethod('Net Banking')}
                    />
                    <Building className="w-4 h-4 text-blue-600" />
                    <span>Net Banking (HDFC, SBI, ICICI)</span>
                  </label>

                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    paymentMethod === 'Debit/Credit Card' ? 'border-rose-500 bg-white font-semibold shadow-2xs' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'Debit/Credit Card'}
                      onChange={() => setPaymentMethod('Debit/Credit Card')}
                    />
                    <CreditCard className="w-4 h-4 text-purple-600" />
                    <span>Credit / Debit Card (RuPay, Visa, MC)</span>
                  </label>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3 flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block border-b pb-2 mb-2">Price Breakdown:</span>
                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>Base License (1 Year):</span>
                        <span>₹ {checkoutPlan === 'Gold Desktop + Mobile' ? '4,236.44' : '2,541.52'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>GST @ 18%:</span>
                        <span>₹ {checkoutPlan === 'Gold Desktop + Mobile' ? '762.56' : '457.48'}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-bold text-slate-900 text-sm">
                        <span>Total Payable:</span>
                        <span className="text-rose-600">
                          ₹ {checkoutPlan === 'Gold Desktop + Mobile' ? '4,999.00' : '2,999.00'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleCheckoutSubmit}>
                    <button
                      type="submit"
                      disabled={isProcessingOrder}
                      className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2"
                    >
                      {isProcessingOrder ? (
                        <span>Processing Payment &amp; Generating License...</span>
                      ) : (
                        <span>Pay ₹ {checkoutPlan === 'Gold Desktop + Mobile' ? '4,999' : '2,999'} &amp; Activate</span>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : null}

          {/* 1. PLANS TAB */}
          {activeTab === 'plans' && !checkoutPlan && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Select Business License for Desktop &amp; Multi-Device Accounting
                </h3>
                <p className="text-slate-600 text-xs">
                  All plans include free GST updates, e-Invoicing, barcode support &amp; priority hotline assistance.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Silver Plan Card */}
                <div className="border border-slate-200 rounded-xl p-4.5 bg-slate-50 space-y-3.5 hover:border-slate-300 transition-all shadow-2xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-sm text-slate-900">Vyapar Silver Desktop</div>
                      <div className="text-[11px] text-slate-500">For Single Counter Shops</div>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">1 PC</span>
                  </div>

                  <div className="text-2xl font-bold text-slate-900">
                    ₹ 2,999 <span className="text-xs font-normal text-slate-500">/ 1 Year</span>
                  </div>

                  <ul className="space-y-2 text-[11px] text-slate-600">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Unlimited GST Invoices &amp; Estimates</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Remove "Powered by Vyapar" Branding</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Thermal 2" / 3" POS Slip Generation</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Up to 5 Staff User Profiles</span>
                    </li>
                  </ul>

                  <button
                    onClick={() => setCheckoutPlan('Silver Desktop')}
                    className="w-full py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors shadow-2xs"
                  >
                    Select Silver License
                  </button>
                </div>

                {/* Gold Plan Card */}
                <div className="border-2 border-rose-500 rounded-xl p-4.5 bg-rose-50/30 relative space-y-3.5 shadow-md">
                  <span className="absolute -top-2.5 right-4 bg-rose-600 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                    Recommended
                  </span>

                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-sm text-slate-900">Vyapar Gold (Desktop + Mobile)</div>
                      <div className="text-[11px] text-slate-500">For Growing Multi-Branch Traders</div>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-rose-200 text-rose-800">MULTI-DEVICE</span>
                  </div>

                  <div className="text-2xl font-bold text-slate-900">
                    ₹ 4,999 <span className="text-xs font-normal text-slate-500">/ 1 Year</span>
                  </div>

                  <ul className="space-y-2 text-[11px] text-slate-600">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Real-time Multi-Device Cloud Sync</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Up to 20 Staff Roles &amp; Permissions</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Automated WhatsApp Payment Reminders</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>e-Way Bill &amp; e-Invoice Direct Upload</span>
                    </li>
                  </ul>

                  <button
                    onClick={() => setCheckoutPlan('Gold Desktop + Mobile')}
                    className="w-full py-2 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors shadow-2xs"
                  >
                    Select Gold License
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. ACTIVATE KEY TAB */}
          {activeTab === 'activate' && (
            <div className="space-y-4 max-w-lg mx-auto py-2">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-1">
                  <Key className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Enter Your Vyapar License Activation Key</h3>
                <p className="text-slate-600 text-xs">
                  Keys are sent to your registered email after purchase or provided by authorized distributors.
                </p>
              </div>

              {keyError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{keyError}</span>
                </div>
              )}

              <form onSubmit={handleActivate} className="space-y-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">License Key *</label>
                  <input
                    type="text"
                    required
                    value={licenseKeyInput}
                    onChange={(e) => setLicenseKeyInput(e.target.value)}
                    placeholder="e.g. VYP-GOLD-2026-X79K-8812"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 font-mono uppercase text-xs focus:border-rose-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Supported format: VYP-GOLD-*, VYP-SILV-*, or VYAP-* (min 12 characters).
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <span className="font-bold text-slate-800">Quick Test Keys (copy &amp; test):</span>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setLicenseKeyInput('VYP-GOLD-2026-DEMO-TEST')}
                      className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-800 font-mono text-[10px] hover:border-rose-400"
                    >
                      VYP-GOLD-2026-DEMO-TEST
                    </button>
                    <button
                      type="button"
                      onClick={() => setLicenseKeyInput('VYP-SILV-2026-DEMO-TEST')}
                      className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-800 font-mono text-[10px] hover:border-rose-400"
                    >
                      VYP-SILV-2026-DEMO-TEST
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-colors"
                >
                  Verify &amp; Activate License
                </button>
              </form>
            </div>
          )}

          {/* 3. ORDER HISTORY TAB */}
          {activeTab === 'orders' && (
            <div className="space-y-3">
              <span className="font-bold text-slate-900 block">Verified License Purchases</span>
              {premiumOrders.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <div className="font-semibold text-slate-600">No previous orders recorded</div>
                  <div className="text-[11px]">Select a plan from the Plans tab to purchase a license.</div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border rounded-lg bg-white overflow-hidden">
                  {premiumOrders.map((ord) => (
                    <div key={ord.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{ord.plan}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                            {ord.paymentStatus}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Order #{ord.orderNumber} • Paid via {ord.paymentMethod} on {ord.createdAt}
                        </div>
                        <div className="font-mono text-[10px] text-slate-700 mt-1">
                          Key: {ord.generatedLicenseKey}
                        </div>
                      </div>

                      <div className="text-right font-bold text-slate-900">
                        ₹ {ord.amount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
