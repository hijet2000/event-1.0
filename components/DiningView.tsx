import React, { useState } from 'react';
import { type MealPlanAssignment, type Restaurant } from '../types';
import { DiningReservationModal } from './DiningReservationModal';

interface DiningViewProps {
  mealPlanAssignment: MealPlanAssignment | null;
  restaurants: Restaurant[];
}

const RestaurantCard: React.FC<{ restaurant: Restaurant, onBook: () => void }> = ({ restaurant, onBook }) => (
    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
        <h4 className="font-bold">{restaurant.name}</h4>
        <p className="text-sm text-gray-500">{restaurant.cuisine} &bull; {restaurant.operatingHours}</p>
        <pre className="mt-2 text-xs font-mono bg-white dark:bg-gray-800 p-2 rounded whitespace-pre-wrap">{restaurant.menu || 'Menu not available.'}</pre>
        <button onClick={onBook} className="mt-3 text-sm font-medium text-primary hover:underline">Book a Table</button>
    </div>
);

export const DiningView: React.FC<DiningViewProps> = ({ mealPlanAssignment, restaurants }) => {
    const [bookingRestaurant, setBookingRestaurant] = useState<Restaurant | null>(null);

    return (
        <div>
            <h2 className="text-xl font-bold mb-4">Dining Information</h2>
            
            <div className="p-4 rounded-lg bg-primary/10 mb-6">
                <h3 className="font-semibold text-primary">Your Meal Plan</h3>
                {mealPlanAssignment ? (
                    <p>You are on the <strong>{mealPlanAssignment.mealPlanId}</strong> plan from {mealPlanAssignment.startDate} to {mealPlanAssignment.endDate}.</p>
                ) : (
                    <p>You have not been assigned a meal plan.</p>
                )}
            </div>

            <div>
                <h3 className="font-semibold mb-3">Available Restaurants</h3>
                <div className="space-y-4">
                    {restaurants.map(r => <RestaurantCard key={r.id} restaurant={r} onBook={() => setBookingRestaurant(r)} />)}
                    {restaurants.length === 0 && <p className="italic text-gray-500">No restaurants are available.</p>}
                </div>
            </div>

            {bookingRestaurant && (
                <DiningReservationModal 
                    isOpen={!!bookingRestaurant} 
                    onClose={() => setBookingRestaurant(null)} 
                    restaurant={bookingRestaurant} 
                />
            )}
        </div>
    );
};
