import React, { useState } from 'react';
import { type RegistrationData, type EventConfig } from '../types';
import { Alert } from './Alert';
import { Spinner } from './Spinner';
import { sendUpdateEmailToDelegate } from '../server/api';

interface DelegateDetailViewProps {
  delegate: RegistrationData;
  config: EventConfig;
  onBack: () => void;
  adminToken: string;
}

export const DelegateDetailView: React.FC<DelegateDetailViewProps> = ({ delegate, config, onBack, adminToken }) => {
    const [isSending, setIsSending] = useState(false);
    const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const handleSendUpdateEmail = async () => {
        setIsSending(true);
        setSendStatus(null);
        try {
            await sendUpdateEmailToDelegate(adminToken, 'main-event', delegate.id!);
            setSendStatus({ type: 'success', message: 'Update email sent successfully!' });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'An unknown error occurred.';
            setSendStatus({ type: 'error', message });
        } finally {
            setIsSending(false);
            setTimeout(() => setSendStatus(null), 4000);
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Back to Registrations
                </button>
            </div>
            
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{delegate.name}</h2>
                            <p className="text-gray-500 dark:text-gray-400">{delegate.email}</p>
                        </div>
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${delegate.checkedIn ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>
                            {delegate.checkedIn ? 'Checked-in' : 'Pending'}
                        </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Registered on: {new Date(delegate.createdAt).toLocaleString()}</p>
                </div>
                
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Registration Details</h3>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        {config.formFields.filter(f => f.enabled && delegate[f.id]).map(field => (
                            <div key={field.id}>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{field.label}</dt>
                                <dd className="mt-1 text-gray-900 dark:text-white whitespace-pre-wrap">{delegate[field.id]}</dd>
                            </div>
                        ))}
                    </dl>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex flex-col sm:flex-row items-center justify-end gap-4">
                    {sendStatus && <Alert type={sendStatus.type} message={sendStatus.message} />}
                    <button
                        onClick={handleSendUpdateEmail}
                        disabled={isSending}
                        className="w-full sm:w-auto py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center justify-center disabled:opacity-50"
                    >
                        {isSending ? <><Spinner /> Sending...</> : 'Send Update Email'}
                    </button>
                </div>
            </div>
        </div>
    );
};