import React, { useState, useEffect } from 'react';
import { listPublicEvents } from '../server/api';
import { type PublicEvent } from '../types';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { AdminLoginModal } from './AdminLoginModal';

const EventCard: React.FC<{ event: PublicEvent }> = ({ event }) => (
    <a 
        href={`/${event.id}`} 
        className="block group bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 overflow-hidden border-b-4 border-transparent group-hover:border-[var(--event-color)]"
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
    </a>
);

export const EventSelectionPage: React.FC = () => {
    const [events, setEvents] = useState<PublicEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdminModalOpen, setAdminModalOpen] = useState(false);

    useEffect(() => {
        listPublicEvents()
            .then(setEvents)
            .catch(() => setError("Could not load available events. Please try again later."))
            .finally(() => setIsLoading(false));

        // Check for admin login trigger in URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('admin') === 'true') {
            setAdminModalOpen(true);
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const handleAdminLoginSuccess = () => {
        // Redirect to root. The App component will detect the token and show the admin portal.
        window.location.href = '/';
    };
    
    return (
        <div className="bg-background-color min-h-screen font-sans text-gray-800 dark:text-gray-200">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <header className="text-center">
                    <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
                        Welcome to the Event Platform
                    </h1>
                    <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400">
                        Please select an event to view details or register.
                    </p>
                </header>

                <main className="mt-12">
                    {isLoading && <ContentLoader text="Loading events..." />}
                    {error && <Alert type="error" message={error} />}
                    
                    {!isLoading && !error && (
                        events.length > 0 ? (
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                {events.map(event => <EventCard key={event.id} event={event} />)}
                            </div>
                        ) : (
                            <div className="text-center py-16 px-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Events Found</h3>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">There are currently no public events available.</p>
                            </div>
                        )
                    )}
                </main>
                
                 <footer className="mt-16 text-center text-sm text-gray-500 dark:text-gray-400">
                    <button onClick={() => setAdminModalOpen(true)} className="hover:text-primary transition">Admin Login</button>
                 </footer>
            </div>

            <AdminLoginModal 
                isOpen={isAdminModalOpen}
                onClose={() => setAdminModalOpen(false)}
                onLoginSuccess={handleAdminLoginSuccess}
            />
        </div>
    );
};