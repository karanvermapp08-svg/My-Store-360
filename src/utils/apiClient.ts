/**
 * Authoritative API Client for Vyapar Shared Backend Services
 * Connects role applications to centralized billing, inventory, payments, approvals and audit APIs.
 */

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.token = localStorage.getItem('vyapar_auth_token') || 'token-owner-secure';
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof localStorage !== 'undefined') {
      if (token) localStorage.setItem('vyapar_auth_token', token);
      else localStorage.removeItem('vyapar_auth_token');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || `HTTP ${response.status}: Failed request to ${endpoint}`);
      }
      return json as T;
    } catch (err: any) {
      console.warn(`[ApiClient] Request to ${endpoint} failed:`, err.message);
      throw err;
    }
  }

  // Health
  async getHealth() {
    return this.request<{ status: string; tenant: string; uptime: number }>('/health');
  }

  // Auth & Session
  async login(roleName: string) {
    const data = await this.request<{ user: any; token: string; tenant: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ roleName }),
    });
    this.setToken(data.token);
    return data;
  }

  async getCurrentUser() {
    return this.request<{ user: any; tenant: any; branches: any[] }>('/auth/me');
  }

  async switchRole(targetRole: string) {
    const data = await this.request<{ success: boolean; user: any; token: string }>('/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ targetRole }),
    });
    if (data.token) this.setToken(data.token);
    return data;
  }

  // Workspaces
  async getWorkspace(role: string) {
    return this.request<{
      role: string;
      tenant: string;
      user: any;
      metrics: {
        totalSales: number;
        totalReceived: number;
        totalOutstanding: number;
        invoiceCount: number;
        lowStockCount: number;
        pendingApprovalsCount: number;
        pendingDeliveriesCount: number;
        itemsCount: number;
        partiesCount: number;
      };
      authorizedModules: string[];
    }>(`/workspaces/${role}`);
  }

  // Invoices & Billing
  async getInvoices() {
    return this.request<{ invoices: any[] }>('/invoices');
  }

  async createInvoice(payload: {
    partyName: string;
    partyId?: string;
    paymentType: string;
    receivedAmount: number;
    discountPercent?: number;
    items: Array<{
      name: string;
      qty: number;
      price?: number;
      discountPercent?: number;
      taxPercent?: number;
    }>;
  }) {
    return this.request<{ success: boolean; invoice: any; message: string }>('/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async cancelInvoice(id: string, reason?: string) {
    return this.request<{ success?: boolean; status?: string; message: string; approvalId?: string }>(
      `/invoices/${id}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
  }

  // Inventory & Stock
  async getInventoryItems() {
    return this.request<{ items: any[] }>('/inventory/items');
  }

  async adjustStock(itemId: string, newStock: number, reason: string) {
    return this.request<{ success: boolean; item: any }>('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({ itemId, newStock, reason }),
    });
  }

  // Approvals
  async getApprovals() {
    return this.request<{ approvals: any[] }>('/approvals');
  }

  async decideApproval(id: string, decision: 'APPROVED' | 'REJECTED') {
    return this.request<{ success: boolean; approval: any }>(`/approvals/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    });
  }

  // Delivery
  async getDeliveryOrders() {
    return this.request<{ orders: any[] }>('/delivery/orders');
  }

  async updateDeliveryStatus(id: string, status: string, codCollected?: boolean) {
    return this.request<{ success: boolean; order: any }>(`/delivery/orders/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, codCollected }),
    });
  }

  // Audit
  async getAuditLogs() {
    return this.request<{ auditLogs: any[] }>('/audit-logs');
  }

  // Backend Automated Tests
  async runBackendTests() {
    return this.request<{ summary: string; total: number; passed: number; failed: number; results: any[] }>('/tests/run');
  }

  // Unified My Store <-> Billing Sync APIs
  async getStoreBootstrap() {
    return this.request<{ orders: any[]; coupons: any[]; returnRequests: any[]; serviceAreaConfig: any }>('/store/bootstrap');
  }

  async createStoreOrder(payload: { order: any; payment: any; stockHistory: any[] }) {
    return this.request<{ success: boolean; order: any }>('/store/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async advanceStoreOrder(
    orderId: string,
    payload: { stage: string; deliveryBagId?: string; deliveryBoyName?: string; deliveryOtp?: string }
  ) {
    return this.request<{ success: boolean; order: any }>(`/store/orders/${orderId}/advance`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async verifyStoreDeliveryOtp(orderId: string, otp: string, codCollected = true) {
    return this.request<{ success: boolean; order: any }>(`/store/orders/${orderId}/verify-otp`, {
      method: 'POST',
      body: JSON.stringify({ otp, codCollected }),
    });
  }

  async cancelStoreOrder(orderId: string, reason: string) {
    return this.request<{ success: boolean; order: any }>(`/store/orders/${orderId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async submitStoreReturn(orderId: string, returnRequest: any) {
    return this.request<{ success: boolean; returnRequest: any }>(`/store/orders/${orderId}/return`, {
      method: 'POST',
      body: JSON.stringify(returnRequest),
    });
  }

  async validateStoreCoupon(code: string, subtotal: number, customerId?: string, categories?: string[]) {
    return this.request<{ valid: boolean; coupon?: any; discountAmount?: number; message?: string }>('/store/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code, subtotal, customerId, categories }),
    });
  }

  async requestCustomerOtp(phone: string, purpose: 'login' | 'register', otp?: string) {
    return this.request<{ success: boolean; phone: string; purpose: string; expiresInSeconds: number }>(
      '/store/auth/otp/request',
      {
        method: 'POST',
        body: JSON.stringify({ phone, purpose, otp }),
      }
    );
  }

  async verifyCustomerOtp(phone: string, otp: string) {
    return this.request<{ valid: boolean; verified: boolean }>('/store/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    });
  }

  async getStoreSyncState() {
    return this.request<{ available: boolean; snapshot: Record<string, any> | null }>('/store/sync-state');
  }

  async pushStoreSyncState(snapshot: Record<string, any>) {
    return this.request<{ success: boolean; syncedAt: string }>('/store/sync-state', {
      method: 'POST',
      body: JSON.stringify(snapshot),
    });
  }

  // Seller Role APIs (Permission & Product-Specific Wholesale Tier Validation)
  async validateSellerSale(payload: {
    sellerId: string;
    sellerType: 'Wholesaler Only' | 'Retailer Only' | 'Both Wholesaler + Retailer';
    saleChannel: 'Wholesale' | 'Retail';
    partyName: string;
    paymentType: string;
    receivedAmount: number;
    items: Array<{
      itemId: string;
      name: string;
      qty: number;
      retailPrice: number;
      wholesalePrice: number;
      minWholesaleQty: number;
      discountPercent?: number;
      taxPercent?: number;
    }>;
  }) {
    return this.request<{
      success: boolean;
      validatedTotals: {
        subtotal: number;
        taxAmount: number;
        totalAmount: number;
        lineResults: Array<{
          itemId: string;
          appliedPrice: number;
          appliedTier: 'Wholesale' | 'Retail';
          lineTotal: number;
        }>;
      };
    }>('/seller/validate-sale', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Online Store Manager APIs
  async onlineManagerOrderAction(
    orderId: string,
    payload: {
      action: 'accept' | 'reject' | 'pack' | 'ready' | 'assign';
      roleName: string;
      reason?: string;
      deliveryBagId?: string;
      deliveryBoyId?: string;
      deliveryBoyName?: string;
    }
  ) {
    return this.request<{ success: boolean; nextStage: string }>(`/online-manager/orders/${orderId}/action`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async replyCustomerSupport(payload: {
    messageId: string;
    managerId: string;
    managerName: string;
    roleName: string;
    replyText: string;
  }) {
    return this.request<{ success: boolean; timestamp: string }>('/online-manager/support/reply', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Module 1: AI Purchase Bill Scanner
  async extractPurchaseBill(files: Array<{ name: string; mimeType: string; base64Data: string }>) {
    return this.request<{ success: boolean; extracted: any }>('/purchase-scans/extract', {
      method: 'POST',
      body: JSON.stringify({ files }),
    });
  }

  async getPurchaseScans() {
    return this.request<{ scans: any[] }>('/purchase-scans');
  }

  async savePurchaseScan(scan: any) {
    return this.request<{ success: boolean; scan: any }>('/purchase-scans', {
      method: 'POST',
      body: JSON.stringify(scan),
    });
  }

  // Module 2: Authoritative HSN / SAC Master & GST Audits
  async getHsnMaster(q = '') {
    return this.request<{ entries: any[]; officialCount: number; customCount: number }>(
      `/hsn-master?q=${encodeURIComponent(q)}`
    );
  }

  async saveHsnEntry(entry: any) {
    return this.request<{ success: boolean; entry: any }>('/hsn-master', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  async getGstAudits() {
    return this.request<{ audits: any[] }>('/gst-audits');
  }

  async saveGstAudit(audit: any) {
    return this.request<{ success: boolean; audit: any }>('/gst-audits', {
      method: 'POST',
      body: JSON.stringify(audit),
    });
  }

  // Module 4: E-Invoice & E-Way Bill (GSP / NIC IRP)
  async getGspStatus() {
    return this.request<{
      configured: boolean;
      providerName: string;
      environment: 'Sandbox' | 'Production';
      sellerGstin: string;
      maskedClientId?: string;
      irpEndpointConfigured: boolean;
      ewbEndpointConfigured: boolean;
      updatedAt?: string;
    }>('/einvoice/gsp-status');
  }

  async saveGspConfig(payload: {
    providerName: string;
    environment: 'Sandbox' | 'Production';
    sellerGstin: string;
    irpApiUrl: string;
    ewbApiUrl?: string;
    clientId: string;
    clientSecret: string;
    username?: string;
    password?: string;
  }) {
    return this.request<{ success: boolean; updatedAt: string; message: string }>('/einvoice/gsp-config', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async validateEInvoice(payload: {
    invoice: any;
    sellerGstin: string;
    sellerAddress: string;
    sellerState: string;
  }) {
    return this.request<{
      eligible: boolean;
      valid: boolean;
      errors: string[];
      warnings: string[];
      placeOfSupplyCode: string | null;
      needsEWayBill: boolean;
    }>('/einvoice/validate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getEInvoiceData() {
    return this.request<{ eInvoices: any[]; apiLogs: any[]; eWayBills: any[] }>('/einvoice/records');
  }

  async generateEInvoice(payload: { invoice: any; sellerProfile: any }) {
    return this.request<{ success: boolean; record: any }>('/einvoice/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async cancelEInvoice(id: string, reasonCode = '1', remarks = 'Cancelled by authorized user') {
    return this.request<{ success: boolean; record: any }>(`/einvoice/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reasonCode, remarks }),
    });
  }

  async generateEWayBill(payload: {
    invoice: any;
    transport: {
      irn?: string;
      transporterName?: string;
      transporterId?: string;
      vehicleNumber?: string;
      transportMode?: 'Road' | 'Rail' | 'Air' | 'Ship';
      distanceKm?: number;
      dispatchLocation?: string;
      deliveryLocation?: string;
      transportDocNo?: string;
      transportDocDate?: string;
    };
  }) {
    return this.request<{ success: boolean; record: any }>('/ewaybill/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Module 5: Customer Quotation Approval Portal
  async shareQuotation(quotation: any, company: any) {
    return this.request<{ success: boolean; token: string }>('/quotations/share', {
      method: 'POST',
      body: JSON.stringify({ quotation, company }),
    });
  }

  async getPublicQuotation(token: string) {
    return this.request<{ quotation: any; company: any; sharedAt: string }>(
      `/quotations/public/${encodeURIComponent(token)}`
    );
  }

  async respondPublicQuotation(
    token: string,
    payload: {
      decision: 'Accepted' | 'Rejected' | 'Modification Requested';
      customerName?: string;
      comment?: string;
    }
  ) {
    return this.request<{ success: boolean; quotation: any }>(
      `/quotations/public/${encodeURIComponent(token)}/respond`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }

  // Module 8 & 10: Backup & Migration Rollback
  async createErpBackup(label: string, clientSnapshot?: any) {
    return this.request<{ success: boolean; backupId: string; createdAt: string }>('/erp/backup', {
      method: 'POST',
      body: JSON.stringify({ label, clientSnapshot }),
    });
  }

  async rollbackErpBackup(backupId: string) {
    return this.request<{ success: boolean; restoredBackupId: string; clientSnapshot?: any }>('/erp/rollback', {
      method: 'POST',
      body: JSON.stringify({ backupId }),
    });
  }

  // Module 11: Complete Settings & Role-Based Settings Access
  async getSettingsBundle() {
    return this.request<{
      businessSettings: any;
      partyGroups: any[];
      serviceReminders: any[];
      settingsAuditLogs: any[];
    }>('/settings');
  }

  async saveSettingsBundle(payload: {
    category: string;
    settingsBundle: any;
    partyGroups?: any[];
    serviceReminders?: any[];
    reason?: string;
    gstin?: string;
  }) {
    return this.request<{
      success: boolean;
      updatedAt: string;
      businessSettings: any;
      settingsAuditLogs: any[];
    }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async resetSettingsBundle(payload: { category?: string; settingsBundle: any }) {
    return this.request<{
      success: boolean;
      updatedAt: string;
      businessSettings: any;
      settingsAuditLogs: any[];
    }>('/settings/reset', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getSettingsAuditLogs() {
    return this.request<{ logs: any[] }>('/settings/audit-logs');
  }

  // Module 12: AI Business Assistant
  async askAiAssistant(payload: {
    message: string;
    history?: Array<{ role: 'user' | 'assistant'; text: string }>;
    contextSnapshot: Record<string, any>;
  }) {
    return this.request<{
      answer: string;
      highlights: Array<{ label: string; value: string }>;
      proposedAction?: {
        actionType: 'NONE' | 'CREATE_PURCHASE_ORDER' | 'ADJUST_MIN_STOCK' | 'CREATE_STOCK_ADJUSTMENT';
        title: string;
        description: string;
        itemId?: string;
        itemName?: string;
        supplierName?: string;
        qty?: number;
        unitPrice?: number;
        newMinStock?: number;
      };
    }>('/ai/assistant', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const apiClient = new ApiClient();
