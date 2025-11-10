import React, { useState, useEffect } from 'react';
import { getDelegateProfile } from '../server/api';
import { type DelegateProfile } from '../types';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { ProfileView } from './ProfileView';
import { DiningView } from './DiningView';
import { AccommodationView } from './AccommodationView';

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileData = await getDelegateProfile(delegateToken);
        setProfile(profileData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [delegateToken]);

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
        case 'dining':
            return <DiningView mealPlanAssignment={profile.mealPlanAssignment} restaurants={profile.restaurants} />;
        case 'accommodation':
            return <AccommodationView accommodationBooking={profile.accommodationBooking} />;
        default:
            return <p>Select a tab to view content.</p>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">Delegate Portal</h1>
          <button onClick={onLogout} className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary">
            Logout
          </button>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="md:flex md:space-x-8">
            <aside className="md:w-1/4 lg:w-1/5">
                <nav className="space-y-1">
                    <PortalTab label="My Profile" isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
                    <PortalTab label="Dining" isActive={activeTab === 'dining'} onClick={() => setActiveTab('dining')} />
                    <PortalTab label="Accommodation" isActive={activeTab === 'accommodation'} onClick={() => setActiveTab('accommodation')} />
                </nav>
            </aside>
            <div className="md:w-3/4 lg:w-4/5 mt-6 md:mt-0">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    {renderTabContent()}
                </div>
            </div>
        </div>
      </main>
    </div>
  );
};
