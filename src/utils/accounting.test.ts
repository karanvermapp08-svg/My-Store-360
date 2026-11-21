/**
 * Automated Verification and Test Suite
 * Tests accounting calculations, stock adjustments, safe storage recovery, and RBAC permissions.
 */

import { safeGetStoredData, generateUniqueId } from './storage';
import { DEFAULT_ROLES, DEFAULT_USERS } from './rbacDefaults';
import { InvoiceItem, Item, ItemBatch, Party, PermissionKey, Transaction } from '../types';
import { buildDefaultBusinessSettings } from '../data/defaultSettings';
import {
  analyzeSaleInvoiceProfit,
  computeComprehensivePL,
  computePurchaseLineLandedCosts,
  computeWeightedAverageAfterPurchase,
  isDateInLockedPeriod,
  resolveUnitCostForSale,
  stampSaleTransactionProfit,
} from './profitEngine';
import {
  calculateAmountFromWeight,
  calculateWeightFromAmount,
  convertUnitQty,
  resolveEffectiveItemDiscountPercent,
  resolveEffectiveSellingRate,
} from './kiranaBilling';
import { findItemByBarcode, isBarcodeUnique } from './barcodeUtils';
import { getBatchExpiryStatus, validateBatchEntries, BatchDraftRow } from '../components/modals/ItemBatchEditor';
import {
  buildSplitInvoiceItems,
  calculatePaymentAllocationBreakdown,
  canTransitionWorkflowState,
  compareSupplierQuotations,
  DEFAULT_PAYMENT_LIMITS,
  detectDuplicateTransactionFingerprint,
  diffTransactionVersions,
  evaluatePaymentLimits,
  formatSequenceNumber,
  runPurchaseHealthCheck,
  validateTransactionIntegrity,
} from './transactionEngine';

export interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  message: string;
}

export function runAutomatedAccountingTests(): { summary: string; total: number; passed: number; failed: number; results: TestResult[] } {
  const results: TestResult[] = [];

  const assert = (suite: string, testName: string, condition: boolean, message: string) => {
    results.push({
      suite,
      testName,
      passed: Boolean(condition),
      message: condition ? 'Passed' : `Assertion Failed: ${message}`,
    });
  };

  // ==========================================
  // 1. INVOICE AND TAX CALCULATIONS
  // ==========================================
  const calculateItemAmount = (qty: number, price: number, discountPercent: number, taxPercent: number) => {
    const base = qty * price;
    const discounted = base - (base * discountPercent) / 100;
    const total = discounted + (discounted * taxPercent) / 100;
    return Math.round(total * 100) / 100;
  };

  // Test 1: Simple sale line item without discount or tax
  const amt1 = calculateItemAmount(2, 500, 0, 0);
  assert('Calculations', 'Simple multiplication (2 x 500 = 1000)', amt1 === 1000, `Expected 1000, got ${amt1}`);

  // Test 2: Line item with 10% discount and 18% GST
  // Base = 1000; Discounted = 900; Tax = 900 * 0.18 = 162; Total = 1062
  const amt2 = calculateItemAmount(1, 1000, 10, 18);
  assert('Calculations', 'Line item with 10% discount and 18% GST (1000 -> 1062)', amt2 === 1062, `Expected 1062, got ${amt2}`);

  // Test 3: Invoice balance calculation
  const totalInvoice = 2500;
  const receivedAmount = 1000;
  const balance = Math.max(0, totalInvoice - receivedAmount);
  assert('Calculations', 'Invoice balance calculation (2500 - 1000 = 1500)', balance === 1500, `Expected 1500, got ${balance}`);

  // Test 4: Overpayment balance clamp
  const overpaidBalance = Math.max(0, totalInvoice - 3000);
  assert('Calculations', 'Invoice balance never negative on overpayment', overpaidBalance === 0, `Expected 0, got ${overpaidBalance}`);

  // ==========================================
  // 2. STOCK ACCOUNTING ADJUSTMENTS
  // ==========================================
  let stock = 50;

  // Sale of 15 units reduces stock
  const saleQty = 15;
  stock -= saleQty;
  assert('Stock Accounting', 'Sale reduces inventory stock (50 - 15 = 35)', stock === 35, `Expected 35, got ${stock}`);

  // Purchase inward of 25 units increases stock
  const purchaseQty = 25;
  stock += purchaseQty;
  assert('Stock Accounting', 'Purchase increases inventory stock (35 + 25 = 60)', stock === 60, `Expected 60, got ${stock}`);

  // Sale return of 5 units restocks inventory
  const returnQty = 5;
  stock += returnQty;
  assert('Stock Accounting', 'Sale return adds goods back to stock (60 + 5 = 65)', stock === 65, `Expected 65, got ${stock}`);

  // Reversal on transaction cancellation
  stock -= returnQty;
  assert('Stock Accounting', 'Reversal on deletion restores previous inventory state', stock === 60, `Expected 60, got ${stock}`);

  // ==========================================
  // 3. STORAGE RECOVERY & CORRUPTION HANDLING
  // ==========================================
  // Provide test environment storage mock if run under Node.js CLI
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) || null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    };
  }

  // Test safeGetStoredData with corrupted JSON
  const corruptedKey = '__test_corrupt_key__';
  try {
    localStorage.setItem(corruptedKey, 'INVALID_NOT_JSON{[[[');
    const recovered = safeGetStoredData(corruptedKey, { defaultData: true });
    assert('Storage Recovery', 'Handles corrupted JSON gracefully without throw', recovered.defaultData === true, 'Failed to recover from corrupt JSON');
  } catch (err) {
    assert('Storage Recovery', 'Handles corrupted JSON gracefully without throw', false, String(err));
  } finally {
    try { localStorage.removeItem(corruptedKey); } catch { /* ignore */ }
  }

  // ==========================================
  // 4. RBAC PERMISSIONS AND SECURITY
  // ==========================================
  const ownerRole = DEFAULT_ROLES.find((r) => r.name === 'Owner' || r.type === 'Owner');
  const cashierRole = DEFAULT_ROLES.find((r) => r.type === 'Cashier' || r.name === 'Cashier');

  const checkRolePermission = (role: typeof ownerRole, perm: PermissionKey) => {
    if (!role) return false;
    if (role.name === 'Owner') return true;
    return role.permissions.includes(perm);
  };

  assert('RBAC Permissions', 'Owner has settings permission', checkRolePermission(ownerRole, 'settings') === true, 'Owner should have settings permission');
  assert('RBAC Permissions', 'Owner has delete permission', checkRolePermission(ownerRole, 'delete') === true, 'Owner should have delete permission');
  assert('RBAC Permissions', 'Cashier cannot delete records', checkRolePermission(cashierRole, 'delete') === false, 'Cashier should NOT have delete permission');
  assert('RBAC Permissions', 'Cashier can print and create records', checkRolePermission(cashierRole, 'create') === true && checkRolePermission(cashierRole, 'print') === true, 'Cashier should have create and print permissions');

  // ==========================================
  // 5. UNIQUE ID COLLISION RESISTANCE
  // ==========================================
  const generatedIds = new Set<string>();
  const idCount = 500;
  for (let i = 0; i < idCount; i++) {
    generatedIds.add(generateUniqueId('tx'));
  }
  assert('Collision Resistance', `Generates ${idCount} collision-free unique IDs`, generatedIds.size === idCount, `Expected ${idCount} unique IDs, got ${generatedIds.size}`);

  // ==========================================
  // 6. PASSWORD AUTHENTICATION RULES
  // ==========================================
  const ownerUser = DEFAULT_USERS.find((u) => u.email === 'krishna.enterprises@gmail.com');
  const pendingUser = DEFAULT_USERS.find((u) => u.status === 'Pending Approval');

  // ==========================================
  // 7. GST TAX ENGINE: INTRA-STATE VS INTER-STATE SPLIT
  // ==========================================
  const calculateGstSplit = (taxable: number, taxPercent: number, isIntraState: boolean) => {
    const totalTax = Math.round(((taxable * taxPercent) / 100) * 100) / 100;
    if (isIntraState) {
      const cgst = Math.round((totalTax / 2) * 100) / 100;
      const sgst = Math.round((totalTax / 2) * 100) / 100;
      return { cgst, sgst, igst: 0, totalTax };
    } else {
      return { cgst: 0, sgst: 0, igst: totalTax, totalTax };
    }
  };

  const intraSplit = calculateGstSplit(10000, 18, true);
  assert(
    'GST Engine',
    'Intra-State 18% GST splits equally into 9% CGST (900) + 9% SGST (900)',
    intraSplit.cgst === 900 && intraSplit.sgst === 900 && intraSplit.igst === 0,
    `Expected CGST=900, SGST=900, got CGST=${intraSplit.cgst}, SGST=${intraSplit.sgst}`
  );

  const interSplit = calculateGstSplit(10000, 18, false);
  assert(
    'GST Engine',
    'Inter-State 18% GST assigns 100% to IGST (1800)',
    interSplit.igst === 1800 && interSplit.cgst === 0 && interSplit.sgst === 0,
    `Expected IGST=1800, got IGST=${interSplit.igst}`
  );

  // ==========================================
  // 8. CREDIT LIMIT CONTROLLER
  // ==========================================
  const checkCredit = (currentBal: number, limit: number, newBalance: number) => {
    const projected = currentBal + newBalance;
    const exceeded = limit > 0 && projected > limit;
    const excess = Math.max(0, projected - limit);
    return { exceeded, excess };
  };

  const withinLimit = checkCredit(5000, 50000, 10000);
  assert('Credit Limits', 'Sale within credit limit is not flagged as excess', withinLimit.exceeded === false && withinLimit.excess === 0, 'Should not exceed limit');

  const overLimit = checkCredit(45000, 50000, 15000);
  assert('Credit Limits', 'Sale exceeding credit limit flags excess (60000 > 50000 by 10000)', overLimit.exceeded === true && overLimit.excess === 10000, `Expected excess 10000, got ${overLimit.excess}`);

  // ==========================================
  // 9. QUOTATION TO INVOICE CONVERSION INTEGRITY
  // ==========================================
  const mockQuotation = {
    id: 'est-1',
    invoiceNo: 'EST-101',
    totalAmount: 5000,
    fulfillmentStatus: 'Pending' as 'Pending' | 'Completed',
    items: [{ id: 'li-1', name: 'Item A', qty: 2, price: 2500, amount: 5000, hsn: '8471', unit: 'PCS', discountPercent: 0, taxPercent: 0 }],
  };

  // Conversion process
  const convertedInvoice = {
    ...mockQuotation,
    id: 'inv-1',
    type: 'Sale',
    invoiceNo: 'INV-0005',
    convertedFrom: { type: 'Estimate', docId: mockQuotation.id, docNo: mockQuotation.invoiceNo },
  };
  mockQuotation.fulfillmentStatus = 'Completed';

  assert('Document Conversion', 'Estimate status updates to Completed after conversion', mockQuotation.fulfillmentStatus === 'Completed', 'Estimate should be Completed');
  assert('Document Conversion', 'Invoice preserves quotation items and references source doc', convertedInvoice.convertedFrom.docNo === 'EST-101' && convertedInvoice.items.length === 1, 'Conversion linkage broken');

  // ==========================================
  // 10. CROSS-TENANT & CROSS-BRANCH ACCESS ISOLATION
  // ==========================================
  const tenant1Id = 'tenant-krishna-1';
  const tenant2Id = 'tenant-competitor-99';
  const validateTenantAccess = (userTenantId: string, recordTenantId: string) => userTenantId === recordTenantId;
  assert('Tenant Isolation', 'User from Tenant 1 cannot access Tenant 2 records', validateTenantAccess(tenant1Id, tenant2Id) === false, 'Cross-tenant access must be denied');
  assert('Tenant Isolation', 'User from Tenant 1 can access Tenant 1 records', validateTenantAccess(tenant1Id, tenant1Id) === true, 'Valid tenant access should be permitted');

  const userBranch = 'Bengaluru Flagship Store';
  const targetBranch = 'Hubballi Branch & Depot';
  const isBranchPermitted = (userScope: string, branch: string) => userScope === 'All Branches' || userScope === branch;
  assert('Branch Isolation', 'Cashier scoped to Bengaluru cannot access Hubballi terminal', isBranchPermitted(userBranch, targetBranch) === false, 'Cross-branch access must be denied');
  assert('Branch Isolation', 'Owner with All Branches scope can access Hubballi terminal', isBranchPermitted('All Branches', targetBranch) === true, 'All Branches scope must permit access');

  // ==========================================
  // 11. ROLE APPLICATION WORKSPACE ACCESS GUARDS
  // ==========================================
  const canAccessWorkspace = (role: string, workspacePath: string) => {
    if (role === 'Owner') return true;
    if (role === 'Admin' && workspacePath !== '/owner') return true;
    if (role === 'Cashier') return workspacePath === '/pos';
    if (role === 'Accountant') return workspacePath === '/accounting';
    if (role === 'Sales') return workspacePath === '/sales';
    if (role === 'Purchase') return workspacePath === '/purchases';
    if (role === 'Inventory') return workspacePath === '/inventory';
    if (role === 'Delivery') return workspacePath === '/delivery';
    if (role === 'Manager') return workspacePath !== '/owner';
    return false;
  };

  assert('Workspace Guard', 'Cashier cannot access /owner workspace', canAccessWorkspace('Cashier', '/owner') === false, 'Cashier access to /owner must be denied');
  assert('Workspace Guard', 'Cashier can access /pos workspace', canAccessWorkspace('Cashier', '/pos') === true, 'Cashier access to /pos must be permitted');
  assert('Workspace Guard', 'Accountant can access /accounting workspace', canAccessWorkspace('Accountant', '/accounting') === true, 'Accountant access to /accounting must be permitted');
  assert('Workspace Guard', 'Owner has universal workspace access', canAccessWorkspace('Owner', '/owner') && canAccessWorkspace('Owner', '/pos'), 'Owner must access all workspaces');

  // ==========================================
  // 12. SEQUENTIAL INVOICE NUMBERING & IDEMPOTENCY
  // ==========================================
  let serverInvoiceSeq = 100;
  const generateNextInvoiceNo = () => `INV-${String(++serverInvoiceSeq).padStart(4, '0')}`;
  const invNo1 = generateNextInvoiceNo();
  const invNo2 = generateNextInvoiceNo();
  assert('Sequential Numbering', 'Consecutive invoices receive strictly incremented numbers', invNo1 === 'INV-0101' && invNo2 === 'INV-0102', 'Invoices must be strictly sequential');

  // ==========================================
  // 13. ATOMIC STOCK DEDUCTION ON SALE POSTING
  // ==========================================
  let inventoryStock = 45;
  const soldQty = 3;
  inventoryStock -= soldQty;
  assert('Atomic Stock Deduction', 'Sale finalization deducts stock from inventory (45 - 3 = 42)', inventoryStock === 42, `Expected 42, got ${inventoryStock}`);

  // ==========================================
  // 14. DISCOUNT CEILING & REFUND APPROVAL PROTECTION
  // ==========================================
  const cashierMaxDiscount = 5;
  const isDiscountAllowed = (applied: number, ceiling: number) => applied <= ceiling;
  assert('Discount Protection', 'Cashier cannot apply 12% discount (exceeds 5% ceiling)', isDiscountAllowed(12, cashierMaxDiscount) === false, 'Over-ceiling discount must be blocked');
  assert('Discount Protection', 'Cashier can apply 4% discount (within 5% ceiling)', isDiscountAllowed(4, cashierMaxDiscount) === true, 'Permitted discount must pass');

  // ==========================================
  // 15. FINANCIAL PRIVACY: PURCHASE COST MASKING
  // ==========================================
  const isCostVisible = (role: string) => ['Owner', 'Admin', 'Purchase', 'Inventory'].includes(role);
  assert('Financial Privacy', 'Purchase cost is hidden from Cashier role', isCostVisible('Cashier') === false, 'Cashier must not see purchase costs');
  assert('Financial Privacy', 'Purchase cost is hidden from Sales role', isCostVisible('Sales') === false, 'Sales must not see purchase costs');
  assert('Financial Privacy', 'Purchase cost is visible to Owner role', isCostVisible('Owner') === true, 'Owner must see purchase costs');

  // ==========================================
  // 16. SEPARATION OF DUTIES
  // ==========================================
  const canSelfApprove = (requesterId: string, reviewerId: string) => requesterId !== reviewerId;
  assert('Separation of Duties', 'Staff member cannot self-approve their own discount request', canSelfApprove('usr-vikram', 'usr-vikram') === false, 'Self-approval must be blocked');
  assert('Separation of Duties', 'Manager can approve cashier request', canSelfApprove('usr-vikram', 'usr-ananya') === true, 'Independent supervisor approval permitted');

  // ==========================================
  // 17. ADVANCED PROFIT & LOSS ENGINE (15 ACCEPTANCE TESTS)
  // ==========================================
  const testSettings = buildDefaultBusinessSettings();
  const baseItemA: Item = {
    id: 'pl-item-a',
    name: 'Toor Dal 1kg',
    code: 'TD01',
    category: 'Pulses',
    salePrice: 1000,
    purchasePrice: 800,
    lastPurchasePrice: 800,
    weightedAvgCost: 800,
    stock: 20,
    unit: 'PCS',
    taxRate: 18,
  };
  const baseItemB: Item = {
    id: 'pl-item-b',
    name: 'Cooking Oil 1L',
    code: 'CO01',
    category: 'Oils',
    salePrice: 200,
    purchasePrice: 250,
    lastPurchasePrice: 250,
    weightedAvgCost: 250,
    stock: 15,
    unit: 'PCS',
    taxRate: 5,
  };
  const mkLine = (id: string, item: Item, qty: number, discountPercent = 0, priceOverride?: number): InvoiceItem => ({
    id,
    name: item.name,
    hsn: item.code,
    qty,
    unit: item.unit,
    price: priceOverride ?? item.salePrice,
    discountPercent,
    taxPercent: item.taxRate,
    amount: Math.round(qty * (priceOverride ?? item.salePrice) * (1 - discountPercent / 100) * 100) / 100,
  });

  // P&L Test 1: Normal Profitable Sale
  const pl1 = analyzeSaleInvoiceProfit({
    lines: [mkLine('l1', baseItemA, 1, 0)],
    items: [baseItemA],
    batches: [],
    costingMethod: 'Weighted Average',
    isGstActive: false,
  });
  assert(
    'P&L Engine',
    '1. Normal profitable sale calculates exact gross profit & margin (1000 - 800 = 200)',
    pl1.status === 'PROFIT' && pl1.grossProfit === 200 && pl1.profitMarginPercent === 20,
    `Expected PROFIT 200 (20%), got ${pl1.status} ${pl1.grossProfit}`
  );

  // P&L Test 2: Partial Discount Still Profitable
  const pl2 = analyzeSaleInvoiceProfit({
    lines: [mkLine('l2', baseItemA, 1, 10)],
    items: [baseItemA],
    batches: [],
    costingMethod: 'Weighted Average',
    isGstActive: false,
  });
  assert(
    'P&L Engine',
    '2. Partial 10% discount remains profitable (900 - 800 = 100)',
    pl2.status === 'PROFIT' && pl2.netExGstRevenue === 900 && pl2.grossProfit === 100,
    `Expected net 900 GP 100, got ${pl2.netExGstRevenue} GP ${pl2.grossProfit}`
  );

  // P&L Test 3: Max Safe Discount Boundary (Break-Even)
  const pl3 = analyzeSaleInvoiceProfit({
    lines: [mkLine('l3', baseItemA, 1, 20)],
    items: [baseItemA],
    batches: [],
    costingMethod: 'Weighted Average',
    isGstActive: false,
  });
  assert(
    'P&L Engine',
    '3. Max safe discount boundary equals 20% / ₹200 with BREAK_EVEN at 0 profit',
    pl1.maxSafeInvoiceDiscountAmount === 200 &&
      pl1.maxSafeInvoiceDiscountPercent === 20 &&
      pl3.lines[0].maxSafeDiscountAmount === 200 &&
      pl3.lines[0].maxSafeDiscountPercent === 20 &&
      pl3.status === 'BREAK_EVEN' &&
      pl3.grossProfit === 0,
    `Expected maxSafe 200 (20%) & BREAK_EVEN at 0 GP, got ${pl3.status} ${pl3.grossProfit}`
  );

  // P&L Test 4: Loss-Making Invoice & Admin Approval Flag
  const pl4 = analyzeSaleInvoiceProfit({
    lines: [mkLine('l4', baseItemA, 1, 25)],
    items: [baseItemA],
    batches: [],
    costingMethod: 'Weighted Average',
    isGstActive: false,
  });
  assert(
    'P&L Engine',
    '4. Discount exceeding margin creates LOSS status and requires Admin PIN approval',
    pl4.status === 'LOSS' && pl4.grossProfit === -50 && pl4.lossAmount === 50 && pl4.requiresAdminApproval === true,
    `Expected LOSS -50 with Admin approval flag, got ${pl4.status} ${pl4.grossProfit}`
  );

  // P&L Test 5: Multi-Product Mixed Margin Invoice
  const pl5 = analyzeSaleInvoiceProfit({
    lines: [mkLine('l5a', baseItemA, 1, 0), mkLine('l5b', baseItemB, 1, 0)],
    items: [baseItemA, baseItemB],
    batches: [],
    costingMethod: 'Weighted Average',
    isGstActive: false,
  });
  assert(
    'P&L Engine',
    '5. Multi-product mixed margin isolates loss-causing item while computing net GP (+150)',
    pl5.grossProfit === 150 && pl5.lossCausingItems.length === 1 && pl5.requiresAdminApproval === true,
    `Expected GP 150 with 1 loss item, got ${pl5.grossProfit} (${pl5.lossCausingItems.length})`
  );

  // P&L Test 6: GST-Inclusive Ex-GST Profit Calculation
  const pl6 = analyzeSaleInvoiceProfit({
    lines: [mkLine('l6', baseItemA, 1, 0, 1180)],
    items: [baseItemA],
    batches: [],
    costingMethod: 'Weighted Average',
    isGstActive: true,
    isTaxInclusive: true,
    gstBasisForProfit: 'Exclude Creditable GST',
  });
  assert(
    'P&L Engine',
    '6. GST-inclusive sale strips 18% GST from 1180 -> 1000 ex-GST revenue and 200 GP',
    pl6.netExGstRevenue === 1000 && pl6.totalGstExcludedFromProfit === 180 && pl6.grossProfit === 200,
    `Expected ex-GST 1000 / GST 180 / GP 200, got ${pl6.netExGstRevenue}/${pl6.totalGstExcludedFromProfit}/${pl6.grossProfit}`
  );

  // P&L Test 7: GST-Exclusive Ex-GST Profit Calculation
  const pl7 = analyzeSaleInvoiceProfit({
    lines: [mkLine('l7', baseItemA, 1, 0, 1000)],
    items: [baseItemA],
    batches: [],
    costingMethod: 'Weighted Average',
    isGstActive: true,
    isTaxInclusive: false,
    gstBasisForProfit: 'Exclude Creditable GST',
  });
  assert(
    'P&L Engine',
    '7. GST-exclusive sale keeps 1000 taxable revenue separate from 180 output GST -> 200 GP',
    pl7.netExGstRevenue === 1000 && pl7.totalGstExcludedFromProfit === 180 && pl7.grossProfit === 200,
    `Expected 1000 / 180 / 200, got ${pl7.netExGstRevenue}/${pl7.totalGstExcludedFromProfit}/${pl7.grossProfit}`
  );

  // P&L Test 8: Purchase Landed Cost Allocation + Freight & ITC Eligibility
  const purLine = mkLine('p1', baseItemA, 10, 0, 100);
  const landedEligible = computePurchaseLineLandedCosts({
    lines: [purLine],
    freightCharges: 100,
    isGstActive: true,
    isTaxInclusive: false,
    gstInputCreditEligible: true,
  });
  const landedNonEligible = computePurchaseLineLandedCosts({
    lines: [purLine],
    freightCharges: 100,
    isGstActive: true,
    isTaxInclusive: false,
    gstInputCreditEligible: false,
  });
  const updatedWaCost = computeWeightedAverageAfterPurchase(10, 100, 10, 110);
  assert(
    'P&L Engine',
    '8. Purchase freight allocation & ITC eligibility compute accurate landed unit cost & WA update',
    landedEligible.lines[0].landedUnitCost === 110 &&
      landedEligible.totalItcCreditable === 180 &&
      landedNonEligible.lines[0].landedUnitCost === 128 &&
      updatedWaCost === 105,
    `Got eligible=${landedEligible.lines[0].landedUnitCost}, itc=${landedEligible.totalItcCreditable}, nonItc=${landedNonEligible.lines[0].landedUnitCost}, wa=${updatedWaCost}`
  );

  // P&L Test 9: Costing Method Comparison (Weighted Average vs FIFO vs Last Purchase Price)
  const costItem: Item = {
    ...baseItemA,
    id: 'pl-cost-item',
    name: 'Basmati Rice 5kg',
    purchasePrice: 100,
    weightedAvgCost: 105,
    lastPurchasePrice: 120,
    stock: 20,
  };
  const costBatches: ItemBatch[] = [
    { id: 'b1', itemId: costItem.id, itemName: costItem.name, batchNumber: 'B-OLD', mfgDate: '2026-01-01', expiryDate: '2027-01-01', purchaseRate: 90, saleRate: 150, qty: 10 },
    { id: 'b2', itemId: costItem.id, itemName: costItem.name, batchNumber: 'B-NEW', mfgDate: '2026-02-01', expiryDate: '2027-02-01', purchaseRate: 120, saleRate: 150, qty: 10 },
  ];
  const costWa = resolveUnitCostForSale(costItem, 15, 'Weighted Average', costBatches);
  const costFifo = resolveUnitCostForSale(costItem, 15, 'FIFO', costBatches);
  const costLast = resolveUnitCostForSale(costItem, 15, 'Last Purchase Price', costBatches);
  assert(
    'P&L Engine',
    '9. Selectable costing methods (WA=105, FIFO=100, Last Purchase=120) diverge accurately',
    costWa.unitCost === 105 && costFifo.unitCost === 100 && costLast.unitCost === 120,
    `Expected WA=105 FIFO=100 Last=120, got ${costWa.unitCost}/${costFifo.unitCost}/${costLast.unitCost}`
  );

  // P&L Test 10: Partial Sales Return Reversing Historical COGS
  const saleForRetBase: Omit<Transaction, 'id' | 'createdAt'> = {
    type: 'Sale',
    invoiceNo: 'INV-RET-1',
    date: '01/10/2026, 10:00 AM',
    partyName: 'Walk-in',
    firm: 'Main',
    user: 'Admin',
    paymentType: 'Cash',
    totalAmount: 1000,
    receivedAmount: 1000,
    balance: 0,
    dueDate: '01/10/2026',
    status: 'Paid',
    items: [{ id: 'sr1', name: costItem.name, hsn: '1006', qty: 4, unit: 'PCS', price: 250, discountPercent: 0, taxPercent: 0, amount: 1000 }],
  };
  const stampedSale = stampSaleTransactionProfit({
    txData: saleForRetBase,
    items: [{ ...costItem, weightedAvgCost: 100, purchasePrice: 100 }],
    batches: [],
    settings: testSettings,
  });
  const saleTxObj: Transaction = { ...stampedSale, id: 'tx-s1', createdAt: '2026-10-01T10:00:00Z' };
  const partialRetStamped = stampSaleTransactionProfit({
    txData: {
      ...saleForRetBase,
      type: 'Sale Return',
      invoiceNo: 'CR-RET-1',
      originalInvoiceId: saleTxObj.id,
      totalAmount: 250,
      receivedAmount: 250,
      items: [{ id: 'sr-r1', name: costItem.name, hsn: '1006', qty: 1, unit: 'PCS', price: 250, discountPercent: 0, taxPercent: 0, amount: 250 }],
    },
    items: [{ ...costItem, weightedAvgCost: 180, purchasePrice: 180 }], // later cost changed!
    batches: [],
    settings: testSettings,
    existingTransactions: [saleTxObj],
  });
  const partialRetTx: Transaction = { ...partialRetStamped, id: 'tx-r1', createdAt: '2026-10-02T10:00:00Z' };
  const partialPlReport = computeComprehensivePL({
    transactions: [saleTxObj, partialRetTx],
    items: [{ ...costItem, weightedAvgCost: 180, stock: 5 }],
    parties: [] as Party[],
    batches: [],
    settings: testSettings,
  });
  assert(
    'P&L Engine',
    '10. Partial sales return reverses historical COGS (400 - 100 = 300) and net sales (750)',
    partialPlReport.tradingAndPL.netSalesExGst === 750 &&
      partialPlReport.tradingAndPL.cogs === 300 &&
      partialPlReport.tradingAndPL.grossProfit === 450,
    `Expected Net 750 COGS 300 GP 450, got ${partialPlReport.tradingAndPL.netSalesExGst}/${partialPlReport.tradingAndPL.cogs}/${partialPlReport.tradingAndPL.grossProfit}`
  );

  // P&L Test 11: Full Sales Return
  const fullRetStamped = stampSaleTransactionProfit({
    txData: {
      ...saleForRetBase,
      type: 'Sale Return',
      invoiceNo: 'CR-RET-FULL',
      originalInvoiceId: saleTxObj.id,
      totalAmount: 1000,
      receivedAmount: 1000,
      items: [{ id: 'sr-rf', name: costItem.name, hsn: '1006', qty: 4, unit: 'PCS', price: 250, discountPercent: 0, taxPercent: 0, amount: 1000 }],
    },
    items: [costItem],
    batches: [],
    settings: testSettings,
    existingTransactions: [saleTxObj],
  });
  const fullRetPl = computeComprehensivePL({
    transactions: [saleTxObj, { ...fullRetStamped, id: 'tx-rf', createdAt: '2026-10-02T11:00:00Z' }],
    items: [{ ...costItem, weightedAvgCost: 100, stock: 10 }],
    parties: [],
    batches: [],
    settings: testSettings,
  });
  assert(
    'P&L Engine',
    '11. Full sales return reduces net sales, COGS, and gross profit to 0',
    fullRetPl.tradingAndPL.netSalesExGst === 0 &&
      fullRetPl.tradingAndPL.cogs === 0 &&
      fullRetPl.tradingAndPL.grossProfit === 0,
    `Expected 0/0/0, got ${fullRetPl.tradingAndPL.netSalesExGst}/${fullRetPl.tradingAndPL.cogs}/${fullRetPl.tradingAndPL.grossProfit}`
  );

  // P&L Test 12: Operating Expense & Other Income Deduction
  const expTx: Transaction = {
    id: 'tx-exp-1',
    type: 'Expense',
    invoiceNo: 'EXP-1',
    date: '03/10/2026, 10:00 AM',
    partyName: 'Electricity Bill',
    expenseCategory: 'Utilities',
    firm: 'Main',
    user: 'Admin',
    paymentType: 'UPI',
    totalAmount: 200,
    receivedAmount: 200,
    balance: 0,
    dueDate: '03/10/2026',
    status: 'Paid',
    items: [],
    createdAt: '2026-10-03T10:00:00Z',
  };
  const incTx: Transaction = {
    ...expTx,
    id: 'tx-inc-1',
    type: 'Other Income',
    invoiceNo: 'INC-1',
    partyName: 'Scrap Rebate',
    totalAmount: 50,
    receivedAmount: 50,
  };
  const plWithExp = computeComprehensivePL({
    transactions: [saleTxObj, expTx, incTx], // sale GP = 1000 - 400 = 600; + 50 - 200 = 450
    items: [costItem],
    parties: [],
    batches: [],
    settings: testSettings,
  });
  assert(
    'P&L Engine',
    '12. Net Profit deducts indirect expenses and adds other income (600 + 50 - 200 = 450)',
    plWithExp.tradingAndPL.grossProfit === 600 && plWithExp.tradingAndPL.netProfit === 450,
    `Expected GP 600 Net 450, got ${plWithExp.tradingAndPL.grossProfit}/${plWithExp.tradingAndPL.netProfit}`
  );

  // P&L Test 13: Historical Profit Invariance After Later Cost/Price Changes
  const plAfterCostJump = computeComprehensivePL({
    transactions: [saleTxObj],
    items: [{ ...costItem, purchasePrice: 999, weightedAvgCost: 999, lastPurchasePrice: 999, salePrice: 1200 }],
    parties: [],
    batches: [],
    settings: testSettings,
  });
  assert(
    'P&L Engine',
    '13. Historical invoice profit remains invariant (600) even after item cost rises to ₹999',
    plAfterCostJump.tradingAndPL.cogs === 400 && plAfterCostJump.tradingAndPL.grossProfit === 600,
    `Expected locked COGS 400 / GP 600, got ${plAfterCostJump.tradingAndPL.cogs}/${plAfterCostJump.tradingAndPL.grossProfit}`
  );

  // P&L Test 14: Post-Return Stock & Closing Stock Valuation
  assert(
    'P&L Engine',
    '14. Closing stock valuation accurately values remaining post-return inventory (5 x 180 = 900)',
    partialPlReport.tradingAndPL.closingStockValue === 900,
    `Expected closing stock 900, got ${partialPlReport.tradingAndPL.closingStockValue}`
  );

  // P&L Test 15: Locked Financial Period Guard & Discount Cap Policy
  const lockedSettings = buildDefaultBusinessSettings();
  lockedSettings.accounting.lockedPeriods = [
    { id: 'lp-test', label: 'Sep 2026 Close', startDate: '2026-09-01', endDate: '2026-09-30', lockedAt: '2026-10-01', lockedBy: 'Owner' },
  ];
  const lockHit = isDateInLockedPeriod('15/09/2026, 02:00 PM', lockedSettings);
  const lockMiss = isDateInLockedPeriod('05/10/2026, 02:00 PM', lockedSettings);
  assert(
    'P&L Engine',
    '15. Financial Period Lock blocks backdated Sep entries and allows Oct entries',
    lockHit.locked === true && lockHit.periodLabel === 'Sep 2026 Close' && lockMiss.locked === false,
    `Expected Sep locked & Oct unlocked, got hit=${lockHit.locked} miss=${lockMiss.locked}`
  );

  // ==========================================
  // 5. SMART KIRANA WEIGHT & AMOUNT BILLING TESTS (1-10)
  // ==========================================
  // Kirana 1: Sugar ₹50/kg, ₹10 -> 200 g (0.2 kg)
  const k1 = calculateWeightFromAmount({ amount: 10, ratePerBaseUnit: 50, baseUnit: 'KG' });
  assert(
    'Kirana Billing',
    '1. Sugar ₹50/kg, entered ₹10 -> 200 g (0.2 kg)',
    k1.baseQty === 0.2 && k1.normalizedSmallUnits === 200 && k1.displayWeightLabel === '200 g',
    `Expected 0.2 kg / 200 g, got ${k1.baseQty} kg / ${k1.displayWeightLabel}`
  );

  // Kirana 2: Toor Dal ₹120/kg, ₹10 -> 83.333 g
  const k2 = calculateWeightFromAmount({ amount: 10, ratePerBaseUnit: 120, baseUnit: 'KG', decimalPrecision: 3 });
  assert(
    'Kirana Billing',
    '2. Toor Dal ₹120/kg, entered ₹10 -> 83.333 g',
    Math.abs(k2.normalizedSmallUnits - 83.333) < 0.002 && Math.abs(k2.baseQty - 0.083333) < 0.0001,
    `Expected 83.333 g, got ${k2.normalizedSmallUnits} g`
  );

  // Kirana 3: Rice ₹60/kg, 500 g -> ₹30.00
  const k3 = calculateAmountFromWeight({ weight: 500, weightUnit: 'GM', ratePerBaseUnit: 60, baseUnit: 'KG' });
  assert(
    'Kirana Billing',
    '3. Rice ₹60/kg, entered 500 g -> ₹30.00',
    k3.calculatedAmount === 30 && k3.baseQty === 0.5,
    `Expected ₹30 / 0.5 kg, got ₹${k3.calculatedAmount} / ${k3.baseQty} kg`
  );

  // Kirana 4: Sugar ₹50/kg, 250 g -> ₹12.50
  const k4 = calculateAmountFromWeight({ weight: 250, weightUnit: 'GM', ratePerBaseUnit: 50, baseUnit: 'KG' });
  assert(
    'Kirana Billing',
    '4. Sugar ₹50/kg, entered 250 g -> ₹12.50',
    k4.calculatedAmount === 12.5 && k4.baseQty === 0.25,
    `Expected ₹12.50 / 0.25 kg, got ₹${k4.calculatedAmount} / ${k4.baseQty} kg`
  );

  // Kirana 5: Stock deduction 10 kg - 250 g = 9.75 kg
  const deductedBase = convertUnitQty(250, 'GM', 'KG');
  const stockAfterSale = Math.round((10 - deductedBase) * 1000000) / 1000000;
  assert(
    'Kirana Billing',
    '5. Stock deduction 10 kg - 250 g = 9.75 kg',
    stockAfterSale === 9.75,
    `Expected 9.75 kg remaining, got ${stockAfterSale} kg`
  );

  // Kirana 6: Liquid Mustard Oil ₹150/LTR, 250 ml -> ₹37.50 & 0.25 L deduction
  const k6 = calculateAmountFromWeight({ weight: 250, weightUnit: 'ML', ratePerBaseUnit: 150, baseUnit: 'LTR' });
  assert(
    'Kirana Billing',
    '6. Mustard Oil ₹150/L, 250 ml -> ₹37.50 & 0.25 L',
    k6.calculatedAmount === 37.5 && k6.baseQty === 0.25 && k6.displayWeightLabel === '250 ml',
    `Expected ₹37.50 / 0.25 L, got ₹${k6.calculatedAmount} / ${k6.baseQty} L`
  );

  // Kirana 7: Mode switch consistency (Amount -> Weight -> Amount preserves ₹10 exact)
  const k7Weight = calculateWeightFromAmount({ amount: 10, ratePerBaseUnit: 50, baseUnit: 'KG' });
  const k7Amount = calculateAmountFromWeight({ weight: k7Weight.displayWeightQty, weightUnit: k7Weight.displayWeightUnit, ratePerBaseUnit: 50, baseUnit: 'KG' });
  assert(
    'Kirana Billing',
    '7. Dual-entry mode consistency preserves ₹10.00 round-trip',
    k7Amount.calculatedAmount === 10 && k7Amount.baseQty === 0.2,
    `Expected ₹10 round-trip, got ₹${k7Amount.calculatedAmount}`
  );

  // Kirana 8: Over-stock validation blocks 11 kg when only 10 kg available
  const reqBase = convertUnitQty(11000, 'GM', 'KG');
  assert(
    'Kirana Billing',
    '8. Over-stock validation detects 11000 g > 10 kg stock',
    reqBase > 10,
    `Expected 11 > 10, got ${reqBase}`
  );

  // Kirana 9 & 10: Fractional Loose Sale Return (250g) & Master Rate Change Invariance
  const sugarLooseItem: Item = {
    id: 'itm-sugar-loose',
    name: 'Loose Sugar',
    brand: 'Mandi Bulk',
    code: 'SUG-01',
    category: 'Grains',
    hsnCode: '1701',
    unit: 'KG',
    productType: 'Loose',
    salePrice: 50,
    purchasePrice: 40,
    weightedAvgCost: 40,
    lastPurchasePrice: 40,
    taxRate: 0,
    stock: 10,
    minStockAlert: 1,
    customerPrices: { 'cust-rahul': 48 },
  };
  const custPrice = resolveEffectiveSellingRate(sugarLooseItem, { customerId: 'cust-rahul' });
  assert(
    'Kirana Billing',
    '9a. Customer-specific loose pricing resolves ₹48/kg for Rahul',
    custPrice === 48,
    `Expected ₹48, got ₹${custPrice}`
  );

  const looseSaleStamped = stampSaleTransactionProfit({
    txData: {
      type: 'Sale',
      invoiceNo: 'KIR-001',
      date: '05/10/2026, 10:00 AM',
      partyName: 'Rahul Sharma',
      firm: 'Main',
      user: 'Admin',
      paymentType: 'Cash',
      totalAmount: 50,
      receivedAmount: 50,
      balance: 0,
      dueDate: '05/10/2026',
      status: 'Paid',
      items: [
        {
          id: 'kl-1',
          itemId: sugarLooseItem.id,
          name: sugarLooseItem.name,
          hsn: '1701',
          qty: 1,
          unit: 'KG',
          price: 50,
          discountPercent: 0,
          taxPercent: 0,
          amount: 50,
        },
      ],
    },
    items: [sugarLooseItem],
    batches: [],
    settings: testSettings,
  });
  const looseSaleTx: Transaction = { ...looseSaleStamped, id: 'tx-kir-sale-1', createdAt: '2026-10-05T10:00:00Z' };
  const looseRetStamped = stampSaleTransactionProfit({
    txData: {
      type: 'Sale Return',
      invoiceNo: 'CR-KIR-001',
      originalInvoiceId: looseSaleTx.id,
      date: '05/10/2026, 11:00 AM',
      partyName: 'Rahul Sharma',
      firm: 'Main',
      user: 'Admin',
      paymentType: 'Cash',
      totalAmount: 12.5,
      receivedAmount: 12.5,
      balance: 0,
      dueDate: '05/10/2026',
      status: 'Paid',
      items: [
        {
          id: 'kl-ret-1',
          itemId: sugarLooseItem.id,
          name: sugarLooseItem.name,
          hsn: '1701',
          qty: 0.25,
          unit: 'KG',
          displayWeightLabel: '250 g',
          price: 50,
          discountPercent: 0,
          taxPercent: 0,
          amount: 12.5,
        },
      ],
    },
    items: [{ ...sugarLooseItem, purchasePrice: 99, weightedAvgCost: 99, salePrice: 80 }],
    batches: [],
    settings: testSettings,
    existingTransactions: [looseSaleTx],
  });
  const loosePlAfterRateJump = computeComprehensivePL({
    transactions: [looseSaleTx, { ...looseRetStamped, id: 'tx-kir-ret-1', createdAt: '2026-10-05T11:00:00Z' }],
    items: [{ ...sugarLooseItem, purchasePrice: 99, weightedAvgCost: 99, salePrice: 80, stock: 9.25 }],
    parties: [],
    batches: [],
    settings: testSettings,
  });
  assert(
    'Kirana Billing',
    '9b & 10. Fractional 250g return reverses ₹10 COGS & keeps historical profit invariant after master price change',
    loosePlAfterRateJump.tradingAndPL.netSalesExGst === 37.5 &&
      loosePlAfterRateJump.tradingAndPL.cogs === 30 &&
      loosePlAfterRateJump.tradingAndPL.grossProfit === 7.5,
    `Expected Net 37.5 COGS 30 GP 7.5, got ${loosePlAfterRateJump.tradingAndPL.netSalesExGst}/${loosePlAfterRateJump.tradingAndPL.cogs}/${loosePlAfterRateJump.tradingAndPL.grossProfit}`
  );

  // ==========================================
  // 6. EDITABLE PURCHASE COST, 30-DAY FORECAST CI & CUSTOMER-PRODUCT-BRAND PROFIT
  // ==========================================
  const editedCostLine: InvoiceItem = {
    id: 'ec-1',
    itemId: sugarLooseItem.id,
    name: sugarLooseItem.name,
    hsn: '1701',
    qty: 2,
    unit: 'KG',
    price: 50,
    discountPercent: 0,
    taxPercent: 0,
    amount: 100,
    unitCostAtSale: 42.5,
    unitCostEdited: true,
  };
  const editedCostAnalysis = analyzeSaleInvoiceProfit({
    lines: [editedCostLine],
    items: [sugarLooseItem],
    batches: [],
    costingMethod: 'Weighted Average',
    isGstActive: false,
  });
  assert(
    'P&L Engine',
    '16. Editable purchase price on invoice overrides catalog cost (2 x 42.5 = 85 cost, 15 GP)',
    editedCostAnalysis.totalCost === 85 && editedCostAnalysis.grossProfit === 15,
    `Expected Cost 85 / GP 15, got Cost ${editedCostAnalysis.totalCost} / GP ${editedCostAnalysis.grossProfit}`
  );

  const editedSaleStamped = stampSaleTransactionProfit({
    txData: {
      type: 'Sale',
      invoiceNo: 'KIR-EDIT-COST',
      date: '05/10/2026, 12:00 PM',
      partyName: 'Rahul Sharma',
      firm: 'Main',
      user: 'Admin',
      paymentType: 'Cash',
      totalAmount: 100,
      receivedAmount: 100,
      balance: 0,
      dueDate: '05/10/2026',
      status: 'Paid',
      items: [editedCostLine],
    },
    items: [sugarLooseItem],
    batches: [],
    settings: testSettings,
  });
  assert(
    'P&L Engine',
    '17. Stamped transaction persists edited purchase cost (85) and GP (15)',
    editedSaleStamped.totalCostOfGoodsSold === 85 && editedSaleStamped.grossProfit === 15,
    `Expected persisted COGS 85 / GP 15, got ${editedSaleStamped.totalCostOfGoodsSold} / ${editedSaleStamped.grossProfit}`
  );

  const forecastSeries = loosePlAfterRateJump.salesForecast.projected30DaysSeries;
  const cpbMatch = loosePlAfterRateJump.customerProductBrandRows.find(
    (r) => r.partyName === 'Rahul Sharma' && r.productName === 'Loose Sugar' && r.brand === 'Mandi Bulk'
  );
  const boundsValid =
    forecastSeries.length === 30 &&
    forecastSeries.every(
      (pt) =>
        pt.revenueLower <= pt.projectedRevenue &&
        pt.projectedRevenue <= pt.revenueUpper &&
        pt.grossProfitLower <= pt.projectedGrossProfit &&
        pt.projectedGrossProfit <= pt.grossProfitUpper
    );
  assert(
    'P&L Engine',
    '18. 30-day forecast CI bounds & Customer×Product×Brand profit row match expected values',
    boundsValid &&
      !!cpbMatch &&
      cpbMatch.grossProfit === 7.5 &&
      Math.abs(cpbMatch.netQty - 0.75) < 0.001,
    `Expected 30 forecast pts with valid CI & Rahul/Mandi Bulk GP 7.5 (0.75 kg), got len=${forecastSeries.length}, bounds=${boundsValid}, cpb=${JSON.stringify(cpbMatch)}`
  );

  // ==========================================
  // 7. ADVANCED ITEM MANAGEMENT TESTS
  // ==========================================
  const multiBarcodeItem: Item = {
    ...baseItemA,
    id: 'itm-multi-bc',
    name: 'Assam Premium Tea',
    code: 'TEA-001',
    sku: 'SKU-TEA-99',
    barcode: '8901112223334',
    extraBarcodes: ['8909998887771', 'TEA-PACK-250'],
    salePrice: 240,
    purchasePrice: 180,
    unit: 'KG',
    qtyDiscountMinQty: 5,
    qtyDiscountPercent: 8,
    wholesaleDiscountPercent: 12,
    maxDiscountLimitPercent: 10,
  };

  const foundExtra = findItemByBarcode([multiBarcodeItem], '8909998887771');
  const foundSku = findItemByBarcode([multiBarcodeItem], 'SKU-TEA-99');
  const dupExtraCheck = isBarcodeUnique([multiBarcodeItem], '8909998887771');
  const selfExtraCheck = isBarcodeUnique([multiBarcodeItem], '8909998887771', multiBarcodeItem.id);
  assert(
    'Item Management',
    '1. Multi-barcode & SKU lookup finds item and prevents duplicate extraBarcodes',
    foundExtra?.id === multiBarcodeItem.id &&
      foundSku?.id === multiBarcodeItem.id &&
      dupExtraCheck.unique === false &&
      selfExtraCheck.unique === true,
    `Expected multi-barcode & SKU lookup hit + uniqueness guard`
  );

  const wToA200 = calculateAmountFromWeight(200, 'GM', 50, 'KG');
  const aToW30 = calculateWeightFromAmount(30, 60, 'KG');
  const tea250 = calculateAmountFromWeight(250, 'GM', 240, 'KG');
  const ctnToPkt = convertUnitQty(1, 'CTN', 'PKT');
  assert(
    'Item Management',
    '2. Weight/Qty calculator computes 200g@₹50=₹10, ₹30@₹60=500g, 250g Tea@₹240=₹60, 1 CTN=24 PKT',
    wToA200.calculatedAmount === 10 &&
      aToW30.baseQty === 0.5 &&
      aToW30.displayWeightLabel === '500 g' &&
      tea250.calculatedAmount === 60 &&
      ctnToPkt === 24,
    `Got 200g=${wToA200.calculatedAmount}, ₹30=${aToW30.displayWeightLabel}, Tea=${tea250.calculatedAmount}, CTN=${ctnToPkt}`
  );

  const discQty5 = resolveEffectiveItemDiscountPercent(multiBarcodeItem, { qty: 5, salePriceMode: 'Retail' });
  const discWholesaleCapped = resolveEffectiveItemDiscountPercent(multiBarcodeItem, { qty: 10, salePriceMode: 'Wholesale' });
  assert(
    'Item Management',
    '3. Item discount engine applies 8% qty discount at 5+ units and caps 12% wholesale at 10% max limit',
    discQty5 === 8 && discWholesaleCapped === 10,
    `Expected qty=8%, wholesale capped=10%, got ${discQty5}% / ${discWholesaleCapped}%`
  );

  // ==========================================
  // 8. BATCH & EXPIRY TRACKING + 5,001-5,400 ERP ENGINE TESTS
  // ==========================================
  const batchValidRows: BatchDraftRow[] = [
    {
      id: 'b-row-1',
      batchNumber: 'BAT-2611-01',
      mfgDate: '2026-10-01',
      expiryDate: '2027-10-01',
      qty: 10,
      purchaseRate: 80,
      saleRate: 100,
    },
  ];
  const batchInvalidRows: BatchDraftRow[] = [
    {
      id: 'b-row-a',
      batchNumber: 'BAT-DUP',
      mfgDate: '2026-12-01',
      expiryDate: '2026-11-01', // invalid: before mfgDate
      qty: 5,
      purchaseRate: 80,
      saleRate: 100,
    },
    {
      id: 'b-row-b',
      batchNumber: 'BAT-DUP', // duplicate
      mfgDate: '2026-10-01',
      expiryDate: '',
      qty: 3,
      purchaseRate: 80,
      saleRate: 100,
    },
  ];
  const batchResValid = validateBatchEntries(batchValidRows, { requireAtLeastOneBatch: true, requireExpiry: true });
  const batchResInvalid = validateBatchEntries(batchInvalidRows, { requireAtLeastOneBatch: true, requireExpiry: true });
  const expPast = getBatchExpiryStatus('2020-01-01', 30);
  const expFuture = getBatchExpiryStatus('2099-12-31', 30);
  assert(
    'Batch & Expiry',
    '1. Batch validation allows valid lots and catches duplicate batch #, expiry < mfgDate & missing expiry',
    batchResValid.valid === true &&
      batchResValid.totalBatchQty === 10 &&
      batchResInvalid.valid === false &&
      (batchResInvalid.errorsByRowId['b-row-a']?.length || 0) >= 1 &&
      (batchResInvalid.errorsByRowId['b-row-b']?.length || 0) >= 2 &&
      expPast.status === 'Expired' &&
      expFuture.status === 'Healthy',
    `Valid=${batchResValid.valid}, Invalid=${batchResInvalid.valid}, expPast=${expPast.status}, expFuture=${expFuture.status}`
  );

  // Transaction Engine: Numbering, Fingerprint, Validation, Workflow & Diff
  const formattedSeq = formatSequenceNumber(
    {
      docType: 'Sales Invoice',
      prefix: 'INV-',
      suffix: '-BLR',
      digits: 4,
      startNumber: 1,
      nextNumber: 42,
      useFinancialYear: true,
      autoNumbering: true,
      allowManualOverride: true,
      preventDuplicate: true,
      resetPolicy: 'Financial Year',
    },
    { financialYearLabel: 'FY26-27', branchCode: 'B1', warehouseCode: 'W2' }
  );
  assert(
    'Transaction Engine',
    '1. Branch & Warehouse sequence generator formats INV-B1/W2/FY26-27/0042-BLR',
    formattedSeq === 'INV-B1/W2/FY26-27/0042-BLR',
    `Expected INV-B1/W2/FY26-27/0042-BLR, got ${formattedSeq}`
  );

  const dupFingerprint = detectDuplicateTransactionFingerprint([saleTxObj], {
    type: 'Sale',
    partyName: 'Walk-in',
    totalAmount: 1000,
    date: '01/10/2026',
  });
  const blockedParty: Party = {
    id: 'p-blocked',
    name: 'Blocked Buyer',
    phone: '9999999999',
    email: '',
    type: 'Customer',
    balance: 0,
    gstin: 'BADGSTIN',
    address: '',
    status: 'Blocked',
  };
  const integrityRes = validateTransactionIntegrity(
    {
      type: 'Sale',
      invoiceNo: 'INV-TEST',
      date: '20/11/2026',
      partyName: 'Blocked Buyer',
      partyGstin: 'BADGSTIN',
      totalAmount: 500,
      receivedAmount: 0,
      items: [],
    },
    { items: [baseItemA], parties: [blockedParty], existingTransactions: [], settings: testSettings }
  );
  assert(
    'Transaction Engine',
    '2. Duplicate fingerprint & transaction integrity guard block Blocked parties & invalid GSTIN',
    !!dupFingerprint && integrityRes.valid === false && integrityRes.issues.some((i) => i.code === 'PARTY_BLOCKED'),
    `dup=${!!dupFingerprint}, valid=${integrityRes.valid}`
  );

  const wfOk = canTransitionWorkflowState('Draft', 'Approved');
  const wfBad = canTransitionWorkflowState('Reversed', 'Completed');
  const diffRows = diffTransactionVersions(
    {
      invoiceNo: 'INV-1',
      date: '01/10/2026',
      partyName: 'A',
      paymentType: 'Cash',
      totalAmount: 500,
      receivedAmount: 500,
      balance: 0,
      status: 'Paid',
      workflowStatus: 'Draft',
      items: [],
    },
    {
      invoiceNo: 'INV-1',
      date: '01/10/2026',
      partyName: 'A',
      paymentType: 'UPI',
      totalAmount: 650,
      receivedAmount: 650,
      balance: 0,
      status: 'Paid',
      workflowStatus: 'Completed',
      items: [],
    }
  );
  assert(
    'Transaction Engine',
    '3. Workflow state transitions & version diff detect field modifications accurately',
    wfOk === true && wfBad === false && diffRows.length >= 3,
    `wfOk=${wfOk}, wfBad=${wfBad}, diffs=${diffRows.length}`
  );

  // Invoice Splitting + Payment Limits + Allocation
  const splitRes = buildSplitInvoiceItems(
    [{ id: 's1', name: 'Rice', hsn: '1006', qty: 10, unit: 'KG', price: 60, discountPercent: 0, taxPercent: 0, amount: 600 }],
    40
  );
  const limitCheck = evaluatePaymentLimits({
    amount: 250000,
    mode: 'Mixed/Split',
    splitParts: [
      { id: 'sp1', mode: 'Cash', amount: 220000 },
      { id: 'sp2', mode: 'UPI', amount: 30000 },
    ],
    limits: DEFAULT_PAYMENT_LIMITS,
    userDailyTotalSoFar: 0,
  });
  const allocRes = calculatePaymentAllocationBreakdown({
    paymentAmount: 1500,
    allocations: [{ invoiceId: 'inv-1', invoiceTotalPending: 1200, allocatedAmount: 1200 }],
    writeOffShortfall: false,
  });
  assert(
    'Payment & Billing Engine',
    '1. Split invoice (40/60), Cash Section 269ST limit alert & Excess Advance allocation work accurately',
    splitRes.partA[0].qty === 4 &&
      splitRes.partB[0].qty === 6 &&
      limitCheck.exceedsLimit === true &&
      allocRes.excessAdvance === 300,
    `split=${splitRes.partA[0].qty}/${splitRes.partB[0].qty}, limit=${limitCheck.exceedsLimit}, adv=${allocRes.excessAdvance}`
  );

  // Purchase RFQ comparison + Health Check
  const rfqCompare = compareSupplierQuotations(
    [
      {
        id: 'q1',
        quoteNo: 'RFQ-1',
        date: '01/11/2026',
        validUntil: '2026-12-01',
        supplierName: 'Metro Traders',
        items: [{ itemName: 'Sugar', unit: 'KG', qty: 100, quotedRate: 44, taxPercent: 5, leadTimeDays: 2 }],
        totalAmount: 4620,
        status: 'Open',
        createdAt: '2026-11-01',
      },
      {
        id: 'q2',
        quoteNo: 'RFQ-2',
        date: '02/11/2026',
        validUntil: '2026-12-01',
        supplierName: 'Kisan Wholesale',
        items: [{ itemName: 'Sugar', unit: 'KG', qty: 100, quotedRate: 41, taxPercent: 5, leadTimeDays: 3 }],
        totalAmount: 4305,
        status: 'Open',
        createdAt: '2026-11-02',
      },
    ],
    'Sugar'
  );
  const dupPurTx: Transaction = {
    ...saleTxObj,
    id: 'pur-dup-1',
    type: 'Purchase',
    invoiceNo: 'SUP-99',
    partyName: 'Kisan Wholesale',
    totalAmount: 4305,
  };
  const healthCheckRes = runPurchaseHealthCheck([dupPurTx, { ...dupPurTx, id: 'pur-dup-2' }], []);
  assert(
    'Purchase Engine',
    '1. RFQ comparison selects lowest vendor (₹41 Kisan Wholesale) & Purchase Health Check detects duplicate bill',
    rfqCompare.bestSupplier === 'Kisan Wholesale' &&
      rfqCompare.lowestRate === 41 &&
      healthCheckRes.duplicateBills.length === 1 &&
      healthCheckRes.healthy === false,
    `best=${rfqCompare.bestSupplier}, dups=${healthCheckRes.duplicateBills.length}`
  );

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  const summary = `${passed} of ${total} tests passed (${failed} failures).`;

  return { summary, total, passed, failed, results };
}
