import React, { useState } from 'react';
import { type MealPlanAssignment, type Restaurant, type MealPlan } from '../types';
import { DiningReservationModal } from './DiningReservationModal';
import { assignMealPlan } from '../server/api'; // Assuming you have a delegate token context/prop
import { Alert } from './Alert';


interface DiningViewProps {
  mealPlanAssignment: MealPlanAssignment | null;
  restaurants: Restaurant[];
  mealPlans: MealPlan[]; // Pass down all available meal plans
  delegateToken: string;
  onUpdate: () => void; // Callback to refresh parent data
}

const RestaurantCard: React.FC<{ restaurant: Restaurant, onBook: () => void }> = ({ restaurant, onBook }) => (
    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
        <h4 className="font-bold">{restaurant.name}</h4>
        <p className="text-sm text-gray-500">{restaurant.cuisine} &bull; {restaurant.operatingHours}</p>
        <pre className="mt-2 text-xs font-mono bg-white dark:bg-gray-800 p-2 rounded whitespace-pre-wrap">{restaurant.menu || 'Menu not available.'}</pre>
        <button onClick={onBook} className="mt-3 text-sm font-medium text-primary hover:underline">Book a Table</button>
    </div>
);

export const DiningView: React.FC<DiningViewProps> = ({ mealPlanAssignment, restaurants, mealPlans, delegateToken, onUpdate }) => {
    const [bookingRestaurant, setBookingRestaurant] = useState<Restaurant | null>(null);
    const [selectedPlanId, setSelectedPlanId] = useState(mealPlanAssignment?.mealPlanId || '');
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<{type: 'success' | 'error', message: string} | null>(null);

    const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedPlanId(e.target.value);
    };

    const handleSavePlan = async () => {
        if (!selectedPlanId) {
            setStatus({ type: 'error', message: 'Please select a meal plan.'});
            return;
        }
        setIsSaving(true);
        setStatus(null);
        try {
            // Dates would be dynamic in a real app
            await assignMealPlan(delegateToken, selectedPlanId, '2024-10-26', '2024-10-28');
            setStatus({ type: 'success', message: 'Meal plan updated successfully!'});
            onUpdate(); // Trigger parent to refetch data
        } catch (e) {
            setStatus({ type: 'error', message: 'Failed to save meal plan.'});
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div>
            <h2 className="text-xl font-bold mb-4">Dining Information</h2>
            
            <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-900/50 mb-6">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">Your Meal Plan</h3>
                {status && <div className="my-2"><Alert type={status.type} message={status.message} /></div>}
                <div className="mt-2 flex items-center gap-4">
                    <select value={selectedPlanId} onChange={handlePlanChange} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm">
                        <option value="">-- Select a Plan --</option>
                        {mealPlans.map(plan => (
                            <option key={plan.id} value={plan.id}>{plan.name} - {plan.description}</option>
                        ))}
                    </select>
                    <button onClick={handleSavePlan} disabled={isSaving} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50">
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>
                 {mealPlanAssignment && <p className="text-xs text-gray-500 mt-2">Currently on the {mealPlans.find(p => p.id === mealPlanAssignment.mealPlanId)?.name} plan.</p>}
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
                    delegateToken={delegateToken}
                />
            )}
        </div>
    );
};