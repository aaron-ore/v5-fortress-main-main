"use client";

import React, { useMemo } from "react";
import { useProfile } from "@/context/ProfileContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import AppContent from "@/AppContent";
import ThemeInitializer from "@/components/ThemeInitializer";
// REMOVED: import { AuthProvider } from "@/context/AuthContext"; // No longer needed here

const ThemedAppContent: React.FC = () => {
  const { profile, isLoadingProfile } = useProfile();

  const initialDefaultTheme = useMemo(() => {
    if (!isLoadingProfile && profile?.companyProfile?.organizationTheme) {
      return profile.companyProfile.organizationTheme;
    }
    return "dark";
  }, [profile?.companyProfile?.organizationTheme, isLoadingProfile]);

  return (
    <ThemeProvider defaultTheme={initialDefaultTheme}>
      {/* REMOVED: <AuthProvider> */}
        <ThemeInitializer>
          <AppContent />
        </ThemeInitializer>
      {/* REMOVED: </AuthProvider> */}
    </ThemeProvider>
  );
};

export default ThemedAppContent;