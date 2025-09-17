import { useState, useEffect, useCallback, useMemo } from "react";
import { DateRange } from "react-day-picker";
import { format, isWithinInterval, startOfDay, endOfDay, isValid, subMonths, subDays, startOfMonth } from "date-fns";
import { useInventory, InventoryItem } from "@/context/InventoryContext";
import { useOrders, OrderItem, POItem } from "@/context/OrdersContext";
import { useCategories } from "@/context/CategoryContext";
import { useCustomers } from "@/context/CustomerContext";
import { useStockMovement, StockMovement } from "@/context/StockMovementContext";
import { useProfile } from "@/context/ProfileContext";
import { useOnboarding } from "@/context/OnboardingContext";
import { parseAndValidateDate } from "@/utils/dateUtils";
import { supabase } from "@/lib/supabaseClient";
import { showError } from "@/utils/toast";

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

export const useReportData = (reportId: string, dateRange: DateRange | undefined): UseDashboardHookResult => {
  const { inventoryItems, isLoadingInventory, refreshInventory } = useInventory();
  const { orders, isLoadingOrders, fetchOrders } = useOrders();
  const { categories, isLoadingCategories, refreshCategories } = useCategories();
  const { customers, isLoadingCustomers, refreshCustomers } = useCustomers();
  const { stockMovements, isLoadingStockMovements, fetchStockMovements } = useStockMovement();
  const { vendors, isLoadingVendors, refreshVendors } = useVendors(); // Destructure refreshVendors
  const { profile, isLoadingProfile, fetchAllProfiles } = useProfile();
  const { inventoryFolders: structuredLocations, isLoadingFolders, fetchInventoryFolders } = useOnboarding();

  const [processedData, setProcessedData] = useState<any>(null);
  const [pdfProps, setPdfProps] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = useCallback(() => {
    setError(null); // Clear previous errors on refresh
    setRefreshTrigger(prev => prev + 1);
    // Trigger individual context refreshes
    refreshInventory();
    fetchOrders();
    refreshCategories();
    refreshCustomers();
    fetchStockMovements();
    refreshVendors(); // Now correctly called
    fetchAllProfiles();
    fetchInventoryFolders();
  }, [refreshInventory, fetchOrders, refreshCategories, refreshCustomers, fetchStockMovements, refreshVendors, fetchAllProfiles, fetchInventoryFolders]);

  const filterDataByDateRange = useCallback((items: any[], dateKey: string) => {
    const filterFrom = (dateRange?.from && isValid(dateRange.from)) ? startOfDay(dateRange.from) : null;
    const filterTo = (dateRange?.to && isValid(dateRange.to)) ? endOfDay(dateRange.to) : ((dateRange?.from && isValid(dateRange.from)) ? endOfDay(dateRange.from) : null);

    if (!filterFrom || !filterTo) return items;

    return items.filter(item => {
      const itemDate = parseAndValidateDate(item[dateKey]);
      return itemDate && isValid(itemDate) && isWithinInterval(itemDate, { start: filterFrom, end: filterTo });
    });
  }, [dateRange]);

  const generateReportData = useCallback(async () => {
    if (!profile?.companyProfile) {
      setError("Company profile not loaded. Cannot generate report.");
      setIsLoading(false);
      return;
    }

    // Check if any critical data dependencies are still loading
    if (
      isLoadingProfile ||
      isLoadingInventory ||
      isLoadingOrders ||
      isLoadingStockMovements ||
      isLoadingVendors ||
      isLoadingCategories ||
      isLoadingCustomers ||
      isLoadingFolders
    ) {
      // If any dependency is still loading, defer report generation.
      // The useEffect below will re-trigger once all are loaded.
      setIsLoading(true); // Keep loading state true
      return;
    }

    setIsLoading(true);
    setError(null); // Clear error at the start of a new generation attempt

    const basePdfProps = {
      companyName: profile.companyProfile.companyName,
      companyAddress: profile.companyProfile.companyAddress || "N/A",
      companyCurrency: profile.companyProfile.companyCurrency || "N/A",
      companyLogoUrl: profile.companyProfile.companyLogoUrl || undefined,
      reportDate: format(new Date(), "MMM dd, yyyy HH:mm"),
      dateRange,
    };

    let currentProcessedData: any = null;
    let currentPdfProps: any = { ...basePdfProps };

    try {
      switch (reportId) {
        case "dashboard-summary": {
          const filteredInventory = filterDataByDateRange(inventoryItems, 'lastUpdated');
          const filteredOrders = filterDataByDateRange(orders, 'date');

          const totalStockValue = filteredInventory.reduce((sum: number, item: InventoryItem) => sum + (item.quantity * item.unitCost), 0);
          const totalUnitsOnHand = filteredInventory.reduce((sum: number, item: InventoryItem) => sum + item.quantity, 0);
          const lowStockItems = filteredInventory.filter((item: InventoryItem) => item.quantity > 0 && item.quantity <= item.reorderLevel);
          const outOfStockItems = filteredInventory.filter((item: InventoryItem) => item.quantity === 0);

          const recentSalesOrders = filteredOrders
            .filter((order: OrderItem) => order.type === "Sales")
            .sort((a: OrderItem, b: OrderItem) => {
              const dateA = parseAndValidateDate(a.date);
              const dateB = parseAndValidateDate(b.date);
              if (!dateA || !dateB || !isValid(dateA) || !isValid(dateB)) return 0;
              return dateB.getTime() - dateA.getTime();
            })
            .slice(0, 5);

          const recentPurchaseOrders = filteredOrders
            .filter((order: OrderItem) => order.type === "Purchase")
            .sort((a: OrderItem, b: OrderItem) => {
              const dateA = parseAndValidateDate(a.date);
              const dateB = parseAndValidateDate(b.date);
              if (!dateA || !dateB || !isValid(dateA) || !isValid(dateB)) return 0;
              return dateB.getTime() - dateB.getTime();
            })
            .slice(0, 5);

          currentProcessedData = {
            totalStockValue,
            totalUnitsOnHand,
            lowStockItems,
            outOfStockItems,
            recentSalesOrders,
            recentPurchaseOrders,
          };
          currentPdfProps = { ...basePdfProps, ...currentProcessedData };
          break;
        }
        case "inventory-valuation": {
          const filteredInventory = filterDataByDateRange(inventoryItems, 'lastUpdated');
          const groupBy = 'category'; // Default or from a filter option

          let groupedData: { name: string; totalValue: number; totalQuantity: number }[] = [];
          let totalOverallValue = 0;
          let totalOverallQuantity = 0;

          if (groupBy === "category") {
            const categoryMap: { [key: string]: { totalValue: number; totalQuantity: number } } = {};
            filteredInventory.forEach((item: InventoryItem) => {
              if (!categoryMap[item.category]) {
                categoryMap[item.category] = { totalValue: 0, totalQuantity: 0 };
              }
              categoryMap[item.category].totalValue += item.quantity * item.unitCost;
              categoryMap[item.category].totalQuantity += item.quantity;
              totalOverallValue += item.quantity * item.unitCost;
              totalOverallQuantity += item.quantity;
            });
            groupedData = Object.entries(categoryMap).map(([name, data]) => ({
              name,
              totalValue: data.totalValue,
              totalQuantity: data.totalQuantity,
            })).sort((a, b) => b.totalValue - a.totalValue);
          } else { // Group by folder
            const locationMap: { [key: string]: { totalValue: number; totalQuantity: number, displayName: string } } = {};
            filteredInventory.forEach((item: InventoryItem) => {
              const folderIdKey = item.folderId;
              const display = structuredLocations.find(folder => folder.id === folderIdKey)?.name || folderIdKey;

              if (!locationMap[folderIdKey]) {
                locationMap[folderIdKey] = { totalValue: 0, totalQuantity: 0, displayName: display };
              }
              locationMap[folderIdKey].totalValue += item.quantity * item.unitCost;
              locationMap[folderIdKey].totalQuantity += item.quantity;
              totalOverallValue += item.quantity * item.unitCost;
              totalOverallQuantity += item.quantity;
            });
            groupedData = Object.entries(locationMap).map(([_key, data]) => ({
              name: data.displayName,
              totalValue: data.totalValue,
              totalQuantity: data.totalQuantity,
            })).sort((a, b) => b.totalValue - a.totalValue);
          }

          currentProcessedData = {
            groupedData,
            groupBy,
            totalOverallValue,
            totalOverallQuantity,
          };
          currentPdfProps = { ...basePdfProps, ...currentProcessedData };
          break;
        }
        case "low-stock-out-of-stock": {
          const filteredInventory = filterDataByDateRange(inventoryItems, 'lastUpdated');
          const itemsToDisplay = filteredInventory.filter((item: InventoryItem) => item.quantity <= item.reorderLevel || item.quantity === 0);
          
          currentProcessedData = {
            items: itemsToDisplay,
            statusFilter: 'all', // Default or from a filter option
            structuredLocations,
          };
          currentPdfProps = { ...basePdfProps, ...currentProcessedData };
          break;
        }
        case "inventory-movement": {
          const movementTypeFilter = 'all'; // Default or from a filter option

          const filteredMovements = filterDataByDateRange(stockMovements, 'timestamp').filter((movement: StockMovement) => {
            return movementTypeFilter === "all" || movement.type === movementTypeFilter;
          });

          currentProcessedData = {
            movements: filteredMovements,
            allProfiles,
            structuredLocations,
          };
          currentPdfProps = { ...basePdfProps, ...currentProcessedData };
          break;
        }
        case "sales-by-customer": {
          const filteredOrders = filterDataByDateRange(orders, 'date').filter((order: OrderItem) => order.type === "Sales");

          const customerSalesMap: { [key: string]: { totalSales: number; totalItems: number; lastOrderDate: Date } } = {};
          filteredOrders.forEach((order: OrderItem) => {
            if (!customerSalesMap[order.customerSupplier]) {
              customerSalesMap[order.customerSupplier] = { totalSales: 0, totalItems: 0, lastOrderDate: new Date(0) };
            }
            customerSalesMap[order.customerSupplier].totalSales += order.totalAmount;
            customerSalesMap[order.customerSupplier].totalItems += order.itemCount;
            const currentOrderDate = parseAndValidateDate(order.date);
            if (currentOrderDate && isValid(currentOrderDate) && currentOrderDate > customerSalesMap[order.customerSupplier].lastOrderDate) {
              customerSalesMap[order.customerSupplier].lastOrderDate = currentOrderDate;
            }
          });

          const customerSales = Object.entries(customerSalesMap).map(([customerName, data]) => ({
            customerName,
            totalSales: data.totalSales,
            totalItems: data.totalItems,
            lastOrderDate: format(data.lastOrderDate, "MMM dd, yyyy"),
          })).sort((a, b) => b.totalSales - a.totalSales);

          currentProcessedData = { customerSales };
          currentPdfProps = { ...basePdfProps, ...currentProcessedData };
          break;
        }
        case "sales-by-product": {
          const filteredOrders = filterDataByDateRange(orders, 'date').filter((order: OrderItem) => order.type === "Sales");

          const productSalesMap: { [key: string]: { productName: string; sku: string; category: string; unitsSold: number; totalRevenue: number } } = {};
          filteredOrders.forEach((order: OrderItem) => {
            order.items.forEach((orderItem: POItem) => {
              const inventoryItem = inventoryItems.find((inv: InventoryItem) => inv.id === orderItem.inventoryItemId);
              const sku = inventoryItem?.sku || "N/A";
              const category = inventoryItem?.category || "Uncategorized";
              const productName = orderItem.itemName;

              if (!productSalesMap[sku]) {
                productSalesMap[sku] = { productName, sku, category, unitsSold: 0, totalRevenue: 0 };
              }
              productSalesMap[sku].unitsSold += orderItem.quantity;
              productSalesMap[sku].totalRevenue += orderItem.quantity * orderItem.unitPrice;
            });
          });

          const productSales = Object.values(productSalesMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

          currentProcessedData = { productSales };
          currentPdfProps = { ...basePdfProps, ...currentProcessedData };
          break;
        }
        case "purchase-order-status": {
          const filteredOrders = filterDataByDateRange(orders, 'date').filter((order: OrderItem) => {
            return order.type === "Purchase";
          });

          const statusFilter: 'all' | 'new-order' | 'processing' | 'packed' | 'shipped' | 'on-hold-problem' | 'archived' = 'all'; // Default or from a filter option
          currentProcessedData = { orders: filteredOrders, statusFilter };
          currentPdfProps = { ...basePdfProps, ...currentProcessedData };
          break;
        }
        case "profitability": {
          const filteredOrders = filterDataByDateRange(orders, 'date').filter((order: OrderItem) => order.type === "Sales");

          let totalSalesRevenue = 0;
          let totalCostOfGoodsSold = 0;

          filteredOrders.forEach((order: OrderItem) => {
            totalSalesRevenue += order.totalAmount;
            order.items.forEach((orderItem: POItem) => {
              const inventoryItem = inventoryItems.find((inv: InventoryItem) => inv.id === orderItem.inventoryItemId);
              if (inventoryItem) {
                totalCostOfGoodsSold += orderItem.quantity * inventoryItem.unitCost;
              } else {
                totalCostOfGoodsSold += orderItem.quantity * orderItem.unitPrice * 0.7; // Fallback if item not found
              }
            });
          });

          const grossProfit = totalSalesRevenue - totalCostOfGoodsSold;
          const grossProfitMargin = totalSalesRevenue > 0 ? (grossProfit / totalSalesRevenue) * 100 : 0;
          const simulatedOperatingExpenses = totalSalesRevenue * 0.20; // Example
          const netProfit = grossProfit - simulatedOperatingExpenses;
          const netProfitMargin = totalSalesRevenue > 0 ? (netProfit / totalSalesRevenue) * 100 : 0;
          const simulatedLossesPercentage = totalSalesRevenue > 0 ? (totalSalesRevenue * 0.05 / totalSalesRevenue) * 100 : 0; // Example

          const metricsData = [
            { name: "Gross Margin", value: parseFloat(grossProfitMargin.toFixed(0)), color: "#00BFD8" },
            { name: "Net Margin", value: parseFloat(netProfitMargin.toFixed(0)), color: "#00C49F" },
            { name: "Simulated Losses", value: parseFloat(simulatedLossesPercentage.toFixed(0)), color: "#0088FE" },
          ];

          currentProcessedData = {
            metricsData,
            totalSalesRevenue,
            totalCostOfGoodsSold,
          };
          currentPdfProps = { ...basePdfProps, ...currentProcessedData };
          break;
        }
        case "stock-discrepancy": {
          const statusFilter: 'all' | 'pending' | 'resolved' = 'all'; // Default or from a filter option

          let query = supabase
            .from('discrepancies')
            .select('*')
            .eq('organization_id', profile.organizationId)
            .order('timestamp', { ascending: false });

          if (statusFilter !== "all") {
            query = query.eq('status', statusFilter);
          }

          const filterFrom = (dateRange?.from && isValid(dateRange.from)) ? startOfDay(dateRange.from) : null;
          const filterTo = (dateRange?.to && isValid(dateRange.to)) ? endOfDay(dateRange.to) : ((dateRange?.from && isValid(dateRange.from)) ? endOfDay(dateRange.from) : null);

          if (filterFrom && filterTo) {
            query = query.gte('timestamp', filterFrom.toISOString())
                         .lte('timestamp', filterTo.toISOString());
          }

          const { data: discrepanciesData, error: discrepanciesError } = await query;

          if (discrepanciesError) throw discrepanciesError;

          const discrepancies = discrepanciesData.map((log: any) => ({
            id: log.id,
            timestamp: parseAndValidateDate(log.timestamp)?.toISOString() || new Date().toISOString(),
            userId: log.user_id,
            organizationId: log.organization_id,
            itemId: log.item_id,
            itemName: log.item_name,
            folderId: log.folder_id,
            locationType: log.location_type,
            originalQuantity: log.original_quantity,
            countedQuantity: log.counted_quantity,
            difference: log.difference,
            status: log.status,
            reason: log.reason,
          }));

          currentProcessedData = {
            discrepancies,
            statusFilter,
            allProfiles,
            structuredLocations,
          };
          currentPdfProps = { ...basePdfProps, ...currentProcessedData };
          break;
        }
        default:
          setError("Unknown report type selected.");
          break;
      }
    } catch (err: any) {
      console.error(`Error generating report data for ${reportId}:`, err);
      setError(`Failed to generate report: ${err.message || 'Unknown error'}`);
    } finally {
      setProcessedData(currentProcessedData);
      setPdfProps(currentPdfProps);
      setIsLoading(false);
    }
  }, [
    reportId, dateRange, inventoryItems, orders, categories, customers, stockMovements,
    profile, allProfiles, structuredLocations, isLoadingInventory, isLoadingOrders,
    isLoadingStockMovements, isLoadingVendors, isLoadingProfile, isLoadingCategories,
    isLoadingCustomers, isLoadingFolders
  ]);

  useEffect(() => {
    // Only trigger report generation if all contexts are loaded
    if (
      !isLoadingProfile &&
      !isLoadingInventory &&
      !isLoadingOrders &&
      !isLoadingStockMovements &&
      !isLoadingVendors &&
      !isLoadingCategories &&
      !isLoadingCustomers &&
      !isLoadingFolders
    ) {
      generateReportData();
    }
  }, [
    generateReportData, refreshTrigger, isLoadingProfile, isLoadingInventory,
    isLoadingOrders, isLoadingStockMovements, isLoadingVendors, isLoadingCategories,
    isLoadingCustomers, isLoadingFolders
  ]);

  return { data: processedData, pdfProps, isLoading, error, refresh };
};