import React, { useState } from 'react';
import { type Restaurant } from '../types';
import { Spinner } from './Spinner';

interface DiningReservationModalProps {
    isOpen: boolean;
    onClose: () => void;
    restaurant: Restaurant;
}

export const DiningReservationModal: React.FC<DiningReservationModalProps> = ({ isOpen, onClose, restaurant }) => {
    const [partySize, setPartySize] = useState(1);
    const [dateTime, setDateTime] = useState('');
    const [isBooking, setIsBooking] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    
    if (!isOpen) return null;

    const handleBooking = (e: React.FormEvent) => {
        e.preventDefault();
        setIsBooking(true);
        setError('');
        // Mock booking
        setTimeout(() => {
            if (partySize > 0 && dateTime) {
                setSuccess(true);
            } else {
                setError('Please fill all fields');
            }
            setIsBooking(false);
        }, 1000);
    }
    
    const handleClose = () => {
        setSuccess(false);
        setError('');
        onClose();
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={handleClose}>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold">Book a Table at {restaurant.name}</h2>
                {success ? (
                    <div className="text-center py-8">
                        <p className="text-green-600">Booking confirmed!</p>
                        <button onClick={handleClose} className="mt-4 py-2 px-4 bg-primary text-white rounded-md">Close</button>
                    </div>
                ) : (
                    <form onSubmit={handleBooking} className="mt-6 space-y-4">
                        <div>
                            <label htmlFor="partySize" className="block text-sm font-medium">Party Size</label>
                            <input type="number" id="partySize" value={partySize} onChange={e => setPartySize(parseInt(e.target.value, 10))} min="1" className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" />
                        </div>
                        <div>
                            <label htmlFor="dateTime" className="block text-sm font-medium">Date and Time</label>
                            <input type="datetime-local" id="dateTime" value={dateTime} onChange={e => setDateTime(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" />
                        </div>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={handleClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md text-sm">Cancel</button>
                            <button type="submit" disabled={isBooking} className="py-2 px-4 bg-primary text-white rounded-md text-sm flex items-center disabled:opacity-50">
                                {isBooking ? <><Spinner /> Booking...</> : 'Confirm Booking'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
