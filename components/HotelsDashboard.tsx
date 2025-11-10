import React, { useState, useEffect } from 'react';
import { type Hotel } from '../types';
import { getHotels, saveHotel, deleteHotel } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { HotelEditorModal } from './HotelEditorModal';

interface HotelsDashboardProps {
  adminToken: string;
}

export const HotelsDashboard: React.FC<HotelsDashboardProps> = ({ adminToken }) => {
    const [hotels, setHotels] = useState<Hotel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal states
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
    
    const fetchData = async () => {
        try {
            setIsLoading(true);
            const data = await getHotels(adminToken);
            setHotels(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load hotel data.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [adminToken]);

    const handleSave = async (data: Partial<Hotel>) => {
        await saveHotel(adminToken, { ...editingHotel, ...data });
        await fetchData();
        return true;
    };
    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure? This will delete the hotel and all its room types.')) {
            await deleteHotel(adminToken, id);
            await fetchData();
        }
    };

    if (isLoading) return <ContentLoader text="Loading hotel info..." />;
    if (error) return <Alert type="error" message={error} />;

    return (
        <>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Accommodation Management</h2>
                 <button onClick={() => { setEditingHotel(null); setModalOpen(true); }} className="py-2 px-4 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary/90">Add Hotel</button>
            </div>
            
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 space-y-3">
                 {hotels.map(hotel => (
                    <div key={hotel.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                        <div className="flex justify-between items-start">
                             <div>
                                <p className="font-bold">{hotel.name}</p>
                                <p className="text-sm text-gray-500">{hotel.address}</p>
                                <p className="text-xs mt-1">{hotel.roomTypes.length} room type(s)</p>
                            </div>
                            <div className="space-x-3 flex-shrink-0">
                                <button onClick={() => { setEditingHotel(hotel); setModalOpen(true); }} className="text-sm font-medium text-primary hover:underline">Edit</button>
                                <button onClick={() => handleDelete(hotel.id)} className="text-sm font-medium text-red-500 hover:underline">Delete</button>
                            </div>
                        </div>
                    </div>
                ))}
                {hotels.length === 0 && <p className="text-sm italic text-gray-500">No hotels configured.</p>}
            </div>

            <HotelEditorModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} hotel={editingHotel} adminToken={adminToken} />
        </>
    );
};
