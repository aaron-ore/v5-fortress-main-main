import { useState, useEffect, useCallback, useMemo } from "react";
import { DateRange } from "react-day-picker";
import { format, isWithinInterval, startOfDay, endOfDay, isValid } from "date-fns";
import { useInventory, InventoryItem } from "@/context/InventoryContext";
import { useOrders, OrderItem, POItem } from "@/context/OrdersContext";
import { useCategories } from "@/context/CategoryContext";
import { useCustomers } from "@/context/CustomerContext";
import { useStockMovement, StockMovement } from "@/context/StockMovementContext";
import { useProfile } from "@/context/ProfileContext";
import { useOnboarding } from "@/context/OnboardingContext"; // Updated to InventoryFolder
import { parseAndValidateDate } from "@/utils/dateUtils";
import { supabase } from "@/lib/supabaseClient";
// Removed: import { PrintContentData } from "@/context/PrintContext";

interface ReportDataResult {
  data: any;
  pdfProps: any;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export const useReportData = (reportId: string, dateRange: DateRange | undefined): ReportDataResult => {
  const { inventoryItems } = useInventory();
  const { orders } = useOrders();
  const { categories } = useCategories();
  const { customers } = useCustomers();
  const { stockMovements, fetchStockMovements } = useStockMovement();
  const { profile, allProfiles, fetchAllProfiles } = useProfile();
  const { inventoryFolders: structuredLocations } = useOnboarding(); // Updated to inventoryFolders

  const [processedData, setProcessedData] = useState<any>(null);
  const [pdfProps, setPdfProps] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

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

    setIsLoading(true);
    setError(null);

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
    // let printType: PrintContentData['type'] = reportId as PrintContentData['type']; // Removed unused variable

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
          const groupBy = 'category';

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
          } else {
            const locationMap: { [key: string]: { totalValue: number; totalQuantity: number, displayName: string } } = {};
            filteredInventory.forEach((item: InventoryItem) => {
              const folderIdKey = item.folderId; // Changed from locationKey to folderIdKey
              const display = structuredLocations.find(folder => folder.id === folderIdKey)?.name || folderIdKey; // Find folder by ID and use its name

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
            statusFilter: 'all',
            structuredLocations,
          };
          currentPdfProps = { ...basePdfProps, ...currentProcessedData };
          break;
        }
        case "inventory-movement": {
          await fetchStockMovements();
          await fetchAllProfiles();
          const movementTypeFilter = 'all';

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

          const statusFilter: 'all' | 'new-order' | 'processing' | 'packed' | 'shipped' | 'on-hold-problem' | 'archived' = 'all';
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
                totalCostOfGoodsSold += orderItem.quantity * orderItem.unitPrice * 0.7;
              }
            });
          });

          const grossProfit = totalSalesRevenue - totalCostOfGoodsSold;
          const grossProfitMargin = totalSalesRevenue > 0 ? (grossProfit / totalSalesRevenue) * 100 : 0;
          const simulatedOperatingExpenses = totalSalesRevenue * 0.20;
          const netProfit = grossProfit - simulatedOperatingExpenses;
          const netProfitMargin = totalSalesRevenue > 0 ? (netProfit / totalSalesRevenue) * 100 : 0;
          const simulatedLossesPercentage = totalSalesRevenue > 0 ? (totalSalesRevenue * 0.05 / totalSalesRevenue) * 100 : 0;

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
          await fetchAllProfiles();
          const statusFilter: 'all' | 'pending' | 'resolved' = 'all';

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
            reason: log.reason,
            status: log.status,
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
  }, [reportId, dateRange, inventoryItems, orders, categories, customers, stockMovements, profile, allProfiles, structuredLocations, fetchStockMovements, fetchAllProfiles]);

  useEffect(() => {
    if (profile?.companyProfile) {
      generateReportData();
    }
  }, [profile?.companyProfile, generateReportData, refreshTrigger]);

  return { data: processedData, pdfProps, isLoading, error, refresh };
};