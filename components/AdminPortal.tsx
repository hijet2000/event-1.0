
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
import { HelpDashboard } from './HelpDashboard';
import { Permission } from '../types';

type AdminView = 'dashboard' | 'registrations' | 'settings' | 'users' | 'tasks' | 'dining' | 'hotels' | 'id_design' | 'eventcoin' | 'agenda' | 'speakers_sponsors' | 'marketing' | 'system' | 'communications' | 'media' | 'tests' | 'gamification' | 'ticketing' | 'maps' | 'help';

interface AdminPortalProps {
  onLogout: () => void;
  adminToken: string;
  user: { email: string; permissions: Permission[] };
}

// --- Internal Sidebar Components ---

const NavLink: React.FC<{ label: string, isActive: boolean, onClick: () => void, userPermissions: Permission[], permission?: Permission, icon?: React.ReactNode }> = ({ label, isActive, onClick, userPermissions, permission, icon }) => {
    if (permission && !userPermissions.includes(permission)) return null;
    return (
        <button
            onClick={onClick}
            className={`flex items-center w-full px-4 py-2 text-left text-sm font-medium transition-all rounded-md mb-0.5 ${isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100'}`}
        >
            {icon && <span className="mr-3 opacity-70">{icon}</span>}
            {label}
        </button>
    );
};

const NavGroup: React.FC<{ title?: string, children: React.ReactNode }> = ({ title, children }) => {
    // Check if children are all null (effectively hidden by permissions)
    const hasVisibleChildren = React.Children.toArray(children).some(child => child !== null);
    if (!hasVisibleChildren) return null;

    return (
        <div className="mb-6 px-3">
            {title && (
                <h3 className="px-4 mb-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em]">
                    {title}
                </h3>
            )}
            <div className="space-y-0.5">
                {children}
            </div>
        </div>
    );
};

// --- View Guard ---

const AccessDenied: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="h-16 w-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m11-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Access Denied</h2>
        <p className="mt-2 text-gray-500 dark:text-gray-400">You do not have permission to view this module. Please contact a system administrator if you believe this is an error.</p>
    </div>
);

// --- Main Portal Component ---

export const AdminPortal: React.FC<AdminPortalProps> = ({ onLogout, adminToken, user }) => {
  const [view, setView] = useState<AdminView>('dashboard');

  const checkPermission = (permission: Permission) => user.permissions.includes(permission);

  const renderView = () => {
    const guards: Partial<Record<AdminView, Permission>> = {
        dashboard: 'view_dashboard',
        registrations: 'manage_registrations',
        settings: 'manage_settings',
        users: 'manage_users',
        tasks: 'manage_tasks',
        dining: 'manage_dining',
        hotels: 'manage_accommodation',
        id_design: 'manage_settings',
        eventcoin: 'view_eventcoin_dashboard',
        agenda: 'manage_agenda',
        speakers_sponsors: 'manage_speakers_sponsors',
        marketing: 'manage_marketing',
        system: 'view_system_status',
        communications: 'manage_communications',
        media: 'manage_media',
        tests: 'view_diagnostics',
        gamification: 'manage_gamification',
        ticketing: 'manage_registrations',
        maps: 'manage_maps',
        help: 'view_dashboard'
    };

    const requiredPermission = guards[view];
    if (requiredPermission && !checkPermission(requiredPermission)) {
        return <AccessDenied />;
    }

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
      case 'help': return <HelpDashboard adminToken={adminToken} />;
      default: return <AdminDashboard user={user} adminToken={adminToken} onNavigate={(v) => setView(v as AdminView)} />;
    }
  };

  const navProps = { userPermissions: user.permissions };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-900 shadow-xl flex flex-col fixed h-full z-20 border-r border-gray-200 dark:border-gray-800">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
          <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-primary/30">⚡</div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tighter">
             EVENT CORE
          </h1>
        </div>

        <nav className="flex-1 overflow-y-auto py-6">
            <NavGroup>
                <NavLink label="Dashboard" isActive={view === 'dashboard'} onClick={() => setView('dashboard')} permission="view_dashboard" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" /></svg>} />
            </NavGroup>

            <NavGroup title="Attendance">
                <NavLink label="Registrations" isActive={view === 'registrations'} onClick={() => setView('registrations')} permission="manage_registrations" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-5.176-5.97m8.352 2.977A6 6 0 0021 15v-1a6 6 0 00-6-6" /></svg>} />
                <NavLink label="Ticketing" isActive={view === 'ticketing'} onClick={() => setView('ticketing')} permission="manage_registrations" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>} />
            </NavGroup>

            <NavGroup title="Event Content">
                <NavLink label="Agenda & Sessions" isActive={view === 'agenda'} onClick={() => setView('agenda')} permission="manage_agenda" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
                <NavLink label="Speakers & Sponsors" isActive={view === 'speakers_sponsors'} onClick={() => setView('speakers_sponsors')} permission="manage_speakers_sponsors" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.274-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.274.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
                <NavLink label="Venue Maps" isActive={view === 'maps'} onClick={() => setView('maps')} permission="manage_maps" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9.553 4.553A1 1 0 009 3.618C9 3.618 9.553 4.553 15 7z" /></svg>} />
            </NavGroup>

            <NavGroup title="Operations">
                <NavLink label="Task Board" isActive={view === 'tasks'} onClick={() => setView('tasks')} permission="manage_tasks" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>} />
                <NavLink label="Dining & Meals" isActive={view === 'dining'} onClick={() => setView('dining')} permission="manage_dining" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>} />
                <NavLink label="Accommodation" isActive={view === 'hotels'} onClick={() => setView('hotels')} permission="manage_accommodation" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>} />
            </NavGroup>

            <NavGroup title="Engagement">
                <NavLink label="Event Coin Economy" isActive={view === 'eventcoin'} onClick={() => setView('eventcoin')} permission="view_eventcoin_dashboard" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                <NavLink label="Scavenger Hunt" isActive={view === 'gamification'} onClick={() => setView('gamification')} permission="manage_gamification" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9.553 4.553A1 1 0 009 3.618C9 3.618 9.553 4.553 15 7z" /></svg>} />
            </NavGroup>

            <NavGroup title="Marketing">
                <NavLink label="Communications" isActive={view === 'communications'} onClick={() => setView('communications')} permission="manage_communications" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} />
                <NavLink label="Video Studio" isActive={view === 'marketing'} onClick={() => setView('marketing')} permission="manage_marketing" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>} />
                <NavLink label="Media Library" isActive={view === 'media'} onClick={() => setView('media')} permission="manage_media" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
            </NavGroup>

            <NavGroup title="Configuration">
                <NavLink label="Event Settings" isActive={view === 'settings'} onClick={() => setView('settings')} permission="manage_settings" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
                <NavLink label="Badge Designer" isActive={view === 'id_design'} onClick={() => setView('id_design')} permission="manage_settings" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>} />
                <NavLink label="Users & Roles" isActive={view === 'users'} onClick={() => setView('users')} permission="manage_users" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-5.176-5.97m8.352 2.977A6 6 0 0021 15v-1a6 6 0 00-6-6" /></svg>} />
            </NavGroup>

            <NavGroup title="Maintenance">
                <NavLink label="System Health" isActive={view === 'system'} onClick={() => setView('system')} permission="view_system_status" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>} />
                <NavLink label="Diagnostics" isActive={view === 'tests'} onClick={() => setView('tests')} permission="view_diagnostics" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>} />
                <NavLink label="Help & Support" isActive={view === 'help'} onClick={() => setView('help')} permission="view_dashboard" {...navProps} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
            </NavGroup>
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-black/20">
            <div className="flex items-center gap-3 mb-4 px-2">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                    {user.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{user.email}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-tight">System Admin</p>
                </div>
            </div>
            <button 
                onClick={onLogout} 
                className="w-full py-2.5 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:border-red-900/30 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Sign Out
            </button>
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
