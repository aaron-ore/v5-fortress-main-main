"use client";

import React, { useEffect, useMemo } from "react";
import { useProfile } from "@/context/ProfileContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import AppContent from "@/AppContent";
import ThemeInitializer from "@/components/ThemeInitializer";
import { AuthProvider } from "@/context/AuthContext"; // NEW: Import AuthProvider

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
      <AuthProvider> {/* NEW: Wrap with AuthProvider */}
        <ThemeInitializer>
          <AppContent />
        </ThemeInitializer>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default ThemedAppContent;