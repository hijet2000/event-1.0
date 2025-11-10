import React, { useState, useEffect } from 'react';
import { type MealPlan, type Restaurant } from '../types';
import { getMealPlans, getRestaurants, saveMealPlan, deleteMealPlan, saveRestaurant, deleteRestaurant } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { MealPlanEditorModal } from './MealPlanEditorModal';
import { RestaurantEditorModal } from './RestaurantEditorModal';
import { RestaurantReservationsModal } from './RestaurantReservationsModal';

interface DiningDashboardProps {
  adminToken: string;
}

export const DiningDashboard: React.FC<DiningDashboardProps> = ({ adminToken }) => {
    const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal states
    const [isPlanModalOpen, setPlanModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<MealPlan | null>(null);
    const [isRestaurantModalOpen, setRestaurantModalOpen] = useState(false);
    const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
    const [viewingReservationsFor, setViewingReservationsFor] = useState<Restaurant | null>(null);
    
    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [plans, rests] = await Promise.all([
                getMealPlans(adminToken),
                getRestaurants(adminToken)
            ]);
            setMealPlans(plans);
            setRestaurants(rests);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load dining options.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [adminToken]);

    const handleSavePlan = async (data: Partial<MealPlan>) => {
        await saveMealPlan(adminToken, { ...editingPlan, ...data });
        await fetchData();
        return true;
    };
    const handleDeletePlan = async (id: string) => {
        if (window.confirm('Are you sure?')) await deleteMealPlan(adminToken, id);
        await fetchData();
    };
    const handleSaveRestaurant = async (data: Partial<Restaurant>) => {
        await saveRestaurant(adminToken, { ...editingRestaurant, ...data });
        await fetchData();
        return true;
    };
     const handleDeleteRestaurant = async (id: string) => {
        if (window.confirm('Are you sure?')) await deleteRestaurant(adminToken, id);
        await fetchData();
    };

    if (isLoading) return <ContentLoader text="Loading dining info..." />;
    if (error) return <Alert type="error" message={error} />;

    return (
        <>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dining Management</h2>
            
            {/* Meal Plans */}
            <section className="mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Meal Plans</h3>
                    <button onClick={() => { setEditingPlan(null); setPlanModalOpen(true); }} className="py-2 px-4 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary/90">Add Meal Plan</button>
                </div>
                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 space-y-3">
                    {mealPlans.map(plan => (
                        <div key={plan.id} className="p-3 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 rounded-md">
                            <div>
                                <p className="font-bold">{plan.name}</p>
                                <p className="text-sm text-gray-500">{plan.description}</p>
                            </div>
                            <div className="space-x-3">
                                <button onClick={() => { setEditingPlan(plan); setPlanModalOpen(true); }} className="text-sm font-medium text-primary hover:underline">Edit</button>
                                <button onClick={() => handleDeletePlan(plan.id)} className="text-sm font-medium text-red-500 hover:underline">Delete</button>
                            </div>
                        </div>
                    ))}
                    {mealPlans.length === 0 && <p className="text-sm italic text-gray-500">No meal plans configured.</p>}
                </div>
            </section>

            {/* Restaurants */}
            <section className="mt-10">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Restaurants</h3>
                    <button onClick={() => { setEditingRestaurant(null); setRestaurantModalOpen(true); }} className="py-2 px-4 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary/90">Add Restaurant</button>
                </div>
                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 space-y-3">
                    {restaurants.map(rest => (
                        <div key={rest.id} className="p-3 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 rounded-md">
                            <div>
                                <p className="font-bold">{rest.name} <span className="text-xs font-normal text-gray-400">({rest.cuisine})</span></p>
                                <p className="text-sm text-gray-500">{rest.operatingHours}</p>
                            </div>
                             <div className="space-x-3">
                                <button onClick={() => setViewingReservationsFor(rest)} className="text-sm font-medium text-primary hover:underline">Reservations</button>
                                <button onClick={() => { setEditingRestaurant(rest); setRestaurantModalOpen(true); }} className="text-sm font-medium text-primary hover:underline">Edit</button>
                                <button onClick={() => handleDeleteRestaurant(rest.id)} className="text-sm font-medium text-red-500 hover:underline">Delete</button>
                            </div>
                        </div>
                    ))}
                    {restaurants.length === 0 && <p className="text-sm italic text-gray-500">No restaurants configured.</p>}
                </div>
            </section>

            <MealPlanEditorModal isOpen={isPlanModalOpen} onClose={() => setPlanModalOpen(false)} onSave={handleSavePlan} plan={editingPlan} adminToken={adminToken} />
            <RestaurantEditorModal isOpen={isRestaurantModalOpen} onClose={() => setRestaurantModalOpen(false)} onSave={handleSaveRestaurant} restaurant={editingRestaurant} adminToken={adminToken} />
            {viewingReservationsFor && <RestaurantReservationsModal isOpen={!!viewingReservationsFor} onClose={() => setViewingReservationsFor(null)} restaurant={viewingReservationsFor} adminToken={adminToken} />}
        </>
    );
};
