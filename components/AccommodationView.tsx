import React from 'react';
import { type AccommodationBooking, type Hotel } from '../types';

interface AccommodationViewProps {
  accommodationBooking: AccommodationBooking | null;
  hotels?: Hotel[]; // Make optional if not always available
}

export const AccommodationView: React.FC<AccommodationViewProps> = ({ accommodationBooking, hotels = [] }) => {
  const booking = accommodationBooking;
  const hotel = booking ? hotels.find(h => h.id === booking.hotelId) : null;
  const room = hotel ? hotel.roomTypes.find(rt => rt.id === booking?.roomTypeId) : null;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Accommodation</h2>
      
      {booking && hotel && room ? (
        <div className="p-4 rounded-lg bg-primary/10">
          <h3 className="font-semibold text-primary">Your Booking Details</h3>
          <div className="mt-2 space-y-1">
            <p><strong>Hotel:</strong> {hotel.name}</p>
            <p><strong>Room:</strong> {room.name}</p>
            <p><strong>Check-in:</strong> {booking.checkInDate}</p>
            <p><strong>Check-out:</strong> {booking.checkOutDate}</p>
            <p><strong>Address:</strong> {hotel.address}</p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900/50">
          <p className="text-yellow-800 dark:text-yellow-200">You do not have an accommodation booking.</p>
        </div>
      )}

      <div className="mt-6">
        <h3 className="font-semibold mb-3">Available Hotels</h3>
        {hotels.length > 0 ? (
            <div className="space-y-4">
            {hotels.map(h => (
                <div key={h.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <h4 className="font-bold">{h.name}</h4>
                    <p className="text-sm text-gray-500">{h.address}</p>
                    <p className="mt-2 text-sm">{h.description}</p>
                    {h.bookingUrl && <a href={h.bookingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">Book Now &rarr;</a>}
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
