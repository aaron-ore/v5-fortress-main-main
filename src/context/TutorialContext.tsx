"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from "react";
import { useProfile } from "./ProfileContext";
import { useNavigate, useLocation } from "react-router-dom"; // Import useLocation

export interface TutorialStep {
  id: string;
  targetSelector: string;
  title: string;
  content: string;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  path?: string; // Optional path to navigate to for this step
}

const tutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    targetSelector: "body", // Global target for initial welcome
    title: "Welcome to Fortress!",
    content: "Let's take a quick tour to show you around your new inventory management system.",
    placement: "center",
    path: "/", // Ensure we are on the dashboard
  },
  {
    id: "total-stock-value-card",
    targetSelector: "[data-tutorial-target='total-stock-value-card']",
    title: "Total Stock Value",
    content: "This card shows the total monetary value of all your inventory items. Keep an eye on this to understand your asset value.",
    placement: "bottom",
  },
  {
    id: "low-stock-alerts-card",
    targetSelector: "[data-tutorial-target='low-stock-alerts-card']",
    title: "Low Stock Alerts",
    content: "Here you'll find items that are running low. Click 'Reorder' to quickly generate a purchase order.",
    placement: "bottom",
  },
  {
    id: "quick-actions-section",
    targetSelector: "[data-tutorial-target='quick-actions-section']",
    title: "Quick Actions",
    content: "Use these buttons to quickly add new items, create orders, or scan items for lookup.",
    placement: "top",
  },
  {
    id: "sidebar-navigation",
    targetSelector: "[data-tutorial-target='sidebar-navigation']",
    title: "Navigation Sidebar",
    content: "This sidebar is your main navigation. Explore different sections like Inventory, Orders, Reports, and Settings.",
    placement: "right",
    path: "/", // Ensure we are on the dashboard
  },
  {
    id: "all-set",
    targetSelector: "body", // Global target for final message
    title: "You're All Set!",
    content: "That's the basics! Feel free to explore, and remember you can always visit the Help Center for more guidance.",
    placement: "center",
  },
];

interface TutorialContextType {
  isTutorialActive: boolean;
  currentStep: TutorialStep | null;
  startTutorial: () => void;
  nextStep: () => void;
  dismissTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const TutorialProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { profile, isLoadingProfile, markTutorialAsShown } = useProfile();
  const navigate = useNavigate();
  const location = useLocation(); // Use useLocation
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const currentStep = isTutorialActive ? tutorialSteps[currentStepIndex] : null;

  const dismissTutorial = useCallback(async () => {
    console.log("[TutorialContext] dismissTutorial called.");
    setIsTutorialActive(false);
    setCurrentStepIndex(0);
    if (profile && !profile.hasUiTutorialShown) { // Use hasUiTutorialShown
      console.log("[TutorialContext] Marking UI tutorial as shown in DB.");
      await markTutorialAsShown();
    }
  }, [profile, markTutorialAsShown]);

  const nextStep = useCallback(() => {
    console.log("[TutorialContext] nextStep called. currentStepIndex:", currentStepIndex);
    if (currentStepIndex < tutorialSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      const nextTutorialStep = tutorialSteps[currentStepIndex + 1];
      if (nextTutorialStep.path && location.pathname !== nextTutorialStep.path) { // Use location.pathname
        console.log("[TutorialContext] Navigating to next tutorial path:", nextTutorialStep.path);
        navigate(nextTutorialStep.path);
      }
    } else {
      console.log("[TutorialContext] Last step reached, dismissing tutorial.");
      dismissTutorial();
    }
  }, [currentStepIndex, navigate, location.pathname, dismissTutorial]); // Add location.pathname to dependencies

  const startTutorial = useCallback(() => {
    console.log("[TutorialContext] startTutorial called. profile?.hasUiTutorialShown:", profile?.hasUiTutorialShown);
    if (profile && !profile.hasUiTutorialShown) { // Use hasUiTutorialShown
      setIsTutorialActive(true);
      setCurrentStepIndex(0);
      if (tutorialSteps[0].path && location.pathname !== tutorialSteps[0].path) { // Use location.pathname
        console.log("[TutorialContext] Navigating to initial tutorial path:", tutorialSteps[0].path);
        navigate(tutorialSteps[0].path);
      }
    }
  }, [profile, navigate, location.pathname]); // Add location.pathname to dependencies

  useEffect(() => {
    console.log("[TutorialContext] Effect for starting tutorial. isLoadingProfile:", isLoadingProfile, "profile:", profile?.id, "orgId:", profile?.organizationId, "wizardCompleted:", profile?.hasOnboardingWizardCompleted, "uiTutorialShown:", profile?.hasUiTutorialShown);
    if (!isLoadingProfile && profile && profile.organizationId && profile.hasOnboardingWizardCompleted && !profile.hasUiTutorialShown) { // Only start tutorial if wizard is completed and UI tutorial not shown
      // Delay slightly to ensure UI is rendered before trying to find targets
      const timer = setTimeout(() => {
        console.log("[TutorialContext] Delay finished, attempting to start tutorial.");
        startTutorial();
      }, 1000); // 1 second delay
      return () => clearTimeout(timer);
    }
  }, [isLoadingProfile, profile, startTutorial]);

  return (
    <TutorialContext.Provider value={{ isTutorialActive, currentStep, startTutorial, nextStep, dismissTutorial }}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error("useTutorial must be used within a TutorialProvider");
  }
  return context;
};