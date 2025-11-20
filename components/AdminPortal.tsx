
import React, { useState, useEffect } from 'react';
import { type Permission, type PublicEvent, type EventData } from '../types';
import { AdminDashboard } from './AdminDashboard';
import { RegistrationsDashboard } from './RegistrationsDashboard';
import { SettingsForm } from './SettingsForm';
import { UsersAndRolesDashboard } from './UsersAndRolesDashboard';
import { EventSelector } from './EventSelector';
import { CreateEventModal } from './CreateEventModal';
import { listPublicEvents, createEvent as apiCreateEvent } from '../server/api';
import { TasksDashboard } from './TasksDashboard';
import { DiningDashboard } from './DiningDashboard';
import { HotelsDashboard } from './HotelsDashboard';
import { EventIdDesign } from './EventIdDesign';
import { EventCoinDashboard } from './EventCoinDashboard';
import { AgendaDashboard } from './AgendaDashboard';
import { SpeakersSponsorsDashboard } from './SpeakersSponsorsDashboard';
import { VideoGenerator } from './VideoGenerator';
import { SystemStatus } from './SystemStatus';
import { CommunicationsDashboard } from './CommunicationsDashboard';
import { MediaDashboard } from './MediaDashboard';
import { TestDashboard } from './TestDashboard';
import { GamificationDashboard } from './GamificationDashboard';
import { ThemeProvider } from '../contexts/ThemeContext';

type AdminView = 'dashboard' | 'registrations' | 'settings' | 'users' | 'tasks' | 'dining' | 'hotels' | 'id_design' | 'eventcoin' | 'agenda' | 'speakers_sponsors' | 'marketing' | 'system' | 'communications' | 'media' | 'tests' | 'gamification';

interface AdminPortalProps {
  onLogout: () => void;
  adminToken: string;
  user: { email: string; permissions: Permission[] };
}

const NavLink: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
    permission?: Permission;
    userPermissions: Permission[];
}> = ({ label, isActive, onClick, permission, userPermissions }) => {
    if (permission && !userPermissions.includes(permission)) {
        return null;
    }
    return (
        <button
            onClick={onClick}
            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
            {label}
        </button>
    );
};

export const AdminPortal: React.FC<AdminPortalProps> = ({ onLogout, adminToken, user }) => {
  // Initialize view from URL param if valid, else default to 'dashboard'
  const [view, setView] = useState<AdminView>(() => {
      const params = new URLSearchParams(window.location.search);
      const urlView = params.get('view') as AdminView;
      const validViews: AdminView[] = ['dashboard', 'registrations', 'settings', 'users', 'tasks', 'dining', 'hotels', 'id_design', 'eventcoin', 'agenda', 'speakers_sponsors', 'marketing', 'system', 'communications', 'media', 'tests', 'gamification'];
      return validViews.includes(urlView) ? urlView : 'dashboard';
  });
  
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  
  useEffect(() => {
    listPublicEvents().then(events => {
        setEvents(events);
        if (events.length > 0) {
            // Only set if not already set (e.g. via URL param in future enhancement)
            if (!selectedEventId) setSelectedEventId(events[0].id);
        }
    }).catch(e => console.error("Failed to list events", e));
  }, []);

  // Deep Linking: Update URL when view changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') !== view) {
        params.set('view', view);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        try {
            window.history.pushState({ view }, '', newUrl);
        } catch (e) {
            // Sandbox restriction handling
            console.warn("History update failed (sandbox):", e);
        }
    }
  }, [view]);

  // Deep Linking: Handle Back/Forward browser buttons
  useEffect(() => {
      const handlePopState = () => {
          const params = new URLSearchParams(window.location.search);
          const urlView = params.get('view') as AdminView;
          if (urlView && urlView !== view) {
              setView(urlView);
          } else if (!urlView) {
              setView('dashboard');
          }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  
  const handleCreateEvent = async (name: string, type: string) => {
    try {
        const newEvent = await apiCreateEvent(adminToken, name, type);
        setEvents(prev => [...prev, { id: newEvent.id, name: newEvent.name, date: newEvent.config.event.date, location: newEvent.config.event.location, logoUrl: '', colorPrimary: '' }]);
        setSelectedEventId(newEvent.id);
        setCreateModalOpen(false);
        return true;
    } catch(e) {
        return false;
    }
  };

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <AdminDashboard user={user} adminToken={adminToken} onNavigate={(v) => setView(v as AdminView)} />;
      case 'registrations':
        return <RegistrationsDashboard adminToken={adminToken} permissions={user.permissions} />;
      case 'settings':
        return <SettingsForm adminToken={adminToken} />;
      case 'users':
          return <UsersAndRolesDashboard adminToken={adminToken} />;
      case 'tasks':
        return <TasksDashboard adminToken={adminToken} />;
      case 'agenda':
        return <AgendaDashboard adminToken={adminToken} />;
      case 'speakers_sponsors':
        return <SpeakersSponsorsDashboard adminToken={adminToken} />;
      case 'dining':
        return <DiningDashboard adminToken={adminToken} />;
      case 'hotels':
        return <HotelsDashboard adminToken={adminToken} />;
      case 'id_design':
        return <EventIdDesign adminToken={adminToken} />;
      case 'eventcoin':
        return <EventCoinDashboard adminToken={adminToken} />;
      case 'marketing':
        return <VideoGenerator />;
      case 'communications':
        return <CommunicationsDashboard adminToken={adminToken} />;
      case 'media':
        return <MediaDashboard adminToken={adminToken} />;
      case 'system':
        return <SystemStatus adminToken={adminToken} />;
      case 'gamification':
        return <GamificationDashboard adminToken={adminToken} />;
      case 'tests':
        return <TestDashboard adminToken={adminToken} />;
      default:
        return <div>Select a view</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
                 <EventSelector 
                    events={events}
                    selectedEventId={selectedEventId}
                    onSelectEvent={setSelectedEventId}
                    onCreateEvent={() => setCreateModalOpen(true)}
                    canCreate={true} // Assuming super admin can always create
                 />
            </div>
            <div className="flex items-center space-x-4">
                <span className="text-sm hidden sm:block">Welcome, {user.email}</span>
                <button onClick={onLogout} className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary">
                    Logout
                </button>
            </div>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="md:flex md:space-x-8">
            <aside className="md:w-1/4 lg:w-1/5 hidden md:block sticky top-24 h-[calc(100vh-8rem)] overflow-y-auto">
                <nav className="space-y-1 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                    <NavLink label="Dashboard" isActive={view === 'dashboard'} onClick={() => setView('dashboard')} userPermissions={user.permissions} permission="view_dashboard" />
                    <NavLink label="Registrations" isActive={view === 'registrations'} onClick={() => setView('registrations')} userPermissions={user.permissions} permission="manage_registrations" />
                    <NavLink label="Task Board" isActive={view === 'tasks'} onClick={() => setView('tasks')} userPermissions={user.permissions} permission="manage_tasks" />
                    <NavLink label="Agenda" isActive={view === 'agenda'} onClick={() => setView('agenda')} userPermissions={user.permissions} permission="manage_agenda" />
                    <NavLink label="Speakers & Sponsors" isActive={view === 'speakers_sponsors'} onClick={() => setView('speakers_sponsors')} userPermissions={user.permissions} permission="manage_speakers_sponsors" />
                    <NavLink label="Dining" isActive={view === 'dining'} onClick={() => setView('dining')} userPermissions={user.permissions} permission="manage_dining" />
                    <NavLink label="Hotels" isActive={view === 'hotels'} onClick={() => setView('hotels')} userPermissions={user.permissions} permission="manage_accommodation" />
                    <NavLink label="ID Design" isActive={view === 'id_design'} onClick={() => setView('id_design')} userPermissions={user.permissions} permission="manage_settings" />
                    <NavLink label="EventCoin" isActive={view === 'eventcoin'} onClick={() => setView('eventcoin')} userPermissions={user.permissions} permission="view_eventcoin_dashboard" />
                    <NavLink label="Scavenger Hunt" isActive={view === 'gamification'} onClick={() => setView('gamification')} userPermissions={user.permissions} permission="manage_settings" />
                    <NavLink label="Media Library" isActive={view === 'media'} onClick={() => setView('media')} userPermissions={user.permissions} permission="manage_settings" />
                    <NavLink label="Marketing (Video)" isActive={view === 'marketing'} onClick={() => setView('marketing')} userPermissions={user.permissions} permission="manage_settings" />
                    <NavLink label="Communications" isActive={view === 'communications'} onClick={() => setView('communications')} userPermissions={user.permissions} permission="manage_registrations" />
                    <NavLink label="Settings" isActive={view === 'settings'} onClick={() => setView('settings')} userPermissions={user.permissions} permission="manage_settings" />
                    <NavLink label="Users & Roles" isActive={view === 'users'} onClick={() => setView('users')} userPermissions={user.permissions} permission="manage_users" />
                    
                    <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                        <NavLink label="System Status" isActive={view === 'system'} onClick={() => setView('system')} userPermissions={user.permissions} permission="manage_settings" />
                        <NavLink label="System Tests" isActive={view === 'tests'} onClick={() => setView('tests')} userPermissions={user.permissions} permission="manage_settings" />
                    </div>
                </nav>
            </aside>
            
            {/* Mobile Navigation Menu (Dropdown) */}
            <div className="md:hidden w-full mb-4">
                 <select 
                    value={view} 
                    onChange={(e) => setView(e.target.value as AdminView)}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2"
                 >
                    <option value="dashboard">Dashboard</option>
                    <option value="registrations">Registrations</option>
                    <option value="tasks">Task Board</option>
                    <option value="agenda">Agenda</option>
                    <option value="speakers_sponsors">Speakers & Sponsors</option>
                    <option value="dining">Dining</option>
                    <option value="hotels">Hotels</option>
                    <option value="id_design">ID Design</option>
                    <option value="eventcoin">EventCoin</option>
                    <option value="gamification">Scavenger Hunt</option>
                    <option value="media">Media Library</option>
                    <option value="marketing">Marketing</option>
                    <option value="communications">Communications</option>
                    <option value="settings">Settings</option>
                    <option value="users">Users & Roles</option>
                    <option value="system">System Status</option>
                    <option value="tests">System Tests</option>
                 </select>
            </div>

            <div className="md:w-3/4 lg:w-4/5 mt-0">
                {/* Ensure ThemeProvider wraps the dynamic content so components like SettingsForm can useTheme() */}
                <ThemeProvider eventId={selectedEventId || 'main-event'}>
                    {renderView()}
                </ThemeProvider>
            </div>
        </div>
      </main>
      <CreateEventModal 
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={(newEvent: EventData) => {
             setEvents(prev => [...prev, { id: newEvent.id, name: newEvent.name, date: newEvent.config.event.date, location: newEvent.config.event.location, logoUrl: '', colorPrimary: '' }]);
             setSelectedEventId(newEvent.id);
             setCreateModalOpen(false);
        }}
        adminToken={adminToken}
      />
    </div>
  );
};
