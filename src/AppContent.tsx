import React, { useEffect, useRef } from "react"; // Re-added React, useEffect, useRef
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Orders from "./pages/Orders";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import CreatePurchaseOrder from "./pages/CreatePurchaseOrder";
import EditInventoryItem from "./pages/EditInventoryItem";
import EditPurchaseOrder from "./pages/EditPurchaseOrder";
import Auth from "./pages/Auth";
import MyProfile from "./pages/MyProfile";
import AccountSettings from "./pages/AccountSettings";
import NotificationsPage from "./pages/NotificationsPage";
import BillingSubscriptions from "./pages/BillingSubscriptions";
import HelpCenter from "./pages/HelpCenter";
import WhatsNew from "./pages/WhatsNew";
import Vendors from "./pages/Vendors";
import Users from "./pages/Users";
import CreateInvoice from "./pages/CreateInvoice";
import SetupInstructions from "./pages/SetupInstructions";
import WarehouseOperationsPage from "./pages/WarehouseOperationsPage";
import ResetPassword from "./pages/ResetPassword";
import Locations from "./pages/Locations";
import Customers from "./pages/Customers";
import Integrations from "./pages/Integrations";
import OnboardingPage from "./pages/OnboardingPage";
import ErrorBoundary from "./components/ErrorBoundary";
import PrintWrapper from "./components/PrintWrapper";
import DashboardSummaryPdfContent from "./components/DashboardSummaryPdfContent";
import PurchaseOrderPdfContent from "./components/PurchaseOrderPdfContent";
import InvoicePdfContent from "./components/InvoicePdfContent";
import AdvancedDemandForecastPdfContent from "./components/AdvancedDemandForecastPdfContent";
import PutawayLabelPdfContent from "./components/PutawayLabelPdfContent";
import LocationLabelPdfContent from "./components/LocationLabelPdfContent";
import PickingWavePdfContent from "./components/PickingWavePdfContent";

// Import all new PDF content components
import InventoryValuationPdfContent from "./components/reports/pdf/InventoryValuationPdfContent";
import LowStockPdfContent from "./components/reports/pdf/LowStockPdfContent";
import InventoryMovementPdfContent from "./components/reports/pdf/InventoryMovementPdfContent";
import SalesByCustomerPdfContent from "./components/reports/pdf/SalesByCustomerPdfContent";
import SalesByProductPdfContent from "./components/reports/pdf/SalesByProductPdfContent";
import PurchaseOrderStatusPdfContent from "./components/reports/pdf/PurchaseOrderStatusPdfContent";
import ProfitabilityPdfContent from "./components/reports/pdf/ProfitabilityPdfContent";
import DiscrepancyPdfContent from "./components/reports/pdf/DiscrepancyPdfContent";

import { useOnboarding } from "./context/OnboardingContext";
import { useProfile } from "./context/ProfileContext";
import { usePrint } from "./context/PrintContext";
import { supabase } from "./lib/supabaseClient";
import { showSuccess, showError } from "./utils/toast";

// Import all providers needed for AuthenticatedApp
import { SidebarProvider } from "./context/SidebarContext";
import { OrdersProvider } from "./context/OrdersContext";
import { VendorProvider } from "./context/VendorContext";
import { CustomerProvider } from "./context/CustomerContext";
import { CategoryProvider } from "./context/CategoryContext";
import { NotificationProvider } from "./context/NotificationContext";
import { StockMovementProvider } from "./context/StockMovementContext";
import { ReplenishmentProvider } from "./context/ReplenishmentContext";
import { InventoryProvider } from "./context/InventoryContext";
import { AutomationProvider } from "./context/AutomationContext";
import Automation from "./pages/Automation";
import ItemHistoryPage from "./pages/ItemHistoryPage";
import { Loader2 } from "lucide-react";


// Moved AuthenticatedApp definition here
const AuthenticatedApp = () => {
  const { isOnboardingComplete } = useOnboarding();

  return (
    <SidebarProvider>
      <OrdersProvider>
        <VendorProvider>
          <CustomerProvider>
            <CategoryProvider>
              <NotificationProvider>
                <StockMovementProvider>
                  <ReplenishmentProvider>
                    <InventoryProvider>
                      <AutomationProvider>
                        <Routes>
                          <Route path="/" element={<Layout />}>
                            <Route index element={<Dashboard />} />
                            <Route path="inventory" element={<Inventory />} />
                            <Route path="inventory/:id" element={<EditInventoryItem />} />
                            <Route path="inventory/:id/history" element={<ItemHistoryPage />} />
                            <Route path="orders" element={<Orders />} />
                            <Route path="orders/:id" element={<EditPurchaseOrder />} />
                            <Route path="reports" element={<Reports />} />
                            <Route path="settings" element={<Settings />} />
                            <Route path="create-po" element={<CreatePurchaseOrder />} />
                            <Route path="create-invoice" element={<CreateInvoice />} />
                            <Route path="profile" element={<MyProfile />} />
                            <Route path="account-settings" element={<AccountSettings />} />
                            <Route path="notifications-page" element={<NotificationsPage />} />
                            <Route path="billing" element={<BillingSubscriptions />} />
                            <Route path="help" element={<HelpCenter />} />
                            <Route path="whats-new" element={<WhatsNew />} />
                            <Route path="vendors" element={<Vendors />} />
                            <Route path="customers" element={<Customers />} />
                            <Route path="users" element={<Users />} />
                            <Route path="setup-instructions" element={<SetupInstructions />} />
                            <Route path="warehouse-operations" element={<WarehouseOperationsPage />} />
                            <Route path="locations" element={<Locations />} />
                            <Route path="integrations" element={<Integrations />} />
                            <Route path="automation" element={<Automation />} />
                            <Route path="*" element={<NotFound />} />
                          </Route>
                        </Routes>
                      </AutomationProvider>
                    </InventoryProvider>
                  </ReplenishmentProvider>
                </StockMovementProvider>
              </NotificationProvider>
            </CategoryProvider>
          </CustomerProvider>
        </VendorProvider>
      </OrdersProvider>
    </SidebarProvider>
  );
};

const AppContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoadingProfile, profile } = useProfile();
  const { isPrinting, printContentData, resetPrintState } = usePrint();
  const { locations: structuredLocations } = useOnboarding();
  const { companyProfile } = useOnboarding();

  const qbCallbackProcessedRef = useRef(false);
  const shopifyCallbackProcessedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const quickbooksSuccess = params.get('quickbooks_success');
    const quickbooksError = params.get('quickbooks_error');
    const shopifySuccess = params.get('shopify_success');
    const shopifyError = params.get('shopify_error');

    console.log('AppContent.tsx: quickbooks_success from URL parameters:', quickbooksSuccess);
    console.log('AppContent.tsx: quickbooks_error from URL parameters:', quickbooksError);
    console.log('AppContent.tsx: shopify_success from URL parameters:', shopifySuccess);
    console.log('AppContent.tsx: shopify_error from URL parameters:', shopifyError);

    if ((quickbooksSuccess || quickbooksError) && !qbCallbackProcessedRef.current) {
      if (quickbooksSuccess) {
        showSuccess("QuickBooks connected successfully!");
      } else if (quickbooksError) {
        showError(`QuickBooks connection failed: ${quickbooksError}`);
      }
      qbCallbackProcessedRef.current = true;
      navigate('/integrations', { replace: true });
    }

    if ((shopifySuccess || shopifyError) && !shopifyCallbackProcessedRef.current) {
      if (shopifySuccess) {
        showSuccess("Shopify connected successfully!");
      } else if (shopifyError) {
        showError(`Shopify connection failed: ${shopifyError}`);
      }
      shopifyCallbackProcessedRef.current = true;
      navigate('/integrations', { replace: true });
    }
  }, [location.search, navigate]);

  useEffect(() => {
    if (isPrinting && printContentData?.type === "location-label") {
      document.documentElement.classList.add("print-mode-label");
    } else {
      document.documentElement.classList.remove("print-mode-label");
    }
  }, [isPrinting, printContentData]);

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="ml-4 text-lg">Loading application...</span>
      </div>
    );
  }

  const mainAppRoutes = profile ? (
    <ErrorBoundary>
      <Routes>
        <Route path="/*" element={<AuthenticatedApp />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Routes>
    </ErrorBoundary>
  ) : (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<Auth />} />
    </Routes>
  );

  return (
    <>
      <div className={isPrinting ? "hidden" : ""}>
        {mainAppRoutes}
      </div>

      {printContentData && (
        <PrintWrapper contentData={printContentData} onPrintComplete={resetPrintState}>
          {printContentData.type === "purchase-order" && (
            <PurchaseOrderPdfContent {...printContentData.props} />
          )}
          {printContentData.type === "invoice" && (
            <InvoicePdfContent {...printContentData.props} />
          )}
          {printContentData.type === "dashboard-summary" && (
            <DashboardSummaryPdfContent {...printContentData.props} />
          )}
          {printContentData.type === "advanced-demand-forecast" && (
            <AdvancedDemandForecastPdfContent {...printContentData.props} />
          )}
          {printContentData.type === "putaway-label" && (
            <PutawayLabelPdfContent {...printContentData.props} />
          )}
          {printContentData.type === "location-label" && (
            <LocationLabelPdfContent {...printContentData.props} />
          )}
          {printContentData.type === "picking-wave" && (
            <PickingWavePdfContent {...printContentData.props} />
          )}
          {printContentData.type === "inventory-valuation-report" && (
            <InventoryValuationPdfContent {...printContentData.props} />
          )}
          {printContentData.type === "low-stock-report" && (
            <LowStockPdfContent {...printContentData.props} />
          )}
          {printContentData.type === "inventory-movement-report" && (
            <InventoryMovementPdfContent {...printContentData.props} />
          )}
          {printContentData.type === "sales-by-customer-report" && (
            <SalesByCustomerPdfContent {...printContentData.props} />
          )}
          {printContentData.type === "sales-by-product-report" && (
            <SalesByProductPdfContent {...printContentData.props} />
          )}
          {printContentData.type === "purchase-order-status-report" && (
            <PurchaseOrderStatusPdfContent {...printContentData.props} />
          )}
          {printContentData.type === "profitability-report" && (
            <ProfitabilityPdfContent {...printContentData.props} />
          )}
          {printContentData.type === "discrepancy-report" && (
            <DiscrepancyPdfContent {...printContentData.props} />
          )}
        </PrintWrapper>
      )}
    </>
  );
};

export default AppContent;