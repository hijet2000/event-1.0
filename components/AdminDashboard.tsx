
import React from 'react';
import { type Permission, type DashboardStats } from '../types';
import { getDashboardStats } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { useLiveQuery } from '../hooks/useLiveQuery';

interface AdminDashboardProps {
  user: { email: string; permissions: Permission[] };
  adminToken: string;
  onNavigate: (view: string) => void;
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

// Simple SVG Line Chart for Registration Trends
const TrendChart: React.FC<{ data: { date: string; count: number }[] }> = ({ data }) => {
    if (!data || data.length < 2) return <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Not enough data for trend</div>;

    // Ensure data is sorted
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const max = Math.max(...sortedData.map(d => d.count), 1); // avoid div by zero
    
    // Dimensions
    const height = 100;
    const width = 100; // using viewbox percentage logic
    
    // Generate points
    const points = sortedData.map((d, i) => {
        const x = (i / (sortedData.length - 1)) * width;
        const y = height - (d.count / max) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="w-full h-32 relative">
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                {/* Gradient Definition */}
                <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                </defs>
                {/* Area under curve */}
                <path
                    d={`M0,${height} ${points} L${width},${height} Z`}
                    fill="url(#chartGradient)"
                    className="text-primary"
                />
                {/* Line */}
                <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    points={points}
                    className="text-primary"
                    vectorEffect="non-scaling-stroke"
                />
                {/* Dots */}
                {sortedData.map((d, i) => {
                    const x = (i / (sortedData.length - 1)) * width;
                    const y = height - (d.count / max) * height;
                    return (
                        <circle 
                            key={i} 
                            cx={x} 
                            cy={y} 
                            r="1.5" 
                            className="text-primary fill-current" 
                            vectorEffect="non-scaling-stroke"
                        >
                            <title>{d.date}: {d.count}</title>
                        </circle>
                    );
                })}
            </svg>
            {/* Labels (simplified) */}
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>{sortedData[0]?.date.slice(5)}</span>
                <span>{sortedData[sortedData.length-1]?.date.slice(5)}</span>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: string | number; description?: string, icon: React.ReactNode, progress?: number, trend?: React.ReactNode }> = ({ title, value, description, icon, progress, trend }) => (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-6 border border-gray-100 dark:border-gray-700 flex flex-col justify-between h-full">
      <div className="flex items-start justify-between">
        <div>
          <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</dt>
          <dd className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">{value}</dd>
          {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
        <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300">
            {icon}
        </div>
      </div>
      
      {/* Optional Trend Chart or Progress Bar */}
      <div className="mt-4">
          {trend}
          {progress !== undefined && progress >= 0 && (
            <div className="relative pt-1">
                <div className="overflow-hidden h-2 mb-1 text-xs flex rounded bg-gray-100 dark:bg-gray-700">
                    <div style={{ width: `${Math.min(progress, 100)}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary transition-all duration-500"></div>
                </div>
                <div className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400">{Math.round(progress)}%</div>
            </div>
          )}
      </div>
    </div>
);

const QuickAction: React.FC<{ label: string, icon: React.ReactNode, onClick: () => void }> = ({ label, icon, onClick }) => (
    <button 
        onClick={onClick}
        className="flex flex-col items-center justify-center p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group w-full h-full"
    >
        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white flex items-center justify-center transition-colors mb-3">
            {icon}
        </div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">{label}</span>
    </button>
);


export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, adminToken, onNavigate }) => {
  const { data: stats, isLoading, error } = useLiveQuery<DashboardStats>(
      () => getDashboardStats(adminToken),
      ['registrations', 'transactions', 'events', 'tasks'],
      [adminToken]
  );

  const calculateDaysLeft = (dateString: string) => {
    try {
        // Handle common date formats loosely
        const cleanDateString = dateString.split(/[-–,]/)[0].trim() + ", " + (dateString.match(/\d{4}/)?.[0] || new Date().getFullYear());
        const eventDate = new Date(cleanDateString);
        if (isNaN(eventDate.getTime())) return { text: dateString, days: null };

        const now = new Date();
        now.setHours(0, 0, 0, 0); 
        eventDate.setHours(0,0,0,0);
        
        const diffTime = eventDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return { text: "Event Over", days: diffDays };
        if (diffDays === 0) return { text: "Today!", days: 0 };
        return { text: `${diffDays} Days`, days: diffDays };
    } catch {
        return { text: "TBD", days: null };
    }
  };
  
  const countdown = stats ? calculateDaysLeft(stats.eventDate) : null;
  const capacityPercent = stats && stats.maxAttendees > 0 ? (stats.totalRegistrations / stats.maxAttendees) * 100 : 0;
  
  // Task progress calculation
  const taskProgress = stats && stats.taskStats.total > 0 
      ? (stats.taskStats.completed / stats.taskStats.total) * 100 
      : 0;

  if (isLoading) {
    return <ContentLoader text="Loading dashboard..." />;
  }

  if (error) {
    return <Alert type="error" message={error} />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Overview of {stats?.eventCoinName} Event Performance</p>
          </div>
          <span className="flex items-center text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-3 py-1 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              System Operational
          </span>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 1. Registrations with Trend */}
        <StatCard 
            title="Total Registrations" 
            value={stats?.totalRegistrations.toLocaleString() || 0}
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.274-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.274.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
            trend={stats?.registrationTrend && <TrendChart data={stats.registrationTrend} />}
        />
        
        {/* 2. Capacity / Progress */}
        <StatCard 
            title="Event Capacity"
            value={`${Math.round(capacityPercent)}%`}
            description={stats && stats.maxAttendees > 0 ? `${stats.totalRegistrations}/${stats.maxAttendees} Seats` : "Unlimited"}
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>}
            progress={capacityPercent}
        />

        {/* 3. Tasks */}
        <StatCard 
            title="Planning Tasks"
            value={`${stats?.taskStats.completed} / ${stats?.taskStats.total}`}
            description={`${stats?.taskStats.pending} Pending`}
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
            progress={taskProgress}
        />

        {/* 4. Countdown */}
        <StatCard 
            title="Countdown"
            value={countdown?.text || '...'}
            description={stats?.eventDate}
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Quick Actions & Recent Registrations (2/3) */}
          <div className="lg:col-span-2 space-y-8">
              
              {/* Quick Actions */}
              <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <QuickAction label="Check-in" onClick={() => onNavigate('registrations')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6.5 6.5v-1m-6.5-5.5h-1M4 12V4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z" /></svg>} />
                      <QuickAction label="Add Task" onClick={() => onNavigate('tasks')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>} />
                      <QuickAction label="Send Email" onClick={() => onNavigate('communications')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} />
                      <QuickAction label="Settings" onClick={() => onNavigate('settings')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
                  </div>
              </div>

              {/* Recent Registrations */}
              <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Registrations</h3>
                    <button onClick={() => onNavigate('registrations')} className="text-sm text-primary hover:underline">View All</button>
                </div>
                {stats && stats.recentRegistrations.length > 0 ? (
                  <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                    {stats.recentRegistrations.map(reg => (
                      <li key={reg.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white mr-3 ${reg.checkedIn ? 'bg-green-500' : 'bg-gray-400'}`}>
                                    {reg.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{reg.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{reg.email}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-500 dark:text-gray-400">{timeAgo(reg.createdAt)}</p>
                                {reg.checkedIn && <span className="text-[10px] text-green-600 font-bold">Checked In</span>}
                            </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400 italic">No recent activity to show.</div>
                )}
              </div>
          </div>

          {/* Right Column: Financials & System (1/3) */}
          <div className="space-y-8">
               {/* Financial Overview */}
               <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-6 border border-gray-100 dark:border-gray-700">
                   <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Financial Overview</h3>
                   <div className="space-y-4">
                       <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800">
                           <p className="text-sm text-indigo-600 dark:text-indigo-300 font-medium">Circulation</p>
                           <p className="text-2xl font-bold text-indigo-900 dark:text-white">{stats?.eventCoinCirculation.toLocaleString()} <span className="text-sm font-normal">{stats?.eventCoinName}</span></p>
                       </div>
                       {/* Placeholder for Sales if implemented */}
                       <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
                           <p className="text-sm text-green-600 dark:text-green-300 font-medium">Ticket Sales (Est)</p>
                           <p className="text-2xl font-bold text-green-900 dark:text-white">$0.00</p>
                           <p className="text-xs text-gray-500 mt-1">Integration pending</p>
                       </div>
                   </div>
               </div>

               {/* Help/Support Box */}
               <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl p-6 text-white shadow-md">
                   <h3 className="text-lg font-bold mb-2">Need Help?</h3>
                   <p className="text-sm text-indigo-100 mb-4">Check the system status or run diagnostics if you encounter issues.</p>
                   <button onClick={() => onNavigate('tests')} className="block w-full text-center bg-white/20 hover:bg-white/30 border border-white/40 rounded-lg py-2 text-sm font-medium transition-colors">
                       Run System Tests
                   </button>
               </div>
          </div>
      </div>
    </div>
  );
};
