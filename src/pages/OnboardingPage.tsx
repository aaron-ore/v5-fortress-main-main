"use client";

import React from "react";
import { useNavigate } from "react-router-dom";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import { useOnboarding } from "@/context/OnboardingContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isOnboardingComplete } = useOnboarding();

  const handleOnboardingComplete = () => {
    navigate("/"); // Redirect to dashboard after onboarding
  };

  if (isOnboardingComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl font-bold">Onboarding Complete!</CardTitle>
            <CardDescription>You've successfully set up your Fortress account.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Redirecting you to the dashboard...</p>
            <button onClick={() => navigate("/")} className="text-primary hover:underline">
              Go to Dashboard
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <OnboardingWizard onComplete={handleOnboardingComplete} />
    </div>
  );
};

export default OnboardingPage;