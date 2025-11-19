import React, { useState, useEffect } from 'react';
import { type MealPlan, type Restaurant, type MealType } from '../types';
import { getMealPlans, getRestaurants, saveMealPlan, deleteMealPlan, saveRestaurant, deleteRestaurant, recordMealConsumption } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { MealPlanEditorModal } from './MealPlanEditorModal';
import { RestaurantEditorModal } from './RestaurantEditorModal';
import { RestaurantReservationsModal } from './RestaurantReservationsModal';
import { QRCodeScannerModal } from './QRCodeScannerModal';

interface DiningDashboardProps {
  adminToken: string;
}

const ScanButton: React.FC<{ mealType: MealType, onClick: (mealType: MealType) => void }> = ({ mealType, onClick }) => {
    const icons = {
        breakfast: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M5.05 3.05a7 7 0 000 9.9A7 7 0 0014.95 3.05a7 7 0 00-9.9 0zM10 12a2 2 0 100-4 2 2 0 000 4z" /><path d="M2.22 9.22A.75.75 0 003 9h14a.75.75 0 00.78-.78A10 10 0 0010 0 10 10 0 002.22 9.22z" /></svg>,
        lunch: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>,
        dinner: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
    };

    return (
        <button 
            onClick={() => onClick(mealType)} 
            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-300 ease-in-out"
        >
            {icons[mealType]}
            Scan for {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
        </button>
    )
};

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
    
    // New state for scanning
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanningForMeal, setScanningForMeal] = useState<MealType | null>(null);
    const [scanStatus, setScanStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

    // New handlers for scanning
    const handleScanButtonClick = (mealType: MealType) => {
        setScanStatus(null);
        setScanningForMeal(mealType);
        setIsScannerOpen(true);
    };

    const handleScan = async (data: string) => {
        setIsScannerOpen(false);
        if (!scanningForMeal) return;

        const delegateId = data; // QR code contains the delegate ID

        try {
            const result = await recordMealConsumption(adminToken, delegateId, scanningForMeal);
            setScanStatus({
                type: result.success ? 'success' : 'error',
                message: result.message,
            });
        } catch (e) {
            setScanStatus({
                type: 'error',
                message: e instanceof Error ? e.message : 'An unknown error occurred.',
            });
        } finally {
            setScanningForMeal(null);
            setTimeout(() => setScanStatus(null), 5000); // Clear message after 5 seconds
        }
    };

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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dining Management</h2>
            
            {scanStatus && <div className="mb-4"><Alert type={scanStatus.type} message={scanStatus.message} /></div>}

             {/* On-site Meal Redemption */}
            <section className="mb-10">
                <h3 className="text-xl font-semibold mb-4">On-site Meal Redemption</h3>
                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Use a camera to scan delegate QR codes and record meal consumption. This prevents duplicate entries for the same meal on the same day.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <ScanButton mealType="breakfast" onClick={handleScanButtonClick} />
                        <ScanButton mealType="lunch" onClick={handleScanButtonClick} />
                        <ScanButton mealType="dinner" onClick={handleScanButtonClick} />
                    </div>
                </div>
            </section>
            
            {/* Meal Plans */}
            <section>
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
            <QRCodeScannerModal 
                isOpen={isScannerOpen} 
                onClose={() => setIsScannerOpen(false)} 
                onScan={handleScan} 
            />
        </>
    );
};