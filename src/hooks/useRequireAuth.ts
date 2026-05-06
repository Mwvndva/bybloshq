import { useGlobalAuth } from '@/contexts/GlobalAuthContext';
import { useModals } from '@/contexts/ModalContext';
import { useToast } from '@/components/ui/use-toast';

export const useRequireAuth = () => {
    const { isAuthenticated, isGuest, pendingActionRef, executePendingAction } = useGlobalAuth();
    const { openRegistrationModal } = useModals();
    const { toast } = useToast();

    const requireAuth = (action: () => void | Promise<void>, message?: string) => {
        if (!isAuthenticated || isGuest) {
            toast({
                title: "Security Gate",
                description: message || "Please provide your details to proceed.",
            });

            pendingActionRef.current = action;
            openRegistrationModal(async () => {
                await executePendingAction();
            });
            return false;
        }

        // Already authenticated
        action();
        return true;
    };

    return { requireAuth };
};
