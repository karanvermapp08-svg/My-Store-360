import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';

export const ShortcutsModal: React.FC = () => {
  const { isShortcutsModalOpen, setIsShortcutsModalOpen } = useVyapar();

  if (!isShortcutsModalOpen) return null;

  const shortcuts = [
    { key: 'Ctrl + F', desc: 'Open Anything (Global Search & Quick Actions)' },
    { key: 'Ctrl + N / Alt + S', desc: 'Create New Sale Invoice' },
    { key: 'Ctrl + P', desc: 'Export Current View as PDF Document / Print' },
    { key: 'Esc', desc: 'Close any active popup or modal' },
    { key: 'Alt + P', desc: 'Record Purchase Bill' },
    { key: 'Alt + C', desc: 'Open Company / Firm Settings' },
    { key: 'Alt + I', desc: 'Add New Inventory Item' },
    { key: 'F1', desc: 'Open MY STORE Knowledge Base & Help' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md flex flex-col overflow-hidden text-xs text-slate-800">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-rose-400" />
            <h2 className="text-sm font-bold tracking-tight">MY STORE Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={() => setIsShortcutsModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-2.5">
          {shortcuts.map((sc, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200"
            >
              <span className="text-slate-700 font-medium">{sc.desc}</span>
              <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-semibold text-[11px] text-slate-900 shadow-2xs">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={() => setIsShortcutsModalOpen(false)}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-900 text-white font-semibold"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
