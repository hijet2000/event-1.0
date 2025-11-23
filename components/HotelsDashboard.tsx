
import React, { useState, useEffect } from 'react';
import { type EnrichedAccommodationBooking, type Hotel, type AccommodationBookingStatus, type HotelRoom, HotelRoomStatus } from '../types';
import { getAccommodationBookings, updateBookingStatus, getHotels, saveHotel, deleteHotel, generateHotelRooms, getAvailableRooms, assignRoomToBooking, getAllRooms, updateRoomStatus, processCheckOut } from '../server/api';
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
    
    // Modal State
    const [isHotelModalOpen, setHotelModalOpen] = useState(false);
    const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
    
    // New Modals
    const [inventoryHotel, setInventoryHotel] = useState<Hotel | null>(null);
    const [checkInBooking, setCheckInBooking] = useState<EnrichedAccommodationBooking | null>(null);
    
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

            {/* Bookings Tab */}
            {activeTab === 'bookings' && (
                <>
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
                                                disabled={actionLoading[b.id] || b.status === 'CheckedOut'}
                                                className="block w-32 rounded-md border-gray-300 dark:border-gray-600 py-1.5 text-xs shadow-sm focus:border-primary focus:ring-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            >
                                                <option value="Confirmed">Confirmed</option>
                                                <option value="CheckedIn">Check In</option>
                                                <option value="CheckedOut">Check Out</option>
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
        </div>
    );
};
