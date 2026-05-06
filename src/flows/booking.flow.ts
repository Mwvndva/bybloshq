import { useState } from 'react';

export const useBookingFlow = () => {
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [bookingData, setBookingData] = useState<any>(null);

    const openBookingModal = () => setIsBookingModalOpen(true);
    const closeBookingModal = () => setIsBookingModalOpen(false);

    const handleBookingConfirm = (data: any) => {
        setBookingData(data);
        setIsBookingModalOpen(false);
        return data;
    };

    return {
        isBookingModalOpen,
        bookingData,
        openBookingModal,
        closeBookingModal,
        handleBookingConfirm,
    };
};
