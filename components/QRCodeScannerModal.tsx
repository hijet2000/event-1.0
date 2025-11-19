
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Alert } from './Alert';

// A simple loader component
const Loader: React.FC = () => (
    <div className="flex justify-center items-center">
        <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

interface QRCodeScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (data: string) => void;
}

export const QRCodeScannerModal: React.FC<QRCodeScannerModalProps> = ({ isOpen, onClose, onScan }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const cleanup = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    useEffect(() => {
        if (!isOpen) {
            cleanup();
            return;
        }
        
        const startScan = async () => {
            setError(null);
            setIsLoading(true);

            if (!('BarcodeDetector' in window)) {
                setError('QR code scanning is not supported by your browser.');
                setIsLoading(false);
                return;
            }

            try {
                streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                if (videoRef.current) {
                    videoRef.current.srcObject = streamRef.current;
                    await videoRef.current.play();
                    setIsLoading(false);
                    
                    const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
                    
                    const detect = () => {
                        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
                           return;
                        }
                        // Check if video has enough data to be scanned
                        if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                             barcodeDetector.detect(videoRef.current)
                                .then((barcodes: any[]) => {
                                    if (barcodes.length > 0) {
                                        onScan(barcodes[0].rawValue);
                                    } else {
                                        animationFrameRef.current = requestAnimationFrame(detect);
                                    }
                                })
                                .catch((err: Error) => {
                                    // This can happen, but we can often just try again
                                    console.error("Barcode detection failed:", err);
                                    animationFrameRef.current = requestAnimationFrame(detect);
                                });
                        } else {
                            animationFrameRef.current = requestAnimationFrame(detect);
                        }
                    };
                    detect();
                }
            } catch (err) {
                 if (err instanceof Error) {
                    if (err.name === 'NotAllowedError') {
                        setError('Camera permission denied. Please enable camera access in your browser settings.');
                    } else if (err.name === 'NotFoundError') {
                         setError('No camera found. Please connect a camera to use this feature.');
                    } else {
                        setError(`Could not start camera: ${err.message}`);
                    }
                } else {
                    setError('An unknown error occurred while accessing the camera.');
                }
                setIsLoading(false);
            }
        };

        startScan();

        // Cleanup on component unmount
        return () => {
            cleanup();
        };

    }, [isOpen, onScan, cleanup]);


    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-scanner-title"
        >
            <div 
                className="bg-gray-900 rounded-lg shadow-xl w-full max-w-lg h-full max-h-[80vh] flex flex-col relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                    <h2 id="qr-scanner-title" className="text-lg font-bold text-white">Scan Recipient's QR Code</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
                </div>
                <div className="flex-1 relative bg-black flex items-center justify-center">
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline />
                    <div className="absolute inset-0 flex items-center justify-center">
                        {isLoading && <Loader />}
                        {error && <div className="p-4 max-w-sm mx-auto"><Alert type="error" message={error} /></div>}
                        {!isLoading && !error && <div className="absolute w-2/3 aspect-square border-4 border-dashed border-white/50 rounded-lg"></div>}
                    </div>
                </div>
                 <div className="p-4 text-center text-sm text-gray-400 bg-gray-800 flex-shrink-0">
                    Position the delegate's QR code inside the frame.
                </div>
            </div>
        </div>
    );
};
