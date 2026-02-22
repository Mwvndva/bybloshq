import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ─── Chunk error detection ────────────────────────────────────────────────────
function isChunkError(error: Error | null): boolean {
  if (!error) return false;
  return (
    error.message?.includes('Failed to fetch dynamically imported module') ||
    error.message?.includes('Importing a module script failed')
  );
}

// ─── Main ErrorBoundary class ─────────────────────────────────────────────────
/**
 * Unified ErrorBoundary — handles both general React errors and chunk-load
 * failures (e.g. after a new deployment).
 *
 * Formerly split across ChunkErrorBoundary + RootErrorElement + ErrorBoundary.
 * Now consolidated into a single component.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    // TODO: forward to monitoring service (Sentry, LogRocket, etc.)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const chunkError = isChunkError(this.state.error);

      // Chunk-load failure UI (new deployment)
      if (chunkError) {
        return (
          <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-center animate-in fade-in duration-500">
            <div className="bg-zinc-900/50 border border-white/10 p-8 rounded-2xl max-w-md w-full shadow-2xl backdrop-blur-xl">
              <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">New Update Available</h2>
              <p className="text-gray-400 mb-8 leading-relaxed">
                We pushed a new version of the app. Refresh to receive the latest updates.
              </p>
              <Button
                onClick={this.handleReload}
                className="w-full h-12 bg-white text-black hover:bg-gray-200 font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Now
              </Button>
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-6 p-4 bg-red-950/30 rounded-lg text-left overflow-auto max-h-40 border border-red-900/50">
                  <p className="text-red-400 font-mono text-xs break-all">
                    {this.state.error?.toString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      }

      // General application error UI
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <div
              className="rounded-3xl p-8 md:p-12 text-center"
              style={{
                background: 'rgba(20, 20, 20, 0.7)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.6)',
              }}
            >
              <div className="w-20 h-20 mx-auto mb-6 bg-red-500/10 border border-red-500/30 rounded-3xl flex items-center justify-center">
                <AlertTriangle className="h-10 w-10 text-red-400" />
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white mb-4">
                Oops! Something went wrong
              </h1>
              <p className="text-gray-300 text-lg mb-8 max-w-md mx-auto">
                We hit an unexpected error. Your data is safe — try refreshing or go home.
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mb-8 text-left">
                  <details className="bg-black/40 rounded-xl p-4 border border-white/10">
                    <summary className="text-yellow-400 font-semibold cursor-pointer mb-2">
                      Error Details (Development Only)
                    </summary>
                    <p className="text-red-400 font-mono text-sm">
                      {this.state.error.toString()}
                    </p>
                    {this.state.errorInfo && (
                      <p className="text-gray-400 text-xs font-mono whitespace-pre-wrap mt-2">
                        {this.state.errorInfo.componentStack}
                      </p>
                    )}
                  </details>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button onClick={this.handleReset} variant="byblos" size="lg" className="gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Try Again
                </Button>
                <Button onClick={this.handleGoHome} variant="outline" size="lg" className="gap-2">
                  <Home className="h-5 w-5" />
                  Go to Homepage
                </Button>
              </div>

              <p className="text-gray-400 text-sm mt-8">
                Persistent issue? Contact{' '}
                <a href="mailto:support@byblos.com" className="text-yellow-400 hover:text-yellow-300 underline">
                  support@byblos.com
                </a>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ─── Router Error Element ─────────────────────────────────────────────────────
/**
 * RootErrorElement — use as React Router's `errorElement` prop.
 * Reads the route error and renders the unified ErrorBoundary UI.
 * Previously in a separate RootErrorElement.tsx that awkwardly re-threw
 * into ChunkErrorBoundary.
 */
export function RootErrorElement() {
  const error = useRouteError() as any;

  const isChunk =
    error?.message?.includes('Failed to fetch dynamically imported module') ||
    error?.message?.includes('Importing a module script failed') ||
    (isRouteErrorResponse(error) && error.status === 404);

  if (isChunk) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-center animate-in fade-in duration-500">
        <div className="bg-zinc-900/50 border border-white/10 p-8 rounded-2xl max-w-md w-full shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">New Update Available</h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            We pushed a new version of the app. Refresh to get the latest.
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="w-full h-12 bg-white text-black hover:bg-gray-200 font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Now
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div
        className="rounded-3xl p-8 text-center max-w-lg w-full"
        style={{
          background: 'rgba(20, 20, 20, 0.7)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="w-16 h-16 mx-auto mb-6 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-black text-white mb-3">Page Error</h1>
        <p className="text-gray-400 mb-6">An unexpected routing error occurred.</p>
        <Button onClick={() => window.location.href = '/'} variant="byblos" size="lg" className="gap-2">
          <Home className="h-5 w-5" />
          Go Home
        </Button>
      </div>
    </div>
  );
}

export default ErrorBoundary;
