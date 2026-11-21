import React, { useMemo, useState } from 'react';
import { Bell, Plus, CheckCircle2, Trash2, CalendarClock, MessageCircle } from 'lucide-react';
import {
  BusinessSettingsBundle,
  Party,
  ServiceReminderCategory,
  ServiceReminderRecord,
} from '../../types';
import { SettingsCard, ToggleSwitch, ReadOnlyBanner } from './SettingsUi';

interface ServiceRemindersPanelProps {
  draft: BusinessSettingsBundle;
  setDraft: React.Dispatch<React.SetStateAction<BusinessSettingsBundle>>;
  serviceReminders: ServiceReminderRecord[];
  parties: Party[];
  onAddReminder: (rec: Omit<ServiceReminderRecord, 'id' | 'createdAt'>) => void;
  onUpdateReminder: (id: string, patch: Partial<ServiceReminderRecord>) => void;
  onDeleteReminder: (id: string) => void;
  canEdit: boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const REMINDER_CATEGORIES: ServiceReminderCategory[] = [
  'Product Warranty',
  'Equipment Service',
  'Customer Follow-up',
  'Payment Follow-up',
  'Annual Maintenance',
  'Custom Reminder',
];

export const ServiceRemindersPanel: React.FC<ServiceRemindersPanelProps> = ({
  draft,
  setDraft,
  serviceReminders,
  parties,
  onAddReminder,
  onUpdateReminder,
  onDeleteReminder,
  canEdit,
  showToast,
}) => {
  const sr = draft.serviceReminders;
  const [statusFilter, setStatusFilter] = useState<'All' | 'Upcoming' | 'Due Today' | 'Overdue' | 'Completed'>('All');

  const [category, setCategory] = useState<ServiceReminderCategory>('Equipment Service');
  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState(parties[0]?.id || '');
  const [relatedItemName, setRelatedItemName] = useState('');
  const [reminderDate, setReminderDate] = useState(new Date().toISOString().slice(0, 10));
  const [repeatFrequency, setRepeatFrequency] = useState<ServiceReminderRecord['repeatFrequency']>('Monthly');
  const [priority, setPriority] = useState<ServiceReminderRecord['priority']>('Medium');
  const [message, setMessage] = useState('');

  const updateSrCfg = <K extends keyof BusinessSettingsBundle['serviceReminders']>(
    key: K,
    val: BusinessSettingsBundle['serviceReminders'][K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      serviceReminders: { ...prev.serviceReminders, [key]: val },
    }));
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  const enrichedReminders = useMemo(() => {
    return serviceReminders.map((r) => {
      let computedStatus = r.status;
      if (r.status !== 'Completed' && r.status !== 'Cancelled') {
        if (r.reminderDate < todayStr) computedStatus = 'Overdue';
        else if (r.reminderDate === todayStr) computedStatus = 'Due Today';
        else computedStatus = 'Upcoming';
      }
      return { ...r, computedStatus };
    });
  }, [serviceReminders, todayStr]);

  const filteredReminders = enrichedReminders.filter((r) =>
    statusFilter === 'All' ? true : r.computedStatus === statusFilter
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!title.trim()) {
      showToast('Please enter a reminder title.', 'warning');
      return;
    }
    const party = parties.find((pt) => pt.id === customerId) || parties[0];
    onAddReminder({
      category,
      title: title.trim(),
      customerId: party?.id,
      customerName: party?.name || 'Walk-in Customer',
      customerPhone: party?.phone || '',
      relatedItemName: relatedItemName.trim() || undefined,
      reminderDate,
      repeatFrequency,
      message: message.trim() || `Service / follow-up reminder: ${title.trim()}`,
      priority,
      status: reminderDate < todayStr ? 'Overdue' : reminderDate === todayStr ? 'Due Today' : 'Upcoming',
    });
    setTitle('');
    setRelatedItemName('');
    setMessage('');
  };

  const snoozeOneWeek = (r: ServiceReminderRecord) => {
    const dt = new Date(r.reminderDate || todayStr);
    dt.setDate(dt.getDate() + 7);
    const nextDate = dt.toISOString().slice(0, 10);
    onUpdateReminder(r.id, { reminderDate: nextDate, status: 'Upcoming' });
    showToast(`Reminder snoozed to ${nextDate}.`);
  };

  const inputClass =
    'w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-100';

  return (
    <div className="space-y-5">
      {!canEdit && <ReadOnlyBanner categoryLabel="Service Reminders" />}

      {/* 1. Reminder Configuration */}
      <SettingsCard
        title="Service Reminder Preferences"
        subtitle="Control warranty, AMC, equipment servicing & follow-up reminder defaults"
        rightSlot={<Bell className="w-4 h-4 text-blue-600" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <ToggleSwitch
              checked={sr.enabled}
              onChange={(v) => updateSrCfg('enabled', v)}
              disabled={!canEdit}
              label="Enable Service Reminders Module"
            />
            <ToggleSwitch
              checked={sr.showOnDashboard}
              onChange={(v) => updateSrCfg('showOnDashboard', v)}
              disabled={!canEdit}
              label="Show Due / Overdue Service Reminders on Dashboard"
            />
            <ToggleSwitch
              checked={sr.enableWhatsAppManualShare}
              onChange={(v) => updateSrCfg('enableWhatsAppManualShare', v)}
              disabled={!canEdit}
              label="Allow Manual WhatsApp Follow-Up Links"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 content-start">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Repeat Cycle
              </label>
              <select
                value={sr.defaultRepeatFrequency}
                disabled={!canEdit}
                onChange={(e) =>
                  updateSrCfg(
                    'defaultRepeatFrequency',
                    e.target.value as ServiceReminderRecord['repeatFrequency']
                  )
                }
                className={inputClass}
              >
                <option value="None">One-Time</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notify Days Ahead
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={sr.notifyDaysBefore}
                disabled={!canEdit}
                onChange={(e) => updateSrCfg('notifyDaysBefore', Number(e.target.value))}
                className={`${inputClass} tabular-nums`}
              />
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* 2. Create Service Reminder */}
      <SettingsCard
        title="Schedule New Service / Follow-Up Reminder"
        subtitle="Create persistent reminders linked to customers or equipment"
      >
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Category</label>
            <select
              value={category}
              disabled={!canEdit}
              onChange={(e) => setCategory(e.target.value as ServiceReminderCategory)}
              className={inputClass}
            >
              {REMINDER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Reminder Title *</label>
            <input
              type="text"
              value={title}
              disabled={!canEdit}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. RO Filter Annual Maintenance Check"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Customer / Party</label>
            <select
              value={customerId}
              disabled={!canEdit}
              onChange={(e) => setCustomerId(e.target.value)}
              className={inputClass}
            >
              {parties.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Due Date</label>
            <input
              type="date"
              value={reminderDate}
              disabled={!canEdit}
              onChange={(e) => setReminderDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Repeat &amp; Priority</label>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={repeatFrequency}
                disabled={!canEdit}
                onChange={(e) =>
                  setRepeatFrequency(e.target.value as ServiceReminderRecord['repeatFrequency'])
                }
                className={inputClass}
              >
                <option value="None">Once</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
              </select>
              <select
                value={priority}
                disabled={!canEdit}
                onChange={(e) => setPriority(e.target.value as ServiceReminderRecord['priority'])}
                className={inputClass}
              >
                <option value="Low">Low</option>
                <option value="Medium">Med</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          <div className="lg:col-span-2">
            <input
              type="text"
              value={relatedItemName}
              disabled={!canEdit}
              onChange={(e) => setRelatedItemName(e.target.value)}
              placeholder="Related Product / Serial No (optional)"
              className={inputClass}
            />
          </div>
          <div className="lg:col-span-3">
            <input
              type="text"
              value={message}
              disabled={!canEdit}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Custom reminder message..."
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={!canEdit}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Reminder</span>
          </button>
        </form>
      </SettingsCard>

      {/* 3. Active Reminders List */}
      <SettingsCard
        title="Scheduled Service & Payment Follow-Up Reminders"
        subtitle="Filter by due status, complete tasks, snooze 7 days, or open manual WhatsApp follow-up"
        rightSlot={
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {(['All', 'Overdue', 'Due Today', 'Upcoming', 'Completed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md border font-semibold cursor-pointer ${
                  statusFilter === st
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        }
      >
        {filteredReminders.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No service reminders match the selected filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
            {filteredReminders.map((r) => {
              const phoneDigits = (r.customerPhone || '').replace(/\D/g, '').slice(-10);
              const waHref = phoneDigits
                ? `https://wa.me/91${phoneDigits}?text=${encodeURIComponent(r.message)}`
                : `https://wa.me/?text=${encodeURIComponent(r.message)}`;

              const statusColor =
                r.computedStatus === 'Overdue'
                  ? 'text-rose-600'
                  : r.computedStatus === 'Due Today'
                  ? 'text-amber-600'
                  : r.computedStatus === 'Completed'
                  ? 'text-emerald-600'
                  : 'text-blue-600';

              return (
                <div
                  key={r.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[11px] font-bold uppercase ${statusColor}`}>
                        {r.computedStatus}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {r.title}
                      </span>
                      <span className="text-[11px] text-slate-500">({r.category})</span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      <strong>Customer:</strong> {r.customerName}
                      {r.relatedItemName ? ` • ${r.relatedItemName}` : ''} •{' '}
                      <strong>Due:</strong> <span className="tabular-nums">{r.reminderDate}</span> ({r.repeatFrequency})
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{r.message}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {sr.enableWhatsAppManualShare && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-semibold"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                    {canEdit && r.computedStatus !== 'Completed' && (
                      <>
                        <button
                          type="button"
                          onClick={() => snoozeOneWeek(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-[11px] font-semibold cursor-pointer"
                        >
                          <CalendarClock className="w-3 h-3 text-slate-500" />
                          <span>+7d</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateReminder(r.id, {
                              status: 'Completed',
                              completedAt: new Date().toISOString(),
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Complete</span>
                        </button>
                      </>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onDeleteReminder(r.id)}
                        title="Delete reminder"
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>
    </div>
  );
};
