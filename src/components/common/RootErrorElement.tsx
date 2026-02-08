import React from 'react';
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import ChunkErrorBoundary from './ChunkErrorBoundary';

/**
 * A root error element for React Router that specifically handles
 * chunk loading errors and other unexpected routing failures.
 */
export const RootErrorElement = () => {
    const error = useRouteError() as any;

    // Log the error for debugging
    console.error('RootErrorElement caught an error:', error);

    // If it's a chunk error, we can use the existing ChunkErrorBoundary UI
    // or a simplified version of it.
    const isChunkError =
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed') ||
        error?.statusText === 'Not Found' || // Sometimes chunks return 404
        (isRouteErrorResponse(error) && error.status === 404);

    // We wrap the internal logic in ChunkErrorBoundary's visual style
    // but we manually handle the state here since useRouteError provided it.

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
            <ChunkErrorBoundary>
                {/* 
           We pass a dummy component that throws the error we just caught
           so that ChunkErrorBoundary can render its specialized UI.
        */}
                <ErrorThrower error={error} />
            </ChunkErrorBoundary>
        </div>
    );
};

const ErrorThrower = ({ error }: { error: any }) => {
    throw error;
};

export default RootErrorElement;
