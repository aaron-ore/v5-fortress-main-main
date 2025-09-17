import { useEffect, useRef } from "react";
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
import Folders from "./pages/Locations"; // Changed import from Locations to Folders
import Customers from "./pages/Customers";
import Integrations from "./pages/Integrations";
import OnboardingPage from "./pages/OnboardingPage";
import ErrorBoundary from "./components/ErrorBoundary";
import PrintWrapper from "./components/PrintWrapper";

import PurchaseOrderPdfContent from "./components/PurchaseOrderPdfContent";
import InvoicePdfContent from "./components/InvoicePdfContent";
import LocationLabelPdfContent from "./components/LocationLabelPdfContent";
import PickingWavePdfContent from "./components/PickingWavePdfContent";

import DashboardSummaryPdfContent from "./components/reports/pdf/DashboardSummaryPdfContent";
import AdvancedDemandForecastPdfContent from "./components/reports/pdf/AdvancedDemandForecastPdfContent";
import PutawayLabelPdfContent from "./components/reports/pdf/PutawayLabelPdfContent";

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
import { showSuccess, showError } from "./utils/toast";

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
import FolderContentPage from "./pages/FolderContentPage"; // NEW: Import FolderContentPage
import { Loader2 } from "lucide-react";


const AuthenticatedApp = () => {
  const {  } = useOnboarding();

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
                            <Route path="folders" element={<Folders />} />
                            <Route path="folders/:folderId" element={<FolderContentPage />} /> {/* NEW: Route for folder content */}
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

    // Handle Shopify callback
    if ((shopifySuccess || shopifyError) && !shopifyCallbackProcessedRef.current) {
      if (shopifySuccess) {
        showSuccess("Shopify connected successfully!");
      } else if (shopifyError) {
        showError(`Shopify connection failed: ${shopifyError}`);
      }
      shopifyCallbackProcessedRef.current = true;
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

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

  const renderPdfComponent = () => {
    if (!printContentData) return null;

    console.log("[AppContent] Rendering PDF component for type:", printContentData.type); // NEW: Log the type

    switch (printContentData.type) {
      case "purchase-order":
        return <PurchaseOrderPdfContent {...printContentData.props} />;
      case "invoice":
        return <InvoicePdfContent {...printContentData.props} />;
      case "dashboard-summary":
        return <DashboardSummaryPdfContent {...printContentData.props} />;
      case "advanced-demand-forecast":
        return <AdvancedDemandForecastPdfContent {...printContentData.props} />;
      case "putaway-label":
        return <PutawayLabelPdfContent {...printContentData.props} />;
      case "location-label":
        return <LocationLabelPdfContent {...printContentData.props} />;
      case "picking-wave":
        return <PickingWavePdfContent {...printContentData.props} />;
      case "inventory-valuation-report":
        return <InventoryValuationPdfContent {...printContentData.props} />;
      case "low-stock-report":
        return <LowStockPdfContent {...printContentData.props} />;
      case "inventory-movement-report":
        return <InventoryMovementPdfContent {...printContentData.props} />;
      case "sales-by-customer-report":
        return <SalesByCustomerPdfContent {...printContentData.props} />;
      case "sales-by-product-report":
        return <SalesByProductPdfContent {...printContentData.props} />;
      case "purchase-order-status-report":
        return <PurchaseOrderStatusPdfContent {...printContentData.props} />;
      case "profitability-report":
        return <ProfitabilityPdfContent {...printContentData.props} />;
      case "discrepancy-report":
        return <DiscrepancyPdfContent {...printContentData.props} />;
      default:
        return <div>Unknown PDF Report Type</div>;
    }
  };

  return (
    <>
      <div className={isPrinting ? "hidden" : ""}>
        {mainAppRoutes}
      </div>

      {isPrinting && printContentData && (
        <PrintWrapper contentData={printContentData} onPrintComplete={resetPrintState}>
          {renderPdfComponent()}
        </PrintWrapper>
      )}
    </>
  );
};

export default AppContent;