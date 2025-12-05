
import React, { useState, useEffect } from 'react';
import { ProfileView } from './ProfileView';
import { EventPassView } from './EventPassView';
import { WalletView } from './WalletView';
import { AgendaView } from './AgendaView';
import { DirectoryView } from './DirectoryView';
import { DiningView } from './DiningView';
import { AccommodationView } from './AccommodationView';
import { NetworkingView } from './NetworkingView';
import { ScavengerHuntView } from './ScavengerHuntView';
import { ChatView } from './ChatView';
import { VenueMapView } from './VenueMapView';
import { NotificationBell } from './NotificationBell';
import { VirtualConcierge } from './VirtualConcierge';
import { useTheme } from '../contexts/ThemeContext';
import { getPublicEventData, getMyAgenda } from '../server/api';
import { Session, Speaker, Sponsor } from '../types';

interface DelegatePortalProps {
    onLogout: () => void;
    delegateToken: string;
}

const PortalTab: React.FC<{ label: string, isActive: boolean, onClick: () => void, icon?: React.ReactNode }> = ({ label, isActive, onClick, icon }) => (
    <button
        onClick={onClick}
        className={`flex items-center w-full px-4 py-3 text-left text-sm font-medium transition-colors ${isActive ? 'bg-primary/10 text-primary border-r-4 border-primary' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
    >
        {icon && <span className="mr-3">{icon}</span>}
        {label}
    </button>
);

export const DelegatePortal: React.FC<DelegatePortalProps> = ({ onLogout, delegateToken }) => {
    const [activeTab, setActiveTab] = useState('eventPass');
    const { config } = useTheme();
    const [isConciergeOpen, setIsConciergeOpen] = useState(false);
    
    // Data State
    const [sessions, setSessions] = useState<Session[]>([]);
    const [speakers, setSpeakers] = useState<Speaker[]>([]);
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [mySessionIds, setMySessionIds] = useState<string[]>([]);

    useEffect(() => {
        // Load basic event data and my agenda
        const loadData = async () => {
            const eventData = await getPublicEventData('main-event'); // assuming main event for now
            setSessions(eventData.sessions);
            setSpeakers(eventData.speakers);
            setSponsors(eventData.sponsors);
            
            const myAgenda = await getMyAgenda(delegateToken);
            setMySessionIds(myAgenda);
        };
        loadData();
    }, [delegateToken]);

    const handleToggleSession = (sessionId: string, isAdded: boolean) => {
        setMySessionIds(prev => isAdded ? [...prev, sessionId] : prev.filter(id => id !== sessionId));
        // The API call is handled inside AgendaView, but we update local state here to reflect immediately if needed
    };

    // Placeholder data for views that need props but API hasn't loaded yet
    // In a real app, these would be fetched via hooks in the views or here
    const mockUser = { id: '123', name: 'Delegate', email: 'delegate@example.com', createdAt: Date.now() };

    const renderTabContent = () => {
        switch(activeTab) {
            case 'profile': return <ProfileView user={mockUser} delegateToken={delegateToken} onProfileUpdate={() => {}} />;
            case 'eventPass': return <EventPassView user={mockUser} />;
            case 'wallet': return <WalletView delegateToken={delegateToken} />;
            case 'agenda': return <AgendaView sessions={sessions} speakers={speakers} mySessionIds={mySessionIds} delegateToken={delegateToken} onToggleSession={handleToggleSession} />;
            case 'directory': return <DirectoryView speakers={speakers} sponsors={sponsors} />;
            case 'dining': return <DiningView mealPlanAssignment={null} restaurants={[]} mealPlans={[]} delegateToken={delegateToken} onUpdate={() => {}} />;
            case 'accommodation': return <AccommodationView accommodationBooking={null} delegateToken={delegateToken} onUpdate={() => {}} />;
            case 'networking': return <NetworkingView delegateToken={delegateToken} />;
            case 'gamification': return <ScavengerHuntView delegateToken={delegateToken} />;
            case 'messages': return <ChatView delegateToken={delegateToken} />;
            case 'map': return <VenueMapView delegateToken={delegateToken} />;
            default: return <EventPassView user={mockUser} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-gray-800 shadow-md hidden md:flex flex-col fixed h-full z-20">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    {config?.theme.logoUrl ? (
                        <img src={config.theme.logoUrl} alt="Logo" className="h-8 w-auto" />
                    ) : (
                        <span className="font-bold text-xl text-primary">{config?.event.name || 'Event Portal'}</span>
                    )}
                </div>
                <nav className="flex-1 overflow-y-auto py-4">
                    <PortalTab label="My Event Pass" isActive={activeTab === 'eventPass'} onClick={() => setActiveTab('eventPass')} />
                    <PortalTab label="Agenda" isActive={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} />
                    <PortalTab label="Venue Map" isActive={activeTab === 'map'} onClick={() => setActiveTab('map')} />
                    <PortalTab label="Directory" isActive={activeTab === 'directory'} onClick={() => setActiveTab('directory')} />
                    <div className="my-2 border-t border-gray-200 dark:border-gray-700"></div>
                    <PortalTab label="Networking Hub" isActive={activeTab === 'networking'} onClick={() => setActiveTab('networking')} />
                    <PortalTab label="Messages" isActive={activeTab === 'messages'} onClick={() => setActiveTab('messages')} />
                    <PortalTab label="Scavenger Hunt" isActive={activeTab === 'gamification'} onClick={() => setActiveTab('gamification')} />
                    <div className="my-2 border-t border-gray-200 dark:border-gray-700"></div>
                    <PortalTab label="My Wallet" isActive={activeTab === 'wallet'} onClick={() => setActiveTab('wallet')} />
                    <PortalTab label="Dining" isActive={activeTab === 'dining'} onClick={() => setActiveTab('dining')} />
                    <PortalTab label="Accommodation" isActive={activeTab === 'accommodation'} onClick={() => setActiveTab('accommodation')} />
                    <PortalTab label="Profile" isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
                </nav>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <button onClick={onLogout} className="w-full py-2 px-4 border border-gray-300 dark:border-gray-600 rounded text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Logout</button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 w-full bg-white dark:bg-gray-800 shadow-sm z-30 p-4 flex justify-between items-center">
                <span className="font-bold text-lg">{config?.event.name}</span>
                <div className="flex items-center gap-4">
                    <NotificationBell delegateToken={delegateToken} />
                    <button onClick={onLogout} className="text-sm text-gray-500">Logout</button>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-4 md:p-8 pt-20 md:pt-8 pb-24 md:pb-8">
                <div className="max-w-5xl mx-auto">
                    <div className="flex justify-end mb-6 hidden md:flex">
                        <NotificationBell delegateToken={delegateToken} />
                    </div>
                    {renderTabContent()}
                </div>
            </main>

            {/* Mobile Bottom Nav */}
            <nav className="md:hidden fixed bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around p-3 z-30 overflow-x-auto">
                <button onClick={() => setActiveTab('eventPass')} className={`whitespace-nowrap px-3 py-2 rounded-full text-sm font-medium ${activeTab === 'eventPass' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>Pass</button>
                <button onClick={() => setActiveTab('agenda')} className={`whitespace-nowrap px-3 py-2 rounded-full text-sm font-medium ${activeTab === 'agenda' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>Agenda</button>
                <button onClick={() => setActiveTab('map')} className={`whitespace-nowrap px-3 py-2 rounded-full text-sm font-medium ${activeTab === 'map' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>Map</button>
                <button onClick={() => setActiveTab('networking')} className={`whitespace-nowrap px-3 py-2 rounded-full text-sm font-medium ${activeTab === 'networking' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>Network</button>
            </nav>

            {/* AI Assistant FAB */}
            <button
                onClick={() => setIsConciergeOpen(true)}
                className="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-110 transition-transform z-40"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
            </button>

            <VirtualConcierge isOpen={isConciergeOpen} onClose={() => setIsConciergeOpen(false)} delegateToken={delegateToken} />
        </div>
    );
};
