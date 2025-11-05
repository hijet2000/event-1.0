import React, { useState, useEffect, useMemo } from 'react';
import { type RegistrationData, type EventConfig, Permission } from '../types';
import { getRegistrations, getEventConfig } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { DelegateDetailView } from './DelegateDetailView';
import { BulkImportModal } from './BulkImportModal';
import { Alert } from './Alert';

interface RegistrationsDashboardProps {
  adminToken: string;
  permissions: Permission[];
}

export const RegistrationsDashboard: React.FC<RegistrationsDashboardProps> = ({ adminToken, permissions }) => {
  const [registrations, setRegistrations] = useState<RegistrationData[]>([]);
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDelegate, setSelectedDelegate] = useState<RegistrationData | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // State for filters
  const [filterText, setFilterText] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const canManage = permissions.includes('manage_registrations');

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [regData, configData] = await Promise.all([
          getRegistrations(adminToken),
          getEventConfig()
      ]);
      setRegistrations(regData);
      setConfig(configData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load registrations. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [adminToken]);

  const handleImportSuccess = () => {
      setIsImportModalOpen(false);
      loadData(); // Refresh the list after import
  }

  // Memoize the filtered list to avoid re-calculating on every render
  const filteredRegistrations = useMemo(() => {
    const lowerCaseFilter = filterText.toLowerCase();

    let filterStartTimestamp: number | null = null;
    if (filterDate) {
      const parts = filterDate.split('-').map(s => parseInt(s, 10));
      if (parts.length === 3) {
        const filterStartDate = new Date(parts[0], parts[1] - 1, parts[2]);
        filterStartTimestamp = filterStartDate.getTime();
      }
    }
    
    if (!filterText && !filterDate) {
        return registrations;
    }

    return registrations.filter(reg => {
      const textMatch = !filterText || 
        reg.name.toLowerCase().includes(lowerCaseFilter) || 
        reg.email.toLowerCase().includes(lowerCaseFilter);

      const dateMatch = !filterStartTimestamp || reg.createdAt >= filterStartTimestamp;

      return textMatch && dateMatch;
    });
  }, [registrations, filterText, filterDate]);

  const renderContent = () => {
    if (isLoading) {
      return <ContentLoader text="Loading registrations..." />;
    }

    if (error) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">Something went wrong</h3>
            <div className="mt-2">
                <Alert type="error" message={error} />
            </div>
          <button
            onClick={loadData}
            className="mt-6 py-2 px-5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      );
    }
    
    if (registrations.length === 0) {
      return (
        <div className="text-center py-16 px-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-5.176-5.97m8.352 2.977A6 6 0 0021 15v-1a6 6 0 00-6-6" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No Registrations Yet</h3>
            {canManage ? (
              <>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by importing your first list of attendees.</p>
                <div className="mt-6">
                    <button 
                        onClick={() => setIsImportModalOpen(true)} 
                        className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
                    >
                        Bulk Import Registrations
                    </button>
                </div>
              </>
            ) : (
               <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Once attendees register for the event, they will appear here.</p>
            )}
        </div>
      );
    }

    return (
      <>
        {/* Filter controls */}
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <label htmlFor="filter-text" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Filter by Name or Email
              </label>
              <input
                type="text"
                id="filter-text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Search..."
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="filter-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Registered On or After
              </label>
              <input
                type="date"
                id="filter-date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { setFilterText(''); setFilterDate(''); }}
                className="w-full mt-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto bg-white dark:bg-gray-800 shadow-md rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Registered On</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredRegistrations.length > 0 ? filteredRegistrations.map(reg => (
                        <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{reg.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{reg.email}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(reg.createdAt).toLocaleDateString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button onClick={() => setSelectedDelegate(reg)} className="text-primary hover:underline">View</button>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={4} className="text-center py-10 text-gray-500 dark:text-gray-400">
                                No registrations match your filters.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </>
    );
  };

  if (selectedDelegate && config) {
    return <DelegateDetailView delegate={selectedDelegate} formFields={config.formFields} onBack={() => setSelectedDelegate(null)} adminToken={adminToken} />;
  }
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Registrations</h2>
        {canManage && registrations.length > 0 && (
            <button onClick={() => setIsImportModalOpen(true)} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90">
                Bulk Import
            </button>
        )}
      </div>

      {renderContent()}

      <BulkImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
        adminToken={adminToken}
      />
    </div>
  );
};
