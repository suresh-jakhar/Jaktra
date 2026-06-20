import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { getErrorMessage } from "../../utils/error-utils";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ReactErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled runtime rendering error caught by boundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 shadow-lg">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 mb-6">
              <AlertTriangle className="h-7 w-7 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-500 mb-6">
              An unexpected error occurred while rendering this page.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 mb-6 text-left max-h-40 overflow-auto">
                <code className="text-xs text-red-600 block break-all whitespace-pre-wrap font-mono">
                  {getErrorMessage(this.state.error)}
                </code>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 px-4 py-2 text-sm shadow transition-colors"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 px-4 py-2 text-sm shadow-sm transition-colors"
              >
                <Home className="mr-2 h-4 w-4" />
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
