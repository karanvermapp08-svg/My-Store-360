import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Store,
  ShoppingCart,
  Scale,
  TrendingUp,
  Truck,
  Boxes,
  Lock,
  ChevronDown,
  RefreshCw,
  Building2,
  Key,
  LogOut,
  Sparkles,
  ExternalLink,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { apiClient } from '../../utils/apiClient';

// 9 Dedicated Role Workspaces
import { OwnerWorkspace } from './OwnerWorkspace';
import { AdminWorkspace } from './AdminWorkspace';
import { ManagerWorkspace } from './ManagerWorkspace';
import { CashierPosWorkspace } from './CashierPosWorkspace';
import { AccountantWorkspace } from './AccountantWorkspace';
import { SalesWorkspace } from './SalesWorkspace';
import { PurchaseWorkspace } from './PurchaseWorkspace';
import { InventoryWorkspace } from './InventoryWorkspace';
import { DeliveryWorkspace } from './DeliveryWorkspace';

export type WorkspaceRoute =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'pos'
  | 'accounting'
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'delivery';

interface WorkspaceDefinition {
  id: WorkspaceRoute;
  path: string;
  name: string;
  roleRequired: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export const WORKSPACES: WorkspaceDefinition[] = [
  {
    id: 'owner',
    path: '/owner',
    name: 'Owner Executive Console',
    roleRequired: 'Owner',
    color: '#e11d48',
    icon: ShieldCheck,
    description: 'Executive GMV, P&L, balance sheets, branch health, and company control',
  },
  {
    id: 'admin',
    path: '/admin',
    name: 'Admin Governance Portal',
    roleRequired: 'Admin',
    color: '#7c3aed',
    icon: Lock,
    description: 'Employee provisioning, 9-role authorization matrix, and security policies',
  },
  {
    id: 'manager',
    path: '/manager',
    name: 'Store Manager Operations',
    roleRequired: 'Manager',
    color: '#d97706',
    icon: Store,
    description: 'Floor supervision, discount & refund approval queue, and daily cash tally',
  },
  {
    id: 'pos',
    path: '/pos',
    name: 'Cashier POS Terminal',
    roleRequired: 'Cashier',
    color: '#059669',
    icon: ShoppingCart,
    description: 'Barcode checkout, quick cash/UPI tender, receipts, and 5% discount limit',
  },
  {
    id: 'accounting',
    path: '/accounting',
    name: 'Accountant Tax & Ledgers',
    roleRequired: 'Accountant',
    color: '#2563eb',
    icon: Scale,
    description: 'Double-entry ledgers, GSTR-1/3B tax computations, and bank reconciliation',
  },
  {
    id: 'sales',
    path: '/sales',
    name: 'Sales Executive Workstation',
    roleRequired: 'Sales',
    color: '#10b981',
    icon: TrendingUp,
    description: 'Client quotations, sales orders, CRM follow-ups, and commission tracking',
  },
  {
    id: 'purchases',
    path: '/purchases',
    name: 'Purchase & Procurement Desk',
    roleRequired: 'Purchase',
    color: '#ea580c',
    icon: Truck,
    description: 'Suppliers, purchase orders, goods receipt notes (GRN), and vendor bills',
  },
  {
    id: 'inventory',
    path: '/inventory',
    name: 'Inventory & Warehousing',
    roleRequired: 'Inventory',
    color: '#4f46e5',
    icon: Boxes,
    description: 'Stock valuation, low-stock reorder warnings, and warehouse transfers',
  },
  {
    id: 'delivery',
    path: '/delivery',
    name: 'Delivery Agent & COD Portal',
    roleRequired: 'Delivery',
    color: '#0d9488',
    icon: Truck,
    description: 'Route shipments, proof of delivery, and Cash-on-Delivery collections',
  },
];

export const WorkspaceRouter: React.FC<{ onSwitchToClassic?: (tab?: string) => void }> = ({
  onSwitchToClassic,
}) => {
  const {
    currentUser,
    switchUser,
    switchRole,
    users,
    setIsAuthModalOpen,
    setAuthModalTab,
    showToast,
  } = useVyapar();

  // Parse initial route from window.location.pathname or default to current user role
  const getInitialWorkspace = (): WorkspaceRoute => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase().replace('/', '');
      const match = WORKSPACES.find((w) => w.id === path || w.path.replace('/', '') === path);
      if (match) return match.id;
    }

    // Default based on current logged in user role
    const role = (currentUser?.roleName || 'Owner').toLowerCase();
    if (role === 'owner') return 'owner';
    if (role === 'admin') return 'admin';
    if (role === 'manager') return 'manager';
    if (role === 'cashier') return 'pos';
    if (role === 'accountant') return 'accounting';
    if (role === 'sales') return 'sales';
    if (role === 'purchase') return 'purchases';
    if (role === 'inventory') return 'inventory';
    if (role === 'delivery') return 'delivery';
    return 'owner';
  };

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<WorkspaceRoute>(getInitialWorkspace());
  const [isAppLauncherOpen, setIsAppLauncherOpen] = useState(false);
  const [serverOnline, setServerOnline] = useState(true);

  // Sync browser URL cleanly with HTML5 history
  const navigateToWorkspace = (workspaceId: WorkspaceRoute) => {
    setActiveWorkspaceId(workspaceId);
    setIsAppLauncherOpen(false);
    if (typeof window !== 'undefined') {
      const target = WORKSPACES.find((w) => w.id === workspaceId);
      if (target) {
        window.history.pushState({}, '', target.path);
      }
    }
  };

  // Check backend server health
  useEffect(() => {
    apiClient
      .getHealth()
      .then(() => setServerOnline(true))
      .catch(() => setServerOnline(false));
  }, [activeWorkspaceId]);

  const currentWorkspace = WORKSPACES.find((w) => w.id === activeWorkspaceId) || WORKSPACES[0];

  // Route Guard check: Does current user have privilege to view this workspace?
  // Owner and Admin can access any workspace. Specific roles can access their own workspace.
  const isAuthorized =
    currentUser?.roleName === 'Owner' ||
    currentUser?.roleName === 'Admin' ||
    (currentUser?.roleName === 'Manager' && activeWorkspaceId !== 'owner') ||
    currentWorkspace.roleRequired.toLowerCase() === (currentUser?.roleName || '').toLowerCase() ||
    (currentUser?.roleName === 'Cashier' && activeWorkspaceId === 'pos') ||
    (currentUser?.roleName === 'Accountant' && activeWorkspaceId === 'accounting') ||
    (currentUser?.roleName === 'Sales' && activeWorkspaceId === 'sales') ||
    (currentUser?.roleName === 'Purchase' && activeWorkspaceId === 'purchases') ||
    (currentUser?.roleName === 'Inventory' && activeWorkspaceId === 'inventory') ||
    (currentUser?.roleName === 'Delivery' && activeWorkspaceId === 'delivery');

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f0f4f9] text-slate-800">
      {/* Universal Workspace Navigation & App Switcher Header */}
      <header className="bg-slate-900 text-white px-5 py-2.5 flex items-center justify-between border-b border-slate-800 shrink-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          {/* App Launcher Button */}
          <div className="relative">
            <button
              onClick={() => setIsAppLauncherOpen(!isAppLauncherOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-colors shadow-2xs"
            >
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: currentWorkspace.color }}
              />
              <span className="truncate max-w-[200px] sm:max-w-none">{currentWorkspace.name}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isAppLauncherOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Role Application Dropdown Drawer */}
            {isAppLauncherOpen && (
              <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2 border-b border-slate-100 mb-2 flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">Switch Role Workspace</span>
                  <span className="text-[10px] text-slate-400 font-medium">9 Dedicated Role Apps</span>
                </div>

                <div className="grid grid-cols-1 gap-1 max-h-96 overflow-y-auto">
                  {WORKSPACES.map((w) => {
                    const Icon = w.icon;
                    const isSelected = w.id === activeWorkspaceId;
                    return (
                      <button
                        key={w.id}
                        onClick={() => navigateToWorkspace(w.id)}
                        className={`w-full p-2.5 rounded-xl flex items-start gap-3 text-left transition-colors ${
                          isSelected ? 'bg-purple-50 text-purple-950 font-bold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className="p-1.5 rounded-lg text-white shrink-0 mt-0.5"
                          style={{ backgroundColor: w.color }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs truncate">{w.name}</span>
                            <span className="text-[9px] font-mono text-slate-400">{w.path}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-normal line-clamp-1">{w.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <span className="text-slate-500 hidden sm:inline">|</span>

          {/* Branch indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-300">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Bengaluru Flagship</span>
          </div>
        </div>

        {/* Right Info: Server Sync, Current User, Quick Switch */}
        <div className="flex items-center gap-3">
          {/* Realtime Server Sync status */}
          <div
            title="Shared Authoritative Backend & Database"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Shared DB Synced</span>
          </div>

          {/* Switch to Classic Desktop Billing View */}
          {onSwitchToClassic && (
            <button
              onClick={() => onSwitchToClassic()}
              className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Classic Billing Suite</span>
            </button>
          )}

          {/* Current User & Role Switcher */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAuthModalTab('switch');
                setIsAuthModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
            >
              <Key className="w-3 h-3 text-purple-400" />
              <span>
                {currentUser?.name || 'Krishna Murthy'} (
                <strong className="text-rose-400">{currentUser?.roleName || 'Owner'}</strong>)
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Route Guard Barrier */}
        {!isAuthorized ? (
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-100">
            <div className="bg-white rounded-2xl p-8 max-w-lg w-full text-center space-y-4 border border-rose-200 shadow-xl">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
                <ShieldAlert className="w-8 h-8 stroke-[2]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Access Restricted by Security Policy</h2>
                <p className="text-xs text-slate-500 mt-1">
                  The <strong className="text-slate-800">{currentWorkspace.name}</strong> workspace ({currentWorkspace.path}) requires{' '}
                  <strong className="text-rose-700">{currentWorkspace.roleRequired}</strong> role clearance.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Your current authenticated session is as{' '}
                  <strong className="text-slate-700">{currentUser?.name}</strong> ({currentUser?.roleName}).
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={() => {
                    // Navigate to user's permitted workspace
                    const userRole = (currentUser?.roleName || 'Cashier').toLowerCase();
                    const targetW =
                      WORKSPACES.find((w) => w.roleRequired.toLowerCase() === userRole) || WORKSPACES[3];
                    navigateToWorkspace(targetW.id);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
                >
                  Go to My Authorized Workspace
                </button>
                <button
                  onClick={() => {
                    setAuthModalTab('switch');
                    setIsAuthModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs"
                >
                  Log In as Administrator
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {activeWorkspaceId === 'owner' && (
              <OwnerWorkspace onNavigateClassic={(tab) => onSwitchToClassic?.(tab)} />
            )}
            {activeWorkspaceId === 'admin' && <AdminWorkspace />}
            {activeWorkspaceId === 'manager' && (
              <ManagerWorkspace onNavigateClassic={(tab) => onSwitchToClassic?.(tab)} />
            )}
            {activeWorkspaceId === 'pos' && <CashierPosWorkspace />}
            {activeWorkspaceId === 'accounting' && <AccountantWorkspace />}
            {activeWorkspaceId === 'sales' && <SalesWorkspace />}
            {activeWorkspaceId === 'purchases' && <PurchaseWorkspace />}
            {activeWorkspaceId === 'inventory' && <InventoryWorkspace />}
            {activeWorkspaceId === 'delivery' && <DeliveryWorkspace />}
          </>
        )}
      </main>
    </div>
  );
};
