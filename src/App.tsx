import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { OnboardingProvider } from "./context/OnboardingContext";
import { ProfileProvider } from "./context/ProfileContext";
import { PrintProvider } from "./context/PrintContext";
import ThemedAppContent from "./components/ThemedAppContent";
import { AuthProvider } from "./context/AuthContext";
import * as Sentry from "@sentry/react"; // NEW: Import Sentry

const queryClient = new QueryClient();

const App = () => {
  return (
    <Sentry.ErrorBoundary fallback={<p>An error has occurred</p>}> {/* NEW: Wrap with Sentry.ErrorBoundary */}
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
                </OnboardingProvider>
            </ProfileProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  );
};

export default App;