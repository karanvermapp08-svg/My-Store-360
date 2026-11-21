import { HsnMasterEntry } from '../types';

/**
 * Authoritative Indian GST Council / CBIC HSN & SAC Classification Schedule
 * Focused on Indian General Stores, Kirana Groceries, FMCG, Beverages, Personal Care,
 * Household Staples, Packaging, Electronics & Retail Logistics Services.
 * Rates and tax categories follow official CBIC GST Tariff schedules.
 */
export const INDIA_HSN_SAC_MASTER: HsnMasterEntry[] = [
  // 0% / Exempt Staples & Unbranded Essentials
  { code: '0401', type: 'HSN', description: 'Fresh Milk & Cream (Not concentrated or sweetened)', category: 'Dairy', gstRate: 0, taxCategory: 'Exempt', uqc: 'LTR', sourceRef: 'CBIC Notification 2/2017-CT(R)', effectiveDate: '2017-07-01' },
  { code: '0407', type: 'HSN', description: 'Birds Eggs in Shell, Fresh', category: 'Dairy & Eggs', gstRate: 0, taxCategory: 'Exempt', uqc: 'PCS', sourceRef: 'CBIC Notification 2/2017-CT(R)', effectiveDate: '2017-07-01' },
  { code: '0701', type: 'HSN', description: 'Fresh Potatoes & Onions / Fresh Vegetables', category: 'Fruits & Vegetables', gstRate: 0, taxCategory: 'Exempt', uqc: 'KGS', sourceRef: 'CBIC Notification 2/2017-CT(R)', effectiveDate: '2017-07-01' },
  { code: '0803', type: 'HSN', description: 'Fresh Bananas, Apples & Citrus Fruits', category: 'Fruits & Vegetables', gstRate: 0, taxCategory: 'Exempt', uqc: 'KGS', sourceRef: 'CBIC Notification 2/2017-CT(R)', effectiveDate: '2017-07-01' },
  { code: '1001', type: 'HSN', description: 'Wheat and Meslin (Unpackaged / Loose)', category: 'Grains & Staples', gstRate: 0, taxCategory: 'Exempt', uqc: 'KGS', sourceRef: 'CBIC Notification 2/2017-CT(R)', effectiveDate: '2017-07-01' },
  { code: '1006', type: 'HSN', description: 'Rice (Unpackaged / Loose)', category: 'Grains & Staples', gstRate: 0, taxCategory: 'Exempt', uqc: 'KGS', sourceRef: 'CBIC Notification 2/2017-CT(R)', effectiveDate: '2017-07-01' },
  { code: '2501', type: 'HSN', description: 'Common Salt, Table Salt & Iodised Salt', category: 'Grocery & Spices', gstRate: 0, taxCategory: 'Exempt', uqc: 'KGS', sourceRef: 'CBIC Notification 2/2017-CT(R)', effectiveDate: '2017-07-01' },
  { code: '19059090', type: 'HSN', description: 'Unbranded Bread (except pizza bread)', category: 'Bakery', gstRate: 0, taxCategory: 'Exempt', uqc: 'PCS', sourceRef: 'CBIC Notification 2/2017-CT(R)', effectiveDate: '2017-07-01' },

  // 5% Essential Packaged Food Grains, Oils, Spices, Tea/Coffee, Sugar
  { code: '10063020', type: 'HSN', description: 'Basmati Rice (Pre-packaged & Labelled)', category: 'Grains & Staples', gstRate: 5, taxCategory: 'Taxable', uqc: 'KGS', sourceRef: 'CBIC 06/2022-CT(R)', effectiveDate: '2022-07-18' },
  { code: '1101', type: 'HSN', description: 'Wheat Flour / Atta & Maida (Pre-packaged & Labelled)', category: 'Grains & Staples', gstRate: 5, taxCategory: 'Taxable', uqc: 'KGS', sourceRef: 'CBIC 06/2022-CT(R)', effectiveDate: '2022-07-18' },
  { code: '0713', type: 'HSN', description: 'Dried Leguminous Vegetables / Toor, Moong, Chana Dal (Pre-packaged)', category: 'Pulses & Lentils', gstRate: 5, taxCategory: 'Taxable', uqc: 'KGS', sourceRef: 'CBIC 06/2022-CT(R)', effectiveDate: '2022-07-18' },
  { code: '1507', type: 'HSN', description: 'Refined Soyabean & Sunflower Edible Oils', category: 'Edible Oils', gstRate: 5, taxCategory: 'Taxable', uqc: 'LTR', sourceRef: 'CBIC Schedule I', effectiveDate: '2017-07-01' },
  { code: '1511', type: 'HSN', description: 'Palm Oil & Vegetable Cooking Oils', category: 'Edible Oils', gstRate: 5, taxCategory: 'Taxable', uqc: 'LTR', sourceRef: 'CBIC Schedule I', effectiveDate: '2017-07-01' },
  { code: '1512', type: 'HSN', description: 'Sunflower, Safflower & Cotton-seed Oil', category: 'Edible Oils', gstRate: 5, taxCategory: 'Taxable', uqc: 'LTR', sourceRef: 'CBIC Schedule I', effectiveDate: '2017-07-01' },
  { code: '1514', type: 'HSN', description: 'Mustard Oil / Rapeseed Oil', category: 'Edible Oils', gstRate: 5, taxCategory: 'Taxable', uqc: 'LTR', sourceRef: 'CBIC Schedule I', effectiveDate: '2017-07-01' },
  { code: '1701', type: 'HSN', description: 'Cane or Beet Sugar (Pre-packaged & Labelled)', category: 'Sugar & Sweeteners', gstRate: 5, taxCategory: 'Taxable', uqc: 'KGS', sourceRef: 'CBIC Schedule I', effectiveDate: '2017-07-01' },
  { code: '0901', type: 'HSN', description: 'Coffee (Roasted / Decaffeinated Beans & Ground)', category: 'Beverages', gstRate: 5, taxCategory: 'Taxable', uqc: 'KGS', sourceRef: 'CBIC Schedule I', effectiveDate: '2017-07-01' },
  { code: '0902', type: 'HSN', description: 'Tea Leaves & CTC Dust Tea (Packaged)', category: 'Beverages', gstRate: 5, taxCategory: 'Taxable', uqc: 'KGS', sourceRef: 'CBIC Schedule I', effectiveDate: '2017-07-01' },
  { code: '0904', type: 'HSN', description: 'Black Pepper, Dried Chillies & Whole Spices', category: 'Spices & Masala', gstRate: 5, taxCategory: 'Taxable', uqc: 'KGS', sourceRef: 'CBIC Schedule I', effectiveDate: '2017-07-01' },
  { code: '0910', type: 'HSN', description: 'Turmeric, Ginger, Curry Masala & Mixed Spices', category: 'Spices & Masala', gstRate: 5, taxCategory: 'Taxable', uqc: 'KGS', sourceRef: 'CBIC Schedule I', effectiveDate: '2017-07-01' },
  { code: '0403', type: 'HSN', description: 'Curd, Lassi, Buttermilk (Pre-packaged & Labelled)', category: 'Dairy', gstRate: 5, taxCategory: 'Taxable', uqc: 'KGS', sourceRef: 'CBIC 06/2022-CT(R)', effectiveDate: '2022-07-18' },
  { code: '0406', type: 'HSN', description: 'Paneer & Fresh Cheese (Pre-packaged & Labelled)', category: 'Dairy', gstRate: 5, taxCategory: 'Taxable', uqc: 'KGS', sourceRef: 'CBIC 06/2022-CT(R)', effectiveDate: '2022-07-18' },
  { code: '0409', type: 'HSN', description: 'Natural Honey (Pre-packaged & Branded)', category: 'Grocery', gstRate: 5, taxCategory: 'Taxable', uqc: 'KGS', sourceRef: 'CBIC Schedule I', effectiveDate: '2017-07-01' },
  { code: '21069099', type: 'HSN', description: 'Papad (Pre-packaged), Khakhra & Traditional Savouries', category: 'Snacks & Bakery', gstRate: 5, taxCategory: 'Taxable', uqc: 'PAC', sourceRef: 'CBIC Schedule I', effectiveDate: '2017-07-01' },
  { code: '19053100', type: 'HSN', description: 'Rusk & Toasted Bread Products', category: 'Snacks & Bakery', gstRate: 5, taxCategory: 'Taxable', uqc: 'PAC', sourceRef: 'CBIC Schedule I', effectiveDate: '2017-07-01' },
  { code: '3605', type: 'HSN', description: 'Matches / Safety Matchboxes', category: 'Household Essentials', gstRate: 5, taxCategory: 'Taxable', uqc: 'BOX', sourceRef: 'CBIC Schedule I', effectiveDate: '2017-07-01' },
  { code: '33074100', type: 'HSN', description: 'Agarbatti & Incense Sticks', category: 'Pooja & Household', gstRate: 5, taxCategory: 'Taxable', uqc: 'PAC', sourceRef: 'CBIC Schedule I', effectiveDate: '2017-07-01' },

  // 12% Dairy Fats, Processed Foods, Noodles, Namkeen, Pickles, Dry Fruits, Stationery
  { code: '0405', type: 'HSN', description: 'Butter, Ghee & Dairy Spreads', category: 'Dairy', gstRate: 12, taxCategory: 'Taxable', uqc: 'KGS', sourceRef: 'CBIC Schedule II', effectiveDate: '2017-07-01' },
  { code: '04069000', type: 'HSN', description: 'Processed Cheese (Blocks, Slices & Spreads)', category: 'Dairy', gstRate: 12, taxCategory: 'Taxable', uqc: 'KGS', sourceRef: 'CBIC Schedule II', effectiveDate: '2017-07-01' },
  { code: '0801', type: 'HSN', description: 'Cashew Nuts, Almonds & Shelled Dry Fruits', category: 'Dry Fruits', gstRate: 12, taxCategory: 'Taxable', uqc: 'KGS', sourceRef: 'CBIC Schedule II', effectiveDate: '2017-07-01' },
  { code: '1902', type: 'HSN', description: 'Instant Noodles, Pasta, Vermicelli & Macaroni', category: 'Packaged Foods', gstRate: 12, taxCategory: 'Taxable', uqc: 'PAC', sourceRef: 'CBIC Schedule II', effectiveDate: '2017-07-01' },
  { code: '2001', type: 'HSN', description: 'Pickles, Chutneys, Jams & Fruit Preserves', category: 'Sauces & Condiments', gstRate: 12, taxCategory: 'Taxable', uqc: 'BOT', sourceRef: 'CBIC Schedule II', effectiveDate: '2017-07-01' },
  { code: '2103', type: 'HSN', description: 'Tomato Ketchup, Soy Sauce & Mixed Condiments', category: 'Sauces & Condiments', gstRate: 12, taxCategory: 'Taxable', uqc: 'BOT', sourceRef: 'CBIC Schedule II', effectiveDate: '2017-07-01' },
  { code: '21069091', type: 'HSN', description: 'Namkeen, Bhujia, Mixture & Extruded Snacks', category: 'Snacks & Bakery', gstRate: 12, taxCategory: 'Taxable', uqc: 'PAC', sourceRef: 'CBIC Schedule II', effectiveDate: '2017-07-01' },
  { code: '2009', type: 'HSN', description: 'Fruit Juices & Vegetable Juices (Packaged)', category: 'Beverages', gstRate: 12, taxCategory: 'Taxable', uqc: 'LTR', sourceRef: 'CBIC Schedule II', effectiveDate: '2017-07-01' },
  { code: '4820', type: 'HSN', description: 'Notebooks, Exercise Books, Registers & Diaries', category: 'Stationery', gstRate: 12, taxCategory: 'Taxable', uqc: 'PCS', sourceRef: 'CBIC Schedule II', effectiveDate: '2017-07-01' },
  { code: '9608', type: 'HSN', description: 'Ball Point Pens, Fountain Pens & Markers', category: 'Stationery', gstRate: 12, taxCategory: 'Taxable', uqc: 'PCS', sourceRef: 'CBIC Schedule II', effectiveDate: '2017-07-01' },

  // 18% Biscuits, Confectionery, Personal Care, Soaps, Detergents, Bottled Water, Packaging, Electronics
  { code: '190531', type: 'HSN', description: 'Sweet Biscuits, Cookies & Wafers', category: 'Snacks & Bakery', gstRate: 18, taxCategory: 'Taxable', uqc: 'PAC', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },
  { code: '1806', type: 'HSN', description: 'Chocolates, Cocoa Spreads & Confectionery', category: 'Snacks & Bakery', gstRate: 18, taxCategory: 'Taxable', uqc: 'PCS', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },
  { code: '2101', type: 'HSN', description: 'Instant Coffee & Tea Extracts', category: 'Beverages', gstRate: 18, taxCategory: 'Taxable', uqc: 'JAR', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },
  { code: '2105', type: 'HSN', description: 'Ice Cream & Edible Ice', category: 'Dairy & Frozen', gstRate: 18, taxCategory: 'Taxable', uqc: 'PCS', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },
  { code: '2201', type: 'HSN', description: 'Packaged Mineral & Drinking Water', category: 'Beverages', gstRate: 18, taxCategory: 'Taxable', uqc: 'BOT', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },
  { code: '3304', type: 'HSN', description: 'Skin Care, Face Creams, Talcum Powder & Beauty Care', category: 'Personal Care', gstRate: 18, taxCategory: 'Taxable', uqc: 'PCS', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },
  { code: '3305', type: 'HSN', description: 'Shampoos, Hair Oils, Hair Conditioners', category: 'Personal Care', gstRate: 18, taxCategory: 'Taxable', uqc: 'BOT', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },
  { code: '3306', type: 'HSN', description: 'Toothpaste, Toothpowder & Oral Hygiene', category: 'Personal Care', gstRate: 18, taxCategory: 'Taxable', uqc: 'PCS', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },
  { code: '3307', type: 'HSN', description: 'Deodorants, Shaving Foam & Aftershave', category: 'Personal Care', gstRate: 18, taxCategory: 'Taxable', uqc: 'PCS', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },
  { code: '3401', type: 'HSN', description: 'Toilet Soap Bars & Liquid Bathing Soaps', category: 'Personal Care', gstRate: 18, taxCategory: 'Taxable', uqc: 'PCS', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },
  { code: '3402', type: 'HSN', description: 'Detergent Powder, Washing Bars & Dishwash Liquids', category: 'Cleaning & Household', gstRate: 18, taxCategory: 'Taxable', uqc: 'PAC', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },
  { code: '3808', type: 'HSN', description: 'Disinfectants, Mosquito Repellents & Floor Cleaners', category: 'Cleaning & Household', gstRate: 18, taxCategory: 'Taxable', uqc: 'BOT', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },
  { code: '4811', type: 'HSN', description: 'Thermal Paper Rolls, Adhesive Labels & Coated Paper', category: 'Stationery & POS', gstRate: 18, taxCategory: 'Taxable', uqc: 'BOX', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },
  { code: '3923', type: 'HSN', description: 'Plastic Storage Containers, Bottles & Carry Bags', category: 'Packaging & Plastics', gstRate: 18, taxCategory: 'Taxable', uqc: 'PCS', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },
  { code: '8303', type: 'HSN', description: 'POS Cash Drawers, Safes & Metal Cash Boxes', category: 'Electronics & Hardware', gstRate: 18, taxCategory: 'Taxable', uqc: 'PCS', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },
  { code: '8471', type: 'HSN', description: 'POS Terminals, Barcode Scanners & Thermal Printers', category: 'Electronics & Hardware', gstRate: 18, taxCategory: 'Taxable', uqc: 'PCS', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },
  { code: '8506', type: 'HSN', description: 'Primary Cells & AA/AAA Batteries', category: 'Electronics & Hardware', gstRate: 18, taxCategory: 'Taxable', uqc: 'PCS', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },
  { code: '8539', type: 'HSN', description: 'LED Bulbs, Tube Lights & Domestic Lamps', category: 'Electronics & Hardware', gstRate: 18, taxCategory: 'Taxable', uqc: 'PCS', sourceRef: 'CBIC Schedule III', effectiveDate: '2017-07-01' },

  // 28% Aerated & Caffeinated Beverages (excluding compensation cess tracking note)
  { code: '22021010', type: 'HSN', description: 'Aerated Soft Drinks, Carbonated Cola & Flavoured Sodas', category: 'Beverages', gstRate: 28, taxCategory: 'Taxable', uqc: 'BOT', sourceRef: 'CBIC Schedule IV', effectiveDate: '2017-07-01' },
  { code: '22029990', type: 'HSN', description: 'Caffeinated Energy Drinks & Non-Alcoholic Malt Beverages', category: 'Beverages', gstRate: 28, taxCategory: 'Taxable', uqc: 'CAN', sourceRef: 'CBIC Schedule IV', effectiveDate: '2017-07-01' },

  // Services Accounting Codes (SAC)
  { code: '996511', type: 'SAC', description: 'Road Freight & Goods Transport Agency (GTA) Services', category: 'Transport & Logistics', gstRate: 5, taxCategory: 'Taxable', uqc: 'OTH', sourceRef: 'CBIC SAC Notification 11/2017', effectiveDate: '2017-07-01' },
  { code: '996812', type: 'SAC', description: 'Courier & Local Last-Mile Parcel Delivery Services', category: 'Transport & Logistics', gstRate: 18, taxCategory: 'Taxable', uqc: 'OTH', sourceRef: 'CBIC SAC Notification 11/2017', effectiveDate: '2017-07-01' },
  { code: '996729', type: 'SAC', description: 'Cold Storage, Warehousing & Packaging Services', category: 'Warehousing', gstRate: 18, taxCategory: 'Taxable', uqc: 'OTH', sourceRef: 'CBIC SAC Notification 11/2017', effectiveDate: '2017-07-01' },
  { code: '998549', type: 'SAC', description: 'Packaging & Labelling Services for Retail Goods', category: 'Store Services', gstRate: 18, taxCategory: 'Taxable', uqc: 'OTH', sourceRef: 'CBIC SAC Notification 11/2017', effectiveDate: '2017-07-01' },
  { code: '998314', type: 'SAC', description: 'IT, POS Billing Software Support & Maintenance', category: 'IT Services', gstRate: 18, taxCategory: 'Taxable', uqc: 'OTH', sourceRef: 'CBIC SAC Notification 11/2017', effectiveDate: '2017-07-01' },
];

export const INDIAN_STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const HSN_REGEX = /^[0-9]{4}([0-9]{2}([0-9]{2})?)?$/;

export function isValidGstin(gstin?: string): boolean {
  if (!gstin) return false;
  return GSTIN_REGEX.test(gstin.trim().toUpperCase());
}

export function isValidHsnOrSac(code?: string): boolean {
  if (!code) return false;
  const clean = code.trim();
  return HSN_REGEX.test(clean) || /^99[0-9]{4}$/.test(clean);
}

export function extractStateCodeFromGstin(gstin?: string): string | null {
  if (!gstin || gstin.trim().length < 2) return null;
  const code = gstin.trim().slice(0, 2);
  return INDIAN_STATE_CODES[code] ? code : null;
}

export function searchHsnMaster(
  query: string,
  extraEntries: HsnMasterEntry[] = []
): HsnMasterEntry[] {
  const combined = [...INDIA_HSN_SAC_MASTER, ...extraEntries];
  const q = query.trim().toLowerCase();
  if (!q) return combined;
  return combined.filter(
    (e) =>
      e.code.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.type.toLowerCase().includes(q)
  );
}
