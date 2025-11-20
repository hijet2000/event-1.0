
import React, { useState, useEffect } from 'react';
import { type RegistrationData, type EventConfig } from '../types';
import { Alert } from './Alert';
import { Spinner } from './Spinner';
import { sendUpdateEmailToDelegate, saveAdminRegistration } from '../server/api';

interface DelegateDetailViewProps {
  delegate: RegistrationData;
  config: EventConfig;
  onBack: () => void;
  adminToken: string;
}

export const DelegateDetailView: React.FC<DelegateDetailViewProps> = ({ delegate, config, onBack, adminToken }) => {
    const [isSending, setIsSending] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    
    // Editing State
    const [formData, setFormData] = useState<RegistrationData>(delegate);

    // Update local state if prop changes
    useEffect(() => {
        setFormData(delegate);
    }, [delegate]);

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
    
    const handleSave = async () => {
        setIsSaving(true);
        setSendStatus(null);
        try {
            const updates = {
                name: formData.name,
                email: formData.email,
                customFields: {} as any,
                checkedIn: formData.checkedIn
            };
            // Extract custom fields
            config.formFields.forEach(f => {
                if (formData[f.id]) updates.customFields[f.id] = formData[f.id];
            });

            await saveAdminRegistration(adminToken, delegate.id!, updates);
            setSendStatus({ type: 'success', message: 'Delegate details saved.' });
            setIsEditing(false);
        } catch (err) {
            setSendStatus({ type: 'error', message: 'Failed to save changes.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleToggleCheckIn = () => {
        setFormData(prev => ({ ...prev, checkedIn: !prev.checkedIn }));
    };

    return (
        <div className="animate-fade-in">
            <div className="mb-6 flex justify-between items-center">
                <button
                    onClick={onBack}
                    className="flex items-center text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Back to Registrations
                </button>
                
                {!isEditing && (
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                        Edit Details
                    </button>
                )}
            </div>
            
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        {isEditing ? (
                            <div className="w-full md:w-2/3 space-y-4">
                                <input 
                                    type="text" 
                                    name="name" 
                                    value={formData.name} 
                                    onChange={handleInputChange}
                                    className="block w-full text-xl font-bold border-b border-gray-300 dark:border-gray-600 bg-transparent focus:outline-none focus:border-primary dark:text-white"
                                    placeholder="Delegate Name"
                                />
                                <input 
                                    type="email" 
                                    name="email" 
                                    value={formData.email} 
                                    onChange={handleInputChange}
                                    className="block w-full text-sm text-gray-500 bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-primary"
                                    placeholder="Email Address"
                                />
                            </div>
                        ) : (
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{formData.name}</h2>
                                <p className="text-gray-500 dark:text-gray-400">{formData.email}</p>
                            </div>
                        )}
                        
                        <div className="flex items-center gap-3">
                             {isEditing ? (
                                 <label className="flex items-center cursor-pointer">
                                    <span className="mr-2 text-sm font-medium text-gray-700 dark:text-gray-300">Status:</span>
                                    <button 
                                        type="button"
                                        onClick={handleToggleCheckIn}
                                        className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none ${formData.checkedIn ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                    >
                                        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${formData.checkedIn ? 'translate-x-5' : 'translate-x-0'}`}></span>
                                    </button>
                                    <span className="ml-2 text-sm text-gray-500">{formData.checkedIn ? 'Checked In' : 'Pending'}</span>
                                 </label>
                             ) : (
                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${formData.checkedIn ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>
                                    {formData.checkedIn ? 'Checked-in' : 'Pending'}
                                </span>
                             )}
                        </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Registered on: {new Date(delegate.createdAt).toLocaleString()}</p>
                </div>
                
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Registration Details</h3>
                    {isEditing ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             {config.formFields.filter(f => f.enabled).map(field => (
                                 <div key={field.id}>
                                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{field.label}</label>
                                     {field.type === 'textarea' ? (
                                         <textarea 
                                            name={field.id}
                                            value={formData[field.id] || ''}
                                            onChange={handleInputChange}
                                            rows={3}
                                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white sm:text-sm focus:ring-primary focus:border-primary"
                                         />
                                     ) : field.type === 'dropdown' ? (
                                         <select
                                            name={field.id}
                                            value={formData[field.id] || ''}
                                            onChange={handleInputChange}
                                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white sm:text-sm focus:ring-primary focus:border-primary"
                                         >
                                             <option value="">Select...</option>
                                             {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                         </select>
                                     ) : (
                                         <input 
                                            type="text"
                                            name={field.id}
                                            value={formData[field.id] || ''}
                                            onChange={handleInputChange}
                                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white sm:text-sm focus:ring-primary focus:border-primary"
                                         />
                                     )}
                                 </div>
                             ))}
                         </div>
                    ) : (
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            {config.formFields.filter(f => f.enabled && delegate[f.id]).map(field => (
                                <div key={field.id}>
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{field.label}</dt>
                                    <dd className="mt-1 text-gray-900 dark:text-white whitespace-pre-wrap">{delegate[field.id]}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex flex-col sm:flex-row items-center justify-end gap-4 border-t dark:border-gray-700">
                    {sendStatus && <Alert type={sendStatus.type} message={sendStatus.message} />}
                    
                    {isEditing ? (
                        <>
                            <button 
                                onClick={() => { setIsEditing(false); setFormData(delegate); }}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center"
                            >
                                {isSaving ? <><Spinner /> Saving...</> : 'Save Changes'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleSendUpdateEmail}
                            disabled={isSending}
                            className="w-full sm:w-auto py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center justify-center disabled:opacity-50"
                        >
                            {isSending ? <><Spinner /> Sending...</> : 'Send Update Email'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
