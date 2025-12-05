
import React, { useState, useEffect } from 'react';
import { type AccommodationBooking, type Hotel, RoomType } from '../types';
import { bookAccommodation, cancelAccommodationBooking, getDelegateBalance, selfCheckOut } from '../server/api';
import { Alert } from './Alert';
import { Spinner } from './Spinner';

interface AccommodationViewProps {
  accommodationBooking: AccommodationBooking | null;
  hotels?: Hotel[]; // Make optional if not always available
  delegateToken: string;
  onUpdate: () => void;
}

const RoomTypeCard: React.FC<{ hotel: Hotel, room: RoomType, onBook: () => void, isBooked: boolean }> = ({ hotel, room, onBook, isBooked }) => (
    <div className={`p-3 rounded-md ${isBooked ? 'bg-primary/10 border border-primary' : 'bg-gray-100 dark:bg-gray-900/50'}`}>
        <div className="flex justify-between items-start">
            <div>
                <p className="font-semibold">{room.name}</p>
                <p className="text-sm text-gray-500">{room.description}</p>
                <p className="text-xs text-gray-400 mt-1">{room.amenities.join(', ')}</p>
                <p className="text-xs font-bold mt-2 text-gray-600 dark:text-gray-300">{room.costPerNight} Coins / night</p>
            </div>
            {isBooked ? (
                 <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Booked</span>
            ) : (
                <button onClick={onBook} className="text-sm font-medium text-primary hover:underline">Book</button>
            )}
        </div>
    </div>
);


export const AccommodationView: React.FC<AccommodationViewProps> = ({ accommodationBooking, hotels = [], delegateToken, onUpdate }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [balance, setBalance] = useState<number | null>(null);
    
    // Date state
    const [checkIn, setCheckIn] = useState(accommodationBooking?.checkInDate || new Date().toISOString().split('T')[0]);
    const [checkOut, setCheckOut] = useState(accommodationBooking?.checkOutDate || new Date(Date.now() + 86400000).toISOString().split('T')[0]);

    useEffect(() => {
        getDelegateBalance(delegateToken).then(data => setBalance(data.balance));
    }, [delegateToken]);

    const calculateCost = (costPerNight: number) => {
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(1, nights) * costPerNight;
    }

    const handleBookRoom = async (hotelId: string, roomTypeId: string, costPerNight: number) => {
        if (new Date(checkIn) >= new Date(checkOut)) {
            setError("Check-out date must be after check-in date.");
            return;
        }
        
        const totalCost = calculateCost(costPerNight);
        if (balance !== null && balance < totalCost) {
            setError(`Insufficient funds. You need ${totalCost} coins but have ${balance}.`);
            return;
        }
        
        if (!window.confirm(`Book this room from ${checkIn} to ${checkOut} for ${totalCost} Coins? This will replace any existing booking.`)) return;

        setIsLoading(true);
        setError(null);
        setSuccessMsg(null);
        try {
            await bookAccommodation(delegateToken, hotelId, roomTypeId, checkIn, checkOut);
            setSuccessMsg(`Room booked successfully! Paid ${totalCost} Coins.`);
            onUpdate();
            // Refresh balance
            getDelegateBalance(delegateToken).then(data => setBalance(data.balance));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to book room.");
        } finally {
            setIsLoading(false);
        }
    }

    const handleCancelBooking = async () => {
        if (!accommodationBooking) return;
        if (!window.confirm("Are you sure you want to cancel your booking? You will receive a refund.")) return;

        setIsLoading(true);
        setError(null);
        try {
            await cancelAccommodationBooking(delegateToken, accommodationBooking.id);
            setSuccessMsg("Booking cancelled. Refund processed.");
            onUpdate();
            getDelegateBalance(delegateToken).then(data => setBalance(data.balance));
        } catch (e) {
            setError("Failed to cancel booking.");
        } finally {
            setIsLoading(false);
        }
    }

    const handleSelfCheckOut = async () => {
        if (!accommodationBooking) return;
        if (!window.confirm("Are you checking out now? This will mark your room for cleaning.")) return;
        
        setIsLoading(true);
        try {
            await selfCheckOut(delegateToken, accommodationBooking.id);
            setSuccessMsg("Checked out successfully. Safe travels!");
            onUpdate();
        } catch (e) {
            setError("Failed to check out.");
        } finally {
            setIsLoading(false);
        }
    };

    // Determine booked details for display
    const bookedHotel = accommodationBooking ? hotels.find(h => h.id === accommodationBooking.hotelId) : null;
    const bookedRoomType = bookedHotel ? bookedHotel.roomTypes.find(rt => rt.id === accommodationBooking.roomTypeId) : null;

    return (
    <div>
      <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Accommodation</h2>
          {balance !== null && (
              <span className="text-sm font-medium bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                  Balance: <span className="text-primary font-bold">{balance} Coins</span>
              </span>
          )}
      </div>
      
      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}
      {successMsg && <div className="mb-4"><Alert type="success" message={successMsg} /></div>}
      
      {/* Current Booking Card */}
      {accommodationBooking && accommodationBooking.status !== 'Cancelled' && bookedHotel && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border-l-4 border-green-500">
              <div className="flex justify-between items-start">
                  <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Current Reservation</h3>
                      <p className="text-primary font-medium">{bookedHotel.name}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      accommodationBooking.status === 'CheckedIn' ? 'bg-green-100 text-green-800' : 
                      accommodationBooking.status === 'CheckedOut' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                      {accommodationBooking.status === 'CheckedIn' ? 'Checked In' : 
                       accommodationBooking.status === 'CheckedOut' ? 'Checked Out' : 'Confirmed'}
                  </span>
              </div>
              
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                      <p className="text-gray-500 dark:text-gray-400">Room Type</p>
                      <p className="font-semibold">{bookedRoomType?.name}</p>
                  </div>
                  <div>
                      <p className="text-gray-500 dark:text-gray-400">Room Number</p>
                      <p className="font-semibold text-lg">
                          {accommodationBooking.roomNumber && accommodationBooking.roomNumber !== 'Pending' 
                            ? `#${accommodationBooking.roomNumber}` 
                            : 'Assigned on arrival'}
                      </p>
                  </div>
                  <div>
                      <p className="text-gray-500 dark:text-gray-400">Check-in</p>
                      <p className="font-medium">{new Date(accommodationBooking.checkInDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                      <p className="text-gray-500 dark:text-gray-400">Check-out</p>
                      <p className="font-medium">{new Date(accommodationBooking.checkOutDate).toLocaleDateString()}</p>
                  </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-4">
                  {accommodationBooking.status === 'CheckedIn' && (
                      <button 
                        onClick={handleSelfCheckOut}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-sm font-medium"
                      >
                          Check Out Now
                      </button>
                  )}
                  {accommodationBooking.status === 'Confirmed' && (
                      <button 
                        onClick={handleCancelBooking}
                        className="text-sm text-red-600 hover:text-red-800 hover:underline"
                      >
                          Cancel Reservation (Refund)
                      </button>
                  )}
              </div>
          </div>
      )}

      {/* Date Selection */}
      {(!accommodationBooking || accommodationBooking.status === 'Cancelled' || accommodationBooking.status === 'CheckedOut') && (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Select Stay Dates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Check-in</label>
                    <input 
                        type="date" 
                        value={checkIn} 
                        onChange={e => setCheckIn(e.target.value)} 
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:bg-gray-700"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Check-out</label>
                    <input 
                        type="date" 
                        value={checkOut} 
                        onChange={e => setCheckOut(e.target.value)} 
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:bg-gray-700"
                    />
                </div>
            </div>
        </div>
      )}

      {isLoading && <div className="text-center py-4"><Spinner /></div>}

      {/* Hotel List */}
      {(!accommodationBooking || accommodationBooking.status === 'Cancelled' || accommodationBooking.status === 'CheckedOut') && (
          <div className="mt-6">
            <h3 className="font-semibold mb-3">Available Hotels & Rooms</h3>
            {hotels.length > 0 ? (
                <div className="space-y-6">
                {hotels.map(h => (
                    <div key={h.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                        <h4 className="font-bold text-lg">{h.name}</h4>
                        <p className="text-sm text-gray-500">{h.address}</p>
                        <p className="mt-2 text-sm">{h.description}</p>
                        {h.bookingUrl && <a href={h.bookingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">Visit Hotel Website &rarr;</a>}
                        <div className="mt-4 space-y-2">
                            {h.roomTypes.map(rt => (
                                <RoomTypeCard 
                                    key={rt.id} 
                                    hotel={h} 
                                    room={rt}
                                    isBooked={false}
                                    onBook={() => handleBookRoom(h.id, rt.id, rt.costPerNight)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
                </div>
            ) : (
                <p className="italic text-gray-500">No hotels are available for this event.</p>
            )}
          </div>
      )}
    </div>
  );
};
