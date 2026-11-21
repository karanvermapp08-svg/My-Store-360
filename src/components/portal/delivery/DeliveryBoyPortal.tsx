import React, { useMemo, useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Package,
  MapPin,
  Briefcase,
  IndianRupee,
  Calendar,
  TrendingUp,
  User,
  Bell,
  Headphones,
  Settings,
  LogOut,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Star,
  Navigation,
  Plus,
  Minus,
  Eye,
  Phone,
  ShieldCheck,
  Award,
  X,
  ArrowRight,
  Menu,
} from 'lucide-react';
import { useVyapar } from '../../../context/VyaparContext';
import { Transaction } from '../../../types';

type DeliveryPageId =
  | 'dashboard'
  | 'orders'
  | 'map'
  | 'bag'
  | 'earnings'
  | 'attendance'
  | 'performance'
  | 'profile'
  | 'notifications'
  | 'support'
  | 'settings';

const DELIVERY_ROUTES: { id: DeliveryPageId; path: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', path: '/delivery/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', path: '/delivery/orders', label: 'My Orders', icon: Package },
  { id: 'map', path: '/delivery/map', label: 'Delivery Map', icon: MapPin },
  { id: 'bag', path: '/delivery/bag', label: 'Delivery Bag', icon: Briefcase },
  { id: 'earnings', path: '/delivery/earnings', label: 'Earnings', icon: IndianRupee },
  { id: 'attendance', path: '/delivery/attendance', label: 'Attendance', icon: Calendar },
  { id: 'performance', path: '/delivery/performance', label: 'My Performance', icon: TrendingUp },
  { id: 'profile', path: '/delivery/profile', label: 'Profile', icon: User },
  { id: 'notifications', path: '/delivery/notifications', label: 'Notifications', icon: Bell },
  { id: 'support', path: '/delivery/support', label: 'Help & Support', icon: Headphones },
  { id: 'settings', path: '/delivery/settings', label: 'Settings', icon: Settings },
];

export const DeliveryBoyPortal: React.FC = () => {
  const {
    currentUser,
    company,
    transactions,
    attendanceRecords,
    portalNotifications,
    verifyDeliveryOtpAndCompleteOrder,
    updateDeliveryBoyAvailability,
    markDeliveryOutcome,
    recordAttendance,
    markPortalNotificationRead,
    setIsLogoutModalOpen,
    showToast,
  } = useVyapar();

  const resolveInitialPage = (): DeliveryPageId => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      const matched = DELIVERY_ROUTES.find((r) => r.path === p);
      if (matched) return matched.id;
    }
    return 'dashboard';
  };

  const [activePage, setActivePage] = useState<DeliveryPageId>(resolveInitialPage);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [earningsPeriod, setEarningsPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [mapZoom, setMapZoom] = useState<number>(1);
  const [selectedOrder, setSelectedOrder] = useState<Transaction | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [codCollected, setCodCollected] = useState(true);
  const [outcomeReason, setOutcomeReason] = useState('');
  const [supportMsg, setSupportMsg] = useState('');

  useEffect(() => {
    const onPopState = () => setActivePage(resolveInitialPage());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (!currentUser) return null;

  const navigateTo = (pageId: DeliveryPageId) => {
    setActivePage(pageId);
    setMobileMenuOpen(false);
    const route = DELIVERY_ROUTES.find((r) => r.id === pageId);
    if (route && typeof window !== 'undefined') {
      window.history.pushState({}, '', route.path);
    }
  };

  const agentCode = currentUser.employeeId || currentUser.id;
  const availability = currentUser.deliveryAvailability || 'Available';
  const agentRating = currentUser.deliveryRating || 4.8;

  // All delivery orders relevant to this delivery partner (assigned to them or ready online orders/challans)
  const deliveryOrders = useMemo(() => {
    return transactions.filter((t) => {
      if (t.type !== 'Sale Order' && t.type !== 'Delivery Challan') return false;
      const isOnline = t.source === 'ONLINE_STORE' || t.type === 'Delivery Challan';
      if (!isOnline) return false;
      if (t.deliveryBoyId && t.deliveryBoyId !== agentCode && t.deliveryBoyId !== currentUser.id && t.deliveryBoyName !== currentUser.name) {
        return true; // Show store delivery queue while highlighting assigned
      }
      return true;
    });
  }, [transactions, agentCode, currentUser.id, currentUser.name]);

  const metrics = useMemo(() => {
    const active = deliveryOrders.filter(
      (o) => !o.isCancelled && o.orderWorkflowStatus !== 'Delivered' && o.orderWorkflowStatus !== 'Returned'
    );
    const pendingPickup = deliveryOrders.filter(
      (o) => !o.isCancelled && (o.orderWorkflowStatus === 'Confirmed' || o.orderWorkflowStatus === 'Pending Approval' || o.orderWorkflowStatus === 'Packing')
    );
    const pickedUp = deliveryOrders.filter(
      (o) => !o.isCancelled && (o.orderWorkflowStatus === 'Packing' || o.orderWorkflowStatus === 'Out for Delivery')
    );
    const outForDelivery = deliveryOrders.filter((o) => !o.isCancelled && o.orderWorkflowStatus === 'Out for Delivery');
    const delivered = deliveryOrders.filter((o) => o.orderWorkflowStatus === 'Delivered');
    const failed = deliveryOrders.filter((o) => o.isCancelled || o.orderWorkflowStatus === 'Cancelled');
    const returned = deliveryOrders.filter((o) => o.orderWorkflowStatus === 'Returned');

    const basePerDelivery = 75;
    const todayEarnings = Math.max(delivered.length * basePerDelivery, 0);
    const totalAttempted = delivered.length + failed.length;
    const successRate = totalAttempted > 0 ? Math.round((delivered.length / totalAttempted) * 100) : 95;

    return {
      totalToday: deliveryOrders.length,
      pendingCount: pendingPickup.length || active.length,
      pickedUpCount: pickedUp.length,
      outForDeliveryCount: outForDelivery.length,
      deliveredCount: delivered.length,
      failedCount: failed.length,
      returnedCount: returned.length,
      todayEarnings,
      successRate,
    };
  }, [deliveryOrders]);

  const myNotifications = useMemo(
    () =>
      portalNotifications.filter(
        (n) => n.recipientType === 'STAFF' && (n.recipientId === 'ALL' || n.recipientId === agentCode)
      ),
    [portalNotifications, agentCode]
  );
  const unreadNotifCount = myNotifications.filter((n) => !n.read).length;

  const myAttendance = useMemo(
    () => attendanceRecords.filter((a) => a.employeeId === agentCode || a.employeeName === currentUser.name),
    [attendanceRecords, agentCode, currentUser.name]
  );

  const activeFocusOrder = useMemo(
    () =>
      deliveryOrders.find((o) => !o.isCancelled && o.orderWorkflowStatus === 'Out for Delivery') ||
      deliveryOrders[0] ||
      null,
    [deliveryOrders]
  );

  // Weekly earnings bar values derived from deliveries
  const weeklyBars = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const mult = earningsPeriod === 'today' ? 1 : earningsPeriod === 'week' ? 2.4 : 4.2;
    const base = Math.max(metrics.todayEarnings, 150);
    const ratios = [0.42, 0.58, 0.56, 0.78, 0.62, 0.79, 0.94];
    return days.map((d, idx) => ({
      day: d,
      value: Math.round(base * ratios[idx] * mult),
    }));
  }, [metrics.todayEarnings, earningsPeriod]);

  const maxBar = Math.max(...weeklyBars.map((b) => b.value), 100);
  const displayEarnings =
    earningsPeriod === 'today'
      ? metrics.todayEarnings
      : earningsPeriod === 'week'
      ? weeklyBars.reduce((s, b) => s + b.value, 0)
      : weeklyBars.reduce((s, b) => s + b.value, 0) * 3;

  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const getStatusChip = (ord: Transaction) => {
    if (ord.orderWorkflowStatus === 'Delivered') {
      return { label: 'Delivered', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }
    if (ord.orderWorkflowStatus === 'Out for Delivery') {
      return { label: 'Out for Delivery', cls: 'bg-sky-100 text-sky-800 border-sky-200' };
    }
    if (ord.orderWorkflowStatus === 'Cancelled' || ord.isCancelled) {
      return { label: 'Failed / Cancelled', cls: 'bg-rose-100 text-rose-800 border-rose-200' };
    }
    if (ord.orderWorkflowStatus === 'Returned') {
      return { label: 'Returned', cls: 'bg-purple-100 text-purple-800 border-purple-200' };
    }
    return { label: 'Pickup Pending', cls: 'bg-amber-100 text-amber-800 border-amber-200' };
  };

  const activeRouteMeta = DELIVERY_ROUTES.find((r) => r.id === activePage) || DELIVERY_ROUTES[0];
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (metrics.successRate / 100) * circumference;

  return (
    <div className="h-screen w-screen flex bg-[#F3F4F8] text-slate-900 overflow-hidden select-none font-sans">
      {/* Left Crimson Sidebar */}
      <aside
        className={`${
          mobileMenuOpen ? 'fixed inset-y-0 left-0 z-40 flex' : 'hidden lg:flex'
        } w-60 bg-gradient-to-b from-[#961123] via-[#840C1C] to-[#650713] text-white flex-col justify-between shrink-0 shadow-2xl relative overflow-hidden`}
      >
        <svg
          viewBox="0 0 240 200"
          className="pointer-events-none absolute -bottom-6 -left-8 w-56 h-56 opacity-20 text-white"
          aria-hidden="true"
        >
          <path d="M0 120 C70 90, 140 160, 240 110 L240 200 L0 200 Z" fill="currentColor" />
        </svg>

        {/* Brand + Profile Card */}
        <div className="relative z-10 flex flex-col">
          <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white text-[#8B0D1E] font-extrabold text-sm flex items-center justify-center shadow-md">
                MS
              </div>
              <div className="leading-tight">
                <div className="font-extrabold text-sm text-white tracking-tight">My Store</div>
                <div className="text-[10px] text-rose-200">Express Delivery</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 rounded text-rose-100 hover:bg-white/10"
              aria-label="Close Sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 py-4 flex flex-col items-center text-center border-b border-white/10">
            <div className="relative mb-2">
              <div className="w-16 h-16 rounded-full bg-white text-[#8B0D1E] border-2 border-white/80 shadow-lg flex items-center justify-center text-xl font-extrabold">
                {currentUser.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <span
                className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                  availability === 'Available'
                    ? 'bg-emerald-500'
                    : availability === 'On Break'
                    ? 'bg-amber-400'
                    : 'bg-slate-400'
                }`}
              />
            </div>
            <div className="font-bold text-sm text-white leading-tight">{currentUser.name}</div>
            <div className="text-[11px] text-rose-200 mt-0.5">Delivery Boy · {agentCode}</div>
            <button
              type="button"
              onClick={() =>
                updateDeliveryBoyAvailability(availability === 'Available' ? 'On Break' : 'Available')
              }
              className="mt-2 px-3 py-0.5 rounded-full bg-black/25 hover:bg-black/35 text-[10px] font-bold text-white flex items-center gap-1.5 cursor-pointer"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  availability === 'Available' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span>{availability === 'Available' ? 'Online' : availability}</span>
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="relative z-10 flex-1 overflow-y-auto py-2 px-2.5 space-y-0.5 no-scrollbar">
          {DELIVERY_ROUTES.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            const badge =
              item.id === 'orders'
                ? metrics.pendingCount
                : item.id === 'notifications'
                ? unreadNotifCount
                : 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#D62839] text-white font-bold shadow-md ring-1 ring-white/15'
                    : 'text-rose-100/90 hover:text-white hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {badge > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-white text-[#8B0D1E] text-[10px] font-extrabold tabular-nums">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Logout */}
        <div className="relative z-10 p-2.5 border-t border-white/10 bg-[#5E0712]/70">
          <button
            type="button"
            onClick={() => setIsLogoutModalOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-100 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Crimson Header Bar */}
        <header className="bg-gradient-to-r from-[#8E0E20] to-[#B0162B] text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer"
              aria-label="Open Navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <Navigation className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight leading-none">
                {activePage === 'dashboard' ? 'Delivery Boy Dashboard' : activeRouteMeta.label}
              </h1>
              <p className="text-[10px] text-rose-100/80 mt-0.5 hidden sm:block">
                {company.name} · Active Route Partner ({agentCode})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 border border-white/20 text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5" />
              <span>Today : {todayFormatted}</span>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('notifications')}
              aria-label="Notifications"
              className="relative p-2 rounded-lg bg-white/15 hover:bg-white/25 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-900 text-[10px] font-extrabold flex items-center justify-center tabular-nums">
                  {unreadNotifCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activePage === 'dashboard' && (
            <>
              {/* Top 2 Rows of 5 KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 text-[#B91C1C] flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Today&apos;s Deliveries</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-extrabold text-slate-900 tabular-nums">{metrics.totalToday}</span>
                      <span className="text-[10px] font-bold text-emerald-600">Live</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Pending Deliveries</div>
                    <div className="text-xl font-extrabold text-slate-900 tabular-nums">{metrics.pendingCount}</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Picked Up</div>
                    <div className="text-xl font-extrabold text-slate-900 tabular-nums">{metrics.pickedUpCount}</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Navigation className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Out for Delivery</div>
                    <div className="text-xl font-extrabold text-slate-900 tabular-nums">{metrics.outForDeliveryCount}</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Delivered</div>
                    <div className="text-xl font-extrabold text-slate-900 tabular-nums">{metrics.deliveredCount}</div>
                  </div>
                </div>

                {/* Row 2 KPI Cards */}
                <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Failed Deliveries</div>
                    <div className="text-xl font-extrabold text-slate-900 tabular-nums">{metrics.failedCount}</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center shrink-0">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Returned Orders</div>
                    <div className="text-xl font-extrabold text-slate-900 tabular-nums">{metrics.returnedCount}</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <IndianRupee className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Today&apos;s Earnings</div>
                    <div className="text-xl font-extrabold text-slate-900 tabular-nums">
                      ₹{metrics.todayEarnings.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <Star className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Customer Rating</div>
                    <div className="text-xl font-extrabold text-slate-900 tabular-nums flex items-center gap-1">
                      <span>{agentRating}</span>
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Status</div>
                    <select
                      aria-label="Delivery Availability Status"
                      value={availability}
                      onChange={(e) =>
                        updateDeliveryBoyAvailability(e.target.value as 'Available' | 'On Break' | 'Offline')
                      }
                      className={`text-sm font-extrabold bg-transparent focus:outline-none cursor-pointer ${
                        availability === 'Available'
                          ? 'text-emerald-600'
                          : availability === 'On Break'
                          ? 'text-amber-600'
                          : 'text-slate-500'
                      }`}
                    >
                      <option value="Available">Available</option>
                      <option value="On Break">On Break</option>
                      <option value="Offline">Offline</option>
                    </select>
                  </div>
                  <span
                    className={`w-3 h-3 rounded-full shrink-0 ${
                      availability === 'Available'
                        ? 'bg-emerald-500'
                        : availability === 'On Break'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                    }`}
                  />
                </div>
              </div>

              {/* Middle Split: Delivery Schedule + Delivery Map */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Schedule Table */}
                <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                  <div className="bg-[#961123] text-white px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Calendar className="w-4 h-4" />
                      <span>Today&apos;s Delivery Schedule</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateTo('orders')}
                      className="text-[11px] font-semibold text-rose-100 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <span>View All</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold text-[11px]">
                          <th className="py-2.5 px-3">Order ID</th>
                          <th className="py-2.5 px-3">Customer</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {deliveryOrders.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              No deliveries assigned yet today.
                            </td>
                          </tr>
                        ) : (
                          deliveryOrders.slice(0, 5).map((ord) => {
                            const chip = getStatusChip(ord);
                            return (
                              <tr key={ord.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 font-bold font-mono text-slate-900">
                                  {ord.onlineOrderId || ord.invoiceNo}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-800">{ord.partyName}</td>
                                <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                                  ₹{ord.totalAmount.toLocaleString('en-IN')}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${chip.cls}`}
                                  >
                                    {chip.label}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedOrder(ord);
                                      setOtpInput('');
                                    }}
                                    className="px-3 py-1 rounded-md bg-[#961123] hover:bg-[#7D0C1B] text-white text-[11px] font-bold cursor-pointer"
                                  >
                                    View
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Interactive Route Map */}
                <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                  <div className="bg-[#961123] text-white px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <MapPin className="w-4 h-4" />
                      <span>Delivery Map</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateTo('map')}
                      className="text-[11px] font-semibold text-rose-100 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Full Map</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="relative flex-1 min-h-[220px] bg-[#eaf2e6] overflow-hidden p-3 flex items-center justify-between gap-3">
                    {/* Interactive SVG Road Network & Route */}
                    <svg
                      viewBox="0 0 420 220"
                      style={{ transform: `scale(${mapZoom})` }}
                      className="w-full h-52 transition-transform duration-200"
                    >
                      <rect width="420" height="220" fill="#e6f0e1" rx="10" />
                      <path d="M0 70 Q140 50 420 95" stroke="#ffffff" strokeWidth="10" fill="none" />
                      <path d="M80 0 L150 220" stroke="#ffffff" strokeWidth="8" fill="none" />
                      <path d="M240 0 L210 220" stroke="#ffffff" strokeWidth="8" fill="none" />
                      <path d="M0 155 Q200 130 420 175" stroke="#fde68a" strokeWidth="7" fill="none" />
                      {/* Active Route Polyline */}
                      <path
                        d="M 62 178 L 128 118 L 196 135 L 278 68"
                        stroke="#2563eb"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                      {/* Store Pin */}
                      <circle cx="62" cy="178" r="13" fill="#b91c1c" stroke="#ffffff" strokeWidth="3" />
                      <text x="62" y="203" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#1e293b">
                        Store
                      </text>
                      {/* You (Driver) Pin */}
                      <circle cx="196" cy="135" r="11" fill="#2563eb" stroke="#ffffff" strokeWidth="3" />
                      <text x="196" y="157" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#1e293b">
                        You
                      </text>
                      {/* Customer Pin */}
                      <circle cx="278" cy="68" r="13" fill="#059669" stroke="#ffffff" strokeWidth="3" />
                      <text x="278" y="48" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#1e293b">
                        Customer
                      </text>
                    </svg>

                    {/* Zoom Controls */}
                    <div className="absolute bottom-3 left-3 flex flex-col bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setMapZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(1)))}
                        className="p-1.5 hover:bg-slate-100 text-slate-700 cursor-pointer"
                        aria-label="Zoom In"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapZoom((z) => Math.max(0.8, +(z - 0.1).toFixed(1)))}
                        className="p-1.5 hover:bg-slate-100 border-t border-slate-200 text-slate-700 cursor-pointer"
                        aria-label="Zoom Out"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Route Info Overlay Card */}
                    <div className="hidden sm:flex flex-col gap-2 bg-white/95 backdrop-blur-xs rounded-xl border border-slate-200 p-3 shadow-md w-44 shrink-0 text-[11px]">
                      <div>
                        <div className="font-bold text-slate-900">Store</div>
                        <div className="text-slate-500 truncate">{company.name}</div>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">Customer</div>
                        <div className="text-slate-600 truncate">
                          {activeFocusOrder?.partyName || 'Awaiting assignment'}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-slate-500">Distance</span>
                        <span className="font-bold text-slate-900">3.8 km</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">ETA</span>
                        <span className="font-bold text-emerald-600">12 min</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom 3-Column Row: Earnings Overview, Your Performance, Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Earnings Overview */}
                <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                  <div className="bg-[#961123] text-white px-4 py-2.5 flex items-center gap-2 font-bold text-xs">
                    <IndianRupee className="w-4 h-4" />
                    <span>Earnings Overview</span>
                  </div>
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-full">
                      {(['today', 'week', 'month'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setEarningsPeriod(p)}
                          className={`flex-1 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                            earningsPeriod === p ? 'bg-[#961123] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
                        </button>
                      ))}
                    </div>

                    <div className="text-center">
                      <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
                        ₹{displayEarnings.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-600">
                        + {metrics.deliveredCount} completed deliveries
                      </div>
                    </div>

                    <div className="flex items-end justify-between gap-2 h-28 pt-3 border-t border-slate-100">
                      {weeklyBars.map((b) => {
                        const pct = Math.max(15, Math.round((b.value / maxBar) * 100));
                        return (
                          <div key={b.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                            <div
                              title={`₹${b.value}`}
                              style={{ height: `${pct}%` }}
                              className="w-full max-w-[18px] rounded-t-md bg-gradient-to-t from-[#961123] to-[#E11D48] transition-all"
                            />
                            <span className="text-[10px] font-medium text-slate-500">{b.day}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Your Performance Ring Gauge */}
                <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                  <div className="bg-[#961123] text-white px-4 py-2.5 flex items-center gap-2 font-bold text-xs">
                    <Award className="w-4 h-4" />
                    <span>Your Performance</span>
                  </div>
                  <div className="p-4 flex-1 flex items-center justify-around gap-4">
                    <div className="flex flex-col items-center">
                      <div className="relative w-28 h-28 flex items-center justify-center">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          <circle cx="50" cy="50" r={radius} stroke="#e2e8f0" strokeWidth="10" fill="none" />
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            stroke="#16a34a"
                            strokeWidth="10"
                            strokeLinecap="round"
                            fill="none"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                          />
                        </svg>
                        <span className="absolute text-xl font-extrabold text-slate-900 tabular-nums">
                          {metrics.successRate}%
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-slate-700 mt-1">Delivery Success Rate</div>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
                        <div>
                          <div className="font-extrabold text-slate-900">{agentRating}</div>
                          <div className="text-[10px] text-slate-500">Customer Rating</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <MapPin className="w-4 h-4 text-[#961123] shrink-0" />
                        <div>
                          <div className="font-extrabold text-slate-900 tabular-nums">
                            {Math.max(12, metrics.totalToday * 6)} km
                          </div>
                          <div className="text-[10px] text-slate-500">Total Distance</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Package className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <div className="font-extrabold text-slate-900 tabular-nums">{metrics.totalToday}</div>
                          <div className="text-[10px] text-slate-500">Total Deliveries</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity Timeline */}
                <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                  <div className="bg-[#961123] text-white px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Clock className="w-4 h-4" />
                      <span>Recent Activity</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateTo('orders')}
                      className="text-[11px] font-semibold text-rose-100 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <span>View All</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                    {deliveryOrders.slice(0, 4).map((ord) => (
                      <div key={ord.id} className="flex items-start gap-3 text-xs">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            ord.orderWorkflowStatus === 'Delivered'
                              ? 'bg-emerald-100 text-emerald-700'
                              : ord.orderWorkflowStatus === 'Out for Delivery'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">
                            {ord.orderWorkflowStatus || 'Assigned'} · {ord.onlineOrderId || ord.invoiceNo}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {ord.partyName} {ord.deliveryBagId ? `· ${ord.deliveryBagId}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* SEPARATE PAGE: MY ORDERS */}
          {activePage === 'orders' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Assigned Delivery Orders</h2>
                  <p className="text-xs text-slate-500">Verify 4-digit customer OTP and record COD settlements</p>
                </div>
              </div>
              <div className="space-y-3">
                {deliveryOrders.map((ord) => {
                  const chip = getStatusChip(ord);
                  return (
                    <div
                      key={ord.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold font-mono text-slate-900">{ord.onlineOrderId || ord.invoiceNo}</span>
                          <span className="font-semibold text-slate-800">{ord.partyName}</span>
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${chip.cls}`}>
                            {chip.label}
                          </span>
                          {ord.deliveryBagId && (
                            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px] font-bold">
                              {ord.deliveryBagId}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          {ord.partyAddress || 'Store Pickup Zone'} · {ord.partyPhone || 'N/A'} · ₹
                          {ord.totalAmount.toLocaleString('en-IN')} ({ord.paymentType})
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrder(ord);
                          setOtpInput('');
                        }}
                        className="px-4 py-2 rounded-lg bg-[#961123] hover:bg-[#7D0C1B] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Manage Delivery</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SEPARATE PAGE: DELIVERY MAP */}
          {activePage === 'map' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Full Route Navigation</h2>
                  <p className="text-xs text-slate-500">Active stops from {company.name} dispatch hub</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                  {metrics.outForDeliveryCount} Active Stops
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deliveryOrders.map((ord, idx) => (
                  <div key={ord.id} className="p-4 rounded-xl border border-slate-200 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-full bg-[#961123] text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-sm text-slate-900">{ord.partyName}</div>
                        <div className="text-xs text-slate-500">{ord.partyAddress || 'Local Store Zone'}</div>
                        <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-2">
                          <Phone className="w-3 h-3" />
                          <span>{ord.partyPhone || '+91 98450 00000'}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(ord)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 hover:border-[#961123] text-xs font-semibold cursor-pointer"
                    >
                      Verify OTP
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SEPARATE PAGE: DELIVERY BAG */}
          {activePage === 'bag' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900">Delivery Bag Manifest</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deliveryOrders
                  .filter((o) => !o.isCancelled)
                  .map((ord) => (
                    <div key={ord.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-[#961123]">
                          {ord.deliveryBagId || `BAG-${ord.invoiceNo}`}
                        </span>
                        <span className="text-xs font-bold text-slate-700">{ord.items.length} item(s)</span>
                      </div>
                      <div className="text-xs font-semibold text-slate-800">{ord.partyName}</div>
                      <ul className="text-[11px] text-slate-600 list-disc pl-4 space-y-0.5">
                        {ord.items.map((it) => (
                          <li key={it.id}>
                            {it.name} × {it.qty}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* SEPARATE PAGE: EARNINGS */}
          {activePage === 'earnings' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900">Delivery Earnings & COD Summary</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                  <div className="text-xs text-slate-600">Today&apos;s Payout</div>
                  <div className="text-2xl font-extrabold text-[#961123] tabular-nums">
                    ₹{metrics.todayEarnings.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-xs text-slate-600">Completed Deliveries</div>
                  <div className="text-2xl font-extrabold text-emerald-700 tabular-nums">{metrics.deliveredCount}</div>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-xs text-slate-600">Per-Drop Rate</div>
                  <div className="text-2xl font-extrabold text-amber-700 tabular-nums">₹75.00</div>
                </div>
              </div>
            </div>
          )}

          {/* SEPARATE PAGE: ATTENDANCE */}
          {activePage === 'attendance' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Shift Attendance</h2>
                  <p className="text-xs text-slate-500">Punch IN before starting delivery route and Punch OUT after shift</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => recordAttendance(agentCode, 'IN', 'Delivery shift started')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Punch IN
                  </button>
                  <button
                    type="button"
                    onClick={() => recordAttendance(agentCode, 'OUT', 'Delivery shift ended')}
                    className="px-4 py-2 rounded-xl bg-[#961123] hover:bg-[#7D0C1B] text-white text-xs font-bold cursor-pointer"
                  >
                    Punch OUT
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {myAttendance.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">No attendance logs yet.</div>
                ) : (
                  myAttendance.map((rec) => (
                    <div key={rec.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{rec.date}</div>
                        <div className="text-slate-500">
                          In: {rec.punchInTime} {rec.punchOutTime ? `· Out: ${rec.punchOutTime}` : ''}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                        {rec.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* SEPARATE PAGE: MY PERFORMANCE */}
          {activePage === 'performance' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900">Partner Performance Scorecard</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200">
                  <div className="text-xs text-slate-500">On-Time Success Rate</div>
                  <div className="text-3xl font-extrabold text-emerald-600 mt-1 tabular-nums">{metrics.successRate}%</div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200">
                  <div className="text-xs text-slate-500">Average Customer Rating</div>
                  <div className="text-3xl font-extrabold text-amber-600 mt-1">{agentRating} ★</div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200">
                  <div className="text-xs text-slate-500">Failed / Returned</div>
                  <div className="text-3xl font-extrabold text-rose-600 mt-1 tabular-nums">
                    {metrics.failedCount + metrics.returnedCount}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SEPARATE PAGE: PROFILE / SUPPORT / SETTINGS */}
          {(activePage === 'profile' || activePage === 'settings') && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 max-w-2xl">
              <h2 className="text-base font-bold text-slate-900">
                {activePage === 'profile' ? 'Delivery Partner Profile' : 'Partner App Settings'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-400">Name</div>
                  <div className="font-bold text-slate-900 mt-0.5">{currentUser.name}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-400">Partner ID</div>
                  <div className="font-bold font-mono text-slate-900 mt-0.5">{agentCode}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-400">Mobile</div>
                  <div className="font-bold text-slate-900 mt-0.5">{currentUser.phone}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-400">Duty Status</div>
                  <select
                    value={availability}
                    onChange={(e) =>
                      updateDeliveryBoyAvailability(e.target.value as 'Available' | 'On Break' | 'Offline')
                    }
                    className="mt-1 px-2 py-1 rounded border border-slate-300 bg-white font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="Available">Available</option>
                    <option value="On Break">On Break</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activePage === 'notifications' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h2 className="text-base font-bold text-slate-900">Delivery Notifications</h2>
              {myNotifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No notifications yet.</div>
              ) : (
                myNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                      n.read ? 'border-slate-200 bg-white' : 'border-rose-200 bg-rose-50/50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{n.title}</div>
                      <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                    </div>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => markPortalNotificationRead(n.id)}
                        className="text-xs font-bold text-[#961123] hover:underline shrink-0 cursor-pointer"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activePage === 'support' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 max-w-xl">
              <h2 className="text-base font-bold text-slate-900">Dispatch & Route Support</h2>
              <p className="text-xs text-slate-500">
                Report customer unreachable, vehicle issues, or address corrections to the Online Store Manager.
              </p>
              <textarea
                rows={4}
                value={supportMsg}
                onChange={(e) => setSupportMsg(e.target.value)}
                placeholder="Describe your route issue or order ID..."
                className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#961123]"
              />
              <button
                type="button"
                onClick={() => {
                  if (!supportMsg.trim()) return showToast('Enter a support message first.');
                  setSupportMsg('');
                  showToast('Support alert sent to Online Store Manager.');
                }}
                className="px-4 py-2 rounded-xl bg-[#961123] hover:bg-[#7D0C1B] text-white text-xs font-bold cursor-pointer"
              >
                Send to Dispatch Desk
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Order Verification Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-[#961123] text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm">
                  {selectedOrder.onlineOrderId || `Order #${selectedOrder.invoiceNo}`}
                </div>
                <div className="text-[11px] text-rose-100">{selectedOrder.partyName}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-lg hover:bg-white/15 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900">Delivery Address</div>
                <div className="text-slate-600">{selectedOrder.partyAddress || 'Store Delivery Zone'}</div>
                <div className="text-slate-500">Phone: {selectedOrder.partyPhone || 'N/A'}</div>
              </div>

              <div className="flex items-center justify-between font-bold text-sm">
                <span>Amount ({selectedOrder.paymentType})</span>
                <span className="text-[#961123] tabular-nums">
                  ₹{selectedOrder.totalAmount.toLocaleString('en-IN')}
                </span>
              </div>

              {selectedOrder.orderWorkflowStatus !== 'Delivered' && !selectedOrder.isCancelled ? (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  {selectedOrder.paymentType === 'Cash' && (
                    <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={codCollected}
                        onChange={(e) => setCodCollected(e.target.checked)}
                        className="accent-[#961123]"
                      />
                      <span>Confirm COD cash collected (₹{selectedOrder.totalAmount})</span>
                    </label>
                  )}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Customer 4-Digit Delivery OTP</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 4-digit OTP"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-center text-sm font-bold focus:outline-none focus:border-[#961123]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const res = verifyDeliveryOtpAndCompleteOrder(
                        selectedOrder.id,
                        otpInput,
                        selectedOrder.paymentType === 'Cash' ? codCollected : true
                      );
                      if (res.success) {
                        setSelectedOrder(null);
                      }
                    }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                  >
                    Verify OTP &amp; Mark Delivered
                  </button>

                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <input
                      type="text"
                      value={outcomeReason}
                      onChange={(e) => setOutcomeReason(e.target.value)}
                      placeholder="Reason if delivery failed or returned"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          markDeliveryOutcome(
                            selectedOrder.id,
                            'Cancelled',
                            outcomeReason || 'Customer unreachable'
                          );
                          setSelectedOrder(null);
                        }}
                        className="py-2 rounded-lg border border-rose-200 text-rose-700 font-bold hover:bg-rose-50 cursor-pointer"
                      >
                        Mark Failed
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          markDeliveryOutcome(selectedOrder.id, 'Returned', outcomeReason || 'Customer returned');
                          setSelectedOrder(null);
                        }}
                        className="py-2 rounded-lg border border-purple-200 text-purple-700 font-bold hover:bg-purple-50 cursor-pointer"
                      >
                        Mark Returned
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-center">
                  Status: {selectedOrder.orderWorkflowStatus}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
