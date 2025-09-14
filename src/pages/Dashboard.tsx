import React, { useState, useEffect } from "react";
import DefaultDashboardContent from "./DefaultDashboardContent";
import ClassicDashboard from "./ClassicDashboard";
import { DateRange } from "react-day-picker"; // Import DateRange

const Dashboard: React.FC = () => {
  const [dashboardView, setDashboardView] = useState<"default" | "classic">("default");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined); // State for date range

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