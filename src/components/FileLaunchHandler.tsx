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

            let sessionToken: string;

            if (!isActivated) {
                setStatus('Activating device...');
                const response = await axios.post('/api/activation/bond', {
                    orderNumber,
                    productId,
                    fingerprint
                });
                sessionToken = (response.data as any).sessionToken;
            } else {
                setStatus('Verifying hardware lock...');
                const response = await axios.post('/api/activation/verify', {
                    orderNumber,
                    productId,
                    fingerprint
                });
                sessionToken = (response.data as any).sessionToken;
            }

            setStatus('Decrypting content into Secure Vault...');

            if (!navigator.serviceWorker.controller) {
                throw new Error('Service Worker not ready. Please refresh.');
            }

            const channel = new MessageChannel();
            navigator.serviceWorker.controller.postMessage({
                type: 'ACTIVATE_SESSION',
                sessionToken,
                orderNumber,
                productId,
                fileBuffer: buffer,
                fileName: file.name.replace('.bybx', '')
            }, [channel.port2, buffer]); // Transfer buffer ownership to SW

            channel.port1.onmessage = (event) => {
                if (event.data.success) {
                    setStatus('Content ready.');
                    onFileLoaded(event.data.virtualUrl, file.name.replace('.bybx', ''));
                } else {
                    setError(event.data.error);
                }
            };

        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || err.message);
        }
    };

    if (error) return <div className="p-4 bg-red-900/50 text-red-200 rounded border border-red-500">Error: {error}</div>;
    if (status) return <div className="p-4 bg-black/50 text-white rounded border border-white/20 animate-pulse">{status}</div>;

    return null;
};

export default FileLaunchHandler;
