
import React, { useRef, useEffect, useState } from 'react';
import { processCheckIn, getEventConfig } from '../server/api';
import { BadgePrintLayout } from './BadgePrintLayout';
import { EventConfig } from '../types';

interface KioskViewProps {
    adminToken: string;
    onExit: () => void;
}

export const KioskView: React.FC<KioskViewProps> = ({ adminToken, onExit }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState<'scanning' | 'processing' | 'success' | 'error'>('scanning');
    const [scannedUser, setScannedUser] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [config, setConfig] = useState<EventConfig | null>(null);
    
    // Improved Kiosk States
    const [mode, setMode] = useState<'scan' | 'manual'>('scan');
    const [manualInput, setManualInput] = useState('');
    const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
    const [activeCameraId, setActiveCameraId] = useState<string>('');
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Audio Context for Beeps
    const playSuccessSound = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            // Pleasant chime
            osc.type = 'sine';
            osc.frequency.setValueAtTime(500, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
            
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) {
            // Ignore if audio context fails
        }
    };

    const playErrorSound = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.2);
            
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        } catch (e) {
            // Ignore
        }
    };

    // Load config
    useEffect(() => {
        getEventConfig().then(setConfig).catch(console.error);
        
        // Check for cameras
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            navigator.mediaDevices.enumerateDevices().then(devices => {
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                setCameras(videoDevices);
                if (videoDevices.length > 0) {
                    // Prefer back camera if available
                    const backCam = videoDevices.find(d => d.label.toLowerCase().includes('back')) || videoDevices[videoDevices.length - 1];
                    setActiveCameraId(backCam.deviceId);
                }
            });
        }
        
        // Listen for fullscreen change
        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    // Auto-Print Logic
    useEffect(() => {
        if (status === 'success' && scannedUser && config?.printConfig?.autoPrintOnKiosk) {
            const timer = setTimeout(() => {
                window.print();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [status, scannedUser, config]);

    // Scanner Logic
    useEffect(() => {
        let stream: MediaStream | null = null;
        let animationFrameId: number;

        const startCamera = async () => {
            if (status !== 'scanning' || mode !== 'scan') return;

            // Browser Support Check
            if (!('BarcodeDetector' in window)) {
                console.warn("BarcodeDetector API not supported. Defaulting to manual entry.");
                setMode('manual');
                return;
            }

            try {
                const constraints = activeCameraId ? { video: { deviceId: { exact: activeCameraId } } } : { video: { facingMode: 'environment' } };
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                    
                    const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
                    
                    const detect = async () => {
                        if (status !== 'scanning' || mode !== 'scan' || !videoRef.current) return;
                        
                        try {
                            const barcodes = await barcodeDetector.detect(videoRef.current);
                            if (barcodes.length > 0) {
                                handleCheckInAttempt(barcodes[0].rawValue);
                            } else {
                                animationFrameId = requestAnimationFrame(detect);
                            }
                        } catch (e) {
                            // Detection failed (frame empty, etc), retry
                            animationFrameId = requestAnimationFrame(detect);
                        }
                    };
                    detect();
                }
            } catch (err) {
                console.error("Camera error", err);
                // Fail gracefully to manual mode if camera denied/missing
                setMode('manual');
            }
        };

        startCamera();

        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
            cancelAnimationFrame(animationFrameId);
        };
    }, [status, mode, activeCameraId]);

    const handleCheckInAttempt = async (identifier: string) => {
        setStatus('processing');
        try {
            const result = await processCheckIn(adminToken, identifier);
            if (result.success) {
                setScannedUser(result.user);
                setStatus('success');
                setManualInput(''); // Clear input
                playSuccessSound();
                
                // Auto reset
                setTimeout(() => {
                    setScannedUser(null);
                    setStatus('scanning');
                }, 5000);
            } else {
                setErrorMsg(result.message);
                setStatus('error');
                playErrorSound();
                setTimeout(() => {
                    setErrorMsg(null);
                    setStatus('scanning');
                }, 3000);
            }
        } catch (e) {
            setErrorMsg("Network error or invalid token.");
            setStatus('error');
            playErrorSound();
            setTimeout(() => {
                setErrorMsg(null);
                setStatus('scanning');
            }, 3000);
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualInput.trim()) return;
        handleCheckInAttempt(manualInput.trim());
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.error("Fullscreen error:", err));
        } else {
            document.exitFullscreen();
        }
    };

    const cycleCamera = () => {
        if (cameras.length < 2) return;
        const currentIndex = cameras.findIndex(c => c.deviceId === activeCameraId);
        const nextIndex = (currentIndex + 1) % cameras.length;
        setActiveCameraId(cameras[nextIndex].deviceId);
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center relative overflow-hidden font-sans text-gray-100">
            {/* Hidden Print Layout */}
            {config && scannedUser && (
                <BadgePrintLayout user={scannedUser} config={config} />
            )}

            {/* Top Bar */}
            <div className="absolute top-0 w-full p-6 flex justify-between items-center z-30 bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center gap-3">
                    {config?.theme.logoUrl && <img src={config.theme.logoUrl} className="h-10 w-10 bg-white rounded-full p-1" alt="Logo" />}
                    <div>
                        <h1 className="text-xl font-bold tracking-wider text-white">{config?.event.name || 'Event'}</h1>
                        <p className="text-gray-300 text-xs uppercase tracking-widest font-semibold">Self Check-in Kiosk</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={toggleFullscreen}
                        className="text-gray-400 hover:text-white transition-colors p-2"
                        title="Toggle Fullscreen"
                    >
                        {isFullscreen ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9.553 4.553A1 1 0 009 3.618C9 3.618 9.553 4.553 15 7z" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                        )}
                    </button>
                    <button 
                        onClick={onExit}
                        className="text-gray-400 hover:text-red-400 transition-colors p-2"
                        title="Exit Kiosk"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* Main Stage */}
            <div className="w-full max-w-3xl px-6 relative z-10 flex flex-col items-center">
                
                {/* 1. Scanning State */}
                {status === 'scanning' && mode === 'scan' && (
                    <div className="relative w-full aspect-[4/3] max-h-[60vh] bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-gray-800">
                        <video 
                            ref={videoRef} 
                            className="w-full h-full object-cover" 
                            playsInline 
                            muted
                        />
                        {/* Overlay Frame */}
                        <div className="absolute inset-0 border-[60px] border-black/60 pointer-events-none flex flex-col items-center justify-center">
                            <div className="w-64 h-64 border-4 border-white/50 rounded-2xl relative shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                                {/* Corners */}
                                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg"></div>
                                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg"></div>
                                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg"></div>
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg"></div>
                                
                                {/* Scan Line Animation */}
                                <div className="absolute left-0 right-0 h-0.5 bg-red-500/80 shadow-[0_0_10px_red] animate-scan-y top-1/2"></div>
                            </div>
                            <p className="text-white mt-8 text-lg font-medium drop-shadow-md tracking-wide">
                                Scan your QR Code
                            </p>
                        </div>
                        
                        {/* Camera Switcher */}
                        {cameras.length > 1 && (
                            <button 
                                onClick={cycleCamera}
                                className="absolute bottom-4 right-4 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 backdrop-blur-sm z-40"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </button>
                        )}
                    </div>
                )}

                {/* 2. Manual Entry State */}
                {status === 'scanning' && mode === 'manual' && (
                    <div className="w-full max-w-lg bg-white dark:bg-gray-800 p-10 rounded-3xl shadow-2xl text-center border border-gray-700">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Manual Check-in</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 text-lg">Enter the Ticket ID or Email Address.</p>
                        
                        <form onSubmit={handleManualSubmit} className="space-y-6">
                            <input 
                                type="text" 
                                value={manualInput}
                                onChange={(e) => setManualInput(e.target.value)}
                                placeholder="e.g. ticket_123 or name@email.com"
                                className="w-full px-6 py-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-xl focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder-gray-400"
                                autoFocus
                            />
                            <div className="flex gap-4">
                                <button 
                                    type="button"
                                    onClick={() => setMode('scan')}
                                    className="flex-1 py-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl font-bold text-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={!manualInput.trim()}
                                    className="flex-1 py-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-lg shadow-lg transform transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Check In
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* 3. Processing State */}
                {status === 'processing' && (
                    <div className="bg-gray-800/90 backdrop-blur-md p-12 rounded-3xl flex flex-col items-center justify-center shadow-2xl border border-gray-700 w-full max-w-md">
                        <div className="w-20 h-20 border-8 border-primary border-t-transparent rounded-full animate-spin mb-8"></div>
                        <p className="text-white text-2xl font-medium tracking-wide">Verifying...</p>
                    </div>
                )}

                {/* 4. Success State */}
                {status === 'success' && scannedUser && (
                    <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up border-4 border-green-500">
                        <div className="bg-green-500 p-8 flex flex-col items-center text-white">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4 shadow-lg animate-bounce">
                                <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7"/></svg>
                            </div>
                            <h2 className="text-4xl font-bold">You're Checked In!</h2>
                        </div>
                        <div className="p-10 text-center">
                            <h3 className="text-5xl font-extrabold text-gray-900 dark:text-white mb-3">{scannedUser.name}</h3>
                            <p className="text-2xl text-gray-500 dark:text-gray-300 font-medium">{scannedUser.company || scannedUser.role || 'Delegate'}</p>
                            
                            <div className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-3">
                                {config?.printConfig?.autoPrintOnKiosk ? (
                                    <div className="flex items-center justify-center gap-3 text-primary animate-pulse font-bold text-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                        <span>Printing Badge...</span>
                                    </div>
                                ) : (
                                    <p className="text-lg text-gray-400">Please proceed to the event hall.</p>
                                )}
                            </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 p-2">
                            <div className="h-2 bg-green-500 w-full animate-shrink-width origin-left"></div>
                        </div>
                    </div>
                )}

                {/* 5. Error State */}
                {status === 'error' && (
                    <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-10 text-center border-4 border-red-500 animate-shake">
                        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 dark:text-red-500">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Check-in Failed</h2>
                        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">{errorMsg || "Invalid Ticket"}</p>
                        
                        <button 
                            onClick={() => { setStatus('scanning'); setErrorMsg(null); }}
                            className="px-10 py-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-xl font-bold text-gray-800 dark:text-white transition-colors text-lg"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Mode Switcher (Scan vs Manual) */}
                {status === 'scanning' && (
                    <div className="mt-12 flex gap-6">
                        <button
                            onClick={() => setMode('scan')}
                            className={`px-8 py-4 rounded-full font-bold transition-all shadow-xl flex items-center gap-3 text-lg ${mode === 'scan' ? 'bg-primary text-white scale-105 ring-4 ring-primary/30' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6.5 6.5v-1m-6.5-5.5h-1M4 12V4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z" /></svg>
                            Scan QR
                        </button>
                        <button
                            onClick={() => setMode('manual')}
                            className={`px-8 py-4 rounded-full font-bold transition-all shadow-xl flex items-center gap-3 text-lg ${mode === 'manual' ? 'bg-primary text-white scale-105 ring-4 ring-primary/30' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Manual Entry
                        </button>
                    </div>
                )}
            </div>
            
            {/* Background Effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[100px]"></div>
            </div>
            
            {/* Styles for animations */}
            <style>{`
                @keyframes scan-y {
                    0% { top: 10%; opacity: 0.5; }
                    50% { top: 90%; opacity: 1; }
                    100% { top: 10%; opacity: 0.5; }
                }
                .animate-scan-y {
                    animation: scan-y 3s infinite ease-in-out;
                }
                @keyframes shrink-width {
                    from { width: 100%; }
                    to { width: 0%; }
                }
                .animate-shrink-width {
                    animation: shrink-width 5s linear forwards;
                }
                .animate-shake {
                    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
                }
                @keyframes shake {
                    10%, 90% { transform: translate3d(-1px, 0, 0); }
                    20%, 80% { transform: translate3d(2px, 0, 0); }
                    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                    40%, 60% { transform: translate3d(4px, 0, 0); }
                }
            `}</style>
        </div>
    );
};
