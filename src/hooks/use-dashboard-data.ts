import { useState, useEffect, useCallback, useMemo } from "react";
import { DateRange } from "react-day-picker";
import { format, isWithinInterval, startOfDay, endOfDay, isValid, subMonths, subDays, startOfMonth } from "date-fns";
import { useInventory, InventoryItem } from "@/context/InventoryContext";
import { useOrders, OrderItem } from "@/context/OrdersContext";
import { useStockMovement } from "@/context/StockMovementContext";
import { useProfile } => "@/context/ProfileContext";
import { useOnboarding, InventoryFolder } from "@/context/OnboardingContext";
import { parseAndValidateDate } from "@/utils/dateUtils";
import { supabase } from "@/lib/supabaseClient";
import { useVendors } from "@/context/VendorContext";
import { StockMovement } from "@/context/StockMovementContext";

interface DashboardContentData {
  metrics: {
    totalStockValue: number;
    totalUnitsOnHand: number;
    lowStockItemsCount: number;
    outOfStockItemsCount: number;
    ordersDueTodayCount: number;
    incomingShipmentsCount: number;
    recentAdjustmentsCount: number;
    totalIncome: number;
    totalLosses: number;
    fulfillmentPercentage: number;
    pendingPercentage: number;
    inventoryTurnoverRate: string;
    supplierPerformanceScore: "good" | "average" | "bad";
  };
  charts: {
    last3MonthSalesData: any[];
    monthlyOverviewData: any[];
    liveActivityData: any[];
    totalStockValueTrendData: any[];
    salesInventoryTrendData: any[];
    demandForecastData: any[];
    weeklyRevenueData: any[];
    profitabilityMetricsData: any[];
    topStockBulletGraphData: any[];
    locationStockHealthData: any[];
  };
  lists: {
    lowStockItems: InventoryItem[];
    outOfStockItems: InventoryItem[];
    recentSalesOrders: OrderItem[];
    recentPurchaseOrders: OrderItem[];
    openPurchaseOrders: OrderItem[];
    pendingInvoices: OrderItem[];
    recentShipments: OrderItem[];
    topSellingProducts: { name: string; unitsSold: number }[];
    pendingDiscrepanciesCount: number;
    previousPeriodDiscrepanciesCount: number;
    dailyIssuesCount: number;
    previousPeriodIssuesCount: number;
  };
}

interface UseDashboardHookResult {
  data: DashboardContentData | null;
  pdfProps: any;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const generateMockData = (dateRange: DateRange | undefined): DashboardContentData => {
  const today = new Date();
  const todayString = format(today, "yyyy-MM-dd");

  // Mock Inventory Items
  const mockInventoryItems: InventoryItem[] = [
    { id: "item1", name: "Laptop Pro X", description: "High-performance laptop", sku: "LPX-001", category: "Electronics", pickingBinQuantity: 15, overstockQuantity: 35, quantity: 50, reorderLevel: 20, pickingReorderLevel: 10, committedStock: 5, incomingStock: 10, unitCost: 900, retailPrice: 1200, folderId: "folder1", pickingBinFolderId: "folder1", status: "In Stock", lastUpdated: subDays(today, 5).toISOString(), imageUrl: "/placeholder.svg", vendorId: "vendor1", barcodeUrl: "LPX-001", organizationId: "org1", autoReorderEnabled: true, autoReorderQuantity: 50, createdAt: subMonths(today, 3).toISOString() },
    { id: "item2", name: "Wireless Mouse", description: "Ergonomic wireless mouse", sku: "WM-002", category: "Accessories", pickingBinQuantity: 5, overstockQuantity: 5, quantity: 10, reorderLevel: 15, pickingReorderLevel: 5, committedStock: 2, incomingStock: 0, unitCost: 20, retailPrice: 35, folderId: "folder2", pickingBinFolderId: "folder2", status: "Low Stock", lastUpdated: subDays(today, 2).toISOString(), imageUrl: "/placeholder.svg", vendorId: "vendor2", barcodeUrl: "WM-002", organizationId: "org1", autoReorderEnabled: true, autoReorderQuantity: 20, createdAt: subMonths(today, 2).toISOString() },
    { id: "item3", name: "USB-C Hub", description: "Multi-port USB-C hub", sku: "UCH-003", category: "Accessories", pickingBinQuantity: 0, overstockQuantity: 0, quantity: 0, reorderLevel: 10, pickingReorderLevel: 5, committedStock: 0, incomingStock: 0, unitCost: 40, retailPrice: 60, folderId: "folder2", pickingBinFolderId: "folder2", status: "Out of Stock", lastUpdated: subDays(today, 10).toISOString(), imageUrl: "/placeholder.svg", vendorId: "vendor1", barcodeUrl: "UCH-003", organizationId: "org1", autoReorderEnabled: true, autoReorderQuantity: 30, createdAt: subMonths(today, 4).toISOString() },
    { id: "item4", name: "Monitor 27-inch", description: "4K UHD Monitor", sku: "MON-004", category: "Electronics", pickingBinQuantity: 8, overstockQuantity: 12, quantity: 20, reorderLevel: 10, pickingReorderLevel: 5, committedStock: 3, incomingStock: 5, unitCost: 300, retailPrice: 450, folderId: "folder1", pickingBinFolderId: "folder1", status: "In Stock", lastUpdated: subDays(today, 1).toISOString(), imageUrl: "/placeholder.svg", vendorId: "vendor3", barcodeUrl: "MON-004", organizationId: "org1", autoReorderEnabled: false, autoReorderQuantity: 0, createdAt: subMonths(today, 1).toISOString() },
    { id: "item5", name: "Ergonomic Chair", description: "Adjustable office chair", sku: "EC-005", category: "Furniture", pickingBinQuantity: 2, overstockQuantity: 3, quantity: 5, reorderLevel: 5, pickingReorderLevel: 2, committedStock: 1, incomingStock: 0, unitCost: 250, retailPrice: 400, folderId: "folder3", pickingBinFolderId: "folder3", status: "Low Stock", lastUpdated: subDays(today, 7).toISOString(), imageUrl: "/placeholder.svg", vendorId: "vendor2", barcodeUrl: "EC-005", organizationId: "org1", autoReorderEnabled: true, autoReorderQuantity: 10, createdAt: subMonths(today, 5).toISOString() },
  ];

  // Mock Orders
  const mockOrders: OrderItem[] = [
    { id: "SO-001", type: "Sales", customerSupplier: "Acme Corp", date: subDays(today, 10).toISOString(), status: "Shipped", totalAmount: 2400, dueDate: subDays(today, 10).toISOString(), itemCount: 2, notes: "Urgent order", orderType: "Retail", shippingMethod: "Express", items: [], organizationId: "org1" },
    { id: "PO-001", type: "Purchase", customerSupplier: "Global Tech", date: subDays(today, 15).toISOString(), status: "New Order", totalAmount: 4500, dueDate: subDays(today, 5).toISOString(), itemCount: 10, notes: "Bulk order for laptops", orderType: "Wholesale", shippingMethod: "Standard", items: [], organizationId: "org1" },
    { id: "SO-002", type: "Sales", customerSupplier: "Beta Solutions", date: subDays(today, 3).toISOString(), status: "Processing", totalAmount: 70, dueDate: subDays(today, 1).toISOString(), itemCount: 2, notes: "", orderType: "Retail", shippingMethod: "Standard", items: [], organizationId: "org1" },
    { id: "SO-003", type: "Sales", customerSupplier: "Gamma Inc", date: subDays(today, 1).toISOString(), status: "New Order", totalAmount: 1200, dueDate: today.toISOString(), itemCount: 1, notes: "Due today", orderType: "Retail", shippingMethod: "Express", items: [], organizationId: "org1" },
    { id: "PO-002", type: "Purchase", customerSupplier: "Office Supply Co", date: subDays(today, 7).toISOString(), status: "Processing", totalAmount: 200, dueDate: subDays(today, -3).toISOString(), itemCount: 5, notes: "", orderType: "Wholesale", shippingMethod: "Standard", items: [], organizationId: "org1" },
    { id: "SO-004", type: "Sales", customerSupplier: "Delta Corp", date: subDays(today, 2).toISOString(), status: "Packed", totalAmount: 450, dueDate: subDays(today, -2).toISOString(), itemCount: 1, notes: "", orderType: "Retail", shippingMethod: "Standard", items: [], organizationId: "org1" },
    { id: "SO-005", type: "Sales", customerSupplier: "Epsilon Ltd", date: subDays(today, 20).toISOString(), status: "On Hold / Problem", totalAmount: 800, dueDate: subDays(today, 25).toISOString(), itemCount: 1, notes: "Payment issue", orderType: "Retail", shippingMethod: "Standard", items: [], organizationId: "org1" },
    { id: "SO-006", type: "Sales", customerSupplier: "Zeta LLC", date: subDays(today, 40).toISOString(), status: "Archived", totalAmount: 150, dueDate: subDays(today, 40).toISOString(), itemCount: 1, notes: "", orderType: "Retail", shippingMethod: "Standard", items: [], organizationId: "org1" },
  ];

  // Mock Stock Movements
  const mockStockMovements: StockMovement[] = [
    { id: "sm1", itemId: "item1", itemName: "Laptop Pro X", type: "add", amount: 20, oldQuantity: 30, newQuantity: 50, reason: "Received from PO-001", timestamp: subDays(today, 5).toISOString(), organizationId: "org1", userId: "user1", folderId: "folder1" },
    { id: "sm2", itemId: "item2", itemName: "Wireless Mouse", type: "subtract", amount: 5, oldQuantity: 15, newQuantity: 10, reason: "Fulfilled for SO-002", timestamp: subDays(today, 2).toISOString(), organizationId: "org1", userId: "user1", folderId: "folder2" },
    { id: "sm3", itemId: "item1", itemName: "Laptop Pro X", type: "subtract", amount: 1, oldQuantity: 50, newQuantity: 49, reason: "Damaged during handling", timestamp: subDays(today, 0).toISOString(), organizationId: "org1", userId: "user2", folderId: "folder1" },
    { id: "sm4", itemId: "item4", itemName: "Monitor 27-inch", type: "add", amount: 5, oldQuantity: 15, newQuantity: 20, reason: "Initial stock", timestamp: subDays(today, 1).toISOString(), organizationId: "org1", userId: "user1", folderId: "folder1" },
  ];

  // Mock Inventory Folders
  const mockInventoryFolders: InventoryFolder[] = [
    { id: "folder1", organizationId: "org1", name: "Main Warehouse", color: "#4CAF50", createdAt: new Date().toISOString(), userId: "user1" },
    { id: "folder2", organizationId: "org1", name: "Store Front", color: "#2196F3", createdAt: new Date().toISOString(), userId: "user1" },
    { id: "folder3", organizationId: "org1", name: "Cold Storage", color: "#9C27B0", createdAt: new Date().toISOString(), userId: "user1" },
  ];

  // Mock Profiles (for discrepancy/issue reports)
  const mockAllProfiles: any[] = [
    { id: "user1", full_name: "Admin User", email: "admin@example.com", role: "admin", organization_id: "org1" },
    { id: "user2", full_name: "Manager User", email: "manager@example.com", role: "inventory_manager", organization_id: "org1" },
  ];

  // Mock Discrepancies
  const mockDiscrepancies: any[] = [
    { id: "disc1", item_id: "item1", item_name: "Laptop Pro X", folder_id: "folder1", location_type: "picking_bin", original_quantity: 15, counted_quantity: 14, difference: -1, reason: "Cycle Count", status: "pending", timestamp: subDays(today, 0).toISOString(), user_id: "user2", organization_id: "org1" },
    { id: "disc2", item_id: "item2", item_name: "Wireless Mouse", folder_id: "folder2", location_type: "overstock", original_quantity: 5, counted_quantity: 6, difference: 1, reason: "Cycle Count", status: "pending", timestamp: subDays(today, 0).toISOString(), user_id: "user2", organization_id: "org1" },
  ];

  // Mock Issues
  const mockIssues: any[] = [
    { id: "issue1", user_id: "user2", organization_id: "org1", activity_type: "Issue Reported", description: "Damaged packaging on item LPX-001", details: { issueType: "damaged-item", itemId: "item1", itemName: "Laptop Pro X", folderId: "folder1", contactInfo: "manager@example.com", description: "Box crushed during transit." }, timestamp: subDays(today, 0).toISOString() },
  ];


  const filterDataByDateRangeMock = (items: any[], dateKey: string) => {
    const filterFrom = (dateRange?.from && isValid(dateRange.from)) ? startOfDay(dateRange.from) : null;
    const filterTo = (dateRange?.to && isValid(dateRange.to)) ? endOfDay(dateRange.to) : ((dateRange?.from && isValid(dateRange.from)) ? endOfDay(dateRange.from) : null);

    if (!filterFrom || !filterTo) return items;

    return items.filter((item: any) => {
      const itemDate = parseAndValidateDate(item[dateKey]);
      return itemDate && isValid(itemDate) && isWithinInterval(itemDate, { start: filterFrom, end: filterTo });
    });
  };

  const filteredInventory = filterDataByDateRangeMock(mockInventoryItems, 'lastUpdated');
  const filteredOrders = filterDataByDateRangeMock(mockOrders, 'date');
  const filteredStockMovements = filterDataByDateRangeMock(mockStockMovements, 'timestamp');
  const filteredDiscrepancies = filterDataByDateRangeMock(mockDiscrepancies, 'timestamp');
  const filteredIssues = filterDataByDateRangeMock(mockIssues, 'timestamp');


  const totalStockValue = filteredInventory.reduce((sum: number, item: InventoryItem) => sum + (item.quantity * item.unitCost), 0);
  const totalUnitsOnHand = filteredInventory.reduce((sum: number, item: InventoryItem) => sum + item.quantity, 0);
  const lowStockItemsCount = filteredInventory.filter((item: InventoryItem) => item.quantity <= item.reorderLevel).length;
  const outOfStockItemsCount = filteredInventory.filter((item: InventoryItem) => item.quantity === 0).length;
  const ordersDueTodayCount = filteredOrders.filter(
    (order: OrderItem) => format(parseAndValidateDate(order.dueDate) || new Date(), "yyyy-MM-dd") === todayString && order.status !== "Shipped" && order.status !== "Packed"
  ).length;
  const incomingShipmentsCount = filteredOrders.filter((order: OrderItem) => order.type === "Purchase" && order.status !== "Shipped").length;
  const recentAdjustmentsCount = filteredStockMovements.filter(
    (movement: any) => format(parseAndValidateDate(movement.timestamp) || new Date(), "yyyy-MM-dd") === todayString
  ).length;

  const totalSalesRevenue = filteredOrders.filter((order: OrderItem) => order.type === "Sales").reduce((sum: number, order: OrderItem) => sum + order.totalAmount, 0);
  const totalPurchaseCost = filteredOrders.filter((order: OrderItem) => order.type === "Purchase").reduce((sum: number, order: OrderItem) => sum + order.totalAmount, 0);
  const totalIncome = totalSalesRevenue;
  const totalLosses = totalPurchaseCost;

  const totalOrders = filteredOrders.length;
  const fulfilledOrders = filteredOrders.filter(
    (order: OrderItem) => order.status === "Shipped" || order.status === "Packed"
  ).length;
  const fulfillmentPercentage = totalOrders > 0 ? Math.round((fulfilledOrders / totalOrders) * 100) : 0;
  const pendingPercentage = 100 - fulfillmentPercentage;

  const totalInventoryCost = mockInventoryItems.reduce((sum: number, item: InventoryItem) => sum + (item.quantity * item.unitCost), 0);
  const inventoryTurnoverRate = totalInventoryCost > 0 ? `${(totalSalesRevenue / totalInventoryCost).toFixed(1)}x` : "N/A";

  const supplierPerformanceScore: "good" | "average" | "bad" = "good";

  const last3MonthSalesData = (() => {
    const monthlyData: { [key: string]: { salesRevenue: number; newInventory: number; itemsShipped: number } } = {};
    const effectiveFrom = subMonths(today, 2);
    let currentDate = startOfMonth(effectiveFrom);
    while (currentDate.getTime() <= today.getTime()) {
      const monthKey = format(currentDate, "MMM yyyy");
      monthlyData[monthKey] = { salesRevenue: Math.floor(Math.random() * 5000) + 1000, newInventory: Math.floor(Math.random() * 200) + 50, itemsShipped: Math.floor(Math.random() * 150) + 30 };
      currentDate = subMonths(currentDate, -1);
    }
    return Object.keys(monthlyData).sort((a: string, b: string) => {
      const dateA = parseAndValidateDate(a);
      const dateB = parseAndValidateDate(b);
      if (!dateA || !dateB) return 0;
      return dateA.getTime() - dateB.getTime();
    }).map((monthKey: string) => ({
      name: format(parseAndValidateDate(monthKey) || new Date(), "MMM"),
      "Sales Revenue": parseFloat(monthlyData[monthKey].salesRevenue.toFixed(2)),
      "New Inventory Added": parseFloat(monthlyData[monthKey].newInventory.toFixed(0)),
      "Items Shipped": parseFloat(monthlyData[monthKey].itemsShipped.toFixed(0)),
    }));
  })();

  const monthlyOverviewData = (() => {
    const monthlyData: { [key: string]: { salesRevenue: number; inventoryValue: number; purchaseVolume: number } } = {};
    const effectiveFrom = subMonths(today, 11);
    let currentDate = startOfMonth(effectiveFrom);
    while (currentDate.getTime() <= today.getTime()) {
      const monthKey = format(currentDate, "MMM yyyy");
      monthlyData[monthKey] = { salesRevenue: Math.floor(Math.random() * 10000) + 2000, inventoryValue: Math.floor(Math.random() * 50000) + 10000, purchaseVolume: Math.floor(Math.random() * 500) + 100 };
      currentDate = subMonths(currentDate, -1);
    }
    return Object.keys(monthlyData).sort((a: string, b: string) => {
      const dateA = parseAndValidateDate(a);
      const dateB = parseAndValidateDate(b);
      if (!dateA || !dateB) return 0;
      return dateA.getTime() - dateB.getTime();
    }).map((monthKey: string) => ({
      name: format(parseAndValidateDate(monthKey) || new Date(), "MMM"),
      "Sales Revenue": parseFloat(monthlyData[monthKey].salesRevenue.toFixed(2)),
      "Inventory Value": parseFloat(monthlyData[monthKey].inventoryValue.toFixed(2)),
      "Purchase Volume": parseFloat(monthlyData[monthKey].purchaseVolume.toFixed(0)),
    }));
  })();

  const liveActivityData = (() => {
    const dataPoints = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const dateKey = format(date, "MMM dd");
      dataPoints.push({
        name: dateKey,
        "Total Daily Activity": Math.floor(Math.random() * 100) + 20,
      });
    }
    return dataPoints;
  })();

  const totalStockValueTrendData = (() => {
    const dataPoints = [];
    for (let i = 5; i >= 0; i--) {
      const month = subMonths(today, i);
      const monthName = format(month, "MMM");
      dataPoints.push({ name: monthName, value: parseFloat((Math.random() * 100000 + 50000).toFixed(2)) });
    }
    return dataPoints;
  })();

  const salesInventoryTrendData = (() => {
    const dataPoints = [];
    for (let i = 5; i >= 0; i--) {
      const month = subMonths(today, i);
      const monthName = format(month, "MMM");
      dataPoints.push({
        name: monthName,
        "Sales Revenue": parseFloat((Math.random() * 50000 + 10000).toFixed(2)),
        "Inventory Value": parseFloat((Math.random() * 150000 + 50000).toFixed(2)),
      });
    }
    return dataPoints;
  })();

  const demandForecastData = (() => {
    const dataPoints = [];
    for (let i = 5; i >= 0; i--) {
      const month = subMonths(today, i);
      const monthName = format(month, "MMM");
      dataPoints.push({
        name: monthName,
        "Actual Sales": parseFloat((Math.random() * 10000 + 2000).toFixed(2)),
        "Projected Demand": null,
      });
    }
    for (let i = 1; i <= 3; i++) {
      const month = subMonths(today, -i);
      const monthName = format(month, "MMM");
      dataPoints.push({
        name: monthName,
        "Actual Sales": null,
        "Projected Demand": parseFloat((Math.random() * 12000 + 3000).toFixed(2)),
      });
    }
    return dataPoints;
  })();

  const weeklyRevenueData = (() => {
    const dataPoints = [];
    const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (let i = 0; i < 7; i++) {
      dataPoints.push({
        name: daysOfWeek[i],
        "This Week": parseFloat((Math.random() * 2000 + 500).toFixed(2)),
        "Last Week": parseFloat((Math.random() * 1800 + 400).toFixed(2)),
      });
    }
    return dataPoints;
  })();

  const profitabilityMetricsData = [
    { name: "Gross Margin", value: 45, color: "#00BFD8" },
    { name: "Net Margin", value: 20, color: "#00C49F" },
    { name: "Simulated Losses", value: 5, color: "#0088FE" },
  ];

  const topStockBulletGraphData = mockInventoryItems
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 4)
    .map(item => ({
      name: item.name,
      quantity: item.quantity,
      reorderLevel: item.reorderLevel,
    }));

  const locationStockHealthData = [
    { label: "Main Warehouse", percentage: 75, isPositive: true, movementScore: 150 },
    { label: "Store Front", percentage: 60, isPositive: false, movementScore: 80 },
    { label: "Cold Storage", percentage: 90, isPositive: true, movementScore: 200 },
    { label: "Returns Area", percentage: 30, isPositive: false, movementScore: 40 },
  ];

  const lowStockItems = filteredInventory.filter(item => item.quantity > 0 && item.quantity <= item.reorderLevel);
  const outOfStockItems = filteredInventory.filter(item => item.quantity === 0);

  const recentSalesOrders = filteredOrders
    .filter(order => order.type === "Sales")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const recentPurchaseOrders = filteredOrders
    .filter(order => order.type === "Purchase")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const openPurchaseOrders = mockOrders
    .filter(order => order.type === "Purchase" && order.status !== "Shipped" && order.status !== "Archived")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  const pendingInvoices = mockOrders
    .filter(order => {
      const orderDueDate = parseAndValidateDate(order.dueDate);
      const thirtyDaysAgo = subDays(new Date(), 30);
      return (
        order.type === "Sales" &&
        order.status !== "Shipped" &&
        order.status !== "Archived" &&
        order.status !== "Packed" &&
        orderDueDate && isValid(orderDueDate) && isWithinInterval(orderDueDate, { start: new Date(0), end: thirtyDaysAgo })
      );
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  const recentShipments = mockOrders
    .filter(order => order.type === "Sales" && order.status === "Shipped")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const topSellingProducts = mockInventoryItems
    .map(item => ({
      name: item.name,
      unitsSold: item.quantity > 0 ? Math.floor(item.quantity * (0.1 + Math.random() * 0.4)) + 1 : 0,
    }))
    .filter(product => product.unitsSold > 0)
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 5);

  const pendingDiscrepanciesCount = filteredDiscrepancies.length;
  const previousPeriodDiscrepanciesCount = Math.floor(Math.random() * 5); // Mock previous period
  const dailyIssuesCount = filteredIssues.length;
  const previousPeriodIssuesCount = Math.floor(Math.random() * 3); // Mock previous period


  return {
    metrics: {
      totalStockValue,
      totalUnitsOnHand,
      lowStockItemsCount,
      outOfStockItemsCount,
      ordersDueTodayCount,
      incomingShipmentsCount,
      recentAdjustmentsCount,
      totalIncome,
      totalLosses,
      fulfillmentPercentage,
      pendingPercentage,
      inventoryTurnoverRate,
      supplierPerformanceScore,
    },
    charts: {
      last3MonthSalesData,
      monthlyOverviewData,
      liveActivityData,
      totalStockValueTrendData,
      salesInventoryTrendData,
      demandForecastData,
      weeklyRevenueData,
      profitabilityMetricsData,
      topStockBulletGraphData,
      locationStockHealthData,
    },
    lists: {
      lowStockItems,
      outOfStockItems,
      recentSalesOrders,
      recentPurchaseOrders,
      openPurchaseOrders,
      pendingInvoices,
      recentShipments,
      topSellingProducts,
      pendingDiscrepanciesCount,
      previousPeriodDiscrepanciesCount,
      dailyIssuesCount,
      previousPeriodIssuesCount,
    },
  };
};


export const useDashboardData = (dateRange: DateRange | undefined): UseDashboardHookResult => {
  const { inventoryItems, isLoadingInventory, refreshInventory } = useInventory();
  const { orders, isLoadingOrders, fetchOrders } = useOrders();
  const { stockMovements, isLoadingStockMovements, fetchStockMovements } = useStockMovement();
  const { refreshVendors } = useVendors();
  const { profile, isLoadingProfile, fetchAllProfiles } = useProfile();
  const { inventoryFolders: structuredLocations, fetchInventoryFolders } = useOnboarding();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = useCallback(() => {
    setError(null);
    setRefreshTrigger(prev => prev + 1);
    refreshInventory();
    fetchOrders();
    fetchStockMovements();
    refreshVendors(); // Re-enabled
    fetchAllProfiles();
    fetchInventoryFolders();
  }, [refreshInventory, fetchOrders, fetchStockMovements, refreshVendors, fetchAllProfiles, fetchInventoryFolders]);

  const filterDataByDateRange = useCallback((items: any[], dateKey: string) => {
    const filterFrom = (dateRange?.from && isValid(dateRange.from)) ? startOfDay(dateRange.from) : null;
    const filterTo = (dateRange?.to && isValid(dateRange.to)) ? endOfDay(dateRange.to) : ((dateRange?.from && isValid(dateRange.from)) ? endOfDay(dateRange.from) : null);

    if (!filterFrom || !filterTo) return items;

    return items.filter((item: any) => { // Explicitly type item
      const itemDate = parseAndValidateDate(item[dateKey]);
      return itemDate && isValid(itemDate) && isWithinInterval(itemDate, { start: filterFrom, end: filterTo });
    });
  }, [dateRange]);

  const [pendingDiscrepanciesCount, setPendingDiscrepanciesCount] = useState(0);
  const [previousPeriodDiscrepanciesCount, setPreviousPeriodDiscrepanciesCount] = useState(0);
  const [dailyIssuesCount, setDailyIssuesCount] = useState(0);
  const [previousPeriodIssuesCount, setPreviousPeriodIssuesCount] = useState(0);

  const fetchDiscrepancyAndIssueCounts = useCallback(async () => {
    if (!profile?.organizationId) {
      setPendingDiscrepanciesCount(0);
      setPreviousPeriodDiscrepanciesCount(0);
      setDailyIssuesCount(0);
      setPreviousPeriodIssuesCount(0);
      return;
    }

    const today = new Date();
    let currentPeriodStart: Date;
    let currentPeriodEnd: Date;
    let previousPeriodStart: Date;
    let previousPeriodEnd: Date;

    currentPeriodStart = (dateRange?.from && isValid(dateRange.from)) ? startOfDay(dateRange.from) : startOfDay(today);
    currentPeriodEnd = (dateRange?.to && isValid(dateRange.to)) ? endOfDay(dateRange.to) : ((dateRange?.from && isValid(dateRange.from)) ? endOfDay(dateRange.from) : endOfDay(today));

    const durationMs = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
    previousPeriodEnd = subDays(currentPeriodStart, 1);
    previousPeriodStart = new Date(previousPeriodEnd.getTime() - durationMs);

    const fetchCount = async (table: string, activityType: string | null, start: Date, end: Date) => {
      let query = supabase
        .from(table)
        .select('id', { count: 'exact' })
        .eq('organization_id', profile.organizationId)
        .gte('timestamp', start.toISOString())
        .lte('timestamp', end.toISOString());

      if (table === 'discrepancies') {
        query = query.eq('status', 'pending');
      } else if (table === 'activity_logs' && activityType) {
        query = query.eq('activity_type', activityType);
      }

      const { count, error: countError } = await query;

      if (countError) {
        console.error(`Error fetching ${table} count:`, countError);
        // showError(`Failed to load ${table} count.`); // Removed showError to prevent toast spam
        return 0;
      }
      return count || 0;
    };

    const currentDiscrepancyCount = await fetchCount('discrepancies', null, currentPeriodStart, currentPeriodEnd);
    const prevDiscrepancyCount = await fetchCount('discrepancies', null, previousPeriodStart, previousPeriodEnd);
    setPendingDiscrepanciesCount(currentDiscrepancyCount);
    setPreviousPeriodDiscrepanciesCount(prevDiscrepancyCount);

    const currentIssueCount = await fetchCount('activity_logs', 'Issue Reported', currentPeriodStart, currentPeriodEnd);
    const prevIssueCount = await fetchCount('activity_logs', 'Issue Reported', previousPeriodStart, previousPeriodEnd);
    setDailyIssuesCount(currentIssueCount);
    setPreviousPeriodIssuesCount(prevIssueCount);

  }, [profile?.organizationId, dateRange]);

  useEffect(() => {
    if (!isLoadingProfile && profile?.organizationId) {
      fetchDiscrepancyAndIssueCounts();
    }
  }, [isLoadingProfile, profile?.organizationId, dateRange, fetchDiscrepancyAndIssueCounts]);


  const dashboardData = useMemo<DashboardContentData | null>(() => {
    // If any real data is still loading, return null to show loading state
    if (isLoadingInventory || isLoadingOrders || isLoadingStockMovements || isLoadingProfile) {
      return null;
    }

    // If no profile or organization, return mock data for landing page screenshots
    if (!profile?.organizationId) {
      return generateMockData(dateRange);
    }

    const today = new Date();
    const todayString = format(today, "yyyy-MM-dd");

    const filteredInventory = filterDataByDateRange(inventoryItems, 'lastUpdated');
    const filteredOrders = filterDataByDateRange(orders, 'date');
    const filteredStockMovements = filterDataByDateRange(stockMovements, 'timestamp');

    const totalStockValue = filteredInventory.reduce((sum: number, item: InventoryItem) => sum + (item.quantity * item.unitCost), 0);
    const totalUnitsOnHand = filteredInventory.reduce((sum: number, item: InventoryItem) => sum + item.quantity, 0);
    const lowStockItemsCount = filteredInventory.filter((item: InventoryItem) => item.quantity <= item.reorderLevel).length;
    const outOfStockItemsCount = filteredInventory.filter((item: InventoryItem) => item.quantity === 0).length;
    const ordersDueTodayCount = filteredOrders.filter(
      (order: OrderItem) => format(parseAndValidateDate(order.dueDate) || new Date(), "yyyy-MM-dd") === todayString && order.status !== "Shipped" && order.status !== "Packed"
    ).length;
    const incomingShipmentsCount = filteredOrders.filter((order: OrderItem) => order.type === "Purchase" && order.status !== "Shipped").length;
    const recentAdjustmentsCount = filteredStockMovements.filter(
      (movement: any) => format(parseAndValidateDate(movement.timestamp) || new Date(), "yyyy-MM-dd") === todayString
    ).length;

    const totalSalesRevenue = filteredOrders.filter((order: OrderItem) => order.type === "Sales").reduce((sum: number, order: OrderItem) => sum + order.totalAmount, 0);
    const totalPurchaseCost = filteredOrders.filter((order: OrderItem) => order.type === "Purchase").reduce((sum: number, order: OrderItem) => sum + order.totalAmount, 0);
    const totalIncome = totalSalesRevenue;
    const totalLosses = totalPurchaseCost;

    const totalOrders = filteredOrders.length;
    const fulfilledOrders = filteredOrders.filter(
      (order: OrderItem) => order.status === "Shipped" || order.status === "Packed"
    ).length;
    const fulfillmentPercentage = totalOrders > 0 ? Math.round((fulfilledOrders / totalOrders) * 100) : 0;
    const pendingPercentage = 100 - fulfillmentPercentage;

    const totalInventoryCost = inventoryItems.reduce((sum: number, item: InventoryItem) => sum + (item.quantity * item.unitCost), 0);
    const inventoryTurnoverRate = totalInventoryCost > 0 ? `${(totalSalesRevenue / totalInventoryCost).toFixed(1)}x` : "N/A";

    const supplierPerformanceScore: "good" | "average" | "bad" = "good";

    const last3MonthSalesData = (() => {
      const monthlyData: { [key: string]: { salesRevenue: number; newInventory: number; itemsShipped: number } } = {};
      const effectiveFrom = subMonths(today, 2);
      let currentDate = startOfMonth(effectiveFrom);
      while (currentDate.getTime() <= today.getTime()) {
        const monthKey = format(currentDate, "MMM yyyy");
        monthlyData[monthKey] = { salesRevenue: 0, newInventory: 0, itemsShipped: 0 };
        currentDate = subMonths(currentDate, -1);
      }

      orders.filter((order: OrderItem) => order.type === "Sales").forEach((order: OrderItem) => {
        const orderDate = parseAndValidateDate(order.date);
        if (!orderDate || !isValid(orderDate)) return;
        const monthKey = format(orderDate, "MMM yyyy");
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].salesRevenue += order.totalAmount;
          monthlyData[monthKey].itemsShipped += order.itemCount;
        }
      });

      inventoryItems.forEach((item: InventoryItem) => {
        const itemDate = parseAndValidateDate(item.createdAt); // Accessing createdAt
        if (!itemDate || !isValid(itemDate)) return;
        const monthKey = format(itemDate, "MMM yyyy");
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].newInventory += item.quantity;
        }
      });

      return Object.keys(monthlyData).sort((a: string, b: string) => { // Explicitly type a, b
        const dateA = parseAndValidateDate(a);
        const dateB = parseAndValidateDate(b);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      }).map((monthKey: string) => ({ // Explicitly type monthKey
        name: format(parseAndValidateDate(monthKey) || new Date(), "MMM"),
        "Sales Revenue": parseFloat(monthlyData[monthKey].salesRevenue.toFixed(2)),
        "New Inventory Added": parseFloat(monthlyData[monthKey].newInventory.toFixed(0)),
        "Items Shipped": parseFloat(monthlyData[monthKey].itemsShipped.toFixed(0)),
      }));
    })();

    const monthlyOverviewData = (() => {
      const monthlyData: { [key: string]: { salesRevenue: number; inventoryValue: number; purchaseVolume: number } } = {};
      const effectiveFrom = subMonths(today, 11);
      let currentDate = startOfMonth(effectiveFrom);
      while (currentDate.getTime() <= today.getTime()) {
        const monthKey = format(currentDate, "MMM yyyy");
        monthlyData[monthKey] = { salesRevenue: 0, inventoryValue: 0, purchaseVolume: 0 };
        currentDate = subMonths(currentDate, -1);
      }

      orders.forEach((order: OrderItem) => {
        const orderDate = parseAndValidateDate(order.date);
        if (!orderDate || !isValid(orderDate)) return;
        const monthKey = format(orderDate, "MMM yyyy");
        if (monthlyData[monthKey]) {
          if (order.type === "Sales") {
            monthlyData[monthKey].salesRevenue += order.totalAmount;
          } else if (order.type === "Purchase") {
            monthlyData[monthKey].purchaseVolume += order.itemCount;
          }
        }
      });

      const totalCurrentInventoryValue = inventoryItems.reduce((sum: number, item: InventoryItem) => sum + (item.quantity * item.unitCost), 0);
      Object.keys(monthlyData).sort((a: string, b: string) => { // Explicitly type a, b
        const dateA = parseAndValidateDate(a);
        const dateB = parseAndValidateDate(b);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      }).forEach((monthKey: string, index: number, array: string[]) => { // Explicitly type monthKey, index, array
        if (monthKey === format(today, "MMM yyyy")) {
          monthlyData[monthKey].inventoryValue = totalCurrentInventoryValue;
        } else {
          const factor = (index + 1) / array.length;
          monthlyData[monthKey].inventoryValue = totalCurrentInventoryValue * (0.8 + 0.4 * factor);
        }
      });

      return Object.keys(monthlyData).sort((a: string, b: string) => { // Explicitly type a, b
        const dateA = parseAndValidateDate(a);
        const dateB = parseAndValidateDate(b);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      }).map((monthKey: string) => ({ // Explicitly type monthKey
        name: format(parseAndValidateDate(monthKey) || new Date(), "MMM"),
        "Sales Revenue": parseFloat(monthlyData[monthKey].salesRevenue.toFixed(2)),
        "Inventory Value": parseFloat(monthlyData[monthKey].inventoryValue.toFixed(2)),
        "Purchase Volume": parseFloat(monthlyData[monthKey].purchaseVolume.toFixed(0)),
      }));
    })();

    const liveActivityData = (() => {
      const dailyMetrics: { [key: string]: { salesVolume: number; purchaseVolume: number; adjustments: number } } = {};
      const filterFrom = (dateRange?.from && isValid(dateRange.from)) ? startOfDay(dateRange.from) : subDays(startOfDay(today), 6);
      const filterTo = (dateRange?.to && isValid(dateRange.to)) ? endOfDay(dateRange.to) : ((dateRange?.from && isValid(dateRange.from)) ? endOfDay(dateRange.from) : endOfDay(today));

      let currentDate = new Date(filterFrom);
      while (currentDate.getTime() <= filterTo.getTime()) {
        const dateKey = format(currentDate, "MMM dd");
        dailyMetrics[dateKey] = { salesVolume: 0, purchaseVolume: 0, adjustments: 0 };
        currentDate = subDays(currentDate, -1);
      }

      orders.forEach((order: OrderItem) => {
        const orderDate = parseAndValidateDate(order.date);
        if (!orderDate || !isValid(orderDate)) return;
        const dateKey = format(orderDate, "MMM dd");
        if (dailyMetrics[dateKey] && isWithinInterval(orderDate, { start: filterFrom, end: filterTo })) {
          if (order.type === "Sales") {
            dailyMetrics[dateKey].salesVolume += order.itemCount;
          } else if (order.type === "Purchase") {
            dailyMetrics[dateKey].purchaseVolume += order.itemCount;
          }
        }
      });

      stockMovements.forEach((movement: any) => { // Explicitly type movement
        const moveDate = parseAndValidateDate(movement.timestamp);
        if (!moveDate || !isValid(moveDate)) return;
        const dateKey = format(moveDate, "MMM dd");
        if (dailyMetrics[dateKey] && isWithinInterval(moveDate, { start: filterFrom, end: filterTo })) {
          dailyMetrics[dateKey].adjustments += movement.amount;
        }
      });

      return Object.keys(dailyMetrics).sort((a: string, b: string) => { // Explicitly type a, b
        const dateA = parseAndValidateDate(a);
        const dateB = parseAndValidateDate(b);
        if (!dateA || !dateB || !isValid(dateA) || !isValid(dateB)) return 0;
        return dateA.getTime() - dateB.getTime();
      }).map((dateKey: string) => { // Explicitly type dateKey
        const totalDailyActivity = dailyMetrics[dateKey].salesVolume + dailyMetrics[dateKey].purchaseVolume + dailyMetrics[dateKey].adjustments;
        return {
          name: dateKey,
          "Total Daily Activity": totalDailyActivity,
        };
      });
    })();

    const totalStockValueTrendData = (() => {
      const dataPoints = [];
      const totalCurrentInventoryValue = inventoryItems.reduce((sum: number, item: InventoryItem) => sum + (item.quantity * item.unitCost), 0);
      for (let i = 0; i < 6; i++) {
        const month = subMonths(today, 5 - i);
        const monthName = format(month, "MMM");
        let simulatedValue;
        if (i === 5) {
          simulatedValue = totalStockValue;
        } else {
          const trendFactor = (i + 1) / 6;
          const baseValue = totalCurrentInventoryValue > 0 ? totalCurrentInventoryValue * (0.7 + (0.3 * trendFactor)) : 0;
          simulatedValue = Math.max(0, baseValue + (Math.random() - 0.5) * (totalCurrentInventoryValue * 0.1));
        }
        dataPoints.push({ name: monthName, value: parseFloat(simulatedValue.toFixed(2)) });
      }
      return dataPoints;
    })();

    const salesInventoryTrendData = (() => {
      const dataPoints = [];
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const currentMonthIndex = new Date().getMonth();

      const totalCurrentInventoryValue = inventoryItems.reduce((sum: number, item: InventoryItem) => sum + (item.quantity * item.unitCost), 0);
      const totalCurrentSalesRevenue = orders.filter((o: OrderItem) => o.type === "Sales").reduce((sum: number, o: OrderItem) => sum + o.totalAmount, 0);

      for (let i = 0; i < 6; i++) {
        const monthIndex = (currentMonthIndex - 5 + i + 12) % 12;
        const monthName = months[monthIndex];

        let simulatedInventoryValue;
        let simulatedSalesRevenue;

        if (i === 5) {
          simulatedInventoryValue = totalCurrentInventoryValue;
          simulatedSalesRevenue = totalCurrentSalesRevenue;
        } else {
          const trendFactor = (i + 1) / 6;
          const baseValue = totalCurrentInventoryValue > 0 ? totalCurrentInventoryValue * (0.7 + (0.3 * trendFactor)) : 0;
          simulatedInventoryValue = Math.max(0, baseValue + (Math.random() - 0.5) * (totalCurrentInventoryValue * 0.1));
          const baseSalesValue = totalCurrentSalesRevenue > 0 ? totalCurrentSalesRevenue * (0.7 + (0.3 * trendFactor)) : 0;
          simulatedSalesRevenue = Math.max(0, baseSalesValue + (Math.random() - 0.5) * (totalCurrentSalesRevenue * 0.1));
        }

        dataPoints.push({
          name: monthName,
          "Sales Revenue": parseFloat(simulatedSalesRevenue.toFixed(2)),
          "Inventory Value": parseFloat(simulatedInventoryValue.toFixed(2)),
        });
      }
      return dataPoints;
    })();

    const demandForecastData = (() => {
      const historicalSales: { [key: string]: number } = {};
      for (let i = 5; i >= 0; i--) {
        const month = subMonths(today, i);
        const monthKey = format(month, "MMM yyyy");
        historicalSales[monthKey] = 0;
      }

      orders.filter((order: OrderItem) => order.type === "Sales").forEach((order: OrderItem) => {
        const orderDate = parseAndValidateDate(order.date);
        if (!orderDate || !isValid(orderDate)) return;
        const monthKey = format(orderDate, "MMM yyyy");
        if (historicalSales.hasOwnProperty(monthKey)) {
          historicalSales[monthKey] += order.totalAmount;
        }
      });

      const chartData = [];
      const historicalKeys = Object.keys(historicalSales).sort((a: string, b: string) => { // Explicitly type a, b
        const dateA = parseAndValidateDate(a);
        const dateB = parseAndValidateDate(b);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      });

      historicalKeys.forEach((monthKey: string) => { // Explicitly type monthKey
        chartData.push({
          name: format(parseAndValidateDate(monthKey) || new Date(), "MMM"),
          "Actual Sales": parseFloat(historicalSales[monthKey].toFixed(2)),
          "Projected Demand": null,
        });
      });

      const lastThreeMonthsSales = historicalKeys.slice(-3).map((key: string) => historicalSales[key]); // Explicitly type key
      const averageSales = lastThreeMonthsSales.length > 0
        ? lastThreeMonthsSales.reduce((sum: number, val: number) => sum + val, 0) / lastThreeMonthsSales.length
        : 0;

      for (let i = 1; i <= 3; i++) {
        const futureMonth = subMonths(today, -i);
        const futureMonthName = format(futureMonth, "MMM");
        const projectedValue = averageSales > 0 ? Math.max(0, averageSales * (1 + (Math.random() - 0.5) * 0.1)) : 0;
        chartData.push({
          name: futureMonthName,
          "Actual Sales": null,
          "Projected Demand": parseFloat(projectedValue.toFixed(2)),
        });
      }
      return chartData;
    })();

    const weeklyRevenueData = (() => {
      const weeklyDataPoints = [];
      const thisWeekRevenue: { [key: string]: number } = {};
      const lastWeekRevenue: { [key: string]: number } = {};
      const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const currentDayIndex = today.getDay();

      orders.filter((order: OrderItem) => order.type === "Sales").forEach((order: OrderItem) => {
        const orderDate = parseAndValidateDate(order.date);
        if (!orderDate || !isValid(orderDate)) return;
        const diffDays = Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays < 7) {
          const dayName = format(orderDate, "E");
          thisWeekRevenue[dayName] = (thisWeekRevenue[dayName] || 0) + order.totalAmount;
        } else if (diffDays >= 7 && diffDays < 14) {
          const dayName = format(orderDate, "E");
          lastWeekRevenue[dayName] = (lastWeekRevenue[dayName] || 0) + order.totalAmount;
        }
      });

      for (let i = 0; i < 7; i++) {
        const dayIndex = (currentDayIndex + i) % 7;
        const dayName = daysOfWeek[dayIndex];
        const thisWeekVal = thisWeekRevenue[dayName] || 0;
        const lastWeekVal = lastWeekRevenue[dayName] || 0;
        weeklyDataPoints.push({
          name: dayName,
          "This Week": parseFloat(thisWeekVal.toFixed(2)),
          "Last Week": parseFloat(lastWeekVal.toFixed(2)),
        });
      }
      return weeklyDataPoints;
    })();

    const profitabilityMetricsData = (() => {
      let totalSalesRevenueCalc = 0;
      let totalCostOfGoodsSold = 0;

      orders.filter((order: OrderItem) => order.type === "Sales").forEach((order: OrderItem) => {
        totalSalesRevenueCalc += order.totalAmount;
        order.items.forEach((orderItem: any) => { // Explicitly type orderItem
          const inventoryItem = inventoryItems.find((inv: InventoryItem) => inv.id === orderItem.inventoryItemId);
          if (inventoryItem) {
            totalCostOfGoodsSold += orderItem.quantity * inventoryItem.unitCost;
          } else {
            totalCostOfGoodsSold += orderItem.quantity * orderItem.unitPrice * 0.7;
          }
        });
      });

      const grossProfit = totalSalesRevenueCalc - totalCostOfGoodsSold;
      const grossProfitMargin = totalSalesRevenueCalc > 0 ? (grossProfit / totalSalesRevenueCalc) * 100 : 0;
      const simulatedOperatingExpenses = totalSalesRevenueCalc * 0.20;
      const netProfit = grossProfit - simulatedOperatingExpenses;
      const netProfitMargin = totalSalesRevenueCalc > 0 ? (netProfit / totalSalesRevenueCalc) * 100 : 0;
      const simulatedLossesPercentage = totalSalesRevenueCalc > 0 ? (totalSalesRevenueCalc * 0.05 / totalSalesRevenueCalc) * 100 : 0;

      return [
        { name: "Gross Margin", value: parseFloat(grossProfitMargin.toFixed(0)), color: "#00BFD8" },
        { name: "Net Margin", value: parseFloat(netProfitMargin.toFixed(0)), color: "#00C49F" },
        { name: "Simulated Losses", value: parseFloat(simulatedLossesPercentage.toFixed(0)), color: "#0088FE" },
      ];
    })();

    const topStockBulletGraphData = (() => {
      return inventoryItems
        .sort((a: InventoryItem, b: InventoryItem) => b.quantity - a.quantity) // Explicitly type a, b
        .slice(0, 4)
        .map((item: InventoryItem) => ({ // Explicitly type item
          name: item.name,
          quantity: item.quantity,
          reorderLevel: item.reorderLevel,
        }));
    })();

    const locationStockHealthData = (() => {
      const locationMetrics: {
        [key: string]: {
          totalMovements: number;
          currentStock: number;
          netChange: number;
          displayName: string;
        };
      } = {};

      structuredLocations.forEach((loc: InventoryFolder) => { // Explicitly type loc
        locationMetrics[loc.id] = {
          totalMovements: 0,
          currentStock: 0,
          netChange: 0,
          displayName: loc.name,
        };
      });

      stockMovements.forEach((movement: any) => { // Explicitly type movement
        const item = inventoryItems.find((inv: InventoryItem) => inv.id === movement.itemId); // Explicitly type inv
        if (item) {
          const movementFolderId = item.folderId;
          if (locationMetrics[movementFolderId]) {
            locationMetrics[movementFolderId].totalMovements += movement.amount;
            if (movement.type === "add") {
              locationMetrics[movementFolderId].netChange += movement.amount;
            } else {
              locationMetrics[movementFolderId].netChange -= movement.amount;
            }
          }
        }
      });

      inventoryItems.forEach((item: InventoryItem) => { // Explicitly type item
        if (locationMetrics[item.folderId]) {
          locationMetrics[item.folderId].currentStock += item.quantity;
        }
        if (item.pickingBinFolderId && item.pickingBinFolderId !== item.folderId && locationMetrics[item.pickingBinFolderId]) {
          locationMetrics[item.pickingBinFolderId].currentStock += item.pickingBinQuantity;
        }
      });

      const healthData = Object.entries(locationMetrics).map(([_locationString, metrics]) => {
        const totalActivity = metrics.totalMovements;
        const currentStock = metrics.currentStock;
        const netChange = metrics.netChange;

        const percentage = totalActivity + currentStock > 0
          ? Math.min(100, Math.round((totalActivity / (totalActivity + currentStock)) * 100))
          : 0;

        const isPositive = netChange >= 0 || percentage > 50;

        return {
          label: metrics.displayName,
          percentage,
          isPositive,
          movementScore: totalActivity,
        };
      });

      return healthData.sort((a: any, b: any) => b.movementScore - a.movementScore).slice(0, 4); // Explicitly type a, b
    })();


    const lowStockItems = filteredInventory.filter((item: InventoryItem) => item.quantity > 0 && item.quantity <= item.reorderLevel);
    const outOfStockItems = filteredInventory.filter((item: InventoryItem) => item.quantity === 0);

    const recentSalesOrders = filteredOrders
      .filter((order: OrderItem) => order.type === "Sales")
      .sort((a: OrderItem, b: OrderItem) => { // Explicitly type a, b
        const dateA = parseAndValidateDate(a.date);
        const dateB = parseAndValidateDate(b.date);
        if (!dateA || !dateB || !isValid(dateA) || !isValid(dateB)) return 0;
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5);

    const recentPurchaseOrders = filteredOrders
      .filter((order: OrderItem) => order.type === "Purchase")
      .sort((a: OrderItem, b: OrderItem) => { // Explicitly type a, b
        const dateA = parseAndValidateDate(a.date);
        const dateB = parseAndValidateDate(b.date);
        if (!dateA || !dateB || !isValid(dateA) || !isValid(dateB)) return 0;
        return dateB.getTime() - dateB.getTime();
      })
      .slice(0, 5);

    const openPurchaseOrders = orders
      .filter((order: OrderItem) => order.type === "Purchase" && order.status !== "Shipped" && order.status !== "Archived")
      .sort((a: OrderItem, b: OrderItem) => { // Explicitly type a, b
        const dateA = parseAndValidateDate(a.dueDate);
        const dateB = parseAndValidateDate(b.dueDate);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 5);

    const pendingInvoices = orders
      .filter((order: OrderItem) => { // Explicitly type order
        const orderDueDate = parseAndValidateDate(order.dueDate);
        const thirtyDaysAgo = subDays(new Date(), 30);
        return (
          order.type === "Sales" &&
          order.status !== "Shipped" &&
          order.status !== "Archived" &&
          order.status !== "Packed" &&
          orderDueDate && isValid(orderDueDate) && isWithinInterval(orderDueDate, { start: new Date(0), end: thirtyDaysAgo })
        );
      })
      .sort((a: OrderItem, b: OrderItem) => { // Explicitly type a, b
        const dateA = parseAndValidateDate(a.dueDate);
        const dateB = parseAndValidateDate(b.dueDate);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 5);

    const recentShipments = orders
      .filter((order: OrderItem) => order.type === "Sales" && order.status === "Shipped")
      .sort((a: OrderItem, b: OrderItem) => { // Explicitly type a, b
        const dateA = parseAndValidateDate(a.date);
        const dateB = parseAndValidateDate(b.date);
        if (!dateA || !dateB) return 0;
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5);

    const topSellingProducts = inventoryItems
      .map((item: InventoryItem) => ({ // Explicitly type item
        name: item.name,
        unitsSold: item.quantity > 0 ? Math.floor(item.quantity * (0.1 + Math.random() * 0.4)) + 1 : 0,
      }))
      .filter((product: { name: string; unitsSold: number }) => product.unitsSold > 0) // Explicitly type product
      .sort((a: { name: string; unitsSold: number }, b: { name: string; unitsSold: number }) => b.unitsSold - a.unitsSold) // Explicitly type a, b
      .slice(0, 5);

    return {
      metrics: {
        totalStockValue,
        totalUnitsOnHand,
        lowStockItemsCount,
        outOfStockItemsCount,
        ordersDueTodayCount,
        incomingShipmentsCount,
        recentAdjustmentsCount,
        totalIncome,
        totalLosses,
        fulfillmentPercentage,
        pendingPercentage,
        inventoryTurnoverRate,
        supplierPerformanceScore,
      },
      charts: {
        last3MonthSalesData,
        monthlyOverviewData,
        liveActivityData,
        totalStockValueTrendData,
        salesInventoryTrendData,
        demandForecastData,
        weeklyRevenueData,
        profitabilityMetricsData,
        topStockBulletGraphData,
        locationStockHealthData,
      },
      lists: {
        lowStockItems,
        outOfStockItems,
        recentSalesOrders,
        recentPurchaseOrders,
        openPurchaseOrders,
        pendingInvoices,
        recentShipments,
        topSellingProducts,
        pendingDiscrepanciesCount,
        previousPeriodDiscrepanciesCount,
        dailyIssuesCount,
        previousPeriodIssuesCount,
      },
    };
  }, [
    isLoadingInventory, isLoadingOrders, isLoadingStockMovements, isLoadingProfile,
    inventoryItems, orders, stockMovements, profile, structuredLocations, dateRange,
    pendingDiscrepanciesCount, previousPeriodDiscrepanciesCount, dailyIssuesCount, previousPeriodIssuesCount,
    filterDataByDateRange, refreshTrigger
  ]);

  useEffect(() => {
    if (dashboardData) {
      setIsLoading(false);
    } else if (
      !isLoadingInventory && !isLoadingOrders && !isLoadingStockMovements && !isLoadingProfile
    ) {
      setError("Failed to load dashboard data.");
      setIsLoading(false);
    }
  }, [dashboardData, isLoadingInventory, isLoadingOrders, isLoadingStockMovements, isLoadingProfile]);

  return {
    data: dashboardData,
    pdfProps: null,
    isLoading,
    error,
    refresh,
  };
};