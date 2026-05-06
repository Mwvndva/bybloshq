import React, { createContext, useContext, useState, ReactNode } from 'react';
import { BuyerInfoModal } from '@/components/BuyerInfoModal';

interface ModalContextType {
    openRegistrationModal: (onSuccess?: (buyer: any) => void) => void;
    closeRegistrationModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
    const [onSuccessCallback, setOnSuccessCallback] = useState<((buyer: any) => void) | undefined>();

    const openRegistrationModal = (onSuccess?: (buyer: any) => void) => {
        setOnSuccessCallback(() => onSuccess);
        setIsRegistrationModalOpen(true);
    };

    const closeRegistrationModal = () => {
        setIsRegistrationModalOpen(false);
        setOnSuccessCallback(undefined);
    };

    const handleSuccess = (buyer: any) => {
        if (onSuccessCallback) {
            onSuccessCallback(buyer);
        }
        closeRegistrationModal();
    };

    return (
        <ModalContext.Provider value={{ openRegistrationModal, closeRegistrationModal }}>
            {children}
            <BuyerInfoModal
                isOpen={isRegistrationModalOpen}
                onClose={closeRegistrationModal}
                onSuccess={handleSuccess}
            />
        </ModalContext.Provider>
    );
};

export const useModals = () => {
    const context = useContext(ModalContext);
    if (context === undefined) {
        throw new Error('useModals must be used within a ModalProvider');
    }
    return context;
};
