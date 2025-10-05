import {
  LayoutDashboard,
  Package,
  Receipt,
  Truck,
  BarChart,
  Warehouse,
  Search,
  PackagePlus,
  ShoppingCart,
  ListOrdered,
  Repeat,
  CheckCircle,
  Undo2,
  Scan,
  AlertTriangle,
  MapPin,
  User,
  Settings as SettingsIcon,
  Bell,
  DollarSign,
  Users as UsersIcon,
  HelpCircle,
  Sparkles,
  BookOpen,
  Plug,
  Zap,
  Activity,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  isParent?: boolean;
  children?: NavItem[];
  adminOnly?: boolean;
  mobileOnly?: boolean;
  action?: () => void;
  tag?: string;
}

export const mainNavItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Reports", href: "/reports", icon: BarChart },
  { title: "Inventory", href: "/inventory", icon: Package },
  { title: "Orders", href: "/orders", icon: Receipt },
  { title: "Customers", href: "/customers", icon: User },
  { title: "Vendors", href: "/vendors", icon: Truck },
  { title: "Folders", href: "/folders", icon: MapPin },
  { title: "Integrations", href: "/integrations", icon: Plug, tag: "Coming Soon" },
  { title: "Automation", href: "/automation", icon: Zap, adminOnly: true },
  { title: "Warehouse Operations", href: "/warehouse-operations", icon: Warehouse }, // Consolidated into a single entry
];

export const userAndSettingsNavItems: NavItem[] = [
  { title: "My Profile", href: "/profile", icon: User },
  { title: "Account Settings", href: "/account-settings", icon: SettingsIcon },
  { title: "Notifications", href: "/notifications-page", icon: Bell },
  { title: "Billing & Subscriptions", href: "/billing", icon: DollarSign },
  { title: "Users", href: "/users", icon: UsersIcon, adminOnly: true },
  { title: "Activity Logs", href: "/activity-logs", icon: Activity, adminOnly: true },
  { title: "Company Settings", href: "/settings", icon: SettingsIcon },
];

export const supportAndResourcesNavItems: NavItem[] = [
  { title: "Help Center", href: "/help", icon: HelpCircle },
  { title: "What's New?", href: "/whats-new", icon: Sparkles },
  { title: "Setup Instructions", href: "/setup-instructions", icon: BookOpen },
];