import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  ClipboardCheck,
  ShoppingBag,
  Truck,
  Users,
  Boxes,
  BarChart3,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Eye,
  CheckCircle2,
  XCircle,
  Package,
  Send,
  Search,
  ShieldAlert,
  Phone,
  Clock,
  MapPin,
  Printer,
  MessageSquare,
  Download,
} from 'lucide-react';
import { useVyapar } from '../../../context/VyaparContext';
import { Transaction } from '../../../types';
import { apiClient } from '../../../utils/apiClient';

type OnlineManagerPageId =
  | 'dashboard'
  | 'assigned-work'
  | 'online-orders'
  | 'packing-delivery'
  | 'customers'
  | 'inventory'
  | 'reports'
  | 'notifications'
  | 'settings';

const MANAGER_ROUTES: {
  id: OnlineManagerPageId;
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'dashboard', path: '/online-manager/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'assigned-work', path: '/online-manager/assigned-work', label: 'Assigned Work', icon: ClipboardCheck },
  { id: 'online-orders', path: '/online-manager/online-orders', label: 'Online Orders', icon: ShoppingBag },
  { id: 'packing-delivery', path: '/online-manager/packing-delivery', label: 'Packing & Delivery', icon: Truck },
  { id: 'customers', path: '/online-manager/customers', label: 'Customers', icon: Users },
  { id: 'inventory', path: '/online-manager/inventory', label: 'Inventory', icon: Boxes },
  { id: 'reports', path: '/online-manager/reports', label: 'Reports', icon: BarChart3 },
  { id: 'notifications', path: '/online-manager/notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', path: '/online-manager/settings', label: 'Settings', icon: Settings },
];

type PipelineStage =
  | 'All'
  | 'New Order'
  | 'Accepted'
  | 'Packing'
  | 'Ready for Dispatch'
  | 'Out for Delivery'
  | 'Delivered';

export const OnlineManagerPortal: React.FC = () => {
  const {
    currentUser,
    company,
    users,
    items,
    customerAccounts,
    transactions,
    staffTasks,
    supportMessages,
    portalNotifications,
    serviceAreaConfig,
    canAccessFeature,
    approveOnlineOrder,
    rejectOnlineOrder,
    packOnlineOrder,
    markOrderReadyForDispatch,
    assignDeliveryBoyToOrder,
    replyToCustomerSupport,
    toggleStaffTaskStatus,
    markPortalNotificationRead,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    exportModuleCsv,
    exportCurrentViewPdf,
    setIsLogoutModalOpen,
    showToast,
  } = useVyapar();

  const managerId = currentUser?.employeeId || currentUser?.id || 'OMGR001';
  const roleName = currentUser?.roleName || 'Online Store Manager';
  const inventoryAuthorized =
    currentUser?.onlineInventoryAccess !== false && canAccessFeature('products');

  const resolvePageFromUrl = (): OnlineManagerPageId => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      const matched = MANAGER_ROUTES.find((r) => r.path === p);
      if (matched) return matched.id;
    }
    return 'dashboard';
  };

  const [activePage, setActivePage] = useState<OnlineManagerPageId>(resolvePageFromUrl);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState<PipelineStage>('All');
  const [orderSearch, setOrderSearch] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');
  const [selectedOrderModal, setSelectedOrderModal] = useState<Transaction | null>(null);

  // Reject Order Modal State
  const [rejectTarget, setRejectTarget] = useState<Transaction | null>(null);
  const [rejectReason, setRejectReason] = useState('Item out of stock in central hub');

  // Assign Delivery Modal State
  const [assignTarget, setAssignTarget] = useState<Transaction | null>(null);
  const [selectedDeliveryUserId, setSelectedDeliveryUserId] = useState<string>('');

  // Support Reply State
  const [activeSupportId, setActiveSupportId] = useState<string | null>(null);
  const [supportReplyText, setSupportReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const navigateTo = (pageId: OnlineManagerPageId) => {
    setActivePage(pageId);
    setMobileMenuOpen(false);
    const meta = MANAGER_ROUTES.find((r) => r.id === pageId);
    if (meta && typeof window !== 'undefined' && window.location.pathname !== meta.path) {
      window.history.pushState({ managerPage: pageId }, '', meta.path);
    }
  };

  useEffect(() => {
    const onPopState = () => {
      setActivePage(resolvePageFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Derive strictly online orders (never mix physical counter POS bills)
  const onlineOrders = useMemo(
    () =>
      transactions.filter(
        (tx) => tx.source === 'ONLINE_STORE' || Boolean(tx.onlineOrderId)
      ),
    [transactions]
  );

  const mapOrderPipelineStage = (tx: Transaction): PipelineStage => {
    const st = tx.orderWorkflowStatus;
    if (st === 'Pending Approval' || !st) return 'New Order';
    if (st === 'Confirmed') return 'Accepted';
    if (st === 'Packing') {
      return tx.deliveryBagId ? 'Ready for Dispatch' : 'Packing';
    }
    if (st === 'Out for Delivery') return 'Out for Delivery';
    if (st === 'Delivered') return 'Delivered';
    return 'New Order';
  };

  const kpis = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-GB');
    const activeOrders = onlineOrders.filter((o) => o.orderWorkflowStatus !== 'Cancelled');
    const newOrders = activeOrders.filter((o) => mapOrderPipelineStage(o) === 'New Order').length;
    const pendingPacking = activeOrders.filter(
      (o) => o.orderWorkflowStatus === 'Confirmed' || mapOrderPipelineStage(o) === 'Packing'
    ).length;
    const readyDispatch = activeOrders.filter(
      (o) => mapOrderPipelineStage(o) === 'Ready for Dispatch'
    ).length;
    const inProgress = activeOrders.filter(
      (o) => o.orderWorkflowStatus === 'Out for Delivery'
    ).length;
    const deliveredCount = activeOrders.filter((o) => o.orderWorkflowStatus === 'Delivered').length;
    const cancelledCount = onlineOrders.filter((o) => o.orderWorkflowStatus === 'Cancelled').length;
    const todaySales = activeOrders
      .filter((o) => (o.date || '').startsWith(todayStr))
      .reduce((s, o) => s + (o.totalAmount || 0), 0);
    const totalSales = activeOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const successRate =
      deliveredCount + cancelledCount > 0
        ? Math.round((deliveredCount / (deliveredCount + cancelledCount)) * 100)
        : 96;

    return {
      todayOrdersCount:
        activeOrders.filter((o) => (o.date || '').startsWith(todayStr)).length ||
        activeOrders.length,
      newOrders,
      pendingPacking,
      readyDispatch,
      inProgress,
      deliveredCount,
      cancelledCount,
      todaySales: todaySales || totalSales,
      totalSales,
      successRate,
    };
  }, [onlineOrders]);

  const deliveryAgents = useMemo(() => {
    const agents = users.filter(
      (u) =>
        u.roleName.toLowerCase().includes('delivery') ||
        u.roleId === 'role-delivery' ||
        (u.employeeId || '').startsWith('DEL')
    );
    return agents.map((a) => {
      const assignedCount = onlineOrders.filter(
        (o) =>
          (o.deliveryBoyId === a.employeeId ||
            o.deliveryBoyId === a.id ||
            o.deliveryBoyName === a.name) &&
          o.orderWorkflowStatus !== 'Delivered' &&
          o.orderWorkflowStatus !== 'Cancelled'
      ).length;
      return {
        ...a,
        assignedCount,
        availability: a.deliveryAvailability || 'Available',
      };
    });
  }, [users, onlineOrders]);

  useEffect(() => {
    if (!selectedDeliveryUserId && deliveryAgents.length > 0) {
      setSelectedDeliveryUserId(deliveryAgents[0].employeeId || deliveryAgents[0].id);
    }
  }, [deliveryAgents, selectedDeliveryUserId]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return onlineOrders.filter((tx) => {
      const stage = mapOrderPipelineStage(tx);
      if (stageFilter !== 'All' && stage !== stageFilter) return false;
      if (!q) return true;
      return (
        (tx.onlineOrderId || tx.invoiceNo).toLowerCase().includes(q) ||
        tx.partyName.toLowerCase().includes(q) ||
        (tx.partyPhone || '').toLowerCase().includes(q)
      );
    });
  }, [onlineOrders, stageFilter, orderSearch]);

  const unreadNotifs = useMemo(
    () => portalNotifications.filter((n) => !n.read),
    [portalNotifications]
  );

  // Order Workflow Action Handlers (Synced via Express API + Context)
  const handleAcceptOrder = async (tx: Transaction) => {
    try {
      await apiClient.onlineManagerOrderAction(tx.id, { action: 'accept', roleName });
    } catch {
      // Context still executes if offline/bootstrapped locally
    }
    approveOnlineOrder(tx.id);
  };

  const handleStartPacking = async (tx: Transaction) => {
    try {
      await apiClient.onlineManagerOrderAction(tx.id, { action: 'pack', roleName });
    } catch {
      // ignore
    }
    packOnlineOrder(tx.id);
  };

  const handleMarkReady = async (tx: Transaction) => {
    const bagId = tx.deliveryBagId || `BAG-${tx.invoiceNo.slice(-4)}`;
    try {
      await apiClient.onlineManagerOrderAction(tx.id, {
        action: 'ready',
        roleName,
        deliveryBagId: bagId,
      });
    } catch {
      // ignore
    }
    markOrderReadyForDispatch(tx.id, bagId);
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    try {
      await apiClient.onlineManagerOrderAction(rejectTarget.id, {
        action: 'reject',
        roleName,
        reason: rejectReason,
      });
    } catch {
      // ignore
    }
    rejectOnlineOrder(rejectTarget.id, rejectReason);
    setRejectTarget(null);
  };

  const handleConfirmAssignDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTarget) return;
    const agent =
      deliveryAgents.find(
        (a) => (a.employeeId || a.id) === selectedDeliveryUserId
      ) || deliveryAgents[0];
    if (!agent) return;
    const agentCode = agent.employeeId || agent.id;
    try {
      await apiClient.onlineManagerOrderAction(assignTarget.id, {
        action: 'assign',
        roleName,
        deliveryBoyId: agentCode,
        deliveryBoyName: agent.name,
      });
    } catch {
      // ignore
    }
    assignDeliveryBoyToOrder(assignTarget.id, agentCode, agent.name, agent.phone);
    setAssignTarget(null);
  };

  const handleSendSupportReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSupportId || !supportReplyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      const res = await replyToCustomerSupport(activeSupportId, supportReplyText.trim());
      if (res.success) {
        setSupportReplyText('');
        setActiveSupportId(null);
      }
    } finally {
      setSendingReply(false);
    }
  };

  const pipelineCounts = useMemo(() => {
    const stages: Exclude<PipelineStage, 'All'>[] = [
      'New Order',
      'Accepted',
      'Packing',
      'Ready for Dispatch',
      'Out for Delivery',
      'Delivered',
    ];
    return stages.map((st) => ({
      stage: st,
      count: onlineOrders.filter(
        (o) => o.orderWorkflowStatus !== 'Cancelled' && mapOrderPipelineStage(o) === st
      ).length,
    }));
  }, [onlineOrders]);

  const dailyChartSeries = useMemo(() => {
    const arr: { label: string; orders: number; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toLocaleDateString('en-GB');
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayOrders = onlineOrders.filter(
        (o) => o.orderWorkflowStatus !== 'Cancelled' && (o.date || '').startsWith(dStr)
      );
      arr.push({
        label,
        orders: dayOrders.length,
        revenue: dayOrders.reduce((s, o) => s + (o.totalAmount || 0), 0),
      });
    }
    if (arr.every((x) => x.orders === 0) && onlineOrders.length > 0) {
      arr[arr.length - 1].orders = onlineOrders.length;
      arr[arr.length - 1].revenue = kpis.totalSales;
    }
    return arr;
  }, [onlineOrders, kpis.totalSales]);

  const stageBadgeClass = (stage: PipelineStage | string) => {
    switch (stage) {
      case 'New Order':
      case 'Pending Approval':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Accepted':
      case 'Confirmed':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Packing':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Ready for Dispatch':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'Out for Delivery':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F3F6FC] text-slate-800 font-sans overflow-hidden select-none">
      {/* Top Navy Header */}
      <header className="h-16 bg-gradient-to-r from-[#0A162B] via-[#102246] to-[#152E5E] text-white px-4 lg:px-6 flex items-center justify-between shrink-0 border-b border-white/10 shadow-md z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] flex items-center justify-center font-black text-sm shadow-md border border-white/20">
              MS
            </div>
            <div>
              <div className="text-sm sm:text-base font-extrabold tracking-tight leading-none">
                Online Store Manager Dashboard
              </div>
              <div className="text-[10px] text-blue-200/80 font-medium mt-0.5">
                {company.name} • Online Fulfilment &amp; Dispatch Control
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigateTo('notifications')}
            className="relative p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifs.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EF4444] text-[10px] font-bold flex items-center justify-center">
                {unreadNotifs.length}
              </span>
            )}
          </button>

          <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-white/15">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-xs font-bold text-white border border-white/30">
              {(currentUser?.name || 'O').charAt(0)}
            </div>
            <div className="leading-tight">
              <div className="text-xs font-bold text-white">
                Welcome, {currentUser?.name || 'Online Manager'}
              </div>
              <div className="text-[10px] text-blue-200 font-mono">Manager ID: {managerId}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsLogoutModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold shadow-sm cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Navy Sidebar */}
        <aside
          className={`${
            mobileMenuOpen ? 'fixed inset-y-16 left-0 z-40 flex' : 'hidden lg:flex'
          } w-60 bg-gradient-to-b from-[#0C1830] via-[#102347] to-[#0B152A] text-slate-200 flex-col justify-between p-3.5 shrink-0 border-r border-white/10 overflow-y-auto`}
        >
          <nav className="space-y-1">
            {MANAGER_ROUTES.map((route) => {
              const Icon = route.icon;
              const active = activePage === route.id;
              return (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => navigateTo(route.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white shadow-lg shadow-blue-950/50'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{route.label}</span>
                  </span>
                  {route.id === 'online-orders' && kpis.newOrders > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                      {kpis.newOrders}
                    </span>
                  )}
                  {route.id === 'notifications' && unreadNotifs.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                      {unreadNotifs.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom Fast Delivery Vector Card */}
          <div className="mt-4 rounded-2xl bg-gradient-to-b from-[#172E59] to-[#0E1E3C] border border-blue-400/20 p-3.5 text-center">
            <svg viewBox="0 0 120 70" className="w-24 h-14 mx-auto mb-1.5" aria-hidden="true">
              <rect x="20" y="20" width="52" height="32" rx="5" fill="#2563EB" />
              <path d="M72 28 H94 L104 40 V52 H72 Z" fill="#60A5FA" />
              <circle cx="38" cy="54" r="7" fill="#0F172A" stroke="#E2E8F0" strokeWidth="2.5" />
              <circle cx="88" cy="54" r="7" fill="#0F172A" stroke="#E2E8F0" strokeWidth="2.5" />
              <path d="M8 30 H18 M4 38 H16" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div className="text-xs font-extrabold text-white">Fast Delivery Dispatch</div>
            <div className="text-[10px] text-blue-200 mt-0.5">
              {serviceAreaConfig.hubName}
            </div>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">
          {/* 1. DASHBOARD */}
          {activePage === 'dashboard' && (
            <div className="space-y-5">
              {/* 6 Summary KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5">
                <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-xs">
                  <div className="text-[11px] font-semibold text-slate-500">Today&apos;s Online Orders</div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">
                    {kpis.todayOrdersCount}
                  </div>
                  <div className="text-[10px] font-bold text-[#2563EB] mt-1">Live store queue</div>
                </div>
                <div className="bg-white rounded-2xl border border-amber-100 p-4 shadow-xs">
                  <div className="text-[11px] font-semibold text-slate-500">New Orders</div>
                  <div className="text-2xl font-extrabold text-amber-600 mt-1">{kpis.newOrders}</div>
                  <div className="text-[10px] font-bold text-amber-700 mt-1">Awaiting accept</div>
                </div>
                <div className="bg-white rounded-2xl border border-indigo-100 p-4 shadow-xs">
                  <div className="text-[11px] font-semibold text-slate-500">Pending Packing</div>
                  <div className="text-2xl font-extrabold text-indigo-600 mt-1">
                    {kpis.pendingPacking}
                  </div>
                  <div className="text-[10px] font-bold text-indigo-700 mt-1">In godown hub</div>
                </div>
                <div className="bg-white rounded-2xl border border-violet-100 p-4 shadow-xs">
                  <div className="text-[11px] font-semibold text-slate-500">Ready for Dispatch</div>
                  <div className="text-2xl font-extrabold text-violet-600 mt-1">
                    {kpis.readyDispatch}
                  </div>
                  <div className="text-[10px] font-bold text-violet-700 mt-1">Bagged &amp; tagged</div>
                </div>
                <div className="bg-white rounded-2xl border border-sky-100 p-4 shadow-xs">
                  <div className="text-[11px] font-semibold text-slate-500">Deliveries in Progress</div>
                  <div className="text-2xl font-extrabold text-sky-600 mt-1">{kpis.inProgress}</div>
                  <div className="text-[10px] font-bold text-sky-700 mt-1">Out with riders</div>
                </div>
                <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-xs">
                  <div className="text-[11px] font-semibold text-slate-500">Today&apos;s Online Sales</div>
                  <div className="text-xl font-extrabold text-emerald-700 mt-1">
                    ₹{kpis.todaySales.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] font-bold text-emerald-600 mt-1">
                    {kpis.deliveredCount} delivered
                  </div>
                </div>
              </div>

              {/* Order Fulfilment Pipeline */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Order Fulfilment Pipeline
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Click any stage to filter Online Orders Management below.
                    </p>
                  </div>
                  {stageFilter !== 'All' && (
                    <button
                      type="button"
                      onClick={() => setStageFilter('All')}
                      className="text-xs font-bold text-[#2563EB] hover:underline cursor-pointer"
                    >
                      Show All Stages
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {pipelineCounts.map((step, idx) => {
                    const selected = stageFilter === step.stage;
                    return (
                      <button
                        key={step.stage}
                        type="button"
                        onClick={() =>
                          setStageFilter((prev) => (prev === step.stage ? 'All' : step.stage))
                        }
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          selected
                            ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-md'
                            : 'bg-slate-50 hover:bg-blue-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="text-[10px] font-bold opacity-75">Step {idx + 1}</div>
                        <div className="text-xs font-extrabold mt-0.5 truncate">{step.stage}</div>
                        <div className="text-lg font-black mt-1">{step.count}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Main Orders Management Table + Delivery Assignment Panel */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                <div className="xl:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Online Orders Management ({filteredOrders.length})
                    </h3>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        placeholder="Search order ID or customer..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="py-2 pr-2">Order ID</th>
                          <th className="py-2 px-2">Customer</th>
                          <th className="py-2 px-2">Amount</th>
                          <th className="py-2 px-2">Payment</th>
                          <th className="py-2 px-2">Stage</th>
                          <th className="py-2 pl-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredOrders.slice(0, 8).map((tx) => {
                          const stage =
                            tx.orderWorkflowStatus === 'Cancelled'
                              ? 'Cancelled'
                              : mapOrderPipelineStage(tx);
                          return (
                            <tr key={tx.id} className="hover:bg-blue-50/40">
                              <td className="py-2.5 pr-2 font-mono font-bold text-slate-900">
                                {tx.onlineOrderId || tx.invoiceNo}
                              </td>
                              <td className="py-2.5 px-2">
                                <div className="font-semibold text-slate-900">{tx.partyName}</div>
                                <div className="text-[10px] text-slate-500">{tx.partyPhone}</div>
                              </td>
                              <td className="py-2.5 px-2 font-bold">
                                ₹{tx.totalAmount.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    tx.status === 'Paid'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-amber-50 text-amber-700'
                                  }`}
                                >
                                  {tx.status === 'Paid' ? 'Paid' : 'Pending'}
                                </span>
                              </td>
                              <td className="py-2.5 px-2">
                                <span
                                  className={`px-2 py-0.5 rounded border text-[10px] font-bold ${stageBadgeClass(
                                    stage
                                  )}`}
                                >
                                  {stage}
                                </span>
                              </td>
                              <td className="py-2.5 pl-2 text-right whitespace-nowrap space-x-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderModal(tx)}
                                  className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
                                >
                                  View
                                </button>
                                {stage === 'New Order' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleAcceptOrder(tx)}
                                      className="px-2 py-1 rounded-lg bg-[#2563EB] text-white text-[11px] font-bold cursor-pointer"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRejectTarget(tx)}
                                      className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                {stage === 'Accepted' && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartPacking(tx)}
                                    className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold cursor-pointer"
                                  >
                                    Start Packing
                                  </button>
                                )}
                                {stage === 'Packing' && (
                                  <button
                                    type="button"
                                    onClick={() => handleMarkReady(tx)}
                                    className="px-2 py-1 rounded-lg bg-violet-600 text-white text-[11px] font-bold cursor-pointer"
                                  >
                                    Mark Ready
                                  </button>
                                )}
                                {(stage === 'Ready for Dispatch' || stage === 'Packing') && (
                                  <button
                                    type="button"
                                    onClick={() => setAssignTarget(tx)}
                                    className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                                  >
                                    Assign Boy
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {filteredOrders.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400">
                              No online orders match the current filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Delivery Assignment Panel */}
                <div className="xl:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-slate-900">Delivery Assignment</h3>
                    <button
                      type="button"
                      onClick={() => navigateTo('packing-delivery')}
                      className="text-[11px] font-bold text-[#2563EB] hover:underline cursor-pointer"
                    >
                      Manage Dispatch →
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {deliveryAgents.map((agent) => (
                      <div
                        key={agent.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-extrabold text-slate-900">{agent.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              ID: {agent.employeeId || agent.id} • {agent.phone}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              agent.availability === 'Available'
                                ? 'bg-emerald-50 text-emerald-700'
                                : agent.availability === 'On Break'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {agent.availability}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1">
                          <span>Active Assigned Orders: <strong>{agent.assignedCount}</strong></span>
                          <span>★ {agent.deliveryRating || 4.8}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Customer Support + Online Store Performance Analytics */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                {/* Customer Support Queries */}
                <div className="xl:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Customer Support Queries
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#2563EB] text-[10px] font-bold">
                      {supportMessages.filter((m) => m.status === 'Open').length} Open
                    </span>
                  </div>
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {supportMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-extrabold text-slate-900">
                              {msg.customerName}
                            </span>
                            {msg.orderId && (
                              <span className="ml-2 font-mono text-[10px] text-[#2563EB] font-bold">
                                #{msg.orderId}
                              </span>
                            )}
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              msg.status === 'Open'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {msg.status}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-700">{msg.subject}</div>
                        <p className="text-[11px] text-slate-600">{msg.message}</p>
                        {msg.replies && msg.replies.length > 0 && (
                          <div className="pl-3 border-l-2 border-[#2563EB] space-y-1">
                            {msg.replies.map((r) => (
                              <div key={r.id} className="text-[11px] text-slate-700">
                                <strong>{r.senderName}:</strong> {r.message}{' '}
                                <span className="text-[10px] text-slate-400">({r.timestamp})</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {activeSupportId === msg.id ? (
                          <form onSubmit={handleSendSupportReply} className="flex gap-2 pt-1">
                            <input
                              type="text"
                              required
                              value={supportReplyText}
                              onChange={(e) => setSupportReplyText(e.target.value)}
                              placeholder="Type customer reply..."
                              className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                            />
                            <button
                              type="submit"
                              disabled={sendingReply}
                              className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Send className="w-3 h-3" />
                              <span>Send</span>
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSupportId(msg.id);
                              setSupportReplyText('');
                            }}
                            className="text-[11px] font-bold text-[#2563EB] hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Reply to Customer</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Online Store Performance Charts */}
                <div className="xl:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Online Store Performance
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Daily Online Orders &amp; Delivery Success Rate
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-extrabold">
                      {kpis.successRate}% Success
                    </span>
                  </div>
                  <div className="h-36 flex items-end justify-between gap-2 pt-2">
                    {(() => {
                      const maxRev = Math.max(100, ...dailyChartSeries.map((d) => d.revenue));
                      return dailyChartSeries.map((d, i) => {
                        const pct = Math.max(10, Math.round((d.revenue / maxRev) * 100));
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[10px] font-bold text-slate-600">{d.orders}</span>
                            <div className="w-full h-24 bg-blue-50 rounded-t-lg flex items-end p-0.5">
                              <div
                                className="w-full bg-gradient-to-t from-[#2563EB] to-[#60A5FA] rounded-t-md"
                                style={{ height: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-500 font-semibold">{d.label}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-center text-xs">
                    <div>
                      <div className="text-slate-500">Completed</div>
                      <div className="font-extrabold text-emerald-700">{kpis.deliveredCount}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Cancelled</div>
                      <div className="font-extrabold text-rose-600">{kpis.cancelledCount}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Online Revenue</div>
                      <div className="font-extrabold text-[#2563EB]">
                        ₹{kpis.totalSales.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. ASSIGNED WORK */}
          {activePage === 'assigned-work' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Assigned Online Store Work</h2>
                <p className="text-xs text-slate-500">
                  Operational checklist and SLA fulfilment tasks assigned to Online Store Management.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {staffTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-900">{t.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : t.status === 'In Progress'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{t.description}</p>
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span className="text-slate-500">
                        Priority: <strong>{t.priority}</strong> • Due {t.dueDate}
                      </span>
                      <select
                        value={t.status}
                        onChange={(e) => toggleStaffTaskStatus(t.id, e.target.value as any)}
                        className="px-2 py-1 rounded-lg border border-slate-200 bg-white font-semibold"
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. ONLINE ORDERS */}
          {activePage === 'online-orders' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">All Online Orders</h2>
                  <p className="text-xs text-slate-500">
                    Accept, reject, pack, or assign online orders without interfering with offline POS billing.
                  </p>
                </div>
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search Order ID, Customer, Phone..."
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs w-full md:w-72"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Order ID</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Items</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Stage</th>
                      <th className="py-2.5 px-3 text-right">Workflow Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((tx) => {
                      const stage =
                        tx.orderWorkflowStatus === 'Cancelled'
                          ? 'Cancelled'
                          : mapOrderPipelineStage(tx);
                      return (
                        <tr key={tx.id} className="hover:bg-blue-50/40">
                          <td className="py-2.5 px-3 font-mono font-bold">
                            {tx.onlineOrderId || tx.invoiceNo}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{tx.date}</td>
                          <td className="py-2.5 px-3 font-semibold">{tx.partyName}</td>
                          <td className="py-2.5 px-3">{tx.items.length} items</td>
                          <td className="py-2.5 px-3 font-bold">
                            ₹{tx.totalAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded border text-[10px] font-bold ${stageBadgeClass(
                                stage
                              )}`}
                            >
                              {stage}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedOrderModal(tx)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 font-semibold cursor-pointer"
                            >
                              View Order
                            </button>
                            {stage === 'New Order' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleAcceptOrder(tx)}
                                  className="px-2.5 py-1 rounded-lg bg-[#2563EB] text-white font-bold cursor-pointer"
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRejectTarget(tx)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {stage === 'Accepted' && (
                              <button
                                type="button"
                                onClick={() => handleStartPacking(tx)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold cursor-pointer"
                              >
                                Pack
                              </button>
                            )}
                            {stage === 'Packing' && (
                              <button
                                type="button"
                                onClick={() => handleMarkReady(tx)}
                                className="px-2.5 py-1 rounded-lg bg-violet-600 text-white font-bold cursor-pointer"
                              >
                                Mark Ready
                              </button>
                            )}
                            {(stage === 'Ready for Dispatch' || stage === 'Packing') && (
                              <button
                                type="button"
                                onClick={() => setAssignTarget(tx)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer"
                              >
                                Assign Delivery Boy
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. PACKING & DELIVERY */}
          {activePage === 'packing-delivery' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <h2 className="text-lg font-extrabold text-slate-900">Packing &amp; Delivery Queue</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {onlineOrders
                    .filter((o) => o.orderWorkflowStatus !== 'Cancelled')
                    .map((tx) => {
                      const stage = mapOrderPipelineStage(tx);
                      return (
                        <div
                          key={tx.id}
                          className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-extrabold text-slate-900">
                              {tx.onlineOrderId || tx.invoiceNo}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded border text-[10px] font-bold ${stageBadgeClass(
                                stage
                              )}`}
                            >
                              {stage}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-800">{tx.partyName}</div>
                          <div className="text-[11px] text-slate-500">
                            Bag ID: <strong>{tx.deliveryBagId || 'Not Bagged'}</strong> • Delivery Boy:{' '}
                            <strong>{tx.deliveryBoyName || 'Unassigned'}</strong>
                          </div>
                          {tx.deliveryOtp && (
                            <div className="text-[11px] font-mono text-[#2563EB] font-bold">
                              Customer Delivery OTP: {tx.deliveryOtp}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2 pt-1">
                            {stage === 'Accepted' && (
                              <button
                                type="button"
                                onClick={() => handleStartPacking(tx)}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                              >
                                Start Packing
                              </button>
                            )}
                            {stage === 'Packing' && (
                              <button
                                type="button"
                                onClick={() => handleMarkReady(tx)}
                                className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold cursor-pointer"
                              >
                                Mark Ready for Dispatch
                              </button>
                            )}
                            {(stage === 'Ready for Dispatch' || stage === 'Packing') && (
                              <button
                                type="button"
                                onClick={() => setAssignTarget(tx)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                              >
                                Assign Delivery Boy
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* 5. CUSTOMERS */}
          {activePage === 'customers' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <h2 className="text-lg font-extrabold text-slate-900">Online Store Customers</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {customerAccounts.map((c) => {
                  const orders = onlineOrders.filter(
                    (o) => o.customerId === c.id || o.partyName === c.linkedPartyName
                  );
                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold text-slate-900">{c.fullName}</span>
                        <span className="text-[10px] font-mono font-bold text-[#2563EB]">
                          {c.customerId}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">{c.phone} • {c.email}</div>
                      <div className="text-[11px] text-slate-500">
                        MS Credit Balance: <strong>₹{c.msCreditBalance || 0}</strong> • Orders:{' '}
                        <strong>{orders.length}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. INVENTORY (Permission-Based) */}
          {activePage === 'inventory' &&
            (inventoryAuthorized ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">
                      Online Store Inventory Overview
                    </h2>
                    <p className="text-xs text-slate-500">
                      Live stock &amp; reserved quantities synced with customer storefront.
                    </p>
                  </div>
                  <input
                    type="text"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="Search online SKU..."
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs w-full sm:w-64"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">Online Price</th>
                        <th className="py-2.5 px-3">Available Stock</th>
                        <th className="py-2.5 px-3">Reserved</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items
                        .filter(
                          (it) =>
                            !inventorySearch.trim() ||
                            it.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
                            it.code.toLowerCase().includes(inventorySearch.toLowerCase())
                        )
                        .map((it) => (
                          <tr key={it.id} className="hover:bg-blue-50/40">
                            <td className="py-2.5 px-3 font-mono text-slate-500">{it.code}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{it.name}</td>
                            <td className="py-2.5 px-3 font-bold">₹{it.salePrice}</td>
                            <td className="py-2.5 px-3 font-bold">
                              {it.stock} {it.unit}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{it.reservedStock || 0}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  it.stock <= (it.minStockAlert || 5)
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                {it.stock <= 0
                                  ? 'Out of Stock'
                                  : it.stock <= (it.minStockAlert || 5)
                                  ? 'Low Stock'
                                  : 'In Stock'}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-rose-200 p-8 max-w-lg mx-auto text-center">
                <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto mb-3" />
                <h2 className="text-base font-extrabold text-slate-900">
                  Inventory View Restricted
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Administrator has disabled Inventory access for this Online Store Manager account.
                </p>
              </div>
            ))}

          {/* 7. REPORTS */}
          {activePage === 'reports' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    Online Store Reports &amp; KPIs
                  </h2>
                  <p className="text-xs text-slate-500">
                    Fulfilment SLA, online revenue, and delivery completion ratios.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => exportModuleCsv('sales')}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCurrentViewPdf()}
                    className="px-3.5 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Report</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                  <div className="text-xs text-slate-600">Total Online Orders</div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">
                    {onlineOrders.length}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="text-xs text-slate-600">Completed Deliveries</div>
                  <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                    {kpis.deliveredCount}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                  <div className="text-xs text-slate-600">Cancelled Orders</div>
                  <div className="text-2xl font-extrabold text-rose-700 mt-1">
                    {kpis.cancelledCount}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                  <div className="text-xs text-slate-600">Delivery Success Rate</div>
                  <div className="text-2xl font-extrabold text-indigo-700 mt-1">
                    {kpis.successRate}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 8. NOTIFICATIONS */}
          {activePage === 'notifications' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h2 className="text-lg font-extrabold text-slate-900">Alerts &amp; Notifications</h2>
              <div className="space-y-2.5">
                {portalNotifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markPortalNotificationRead(n.id)}
                    className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 cursor-pointer ${
                      n.read ? 'bg-white border-slate-200' : 'bg-blue-50/70 border-blue-200'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">{n.title}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{n.message}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{n.createdAt}</div>
                    </div>
                    {!n.read && (
                      <span className="px-2 py-0.5 rounded bg-[#2563EB] text-white text-[10px] font-bold">
                        New
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. SETTINGS */}
          {activePage === 'settings' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl shadow-xs space-y-4">
              <h2 className="text-lg font-extrabold text-slate-900">
                Online Store Manager Settings
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">Manager Name</div>
                  <div className="font-bold text-slate-900 mt-0.5">{currentUser?.name}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">Manager ID</div>
                  <div className="font-mono font-bold text-[#2563EB] mt-0.5">{managerId}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">Serviceable Hub</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {serviceAreaConfig.hubName} (Max {serviceAreaConfig.maxRadiusKm} km)
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">Inventory Permission</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {inventoryAuthorized ? 'Authorized (Read Live Stock)' : 'Restricted'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* View Order Detail Modal */}
      {selectedOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Order {selectedOrderModal.onlineOrderId || selectedOrderModal.invoiceNo}
                </h3>
                <p className="text-xs text-slate-500">{selectedOrderModal.date}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderModal(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <strong>Customer:</strong> {selectedOrderModal.partyName} (
                {selectedOrderModal.partyPhone || 'N/A'})
              </div>
              <div>
                <strong>Address:</strong> {selectedOrderModal.partyAddress || 'Store Pickup'}
              </div>
              <div>
                <strong>Payment:</strong> {selectedOrderModal.paymentType} •{' '}
                {selectedOrderModal.status}
              </div>
            </div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {selectedOrderModal.items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between text-xs border-b border-slate-100 pb-1.5"
                >
                  <span>
                    {it.name} × {it.qty} {it.unit}
                  </span>
                  <span className="font-bold">₹{it.amount.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="text-sm font-extrabold text-[#2563EB]">
                Total: ₹{selectedOrderModal.totalAmount.toLocaleString('en-IN')}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedInvoice(selectedOrderModal);
                  setIsInvoicePreviewOpen(true);
                  setSelectedOrderModal(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Order Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Order Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmReject}
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-3 shadow-2xl"
          >
            <h3 className="text-sm font-extrabold text-slate-900">
              Reject Order {rejectTarget.onlineOrderId || rejectTarget.invoiceNo}
            </h3>
            <p className="text-xs text-slate-500">
              Provide a rejection reason. Reserved stock will be released automatically.
            </p>
            <textarea
              required
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assign Delivery Boy Modal */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmAssignDelivery}
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-3 shadow-2xl"
          >
            <h3 className="text-sm font-extrabold text-slate-900">
              Assign Delivery Partner — {assignTarget.onlineOrderId || assignTarget.invoiceNo}
            </h3>
            <p className="text-xs text-slate-500">
              Customer: {assignTarget.partyName} • Total: ₹
              {assignTarget.totalAmount.toLocaleString('en-IN')}
            </p>
            <select
              value={selectedDeliveryUserId}
              onChange={(e) => setSelectedDeliveryUserId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
            >
              {deliveryAgents.map((a) => (
                <option key={a.id} value={a.employeeId || a.id}>
                  {a.name} ({a.employeeId || a.id}) — {a.availability} ({a.assignedCount} active)
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssignTarget(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
              >
                Dispatch &amp; Generate OTP
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
