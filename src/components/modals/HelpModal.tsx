import React, { useState } from 'react';
import {
  X,
  HelpCircle,
  BookOpen,
  Barcode,
  FileText,
  Database,
  ArrowRight,
  Keyboard,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';

type GuideTab = 'quick-start' | 'gst-returns' | 'barcode-pos' | 'accounting-backup';

export const HelpModal: React.FC = () => {
  const {
    isHelpModalOpen,
    setIsHelpModalOpen,
    setActiveTab,
    setIsShortcutsModalOpen,
  } = useVyapar();

  const [guideTab, setGuideTab] = useState<GuideTab>('quick-start');

  if (!isHelpModalOpen) return null;

  const navigateAndClose = (tab: string) => {
    setActiveTab(tab);
    setIsHelpModalOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden text-xs text-slate-800 dark:text-slate-100">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold tracking-tight">Business Manager 360 — Knowledge Base &amp; Guides</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsHelpModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 overflow-x-auto shrink-0 font-semibold">
          {[
            { id: 'quick-start', label: 'Quick Start', icon: BookOpen },
            { id: 'gst-returns', label: 'GST & Returns', icon: FileText },
            { id: 'barcode-pos', label: 'Barcode & POS', icon: Barcode },
            { id: 'accounting-backup', label: 'Accounting & Backup', icon: Database },
          ].map((t) => {
            const Icon = t.icon;
            const active = guideTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setGuideTab(t.id as GuideTab)}
                className={`py-2.5 flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-[#8E0E20] text-[#8E0E20] dark:text-rose-400 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Guide Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {guideTab === 'quick-start' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5">
                <h4 className="font-bold text-slate-900 dark:text-white">1. End-to-End Store Workflow</h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Add inventory items with purchase/sale prices, GST %, HSN codes, and godown assignments. Record Purchase Bills to increase stock &amp; supplier balances, then bill customers via Sale Invoices or Counter POS.
                </p>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5">
                <h4 className="font-bold text-slate-900 dark:text-white">2. Connected Payment &amp; Ledger Allocation</h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Use Payment-In (customers) and Payment-Out (suppliers) with FIFO Auto-Allocate to settle specific open invoices/bills, automatically updating party balances, Cash/Bank accounts, and Double-Entry journals.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => navigateAndClose('items')}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Go to Items</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateAndClose('settings')}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Open Business Settings</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {guideTab === 'gst-returns' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5">
                <h4 className="font-bold text-slate-900 dark:text-white">GST vs Non-GST Billing Control</h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Toggle GST Registration and Inclusive/Exclusive tax mode inside Settings &rarr; Taxes &amp; GST. Intra-state invoices split automatically into CGST + SGST; inter-state invoices apply IGST.
                </p>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5">
                <h4 className="font-bold text-slate-900 dark:text-white">GSTR-1, GSTR-2, GSTR-3B &amp; HSN Summaries</h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Open the GST Compliance &amp; Returns Center to inspect B2B, B2C Large/Small, Credit/Debit Notes, ITC registers, and export portal-ready CSV/JSON/PDF summaries.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigateAndClose('hsn-gst')}
                className="px-3 py-1.5 rounded-lg bg-[#8E0E20] text-white font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Open GST Center</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {guideTab === 'barcode-pos' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5">
                <h4 className="font-bold text-slate-900 dark:text-white">Camera, USB &amp; Bluetooth Scanners</h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Both Counter POS and Sale Invoice support USB/Bluetooth keyboard-wedge scanners directly (just scan and press Enter) as well as live camera scanning via the Scan Barcode button (EAN-13, EAN-8, UPC-A, Code 128, Code 39).
                </p>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5">
                <h4 className="font-bold text-slate-900 dark:text-white">Batch FEFO &amp; Serial/IMEI Tracking</h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Manage product batches and serial/warranty units in Enterprise Inventory. POS and Sale Invoices automatically pick the earliest-expiring batch (FEFO) and mark sold serial units automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigateAndClose('pos')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Launch Counter POS</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {guideTab === 'accounting-backup' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5">
                <h4 className="font-bold text-slate-900 dark:text-white">Double-Entry Accounting &amp; Cash/Bank</h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Every sale, purchase, expense, and receipt automatically posts balanced Debit/Credit Journal Vouchers to the Chart of Accounts, Trial Balance, P&amp;L, and Balance Sheet. Manage multiple bank accounts and inward/outward cheques under Cash &amp; Bank.
                </p>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5">
                <h4 className="font-bold text-slate-900 dark:text-white">Local Backup, CSV &amp; Database Sync</h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Export full JSON backups, restore checkpoints, or export CSV sheets from Backup &amp; Restore at any time.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigateAndClose('erp-accounting')}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Open Accounting ERP</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateAndClose('erp-tools')}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Backup &amp; Restore</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsHelpModalOpen(false);
              setIsShortcutsModalOpen(true);
            }}
            className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Keyboard Shortcuts</span>
          </button>
          <button
            type="button"
            onClick={() => setIsHelpModalOpen(false)}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-900 text-white font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
