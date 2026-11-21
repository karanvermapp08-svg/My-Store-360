import React, { useState } from 'react';
import { Shield, Lock, History, CheckCircle2 } from 'lucide-react';
import {
  BusinessSettingsBundle,
  CoreSettingsCategoryId,
  RoleDefinition,
  RoleSettingsAccessRule,
  SettingsAuditEntry,
} from '../../types';
import { CORE_SETTINGS_CATEGORIES } from '../../data/defaultSettings';
import { SettingsCard, ToggleSwitch } from './SettingsUi';

interface RoleSettingsAccessPanelProps {
  draft: BusinessSettingsBundle;
  roles: RoleDefinition[];
  onUpdateRoleRule: (roleName: string, rule: RoleSettingsAccessRule) => void;
  auditLogs: SettingsAuditEntry[];
  canManageRoleAccess: boolean;
  canViewAuditHistory: boolean;
}

export const RoleSettingsAccessPanel: React.FC<RoleSettingsAccessPanelProps> = ({
  draft,
  roles,
  onUpdateRoleRule,
  auditLogs,
  canManageRoleAccess,
  canViewAuditHistory,
}) => {
  const roleNames = Array.from(
    new Set([
      'Owner',
      'Admin',
      'Manager',
      'Accountant',
      'Cashier',
      'Sales',
      'Purchase',
      'Inventory',
      'Delivery',
      ...roles.map((r) => r.name),
      ...Object.keys(draft.roleSettingsAccess || {}),
    ])
  );

  const [selectedRole, setSelectedRole] = useState<string>(roleNames[0] || 'Manager');

  const activeRule: RoleSettingsAccessRule = draft.roleSettingsAccess?.[selectedRole] || {
    roleName: selectedRole,
    categories: CORE_SETTINGS_CATEGORIES.reduce(
      (acc, c) => ({ ...acc, [c.id]: { view: true, edit: false } }),
      {} as Record<CoreSettingsCategoryId, { view: boolean; edit: boolean }>
    ),
    canManageRoleAccess: false,
    canResetSettings: false,
    canBackupAndRestore: false,
    canViewAuditHistory: false,
  };

  const isLockedOwnerRole = selectedRole === 'Owner' || selectedRole === 'Admin';
  const editable = canManageRoleAccess && !isLockedOwnerRole;

  const setCatPerm = (catId: CoreSettingsCategoryId, mode: 'view' | 'edit', value: boolean) => {
    if (!editable) return;
    const prevCat = activeRule.categories[catId] || { view: false, edit: false };
    const nextCat =
      mode === 'edit'
        ? { view: value ? true : prevCat.view, edit: value }
        : { view: value, edit: value ? prevCat.edit : false };

    onUpdateRoleRule(selectedRole, {
      ...activeRule,
      categories: {
        ...activeRule.categories,
        [catId]: nextCat,
      },
    });
  };

  const setFlag = (
    key: 'canManageRoleAccess' | 'canResetSettings' | 'canBackupAndRestore' | 'canViewAuditHistory',
    val: boolean
  ) => {
    if (!editable) return;
    onUpdateRoleRule(selectedRole, {
      ...activeRule,
      [key]: val,
    });
  };

  const grantPreset = (preset: 'full' | 'view-only' | 'none') => {
    if (!editable) return;
    const nextCats = CORE_SETTINGS_CATEGORIES.reduce((acc, c) => {
      acc[c.id] =
        preset === 'full'
          ? { view: true, edit: true }
          : preset === 'view-only'
          ? { view: true, edit: false }
          : { view: false, edit: false };
      return acc;
    }, {} as Record<CoreSettingsCategoryId, { view: boolean; edit: boolean }>);

    onUpdateRoleRule(selectedRole, {
      ...activeRule,
      categories: nextCats,
    });
  };

  return (
    <div className="space-y-5">
      {!canManageRoleAccess && (
        <div className="px-4 py-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            <strong>Administrator Lock:</strong> Only Owner / Admin roles can modify Settings Role Permissions.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Role Selector */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <span>Select Staff Role</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {roleNames.map((rn) => {
              const rule = draft.roleSettingsAccess?.[rn];
              const editCount = rule
                ? Object.values(rule.categories).filter((c) => c.edit).length
                : 0;
              const viewCount = rule
                ? Object.values(rule.categories).filter((c) => c.view).length
                : 0;
              const active = selectedRole === rn;

              return (
                <button
                  key={rn}
                  type="button"
                  onClick={() => setSelectedRole(rn)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                    active
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span>{rn}</span>
                  <span className="text-[10px] text-slate-500 tabular-nums">
                    {editCount} Edit · {viewCount} View
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Category Matrix for Selected Role */}
        <div className="lg:col-span-8 space-y-5">
          <SettingsCard
            title={`Settings Permissions — ${selectedRole}`}
            subtitle={
              isLockedOwnerRole
                ? 'Owner & Admin roles always retain full Settings access to prevent accidental lockout.'
                : 'Choose which settings categories this role can View or Edit (enforced on both UI & Server API).'
            }
            rightSlot={
              editable && (
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => grantPreset('full')}
                    className="px-2.5 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 cursor-pointer"
                  >
                    Allow All Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => grantPreset('view-only')}
                    className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    View Only All
                  </button>
                  <button
                    type="button"
                    onClick={() => grantPreset('none')}
                    className="px-2.5 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 font-semibold hover:bg-rose-100 cursor-pointer"
                  >
                    Revoke All
                  </button>
                </div>
              )
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase">
                    <th className="py-2 pr-3">Settings Category</th>
                    <th className="py-2 px-3 text-center w-24">Can View</th>
                    <th className="py-2 px-3 text-center w-24">Can Edit</th>
                    <th className="py-2 pl-3 text-right">Effective Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {CORE_SETTINGS_CATEGORIES.map((cat) => {
                    const perm = activeRule.categories?.[cat.id] || { view: false, edit: false };
                    return (
                      <tr key={cat.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 pr-3">
                          <div className="font-semibold text-slate-900 dark:text-white">{cat.label}</div>
                          <div className="text-[11px] text-slate-500">{cat.description}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={perm.view}
                            disabled={!editable}
                            onChange={(e) => setCatPerm(cat.id, 'view', e.target.checked)}
                            className="rounded text-blue-600 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={perm.edit}
                            disabled={!editable}
                            onChange={(e) => setCatPerm(cat.id, 'edit', e.target.checked)}
                            className="rounded text-blue-600 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 pl-3 text-right text-[11px] font-bold">
                          {perm.edit ? (
                            <span className="text-emerald-700 dark:text-emerald-400">Full Edit</span>
                          ) : perm.view ? (
                            <span className="text-amber-600">View Only</span>
                          ) : (
                            <span className="text-slate-400">Hidden</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Sensitive Administrative Privileges
              </div>
              <ToggleSwitch
                checked={activeRule.canBackupAndRestore}
                onChange={(v) => setFlag('canBackupAndRestore', v)}
                disabled={!editable}
                label="Allow Backup Download & JSON Data Restore"
              />
              <ToggleSwitch
                checked={activeRule.canViewAuditHistory}
                onChange={(v) => setFlag('canViewAuditHistory', v)}
                disabled={!editable}
                label="Allow Viewing Settings Change Audit Log"
              />
              <ToggleSwitch
                checked={activeRule.canResetSettings}
                onChange={(v) => setFlag('canResetSettings', v)}
                disabled={!editable}
                label="Allow Resetting Settings Sections to Defaults"
              />
              <ToggleSwitch
                checked={activeRule.canManageRoleAccess}
                onChange={(v) => setFlag('canManageRoleAccess', v)}
                disabled={!editable}
                label="Allow Managing Settings Role Permissions"
              />
            </div>
          </SettingsCard>
        </div>
      </div>

      {/* Settings Change Audit Log */}
      {canViewAuditHistory && (
        <SettingsCard
          title="Settings Change Audit Trail"
          subtitle="Tracks every setting update with actor, role, timestamp, and previous vs. new diff"
          rightSlot={<History className="w-4 h-4 text-blue-600" />}
        >
          {auditLogs.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center gap-1">
              <CheckCircle2 className="w-5 h-5 text-slate-300" />
              <span>No settings changes logged in this session yet.</span>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase">
                    <th className="py-2 pr-3">Timestamp</th>
                    <th className="py-2 px-2">Category</th>
                    <th className="py-2 px-2">Setting</th>
                    <th className="py-2 px-2">Actor</th>
                    <th className="py-2 pl-2">Summary / Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditLogs.slice(0, 25).map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-2 pr-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-2 font-semibold capitalize text-blue-700 dark:text-blue-400 whitespace-nowrap">
                        {entry.category}
                      </td>
                      <td className="py-2 px-2 font-medium text-slate-800 dark:text-slate-200">
                        {entry.settingName}
                      </td>
                      <td className="py-2 px-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {entry.changedBy} ({entry.changedRole})
                      </td>
                      <td className="py-2 pl-2 text-[11px] text-slate-500 truncate max-w-xs">
                        {entry.newValue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SettingsCard>
      )}
    </div>
  );
};
