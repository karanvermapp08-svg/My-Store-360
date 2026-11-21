import React from 'react';
import { FileDown } from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';

export const SaleFaView: React.FC = () => {
  const { setIsAddSaleOpen, exportCurrentViewPdf, showToast } = useVyapar();

  return (
    <div className="flex-1 flex flex-col bg-white overflow-y-auto select-none text-xs text-slate-800">
      {/* 1. Header */}
      <div className="border-b border-[#e2e8f0] px-6 py-3 flex items-center justify-between shrink-0">
        <div className="w-20" />
        <h2 className="text-xs font-bold text-[#64748b] tracking-wider uppercase">
          SALE OF FIXED ASSETS
        </h2>
        <button
          onClick={() => exportCurrentViewPdf()}
          title="Export Fixed Assets Register as PDF"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
        >
          <FileDown className="w-3.5 h-3.5" />
          <span>Export PDF</span>
        </button>
      </div>

      {/* Center Illustration & Call to Action matching Screenshot 653 */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        {/* Hand holding receipt with ₹ coin illustration */}
        <div className="w-40 h-36 relative flex items-center justify-center mb-6">
          <div className="w-28 h-28 bg-[#fef3c7] rounded-full flex items-center justify-center relative">
            <div className="w-18 h-22 bg-white border-2 border-slate-800 rounded p-1.5 flex flex-col justify-between shadow-sm">
              <div className="space-y-1">
                <div className="w-full h-1 bg-slate-300 rounded" />
                <div className="w-3/4 h-1 bg-slate-300 rounded" />
                <div className="w-1/2 h-1 bg-slate-300 rounded" />
              </div>
              <div className="w-8 h-8 rounded-full bg-[#fde047] border border-slate-800 flex items-center justify-center font-bold text-slate-900 ml-auto">
                ₹
              </div>
            </div>
          </div>
        </div>

        <p className="text-slate-600 text-xs max-w-sm mb-5 leading-relaxed">
          You can manage sale of all your fixed assets here.
        </p>

        <button
          onClick={() => {
            setIsAddSaleOpen(true);
            showToast('Create Sale of Fixed Asset');
          }}
          className="px-6 py-2 rounded-md bg-[#f59e0b] hover:bg-[#d97706] active:bg-[#b45309] text-white font-semibold text-xs shadow-xs transition-transform active:scale-95"
        >
          Add Your First Sale Of A Fixed Asset Here
        </button>
      </div>
    </div>
  );
};
