import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import * as Sentry from "@sentry/react"; // NEW: Import Sentry

console.log("Dyad Test Log: main.tsx is running!"); // NEW: Added test log

// NEW: Initialize Sentry
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN, // Get DSN from environment variable
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring

  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then to a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when an error occurs.
});

createRoot(document.getElementById("root")!).render(<App />);