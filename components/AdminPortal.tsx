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

type AdminView = 'dashboard' | 'registrations' | 'settings' | 'users' | 'tasks' | 'dining' | 'hotels' | 'id_design';

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
  const [view, setView] = useState<AdminView>('dashboard');
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  
  useEffect(() => {
    listPublicEvents().then(events => {
        setEvents(events);
        if (events.length > 0) {
            setSelectedEventId(events[0].id);
        }
    });
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
        return <AdminDashboard user={user} adminToken={adminToken} />;
      case 'registrations':
        return <RegistrationsDashboard adminToken={adminToken} permissions={user.permissions} />;
      case 'settings':
        return <SettingsForm adminToken={adminToken} />;
      case 'users':
          return <UsersAndRolesDashboard adminToken={adminToken} />;
      case 'tasks':
        return <TasksDashboard adminToken={adminToken} />;
      case 'dining':
        return <DiningDashboard adminToken={adminToken} />;
      case 'hotels':
        return <HotelsDashboard adminToken={adminToken} />;
      case 'id_design':
        return <EventIdDesign adminToken={adminToken} />;
      default:
        return <div>Select a view</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <header className="bg-white dark:bg-gray-800 shadow-md">
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
            <aside className="md:w-1/4 lg:w-1/5">
                <nav className="space-y-1 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                    <NavLink label="Dashboard" isActive={view === 'dashboard'} onClick={() => setView('dashboard')} userPermissions={user.permissions} permission="view_dashboard" />
                    <NavLink label="Registrations" isActive={view === 'registrations'} onClick={() => setView('registrations')} userPermissions={user.permissions} permission="manage_registrations" />
                    <NavLink label="Task Board" isActive={view === 'tasks'} onClick={() => setView('tasks')} userPermissions={user.permissions} permission="manage_tasks" />
                    <NavLink label="Dining" isActive={view === 'dining'} onClick={() => setView('dining')} userPermissions={user.permissions} permission="manage_dining" />
                    <NavLink label="Hotels" isActive={view === 'hotels'} onClick={() => setView('hotels')} userPermissions={user.permissions} permission="manage_accommodation" />
                    <NavLink label="ID Design" isActive={view === 'id_design'} onClick={() => setView('id_design')} userPermissions={user.permissions} permission="manage_settings" />
                    <NavLink label="Settings" isActive={view === 'settings'} onClick={() => setView('settings')} userPermissions={user.permissions} permission="manage_settings" />
                    <NavLink label="Users & Roles" isActive={view === 'users'} onClick={() => setView('users')} userPermissions={user.permissions} permission="manage_users" />
                </nav>
            </aside>
            <div className="md:w-3/4 lg:w-4/5 mt-6 md:mt-0">
                {renderView()}
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
