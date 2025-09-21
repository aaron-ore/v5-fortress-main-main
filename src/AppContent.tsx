import { useEffect, useRef, lazy, Suspense } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
// Import pdfContentComponents from the centralized config file
import { pdfContentComponents } from "./lib/reportConfig";

import { useOnboarding } from "./context/OnboardingContext";
import { useProfile } from "./context/ProfileContext"; // Removed UserProfile import as it's not directly used here
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
import ErrorBoundary from "./components/ErrorBoundary";
import PrintWrapper from "./components/PrintWrapper";
import { Loader2 } from "lucide-react";
import { useTutorial } from "./context/TutorialContext"; // NEW: Import TutorialProvider and useTutorial
import TutorialTooltip from "./components/TutorialTooltip"; // NEW: Import TutorialTooltip

// Dynamically import all page components for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Orders = lazy(() => import("./pages/Orders"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CreatePurchaseOrder = lazy(() => import("./pages/CreatePurchaseOrder"));
const EditInventoryItem = lazy(() => import("./pages/EditInventoryItem"));
const EditPurchaseOrder = lazy(() => import("./pages/EditPurchaseOrder"));
const Auth = lazy(() => import("./pages/Auth"));
const MyProfile = lazy(() => import("./pages/MyProfile"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const BillingSubscriptions = lazy(() => import("./pages/BillingSubscriptions"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const WhatsNew = lazy(() => import("./pages/WhatsNew"));
const Vendors = lazy(() => import("./pages/Vendors"));
const Users = lazy(() => import("./pages/Users"));
const CreateInvoice = lazy(() => import("./pages/CreateInvoice"));
const SetupInstructions = lazy(() => import("./pages/SetupInstructions"));
const WarehouseOperationsPage = lazy(() => import("./pages/WarehouseOperationsPage"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Folders = lazy(() => import("./pages/Locations"));
const Customers = lazy(() => import("./pages/Customers"));
const Integrations = lazy(() => import("./pages/Integrations"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const Automation = lazy(() => import("./pages/Automation"));
const ItemHistoryPage = lazy(() => import("./pages/ItemHistoryPage"));
const FolderContentPage = lazy(() => import("./pages/FolderContentPage"));

// Fallback component for Suspense
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
    <Loader2 className="h-10 w-10 animate-spin text-primary" />
    <span className="ml-4 text-lg">Loading page...</span>
  </div>
);

const AuthenticatedApp = () => { // Removed profile prop
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
                        <Suspense fallback={<LoadingFallback />}>
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
                              <Route path="reset-password" element={<ResetPassword />} />
                              <Route path="folders" element={<Folders />} />
                              <Route path="folders/:folderId" element={<FolderContentPage />} />
                              <Route path="integrations" element={<Integrations />} />
                              <Route path="automation" element={<Automation />} />
                              <Route path="*" element={<NotFound />} />
                            </Route>
                          </Routes>
                        </Suspense>
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
  const { isTutorialActive, currentStep } = useTutorial(); // NEW: Use tutorial context

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
    <ErrorBoundary> {/* Removed profile prop */}
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/*" element={<AuthenticatedApp />} /> {/* Removed profile prop */}
      </Routes>
    </ErrorBoundary>
  ) : (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Auth />} />
      </Routes>
    </Suspense>
  );

  const renderPdfComponent = () => {
    if (!printContentData) return null;

    console.log("[AppContent] Rendering PDF component for type:", printContentData.type);

    const PdfComponent = pdfContentComponents[printContentData.type];

    if (PdfComponent) {
      return <PdfComponent {...printContentData.props} />;
    } else {
      return <div>Unknown PDF Report Type: {printContentData.type}</div>;
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

      {isTutorialActive && currentStep && ( // NEW: Render tutorial tooltip
        <TutorialTooltip step={currentStep} />
      )}
    </>
  );
};

export default AppContent;