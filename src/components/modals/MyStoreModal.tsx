import React, { useState } from 'react';
import { X, Store, Globe, Share2, Copy, Check } from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';

export const MyStoreModal: React.FC = () => {
  const {
    isMyStoreModalOpen,
    setIsMyStoreModalOpen,
    company,
    items,
    coupons,
    serviceAreaConfig,
    updateServiceAreaConfig,
    toggleBillingCouponStatus,
    showToast,
  } = useVyapar();

  const [copied, setCopied] = useState(false);
  const [pincodeDraft, setPincodeDraft] = useState(serviceAreaConfig.allowedPincodes.join(', '));
  const [freeThresholdDraft, setFreeThresholdDraft] = useState(String(serviceAreaConfig.freeDeliveryThreshold));

  if (!isMyStoreModalOpen) return null;

  const storeSlug = company.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const storeUrl = `https://vyapar.store/${storeSlug}`;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(storeUrl);
    setCopied(true);
    showToast('Online store URL copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAreaSettings = () => {
    const parsedPins = pincodeDraft
      .split(/[\s,]+/)
      .map((p) => p.replace(/\D/g, '').slice(0, 6))
      .filter((p) => p.length === 6);
    updateServiceAreaConfig({
      allowedPincodes: parsedPins.length > 0 ? Array.from(new Set(parsedPins)) : serviceAreaConfig.allowedPincodes,
      freeDeliveryThreshold: Math.max(0, Number(freeThresholdDraft) || 0),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden text-xs text-slate-800">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold tracking-tight">My Online Store &amp; Service Zones</h2>
          </div>
          <button
            onClick={() => setIsMyStoreModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-cyan-950 text-sm">{company.name} Online Catalog</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={serviceAreaConfig.storeEnabled}
                  onChange={(e) => updateServiceAreaConfig({ storeEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>
            <p className="text-cyan-800 text-xs">
              Synced live with Billing Items, Stock Reservations, Serviceable PINs &amp; Store Coupons.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Your Store Web Address
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={storeUrl}
                className="flex-1 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-700 text-xs select-all"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded bg-slate-900 text-white font-medium hover:bg-slate-800 flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-3 space-y-2">
            <span className="font-semibold text-slate-900 block">Delivery PIN Zones &amp; Free Delivery Threshold</span>
            <input
              type="text"
              value={pincodeDraft}
              onChange={(e) => setPincodeDraft(e.target.value)}
              placeholder="Comma-separated 6-digit PIN codes"
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-[11px]"
            />
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-600 whitespace-nowrap">Free Delivery Above ₹</label>
              <input
                type="number"
                value={freeThresholdDraft}
                onChange={(e) => setFreeThresholdDraft(e.target.value)}
                className="w-24 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-bold"
              />
              <button
                type="button"
                onClick={handleSaveAreaSettings}
                className="ml-auto px-3 py-1 rounded bg-cyan-700 hover:bg-cyan-800 text-white font-semibold text-[11px] cursor-pointer"
              >
                Save Delivery Rules
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-3 space-y-2">
            <span className="font-semibold text-slate-900 block">Store Coupons (Shared with Customer App)</span>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {coupons.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded bg-slate-50 text-[11px]">
                  <div>
                    <span className="font-mono font-bold text-slate-900">{c.code}</span>
                    <span className="ml-2 text-slate-600">{c.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleBillingCouponStatus(c.id)}
                    className={`px-2 py-0.5 rounded font-bold text-[10px] cursor-pointer ${
                      c.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {c.isActive ? 'Active' : 'Paused'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-3 space-y-2">
            <span className="font-semibold text-slate-900 block">Published Products in Store ({items.length})</span>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between p-2 rounded bg-slate-50 text-[11px]"
                >
                  <span className="font-medium text-slate-800">
                    {it.name} ({Math.max(0, it.stock - (it.reservedStock || 0))} avail)
                  </span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    ₹ {it.salePrice.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={() => setIsMyStoreModalOpen(false)}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-900 text-white font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
