import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  private lastLoggedTime = 0;

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary caught error in component [${this.props.name || "Unknown"}]:`, error, errorInfo);
    
    // Rate limit: prevent logging duplicate reports from the same boundary within 10 seconds
    const now = Date.now();
    if (now - this.lastLoggedTime < 10000) return;
    this.lastLoggedTime = now;

    try {
      const deviceId = localStorage.getItem('realssa_device_uuid') || 'unknown';
      import('@/lib/api-base').then(({ apiUrl }) => {
        fetch(apiUrl('/api/client-error'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId,
            message: error.message || String(error),
            stack: error.stack || null,
            componentName: this.props.name || 'Unknown'
          }),
          keepalive: true
        }).catch(() => {});
      }).catch(() => {});
    } catch (err) {}
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 text-center bg-zinc-950/80 border border-white/5 rounded-xl backdrop-blur-md w-full h-full min-h-[200px] z-20">
          <AlertTriangle className="h-10 w-10 text-amber-500 mb-3 animate-pulse" />
          <h3 className="text-white font-bold text-sm mb-1">
            Feed Temporarily Unavailable
          </h3>
          <p className="text-gray-400 text-xs max-w-xs mb-4">
            A rendering crash occurred in this component.
          </p>
          <Button
            onClick={this.handleReset}
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 border-white/10 hover:bg-white/5 text-xs text-white"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Retry Feed</span>
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
