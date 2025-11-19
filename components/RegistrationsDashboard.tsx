
import React, { useState, useEffect, useMemo } from 'react';
import { type RegistrationData, type EventConfig, Permission } from '../types';
import { getRegistrations, getEventConfig, updateRegistrationStatus } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { DelegateDetailView } from './DelegateDetailView';
import { BulkImportModal } from './BulkImportModal';
import { Alert } from './Alert';
import { QRCodeScannerModal } from './QRCodeScannerModal';
import { InviteDelegateModal } from './InviteDelegateModal';
import { jsPDF } from 'jspdf';
import { Spinner } from './Spinner';

interface RegistrationsDashboardProps {
  adminToken: string;
  permissions: Permission[];
}

// Helper for image processing
const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
    try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        return "";
    }
};

export const RegistrationsDashboard: React.FC<RegistrationsDashboardProps> = ({ adminToken, permissions }) => {
  const [registrations, setRegistrations] = useState<RegistrationData[]>([]);
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDelegate, setSelectedDelegate] = useState<RegistrationData | null>(null);
  
  // Modal states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  
  // Action states
  const [isExporting, setIsExporting] = useState(false);
  
  // Feedback states
  const [scanStatus, setScanStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState<string | null>(null);
  
  // State for filters
  const [filterText, setFilterText] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const canManage = permissions.includes('manage_registrations');
  const canInvite = permissions.includes('send_invitations');

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

  const handleInviteSuccess = (email: string) => {
    setInviteModalOpen(false);
    setInviteSuccessMessage(`Invitation successfully sent to ${email}.`);
    setTimeout(() => setInviteSuccessMessage(null), 4000);
  };

  const handleScan = async (data: string) => {
    setIsScannerOpen(false);
    setScanStatus(null);
    
    // Assuming QR code contains the registration ID
    const registrationId = data;
    const registration = registrations.find(r => r.id === registrationId);

    if (!registration) {
      setScanStatus({ type: 'error', message: `Registration not found for ID: ${registrationId}` });
      return;
    }

    if (registration.checkedIn) {
      setScanStatus({ type: 'error', message: `${registration.name} is already checked in.` });
      return;
    }

    // Optimistic update
    const originalRegistrations = [...registrations];
    setRegistrations(prev => prev.map(r => r.id === registrationId ? { ...r, checkedIn: true } : r));
    setScanStatus({ type: 'success', message: `Successfully checked in ${registration.name}.` });
    setTimeout(() => setScanStatus(null), 4000);

    try {
      await updateRegistrationStatus(adminToken, 'main-event', registrationId, { checkedIn: true });
    } catch (error) {
      // Revert on error
      setScanStatus({ type: 'error', message: 'Failed to save check-in status to the server.' });
      setRegistrations(originalRegistrations);
    }
  };

  const handleExportBadges = async () => {
      if (!config || registrations.length === 0) return;
      setIsExporting(true);

      try {
          const doc = new jsPDF();
          const pageWidth = doc.internal.pageSize.getWidth();
          const pageHeight = doc.internal.pageSize.getHeight();
          
          // Layout Config (A4)
          const margin = 10;
          const gap = 5;
          const cols = 2;
          const rows = 4;
          const badgeWidth = (pageWidth - (margin * 2) - (gap * (cols - 1))) / cols;
          const badgeHeight = (pageHeight - (margin * 2) - (gap * (rows - 1))) / rows;

          // Pre-fetch Logo if exists
          let logoBase64 = "";
          if (config.theme.logoUrl) {
              logoBase64 = await getBase64ImageFromUrl(config.theme.logoUrl);
          }

          let col = 0;
          let row = 0;

          for (let i = 0; i < registrations.length; i++) {
              const reg = registrations[i];
              
              // Calculate Position
              const x = margin + col * (badgeWidth + gap);
              const y = margin + row * (badgeHeight + gap);

              // Draw Badge Border
              doc.setDrawColor(200, 200, 200);
              doc.rect(x, y, badgeWidth, badgeHeight);

              // Header Bar (Primary Color)
              doc.setFillColor(config.theme.colorPrimary);
              doc.rect(x, y, badgeWidth, 15, 'F');

              // Event Name (White text in header)
              doc.setTextColor(255, 255, 255);
              doc.setFontSize(10);
              doc.setFont("helvetica", "bold");
              doc.text(config.event.name, x + badgeWidth / 2, y + 10, { align: "center" });

              // Logo (if exists)
              if (logoBase64) {
                  try {
                      const logoSize = 12;
                      // Draw slightly overlapping header for style
                      doc.addImage(logoBase64, 'PNG', x + 5, y + 8, logoSize, logoSize);
                  } catch (e) { /* Ignore logo errors */ }
              }

              // Content Container
              const contentCenter = x + badgeWidth / 2;
              let currentY = y + 30;

              // Delegate Name
              doc.setTextColor(0, 0, 0);
              doc.setFontSize(16);
              doc.setFont("helvetica", "bold");
              // Truncate if too long
              const name = reg.name.length > 20 ? reg.name.substring(0, 18) + '...' : reg.name;
              doc.text(name.toUpperCase(), contentCenter, currentY, { align: "center" });
              
              currentY += 8;

              // Role & Company
              doc.setFontSize(10);
              doc.setFont("helvetica", "normal");
              doc.setTextColor(80, 80, 80);
              
              if (reg.role) {
                  doc.text(reg.role, contentCenter, currentY, { align: "center" });
                  currentY += 5;
              }
              if (reg.company) {
                   doc.setFont("helvetica", "bold");
                   doc.text(reg.company, contentCenter, currentY, { align: "center" });
              }

              // Footer QR Code (Simulated)
              // In a real app, we'd fetch the QR image blob. Here we use a placeholder box or try fetching.
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${reg.id}`;
              const qrBase64 = await getBase64ImageFromUrl(qrUrl);
              if (qrBase64) {
                  const qrSize = 20;
                  doc.addImage(qrBase64, 'PNG', contentCenter - (qrSize/2), y + badgeHeight - 25, qrSize, qrSize);
              }
              
              doc.setFontSize(8);
              doc.setTextColor(150,150,150);
              doc.text(reg.id?.slice(-6) || '', contentCenter, y + badgeHeight - 3, { align: "center"});


              // Cut Marks (subtle)
              doc.setDrawColor(240, 240, 240);
              doc.setLineWidth(0.1);
              doc.line(x, y, x + 2, y); // Top Left horizontal
              doc.line(x, y, x, y + 2); // Top Left vertical
              // ... add more if needed for production print shops

              // Grid Logic
              col++;
              if (col >= cols) {
                  col = 0;
                  row++;
                  if (row >= rows) {
                      // New Page
                      if (i < registrations.length - 1) {
                          doc.addPage();
                          col = 0;
                          row = 0;
                      }
                  }
              }
          }

          doc.save(`${config.event.name.replace(/\s+/g, '_')}_Badges.pdf`);

      } catch (e) {
          console.error(e);
          alert("Failed to generate badges PDF.");
      } finally {
          setIsExporting(false);
      }
  };

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
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by importing your first list of delegates.</p>
                <div className="mt-6">
                    <button 
                        onClick={() => setIsImportModalOpen(true)} 
                        className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
                    >
                        Bulk Import Delegates
                    </button>
                </div>
              </>
            ) : (
               <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Once delegates register, they will appear here.</p>
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredRegistrations.length > 0 ? filteredRegistrations.map(reg => (
                        <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{reg.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{reg.email}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(reg.createdAt).toLocaleDateString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {reg.checkedIn ? (
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                        Checked-in
                                    </span>
                                ) : (
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                        Pending
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button onClick={() => setSelectedDelegate(reg)} className="text-primary hover:underline">View</button>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={5} className="text-center py-10 text-gray-500 dark:text-gray-400">
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
    return <DelegateDetailView delegate={selectedDelegate} config={config} onBack={() => setSelectedDelegate(null)} adminToken={adminToken} />;
  }
  
  return (
    <div>
      <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Registrations</h2>
        <div className="flex gap-2">
            {canInvite && (
                <button onClick={() => setInviteModalOpen(true)} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-secondary hover:bg-secondary/90 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Invite Delegate
                </button>
            )}
            {canManage && (
              <>
                <button onClick={() => setIsScannerOpen(true)} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6.5 6.5v-1m-6.5-5.5h-1M4 12V4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z" /></svg>
                    Scan to Check-in
                </button>
                <button 
                    onClick={handleExportBadges} 
                    disabled={isExporting}
                    className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 disabled:opacity-50"
                >
                    {isExporting ? <Spinner /> : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    )}
                    Export Badges
                </button>
                <button onClick={() => setIsImportModalOpen(true)} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90">
                    Bulk Import
                </button>
              </>
            )}
        </div>
      </div>

      {scanStatus && <div className="mb-4"><Alert type={scanStatus.type} message={scanStatus.message} /></div>}
      {inviteSuccessMessage && <div className="mb-4"><Alert type="success" message={inviteSuccessMessage} /></div>}

      {renderContent()}

      <BulkImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
        adminToken={adminToken}
      />
      <QRCodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
      />
      <InviteDelegateModal
        isOpen={isInviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onInviteSuccess={handleInviteSuccess}
        adminToken={adminToken}
      />
    </div>
  );
};
