import React, { useState, useEffect } from 'react';
import { type Restaurant, type DiningReservation } from '../types';
import { getReservationsForRestaurant } from '../server/api';
import { ContentLoader } from './ContentLoader';

interface RestaurantReservationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    restaurant: Restaurant;
    adminToken: string;
}

export const RestaurantReservationsModal: React.FC<RestaurantReservationsModalProps> = ({ isOpen, onClose, restaurant, adminToken }) => {
    const [reservations, setReservations] = useState<DiningReservation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            getReservationsForRestaurant(adminToken, restaurant.id)
                .then(setReservations)
                .finally(() => setIsLoading(false));
        }
    }, [isOpen, restaurant, adminToken]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <h2 className="p-6 text-xl font-bold text-gray-900 dark:text-white border-b dark:border-gray-700">
                    Reservations for {restaurant.name}
                </h2>
                <div className="p-6 overflow-y-auto">
                    {isLoading ? <ContentLoader /> : (
                        reservations.length > 0 ? (
                             <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium">Delegate</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium">Time</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium">Party Size</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {reservations.map(res => (
                                        <tr key={res.id}>
                                            <td className="px-4 py-2 whitespace-nowrap">{res.delegateName}</td>
                                            <td className="px-4 py-2 whitespace-nowrap">{new Date(res.reservationTime).toLocaleString()}</td>
                                            <td className="px-4 py-2 whitespace-nowrap">{res.partySize}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-center text-gray-500 italic">No reservations found.</p>
                        )
                    )}
                </div>
                 <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 border-t dark:border-gray-700">
                    <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium">Close</button>
                </div>
            </div>
        </div>
    );
};
