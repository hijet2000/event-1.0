import React, { useState, useEffect } from 'react';
import { type Hotel, type RoomType } from '../types';
import { Spinner } from './Spinner';
import { RoomTypeEditorModal } from './RoomTypeEditorModal';
import { generateAiContent } from '../server/api';
import { v4 as uuidv4 } from 'https://jspm.dev/uuid';

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
            const description = await generateAiContent(adminToken, 'hotel', { name: formData.name, address: formData.address });
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
            roomTypes.push({ ...room, id: room.id || `room_${uuidv4()}` });
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
                            <label htmlFor="description" className="block text-sm font-medium">Description</label>
                            <textarea id="description" name="description" value={formData.description || ''} onChange={handleChange} rows={3} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm"></textarea>
                             <button type="button" onClick={handleGenerateDescription} disabled={isGenerating} className="mt-2 text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                                {isGenerating ? 'Generating...' : 'Generate with AI ✨'}
                            </button>
                        </div>
                        <InputField label="Booking URL (Optional)" id="bookingUrl" name="bookingUrl" type="url" value={formData.bookingUrl || ''} onChange={handleChange} />
                        
                        {/* Room Types Section */}
                        <div className="pt-4 border-t dark:border-gray-700">
                             <div className="flex justify-between items-center mb-2">
                                <h3 className="font-semibold">Room Types</h3>
                                <button type="button" onClick={() => openRoomModal(null)} className="text-sm font-medium text-primary hover:underline">+ Add Room</button>
                             </div>
                             <div className="space-y-2">
                                {(formData.roomTypes || []).map(room => (
                                    <div key={room.id} className="p-2 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                        <p>{room.name} ({room.totalRooms} rooms)</p>
                                        <div className="space-x-2">
                                            <button type="button" onClick={() => openRoomModal(room)} className="text-xs font-medium text-primary hover:underline">Edit</button>
                                            <button type="button" onClick={() => handleDeleteRoom(room.id)} className="text-xs font-medium text-red-500 hover:underline">Delete</button>
                                        </div>
                                    </div>
                                ))}
                                {(!formData.roomTypes || formData.roomTypes.length === 0) && <p className="text-xs italic text-gray-500">No room types added.</p>}
                             </div>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 border-t dark:border-gray-700">
                        <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium">Cancel</button>
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
