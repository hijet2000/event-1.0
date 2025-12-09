
import { insert } from './db';
import { MediaItem } from '../types';

/**
 * Uploads a file.
 * Tries to upload to the backend server first.
 * If offline or fails, falls back to local Base64 storage in the browser DB.
 */
export const uploadFileToStorage = async (file: File): Promise<MediaItem> => {
    // 1. Try uploading to backend
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        // Get token for auth
        const adminToken = localStorage.getItem('adminToken');
        const delegateToken = localStorage.getItem('delegateToken');
        const token = adminToken || delegateToken;
        const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};

        // We assume /api is proxied to the backend
        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: headers,
            body: formData,
        });

        if (response.ok) {
            const data = await response.json();
            
            // Create a media item record for the local UI to track
            // Even if the file lives on the server, we track the reference locally for the UI
            const newItem: MediaItem = {
                id: data.id || `file_${Date.now()}`,
                name: file.name,
                type: file.type,
                size: file.size,
                url: data.url, // URL provided by backend
                uploadedAt: Date.now()
            };
            
            // Insert reference into local store to keep UI in sync instantly
            await insert('media', newItem);
            return newItem;
        }
    } catch (e) {
        console.warn("Backend upload failed, falling back to local storage:", e);
    }

    // 2. Fallback: Local Base64 Storage
    return new Promise((resolve, reject) => {
        if (typeof FileReader === 'undefined') {
            reject(new Error("File upload is not supported in this environment."));
            return;
        }

        const reader = new FileReader();
        
        reader.onload = async () => {
            const base64String = reader.result as string;
            
            // Simulate network delay
            await new Promise(r => setTimeout(r, 500));

            const newItem: MediaItem = {
                id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                name: file.name,
                type: file.type,
                size: file.size,
                url: base64String, // Base64 data URI
                uploadedAt: Date.now()
            };

            try {
                await insert('media', newItem);
                resolve(newItem);
            } catch (e) {
                reject(e);
            }
        };

        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
};

/**
 * Helper to manually add a base64 string (e.g. from AI generation) to the media library
 */
export const saveGeneratedImageToStorage = async (base64: string, prefix: string = 'generated'): Promise<MediaItem> => {
    const newItem: MediaItem = {
        id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: `${prefix}_${Date.now()}.jpg`,
        type: 'image/jpeg',
        size: Math.round((base64.length * 3) / 4), // Approx size
        url: base64,
        uploadedAt: Date.now()
    };
    await insert('media', newItem);
    return newItem;
};
