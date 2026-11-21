import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  Receipt,
  Users,
  Package,
  CalendarClock,
  Bell,
  LogOut,
  Lock,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { SaleInvoicesView } from '../SaleInvoicesView';
import { SaleOrderView } from '../SaleOrderView';
import { PartiesView } from '../PartiesView';
import { ItemsView } from '../ItemsView';
import { StockSummaryView } from '../StockSummaryView';
import { ReportsHubView } from '../ReportsHubView';

type StaffNavTab =
  | 'dashboard'
  | 'tasks'
  | 'daily-work'
  | 'billing'
  | 'customers'
  | 'inventory'
  | 'reports'
  | 'attendance'
  | 'notifications';

export const StaffDashboard: React.FC = () => {
  const {
    currentUser,
    staffTasks,
    parties,
    transactions,
    attendanceRecords,
    portalNotifications,
    canAccessFeature,
    checkFeatureAccess,
    isFinancialDataVisible,
    toggleStaffTaskStatus,
    recordAttendance,
    markPortalNotificationRead,
    verifyDeliveryOtpAndCompleteOrder,
    setIsLogoutModalOpen,
  } = useVyapar();

  const [tab, setTab] = useState<StaffNavTab>('dashboard');
  const [inventorySubView, setInventorySubView] = useState<'items' | 'stock'>('items');
  const [billingSubView, setBillingSubView] = useState<'invoices' | 'online-orders'>('invoices');
  const [staffOtpMap, setStaffOtpMap] = useState<Record<string, string>>({});

  if (!currentUser) return null;

  const staffCode = currentUser.employeeId || currentUser.id;
  const customerCount = parties.filter((p) => p.type === 'Customer' || !p.type).length;
  const salesTotal = useMemo(
    () =>
      transactions
        .filter((t) => !t.isCancelled && t.type === 'Sale')
        .reduce((acc, t) => acc + t.totalAmount, 0),
    [transactions]
  );

  const myTasks = useMemo(
    () => staffTasks.filter((t) => t.staffId === staffCode || t.staffId === 'ALL'),
    [staffTasks, staffCode]
  );

  const pendingTaskCount = myTasks.filter((t) => t.status !== 'Completed').length;

  const myAttendance = useMemo(
    () => attendanceRecords.filter((a) => a.employeeId === staffCode || a.employeeName === currentUser.name),
    [attendanceRecords, staffCode, currentUser.name]
  );

  const myNotifications = useMemo(
    () =>
      portalNotifications.filter(
        (n) =>
          n.recipientType === 'STAFF' &&
          (n.recipientId === 'ALL' || n.recipientId === staffCode)
      ),
    [portalNotifications, staffCode]
  );
  const unreadNotifCount = myNotifications.filter((n) => !n.read).length;

  const openGatedTab = (target: StaffNavTab, featureKey: string, label: string) => {
    if (checkFeatureAccess(featureKey, label)) {
      setTab(target);
    }
  };

  const navItems: {
    id: StaffNavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    featureKey?: string;
    badge?: number;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Assigned Tasks', icon: ClipboardList, badge: pendingTaskCount || undefined },
    { id: 'daily-work', label: 'Daily Work', icon: CheckSquare },
    { id: 'billing', label: 'Billing Access', icon: Receipt, featureKey: 'billing' },
    { id: 'customers', label: 'Customer Management', icon: Users, featureKey: 'customers' },
    { id: 'inventory', label: 'Inventory Access', icon: Package, featureKey: 'products' },
    { id: 'attendance', label: 'Attendance', icon: CalendarClock },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifCount || undefined },
  ];

  const RestrictedNotice = ({ moduleName }: { moduleName: string }) => (
    <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center max-w-md mx-auto mt-10 shadow-sm">
      <div className="w-12 h-12 rounded-full bg-rose-50 text-[#8B1E2D] flex items-center justify-center mx-auto mb-3">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-slate-900">Permission Required: {moduleName}</h3>
      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
        Your assigned role (<strong>{currentUser.roleName}</strong>) does not currently have permission to access {moduleName}. Contact your Store Administrator to enable it.
      </p>
    </div>
  );

  return (
    <div className="h-screen w-screen flex bg-[#F8FAFC] text-slate-900 overflow-hidden select-none font-sans">
      {/* Left Maroon Sidebar matching Screen 5 & Business Manager 360 palette */}
      <aside className="w-60 md:w-64 bg-[#8B1E2D] text-white flex flex-col justify-between shrink-0 shadow-2xl z-20">
        <div className="px-4 py-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-pink-500 flex items-center justify-center font-bold text-white text-xs shadow-md shrink-0">
            360
          </div>
          <div className="leading-tight truncate">
            <div className="font-bold text-sm text-white truncate">Business Manager 360</div>
            <div className="text-[11px] text-rose-200/80">Staff Workspace</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            const locked = item.featureKey ? !canAccessFeature(item.featureKey) : false;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.featureKey) {
                    openGatedTab(item.id, item.featureKey, item.label);
                  } else {
                    setTab(item.id);
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-[#A02838] text-white font-semibold shadow-inner'
                    : locked
                    ? 'text-rose-100/50 hover:bg-white/5'
                    : 'text-rose-100/90 hover:text-white hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0 text-rose-200" />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {item.badge !== undefined && item.badge > 0 && !locked && (
                    <span className="px-1.5 py-0.5 rounded bg-white/15 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                  {locked && <Lock className="w-3.5 h-3.5 text-rose-300/80" />}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 bg-[#7B1825]">
          <button
            type="button"
            onClick={() => setIsLogoutModalOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-100 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header matching Screen 5 */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-[#8B1E2D] flex items-center justify-center font-bold text-sm border border-rose-200">
              {currentUser.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                Welcome, <span className="text-[#8B1E2D]">{currentUser.name}</span>
              </h1>
              <div className="text-xs text-slate-500">
                Staff ID: <span className="font-mono font-semibold text-slate-700">{staffCode}</span>
                <span className="mx-2 text-slate-300">|</span>
                <span>Role: {currentUser.roleName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTab('notifications')}
              aria-label="Notifications"
              className="relative p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#B91C1C] text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadNotifCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(true)}
              className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-[#B91C1C] hover:text-white text-[#B91C1C] text-xs font-bold transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STAFF OVERVIEW DASHBOARD matching Screen 5 bottom-right */}
          {tab === 'dashboard' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white text-[#8B1E2D] flex items-center justify-center border border-rose-200">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-600">Today's Tasks</div>
                      <div className="text-2xl font-extrabold text-slate-900">{myTasks.length}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('tasks')}
                    className="text-xs font-bold text-[#8B1E2D] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Tasks</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white text-emerald-700 flex items-center justify-center border border-emerald-200">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-600">Customers</div>
                      <div className="text-2xl font-extrabold text-slate-900">{customerCount}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openGatedTab('customers', 'customers', 'Customer Management')}
                    className="text-xs font-bold text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Customers</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white text-amber-700 flex items-center justify-center border border-amber-200">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-600">Sales Recorded</div>
                      <div className="text-2xl font-extrabold text-slate-900">
                        {isFinancialDataVisible() ? `₹${salesTotal.toLocaleString('en-IN')}` : '₹ ••••••'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openGatedTab('reports', 'reports', 'Sales Reports')}
                    className="text-xs font-bold text-amber-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Report</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Lower 2-Column Grid: Daily Work + Quick Access */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 mb-3">Your Daily Work</h2>
                    {myTasks.length === 0 ? (
                      <div className="py-6 text-xs text-slate-500 text-center">
                        No assigned tasks pending today.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {myTasks.slice(0, 4).map((t) => {
                          const done = t.status === 'Completed';
                          return (
                            <label
                              key={t.id}
                              className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={done}
                                  onChange={() =>
                                    toggleStaffTaskStatus(t.id, done ? 'Pending' : 'Completed')
                                  }
                                  className="accent-[#8B1E2D] w-4 h-4 rounded cursor-pointer"
                                />
                                <span
                                  className={`text-xs font-medium truncate ${
                                    done ? 'line-through text-slate-400' : 'text-slate-800'
                                  }`}
                                >
                                  {t.title}
                                </span>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                  done
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : t.priority === 'High'
                                    ? 'bg-rose-50 text-[#B91C1C]'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {done ? 'Done' : t.priority}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 text-right">
                    <button
                      type="button"
                      onClick={() => setTab('tasks')}
                      className="px-4 py-2 rounded-xl bg-[#8B1E2D] hover:bg-[#731825] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>View All Tasks</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Quick Access Permission-Gated Modules */}
                <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                  <h2 className="text-sm font-bold text-slate-900 mb-3">Quick Access</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: 'billing' as StaffNavTab, label: 'Billing', key: 'billing', icon: Receipt },
                      { id: 'customers' as StaffNavTab, label: 'Customers', key: 'customers', icon: Users },
                      { id: 'inventory' as StaffNavTab, label: 'Inventory', key: 'products', icon: Package },
                      { id: 'reports' as StaffNavTab, label: 'Reports', key: 'reports', icon: BarChart3 },
                    ].map((mod) => {
                      const Icon = mod.icon;
                      const locked = !canAccessFeature(mod.key);
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => openGatedTab(mod.id, mod.key, mod.label)}
                          className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer relative ${
                            locked
                              ? 'border-slate-200 bg-slate-50 text-slate-400'
                              : 'border-rose-200 bg-rose-50/50 hover:bg-rose-100/70 text-slate-800'
                          }`}
                        >
                          {locked && <Lock className="w-3.5 h-3.5 text-slate-400 absolute top-2 right-2" />}
                          <Icon className={`w-5 h-5 ${locked ? 'text-slate-400' : 'text-[#8B1E2D]'}`} />
                          <span className="text-xs font-semibold">{mod.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4 text-xs font-semibold text-[#8B1E2D]">
                <span>Keep up the good work, {currentUser.name}! Need to log your shift?</span>
                <button
                  type="button"
                  onClick={() => setTab('attendance')}
                  className="px-3.5 py-1.5 rounded-lg bg-[#8B1E2D] text-white font-bold cursor-pointer"
                >
                  Open Attendance
                </button>
              </div>
            </>
          )}

          {/* ASSIGNED TASKS & DAILY WORK */}
          {(tab === 'tasks' || tab === 'daily-work') && (
            <div className="space-y-5">
              {transactions.some(
                (t) =>
                  t.type === 'Sale Order' &&
                  t.source === 'ONLINE_STORE' &&
                  !t.isCancelled &&
                  t.orderWorkflowStatus === 'Out for Delivery'
              ) && (
                <div className="bg-white rounded-2xl border border-rose-200 p-5 shadow-xs space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    Online Store Deliveries (Verify Customer 4-Digit OTP)
                  </h3>
                  <div className="space-y-2.5">
                    {transactions
                      .filter(
                        (t) =>
                          t.type === 'Sale Order' &&
                          t.source === 'ONLINE_STORE' &&
                          !t.isCancelled &&
                          t.orderWorkflowStatus === 'Out for Delivery'
                      )
                      .map((ord) => (
                        <div
                          key={ord.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {ord.onlineOrderId || `#${ord.invoiceNo}`} · {ord.partyName} ({ord.deliveryBagId || 'BAG'})
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {ord.partyAddress} · ₹{ord.totalAmount.toLocaleString('en-IN')} ({ord.paymentType})
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              maxLength={4}
                              value={staffOtpMap[ord.id] || ''}
                              onChange={(e) =>
                                setStaffOtpMap((p) => ({ ...p, [ord.id]: e.target.value.replace(/\D/g, '') }))
                              }
                              placeholder="4-digit OTP"
                              className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-center text-xs font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const res = verifyDeliveryOtpAndCompleteOrder(ord.id, staffOtpMap[ord.id] || '', true);
                                if (res.success) setStaffOtpMap((p) => ({ ...p, [ord.id]: '' }));
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-[#8B1E2D] hover:bg-[#731825] text-white text-xs font-bold cursor-pointer"
                            >
                              Verify &amp; Deliver
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {tab === 'tasks' ? 'Assigned Tasks' : 'Daily Work Checklist'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tasks assigned to {currentUser.name} ({staffCode})
                  </p>
                </div>
                {myTasks.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-500">
                    No tasks assigned right now.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myTasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{t.title}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                t.priority === 'High'
                                  ? 'bg-rose-50 text-[#B91C1C]'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {t.priority}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{t.description}</p>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Due: {t.dueDate} • Assigned by {t.assignedBy}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(['Pending', 'In Progress', 'Completed'] as const).map((statusOption) => (
                            <button
                              key={statusOption}
                              type="button"
                              onClick={() => toggleStaffTaskStatus(t.id, statusOption)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                                t.status === statusOption
                                  ? 'bg-[#8B1E2D] border-[#8B1E2D] text-white'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {statusOption}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PERMISSION-GATED MODULES */}
          {tab === 'billing' &&
            (canAccessFeature('billing') ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBillingSubView('invoices')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                      billingSubView === 'invoices'
                        ? 'bg-[#8B1E2D] text-white'
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    Sale Invoices
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingSubView('online-orders')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                      billingSubView === 'online-orders'
                        ? 'bg-[#8B1E2D] text-white'
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    Online Store Orders
                  </button>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs min-h-[560px] flex flex-col">
                  {billingSubView === 'invoices' ? <SaleInvoicesView /> : <SaleOrderView />}
                </div>
              </div>
            ) : (
              <RestrictedNotice moduleName="Billing & Sale Invoices" />
            ))}

          {tab === 'customers' &&
            (canAccessFeature('customers') ? (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs min-h-[600px] flex flex-col">
                <PartiesView typeFilter="Customer" />
              </div>
            ) : (
              <RestrictedNotice moduleName="Customer Management" />
            ))}

          {tab === 'inventory' &&
            (canAccessFeature('products') ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInventorySubView('items')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                      inventorySubView === 'items'
                        ? 'bg-[#8B1E2D] text-white'
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    Products Catalog
                  </button>
                  <button
                    type="button"
                    onClick={() => setInventorySubView('stock')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                      inventorySubView === 'stock'
                        ? 'bg-[#8B1E2D] text-white'
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    Stock Summary
                  </button>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs min-h-[560px] flex flex-col">
                  {inventorySubView === 'items' ? <ItemsView /> : <StockSummaryView />}
                </div>
              </div>
            ) : (
              <RestrictedNotice moduleName="Inventory & Products" />
            ))}

          {tab === 'reports' &&
            (canAccessFeature('reports') ? (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs min-h-[600px] flex flex-col">
                <ReportsHubView />
              </div>
            ) : (
              <RestrictedNotice moduleName="Reports & Analytics" />
            ))}

          {/* ATTENDANCE */}
          {tab === 'attendance' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Staff Attendance</h2>
                  <p className="text-xs text-slate-500">Log your daily counter/shift check-in & check-out</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => recordAttendance(staffCode, 'IN', 'Shift started via Staff Portal')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Punch IN</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => recordAttendance(staffCode, 'OUT', 'Shift ended via Staff Portal')}
                    className="px-4 py-2 rounded-xl bg-[#8B1E2D] hover:bg-[#731825] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Punch OUT</span>
                  </button>
                </div>
              </div>

              {myAttendance.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No attendance entries recorded yet. Click Punch IN to log today's attendance.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {myAttendance.map((rec) => (
                    <div key={rec.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{rec.date}</div>
                        <div className="text-slate-500">
                          In: {rec.punchInTime} {rec.punchOutTime ? `• Out: ${rec.punchOutTime}` : ''}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold">
                        {rec.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* NOTIFICATIONS */}
          {tab === 'notifications' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h2 className="text-base font-bold text-slate-900">Staff Notifications</h2>
              {myNotifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">No notifications yet.</div>
              ) : (
                <div className="space-y-2.5">
                  {myNotifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
                        n.read ? 'border-slate-200 bg-white' : 'border-rose-200 bg-rose-50/50'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900">{n.title}</div>
                        <p className="text-xs text-slate-600 mt-1">{n.message}</p>
                        <div className="text-[11px] text-slate-400 mt-1">{n.createdAt}</div>
                      </div>
                      {!n.read && (
                        <button
                          type="button"
                          onClick={() => markPortalNotificationRead(n.id)}
                          className="text-[11px] font-bold text-[#8B1E2D] hover:underline shrink-0 cursor-pointer"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
