
import React, { useState } from 'react';
import { AdminDashboard } from './AdminDashboard';
import { RegistrationsDashboard } from './RegistrationsDashboard';
import { SettingsForm } from './SettingsForm';
import { UsersAndRolesDashboard } from './UsersAndRolesDashboard';
import { TasksDashboard } from './TasksDashboard';
import { DiningDashboard } from './DiningDashboard';
import { HotelsDashboard } from './HotelsDashboard';
import { AgendaDashboard } from './AgendaDashboard';
import { SpeakersSponsorsDashboard } from './SpeakersSponsorsDashboard';
import { EventCoinDashboard } from './EventCoinDashboard';
import { EventIdDesign } from './EventIdDesign';
import { SystemStatus } from './SystemStatus';
import { CommunicationsDashboard } from './CommunicationsDashboard';
import { MediaDashboard } from './MediaDashboard';
import { VideoGenerator } from './VideoGenerator';
import { TestDashboard } from './TestDashboard';
import { GamificationDashboard } from './GamificationDashboard';
import { TicketTiersDashboard } from './TicketTiersDashboard';
import { MapDashboard } from './MapDashboard';
import { Permission } from '../types';

type AdminView = 'dashboard' | 'registrations' | 'settings' | 'users' | 'tasks' | 'dining' | 'hotels' | 'id_design' | 'eventcoin' | 'agenda' | 'speakers_sponsors' | 'marketing' | 'system' | 'communications' | 'media' | 'tests' | 'gamification' | 'ticketing' | 'maps';

interface AdminPortalProps {
  onLogout: () => void;
  adminToken: string;
  user: { email: string; permissions: Permission[] };
}

const NavLink: React.FC<{ label: string, isActive: boolean, onClick: () => void, userPermissions: Permission[], permission?: Permission }> = ({ label, isActive, onClick, userPermissions, permission }) => {
    if (permission && !userPermissions.includes(permission)) return null;
    return (
        <button
            onClick={onClick}
            className={`flex items-center w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${isActive ? 'bg-primary/10 text-primary border-r-4 border-primary' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
        >
            {label}
        </button>
    );
};

export const AdminPortal: React.FC<AdminPortalProps> = ({ onLogout, adminToken, user }) => {
  const [view, setView] = useState<AdminView>('dashboard');

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <AdminDashboard user={user} adminToken={adminToken} onNavigate={(v) => setView(v as AdminView)} />;
      case 'registrations': return <RegistrationsDashboard adminToken={adminToken} permissions={user.permissions} />;
      case 'settings': return <SettingsForm adminToken={adminToken} />;
      case 'users': return <UsersAndRolesDashboard adminToken={adminToken} />;
      case 'tasks': return <TasksDashboard adminToken={adminToken} />;
      case 'dining': return <DiningDashboard adminToken={adminToken} />;
      case 'hotels': return <HotelsDashboard adminToken={adminToken} />;
      case 'agenda': return <AgendaDashboard adminToken={adminToken} />;
      case 'speakers_sponsors': return <SpeakersSponsorsDashboard adminToken={adminToken} />;
      case 'eventcoin': return <EventCoinDashboard adminToken={adminToken} />;
      case 'id_design': return <EventIdDesign adminToken={adminToken} />;
      case 'system': return <SystemStatus adminToken={adminToken} />;
      case 'communications': return <CommunicationsDashboard adminToken={adminToken} />;
      case 'media': return <MediaDashboard adminToken={adminToken} />;
      case 'marketing': return <VideoGenerator />;
      case 'tests': return <TestDashboard adminToken={adminToken} />;
      case 'gamification': return <GamificationDashboard adminToken={adminToken} />;
      case 'ticketing': return <TicketTiersDashboard adminToken={adminToken} />;
      case 'maps': return <MapDashboard adminToken={adminToken} />;
      default: return <AdminDashboard user={user} adminToken={adminToken} onNavigate={(v) => setView(v as AdminView)} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 shadow-md flex flex-col fixed h-full z-20">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold text-primary flex items-center">
             <span className="mr-2">⚡</span> Event Admin
          </h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
            <NavLink label="Dashboard" isActive={view === 'dashboard'} onClick={() => setView('dashboard')} userPermissions={user.permissions} permission="view_dashboard" />
            <div className="my-2 border-t border-gray-100 dark:border-gray-700"></div>
            <NavLink label="Registrations" isActive={view === 'registrations'} onClick={() => setView('registrations')} userPermissions={user.permissions} permission="manage_registrations" />
            <NavLink label="Agenda & Speakers" isActive={view === 'agenda'} onClick={() => setView('agenda')} userPermissions={user.permissions} permission="manage_agenda" />
            <NavLink label="Speakers & Sponsors" isActive={view === 'speakers_sponsors'} onClick={() => setView('speakers_sponsors')} userPermissions={user.permissions} permission="manage_speakers_sponsors" />
            <NavLink label="Ticketing" isActive={view === 'ticketing'} onClick={() => setView('ticketing')} userPermissions={user.permissions} permission="manage_registrations" />
            <div className="my-2 border-t border-gray-100 dark:border-gray-700"></div>
            <NavLink label="Event Coin" isActive={view === 'eventcoin'} onClick={() => setView('eventcoin')} userPermissions={user.permissions} permission="view_eventcoin_dashboard" />
            <NavLink label="Gamification" isActive={view === 'gamification'} onClick={() => setView('gamification')} userPermissions={user.permissions} permission="manage_settings" />
            <NavLink label="Dining" isActive={view === 'dining'} onClick={() => setView('dining')} userPermissions={user.permissions} permission="manage_dining" />
            <NavLink label="Accommodation" isActive={view === 'hotels'} onClick={() => setView('hotels')} userPermissions={user.permissions} permission="manage_accommodation" />
            <NavLink label="Venue Maps" isActive={view === 'maps'} onClick={() => setView('maps')} userPermissions={user.permissions} permission="manage_settings" />
            <div className="my-2 border-t border-gray-100 dark:border-gray-700"></div>
            <NavLink label="Tasks" isActive={view === 'tasks'} onClick={() => setView('tasks')} userPermissions={user.permissions} permission="manage_tasks" />
            <NavLink label="Communications" isActive={view === 'communications'} onClick={() => setView('communications')} userPermissions={user.permissions} permission="manage_registrations" />
            <NavLink label="Marketing Video" isActive={view === 'marketing'} onClick={() => setView('marketing')} userPermissions={user.permissions} permission="manage_settings" />
            <NavLink label="Media Library" isActive={view === 'media'} onClick={() => setView('media')} userPermissions={user.permissions} permission="manage_settings" />
            <div className="my-2 border-t border-gray-100 dark:border-gray-700"></div>
            <NavLink label="Settings" isActive={view === 'settings'} onClick={() => setView('settings')} userPermissions={user.permissions} permission="manage_settings" />
            <NavLink label="Badge Design" isActive={view === 'id_design'} onClick={() => setView('id_design')} userPermissions={user.permissions} permission="manage_settings" />
            <NavLink label="Users & Roles" isActive={view === 'users'} onClick={() => setView('users')} userPermissions={user.permissions} permission="manage_users" />
            <NavLink label="System Status" isActive={view === 'system'} onClick={() => setView('system')} userPermissions={user.permissions} permission="manage_settings" />
            <NavLink label="Diagnostics" isActive={view === 'tests'} onClick={() => setView('tests')} userPermissions={user.permissions} permission="manage_settings" />
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="mb-2 px-2 text-xs text-gray-500 truncate">{user.email}</div>
            <button onClick={onLogout} className="w-full py-2 px-4 border border-gray-300 dark:border-gray-600 rounded text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Logout</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
            {renderView()}
        </div>
      </main>
    </div>
  );
};
