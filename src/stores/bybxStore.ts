import { create } from 'zustand';

interface BybxState {
  decryptedFile: { url: string; name: string } | null;
  setDecryptedFile: (file: { url: string; name: string } | null) => void;
  onFileLoaded: (url: string, name: string) => void;
}

export const useBybxStore = create<BybxState>((set) => ({
  decryptedFile: null,
  setDecryptedFile: (file) => set({ decryptedFile: file }),
  onFileLoaded: (url, name) => {
    set({ decryptedFile: { url, name } });

    const lowerName = name.toLowerCase();

    if (lowerName.endsWith('.pdf')) {
      return;
    }

    if (lowerName.endsWith('.mp3') || lowerName.endsWith('.m4a') || lowerName.endsWith('.wav')) {
      const audio = new Audio(url);
      audio.play().catch(console.error);
      alert(`Now streaming Unlocked Audio: ${name}`);
    }
  },
}));


