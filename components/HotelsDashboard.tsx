import React, { useState, useEffect } from 'react';
import { type EnrichedAccommodationBooking, type Hotel, type AccommodationBookingStatus } from '../types';
import { getAccommodationBookings, updateBookingStatus, getHotels, saveHotel, deleteHotel } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { Spinner } from './Spinner';
import { HotelEditorModal } from './HotelEditorModal';

interface HotelsDashboardProps {
  adminToken: string;
}

const BookingStatusBadge: React.FC<{ status: AccommodationBookingStatus }> = ({ status }) => {
    const colors = {
        Confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        CheckedIn: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        CheckedOut: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    };
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[status] || colors.Confirmed}`}>
            {status}
        </span>
    );
};

export const HotelsDashboard: React.FC<HotelsDashboardProps> = ({ adminToken }) => {
    const [bookings, setBookings] = useState<EnrichedAccommodationBooking[]>([]);
    const [hotels, setHotels] = useState<Hotel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
    
    // Modal State
    const [isHotelModalOpen, setHotelModalOpen] = useState(false);
    const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [bookingsData, hotelsData] = await Promise.all([
                getAccommodationBookings(adminToken),
                getHotels(adminToken)
            ]);
            setBookings(bookingsData);
            setHotels(hotelsData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load accommodation data.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [adminToken]);

    const handleBookingStatusChange = async (bookingId: string, newStatus: AccommodationBookingStatus) => {
        setActionLoading(prev => ({ ...prev, [bookingId]: true }));
        try {
            await updateBookingStatus(adminToken, bookingId, newStatus);
            // Optimistic update or refetch
            setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
        } catch (e) {
            alert("Failed to update status");
        } finally {
            setActionLoading(prev => ({ ...prev, [bookingId]: false }));
        }
    };
    
    const handleSaveHotel = async (data: Partial<Hotel>) => {
        try {
            await saveHotel(adminToken, { ...editingHotel, ...data });
            await fetchData();
            return true;
        } catch (e) {
            alert("Failed to save hotel.");
            return false;
        }
    };

    const handleDeleteHotel = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this hotel?")) {
            try {
                await deleteHotel(adminToken, id);
                await fetchData();
            } catch (e) {
                alert("Failed to delete hotel.");
            }
        }
    };

    if (isLoading) return <ContentLoader text="Loading accommodation data..." />;
    if (error) return <Alert type="error" message={error} />;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Accommodation Management</h2>
                <button 
                    onClick={() => { setEditingHotel(null); setHotelModalOpen(true); }} 
                    className="py-2 px-4 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary/90"
                >
                    + Add Hotel
                </button>
            </div>

            {/* Hotels List */}
            <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Hotels</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {hotels.map(hotel => (
                        <div key={hotel.id} className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                            <h4 className="font-bold text-lg">{hotel.name}</h4>
                            <p className="text-sm text-gray-500 mb-2">{hotel.address}</p>
                            <div className="flex justify-between items-center mt-4">
                                <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{hotel.roomTypes?.length || 0} Room Types</span>
                                <div className="space-x-2">
                                    <button onClick={() => { setEditingHotel(hotel); setHotelModalOpen(true); }} className="text-sm text-primary hover:underline">Edit</button>
                                    <button onClick={() => handleDeleteHotel(hotel.id)} className="text-sm text-red-600 hover:underline">Delete</button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {hotels.length === 0 && <p className="text-gray-500 italic">No hotels added yet.</p>}
                </div>
            </div>

            {/* Bookings Table */}
            <h3 className="text-lg font-semibold mb-4">Recent Bookings</h3>
            <div className="overflow-x-auto bg-white dark:bg-gray-800 shadow-md rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Delegate</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Room Detail</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Dates</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {bookings.map(b => (
                        <tr key={b.id}>
                            <td className="px-6 py-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{b.delegateName}</div>
                                <div className="text-xs text-gray-500">{b.delegateEmail}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm text-gray-900 dark:text-white">{b.hotelName}</div>
                                <div className="text-xs text-gray-500">{b.roomTypeName} (#{b.roomNumber})</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(b.checkInDate).toLocaleDateString()} - {new Date(b.checkOutDate).toLocaleDateString()}</td>
                            <td className="px-6 py-4"><BookingStatusBadge status={b.status} /></td>
                            <td className="px-6 py-4 text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-2">
                                    <select
                                        value={b.status}
                                        onChange={(e) => handleBookingStatusChange(b.id, e.target.value as AccommodationBookingStatus)}
                                        disabled={actionLoading[b.id]}
                                        className="block w-32 rounded-md border-gray-300 dark:border-gray-600 py-1.5 text-xs shadow-sm focus:border-primary focus:ring-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    >
                                        <option value="Confirmed">Confirmed</option>
                                        <option value="CheckedIn">Checked In</option>
                                        <option value="CheckedOut">Checked Out</option>
                                    </select>
                                    {actionLoading[b.id] && <Spinner />}
                                </div>
                            </td>
                        </tr>
                    ))}
                    {bookings.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-10 text-gray-500 italic">No bookings found.</td></tr>
                    )}
                    </tbody>
                </table>
            </div>
            
            <HotelEditorModal 
                isOpen={isHotelModalOpen}
                onClose={() => setHotelModalOpen(false)}
                onSave={handleSaveHotel}
                hotel={editingHotel}
                adminToken={adminToken}
            />
        </div>
    );
};
