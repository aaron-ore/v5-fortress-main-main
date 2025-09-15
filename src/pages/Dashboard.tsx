import React, { useState } from "react";
import DefaultDashboardContent from "./DefaultDashboardContent";
import ClassicDashboard from "./ClassicDashboard";
// Removed DateRange and setDateRange as they are not used in this component

const Dashboard: React.FC = () => {
  const [dashboardView, setDashboardView] = useState<"default" | "classic">("default");
  // Removed dateRange and setDateRange as they are not used in this component

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedView = localStorage.getItem("dashboardViewPreference") as "default" | "classic";
      if (savedView) {
        setDashboardView(savedView);
      }
    }
  }, []);

  return (
    <>
      {dashboardView === "classic" ? (
        <ClassicDashboard />
      ) : (
        <DefaultDashboardContent />
      )}
    </>
  );
};

export default Dashboard;