"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from "react";
import { useProfile } from "./ProfileContext";
import { useNavigate } from "react-router-dom";

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
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const currentStep = isTutorialActive ? tutorialSteps[currentStepIndex] : null;

  const startTutorial = useCallback(() => {
    if (profile && !profile.hasOnboardingTutorialShown) {
      setIsTutorialActive(true);
      setCurrentStepIndex(0);
      if (tutorialSteps[0].path && navigate.pathname !== tutorialSteps[0].path) {
        navigate(tutorialSteps[0].path);
      }
    }
  }, [profile, navigate]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < tutorialSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      const nextTutorialStep = tutorialSteps[currentStepIndex + 1];
      if (nextTutorialStep.path && navigate.pathname !== nextTutorialStep.path) {
        navigate(nextTutorialStep.path);
      }
    } else {
      dismissTutorial();
    }
  }, [currentStepIndex, navigate]);

  const dismissTutorial = useCallback(async () => {
    setIsTutorialActive(false);
    setCurrentStepIndex(0);
    if (profile && !profile.hasOnboardingTutorialShown) {
      await markTutorialAsShown();
    }
  }, [profile, markTutorialAsShown]);

  useEffect(() => {
    if (!isLoadingProfile && profile && profile.organizationId && !profile.hasOnboardingTutorialShown) {
      // Delay slightly to ensure UI is rendered before trying to find targets
      const timer = setTimeout(() => {
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