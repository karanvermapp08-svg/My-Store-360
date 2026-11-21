import React, { useState, useEffect } from 'react';
import { RotateCw, ChevronLeft, ChevronRight, Phone, Radio, Minus, Square, X, ExternalLink, FileDown } from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';

export const DesktopTitleBar: React.FC = () => {
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    setIsCompanyModalOpen,
    setIsHelpModalOpen,
    setIsVersionsModalOpen,
    setIsShortcutsModalOpen,
    setIsSupportModalOpen,
    exportCurrentViewPdf,
    requestConfirmation,
    showToast,
  } = useVyapar();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+P or Cmd+P: Export Current View as PDF
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        exportCurrentViewPdf();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exportCurrentViewPdf]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('Data refreshed successfully');
    }, 400);
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
      showToast('Fullscreen enabled (Press Esc or button to exit)');
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
      showToast('Exited fullscreen');
    }
  };

  const handleMinimize = () => {
    setIsMinimized(true);
    showToast('Application minimized to taskbar');
  };

  const handleClose = () => {
    requestConfirmation({
      title: 'Save & Close Session',
      message: 'All transactions, inventory changes, and settings are automatically saved. Confirm safe workspace checkpoint?',
      confirmLabel: 'Confirm Save',
      variant: 'primary',
      onConfirm: () => { showToast('MY STORE state saved safely.', 'success'); },
    });
  };

  const copySupportNumber = (num: string) => {
    navigator.clipboard?.writeText(num);
    showToast(`Support number ${num} copied to clipboard!`);
  };

  return (
    <>
      <header className="h-9 bg-[#ffffff] border-b border-[#e2e8f0] flex items-center justify-between px-3 select-none text-xs text-[#334155] z-30 shrink-0">
        {/* Left Side: Brand Logo & Top Menu */}
        <div className="flex items-center gap-4">
          {/* MY STORE Emerald Storefront Icon */}
          <div
            onClick={() => setIsVersionsModalOpen(true)}
            title="MY STORE Business Management v2.0"
            className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
          >
            <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xs">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current stroke-2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="font-extrabold text-xs tracking-tight text-slate-900">
              MY <span className="text-emerald-600">STORE</span>
            </span>
          </div>

          {/* Menu Items */}
          <nav className="flex items-center gap-3 font-normal text-[#475569]">
            <button
              onClick={() => setIsCompanyModalOpen(true)}
              className="hover:text-emerald-600 hover:bg-[#f1f5f9] px-2 py-0.5 rounded transition-colors"
            >
              Company
            </button>
            <button
              onClick={() => setIsHelpModalOpen(true)}
              className="hover:text-emerald-600 hover:bg-[#f1f5f9] px-2 py-0.5 rounded transition-colors"
            >
              Help
            </button>
            <button
              onClick={() => setIsVersionsModalOpen(true)}
              className="hover:text-emerald-600 hover:bg-[#f1f5f9] px-2 py-0.5 rounded transition-colors"
            >
              Versions
            </button>
            <button
              onClick={() => setIsShortcutsModalOpen(true)}
              className="hover:text-emerald-600 hover:bg-[#f1f5f9] px-2 py-0.5 rounded transition-colors"
            >
              Shortcuts
            </button>
            <button
              onClick={() => exportCurrentViewPdf()}
              title="Export Current View Data as PDF Document (Ctrl+P)"
              className="text-emerald-600 hover:bg-emerald-50 px-2 py-0.5 rounded transition-colors font-semibold flex items-center gap-1"
            >
              <FileDown className="w-3 h-3" />
              <span>Export PDF</span>
            </button>
          </nav>

          {/* Refresh Action */}
          <button
            onClick={handleRefresh}
            title="Reload & Refresh Data"
            className="text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] p-1 rounded transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-red-600' : ''}`} />
          </button>

          {/* Sidebar Toggle Chevron */}
          <button
            onClick={() => setSidebarCollapsed((prev: boolean) => !prev)}
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="w-5 h-5 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] flex items-center justify-center text-[#475569] transition-colors"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Center / Right: Customer Support & Live Assistance */}
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2 text-[11px] text-[#475569]">
            <span className="font-normal text-[#64748b]">Customer Support :</span>
            <div className="flex items-center gap-1.5 text-[#0284c7] font-medium">
              <Phone className="w-3 h-3 text-[#0284c7]" />
              <button
                onClick={() => copySupportNumber('+91-9333911911')}
                title="Click to copy support phone"
                className="hover:underline"
              >
                +91-9333911911
              </button>
              <button
                onClick={() => copySupportNumber('+917795687633')}
                title="Click to copy support phone"
                className="hover:underline ml-1"
              >
                +917795687633
              </button>
            </div>
            <span className="text-[#cbd5e1]">|</span>
            <button
              onClick={() => setIsSupportModalOpen(true)}
              className="flex items-center gap-1 text-[#0284c7] hover:underline font-medium"
            >
              <Radio className="w-3 h-3 text-[#0284c7]" />
              <span>Get Instant Online Support</span>
            </button>
          </div>

          {/* Desktop Window Controls: Minimize, Maximize, Close */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleMinimize}
              title="Minimize"
              className="w-8 h-7 flex items-center justify-center text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleToggleFullscreen}
              title={isFullscreen ? 'Restore Down' : 'Maximize'}
              className="w-8 h-7 flex items-center justify-center text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors"
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={handleClose}
              title="Close Application"
              className="w-8 h-7 flex items-center justify-center text-[#64748b] hover:bg-[#dc2626] hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* If minimized banner */}
      {isMinimized && (
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-1 text-xs text-amber-900 flex items-center justify-between z-50">
          <span>MY STORE is running in minimized workspace mode.</span>
          <button
            onClick={() => setIsMinimized(false)}
            className="text-xs font-semibold underline text-amber-950"
          >
            Restore Window
          </button>
        </div>
      )}
    </>
  );
};
