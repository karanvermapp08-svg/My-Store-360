import React from 'react';
import { X, Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';

export const VersionsModal: React.FC = () => {
  const { isVersionsModalOpen, setIsVersionsModalOpen, showToast } = useVyapar();

  if (!isVersionsModalOpen) return null;

  const handleCheckUpdate = () => {
    showToast('You are on the latest version of Vyapar Desktop (v18.2.1)');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md flex flex-col overflow-hidden text-xs text-slate-800">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold tracking-tight">Vyapar Desktop Release v18.2.1</h2>
          </div>
          <button
            onClick={() => setIsVersionsModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold">Installed Version: 18.2.1 (64-bit)</span>
            </div>
            <button
              onClick={handleCheckUpdate}
              className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Check for Updates</span>
            </button>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-2">What&apos;s New in this Version:</h4>
            <ul className="space-y-1.5 text-slate-600 list-disc list-inside">
              <li>High-speed Sale Invoice generation with instant thermal print.</li>
              <li>Enhanced GSTR-1, GSTR-3B tax calculations with HSN code auto-fill.</li>
              <li>Vyapar POS mode with barcode reader and quick cash payment buttons.</li>
              <li>Integrated WhatsApp invoice sharing with dynamic payment links.</li>
              <li>Multi-firm management with isolated client ledgers.</li>
              <li>Automatic background data backup with instant restoration.</li>
            </ul>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={() => setIsVersionsModalOpen(false)}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-900 text-white font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
