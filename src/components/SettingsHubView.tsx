import React, { useEffect, useMemo, useState } from 'react';
import {
  Settings,
  Sliders,
  ArrowLeftRight,
  Printer,
  Percent,
  MessageSquare,
  Users,
  Package,
  BellRing,
  BookOpen,
  Shield,
  Wrench,
  UserCog,
  Search,
  Save,
  RotateCcw,
  X,
  Lock,
  Menu,
  ArrowLeft,
  Tags,
  Scale,
  Building2,
  ArrowRightLeft,
  History,
  QrCode,
  Briefcase,
  ShieldCheck,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import {
  BusinessSettingsBundle,
  CompanyProfile,
  CoreSettingsCategoryId,
  RoleSettingsAccessRule,
  SettingsCategoryId,
} from '../types';
import { CORE_SETTINGS_CATEGORIES, SETTINGS_SEARCH_INDEX } from '../data/defaultSettings';
import { MY_STORE_DATA_VERSION, validateBackupPayload } from '../utils/erpEngine';

import { GeneralSettingsPanel } from './settings/GeneralSettingsPanel';
import { TransactionSettingsPanel } from './settings/TransactionSettingsPanel';
import { PrintSettingsPanel } from './settings/PrintSettingsPanel';
import { TaxesGstSettingsPanel } from './settings/TaxesGstSettingsPanel';
import { TransactionMessagePanel } from './settings/TransactionMessagePanel';
import { PartySettingsPanel } from './settings/PartySettingsPanel';
import { ItemSettingsPanel } from './settings/ItemSettingsPanel';
import { ServiceRemindersPanel } from './settings/ServiceRemindersPanel';
import { AccountingSettingsPanel } from './settings/AccountingSettingsPanel';
import { RoleSettingsAccessPanel } from './settings/RoleSettingsAccessPanel';

import { CategoriesView } from './CategoriesView';
import { UnitsView } from './UnitsView';
import { WarehousesView } from './WarehousesView';
import { StockTransferView } from './StockTransferView';
import { AuditLogView } from './AuditLogView';
import { BarcodeStudioView } from './BarcodeStudioView';
import { SaleFaView } from './SaleFaView';
import { StaffManagementView } from './StaffManagementView';
import { CustomerStaffManagementView } from './portal/CustomerStaffManagementView';

type MastersToolId =
  | 'categories'
  | 'units'
  | 'warehouses'
  | 'stock-transfer'
  | 'audit-log'
  | 'barcode-studio'
  | 'sale-fa';

type AdminToolId = 'staff-management' | 'customer-staff-portal';

const CATEGORY_ICONS: Record<SettingsCategoryId, React.ComponentType<{ className?: string }>> = {
  general: Sliders,
  transaction: ArrowLeftRight,
  print: Printer,
  'taxes-gst': Percent,
  'transaction-message': MessageSquare,
  party: Users,
  item: Package,
  'service-reminders': BellRing,
  accounting: BookOpen,
  'role-access': Shield,
  masters: Wrench,
  'users-portal': UserCog,
  'audit-backup': History,
};

export const SettingsHubView: React.FC = () => {
  const {
    company,
    updateCompany,
    settings,
    transactions,
    parties,
    items,
    users,
    roles,
    employees,
    attendanceRecords,
    accounts,
    addAccount,
    sidebarCollapsed,
    expandedSidebarGroups,
    serverSyncStatus,
    lastServerSyncAt,
    syncNowWithServer,
    restoreFullBackup,
    exportModuleCsv,
    canAccessFeature,
    isAdminSession,
    currentUser,
    themePreference,
    setThemePreference,
    setActiveTab,
    setIsShortcutsModalOpen,
    showToast,
    businessSettings,
    partyGroups,
    serviceReminders,
    settingsAuditLogs,
    activeSettingsCategory,
    setActiveSettingsCategory,
    canViewSettingsCategory,
    canEditSettingsCategory,
    updateBusinessSettingsSection,
    updateRoleSettingsAccessRule,
    resetBusinessSettingsSection,
    addPartyGroup,
    updatePartyGroup,
    deletePartyGroup,
    addServiceReminder,
    updateServiceReminder,
    deleteServiceReminder,
  } = useVyapar();

  const [draft, setDraft] = useState<BusinessSettingsBundle>(businessSettings);
  const [companyDraft, setCompanyDraft] = useState<CompanyProfile>(company);
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    try {
      return localStorage.getItem('bm360_settings_search_query') || '';
    } catch {
      return '';
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsSidebarCollapsed, setSettingsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bm360_settings_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [pendingCategorySwitch, setPendingCategorySwitch] = useState<SettingsCategoryId | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [activeMasterTool, setActiveMasterTool] = useState<MastersToolId | null>(null);
  const [activeAdminTool, setActiveAdminTool] = useState<AdminToolId | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      if (searchQuery) {
        localStorage.setItem('bm360_settings_search_query', searchQuery);
      } else {
        localStorage.removeItem('bm360_settings_search_query');
      }
    } catch {
      // Ignore storage failures
    }
  }, [searchQuery]);

  useEffect(() => {
    try {
      localStorage.setItem('bm360_settings_sidebar_collapsed', String(settingsSidebarCollapsed));
    } catch {
      // Ignore storage failures
    }
  }, [settingsSidebarCollapsed]);

  // Sync draft when persisted bundle updates externally (e.g. reset or backend hydration)
  useEffect(() => {
    setDraft(businessSettings);
  }, [businessSettings]);

  useEffect(() => {
    setCompanyDraft(company);
  }, [company]);

  const currentRoleName = currentUser?.roleName || 'Owner';
  const currentRoleRule =
    businessSettings.roleSettingsAccess?.[currentRoleName] ||
    businessSettings.roleSettingsAccess?.['Owner'];

  const canManageRoleAccess =
    isAdminSession() || Boolean(currentRoleRule?.canManageRoleAccess);
  const canResetSettings =
    isAdminSession() || Boolean(currentRoleRule?.canResetSettings);
  const canBackupAndRestore =
    isAdminSession() || Boolean(currentRoleRule?.canBackupAndRestore);
  const canViewAuditHistory =
    isAdminSession() || Boolean(currentRoleRule?.canViewAuditHistory);

  const isDirty = useMemo(() => {
    return (
      JSON.stringify(draft) !== JSON.stringify(businessSettings) ||
      JSON.stringify(companyDraft) !== JSON.stringify(company)
    );
  }, [draft, businessSettings, companyDraft, company]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return SETTINGS_SEARCH_INDEX.filter(
      (entry) =>
        canViewSettingsCategory(entry.category) &&
        (entry.label.toLowerCase().includes(q) ||
          entry.categoryLabel.toLowerCase().includes(q) ||
          entry.keywords.toLowerCase().includes(q))
    );
  }, [searchQuery, canViewSettingsCategory]);

  const searchMatchesByCategory = useMemo(() => {
    const map: Partial<Record<SettingsCategoryId, number>> = {};
    for (const hit of searchResults) {
      map[hit.category] = (map[hit.category] || 0) + 1;
    }
    return map;
  }, [searchResults]);

  const applyCategorySelection = (catId: SettingsCategoryId) => {
    setActiveSettingsCategory(catId);
    setActiveMasterTool(null);
    setActiveAdminTool(null);
    setConfirmResetOpen(false);
    setPendingCategorySwitch(null);
    setMobileMenuOpen(false);
  };

  const handleSelectCategory = (catId: SettingsCategoryId) => {
    if (!canViewSettingsCategory(catId)) {
      showToast('Your role does not have permission to view this settings category.', 'warning');
      return;
    }
    if (catId !== activeSettingsCategory && isDirty) {
      setPendingCategorySwitch(catId);
      setMobileMenuOpen(false);
      return;
    }
    applyCategorySelection(catId);
  };

  const handleSaveAllChanges = async (): Promise<boolean> => {
    const gstinClean = (companyDraft.gstin || '').trim().toUpperCase();
    const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (draft.gst.isGstRegistered && gstinClean && !GSTIN_REGEX.test(gstinClean)) {
      showToast('Invalid GSTIN format. Expected 15-character alphanumeric GSTIN (e.g. 29ABCDE1234F1Z5).', 'error');
      return false;
    }

    // Save company profile if modified
    if (JSON.stringify(companyDraft) !== JSON.stringify(company)) {
      updateCompany(companyDraft);
    }

    // Persist modified settings sections
    const coreSections: Array<{
      cat: CoreSettingsCategoryId;
      key: keyof BusinessSettingsBundle;
    }> = [
      { cat: 'general', key: 'general' },
      { cat: 'transaction', key: 'transaction' },
      { cat: 'print', key: 'print' },
      { cat: 'taxes-gst', key: 'gst' },
      { cat: 'transaction-message', key: 'messages' },
      { cat: 'party', key: 'party' },
      { cat: 'item', key: 'item' },
      { cat: 'service-reminders', key: 'serviceReminders' },
      { cat: 'accounting', key: 'accounting' },
    ];

    for (const sec of coreSections) {
      if (JSON.stringify(draft[sec.key]) !== JSON.stringify(businessSettings[sec.key])) {
        const res = await updateBusinessSettingsSection(sec.cat, sec.key, draft[sec.key]);
        if (!res.success) return false;
      }
    }

    showToast('Settings saved and synced across Business Manager 360.', 'success');
    return true;
  };

  const handleCancelChanges = () => {
    setDraft(businessSettings);
    setCompanyDraft(company);
    setConfirmResetOpen(false);
    showToast('Unsaved changes discarded.', 'info');
  };

  const handleResetActiveSection = async () => {
    const coreMatch = CORE_SETTINGS_CATEGORIES.find((c) => c.id === activeSettingsCategory);
    if (coreMatch) {
      await resetBusinessSettingsSection(coreMatch.id);
    } else if (activeSettingsCategory === 'role-access') {
      await resetBusinessSettingsSection('role-access');
    }
    setConfirmResetOpen(false);
  };

  const handleExportFullBackup = () => {
    if (!canBackupAndRestore) {
      showToast('Your role is not permitted to export system backups.', 'warning');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const backupData = {
      app: 'MY STORE',
      schemaVersion: MY_STORE_DATA_VERSION,
      exportDate: new Date().toISOString(),
      company,
      settings,
      businessSettings,
      partyGroups,
      serviceReminders,
      transactions,
      parties,
      items,
      users,
      roles,
      employees,
      attendanceRecords,
      preferences: {
        sidebarCollapsed,
        expandedSidebarGroups,
      },
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `MY_STORE_BACKUP_${today}.json`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Backup downloaded as MY_STORE_BACKUP_${today}.json`, 'success');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canBackupAndRestore) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const validation = validateBackupPayload(parsed);
        if (!validation.valid) {
          showToast(validation.error || 'Backup validation failed', 'error');
          return;
        }
        const { restoredCounts } = await restoreFullBackup(parsed);
        const summary = Object.entries(restoredCounts)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        showToast(`Backup restored cleanly (${summary || 'settings updated'})!`, 'success');
      } catch {
        showToast('Invalid JSON backup file format', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUpdateRoleRule = (roleName: string, rule: RoleSettingsAccessRule) => {
    setDraft((prev) => ({
      ...prev,
      roleSettingsAccess: {
        ...prev.roleSettingsAccess,
        [roleName]: rule,
      },
    }));
    void updateRoleSettingsAccessRule(roleName, rule);
  };

  const masterTools: Array<{
    id: MastersToolId;
    title: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
    featureKey: string;
  }> = [
    {
      id: 'categories',
      title: 'Categories',
      desc: 'Organize product groups, catalog tags & category stock valuations.',
      icon: Tags,
      featureKey: 'categories',
    },
    {
      id: 'units',
      title: 'Units of Measurement',
      desc: 'Manage PCS, BOX, KG, LTR, decimal precisions & conversions.',
      icon: Scale,
      featureKey: 'units',
    },
    {
      id: 'warehouses',
      title: 'Warehouses / Godowns',
      desc: 'Configure multi-location storage hubs & godown managers.',
      icon: Building2,
      featureKey: 'warehouses',
    },
    {
      id: 'stock-transfer',
      title: 'Stock Transfer',
      desc: 'Move stock between central warehouse and retail branches.',
      icon: ArrowRightLeft,
      featureKey: 'stock-transfer',
    },
    {
      id: 'audit-log',
      title: 'Stock History & Audit Log',
      desc: 'Inspect stock adjustments, invoice edits & security logs.',
      icon: History,
      featureKey: 'audit-log',
    },
    {
      id: 'barcode-studio',
      title: 'Barcode Studio',
      desc: 'Generate, scan-test & print custom SKU barcode sticker labels.',
      icon: QrCode,
      featureKey: 'barcode-studio',
    },
    {
      id: 'sale-fa',
      title: 'Fixed Assets',
      desc: 'Track disposal and sale of store equipment & fixtures.',
      icon: Briefcase,
      featureKey: 'sale-fa',
    },
  ];

  const activeCategoryMeta = useMemo(() => {
    const core = CORE_SETTINGS_CATEGORIES.find((c) => c.id === activeSettingsCategory);
    if (core) return core;
    if (activeSettingsCategory === 'role-access') {
      return {
        id: 'role-access',
        label: 'Settings by Role',
        description: 'Control which staff roles can View or Edit each settings category & view audit history',
      };
    }
    if (activeSettingsCategory === 'masters') {
      return {
        id: 'masters',
        label: 'Masters & Utilities',
        description: 'Categories, units, godowns, stock transfers, barcode labels & audit trail',
      };
    }
    return {
      id: 'users-portal',
      label: 'Users, Staff & Portal',
      description: 'Manage employee RBAC permissions, customer accounts & staff credentials',
    };
  }, [activeSettingsCategory]);

  const canEditCurrent = canEditSettingsCategory(activeSettingsCategory);
  const isCoreCategory = CORE_SETTINGS_CATEGORIES.some((c) => c.id === activeSettingsCategory);
  const isEmbeddedFullScreen =
    (activeSettingsCategory === 'masters' && activeMasterTool !== null) ||
    (activeSettingsCategory === 'users-portal' && activeAdminTool !== null);

  const sidebarContent = (isCollapsedDesktop: boolean) => (
    <div className="h-full flex flex-col bg-[#0f172a] text-slate-200 select-none">
      {/* Sidebar Brand Header */}
      <div className="px-3.5 py-4 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Settings className="w-4 h-4" />
          </div>
          {!isCollapsedDesktop && (
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">Settings</div>
              <div className="text-[10px] text-slate-400 truncate">Business Manager 360</div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSettingsSidebarCollapsed((c) => !c)}
          title={isCollapsedDesktop ? 'Expand Settings Sidebar' : 'Collapse Settings Sidebar'}
          className="hidden lg:inline-flex p-1 text-slate-400 hover:text-white rounded cursor-pointer"
        >
          {isCollapsedDesktop ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1 text-slate-400 hover:text-white rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Searchable Settings Input */}
      {isCollapsedDesktop ? (
        <div className="p-2 border-b border-slate-800 flex justify-center">
          <button
            type="button"
            title="Expand & Search Settings"
            aria-label="Search settings"
            onClick={() => {
              setSettingsSidebarCollapsed(false);
              setTimeout(() => searchInputRef.current?.focus(), 60);
            }}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              searchQuery.trim()
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="p-3 border-b border-slate-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings..."
              aria-label="Search settings"
              className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Persistent Search Hits */}
          {searchQuery.trim() !== '' && (
            <div className="mt-2 rounded-lg bg-slate-900 border border-slate-700 divide-y divide-slate-800 max-h-56 overflow-y-auto">
              <div className="px-2.5 py-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-950/60">
                <span>{searchResults.length} setting match{searchResults.length === 1 ? '' : 'es'}</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-blue-400 hover:text-blue-300 normal-case cursor-pointer"
                >
                  Clear
                </button>
              </div>
              {searchResults.length === 0 ? (
                <div className="px-2.5 py-3 text-[11px] text-slate-400 text-center">
                  No settings match &ldquo;{searchQuery.trim()}&rdquo;
                </div>
              ) : (
                searchResults.map((res) => {
                  const HitIcon = CATEGORY_ICONS[res.category] || Settings;
                  const isCurrentHitCat = activeSettingsCategory === res.category;
                  return (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => handleSelectCategory(res.category)}
                      className={`w-full text-left px-2.5 py-2 flex items-start gap-2 transition-colors cursor-pointer ${
                        isCurrentHitCat ? 'bg-blue-950/70' : 'hover:bg-slate-800'
                      }`}
                    >
                      <HitIcon className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-white leading-snug">{res.label}</div>
                        <div className="text-[10px] text-blue-400">{res.categoryLabel}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Categories List */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-5" aria-label="Settings Categories">
        <div>
          {!isCollapsedDesktop && (
            <div className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Core Configuration
            </div>
          )}
          <div className="space-y-0.5">
            {CORE_SETTINGS_CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.id];
              const canView = canViewSettingsCategory(cat.id);
              const canEditCat = canEditSettingsCategory(cat.id);
              const active = activeSettingsCategory === cat.id;
              const matchCount = searchMatchesByCategory[cat.id] || 0;

              return (
                <button
                  key={cat.id}
                  type="button"
                  disabled={!canView}
                  aria-current={active ? 'page' : undefined}
                  title={cat.label}
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`w-full flex items-center ${isCollapsedDesktop ? 'justify-center px-2' : 'justify-between px-3'} gap-2 py-2 rounded-lg text-xs transition-colors ${
                    active
                      ? 'bg-blue-600 text-white font-bold shadow-2xs'
                      : matchCount > 0 && canView
                      ? 'bg-slate-800/90 text-white font-semibold ring-1 ring-blue-500/50 cursor-pointer'
                      : canView
                      ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium cursor-pointer'
                      : 'text-slate-600 opacity-55 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : matchCount > 0 ? 'text-blue-400' : 'text-slate-400'}`} />
                    {!isCollapsedDesktop && <span className="truncate">{cat.label}</span>}
                  </div>
                  {!isCollapsedDesktop &&
                    (!canView ? (
                      <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                    ) : matchCount > 0 ? (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${active ? 'bg-blue-500 text-white' : 'bg-blue-600/30 text-blue-300'}`}>
                        {matchCount}
                      </span>
                    ) : !canEditCat ? (
                      <span className="text-[9px] font-semibold uppercase text-slate-400">View</span>
                    ) : null)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Role Access & Store Administration */}
        <div>
          {!isCollapsedDesktop && (
            <div className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Access &amp; Administration
            </div>
          )}
          <div className="space-y-0.5">
            {[
              {
                id: 'role-access' as const,
                label: 'Settings by Role',
                visible: canManageRoleAccess || canViewAuditHistory,
              },
              { id: 'masters' as const, label: 'Masters & Utilities', visible: true },
              { id: 'users-portal' as const, label: 'Users, Staff & Portal', visible: true },
            ].map((item) => {
              const Icon = CATEGORY_ICONS[item.id];
              const active = activeSettingsCategory === item.id;
              const matchCount = searchMatchesByCategory[item.id] || 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.visible}
                  aria-current={active ? 'page' : undefined}
                  title={item.label}
                  onClick={() => handleSelectCategory(item.id)}
                  className={`w-full flex items-center ${isCollapsedDesktop ? 'justify-center px-2' : 'justify-between px-3'} gap-2 py-2 rounded-lg text-xs transition-colors ${
                    active
                      ? 'bg-blue-600 text-white font-bold'
                      : matchCount > 0 && item.visible
                      ? 'bg-slate-800/90 text-white font-semibold ring-1 ring-blue-500/50 cursor-pointer'
                      : item.visible
                      ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium cursor-pointer'
                      : 'text-slate-600 opacity-55 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : matchCount > 0 ? 'text-blue-400' : 'text-slate-400'}`} />
                    {!isCollapsedDesktop && <span className="truncate">{item.label}</span>}
                  </div>
                  {!isCollapsedDesktop &&
                    (!item.visible ? (
                      <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                    ) : matchCount > 0 ? (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${active ? 'bg-blue-500 text-white' : 'bg-blue-600/30 text-blue-300'}`}>
                        {matchCount}
                      </span>
                    ) : null)}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Role Footer */}
      <div className="px-4 py-3 border-t border-slate-800 text-[11px] text-slate-400 text-center lg:text-left">
        {isCollapsedDesktop ? (
          <strong className="text-slate-200">{currentRoleName.slice(0, 3)}</strong>
        ) : (
          <>
            Active Role: <strong className="text-slate-200">{currentRoleName}</strong>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex bg-[#f8fafc] dark:bg-slate-950 overflow-hidden text-xs text-slate-800 dark:text-slate-100 relative">
      {/* Desktop Dark Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 border-r border-slate-200 dark:border-slate-800 transition-all duration-200 ${
          settingsSidebarCollapsed ? 'w-[68px]' : 'w-64'
        }`}
      >
        {sidebarContent(settingsSidebarCollapsed)}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-68 h-full shadow-2xl">{sidebarContent(false)}</div>
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="flex-1 bg-black/50"
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Action Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open settings menu"
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              {(() => {
                const ActiveHeaderIcon = CATEGORY_ICONS[activeSettingsCategory] || Settings;
                return <ActiveHeaderIcon className="w-4 h-4" />;
              })()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                  {activeCategoryMeta.label}
                </h1>
                {!canEditCurrent && isCoreCategory && (
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                    Read Only
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {activeCategoryMeta.description}
              </p>
            </div>
          </div>

          {/* Primary Save / Cancel / Reset Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {(isCoreCategory || activeSettingsCategory === 'role-access') && canResetSettings && (
              <button
                type="button"
                onClick={() => setConfirmResetOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset to Default</span>
              </button>
            )}

            {isDirty && (
              <>
                <button
                  type="button"
                  onClick={handleCancelChanges}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllChanges}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Inline Reset Confirmation Strip */}
        {confirmResetOpen && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Reset <strong>{activeCategoryMeta.label}</strong> back to factory defaults? Your invoices, customers, and items will not be deleted.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetActiveSection}
                className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs cursor-pointer"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-3 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Keep Current
              </button>
            </div>
          </div>
        )}

        {/* Unsaved Changes Reminder Bar */}
        {isDirty && !pendingCategorySwitch && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-900 px-6 py-2 flex items-center justify-between gap-2 text-xs text-blue-900 dark:text-blue-200 shrink-0">
            <span>You have unsaved configuration changes in <strong>{activeCategoryMeta.label}</strong>.</span>
            <button
              type="button"
              onClick={() => void handleSaveAllChanges()}
              className="font-bold text-blue-700 dark:text-blue-300 underline cursor-pointer"
            >
              Save Changes Now
            </button>
          </div>
        )}

        {/* Unsaved Changes Navigation Guard */}
        {pendingCategorySwitch && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-800 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                You have unsaved changes in <strong>{activeCategoryMeta.label}</strong>. Save or discard before switching tabs?
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const ok = await handleSaveAllChanges();
                  if (ok && pendingCategorySwitch) applyCategorySelection(pendingCategorySwitch);
                }}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer"
              >
                Save &amp; Switch
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(businessSettings);
                  setCompanyDraft(company);
                  if (pendingCategorySwitch) applyCategorySelection(pendingCategorySwitch);
                }}
                className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs cursor-pointer"
              >
                Discard &amp; Switch
              </button>
              <button
                type="button"
                onClick={() => setPendingCategorySwitch(null)}
                className="px-3 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Stay Here
              </button>
            </div>
          </div>
        )}

        {/* Body Content */}
        {isEmbeddedFullScreen ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-2 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveMasterTool(null);
                  setActiveAdminTool(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-semibold text-xs cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to {activeCategoryMeta.label}</span>
              </button>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeMasterTool === 'categories' && <CategoriesView />}
              {activeMasterTool === 'units' && <UnitsView />}
              {activeMasterTool === 'warehouses' && <WarehousesView />}
              {activeMasterTool === 'stock-transfer' && <StockTransferView />}
              {activeMasterTool === 'audit-log' && <AuditLogView />}
              {activeMasterTool === 'barcode-studio' && <BarcodeStudioView />}
              {activeMasterTool === 'sale-fa' && <SaleFaView />}
              {activeAdminTool === 'staff-management' && <StaffManagementView />}
              {activeAdminTool === 'customer-staff-portal' && <CustomerStaffManagementView />}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-6xl mx-auto">
              {activeSettingsCategory === 'general' && (
                <GeneralSettingsPanel
                  draft={draft}
                  setDraft={setDraft}
                  companyDraft={companyDraft}
                  setCompanyDraft={setCompanyDraft}
                  canEdit={canEditCurrent}
                  canBackupAndRestore={canBackupAndRestore}
                  themePreference={themePreference}
                  onChangeTheme={(mode) => {
                    setThemePreference(mode);
                    showToast(`Theme updated to ${mode}.`);
                  }}
                  onExportBackup={handleExportFullBackup}
                  onImportBackup={handleImportBackup}
                  onExportModuleCsv={exportModuleCsv}
                  onSyncServer={async () => {
                    const ok = await syncNowWithServer();
                    showToast(ok ? 'Synced with server cleanly.' : 'Server sync failed.', ok ? 'success' : 'error');
                  }}
                  serverSyncStatus={serverSyncStatus}
                  lastServerSyncAt={lastServerSyncAt}
                  onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
                  onOpenErpTools={() => setActiveTab('erp-tools')}
                  showToast={showToast}
                />
              )}

              {activeSettingsCategory === 'transaction' && (
                <TransactionSettingsPanel
                  draft={draft}
                  setDraft={setDraft}
                  canEdit={canEditCurrent}
                />
              )}

              {activeSettingsCategory === 'print' && (
                <PrintSettingsPanel
                  draft={draft}
                  setDraft={setDraft}
                  companyDraft={companyDraft}
                  canEdit={canEditCurrent}
                />
              )}

              {activeSettingsCategory === 'taxes-gst' && (
                <TaxesGstSettingsPanel
                  draft={draft}
                  setDraft={setDraft}
                  companyDraft={companyDraft}
                  setCompanyDraft={setCompanyDraft}
                  canEdit={canEditCurrent}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              )}

              {activeSettingsCategory === 'transaction-message' && (
                <TransactionMessagePanel
                  draft={draft}
                  setDraft={setDraft}
                  companyDraft={companyDraft}
                  canEdit={canEditCurrent}
                  showToast={showToast}
                />
              )}

              {activeSettingsCategory === 'party' && (
                <PartySettingsPanel
                  draft={draft}
                  setDraft={setDraft}
                  companyDraft={companyDraft}
                  partyGroups={partyGroups}
                  onAddPartyGroup={addPartyGroup}
                  onUpdatePartyGroup={updatePartyGroup}
                  onDeletePartyGroup={deletePartyGroup}
                  canEdit={canEditCurrent}
                  showToast={showToast}
                />
              )}

              {activeSettingsCategory === 'item' && (
                <ItemSettingsPanel
                  draft={draft}
                  setDraft={setDraft}
                  canEdit={canEditCurrent}
                  showToast={showToast}
                />
              )}

              {activeSettingsCategory === 'service-reminders' && (
                <ServiceRemindersPanel
                  draft={draft}
                  setDraft={setDraft}
                  serviceReminders={serviceReminders}
                  parties={parties}
                  onAddReminder={addServiceReminder}
                  onUpdateReminder={updateServiceReminder}
                  onDeleteReminder={deleteServiceReminder}
                  canEdit={canEditCurrent}
                  showToast={showToast}
                />
              )}

              {activeSettingsCategory === 'accounting' && (
                <AccountingSettingsPanel
                  draft={draft}
                  setDraft={setDraft}
                  accounts={accounts}
                  onAddAccount={addAccount}
                  canEdit={canEditCurrent}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  showToast={showToast}
                />
              )}

              {activeSettingsCategory === 'role-access' && (
                <RoleSettingsAccessPanel
                  draft={draft}
                  roles={roles}
                  onUpdateRoleRule={handleUpdateRoleRule}
                  auditLogs={settingsAuditLogs}
                  canManageRoleAccess={canManageRoleAccess}
                  canViewAuditHistory={canViewAuditHistory}
                />
              )}

              {activeSettingsCategory === 'masters' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {masterTools.map((tool) => {
                    const Icon = tool.icon;
                    const allowed = canAccessFeature(tool.featureKey);
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => {
                          if (!allowed) {
                            showToast(`Access restricted for ${tool.title}.`, 'warning');
                            return;
                          }
                          setActiveMasterTool(tool.id);
                        }}
                        className={`text-left bg-white dark:bg-slate-900 rounded-xl border p-4 shadow-2xs transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                          allowed
                            ? 'border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:shadow-sm'
                            : 'border-slate-200/80 opacity-65'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          {!allowed && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-semibold">
                              <Lock className="w-3 h-3" />
                              Restricted
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white">{tool.title}</div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{tool.desc}</p>
                        </div>
                        <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                          {allowed ? 'Open Tool →' : 'Permission Required'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeSettingsCategory === 'users-portal' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (!canAccessFeature('staff-management')) {
                        showToast('Access restricted for User & Role Management.', 'warning');
                        return;
                      }
                      setActiveAdminTool('staff-management');
                    }}
                    className="text-left bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 p-5 shadow-2xs transition-all flex flex-col justify-between gap-4 cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
                      <UserCog className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        User &amp; Role Management (RBAC)
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Configure staff profiles, module permissions, attendance, active sessions &amp; invitations.
                      </p>
                    </div>
                    <div className="text-xs font-bold text-blue-600">Open User &amp; Role Management →</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isAdminSession()) {
                        showToast('Administrator access required for Portal Admin.', 'warning');
                        return;
                      }
                      setActiveAdminTool('customer-staff-portal');
                    }}
                    className="text-left bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 p-5 shadow-2xs transition-all flex flex-col justify-between gap-4 cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        Customer &amp; Staff Portal Controls
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Manage Customer Accounts, Staff Accounts, Login History &amp; Account Status.
                      </p>
                    </div>
                    <div className="text-xs font-bold text-blue-600">Open Portal Admin →</div>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
