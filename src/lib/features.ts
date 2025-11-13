export interface AppFeature {
  id: string;
  name: string;
  description: string;
  introducedVersion: string; // The version in which this feature was introduced
}

// This is a snapshot of all features available in the current application version (e.g., 1.3.0)
// When a perpetual license is purchased, the features available at that time will be recorded.
export const ALL_APP_FEATURES: AppFeature[] = [
  // Core Features (generally always included)
  { id: "core_inventory_management", name: "Core Inventory Management", description: "Basic item tracking, quantities, and categories.", introducedVersion: "1.0.0" },
  { id: "dashboard_overview", name: "Dashboard Overview", description: "High-level metrics and quick insights.", introducedVersion: "1.0.0" },
  { id: "basic_order_management", name: "Basic Order Management", description: "Create, view, and track sales and purchase orders.", introducedVersion: "1.0.0" },
  { id: "user_profile_management", name: "User Profile Management", description: "Manage personal user profiles.", introducedVersion: "1.0.0" },
  { id: "basic_reports", name: "Basic Reports", description: "Access fundamental inventory and order reports.", introducedVersion: "1.0.0" },
  { id: "mobile_responsive_ui", name: "Mobile Responsive UI", description: "Access the application on mobile devices.", introducedVersion: "1.0.0" },
  { id: "email_notifications", name: "Email Notifications", description: "Receive email alerts for important events.", introducedVersion: "1.0.0" },
  { id: "in_app_notifications", name: "In-App Notifications", description: "Receive in-app alerts for important events.", introducedVersion: "1.0.0" },
  { id: "customer_management", name: "Customer Management", description: "Manage customer profiles and contact information.", introducedVersion: "1.1.0" },
  { id: "vendor_management", name: "Vendor Management", description: "Manage supplier and business partner information.", introducedVersion: "1.1.0" },
  { id: "folder_management", name: "Folder Management", description: "Organize inventory items into hierarchical folders.", introducedVersion: "1.1.0" },
  { id: "qr_code_generation", name: "QR Code Generation", description: "Generate QR codes for items and folders.", introducedVersion: "1.1.0" },
  { id: "csv_import_export", name: "CSV Import/Export", description: "Bulk import and export inventory and customer data via CSV.", introducedVersion: "1.2.0" },
  { id: "order_kanban_board", name: "Order Kanban Board", description: "Visual drag-and-drop order tracking.", introducedVersion: "1.2.0" },
  { id: "pdf_export_orders", name: "PDF Export for Orders", description: "Generate PDF documents for invoices and purchase orders.", introducedVersion: "1.2.0" },
  { id: "warehouse_operations_dashboard", name: "Warehouse Operations Dashboard", description: "Overview of warehouse activities.", introducedVersion: "1.3.0" },
  { id: "warehouse_tool_item_lookup", name: "Warehouse Tool: Item Lookup", description: "Scan or search for items to view details.", introducedVersion: "1.3.0" },
  { id: "warehouse_tool_receive_inventory", name: "Warehouse Tool: Receive Inventory", description: "Process incoming shipments and update stock.", introducedVersion: "1.3.0" },
  { id: "warehouse_tool_putaway", name: "Warehouse Tool: Putaway", description: "Scan locations and items to put away received stock.", introducedVersion: "1.3.0" },
  { id: "warehouse_tool_fulfill_order", name: "Warehouse Tool: Fulfill Order", description: "Pick and pack items for sales orders.", introducedVersion: "1.3.0" },
  { id: "warehouse_tool_ship_order", name: "Warehouse Tool: Ship Order", description: "Verify and dispatch packed orders for shipment.", introducedVersion: "1.3.0" },
  { id: "warehouse_tool_stock_transfer", name: "Warehouse Tool: Stock Transfer", description: "Move inventory items between folders.", introducedVersion: "1.3.0" },
  { id: "warehouse_tool_cycle_count", name: "Warehouse Tool: Cycle Count", description: "Perform inventory counts and reconcile discrepancies.", introducedVersion: "1.3.0" },
  { id: "warehouse_tool_issue_report", name: "Warehouse Tool: Issue Report", description: "Report damaged items, discrepancies, or other issues.", introducedVersion: "1.3.0" },
  { id: "warehouse_tool_replenishment_management", name: "Warehouse Tool: Replenishment Management", description: "Manage tasks for moving stock from overstock to picking bins.", introducedVersion: "1.3.0" },
  { id: "warehouse_tool_picking_wave_management", name: "Warehouse Tool: Picking Wave Management", description: "Batch sales orders into efficient picking waves.", introducedVersion: "1.3.0" },
  { id: "warehouse_tool_shipping_verification", name: "Warehouse Tool: Shipping Verification", description: "Verify items before loading onto a truck for shipment.", introducedVersion: "1.3.0" },
  { id: "warehouse_tool_returns_processing", name: "Warehouse Tool: Returns Processing", description: "Process returned items and update inventory.", introducedVersion: "1.3.0" },
  { id: "activity_logs", name: "Activity Logs", description: "View all user activities within your organization (Admin only).", introducedVersion: "1.3.0" },
  { id: "custom_roles_management", name: "Custom Roles Management", description: "Create, edit, and delete custom user roles (Admin only).", introducedVersion: "1.3.0" },
  { id: "transfer_admin_role", name: "Transfer Admin Role", description: "Transfer administrator privileges to another user (Admin only).", introducedVersion: "1.3.0" },
  { id: "auto_reorder_settings", name: "Auto-Reorder Settings", description: "Configure global and item-specific auto-reorder rules.", introducedVersion: "1.3.0" },
  { id: "integrations_quickbooks", name: "QuickBooks Integration", description: "Connect and sync with QuickBooks for financial data.", introducedVersion: "1.3.0" },
  { id: "integrations_shopify", name: "Shopify Integration", description: "Connect and sync with Shopify for product and inventory data.", introducedVersion: "1.3.0" },
  { id: "ai_report_summaries", name: "AI Report Summaries", description: "Generate concise AI summaries for any report.", introducedVersion: "1.3.0" },
  { id: "advanced_demand_forecast", name: "Advanced Demand Forecast", description: "AI-powered predictions for future product demand.", introducedVersion: "1.3.0" },
  { id: "automation_engine", name: "Automation Engine", description: "Automate repetitive tasks with custom rules.", introducedVersion: "1.3.0" },
  { id: "terms_of_service", name: "Terms of Service", description: "Access the application's Terms of Service.", introducedVersion: "1.3.0" },
  { id: "privacy_policy", name: "Privacy Policy", description: "Access the application's Privacy Policy.", introducedVersion: "1.3.0" },
  { id: "refund_policy", name: "Refund Policy", description: "Access the application's Refund Policy.", introducedVersion: "1.3.0" },
];

// Helper to get all feature IDs
export const getAllFeatureIds = (): string[] => ALL_APP_FEATURES.map(f => f.id);

// Helper to get features introduced up to a specific version (e.g., "1.3.0")
export const getFeaturesUpToVersion = (targetVersion: string): string[] => {
  const parseVersion = (version: string) => version.split('.').map(Number);
  const [targetMajor, targetMinor, targetPatch] = parseVersion(targetVersion);

  return ALL_APP_FEATURES
    .filter(feature => {
      const [featureMajor, featureMinor, featurePatch] = parseVersion(feature.introducedVersion);
      if (featureMajor < targetMajor) return true;
      if (featureMajor > targetMajor) return false;
      if (featureMinor < targetMinor) return true;
      if (featureMinor > targetMinor) return false;
      return featurePatch <= targetPatch;
    })
    .map(feature => feature.id);
};