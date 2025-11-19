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

    const handleBookRoom = async (hotelId: string, roomTypeId: string) => {
        if (!window.confirm("Are you sure you want to book this room? This will replace any existing booking.")) return;

        setIsLoading(true);
        setError(null);
        try {
            await bookAccommodation(delegateToken, hotelId, roomTypeId, '2024-10-25', '2024-10-29');
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
      {isLoading && <p>Booking...</p>}

      <div className="mt-6">
        <h3 className="font-semibold mb-3">Available Hotels & Rooms</h3>
        {hotels.length > 0 ? (
            <div className="space-y-6">
            {hotels.map(h => (
                <div key={h.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <h4 className="font-bold">{h.name}</h4>
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