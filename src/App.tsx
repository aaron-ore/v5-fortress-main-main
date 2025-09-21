import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter } from "react-router-dom";
import { OnboardingProvider } from "./context/OnboardingContext";
import { ProfileProvider } from "./context/ProfileContext";
import { PrintProvider } from "./context/PrintContext";
import ThemedAppContent from "./components/ThemedAppContent";
import { AuthProvider } from "./context/AuthContext";
import { TutorialProvider } from "./context/TutorialContext"; // NEW: Import TutorialProvider

const App = () => {
  return (
    <>
      <SonnerToaster
        richColors
        position="top-right"
        duration={3000}
        closeButton
      />
      <BrowserRouter>
        <AuthProvider>
          <ProfileProvider>
              <OnboardingProvider>
                <PrintProvider>
                  <TooltipProvider>
                    <TutorialProvider> {/* NEW: Wrap with TutorialProvider */}
                      <ThemedAppContent />
                    </TutorialProvider>
                  </TooltipProvider>
                </PrintProvider>
              </OnboardingProvider>
          </ProfileProvider>
        </AuthProvider>
      </BrowserRouter>
    </>
  );
};

export default App;