// src/App.tsx
import React from "react"; // Re-added React
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { OnboardingProvider } from "./context/OnboardingContext";
import { ProfileProvider } from "./context/ProfileContext";
import { PrintProvider } from "./context/PrintContext";
import ThemedAppContent from "./components/ThemedAppContent";

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
        <ProfileProvider>
            <OnboardingProvider>
              <PrintProvider>
                <TooltipProvider>
                  <ThemedAppContent />
                </TooltipProvider>
              </PrintProvider>
            </OnboardingProvider>
        </ProfileProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;