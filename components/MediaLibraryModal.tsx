
import React, { useState, useEffect, useRef } from 'react';
import { getMediaLibrary, uploadFile, deleteMedia } from '../server/api';
import { type MediaItem } from '../types';
import { ContentLoader } from './ContentLoader';
import { Spinner } from './Spinner';
import { Alert } from './Alert';

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  adminToken?: string; // Optional, required for delete
}

export const MediaLibraryModal: React.FC<MediaLibraryModalProps> = ({ isOpen, onClose, onSelect, adminToken }) => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMedia = async () => {
    setIsLoading(true);
    try {
        // In a real app, we'd pass the token. 
        // Here we use a mock token if none provided because getMediaLibrary in api.ts currently doesn't check strictly for this mock.
        const data = await getMediaLibrary(adminToken || 'mock-token');
        setMedia(data);
    } catch (err) {
        setError("Failed to load media library.");
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
        fetchMedia();
    }
  }, [isOpen]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      // Client-side check for 50MB, matching backend limit
      if (file.size > 50 * 1024 * 1024) {
          alert("File is too large. Max 50MB.");
          return;
      }

      setIsUploading(true);
      setError(null);
      try {
          await uploadFile(file);
          await fetchMedia();
      } catch (err) {
          setError("Upload failed.");
      } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };
  
  const handleDelete = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (!adminToken) return; 
      if (!window.confirm("Are you sure you want to delete this file?")) return;
      
      try {
          await deleteMedia(adminToken, id);
          setMedia(prev => prev.filter(m => m.id !== id));
      } catch (err) {
          alert("Failed to delete file.");
      }
  };

  const filteredMedia = media.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Media Library</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            {/* Toolbar */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-gray-900">
                <div className="relative w-full sm:w-64">
                    <input 
                        type="text" 
                        placeholder="Search files..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-primary focus:border-primary"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept="image/*,video/*" 
                        className="hidden" 
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-full sm:w-auto px-4 py-2 bg-primary text-white text-sm font-medium rounded-md shadow-sm hover:bg-primary/90 flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {isUploading ? <Spinner /> : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        )}
                        Upload New
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-black/20">
                {error && <Alert type="error" message={error} />}
                
                {isLoading ? (
                    <ContentLoader text="Loading library..." />
                ) : filteredMedia.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filteredMedia.map(item => (
                            <div 
                                key={item.id} 
                                className="group relative aspect-square bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary hover:shadow-md transition-all"
                                onClick={() => { onSelect(item.url); onClose(); }}
                            >
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-black">
                                     {item.type.startsWith('video/') ? (
                                        <video src={item.url} className="w-full h-full object-cover pointer-events-none" />
                                     ) : (
                                        <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                                     )}
                                </div>
                                
                                {/* Overlay Info */}
                                <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                                    <p className="text-xs text-white truncate" title={item.name}>{item.name}</p>
                                    <p className="text-[10px] text-gray-300">{(item.size / 1024).toFixed(1)} KB</p>
                                </div>

                                {/* Delete Action (Only if Admin Token Present) */}
                                {adminToken && (
                                    <button 
                                        onClick={(e) => handleDelete(e, item.id)}
                                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity shadow-sm"
                                        title="Delete file"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <p>No files found in library.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
