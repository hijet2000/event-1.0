
import React, { useState, useEffect } from 'react';
import { type Restaurant, type DiningReservation, type RegistrationData } from '../types';
import { getReservationsForRestaurant, createAdminDiningReservation, deleteDiningReservation, getRegistrations } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Spinner } from './Spinner';
import { Alert } from './Alert';

interface RestaurantReservationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    restaurant: Restaurant;
    adminToken: string;
}

export const RestaurantReservationsModal: React.FC<RestaurantReservationsModalProps> = ({ isOpen, onClose, restaurant, adminToken }) => {
    const [reservations, setReservations] = useState<DiningReservation[]>([]);
    const [delegates, setDelegates] = useState<RegistrationData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Create Mode State
    const [isCreating, setIsCreating] = useState(false);
    const [newRes, setNewRes] = useState({ delegateId: '', dateTime: '', partySize: 2 });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [resData, delData] = await Promise.all([
                getReservationsForRestaurant(adminToken, restaurant.id),
                getRegistrations(adminToken) // Need list for dropdown
            ]);
            setReservations(resData);
            setDelegates(delData);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchData();
            setIsCreating(false);
            setNewRes({ delegateId: '', dateTime: '', partySize: 2 });
            setError(null);
        }
    }, [isOpen, restaurant, adminToken]);

    const handleDelete = async (id: string) => {
        if (window.confirm("Delete this reservation?")) {
            await deleteDiningReservation(adminToken, id);
            // Refresh locally
            setReservations(prev => prev.filter(r => r.id !== id));
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRes.delegateId || !newRes.dateTime) {
            setError("Please select a delegate and time.");
            return;
        }
        
        setIsSubmitting(true);
        setError(null);
        try {
            await createAdminDiningReservation(adminToken, {
                restaurantId: restaurant.id,
                delegateId: newRes.delegateId,
                reservationTime: new Date(newRes.dateTime).toISOString(),
                partySize: newRes.partySize
            });
            // Refresh and close form
            const resData = await getReservationsForRestaurant(adminToken, restaurant.id);
            setReservations(resData);
            setIsCreating(false);
        } catch (e) {
            setError("Failed to create reservation.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                     <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Reservations: {restaurant.name}
                    </h2>
                    {!isCreating && (
                        <button 
                            onClick={() => setIsCreating(true)}
                            className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded hover:bg-primary/90"
                        >
                            + Add Reservation
                        </button>
                    )}
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                    {isCreating ? (
                        <form onSubmit={handleCreate} className="space-y-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                            <h3 className="font-bold text-sm uppercase text-gray-500">New Reservation</h3>
                            {error && <Alert type="error" message={error} />}
                            <div>
                                <label className="block text-xs font-medium mb-1">Delegate</label>
                                <select 
                                    className="w-full p-2 border rounded dark:bg-gray-700"
                                    value={newRes.delegateId}
                                    onChange={e => setNewRes({...newRes, delegateId: e.target.value})}
                                >
                                    <option value="">Select Delegate...</option>
                                    {delegates.map(d => <option key={d.id} value={d.id}>{d.name} ({d.email})</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium mb-1">Date & Time</label>
                                    <input 
                                        type="datetime-local" 
                                        className="w-full p-2 border rounded dark:bg-gray-700"
                                        value={newRes.dateTime}
                                        onChange={e => setNewRes({...newRes, dateTime: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Party Size</label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        className="w-full p-2 border rounded dark:bg-gray-700"
                                        value={newRes.partySize}
                                        onChange={e => setNewRes({...newRes, partySize: parseInt(e.target.value)})}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setIsCreating(false)} className="px-3 py-1.5 border rounded text-sm">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-3 py-1.5 bg-primary text-white rounded text-sm disabled:opacity-50">
                                    {isSubmitting ? <Spinner /> : 'Save'}
                                </button>
                            </div>
                        </form>
                    ) : isLoading ? <ContentLoader /> : (
                        reservations.length > 0 ? (
                             <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Delegate</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Time</th>
                                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Size</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {reservations.map(res => (
                                        <tr key={res.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                            <td className="px-4 py-3 text-sm font-medium">{res.delegateName}</td>
                                            <td className="px-4 py-3 text-sm">{new Date(res.reservationTime).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-sm text-center">{res.partySize}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => handleDelete(res.id)} className="text-red-500 hover:bg-red-100 p-1.5 rounded-full transition-colors" title="Cancel Reservation">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                                <p className="text-gray-500 italic">No reservations found for this restaurant.</p>
                            </div>
                        )
                    )}
                </div>
                 <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 border-t dark:border-gray-700">
                    <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">Close</button>
                </div>
            </div>
        </div>
    );
};
