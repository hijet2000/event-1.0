
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { processCheckIn, getEventConfig } from '../server/api';
import { BadgePrintLayout } from './BadgePrintLayout';
import { EventConfig } from '../types';

interface KioskViewProps {
    adminToken: string;
    eventId: string;
    onExit: () => void;
}

export const KioskView: React.FC<KioskViewProps> = ({ adminToken, eventId, onExit }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState<'scanning' | 'processing' | 'success' | 'error'>('scanning');
    const [scannedUser, setScannedUser] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [config, setConfig] = useState<EventConfig | null>(null);
    const [mode, setMode] = useState<'scan' | 'manual'>('scan');
    const [manualInput, setManualInput] = useState('');
    const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
    const [activeCameraId, setActiveCameraId] = useState<string>('');
    const [isFullscreen, setIsFullscreen] = useState(false);

    const lastScannedCode = useRef<string | null>(null);
    const processingRef = useRef(false);

    const playBeep = (type: 'success' | 'error') => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = type === 'success' ? 'sine' : 'sawtooth';
            osc.frequency.setValueAtTime(type === 'success' ? 800 : 200, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        } catch (e) {}
    };

    useEffect(() => {
        getEventConfig(eventId).then(setConfig).catch(console.error);
        
        if (navigator.mediaDevices?.enumerateDevices) {
            navigator.mediaDevices.enumerateDevices().then(devices => {
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                setCameras(videoDevices);
                if (videoDevices.length > 0 && !activeCameraId) {
                    // Default to back camera if available
                    const backCamera = videoDevices.find(d => d.label.toLowerCase().includes('back'));
                    setActiveCameraId(backCamera?.deviceId || videoDevices[0].deviceId);
                }
            });
        }
        
        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, [eventId]);

    useEffect(() => {
        if (status === 'success' && scannedUser && config?.printConfig?.autoPrintOnKiosk) {
            const timer = setTimeout(() => window.print(), 1000);
            return () => clearTimeout(timer);
        }
    }, [status, scannedUser, config]);

    const handleCheckInAttempt = useCallback(async (identifier: string) => {
        if (processingRef.current || (lastScannedCode.current === identifier && status === 'success')) return;
        
        processingRef.current = true;
        lastScannedCode.current = identifier;
        setStatus('processing');
        setErrorMsg(null);
        
        try {
            const result = await processCheckIn(adminToken, identifier, eventId);
            if (result.success) {
                setScannedUser(result.user);
                setStatus('success');
                setManualInput('');
                playBeep('success');
                setTimeout(() => {
                    setScannedUser(null);
                    setStatus('scanning');
                    processingRef.current = false;
                    lastScannedCode.current = null;
                }, 4000);
            } else {
                setErrorMsg(result.message);
                setStatus('error');
                playBeep('error');
                setTimeout(() => {
                    setStatus('scanning');
                    processingRef.current = false;
                    lastScannedCode.current = null;
                }, 3000);
            }
        } catch (e) {
            setErrorMsg("Check-in failed. Try again.");
            setStatus('error');
            playBeep('error');
            setTimeout(() => {
                setStatus('scanning');
                processingRef.current = false;
                lastScannedCode.current = null;
            }, 3000);
        }
    }, [adminToken, status, eventId]);

    useEffect(() => {
        let stream: MediaStream | null = null;
        let animationFrameId: number;

        const startCamera = async () => {
            if (mode !== 'scan') return;
            
            // Check if environment supports scanning
            if (!('BarcodeDetector' in window)) {
                console.warn("BarcodeDetector not supported, switching to manual mode.");
                setMode('manual');
                return;
            }

            try {
                const constraints = activeCameraId ? 
                    { video: { deviceId: { exact: activeCameraId } } } : 
                    { video: { facingMode: 'environment' } };
                    
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                    
                    const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
                    
                    const detect = async () => {
                        if (mode !== 'scan' || !videoRef.current) return;
                        
                        if (status === 'scanning' && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                            try {
                                const barcodes = await detector.detect(videoRef.current);
                                if (barcodes.length > 0) {
                                    handleCheckInAttempt(barcodes[0].rawValue);
                                }
                            } catch (e) {
                                // Ignore non-critical detection errors
                            }
                        }
                        animationFrameId = requestAnimationFrame(detect);
                    };
                    detect();
                }
            } catch (err) {
                console.error("Camera start error:", err);
                setMode('manual');
            }
        };

        startCamera();
        
        return () => {
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
            }
            cancelAnimationFrame(animationFrameId);
        };
    }, [mode, activeCameraId, handleCheckInAttempt, status]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(e => console.error(e));
        } else {
            document.exitFullscreen();
        }
    };

    const switchCamera = () => {
        if (cameras.length < 2) return;
        const currentIdx = cameras.findIndex(c => c.deviceId === activeCameraId);
        const nextIdx = (currentIdx + 1) % cameras.length;
        setActiveCameraId(cameras[nextIdx].deviceId);
    };

    return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center relative overflow-hidden text-gray-100">
            {config && scannedUser && <BadgePrintLayout user={scannedUser} config={config} />}
            
            {/* Header Overlay */}
            <div className="absolute top-0 w-full p-8 flex justify-between items-center z-30 bg-gradient-to-b from-black/50 to-transparent">
                <div className="flex items-center gap-4">
                    {config?.theme.logoUrl ? (
                        <img src={config.theme.logoUrl} className="h-12 w-auto bg-white rounded-lg p-1 shadow-lg" alt="Logo" />
                    ) : (
                        <div className="h-12 w-12 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-2xl">E</div>
                    )}
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-white uppercase leading-none">{config?.event.name || 'Event Check-in'}</h1>
                        <p className="text-[10px] text-primary font-bold mt-1 tracking-widest">SELF-SERVICE KIOSK</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    {cameras.length > 1 && (
                         <button onClick={switchCamera} className="text-gray-400 hover:text-white p-2 bg-white/5 rounded-full backdrop-blur-md" title="Switch Camera">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                    )}
                    <button onClick={toggleFullscreen} className="text-gray-400 hover:text-white p-2 bg-white/5 rounded-full backdrop-blur-md">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    </button>
                    <button onClick={onExit} className="text-gray-400 hover:text-red-500 p-2 bg-white/5 rounded-full backdrop-blur-md">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            <div className="w-full max-w-4xl px-8 flex flex-col items-center">
                {mode === 'scan' && status !== 'success' && status !== 'error' && (
                    <div className="relative w-full aspect-video bg-black rounded-[2rem] overflow-hidden shadow-2xl border-4 border-gray-800">
                        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-72 h-72 border-2 border-white/20 rounded-3xl relative">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg"></div>
                                {status === 'scanning' && <div className="absolute left-0 right-0 h-1 bg-primary/50 shadow-[0_0_15px_rgba(79,70,229,1)] animate-scan-y top-0"></div>}
                            </div>
                        </div>
                        <div className="absolute bottom-6 left-0 right-0 text-center">
                            <p className="text-white/60 text-sm font-medium tracking-wide">Position your QR code in the frame</p>
                        </div>
                    </div>
                )}

                {mode === 'manual' && status === 'scanning' && (
                    <div className="w-full max-w-lg bg-white dark:bg-gray-800 p-12 rounded-[2.5rem] shadow-2xl text-center border border-gray-100 dark:border-gray-700 animate-fade-in">
                        <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">Manual Entry</h2>
                        <form onSubmit={(e) => { e.preventDefault(); handleCheckInAttempt(manualInput); }} className="space-y-8">
                            <input 
                                type="text" 
                                value={manualInput} 
                                onChange={(e) => setManualInput(e.target.value)} 
                                placeholder="ID or Email" 
                                className="w-full px-8 py-5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-3xl text-center focus:border-primary outline-none transition-all dark:text-white" 
                                autoFocus 
                            />
                            <div className="flex gap-6">
                                <button type="button" onClick={() => setMode('scan')} className="flex-1 py-5 bg-gray-100 dark:bg-gray-700 text-2xl font-bold rounded-2xl text-gray-700 dark:text-gray-200">Back to Scan</button>
                                <button type="submit" disabled={!manualInput.trim()} className="flex-1 py-5 bg-primary text-white text-2xl font-bold rounded-2xl shadow-xl hover:bg-primary/90 disabled:opacity-50">Find Me</button>
                            </div>
                        </form>
                    </div>
                )}

                {status === 'processing' && (
                    <div className="text-center animate-pulse">
                        <div className="w-32 h-32 border-[12px] border-primary border-t-transparent rounded-full animate-spin mx-auto mb-8"></div>
                        <h2 className="text-4xl font-bold text-white">Verifying Ticket...</h2>
                    </div>
                )}

                {status === 'success' && scannedUser && (
                    <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl overflow-hidden animate-fade-in-up">
                        <div className="bg-green-500 p-12 flex flex-col items-center text-white">
                            <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl animate-bounce">
                                <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7"/></svg>
                            </div>
                            <h2 className="text-5xl font-black">WELCOME!</h2>
                        </div>
                        <div className="p-16 text-center">
                            <h3 className="text-6xl font-extrabold text-gray-900 dark:text-white mb-4">{scannedUser.name}</h3>
                            <p className="text-3xl text-gray-500 dark:text-gray-400 font-medium italic">{scannedUser.company || 'Confirmed Attendee'}</p>
                            {config?.printConfig?.autoPrintOnKiosk ? (
                                <p className="mt-12 text-2xl text-primary font-bold animate-pulse">Printing your badge now...</p>
                            ) : (
                                <p className="mt-12 text-2xl text-primary font-bold">Successfully Checked In!</p>
                            )}
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div className="w-full max-w-lg bg-red-50 dark:bg-red-900/20 p-16 rounded-[3rem] text-center border-4 border-red-500 animate-shake shadow-2xl">
                        <h2 className="text-4xl font-bold text-red-600 dark:text-red-400 mb-4">Access Denied</h2>
                        <p className="text-2xl text-gray-700 dark:text-gray-300">{errorMsg || "Invalid or used ticket."}</p>
                        <button onClick={() => { setStatus('scanning'); lastScannedCode.current = null; }} className="mt-10 px-12 py-4 bg-red-600 text-white text-2xl font-bold rounded-2xl shadow-lg hover:bg-red-700">Try Again</button>
                    </div>
                )}

                {status === 'scanning' && mode === 'scan' && (
                    <button onClick={() => setMode('manual')} className="mt-12 px-10 py-4 bg-gray-800/80 backdrop-blur-md text-gray-300 rounded-full font-bold text-lg hover:text-white border border-gray-700 hover:border-gray-500 transition-all">Manual ID Lookup</button>
                )}
            </div>

            <style>{`
                @keyframes scan-y { 0%, 100% { top: 0% } 50% { top: 100% } }
                .animate-scan-y { animation: scan-y 2.5s infinite linear; }
                .animate-shake { animation: shake 0.5s linear; }
                @keyframes shake { 0%, 100% { transform: translateX(0) } 25% { transform: translateX(-10px) } 75% { transform: translateX(10px) } }
            `}</style>
        </div>
    );
};
