
import React, { useState, useEffect, useRef } from 'react';
import { getMediaLibrary, uploadFile, deleteMedia, type MediaItem } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Spinner } from './Spinner';
import { Alert } from './Alert';

interface MediaDashboardProps {
  adminToken: string;
}

export const MediaDashboard: React.FC<MediaDashboardProps> = ({ adminToken }) => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMedia = async () => {
    setIsLoading(true);
    try {
        const data = await getMediaLibrary(adminToken);
        setMedia(data);
    } catch (err) {
        setError("Failed to load media library.");
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [adminToken]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      if (file.size > 5 * 1024 * 1024) {
          alert("File is too large. Max 5MB.");
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
  
  const handleDelete = async (id: string) => {
      if (!window.confirm("Are you sure you want to delete this file? It may be used in other parts of the application.")) return;
      try {
          await deleteMedia(adminToken, id);
          setMedia(prev => prev.filter(m => m.id !== id));
      } catch (err) {
          alert("Failed to delete file.");
      }
  };

  const filteredMedia = media.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (isLoading) return <ContentLoader text="Loading media library..." />;
  if (error) return <Alert type="error" message={error} />;

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
             <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Media Library</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage all images and files uploaded to your event platform.</p>
            </div>
            <div>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept="image/*" 
                    className="hidden" 
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="py-2 px-4 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary/90 flex items-center gap-2 disabled:opacity-70"
                >
                    {isUploading ? <Spinner /> : '+ Upload File'}
                </button>
            </div>
        </div>

        <div className="mb-6">
             <input 
                type="text" 
                placeholder="Search files by name..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-primary focus:border-primary"
            />
        </div>

        {filteredMedia.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredMedia.map(item => (
                    <div key={item.id} className="group relative bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                        <div className="aspect-square bg-gray-100 dark:bg-black/30 relative">
                            <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <button 
                                    onClick={() => handleDelete(item.id)}
                                    className="bg-red-500 text-white p-2 rounded-full shadow-lg hover:bg-red-600 transform hover:scale-110 transition-all"
                                    title="Delete"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="p-3">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={item.name}>{item.name}</p>
                            <div className="flex justify-between items-center mt-1">
                                <p className="text-xs text-gray-500 dark:text-gray-400">{(item.size / 1024).toFixed(1)} KB</p>
                                <p className="text-xs text-gray-400">{new Date(item.uploadedAt).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <p className="text-gray-500 dark:text-gray-400">No media files found matching your search.</p>
            </div>
        )}
    </div>
  );
};
