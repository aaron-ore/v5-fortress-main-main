import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import ReportSidebar from "@/components/reports/ReportSidebar";
import ReportViewer from "@/components/reports/ReportViewer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, LayoutDashboard, Package, Receipt, Truck, Scale, FileText, DollarSign, Users, AlertTriangle, ChevronDown, FilterX } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/DateRangePicker"; // Import DateRangePicker
import { DateRange } from "react-day-picker"; // Import DateRange
import { isValid } from "date-fns"; // Import isValid

interface ReportCategory {
  title: string;
  icon: React.ElementType;
  reports: ReportItem[];
}

interface ReportItem {
  id: string; // Unique ID for the report, used in URL hash
  title: string;
  description: string;
  icon: React.ElementType;
}

const reportCategories: ReportCategory[] = [
  {
    title: "Overview",
    icon: LayoutDashboard,
    reports: [
      { id: "dashboard-summary", title: "Dashboard Summary", description: "High-level overview of key metrics.", icon: LayoutDashboard },
    ],
  },
  {
    title: "Inventory Reports",
    icon: Package,
    reports: [
      { id: "inventory-valuation", title: "Inventory Valuation", description: "Value of all stock by category/location.", icon: DollarSign },
      { id: "low-stock-out-of-stock", title: "Low/Out of Stock", description: "Items needing replenishment.", icon: AlertTriangle },
      { id: "inventory-movement", title: "Inventory Movement", description: "Detailed log of stock changes.", icon: Scale },
      { id: "stock-discrepancy", title: "Stock Discrepancy", description: "Reported differences in stock counts.", icon: AlertTriangle },
    ],
  },
  {
    title: "Sales Reports",
    icon: Receipt,
    reports: [
      { id: "sales-by-customer", title: "Sales by Customer", description: "Revenue generated per customer.", icon: Users },
      { id: "sales-by-product", title: "Sales by Product", description: "Top-selling items by quantity/revenue.", icon: BarChart },
    ],
  },
  {
    title: "Purchase Reports",
    icon: Truck,
    reports: [
      { id: "purchase-order-status", title: "Purchase Order Status", description: "Overview of all purchase orders.", icon: FileText },
    ],
  },
  {
    title: "Financial Reports",
    icon: DollarSign,
    reports: [
      { id: "profitability", title: "Profitability (Gross Margin)", description: "Gross profit by product or category.", icon: DollarSign },
    ],
  },
];

const Reports: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeReportId, setActiveReportId] = useState<string>("");
  // Removed reportViewMode state
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Flatten all reports for the dropdown menu
  const allReports = useMemo(() => {
    return reportCategories.flatMap(category => category.reports);
  }, []);

  useEffect(() => {
    // Extract report ID from URL hash
    const hash = location.hash.replace("#", "");
    if (hash) {
      setActiveReportId(hash);
    } else {
      // Default to a report if no hash is present, e.g., "dashboard-summary"
      setActiveReportId("dashboard-summary");
      navigate("/reports#dashboard-summary", { replace: true });
    }
  }, [location.hash, navigate]);

  const handleReportSelect = (reportId: string) => {
    setActiveReportId(reportId);
    navigate(`/reports#${reportId}`); // Update URL hash
  };

  const handleClearDateFilter = () => {
    setDateRange(undefined);
  };

  const currentReportTitle = useMemo(() => {
    const report = allReports.find(r => r.id === activeReportId);
    return report ? report.title : "Select a Report";
  }, [activeReportId, allReports]);

  return (
    <div className="flex flex-col flex-grow">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
      </div>
      <p className="text-muted-foreground mb-6">
        Generate detailed reports to gain actionable insights into your inventory, sales, and operations.
      </p>

      <Card className="mb-4 bg-card border-border shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-semibold">Report Configuration</CardTitle>
          <div className="flex items-center gap-2">
            <DateRangePicker dateRange={dateRange} onSelect={setDateRange} className="w-[240px]" />
            {dateRange?.from && isValid(dateRange.from) && (
              <Button variant="outline" onClick={handleClearDateFilter} size="icon">
                <FilterX className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Always render the detailed view structure */}
      <Card className="flex-grow rounded-lg border flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-xl font-semibold">
            {currentReportTitle}
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <BarChart className="h-4 w-4" /> {currentReportTitle} <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {reportCategories.map(category => (
                <React.Fragment key={category.title}>
                  <DropdownMenuLabel className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-primary-foreground bg-primary rounded-md mx-2 my-1 cursor-default">
                    <category.icon className="h-4 w-4" /> {category.title}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="mx-2" />
                  {category.reports.map(report => (
                    <DropdownMenuItem
                      key={report.id}
                      onClick={() => handleReportSelect(report.id)}
                      className={cn("mx-2", activeReportId === report.id && "bg-muted text-primary")}
                    >
                      {report.title}
                    </DropdownMenuItem>
                  ))}
                  {reportCategories.indexOf(category) < reportCategories.length - 1 && <DropdownMenuSeparator className="mx-2" />}
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="flex-grow p-4 pt-0">
          <ReportViewer reportId={activeReportId} dateRange={dateRange} />
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;