import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary Component
 * 
 * Catches React component errors and prevents white screen of death.
 * Displays user-friendly error UI with recovery options.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        // Update state so the next render will show the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error details for debugging
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // Update state with error details
        this.setState({
            error,
            errorInfo,
        });

        // TODO: Send error to monitoring service (e.g., Sentry, LogRocket)
        // logErrorToService(error, errorInfo);
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback UI if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <div className="min-h-screen bg-black flex items-center justify-center p-4">
                    <div className="max-w-2xl w-full">
                        {/* Error Card */}
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
                            {/* Icon */}
                            <div className="w-20 h-20 mx-auto mb-6 bg-red-500/10 border border-red-500/30 rounded-3xl flex items-center justify-center">
                                <AlertTriangle className="h-10 w-10 text-red-400" />
                            </div>

                            {/* Title */}
                            <h1 className="text-3xl md:text-4xl font-black text-white mb-4">
                                Oops! Something went wrong
                            </h1>

                            {/* Description */}
                            <p className="text-gray-300 text-lg mb-8 max-w-md mx-auto">
                                We encountered an unexpected error. Don't worry, your data is safe.
                                Try refreshing the page or go back to the homepage.
                            </p>

                            {/* Error Details (dev mode only) */}
                            {process.env.NODE_ENV === 'development' && this.state.error && (
                                <div className="mb-8 text-left">
                                    <details className="bg-black/40 rounded-xl p-4 border border-white/10">
                                        <summary className="text-yellow-400 font-semibold cursor-pointer mb-2">
                                            Error Details (Development Only)
                                        </summary>
                                        <div className="space-y-2">
                                            <div>
                                                <p className="text-red-400 font-mono text-sm">
                                                    {this.state.error.toString()}
                                                </p>
                                            </div>
                                            {this.state.errorInfo && (
                                                <div>
                                                    <p className="text-gray-400 text-xs font-mono whitespace-pre-wrap">
                                                        {this.state.errorInfo.componentStack}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </details>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button
                                    onClick={this.handleReset}
                                    variant="byblos"
                                    size="lg"
                                    className="gap-2"
                                >
                                    <RefreshCw className="h-5 w-5" />
                                    Try Again
                                </Button>
                                <Button
                                    onClick={this.handleGoHome}
                                    variant="outline"
                                    size="lg"
                                    className="gap-2"
                                >
                                    <Home className="h-5 w-5" />
                                    Go to Homepage
                                </Button>
                            </div>

                            {/* Help Text */}
                            <p className="text-gray-300 text-sm mt-8">
                                If this problem persists, please contact support at{' '}
                                <a
                                    href="mailto:support@byblos.com"
                                    className="text-yellow-400 hover:text-yellow-300 underline"
                                >
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

export default ErrorBoundary;
