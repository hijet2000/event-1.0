
import React, { useState, useEffect } from 'react';
import { getDelegateProfile, getMealPlans } from '../server/api';
import { type DelegateProfile, type MealPlan } from '../types';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { ProfileView } from './ProfileView';
import { DiningView } from './DiningView';
import { AccommodationView } from './AccommodationView';
import { AgendaView } from './AgendaView';
import { DirectoryView } from './DirectoryView';
import { EventPassView } from './EventPassView';
import { WalletView } from './WalletView';
import { VirtualConcierge } from './VirtualConcierge';
import { NetworkingView } from './NetworkingView';
import { ScavengerHuntView } from './ScavengerHuntView';

interface DelegatePortalProps {
  onLogout: () => void;
  delegateToken: string;
}

const PortalTab: React.FC<{ label: string, isActive: boolean, onClick: () => void }> = ({ label, isActive, onClick }) => (
     <button onClick={onClick} className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
        {label}
    </button>
);

export const DelegatePortal: React.FC<DelegatePortalProps> = ({ onLogout, delegateToken }) => {
  const [profile, setProfile] = useState<DelegateProfile | null>(null);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize tab from URL query parameter
  const [activeTab, setActiveTab] = useState(() => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      const validTabs = ['profile', 'eventPass', 'wallet', 'agenda', 'directory', 'dining', 'accommodation', 'networking', 'gamification'];
      return validTabs.includes(tab || '') ? tab! : 'profile';
  });
  
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);

  const fetchProfile = async () => {
      try {
        setIsLoading(true);
        const [profileData, mealPlansData] = await Promise.all([
          getDelegateProfile(delegateToken),
          getMealPlans(delegateToken) // Assuming admin token is not needed for reads
        ]);
        setProfile(profileData);
        setMealPlans(mealPlansData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile.');
      } finally {
        setIsLoading(false);
      }
    };
    
  useEffect(() => {
    fetchProfile();
  }, [delegateToken]);

  // Deep Linking: Sync state with URL
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') !== activeTab) {
          params.set('tab', activeTab);
          const newUrl = `${window.location.pathname}?${params.toString()}`;
          try {
              window.history.pushState({ tab: activeTab }, '', newUrl);
          } catch (e) {
              // Sandbox restriction
              console.warn("History update failed (sandbox):", e);
          }
      }
  }, [activeTab]);

  // Deep Linking: Handle Back button
  useEffect(() => {
      const handlePopState = () => {
          const params = new URLSearchParams(window.location.search);
          const tab = params.get('tab');
          if (tab) setActiveTab(tab);
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleProfileUpdate = (updatedUser: any) => {
    if(profile) {
        setProfile({ ...profile, user: updatedUser });
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><ContentLoader text="Loading your portal..." /></div>;
  }
  
  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md mx-auto text-center">
          <Alert type="error" message={error || 'Could not load your profile.'} />
          <button onClick={onLogout} className="mt-4 px-4 py-2 bg-primary text-white rounded-md">
            Logout
          </button>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch(activeTab) {
        case 'profile':
            return <ProfileView user={profile.user} delegateToken={delegateToken} onProfileUpdate={handleProfileUpdate} />;
        case 'eventPass':
            return <EventPassView user={profile.user} />;
        case 'wallet':
            return <WalletView delegateToken={delegateToken} />;
        case 'agenda':
            return <AgendaView sessions={profile.sessions} speakers={profile.speakers} mySessionIds={profile.mySessionIds} delegateToken={delegateToken} />;
        case 'directory':
            return <DirectoryView speakers={profile.speakers} sponsors={profile.sponsors} />;
        case 'dining':
            return <DiningView mealPlanAssignment={profile.mealPlanAssignment} restaurants={profile.restaurants} mealPlans={mealPlans} delegateToken={delegateToken} onUpdate={fetchProfile} />;
        case 'accommodation':
            return <AccommodationView accommodationBooking={profile.accommodationBooking} hotels={profile.hotels} delegateToken={delegateToken} onUpdate={fetchProfile} />;
        case 'networking':
            return <NetworkingView delegateToken={delegateToken} />;
        case 'gamification':
            return <ScavengerHuntView delegateToken={delegateToken} />;
        default:
            return <ProfileView user={profile.user} delegateToken={delegateToken} onProfileUpdate={handleProfileUpdate} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 relative">
      <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">Delegate Portal</h1>
          <button onClick={onLogout} className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary">
            Logout
          </button>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8 pb-24">
        <div className="md:flex md:space-x-8">
            <aside className="md:w-1/4 lg:w-1/5 hidden md:block">
                <nav className="space-y-1">
                    <PortalTab label="My Profile" isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
                    <PortalTab label="Event Pass" isActive={activeTab === 'eventPass'} onClick={() => setActiveTab('eventPass')} />
                    <PortalTab label="Networking Hub" isActive={activeTab === 'networking'} onClick={() => setActiveTab('networking')} />
                    <PortalTab label="Scavenger Hunt" isActive={activeTab === 'gamification'} onClick={() => setActiveTab('gamification')} />
                    <PortalTab label="My Wallet" isActive={activeTab === 'wallet'} onClick={() => setActiveTab('wallet')} />
                    <PortalTab label="Agenda" isActive={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} />
                    <PortalTab label="Directory" isActive={activeTab === 'directory'} onClick={() => setActiveTab('directory')} />
                    <PortalTab label="Accommodation" isActive={activeTab === 'accommodation'} onClick={() => setActiveTab('accommodation')} />
                    <PortalTab label="Dining" isActive={activeTab === 'dining'} onClick={() => setActiveTab('dining')} />
                </nav>
            </aside>
            
            {/* Mobile Tabs */}
            <div className="md:hidden w-full mb-4 overflow-x-auto">
                <div className="flex space-x-2 pb-2">
                    <button onClick={() => setActiveTab('profile')} className={`whitespace-nowrap px-3 py-2 rounded-full text-sm font-medium ${activeTab === 'profile' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>Profile</button>
                    <button onClick={() => setActiveTab('networking')} className={`whitespace-nowrap px-3 py-2 rounded-full text-sm font-medium ${activeTab === 'networking' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>Networking</button>
                    <button onClick={() => setActiveTab('gamification')} className={`whitespace-nowrap px-3 py-2 rounded-full text-sm font-medium ${activeTab === 'gamification' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>Games</button>
                    <button onClick={() => setActiveTab('eventPass')} className={`whitespace-nowrap px-3 py-2 rounded-full text-sm font-medium ${activeTab === 'eventPass' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>Pass</button>
                    <button onClick={() => setActiveTab('agenda')} className={`whitespace-nowrap px-3 py-2 rounded-full text-sm font-medium ${activeTab === 'agenda' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>Agenda</button>
                </div>
            </div>

            <div className="md:w-3/4 lg:w-4/5 mt-0">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    {renderTabContent()}
                </div>
            </div>
        </div>
      </main>

      {/* Floating Concierge Button */}
      <button 
        onClick={() => setIsConciergeOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-primary to-secondary text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all z-40 flex items-center gap-2"
        aria-label="Open Virtual Concierge"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <span className="font-bold hidden sm:inline">Ask Concierge</span>
      </button>

      <VirtualConcierge 
        isOpen={isConciergeOpen} 
        onClose={() => setIsConciergeOpen(false)} 
        delegateToken={delegateToken}
      />
    </div>
  );
};
