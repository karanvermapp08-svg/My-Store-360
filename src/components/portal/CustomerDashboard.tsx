import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ShoppingCart,
  MapPin,
  Search,
  ChevronDown,
  Heart,
  Headphones,
  User as UserIcon,
  Menu,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Star,
  ArrowLeftRight,
  SlidersHorizontal,
  X,
  RotateCcw,
  Sparkles,
  Package,
  FileText,
  LogOut,
  Plus,
  Minus,
} from 'lucide-react';
import { useVyapar } from '../../context/VyaparContext';
import { Transaction } from '../../types';
import {
  buildMergedStoreProducts,
  CATEGORY_EXPLORE_TILES,
  COMBO_PACKS,
  ComboPack,
  DELIVERY_HUBS,
  DeliveryHub,
  HERO_SLIDES,
  STORE_CATEGORY_NAV,
  StoreCategory,
  StoreProduct,
} from '../../utils/customerStoreCatalog';
import { DeliveryLocationModal } from './customer/DeliveryLocationModal';
import { ProductDetailModal } from './customer/ProductDetailModal';
import { CartEntry, CustomerCartView } from './customer/CustomerCartView';
import { CustomerAccountPortal, CustomerAccountSection } from './customer/CustomerAccountPortal';

type StoreViewMode = 'home' | 'catalog' | 'cart' | 'account';
type SortOption = 'popularity' | 'price-asc' | 'price-desc' | 'discount-desc';

const ALL_FILTER_CATEGORIES: StoreCategory[] = [
  'All Categories',
  'Grocery',
  'Daily Essentials',
  'Dairy Products',
  'Fruits & Vegetables',
  'Food & Beverages',
  'Personal Care',
  'Home & Kitchen',
  'Electronics',
  'Fashion',
  'Household',
  'Combo Packs',
  'Offers',
];

export const CustomerDashboard: React.FC = () => {
  const {
    currentCustomer,
    items: erpItems,
    transactions,
    company,
    setIsLogoutModalOpen,
    placeCustomerOnlineOrder,
    showToast,
  } = useVyapar();

  const customerKey = currentCustomer?.customerId || 'CUST001';

  // Top-level navigation state
  const [viewMode, setViewMode] = useState<StoreViewMode>('home');
  const [accountSection, setAccountSection] = useState<CustomerAccountSection>('wishlist');
  const [activeCategory, setActiveCategory] = useState<StoreCategory>('All Categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(5000);
  const [minDiscountFilter, setMinDiscountFilter] = useState<number>(0);

  // Header Menus & Modals
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [allCatDropdownOpen, setAllCatDropdownOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<StoreProduct | null>(null);
  const [detailCombo, setDetailCombo] = useState<ComboPack | null>(null);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  // Hero carousel
  const [heroIdx, setHeroIdx] = useState(0);

  // Persistent storefront user state (Cart, Wishlist, Recently Viewed, Hub, Promo)
  const [cart, setCart] = useState<CartEntry[]>(() => {
    try {
      const saved = localStorage.getItem(`bm360_cart_${customerKey}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [wishlistIds, setWishlistIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`bm360_wishlist_${customerKey}`);
      return saved ? JSON.parse(saved) : ['sp-apples', 'sp-headphones'];
    } catch {
      return ['sp-apples', 'sp-headphones'];
    }
  });

  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`bm360_recent_${customerKey}`);
      return saved ? JSON.parse(saved) : ['sp-apples', 'sp-basmati', 'sp-headphones'];
    } catch {
      return ['sp-apples', 'sp-basmati', 'sp-headphones'];
    }
  });

  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [appliedPromoCode, setAppliedPromoCode] = useState('');

  const [activeHub, setActiveHub] = useState<DeliveryHub>(() => {
    try {
      const saved = localStorage.getItem(`bm360_hub_${customerKey}`);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DELIVERY_HUBS[0];
  });

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(() => {
    const def = currentCustomer?.addresses?.find((a) => a.isDefault);
    return def ? def.id : null;
  });

  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const catDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(`bm360_cart_${customerKey}`, JSON.stringify(cart));
    } catch {
      // ignore storage quota errors
    }
  }, [cart, customerKey]);

  useEffect(() => {
    try {
      localStorage.setItem(`bm360_wishlist_${customerKey}`, JSON.stringify(wishlistIds));
    } catch {
      // ignore
    }
  }, [wishlistIds, customerKey]);

  useEffect(() => {
    try {
      localStorage.setItem(`bm360_recent_${customerKey}`, JSON.stringify(recentlyViewedIds));
    } catch {
      // ignore
    }
  }, [recentlyViewedIds, customerKey]);

  useEffect(() => {
    try {
      localStorage.setItem(`bm360_hub_${customerKey}`, JSON.stringify(activeHub));
    } catch {
      // ignore
    }
  }, [activeHub, customerKey]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
      if (catDropdownRef.current && !catDropdownRef.current.contains(e.target as Node)) {
        setAllCatDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  if (!currentCustomer) return null;

  // Customer-isolated invoices & points
  const normalizedPhone = currentCustomer.phone.replace(/\D/g, '');
  const scopedInvoices = useMemo(
    () =>
      transactions.filter((t) => {
        if (t.isCancelled || (t.type !== 'Sale' && t.type !== 'Sale Order')) return false;
        const pName = t.partyName.toLowerCase().trim();
        const nameMatch =
          pName === currentCustomer.fullName.toLowerCase().trim() ||
          pName === currentCustomer.linkedPartyName.toLowerCase().trim();
        const txPhone = (t.partyPhone || '').replace(/\D/g, '');
        const phoneMatch = Boolean(normalizedPhone && txPhone && txPhone.endsWith(normalizedPhone.slice(-10)));
        return nameMatch || phoneMatch;
      }),
    [transactions, currentCustomer, normalizedPhone]
  );

  const rewardPoints = useMemo(() => {
    const earned = scopedInvoices.reduce((acc, inv) => acc + Math.floor(inv.totalAmount / 100) * 10, 0);
    return 240 + Math.min(earned, 2000);
  }, [scopedInvoices]);

  const msCreditBalance = currentCustomer.msCreditBalance ?? 0;

  const latestInvoice = scopedInvoices[0] || null;
  const latestOrderLabel = latestInvoice
    ? latestInvoice.onlineOrderId || `BM360-${latestInvoice.invoiceNo}`
    : 'Quick Basket';

  const allProducts = useMemo(() => buildMergedStoreProducts(erpItems), [erpItems]);

  const totalCartCount = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);

  const getCartQty = (id: string) => cart.find((c) => c.id === id)?.qty || 0;

  const handleAddToCart = (id: string) => {
    const prod = allProducts.find((p) => p.id === id);
    const combo = COMBO_PACKS.find((c) => c.id === id);
    const currentQty = getCartQty(id);
    if (prod) {
      if (prod.availableStock <= 0) {
        showToast(`"${prod.name}" is currently out of stock.`);
        return;
      }
      if (currentQty + 1 > prod.availableStock) {
        showToast(`Only ${prod.availableStock} unit(s) available for "${prod.name}".`);
        return;
      }
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.id === id);
      if (existing) {
        return prev.map((c) => (c.id === id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { id, qty: 1 }];
    });
    showToast(`Added "${prod?.name || combo?.title || 'Item'}" to cart`);
  };

  const handleUpdateQty = (id: string, nextQty: number) => {
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((c) => c.id !== id));
      return;
    }
    const prod = allProducts.find((p) => p.id === id);
    if (prod && nextQty > prod.availableStock) {
      showToast(`Only ${prod.availableStock} unit(s) available (${prod.reservedStock} reserved).`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.id === id);
      if (existing) return prev.map((c) => (c.id === id ? { ...c, qty: nextQty } : c));
      return [...prev, { id, qty: nextQty }];
    });
  };

  const handleToggleWishlist = (id: string) => {
    setWishlistIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((w) => w !== id) : [id, ...prev];
      showToast(exists ? 'Removed from Wishlist' : 'Saved to Wishlist');
      return next;
    });
  };

  const handleToggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      if (prev.length >= 3) {
        showToast('Compare up to 3 products at a time');
        return prev;
      }
      return [...prev, id];
    });
  };

  const openProductModal = (prod: StoreProduct) => {
    setDetailCombo(null);
    setDetailProduct(prod);
    setRecentlyViewedIds((prev) => [prod.id, ...prev.filter((id) => id !== prod.id)].slice(0, 5));
  };

  const navigateToCategory = (cat: StoreCategory) => {
    setActiveCategory(cat);
    setViewMode('catalog');
    setAllCatDropdownOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToAccount = (sec: CustomerAccountSection) => {
    setAccountSection(sec);
    setViewMode('account');
    setAccountMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveCategory('All Categories');
    setViewMode('catalog');
  };

  const handleQuickReorder = () => {
    if (!latestInvoice || latestInvoice.items.length === 0) {
      // Populate everyday essentials pack if no item-level history
      handleAddToCart('sp-apples');
      handleAddToCart('sp-tea');
      setViewMode('cart');
      return;
    }
    let matchedCount = 0;
    latestInvoice.items.forEach((line) => {
      const match =
        allProducts.find(
          (p) =>
            p.name.toLowerCase() === line.name.toLowerCase() ||
            (line.hsn && p.hsn === line.hsn)
        ) || allProducts[0];
      if (match) {
        handleUpdateQty(match.id, Math.max(1, line.qty));
        matchedCount++;
      }
    });
    if (matchedCount > 0) {
      showToast(`Re-added ${matchedCount} item(s) from ${latestOrderLabel}`);
      setViewMode('cart');
    }
  };

  const handleReorderTransaction = (tx: Transaction) => {
    if (tx.items.length === 0) {
      handleAddToCart('sp-basmati');
      setViewMode('cart');
      return;
    }
    tx.items.forEach((line) => {
      const match = allProducts.find((p) => p.name.toLowerCase() === line.name.toLowerCase());
      if (match) {
        handleUpdateQty(match.id, getCartQty(match.id) + Math.max(1, line.qty));
      }
    });
    showToast(`Items from #${tx.invoiceNo} added to cart`);
    setViewMode('cart');
  };

  // Filtered & sorted catalog list
  const filteredCatalogProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = allProducts.filter((prod) => {
      if (activeCategory === 'Offers' && prod.discountPercent < 25) return false;
      if (
        activeCategory !== 'All Categories' &&
        activeCategory !== 'Offers' &&
        activeCategory !== 'Combo Packs' &&
        prod.category !== activeCategory
      ) {
        return false;
      }
      if (activeCategory === 'Combo Packs') return false;
      if (prod.price > maxPriceFilter) return false;
      if (prod.discountPercent < minDiscountFilter) return false;
      if (q) {
        const hay = `${prod.name} ${prod.brand} ${prod.category} ${prod.subLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'discount-desc') return b.discountPercent - a.discountPercent;
      return b.reviewCount - a.reviewCount;
    });
  }, [allProducts, activeCategory, maxPriceFilter, minDiscountFilter, searchQuery, sortBy]);

  // Home sections subsets
  const todaysDeals = useMemo(() => allProducts.filter((p) => p.isDeal).slice(0, 5), [allProducts]);
  const recommendedList = useMemo(() => {
    const basmati = allProducts.find((p) => p.id === 'sp-basmati');
    const core = allProducts.filter((p) => p.isRecommended).slice(0, 4);
    return basmati ? [...core, basmati] : allProducts.slice(0, 5);
  }, [allProducts]);
  const groceryDairyList = useMemo(
    () =>
      allProducts
        .filter((p) =>
          ['Fruits & Vegetables', 'Grocery', 'Dairy Products', 'Daily Essentials'].includes(p.category)
        )
        .slice(0, 5),
    [allProducts]
  );
  const trendingList = useMemo(() => allProducts.filter((p) => p.isTrending).slice(0, 5), [allProducts]);
  const recentlyViewedList = useMemo(
    () =>
      recentlyViewedIds
        .map((id) => allProducts.find((p) => p.id === id))
        .filter((p): p is StoreProduct => Boolean(p)),
    [recentlyViewedIds, allProducts]
  );

  const compareProducts = useMemo(
    () => allProducts.filter((p) => compareIds.includes(p.id)),
    [allProducts, compareIds]
  );

  const currentHero = HERO_SLIDES[heroIdx];

  const renderProductCard = (prod: StoreProduct) => {
    const qty = getCartQty(prod.id);
    const wishlisted = wishlistIds.includes(prod.id);
    const compared = compareIds.includes(prod.id);

    return (
      <div
        key={prod.id}
        className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between"
      >
        <div>
          <div
            onClick={() => openProductModal(prod)}
            className="relative bg-slate-50/90 rounded-xl p-2.5 mb-3 h-36 flex items-center justify-center cursor-pointer group"
          >
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-bold">
              {prod.discountPercent}% OFF
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleCompare(prod.id);
              }}
              title="Compare product"
              aria-label={`Compare ${prod.name}`}
              className={`absolute top-2 right-2 w-7 h-7 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                compared
                  ? 'bg-[#1D63ED] border-[#1D63ED] text-white'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-[#1D63ED]'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
            <img
              src={prod.image}
              alt={prod.name}
              referrerPolicy="no-referrer"
              className="h-28 w-full object-contain rounded-lg group-hover:scale-105 transition-transform"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] gap-2">
            <span className="text-slate-500 font-medium truncate">{prod.brand}</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-slate-800 shrink-0 tabular-nums">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {prod.rating.toFixed(1)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => openProductModal(prod)}
            className="text-left w-full mt-1 cursor-pointer"
          >
            <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug hover:text-[#1D63ED] min-h-[2.25rem]">
              {prod.name}
            </h3>
          </button>

          <div className="text-[11px] text-slate-400 mt-0.5">{prod.subLabel}</div>

          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-sm font-extrabold text-slate-900 tabular-nums">
              ₹{prod.price.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-slate-400 line-through tabular-nums">
              ₹{prod.mrp.toLocaleString('en-IN')}
            </span>
          </div>

          <div className={`text-[11px] font-semibold mt-1 ${prod.availableStock > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
            {prod.availableStock > 0
              ? prod.wholesalePrice && prod.minWholesaleQty
                ? `✓ ${prod.availableStock} left · Bulk ₹${prod.wholesalePrice} (${prod.minWholesaleQty}+)`
                : `✓ ${prod.availableStock} in stock`
              : 'Out of Stock'}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          {qty > 0 ? (
            <div className="flex-1 flex items-center justify-between rounded-xl bg-blue-50 border border-blue-200 px-2 py-1">
              <button
                type="button"
                onClick={() => handleUpdateQty(prod.id, qty - 1)}
                aria-label="Decrease quantity"
                className="w-6 h-6 rounded-lg bg-white text-[#1D63ED] font-bold flex items-center justify-center hover:bg-blue-100 cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-xs font-extrabold text-[#1D63ED] tabular-nums">{qty}</span>
              <button
                type="button"
                disabled={qty >= prod.availableStock}
                onClick={() => handleUpdateQty(prod.id, qty + 1)}
                aria-label="Increase quantity"
                className="w-6 h-6 rounded-lg bg-[#1D63ED] disabled:bg-slate-300 text-white font-bold flex items-center justify-center hover:bg-[#1552CC] cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleAddToCart(prod.id)}
              disabled={prod.availableStock <= 0}
              className="flex-1 py-2 px-3 rounded-xl bg-[#1D63ED] hover:bg-[#1552CC] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>{prod.availableStock > 0 ? 'Add to Cart' : 'Out of Stock'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleToggleWishlist(prod.id)}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              wishlisted
                ? 'bg-rose-50 border-rose-200 text-rose-600'
                : 'bg-white border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-rose-500' : ''}`} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#F5F7FA] text-slate-900 font-sans">
      {/* 1. TOP STOREFRONT HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Left: Brand + Location Trigger */}
          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => {
                setViewMode('home');
                setSearchQuery('');
              }}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-[#EEF4FF] border border-blue-100 text-[#1D63ED] flex items-center justify-center shrink-0">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <span className="text-base font-extrabold tracking-tight whitespace-nowrap">
                <span className="text-[#1D63ED]">Business Manager</span>
                <span className="text-[#F97316] ml-1">360</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 text-left transition-colors cursor-pointer max-w-[205px]"
            >
              <MapPin className="w-4 h-4 text-[#1D63ED] shrink-0" />
              <div className="min-w-0 leading-tight">
                <div className="text-[11px] font-bold text-emerald-700 whitespace-nowrap">
                  Delivery in {activeHub.eta}
                </div>
                <div className="text-xs font-semibold text-slate-700 truncate flex items-center gap-1">
                  <span className="truncate">{activeHub.shortLabel}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                </div>
              </div>
            </button>
          </div>

          {/* Center: Live Product Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md hidden sm:flex items-center">
            <div className="flex w-full rounded-xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:border-[#1D63ED] overflow-hidden transition-colors">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for groceries, fresh apples, electronics, cookware..."
                className="flex-1 bg-transparent px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="px-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                aria-label="Search store catalog"
                className="px-4 py-2 bg-[#1D63ED] hover:bg-[#1552CC] text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Right: Customer Account, Wishlist, Cart, Support */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Account Dropdown */}
            <div className="relative" ref={accountDropdownRef}>
              <button
                type="button"
                onClick={() => setAccountMenuOpen((o) => !o)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  viewMode === 'account' && accountSection !== 'wishlist' && accountSection !== 'support'
                    ? 'bg-[#EEF4FF] text-[#1D63ED]'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5 text-slate-600" />
                <span className="max-w-[110px] truncate">{currentCustomer.fullName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {accountMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-2xl border border-slate-200 shadow-xl py-1.5 z-50">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <div className="text-xs font-extrabold text-slate-900 truncate">{currentCustomer.fullName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{currentCustomer.customerId} · MS Credit ₹{msCreditBalance}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToAccount('profile')}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>My Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToAccount('orders')}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Package className="w-3.5 h-3.5 text-slate-400" />
                    <span>My Orders ({scopedInvoices.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToAccount('invoices')}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>GST Invoices</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToAccount('addresses')}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Saved Addresses</span>
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setIsLogoutModalOpen(true);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>

            {/* Wishlist */}
            <button
              type="button"
              onClick={() => navigateToAccount('wishlist')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                viewMode === 'account' && accountSection === 'wishlist'
                  ? 'bg-[#EEF4FF] text-[#1D63ED]'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Heart className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden md:inline">Wishlist</span>
              {wishlistIds.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold tabular-nums leading-none">
                  {wishlistIds.length}
                </span>
              )}
            </button>

            {/* Cart */}
            <button
              type="button"
              onClick={() => setViewMode('cart')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                viewMode === 'cart'
                  ? 'bg-[#EEF4FF] text-[#1D63ED]'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden md:inline">Cart</span>
              {totalCartCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#1D63ED] text-white text-[10px] font-bold tabular-nums leading-none">
                  {totalCartCount}
                </span>
              )}
            </button>

            {/* Support */}
            <button
              type="button"
              onClick={() => navigateToAccount('support')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                viewMode === 'account' && accountSection === 'support'
                  ? 'bg-[#EEF4FF] border border-blue-200 text-[#1D63ED]'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Support</span>
            </button>
          </div>
        </div>

        {/* Mobile Search Strip */}
        <form onSubmit={handleSearchSubmit} className="sm:hidden px-4 pb-3 flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search groceries, dairy, electronics..."
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#1D63ED] text-white text-xs font-bold"
          >
            Go
          </button>
        </form>

        {/* 2. BLUE CATEGORY NAVIGATION BAR */}
        <div className="bg-[#1D63ED] text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-11 flex items-center gap-3">
            <div className="relative shrink-0" ref={catDropdownRef}>
              <button
                type="button"
                onClick={() => setAllCatDropdownOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer"
              >
                <Menu className="w-3.5 h-3.5" />
                <span>All Categories</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {allCatDropdownOpen && (
                <div className="absolute left-0 mt-2 w-52 bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-2xl py-1.5 z-50">
                  {ALL_FILTER_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => navigateToCategory(cat)}
                      className={`w-full px-3.5 py-2 text-left text-xs font-semibold hover:bg-blue-50 hover:text-[#1D63ED] transition-colors cursor-pointer ${
                        activeCategory === cat && viewMode === 'catalog'
                          ? 'bg-blue-50 text-[#1D63ED]'
                          : ''
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0 flex-1">
              {STORE_CATEGORY_NAV.map((cat) => {
                const active = viewMode === 'catalog' && activeCategory === cat;
                const isOffers = cat === 'Offers';
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => navigateToCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'bg-white text-[#1D63ED] font-bold'
                        : isOffers
                        ? 'text-amber-300 hover:bg-white/15 font-bold'
                        : 'text-white/95 hover:bg-white/15'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN BODY */}
      <main className="flex-1">
        {/* 3. ACCOUNT PORTAL VIEW */}
        {viewMode === 'account' && (
          <CustomerAccountPortal
            activeSection={accountSection}
            onChangeSection={setAccountSection}
            wishlistIds={wishlistIds}
            products={allProducts}
            rewardPoints={msCreditBalance}
            onToggleWishlist={handleToggleWishlist}
            onAddToCart={handleAddToCart}
            onReorderTransaction={handleReorderTransaction}
            onApplyPromoToCart={(code) => {
              setAppliedPromoCode(code);
              showToast(`Coupon ${code} applied to cart`);
              setViewMode('cart');
            }}
            onBackToStore={() => setViewMode('home')}
          />
        )}

        {/* 4. CART & CHECKOUT VIEW */}
        {viewMode === 'cart' && (
          <CustomerCartView
            cart={cart}
            products={allProducts}
            addresses={currentCustomer.addresses || []}
            selectedAddressId={selectedAddressId}
            activeHub={activeHub}
            appliedPromoCode={appliedPromoCode}
            company={company}
            onUpdateQty={handleUpdateQty}
            onRemoveItem={(id) => setCart((prev) => prev.filter((c) => c.id !== id))}
            onClearCart={() => setCart([])}
            onApplyPromoCode={setAppliedPromoCode}
            onOpenLocationModal={() => setLocationModalOpen(true)}
            onSelectAddressId={setSelectedAddressId}
            onStartShopping={() => setViewMode('home')}
            onViewMyOrders={() => navigateToAccount('orders')}
            onPlaceOrder={placeCustomerOnlineOrder}
          />
        )}

        {/* 5. STOREFRONT HOME & CATALOG VIEWS */}
        {(viewMode === 'home' || viewMode === 'catalog') && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-8">
            {/* Delivery Location Info Bar (Screenshot 873) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 px-4 py-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#EEF4FF] text-[#1D63ED] flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-slate-900">
                      Delivering to {activeHub.areaName} ({activeHub.pincode})
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="font-bold text-emerald-700 inline-flex items-center gap-1">
                      Express ETA: {activeHub.eta}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                    Served locally by {activeHub.hubName} · Live inventory checked for your PIN code
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleQuickReorder}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Quick Reorder ({latestOrderLabel})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#1D63ED] hover:bg-[#1552CC] text-white text-xs font-bold whitespace-nowrap transition-colors cursor-pointer"
                >
                  Change Location
                </button>
              </div>
            </div>

            {/* STOREFRONT HOME SECTIONS */}
            {viewMode === 'home' && (
              <>
                {/* Hero Banner Carousel */}
                <section className="relative rounded-2xl overflow-hidden shadow-sm border border-slate-200/70">
                  <div
                    className={`bg-gradient-to-r ${currentHero.gradientClass} grid grid-cols-1 md:grid-cols-12 min-h-[260px]`}
                  >
                    <div className="md:col-span-6 p-7 sm:p-10 flex flex-col justify-center text-white relative z-10">
                      <span className="text-xs font-semibold text-white/90">{currentHero.badge}</span>
                      <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight mt-2 max-w-md">
                        {currentHero.title}
                      </h1>
                      <p className="text-xs sm:text-sm text-white/90 mt-2.5 max-w-md leading-relaxed">
                        {currentHero.subtitle}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-6">
                        <button
                          type="button"
                          onClick={() => navigateToCategory(currentHero.targetCategory)}
                          className="px-5 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-extrabold inline-flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer shadow-sm"
                        >
                          <span>{currentHero.ctaLabel}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-3.5 py-2 rounded-full bg-amber-300/25 border border-amber-200/40 text-amber-100 text-xs font-bold whitespace-nowrap">
                          {currentHero.promoChip}
                        </span>
                      </div>
                    </div>

                    <div className="md:col-span-6 relative min-h-[200px] md:min-h-[260px]">
                      <img
                        src={currentHero.image}
                        alt={currentHero.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Prev / Next Controls */}
                  <button
                    type="button"
                    onClick={() => setHeroIdx((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
                    aria-label="Previous hero slide"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow flex items-center justify-center cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeroIdx((i) => (i + 1) % HERO_SLIDES.length)}
                    aria-label="Next hero slide"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow flex items-center justify-center cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {/* Slide dots */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                    {HERO_SLIDES.map((s, idx) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setHeroIdx(idx)}
                        aria-label={`Go to slide ${idx + 1}`}
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${
                          heroIdx === idx ? 'w-6 bg-amber-400' : 'w-2 bg-white/60'
                        }`}
                      />
                    ))}
                  </div>
                </section>

                {/* 10 Category Exploration Tiles (Screenshot 870) */}
                <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                  {CATEGORY_EXPLORE_TILES.map((tile) => (
                    <button
                      key={tile.id}
                      type="button"
                      onClick={() => navigateToCategory(tile.id)}
                      className={`p-3.5 rounded-2xl border ${tile.bgClass} hover:shadow-sm transition-all flex items-center gap-3 text-left cursor-pointer`}
                    >
                      <img
                        src={tile.image}
                        alt={tile.label}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover bg-white border border-slate-100 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-900 truncate">{tile.label}</div>
                        <div className={`text-[11px] font-bold mt-0.5 ${tile.accentText}`}>Explore →</div>
                      </div>
                    </button>
                  ))}
                </section>

                {/* Today's Deals + Vertical Special Offer Card (Screenshots 870-871) */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2.5">
                      <h2 className="text-lg font-extrabold text-slate-900">Today&apos;s Deals</h2>
                      <span className="text-xs font-semibold text-rose-600">· Extra Savings Live</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateToCategory('Offers')}
                      className="text-xs font-bold text-[#1D63ED] hover:underline whitespace-nowrap cursor-pointer"
                    >
                      View All →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {todaysDeals.map((prod) => renderProductCard(prod))}

                    {/* Right Special Offer Vertical Card */}
                    <div className="rounded-2xl bg-gradient-to-b from-amber-50 to-amber-200/80 border border-amber-200 p-4 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <span className="inline-block px-2.5 py-1 rounded-md bg-slate-900 text-white text-[10px] font-bold">
                          Special Offer
                        </span>
                        <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                          Flat 40% OFF on Home Essentials
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Cookware, laundry &amp; kitchen favorites.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateToCategory('Home & Kitchen')}
                        className="mt-4 w-full py-2.5 px-3 rounded-xl bg-[#1D63ED] hover:bg-[#1552CC] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Shop Now</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </section>

                {/* Combo Offers & Value Packs (Screenshot 871) */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                      <Package className="w-5 h-5 text-purple-600" />
                      <span>Combo Offers &amp; Value Packs</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => navigateToCategory('Combo Packs')}
                      className="text-xs font-bold text-[#1D63ED] hover:underline whitespace-nowrap cursor-pointer"
                    >
                      View All Combos →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {COMBO_PACKS.map((combo) => {
                      const qty = getCartQty(combo.id);
                      return (
                        <div
                          key={combo.id}
                          className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row gap-4 items-center"
                        >
                          <img
                            src={combo.image}
                            alt={combo.title}
                            referrerPolicy="no-referrer"
                            className="w-28 h-28 rounded-xl object-contain bg-slate-50 border border-slate-100 p-2 shrink-0"
                          />

                          <div className="flex-1 min-w-0 w-full space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[10px] font-extrabold">
                                {combo.badgeText}
                              </span>
                              <span className="text-xs font-extrabold text-emerald-700 tabular-nums">
                                Save ₹{combo.savings}
                              </span>
                            </div>

                            <h3 className="text-sm font-extrabold text-slate-900">{combo.title}</h3>

                            <div className="flex flex-wrap gap-1.5">
                              {combo.includedChips.map((chip) => (
                                <span
                                  key={chip}
                                  className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium"
                                >
                                  {chip}
                                </span>
                              ))}
                            </div>

                            <div className="flex items-center justify-between gap-3 pt-1">
                              <div className="flex items-baseline gap-2">
                                <span className="text-lg font-extrabold text-slate-900 tabular-nums">
                                  ₹{combo.price.toLocaleString('en-IN')}
                                </span>
                                <span className="text-xs text-slate-400 line-through tabular-nums">
                                  ₹{combo.mrp.toLocaleString('en-IN')}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDetailProduct(null);
                                    setDetailCombo(combo);
                                  }}
                                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                  Details
                                </button>
                                {qty > 0 ? (
                                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQty(combo.id, qty - 1)}
                                      className="text-xs font-bold text-[#1D63ED] cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <span className="text-xs font-extrabold text-[#1D63ED] tabular-nums">{qty}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQty(combo.id, qty + 1)}
                                      className="text-xs font-bold text-[#1D63ED] cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleAddToCart(combo.id)}
                                    className="px-4 py-1.5 rounded-xl bg-[#1D63ED] hover:bg-[#1552CC] text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                                  >
                                    Add Combo
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* 3 Promo Highlight Cards (Screenshot 873) */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => navigateToCategory('Home & Kitchen')}
                    className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-left hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-amber-700 uppercase">Special Offer</span>
                      <span className="px-2 py-0.5 rounded bg-white text-[10px] font-bold text-slate-700">Flat 40% OFF</span>
                    </div>
                    <div className="text-sm font-extrabold text-slate-900 mt-1.5">Flat 40% OFF on Home Essentials</div>
                    <div className="text-xs text-slate-600 mt-0.5">Cookware, laundry &amp; everyday utility packs</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateToCategory('Grocery')}
                    className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-left hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-emerald-700 uppercase">Grocery Deal</span>
                      <span className="px-2 py-0.5 rounded bg-white text-[10px] font-bold text-slate-700">Up to 35% OFF</span>
                    </div>
                    <div className="text-sm font-extrabold text-slate-900 mt-1.5">Fresh Grocery Basket Savings</div>
                    <div className="text-xs text-slate-600 mt-0.5">Extra 10% cashback in Reward Points on staples</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateToAccount('membership')}
                    className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-purple-200 text-left hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-purple-700 uppercase">Membership Perk</span>
                      <span className="px-2 py-0.5 rounded bg-white text-[10px] font-bold text-slate-700">2x Rewards</span>
                    </div>
                    <div className="text-sm font-extrabold text-slate-900 mt-1.5">Gold &amp; Premium Member Free Delivery</div>
                    <div className="text-xs text-slate-600 mt-0.5">Zero shipping charges + 2x reward points on every order</div>
                  </button>
                </section>

                {/* Recommended For You (Screenshot 872) */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#1D63ED]" />
                      <span>Recommended For You</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => navigateToCategory('All Categories')}
                      className="text-xs font-bold text-[#1D63ED] hover:underline whitespace-nowrap cursor-pointer"
                    >
                      Explore All →
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {recommendedList.map((prod) => renderProductCard(prod))}
                  </div>
                </section>

                {/* Grocery, Dairy & Daily Essentials (Screenshot 874) */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-extrabold text-slate-900">
                      Grocery, Dairy &amp; Daily Essentials
                    </h2>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => navigateToCategory('Dairy Products')}
                        className="text-xs font-bold text-slate-600 hover:text-[#1D63ED] cursor-pointer"
                      >
                        Dairy
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateToCategory('Daily Essentials')}
                        className="text-xs font-bold text-[#1D63ED] hover:underline whitespace-nowrap cursor-pointer"
                      >
                        Shop Essentials →
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {groceryDairyList.map((prod) => renderProductCard(prod))}
                  </div>
                </section>

                {/* Trending Near You */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-extrabold text-slate-900">Trending Near You</h2>
                    <button
                      type="button"
                      onClick={() => navigateToCategory('All Categories')}
                      className="text-xs font-bold text-[#1D63ED] hover:underline whitespace-nowrap cursor-pointer"
                    >
                      Explore Catalog →
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {trendingList.map((prod) => renderProductCard(prod))}
                  </div>
                </section>

                {/* Recently Viewed */}
                {recentlyViewedList.length > 0 && (
                  <section className="space-y-4 pb-4">
                    <h2 className="text-lg font-extrabold text-slate-900">Recently Viewed</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                      {recentlyViewedList.map((prod) => renderProductCard(prod))}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* CATEGORY & SEARCH FILTERED CATALOG VIEW (Screenshot 878 backdrop) */}
            {viewMode === 'catalog' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <button
                        type="button"
                        onClick={() => setViewMode('home')}
                        className="hover:text-[#1D63ED] font-semibold cursor-pointer"
                      >
                        Home
                      </button>
                      <span>/</span>
                      <span className="font-bold text-slate-800">{activeCategory}</span>
                    </div>
                    <h1 className="text-xl font-extrabold text-slate-900 mt-1">
                      {searchQuery.trim() ? `Results for "${searchQuery.trim()}"` : activeCategory}
                    </h1>
                    <p className="text-xs text-slate-500">
                      Showing {activeCategory === 'Combo Packs' ? COMBO_PACKS.length : filteredCatalogProducts.length} products
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#1D63ED]"
                    >
                      <option value="popularity">Sort: Popularity</option>
                      <option value="price-asc">Price: Low to High</option>
                      <option value="price-desc">Price: High to Low</option>
                      <option value="discount-desc">Discount: High to Low</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Sidebar Filter */}
                  <aside className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-slate-900 inline-flex items-center gap-1.5">
                        <SlidersHorizontal className="w-4 h-4 text-[#1D63ED]" />
                        <span>Filters</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCategory('All Categories');
                          setSearchQuery('');
                          setMaxPriceFilter(5000);
                          setMinDiscountFilter(0);
                        }}
                        className="text-xs font-bold text-[#1D63ED] hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>

                    {/* Category list */}
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-slate-800 mb-2">Category</div>
                      <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                        {ALL_FILTER_CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setActiveCategory(cat)}
                            className={`w-full px-3 py-1.5 rounded-lg text-left text-xs font-semibold transition-colors cursor-pointer ${
                              activeCategory === cat
                                ? 'bg-[#EEF4FF] text-[#1D63ED] font-bold'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Max Price */}
                    <div className="space-y-2 border-t border-slate-100 pt-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">Max Price</span>
                        <span className="font-extrabold text-[#1D63ED] tabular-nums">
                          ₹{maxPriceFilter.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={100}
                        max={5000}
                        step={50}
                        value={maxPriceFilter}
                        onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
                        className="w-full accent-[#1D63ED]"
                      />
                    </div>

                    {/* Minimum Discount */}
                    <div className="space-y-2 border-t border-slate-100 pt-4">
                      <div className="text-xs font-bold text-slate-800">Minimum Discount</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[0, 15, 25, 35].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setMinDiscountFilter(pct)}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                              minDiscountFilter === pct
                                ? 'border-[#1D63ED] bg-blue-50 text-[#1D63ED]'
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {pct === 0 ? 'Any' : `${pct}%+ OFF`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </aside>

                  {/* Right Product Grid */}
                  <div className="lg:col-span-9 space-y-6">
                    {(activeCategory === 'Combo Packs' || activeCategory === 'Offers' || activeCategory === 'All Categories') && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {COMBO_PACKS.map((combo) => (
                          <div
                            key={combo.id}
                            className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-3 items-center shadow-2xs"
                          >
                            <img
                              src={combo.image}
                              alt={combo.title}
                              referrerPolicy="no-referrer"
                              className="w-20 h-20 rounded-xl object-contain bg-slate-50 p-1.5 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-extrabold text-purple-700">{combo.badgeText}</span>
                              <div className="text-xs font-extrabold text-slate-900 truncate mt-0.5">{combo.title}</div>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-sm font-extrabold text-slate-900 tabular-nums">
                                  ₹{combo.price.toLocaleString('en-IN')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleAddToCart(combo.id)}
                                  className="px-3 py-1.5 rounded-lg bg-[#1D63ED] text-white text-xs font-bold cursor-pointer"
                                >
                                  Add Combo
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeCategory !== 'Combo Packs' && (
                      filteredCatalogProducts.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                          <div className="text-sm font-bold text-slate-800">No matching products found</div>
                          <p className="text-xs text-slate-500">Try clearing filters or searching a different keyword.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCategory('All Categories');
                              setSearchQuery('');
                              setMaxPriceFilter(5000);
                              setMinDiscountFilter(0);
                            }}
                            className="px-4 py-2 rounded-xl bg-[#1D63ED] text-white text-xs font-bold cursor-pointer"
                          >
                            Reset Filters
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {filteredCatalogProducts.map((prod) => renderProductCard(prod))}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* FLOATING COMPARE BAR */}
      {compareProducts.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl px-4 py-2.5 shadow-2xl flex items-center gap-4 border border-slate-700">
          <div className="flex items-center gap-2 text-xs font-bold">
            <ArrowLeftRight className="w-4 h-4 text-blue-400" />
            <span>Compare ({compareProducts.length}/3)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCompareModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#1D63ED] hover:bg-[#1552CC] text-white text-xs font-bold cursor-pointer"
            >
              Compare Now
            </button>
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="text-xs text-slate-300 hover:text-white cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* STOREFRONT FOOTER (Screenshot 875) */}
      <footer className="bg-white border-t border-slate-200 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#1D63ED]">Business Manager 360</span>
            <span>·</span>
            <span>Shopping Super App · Currency INR (₹)</span>
          </div>
          <div className="flex items-center gap-4 font-semibold">
            <button
              type="button"
              onClick={() => navigateToAccount('support')}
              className="hover:text-[#1D63ED] cursor-pointer"
            >
              Customer Support &amp; FAQ
            </button>
            <button
              type="button"
              onClick={() => navigateToAccount('orders')}
              className="hover:text-[#1D63ED] cursor-pointer"
            >
              Track Orders
            </button>
            <button
              type="button"
              onClick={() => navigateToCategory('Offers')}
              className="hover:text-[#1D63ED] cursor-pointer"
            >
              Offers &amp; Coupons
            </button>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      <DeliveryLocationModal
        isOpen={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        activeHub={activeHub}
        savedAddresses={currentCustomer.addresses || []}
        selectedAddressId={selectedAddressId}
        onSelectHub={(hub, addrId) => {
          setActiveHub(hub);
          setSelectedAddressId(addrId ?? null);
          showToast(`Delivery set to ${hub.areaName} (${hub.pincode})`);
        }}
      />

      <ProductDetailModal
        product={detailProduct}
        combo={detailCombo}
        cartQty={detailProduct ? getCartQty(detailProduct.id) : detailCombo ? getCartQty(detailCombo.id) : 0}
        isWishlisted={detailProduct ? wishlistIds.includes(detailProduct.id) : false}
        isCompared={detailProduct ? compareIds.includes(detailProduct.id) : false}
        onClose={() => {
          setDetailProduct(null);
          setDetailCombo(null);
        }}
        onAddToCart={handleAddToCart}
        onUpdateQty={handleUpdateQty}
        onToggleWishlist={handleToggleWishlist}
        onToggleCompare={handleToggleCompare}
      />

      {/* Compare Modal */}
      {compareModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          onClick={() => setCompareModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full p-6 space-y-4 overflow-x-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">Side-by-Side Product Comparison</h3>
              <button
                type="button"
                onClick={() => setCompareModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {compareProducts.map((p) => (
                <div key={p.id} className="p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <img
                    src={p.image}
                    alt={p.name}
                    referrerPolicy="no-referrer"
                    className="h-28 w-full object-contain bg-slate-50 rounded-lg p-2"
                  />
                  <div className="font-bold text-slate-900">{p.name}</div>
                  <div className="text-slate-500">{p.brand} · {p.subLabel}</div>
                  <div className="text-base font-extrabold text-[#1D63ED] tabular-nums">₹{p.price}</div>
                  <div className="text-slate-600">Rating: ★ {p.rating.toFixed(1)} · GST {p.gstRate}%</div>
                  <button
                    type="button"
                    onClick={() => handleAddToCart(p.id)}
                    className="w-full py-2 rounded-lg bg-[#1D63ED] text-white font-bold cursor-pointer"
                  >
                    Add to Cart
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
