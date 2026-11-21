import React, { useState } from 'react';
import { MessageSquare, Copy, ExternalLink, RotateCcw, Mail } from 'lucide-react';
import {
  BusinessSettingsBundle,
  CompanyProfile,
  MessageTemplateType,
  TransactionMessageTemplate,
} from '../../types';
import { buildDefaultBusinessSettings, interpolateMessageTemplate } from '../../data/defaultSettings';
import { SettingsCard, ToggleSwitch, ReadOnlyBanner } from './SettingsUi';

interface TransactionMessagePanelProps {
  draft: BusinessSettingsBundle;
  setDraft: React.Dispatch<React.SetStateAction<BusinessSettingsBundle>>;
  companyDraft: CompanyProfile;
  canEdit: boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const TEMPLATE_VARIABLES = [
  '{business_name}',
  '{customer_name}',
  '{supplier_name}',
  '{invoice_number}',
  '{invoice_date}',
  '{due_date}',
  '{total_amount}',
  '{paid_amount}',
  '{balance_amount}',
  '{transaction_link}',
  '{business_mobile}',
];

export const TransactionMessagePanel: React.FC<TransactionMessagePanelProps> = ({
  draft,
  setDraft,
  companyDraft,
  canEdit,
  showToast,
}) => {
  const m = draft.messages;
  const [selectedType, setSelectedType] = useState<MessageTemplateType>('Sales Invoice');

  const activeTemplate =
    m.templates.find((t) => t.type === selectedType) || m.templates[0];

  const updateTemplate = (patch: Partial<TransactionMessageTemplate>) => {
    setDraft((prev) => ({
      ...prev,
      messages: {
        ...prev.messages,
        templates: prev.messages.templates.map((t) =>
          t.type === activeTemplate.type ? { ...t, ...patch } : t
        ),
      },
    }));
  };

  const updateMessages = <K extends keyof BusinessSettingsBundle['messages']>(
    key: K,
    val: BusinessSettingsBundle['messages'][K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      messages: { ...prev.messages, [key]: val },
    }));
  };

  const insertVariable = (token: string) => {
    if (!canEdit) return;
    updateTemplate({ body: `${activeTemplate.body}${activeTemplate.body.endsWith(' ') ? '' : ' '}${token}` });
  };

  const resetActiveTemplate = () => {
    if (!canEdit) return;
    const def = buildDefaultBusinessSettings().messages.templates.find(
      (t) => t.type === activeTemplate.type
    );
    if (def) {
      updateTemplate({ subject: def.subject, body: def.body });
      showToast(`Reset "${activeTemplate.type}" template to default.`);
    }
  };

  const previewText = interpolateMessageTemplate(activeTemplate.body, {
    business_name: companyDraft.name || 'MY STORE',
    customer_name: 'Ramesh Traders',
    supplier_name: 'Kaveri Wholesale Distributors',
    invoice_number: 'MS-INV-204',
    invoice_date: '14/10/2026',
    due_date: '29/10/2026',
    total_amount: '4,850.00',
    paid_amount: '2,000.00',
    balance_amount: '2,850.00',
    transaction_link: `${window.location.origin}/?doc=MS-INV-204`,
    business_mobile: companyDraft.phone || '+91 98765 43210',
  });

  const handleCopyPreview = () => {
    navigator.clipboard?.writeText(previewText);
    showToast('Rendered message copied to clipboard.');
  };

  return (
    <div className="space-y-5">
      {!canEdit && <ReadOnlyBanner categoryLabel="Transaction Message" />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Template Selector */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <span>Message Templates ({m.templates.length})</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[480px] overflow-y-auto">
            {m.templates.map((tpl) => {
              const active = tpl.type === activeTemplate.type;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedType(tpl.type)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                    active
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium'
                  }`}
                >
                  <span>{tpl.type}</span>
                  <span className="text-[10px] text-slate-400">
                    {[
                      tpl.enableWhatsApp ? 'WA' : '',
                      tpl.enableSms ? 'SMS' : '',
                      tpl.enableEmail ? 'Email' : '',
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Off'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Editor & Live Preview */}
        <div className="lg:col-span-8 space-y-5">
          <SettingsCard
            title={`Edit Template — ${activeTemplate.type}`}
            subtitle="Customize subject, body text & dynamic merge fields; click any variable to insert"
            rightSlot={
              <button
                type="button"
                disabled={!canEdit}
                onClick={resetActiveTemplate}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-semibold hover:bg-slate-50 disabled:opacity-45 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Template</span>
              </button>
            }
          >
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Subject / Header
                </label>
                <input
                  type="text"
                  value={activeTemplate.subject}
                  disabled={!canEdit}
                  onChange={(e) => updateTemplate({ subject: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Message Body
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Click a placeholder below to append
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={activeTemplate.body}
                  disabled={!canEdit}
                  onChange={(e) => updateTemplate({ body: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {TEMPLATE_VARIABLES.map((token) => (
                    <button
                      key={token}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => insertVariable(token)}
                      className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-blue-500 hover:text-blue-600 text-[10px] font-mono font-semibold cursor-pointer disabled:opacity-45"
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={activeTemplate.enableWhatsApp}
                    disabled={!canEdit}
                    onChange={(e) => updateTemplate({ enableWhatsApp: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>WhatsApp Share</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={activeTemplate.enableSms}
                    disabled={!canEdit}
                    onChange={(e) => updateTemplate({ enableSms: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>SMS Copy / Intent</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={activeTemplate.enableEmail}
                    disabled={!canEdit}
                    onChange={(e) => updateTemplate({ enableEmail: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Email Client</span>
                </label>
              </div>
            </div>
          </SettingsCard>

          {/* Live Rendered Preview + Safe Manual Test Share */}
          <SettingsCard
            title="Live Rendered Message Preview"
            subtitle="Preview with realistic invoice data; messages are never auto-sent without your action"
          >
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
              {previewText}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyPreview}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-slate-600" />
                <span>Copy Rendered Message</span>
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(previewText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Test Open in WhatsApp</span>
              </a>
              <a
                href={`mailto:?subject=${encodeURIComponent(activeTemplate.subject)}&body=${encodeURIComponent(previewText)}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-semibold"
              >
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                <span>Open in Email App</span>
              </a>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Reminder Timing & Safety Controls"
            subtitle="Channel readiness and confirmation rules"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Due Date Reminder Lead Time (Days Before)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={m.dueDateReminderDays}
                  disabled={!canEdit}
                  onChange={(e) => updateMessages('dueDateReminderDays', Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Overdue Repeat Interval (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={m.overdueReminderFrequencyDays}
                  disabled={!canEdit}
                  onChange={(e) =>
                    updateMessages('overdueReminderFrequencyDays', Math.max(1, Number(e.target.value)))
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs tabular-nums"
                />
              </div>
            </div>
            <ToggleSwitch
              checked={m.requireManualSendConfirmation}
              onChange={(v) => updateMessages('requireManualSendConfirmation', v)}
              disabled={!canEdit}
              label="Require Explicit User Confirmation Before Sending Any Message"
              description="Prevents automated WhatsApp/SMS dispatch without staff review."
            />
          </SettingsCard>
        </div>
      </div>
    </div>
  );
};
