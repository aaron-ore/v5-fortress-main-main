"use client";

import React, { useState } from "react";
import AddInventoryDialog from "@/components/AddInventoryDialog";
import ScanItemDialog from "@/components/ScanItemDialog";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DateRange } from "react-day-picker";
import { isValid } from "date-fns";

import WalletCard from "@/components/dashboard/WalletCard";
import LossesCard from "@/components/dashboard/LossesCard";
import IncomeCard from "@/components/dashboard/IncomeCard";
import OrderFulfillmentRateCard from "@/components/dashboard/OrderFulfillmentRateCard";
import Last3MonthSalesCard from "@/components/dashboard/Last3MonthSalesCard";
import IssuesCard from "@/components/dashboard/IssuesCard";
import LiveInformationAreaChartCard from "@/components/dashboard/LiveInformationAreaChartCard";
import StockDiscrepancyCard from "@/components/dashboard/StockDiscrepancyCard";
import LocationStockHealthCard from "@/components/dashboard/LocationStockHealthCard";
import MonthlyOverviewChartCard from "@/components/dashboard/MonthlyOverviewChartCard";
import TopSellingProductsCard from "@/components/dashboard/TopSellingProductsCard";
import GenerateReportButton from "@/components/dashboard/GenerateReportButton";
import { Button } from "@/components/ui/button";
import { FilterX, Loader2, AlertTriangle } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard-data";


const DefaultDashboardContent: React.FC = () => {
  const [isAddInventoryDialogOpen, setIsAddInventoryDialogOpen] = useState(false);
  const [isScanItemDialogOpen, setIsScanItemDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const { data: dashboardData, isLoading, error, refresh } = useDashboardData(dateRange);

  const handleClearDateFilter = () => {
    setDateRange(undefined);
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading dashboard data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-destructive">
        <AlertTriangle className="h-16 w-16 mb-4" />
        <p className="text-lg">Error loading dashboard: {error}</p>
        <Button onClick={refresh} className="mt-4">Retry Loading Dashboard</Button>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-muted-foreground">
        <AlertTriangle className="h-16 w-16 mb-4" />
        <p className="text-lg">No dashboard data available.</p>
        <Button onClick={refresh} className="mt-4">Load Dashboard</Button>
      </div>
    );
  }

  const { metrics, charts, lists } = dashboardData;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <DateRangePicker dateRange={dateRange} onSelect={setDateRange} />
          {dateRange?.from && isValid(dateRange.from) && (
            <Button variant="outline" onClick={handleClearDateFilter} size="icon">
              <FilterX className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div className="col-span-full md:col-span-1">
          <OrderFulfillmentRateCard
            fulfillmentPercentage={metrics.fulfillmentPercentage}
            pendingPercentage={metrics.pendingPercentage}
            totalOrders={lists.recentSalesOrders.length + lists.recentPurchaseOrders.length}
          />
        </div>
        <div className="col-span-full md:col-span-1">
          <Last3MonthSalesCard
            data={charts.last3MonthSalesData}
          />
        </div>
        <div className="col-span-full md:col-span-1">
          <IssuesCard
            dailyIssuesCount={lists.dailyIssuesCount}
            previousPeriodIssuesCount={lists.previousPeriodIssuesCount}
            dateRange={dateRange}
          />
        </div>
        <div className="col-span-full md:col-span-1 flex flex-col gap-4">
          <WalletCard
            totalStockValue={metrics.totalStockValue}
          />
          <LossesCard
            totalLosses={metrics.totalLosses}
          />
          <IncomeCard
            totalIncome={metrics.totalIncome}
          />
          <GenerateReportButton
            dateRange={dateRange}
            totalStockValue={metrics.totalStockValue}
            totalUnitsOnHand={metrics.totalUnitsOnHand}
            lowStockItems={lists.lowStockItems}
            outOfStockItems={lists.outOfStockItems}
            recentSalesOrders={lists.recentSalesOrders}
            recentPurchaseOrders={lists.recentPurchaseOrders}
          />
        </div>

        <div className="col-span-full md:col-span-2 lg:col-span-2 xl:col-span-2">
          <LiveInformationAreaChartCard
            data={charts.liveActivityData}
          />
        </div>
        <div className="col-span-full md:col-span-1">
          <StockDiscrepancyCard
            pendingDiscrepanciesCount={lists.pendingDiscrepanciesCount}
            previousPeriodDiscrepanciesCount={lists.previousPeriodDiscrepanciesCount}
            dateRange={dateRange}
          />
        </div>
        <div className="col-span-full md:col-span-1">
          <LocationStockHealthCard
            locationStockHealthData={charts.locationStockHealthData}
          />
        </div>

        <div className="col-span-full md:col-span-2 lg:col-span-3 xl:col-span-3">
          <MonthlyOverviewChartCard
            data={charts.monthlyOverviewData}
          />
        </div>
        <div className="col-span-full md:col-span-1">
          <TopSellingProductsCard
            topSellingProducts={lists.topSellingProducts}
          />
        </div>
      </div>

      <AddInventoryDialog
        isOpen={isAddInventoryDialogOpen}
        onClose={() => setIsAddInventoryDialogOpen(false)}
      />
      <ScanItemDialog
        isOpen={isScanItemDialogOpen}
        onClose={() => setIsScanItemDialogOpen(false)}
      />
    </div>
  );
};

export default DefaultDashboardContent;