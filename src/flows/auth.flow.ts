import { useGlobalAuth } from '@/contexts/GlobalAuthContext';
import { toast } from 'sonner';

export const useAuthFlow = () => {
    const { login, logout, register, refreshRole, user, isAuthenticated } = useGlobalAuth();

    const handleLogout = async () => {
        try {
            await logout();
            toast.success('Logged out successfully');
        } catch (error: any) {
            toast.error('Logout failed', { description: error.message });
        }
    };

    const handleRoleSwitch = async (newRole: 'buyer' | 'seller' | 'admin') => {
        try {
            await refreshRole(newRole);
        } catch (error: any) {
            toast.error('Role switch failed', { description: error.message });
        }
    };

    return {
        user,
        isAuthenticated,
        handleLogout,
        handleRoleSwitch,
        // Add more auth-related flows here
    };
};
