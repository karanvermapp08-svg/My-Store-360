import React from 'react';
import {
  X,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  LayoutGrid,
  Check,
} from 'lucide-react';

export type DashboardWidgetId =
  | 'quick_actions'
  | 'financial_summaries'
  | 'liquidity_inventory'
  | 'today_pulse'
  | 'monthly_pulse'
  | 'unified_graphs'
  | 'targets_achievement'
  | 'collections_reminders'
  | 'leaderboards'
  | 'recent_transactions'
  | 'role_operations';

export type DashboardPresetId = 'executive' | 'financial' | 'operations' | 'compact' | 'custom';

export interface DashboardWidgetConfig {
  id: DashboardWidgetId;
  title: string;
  description: string;
  category: 'Actions' | 'KPIs' | 'Charts' | 'Collections' | 'Operations';
}

export interface DashboardLayoutState {
  order: DashboardWidgetId[];
  hidden: DashboardWidgetId[];
  preset: DashboardPresetId;
}

export const ALL_WIDGETS: DashboardWidgetConfig[] = [
  {
    id: 'quick_actions',
    title: 'Quick Actions Bar',
    description: 'New sale, purchase, expense, income, payment, item & stock shortcuts',
    category: 'Actions',
  },
  {
    id: 'financial_summaries',
    title: 'Financial Summaries',
    description: 'Sales, purchase, profit, expense & income totals for the active period',
    category: 'KPIs',
  },
  {
    id: 'liquidity_inventory',
    title: 'Cash, Bank & Inventory Health',
    description: 'Cash balance, bank balance, receivables, payables, stock value & alerts',
    category: 'KPIs',
  },
  {
    id: 'today_pulse',
    title: "Today's Business Pulse",
    description: "Today's sales, purchases, expenses, income & net profit",
    category: 'KPIs',
  },
  {
    id: 'monthly_pulse',
    title: 'Monthly Performance Summary',
    description: 'Monthly sales, monthly purchases & monthly profit breakdown',
    category: 'KPIs',
  },
  {
    id: 'unified_graphs',
    title: 'Unified & Mini-Graphs Suite',
    description: 'Interactive tabbed chart plus 5 sparklines (Sales, Purchase, Profit, Expense, Income)',
    category: 'Charts',
  },
  {
    id: 'targets_achievement',
    title: 'Targets & Achievement %',
    description: 'Editable Sales, Purchase & Profit targets with live achievement progress',
    category: 'KPIs',
  },
  {
    id: 'collections_reminders',
    title: 'Pending, Overdue & Payment Reminders',
    description: 'Unpaid balances, overdue invoice tracker & WhatsApp/SMS/Email reminders',
    category: 'Collections',
  },
  {
    id: 'leaderboards',
    title: 'Top Customers, Suppliers & Items',
    description: 'Ranked revenue customers, purchase suppliers & top-selling SKUs',
    category: 'Operations',
  },
  {
    id: 'recent_transactions',
    title: 'Recent Transactions Ledger',
    description: 'Latest invoices, bills, expenses & receipts with instant preview',
    category: 'Operations',
  },
  {
    id: 'role_operations',
    title: 'Branch Oversight / Supervisor Queue',
    description: 'Owner branch & security controls or Manager approval queue',
    category: 'Operations',
  },
];

export const DEFAULT_OWNER_ORDER: DashboardWidgetId[] = [
  'quick_actions',
  'financial_summaries',
  'liquidity_inventory',
  'today_pulse',
  'monthly_pulse',
  'unified_graphs',
  'targets_achievement',
  'collections_reminders',
  'leaderboards',
  'recent_transactions',
  'role_operations',
];

export const DEFAULT_MANAGER_ORDER: DashboardWidgetId[] = [
  'quick_actions',
  'today_pulse',
  'role_operations',
  'liquidity_inventory',
  'financial_summaries',
  'monthly_pulse',
  'collections_reminders',
  'unified_graphs',
  'targets_achievement',
  'leaderboards',
  'recent_transactions',
];

export const PRESET_LAYOUTS: Record<Exclude<DashboardPresetId, 'custom'>, {
  label: string;
  subtitle: string;
  order: DashboardWidgetId[];
  hidden: DashboardWidgetId[];
}> = {
  executive: {
    label: 'Executive Overview',
    subtitle: 'Full 40-metric command center',
    order: DEFAULT_OWNER_ORDER,
    hidden: [],
  },
  financial: {
    label: 'Financial Focus',
    subtitle: 'Summaries, liquidity, graphs & targets first',
    order: [
      'financial_summaries',
      'liquidity_inventory',
      'unified_graphs',
      'targets_achievement',
      'monthly_pulse',
      'today_pulse',
      'collections_reminders',
      'recent_transactions',
      'leaderboards',
      'quick_actions',
      'role_operations',
    ],
    hidden: [],
  },
  operations: {
    label: 'Daily Operations',
    subtitle: 'Floor activity, today pulse, approvals & reminders',
    order: DEFAULT_MANAGER_ORDER,
    hidden: [],
  },
  compact: {
    label: 'Compact Mode',
    subtitle: 'Essential KPIs, graphs & recent ledger only',
    order: [
      'quick_actions',
      'financial_summaries',
      'liquidity_inventory',
      'unified_graphs',
      'collections_reminders',
      'recent_transactions',
      'today_pulse',
      'monthly_pulse',
      'targets_achievement',
      'leaderboards',
      'role_operations',
    ],
    hidden: ['monthly_pulse', 'leaderboards'],
  },
};

export function getDefaultLayoutForRole(role: 'owner' | 'manager'): DashboardLayoutState {
  return role === 'owner'
    ? { order: DEFAULT_OWNER_ORDER, hidden: [], preset: 'executive' }
    : { order: DEFAULT_MANAGER_ORDER, hidden: [], preset: 'operations' };
}

interface DashboardCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  layout: DashboardLayoutState;
  onChangeLayout: (next: DashboardLayoutState) => void;
  role: 'owner' | 'manager';
}

export const DashboardCustomizer: React.FC<DashboardCustomizerProps> = ({
  isOpen,
  onClose,
  layout,
  onChangeLayout,
  role,
}) => {
  if (!isOpen) return null;

  const widgetMap = new Map(ALL_WIDGETS.map((w) => [w.id, w]));

  const toggleVisibility = (id: DashboardWidgetId) => {
    const isHidden = layout.hidden.includes(id);
    const nextHidden = isHidden
      ? layout.hidden.filter((h) => h !== id)
      : [...layout.hidden, id];
    onChangeLayout({
      ...layout,
      hidden: nextHidden,
      preset: 'custom',
    });
  };

  const moveWidget = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= layout.order.length) return;
    const nextOrder = [...layout.order];
    const [removed] = nextOrder.splice(index, 1);
    nextOrder.splice(targetIdx, 0, removed);
    onChangeLayout({
      ...layout,
      order: nextOrder,
      preset: 'custom',
    });
  };

  const applyPreset = (presetId: Exclude<DashboardPresetId, 'custom'>) => {
    const p = PRESET_LAYOUTS[presetId];
    onChangeLayout({
      order: [...p.order],
      hidden: [...p.hidden],
      preset: presetId,
    });
  };

  const visibleCount = layout.order.length - layout.hidden.length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-2xs">
      <div className="w-full max-w-md bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden text-xs text-slate-800">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Customize Dashboard &amp; Widgets</h2>
              <p className="text-[11px] text-slate-500">
                {visibleCount} of {layout.order.length} widgets active · Saved per workspace
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Close customizer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Layout Presets */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900">Layout Presets</h3>
              <button
                type="button"
                onClick={() => onChangeLayout(getDefaultLayoutForRole(role))}
                className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Default</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {(Object.keys(PRESET_LAYOUTS) as Array<Exclude<DashboardPresetId, 'custom'>>).map(
                (presetKey) => {
                  const preset = PRESET_LAYOUTS[presetKey];
                  const isActive = layout.preset === presetKey;
                  return (
                    <button
                      key={presetKey}
                      type="button"
                      onClick={() => applyPreset(presetKey)}
                      className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'border-slate-900 bg-slate-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-900 text-xs">{preset.label}</span>
                        {isActive && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{preset.subtitle}</p>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Widget Gallery: Show/Hide + Reorder */}
          <div className="space-y-2.5">
            <div>
              <h3 className="text-xs font-bold text-slate-900">Widget Gallery &amp; Order</h3>
              <p className="text-[11px] text-slate-500">
                Toggle visibility or reorder sections top-to-bottom.
              </p>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {layout.order.map((widgetId, idx) => {
                const info = widgetMap.get(widgetId);
                if (!info) return null;
                const isVisible = !layout.hidden.includes(widgetId);

                return (
                  <div
                    key={widgetId}
                    className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                      isVisible ? 'bg-white' : 'bg-slate-50/80 opacity-75'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                        <span className="truncate">{info.title}</span>
                        <span className="text-[11px] font-normal text-slate-400">· {info.category}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                        {info.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveWidget(idx, -1)}
                        disabled={idx === 0}
                        title="Move Up"
                        className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveWidget(idx, 1)}
                        disabled={idx === layout.order.length - 1}
                        title="Move Down"
                        className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleVisibility(widgetId)}
                        title={isVisible ? 'Hide Widget' : 'Show Widget'}
                        className={`p-1.5 rounded border cursor-pointer transition-colors ${
                          isVisible
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'border-slate-200 bg-white text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
