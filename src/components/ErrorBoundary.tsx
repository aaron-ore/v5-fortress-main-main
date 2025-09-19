import { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { logActivity } from "@/utils/logActivity"; // NEW: Import logActivity
import { UserProfile } from "@/context/ProfileContext"; // NEW: Import UserProfile

interface ErrorBoundaryProps {
  children: ReactNode;
  profile: UserProfile | null; // NEW: Accept profile as a prop
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true, error: _, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in ErrorBoundary:", error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });

    // NEW: Log the error to Supabase activity_logs
    if (this.props.profile) {
      logActivity(
        "Client-side Error",
        `Unhandled UI error: ${error.message}`,
        this.props.profile,
        {
          componentStack: errorInfo.componentStack,
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
        },
        true // Mark as an error
      );
    } else {
      console.warn("ErrorBoundary: Cannot log error to Supabase, profile is not available.");
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
          <Card className="w-full max-w-md text-center border-destructive">
            <CardHeader className="flex flex-col items-center gap-2">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <CardTitle className="text-2xl font-bold text-destructive">
                Something went wrong.
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                We're sorry, but an unexpected error occurred. Please try
                refreshing the page.
              </p>
              {this.state.error && (
                <details className="text-sm text-left text-muted-foreground bg-muted/20 p-3 rounded-md overflow-auto max-h-40">
                  <summary className="font-semibold cursor-pointer">
                    Error Details
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words">
                    {this.state.error.toString()}
                    <br />
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
              <button
                onClick={() => window.location.reload()}
                className="mt-4 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                Refresh Page
              </button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;