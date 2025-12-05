
import React, { useState, useEffect } from 'react';
import { type EnrichedAccommodationBooking, type Hotel, type AccommodationBookingStatus, type HotelRoom, HotelRoomStatus, type RegistrationData } from '../types';
import { getAccommodationBookings, updateBookingStatus, getHotels, saveHotel, deleteHotel, generateHotelRooms, getAvailableRooms, assignRoomToBooking, getAllRooms, updateRoomStatus, processCheckOut, cancelAccommodationBooking, getRegistrations, createAdminAccommodationBooking } from '../server/api';
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
        Cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[status] || colors.Confirmed}`}>
            {status.replace(/([A-Z])/g, ' $1').trim()}
        </span>
    );
};

const StatBox: React.FC<{ label: string, value: string | number, sub?: string, color?: string }> = ({ label, value, sub, color = 'bg-white dark:bg-gray-800' }) => (
    <div className={`${color} p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700`}>
        <p className="text-xs text-gray-500 uppercase font-bold">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
);

const HotelCard: React.FC<{ hotel: Hotel, onEdit: () => void, onDelete: () => void, onInventory: () => void }> = ({ hotel, onEdit, onDelete, onInventory }) => {
    const totalRooms = hotel.roomTypes.reduce((acc, rt) => acc + rt.totalRooms, 0);
    const minPrice = hotel.roomTypes.length > 0 ? Math.min(...hotel.roomTypes.map(rt => rt.costPerNight)) : 0;
    const maxPrice = hotel.roomTypes.length > 0 ? Math.max(...hotel.roomTypes.map(rt => rt.costPerNight)) : 0;
    
    const priceRange = minPrice === maxPrice ? `${minPrice}` : `${minPrice} - ${maxPrice}`;

    return (
        <div className="bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow rounded-lg p-5 border border-gray-200 dark:border-gray-700 flex flex-col h-full">
            <div className="flex-1">
                <h4 className="font-bold text-lg text-gray-900 dark:text-white mb-1">{hotel.name}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 flex items-start">
                    <svg className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    {hotel.address}
                </p>
                
                <div className="flex gap-4 mb-4 text-sm">
                    <div className="flex-1 bg-gray-50 dark:bg-gray-700/30 p-2 rounded text-center">
                        <span className="block text-xs text-gray-500 uppercase font-bold">Capacity</span>
                        <span className="block font-semibold text-gray-800 dark:text-gray-200">{totalRooms} Rooms</span>
                    </div>
                    <div className="flex-1 bg-gray-50 dark:bg-gray-700/30 p-2 rounded text-center">
                        <span className="block text-xs text-gray-500 uppercase font-bold">Rates</span>
                        <span className="block font-semibold text-primary">{priceRange} EC</span>
                    </div>
                </div>

                {hotel.description && <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-4">{hotel.description}</p>}
                
                <div className="text-xs text-gray-500 mb-2">
                    <span className="font-semibold">Room Types:</span> {hotel.roomTypes.map(rt => rt.name).join(', ') || 'None'}
                </div>
            </div>
            
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center gap-2">
                <button onClick={onInventory} className="flex-1 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-2 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 font-medium transition-colors">
                    Manage Inventory
                </button>
                <div className="flex gap-1">
                    <button onClick={onEdit} className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors" title="Edit Details">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={onDelete} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Delete Property">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

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

// Add Booking Modal
const AddBookingModal: React.FC<{ isOpen: boolean, onClose: () => void, adminToken: string, hotels: Hotel[], onSuccess: () => void }> = ({ isOpen, onClose, adminToken, hotels, onSuccess }) => {
    const [delegates, setDelegates] = useState<RegistrationData[]>([]);
    const [selectedDelegate, setSelectedDelegate] = useState('');
    const [selectedHotel, setSelectedHotel] = useState('');
    const [selectedRoomType, setSelectedRoomType] = useState('');
    const [checkIn, setCheckIn] = useState(new Date().toISOString().split('T')[0]);
    const [checkOut, setCheckOut] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [loadingDelegates, setLoadingDelegates] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setLoadingDelegates(true);
            getRegistrations(adminToken).then(setDelegates).finally(() => setLoadingDelegates(false));
            if (hotels.length > 0) setSelectedHotel(hotels[0].id);
        }
    }, [isOpen, adminToken, hotels]);

    const activeHotel = hotels.find(h => h.id === selectedHotel);

    useEffect(() => {
        if (activeHotel && activeHotel.roomTypes.length > 0) {
            setSelectedRoomType(activeHotel.roomTypes[0].id);
        } else {
            setSelectedRoomType('');
        }
    }, [selectedHotel, activeHotel]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDelegate || !selectedHotel || !selectedRoomType) {
            setError("All fields are required.");
            return;
        }
        
        setLoading(true);
        setError(null);
        try {
            await createAdminAccommodationBooking(adminToken, selectedDelegate, selectedHotel, selectedRoomType, checkIn, checkOut);
            onSuccess();
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to create booking.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4 dark:text-white">Create Booking</h3>
                {error && <Alert type="error" message={error} />}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Delegate</label>
                        {loadingDelegates ? <Spinner /> : (
                            <select value={selectedDelegate} onChange={e => setSelectedDelegate(e.target.value)} className="w-full border p-2 rounded dark:bg-gray-700">
                                <option value="">Select a delegate...</option>
                                {delegates.map(d => <option key={d.id} value={d.id}>{d.name} ({d.email})</option>)}
                            </select>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Hotel</label>
                        <select value={selectedHotel} onChange={e => setSelectedHotel(e.target.value)} className="w-full border p-2 rounded dark:bg-gray-700">
                            {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Room Type</label>
                        <select value={selectedRoomType} onChange={e => setSelectedRoomType(e.target.value)} className="w-full border p-2 rounded dark:bg-gray-700" disabled={!activeHotel}>
                            {activeHotel?.roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name} ({rt.totalRooms} rooms)</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Check-in</label>
                            <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className="w-full border p-2 rounded dark:bg-gray-700" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Check-out</label>
                            <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} className="w-full border p-2 rounded dark:bg-gray-700" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90">
                            {loading ? <Spinner /> : 'Create Booking'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const RoomCard: React.FC<{ room: HotelRoom, onClick: () => void }> = ({ room, onClick }) => {
    const statusColors: Record<HotelRoomStatus, string> = {
        Available: 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200',
        Occupied: 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200',
        Cleaning: 'bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-200',
        OutOfOrder: 'bg-gray-100 border-gray-300 text-gray-800 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'
    };

    return (
        <div 
            onClick={onClick}
            className={`p-4 rounded-lg border-2 cursor-pointer hover:shadow-md transition-all text-center ${statusColors[room.status]}`}
        >
            <h4 className="text-xl font-bold">#{room.roomNumber}</h4>
            <p className="text-xs uppercase font-semibold mt-1 tracking-wider">{room.status.replace(/([A-Z])/g, ' $1').trim()}</p>
        </div>
    );
};

const HousekeepingModal: React.FC<{ isOpen: boolean, onClose: () => void, room: HotelRoom | null, adminToken: string, onUpdate: () => void }> = ({ isOpen, onClose, room, adminToken, onUpdate }) => {
    if (!isOpen || !room) return null;

    const handleSetStatus = async (status: HotelRoomStatus) => {
        try {
            await updateRoomStatus(adminToken, room.id, status);
            onUpdate();
            onClose();
        } catch (e) {
            alert("Failed to update room status.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4">Room {room.roomNumber} Action</h3>
                <div className="space-y-3">
                    {room.status === 'Cleaning' && (
                        <button onClick={() => handleSetStatus('Available')} className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded font-bold">
                            Mark as Clean (Available)
                        </button>
                    )}
                    {room.status === 'Available' && (
                        <button onClick={() => handleSetStatus('OutOfOrder')} className="w-full py-3 bg-gray-500 hover:bg-gray-600 text-white rounded font-bold">
                            Mark for Maintenance
                        </button>
                    )}
                    {room.status === 'OutOfOrder' && (
                        <button onClick={() => handleSetStatus('Available')} className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded font-bold">
                            Back in Service
                        </button>
                    )}
                    {room.status === 'Occupied' && (
                        <p className="text-gray-500">Room is currently occupied. Check out the guest from the Bookings tab.</p>
                    )}
                    <button onClick={onClose} className="w-full py-2 border rounded mt-4">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export const HotelsDashboard: React.FC<HotelsDashboardProps> = ({ adminToken }) => {
    const [activeTab, setActiveTab] = useState<'bookings' | 'hotels' | 'housekeeping'>('bookings');
    const [bookings, setBookings] = useState<EnrichedAccommodationBooking[]>([]);
    const [hotels, setHotels] = useState<Hotel[]>([]);
    const [rooms, setRooms] = useState<HotelRoom[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
    
    // Filters
    const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('active');
    
    // Modal State
    const [isHotelModalOpen, setHotelModalOpen] = useState(false);
    const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
    
    // New Modals
    const [inventoryHotel, setInventoryHotel] = useState<Hotel | null>(null);
    const [checkInBooking, setCheckInBooking] = useState<EnrichedAccommodationBooking | null>(null);
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    
    // Housekeeping
    const [selectedRoom, setSelectedRoom] = useState<HotelRoom | null>(null);
    const [selectedHotelFilter, setSelectedHotelFilter] = useState<string>('');

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [bookingsData, hotelsData] = await Promise.all([
                getAccommodationBookings(adminToken),
                getHotels(adminToken)
            ]) as [EnrichedAccommodationBooking[], Hotel[]];
            
            setBookings(bookingsData);
            setHotels(hotelsData);
            
            // Fetch all rooms for housekeeping view
            if (hotelsData.length > 0) {
                const allRooms: HotelRoom[] = [];
                for (const h of hotelsData) {
                    const hotelRooms = await getAllRooms(adminToken, h.id);
                    allRooms.push(...hotelRooms);
                }
                setRooms(allRooms);
                if (!selectedHotelFilter) setSelectedHotelFilter(hotelsData[0].id);
            }
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
        
        if (newStatus === 'CheckedOut') {
            if (window.confirm(`Check out ${booking.delegateName}? This will mark the room as 'Cleaning'.`)) {
                try {
                    await processCheckOut(adminToken, booking.id);
                    fetchData();
                } catch(e) {
                    alert("Failed to process check-out.");
                }
            }
            return;
        }
        
        if (newStatus === 'Cancelled') {
             if (window.confirm(`Are you sure you want to cancel the booking for ${booking.delegateName}? This will release the room inventory.`)) {
                try {
                    await cancelAccommodationBooking(adminToken, booking.id);
                    fetchData();
                } catch (e) {
                    alert("Failed to cancel booking.");
                }
             }
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

    const filteredBookings = bookings.filter(b => {
        if (bookingStatusFilter === 'active') {
            return b.status !== 'Cancelled' && b.status !== 'CheckedOut';
        }
        if (bookingStatusFilter === 'all') return true;
        return b.status === bookingStatusFilter;
    });

    // Calculate Stats
    const totalBookings = bookings.length;
    const activeBookings = bookings.filter(b => b.status === 'CheckedIn').length;
    const confirmedBookings = bookings.filter(b => b.status === 'Confirmed').length;
    
    // Calculate total capacity
    const totalCapacity = hotels.reduce((acc, h) => acc + h.roomTypes.reduce((rtAcc, rt) => rtAcc + rt.totalRooms, 0), 0);
    const occupancyRate = totalCapacity > 0 ? Math.round(((activeBookings) / totalCapacity) * 100) : 0;

    if (isLoading) return <ContentLoader text="Loading accommodation data..." />;
    if (error) return <Alert type="error" message={error} />;

    const filteredRooms = rooms.filter(r => r.hotelId === selectedHotelFilter).sort((a, b) => parseInt(a.roomNumber) - parseInt(b.roomNumber));

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Accommodation Management</h2>
                    <p className="mt-1 text-sm text-gray-500">Manage hotels, bookings, and housekeeping status.</p>
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('bookings')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'bookings' ? 'bg-white dark:bg-gray-600 shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}>Bookings</button>
                    <button onClick={() => setActiveTab('hotels')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'hotels' ? 'bg-white dark:bg-gray-600 shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}>Hotels</button>
                    <button onClick={() => setActiveTab('housekeeping')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'housekeeping' ? 'bg-white dark:bg-gray-600 shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}>Housekeeping</button>
                </div>
            </div>

            {/* Header Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatBox label="Total Properties" value={hotels.length} />
                <StatBox label="Total Capacity" value={totalCapacity} sub="Rooms across all hotels" />
                <StatBox label="Active Stays" value={activeBookings} sub={`${confirmedBookings} arriving soon`} />
                <StatBox label="Occupancy Rate" value={`${occupancyRate}%`} color={occupancyRate > 80 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-white dark:bg-gray-800'} />
            </div>

            {/* Bookings Tab */}
            {activeTab === 'bookings' && (
                <>
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                        <div className="flex items-center space-x-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</label>
                            <select 
                                value={bookingStatusFilter} 
                                onChange={(e) => setBookingStatusFilter(e.target.value)} 
                                className="border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-1.5 px-3 text-sm dark:bg-gray-700"
                            >
                                <option value="active">Active (Confirmed & Checked In)</option>
                                <option value="all">All Bookings</option>
                                <option value="Confirmed">Confirmed Only</option>
                                <option value="CheckedIn">Checked In Only</option>
                                <option value="CheckedOut">Checked Out Only</option>
                                <option value="Cancelled">Cancelled Only</option>
                            </select>
                        </div>
                        <button 
                            onClick={() => setIsBookingModalOpen(true)}
                            className="py-2 px-4 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary/90"
                        >
                            + New Booking
                        </button>
                    </div>
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
                            {filteredBookings.map(b => (
                                <tr key={b.id}>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-bold text-gray-900 dark:text-white">{b.delegateName}</div>
                                        <div className="text-xs text-gray-500">{b.delegateEmail}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{b.hotelName}</div>
                                        <div className="text-xs text-gray-500">
                                            <span className="font-semibold">{b.roomTypeName}</span>
                                            {b.roomNumber && b.roomNumber !== 'Pending' && (
                                                <span className="ml-2 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 font-mono">
                                                    Room {b.roomNumber}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                        <div>In: {new Date(b.checkInDate).toLocaleDateString()}</div>
                                        <div>Out: {new Date(b.checkOutDate).toLocaleDateString()}</div>
                                    </td>
                                    <td className="px-6 py-4"><BookingStatusBadge status={b.status} /></td>
                                    <td className="px-6 py-4 text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2">
                                            {actionLoading[b.id] ? <Spinner /> : (
                                                <select
                                                    value={b.status}
                                                    onChange={(e) => handleBookingStatusChange(b, e.target.value as AccommodationBookingStatus)}
                                                    className="block w-32 rounded-md border-gray-300 dark:border-gray-600 py-1.5 text-xs shadow-sm focus:border-primary focus:ring-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                >
                                                    <option value="Confirmed">Confirmed</option>
                                                    <option value="CheckedIn">Check In</option>
                                                    <option value="CheckedOut">Check Out</option>
                                                    <option value="Cancelled">Cancel</option>
                                                </select>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredBookings.length === 0 && (
                                <tr><td colSpan={5} className="text-center py-10 text-gray-500 italic">No bookings found matching filter.</td></tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Hotels Tab */}
            {activeTab === 'hotels' && (
                <>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Properties</h3>
                        <button 
                            onClick={() => { setEditingHotel(null); setHotelModalOpen(true); }} 
                            className="py-2 px-4 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary/90"
                        >
                            + Add Hotel
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {hotels.map(hotel => (
                            <HotelCard 
                                key={hotel.id}
                                hotel={hotel}
                                onEdit={() => { setEditingHotel(hotel); setHotelModalOpen(true); }}
                                onDelete={() => handleDeleteHotel(hotel.id)}
                                onInventory={() => setInventoryHotel(hotel)}
                            />
                        ))}
                        {hotels.length === 0 && <p className="text-gray-500 italic">No hotels added yet.</p>}
                    </div>
                </>
            )}

            {/* Housekeeping Tab */}
            {activeTab === 'housekeeping' && (
                <>
                    <div className="mb-6 flex items-center gap-4">
                        <label className="text-sm font-medium">Select Hotel:</label>
                        <select 
                            value={selectedHotelFilter} 
                            onChange={e => setSelectedHotelFilter(e.target.value)} 
                            className="border p-2 rounded dark:bg-gray-700"
                        >
                            {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                        </select>
                        <div className="flex-1"></div>
                        <div className="flex gap-2 text-xs">
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-200 border border-green-400"></div> Available</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-200 border border-red-400"></div> Occupied</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-200 border border-yellow-400"></div> Cleaning</div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
                        {filteredRooms.map(room => (
                            <RoomCard key={room.id} room={room} onClick={() => setSelectedRoom(room)} />
                        ))}
                        {filteredRooms.length === 0 && <p className="col-span-full text-center text-gray-500 py-12">No rooms found. Generate inventory in the Hotels tab.</p>}
                    </div>
                </>
            )}
            
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

            <HousekeepingModal 
                isOpen={!!selectedRoom}
                onClose={() => setSelectedRoom(null)}
                room={selectedRoom}
                adminToken={adminToken}
                onUpdate={fetchData}
            />

            <AddBookingModal
                isOpen={isBookingModalOpen}
                onClose={() => setIsBookingModalOpen(false)}
                adminToken={adminToken}
                hotels={hotels}
                onSuccess={fetchData}
            />
        </div>
    );
};
