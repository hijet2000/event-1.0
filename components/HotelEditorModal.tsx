
import React, { useState, useEffect } from 'react';
import { type Hotel, type RoomType } from '../types';
import { Spinner } from './Spinner';
import { RoomTypeEditorModal } from './RoomTypeEditorModal';
import { generateAiContent } from '../server/api';

interface HotelEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Hotel>) => Promise<boolean>;
    hotel: Hotel | null;
    adminToken: string;
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = (props) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{props.label}</label>
        <input {...props} className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
    </div>
);

export const HotelEditorModal: React.FC<HotelEditorModalProps> = ({ isOpen, onClose, onSave, hotel, adminToken }) => {
    const [formData, setFormData] = useState<Partial<Hotel>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<RoomType | null>(null);

    const isNew = !hotel;

    useEffect(() => {
        if (isOpen) {
            setFormData(hotel ? { ...hotel } : {
                name: '',
                description: '',
                address: '',
                bookingUrl: '',
                roomTypes: [],
            });
        }
    }, [isOpen, hotel]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateDescription = async () => {
        if (!formData.name || !formData.address) {
            alert("Please enter a name and address first.");
            return;
        }
        setIsGenerating(true);
        try {
            const description = await generateAiContent('hotel', { name: formData.name, address: formData.address });
            setFormData(prev => ({ ...prev, description }));
        } catch (e) {
            alert("Failed to generate description.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const success = await onSave(formData);
        setIsSaving(false);
        if (success) {
            onClose();
        }
    };
    
    // Room Type Management
    const openRoomModal = (room: RoomType | null) => {
        setEditingRoom(room);
        setIsRoomModalOpen(true);
    };
    const handleSaveRoom = (room: RoomType) => {
        const roomTypes = [...(formData.roomTypes || [])];
        const index = roomTypes.findIndex(r => r.id === room.id);
        if (index > -1) {
            roomTypes[index] = room;
        } else {
            roomTypes.push({ ...room, id: room.id || `room_${Date.now().toString(36)}_${Math.random().toString(36).substring(2)}` });
        }
        setFormData(prev => ({ ...prev, roomTypes }));
    };
    const handleDeleteRoom = (roomId: string) => {
        if (window.confirm('Delete this room type?')) {
            const roomTypes = (formData.roomTypes || []).filter(r => r.id !== roomId);
            setFormData(prev => ({...prev, roomTypes}));
        }
    };
    
    return (
        <>
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSave}>
                    <h2 className="p-6 text-xl font-bold text-gray-900 dark:text-white border-b dark:border-gray-700">{isNew ? 'Add Hotel' : 'Edit Hotel'}</h2>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        <InputField label="Hotel Name" id="name" name="name" type="text" value={formData.name || ''} onChange={handleChange} required />
                        <InputField label="Address" id="address" name="address" type="text" value={formData.address || ''} onChange={handleChange} required />
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                            <textarea id="description" name="description" value={formData.description || ''} onChange={handleChange} rows={3} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"></textarea>
                             <button type="button" onClick={handleGenerateDescription} disabled={isGenerating} className="mt-2 text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                                {isGenerating ? 'Generating...' : 'Generate with AI ✨'}
                            </button>
                        </div>
                        <InputField label="Booking URL (Optional)" id="bookingUrl" name="bookingUrl" type="url" value={formData.bookingUrl || ''} onChange={handleChange} />
                        
                        {/* Room Types Section */}
                        <div className="pt-4 border-t dark:border-gray-700">
                             <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-gray-900 dark:text-white">Room Types</h3>
                                <button type="button" onClick={() => openRoomModal(null)} className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    Add Room
                                </button>
                             </div>
                             <div className="space-y-3">
                                {(formData.roomTypes || []).map(room => (
                                    <div key={room.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600 hover:border-primary/30 transition-colors">
                                        <div className="mb-2 sm:mb-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-sm text-gray-900 dark:text-white">{room.name}</p>
                                                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                                                    {room.costPerNight} EC
                                                </span>
                                            </div>
                                            <div className="flex gap-4 text-xs text-gray-500 mt-1">
                                                <span className="flex items-center gap-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                    {room.totalRooms} Rooms
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.274-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.274.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                                    Max {room.capacity}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 w-full sm:w-auto justify-end">
                                            <button type="button" onClick={() => openRoomModal(room)} className="px-3 py-1 text-xs font-medium bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded hover:bg-gray-50 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200">Edit</button>
                                            <button type="button" onClick={() => handleDeleteRoom(room.id)} className="px-3 py-1 text-xs font-medium bg-red-50 text-red-600 border border-red-100 rounded hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400">Delete</button>
                                        </div>
                                    </div>
                                ))}
                                {(!formData.roomTypes || formData.roomTypes.length === 0) && (
                                    <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                                        <p className="text-sm text-gray-500">No room types defined yet.</p>
                                        <button type="button" onClick={() => openRoomModal(null)} className="mt-2 text-xs text-primary hover:underline">Add your first room type</button>
                                    </div>
                                )}
                             </div>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 border-t dark:border-gray-700">
                        <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
                        <button type="submit" disabled={isSaving} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center disabled:opacity-50">
                            {isSaving ? <><Spinner /> Saving...</> : 'Save Hotel'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
        <RoomTypeEditorModal isOpen={isRoomModalOpen} onClose={() => setIsRoomModalOpen(false)} onSave={handleSaveRoom} roomType={editingRoom} adminToken={adminToken} />
        </>
    );
};
