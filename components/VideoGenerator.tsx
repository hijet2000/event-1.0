
import React, { useState, useRef } from 'react';
import { uploadFile, generateMarketingVideo } from '../server/api';
import { Alert } from './Alert';
import { Spinner } from './Spinner';
import { ImageUpload } from './ImageUpload';

export const VideoGenerator: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'upload' | 'generate'>('upload');
    const [isProcessing, setIsProcessing] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    // Upload State
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Generation State
    const [prompt, setPrompt] = useState('');
    const [refImage, setRefImage] = useState('');
    const [generationStatus, setGenerationStatus] = useState('');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('video/')) {
            setError("Please upload a valid video file.");
            return;
        }

        if (file.size > 50 * 1024 * 1024) { 
             setError("File size exceeds 50MB limit.");
             return;
        }

        setIsProcessing(true);
        setError(null);
        setVideoUrl(null);
        setSuccessMessage(null);

        try {
            const mediaItem = await uploadFile(file);
            setVideoUrl(mediaItem.url);
            setSuccessMessage("Video uploaded successfully to Media Library!");
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to upload video.");
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError("Please enter a text prompt.");
            return;
        }

        // Mandatory API Key Selection for Veo
        if ((window as any).aistudio) {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            if (!hasKey) {
                try {
                    await (window as any).aistudio.openSelectKey();
                } catch (e) {
                    setError("Failed to select API key.");
                    return;
                }
            }
        }

        setIsProcessing(true);
        setError(null);
        setVideoUrl(null);
        setSuccessMessage(null);
        setGenerationStatus("Initializing generation...");

        try {
            // Cycle through status messages to keep user engaged
            const statusInterval = setInterval(() => {
                const messages = [
                    "Dreaming up scenes...", 
                    "Rendering frames...", 
                    "Applying cinematic lighting...", 
                    "Almost there..."
                ];
                setGenerationStatus(prev => {
                    const currentIdx = messages.indexOf(prev);
                    return messages[(currentIdx + 1) % messages.length];
                });
            }, 3000);

            // The API returns a Blob URL directly
            const url = await generateMarketingVideo(prompt, refImage || undefined);
            
            clearInterval(statusInterval);
            setVideoUrl(url);
            setSuccessMessage("Video generated successfully!");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate video.");
        } finally {
            setIsProcessing(false);
            setGenerationStatus('');
        }
    };

    const handleSaveGenerated = async () => {
        if (!videoUrl) return;
        setIsProcessing(true);
        try {
            // Convert Blob URL to File object for upload
            const response = await fetch(videoUrl);
            const blob = await response.blob();
            const file = new File([blob], `generated_video_${Date.now()}.mp4`, { type: 'video/mp4' });
            
            await uploadFile(file);
            setSuccessMessage("Saved to Media Library!");
        } catch (e) {
            setError("Failed to save to library.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
             <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Marketing Video Studio</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Create or upload promotional videos for your event.
                    </p>
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    <button 
                        onClick={() => { setActiveTab('upload'); setError(null); setSuccessMessage(null); }}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'upload' ? 'bg-white dark:bg-gray-600 shadow text-primary' : 'text-gray-500 hover:text-gray-700 dark:text-gray-300'}`}
                    >
                        Upload Video
                    </button>
                    <button 
                        onClick={() => { setActiveTab('generate'); setError(null); setSuccessMessage(null); }}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'generate' ? 'bg-white dark:bg-gray-600 shadow text-primary' : 'text-gray-500 hover:text-gray-700 dark:text-gray-300'}`}
                    >
                        Generate with AI
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
                {error && <div className="mb-6"><Alert type="error" message={error} /></div>}
                {successMessage && <div className="mb-6"><Alert type="success" message={successMessage} /></div>}

                {activeTab === 'upload' ? (
                    <div className="text-center">
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleFileChange} 
                            accept="video/*" 
                            className="hidden" 
                        />
                        
                        {!videoUrl && !isProcessing && (
                            <div 
                                className="py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Drag and drop your video here</p>
                                <p className="text-sm text-gray-500 mb-6">MP4, WebM, or Ogg (Max 50MB)</p>
                                <button 
                                    type="button"
                                    className="px-6 py-3 bg-primary text-white rounded-md font-medium hover:bg-primary/90 transition-colors pointer-events-none"
                                >
                                    Select Video File
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {!videoUrl && !isProcessing && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Describe your video
                                    </label>
                                    <textarea 
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                                        rows={4}
                                        placeholder="A futuristic conference hall with neon lights, cinematic 4k..."
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Reference Image (Optional)
                                    </label>
                                    <div className="max-w-xs">
                                        <ImageUpload label="" value={refImage} onChange={setRefImage} />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Upload an image to guide the style or content of the video.</p>
                                </div>

                                <div className="pt-4">
                                    <button 
                                        onClick={handleGenerate}
                                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md font-bold shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all transform hover:-translate-y-0.5"
                                    >
                                        ✨ Generate Video with Veo
                                    </button>
                                    <p className="text-center text-xs text-gray-500 mt-3">
                                        Powered by Google Veo. Generation may take a minute.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Loading State */}
                {isProcessing && (
                    <div className="py-20 text-center">
                        <div className="flex justify-center mb-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
                                <div className="relative bg-white dark:bg-gray-800 p-2 rounded-full">
                                    <Spinner />
                                </div>
                            </div>
                        </div>
                        <p className="text-xl font-medium text-gray-900 dark:text-white animate-pulse">
                            {activeTab === 'generate' ? generationStatus : "Uploading video..."}
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                            Please do not close this tab.
                        </p>
                    </div>
                )}

                {/* Result View */}
                {videoUrl && !isProcessing && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-2xl ring-1 ring-gray-900/10">
                            <video src={videoUrl} controls className="w-full h-full object-contain" autoPlay loop muted />
                        </div>
                        
                        <div className="flex gap-4 justify-center">
                            {activeTab === 'generate' && (
                                <button 
                                    onClick={handleSaveGenerated}
                                    className="px-6 py-2 bg-primary text-white rounded-md font-medium hover:bg-primary/90 shadow-sm"
                                >
                                    Save to Library
                                </button>
                            )}
                            <button 
                                onClick={() => { setVideoUrl(null); setError(null); }}
                                className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-md font-medium hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                            >
                                {activeTab === 'generate' ? 'Generate Another' : 'Upload Another'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
