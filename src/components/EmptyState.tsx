import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction
}) => {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
            {Icon && (
                <div className="bg-muted p-4 rounded-full mb-4">
                    <Icon className="h-8 w-8 text-muted-foreground" />
                </div>
            )}
            <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
            {actionLabel && onAction && (
                <Button onClick={onAction} variant="default">
                    {actionLabel}
                </Button>
            )}
        </div>
    );
};
