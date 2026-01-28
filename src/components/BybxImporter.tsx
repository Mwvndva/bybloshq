import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import apiClient from '@/lib/apiClient';

interface BybxImporterProps {
    onFileLoaded: (decryptedData: ArrayBuffer, fileName: string) => void;
}

const BybxImporter: React.FC<BybxImporterProps> = ({ onFileLoaded }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setStatus('Reading armored file...');
            setError(null);
            const buffer = await file.arrayBuffer();

            // Parse Header
            const header = new TextDecoder().decode(buffer.slice(0, 128));
            if (!header.startsWith('BYBX')) {
                throw new Error('Not a valid Byblos Armored file.');
            }

            const orderNumber = header.substring(6, 42).replace(/\0/g, '').trim();
            const productId = new DataView(buffer.slice(42, 46)).getInt32(0);
            const hardwareId = new Uint8Array(buffer.slice(46, 110));
            const isActivated = hardwareId.some(b => b !== 0);

            setStatus('Gathering hardware fingerprint...');
            const fingerprint = await getDeviceFingerprint();

            let decryptionKey: string;

            if (!isActivated) {
                setStatus('Activating device...');
                const response = await apiClient.post('/activation/bond', {
                    orderNumber,
                    productId,
                    fingerprint,
                });
                decryptionKey = (response.data as any).decryptionKey;
            } else {
                setStatus('Verifying hardware lock...');
                const response = await apiClient.post('/activation/verify', {
                    orderNumber,
                    productId,
                    fingerprint,
                });
                decryptionKey = (response.data as any).decryptionKey;
            }

            setStatus('Decrypting content into RAM...');
            const decrypted = await decryptRaw(buffer, decryptionKey);

            setStatus('Content ready.');
            onFileLoaded(decrypted, file.name.replace('.bybx', ''));
            setIsOpen(false);
            setStatus('');

        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || err.message);
            setStatus('');
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

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(true)}
                className="text-black hover:bg-yellow-400 rounded-full"
                title="Unlock .BYBX File"
            >
                <Shield className="h-5 w-5" />
            </Button>

            {isOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-yellow-300">
                        <div className="bg-yellow-300 p-4 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-black" />
                                <h2 className="font-serif font-bold text-lg">Byblos Vault</h2>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-black hover:opacity-70">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="p-8 text-center">
                            {!status && !error && (
                                <>
                                    <Upload className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold mb-2">Manual Unlock</h3>
                                    <p className="text-gray-600 mb-6 text-sm">
                                        Select a .BYBX file to verify your hardware and unlock the content.
                                    </p>
                                    <input
                                        type="file"
                                        accept=".bybx"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleManualUpload}
                                    />
                                    <Button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="bg-black text-yellow-300 hover:bg-zinc-800 w-full rounded-full py-6 font-bold"
                                    >
                                        Select .BYBX File
                                    </Button>
                                </>
                            )}

                            {status && (
                                <div className="py-8">
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
                                        onClick={() => setError(null)}
                                        variant="outline"
                                        className="border-black text-black hover:bg-gray-100 rounded-full px-8"
                                    >
                                        Try Again
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default BybxImporter;
