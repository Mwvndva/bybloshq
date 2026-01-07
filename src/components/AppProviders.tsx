import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrganizerAuthProvider } from "../contexts/OrganizerAuthContext";
import { AdminAuthProvider } from "../contexts/AdminAuthContext";
import { BuyerAuthProvider } from "../contexts/BuyerAuthContext";
import { WishlistProvider } from "../contexts/WishlistContext";

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
            <Toaster />
            <BuyerAuthProvider>
                <WishlistProvider>
                    <OrganizerAuthProvider>
                        <AdminAuthProvider>
                            {children}
                        </AdminAuthProvider>
                    </OrganizerAuthProvider>
                </WishlistProvider>
            </BuyerAuthProvider>
        </TooltipProvider>
    </QueryClientProvider>
);
