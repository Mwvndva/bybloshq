import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * specialized Error Boundary to catch "Failed to fetch dynamically imported module"
 * and other chunk loading errors that occur during deployments.
 */
class ChunkErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ChunkErrorBoundary caught an error:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            // Check if it's likely a chunk error
            const isChunkError = this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
                this.state.error?.message?.includes('Importing a module script failed');

            // Only show the specific UI for chunk errors, otherwise fall back to generic error logic (or rethrow if we want)
            // For this task, we'll show the UI for any error caught here, but emphasize the update if it's a chunk error.

            return (
                <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-center animate-in fade-in duration-500">
                    <div className="bg-zinc-900/50 border border-white/10 p-8 rounded-2xl max-w-md w-full shadow-2xl backdrop-blur-xl">
                        <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-yellow-500" />
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-3">
                            {isChunkError ? 'New Update Available' : 'Application Error'}
                        </h2>

                        <p className="text-gray-400 mb-8 leading-relaxed">
                            {isChunkError
                                ? 'We have pushed a new version of the app. Please refresh to receive the latest updates and features.'
                                : 'Something went wrong while loading the application. Please try refreshing.'}
                        </p>

                        <Button
                            onClick={this.handleReload}
                            className="w-full h-12 bg-white text-black hover:bg-gray-200 font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4 ml-2" />
                            Refresh Now
                        </Button>

                        {process.env.NODE_ENV === 'development' && (
                            <div className="mt-8 p-4 bg-red-950/30 rounded-lg text-left overflow-auto max-h-40 border border-red-900/50">
                                <p className="text-red-400 font-mono text-xs break-all">
                                    {this.state.error?.toString()}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ChunkErrorBoundary;
