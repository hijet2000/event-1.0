
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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
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

    const handleMobileTabClick = (tab: string) => {
        setActiveTab(tab);
        setIsMobileMenuOpen(false);
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
            {/* Sidebar (Desktop) */}
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
                <span className="font-bold text-lg truncate max-w-[200px]">{config?.event.name}</span>
                <div className="flex items-center gap-4">
                    <NotificationBell delegateToken={delegateToken} />
                </div>
            </div>

            {/* Mobile Menu Drawer */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}></div>
                    <div className="relative w-64 bg-white dark:bg-gray-800 shadow-xl flex flex-col h-full animate-fade-in">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <span className="font-bold text-lg text-primary">Menu</span>
                            <button onClick={() => setIsMobileMenuOpen(false)}>&times;</button>
                        </div>
                        <nav className="flex-1 overflow-y-auto py-4">
                            <PortalTab label="My Event Pass" isActive={activeTab === 'eventPass'} onClick={() => handleMobileTabClick('eventPass')} />
                            <PortalTab label="Agenda" isActive={activeTab === 'agenda'} onClick={() => handleMobileTabClick('agenda')} />
                            <PortalTab label="Venue Map" isActive={activeTab === 'map'} onClick={() => handleMobileTabClick('map')} />
                            <PortalTab label="Directory" isActive={activeTab === 'directory'} onClick={() => handleMobileTabClick('directory')} />
                            <div className="my-2 border-t border-gray-200 dark:border-gray-700"></div>
                            <PortalTab label="Networking Hub" isActive={activeTab === 'networking'} onClick={() => handleMobileTabClick('networking')} />
                            <PortalTab label="Messages" isActive={activeTab === 'messages'} onClick={() => handleMobileTabClick('messages')} />
                            <PortalTab label="Scavenger Hunt" isActive={activeTab === 'gamification'} onClick={() => handleMobileTabClick('gamification')} />
                            <div className="my-2 border-t border-gray-200 dark:border-gray-700"></div>
                            <PortalTab label="My Wallet" isActive={activeTab === 'wallet'} onClick={() => handleMobileTabClick('wallet')} />
                            <PortalTab label="Dining" isActive={activeTab === 'dining'} onClick={() => handleMobileTabClick('dining')} />
                            <PortalTab label="Accommodation" isActive={activeTab === 'accommodation'} onClick={() => handleMobileTabClick('accommodation')} />
                            <PortalTab label="Profile" isActive={activeTab === 'profile'} onClick={() => handleMobileTabClick('profile')} />
                        </nav>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                            <button onClick={onLogout} className="w-full py-2 px-4 border border-gray-300 dark:border-gray-600 rounded text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Logout</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-4 md:p-8 pt-20 md:pt-8 pb-24 md:pb-8 w-full max-w-full overflow-hidden">
                <div className="max-w-5xl mx-auto h-full">
                    <div className="flex justify-end mb-6 hidden md:flex">
                        <NotificationBell delegateToken={delegateToken} />
                    </div>
                    {renderTabContent()}
                </div>
            </main>

            {/* Mobile Bottom Nav */}
            <nav className="md:hidden fixed bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-between px-2 py-2 z-30 shadow-lg">
                <button onClick={() => setActiveTab('eventPass')} className={`flex flex-col items-center px-2 py-1 rounded-md ${activeTab === 'eventPass' ? 'text-primary' : 'text-gray-500'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                    <span className="text-[10px] mt-1">Pass</span>
                </button>
                <button onClick={() => setActiveTab('agenda')} className={`flex flex-col items-center px-2 py-1 rounded-md ${activeTab === 'agenda' ? 'text-primary' : 'text-gray-500'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-[10px] mt-1">Agenda</span>
                </button>
                <button onClick={() => setActiveTab('map')} className={`flex flex-col items-center px-2 py-1 rounded-md ${activeTab === 'map' ? 'text-primary' : 'text-gray-500'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9.553 4.553A1 1 0 009 3.618C9 3.618 9.553 4.553 15 7z" /></svg>
                    <span className="text-[10px] mt-1">Map</span>
                </button>
                <button onClick={() => setIsMobileMenuOpen(true)} className={`flex flex-col items-center px-2 py-1 rounded-md ${isMobileMenuOpen ? 'text-primary' : 'text-gray-500'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    <span className="text-[10px] mt-1">More</span>
                </button>
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
