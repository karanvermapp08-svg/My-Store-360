import React from 'react';
import { Lock, X } from 'lucide-react';

interface AccessRestrictedModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

export const AccessRestrictedModal: React.FC<AccessRestrictedModalProps> = ({
  isOpen,
  onClose,
  featureName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 text-center animate-in zoom-in-95 duration-200 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 rounded-full bg-rose-50 text-[#8B1E2D] flex items-center justify-center mx-auto mb-4 shadow-inner border border-rose-100">
          <Lock className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-1">
          Access Restricted
        </h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          You don't have permission to access {featureName ? `"${featureName}"` : 'this feature'}. Please contact your Administrator.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-[#8B1E2D] hover:bg-[#731825] active:bg-[#5a111a] text-white text-xs font-bold shadow-md shadow-rose-900/25 transition-all cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};
