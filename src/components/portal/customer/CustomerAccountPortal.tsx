import React, { useMemo, useState } from 'react';
import {
  User as UserIcon,
  Package,
  Heart,
  MapPin,
  Gift,
  Crown,
  FileText,
  Bell,
  Headphones,
  Settings,
  LogOut,
  ShoppingCart,
  Star,
  Plus,
  Trash2,
  Download,
  Eye,
  ChevronDown,
  MessageCircle,
  Send,
  ShieldCheck,
  RotateCcw,
  Wallet,
  Copy,
} from 'lucide-react';
import { useVyapar } from '../../../context/VyaparContext';
import { Transaction } from '../../../types';
import {
  CUSTOMER_FAQS,
  StoreProduct,
} from '../../../utils/customerStoreCatalog';
import { exportSingleInvoicePdf } from '../../../utils/pdfExport';

export type CustomerAccountSection =
  | 'profile'
  | 'orders'
  | 'wishlist'
  | 'addresses'
  | 'rewards'
  | 'membership'
  | 'invoices'
  | 'notifications'
  | 'support'
  | 'settings';

interface CustomerAccountPortalProps {
  activeSection: CustomerAccountSection;
  onChangeSection: (section: CustomerAccountSection) => void;
  wishlistIds: string[];
  products: StoreProduct[];
  rewardPoints: number;
  onToggleWishlist: (id: string) => void;
  onAddToCart: (id: string) => void;
  onReorderTransaction: (tx: Transaction) => void;
  onApplyPromoToCart: (code: string) => void;
  onBackToStore: () => void;
}

export const CustomerAccountPortal: React.FC<CustomerAccountPortalProps> = ({
  activeSection,
  onChangeSection,
  wishlistIds,
  products,
  rewardPoints,
  onToggleWishlist,
  onAddToCart,
  onReorderTransaction,
  onApplyPromoToCart,
  onBackToStore,
}) => {
  const {
    currentCustomer,
    transactions,
    company,
    portalNotifications,
    supportMessages,
    coupons,
    msCreditTransactions,
    returnRequests,
    serviceAreaConfig,
    setIsLogoutModalOpen,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    updateCustomerProfile,
    addCustomerAddress,
    deleteCustomerAddress,
    setDefaultCustomerAddress,
    payCustomerPendingInvoice,
    submitCustomerSupportMessage,
    markPortalNotificationRead,
    cancelCustomerOnlineOrder,
    submitCustomerReturnRequest,
    showToast,
  } = useVyapar();

  // Profile form state
  const [profName, setProfName] = useState(currentCustomer?.fullName || '');
  const [profPhone, setProfPhone] = useState(currentCustomer?.phone || '');

  // Address form state
  const [addrLabel, setAddrLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrArea, setAddrArea] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState(company.state || 'Maharashtra');
  const [addrPin, setAddrPin] = useState('');
  const [addrDefault, setAddrDefault] = useState(true);

  // Invoice payment modal state
  const [payingTx, setPayingTx] = useState<Transaction | null>(null);
  const [payMethod, setPayMethod] = useState<'UPI' | 'Bank Transfer' | 'Cash'>('UPI');
  const [invoiceFilter, setInvoiceFilter] = useState('');

  // Support & FAQ state matching Screenshot 877
  const [supportCategory, setSupportCategory] = useState('Order Issue');
  const [supportOrderNo, setSupportOrderNo] = useState('');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportDesc, setSupportDesc] = useState('');
  const [openFaqId, setOpenFaqId] = useState<string>('faq-online');
  const [showWhatsappCard, setShowWhatsappCard] = useState(false);

  // Order Cancel & Return Request inline states
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReasonText, setCancelReasonText] = useState('Changed mind / Ordered by mistake');
  const [returningOrderId, setReturningOrderId] = useState<string | null>(null);
  const [returnReasonText, setReturnReasonText] = useState('Damaged or wrong item delivered');

  if (!currentCustomer) return null;

  const normalizedPhone = currentCustomer.phone.replace(/\D/g, '');
  const matchesCustomer = (tx: Transaction) => {
    const pName = tx.partyName.toLowerCase().trim();
    const matchName =
      pName === currentCustomer.fullName.toLowerCase().trim() ||
      pName === currentCustomer.linkedPartyName.toLowerCase().trim();
    const txPhone = (tx.partyPhone || '').replace(/\D/g, '');
    const matchPhone = Boolean(normalizedPhone && txPhone && txPhone.endsWith(normalizedPhone.slice(-10)));
    return matchName || matchPhone;
  };

  const scopedOrders = useMemo(
    () =>
      transactions.filter((t) => {
        if (t.type !== 'Sale Order' && (t.type !== 'Sale' || t.source === 'ONLINE_STORE')) return false;
        // Avoid duplicating Sale + Sale Order for the same onlineOrderId in Orders view
        if (t.type === 'Sale' && t.convertedFrom?.docId) return false;
        return matchesCustomer(t) || t.customerId === currentCustomer.customerId;
      }),
    [transactions, currentCustomer]
  );

  const scopedInvoices = useMemo(
    () =>
      transactions.filter(
        (t) =>
          !t.isCancelled &&
          t.type === 'Sale' &&
          (matchesCustomer(t) || t.customerId === currentCustomer.customerId)
      ),
    [transactions, currentCustomer]
  );

  const pendingInvoices = useMemo(
    () => scopedInvoices.filter((t) => t.balance > 0),
    [scopedInvoices]
  );

  const myNotifications = useMemo(
    () =>
      portalNotifications.filter(
        (n) =>
          n.recipientType === 'CUSTOMER' &&
          (n.recipientId === 'ALL' || n.recipientId === currentCustomer.customerId)
      ),
    [portalNotifications, currentCustomer.customerId]
  );

  const unreadNotifCount = myNotifications.filter((n) => !n.read).length;

  const mySupportMessages = useMemo(
    () => supportMessages.filter((m) => m.customerId === currentCustomer.customerId),
    [supportMessages, currentCustomer.customerId]
  );

  const myMsCreditLedger = useMemo(
    () => msCreditTransactions.filter((m) => m.customerId === currentCustomer.customerId),
    [msCreditTransactions, currentCustomer.customerId]
  );

  const msCreditBalance = currentCustomer.msCreditBalance ?? rewardPoints;

  const wishlistProducts = useMemo(
    () => products.filter((p) => wishlistIds.includes(p.id)),
    [products, wishlistIds]
  );

  const sidebarItems: {
    id: CustomerAccountSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'profile', label: 'My Profile', icon: UserIcon },
    { id: 'orders', label: 'My Orders', icon: Package, badge: scopedOrders.length },
    { id: 'wishlist', label: 'My Wishlist', icon: Heart, badge: wishlistProducts.length },
    { id: 'addresses', label: 'Saved Addresses', icon: MapPin },
    { id: 'rewards', label: 'Rewards & Wallet', icon: Gift },
    { id: 'membership', label: 'Membership', icon: Crown },
    { id: 'invoices', label: 'GST Invoices', icon: FileText },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifCount || undefined },
    { id: 'support', label: 'Support & FAQ', icon: Headphones },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profName.trim()) return;
    updateCustomerProfile({ fullName: profName.trim(), phone: profPhone.trim() });
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrStreet.trim() || !addrCity.trim() || !addrPin.trim()) return;
    addCustomerAddress({
      label: addrLabel,
      name: currentCustomer.fullName,
      phone: currentCustomer.phone,
      street: addrStreet.trim(),
      area: addrArea.trim() || addrCity.trim(),
      city: addrCity.trim(),
      state: addrState.trim() || 'Maharashtra',
      pincode: addrPin.trim(),
      isDefault: addrDefault,
    });
    setAddrStreet('');
    setAddrArea('');
    setAddrCity('');
    setAddrPin('');
  };

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportDesc.trim()) return;
    const prefix = `[${supportCategory}]${supportOrderNo ? ` (${supportOrderNo})` : ''}`;
    submitCustomerSupportMessage(`${prefix} ${supportSubject.trim()}`, supportDesc.trim());
    setSupportSubject('');
    setSupportDesc('');
  };

  const filteredInvoices = scopedInvoices.filter((tx) => {
    if (!invoiceFilter.trim()) return true;
    const q = invoiceFilter.toLowerCase();
    return (
      tx.invoiceNo.toLowerCase().includes(q) ||
      (tx.onlineOrderId || '').toLowerCase().includes(q) ||
      tx.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6">
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Left Account Card matching Screenshots 876 & 877 */}
        <aside className="w-full md:w-64 shrink-0 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="bg-gradient-to-br from-[#1D63ED] to-[#1552CC] px-5 py-4 text-white">
            <div className="text-[11px] text-blue-100 font-medium">Signed in as</div>
            <div className="text-base font-extrabold leading-tight mt-0.5 truncate">
              {currentCustomer.fullName}
            </div>
            <div className="text-xs font-bold text-amber-300 mt-1 tabular-nums">
              MS Credit · ₹{msCreditBalance}
            </div>
          </div>

          <nav className="p-2.5 space-y-0.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeSection(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#EEF4FF] text-[#1D63ED]'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5 whitespace-nowrap">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#1D63ED]' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="pt-2 mt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(true)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Right Workspace Content */}
        <section className="flex-1 min-w-0 w-full space-y-5">
          {/* MY WISHLIST (Screenshot 876) */}
          {activeSection === 'wishlist' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-slate-900">
                  My Wishlist ({wishlistProducts.length})
                </h2>
                <button
                  type="button"
                  onClick={onBackToStore}
                  className="text-xs font-bold text-[#1D63ED] hover:underline cursor-pointer"
                >
                  Explore More Products →
                </button>
              </div>

              {wishlistProducts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
                  <Heart className="w-10 h-10 text-slate-300 mx-auto" />
                  <div className="text-sm font-bold text-slate-800">Your wishlist is empty</div>
                  <p className="text-xs text-slate-500">Tap the heart icon on any item in the store to save it here.</p>
                  <button
                    type="button"
                    onClick={onBackToStore}
                    className="px-5 py-2 rounded-xl bg-[#1D63ED] text-white text-xs font-bold cursor-pointer"
                  >
                    Browse Storefront
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {wishlistProducts.map((product) => (
                    <div
                      key={product.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="relative bg-slate-50 rounded-xl p-3 mb-3 flex items-center justify-center h-40">
                          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-bold">
                            {product.discountPercent}% OFF
                          </span>
                          <img
                            src={product.image}
                            alt={product.name}
                            referrerPolicy="no-referrer"
                            className="h-32 w-full object-contain rounded-lg"
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">{product.brand}</span>
                          <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {product.rating.toFixed(1)}
                          </span>
                        </div>

                        <h3 className="text-xs font-bold text-slate-900 mt-1 line-clamp-2 leading-snug">
                          {product.name}
                        </h3>
                        <div className="text-[11px] text-slate-400 mt-0.5">{product.subLabel}</div>

                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-base font-extrabold text-slate-900 tabular-nums">
                            ₹{product.price.toLocaleString('en-IN')}
                          </span>
                          <span className="text-xs text-slate-400 line-through tabular-nums">
                            ₹{product.mrp.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-emerald-700 mt-1">
                          ✓ In Stock
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-4">
                        <button
                          type="button"
                          onClick={() => onAddToCart(product.id)}
                          className="flex-1 py-2 rounded-xl bg-[#1D63ED] hover:bg-[#1552CC] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Add to Cart</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleWishlist(product.id)}
                          aria-label="Remove from wishlist"
                          className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 cursor-pointer"
                        >
                          <Heart className="w-4 h-4 fill-rose-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUPPORT & FAQ (Screenshot 877) */}
          {activeSection === 'support' && (
            <div className="space-y-5">
              {/* Top Support Banner */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Customer Support Centre</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Need help with delivery, GST billing, or returns? Reach us directly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWhatsappCard((prev) => !prev)}
                  className="px-4 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Contact via WhatsApp</span>
                </button>
              </div>

              {showWhatsappCard && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900">
                  <div>
                    <div className="font-bold">Store WhatsApp Support Desk: {company.phone}</div>
                    <div className="text-emerald-800/80 mt-0.5">
                      Copy support number or send a ticket below for prompt online assistance.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(company.phone);
                      showToast(`Copied store number: ${company.phone}`);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-bold inline-flex items-center gap-1.5 self-start sm:self-center cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Number</span>
                  </button>
                </div>
              )}

              {/* Ticket Form */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <h3 className="text-sm font-extrabold text-slate-900">Submit Return or Support Request</h3>
                <form onSubmit={handleSubmitTicket} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={supportCategory}
                      onChange={(e) => setSupportCategory(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 font-medium focus:outline-none focus:border-[#1D63ED]"
                    >
                      <option value="Order Issue">Order Issue</option>
                      <option value="Return / Replacement Request">Return / Replacement Request</option>
                      <option value="GST Invoice Correction">GST Invoice Correction</option>
                      <option value="Payment / Refund Query">Payment / Refund Query</option>
                      <option value="General Inquiry">General Inquiry</option>
                    </select>
                    <select
                      value={supportOrderNo}
                      onChange={(e) => setSupportOrderNo(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 font-medium focus:outline-none focus:border-[#1D63ED]"
                    >
                      <option value="">Related Order (Optional)</option>
                      {scopedInvoices.map((inv) => (
                        <option key={inv.id} value={inv.onlineOrderId || inv.invoiceNo}>
                          {inv.onlineOrderId || `#${inv.invoiceNo}`} · ₹{inv.totalAmount.toLocaleString('en-IN')} ({inv.date.split(',')[0]})
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="text"
                    required
                    value={supportSubject}
                    onChange={(e) => setSupportSubject(e.target.value)}
                    placeholder="Subject"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#1D63ED]"
                  />

                  <textarea
                    required
                    rows={4}
                    value={supportDesc}
                    onChange={(e) => setSupportDesc(e.target.value)}
                    placeholder="Describe your issue or return request..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#1D63ED]"
                  />

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#1D63ED] hover:bg-[#1552CC] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Ticket</span>
                  </button>
                </form>

                {mySupportMessages.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 space-y-2.5">
                    <div className="text-xs font-bold text-slate-700">Your Recent Support Requests</div>
                    {mySupportMessages.map((msg) => (
                      <div key={msg.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">{msg.subject}</span>
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-[#1D63ED] text-[10px] font-bold">
                            {msg.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{msg.message}</p>
                        <div className="text-[11px] text-slate-400 mt-1">{msg.createdAt}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Frequently Asked Questions */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-extrabold text-slate-900">Frequently Asked Questions</h3>
                <div className="divide-y divide-slate-100">
                  {CUSTOMER_FAQS.map((faq) => {
                    const isOpen = openFaqId === faq.id;
                    return (
                      <div key={faq.id} className="py-3">
                        <button
                          type="button"
                          onClick={() => setOpenFaqId(isOpen ? '' : faq.id)}
                          className="w-full flex items-center justify-between gap-4 text-left cursor-pointer"
                        >
                          <span className="text-xs font-bold text-slate-900">{faq.question}</span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                              isOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        {isOpen && (
                          <p className="text-xs text-slate-600 mt-2 leading-relaxed">{faq.answer}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* MY PROFILE */}
          {activeSection === 'profile' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5 max-w-2xl">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">My Profile</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Customer ID: <span className="font-mono font-bold text-slate-800">{currentCustomer.customerId}</span> · Email: {currentCustomer.email}
                </p>
              </div>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#1D63ED]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    required
                    value={profPhone}
                    onChange={(e) => setProfPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#1D63ED]"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#1D63ED] hover:bg-[#1552CC] text-white text-xs font-bold cursor-pointer"
                >
                  Save Profile Changes
                </button>
              </form>
            </div>
          )}

          {/* MY ORDERS */}
          {activeSection === 'orders' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">My Orders ({scopedOrders.length})</h2>
                  <p className="text-xs text-slate-500">Live workflow tracking, delivery OTP, cancellations, returns &amp; GST invoices</p>
                </div>
                <button
                  type="button"
                  onClick={onBackToStore}
                  className="px-4 py-2 rounded-xl bg-[#1D63ED] text-white text-xs font-bold cursor-pointer self-start sm:self-center"
                >
                  Shop Again
                </button>
              </div>

              {scopedOrders.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  No orders recorded on your customer profile yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {scopedOrders.map((tx) => {
                    const stage = tx.orderWorkflowStatus || (tx.isCancelled ? 'Cancelled' : tx.fulfillmentStatus === 'Completed' ? 'Delivered' : 'Pending Approval');
                    const linkedFinalInvoice = tx.linkedSaleInvoiceId
                      ? transactions.find((inv) => inv.id === tx.linkedSaleInvoiceId)
                      : tx.type === 'Sale'
                      ? tx
                      : undefined;
                    const docForInvoice = linkedFinalInvoice || tx;
                    const canCancel = !tx.isCancelled && (stage === 'Pending Approval' || stage === 'Confirmed' || stage === 'Packing');
                    const existingReturn = returnRequests.find((r) => r.orderId === tx.id);
                    const canReturn = !tx.isCancelled && stage === 'Delivered' && !existingReturn;

                    return (
                      <div key={tx.id} className="p-4 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-extrabold text-slate-900">
                              {tx.onlineOrderId || `#${tx.invoiceNo}`}
                              <span className="ml-2 font-mono font-normal text-slate-400">
                                ({linkedFinalInvoice ? `GST Invoice #${linkedFinalInvoice.invoiceNo}` : `Order #${tx.invoiceNo}`})
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {tx.date} · {tx.paymentType} ({tx.paymentStatus || tx.status})
                              {tx.deliveryBagId ? ` · Bag ${tx.deliveryBagId}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                                stage === 'Delivered'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : stage === 'Cancelled'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : stage === 'Out for Delivery'
                                  ? 'bg-blue-50 text-[#1D63ED] border-blue-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {stage}
                            </span>
                            <span className="text-sm font-extrabold text-slate-900 tabular-nums">
                              ₹{tx.totalAmount.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>

                        {stage === 'Out for Delivery' && tx.deliveryOtp && (
                          <div className="px-3.5 py-2.5 rounded-xl bg-blue-50 border border-blue-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="text-slate-700">
                              Delivery Partner: <strong>{tx.deliveryBoyName || 'Store Rider'}</strong> ({tx.deliveryBoyPhone || 'On the way'})
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-[#1D63ED] text-white font-mono font-extrabold tracking-widest">
                              Delivery OTP: {tx.deliveryOtp}
                            </span>
                          </div>
                        )}

                        {existingReturn && (
                          <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-semibold">
                            Return Request ({existingReturn.status}): {existingReturn.reason}
                          </div>
                        )}

                        {tx.items.length > 0 && (
                          <div className="text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2">
                            {tx.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}
                          </div>
                        )}

                        {cancellingOrderId === tx.id && (
                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2 text-xs">
                            <div className="font-bold text-rose-800">Cancel Order {tx.onlineOrderId || `#${tx.invoiceNo}`}</div>
                            <input
                              type="text"
                              value={cancelReasonText}
                              onChange={(e) => setCancelReasonText(e.target.value)}
                              placeholder="Reason for cancellation..."
                              className="w-full px-3 py-1.5 rounded-lg border border-rose-200 bg-white text-xs"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setCancellingOrderId(null)}
                                className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold cursor-pointer"
                              >
                                Keep Order
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  cancelCustomerOnlineOrder(tx.id, cancelReasonText);
                                  setCancellingOrderId(null);
                                }}
                                className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
                              >
                                Confirm Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {returningOrderId === tx.id && (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-xs">
                            <div className="font-bold text-amber-900">Request Return / Refund</div>
                            <input
                              type="text"
                              value={returnReasonText}
                              onChange={(e) => setReturnReasonText(e.target.value)}
                              placeholder="Describe issue (damaged, wrong item, expired...)"
                              className="w-full px-3 py-1.5 rounded-lg border border-amber-200 bg-white text-xs"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setReturningOrderId(null)}
                                className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  submitCustomerReturnRequest(tx.id, returnReasonText);
                                  setReturningOrderId(null);
                                }}
                                className="px-3 py-1 rounded-lg bg-amber-600 text-white font-bold cursor-pointer"
                              >
                                Submit Return Request
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {canCancel && cancellingOrderId !== tx.id && (
                            <button
                              type="button"
                              onClick={() => setCancellingOrderId(tx.id)}
                              className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold cursor-pointer"
                            >
                              Cancel Order
                            </button>
                          )}
                          {canReturn && returningOrderId !== tx.id && (
                            <button
                              type="button"
                              onClick={() => setReturningOrderId(tx.id)}
                              className="px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 text-xs font-bold cursor-pointer"
                            >
                              Request Return
                            </button>
                          )}
                          {linkedFinalInvoice && linkedFinalInvoice.balance > 0 && (
                            <button
                              type="button"
                              onClick={() => setPayingTx(linkedFinalInvoice)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              <span>Pay Due</span>
                            </button>
                          )}
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(
                              `Order ${tx.onlineOrderId || `#${tx.invoiceNo}`} at ${company.name} — Status: ${stage}, Total: ₹${tx.totalAmount.toLocaleString('en-IN')}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D] text-xs font-bold inline-flex items-center gap-1"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => onReorderTransaction(tx)}
                            className="px-3 py-1.5 rounded-lg bg-[#EEF4FF] text-[#1D63ED] hover:bg-blue-100 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reorder</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(docForInvoice);
                              setIsInvoicePreviewOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{linkedFinalInvoice ? 'View GST Invoice' : 'View Order Slip'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              exportSingleInvoicePdf(docForInvoice, company);
                              showToast(`Downloaded #${docForInvoice.invoiceNo}`);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SAVED ADDRESSES */}
          {activeSection === 'addresses' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">Saved Delivery Addresses</h2>
                {(currentCustomer.addresses || []).length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">No saved delivery addresses yet.</div>
                ) : (
                  <div className="space-y-3">
                    {currentCustomer.addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
                          addr.isDefault ? 'border-[#1D63ED] bg-blue-50/30' : 'border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{addr.label}</span>
                            {addr.isDefault && (
                              <span className="px-2 py-0.5 rounded bg-[#1D63ED] text-white text-[10px] font-bold">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-700 mt-1">
                            {addr.street}, {addr.area}, {addr.city}, {addr.state} - {addr.pincode}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{addr.phone}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!addr.isDefault && (
                            <button
                              type="button"
                              onClick={() => setDefaultCustomerAddress(addr.id)}
                              className="text-[11px] font-bold text-[#1D63ED] hover:underline cursor-pointer"
                            >
                              Set Default
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteCustomerAddress(addr.id)}
                            aria-label="Delete address"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#1D63ED]" />
                  <span>Add New Address</span>
                </h3>
                <form onSubmit={handleAddAddress} className="space-y-3">
                  <select
                    value={addrLabel}
                    onChange={(e) => setAddrLabel(e.target.value as 'Home' | 'Work' | 'Other')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  >
                    <option value="Home">Home</option>
                    <option value="Work">Work</option>
                    <option value="Other">Other</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={addrStreet}
                    onChange={(e) => setAddrStreet(e.target.value)}
                    placeholder="Flat / House / Street"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  <input
                    type="text"
                    value={addrArea}
                    onChange={(e) => setAddrArea(e.target.value)}
                    placeholder="Area / Landmark"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={addrCity}
                      onChange={(e) => setAddrCity(e.target.value)}
                      placeholder="City"
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={addrPin}
                      onChange={(e) => setAddrPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="PIN Code"
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    value={addrState}
                    onChange={(e) => setAddrState(e.target.value)}
                    placeholder="State"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addrDefault}
                      onChange={(e) => setAddrDefault(e.target.checked)}
                    />
                    <span>Set as default delivery address</span>
                  </label>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-[#1D63ED] hover:bg-[#1552CC] text-white text-xs font-bold cursor-pointer"
                  >
                    Save Address
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* REWARDS & WALLET */}
          {activeSection === 'rewards' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-[#1D63ED] to-[#2563EB] rounded-2xl p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-blue-100">MS Credit Wallet Balance (1 MS Credit = ₹1)</div>
                  <div className="text-3xl font-extrabold mt-1 tabular-nums">{msCreditBalance} Credits</div>
                  <div className="text-xs text-blue-100 mt-1">
                    Earn {serviceAreaConfig.msCreditEarnPercent}% back as MS Credits upon verified OTP delivery
                  </div>
                </div>
                <div className="bg-white/15 rounded-xl px-4 py-3 text-xs">
                  <div className="font-bold">Wallet Cash Value</div>
                  <div className="text-lg font-extrabold tabular-nums">₹{msCreditBalance.toLocaleString('en-IN')}</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-extrabold text-slate-900">MS Credit Transaction History</h3>
                {myMsCreditLedger.length === 0 ? (
                  <div className="text-xs text-slate-500 py-4 text-center">No MS Credit transactions yet. Complete a delivery to earn MS Credits!</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {myMsCreditLedger.map((entry) => (
                      <div key={entry.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-bold text-slate-900">{entry.description}</div>
                          <div className="text-[11px] text-slate-400">{entry.createdAt}</div>
                        </div>
                        <span
                          className={`font-extrabold tabular-nums ${
                            entry.type === 'REDEEM' ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {entry.type === 'REDEEM' ? `-${entry.amount}` : `+${entry.amount}`} MS Cr
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-extrabold text-slate-900">Active Billing &amp; Store Coupons</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {coupons
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 flex flex-col justify-between">
                        <div>
                          <div className="font-mono text-xs font-extrabold text-[#1D63ED]">{c.code}</div>
                          <div className="text-xs font-bold text-slate-900 mt-1">{c.title}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">Min order ₹{c.minOrderValue}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onApplyPromoToCart(c.code)}
                          className="w-full py-2 rounded-lg bg-[#1D63ED] hover:bg-[#1552CC] text-white text-xs font-bold cursor-pointer"
                        >
                          Apply in Cart
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* MEMBERSHIP */}
          {activeSection === 'membership' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 text-[11px] font-bold">
                    Silver Member Active
                  </span>
                  <h2 className="text-lg font-extrabold text-slate-900 mt-2">
                    Business Manager 360 Super-App Membership
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {Math.max(0, 500 - msCreditBalance)} more MS Credits to unlock Gold Tier (Priority Dispatch &amp; Bonus Credits)
                  </p>
                </div>
                <Crown className="w-10 h-10 text-amber-500 shrink-0" />
              </div>

              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((msCreditBalance / 500) * 100))}%` }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-4 rounded-xl border border-slate-200">
                  <div className="font-bold text-slate-900">Free Express Delivery</div>
                  <div className="text-slate-500 mt-1">All baskets above ₹{serviceAreaConfig.freeDeliveryThreshold} qualify automatically.</div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200">
                  <div className="font-bold text-slate-900">Verified GST Tax Invoices</div>
                  <div className="text-slate-500 mt-1">Compliant HSN &amp; CGST/SGST bills issued on Delivery OTP verification.</div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200">
                  <div className="font-bold text-slate-900">MS Credit Wallet</div>
                  <div className="text-slate-500 mt-1">Earn 1 MS Credit = ₹1 on every delivered purchase.</div>
                </div>
              </div>
            </div>
          )}

          {/* GST INVOICES */}
          {activeSection === 'invoices' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">GST Invoices ({filteredInvoices.length})</h2>
                  <p className="text-xs text-slate-500">
                    Pending Dues: <strong className="text-rose-600 tabular-nums">₹{pendingInvoices.reduce((s, t) => s + t.balance, 0).toLocaleString('en-IN')}</strong>
                  </p>
                </div>
                <input
                  type="text"
                  value={invoiceFilter}
                  onChange={(e) => setInvoiceFilter(e.target.value)}
                  placeholder="Search invoice # or status..."
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs w-full sm:w-64 focus:outline-none focus:border-[#1D63ED]"
                />
              </div>

              {filteredInvoices.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">No invoices match your filter.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="py-2.5 px-3">Invoice #</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Payment</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3 text-right">Balance</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredInvoices.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">#{tx.invoiceNo}</td>
                          <td className="py-3 px-3 text-slate-600">{tx.date}</td>
                          <td className="py-3 px-3 text-slate-600">{tx.paymentType}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                tx.status === 'Paid'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {tx.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                            ₹{tx.totalAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-rose-600 tabular-nums">
                            ₹{tx.balance.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap space-x-1.5">
                            {tx.balance > 0 && (
                              <button
                                type="button"
                                onClick={() => setPayingTx(tx)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer"
                              >
                                Pay
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedInvoice(tx);
                                setIsInvoicePreviewOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-bold cursor-pointer"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                exportSingleInvoicePdf(tx, company);
                                showToast(`Downloaded Invoice #${tx.invoiceNo}`);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#1D63ED] text-white font-bold cursor-pointer"
                            >
                              PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* NOTIFICATIONS */}
          {activeSection === 'notifications' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h2 className="text-lg font-extrabold text-slate-900">Notifications</h2>
              {myNotifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">All caught up!</div>
              ) : (
                <div className="space-y-2.5">
                  {myNotifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
                        n.read ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50/40'
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
                          className="text-xs font-bold text-[#1D63ED] hover:underline shrink-0 cursor-pointer"
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

          {/* SETTINGS */}
          {activeSection === 'settings' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 max-w-2xl">
              <h2 className="text-lg font-extrabold text-slate-900">Account &amp; Store Preferences</h2>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-xs text-slate-700">
                <ShieldCheck className="w-5 h-5 text-[#1D63ED] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Online Store Sync Active</div>
                  <p className="mt-1 leading-relaxed text-slate-600">
                    Your orders, GST invoices, wishlist, delivery locations, and support requests sync cleanly with {company.name}&apos;s online store server. All data stays strictly isolated to Customer ID {currentCustomer.customerId}.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <div className="font-bold text-slate-900">Currency & Tax Format</div>
                  <div className="text-slate-500 mt-0.5">INR (₹) · GST HSN Tax Invoice Enabled</div>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold">Active</span>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Pending Invoice Payment Modal */}
      {payingTx && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          onClick={() => setPayingTx(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900">Pay Invoice #{payingTx.invoiceNo}</h3>
            <p className="text-xs text-slate-600">
              Pending balance: <strong className="text-slate-900">₹{payingTx.balance.toLocaleString('en-IN')}</strong>
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as 'UPI' | 'Bank Transfer' | 'Cash')}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
              >
                <option value="UPI">UPI Payment</option>
                <option value="Bank Transfer">Bank Transfer / NEFT</option>
                <option value="Cash">Cash at Store Counter</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayingTx(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  payCustomerPendingInvoice(payingTx.id, payMethod);
                  setPayingTx(null);
                }}
                className="flex-1 py-2 rounded-xl bg-[#1D63ED] text-white text-xs font-bold cursor-pointer"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
