import heroKitchenCookwareImg from '../assets/images/hero_kitchen_cookware_1794743580494.jpg';
import prodDairyMilkImg from '../assets/images/prod_dairy_milk_1794743582974.jpg';
import prodDetergentPackImg from '../assets/images/prod_detergent_pack_1794743580923.jpg';
import prodGroceryComboImg from '../assets/images/prod_grocery_combo_1794743582363.jpg';
import prodHeadphonesImg from '../assets/images/prod_headphones_1794743581807.jpg';
import prodNoodlesPackImg from '../assets/images/prod_noodles_pack_1794743582392.jpg';
import prodRedApplesImg from '../assets/images/prod_red_apples_1794743580376.jpg';
import prodSoapBarImg from '../assets/images/prod_soap_bar_1794743582257.jpg';
import prodTeaPackImg from '../assets/images/prod_tea_pack_1794743581343.jpg';
import prodTshirtFashionImg from '../assets/images/prod_tshirt_fashion_1794743582710.jpg';
import { Item } from '../types';

export type StoreCategory =
  | 'All Categories'
  | 'Grocery'
  | 'Daily Essentials'
  | 'Dairy Products'
  | 'Fruits & Vegetables'
  | 'Food & Beverages'
  | 'Personal Care'
  | 'Home & Kitchen'
  | 'Combo Packs'
  | 'Electronics'
  | 'Fashion'
  | 'Household'
  | 'Offers';

export interface StoreCategoryTile {
  id: Exclude<StoreCategory, 'All Categories' | 'Offers' | 'Combo Packs'>;
  label: string;
  image: string;
  bgClass: string;
  accentText: string;
}

export interface StoreProduct {
  id: string;
  linkedItemId: string;
  brand: string;
  name: string;
  category: Exclude<StoreCategory, 'All Categories' | 'Offers'>;
  subLabel: string;
  price: number;
  wholesalePrice?: number;
  minWholesaleQty?: number;
  mrp: number;
  discountPercent: number;
  rating: number;
  reviewCount: number;
  stock: number;
  reservedStock: number;
  availableStock: number;
  gstRate: number;
  hsn: string;
  image: string;
  isDeal?: boolean;
  isRecommended?: boolean;
  isBestSeller?: boolean;
  isTrending?: boolean;
  description: string;
  highlights: string[];
}

export interface ComboPack {
  id: string;
  badgeText: string;
  title: string;
  includedChips: string[];
  price: number;
  mrp: number;
  savings: number;
  image: string;
  gstRate: number;
  hsn: string;
  rating: number;
  description: string;
  category: 'Combo Packs';
}

export interface DeliveryHub {
  id: string;
  areaName: string;
  shortLabel: string;
  cityState: string;
  pincode: string;
  eta: string;
  hubName: string;
  lat: number;
  lng: number;
}

export interface HeroSlide {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  promoChip: string;
  targetCategory: StoreCategory;
  image: string;
  gradientClass: string;
}

export interface PromoCoupon {
  code: string;
  title: string;
  description: string;
  minOrder: number;
  discountType: 'percent' | 'flat';
  discountValue: number;
  maxDiscount?: number;
}

export interface CustomerFaqItem {
  id: string;
  question: string;
  answer: string;
}

export const STORE_MEDIA = {
  heroKitchenCookware: heroKitchenCookwareImg,
  dairyMilk: prodDairyMilkImg,
  detergentPack: prodDetergentPackImg,
  groceryCombo: prodGroceryComboImg,
  headphones: prodHeadphonesImg,
  noodlesPack: prodNoodlesPackImg,
  redApples: prodRedApplesImg,
  soapBar: prodSoapBarImg,
  teaPack: prodTeaPackImg,
  tshirtFashion: prodTshirtFashionImg,
};

export const STORE_CATEGORY_NAV: StoreCategory[] = [
  'Grocery',
  'Daily Essentials',
  'Dairy Products',
  'Fruits & Vegetables',
  'Food & Beverages',
  'Personal Care',
  'Home & Kitchen',
  'Combo Packs',
  'Offers',
];

export const CATEGORY_EXPLORE_TILES: StoreCategoryTile[] = [
  {
    id: 'Grocery',
    label: 'Grocery',
    image: prodGroceryComboImg,
    bgClass: 'bg-[#F0FAF4] border-emerald-100',
    accentText: 'text-emerald-700',
  },
  {
    id: 'Daily Essentials',
    label: 'Daily Essentials',
    image: prodDetergentPackImg,
    bgClass: 'bg-[#F0FAF4] border-emerald-100',
    accentText: 'text-emerald-700',
  },
  {
    id: 'Fruits & Vegetables',
    label: 'Fruits & Vegetables',
    image: prodRedApplesImg,
    bgClass: 'bg-[#ECFDF5] border-emerald-100',
    accentText: 'text-emerald-700',
  },
  {
    id: 'Dairy Products',
    label: 'Dairy Products',
    image: prodDairyMilkImg,
    bgClass: 'bg-[#EFF6FF] border-blue-100',
    accentText: 'text-blue-700',
  },
  {
    id: 'Food & Beverages',
    label: 'Food & Beverages',
    image: prodTeaPackImg,
    bgClass: 'bg-[#FFF5EE] border-orange-100',
    accentText: 'text-orange-700',
  },
  {
    id: 'Personal Care',
    label: 'Personal Care',
    image: prodSoapBarImg,
    bgClass: 'bg-[#F5F3FF] border-purple-100',
    accentText: 'text-purple-700',
  },
  {
    id: 'Home & Kitchen',
    label: 'Home & Kitchen',
    image: heroKitchenCookwareImg,
    bgClass: 'bg-[#FFF7ED] border-amber-100',
    accentText: 'text-amber-700',
  },
  {
    id: 'Electronics',
    label: 'Electronics',
    image: prodHeadphonesImg,
    bgClass: 'bg-[#EFF6FF] border-blue-100',
    accentText: 'text-blue-700',
  },
  {
    id: 'Fashion',
    label: 'Fashion',
    image: prodTshirtFashionImg,
    bgClass: 'bg-[#FDF2F8] border-pink-100',
    accentText: 'text-pink-700',
  },
  {
    id: 'Household',
    label: 'Household',
    image: prodDetergentPackImg,
    bgClass: 'bg-[#EFF6FF] border-sky-100',
    accentText: 'text-sky-700',
  },
];

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'hero-cookware',
    badge: 'Home & Kitchen Special',
    title: 'Chef-Grade Cookware & Home Care',
    subtitle: 'Stock up on durable stainless cookware and eco-friendly home essentials.',
    ctaLabel: 'Shop Home & Kitchen',
    promoChip: 'Flat 40% OFF',
    targetCategory: 'Home & Kitchen',
    image: heroKitchenCookwareImg,
    gradientClass: 'from-[#EA580C] via-[#F97316] to-[#FB923C]',
  },
  {
    id: 'hero-grocery',
    badge: 'Monthly Ration Savings',
    title: 'Fresh Harvest & Kirana Essentials',
    subtitle: 'Farm-sourced fruits, aged basmati staples, and fresh A2 dairy delivered in minutes.',
    ctaLabel: 'Explore Grocery',
    promoChip: 'Up to 35% OFF',
    targetCategory: 'Grocery',
    image: prodGroceryComboImg,
    gradientClass: 'from-[#1D4ED8] via-[#2563EB] to-[#3B82F6]',
  },
  {
    id: 'hero-electronics',
    badge: 'Smart Audio & Lifestyle',
    title: 'StudioPro Wireless & Home Utility',
    subtitle: 'Crisp active noise cancellation and everyday cotton essentials with GST invoices.',
    ctaLabel: 'Shop Electronics',
    promoChip: 'Save ₹2,000',
    targetCategory: 'Electronics',
    image: prodHeadphonesImg,
    gradientClass: 'from-[#0F766E] via-[#0D9488] to-[#14B8A6]',
  },
];

export const CURATED_STORE_PRODUCTS: Omit<StoreProduct, 'linkedItemId' | 'reservedStock' | 'availableStock'>[] = [
  {
    id: 'sp-apples',
    brand: 'Himalayan Harvest',
    name: 'Fresh Kashmiri Red Apples',
    category: 'Fruits & Vegetables',
    subLabel: '1 kg',
    price: 120,
    mrp: 150,
    discountPercent: 20,
    rating: 4.7,
    reviewCount: 428,
    stock: 64,
    gstRate: 0,
    hsn: '0808',
    image: prodRedApplesImg,
    isDeal: true,
    isRecommended: true,
    isBestSeller: true,
    isTrending: true,
    description: 'Crisp, naturally sweet hand-picked orchard red apples packed in breathable cushioned trays.',
    highlights: ['Cold-chain orchard freshness', 'Zero artificial wax', 'GST Exempt Fresh Produce'],
  },
  {
    id: 'sp-tea',
    brand: 'TeaCraft India',
    name: 'Assam Gold Leaf CTC Tea',
    category: 'Food & Beverages',
    subLabel: '500 g',
    price: 195,
    mrp: 300,
    discountPercent: 35,
    rating: 4.8,
    reviewCount: 612,
    stock: 48,
    gstRate: 5,
    hsn: '0902',
    image: prodTeaPackImg,
    isDeal: true,
    isRecommended: true,
    isBestSeller: true,
    description: 'Single-origin upper Assam CTC granules crafted for rich brisk colour and malty morning chai aroma.',
    highlights: ['Strong brisk liquor', 'Airtight aroma lock pouch', '5% GST Included'],
  },
  {
    id: 'sp-detergent',
    brand: 'CleanPro',
    name: 'Active Blue Matic Detergent Powder',
    category: 'Household',
    subLabel: '1 kg',
    price: 210,
    mrp: 280,
    discountPercent: 25,
    rating: 4.6,
    reviewCount: 389,
    stock: 82,
    gstRate: 18,
    hsn: '3402',
    image: prodDetergentPackImg,
    isDeal: true,
    isBestSeller: true,
    isTrending: true,
    description: 'Low-foam high-efficiency detergent formula that lifts stubborn collar and oil stains in one wash.',
    highlights: ['Safe for top & front load washers', 'Fresh floral scent', 'Fast dissolve crystals'],
  },
  {
    id: 'sp-noodles',
    brand: 'SpiceBowl',
    name: '2-Minute Masala Noodles Family Pack',
    category: 'Food & Beverages',
    subLabel: '280 g',
    price: 42,
    mrp: 60,
    discountPercent: 30,
    rating: 4.9,
    reviewCount: 910,
    stock: 135,
    gstRate: 12,
    hsn: '1902',
    image: prodNoodlesPackImg,
    isDeal: true,
    isRecommended: true,
    isBestSeller: true,
    isTrending: true,
    description: 'Classic 4-cake family pack roasted spice masala noodles cooked ready in 2 minutes.',
    highlights: ['Fortified with wheat goodness', '4 single-serve taste-maker sachets', 'Zero trans fat'],
  },
  {
    id: 'sp-soap',
    brand: 'PureDew',
    name: 'Silk Cream Moisturizing Beauty Bar',
    category: 'Personal Care',
    subLabel: '100 g',
    price: 48,
    mrp: 80,
    discountPercent: 40,
    rating: 4.7,
    reviewCount: 274,
    stock: 96,
    gstRate: 18,
    hsn: '3401',
    image: prodSoapBarImg,
    isDeal: true,
    isTrending: true,
    description: 'Rich milk cream and vitamin E pH-balanced cleansing bar that leaves skin soft and nourished.',
    highlights: ['1/4 moisturizing milk cream', 'Dermatologically tested', 'Gentle everyday cleanse'],
  },
  {
    id: 'sp-headphones',
    brand: 'SonicWave',
    name: 'StudioPro ANC Wireless Headphones',
    category: 'Electronics',
    subLabel: '1 piece',
    price: 2999,
    mrp: 4999,
    discountPercent: 40,
    rating: 4.6,
    reviewCount: 192,
    stock: 19,
    gstRate: 18,
    hsn: '8518',
    image: prodHeadphonesImg,
    isRecommended: true,
    isTrending: true,
    description: 'Hybrid active noise cancellation Bluetooth 5.3 over-ear headphones with 45-hour battery life.',
    highlights: ['40mm dynamic drivers', 'USB-C fast charge (10 min = 5 hrs)', '1-Year store warranty'],
  },
  {
    id: 'sp-basmati',
    brand: 'Royal Harvest',
    name: 'Royal Aged Basmati Rice 18 Months',
    category: 'Grocery',
    subLabel: '5 kg',
    price: 549,
    mrp: 750,
    discountPercent: 27,
    rating: 4.8,
    reviewCount: 518,
    stock: 42,
    gstRate: 5,
    hsn: '1006',
    image: prodGroceryComboImg,
    isBestSeller: true,
    description: 'Extra-long slender Himalayan foothills basmati grains aged 18 months for fluffy biryani & pulao.',
    highlights: ['Non-sticky 2x elongation', 'Zero broken grain sorting', 'Resealable burlap tote pack'],
  },
  {
    id: 'sp-dairy-milk',
    brand: 'Samruddhi Dairy',
    name: 'FarmFresh A2 Cow Milk & Malai Paneer Pack',
    category: 'Dairy Products',
    subLabel: '500 ml + 200 g',
    price: 139,
    mrp: 165,
    discountPercent: 16,
    rating: 4.8,
    reviewCount: 344,
    stock: 30,
    gstRate: 5,
    hsn: '0401',
    image: prodDairyMilkImg,
    description: 'Daily chilled glass-bottle A2 cow milk paired with soft artisanal unpressed malai paneer.',
    highlights: ['Antibiotic & hormone free', 'Morning chill-chain packed', 'High calcium & protein'],
  },
  {
    id: 'sp-cooking-oil',
    brand: 'Khandani Organics',
    name: 'Cold-Pressed Groundnut Oil & Essential Pantry',
    category: 'Daily Essentials',
    subLabel: '1 litre + Pantry',
    price: 359,
    mrp: 450,
    discountPercent: 20,
    rating: 4.7,
    reviewCount: 215,
    stock: 55,
    gstRate: 5,
    hsn: '1508',
    image: prodGroceryComboImg,
    description: 'Wood-pressed pure Gujarat peanut oil retaining natural heart-healthy antioxidants & rich flavour.',
    highlights: ['Single-filtered unrefined oil', 'High smoke point for Indian tadka', 'Zero mineral oil'],
  },
  {
    id: 'sp-cookware',
    brand: 'ChefLine Studio',
    name: 'Tri-Ply Stainless Cookware & Utility Set',
    category: 'Home & Kitchen',
    subLabel: '3-Piece Set',
    price: 1499,
    mrp: 2499,
    discountPercent: 40,
    rating: 4.8,
    reviewCount: 163,
    stock: 22,
    gstRate: 12,
    hsn: '7323',
    image: heroKitchenCookwareImg,
    description: 'Heavy-gauge induction-friendly stainless steel kadhai, saucepan & lid combo built for daily cooking.',
    highlights: ['Food-grade 304 steel interior', 'Even heat distribution', 'Oven & induction safe'],
  },
  {
    id: 'sp-tshirt',
    brand: 'LoomCraft Basics',
    name: 'Classic Combed Cotton Crew T-Shirt',
    category: 'Fashion',
    subLabel: 'Size M / L',
    price: 349,
    mrp: 599,
    discountPercent: 42,
    rating: 4.5,
    reviewCount: 147,
    stock: 38,
    gstRate: 5,
    hsn: '6109',
    image: prodTshirtFashionImg,
    description: 'Breathable 180 GSM bio-washed combed cotton crew neck tee tailored for all-day comfort.',
    highlights: ['Pre-shrunk soft jersey knit', 'Reinforced collar rib', 'Color-fast coral dye'],
  },
];

export const COMBO_PACKS: ComboPack[] = [
  {
    id: 'combo-monthly-grocery',
    badgeText: 'COMBO BUNDLE · 26% OFF',
    title: 'Family Monthly Grocery Value Combo Pack',
    includedChips: [
      '5 kg Royal Aged Basmati Rice',
      '1 kg Yellow Moong Dal',
      '1 litre Cold-Pressed Groundnut Oil',
      '200 g Whole Garam Masala',
    ],
    price: 1099,
    mrp: 1490,
    savings: 391,
    image: prodGroceryComboImg,
    gstRate: 5,
    hsn: '2106',
    rating: 4.9,
    description: 'All monthly kitchen staples bundled together at wholesale kirana savings.',
    category: 'Combo Packs',
  },
  {
    id: 'combo-home-laundry',
    badgeText: 'COMBO BUNDLE · 33% OFF',
    title: 'Home & Laundry Care Value Combo Bundle',
    includedChips: [
      '1 kg Active Blue Matic Detergent',
      '4 x 100 g Silk Cream Beauty Bar',
      '200 ml HydraGlow Cleanser',
    ],
    price: 599,
    mrp: 890,
    savings: 291,
    image: prodDetergentPackImg,
    gstRate: 18,
    hsn: '3402',
    rating: 4.8,
    description: 'Complete household laundry and personal care refill bundle for an entire month.',
    category: 'Combo Packs',
  },
];

export const DELIVERY_HUBS: DeliveryHub[] = [
  {
    id: 'hub-fort',
    areaName: 'Fort / Churchgate, Mumbai',
    shortLabel: 'Fort / Churchgate, Mu...',
    cityState: 'Mumbai, Maharashtra',
    pincode: '400001',
    eta: '18-25 mins',
    hubName: 'Mumbai Central Express Hub',
    lat: 18.9322,
    lng: 72.8264,
  },
  {
    id: 'hub-gandhi-bazaar',
    areaName: 'Gandhi Bazaar, Basavanagudi',
    shortLabel: 'Gandhi Bazaar, Blr',
    cityState: 'Bengaluru, Karnataka',
    pincode: '560004',
    eta: '15-22 mins',
    hubName: 'Bengaluru South Kirana Hub',
    lat: 12.9447,
    lng: 77.5715,
  },
  {
    id: 'hub-jayanagar',
    areaName: 'Jayanagar 4th Block',
    shortLabel: 'Jayanagar 4th Block',
    cityState: 'Bengaluru, Karnataka',
    pincode: '560011',
    eta: '18-25 mins',
    hubName: 'Jayanagar Express Store',
    lat: 12.9279,
    lng: 77.5831,
  },
  {
    id: 'hub-cp-delhi',
    areaName: 'Connaught Place / Janpath',
    shortLabel: 'Connaught Place, Del',
    cityState: 'New Delhi, Delhi',
    pincode: '110001',
    eta: '20-30 mins',
    hubName: 'CP Central Dispatch',
    lat: 28.6315,
    lng: 77.2167,
  },
  {
    id: 'hub-hauz-khas',
    areaName: 'Hauz Khas / Green Park',
    shortLabel: 'Hauz Khas, Delhi',
    cityState: 'New Delhi, Delhi',
    pincode: '110016',
    eta: '25-35 mins',
    hubName: 'South Delhi Dark Store',
    lat: 28.5494,
    lng: 77.2001,
  },
  {
    id: 'hub-mi-road',
    areaName: 'MI Road / Johari Bazaar',
    shortLabel: 'MI Road, Jaipur',
    cityState: 'Jaipur, Rajasthan',
    pincode: '302001',
    eta: 'Next-day delivery',
    hubName: 'Jaipur Regional Hub',
    lat: 26.9154,
    lng: 75.8189,
  },
  {
    id: 'hub-navrangpura',
    areaName: 'Lal Darwaja / Navrangpura',
    shortLabel: 'Navrangpura, Ahd',
    cityState: 'Ahmedabad, Gujarat',
    pincode: '380001',
    eta: 'Same-day (2-4 hrs)',
    hubName: 'Ahmedabad City Depot',
    lat: 23.0303,
    lng: 72.58,
  },
  {
    id: 'hub-bandra',
    areaName: 'Marine Lines / Bandra West',
    shortLabel: 'Bandra West, Mumbai',
    cityState: 'Mumbai, Maharashtra',
    pincode: '400050',
    eta: '18-25 mins',
    hubName: 'Bandra Quick Hub',
    lat: 19.0596,
    lng: 72.8295,
  },
];

export const PROMO_COUPONS: PromoCoupon[] = [
  {
    code: 'SAVE10',
    title: '10% Instant Savings',
    description: '10% off up to ₹200 on orders above ₹499',
    minOrder: 499,
    discountType: 'percent',
    discountValue: 10,
    maxDiscount: 200,
  },
  {
    code: 'FRESH20',
    title: 'Flat ₹120 Off Basket',
    description: 'Flat ₹120 off on monthly grocery orders above ₹799',
    minOrder: 799,
    discountType: 'flat',
    discountValue: 120,
  },
  {
    code: 'FIRST50',
    title: 'Welcome ₹50 Off',
    description: 'Flat ₹50 off on any store order above ₹199',
    minOrder: 199,
    discountType: 'flat',
    discountValue: 50,
  },
];

export const CUSTOMER_FAQS: CustomerFaqItem[] = [
  {
    id: 'faq-online',
    question: 'How is this Customer Shopping App currently running?',
    answer:
      'It runs completely online connected to the Express store backend with real-time order, GST invoice, inventory, and address synchronization alongside the store billing ERP.',
  },
  {
    id: 'faq-gst',
    question: 'Do I receive a proper GST Tax Invoice for every online order?',
    answer:
      'Yes. Every completed checkout immediately creates a serialized GST Invoice visible in GST Invoices & My Orders, complete with HSN summary, CGST/SGST breakup, and one-click PDF export.',
  },
  {
    id: 'faq-delivery',
    question: 'How do hyperlocal PIN code delivery slots work?',
    answer:
      'Selecting your saved delivery address or PIN code checks availability at the nearest store hub. Orders above ₹499 qualify for free express delivery.',
  },
  {
    id: 'faq-returns',
    question: 'How can I request a return, damaged item replacement, or payment receipt?',
    answer:
      'Use the Submit Return or Support Request form above, choose Order Issue or Return Request, link your order #, and our store team receives it instantly in their online portal queue.',
  },
];

const ITEM_IMAGE_BY_ID: Record<string, string> = {
  'sp-apples': prodRedApplesImg,
  'sp-tea': prodTeaPackImg,
  'sp-detergent': prodDetergentPackImg,
  'sp-noodles': prodNoodlesPackImg,
  'sp-soap': prodSoapBarImg,
  'sp-headphones': prodHeadphonesImg,
  'sp-basmati': prodGroceryComboImg,
  'sp-dairy-milk': prodDairyMilkImg,
  'sp-cooking-oil': prodGroceryComboImg,
  'sp-cookware': heroKitchenCookwareImg,
  'sp-tshirt': prodTshirtFashionImg,
};

function resolveImageForItem(it: Item): string {
  if (it.image) return it.image;
  if (ITEM_IMAGE_BY_ID[it.id]) return ITEM_IMAGE_BY_ID[it.id];
  const n = it.name.toLowerCase();
  const c = (it.category || '').toLowerCase();
  if (n.includes('apple') || c.includes('fruit') || c.includes('veg')) return prodRedApplesImg;
  if (n.includes('tea') || n.includes('chai') || c.includes('beverage')) return prodTeaPackImg;
  if (n.includes('noodle') || n.includes('masala')) return prodNoodlesPackImg;
  if (n.includes('soap') || n.includes('beauty') || c.includes('personal')) return prodSoapBarImg;
  if (n.includes('headphone') || n.includes('audio') || c.includes('electronic')) return prodHeadphonesImg;
  if (n.includes('milk') || n.includes('paneer') || c.includes('dairy')) return prodDairyMilkImg;
  if (n.includes('cookware') || c.includes('kitchen')) return heroKitchenCookwareImg;
  if (n.includes('shirt') || c.includes('fashion')) return prodTshirtFashionImg;
  if (n.includes('surf') || n.includes('detergent') || c.includes('clean') || c.includes('household')) return prodDetergentPackImg;
  return prodGroceryComboImg;
}

function normalizeStoreCategory(category: string): Exclude<StoreCategory, 'All Categories' | 'Offers'> {
  const valid: Exclude<StoreCategory, 'All Categories' | 'Offers'>[] = [
    'Grocery',
    'Daily Essentials',
    'Dairy Products',
    'Fruits & Vegetables',
    'Food & Beverages',
    'Personal Care',
    'Home & Kitchen',
    'Combo Packs',
    'Electronics',
    'Fashion',
    'Household',
  ];
  const exact = valid.find((v) => v.toLowerCase() === (category || '').toLowerCase());
  if (exact) return exact;
  const c = (category || '').toLowerCase();
  if (c.includes('fmcg') || c.includes('detergent')) return 'Household';
  if (c.includes('combo')) return 'Combo Packs';
  if (c.includes('fruit') || c.includes('veg')) return 'Fruits & Vegetables';
  if (c.includes('dairy')) return 'Dairy Products';
  if (c.includes('tea') || c.includes('food')) return 'Food & Beverages';
  if (c.includes('electronic')) return 'Electronics';
  if (c.includes('kitchen')) return 'Home & Kitchen';
  if (c.includes('personal')) return 'Personal Care';
  if (c.includes('fashion')) return 'Fashion';
  return 'Grocery';
}

/**
 * Derives Customer Storefront products directly from authoritative Billing Inventory items
 * so Retail Price, Wholesale Price, Min Wholesale Qty, Tax Rate, and Live Available Stock
 * never duplicate or drift from the common Billing database.
 */
export function buildMergedStoreProducts(erpItems: Item[]): StoreProduct[] {
  return erpItems
    .filter((it) => {
      if (it.isOnlineAvailable === false) return false;
      if (it.name.toLowerCase() === 'sample item') return false;
      return true;
    })
    .map((it) => {
      const reserved = Math.max(0, it.reservedStock || 0);
      const available = Math.max(0, (it.stock || 0) - reserved);
      const curatedMeta = CURATED_STORE_PRODUCTS.find(
        (c) => c.id === it.id || c.name.toLowerCase() === it.name.toLowerCase()
      );
      const discount =
        it.onlineDiscountPercent && it.onlineDiscountPercent > 0
          ? it.onlineDiscountPercent
          : curatedMeta?.discountPercent ?? 15;
      const computedMrp =
        it.mrp && it.mrp > it.salePrice
          ? it.mrp
          : curatedMeta?.mrp && curatedMeta.mrp > it.salePrice
          ? curatedMeta.mrp
          : Math.round(it.salePrice / Math.max(0.1, 1 - discount / 100));

      return {
        id: it.id,
        linkedItemId: it.id,
        brand: it.brand || curatedMeta?.brand || 'My Store Inventory',
        name: it.name,
        category: normalizeStoreCategory(it.category || curatedMeta?.category || 'Daily Essentials'),
        subLabel: it.subLabel || it.unit || curatedMeta?.subLabel || '1 Pack',
        price: it.salePrice,
        wholesalePrice: it.wholesalePrice,
        minWholesaleQty: it.minWholesaleQty,
        mrp: computedMrp,
        discountPercent: discount,
        rating: it.rating || curatedMeta?.rating || 4.6,
        reviewCount: it.reviewCount || curatedMeta?.reviewCount || 84,
        stock: it.stock,
        reservedStock: reserved,
        availableStock: available,
        gstRate: it.taxRate ?? curatedMeta?.gstRate ?? 5,
        hsn: it.code || curatedMeta?.hsn || '2106',
        image: resolveImageForItem(it),
        isDeal: it.isDeal ?? curatedMeta?.isDeal ?? discount >= 20,
        isRecommended: it.isRecommended ?? curatedMeta?.isRecommended ?? false,
        isBestSeller: it.isBestSeller ?? curatedMeta?.isBestSeller ?? true,
        isTrending: it.isTrending ?? curatedMeta?.isTrending ?? false,
        description:
          it.description ||
          curatedMeta?.description ||
          `Direct store inventory SKU (${it.code || it.category}) with live billing stock synchronization.`,
        highlights:
          it.highlights ||
          curatedMeta?.highlights || [
            'Direct from MY STORE inventory',
            `Live stock synced (${available} available)`,
            `GST ${it.taxRate ?? 5}% tax invoice included`,
          ],
      };
    });
}

export function findNearestHub(lat: number, lng: number): DeliveryHub {
  let nearest = DELIVERY_HUBS[0];
  let bestDist = Infinity;
  for (const hub of DELIVERY_HUBS) {
    const dLat = lat - hub.lat;
    const dLng = lng - hub.lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < bestDist) {
      bestDist = dist;
      nearest = hub;
    }
  }
  return nearest;
}
