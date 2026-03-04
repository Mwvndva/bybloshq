import React, { createContext, useContext, useState, ReactNode } from 'react';

import BybxViewer from '../components/BybxViewer';

interface BybxContextType {
    onFileLoaded: (url: string, name: string) => void;
    decryptedFile: { url: string, name: string } | null;
}

const BybxContext = createContext<BybxContextType | undefined>(undefined);

export const BybxProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [decryptedFile, setDecryptedFile] = useState<{ url: string, name: string } | null>(null);

    const onFileLoaded = (url: string, name: string) => {
        setDecryptedFile({ url, name });

        const lowerName = name.toLowerCase();

        if (lowerName.endsWith('.pdf')) {
            // PDF will be rendered by the BybxViewer component below
            return;
        }

        // Default to audio for now (or check extension)
        if (lowerName.endsWith('.mp3') || lowerName.endsWith('.m4a') || lowerName.endsWith('.wav')) {
            const audio = new Audio(url);
            audio.play().catch(console.error);
            alert(`Now streaming Unlocked Audio: ${name}`);
        }
    };

    const value = React.useMemo(() => ({ onFileLoaded, decryptedFile }), [decryptedFile]);

    return (
        <BybxContext.Provider value={value}>
            {children}
            {decryptedFile && decryptedFile.name.toLowerCase().endsWith('.pdf') && (
                <BybxViewer
                    virtualUrl={decryptedFile.url}
                    fileName={decryptedFile.name}
                    onClose={() => setDecryptedFile(null)}
                />
            )}
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
