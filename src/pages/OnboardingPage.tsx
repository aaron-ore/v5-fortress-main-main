import React, { useState, useEffect } from "react"; // Import useEffect
import { useNavigate, Link } from "react-router-dom"; // NEW: Import Link
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import { useOnboarding } from "@/context/OnboardingContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { useProfile } from "@/context/ProfileContext";
import Footer from "@/components/Footer"; // NEW: Import Footer

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { markOnboardingComplete } = useOnboarding(); // Keep markOnboardingComplete for the final step
  const { profile, isLoadingProfile } = useProfile();

  const [currentStep, setCurrentStep] = useState(0); // State for the current step

  // Effect to handle redirection if onboarding is already complete
  useEffect(() => {
    if (!isLoadingProfile && profile?.hasOnboardingWizardCompleted) {
      navigate("/", { replace: true });
    }
  }, [isLoadingProfile, profile?.hasOnboardingWizardCompleted, navigate]);

  const handleOnboardingComplete = async () => {
    // This is the last step of the wizard, so we mark onboarding as complete
    await markOnboardingComplete(); // Mark the wizard as completed in DB via context
    navigate("/", { replace: true }); // Redirect to dashboard after onboarding
  };

  const handleOnboardingClose = () => {
    // If the user closes the onboarding wizard, redirect them to the dashboard
    navigate("/", { replace: true });
  };

  if (isLoadingProfile || profile?.hasOnboardingWizardCompleted) {
    // Show loading or redirect if profile is loading or onboarding is already complete
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
      <OnboardingWizard
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        onComplete={handleOnboardingComplete}
        onClose={handleOnboardingClose}
      />
      <div className="mt-auto w-full max-w-md text-center text-xs text-muted-foreground pt-4">
        By continuing, you agree to our{" "}
        <Link to="/terms-of-service" className="text-primary hover:underline">Terms of Service</Link> and{" "}
        <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>.
      </div>
      <Footer /> {/* NEW: Add Footer to Onboarding page */}
    </div>
  );
};

export default OnboardingPage;