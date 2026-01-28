import React from 'react';
import { Loader2, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    label?: string;
}

const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
};

export function LoadingSpinner({ size = 'md', className, label }: LoadingSpinnerProps) {
    return (
        <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className={cn('animate-spin text-yellow-400', sizeClasses[size], className)} />
            {label && (
                <p className="text-sm font-medium text-gray-300 animate-pulse">
                    {label}
                </p>
            )}
        </div>
    );
}

interface LoadingOverlayProps {
    isOpen: boolean;
    label?: string;
    className?: string;
}

export function LoadingOverlay({ isOpen, label = 'Loading...', className }: LoadingOverlayProps) {
    if (!isOpen) return null;

    return (
        <div className={cn('fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm', className)}>
            <div className="flex flex-col items-center gap-6 p-8 rounded-3xl bg-black/60 backdrop-blur-md border border-white/10">
                <Loader2 className="h-16 w-16 animate-spin text-yellow-400" />
                <p className="text-lg font-semibold text-white animate-pulse">
                    {label}
                </p>
            </div>
        </div>
    );
}
