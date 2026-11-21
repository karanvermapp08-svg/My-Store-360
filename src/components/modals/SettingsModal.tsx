import React, { useState } from 'react';
import { X, Settings as SettingsIcon, Save, ExternalLink } from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    settings,
    updateSettings,
    setActiveTab,
    showToast,
  } = useVyapar();

  const [invoicePrefix, setInvoicePrefix] = useState(settings.invoicePrefix);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState(settings.nextInvoiceNumber);
  const [defaultTaxRate, setDefaultTaxRate] = useState(settings.defaultTaxRate);
  const [enableGst, setEnableGst] = useState(settings.enableGst);
  const [enableThermalPrint, setEnableThermalPrint] = useState(settings.enableThermalPrint);
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol);

  if (!isSettingsModalOpen) return null;

  const handleSave = () => {
    updateSettings({
      invoicePrefix,
      nextInvoiceNumber: Number(nextInvoiceNumber),
      defaultTaxRate: Number(defaultTaxRate),
      enableGst,
      enableThermalPrint,
      currencySymbol,
    });
    setIsSettingsModalOpen(false);
    showToast('Application settings saved successfully');
  };

  const handleOpenFullSettings = () => {
    setIsSettingsModalOpen(false);
    setActiveTab('settings');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-100">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold tracking-tight">Quick Invoice &amp; Tax Settings</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Invoice Number Prefix
              </label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="e.g. MS-INV-"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Next Sequence Number
              </label>
              <input
                type="number"
                min="1"
                value={nextInvoiceNumber}
                onChange={(e) => setNextInvoiceNumber(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 tabular-nums focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default GST Tax Rate (%)
              </label>
              <select
                value={defaultTaxRate}
                onChange={(e) => setDefaultTaxRate(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-blue-600 focus:outline-none"
              >
                <option value={0}>0% (Exempt)</option>
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18% (Standard)</option>
                <option value={28}>28%</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableGst}
                onChange={(e) => setEnableGst(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium text-slate-800 dark:text-slate-200">
                Enable GST Calculations &amp; HSN Field
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableThermalPrint}
                onChange={(e) => setEnableThermalPrint(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium text-slate-800 dark:text-slate-200">
                Enable Thermal Receipt Mode for POS
              </span>
            </label>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleOpenFullSettings}
              className="w-full py-2 px-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold flex items-center justify-center gap-1.5 hover:bg-blue-100 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Full Settings Control Center (All 9 Categories + Role Access)</span>
            </button>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(false)}
            className="px-4 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
