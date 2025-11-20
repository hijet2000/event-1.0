
import React, { useState } from 'react';
import { type AccommodationBooking, type Hotel, RoomType } from '../types';
import { bookAccommodation } from '../server/api';
import { Alert } from './Alert';

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
    
    // Date state
    const [checkIn, setCheckIn] = useState(accommodationBooking?.checkInDate || new Date().toISOString().split('T')[0]);
    const [checkOut, setCheckOut] = useState(accommodationBooking?.checkOutDate || new Date(Date.now() + 86400000).toISOString().split('T')[0]);

    const handleBookRoom = async (hotelId: string, roomTypeId: string) => {
        if (new Date(checkIn) >= new Date(checkOut)) {
            setError("Check-out date must be after check-in date.");
            return;
        }
        
        if (!window.confirm(`Book this room from ${checkIn} to ${checkOut}? This will replace any existing booking.`)) return;

        setIsLoading(true);
        setError(null);
        try {
            await bookAccommodation(delegateToken, hotelId, roomTypeId, checkIn, checkOut);
            onUpdate();
        } catch (e) {
            setError("Failed to book room.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
    <div>
      <h2 className="text-xl font-bold mb-4">Accommodation</h2>
      
      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}
      
      {/* Date Selection */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Your Stay Dates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Check-in</label>
                  <input 
                    type="date" 
                    value={checkIn} 
                    onChange={e => setCheckIn(e.target.value)} 
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:bg-gray-700"
                    disabled={!!accommodationBooking} // Disable if already booked, forcing them to cancel/change (simplified)
                  />
              </div>
              <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Check-out</label>
                  <input 
                    type="date" 
                    value={checkOut} 
                    onChange={e => setCheckOut(e.target.value)} 
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:bg-gray-700"
                    disabled={!!accommodationBooking}
                  />
              </div>
          </div>
          {accommodationBooking && <p className="text-xs text-gray-500 mt-2 italic">To change dates, please contact support or cancel your booking (not implemented in demo).</p>}
      </div>

      {isLoading && <p className="text-center text-primary animate-pulse mb-4">Processing booking...</p>}

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
                                isBooked={accommodationBooking?.hotelId === h.id && accommodationBooking?.roomTypeId === rt.id}
                                onBook={() => handleBookRoom(h.id, rt.id)}
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
    </div>
  );
};
