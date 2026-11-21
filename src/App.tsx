/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { VyaparProvider, useVyapar } from './context/VyaparContext';
import { Sidebar } from './components/Sidebar';
import { TopActionBar } from './components/TopActionBar';
import { LockScreen } from './components/LockScreen';
import { LogoutConfirmModal } from './components/modals/LogoutConfirmModal';
import { AccessRestrictedModal } from './components/modals/AccessRestrictedModal';
import { WelcomePortalScreen } from './components/portal/WelcomePortalScreen';
import { CustomerLoginView } from './components/portal/CustomerLoginView';
import { StaffLoginView } from './components/portal/StaffLoginView';
import { CustomerDashboard } from './components/portal/CustomerDashboard';
import { StaffDashboard } from './components/portal/StaffDashboard';
import { DeliveryBoyPortal } from './components/portal/delivery/DeliveryBoyPortal';
import { SellerPortal } from './components/portal/seller/SellerPortal';
import { OnlineManagerPortal } from './components/portal/online-manager/OnlineManagerPortal';
import { CustomerStaffManagementView } from './components/portal/CustomerStaffManagementView';

// Primary Views
import { MyStoreDashboard } from './components/MyStoreDashboard';
import { MyStorePosView } from './components/MyStorePosView';
import { SaleInvoicesView } from './components/SaleInvoicesView';
import { EstimateQuotationView } from './components/EstimateQuotationView';
import { SaleOrderView } from './components/SaleOrderView';
import { DeliveryChallanView } from './components/DeliveryChallanView';
import { CreditNoteView } from './components/CreditNoteView';
import { PurchaseView } from './components/PurchaseView';
import { PurchaseOrderView } from './components/PurchaseOrderView';
import { DebitNoteView } from './components/DebitNoteView';
import { PartiesView } from './components/PartiesView';
import { ItemsView } from './components/ItemsView';
import { CategoriesView } from './components/CategoriesView';
import { UnitsView } from './components/UnitsView';
import { StockSummaryView } from './components/StockSummaryView';
import { StockAdjustmentView } from './components/StockAdjustmentView';
import { StockTransferView } from './components/StockTransferView';
import { WarehousesView } from './components/WarehousesView';
import { BarcodeStudioView } from './components/BarcodeStudioView';
import { PaymentInView } from './components/PaymentInView';
import { PaymentOutView } from './components/PaymentOutView';
import { CashBankView } from './components/CashBankView';
import { ExpensesView } from './components/ExpensesView';
import { IncomeView } from './components/IncomeView';
import { ReportsHubView } from './components/ReportsHubView';
import { SettingsHubView } from './components/SettingsHubView';
import { StaffManagementView } from './components/StaffManagementView';
import { AuditLogView } from './components/AuditLogView';
import { DemoFeaturesView } from './components/DemoFeaturesView';
import { SaleFaView } from './components/SaleFaView';
import { AccountingErpView } from './components/AccountingErpView';
import { InventoryEnterpriseView } from './components/InventoryEnterpriseView';
import { ErpToolsView } from './components/ErpToolsView';
import { PurchaseBillScannerView } from './components/PurchaseBillScannerView';
import { HsnGstManagementView } from './components/HsnGstManagementView';
import { EInvoiceEWayBillView } from './components/EInvoiceEWayBillView';
import { SmartInventoryView } from './components/SmartInventoryView';
import { UdharKhataView } from './components/UdharKhataView';
import { ProfitLossDashboardView } from './components/ProfitLossDashboardView';
import { AiAssistantView } from './components/AiAssistantView';
import { OnlineOrdersAdminView } from './components/OnlineOrdersAdminView';
import { CrmLoyaltyView } from './components/CrmLoyaltyView';
import { CustomerQuotationPortal } from './components/portal/CustomerQuotationPortal';
import { TransactionEngineView } from './components/TransactionEngineView';
import { AlertTriangle, CheckCircle2, Info, RotateCcw, X, XCircle } from 'lucide-react';

// Modals
import { AddSaleModal } from './components/modals/AddSaleModal';
import { AddPurchaseModal } from './components/modals/AddPurchaseModal';
import { InvoicePreviewModal } from './components/modals/InvoicePreviewModal';
import { CompanyModal } from './components/modals/CompanyModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { ShortcutsModal } from './components/modals/ShortcutsModal';
import { HelpModal } from './components/modals/HelpModal';
import { VersionsModal } from './components/modals/VersionsModal';
import { SupportModal } from './components/modals/SupportModal';
import { CommandPaletteModal } from './components/modals/CommandPaletteModal';
import { AnalyticsModal } from './components/modals/AnalyticsModal';
import { PremiumModal } from './components/modals/PremiumModal';
import { MyStoreModal } from './components/modals/MyStoreModal';
import { AddPartyModal } from './components/modals/AddPartyModal';
import { AddItemModal } from './components/modals/AddItemModal';
import { UserAuthModal } from './components/modals/UserAuthModal';
import { AddEmployeeModal } from './components/modals/AddEmployeeModal';
import { RoleEditorModal } from './components/modals/RoleEditorModal';
import { EmployeeProfileModal } from './components/modals/EmployeeProfileModal';
import { BarcodeScannerModal } from './components/modals/BarcodeScannerModal';

const GlobalToastBanner: React.FC = () => {
  const { toastNotice, toastMessage, dismissToast } = useVyapar();
  const msg = toastNotice?.message || toastMessage;
  if (!msg) return null;

  const type = toastNotice?.type || 'success';
  const Icon =
    type === 'error'
      ? XCircle
      : type === 'warning'
      ? AlertTriangle
      : type === 'info'
      ? Info
      : CheckCircle2;
  const accent =
    type === 'error'
      ? 'text-rose-400'
      : type === 'warning'
      ? 'text-amber-400'
      : type === 'info'
      ? 'text-sky-400'
      : 'text-emerald-400';

  return (
    <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs flex items-center gap-2.5 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150 max-w-md">
      <Icon className={`w-4 h-4 shrink-0 ${accent}`} />
      <span className="font-medium flex-1">{msg}</span>
      {toastNotice?.onUndo && (
        <button
          type="button"
          onClick={() => {
            toastNotice.onUndo?.();
            dismissToast();
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/15 hover:bg-white/25 text-amber-300 font-bold cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{toastNotice.undoLabel || 'Undo'}</span>
        </button>
      )}
      <button
        type="button"
        onClick={dismissToast}
        aria-label="Dismiss notification"
        className="text-slate-400 hover:text-white cursor-pointer shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

const GlobalConfirmDialog: React.FC = () => {
  const { confirmDialog, closeConfirmation } = useVyapar();
  if (!confirmDialog) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-5 space-y-4 text-xs text-slate-800 dark:text-slate-100">
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              confirmDialog.variant === 'danger'
                ? 'bg-rose-100 text-rose-700'
                : confirmDialog.variant === 'warning'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">{confirmDialog.title}</h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              {confirmDialog.message}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={closeConfirmation}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              await confirmDialog.onConfirm();
              closeConfirmation();
            }}
            className={`px-4 py-2 rounded-lg font-bold text-white cursor-pointer ${
              confirmDialog.variant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700'
                : confirmDialog.variant === 'warning'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-[#8B0D1E] hover:bg-[#740918]'
            }`}
          >
            {confirmDialog.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const {
    activeTab,
    isAuthenticated,
    portalStage,
    activeSessionType,
    currentUser,
    logout,
    isLogoutModalOpen,
    setIsLogoutModalOpen,
    isAccessRestrictedOpen,
    setIsAccessRestrictedOpen,
    restrictedFeatureName,
  } = useVyapar();

  const [isScreenLocked, setIsScreenLocked] = useState(false);

  // Public Standalone Customer Quotation Approval Portal (?quoteToken=...)
  const quoteToken =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('quoteToken')
      : null;
  if (quoteToken) {
    return <CustomerQuotationPortal token={quoteToken} />;
  }

  // First screen when unauthenticated: User Type Selection -> Customer / Staff Login
  if (!isAuthenticated) {
    if (portalStage === 'customer-login' || portalStage === 'customer-register') {
      return <CustomerLoginView />;
    }
    if (portalStage === 'staff-login') {
      return <StaffLoginView />;
    }
    return <WelcomePortalScreen />;
  }

  // Dedicated Isolated Customer Dashboard
  if (activeSessionType === 'CUSTOMER') {
    return (
      <>
        <CustomerDashboard />
        <InvoicePreviewModal />
        <LogoutConfirmModal
          isOpen={isLogoutModalOpen}
          onClose={() => setIsLogoutModalOpen(false)}
          onConfirmLogout={logout}
        />
        <GlobalConfirmDialog />
        <GlobalToastBanner />
      </>
    );
  }

  // Dedicated Role-Specific Staff Portal Dashboards
  if (activeSessionType === 'STAFF') {
    const rName = (currentUser?.roleName || '').toLowerCase();
    const rId = (currentUser?.roleId || '').toLowerCase();

    const renderStaffPortal = () => {
      if (rName === 'seller' || rId === 'role-seller') {
        return <SellerPortal />;
      }
      if (rName === 'online store manager' || rId === 'role-online-manager') {
        return <OnlineManagerPortal />;
      }
      if (rName.includes('delivery') || rId === 'role-delivery') {
        return <DeliveryBoyPortal />;
      }
      return <StaffDashboard />;
    };

    return (
      <>
        {renderStaffPortal()}
        <AddSaleModal />
        <AddPartyModal />
        <AddItemModal />
        <BarcodeScannerModal />
        <InvoicePreviewModal />
        <LogoutConfirmModal
          isOpen={isLogoutModalOpen}
          onClose={() => setIsLogoutModalOpen(false)}
          onConfirmLogout={logout}
        />
        <AccessRestrictedModal
          isOpen={isAccessRestrictedOpen}
          onClose={() => setIsAccessRestrictedOpen(false)}
          featureName={restrictedFeatureName}
        />
        <GlobalConfirmDialog />
        <GlobalToastBanner />
      </>
    );
  }

  const renderActiveView = () => {
    switch (activeTab) {
      // 1. Dashboard
      case 'home':
      case 'dashboard':
        return <MyStoreDashboard />;

      // 2. Point of Sale (POS)
      case 'pos':
      case 'vyapar-pos':
        return <MyStorePosView />;

      // 3. Sale Invoices
      case 'sale-invoices':
        return <SaleInvoicesView />;

      // 4. Estimate / Quotation
      case 'estimate-quotation':
        return <EstimateQuotationView type="Estimate/Quotation" />;

      // 5. Proforma Invoice
      case 'proforma-invoice':
        return <EstimateQuotationView type="Proforma Invoice" />;

      // 6. Sales Order
      case 'sale-order':
        return <SaleOrderView />;

      // 7. Delivery Challan
      case 'delivery-challan':
        return <DeliveryChallanView />;

      // 8. Sales Return / Credit Note
      case 'sale-return':
      case 'credit-note':
        return <CreditNoteView />;

      // 9. Purchase Bills & AI Bill Scanner
      case 'purchase':
      case 'purchase-bills':
        return <PurchaseView />;

      case 'purchase-scanner':
        return <PurchaseBillScannerView />;

      // 10. Purchase Order
      case 'purchase-order':
        return <PurchaseOrderView />;

      // 11. Purchase Return / Debit Note
      case 'debit-note':
      case 'purchase-return':
        return <DebitNoteView />;

      // E-Invoice & E-Way Bill
      case 'e-invoice':
        return <EInvoiceEWayBillView />;

      // 12. Customers
      case 'customers':
        return <PartiesView typeFilter="Customer" />;

      // 13. Suppliers
      case 'suppliers':
        return <PartiesView typeFilter="Supplier" />;

      // All Parties
      case 'parties':
        return <PartiesView typeFilter="All" />;

      // 14. Items / Catalog
      case 'items':
        return <ItemsView />;

      // 15. Categories
      case 'categories':
        return <CategoriesView />;

      // 16. Units
      case 'units':
        return <UnitsView />;

      // 17. Stock Summary & Aging
      case 'stock-summary':
      case 'stock':
        return <StockSummaryView initialFilter="All" />;

      case 'stock-aging':
        return <StockSummaryView initialFilter="LowStock" />;

      // 18. Stock Adjustment
      case 'stock-adjustment':
        return <StockAdjustmentView />;

      // 19. Stock Transfer
      case 'stock-transfer':
        return <StockTransferView />;

      // 20. Warehouses / Godowns
      case 'warehouses':
        return <WarehousesView />;

      // 21. Barcode Studio & HSN/SAC GST Management
      case 'barcode-studio':
        return <BarcodeStudioView />;

      case 'hsn-gst':
      case 'gst-center':
        return <HsnGstManagementView />;

      // 22. Payment-In
      case 'payment-in':
        return <PaymentInView />;

      // 23. Payment-Out
      case 'payment-out':
        return <PaymentOutView />;

      // 24. Cash & Bank / Accounting
      case 'accounting':
      case 'cash-bank':
      case 'cash-account':
        return <CashBankView initialTab="cash" />;

      case 'erp-accounting':
      case 'accounting-erp':
        return <AccountingErpView />;

      case 'erp-inventory':
        return <InventoryEnterpriseView />;

      case 'erp-tools':
      case 'backup':
        return <ErpToolsView />;

      case 'bank-accounts':
        return <CashBankView initialTab="bank" />;

      // 25. Expenses
      case 'expenses':
      case 'expense':
        return <ExpensesView />;

      // 26. Other Income
      case 'other-income':
      case 'income':
        return <IncomeView />;

      // 27. Reports Hub
      case 'reports':
        return <ReportsHubView />;

      // 28. Settings
      case 'settings':
      case 'settings-hub':
        return <SettingsHubView />;

      // RBAC Staff & Roles
      case 'staff-management':
        return <StaffManagementView />;

      // Customer & Staff Portal Management (Admin Only)
      case 'customer-staff-portal':
        return <CustomerStaffManagementView />;

      // Security Audit Trail
      case 'audit-log':
        return <AuditLogView />;

      // Showcase / Demo Hub
      case 'demo-page':
        return <DemoFeaturesView />;

      // Fixed Assets / Specialized Sales
      case 'sale-fa':
        return <SaleFaView />;

      // 6-Module Upgrade Views
      case 'smart-inventory':
        return <SmartInventoryView />;
      case 'udhar-khata':
        return <UdharKhataView />;
      case 'profit-loss':
        return <ProfitLossDashboardView />;
      case 'online-orders':
        return <OnlineOrdersAdminView />;
      case 'ai-assistant':
        return <AiAssistantView />;
      case 'crm-loyalty':
        return <CrmLoyaltyView />;
      case 'transaction-engine':
        return <TransactionEngineView />;

      default:
        return <MyStoreDashboard />;
    }
  };

  return (
    <div className="h-screen w-screen flex bg-[#f8fafc] dark:bg-slate-950 text-[#1e293b] dark:text-slate-100 overflow-hidden select-none font-sans">
      <div className="flex-1 flex h-full w-full overflow-hidden">
        {/* 1. Full-Height Left Crimson Sidebar matching exact specifications */}
        <Sidebar />

        {/* 2. Right Content Area: Top Navigation & Action Bars + Active View */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <TopActionBar onLockScreen={() => setIsScreenLocked(true)} />
          <main className="flex-1 flex flex-col overflow-hidden relative bg-[#f5f6fa] dark:bg-slate-950">
            {renderActiveView()}
          </main>
        </div>
      </div>

      {isScreenLocked && <LockScreen onUnlock={() => setIsScreenLocked(false)} />}

      {/* Global Interactive Modals */}
      <AddSaleModal />
      <AddPurchaseModal />
      <InvoicePreviewModal />
      <CompanyModal />
      <SettingsModal />
      <ShortcutsModal />
      <HelpModal />
      <VersionsModal />
      <SupportModal />
      <CommandPaletteModal />
      <AnalyticsModal />
      <PremiumModal />
      <MyStoreModal />
      <AddPartyModal />
      <AddItemModal />
      <BarcodeScannerModal />
      <UserAuthModal />
      <AddEmployeeModal />
      <RoleEditorModal />
      <EmployeeProfileModal />

      {/* Logout Confirmation & Access Restricted Modals */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirmLogout={logout}
      />

      <AccessRestrictedModal
        isOpen={isAccessRestrictedOpen}
        onClose={() => setIsAccessRestrictedOpen(false)}
        featureName={restrictedFeatureName}
      />

      <GlobalConfirmDialog />
      <GlobalToastBanner />
    </div>
  );
};

export default function App() {
  return (
    <VyaparProvider>
      <AppContent />
    </VyaparProvider>
  );
}