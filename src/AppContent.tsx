import { useEffect, useRef, lazy, Suspense, useState, startTransition } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
// Import pdfContentComponents from the centralized config file
import { pdfContentComponents } from "./lib/reportConfig";

// Removed: import { useOnboarding } from "./context/OnboardingContext";
import { useProfile } from "./context/ProfileContext"; // Removed UserProfile import as it's not directly used here
import { usePrint } from "./context/PrintContext";
import { showSuccess, showError, showInfo } from "./utils/toast"; // ADDED showInfo

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
// Removed: import { useTutorial } from "./context/TutorialContext";
// Removed: import TutorialTooltip from "./components/TutorialTooltip";
import UpgradePromptDialog from "./components/UpgradePromptDialog";
import LiveChatWidget from "./components/LiveChatWidget";
import Footer from "./components/Footer"; // NEW: Import Footer

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
const ActivityLogs = lazy(() => import("./pages/ActivityLogs"));
const TermsOfService = lazy(() => import("./pages/TermsOfService")); // NEW: Import TermsOfService
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy")); // NEW: Import PrivacyPolicy
const RefundPolicy = lazy(() => import("./pages/RefundPolicy")); // NEW: Import RefundPolicy


// Fallback component for Suspense
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
    <Loader2 className="h-10 w-10 animate-spin text-primary" />
    <span className="ml-4 text-lg">Loading page...</span>
  </div>
);

const AuthenticatedApp = () => {
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
                          {/* This is the main layout for authenticated users */}
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
                              <Route path="activity-logs" element={<ActivityLogs />} />
                              <Route path="setup-instructions" element={<SetupInstructions />} />
                              <Route path="warehouse-operations" element={<WarehouseOperationsPage />} />
                              <Route path="reset-password" element={<ResetPassword />} />
                              <Route path="folders" element={<Folders />} />
                              <Route path="folders/:folderId" element={<FolderContentPage />} />
                              <Route path="integrations" element={<Integrations />} />
                              <Route path="automation" element={<Automation />} />
                              <Route path="terms-of-service" element={<TermsOfService />} /> {/* NEW: Route for TermsOfService */}
                              <Route path="privacy-policy" element={<PrivacyPolicy />} /> {/* NEW: Route for PrivacyPolicy */}
                              <Route path="refund-policy" element={<RefundPolicy />} /> {/* NEW: Route for RefundPolicy */}
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
  // Removed: const { isTutorialActive, currentStep } = useTutorial();

  const qbCallbackProcessedRef = useRef(false);
  const shopifyCallbackProcessedRef = useRef(false);
  const dodoCallbackProcessedRef = useRef(false); // RE-ADDED

  const [isUpgradePromptDialogOpen, setIsUpgradePromptDialogOpen] = useState(false);

  useEffect(() => {
    // 1. Handle URL cleanup (e.g., removing Google's #_=_ hash)
    if (location.hash) {
      console.log("[AppContent] Detected URL hash. Clearing it for clean routing.");
      // Clear hash, keep search params
      navigate(location.pathname + location.search, { replace: true });
      return; // Exit this effect run, a new render cycle will start with the cleaned URL
    }

    // 2. Handle OAuth success/error messages (after hash is cleared)
    const params = new URLSearchParams(location.search);
    const quickbooksSuccess = params.get('quickbooks_success');
    const quickbooksError = params.get('quickbooks_error');
    const shopifySuccess = params.get('shopify_success');
    const shopifyError = params.get('shopify_error');
    const dodoCheckoutStatus = params.get('dodo_checkout_status'); // RE-ADDED

    if (quickbooksSuccess && !qbCallbackProcessedRef.current) {
      showSuccess("QuickBooks connected!");
      qbCallbackProcessedRef.current = true;
      navigate('/integrations', { replace: true });
      return; // Exit after navigation
    } else if (quickbooksError && !qbCallbackProcessedRef.current) {
      showError(`QuickBooks connection failed: ${quickbooksError}`);
      qbCallbackProcessedRef.current = true;
      navigate('/integrations', { replace: true });
      return; // Exit after navigation
    }

    if (shopifySuccess && !shopifyCallbackProcessedRef.current) {
      showSuccess("Shopify connected!");
      shopifyCallbackProcessedRef.current = true;
      navigate(location.pathname, { replace: true });
      return; // Exit after navigation
    } else if (shopifyError && !shopifyCallbackProcessedRef.current) {
      showError(`Shopify connection failed: ${shopifyError}`);
      shopifyCallbackProcessedRef.current = true;
      navigate(location.pathname, { replace: true });
      return; // Exit after navigation
    }

    if (dodoCheckoutStatus && !dodoCallbackProcessedRef.current) { // RE-ADDED
      if (dodoCheckoutStatus === 'completed') {
        showSuccess("Dodo checkout completed!");
      } else if (dodoCheckoutStatus === 'cancelled') {
        showError("Dodo checkout cancelled.");
      } else {
        showInfo(`Dodo checkout status: ${dodoCheckoutStatus}`);
      }
      const newSearchParams = new URLSearchParams(params);
      newSearchParams.delete('dodo_checkout_status');
      newSearchParams.delete('organization_id');
      newSearchParams.delete('user_id');
      navigate({ search: newSearchParams.toString() }, { replace: true });
      dodoCallbackProcessedRef.current = true; // Mark as processed
      return; // Exit after navigation
    }

    // 3. Handle primary routing for authenticated users (after URL is clean and OAuth messages handled)
    console.log("[AppContent] Primary routing logic. isLoadingProfile:", isLoadingProfile, "profile:", profile, "location.pathname:", location.pathname);
    if (!isLoadingProfile && profile) {
      // User is authenticated
      if (location.pathname === '/auth') {
        if (profile.organizationId && profile.hasOnboardingWizardCompleted) {
          console.log("[AppContent] Authenticated, onboarding complete, on /auth. Redirecting to dashboard.");
          startTransition(() => {
            navigate('/', { replace: true });
          });
        } else {
          console.log("[AppContent] Authenticated, onboarding NOT complete, on /auth. Redirecting to onboarding.");
          startTransition(() => {
            navigate('/onboarding', { replace: true });
          });
        }
      } else if (!profile.organizationId && location.pathname !== '/onboarding') {
        console.log("[AppContent] Authenticated but no organization. Redirecting to onboarding to create/join org.");
        startTransition(() => {
            navigate('/onboarding', { replace: true });
        });
      }
      // If authenticated, onboarding complete, and on dashboard, show upgrade prompt if applicable
      if (
        profile.organizationId &&
        profile.hasOnboardingWizardCompleted &&
        !profile.hasSeenUpgradePrompt &&
        profile.companyProfile?.plan === 'free' &&
        location.pathname === '/'
      ) {
        console.log("[AppContent] Showing upgrade prompt.");
        setIsUpgradePromptDialogOpen(true);
      } else if (isUpgradePromptDialogOpen) {
        setIsUpgradePromptDialogOpen(false);
      }
    }
  }, [
    location.hash, location.search, location.pathname, navigate,
    qbCallbackProcessedRef, shopifyCallbackProcessedRef, dodoCallbackProcessedRef, // RE-ADDED
    isLoadingProfile, profile, isUpgradePromptDialogOpen,
  ]);

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
        <Route path="/onboarding" element={
          <Suspense fallback={<LoadingFallback />}>
            <OnboardingPage />
          </Suspense>
        } />
        <Route path="/*" element={<AuthenticatedApp />} />
      </Routes>
    </ErrorBoundary>
  ) : (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms-of-service" element={<TermsOfService />} /> {/* NEW: Public route for TermsOfService */}
        <Route path="/privacy-policy" element={<PrivacyPolicy />} /> {/* NEW: Public route for PrivacyPolicy */}
        <Route path="/refund-policy" element={<RefundPolicy />} /> {/* NEW: Public route for RefundPolicy */}
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
        {/* Only show footer if not in print mode and not on onboarding page */}
        {!isPrinting && location.pathname !== '/onboarding' && location.pathname !== '/auth' && (
          <Footer />
        )}
      </div>

      {isPrinting && printContentData && (
        <PrintWrapper contentData={printContentData} onPrintComplete={resetPrintState}>
          {renderPdfComponent()}
        </PrintWrapper>
      )}

      {/* Removed: {isTutorialActive && currentStep && (
        <TutorialTooltip step={currentStep} />
      )} */}

      <UpgradePromptDialog
        isOpen={isUpgradePromptDialogOpen}
        onClose={() => setIsUpgradePromptDialogOpen(false)}
      />

      {!isLoadingProfile && profile && <LiveChatWidget />}
    </>
  );
};

export default AppContent;