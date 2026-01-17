
import React, { useState, useEffect, useRef } from 'react';
import { getActiveSessions, translateText } from '../server/api';
import { Session } from '../types';
import { Spinner } from './Spinner';

export const VirtualStage: React.FC<{ delegateToken: string }> = ({ delegateToken }) => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [language, setLanguage] = useState('English');
    const [isTranslating, setIsTranslating] = useState(false);
    const [showSignPanel, setShowSignPanel] = useState(false);
    const [caption, setCaption] = useState("Original: Welcome to the 2025 Tech Summit!");
    const [translatedCaption, setTranslatedCaption] = useState("");

    useEffect(() => {
        getActiveSessions().then(data => {
            setSessions(data);
            if (data.length > 0) setActiveSession(data[0]);
        });
    }, []);

    // Mock transcript updates
    useEffect(() => {
        const lines = [
            "We are thrilled to have you here today.",
            "Technology is evolving faster than ever before.",
            "Artificial Intelligence is at the heart of our discussions.",
            "Please enjoy the keynote by Dr. Jane Smith."
        ];
        let idx = 0;
        const interval = setInterval(async () => {
            const line = lines[idx % lines.length];
            setCaption(line);
            if (language !== 'English') {
                setIsTranslating(true);
                const translated = await translateText(line, language);
                setTranslatedCaption(translated);
                setIsTranslating(false);
            } else {
                setTranslatedCaption("");
            }
            idx++;
        }, 5000);
        return () => clearInterval(interval);
    }, [language]);

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border dark:border-gray-700">
                <div>
                    <h2 className="text-2xl font-bold">Virtual Stage</h2>
                    <p className="text-sm text-gray-500">{activeSession?.title || 'Main Event'}</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold uppercase text-gray-400">AI Translator</label>
                        <select 
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-sm outline-none border-none focus:ring-2 focus:ring-primary"
                        >
                            <option>English</option>
                            <option>Spanish</option>
                            <option>French</option>
                            <option>German</option>
                            <option>Chinese</option>
                            <option>Arabic</option>
                        </select>
                    </div>
                    <button 
                        onClick={() => setShowSignPanel(!showSignPanel)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${showSignPanel ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                    >
                        Sign Language AI
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1">
                    <div className="aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl relative border-4 border-gray-800">
                        <div className="absolute inset-0 flex items-center justify-center">
                            <p className="text-white text-xl font-bold opacity-50">LIVE STREAM MOCKUP</p>
                        </div>
                        {/* Caption Overlay */}
                        <div className="absolute bottom-10 inset-x-0 flex flex-col items-center gap-2 px-10">
                            {caption && (
                                <div className="bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-lg text-lg text-center max-w-2xl">
                                    {caption}
                                </div>
                            )}
                            {translatedCaption && (
                                <div className="bg-primary/80 text-white px-4 py-2 rounded-lg text-xl font-bold text-center max-w-2xl animate-pulse">
                                    {isTranslating ? '...' : translatedCaption}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {showSignPanel && (
                    <div className="w-full lg:w-80 bg-gray-900 rounded-3xl p-6 flex flex-col items-center border-4 border-primary shadow-xl animate-fade-in">
                        <h3 className="text-white font-bold mb-4 uppercase tracking-widest text-xs">Visual Interpreter</h3>
                        <div className="w-full aspect-[3/4] bg-gray-800 rounded-2xl flex flex-col items-center justify-center border border-gray-700">
                             <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                                 <svg className="w-16 h-16 text-primary animate-bounce" fill="currentColor" viewBox="0 0 24 24">
                                     <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                                 </svg>
                             </div>
                             <p className="text-primary font-bold text-center px-4 animate-pulse">
                                 {isTranslating ? 'Processing Gestures...' : 'Rendering ASL Symbols'}
                             </p>
                        </div>
                        <p className="mt-4 text-xs text-gray-500 text-center">AI is translating current speech into standardized sign language visuals.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
