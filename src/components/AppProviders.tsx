import React from 'react';
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GlobalAuthProvider } from "@/features/auth/contexts";


const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

export const AppProviders = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <SonnerToaster />
            {/* Unified auth provider - provides all role-specific hooks */}
            <GlobalAuthProvider>
                {children}
            </GlobalAuthProvider>
        </TooltipProvider>
    </QueryClientProvider>
);


