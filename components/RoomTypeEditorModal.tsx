import React, { useState, useEffect } from 'react';
import { type RoomType } from '../types';
import { Spinner } from './Spinner';
import { generateAiContent } from '../server/api';

interface RoomTypeEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (roomType: RoomType) => void;
    roomType: RoomType | null;
    adminToken: string;
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = (props) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{props.label}</label>
        <input {...props} className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
    </div>
);

export const RoomTypeEditorModal: React.FC<RoomTypeEditorModalProps> = ({ isOpen, onClose, onSave, roomType, adminToken }) => {
    const [formData, setFormData] = useState<Partial<RoomType>>({});
    const [amenitiesString, setAmenitiesString] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(roomType ? { ...roomType } : { name: '', description: '', totalRooms: 10, costPerNight: 100, capacity: 2 });
            setAmenitiesString(roomType?.amenities?.join(', ') || '');
        }
    }, [isOpen, roomType]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value, 10) : value }));
    };

    const handleGenerateDescription = async () => {
        if (!formData.name) {
            alert("Please enter a room name first.");
            return;
        }
        setIsGenerating(true);
        try {
            const description = await generateAiContent('room', { name: formData.name });
            setFormData(prev => ({ ...prev, description }));
        } catch (e) {
            alert("Failed to generate description.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const finalData = {
            ...formData,
            amenities: amenitiesString.split(',').map(a => a.trim()).filter(Boolean)
        } as RoomType;
        onSave(finalData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSave}>
                    <h2 className="text-xl font-bold">{roomType ? 'Edit' : 'Add'} Room Type</h2>
                    <div className="mt-6 space-y-4">
                        <InputField label="Room Type Name" id="name" name="name" type="text" value={formData.name || ''} onChange={handleChange} placeholder="e.g., King Deluxe Suite" required />
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium">Description</label>
                            <textarea id="description" name="description" value={formData.description || ''} onChange={handleChange} rows={3} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm"></textarea>
                            <button type="button" onClick={handleGenerateDescription} disabled={isGenerating} className="mt-2 text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                                {isGenerating ? 'Generating...' : 'Generate with AI ✨'}
                            </button>
                        </div>
                        <InputField label="Amenities (comma-separated)" id="amenities" name="amenities" type="text" value={amenitiesString} onChange={e => setAmenitiesString(e.target.value)} placeholder="e.g., WiFi, Ocean View, Minibar" />
                        <div className="grid grid-cols-2 gap-4">
                           <InputField label="Guest Capacity" id="capacity" name="capacity" type="number" min="1" value={formData.capacity || 0} onChange={handleChange} required />
                           <InputField label="Total Rooms" id="totalRooms" name="totalRooms" type="number" min="0" value={formData.totalRooms || 0} onChange={handleChange} required />
                        </div>
                        <InputField label="Cost Per Night (in EventCoin)" id="costPerNight" name="costPerNight" type="number" value={formData.costPerNight || 0} onChange={handleChange} required />
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm">Cancel</button>
                        <button type="submit" className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm text-white bg-primary hover:bg-primary/90">{isSaving ? 'Saving...' : 'Save'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};