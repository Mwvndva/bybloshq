
import React, { useEffect, useState } from 'react';
import { Shield, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import api from '@/lib/api';
import { useBybx } from '@/contexts/BybxContext';

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
            const response = await api.get(`/orders/${orderId}/download/${productId}`, {
                responseType: 'arraybuffer'
            });

            const buffer = response.data as ArrayBuffer;

            setStatus('Verifying cryptographic signature...');

            // Parse Header
            const header = new TextDecoder().decode(buffer.slice(0, 128));
            if (!header.startsWith('BYBX')) {
                throw new Error('Invalid file format received from server.');
            }

            const headerOrderNumber = header.substring(6, 42).trim();
            // productId in header might be 0 or incorrect if my previous assumption was wrong, 
            // but we have productId from props.

            const hardwareId = new Uint8Array(buffer.slice(46, 110));
            const isActivated = hardwareId.some(b => b !== 0);

            setStatus('Gathering hardware fingerprint...');
            const fingerprint = await getDeviceFingerprint();

            let decryptionKey: string;

            if (!isActivated) {
                setStatus('Activating independent license...');
                const authResponse = await api.post('/activation/bond', {
                    orderNumber: headerOrderNumber, // Use extracted order number to be safe
                    productId: parseInt(productId), // ensure number
                    fingerprint,
                });
                decryptionKey = (authResponse.data as any).decryptionKey;
            } else {
                setStatus('Verifying hardware lock...');
                const authResponse = await api.post('/activation/verify', {
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-yellow-300">
                <div className="bg-yellow-300 p-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-black" />
                        <h2 className="font-serif font-bold text-lg">Secure View</h2>
                    </div>
                    <button onClick={onClose} className="text-black hover:opacity-70">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-8 text-center">
                    {status && !error && (
                        <div className="py-4">
                            <div className="relative w-16 h-16 mx-auto mb-6">
                                <div className="absolute inset-0 border-4 border-yellow-200 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-black rounded-full border-t-transparent animate-spin"></div>
                            </div>
                            <p className="text-lg font-bold text-black animate-pulse">{status}</p>
                        </div>
                    )}

                    {error && (
                        <div className="py-4">
                            <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 mb-6 text-sm">
                                {error}
                            </div>
                            <Button
                                onClick={() => loadFile()}
                                variant="outline"
                                className="border-black text-black hover:bg-gray-100 rounded-full px-8"
                            >
                                Try Again
                            </Button>
                        </div>
                    )}

                    {decryptedData && (
                        <div className="py-4 space-y-4">
                            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                <Shield className="h-8 w-8 text-green-600" />
                            </div>
                            <h3 className="text-xl font-bold">Successfully Unlocked</h3>
                            <p className="text-gray-600 text-sm">
                                Your secure file is ready.
                            </p>

                            <div className="flex flex-col gap-3">
                                <Button
                                    onClick={() => {
                                        // This click is a trusted event, so window.open works
                                        onFileLoaded(decryptedData.buffer, decryptedData.name);
                                        onClose();
                                    }}
                                    className="bg-black text-yellow-300 hover:bg-zinc-800 w-full rounded-full py-4 font-bold"
                                >
                                    Open Now
                                </Button>

                                <Button
                                    onClick={() => {
                                        // Create a download link for saving
                                        const blob = new Blob([decryptedData.buffer], { type: 'application/pdf' }); // Assuming PDF for now or check ext
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = decryptedData.name; // Save with original name
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                        onClose();
                                    }}
                                    variant="outline"
                                    className="border-black text-black w-full rounded-full"
                                >
                                    Save to Device
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DirectBybxViewer;
