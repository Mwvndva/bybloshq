import React from 'react';
import { Skeleton } from './skeleton';
import { cn } from '@/lib/utils';

interface SkeletonCardProps {
    className?: string;
    variant?: 'product' | 'event' | 'order';
}

export function SkeletonCard({ className, variant = 'product' }: SkeletonCardProps) {
    return (
        <div className={cn('rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden', className)}>
            {/* Image skeleton */}
            <Skeleton className="w-full h-48" />

            {/* Content skeleton */}
            <div className="p-6 space-y-4">
                {/* Title */}
                <Skeleton className="h-6 w-3/4" />

                {/* Price or subtitle */}
                <Skeleton className="h-5 w-1/2" />

                {/* Description */}
                <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                </div>

                {variant === 'product' && (
                    <Skeleton className="h-10 w-full rounded-xl" />
                )}

                {variant === 'event' && (
                    <div className="flex gap-2">
                        <Skeleton className="h-10 flex-1 rounded-xl" />
                        <Skeleton className="h-10 flex-1 rounded-xl" />
                    </div>
                )}
            </div>
        </div>
    );
}

interface SkeletonCardGridProps {
    count?: number;
    variant?: 'product' | 'event' | 'order';
    className?: string;
}

export function SkeletonCardGrid({ count = 6, variant = 'product', className }: SkeletonCardGridProps) {
    return (
        <div className={cn('grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', className)}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} variant={variant} />
            ))}
        </div>
    );
}
