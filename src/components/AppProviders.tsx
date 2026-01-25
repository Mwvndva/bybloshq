import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrganizerAuthProvider } from "../contexts/OrganizerAuthContext";
import { SellerAuthProvider } from "../contexts/SellerAuthContext";
import { AdminAuthProvider } from "../contexts/AdminAuthContext";
import { BuyerAuthProvider } from "../contexts/BuyerAuthContext";
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
                <BuyerAuthProvider>
                    <WishlistProvider>
                        <OrganizerAuthProvider>
                            <SellerAuthProvider>
                                <AdminAuthProvider>
                                    {children}
                                </AdminAuthProvider>
                            </SellerAuthProvider>
                        </OrganizerAuthProvider>
                    </WishlistProvider>
                </BuyerAuthProvider>
            </TooltipProvider>
        </BybxProvider>
    </QueryClientProvider>
);
