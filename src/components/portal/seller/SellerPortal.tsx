import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Store,
  History,
  Package,
  Users,
  FileText,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Search,
  UserPlus,
  RotateCcw,
  Menu,
  X,
  ArrowUpRight,
  Download,
  Edit3,
  Tag,
} from 'lucide-react';
import { useVyapar } from '../../../context/VyaparContext';
import { Item, SellerType, Transaction } from '../../../types';
import { apiClient } from '../../../utils/apiClient';

type SellerPageId =
  | 'dashboard'
  | 'new-sale'
  | 'wholesale-sale'
  | 'retail-sale'
  | 'sales-history'
  | 'products'
  | 'customers'
  | 'invoices'
  | 'reports'
  | 'settings';

interface SellerRouteMeta {
  id: SellerPageId;
  path: string;
  htmlName: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SELLER_ROUTES: SellerRouteMeta[] = [
  { id: 'dashboard', path: '/seller/dashboard', htmlName: 'seller-dashboard.html', label: 'Seller Dashboard', icon: LayoutDashboard },
  { id: 'new-sale', path: '/seller/new-sale', htmlName: 'new-sale.html', label: 'New Sale', icon: ShoppingCart },
  { id: 'wholesale-sale', path: '/seller/wholesale-sale', htmlName: 'wholesale-sale.html', label: 'Wholesale Sale', icon: Boxes },
  { id: 'retail-sale', path: '/seller/retail-sale', htmlName: 'retail-sale.html', label: 'Retail Sale', icon: Store },
  { id: 'sales-history', path: '/seller/sales-history', htmlName: 'sales-history.html', label: 'Sales History', icon: History },
  { id: 'products', path: '/seller/products', htmlName: 'seller-products.html', label: 'Products', icon: Package },
  { id: 'customers', path: '/seller/customers', htmlName: 'seller-customers.html', label: 'Customers', icon: Users },
  { id: 'invoices', path: '/seller/invoices', htmlName: 'seller-invoices.html', label: 'Invoices', icon: FileText },
  { id: 'reports', path: '/seller/reports', htmlName: 'seller-reports.html', label: 'Reports', icon: BarChart3 },
  { id: 'settings', path: '/seller/settings', htmlName: 'seller-settings.html', label: 'Settings', icon: Settings },
];

interface DraftCartLine {
  item: Item;
  qty: number;
  discountPercent: number;
}

export const SellerPortal: React.FC = () => {
  const {
    currentUser,
    company,
    items,
    parties,
    transactions,
    portalNotifications,
    addTransaction,
    addParty,
    getNextFormattedInvoiceNo,
    setSelectedInvoice,
    setIsInvoicePreviewOpen,
    updateProductPricing,
    markPortalNotificationRead,
    exportModuleCsv,
    exportCurrentViewPdf,
    setIsLogoutModalOpen,
    showToast,
  } = useVyapar();

  const sellerType: SellerType = currentUser?.sellerType || 'Both Wholesaler + Retailer';
  const sellerId = currentUser?.employeeId || currentUser?.id || 'SEL001';
  const allowWholesale = sellerType === 'Wholesaler Only' || sellerType === 'Both Wholesaler + Retailer';
  const allowRetail = sellerType === 'Retailer Only' || sellerType === 'Both Wholesaler + Retailer';

  const resolvePageFromUrl = (): SellerPageId => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      const matched = SELLER_ROUTES.find((r) => r.path === p || p.endsWith(`/${r.htmlName}`));
      if (matched) return matched.id;
    }
    return 'dashboard';
  };

  const [activePage, setActivePage] = useState<SellerPageId>(resolvePageFromUrl);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [chartRange, setChartRange] = useState<'7d' | '30d'>('7d');

  // Sale Form State (New Sale / Wholesale Sale / Retail Sale)
  const [selectedPartyName, setSelectedPartyName] = useState('Cash Sale');
  const [saleModeChoice, setSaleModeChoice] = useState<'Wholesale' | 'Retail'>(() =>
    sellerType === 'Wholesaler Only' ? 'Wholesale' : 'Retail'
  );
  const [paymentType, setPaymentType] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Credit'>('Cash');
  const [receivedInput, setReceivedInput] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [cartLines, setCartLines] = useState<DraftCartLine[]>([]);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [saleSuccessTx, setSaleSuccessTx] = useState<Transaction | null>(null);
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);

  // History / Invoices / Products Search & Filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyChannelFilter, setHistoryChannelFilter] = useState<'All' | 'Wholesale' | 'Retail'>('All');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  // Quick Add Customer Modal
  const [addCustModalOpen, setAddCustModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustGstin, setNewCustGstin] = useState('');

  // Edit Product Pricing Modal
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editRetailPrice, setEditRetailPrice] = useState('');
  const [editWholesalePrice, setEditWholesalePrice] = useState('');
  const [editMinWholesaleQty, setEditMinWholesaleQty] = useState('');

  const navigateTo = (pageId: SellerPageId) => {
    setActivePage(pageId);
    setSaleError(null);
    setSaleSuccessTx(null);
    if (pageId === 'wholesale-sale') setSaleModeChoice('Wholesale');
    if (pageId === 'retail-sale') setSaleModeChoice('Retail');
    if (pageId === 'new-sale') {
      setSaleModeChoice(sellerType === 'Wholesaler Only' ? 'Wholesale' : 'Retail');
    }
    setMobileMenuOpen(false);
    const meta = SELLER_ROUTES.find((r) => r.id === pageId);
    if (meta && typeof window !== 'undefined' && window.location.pathname !== meta.path) {
      window.history.pushState({ sellerPage: pageId }, '', meta.path);
    }
  };

  useEffect(() => {
    const onPopState = () => {
      setActivePage(resolvePageFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Derive seller sales & metrics from live database transactions
  const allSales = useMemo(
    () => transactions.filter((t) => t.type === 'Sale' && !t.isCancelled),
    [transactions]
  );

  const classifySaleChannel = (tx: Transaction): 'Wholesale' | 'Retail' => {
    if (tx.saleChannel === 'Wholesale') return 'Wholesale';
    if (tx.saleChannel === 'Retail') return 'Retail';
    if (tx.invoiceNo.includes('WH') || tx.totalAmount >= 5000) return 'Wholesale';
    return 'Retail';
  };

  const sellerSales = useMemo(() => {
    const own = allSales.filter(
      (t) => t.sellerId === sellerId || t.user === currentUser?.name
    );
    return own.length > 0 ? own : allSales;
  }, [allSales, sellerId, currentUser?.name]);

  const metrics = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-GB');
    let todaySales = 0;
    let wholesaleTotal = 0;
    let retailTotal = 0;
    let productsSold = 0;
    let totalRevenue = 0;

    sellerSales.forEach((tx) => {
      totalRevenue += tx.totalAmount || 0;
      if ((tx.date || '').startsWith(todayStr)) {
        todaySales += tx.totalAmount || 0;
      }
      const ch = classifySaleChannel(tx);
      if (ch === 'Wholesale') wholesaleTotal += tx.totalAmount || 0;
      else retailTotal += tx.totalAmount || 0;
      (tx.items || []).forEach((line) => {
        productsSold += line.qty || 0;
      });
    });

    return {
      todaySales: todaySales || totalRevenue,
      totalInvoices: sellerSales.length,
      wholesaleTotal,
      retailTotal,
      productsSold,
      totalRevenue,
    };
  }, [sellerSales]);

  // Top Selling Products
  const topProducts = useMemo(() => {
    const counts: Record<string, { name: string; sold: number; revenue: number }> = {};
    sellerSales.forEach((tx) => {
      (tx.items || []).forEach((line) => {
        if (!counts[line.name]) {
          counts[line.name] = { name: line.name, sold: 0, revenue: 0 };
        }
        counts[line.name].sold += line.qty || 0;
        counts[line.name].revenue += line.amount || 0;
      });
    });
    const list = Object.values(counts).sort((a, b) => b.sold - a.sold).slice(0, 5);
    if (list.length > 0) return list;
    return items.slice(0, 5).map((it, idx) => ({
      name: it.name,
      sold: Math.max(2, 12 - idx * 2),
      revenue: it.salePrice * Math.max(2, 12 - idx * 2),
    }));
  }, [sellerSales, items]);

  // 7-day / 30-day Sales Overview Series
  const chartPoints = useMemo(() => {
    const days = chartRange === '7d' ? 7 : 10;
    const pts: { label: string; amount: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toLocaleDateString('en-GB');
      const label = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
      const daySum = sellerSales
        .filter((t) => (t.date || '').startsWith(dStr))
        .reduce((acc, t) => acc + (t.totalAmount || 0), 0);
      pts.push({ label, amount: daySum });
    }
    const hasAny = pts.some((p) => p.amount > 0);
    if (!hasAny && metrics.totalRevenue > 0) {
      pts[pts.length - 1].amount = metrics.totalRevenue;
    }
    return pts;
  }, [chartRange, sellerSales, metrics.totalRevenue]);

  const unreadNotifs = useMemo(
    () => portalNotifications.filter((n) => !n.read).slice(0, 12),
    [portalNotifications]
  );

  const customers = useMemo(
    () => parties.filter((p) => p.type === 'Customer'),
    [parties]
  );

  // Effective Sale Channel on Sale Builder pages
  const activeSaleMode: 'Wholesale' | 'Retail' =
    activePage === 'wholesale-sale'
      ? 'Wholesale'
      : activePage === 'retail-sale'
      ? 'Retail'
      : sellerType === 'Wholesaler Only'
      ? 'Wholesale'
      : sellerType === 'Retailer Only'
      ? 'Retail'
      : saleModeChoice;

  // Product-specific pricing engine
  const computeLinePricing = (line: DraftCartLine) => {
    const retailPrice = Number(line.item.salePrice || 0);
    const wholesalePrice = Number(line.item.wholesalePrice || Math.round(retailPrice * 0.88));
    const minWhQty = Number(line.item.minWholesaleQty || 5);

    let appliedTier: 'Wholesale' | 'Retail' = 'Retail';
    let appliedUnitPrice = retailPrice;
    let belowMinWarning = false;

    if (sellerType === 'Wholesaler Only') {
      appliedTier = 'Wholesale';
      appliedUnitPrice = wholesalePrice;
      belowMinWarning = line.qty < minWhQty;
    } else if (sellerType === 'Retailer Only') {
      appliedTier = 'Retail';
      appliedUnitPrice = retailPrice;
    } else {
      // Both Wholesaler + Retailer:
      // Always honor product-specific minimum wholesale quantity rule!
      if (activeSaleMode === 'Wholesale') {
        if (line.qty >= minWhQty) {
          appliedTier = 'Wholesale';
          appliedUnitPrice = wholesalePrice;
        } else {
          appliedTier = 'Retail';
          appliedUnitPrice = retailPrice;
          belowMinWarning = true;
        }
      } else {
        // Auto-upgrade to wholesale if qty reaches product's minWholesaleQty on mixed New Sale, or keep Retail if on retail-sale page
        if (activePage !== 'retail-sale' && line.qty >= minWhQty) {
          appliedTier = 'Wholesale';
          appliedUnitPrice = wholesalePrice;
        } else {
          appliedTier = 'Retail';
          appliedUnitPrice = retailPrice;
        }
      }
    }

    const base = appliedUnitPrice * line.qty;
    const discountAmt = base * (line.discountPercent / 100);
    const taxable = base - discountAmt;
    const taxAmt = taxable * ((line.item.taxRate || 0) / 100);
    const lineTotal = Math.round((taxable + taxAmt) * 100) / 100;

    return {
      retailPrice,
      wholesalePrice,
      minWhQty,
      appliedTier,
      appliedUnitPrice,
      belowMinWarning,
      taxable,
      taxAmt,
      lineTotal,
    };
  };

  const cartTotals = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;
    let totalAmount = 0;
    let hasMinQtyViolation = false;
    let hasStockViolation = false;

    cartLines.forEach((line) => {
      const calc = computeLinePricing(line);
      subtotal += calc.taxable;
      taxAmount += calc.taxAmt;
      totalAmount += calc.lineTotal;
      if (sellerType === 'Wholesaler Only' && calc.belowMinWarning) {
        hasMinQtyViolation = true;
      }
      if (line.qty > line.item.stock) {
        hasStockViolation = true;
      }
    });

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      hasMinQtyViolation,
      hasStockViolation,
    };
  }, [cartLines, activeSaleMode, sellerType, activePage]);

  const addProductToCart = (item: Item) => {
    if (item.stock <= 0) {
      showToast(`"${item.name}" is out of stock.`);
      return;
    }
    setSaleError(null);
    setSaleSuccessTx(null);
    const minWhQty = Number(item.minWholesaleQty || 5);
    const defaultQty =
      sellerType === 'Wholesaler Only' || activePage === 'wholesale-sale'
        ? Math.min(item.stock, minWhQty)
        : 1;

    setCartLines((prev) => {
      const existing = prev.find((l) => l.item.id === item.id);
      if (existing) {
        return prev.map((l) =>
          l.item.id === item.id ? { ...l, qty: Math.min(item.stock, l.qty + 1) } : l
        );
      }
      return [...prev, { item, qty: defaultQty, discountPercent: 0 }];
    });
  };

  const updateCartQty = (itemId: string, qty: number) => {
    setSaleError(null);
    setCartLines((prev) =>
      prev.map((l) => (l.item.id === itemId ? { ...l, qty: Math.max(1, qty) } : l))
    );
  };

  const updateCartDiscount = (itemId: string, discountPercent: number) => {
    const safeDisc = Math.max(0, Math.min(50, discountPercent));
    setCartLines((prev) =>
      prev.map((l) => (l.item.id === itemId ? { ...l, discountPercent: safeDisc } : l))
    );
  };

  const removeCartLine = (itemId: string) => {
    setCartLines((prev) => prev.filter((l) => l.item.id !== itemId));
  };

  const handleResetSaleForm = () => {
    setCartLines([]);
    setSelectedPartyName('Cash Sale');
    setPaymentType('Cash');
    setReceivedInput('');
    setNotes('');
    setSaleError(null);
    setSaleSuccessTx(null);
    showToast('Draft sale form cleared (saved records untouched).');
  };

  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingSale) return;
    setSaleError(null);

    if (activeSaleMode === 'Wholesale' && !allowWholesale) {
      setSaleError('Permission Denied: Your Seller Type (Retailer Only) cannot create Wholesale sales.');
      return;
    }
    if (activeSaleMode === 'Retail' && !allowRetail) {
      setSaleError('Permission Denied: Your Seller Type (Wholesaler Only) cannot create Retail sales.');
      return;
    }
    if (cartLines.length === 0) {
      setSaleError('Please add at least one product to the sale.');
      return;
    }

    for (const line of cartLines) {
      if (line.qty <= 0) {
        setSaleError(`Quantity for "${line.item.name}" must be at least 1.`);
        return;
      }
      if (line.qty > line.item.stock) {
        setSaleError(`Insufficient stock for "${line.item.name}". Available: ${line.item.stock} ${line.item.unit}.`);
        return;
      }
      const minWhQty = Number(line.item.minWholesaleQty || 5);
      if (sellerType === 'Wholesaler Only' && line.qty < minWhQty) {
        setSaleError(
          `Minimum wholesale quantity for "${line.item.name}" is ${minWhQty} ${line.item.unit}.`
        );
        return;
      }
    }

    const party = parties.find((p) => p.name === selectedPartyName);
    const totalAmount = cartTotals.totalAmount;
    const received =
      paymentType === 'Credit'
        ? Math.min(totalAmount, Number(receivedInput || 0))
        : receivedInput !== ''
        ? Math.min(totalAmount, Number(receivedInput))
        : totalAmount;
    const balance = Math.max(0, Math.round((totalAmount - received) * 100) / 100);
    const status: Transaction['status'] =
      balance === 0 ? 'Paid' : received > 0 ? 'Partial' : 'Unpaid';

    setIsSubmittingSale(true);
    try {
      // Backend Permission + Product-Specific Wholesale Rule Enforcement
      const validation = await apiClient.validateSellerSale({
        sellerId,
        sellerType,
        saleChannel:
          sellerType === 'Both Wholesaler + Retailer' && activePage !== 'retail-sale'
            ? 'Wholesale'
            : activeSaleMode,
        partyName: selectedPartyName,
        paymentType,
        receivedAmount: received,
        items: cartLines.map((l) => ({
          itemId: l.item.id,
          name: l.item.name,
          qty: l.qty,
          retailPrice: l.item.salePrice,
          wholesalePrice: l.item.wholesalePrice || Math.round(l.item.salePrice * 0.88),
          minWholesaleQty: l.item.minWholesaleQty || 5,
          discountPercent: l.discountPercent,
          taxPercent: l.item.taxRate || 0,
        })),
      });

      const serverLines = validation.validatedTotals.lineResults;
      const resolvedChannel: 'Wholesale' | 'Retail' = serverLines.some(
        (lr) => lr.appliedTier === 'Wholesale'
      )
        ? 'Wholesale'
        : 'Retail';

      const baseInv = getNextFormattedInvoiceNo();
      const uniqueInv = `${baseInv}-${resolvedChannel === 'Wholesale' ? 'WH' : 'RT'}`;

      const invoiceItems = cartLines.map((l, idx) => {
        const lineRes = serverLines[idx];
        const calc = computeLinePricing(l);
        return {
          id: `li-${Date.now()}-${idx}`,
          name: l.item.name,
          hsn: l.item.code,
          qty: l.qty,
          unit: l.item.unit,
          price: lineRes ? lineRes.appliedPrice : calc.appliedUnitPrice,
          discountPercent: l.discountPercent,
          taxPercent: l.item.taxRate || 0,
          amount: lineRes ? lineRes.lineTotal : calc.lineTotal,
        };
      });

      const finalTotal = validation.validatedTotals.totalAmount || totalAmount;
      const finalRec =
        paymentType === 'Credit'
          ? Math.min(finalTotal, Number(receivedInput || 0))
          : receivedInput !== ''
          ? Math.min(finalTotal, Number(receivedInput))
          : finalTotal;
      const finalBal = Math.max(0, Math.round((finalTotal - finalRec) * 100) / 100);

      const created = addTransaction({
        type: 'Sale',
        invoiceNo: uniqueInv,
        date: `${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        dueDate: new Date().toLocaleDateString('en-GB'),
        partyName: selectedPartyName,
        partyPhone: party?.phone || '',
        partyAddress: party?.address || '',
        partyGstin: party?.gstin || '',
        firm: company.name,
        user: currentUser?.name || 'Seller',
        sellerId,
        saleChannel: resolvedChannel,
        paymentType,
        totalAmount: finalTotal,
        receivedAmount: finalRec,
        balance: finalBal,
        status: finalBal === 0 ? 'Paid' : finalRec > 0 ? 'Partial' : 'Unpaid',
        subtotal: validation.validatedTotals.subtotal,
        taxableAmount: validation.validatedTotals.subtotal,
        cgstAmount: Math.round((validation.validatedTotals.taxAmount / 2) * 100) / 100,
        sgstAmount: Math.round((validation.validatedTotals.taxAmount / 2) * 100) / 100,
        items: invoiceItems,
        notes:
          notes.trim() ||
          `Seller ${sellerId} (${sellerType}) • ${resolvedChannel} Sale`,
        source: 'MANUAL',
      });

      if (created) {
        setSaleSuccessTx(created);
        setCartLines([]);
        setReceivedInput('');
        setNotes('');
        showToast(`${resolvedChannel} Invoice #${created.invoiceNo} generated!`);
      } else {
        setSaleError('Permission check blocked transaction creation.');
      }
    } catch (err: any) {
      setSaleError(err.message || 'Server validation rejected this sale.');
    } finally {
      setIsSubmittingSale(false);
    }
  };

  const handleSaveNewCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;
    addParty({
      name: newCustName.trim(),
      phone: newCustPhone.trim(),
      email: newCustEmail.trim(),
      type: 'Customer',
      balance: 0,
      gstin: newCustGstin.trim().toUpperCase(),
      address: newCustAddress.trim() || 'Local Customer',
      state: company.state || 'Karnataka (29)',
    });
    setSelectedPartyName(newCustName.trim());
    setAddCustModalOpen(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustEmail('');
    setNewCustAddress('');
    setNewCustGstin('');
  };

  const handleSavePricingEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const ok = updateProductPricing(editingItem.id, {
      salePrice: Number(editRetailPrice),
      wholesalePrice: Number(editWholesalePrice),
      minWholesaleQty: Math.max(1, Number(editMinWholesaleQty)),
    });
    if (ok) setEditingItem(null);
  };

  const currentRouteMeta = SELLER_ROUTES.find((r) => r.id === activePage) || SELLER_ROUTES[0];

  const isRouteForbidden =
    (activePage === 'wholesale-sale' && !allowWholesale) ||
    (activePage === 'retail-sale' && !allowRetail);

  const filteredProductsForSale = items.filter((it) => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      it.name.toLowerCase().includes(q) ||
      it.code.toLowerCase().includes(q) ||
      it.category.toLowerCase().includes(q)
    );
  });

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return sellerSales.filter((tx) => {
      const ch = classifySaleChannel(tx);
      if (historyChannelFilter !== 'All' && ch !== historyChannelFilter) return false;
      if (!q) return true;
      return (
        tx.invoiceNo.toLowerCase().includes(q) ||
        tx.partyName.toLowerCase().includes(q) ||
        (tx.notes || '').toLowerCase().includes(q)
      );
    });
  }, [sellerSales, historySearch, historyChannelFilter]);

  const sellerBadgeColor =
    sellerType === 'Wholesaler Only'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : sellerType === 'Retailer Only'
      ? 'bg-violet-50 text-violet-700 border-violet-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F1F5FB] text-slate-800 font-sans overflow-hidden select-none">
      {/* Top Dark Navy Header matching My Store Seller Dashboard */}
      <header className="h-16 bg-gradient-to-r from-[#0A152B] via-[#0F2142] to-[#11264D] text-white px-4 lg:px-6 flex items-center justify-between shrink-0 border-b border-white/10 shadow-md z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#EF4444] to-[#B91C1C] flex items-center justify-center font-black text-sm shadow-md border border-white/20">
              MS
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight leading-none">
                My Store
              </div>
              <div className="text-[10px] text-blue-200/80 font-medium mt-0.5">
                Smart Business. Better Growth.
              </div>
            </div>
          </div>
          <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-mono text-blue-200 border border-white/10 ml-3">
            {currentRouteMeta.htmlName}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center px-3.5 py-1 rounded-lg bg-[#1D63ED] text-white text-xs font-bold shadow-sm">
            Seller
          </span>

          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              className="relative p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifs.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EF4444] text-[10px] font-bold flex items-center justify-center">
                  {unreadNotifs.length}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 p-3 z-50">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-900">Notifications</span>
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {unreadNotifs.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">No unread alerts</p>
                  ) : (
                    unreadNotifs.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markPortalNotificationRead(n.id)}
                        className="p-2.5 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-100 cursor-pointer"
                      >
                        <div className="text-xs font-bold text-slate-900">{n.title}</div>
                        <div className="text-[11px] text-slate-600 mt-0.5">{n.message}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-white/15">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-xs font-bold text-white border border-white/30">
              {(currentUser?.name || 'S').charAt(0)}
            </div>
            <div className="leading-tight">
              <div className="text-xs font-bold text-white">{currentUser?.name || 'Rohit Sharma'}</div>
              <div className="text-[10px] text-blue-200 font-mono">Seller ID: {sellerId}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsLogoutModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Navy Sidebar matching Screenshot */}
        <aside
          className={`${
            mobileMenuOpen ? 'fixed inset-y-16 left-0 z-40 flex' : 'hidden lg:flex'
          } w-60 bg-gradient-to-b from-[#0B162C] via-[#0F1F3E] to-[#0A1428] text-slate-200 flex-col justify-between p-3.5 shrink-0 border-r border-white/10 overflow-y-auto`}
        >
          <nav className="space-y-1">
            {SELLER_ROUTES.map((route) => {
              const Icon = route.icon;
              const active = activePage === route.id;
              const disabled =
                (route.id === 'wholesale-sale' && !allowWholesale) ||
                (route.id === 'retail-sale' && !allowRetail);

              return (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => navigateTo(route.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#1D63ED] text-white shadow-lg shadow-blue-900/40'
                      : disabled
                      ? 'text-slate-500 hover:bg-white/5 opacity-60'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{route.label}</span>
                  </span>
                  {disabled && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      Locked
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom Sidebar Promo Card ("Sell More Grow Faster") */}
          <div className="mt-4 rounded-2xl bg-gradient-to-b from-[#172B4D] to-[#0F1C36] border border-blue-400/20 p-3.5 text-center shadow-inner">
            <svg viewBox="0 0 120 74" className="w-24 h-16 mx-auto mb-1.5" aria-hidden="true">
              <rect x="20" y="20" width="80" height="44" rx="6" fill="#1E3A8A" stroke="#60A5FA" strokeWidth="1.5" />
              <rect x="27" y="26" width="66" height="30" rx="3" fill="#0F172A" />
              <path d="M36 48 L48 39 L60 44 L76 31 L86 35" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="86" cy="35" r="3" fill="#34D399" />
              <path d="M12 64 H108" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div className="text-xs font-extrabold text-white leading-tight">
              {sellerType === 'Wholesaler Only'
                ? 'Wholesale Bigger Business'
                : sellerType === 'Retailer Only'
                ? 'Retail Best for Customers'
                : 'Sell More Grow Faster'}
            </div>
            <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#DC2626] text-[9px] font-bold text-white">
              MS My Store
            </div>
          </div>
        </aside>

        {/* Main Content Workspace */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">
          {/* Permission Barrier for Unauthorized Route */}
          {isRouteForbidden && (
            <div className="bg-white rounded-2xl border border-rose-200 p-8 max-w-xl mx-auto mt-8 text-center shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-[#E11D48] flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">Unauthorized Sale Mode</h2>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Your Seller account (<strong>{sellerId}</strong>) is configured as{' '}
                <span className="font-bold text-[#1D63ED]">{sellerType}</span>. Access to{' '}
                <strong>{currentRouteMeta.label}</strong> is restricted by role permissions.
              </p>
              <button
                type="button"
                onClick={() =>
                  navigateTo(allowWholesale ? 'wholesale-sale' : 'retail-sale')
                }
                className="mt-5 px-5 py-2.5 rounded-xl bg-[#1D63ED] hover:bg-blue-700 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                Go to Authorized Sale Page
              </button>
            </div>
          )}

          {/* PAGE 1: SELLER DASHBOARD (seller-dashboard.html) */}
          {!isRouteForbidden && activePage === 'dashboard' && (
            <div className="space-y-5">
              {/* Top Row: Welcome Banner + Seller Type & Quick Actions */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                <div className="xl:col-span-8 bg-gradient-to-r from-[#EFF6FF] via-[#E0EDFF] to-[#DBEAFE] rounded-2xl border border-blue-200/80 p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-5 shadow-xs">
                  <div className="w-24 h-24 rounded-2xl bg-white/90 border border-blue-100 flex items-center justify-center shrink-0 shadow-sm">
                    <svg viewBox="0 0 96 96" className="w-20 h-20" aria-hidden="true">
                      <rect x="14" y="40" width="68" height="40" rx="6" fill="#FFFFFF" stroke="#1D63ED" strokeWidth="2.5" />
                      <path d="M10 40 L20 22 H76 L86 40 Z" fill="#EF4444" />
                      <path d="M26 40 L31 22 M48 40 V22 M70 40 L65 22" stroke="#FFFFFF" strokeWidth="3" />
                      <rect x="38" y="54" width="20" height="26" rx="3" fill="#1D63ED" />
                      <rect x="20" y="50" width="12" height="12" rx="2" fill="#93C5FD" />
                      <rect x="64" y="50" width="12" height="12" rx="2" fill="#93C5FD" />
                    </svg>
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/80 text-[11px] font-bold text-[#1D63ED] border border-blue-200 mb-2">
                      Seller ID: {sellerId} • {sellerType}
                    </div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                      Welcome, {currentUser?.name || 'Rohit Sharma'}
                    </h1>
                    <p className="text-xs text-slate-600 mt-1">
                      Manage your wholesale & retail sales, create GST invoices, and track customer orders in real time.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-2.5">
                      <button
                        type="button"
                        onClick={() => navigateTo('new-sale')}
                        className="px-4 py-2 rounded-xl bg-[#1D63ED] hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Start New Sale</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateTo('products')}
                        className="px-4 py-2 rounded-xl bg-white hover:bg-blue-50 text-slate-800 border border-blue-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Package className="w-3.5 h-3.5 text-[#1D63ED]" />
                        <span>View Product Pricing</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Card: Seller Type + Quick Actions */}
                <div className="xl:col-span-4 space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Seller Type Permission
                    </div>
                    <div className={`px-3.5 py-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-between ${sellerBadgeColor}`}>
                      <span>{sellerType}</span>
                      <span className="text-[10px] font-mono opacity-80">ACTIVE</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                    <div className="text-xs font-bold text-slate-800 mb-2.5">Quick Actions</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => navigateTo('new-sale')}
                        className="p-2.5 rounded-xl bg-[#1D63ED] hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>New Sale</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateTo('invoices')}
                        className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Invoices</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateTo('customers')}
                        className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Customers</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateTo('sales-history')}
                        className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Sales History</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 Summary KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1D63ED] flex items-center justify-center shrink-0">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-semibold">Total Sales</div>
                    <div className="text-xl font-extrabold text-slate-900">
                      ₹{metrics.totalRevenue.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-emerald-600 font-bold mt-0.5">
                      {metrics.productsSold} units sold
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-semibold">Total Invoices</div>
                    <div className="text-xl font-extrabold text-slate-900">{metrics.totalInvoices}</div>
                    <div className="text-[11px] text-emerald-600 font-bold mt-0.5">
                      GST synced records
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-orange-100 p-4 shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                    <Boxes className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-semibold">Wholesale Sales</div>
                    <div className="text-xl font-extrabold text-slate-900">
                      ₹{metrics.wholesaleTotal.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-orange-600 font-bold mt-0.5">
                      {allowWholesale ? 'Bulk tier active' : 'Mode locked'}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-rose-100 p-4 shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-semibold">Retail Sales</div>
                    <div className="text-xl font-extrabold text-slate-900">
                      ₹{metrics.retailTotal.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-rose-600 font-bold mt-0.5">
                      {allowRetail ? 'Counter & direct' : 'Mode locked'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts + Recent Sales + Top Selling Products */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                {/* Sales Overview SVG Chart */}
                <div className="xl:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">Sales Overview</h3>
                      <p className="text-[11px] text-slate-500">Real transaction performance</p>
                    </div>
                    <select
                      value={chartRange}
                      onChange={(e) => setChartRange(e.target.value as '7d' | '30d')}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold bg-slate-50"
                    >
                      <option value="7d">Last 7 Days</option>
                      <option value="30d">Last 10 Days</option>
                    </select>
                  </div>
                  <div className="h-44 flex items-end justify-between gap-2 pt-4">
                    {(() => {
                      const maxVal = Math.max(100, ...chartPoints.map((p) => p.amount));
                      return chartPoints.map((pt, i) => {
                        const pct = Math.max(8, Math.round((pt.amount / maxVal) * 100));
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                            <div className="w-full bg-blue-50 rounded-t-lg h-32 flex items-end p-0.5">
                              <div
                                className="w-full bg-gradient-to-t from-[#1D63ED] to-[#60A5FA] rounded-t-md transition-all"
                                style={{ height: `${pct}%` }}
                                title={`${pt.label}: ₹${pt.amount.toLocaleString('en-IN')}`}
                              />
                            </div>
                            <span className="text-[9px] font-semibold text-slate-500 truncate max-w-full">
                              {pt.label.split(' ')[0]}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Recent Sales Table */}
                <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-extrabold text-slate-900">Recent Sales</h3>
                    <button
                      type="button"
                      onClick={() => navigateTo('sales-history')}
                      className="px-3 py-1 rounded-lg bg-[#1D63ED] text-white text-[11px] font-bold cursor-pointer"
                    >
                      View All
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-500 font-semibold">
                          <th className="py-2 pr-2">Invoice No.</th>
                          <th className="py-2 px-2">Type</th>
                          <th className="py-2 px-2">Amount</th>
                          <th className="py-2 px-2">Status</th>
                          <th className="py-2 pl-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sellerSales.slice(0, 5).map((tx) => {
                          const ch = classifySaleChannel(tx);
                          return (
                            <tr key={tx.id} className="hover:bg-blue-50/40">
                              <td className="py-2.5 pr-2 font-mono font-bold text-slate-900">
                                {tx.invoiceNo}
                              </td>
                              <td className="py-2.5 px-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    ch === 'Wholesale'
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'bg-amber-50 text-amber-700'
                                  }`}
                                >
                                  {ch}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 font-bold text-slate-800">
                                ₹{tx.totalAmount.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    tx.status === 'Paid'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-orange-50 text-orange-700'
                                  }`}
                                >
                                  {tx.status}
                                </span>
                              </td>
                              <td className="py-2.5 pl-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedInvoice(tx);
                                    setIsInvoicePreviewOpen(true);
                                  }}
                                  className="text-[#1D63ED] hover:underline font-bold cursor-pointer"
                                >
                                  Print
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {sellerSales.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              No sales recorded yet. Start your first sale!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top Selling Products */}
                <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-extrabold text-slate-900">Top Selling Products</h3>
                    <button
                      type="button"
                      onClick={() => navigateTo('products')}
                      className="text-[11px] font-bold text-[#1D63ED] hover:underline cursor-pointer"
                    >
                      View All
                    </button>
                  </div>
                  <div className="space-y-3">
                    {topProducts.map((tp, idx) => {
                      const maxSold = Math.max(1, topProducts[0]?.sold || 1);
                      const pct = Math.min(100, Math.round((tp.sold / maxSold) * 100));
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800 truncate pr-2">{tp.name}</span>
                            <span className="text-[11px] font-bold text-slate-500 shrink-0">
                              {tp.sold} sold
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#1D63ED]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Product-wise Minimum Wholesale Qty Info Strip */}
              <div className="rounded-2xl bg-blue-50 border border-blue-200 px-4 py-3 flex items-center justify-between gap-3 text-xs text-blue-900">
                <div className="flex items-center gap-2.5">
                  <Tag className="w-4 h-4 text-[#1D63ED] shrink-0" />
                  <span>
                    {sellerType === 'Wholesaler Only'
                      ? 'Minimum wholesale quantity is applied product-wise. You can sell only in wholesale mode.'
                      : sellerType === 'Retailer Only'
                      ? 'You can only sell at retail prices. Wholesale mode is not available for this account.'
                      : 'Product-wise minimum wholesale quantity is applied automatically. You can sell in both retail and wholesale modes.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('products')}
                  className="shrink-0 font-bold text-[#1D63ED] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Check Product Rules</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* PAGES 2, 3, 4: NEW SALE / WHOLESALE SALE / RETAIL SALE */}
          {!isRouteForbidden &&
            (activePage === 'new-sale' ||
              activePage === 'wholesale-sale' ||
              activePage === 'retail-sale') && (
              <div className="space-y-5">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-extrabold text-slate-900">
                        {currentRouteMeta.label}
                      </h2>
                      <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${sellerBadgeColor}`}>
                        {sellerType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Pricing uses each selected product&apos;s own Retail Price, Wholesale Price, and Minimum Wholesale Quantity.
                    </p>
                  </div>

                  {activePage === 'new-sale' && sellerType === 'Both Wholesaler + Retailer' && (
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setSaleModeChoice('Retail')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                          saleModeChoice === 'Retail'
                            ? 'bg-white text-[#1D63ED] shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        Retail / Auto Tier
                      </button>
                      <button
                        type="button"
                        onClick={() => setSaleModeChoice('Wholesale')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                          saleModeChoice === 'Wholesale'
                            ? 'bg-[#1D63ED] text-white shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        Wholesale Priority
                      </button>
                    </div>
                  )}
                </div>

                {saleError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-[#E11D48]" />
                    <span>{saleError}</span>
                  </div>
                )}

                {saleSuccessTx && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                      <div>
                        <div className="text-sm font-extrabold text-emerald-950">
                          Invoice #{saleSuccessTx.invoiceNo} Saved & Stock Updated
                        </div>
                        <div className="text-xs text-emerald-800">
                          Customer: {saleSuccessTx.partyName} • Channel: {saleSuccessTx.saleChannel} • Total: ₹
                          {saleSuccessTx.totalAmount.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedInvoice(saleSuccessTx);
                        setIsInvoicePreviewOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Preview & Print Invoice</span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                  {/* Left: Product Selector from Live Database */}
                  <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col max-h-[640px]">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="text-sm font-extrabold text-slate-900">Select Products</h3>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {items.length} products
                      </span>
                    </div>
                    <div className="relative mb-3">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={productQuery}
                        onChange={(e) => setProductQuery(e.target.value)}
                        placeholder="Search by product name, SKU, category..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#1D63ED]"
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {filteredProductsForSale.map((item) => {
                        const whPrice = item.wholesalePrice || Math.round(item.salePrice * 0.88);
                        const minWhQty = item.minWholesaleQty || 5;
                        return (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                {item.name}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                                <span>Retail: ₹{item.salePrice}</span>
                                {allowWholesale && (
                                  <span className="text-[#1D63ED] font-semibold">
                                    Wholesale: ₹{whPrice} (Min {minWhQty} {item.unit})
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
                                Stock:{' '}
                                <span
                                  className={
                                    item.stock <= (item.minStockAlert || 5)
                                      ? 'text-rose-600 font-bold'
                                      : 'text-emerald-700 font-bold'
                                  }
                                >
                                  {item.stock} {item.unit}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={item.stock <= 0}
                              onClick={() => addProductToCart(item)}
                              className="px-3 py-1.5 rounded-lg bg-[#1D63ED] hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold shrink-0 cursor-pointer"
                            >
                              + Add
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: Billing & Pricing Rules Form */}
                  <form
                    onSubmit={handleSubmitSale}
                    className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-slate-700">Customer *</label>
                          <button
                            type="button"
                            onClick={() => setAddCustModalOpen(true)}
                            className="text-[11px] font-bold text-[#1D63ED] hover:underline cursor-pointer"
                          >
                            + Add Customer
                          </button>
                        </div>
                        <select
                          value={selectedPartyName}
                          onChange={(e) => setSelectedPartyName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-semibold"
                        >
                          {customers.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name} {c.phone ? `(${c.phone})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Payment Mode
                        </label>
                        <select
                          value={paymentType}
                          onChange={(e) => setPaymentType(e.target.value as any)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-semibold"
                        >
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Credit">Credit (Udhaar)</option>
                        </select>
                      </div>
                    </div>

                    {/* Cart Table with Per-Product Min Wholesale Quantity Rules */}
                    <div className="border border-slate-200 rounded-xl overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                          <tr>
                            <th className="py-2.5 px-3">Product & Min Qty</th>
                            <th className="py-2.5 px-2">Qty</th>
                            <th className="py-2.5 px-2">Tier</th>
                            <th className="py-2.5 px-2">Rate</th>
                            <th className="py-2.5 px-2">Disc %</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                            <th className="py-2.5 px-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {cartLines.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-10 text-center text-slate-400">
                                Select products from the left panel to build this invoice.
                              </td>
                            </tr>
                          ) : (
                            cartLines.map((line) => {
                              const calc = computeLinePricing(line);
                              return (
                                <tr key={line.item.id}>
                                  <td className="py-2.5 px-3">
                                    <div className="font-bold text-slate-900">{line.item.name}</div>
                                    <div className="text-[10px] text-slate-500">
                                      Min Wholesale: <strong>{calc.minWhQty}</strong> {line.item.unit} • Stock:{' '}
                                      {line.item.stock}
                                    </div>
                                    {calc.belowMinWarning && (
                                      <div className="text-[10px] text-amber-700 font-semibold mt-0.5 flex items-center gap-1.5">
                                        <span>
                                          Below min wholesale qty ({calc.minWhQty})
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => updateCartQty(line.item.id, calc.minWhQty)}
                                          className="underline text-[#1D63ED] cursor-pointer"
                                        >
                                          Set {calc.minWhQty}
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2">
                                    <div className="inline-flex items-center border border-slate-200 rounded-lg bg-white">
                                      <button
                                        type="button"
                                        onClick={() => updateCartQty(line.item.id, line.qty - 1)}
                                        className="p-1 hover:bg-slate-100 cursor-pointer"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </button>
                                      <input
                                        type="number"
                                        min={1}
                                        value={line.qty}
                                        onChange={(e) =>
                                          updateCartQty(line.item.id, Number(e.target.value) || 1)
                                        }
                                        className="w-11 text-center text-xs font-bold focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => updateCartQty(line.item.id, line.qty + 1)}
                                        className="p-1 hover:bg-slate-100 cursor-pointer"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-2">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        calc.appliedTier === 'Wholesale'
                                          ? 'bg-blue-50 text-blue-700'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      {calc.appliedTier}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-2 font-bold">
                                    ₹{calc.appliedUnitPrice.toLocaleString('en-IN')}
                                  </td>
                                  <td className="py-2.5 px-2">
                                    <input
                                      type="number"
                                      min={0}
                                      max={50}
                                      value={line.discountPercent}
                                      onChange={(e) =>
                                        updateCartDiscount(line.item.id, Number(e.target.value) || 0)
                                      }
                                      className="w-12 px-1.5 py-1 rounded border border-slate-200 text-xs text-center"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                                    ₹{calc.lineTotal.toLocaleString('en-IN')}
                                  </td>
                                  <td className="py-2.5 px-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => removeCartLine(line.item.id)}
                                      className="text-rose-500 hover:text-rose-700 cursor-pointer"
                                      title="Remove line"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Received Amount (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={receivedInput}
                          onChange={(e) => setReceivedInput(e.target.value)}
                          placeholder={
                            paymentType === 'Credit'
                              ? '0 (Credit invoice)'
                              : `${cartTotals.totalAmount}`
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Invoice Notes
                        </label>
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Optional delivery or batch note..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                        />
                      </div>
                    </div>

                    <div className="bg-blue-50/70 rounded-xl border border-blue-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1 text-xs">
                        <div className="text-slate-600">
                          Taxable Subtotal:{' '}
                          <span className="font-bold text-slate-900">
                            ₹{cartTotals.subtotal.toLocaleString('en-IN')}
                          </span>{' '}
                          • GST:{' '}
                          <span className="font-bold text-slate-900">
                            ₹{cartTotals.taxAmount.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="text-base font-extrabold text-[#1D63ED]">
                          Grand Total: ₹{cartTotals.totalAmount.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleResetSaleForm}
                          className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Draft</span>
                        </button>
                        <button
                          type="submit"
                          disabled={
                            isSubmittingSale ||
                            cartLines.length === 0 ||
                            cartTotals.hasMinQtyViolation ||
                            cartTotals.hasStockViolation
                          }
                          className="px-5 py-2.5 rounded-xl bg-[#1D63ED] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm cursor-pointer"
                        >
                          {isSubmittingSale ? 'Validating & Saving...' : 'Generate Invoice'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}

          {/* PAGE 5: SALES HISTORY (sales-history.html) */}
          {activePage === 'sales-history' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Sales History</h2>
                  <p className="text-xs text-slate-500">
                    Complete chronological log of Wholesale and Retail transactions.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder="Search invoice or customer..."
                      className="pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>
                  {(['All', 'Wholesale', 'Retail'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setHistoryChannelFilter(f)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                        historyChannelFilter === f
                          ? 'bg-[#1D63ED] text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Invoice No.</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Mode</th>
                      <th className="py-2.5 px-3">Payment</th>
                      <th className="py-2.5 px-3">Total</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistory.map((tx) => {
                      const ch = classifySaleChannel(tx);
                      return (
                        <tr key={tx.id} className="hover:bg-blue-50/40">
                          <td className="py-2.5 px-3 font-mono font-bold">{tx.invoiceNo}</td>
                          <td className="py-2.5 px-3 text-slate-500">{tx.date}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{tx.partyName}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                ch === 'Wholesale'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {ch}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">{tx.paymentType}</td>
                          <td className="py-2.5 px-3 font-bold">
                            ₹{tx.totalAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                tx.status === 'Paid'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-orange-50 text-orange-700'
                              }`}
                            >
                              {tx.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedInvoice(tx);
                                setIsInvoicePreviewOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#1D63ED] font-bold hover:bg-blue-100 cursor-pointer"
                            >
                              View / Print
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PAGE 6: PRODUCTS (seller-products.html) */}
          {activePage === 'products' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    Products & Tier Pricing Rules
                  </h2>
                  <p className="text-xs text-slate-500">
                    Each product defines its own Retail Price, Wholesale Price, and Minimum Wholesale Quantity.
                  </p>
                </div>
                <div className="relative w-full md:w-72">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Filter products..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Retail Price</th>
                      <th className="py-2.5 px-3">Wholesale Price</th>
                      <th className="py-2.5 px-3">Min Wholesale Qty</th>
                      <th className="py-2.5 px-3">Stock</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items
                      .filter(
                        (it) =>
                          !catalogSearch.trim() ||
                          it.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                          it.code.toLowerCase().includes(catalogSearch.toLowerCase())
                      )
                      .map((it) => {
                        const wh = it.wholesalePrice || Math.round(it.salePrice * 0.88);
                        const minWh = it.minWholesaleQty || 5;
                        return (
                          <tr key={it.id} className="hover:bg-blue-50/40">
                            <td className="py-2.5 px-3 font-mono text-slate-500">{it.code}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{it.name}</td>
                            <td className="py-2.5 px-3">{it.category}</td>
                            <td className="py-2.5 px-3 font-bold">₹{it.salePrice}</td>
                            <td className="py-2.5 px-3 font-bold text-[#1D63ED]">₹{wh}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-[#1D63ED] font-bold">
                                {minWh} {it.unit}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold">
                              {it.stock} {it.unit}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItem(it);
                                  setEditRetailPrice(String(it.salePrice));
                                  setEditWholesalePrice(String(wh));
                                  setEditMinWholesaleQty(String(minWh));
                                }}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit Tier</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PAGE 7: CUSTOMERS (seller-customers.html) */}
          {activePage === 'customers' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Customers Directory</h2>
                  <p className="text-xs text-slate-500">
                    Manage wholesale & retail buyer accounts synced with central ledger.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search customer name or phone..."
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setAddCustModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-[#1D63ED] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add Customer</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {customers
                  .filter(
                    (c) =>
                      !customerSearch.trim() ||
                      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                      (c.phone || '').includes(customerSearch)
                  )
                  .map((c) => {
                    const custOrders = sellerSales.filter((tx) => tx.partyName === c.name);
                    const totalSpent = custOrders.reduce((s, tx) => s + tx.totalAmount, 0);
                    return (
                      <div
                        key={c.id}
                        className="p-4 rounded-2xl border border-slate-200 hover:border-blue-300 bg-slate-50/40 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-extrabold text-slate-900">{c.name}</div>
                          <span className="text-[11px] font-bold text-[#1D63ED]">
                            {custOrders.length} orders
                          </span>
                        </div>
                        <div className="text-xs text-slate-600">
                          {c.phone || 'No phone'} • {c.email || 'No email'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {c.address || 'Local Market'}
                        </div>
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                          <span>
                            Spent: <strong>₹{totalSpent.toLocaleString('en-IN')}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPartyName(c.name);
                              navigateTo('new-sale');
                            }}
                            className="font-bold text-[#1D63ED] hover:underline cursor-pointer"
                          >
                            Bill Now →
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* PAGE 8: INVOICES (seller-invoices.html) */}
          {activePage === 'invoices' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Invoices & Printing</h2>
                  <p className="text-xs text-slate-500">
                    Open GST Tax Invoices, Thermal receipts, and print copies.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('new-sale')}
                  className="px-4 py-2 rounded-xl bg-[#1D63ED] text-white text-xs font-bold cursor-pointer"
                >
                  + Create Invoice
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sellerSales.map((tx) => {
                  const ch = classifySaleChannel(tx);
                  return (
                    <div
                      key={tx.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-white hover:shadow-md transition-shadow space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-extrabold text-slate-900">
                          {tx.invoiceNo}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ch === 'Wholesale'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {ch}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{tx.partyName}</div>
                        <div className="text-[11px] text-slate-500">{tx.date}</div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div>
                          <div className="text-base font-extrabold text-slate-900">
                            ₹{tx.totalAmount.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10px] font-semibold text-slate-500">
                            {tx.paymentType} • {tx.status}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoice(tx);
                            setIsInvoicePreviewOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#1D63ED] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PAGE 9: REPORTS (seller-reports.html) */}
          {activePage === 'reports' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Seller Analytics & Reports</h2>
                  <p className="text-xs text-slate-500">
                    Wholesale vs Retail revenue split and exportable ledger summaries.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportModuleCsv('sales')}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#1D63ED]" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCurrentViewPdf()}
                    className="px-3.5 py-2 rounded-xl bg-[#1D63ED] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Report</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500">Total Revenue</div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">
                    ₹{metrics.totalRevenue.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500">Wholesale Share</div>
                  <div className="text-2xl font-extrabold text-[#1D63ED] mt-1">
                    ₹{metrics.wholesaleTotal.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500">Retail Share</div>
                  <div className="text-2xl font-extrabold text-amber-600 mt-1">
                    ₹{metrics.retailTotal.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PAGE 10: SETTINGS (seller-settings.html) */}
          {activePage === 'settings' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl shadow-xs space-y-4">
              <h2 className="text-lg font-extrabold text-slate-900">Seller Account Settings</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 font-semibold">Seller Name</div>
                  <div className="font-bold text-slate-900 mt-0.5">{currentUser?.name}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 font-semibold">Seller ID</div>
                  <div className="font-mono font-bold text-[#1D63ED] mt-0.5">{sellerId}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 font-semibold">Assigned Seller Type</div>
                  <div className="font-bold text-slate-900 mt-0.5">{sellerType}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 font-semibold">Store / GSTIN</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {company.name} ({company.gstin})
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Seller Type permissions are governed centrally by the Store Administrator in Customer &amp; Staff Management.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Add Customer Modal */}
      {addCustModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveNewCustomer}
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">Add New Customer</h3>
              <button
                type="button"
                onClick={() => setAddCustModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              required
              value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
              placeholder="Customer / Business Name *"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
            <input
              type="text"
              value={newCustPhone}
              onChange={(e) => setNewCustPhone(e.target.value)}
              placeholder="Phone Number"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
            <input
              type="email"
              value={newCustEmail}
              onChange={(e) => setNewCustEmail(e.target.value)}
              placeholder="Email Address"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
            <input
              type="text"
              value={newCustGstin}
              onChange={(e) => setNewCustGstin(e.target.value)}
              placeholder="GSTIN (Optional)"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs uppercase"
            />
            <input
              type="text"
              value={newCustAddress}
              onChange={(e) => setNewCustAddress(e.target.value)}
              placeholder="Billing Address"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddCustModalOpen(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#1D63ED] text-white text-xs font-bold cursor-pointer"
              >
                Save Customer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Product Pricing / Min Wholesale Qty Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePricingEdit}
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                Edit Pricing — {editingItem.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Retail Price (₹)</label>
              <input
                type="number"
                required
                min={1}
                value={editRetailPrice}
                onChange={(e) => setEditRetailPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Wholesale Price (₹)</label>
              <input
                type="number"
                required
                min={1}
                value={editWholesalePrice}
                onChange={(e) => setEditWholesalePrice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Product Minimum Wholesale Qty ({editingItem.unit})
              </label>
              <input
                type="number"
                required
                min={1}
                value={editMinWholesaleQty}
                onChange={(e) => setEditMinWholesaleQty(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#1D63ED] text-white text-xs font-bold cursor-pointer"
              >
                Update Rules
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
