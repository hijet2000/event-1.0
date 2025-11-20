
import React, { useState } from 'react';
import { getEmailLogs, sendBroadcast } from '../server/api';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { Spinner } from './Spinner';

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

// Modal Component for Composing Broadcast
const BroadcastModal: React.FC<{ isOpen: boolean, onClose: () => void, adminToken: string, onSuccess: (msg: string) => void }> = ({ isOpen, onClose, adminToken, onSuccess }) => {
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [target, setTarget] = useState<'all' | 'checked-in' | 'pending'>('all');
    const [channel, setChannel] = useState<'email' | 'sms' | 'whatsapp' | 'app'>('email');
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !body.trim()) {
            setError("Subject and body are required.");
            return;
        }
        setIsSending(true);
        setError(null);
        try {
            const result = await sendBroadcast(adminToken, subject, body, target, channel);
            if (result.success) {
                onSuccess(result.message);
                onClose();
                setSubject('');
                setBody('');
                setChannel('email');
            } else {
                setError(result.message);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to send broadcast.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Send Broadcast</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Send an announcement to multiple attendees.</p>
                </div>
                <form onSubmit={handleSend} className="p-6 space-y-4">
                    {error && <Alert type="error" message={error} />}
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Target Audience</label>
                            <select 
                                value={target} 
                                onChange={e => setTarget(e.target.value as any)} 
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm text-gray-900 dark:text-white"
                            >
                                <option value="all">All Registrants</option>
                                <option value="checked-in">Checked In Only</option>
                                <option value="pending">Pending Check-in Only</option>
                            </select>
                        </div>
                        <div>
                             <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Channel</label>
                             <select 
                                value={channel} 
                                onChange={e => setChannel(e.target.value as any)} 
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm text-gray-900 dark:text-white"
                            >
                                <option value="email">Email</option>
                                <option value="sms">SMS</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="app">In-App Notification</option>
                            </select>
                        </div>
                    </div>

                    {(channel === 'sms' || channel === 'whatsapp') && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md text-xs text-blue-700 dark:text-blue-300">
                            <strong>Note:</strong> Only users with a valid phone number in their profile (Custom Field: "phone") will receive this message.
                        </div>
                    )}
                    
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Subject</label>
                        <input 
                            type="text" 
                            value={subject} 
                            onChange={e => setSubject(e.target.value)} 
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm text-gray-900 dark:text-white"
                            placeholder="Important Announcement"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Message</label>
                        <textarea 
                            rows={5}
                            value={body} 
                            onChange={e => setBody(e.target.value)} 
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm text-gray-900 dark:text-white"
                            placeholder="Type your message here..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 text-gray-700 dark:text-gray-200">Cancel</button>
                        <button 
                            type="submit" 
                            disabled={isSending} 
                            className="px-4 py-2 bg-primary text-white rounded-md text-sm flex items-center gap-2 hover:bg-primary/90 disabled:opacity-70"
                        >
                            {isSending ? <><Spinner /> Sending...</> : 'Send Broadcast'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


export const CommunicationsDashboard: React.FC<CommunicationsDashboardProps> = ({ adminToken }) => {
    const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
    const [filter, setFilter] = useState('');
    const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    
    const { data: logs, isLoading, error, refresh } = useLiveQuery<EmailLog[]>(
        () => getEmailLogs(adminToken),
        ['emailLogs'],
        [adminToken]
    );

    const filteredLogs = logs?.filter(log => 
        log.to.toLowerCase().includes(filter.toLowerCase()) || 
        log.subject.toLowerCase().includes(filter.toLowerCase())
    ) || [];

    const handleBroadcastSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 5000);
        refresh(); // Refresh logs to see new queued items if any logic pushes them instantly (though logs are async)
    };

    if (isLoading && !logs) return <ContentLoader text="Loading communications history..." />;
    if (error) return <Alert type="error" message={error} />;

    return (
        <div className="flex flex-col h-[calc(100vh-150px)]">
             <div className="mb-6 flex justify-between items-end">
                 <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Communications</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Audit emails and send bulk announcements.</p>
                 </div>
                 <button 
                    onClick={() => setIsBroadcastOpen(true)}
                    className="px-4 py-2 bg-primary text-white rounded-md text-sm font-bold shadow-sm hover:bg-primary/90 flex items-center gap-2"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                     New Broadcast
                 </button>
             </div>
             
             {successMsg && <div className="mb-4"><Alert type="success" message={successMsg} /></div>}
             
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
             
             <BroadcastModal 
                isOpen={isBroadcastOpen} 
                onClose={() => setIsBroadcastOpen(false)} 
                adminToken={adminToken}
                onSuccess={handleBroadcastSuccess}
             />
        </div>
    );
};
