
import React, { useState, useEffect } from 'react';
import { generateMarketingVideo } from '../server/api';
import { ImageUpload } from './ImageUpload';
import { Alert } from './Alert';
import { Spinner } from './Spinner';

export const VideoGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [referenceImage, setReferenceImage] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState('');
    
    const [hasApiKey, setHasApiKey] = useState(true);

    useEffect(() => {
        // Check for API Key availability for Veo models
        const checkKey = async () => {
            const win = window as any;
            if (win.aistudio && win.aistudio.hasSelectedApiKey) {
                const hasKey = await win.aistudio.hasSelectedApiKey();
                setHasApiKey(hasKey);
            }
        };
        checkKey();
    }, []);

    const handleSelectKey = async () => {
        const win = window as any;
        if (win.aistudio && win.aistudio.openSelectKey) {
            await win.aistudio.openSelectKey();
            // Assume success after dialog closes
            setHasApiKey(true);
        }
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) {
            setError("Please provide a prompt for the video.");
            return;
        }

        setIsGenerating(true);
        setError(null);
        setGeneratedVideoUrl(null);
        setLoadingMessage('Initializing video generation model...');

        // Simulate progress messages since we can't get real % from the polling loop easily
        const interval = setInterval(() => {
            setLoadingMessage(prev => {
                if (prev.includes('Initializing')) return 'Generating frames... this takes a minute.';
                if (prev.includes('Generating')) return 'Processing video... almost there.';
                return prev;
            });
        }, 10000);

        try {
            const url = await generateMarketingVideo(prompt, referenceImage || undefined);
            setGeneratedVideoUrl(url);
        } catch (err) {
            if (err instanceof Error && err.message.includes("Requested entity was not found")) {
                 setError("Authentication error. Please re-select your API key.");
                 setHasApiKey(false);
            } else {
                setError(err instanceof Error ? err.message : 'Failed to generate video.');
            }
        } finally {
            clearInterval(interval);
            setIsGenerating(false);
        }
    };

    if (!hasApiKey) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-800 rounded-lg shadow text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Enable Video Generation</h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
                    To generate videos using the Veo model, you need to select a billing-enabled project via AI Studio.
                </p>
                <button 
                    onClick={handleSelectKey}
                    className="px-6 py-3 bg-primary text-white rounded-md font-medium hover:bg-primary/90 transition-colors"
                >
                    Select API Key
                </button>
                <p className="mt-4 text-xs text-gray-500">
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                        Learn more about billing
                    </a>
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Marketing Video Generator</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Create promotional videos for your event using Google's Veo model.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Controls */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-fit">
                    <form onSubmit={handleGenerate} className="space-y-6">
                        <div>
                            <label htmlFor="video-prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Video Prompt <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                id="video-prompt"
                                rows={4}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Describe the video you want to create (e.g., A cinematic drone shot of a futuristic conference center at sunset, neon lights, 4k)..."
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white shadow-sm focus:ring-primary focus:border-primary"
                            />
                        </div>

                        <ImageUpload 
                            label="Starting Frame (Optional)"
                            value={referenceImage}
                            onChange={setReferenceImage}
                        />
                        <p className="text-xs text-gray-500 -mt-4">Upload an image to control the visual style or starting point of the video.</p>

                        {error && <Alert type="error" message={error} />}

                        <button
                            type="submit"
                            disabled={isGenerating || !prompt.trim()}
                            className="w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 flex justify-center items-center transition-all duration-300"
                        >
                            {isGenerating ? (
                                <>
                                    <Spinner />
                                    <span className="ml-2">Generating Video...</span>
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Generate Video
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Preview Area */}
                <div className="bg-black/5 dark:bg-black/20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden p-4">
                    {isGenerating ? (
                        <div className="text-center z-10">
                            <div className="inline-block mb-4">
                                <Spinner />
                            </div>
                            <p className="text-lg font-medium text-gray-700 dark:text-gray-200">{loadingMessage}</p>
                            <p className="text-sm text-gray-500 mt-2">This usually takes about 1-2 minutes.</p>
                        </div>
                    ) : generatedVideoUrl ? (
                        <div className="w-full h-full flex flex-col">
                            <video 
                                src={generatedVideoUrl} 
                                controls 
                                autoPlay 
                                loop 
                                className="w-full h-auto rounded shadow-lg max-h-[500px] object-contain bg-black"
                            />
                             <a 
                                href={generatedVideoUrl} 
                                download={`generated-video-${Date.now()}.mp4`}
                                className="mt-4 self-center px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                            >
                                Download Video
                            </a>
                        </div>
                    ) : (
                        <div className="text-center text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                            </svg>
                            <p>Generated video will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
