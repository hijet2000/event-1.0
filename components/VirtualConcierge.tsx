
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { getEventContextForAI } from '../server/api';
import { Alert } from './Alert';
import { getEnv } from '../server/env';
import { useTheme } from '../contexts/ThemeContext';

interface VirtualConciergeProps {
    isOpen: boolean;
    onClose: () => void;
    delegateToken: string;
}

const Visualizer: React.FC<{ isActive: boolean }> = ({ isActive }) => {
    return (
        <div className="relative h-32 w-32 flex items-center justify-center" aria-hidden="true">
            <div className={`absolute inset-0 rounded-full bg-primary/20 ${isActive ? 'animate-ping' : ''}`}></div>
            <div className={`absolute inset-2 rounded-full bg-primary/40 ${isActive ? 'animate-pulse' : ''}`}></div>
            <div className="absolute inset-6 rounded-full bg-gradient-to-br from-primary to-secondary shadow-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
            </div>
        </div>
    );
};

// Audio utility functions based on guidelines
function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  
  // Manual base64 encoding helper
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Data = btoa(binary);

  return {
    data: base64Data,
    mimeType: 'audio/pcm;rate=16000',
  };
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const VirtualConcierge: React.FC<VirtualConciergeProps> = ({ isOpen, onClose, delegateToken }) => {
    const { config } = useTheme();
    const [status, setStatus] = useState<'initializing' | 'listening' | 'speaking' | 'error'>('initializing');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [transcript, setTranscript] = useState<{ user: string, model: string }>({ user: '', model: '' });
    
    const sessionRef = useRef<any>(null);
    const inputContextRef = useRef<AudioContext | null>(null);
    const outputContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    
    // Cleanup function
    const cleanup = () => {
        if (sessionRef.current) {
            try { sessionRef.current.close(); } catch (e) {}
            sessionRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (inputContextRef.current) {
            inputContextRef.current.close();
            inputContextRef.current = null;
        }
        if (outputContextRef.current) {
            outputContextRef.current.close();
            outputContextRef.current = null;
        }
        sourcesRef.current.forEach(s => s.stop());
        sourcesRef.current.clear();
    };

    useEffect(() => {
        if (!isOpen) {
            cleanup();
            return;
        }

        const init = async () => {
            setStatus('initializing');
            setErrorMsg(null);
            
            try {
                // Get AI config from ThemeContext
                const aiConfig = config?.aiConcierge || { enabled: true, voice: 'Kore', persona: 'You are a helpful assistant.' };
                
                if (!aiConfig.enabled) {
                    throw new Error("Virtual Concierge is currently disabled by the event organizer.");
                }

                const eventContext = await getEventContextForAI(delegateToken);
                
                // Combine Persona with Facts
                const systemInstruction = `${aiConfig.persona}\n\n${eventContext}`;

                const apiKey = getEnv('API_KEY');
                if (!apiKey) {
                    throw new Error("API Key not found.");
                }

                const ai = new GoogleGenAI({ apiKey });
                
                // Setup Audio
                inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                
                // Get Mic Stream
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;

                const sessionPromise = ai.live.connect({
                    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                    callbacks: {
                        onopen: () => {
                            console.log('Live API Connected');
                            setStatus('listening');
                            
                            if (!inputContextRef.current) return;
                            const source = inputContextRef.current.createMediaStreamSource(stream);
                            const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
                            processorRef.current = processor;
                            
                            processor.onaudioprocess = (e) => {
                                const inputData = e.inputBuffer.getChannelData(0);
                                const blob = createBlob(inputData);
                                sessionPromise.then(session => {
                                    session.sendRealtimeInput({ media: blob });
                                });
                            };
                            
                            source.connect(processor);
                            processor.connect(inputContextRef.current.destination);
                        },
                        onmessage: async (message: LiveServerMessage) => {
                            if (message.serverContent?.outputTranscription) {
                                setTranscript(prev => ({ ...prev, model: prev.model + message.serverContent?.outputTranscription?.text }));
                                setStatus('speaking');
                            } else if (message.serverContent?.inputTranscription) {
                                setTranscript(prev => ({ ...prev, user: prev.user + message.serverContent?.inputTranscription?.text }));
                                setStatus('listening');
                            }

                            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                            if (base64Audio && outputContextRef.current) {
                                const ctx = outputContextRef.current;
                                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                                
                                const binaryString = atob(base64Audio);
                                const len = binaryString.length;
                                const bytes = new Uint8Array(len);
                                for (let i = 0; i < len; i++) {
                                    bytes[i] = binaryString.charCodeAt(i);
                                }
                                
                                const audioBuffer = await decodeAudioData(bytes, ctx, 24000, 1);
                                const source = ctx.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(ctx.destination);
                                source.addEventListener('ended', () => {
                                    sourcesRef.current.delete(source);
                                    if (sourcesRef.current.size === 0) {
                                        setStatus('listening');
                                    }
                                });
                                
                                source.start(nextStartTimeRef.current);
                                nextStartTimeRef.current += audioBuffer.duration;
                                sourcesRef.current.add(source);
                            }
                            
                            if (message.serverContent?.interrupted) {
                                sourcesRef.current.forEach(s => s.stop());
                                sourcesRef.current.clear();
                                nextStartTimeRef.current = 0;
                                setTranscript(prev => ({ ...prev, model: '' }));
                                setStatus('listening');
                            }
                        },
                        onerror: (e) => {
                            console.error("Live API Error", e);
                            setErrorMsg("Connection error.");
                            setStatus('error');
                        },
                        onclose: () => {
                            console.log("Live API Closed");
                        }
                    },
                    config: {
                        responseModalities: [Modality.AUDIO],
                        speechConfig: {
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: aiConfig.voice } }
                        },
                        systemInstruction: { parts: [{ text: systemInstruction }] },
                        inputAudioTranscription: {},
                        outputAudioTranscription: {}
                    }
                });
                
                sessionRef.current = await sessionPromise;
                
            } catch (err) {
                console.error("Init failed", err);
                setErrorMsg(err instanceof Error ? err.message : "Failed to initialize voice chat.");
                setStatus('error');
            }
        };
        
        init().catch(err => {
             console.error("Failed to init Virtual Concierge", err);
             setStatus('error');
             setErrorMsg("Initialization failed.");
        });
        
        return cleanup;
    }, [isOpen, delegateToken, config]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 pointer-events-none">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={onClose}></div>
            <div className="relative bg-white dark:bg-gray-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 pointer-events-auto overflow-hidden">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Virtual Concierge</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Ask about your schedule, dining, or the venue.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div className="flex flex-col items-center justify-center py-8 space-y-6">
                     {status === 'initializing' && (
                        <div className="text-center text-primary animate-pulse">Connecting to Event AI...</div>
                     )}
                     {status === 'error' && (
                         <div className="w-full"><Alert type="error" message={errorMsg || 'Error'} /></div>
                     )}
                     {(status === 'listening' || status === 'speaking') && (
                         <>
                            <Visualizer isActive={status === 'speaking'} />
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {status === 'listening' ? 'Listening...' : 'Speaking...'}
                            </p>
                         </>
                     )}
                </div>
                
                <div 
                    className="space-y-4 min-h-[100px] max-h-[150px] overflow-y-auto p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6"
                    aria-live="polite"
                    role="log"
                    aria-atomic="false"
                >
                    {transcript.user && (
                        <div className="flex justify-end">
                             <div className="bg-primary/10 text-primary dark:text-primary px-3 py-2 rounded-lg rounded-tr-none text-sm max-w-[85%]">
                                <span className="sr-only">You said:</span> {transcript.user}
                             </div>
                        </div>
                    )}
                    {transcript.model && (
                         <div className="flex justify-start">
                             <div className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-2 rounded-lg rounded-tl-none text-sm max-w-[85%]">
                                <span className="sr-only">AI said:</span> {transcript.model}
                             </div>
                        </div>
                    )}
                    {!transcript.user && !transcript.model && status !== 'error' && (
                        <p className="text-center text-xs text-gray-400 italic">Try saying "What time is lunch?"</p>
                    )}
                </div>

                <div className="flex justify-center">
                    <button 
                        onClick={onClose}
                        className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4 shadow-lg transition-transform transform hover:scale-105"
                        aria-label="End Voice Chat"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
