
import React, { useState, useRef } from 'react';
import { uploadFile } from '../server/api';
import { Alert } from './Alert';
import { Spinner } from './Spinner';

export const VideoGenerator: React.FC = () => {
    const [isUploading, setIsUploading] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (!file.type.startsWith('video/')) {
            setError("Please upload a valid video file.");
            return;
        }

        if (file.size > 50 * 1024 * 1024) { // 50MB limit matching backend
             setError("File size exceeds 50MB limit.");
             return;
        }

        setIsUploading(true);
        setError(null);
        setVideoUrl(null);

        try {
            const mediaItem = await uploadFile(file);
            setVideoUrl(mediaItem.url);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to upload video.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
             <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Marketing Video Upload</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Upload promotional videos for your event directly to the media library.
                </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md text-center">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange} 
                    accept="video/*" 
                    className="hidden" 
                />
                
                {!videoUrl && !isUploading && (
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

                {isUploading && (
                    <div className="py-20">
                        <div className="flex justify-center mb-4">
                            <Spinner />
                        </div>
                        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Uploading video...</p>
                        <p className="text-sm text-gray-500 mt-2">Please wait while we process your file.</p>
                    </div>
                )}

                {videoUrl && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-lg">
                            <video src={videoUrl} controls className="w-full h-full object-contain" />
                        </div>
                        <Alert type="success" message="Video uploaded successfully to Media Library!" />
                         <button 
                            onClick={() => { setVideoUrl(null); setError(null); }}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                        >
                            Upload Another Video
                        </button>
                    </div>
                )}

                {error && <div className="mt-6"><Alert type="error" message={error} /></div>}
            </div>
        </div>
    );
};
