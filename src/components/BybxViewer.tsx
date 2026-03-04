import React from 'react';

interface Props {
    virtualUrl: string;
    fileName: string;
    onClose: () => void;
}

const BybxViewer: React.FC<Props> = ({ virtualUrl, fileName, onClose }) => {
    return (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col animate-in fade-in">
            <div className="flex items-center justify-between px-6 py-4 bg-[#0a0a0a] border-b border-white/10">
                <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-white text-sm font-bold tracking-widest uppercase">{fileName}</span>
                    <span className="text-white/30 text-[10px] uppercase tracking-tighter border border-white/10 px-2 py-0.5 rounded">Armored Stream</span>
                </div>
                <button
                    onClick={onClose}
                    className="group flex items-center space-x-2 text-gray-400 hover:text-white transition-colors duration-200"
                >
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Close Session</span>
                    <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center group-hover:border-white/30 group-hover:bg-white/5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                </button>
            </div>

            <div className="flex-1 relative bg-[#111]">
                {/* Overlay to prevent right-click and some interactions on the iframe container */}
                <div className="absolute inset-0 pointer-events-none z-10 border-[20px] border-black/20" />

                <iframe
                    src={virtualUrl}
                    className="w-full h-full border-none"
                    sandbox="allow-scripts allow-same-origin"
                    title="Bybx Protected Viewer"
                />
            </div>

            <div className="px-6 py-3 bg-[#0a0a0a] border-t border-white/10 flex justify-between items-center">
                <p className="text-[9px] text-white/40 uppercase tracking-[0.3em]">
                    End-to-End Encrypted &bull; Proprietary Byblos DRM &bull; No Local Cache
                </p>
                <div className="flex space-x-1">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="w-1 h-1 rounded-full bg-emerald-500/30" />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default BybxViewer;
