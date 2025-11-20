
import React, { useState, useEffect } from 'react';
import { type EnrichedAccommodationBooking, type Hotel, type AccommodationBookingStatus, type HotelRoom } from '../types';
import { getAccommodationBookings, updateBookingStatus, getHotels, saveHotel, deleteHotel, generateHotelRooms, getAvailableRooms, assignRoomToBooking } from '../server/api';
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

// New Modal for Generating Inventory
const GenerateInventoryModal: React.FC<{ isOpen: boolean, onClose: () => void, hotel: Hotel | null, adminToken: string }> = ({ isOpen, onClose, hotel, adminToken }) => {
    const [roomTypeId, setRoomTypeId] = useState('');
    const [count, setCount] = useState(10);
    const [startNumber, setStartNumber] = useState(101);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (hotel && hotel.roomTypes.length > 0) {
            setRoomTypeId(hotel.roomTypes[0].id);
        }
    }, [hotel]);

    if (!isOpen || !hotel) return null;

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsGenerating(true);
        try {
            await generateHotelRooms(adminToken, hotel.id, roomTypeId, count, startNumber);
            alert("Rooms generated successfully.");
            onClose();
        } catch (e) {
            alert("Failed to generate rooms.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4 dark:text-white">Generate Room Inventory</h3>
                <form onSubmit={handleGenerate} className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium mb-1">Room Type</label>
                        <select value={roomTypeId} onChange={e => setRoomTypeId(e.target.value)} className="w-full border p-2 rounded dark:bg-gray-700">
                            {hotel.roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                        </select>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Count</label>
                            <input type="number" value={count} onChange={e => setCount(parseInt(e.target.value))} className="w-full border p-2 rounded dark:bg-gray-700" />
                        </div>
                        <div>
                             <label className="block text-sm font-medium mb-1">Start #</label>
                            <input type="number" value={startNumber} onChange={e => setStartNumber(parseInt(e.target.value))} className="w-full border p-2 rounded dark:bg-gray-700" />
                        </div>
                     </div>
                     <div className="flex justify-end gap-3 pt-4">
                         <button type="button" onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
                         <button type="submit" disabled={isGenerating} className="px-4 py-2 bg-primary text-white rounded">
                             {isGenerating ? <Spinner /> : 'Generate'}
                         </button>
                     </div>
                </form>
            </div>
        </div>
    );
};

// New Modal for Check-in Assignment
const CheckInModal: React.FC<{ 
    isOpen: boolean, 
    onClose: () => void, 
    booking: EnrichedAccommodationBooking | null, 
    adminToken: string,
    onSuccess: () => void 
}> = ({ isOpen, onClose, booking, adminToken, onSuccess }) => {
    const [availableRooms, setAvailableRooms] = useState<HotelRoom[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && booking) {
            setLoading(true);
            getAvailableRooms(adminToken, booking.hotelId, booking.roomTypeId)
                .then(rooms => {
                    setAvailableRooms(rooms);
                    if (rooms.length > 0) setSelectedRoomId(rooms[0].id);
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen, booking, adminToken]);

    if (!isOpen || !booking) return null;

    const handleCheckIn = async () => {
        if (!selectedRoomId) return;
        try {
            await assignRoomToBooking(adminToken, booking.id, selectedRoomId);
            onSuccess();
            onClose();
        } catch (e) {
            alert("Check-in failed");
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-2 dark:text-white">Check In: {booking.delegateName}</h3>
                <p className="text-sm text-gray-500 mb-4">Assign a {booking.roomTypeName} room.</p>
                
                {loading ? <Spinner /> : availableRooms.length === 0 ? (
                    <Alert type="error" message="No available rooms of this type found. Please generate inventory first." />
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Select Room</label>
                            <select value={selectedRoomId} onChange={e => setSelectedRoomId(e.target.value)} className="w-full border p-2 rounded dark:bg-gray-700">
                                {availableRooms.map(r => <option key={r.id} value={r.id}>Room {r.roomNumber}</option>)}
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
                            <button onClick={handleCheckIn} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Confirm Check-In</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
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
    
    // New Modals
    const [inventoryHotel, setInventoryHotel] = useState<Hotel | null>(null);
    const [checkInBooking, setCheckInBooking] = useState<EnrichedAccommodationBooking | null>(null);

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

    const handleBookingStatusChange = async (booking: EnrichedAccommodationBooking, newStatus: AccommodationBookingStatus) => {
        if (newStatus === 'CheckedIn' && (booking.roomNumber === 'Pending' || !booking.hotelRoomId || booking.hotelRoomId === 'assigned_later')) {
            // Trigger custom modal logic
            setCheckInBooking(booking);
            return;
        }

        setActionLoading(prev => ({ ...prev, [booking.id]: true }));
        try {
            await updateBookingStatus(adminToken, booking.id, newStatus);
            fetchData();
        } catch (e) {
            alert("Failed to update status");
        } finally {
            setActionLoading(prev => ({ ...prev, [booking.id]: false }));
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
                <h3 className="text-lg font-semibold mb-4">Hotels & Inventory</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {hotels.map(hotel => (
                        <div key={hotel.id} className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                            <h4 className="font-bold text-lg">{hotel.name}</h4>
                            <p className="text-sm text-gray-500 mb-2">{hotel.address}</p>
                            <div className="flex justify-between items-center mt-4 pt-4 border-t dark:border-gray-700">
                                <button onClick={() => setInventoryHotel(hotel)} className="text-xs bg-secondary/10 text-secondary px-2 py-1 rounded hover:bg-secondary/20">
                                    Manage Inventory
                                </button>
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
                                <div className="text-xs text-gray-500">
                                    {b.roomTypeName} 
                                    {b.roomNumber !== 'Pending' ? <span className="ml-1 font-bold text-primary">#{b.roomNumber}</span> : <span className="ml-1 italic text-yellow-600">(Unassigned)</span>}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(b.checkInDate).toLocaleDateString()} - {new Date(b.checkOutDate).toLocaleDateString()}</td>
                            <td className="px-6 py-4"><BookingStatusBadge status={b.status} /></td>
                            <td className="px-6 py-4 text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-2">
                                    <select
                                        value={b.status}
                                        onChange={(e) => handleBookingStatusChange(b, e.target.value as AccommodationBookingStatus)}
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
            
            <GenerateInventoryModal 
                isOpen={!!inventoryHotel}
                onClose={() => setInventoryHotel(null)}
                hotel={inventoryHotel}
                adminToken={adminToken}
            />

            <CheckInModal 
                isOpen={!!checkInBooking}
                onClose={() => setCheckInBooking(null)}
                booking={checkInBooking}
                adminToken={adminToken}
                onSuccess={fetchData}
            />
        </div>
    );
};
