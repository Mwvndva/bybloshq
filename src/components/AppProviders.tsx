import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GlobalAuthProvider } from "../contexts/GlobalAuthContext";
import { WishlistProvider } from "../contexts/WishlistContext";
import { BybxProvider } from "../contexts/BybxContext";

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
        <BybxProvider>
            <TooltipProvider>
                <Toaster />
                {/* Unified auth provider - provides all role-specific hooks */}
                <GlobalAuthProvider>
                    <WishlistProvider>
                        {children}
                    </WishlistProvider>
                </GlobalAuthProvider>
            </TooltipProvider>
        </BybxProvider>
    </QueryClientProvider>
);
