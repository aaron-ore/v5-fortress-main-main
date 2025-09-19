import { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { logActivity } from "@/utils/logActivity";
import { useProfile, UserProfile } from "@/context/ProfileContext"; // NEW: Import useProfile

interface ErrorBoundaryProps {
  children: ReactNode;
  // Removed profile prop, as it will now be fetched from context
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundaryComponent extends Component<ErrorBoundaryProps, ErrorBoundaryState> { // Renamed class to avoid conflict
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

    // Access profile from context within componentDidCatch
    // This is a workaround as hooks cannot be called in class components directly.
    // For a more robust solution, ErrorBoundary could be a functional component
    // using a wrapper to catch errors, or profile could be passed via a HOC.
    // For now, we'll log a warning if profile is not available.
    // In a real app, you might pass a logging function from context.
    console.warn("ErrorBoundary: Profile not directly accessible in componentDidCatch of class component. Error will be logged without user context.");
    logActivity(
      "Client-side Error",
      `Unhandled UI error: ${error.message}`,
      null, // Pass null for profile here, as it's not directly available in class componentDidCatch
      {
        componentStack: errorInfo.componentStack,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      },
      true // Mark as an error
    );
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

// Wrapper to inject context into the class component
const ErrorBoundary: React.FC<ErrorBoundaryProps> = (props) => {
  const { profile } = useProfile(); // Use the hook here
  return <ErrorBoundaryComponent {...props} profile={profile} />; // Pass profile as a prop to the class component
};

export default ErrorBoundary;