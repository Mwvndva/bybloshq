import React, { createContext, useContext, useState, ReactNode } from 'react';

interface BybxContextType {
    onFileLoaded: (data: ArrayBuffer, name: string) => void;
    decryptedFile: { data: ArrayBuffer, name: string } | null;
}

const BybxContext = createContext<BybxContextType | undefined>(undefined);

export const BybxProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [decryptedFile, setDecryptedFile] = useState<{ data: ArrayBuffer, name: string } | null>(null);

    const onFileLoaded = (data: ArrayBuffer, name: string) => {
        setDecryptedFile({ data, name });
        // PoC: play audio
        const blob = new Blob([data], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
        alert(`Now playing Unlocked Audio: ${name}`);
    };

    return (
        <BybxContext.Provider value={{ onFileLoaded, decryptedFile }}>
            {children}
        </BybxContext.Provider>
    );
};

export const useBybx = () => {
    const context = useContext(BybxContext);
    if (context === undefined) {
        throw new Error('useBybx must be used within a BybxProvider');
    }
    return context;
};
