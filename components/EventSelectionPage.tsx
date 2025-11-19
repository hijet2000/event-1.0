
import React, { useState, useEffect } from 'react';
import { listPublicEvents, createEvent } from '../server/api';
import { type PublicEvent, type Permission } from '../types';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { AdminLoginModal } from './AdminLoginModal';

interface EventSelectionPageProps {
    onAdminLogin: (token: string, user: { id: string, email: string, permissions: Permission[] }) => void;
    onNavigate: (path: string) => void;
}

const EventCard: React.FC<{ event: PublicEvent, onNavigate: (path: string) => void }> = ({ event, onNavigate }) => (
    <div 
        onClick={() => onNavigate(`/${event.id}`)} 
        className="cursor-pointer block group bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 overflow-hidden border-b-4 border-transparent group-hover:border-[var(--event-color)]"
        style={{ '--event-color': event.colorPrimary } as React.CSSProperties}
    >
        <div className="h-40 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            {event.logoUrl ? (
                <img src={event.logoUrl} alt={`${event.name} Logo`} className="h-24 w-auto object-contain" />
            ) : (
                <div 
                    className="h-24 w-24 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${event.colorPrimary}20` }} // Primary color with 20% opacity
                >
                     <svg 
                        className="h-12 w-12" 
                        style={{ color: event.colorPrimary }}
                        viewBox="0 0 100 100" 
                        fill="none" 
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path d="M50 0L93.3 25V75L50 100L6.7 75V25L50 0Z" stroke="currentColor" strokeWidth="8"/>
                        <path d="M50 22L76.5 37V63L50 78L23.5 63V37L50 22Z" fill="currentColor" />
                    </svg>
                </div>
            )}
        </div>
        <div className="p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{event.name}</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{event.date} &bull; {event.location}</p>
        </div>
    </div>
);

export const EventSelectionPage: React.FC<EventSelectionPageProps> = ({ onAdminLogin, onNavigate }) => {
    const [events, setEvents] = useState<PublicEvent[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdminModalOpen, setAdminModalOpen] = useState(false);

    useEffect(() => {
        loadEvents();

        // Check both query param AND pathname for admin trigger
        const urlParams = new URLSearchParams(window.location.search);
        const isAdminPath = window.location.pathname === '/admin' || window.location.pathname === '/admin/';
        
        if (urlParams.get('admin') === 'true' || isAdminPath) {
            setAdminModalOpen(true);
            // Clean up URL to avoid stuck state, but be careful not to remove other params if they existed
            if (urlParams.get('admin') === 'true') {
                const newUrl = window.location.pathname;
                try {
                    window.history.replaceState({}, document.title, newUrl);
                } catch (e) {
                    console.warn("History cleanup failed (sandbox):", e);
                }
            }
        }
    }, []);

    const loadEvents = () => {
        setIsLoading(true);
        listPublicEvents()
            .then(setEvents)
            .catch(() => setError("Could not load available events. Please try again later."))
            .finally(() => setIsLoading(false));
    };

    const handleCreateDefault = async () => {
        try {
            // Use mock token for initial setup recovery
            await createEvent('mock-token', 'Default Event', 'Conference');
            loadEvents();
        } catch (e) {
            alert("Failed to create default event.");
        }
    };

    const filteredEvents = events.filter(event => 
        (event.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.location || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen font-sans text-gray-800 dark:text-gray-200 flex flex-col relative">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-grow relative z-0">
                <header className="text-center">
                    <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
                        Welcome to the Event Platform
                    </h1>
                    <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400">
                        Please select an event to view details or register.
                    </p>
                </header>

                <div className="max-w-md mx-auto mt-8 mb-12">
                    <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            className="focus:ring-primary focus:border-primary block w-full pl-10 pr-10 sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md py-3 shadow-sm"
                            placeholder="Search by event name or location..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                <main>
                    {isLoading && <ContentLoader text="Loading events..." />}
                    {error && <Alert type="error" message={error} />}
                    
                    {!isLoading && !error && (
                        filteredEvents.length > 0 ? (
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                {filteredEvents.map(event => <EventCard key={event.id} event={event} onNavigate={onNavigate} />)}
                            </div>
                        ) : (
                            <div className="text-center py-16 px-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                    {events.length === 0 ? "No Events Found" : "No Matches Found"}
                                </h3>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {events.length === 0 
                                        ? "There are currently no public events available." 
                                        : "Try adjusting your search criteria."}
                                </p>
                                {events.length === 0 && (
                                    <button 
                                        onClick={handleCreateDefault}
                                        className="mt-6 px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary/90"
                                    >
                                        Initialize Default Event
                                    </button>
                                )}
                                {searchQuery && events.length > 0 && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="mt-4 text-primary hover:underline"
                                    >
                                        Clear Search
                                    </button>
                                )}
                            </div>
                        )
                    )}
                </main>
            </div>
            
            <footer className="mt-auto text-center text-sm text-gray-500 dark:text-gray-400 py-8 relative z-10 border-t border-gray-200 dark:border-gray-700">
                <button 
                    type="button" 
                    onClick={() => setAdminModalOpen(true)} 
                    className="hover:text-primary transition cursor-pointer underline decoration-transparent hover:decoration-primary underline-offset-4"
                >
                    Admin Login
                </button>
            </footer>

            <AdminLoginModal 
                isOpen={isAdminModalOpen}
                onClose={() => setAdminModalOpen(false)}
                onLoginSuccess={onAdminLogin}
            />
        </div>
    );
};
