
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
import { VirtualStage } from './VirtualStage';
import { CommunityWall } from './CommunityWall';
import { NotificationBell } from './NotificationBell';
import { VirtualConcierge } from './VirtualConcierge';
import { useTheme } from '../contexts/ThemeContext';
import { getPublicEventData, getMyAgenda, getDelegateProfile } from '../server/api';
import { Session, Speaker, Sponsor, RegistrationData } from '../types';

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
    const [activeTab, setActiveTab] = useState('virtualStage');
    const { config } = useTheme();
    const [isConciergeOpen, setIsConciergeOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    const [sessions, setSessions] = useState<Session[]>([]);
    const [speakers, setSpeakers] = useState<Speaker[]>([]);
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [mySessionIds, setMySessionIds] = useState<string[]>([]);
    const [user, setUser] = useState<RegistrationData | null>(null);

    useEffect(() => {
        const loadData = async () => {
            const profile = await getDelegateProfile(delegateToken);
            setUser(profile.user);

            const eventData = await getPublicEventData('main-event');
            setSessions(eventData.sessions);
            setSpeakers(eventData.speakers);
            setSponsors(eventData.sponsors);
            
            const myAgenda = await getMyAgenda(delegateToken);
            setMySessionIds(myAgenda);
        };
        loadData();
    }, [delegateToken]);

    const renderTabContent = () => {
        if (!user) return null;
        switch(activeTab) {
            case 'virtualStage': return <VirtualStage delegateToken={delegateToken} />;
            case 'communityWall': return <CommunityWall delegateToken={delegateToken} />;
            case 'profile': return <ProfileView user={user} delegateToken={delegateToken} onProfileUpdate={setUser} />;
            case 'eventPass': return <EventPassView user={user} />;
            case 'wallet': return <WalletView delegateToken={delegateToken} />;
            case 'agenda': return <AgendaView sessions={sessions} speakers={speakers} mySessionIds={mySessionIds} delegateToken={delegateToken} />;
            case 'directory': return <DirectoryView speakers={speakers} sponsors={sponsors} />;
            case 'dining': return <DiningView mealPlanAssignment={null} restaurants={[]} mealPlans={[]} delegateToken={delegateToken} onUpdate={() => {}} />;
            case 'accommodation': return <AccommodationView accommodationBooking={null} delegateToken={delegateToken} onUpdate={() => {}} />;
            case 'networking': return <NetworkingView delegateToken={delegateToken} />;
            case 'gamification': return <ScavengerHuntView delegateToken={delegateToken} />;
            case 'messages': return <ChatView delegateToken={delegateToken} />;
            case 'map': return <VenueMapView delegateToken={delegateToken} />;
            default: return <VirtualStage delegateToken={delegateToken} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
            <aside className="w-64 bg-white dark:bg-gray-800 shadow-md hidden md:flex flex-col fixed h-full z-20">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <span className="font-bold text-xl text-primary">{config?.event.name || 'Event Portal'}</span>
                </div>
                <nav className="flex-1 overflow-y-auto py-4">
                    <PortalTab label="📺 Watch Live" isActive={activeTab === 'virtualStage'} onClick={() => setActiveTab('virtualStage')} />
                    <PortalTab label="📸 Community Wall" isActive={activeTab === 'communityWall'} onClick={() => setActiveTab('communityWall')} />
                    <PortalTab label="📅 My Agenda" isActive={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} />
                    <PortalTab label="🎟️ My Pass" isActive={activeTab === 'eventPass'} onClick={() => setActiveTab('eventPass')} />
                    <div className="my-2 border-t border-gray-200 dark:border-gray-700"></div>
                    <PortalTab label="📍 Venue Map" isActive={activeTab === 'map'} onClick={() => setActiveTab('map')} />
                    <PortalTab label="🤝 Networking" isActive={activeTab === 'networking'} onClick={() => setActiveTab('networking')} />
                    <PortalTab label="💬 Messages" isActive={activeTab === 'messages'} onClick={() => setActiveTab('messages')} />
                    <PortalTab label="🎮 Scavenger Hunt" isActive={activeTab === 'gamification'} onClick={() => setActiveTab('gamification')} />
                    <div className="my-2 border-t border-gray-200 dark:border-gray-700"></div>
                    <PortalTab label="💳 Wallet" isActive={activeTab === 'wallet'} onClick={() => setActiveTab('wallet')} />
                    <PortalTab label="👤 Profile" isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
                </nav>
            </aside>

            <main className="flex-1 md:ml-64 p-4 md:p-8 pt-20 md:pt-8 pb-24 md:pb-8 w-full max-w-full overflow-hidden">
                <div className="max-w-5xl mx-auto h-full">
                    {renderTabContent()}
                </div>
            </main>

            <button
                onClick={() => setIsConciergeOpen(true)}
                className="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-lg flex items-center justify-center text-white z-40"
            >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
            <VirtualConcierge isOpen={isConciergeOpen} onClose={() => setIsConciergeOpen(false)} delegateToken={delegateToken} />
        </div>
    );
};
