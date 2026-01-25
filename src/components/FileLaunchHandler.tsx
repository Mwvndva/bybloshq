import React, { useEffect, useState } from 'react';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import axios from 'axios';

interface FileLaunchHandlerProps {
    onFileLoaded: (decryptedData: ArrayBuffer, fileName: string) => void;
}

const FileLaunchHandler: React.FC<FileLaunchHandlerProps> = ({ onFileLoaded }) => {
    const [status, setStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if ('launchQueue' in window) {
            (window as any).launchQueue.setConsumer(async (launchParams: any) => {
                if (launchParams.files.length > 0) {
                    const fileHandle = launchParams.files[0];
                    await handleFile(fileHandle);
                }
            });
        }
    }, []);

    const handleFile = async (fileHandle: FileSystemFileHandle) => {
        try {
            setStatus('Opening armored file...');
            const file = await fileHandle.getFile();
            const buffer = await file.arrayBuffer();

            // Parse Header
            const header = new TextDecoder().decode(buffer.slice(0, 128));
            if (!header.startsWith('BYBX')) {
                throw new Error('Not a valid Byblos Armored file.');
            }

            const orderNumber = header.substring(6, 42).trim();
            const productId = new DataView(buffer.slice(42, 46)).getInt32(0);
            const hardwareId = new Uint8Array(buffer.slice(46, 110));
            const isActivated = hardwareId.some(b => b !== 0);

            setStatus('Gathering hardware fingerprint...');
            const fingerprint = await getDeviceFingerprint();

            let decryptionKey: string;

            if (!isActivated) {
                setStatus('Activating device...');
                // First time activation
                // We need to know which product this is. Usually the header would have productId too.
                // Let's assume for PoC we can get it from metadata or order.
                // Actually, my header creation only put orderNumber. 
                // I should have put productId too. Let's fix encryptor later if needed.
                // For now, let's assume one digital product per order or we find it.

                // Wait, I used order_number in Header. Let's use it to fetch key.
                const response = await axios.post('/api/activation/bond', {
                    orderNumber,
                    // productId: we'd need this in header ideally. 
                    // For PoC I'll search by orderNumber.
                    productId, // Placeholder: extract from header in real app
                    fingerprint
                });

                decryptionKey = (response.data as any).decryptionKey;
            } else {
                setStatus('Verifying hardware lock...');
                const response = await axios.post('/api/activation/verify', {
                    orderNumber,
                    productId, // Placeholder
                    fingerprint
                });
                decryptionKey = (response.data as any).decryptionKey;
            }

            setStatus('Decrypting content into RAM...');
            const decrypted = await decryptRaw(buffer, decryptionKey);

            setStatus('Content ready.');
            onFileLoaded(decrypted, file.name.replace('.bybx', ''));

        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || err.message);
        }
    };

    const decryptRaw = async (buffer: ArrayBuffer, masterKey: string) => {
        const iv = buffer.slice(128, 140);
        const tag = buffer.slice(140, 156);
        const encrypted = buffer.slice(156);

        const dataWithTag = new Uint8Array(encrypted.byteLength + tag.byteLength);
        dataWithTag.set(new Uint8Array(encrypted), 0);
        dataWithTag.set(new Uint8Array(tag), encrypted.byteLength);

        const key = await crypto.subtle.importKey(
            'raw',
            hexToBytes(masterKey),
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );

        return await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(iv) },
            key,
            dataWithTag
        );
    };

    const hexToBytes = (hex: string) => {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        return bytes;
    };

    if (error) return <div className="p-4 bg-red-900/50 text-red-200 rounded border border-red-500">Error: {error}</div>;
    if (status) return <div className="p-4 bg-black/50 text-white rounded border border-white/20 animate-pulse">{status}</div>;

    return null;
};

export default FileLaunchHandler;
