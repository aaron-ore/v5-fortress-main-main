import React, { useEffect } from "react";
import PurchaseOrderPdfContent from "./PurchaseOrderPdfContent";
import InvoicePdfContent from "./InvoicePdfContent";
import DashboardSummaryPdfContent from "./DashboardSummaryPdfContent";
import { PrintContentData } from "@/context/PrintContext";
import AdvancedDemandForecastPdfContent from "./AdvancedDemandForecastPdfContent";
import PutawayLabelPdfContent from "./PutawayLabelPdfContent";
import LocationLabelPdfContent from "./LocationLabelPdfContent";
import PickingWavePdfContent from "./PickingWavePdfContent";

// NEW: Import all new PDF content components
import InventoryValuationPdfContent from "./reports/pdf/InventoryValuationPdfContent";
import LowStockPdfContent from "./reports/pdf/LowStockPdfContent";
import InventoryMovementPdfContent from "./reports/pdf/InventoryMovementPdfContent";
import SalesByCustomerPdfContent from "./reports/pdf/SalesByCustomerPdfContent";
import SalesByProductPdfContent from "./reports/pdf/SalesByProductPdfContent";
import PurchaseOrderStatusPdfContent from "./components/reports/pdf/PurchaseOrderStatusPdfContent";
import ProfitabilityPdfContent from "./reports/pdf/ProfitabilityPdfContent";
import DiscrepancyPdfContent from "./reports/pdf/DiscrepancyPdfContent";

interface PrintWrapperProps {
  contentData: PrintContentData;
  onPrintComplete: () => void;
  children: React.ReactNode;
}

const PrintWrapper: React.FC<PrintWrapperProps> = ({ contentData, onPrintComplete, children }) => {
  useEffect(() => {
    if (!contentData) {
      onPrintComplete();
      return;
    }

    const printTimeout = setTimeout(() => {
      window.print();
      onPrintComplete();
    }, 0);

    return () => {
      clearTimeout(printTimeout);
    };
  }, [contentData, onPrintComplete]);

  if (!contentData) {
    return null;
  }

  return (
    <div className="print-only-content">
      {children}
    </div>
  );
};

export default PrintWrapper;