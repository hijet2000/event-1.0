import React, { useRef, useEffect, useState } from 'react';
import { processCheckIn } from '../server/api';
import { Alert } from './Alert';
import { Spinner } from './Spinner';

interface KioskViewProps {
    adminToken: string;
    onExit: () => void;
}

export const KioskView: React.FC<KioskViewProps> = ({ adminToken, onExit }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState<'scanning' | 'processing' | 'success' | 'error'>('scanning');
    const [scannedUser, setScannedUser] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    
    // Scanner Logic
    useEffect(() => {
        let stream: MediaStream | null = null;
        let animationFrameId: number;

        const startCamera = async () => {
            if (status !== 'scanning') return;

            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                    
                    const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
                    
                    const detect = async () => {
                        if (status !== 'scanning' || !videoRef.current) return;
                        
                        try {
                            const barcodes = await barcodeDetector.detect(videoRef.current);
                            if (barcodes.length > 0) {
                                handleScan(barcodes[0].rawValue);
                            } else {
                                animationFrameId = requestAnimationFrame(detect);
                            }
                        } catch (e) {
                            animationFrameId = requestAnimationFrame(detect);
                        }
                    };
                    detect();
                }
            } catch (err) {
                console.error("Camera error", err);
                setErrorMsg("Camera access denied or unavailable.");
                setStatus('error');
            }
        };

        if (status === 'scanning') {
            startCamera();
        }

        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
            cancelAnimationFrame(animationFrameId);
        };
    }, [status]);

    const handleScan = async (qrData: string) => {
        setStatus('processing');
        try {
            const result = await processCheckIn(adminToken, qrData);
            if (result.success) {
                setScannedUser(result.user);
                setStatus('success');
                // Auto reset after success
                setTimeout(() => {
                    setScannedUser(null);
                    setStatus('scanning');
                }, 4000);
            } else {
                setErrorMsg(result.message);
                setStatus('error');
                // Auto reset after error
                setTimeout(() => {
                    setErrorMsg(null);
                    setStatus('scanning');
                }, 3000);
            }
        } catch (e) {
            setErrorMsg("Network error.");
            setStatus('error');
            setTimeout(() => {
                setErrorMsg(null);
                setStatus('scanning');
            }, 3000);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Header */}
            <div className="absolute top-0 w-full p-6 flex justify-between items-center z-20">
                <div className="text-white">
                    <h1 className="text-2xl font-bold tracking-wider">SELF CHECK-IN</h1>
                    <p className="text-gray-400 text-sm">Event Kiosk Mode</p>
                </div>
                <button 
                    onClick={onExit}
                    className="text-gray-600 hover:text-white transition-colors"
                    title="Exit Kiosk"
                >
                    &times;
                </button>
            </div>

            {/* Main Content */}
            <div className="w-full max-w-2xl px-6 relative z-10">
                
                {status === 'scanning' && (
                    <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-800">
                        <video 
                            ref={videoRef} 
                            className="w-full h-full object-cover" 
                            playsInline 
                            muted
                        />
                        {/* Overlay Frame */}
                        <div className="absolute inset-0 border-[60px] border-black/60 pointer-events-none">
                            <div className="w-full h-full border-4 border-white/30 rounded-lg relative">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary"></div>
                            </div>
                        </div>
                        <div className="absolute bottom-8 w-full text-center">
                            <p className="text-white text-lg font-medium drop-shadow-md bg-black/50 inline-block px-4 py-2 rounded-full">
                                Scan your QR Code to check in
                            </p>
                        </div>
                    </div>
                )}

                {status === 'processing' && (
                    <div className="aspect-video bg-gray-800 rounded-2xl flex flex-col items-center justify-center shadow-2xl border-4 border-gray-700">
                        <Spinner />
                        <p className="text-white mt-4 text-xl">Verifying...</p>
                    </div>
                )}

                {status === 'success' && scannedUser && (
                    <div className="aspect-video bg-green-600 rounded-2xl flex flex-col items-center justify-center shadow-2xl animate-fade-in-up text-white text-center p-8">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-lg">
                            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                        </div>
                        <h2 className="text-4xl font-bold mb-2">Welcome, {scannedUser.name}!</h2>
                        <p className="text-xl opacity-90">{scannedUser.company || scannedUser.role}</p>
                        <div className="mt-8 flex items-center gap-3 bg-green-700/50 px-6 py-3 rounded-full">
                            <div className="animate-bounce">🖨️</div>
                            <span className="font-mono text-sm uppercase tracking-widest">Printing Badge...</span>
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div className="aspect-video bg-red-600 rounded-2xl flex flex-col items-center justify-center shadow-2xl animate-shake text-white text-center p-8">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-lg">
                            <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                        </div>
                        <h2 className="text-3xl font-bold mb-2">Check-in Failed</h2>
                        <p className="text-xl opacity-90">{errorMsg || "Invalid Ticket"}</p>
                        <p className="mt-6 text-sm opacity-75">Please see the registration desk for assistance.</p>
                    </div>
                )}

            </div>
            
            {/* Background pattern */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                <div className="absolute top-0 left-0 w-96 h-96 bg-primary rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
            </div>
        </div>
    );
};