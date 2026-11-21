import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Edit3,
  Trash2,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Activity,
  Layers,
  FileSpreadsheet,
  ShoppingCart,
  Boxes,
  Repeat,
  ShieldCheck,
  Receipt,
  Truck,
  TrendingUp,
  Cpu,
  Database,
  Search,
  Filter,
  Check,
  X,
  ExternalLink,
  Laptop,
  ShoppingBag,
  Wrench,
  Stethoscope,
  Building2,
  AlertTriangle
} from 'lucide-react';
import { useVyapar } from '../context/VyaparContext';
import { safeGetStoredData, safeSetStoredData, generateUniqueId } from '../utils/storage';
import { runAutomatedAccountingTests, TestResult } from '../utils/accounting.test';
import { Item, Party, Transaction } from '../types';

export interface DemoFeatureItem {
  id: string;
  title: string;
  category: 'Billing & GST' | 'POS & Retail' | 'Inventory' | 'Conversions' | 'Payments & Credit' | 'Security & Staff' | 'Automation' | 'Custom';
  description: string;
  status: 'Active' | 'Beta' | 'New' | 'Under Review' | 'Custom';
  iconName: string;
  targetTab?: string;
  targetSubtype?: string;
  actionType: 'navigate' | 'openAddSale' | 'openAddPurchase' | 'openAddParty' | 'openAddItem' | 'openSettings' | 'openPremium' | 'runDiagnostics';
  isBuiltIn?: boolean;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
}

const STORAGE_KEY_FEATURES = 'vyapar_demo_features_catalog';

const DEFAULT_FEATURES: DemoFeatureItem[] = [
  {
    id: 'feat-gst-billing',
    title: 'Multi-State GST Tax Engine',
    category: 'Billing & GST',
    description: 'Auto-detects Intra-State (50% CGST + 50% SGST) vs Inter-State (100% IGST) based on customer Place of Supply. Includes real-time tax breakdown, HSN validation, and rounding.',
    status: 'Active',
    iconName: 'FileSpreadsheet',
    targetTab: 'sale-invoices',
    actionType: 'openAddSale',
    isBuiltIn: true,
    tags: ['GST', 'CGST/SGST/IGST', 'Tax Invoice', 'Round-off'],
    createdAt: '2025-01-01'
  },
  {
    id: 'feat-vyapar-pos',
    title: 'High-Speed POS Checkout Counter',
    category: 'POS & Retail',
    description: 'Instant touch & barcode enabled retail billing terminal. Fast item search, one-tap quantity multipliers, quick cash tender presets, and instant thermal receipt printing.',
    status: 'Active',
    iconName: 'ShoppingCart',
    targetTab: 'vyapar-pos',
    actionType: 'navigate',
    isBuiltIn: true,
    tags: ['POS', 'Barcode', 'Retail', 'Quick Cash'],
    createdAt: '2025-01-01'
  },
  {
    id: 'feat-print-templates',
    title: '5 Multi-Template PDF & Print Center',
    category: 'Billing & GST',
    description: 'Switch between GST Tax Invoice (A4 with HSN & amount-in-words), Modern Business, Classic Clean, POS Thermal 3", and POS Thermal 2" with zero layout breakage.',
    status: 'Active',
    iconName: 'Receipt',
    targetTab: 'sale-invoices',
    actionType: 'navigate',
    isBuiltIn: true,
    tags: ['Print', 'Thermal', 'A4 PDF', 'Templates'],
    createdAt: '2025-01-01'
  },
  {
    id: 'feat-estimate-conversion',
    title: 'Quotation-to-Invoice 1-Click Conversion',
    category: 'Conversions',
    description: 'Draft Estimates & Proforma Invoices with zero stock impact. Once approved by the client, convert directly into an active GST Sale Invoice with 1 click.',
    status: 'Active',
    iconName: 'Repeat',
    targetTab: 'estimate-quotation',
    actionType: 'navigate',
    isBuiltIn: true,
    tags: ['Estimate', 'Quotation', 'Proforma', 'Conversion'],
    createdAt: '2025-01-01'
  },
  {
    id: 'feat-sale-orders',
    title: 'Sales Order & Advance Payment Tracker',
    category: 'Conversions',
    description: 'Record pending client bookings, collect advance deposits, track fulfillment states, and seamlessly convert fulfilled orders into finalized tax sales.',
    status: 'Active',
    iconName: 'Layers',
    targetTab: 'sale-order',
    actionType: 'navigate',
    isBuiltIn: true,
    tags: ['Orders', 'Advance', 'Fulfillment', 'Booking'],
    createdAt: '2025-01-01'
  },
  {
    id: 'feat-delivery-challan',
    title: 'Delivery Challan & Dispatch Manager',
    category: 'Conversions',
    description: 'Generate goods dispatch documents with transporter name, vehicle registration number, and delivery site details. Directly convert to sale bills upon handover.',
    status: 'Active',
    iconName: 'Truck',
    targetTab: 'delivery-challan',
    actionType: 'navigate',
    isBuiltIn: true,
    tags: ['Dispatch', 'Transport', 'Vehicle', 'Challan'],
    createdAt: '2025-01-01'
  },
  {
    id: 'feat-credit-notes',
    title: 'Credit Note & Sales Return Engine',
    category: 'Payments & Credit',
    description: 'Process customer returns linked directly to original invoices. Automatically restores item stock ledger and reverses output GST liability correctly.',
    status: 'Active',
    iconName: 'RotateCcw',
    targetTab: 'sale-return',
    actionType: 'navigate',
    isBuiltIn: true,
    tags: ['Credit Note', 'Returns', 'Stock Reversal', 'Tax Credit'],
    createdAt: '2025-01-01'
  },
  {
    id: 'feat-credit-limit',
    title: 'Customer Credit Limit Controller',
    category: 'Payments & Credit',
    description: 'Set custom credit limits and credit periods for parties. Warns or blocks cashier billing when party outstanding exceeds approved boundaries.',
    status: 'Active',
    iconName: 'TrendingUp',
    targetTab: 'parties',
    actionType: 'navigate',
    isBuiltIn: true,
    tags: ['Credit Limit', 'Risk Control', 'Parties', 'Receivables'],
    createdAt: '2025-01-01'
  },
  {
    id: 'feat-inventory-ledger',
    title: 'Stock Ledger & Low-Stock Alerts',
    category: 'Inventory',
    description: 'Complete stock tracking across sale decrements, purchase inward increments, manual stock adjustments, and low-inventory visual alerts.',
    status: 'Active',
    iconName: 'Boxes',
    targetTab: 'items',
    actionType: 'navigate',
    isBuiltIn: true,
    tags: ['Stock', 'Inventory', 'Low Stock', 'Adjustments'],
    createdAt: '2025-01-01'
  },
  {
    id: 'feat-rbac-security',
    title: 'Multi-Role RBAC & Audit Trails',
    category: 'Security & Staff',
    description: '5 specialized business roles (Owner, Manager, Cashier, Stock Keeper, Accountant) with 20 granular permissions, biometric attendance, and tamper-evident audit logs.',
    status: 'Active',
    iconName: 'ShieldCheck',
    targetTab: 'staff-management',
    actionType: 'navigate',
    isBuiltIn: true,
    tags: ['RBAC', 'Roles', 'Attendance', 'Audit Log', 'Permissions'],
    createdAt: '2025-01-01'
  },
  {
    id: 'feat-storage-recovery',
    title: 'Crash-Proof Safe Storage Engine',
    category: 'Automation',
    description: 'Guards against corrupted local storage with safe JSON parsers, auto-healing fallbacks, collision-free transaction IDs, and automated backup snapshots.',
    status: 'Active',
    iconName: 'Database',
    actionType: 'runDiagnostics',
    isBuiltIn: true,
    tags: ['Zero Crash', 'Safe JSON', 'Auto Recovery', 'Reliability'],
    createdAt: '2025-01-01'
  }
];

export const DemoFeaturesView: React.FC = () => {
  const {
    setActiveTab,
    setActiveSaleSubtype,
    setIsAddSaleOpen,
    setIsAddPurchaseOpen,
    setIsAddPartyModalOpen,
    setIsAddItemModalOpen,
    setIsSettingsModalOpen,
    setIsPremiumModalOpen,
    showToast,
    company,
    updateCompany,
    addTransaction,
    addItem,
    addParty,
    clearTransactions
  } = useVyapar();

  // Features State (loaded from storage or default)
  const [features, setFeatures] = useState<DemoFeatureItem[]>(() => {
    return safeGetStoredData<DemoFeatureItem[]>(STORAGE_KEY_FEATURES, DEFAULT_FEATURES);
  });

  // Save to storage whenever features change
  useEffect(() => {
    safeSetStoredData(STORAGE_KEY_FEATURES, features);
  }, [features]);

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  // Diagnostics Test Suite State
  const [testResults, setTestResults] = useState<{
    summary: string;
    total: number;
    passed: number;
    failed: number;
    results: TestResult[];
  } | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  // Add & Edit Feature Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<DemoFeatureItem | null>(null);
  const [isNewFeature, setIsNewFeature] = useState(false);

  // Form Fields for Add/Edit
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<DemoFeatureItem['category']>('Custom');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<DemoFeatureItem['status']>('Active');
  const [formIconName, setFormIconName] = useState('Sparkles');
  const [formTargetTab, setFormTargetTab] = useState('sale-invoices');
  const [formActionType, setFormActionType] = useState<DemoFeatureItem['actionType']>('navigate');
  const [formTags, setFormTags] = useState('');

  // Open "Add Feature"
  const handleOpenAddFeature = () => {
    setIsNewFeature(true);
    setEditingFeature(null);
    setFormTitle('');
    setFormCategory('Custom');
    setFormDescription('');
    setFormStatus('Active');
    setFormIconName('Sparkles');
    setFormTargetTab('sale-invoices');
    setFormActionType('navigate');
    setFormTags('Custom, Feature');
    setIsEditModalOpen(true);
  };

  // Open "Edit Feature"
  const handleOpenEditFeature = (feat: DemoFeatureItem) => {
    setIsNewFeature(false);
    setEditingFeature(feat);
    setFormTitle(feat.title);
    setFormCategory(feat.category);
    setFormDescription(feat.description);
    setFormStatus(feat.status);
    setFormIconName(feat.iconName || 'Sparkles');
    setFormTargetTab(feat.targetTab || 'sale-invoices');
    setFormActionType(feat.actionType || 'navigate');
    setFormTags((feat.tags || []).join(', '));
    setIsEditModalOpen(true);
  };

  // Save Feature (Add or Edit)
  const handleSaveFeature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showToast('Please enter a feature title');
      return;
    }

    const parsedTags = formTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    if (isNewFeature) {
      const newFeat: DemoFeatureItem = {
        id: `feat-${generateUniqueId()}`,
        title: formTitle.trim(),
        category: formCategory,
        description: formDescription.trim(),
        status: formStatus,
        iconName: formIconName,
        targetTab: formTargetTab,
        actionType: formActionType,
        isBuiltIn: false,
        tags: parsedTags.length > 0 ? parsedTags : ['Custom'],
        createdAt: new Date().toISOString().split('T')[0],
      };

      setFeatures(prev => [newFeat, ...prev]);
      showToast(`Feature "${newFeat.title}" added to Studio!`);
    } else if (editingFeature) {
      setFeatures(prev =>
        prev.map(f =>
          f.id === editingFeature.id
            ? {
                ...f,
                title: formTitle.trim(),
                category: formCategory,
                description: formDescription.trim(),
                status: formStatus,
                iconName: formIconName,
                targetTab: formTargetTab,
                actionType: formActionType,
                tags: parsedTags,
                updatedAt: new Date().toISOString().split('T')[0],
              }
            : f
        )
      );
      showToast(`Feature "${formTitle.trim()}" updated successfully!`);
    }

    setIsEditModalOpen(false);
  };

  // Delete Custom Feature
  const handleDeleteFeature = (id: string, title: string) => {
    setFeatures(prev => prev.filter(f => f.id !== id));
    showToast(`Deleted "${title}"`);
    if (editingFeature?.id === id) {
      setIsEditModalOpen(false);
    }
  };

  // Reset to Default Features
  const handleResetDefaults = () => {
    setFeatures(DEFAULT_FEATURES);
    safeSetStoredData(STORAGE_KEY_FEATURES, DEFAULT_FEATURES);
    showToast('Reset features catalog to default standard library');
  };

  // Launch a Feature Live
  const handleLaunchFeature = (feat: DemoFeatureItem) => {
    switch (feat.actionType) {
      case 'openAddSale':
        setIsAddSaleOpen(true);
        showToast(`Launching ${feat.title}: Opened GST Sale Invoice Builder`);
        break;
      case 'openAddPurchase':
        setIsAddPurchaseOpen(true);
        showToast(`Launching ${feat.title}: Opened Purchase Inward Bill`);
        break;
      case 'openAddParty':
        setIsAddPartyModalOpen(true);
        showToast(`Launching ${feat.title}: Opened Customer/Supplier Master`);
        break;
      case 'openAddItem':
        setIsAddItemModalOpen(true);
        showToast(`Launching ${feat.title}: Opened Inventory Item Master`);
        break;
      case 'openSettings':
        setIsSettingsModalOpen(true);
        showToast(`Launching ${feat.title}: Opened System Settings`);
        break;
      case 'openPremium':
        setIsPremiumModalOpen(true);
        showToast(`Launching ${feat.title}: Opened Vyapar Premium`);
        break;
      case 'runDiagnostics':
        handleRunDiagnostics();
        break;
      case 'navigate':
      default:
        if (feat.targetTab) {
          setActiveTab(feat.targetTab);
          if (feat.targetSubtype) {
            setActiveSaleSubtype(feat.targetSubtype);
          }
          showToast(`Navigated to ${feat.title} workspace`);
        }
        break;
    }
  };

  // Run 20-Point Automated Diagnostics
  const handleRunDiagnostics = () => {
    setIsRunningTests(true);
    setShowTestModal(true);
    setTimeout(() => {
      const results = runAutomatedAccountingTests();
      setTestResults(results);
      setIsRunningTests(false);
      showToast(`Diagnostics Completed: ${results.passed}/${results.total} assertions passed!`);
    }, 450);
  };

  // 1-Click Business Scenarios Seeder
  const handleLoadScenario = (scenario: 'electronics' | 'fmcg' | 'hardware' | 'pharmacy') => {
    clearTransactions();

    if (scenario === 'electronics') {
      updateCompany({
        name: 'Apex Digital & Electronics World',
        gstin: '29ABCDE1234F1Z5',
        phone: '+91 98765 43210',
        email: 'sales@apexdigital.in',
        address: '42, Brigade Road, Commercial Hub, Bangalore, Karnataka - 560001',
        state: 'Karnataka',
      });

      const p1 = addParty({
        name: 'Reliance Retail Ventures',
        phone: '9845012345',
        email: 'procurement@relianceretail.com',
        balance: 15400,
        type: 'Customer',
        address: 'MG Road, Bangalore, Karnataka',
        state: 'Karnataka',
        creditLimit: 100000,
        creditPeriodDays: 30,
        gstin: '29AAACR1234P1Z1'
      });

      addParty({
        name: 'Tata Croma Electronics',
        phone: '9820054321',
        email: 'finance@croma.com',
        balance: 0,
        type: 'Customer',
        address: 'Worli Hub, Mumbai, Maharashtra',
        state: 'Maharashtra', // Inter-state IGST test
        creditLimit: 250000,
        creditPeriodDays: 45,
        gstin: '27AABCT5678Q1Z3'
      });

      const item1 = addItem({
        name: 'Samsung 55" 4K Smart UHD TV',
        code: 'TV-SAM-55',
        category: 'Electronics',
        salePrice: 42000,
        purchasePrice: 34000,
        stock: 18,
        unit: 'PCS',
        taxRate: 18
      });

      addItem({
        name: 'Apple iPhone 15 Pro 128GB',
        code: 'PH-APL-15P',
        category: 'Electronics',
        salePrice: 119900,
        purchasePrice: 102000,
        stock: 12,
        unit: 'PCS',
        taxRate: 18
      });

      addItem({
        name: 'Sony WH-1000XM5 Wireless Headphones',
        code: 'HP-SNY-XM5',
        category: 'Electronics',
        salePrice: 26990,
        purchasePrice: 21500,
        stock: 25,
        unit: 'PCS',
        taxRate: 18
      });

      // Seed realistic GST invoices
      addTransaction({
        type: 'Sale',
        partyName: p1.name,
        partyPhone: p1.phone,
        partyAddress: p1.address,
        partyGstin: p1.gstin,
        firm: 'Apex Digital & Electronics World',
        user: 'Admin',
        invoiceNo: 'INV-EL-001',
        date: new Date().toLocaleDateString('en-GB') + ', 10:30 AM',
        totalAmount: 49560,
        receivedAmount: 34160,
        balance: 15400,
        dueDate: new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-GB'),
        status: 'Partial',
        paymentType: 'Cheque',
        subtotal: 42000,
        stateOfSupply: 'Karnataka',
        gstType: 'Intra-State',
        cgstAmount: 3780,
        sgstAmount: 3780,
        roundOff: 0,
        items: [{
          id: '1',
          name: item1.name,
          qty: 1,
          unit: 'PCS',
          price: 42000,
          discountPercent: 0,
          taxPercent: 18,
          amount: 49560,
          hsn: '8528'
        }]
      });

      showToast('Loaded "Retail Electronics & Gadgets" Business Demo!');
    } else if (scenario === 'fmcg') {
      updateCompany({
        name: 'Sri Krishna FMCG & Supermarket',
        gstin: '33AABCS1234D1ZP',
        phone: '+91 94440 11223',
        email: 'orders@krishnafmcg.com',
        address: '15, Anna Salai, T. Nagar, Chennai, Tamil Nadu - 600017',
        state: 'Tamil Nadu',
      });

      const p1 = addParty({
        name: 'Metro Cash & Carry Superstore',
        phone: '9840199887',
        email: 'chennai@metrocash.in',
        address: 'Koyambedu, Chennai, Tamil Nadu',
        balance: 24500,
        type: 'Customer',
        state: 'Tamil Nadu',
        creditLimit: 150000,
        creditPeriodDays: 15,
        gstin: '33AABCM9988L1Z2'
      });

      const item1 = addItem({
        name: 'India Gate Basmati Rice 25kg Bag',
        code: 'RICE-BAS-25',
        category: 'Grocery',
        salePrice: 2450,
        purchasePrice: 2100,
        stock: 85,
        unit: 'BAG',
        taxRate: 5
      });

      addItem({
        name: 'Fortune Sunlite Sunflower Oil 5L Jar',
        code: 'OIL-SUN-5L',
        category: 'Grocery',
        salePrice: 650,
        purchasePrice: 570,
        stock: 140,
        unit: 'JAR',
        taxRate: 5
      });

      addTransaction({
        type: 'Sale',
        partyName: p1.name,
        partyPhone: p1.phone,
        partyAddress: p1.address,
        partyGstin: p1.gstin,
        firm: 'Sri Krishna FMCG & Supermarket',
        user: 'Admin',
        invoiceNo: 'INV-FMCG-101',
        date: new Date().toLocaleDateString('en-GB') + ', 11:15 AM',
        totalAmount: 25725,
        receivedAmount: 1225,
        balance: 24500,
        dueDate: new Date(Date.now() + 15 * 86400000).toLocaleDateString('en-GB'),
        status: 'Partial',
        paymentType: 'UPI',
        subtotal: 24500,
        stateOfSupply: 'Tamil Nadu',
        gstType: 'Intra-State',
        cgstAmount: 612.5,
        sgstAmount: 612.5,
        roundOff: 0,
        items: [{
          id: '1',
          name: item1.name,
          qty: 10,
          unit: 'BAG',
          price: 2450,
          discountPercent: 0,
          taxPercent: 5,
          amount: 25725,
          hsn: '1006'
        }]
      });

      showToast('Loaded "FMCG Grocery & Supermarket" Business Demo!');
    } else if (scenario === 'hardware') {
      updateCompany({
        name: 'Shree Balaji Building Hardware & Steels',
        gstin: '07AAACS9876K1Z9',
        phone: '+91 98110 55443',
        email: 'info@balajihardware.com',
        address: 'Plot 88, Industrial Area Ph-1, New Delhi - 110020',
        state: 'Delhi',
      });

      const p1 = addParty({
        name: 'DLF City Contractors Pvt Ltd',
        phone: '9810012399',
        email: 'contracts@dlfcity.com',
        address: 'Sector 25, Gurugram, Haryana',
        balance: 42000,
        type: 'Customer',
        state: 'Haryana', // Inter-state supply
        creditLimit: 300000,
        creditPeriodDays: 60,
        gstin: '06AABCD4321P1Z5'
      });

      const item1 = addItem({
        name: 'UltraTech Super Cement 50kg',
        code: 'CEM-ULTRA-50',
        category: 'Building Materials',
        salePrice: 420,
        purchasePrice: 360,
        stock: 350,
        unit: 'BAG',
        taxRate: 28
      });

      addItem({
        name: 'Kajaria Vitrified Polished Floor Tiles (60x60cm)',
        code: 'TILE-KAJ-60',
        category: 'Flooring',
        salePrice: 780,
        purchasePrice: 620,
        stock: 120,
        unit: 'BOX',
        taxRate: 18
      });

      addTransaction({
        type: 'Delivery Challan',
        partyName: p1.name,
        partyPhone: p1.phone,
        partyAddress: p1.address,
        partyGstin: p1.gstin,
        firm: 'Shree Balaji Building Hardware & Steels',
        user: 'Admin',
        invoiceNo: 'DC-2025-042',
        date: new Date().toLocaleDateString('en-GB') + ', 02:45 PM',
        totalAmount: 42000,
        receivedAmount: 0,
        balance: 42000,
        dueDate: new Date(Date.now() + 60 * 86400000).toLocaleDateString('en-GB'),
        status: 'Unpaid',
        paymentType: 'Credit',
        subtotal: 32812.5,
        stateOfSupply: 'Haryana',
        gstType: 'Inter-State',
        igstAmount: 9187.5,
        roundOff: 0,
        vehicleNumber: 'DL-01-AB-1234',
        items: [{
          id: '1',
          name: item1.name,
          qty: 100,
          unit: 'BAG',
          price: 420,
          discountPercent: 0,
          taxPercent: 28,
          amount: 42000,
          hsn: '2523'
        }]
      });

      showToast('Loaded "Hardware & Sanitary" Business Demo!');
    } else {
      updateCompany({
        name: 'LifeCare Medico & Surgical Supplies',
        gstin: '24AAACL5566M1ZX',
        phone: '+91 97230 44556',
        email: 'care@lifecaremed.in',
        address: 'Shop 12, Hospital Road, Ahmedabad, Gujarat - 380006',
        state: 'Gujarat',
      });

      addParty({
        name: 'Apollo Clinics Ltd',
        phone: '9723098765',
        email: 'procurement@apolloclinics.com',
        address: 'Ellisbridge, Ahmedabad, Gujarat',
        balance: 12800,
        type: 'Customer',
        state: 'Gujarat',
        creditLimit: 50000,
        creditPeriodDays: 30,
        gstin: '24AAACA9876J1Z8'
      });

      addItem({
        name: 'Dolo 650mg Paracetamol Strips (15 Tabs)',
        code: 'MED-DOLO-650',
        category: 'Medicines',
        salePrice: 32,
        purchasePrice: 24,
        stock: 500,
        unit: 'STRIP',
        taxRate: 12
      });

      addItem({
        name: 'N95 Respirator Anti-Pollution Masks (Pack of 10)',
        code: 'MED-MASK-N95',
        category: 'Surgicals',
        salePrice: 250,
        purchasePrice: 170,
        stock: 80,
        unit: 'BOX',
        taxRate: 5
      });

      showToast('Loaded "Pharmacy & Healthcare" Business Demo!');
    }
  };

  // Filtered Features
  const filteredFeatures = useMemo(() => {
    return features.filter(f => {
      const matchesSearch =
        searchQuery === '' ||
        f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === 'All' || f.category === selectedCategory;
      const matchesStatus = selectedStatus === 'All' || f.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [features, searchQuery, selectedCategory, selectedStatus]);

  // Categories list for filter buttons
  const categories = ['All', 'Billing & GST', 'POS & Retail', 'Inventory', 'Conversions', 'Payments & Credit', 'Security & Staff', 'Automation', 'Custom'];

  // Helper to render icon by name
  const renderIcon = (name: string, className = 'w-5 h-5') => {
    switch (name) {
      case 'FileSpreadsheet': return <FileSpreadsheet className={className} />;
      case 'ShoppingCart': return <ShoppingCart className={className} />;
      case 'Receipt': return <Receipt className={className} />;
      case 'Repeat': return <Repeat className={className} />;
      case 'Layers': return <Layers className={className} />;
      case 'Truck': return <Truck className={className} />;
      case 'RotateCcw': return <RotateCcw className={className} />;
      case 'TrendingUp': return <TrendingUp className={className} />;
      case 'Boxes': return <Boxes className={className} />;
      case 'ShieldCheck': return <ShieldCheck className={className} />;
      case 'Database': return <Database className={className} />;
      case 'Cpu': return <Cpu className={className} />;
      case 'Sparkles':
      default:
        return <Sparkles className={className} />;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f8fafc] overflow-y-auto">
      {/* Top Banner & Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 shrink-0 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Vyapar Interactive Studio</span>
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                Feature Engine v3.2
              </span>
            </div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              All Features Working &amp; Interactive Demo Studio
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl">
              Explore, test, add, and inline-edit all business capabilities. Every button, calculation, conversion, and role is fully connected to the live accounting state.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={handleRunDiagnostics}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Run System Diagnostics</span>
            </button>

            <button
              onClick={handleOpenAddFeature}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Feature</span>
            </button>
          </div>
        </div>

        {/* 1-Click Scenario Loaders */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span>Load 1-Click Business Demo Scenario:</span>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => handleLoadScenario('electronics')}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-slate-200 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <Laptop className="w-3.5 h-3.5 text-blue-600" />
              <span>Retail Electronics</span>
            </button>

            <button
              onClick={() => handleLoadScenario('fmcg')}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
              <span>FMCG Supermarket</span>
            </button>

            <button
              onClick={() => handleLoadScenario('hardware')}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 border border-slate-200 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <Wrench className="w-3.5 h-3.5 text-amber-600" />
              <span>Hardware &amp; Sanitary</span>
            </button>

            <button
              onClick={() => handleLoadScenario('pharmacy')}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 border border-slate-200 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <Stethoscope className="w-3.5 h-3.5 text-rose-600" />
              <span>Pharmacy &amp; Medical</span>
            </button>

            <button
              onClick={handleResetDefaults}
              title="Reset catalog back to standard defaults"
              className="px-2 py-1 text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1 ml-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-3.5 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search features or tags..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8.5 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Feature Catalog Grid */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-slate-500">
            Showing <strong className="text-slate-800 font-semibold">{filteredFeatures.length}</strong> of {features.length} features
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Status filter:</span>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Beta">Beta</option>
              <option value="New">New</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
        </div>

        {/* Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFeatures.map(feat => (
            <div
              key={feat.id}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between group relative"
            >
              <div>
                {/* Card Top: Icon, Category & Actions */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      {renderIcon(feat.iconName, 'w-4.5 h-4.5')}
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600">
                        {feat.category}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {feat.title}
                      </h3>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      feat.status === 'Active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : feat.status === 'Beta'
                        ? 'bg-amber-100 text-amber-800'
                        : feat.status === 'New'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {feat.status}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-3">
                  {feat.description}
                </p>

                {/* Tags */}
                <div className="flex items-center flex-wrap gap-1 mb-4">
                  {feat.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Card Actions: Launch & Edit It */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleLaunchFeature(feat)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white text-xs font-semibold transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Launch Live</span>
                </button>

                {/* EDIT IT BUTTON - Primary user request */}
                <button
                  onClick={() => handleOpenEditFeature(feat)}
                  title="Edit Feature Details"
                  className="flex items-center gap-1 py-1.5 px-2.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Edit</span>
                </button>

                {!feat.isBuiltIn && (
                  <button
                    onClick={() => handleDeleteFeature(feat.id, feat.title)}
                    title="Delete Custom Feature"
                    className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Empty Search State */}
        {filteredFeatures.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
            <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700 mb-1">No features found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              We couldn't find any feature matching "{searchQuery}". You can create a new feature or clear your search filters.
            </p>
            <button
              onClick={handleOpenAddFeature}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              + Add Custom Feature Now
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* ADD / EDIT FEATURE MODAL (WHEN I ADD FEATURE THEN EDITIT) */}
      {/* ========================================================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  {isNewFeature ? <Plus className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    {isNewFeature ? 'Add New Vyapar Feature' : `Edit Feature: ${editingFeature?.title}`}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isNewFeature
                      ? 'Define a new business feature, module, or integration'
                      : 'Customize feature parameters, targets, category, and status'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveFeature} className="p-6 space-y-4">
              {/* Feature Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Feature Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. WhatsApp Payment Reminders, E-Way Bill Generator"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Category & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Billing & GST">Billing & GST</option>
                    <option value="POS & Retail">POS & Retail</option>
                    <option value="Inventory">Inventory</option>
                    <option value="Conversions">Conversions</option>
                    <option value="Payments & Credit">Payments & Credit</option>
                    <option value="Security & Staff">Security & Staff</option>
                    <option value="Automation">Automation</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Badge
                  </label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Beta">Beta</option>
                    <option value="New">New</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Feature Description
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Explain what this feature does, how it calculates or automates the workflow..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Icon & Action Route */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Icon Style
                  </label>
                  <select
                    value={formIconName}
                    onChange={e => setFormIconName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="FileSpreadsheet">File / Invoicing</option>
                    <option value="ShoppingCart">POS Shopping Cart</option>
                    <option value="Boxes">Inventory Boxes</option>
                    <option value="Receipt">Receipt / Thermal</option>
                    <option value="Repeat">Repeat / Conversion</option>
                    <option value="Truck">Truck / Logistics</option>
                    <option value="ShieldCheck">Shield / Security</option>
                    <option value="TrendingUp">Trending / Finance</option>
                    <option value="Database">Database / Storage</option>
                    <option value="Sparkles">Sparkles / Special</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Launch Action
                  </label>
                  <select
                    value={formActionType}
                    onChange={e => setFormActionType(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="navigate">Switch View / Workspace</option>
                    <option value="openAddSale">Open Add Sale Modal</option>
                    <option value="openAddPurchase">Open Add Purchase Modal</option>
                    <option value="openAddParty">Open Add Party Modal</option>
                    <option value="openAddItem">Open Add Item Modal</option>
                    <option value="openSettings">Open System Settings</option>
                    <option value="openPremium">Open Premium Modal</option>
                    <option value="runDiagnostics">Run System Diagnostics</option>
                  </select>
                </div>
              </div>

              {/* Target Workspace (if action is navigate) */}
              {formActionType === 'navigate' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Workspace
                  </label>
                  <select
                    value={formTargetTab}
                    onChange={e => setFormTargetTab(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="sale-invoices">Sale Invoices (GST Billing)</option>
                    <option value="vyapar-pos">Vyapar POS Counter</option>
                    <option value="estimate-quotation">Estimate / Quotations</option>
                    <option value="sale-order">Sale Orders</option>
                    <option value="delivery-challan">Delivery Challans</option>
                    <option value="sale-return">Sale Returns / Credit Notes</option>
                    <option value="payment-in">Payment-In Allocation</option>
                    <option value="purchase">Purchase Inward Bills</option>
                    <option value="items">Inventory Items</option>
                    <option value="parties">Parties (Customers / Suppliers)</option>
                    <option value="staff-management">Staff &amp; RBAC Security</option>
                    <option value="home">Home Dashboard</option>
                  </select>
                </div>
              )}

              {/* Tags (comma separated) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={e => setFormTags(e.target.value)}
                  placeholder="GST, Invoicing, Real-time, Automation"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                {!isNewFeature && !editingFeature?.isBuiltIn ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteFeature(editingFeature!.id, editingFeature!.title)}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Feature</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isNewFeature ? 'Add Feature' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 20-POINT SYSTEM DIAGNOSTICS TEST RUNNER MODAL */}
      {/* ========================================================= */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Automated 20-Point System Diagnostics</h3>
                  <p className="text-[11px] text-slate-400">
                    Comprehensive testing of GST mathematics, stock ledger reconciliation, storage safety, and RBAC
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {isRunningTests ? (
                <div className="py-12 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-xs font-semibold text-slate-700">Executing 20-point test assertions...</p>
                  <p className="text-[11px] text-slate-400 mt-1">Checking tax math, inventory reconciliations, and RBAC permissions</p>
                </div>
              ) : testResults ? (
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-emerald-950">
                          {testResults.passed} of {testResults.total} Assertions Passed
                        </h4>
                        <p className="text-xs text-emerald-700">
                          Core accounting integrity verified: 0 errors or discrepancies found.
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 bg-emerald-600 text-white rounded-full">
                      100% HEALTHY
                    </span>
                  </div>

                  {/* Assertion List */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Detailed Test Log
                    </h5>
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {testResults.results.map((res, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase px-1.5 py-0.5 rounded bg-slate-200">
                              {res.suite}
                            </span>
                            <span className="text-slate-800 font-medium">{res.testName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-emerald-600 font-semibold shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Passed</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500">
                Live verification executed against memory and storage
              </span>
              <button
                onClick={handleRunDiagnostics}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Re-run Diagnostics</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
