import React, { useEffect, useState } from 'react';
import { Shield, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import apiClient from '@/lib/apiClient';
import { useBybx } from '@/contexts/BybxContext';
import { createPortal } from 'react-dom';

interface DirectBybxViewerProps {
    orderId: string;
    productId: string;
    fileName: string;
    isOpen: boolean;
    onClose: () => void;
}

const DirectBybxViewer: React.FC<DirectBybxViewerProps> = ({ orderId, productId, fileName, isOpen, onClose }) => {
    const [status, setStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [decryptedData, setDecryptedData] = useState<{ buffer: ArrayBuffer, name: string } | null>(null);
    const { onFileLoaded } = useBybx();

    useEffect(() => {
        if (isOpen) {
            loadFile();
        }
    }, [isOpen]);

    const loadFile = async () => {
        try {
            setStatus('Securely fetching digital asset...');
            setError(null);

            // Fetch file as blob/arraybuffer directly
            const response = await apiClient.get(`/orders/${orderId}/download/${productId}`, {
                responseType: 'arraybuffer'
            });

            const buffer = response.data as ArrayBuffer;

            setStatus('Verifying cryptographic signature...');

            // Parse Header
            const header = new TextDecoder().decode(buffer.slice(0, 128));
            if (!header.startsWith('BYBX')) {
                throw new Error('Invalid file format received from server.');
            }

            const headerOrderNumber = header.substring(6, 42).replace(/\0/g, '').trim();
            // productId in header might be 0 or incorrect if my previous assumption was wrong, 
            // but we have productId from props.

            const hardwareId = new Uint8Array(buffer.slice(46, 110));
            const isActivated = hardwareId.some(b => b !== 0);

            setStatus('Gathering hardware fingerprint...');
            const fingerprint = await getDeviceFingerprint();

            let decryptionKey: string;

            if (!isActivated) {
                setStatus('Activating independent license...');
                const authResponse = await apiClient.post('/activation/bond', {
                    orderNumber: headerOrderNumber, // Use extracted order number to be safe
                    productId: parseInt(productId), // ensure number
                    fingerprint,
                });
                decryptionKey = (authResponse.data as any).decryptionKey;
            } else {
                setStatus('Verifying hardware lock...');
                const authResponse = await apiClient.post('/activation/verify', {
                    orderNumber: headerOrderNumber,
                    productId: parseInt(productId),
                    fingerprint,
                });
                decryptionKey = (authResponse.data as any).decryptionKey;
            }

            setStatus('Decrypting content in secure memory...');
            const decrypted = await decryptRaw(buffer, decryptionKey);

            setStatus('Content ready.');

            // Don't auto-open here to avoid popup blockers.
            // Instead, we pass the data to a state for the user to click.
            setDecryptedData({ buffer: decrypted, name: fileName });
            setStatus(''); // Clear status to show the ready UI

        } catch (err: any) {
            console.error(err);
            const msg = err.response?.data?.message || err.message || "Failed to load secure file";
            if (msg.includes('403') || msg.includes('license')) {
                setError("License verification failed. You may be trying to open this on a different device than originally activated.");
            } else {
                setError(msg);
            }
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

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden relative border border-gray-100">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors z-10"
                >
                    <X className="h-4 w-4 text-gray-300" />
                </button>

                <div className="p-8 pt-10 text-center">

                    {/* Header Icon */}
                    <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                        {decryptedData ? (
                            <Shield className="h-8 w-8 text-green-500" />
                        ) : error ? (
                            <X className="h-8 w-8 text-red-500" />
                        ) : (
                            <Download className="h-8 w-8 text-black animate-pulse" />
                        )}
                    </div>

                    {/* Title */}
                    <h2 className="font-bold text-2xl mb-2 text-black">
                        {decryptedData ? 'Ready to View' : error ? 'Download Failed' : 'Downloading'}
                    </h2>

                    {/* Status / Error Message */}
                    {!decryptedData && !error && (
                        <div className="space-y-6">
                            <p className="text-gray-300 font-medium text-sm">{status || 'Starting...'}</p>
                            {/* Simple Progress Bar */}
                            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-black rounded-full w-1/3 animate-[shimmer_1.5s_infinite] relative">
                                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 space-y-6">
                            <p className="text-red-500 text-sm bg-red-50 p-4 rounded-xl border border-red-100">
                                {error}
                            </p>
                            <Button
                                onClick={() => loadFile()}
                                className="w-full bg-black text-white hover:bg-gray-900 rounded-xl py-6 font-bold shadow-lg shadow-gray-200"
                            >
                                Try Again
                            </Button>
                        </div>
                    )}

                    {decryptedData && (
                        <div className="mt-2 space-y-4">
                            <p className="text-gray-300 text-sm mb-8">
                                Your file has been unlocked and is ready.
                            </p>

                            <div className="flex flex-col gap-3">
                                <Button
                                    onClick={() => {
                                        onFileLoaded(decryptedData.buffer, decryptedData.name);
                                        onClose();
                                    }}
                                    className="bg-black text-white hover:bg-gray-900 w-full rounded-xl py-6 font-bold shadow-lg shadow-gray-200"
                                >
                                    Open Now
                                </Button>

                                <Button
                                    onClick={() => {
                                        const blob = new Blob([decryptedData.buffer], { type: 'application/pdf' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = decryptedData.name;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                        onClose();
                                    }}
                                    variant="outline"
                                    className="border-gray-200 text-gray-700 hover:text-black hover:bg-gray-50 w-full rounded-xl py-6 font-semibold"
                                >
                                    Save to Device
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default DirectBybxViewer;
