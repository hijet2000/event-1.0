
import React, { useState } from 'react';
import { getEmailLogs } from '../server/api';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';

interface CommunicationsDashboardProps {
    adminToken: string;
}

interface EmailLog {
    id: string;
    to: string;
    subject: string;
    body: string;
    timestamp: number;
    status: 'sent' | 'failed';
    error?: string;
}

const StatusBadge: React.FC<{ status: EmailLog['status'] }> = ({ status }) => (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status === 'sent' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
        {status === 'sent' ? 'Sent' : 'Failed'}
    </span>
);

export const CommunicationsDashboard: React.FC<CommunicationsDashboardProps> = ({ adminToken }) => {
    const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
    const [filter, setFilter] = useState('');
    
    const { data: logs, isLoading, error } = useLiveQuery<EmailLog[]>(
        () => getEmailLogs(adminToken),
        ['emailLogs'],
        [adminToken]
    );

    const filteredLogs = logs?.filter(log => 
        log.to.toLowerCase().includes(filter.toLowerCase()) || 
        log.subject.toLowerCase().includes(filter.toLowerCase())
    ) || [];

    if (isLoading && !logs) return <ContentLoader text="Loading communications history..." />;
    if (error) return <Alert type="error" message={error} />;

    return (
        <div className="flex flex-col h-[calc(100vh-150px)]">
             <div className="mb-6 flex justify-between items-end">
                 <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Communications</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Audit all system-generated emails and notifications.</p>
                 </div>
             </div>
             
             <div className="flex flex-1 gap-6 overflow-hidden">
                 {/* List Panel */}
                 <div className={`flex-1 flex flex-col bg-white dark:bg-gray-800 shadow-md rounded-lg border border-gray-200 dark:border-gray-700 ${selectedLog ? 'hidden md:flex' : 'flex'}`}>
                     <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                         <input 
                            type="text" 
                            placeholder="Search recipient or subject..." 
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                         />
                     </div>
                     <div className="flex-1 overflow-y-auto">
                         {filteredLogs.length > 0 ? (
                             <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                 {filteredLogs.map(log => (
                                     <li 
                                        key={log.id} 
                                        onClick={() => setSelectedLog(log)}
                                        className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${selectedLog?.id === log.id ? 'bg-primary/5 border-l-4 border-primary' : 'border-l-4 border-transparent'}`}
                                     >
                                         <div className="px-4 py-4 sm:px-6">
                                             <div className="flex items-center justify-between">
                                                 <p className="text-sm font-medium text-primary truncate">{log.subject}</p>
                                                 <div className="ml-2 flex-shrink-0 flex">
                                                     <StatusBadge status={log.status} />
                                                 </div>
                                             </div>
                                             <div className="mt-2 flex justify-between">
                                                 <div className="sm:flex">
                                                     <p className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                                         To: {log.to}
                                                     </p>
                                                 </div>
                                                 <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400 sm:mt-0">
                                                     <p>{new Date(log.timestamp).toLocaleString()}</p>
                                                 </div>
                                             </div>
                                         </div>
                                     </li>
                                 ))}
                             </ul>
                         ) : (
                             <p className="text-center text-gray-500 py-10">No communication logs found.</p>
                         )}
                     </div>
                 </div>

                 {/* Detail Panel */}
                 {selectedLog ? (
                     <div className="flex-1 bg-white dark:bg-gray-800 shadow-md rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                         <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start bg-gray-50 dark:bg-gray-900/50">
                             <div className="flex-1">
                                 <button onClick={() => setSelectedLog(null)} className="md:hidden mb-4 text-sm text-primary hover:underline">&larr; Back to list</button>
                                 <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{selectedLog.subject}</h3>
                                 <div className="flex flex-col sm:flex-row sm:justify-between text-sm text-gray-600 dark:text-gray-400 gap-2">
                                     <p><span className="font-semibold">To:</span> {selectedLog.to}</p>
                                     <p>{new Date(selectedLog.timestamp).toLocaleString()}</p>
                                 </div>
                                 {selectedLog.error && (
                                     <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded text-xs font-mono">
                                         Error: {selectedLog.error}
                                     </div>
                                 )}
                             </div>
                         </div>
                         <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-gray-800">
                             <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200">
                                 {selectedLog.body}
                             </div>
                         </div>
                     </div>
                 ) : (
                     <div className="flex-1 bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg hidden md:flex items-center justify-center text-gray-400">
                         Select an email to view details
                     </div>
                 )}
             </div>
        </div>
    );
};
