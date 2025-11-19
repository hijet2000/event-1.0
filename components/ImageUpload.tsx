
import React, { useRef, useState } from 'react';
import { generateImage, uploadFile } from '../server/api';
import { Spinner } from './Spinner';
import { MediaLibraryModal } from './MediaLibraryModal';

interface ImageUploadProps {
  label: string;
  value: string; // The base64 data URL or a regular URL
  onChange: (value: string) => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ label, value, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit for this specific input (simulated constraint)
          alert("File is too large. Please select an image under 2MB.");
          return;
      }
      
      setIsUploading(true);
      setError(null);
      try {
        const mediaItem = await uploadFile(file);
        onChange(mediaItem.url);
      } catch (e) {
        setError("Failed to upload image.");
      } finally {
        setIsUploading(false);
        // Reset input so same file can be selected again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    try {
      // generateImage returns a base64 string
      const imageUrl = await generateImage(aiPrompt);
      onChange(imageUrl);
      setShowAiPrompt(false);
      setAiPrompt('');
    } catch (e) {
      setError("Failed to generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <div className="mt-1 flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-shrink-0 h-32 w-32 rounded-md bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center border border-gray-200 dark:border-gray-600 relative group shadow-sm">
          {value ? (
            <img src={value} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center text-gray-400">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
               <span className="text-[10px]">No Image</span>
            </div>
          )}
           {(isGenerating || isUploading) && (
             <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[1px]">
                <Spinner />
             </div>
           )}
        </div>
        
        <div className="flex-1 space-y-3">
           {!showAiPrompt ? (
             <div className="flex flex-col gap-2 sm:max-w-xs">
                <div className="grid grid-cols-2 gap-2">
                     <input
                        type="file"
                        accept="image/png, image/jpeg, image/gif, image/svg+xml"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex justify-center items-center"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Upload
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowMediaLibrary(true)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex justify-center items-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        Library
                    </button>
                </div>
                
                <button
                    type="button"
                    onClick={() => setShowAiPrompt(true)}
                    className="w-full px-3 py-2 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transition-colors flex items-center justify-center"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    Generate with AI
                </button>

                {value && (
                    <button
                    type="button"
                    onClick={handleRemove}
                    className="w-full px-3 py-2 border border-transparent rounded-md text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors"
                    >
                    Remove Image
                    </button>
                )}
             </div>
           ) : (
             <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md border border-gray-200 dark:border-gray-600 animate-fade-in">
                <label htmlFor={`prompt-${label}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Describe the image you want:
                </label>
                <textarea 
                    id={`prompt-${label}`}
                    rows={2}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="e.g., modern minimalist event logo"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                />
                {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={handleAiGenerate}
                        disabled={isGenerating || !aiPrompt.trim()}
                        className="flex-1 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 disabled:opacity-50"
                    >
                        {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setShowAiPrompt(false); setError(null); }}
                        className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-medium rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                        Cancel
                    </button>
                </div>
             </div>
           )}
           {error && !showAiPrompt && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
      
      <MediaLibraryModal 
        isOpen={showMediaLibrary} 
        onClose={() => setShowMediaLibrary(false)} 
        onSelect={onChange} 
      />
    </div>
  );
};
