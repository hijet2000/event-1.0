
import React from 'react';
import { type Permission, type DashboardStats } from '../types';
import { getDashboardStats } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { useLiveQuery } from '../hooks/useLiveQuery';

interface AdminDashboardProps {
  user: { email: string; permissions: Permission[] };
  adminToken: string;
}

const timeAgo = (timestamp: number): string => {
  const now = Date.now();
  const seconds = Math.floor((now - timestamp) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
};

const StatCard: React.FC<{ title: string; value: string | number; description?: string, icon: React.ReactNode, progress?: number }> = ({ title, value, description, icon, progress }) => (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-5">
      <div className="flex items-center space-x-4">
        <div className="flex-shrink-0 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            {icon}
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</dt>
          <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{value}</dd>
        </div>
      </div>
      {progress !== undefined && progress > 0 && (
        <div className="mt-4">
            <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full">
                <div className="h-2 bg-primary rounded-full" style={{ width: `${Math.min(progress, 100)}%` }}></div>
            </div>
        </div>
      )}
    </div>
);

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, adminToken }) => {
  // Use Live Query to watch registrations and transactions tables
  const { data: stats, isLoading, error } = useLiveQuery<DashboardStats>(
      () => getDashboardStats(adminToken),
      ['registrations', 'transactions', 'events'],
      [adminToken]
  );

  const calculateDaysLeft = (dateString: string) => {
    try {
        const cleanDateString = dateString.split(/[-–,]/)[0].trim() + ", " + dateString.match(/\d{4}/)?.[0];
        const eventDate = new Date(cleanDateString);
        if (isNaN(eventDate.getTime())) return { text: dateString, days: null };

        const now = new Date();
        now.setHours(0, 0, 0, 0); 
        eventDate.setHours(0,0,0,0);
        
        const diffTime = eventDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return { text: "Event Over", days: diffDays };
        if (diffDays === 0) return { text: "Today!", days: 0 };
        return { text: `${diffDays} days to go`, days: diffDays };
    } catch {
        return { text: dateString, days: null };
    }
  };
  
  const countdown = stats ? calculateDaysLeft(stats.eventDate) : null;
  const capacityPercent = stats && stats.maxAttendees > 0 ? (stats.totalRegistrations / stats.maxAttendees) * 100 : 0;
  
  // Explicitly label the registration count vs max attendees
  const registrationsValue = stats?.maxAttendees > 0 
      ? `${stats.totalRegistrations.toLocaleString()} / ${stats.maxAttendees.toLocaleString()}` 
      : stats?.totalRegistrations.toLocaleString();

  if (isLoading) {
    return <ContentLoader text="Loading dashboard..." />;
  }

  if (error) {
    return <Alert type="error" message={error} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
          <span className="flex items-center text-xs text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full animate-pulse">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Live Updates
          </span>
      </div>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Welcome back, <span className="font-medium text-primary">{user.email}</span>! Here's a snapshot of your event.
      </p>

      {/* Stats Cards */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard 
            title={stats && stats.maxAttendees > 0 ? "Registered / Max Attendees" : "Total Registrations"} 
            value={registrationsValue || 0}
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.274-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.274.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
            progress={capacityPercent}
        />
        <StatCard 
            title="Event Date"
            value={countdown?.text || '...'}
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        />
        <StatCard 
            title={`${stats?.eventCoinName || 'EventCoin'} Circulating`}
            value={stats?.eventCoinCirculation.toLocaleString() || 0}
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 12v-1m0 1v.01M12 12c-1.11 0-2.08-.402-2.599-1M12 12V7m0 5v4m0 0v-4m0 4H9m3 0h3m-3 0a2.5 2.5 0 00-2.5-2.5V7.5A2.5 2.5 0 0112 5v1.5a2.5 2.5 0 00-2.5 2.5m5 0A2.5 2.5 0 0112 14.5V16a2.5 2.5 0 002.5-2.5m-5 0V9a2.5 2.5 0 012.5-2.5M12 5v1.5a2.5 2.5 0 002.5 2.5" /></svg>}
        />
      </div>

      {/* Recent Activity */}
      <div className="mt-8 bg-white dark:bg-gray-800 shadow-md rounded-lg">
        <h3 className="text-lg font-semibold p-5 border-b border-gray-200 dark:border-gray-700">Recent Registrations</h3>
        {stats && stats.recentRegistrations.length > 0 ? (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {stats.recentRegistrations.map(reg => (
              <li key={reg.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className="flex-grow">
                  <p className="font-medium text-gray-900 dark:text-white">{reg.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{reg.email}</p>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0 w-full sm:w-auto text-left sm:text-right">{timeAgo(reg.createdAt)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-5 text-sm text-gray-500 dark:text-gray-400 italic">No recent registrations found.</p>
        )}
      </div>
    </div>
  );
};