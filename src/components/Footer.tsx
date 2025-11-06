import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const Footer: React.FC = () => {
  return (
    <footer className={cn(
      "w-full bg-sidebar-background text-sidebar-foreground py-6 px-4 sm:px-6 lg:px-8",
      "border-t border-sidebar-border flex flex-col sm:flex-row items-center justify-center gap-4" // Changed justify-between to justify-center
    )}>
      <div className="text-sm text-muted-foreground text-center"> {/* Removed sm:text-left */}
        © {new Date().getFullYear()} Fortress Inventory. All rights reserved.
      </div>
      <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm"> {/* Changed sm:justify-end to justify-center */}
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