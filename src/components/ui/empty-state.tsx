import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
        icon?: LucideIcon;
    };
    className?: string;
    children?: ReactNode;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
    children,
}: EmptyStateProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center py-20 px-4 text-center', className)}>
            {/* Icon */}
            {Icon && (
                <div className="mb-6 w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                    <Icon className="h-10 w-10 text-yellow-400" />
                </div>
            )}

            {/* Title */}
            <h3 className="text-2xl font-black text-white mb-3">
                {title}
            </h3>

            {/* Description */}
            <p className="text-gray-300 text-base font-medium max-w-md mb-6">
                {description}
            </p>

            {/* Action Button */}
            {action && (
                <Button
                    onClick={action.onClick}
                    className="bg-yellow-400 text-black hover:bg-yellow-500 font-semibold px-8 py-3 rounded-xl shadow-lg"
                >
                    {action.icon && <action.icon className="h-5 w-5 mr-2" />}
                    {action.label}
                </Button>
            )}

            {/* Custom children */}
            {children}
        </div>
    );
}
