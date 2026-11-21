import React from 'react';
import { LogOut, X } from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmLogout: () => void;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmLogout,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 text-center animate-in zoom-in-95 duration-200">
        <div className="w-14 h-14 rounded-full bg-rose-50 text-[#8B1E2D] flex items-center justify-center mx-auto mb-4 shadow-inner border border-rose-100">
          <LogOut className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-1">
          Are you sure you want to logout?
        </h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          You will be redirected to the Welcome Portal screen. Your active session will be cleared cleanly.
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmLogout();
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl bg-[#8B1E2D] hover:bg-[#731825] active:bg-[#5a111a] text-white text-xs font-bold shadow-md shadow-rose-900/25 transition-all cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};
