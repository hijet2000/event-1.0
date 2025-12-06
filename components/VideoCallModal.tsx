
import React, { useState, useEffect, useRef } from 'react';
import { sendSignal, subscribeToSignals } from '../server/api';

interface VideoCallModalProps {
    isOpen: boolean;
    onClose: () => void;
    partnerName: string;
    partnerId: string;
    isCaller: boolean;
    delegateToken: string;
}

const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export const VideoCallModal: React.FC<VideoCallModalProps> = ({ isOpen, onClose, partnerName, partnerId, isCaller, delegateToken }) => {
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [callState, setCallState] = useState<'initializing' | 'calling' | 'connected' | 'ended' | 'failed'>('initializing');
    const [duration, setDuration] = useState(0);
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const localStream = useRef<MediaStream | null>(null);

    // Timer
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (callState === 'connected') {
            interval = setInterval(() => setDuration(d => d + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [callState]);

    // Initialize WebRTC and Signaling
    useEffect(() => {
        if (isOpen) {
            setCallState('initializing');
            setDuration(0);

            const startCall = async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    localStream.current = stream;
                    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

                    const pc = new RTCPeerConnection(iceServers);
                    peerConnection.current = pc;

                    // Add Tracks
                    stream.getTracks().forEach(track => pc.addTrack(track, stream));

                    // Handle Remote Stream
                    pc.ontrack = (event) => {
                        if (remoteVideoRef.current) {
                            remoteVideoRef.current.srcObject = event.streams[0];
                        }
                        setCallState('connected');
                    };

                    // Handle ICE Candidates
                    pc.onicecandidate = (event) => {
                        if (event.candidate) {
                            sendSignal(delegateToken, partnerId, 'candidate', event.candidate);
                        }
                    };

                    pc.onconnectionstatechange = () => {
                        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                            setCallState('failed');
                        }
                    };

                    // Create Offer if caller
                    if (isCaller) {
                        setCallState('calling');
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        await sendSignal(delegateToken, partnerId, 'offer', offer);
                    } else {
                        setCallState('calling'); // Waiting for offer
                    }

                } catch (err) {
                    console.error("Media Error", err);
                    alert("Could not access camera/microphone.");
                    onClose();
                }
            };

            startCall();

            // Setup Socket Listener
            const unsubscribe = subscribeToSignals(async (payload) => {
                if (payload.senderId !== partnerId) return;
                const pc = peerConnection.current;
                if (!pc) return;

                if (payload.type === 'offer') {
                    if (!isCaller) {
                        await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        await sendSignal(delegateToken, partnerId, 'answer', answer);
                    }
                } else if (payload.type === 'answer') {
                    if (isCaller) {
                        await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
                    }
                } else if (payload.type === 'candidate') {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(payload.data));
                    } catch (e) {
                        console.error("Error adding ice candidate", e);
                    }
                }
            });

            return () => {
                unsubscribe();
                if (localStream.current) {
                    localStream.current.getTracks().forEach(t => t.stop());
                }
                if (peerConnection.current) {
                    peerConnection.current.close();
                }
            };
        }
    }, [isOpen, delegateToken, partnerId, isCaller]);

    const toggleMute = () => {
        if (localStream.current) {
            localStream.current.getAudioTracks().forEach(t => t.enabled = !t.enabled);
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStream.current) {
            localStream.current.getVideoTracks().forEach(t => t.enabled = !t.enabled);
            setIsVideoOff(!isVideoOff);
        }
    };

    const handleHangup = () => {
        setCallState('ended');
        setTimeout(onClose, 1000);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-gray-900 flex flex-col items-center justify-center text-white overflow-hidden">
            {/* Main Remote View */}
            <div className="absolute inset-0 flex items-center justify-center bg-black">
                <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-contain"
                />
                
                {callState !== 'connected' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 z-10">
                        {callState === 'calling' || callState === 'initializing' ? (
                            <div className="text-center animate-pulse">
                                <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-4 border-4 border-gray-600 text-3xl font-bold">
                                    {partnerName.charAt(0).toUpperCase()}
                                </div>
                                <h2 className="text-2xl font-bold">{isCaller ? 'Calling...' : 'Connecting...'}</h2>
                                <p className="text-gray-400 mt-2">{partnerName}</p>
                            </div>
                        ) : (
                            <h2 className="text-2xl font-bold text-red-500">{callState === 'failed' ? 'Connection Failed' : 'Call Ended'}</h2>
                        )}
                    </div>
                )}
            </div>

            {/* Local Pip View */}
            <div className="absolute top-4 right-4 w-32 sm:w-48 aspect-[3/4] bg-black rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700 z-20">
                <video 
                    ref={localVideoRef} 
                    autoPlay 
                    muted 
                    playsInline 
                    className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`} 
                />
                {isVideoOff && (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-900">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </div>
                )}
            </div>

            {/* Timer Overlay */}
            {callState === 'connected' && (
                <div className="absolute top-6 left-6 bg-black/50 px-3 py-1 rounded-full text-sm font-mono z-20">
                    {formatTime(duration)}
                </div>
            )}

            {/* Controls */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-6 z-30 pointer-events-none">
                <div className="pointer-events-auto flex gap-6">
                    <button 
                        onClick={toggleMute}
                        className={`p-4 rounded-full transition-all shadow-lg ${isMuted ? 'bg-white text-black' : 'bg-gray-700/80 hover:bg-gray-600 text-white backdrop-blur-md'}`}
                        title={isMuted ? "Unmute" : "Mute"}
                    >
                        {isMuted ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        )}
                    </button>
                    
                    <button 
                        onClick={handleHangup}
                        className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg transform hover:scale-110 transition-all"
                        title="End Call"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" /></svg>
                    </button>

                    <button 
                        onClick={toggleVideo}
                        className={`p-4 rounded-full transition-all shadow-lg ${isVideoOff ? 'bg-white text-black' : 'bg-gray-700/80 hover:bg-gray-600 text-white backdrop-blur-md'}`}
                        title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
                    >
                        {isVideoOff ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
