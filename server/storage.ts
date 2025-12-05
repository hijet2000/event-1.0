
import { insert } from './db';
import { MediaItem } from '../types';

/**
 * Simulates uploading a file to cloud storage.
 * In this prototype, it converts the file to a Base64 string and stores it in the DB.
 */
export const uploadFileToStorage = async (file: File): Promise<MediaItem> => {
    return new Promise((resolve, reject) => {
        if (typeof FileReader === 'undefined') {
            reject(new Error("File upload is not supported in this environment (FileReader missing)."));
            return;
        }

        const reader = new FileReader();
        
        reader.onload = async () => {
            const base64String = reader.result as string;
            
            // Simulate network delay
            await new Promise(r => setTimeout(r, 1000));

            const newItem: MediaItem = {
                id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                name: file.name,
                type: file.type,
                size: file.size,
                url: base64String,
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
