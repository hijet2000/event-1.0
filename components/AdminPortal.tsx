import React, { useState } from 'react';
import { type Permission } from '../types';
import { AdminDashboard } from './AdminDashboard';
import { RegistrationsDashboard } from './RegistrationsDashboard';
import { SettingsForm } from './SettingsForm';
import { UsersAndRolesDashboard } from './UsersAndRolesDashboard';
import { EventCoinDashboard } from './EventCoinDashboard';
import { EventIdDesign } from './EventIdDesign';
import { TasksDashboard } from './TasksDashboard';

interface AdminPortalProps {
  onLogout: () => void;
  adminToken: string;
  user: { email: string; permissions: Permission[] };
}

type AdminView = 'dashboard' | 'registrations' | 'settings' | 'users_roles' | 'eventcoin' | 'event_id' | 'tasks';

const navItems: { id: AdminView, label: string, requiredPermission: Permission }[] = [
    { id: 'dashboard', label: 'Dashboard', requiredPermission: 'view_dashboard' },
    { id: 'registrations', label: 'Registrations', requiredPermission: 'manage_registrations' },
    { id: 'tasks', label: 'Tasks', requiredPermission: 'manage_tasks' },
    { id: 'settings', label: 'Event Settings', requiredPermission: 'manage_settings' },
    { id: 'eventcoin', label: 'EventCoin', requiredPermission: 'view_eventcoin_dashboard' },
    { id: 'event_id', label: 'ID Design', requiredPermission: 'manage_event_id_design' },
    { id: 'users_roles', label: 'Users & Roles', requiredPermission: 'manage_users_roles' },
];

export const AdminPortal: React.FC<AdminPortalProps> = ({ onLogout, adminToken, user }) => {
    const [currentView, setCurrentView] = useState<AdminView>('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const hasPermission = (permission: Permission) => user.permissions.includes(permission);
    const filteredNavItems = navItems.filter(item => hasPermission(item.requiredPermission));

    const renderView = () => {
        switch (currentView) {
            case 'dashboard':
                return <AdminDashboard user={user} adminToken={adminToken} />;
            case 'registrations':
                return <RegistrationsDashboard adminToken={adminToken} permissions={user.permissions} />;
            case 'tasks':
                return <TasksDashboard adminToken={adminToken} />;
            case 'settings':
                return <SettingsForm adminToken={adminToken} />;
            case 'users_roles':
                return <UsersAndRolesDashboard adminToken={adminToken} />;
            case 'eventcoin':
                return <EventCoinDashboard adminToken={adminToken} />;
            case 'event_id':
                return <EventIdDesign adminToken={adminToken} />;
            default:
                return <AdminDashboard user={user} adminToken={adminToken} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
            {isSidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
            
            <aside className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 z-30 w-64 bg-white dark:bg-gray-800 shadow-lg flex flex-col transition-transform duration-200 ease-in-out`}>
                <div className="flex items-center justify-center p-4 border-b dark:border-gray-700">
                    <h1 className="text-xl font-bold text-primary">Admin Portal</h1>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {filteredNavItems.map(item => (
                        <button 
                            key={item.id}
                            onClick={() => {
                                setCurrentView(item.id);
                                setIsSidebarOpen(false);
                            }}
                            className={`w-full text-left flex items-center px-4 py-3 rounded-lg transition-colors duration-200 ${currentView === item.id ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t dark:border-gray-700">
                    <button onClick={onLogout} className="w-full text-left flex items-center space-x-3 px-4 py-3 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
            
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                     <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-gray-500 focus:outline-none">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <div className="flex-1"></div> {/* Spacer */}
                    <div className="text-sm text-right">
                      <p className="font-semibold">{user.email}</p>
                      <p className="text-xs text-gray-500">Administrator</p>
                    </div>
                </header>
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 md:p-8">
                    {renderView()}
                </main>
            </div>
        </div>
    );
};