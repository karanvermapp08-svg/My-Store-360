import React, { useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  MessageCircle,
  Bell,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import {
  BusinessSettingsBundle,
  CompanyProfile,
  CustomFieldDefinition,
  CustomFieldType,
  PartyGroup,
} from '../../types';
import { interpolateMessageTemplate } from '../../data/defaultSettings';
import { SettingsCard, ToggleSwitch, ReadOnlyBanner } from './SettingsUi';

interface PartySettingsPanelProps {
  draft: BusinessSettingsBundle;
  setDraft: React.Dispatch<React.SetStateAction<BusinessSettingsBundle>>;
  companyDraft: CompanyProfile;
  partyGroups: PartyGroup[];
  onAddPartyGroup: (g: Omit<PartyGroup, 'id' | 'createdAt'>) => void;
  onUpdatePartyGroup: (id: string, patch: Partial<PartyGroup>) => void;
  onDeletePartyGroup: (id: string) => void;
  canEdit: boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const FIELD_TYPES: CustomFieldType[] = ['Text', 'Number', 'Date', 'Dropdown', 'Email', 'Phone', 'URL'];

export const PartySettingsPanel: React.FC<PartySettingsPanelProps> = ({
  draft,
  setDraft,
  companyDraft,
  partyGroups,
  onAddPartyGroup,
  onUpdatePartyGroup,
  onDeletePartyGroup,
  canEdit,
  showToast,
}) => {
  const p = draft.party;

  // Party Group inline creator state
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState<'Customer' | 'Supplier' | 'Both'>('Customer');
  const [newGroupDiscount, setNewGroupDiscount] = useState<number>(0);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [isReminderEditorOpen, setIsReminderEditorOpen] = useState(false);

  const updatePartyCfg = <K extends keyof BusinessSettingsBundle['party']>(
    key: K,
    val: BusinessSettingsBundle['party'][K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      party: { ...prev.party, [key]: val },
    }));
  };

  const updateAdditionalField = (
    idx: number,
    patch: Partial<CustomFieldDefinition>
  ) => {
    setDraft((prev) => ({
      ...prev,
      party: {
        ...prev.party,
        additionalFields: prev.party.additionalFields.map((f, i) =>
          i === idx ? { ...f, ...patch } : f
        ),
      },
    }));
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!newGroupName.trim()) {
      showToast('Please enter a party group name.', 'warning');
      return;
    }
    onAddPartyGroup({
      name: newGroupName.trim(),
      partyType: newGroupType,
      defaultDiscountPercent: Number(newGroupDiscount) || 0,
    });
    setNewGroupName('');
    setNewGroupDiscount(0);
  };

  const renderedReminderSample = interpolateMessageTemplate(p.paymentReminderMessage, {
    business_name: companyDraft.name || 'MY STORE',
    customer_name: 'Ramesh Traders',
    invoice_number: 'MS-INV-108',
    due_date: '22/10/2026',
    balance_amount: '4,250.00',
    business_mobile: companyDraft.phone || '+91 98765 43210',
  });

  const inputClass =
    'w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-100';

  return (
    <div className="space-y-5">
      {!canEdit && <ReadOnlyBanner categoryLabel="Party" />}

      {/* TWO SIDE-BY-SIDE SECTIONS ON DESKTOP */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* ============================================================ */}
        {/* LEFT COLUMN: A. PARTY SETTINGS                               */}
        {/* ============================================================ */}
        <div className="xl:col-span-6 space-y-5">
          {/* 1. Party Grouping */}
          <SettingsCard
            title="A. Party Settings — Grouping & Segmentation"
            subtitle="Organize customers and suppliers into groups (Retail, Wholesale, Distributors)"
            rightSlot={<Users className="w-4 h-4 text-blue-600" />}
          >
            <ToggleSwitch
              checked={p.enablePartyGrouping}
              onChange={(v) => updatePartyCfg('enablePartyGrouping', v)}
              disabled={!canEdit}
              label="Enable Party Grouping"
              description="Allows assigning parties to groups and filtering ledgers/reports by group."
            />

            {p.enablePartyGrouping && (
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <form onSubmit={handleCreateGroup} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={newGroupName}
                    disabled={!canEdit}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="New group name (e.g. VIP Wholesale)"
                    className={`${inputClass} sm:col-span-5`}
                  />
                  <select
                    value={newGroupType}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setNewGroupType(e.target.value as 'Customer' | 'Supplier' | 'Both')
                    }
                    className={`${inputClass} sm:col-span-3`}
                  >
                    <option value="Customer">Customer</option>
                    <option value="Supplier">Supplier</option>
                    <option value="Both">Both</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={newGroupDiscount}
                    disabled={!canEdit}
                    onChange={(e) => setNewGroupDiscount(Number(e.target.value))}
                    placeholder="Disc %"
                    title="Default Discount %"
                    className={`${inputClass} sm:col-span-2 tabular-nums`}
                  />
                  <button
                    type="submit"
                    disabled={!canEdit}
                    className="sm:col-span-2 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </form>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg max-h-52 overflow-y-auto">
                  {partyGroups.map((grp) => (
                    <div
                      key={grp.id}
                      className="px-3 py-2 flex items-center justify-between gap-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      {editingGroupId === grp.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editGroupName}
                            onChange={(e) => setEditGroupName(e.target.value)}
                            className={inputClass}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (editGroupName.trim()) {
                                onUpdatePartyGroup(grp.id, { name: editGroupName.trim() });
                              }
                              setEditingGroupId(null);
                            }}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingGroupId(null)}
                            className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {grp.name}
                            </span>
                            <span className="text-[11px] text-slate-500 ml-2">
                              ({grp.partyType}
                              {grp.defaultDiscountPercent ? ` • ${grp.defaultDiscountPercent}% disc` : ''})
                            </span>
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingGroupId(grp.id);
                                  setEditGroupName(grp.name);
                                }}
                                title="Rename group"
                                className="p-1 text-slate-500 hover:text-blue-600 rounded cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeletePartyGroup(grp.id)}
                                title="Delete group"
                                className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SettingsCard>

          {/* 2. Shipping Address & 3. Manage Party Status */}
          <SettingsCard
            title="Shipping Address & Party Status Controls"
            subtitle="Multi-address delivery support & Active / Inactive / Blocked status enforcement"
            rightSlot={<ShieldAlert className="w-4 h-4 text-slate-500" />}
          >
            <div className="space-y-1">
              <ToggleSwitch
                checked={p.enableShippingAddress}
                onChange={(v) => updatePartyCfg('enableShippingAddress', v)}
                disabled={!canEdit}
                label="Enable Shipping Address"
                description="Show separate delivery/shipping address fields in Party forms & invoices."
              />
              <ToggleSwitch
                checked={p.allowMultipleShippingAddresses}
                onChange={(v) => updatePartyCfg('allowMultipleShippingAddresses', v)}
                disabled={!canEdit || !p.enableShippingAddress}
                label="Allow Multiple Shipping Addresses per Party"
                description="Store multiple branch/godown delivery locations on customer profiles."
              />
              <ToggleSwitch
                checked={p.enablePartyStatus}
                onChange={(v) => updatePartyCfg('enablePartyStatus', v)}
                disabled={!canEdit}
                label="Manage Party Status (Active / Inactive / Blocked)"
                description="Enable lifecycle status tags instead of permanently deleting old parties."
              />
              <ToggleSwitch
                checked={p.preventDeleteWithTransactions}
                onChange={(v) => updatePartyCfg('preventDeleteWithTransactions', v)}
                disabled={!canEdit}
                label="Prevent Deleting Parties With Transaction History"
                description="Preserves financial audit integrity; mark parties Inactive instead."
              />
              <ToggleSwitch
                checked={p.blockTransactionsForBlockedParties}
                onChange={(v) => updatePartyCfg('blockTransactionsForBlockedParties', v)}
                disabled={!canEdit}
                label="Block New Bills for Blocked Parties"
                description="Stops creating new sales or purchases when a party status is Blocked."
              />
            </div>
          </SettingsCard>

          {/* 4. Payment Reminder Controls & Message */}
          <SettingsCard
            title="Payment Reminder & Follow-up"
            subtitle="Configure reminder days, editable reminder message template & manual WhatsApp sharing"
            rightSlot={<Bell className="w-4 h-4 text-blue-600" />}
          >
            <ToggleSwitch
              checked={p.enablePaymentReminder}
              onChange={(v) => updatePartyCfg('enablePaymentReminder', v)}
              disabled={!canEdit}
              label="Enable Payment Reminder"
              description="Highlights due/overdue receivables on Dashboard and Parties Ledger."
            />

            {p.enablePaymentReminder && (
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="font-medium">Remind me for payment due in</span>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={p.paymentReminderDaysBeforeDue}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updatePartyCfg(
                        'paymentReminderDaysBeforeDue',
                        Math.max(0, Number(e.target.value))
                      )
                    }
                    className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-center font-bold tabular-nums"
                  />
                  <span className="font-medium">days before due date.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p.remindOnDueDate}
                      disabled={!canEdit}
                      onChange={(e) => updatePartyCfg('remindOnDueDate', e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Flag invoices due today</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p.remindAfterDueDate}
                      disabled={!canEdit}
                      onChange={(e) => updatePartyCfg('remindAfterDueDate', e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Repeat after due date ({p.paymentReminderAfterDays}d)</span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsReminderEditorOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{isReminderEditorOpen ? 'Hide Reminder Message Editor' : 'Reminder Message'}</span>
                  </button>

                  {p.enableWhatsAppReminderShare && (
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(renderedReminderSample)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Preview WhatsApp Share</span>
                    </a>
                  )}
                </div>

                {isReminderEditorOpen && (
                  <div className="space-y-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Payment Reminder Message Template
                    </label>
                    <textarea
                      rows={3}
                      value={p.paymentReminderMessage}
                      disabled={!canEdit}
                      onChange={(e) => updatePartyCfg('paymentReminderMessage', e.target.value)}
                      className={inputClass}
                    />
                    <div className="text-[10px] text-slate-500">
                      Supported placeholders: {'{customer_name}'}, {'{invoice_number}'}, {'{balance_amount}'}, {'{due_date}'}, {'{business_name}'}, {'{business_mobile}'}
                    </div>
                    <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-200">
                      <span className="font-bold text-slate-500 block text-[10px] uppercase mb-0.5">
                        Live Preview:
                      </span>
                      {renderedReminderSample}
                    </div>
                  </div>
                )}

                <ToggleSwitch
                  checked={p.enableWhatsAppReminderShare}
                  onChange={(v) => updatePartyCfg('enableWhatsAppReminderShare', v)}
                  disabled={!canEdit}
                  label="Enable Manual WhatsApp Reminder Button on Party Ledger"
                />
              </div>
            )}
          </SettingsCard>

          {/* 5. Party Form Validation & Credit Limit Rules */}
          <SettingsCard
            title="Party Form & Credit Preferences"
            subtitle="Mandatory fields and credit exposure protection"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  GSTIN Requirement
                </label>
                <select
                  value={p.gstinRequirement}
                  disabled={!canEdit}
                  onChange={(e) =>
                    updatePartyCfg(
                      'gstinRequirement',
                      e.target.value as BusinessSettingsBundle['party']['gstinRequirement']
                    )
                  }
                  className={inputClass}
                >
                  <option value="Optional">Optional</option>
                  <option value="Required for B2B">Required for B2B</option>
                  <option value="Always Required">Always Required</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <ToggleSwitch
                checked={p.customerMobileMandatory}
                onChange={(v) => updatePartyCfg('customerMobileMandatory', v)}
                disabled={!canEdit}
                label="Make Customer Mobile Number Mandatory"
              />
              <ToggleSwitch
                checked={p.supplierMobileMandatory}
                onChange={(v) => updatePartyCfg('supplierMobileMandatory', v)}
                disabled={!canEdit}
                label="Make Supplier Mobile Number Mandatory"
              />
              <ToggleSwitch
                checked={p.enableCreditLimitControl}
                onChange={(v) => updatePartyCfg('enableCreditLimitControl', v)}
                disabled={!canEdit}
                label="Warn When Customer Exceeds Credit Limit"
              />
            </div>
          </SettingsCard>
        </div>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: B. ADDITIONAL FIELDS (CUSTOM PARTY FIELDS)     */}
        {/* ============================================================ */}
        <div className="xl:col-span-6">
          <SettingsCard
            title="B. Additional Fields (Custom Party Fields)"
            subtitle="Enable custom fields shown in Add/Edit Party, Party Profile & Printed Invoices/PDFs"
            rightSlot={<FileText className="w-4 h-4 text-blue-600" />}
          >
            <div className="space-y-3">
              {p.additionalFields.map((field, idx) => (
                <div
                  key={field.id}
                  className={`p-3.5 rounded-xl border transition-colors ${
                    field.enabled
                      ? 'border-blue-200 dark:border-blue-900/60 bg-blue-50/25 dark:bg-blue-950/15'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.enabled}
                        disabled={!canEdit}
                        onChange={(e) =>
                          updateAdditionalField(idx, { enabled: e.target.checked })
                        }
                        className="rounded text-blue-600 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Additional Field {idx + 1}
                      </span>
                    </label>

                    <div className="flex items-center gap-3 text-[11px]">
                      <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={field.required}
                          disabled={!canEdit || !field.enabled}
                          onChange={(e) =>
                            updateAdditionalField(idx, { required: e.target.checked })
                          }
                          className="rounded text-blue-600"
                        />
                        <span>Required</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-blue-700 dark:text-blue-400">
                        <input
                          type="checkbox"
                          checked={field.showInPrint}
                          disabled={!canEdit || !field.enabled}
                          onChange={(e) =>
                            updateAdditionalField(idx, { showInPrint: e.target.checked })
                          }
                          className="rounded text-blue-600"
                        />
                        <span>Show in Print</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-600 dark:text-slate-400">
                        <input
                          type="checkbox"
                          checked={field.showInProfile}
                          disabled={!canEdit || !field.enabled}
                          onChange={(e) =>
                            updateAdditionalField(idx, { showInProfile: e.target.checked })
                          }
                          className="rounded text-blue-600"
                        />
                        <span>Profile</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-5">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Field Name
                      </label>
                      <input
                        type="text"
                        value={field.name}
                        disabled={!canEdit}
                        onChange={(e) => updateAdditionalField(idx, { name: e.target.value })}
                        placeholder={`Custom Field ${idx + 1}`}
                        className={inputClass}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Field Type
                      </label>
                      <select
                        value={field.fieldType}
                        disabled={!canEdit}
                        onChange={(e) =>
                          updateAdditionalField(idx, {
                            fieldType: e.target.value as CustomFieldType,
                          })
                        }
                        className={inputClass}
                      >
                        {FIELD_TYPES.map((ft) => (
                          <option key={ft} value={ft}>
                            {ft}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Default Value
                      </label>
                      <input
                        type={field.fieldType === 'Date' ? 'date' : 'text'}
                        value={field.defaultValue || ''}
                        disabled={!canEdit}
                        onChange={(e) =>
                          updateAdditionalField(idx, { defaultValue: e.target.value })
                        }
                        placeholder="Optional default"
                        className={inputClass}
                      />
                    </div>

                    {field.fieldType === 'Dropdown' && (
                      <div className="sm:col-span-12">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Dropdown Options (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={(field.options || []).join(', ')}
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateAdditionalField(idx, {
                              options: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="Option 1, Option 2, Option 3"
                          className={inputClass}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SettingsCard>
        </div>
      </div>
    </div>
  );
};
