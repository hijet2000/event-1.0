
import React, { useState, useEffect, useMemo } from 'react';
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
            className="w-full flex items-center justify-center py-8 px-4 border-2 border-dashed border-primary/30 hover:border-primary rounded-xl shadow-sm text-sm font-bold text-primary bg-primary/5 hover:bg-primary/10 focus:outline-none transition-all duration-300 ease-in-out flex-col gap-2"
        >
            <div className="p-3 bg-white dark:bg-gray-800 rounded-full shadow-md text-primary">
                {icons[mealType]}
            </div>
            Scan for {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
        </button>
    )
};

export const DiningDashboard: React.FC<DiningDashboardProps> = ({ adminToken }) => {
    const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'restaurants'>('overview');

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

    // Search & Filter
    const [restaurantSearch, setRestaurantSearch] = useState('');
    const [planSearch, setPlanSearch] = useState('');

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

    // Filter Logic
    const filteredRestaurants = useMemo(() => {
        return restaurants.filter(r => 
            r.name.toLowerCase().includes(restaurantSearch.toLowerCase()) ||
            r.cuisine.toLowerCase().includes(restaurantSearch.toLowerCase())
        );
    }, [restaurants, restaurantSearch]);

    const filteredPlans = useMemo(() => {
        return mealPlans.filter(p => 
            p.name.toLowerCase().includes(planSearch.toLowerCase())
        );
    }, [mealPlans, planSearch]);


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
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dining Management</h2>
                    <p className="mt-1 text-sm text-gray-500">Manage meal plans, restaurant partners, and check-ins.</p>
                </div>
                 <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'overview' ? 'bg-white dark:bg-gray-600 shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}>Operations</button>
                    <button onClick={() => setActiveTab('plans')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'plans' ? 'bg-white dark:bg-gray-600 shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}>Meal Plans</button>
                    <button onClick={() => setActiveTab('restaurants')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'restaurants' ? 'bg-white dark:bg-gray-600 shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}>Restaurants</button>
                </div>
            </div>
            
            {scanStatus && <div className="mb-4"><Alert type={scanStatus.type} message={scanStatus.message} /></div>}

            {activeTab === 'overview' && (
                <div className="space-y-8 animate-fade-in">
                    {/* On-site Meal Redemption */}
                    <section>
                        <div className="bg-white dark:bg-gray-800 shadow-md rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Scan Delegate QR</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Use a camera to scan delegate QR codes and record meal consumption. This prevents duplicate entries for the same meal on the same day.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <ScanButton mealType="breakfast" onClick={handleScanButtonClick} />
                                <ScanButton mealType="lunch" onClick={handleScanButtonClick} />
                                <ScanButton mealType="dinner" onClick={handleScanButtonClick} />
                            </div>
                        </div>
                    </section>
                    
                    {/* Quick Stats (Placeholder) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800">
                            <h4 className="text-blue-800 dark:text-blue-300 font-bold text-lg">Total Meal Plans</h4>
                            <p className="text-3xl font-extrabold text-blue-900 dark:text-white mt-2">{mealPlans.length}</p>
                        </div>
                         <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-xl border border-green-100 dark:border-green-800">
                            <h4 className="text-green-800 dark:text-green-300 font-bold text-lg">Partner Restaurants</h4>
                            <p className="text-3xl font-extrabold text-green-900 dark:text-white mt-2">{restaurants.length}</p>
                        </div>
                    </div>
                </div>
            )}
            
            {activeTab === 'plans' && (
                <div className="animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                         <input 
                            type="text" 
                            placeholder="Search plans..." 
                            value={planSearch}
                            onChange={e => setPlanSearch(e.target.value)}
                            className="w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700"
                        />
                        <button onClick={() => { setEditingPlan(null); setPlanModalOpen(true); }} className="py-2 px-4 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary/90">+ Add Meal Plan</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredPlans.map(plan => (
                            <div key={plan.id} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-lg text-gray-900 dark:text-white">{plan.name}</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{plan.description}</p>
                                    <p className="text-xs font-semibold text-primary mt-2">Cost: {plan.dailyCost} Coins/Day</p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => { setEditingPlan(plan); setPlanModalOpen(true); }} className="px-3 py-1 text-xs font-medium text-primary bg-primary/10 rounded hover:bg-primary/20">Edit</button>
                                    <button onClick={() => handleDeletePlan(plan.id)} className="px-3 py-1 text-xs font-medium text-red-600 bg-red-100 dark:bg-red-900/30 rounded hover:bg-red-200">Delete</button>
                                </div>
                            </div>
                        ))}
                        {filteredPlans.length === 0 && <div className="col-span-full text-center py-10 text-gray-500 italic">No meal plans found.</div>}
                    </div>
                </div>
            )}

            {activeTab === 'restaurants' && (
                <div className="animate-fade-in">
                    <div className="flex justify-between items-center mb-4 gap-4">
                         <input 
                            type="text" 
                            placeholder="Search restaurants or cuisine..." 
                            value={restaurantSearch}
                            onChange={e => setRestaurantSearch(e.target.value)}
                            className="flex-grow max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700"
                        />
                        <button onClick={() => { setEditingRestaurant(null); setRestaurantModalOpen(true); }} className="py-2 px-4 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary/90 whitespace-nowrap">+ Add Restaurant</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredRestaurants.map(rest => (
                            <div key={rest.id} className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col">
                                <div className="p-4 flex-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-lg text-gray-900 dark:text-white">{rest.name}</h4>
                                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full">{rest.cuisine}</span>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {rest.operatingHours}
                                    </p>
                                    {rest.menu && (
                                        <div className="mt-3 text-xs text-gray-500 bg-gray-50 dark:bg-gray-900/50 p-2 rounded line-clamp-3 font-mono">
                                            {rest.menu}
                                        </div>
                                    )}
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700/30 px-4 py-3 flex justify-between items-center border-t border-gray-100 dark:border-gray-700">
                                    <button onClick={() => setViewingReservationsFor(rest)} className="text-xs font-bold text-primary hover:underline">View Reservations</button>
                                    <div className="space-x-2">
                                        <button onClick={() => { setEditingRestaurant(rest); setRestaurantModalOpen(true); }} className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-primary">Edit</button>
                                        <button onClick={() => handleDeleteRestaurant(rest.id)} className="text-xs font-medium text-red-500 hover:text-red-700">Delete</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                         {filteredRestaurants.length === 0 && <div className="col-span-full text-center py-10 text-gray-500 italic">No restaurants found.</div>}
                    </div>
                </div>
            )}

            <MealPlanEditorModal isOpen={isPlanModalOpen} onClose={() => setPlanModalOpen(false)} onSave={handleSavePlan} plan={editingPlan} adminToken={adminToken} />
            <RestaurantEditorModal isOpen={isRestaurantModalOpen} onClose={() => setRestaurantModalOpen(false)} onSave={handleSaveRestaurant} restaurant={editingRestaurant} adminToken={adminToken} />
            {viewingReservationsFor && <RestaurantReservationsModal isOpen={!!viewingReservationsFor} onClose={() => setViewingReservationsFor(null)} restaurant={viewingReservationsFor} adminToken={adminToken} />}
            <QRCodeScannerModal 
                isOpen={isScannerOpen} 
                onClose={() => setIsScannerOpen(false)} 
                onScan={handleScan} 
            />
        </div>
    );
};
