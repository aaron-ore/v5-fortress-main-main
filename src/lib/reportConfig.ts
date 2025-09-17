import {
  LayoutDashboard,
  Package,
  Receipt,
  Truck,
  BarChart,
  DollarSign,
  Users,
  AlertTriangle,
  Scale,
  FileText,
} from "lucide-react";

export interface ReportItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

export interface ReportCategory {
  title: string;
  icon: React.ElementType;
  reports: ReportItem[];
}

export const reportCategories: ReportCategory[] = [
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
      { id: "inventory-valuation", title: "Inventory Valuation", description: "Value of all stock by category/folder.", icon: DollarSign },
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