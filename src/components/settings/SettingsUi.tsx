import React from 'react';
import { Lock } from 'lucide-react';

export const SettingsCard: React.FC<{
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, rightSlot, children }) => (
  <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
        {subtitle && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {rightSlot}
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </section>
);

export const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
}> = ({ checked, onChange, disabled, label, description }) => (
  <div className="flex items-start justify-between gap-4 py-1.5">
    <div className="min-w-0 flex-1">
      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
        <span>{label}</span>
        {disabled && <Lock className="w-3 h-3 text-slate-400" />}
      </div>
      {description && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
          {description}
        </p>
      )}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-2xs transition-transform ${
          checked ? 'translate-x-4.5' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

export const ReadOnlyBanner: React.FC<{ categoryLabel: string }> = ({ categoryLabel }) => (
  <div className="px-4 py-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
    <Lock className="w-4 h-4 shrink-0 text-amber-600" />
    <span>
      <strong>View-Only Access:</strong> Your current role can inspect <strong>{categoryLabel}</strong> settings, but editing requires administrator or category edit privileges.
    </span>
  </div>
);
