"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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
import OnboardingWizard from "./components/onboarding/OnboardingWizard"; // Keep import for OnboardingPage
import ErrorBoundary from "./components/ErrorBoundary";
import PrintWrapper from "./components/PrintWrapper";
import DashboardSummaryPdfContent from "./components/DashboardSummaryPdfContent";
import PurchaseOrderPdfContent from "./components/PurchaseOrderPdfContent";
import InvoicePdfContent from "./components/InvoicePdfContent";
import AdvancedDemandForecastPdfContent from "./components/AdvancedDemandForecastPdfContent";
import PutawayLabelPdfContent from "./components/PutawayLabelPdfContent";
import LocationLabelPdfContent from "./components/LocationLabelPdfContent";
import PickingWavePdfContent from "./components/PickingWavePdfContent";

// NEW: Import all new PDF content components
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

// NEW: Import all providers needed for AuthenticatedApp
import { SidebarProvider } from "./context/SidebarContext";
import { OrdersProvider } from "./context/OrdersContext";
import { VendorProvider } from "./context/VendorContext";
import { CustomerProvider } from "./context/CustomerContext";
import { CategoryProvider } from "./context/CategoryContext";
import { NotificationProvider } from "./context/NotificationContext";
import { StockMovementProvider } from "./context/StockMovementContext";
import { ReplenishmentProvider } from "./context/ReplenishmentContext";
import { InventoryProvider } from "./context/InventoryContext";
import { AutomationProvider } from "./context/AutomationContext"; // NEW: Import AutomationProvider
import Automation from "./pages/Automation"; // NEW: Import Automation page
import ItemHistoryPage from "./pages/ItemHistoryPage"; // NEW: Import ItemHistoryPage
import OnboardingPage from "./pages/OnboardingPage"; // NEW: Import OnboardingPage
import { Loader2 } from "lucide-react"; // NEW: Import Loader2 icon


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
                      <AutomationProvider> {/* NEW: Wrap with AutomationProvider */}
                        <Routes>
                          <Route path="/" element={<Layout />}>
                            <Route index element={<Dashboard />} />
                            <Route path="inventory" element={<Inventory />} />
                            <Route path="inventory/:id" element={<EditInventoryItem />} />
                            <Route path="inventory/:id/history" element={<ItemHistoryPage />} /> {/* NEW: Add ItemHistoryPage route */}
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
                            <Route path="automation" element={<Automation />} /> {/* NEW: Add Automation route */}
                            <Route path="*" element={<NotFound />} />
                          </Route>
                        </Routes>
                      </AutomationProvider> {/* NEW: Close AutomationProvider */}
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
  const { isLoadingProfile, profile, fetchProfile } = useProfile(); // Use profile and isLoadingProfile from context
  const { isPrinting, printContentData, resetPrintState } = usePrint();
  const { locations: structuredLocations, isOnboardingComplete } = useOnboarding(); // NEW: Get isOnboardingComplete
  const { companyProfile } = useOnboarding(); // NEW: Get companyProfile for PDF props

  const qbCallbackProcessedRef = useRef(false);
  const shopifyCallbackProcessedRef = useRef(false); // NEW: Ref for Shopify callback

  // Removed the useEffect with supabase.auth.onAuthStateChange as ProfileContext now handles it.

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const quickbooksSuccess = params.get('quickbooks_success');
    const quickbooksError = params.get('quickbooks_error');
    const shopifySuccess = params.get('shopify_success'); // NEW: Get Shopify success param
    const shopifyError = params.get('shopify_error'); // NEW: Get Shopify error param

    console.log('AppContent.tsx: quickbooks_success from URL parameters:', quickbooksSuccess);
    console.log('AppContent.tsx: quickbooks_error from URL parameters:', quickbooksError);
    console.log('AppContent.tsx: shopify_success from URL parameters:', shopifySuccess); // NEW: Log Shopify params
    console.log('AppContent.tsx: shopify_error from URL parameters:', shopifyError); // NEW: Log Shopify params

    if ((quickbooksSuccess || quickbooksError) && !qbCallbackProcessedRef.current) {
      if (quickbooksSuccess) {
        showSuccess("QuickBooks connected successfully!");
        // No need to call fetchProfile here, ProfileContext's onAuthStateChange will handle it.
      } else if (quickbooksError) {
        showError(`QuickBooks connection failed: ${quickbooksError}`);
      }
      qbCallbackProcessedRef.current = true;
      navigate('/integrations', { replace: true });
    }

    // NEW: Handle Shopify callback
    if ((shopifySuccess || shopifyError) && !shopifyCallbackProcessedRef.current) {
      if (shopifySuccess) {
        showSuccess("Shopify connected successfully!");
        // No need to call fetchProfile here, ProfileContext's onAuthStateChange will handle it.
      } else if (shopifyError) {
        showError(`Shopify connection failed: ${shopifyError}`);
      }
      shopifyCallbackProcessedRef.current = true;
      navigate('/integrations', { replace: true });
    }
  }, [location.search, navigate]); // Removed fetchProfile from dependencies as it's not called directly here

  // NEW: Effect to manage print-mode-label class on <html>
  useEffect(() => {
    if (isPrinting && printContentData?.type === "location-label") {
      document.documentElement.classList.add("print-mode-label");
    } else {
      document.documentElement.classList.remove("print-mode-label");
    }
  }, [isPrinting, printContentData]);

  if (isLoadingProfile) { // Use isLoadingProfile from context
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="ml-4 text-lg">Loading application...</span>
      </div>
    );
  }

  const mainAppRoutes = profile ? ( // Use profile from context
    <ErrorBoundary>
      <Routes>
        <Route path="/*" element={<AuthenticatedApp />} />
        <Route path="/onboarding" element={<OnboardingPage />} /> {/* NEW: Add OnboardingPage route */}
      </Routes>
    </ErrorBoundary>
  ) : (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {!profile && <Route path="*" element={<Auth />} />} {/* Use !profile */}
    </Routes>
  );

  return (
    <>
      <div className={isPrinting ? "hidden" : ""}>
        {mainAppRoutes}
      </div>

      {/* Conditionally render OnboardingWizard */}
      {/* REMOVED: !isLoadingProfile && !isOnboardingComplete && <OnboardingWizard onComplete={() => navigate("/")} /> */}

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