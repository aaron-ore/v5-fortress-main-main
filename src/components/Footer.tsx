import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const Footer: React.FC = () => {
  return (
    <footer className={cn(
      "w-full bg-sidebar-background text-sidebar-foreground py-6 px-4 sm:px-6 lg:px-8",
      "border-t border-sidebar-border flex flex-col sm:flex-row items-center justify-between gap-4"
    )}>
      <div className="text-sm text-muted-foreground text-center sm:text-left">
        © {new Date().getFullYear()} Fortress Inventory. All rights reserved.
      </div>
      <nav className="flex flex-wrap justify-center sm:justify-end gap-x-6 gap-y-2 text-sm">
        <Link to="/privacy-policy" className="text-muted-foreground hover:text-primary transition-colors">
          Privacy Policy
        </Link>
        <Link to="/terms-of-service" className="text-muted-foreground hover:text-primary transition-colors">
          Terms of Service
        </Link>
        <Link to="/refund-policy" className="text-muted-foreground hover:text-primary transition-colors">
          Refund Policy
        </Link>
      </nav>
    </footer>
  );
};

export default Footer;