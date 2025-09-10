"use client";

import React, { useEffect, useMemo } from "react";
import { useProfile } from "@/context/ProfileContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import AppContent from "@/AppContent";
import ThemeInitializer from "@/components/ThemeInitializer";

const ThemedAppContent: React.FC = () => {
  const { profile, isLoadingProfile } = useProfile();

  const initialDefaultTheme = useMemo(() => {
    if (!isLoadingProfile && profile?.organizationTheme) {
      return profile.organizationTheme;
    }
    return "dark";
  }, [profile?.organizationTheme, isLoadingProfile]);

  return (
    <ThemeProvider defaultTheme={initialDefaultTheme}>
      <ThemeInitializer>
        <AppContent />
      </ThemeInitializer>
    </ThemeProvider>
  );
};

export default ThemedAppContent;