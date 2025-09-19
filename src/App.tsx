import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"; // Added QueryClientProvider import
import { BrowserRouter } from "react-router-dom";
import { OnboardingProvider } from "./context/OnboardingContext";
import { ProfileProvider } from "./context/ProfileContext";
import { PrintProvider } from "./context/PrintContext";
import ThemedAppContent from "./components/ThemedAppContent";
import { AuthProvider } from "./context/AuthContext";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
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
                    <ThemedAppContent />
                  </TooltipProvider>
                </PrintProvider>
          </ProfileProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;