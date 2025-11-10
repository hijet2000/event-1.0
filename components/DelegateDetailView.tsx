import React, { useState } from 'react';
import { type RegistrationData, type EventConfig } from '../types';
import { Alert } from './Alert';
import { Spinner } from './Spinner';

interface DelegateDetailViewProps {
  delegate: RegistrationData;
  config: EventConfig;
  onBack: () => void;
  adminToken: string;
}

export const DelegateDetailView: React.FC<DelegateDetailViewProps> = ({ delegate, config, onBack, adminToken }) => {
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
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{delegate.name}</h2>
                    <p className="text-gray-500 dark:text-gray-400">{delegate.email}</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Registered on: {new Date(delegate.createdAt).toLocaleString()}</p>
                </div>
                
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Registration Details</h3>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        {config.formFields.filter(f => f.enabled && delegate[f.id]).map(field => (
                            <div key={field.id}>
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{field.label}</dt>
                                <dd className="mt-1 text-gray-900 dark:text-white">{delegate[field.id]}</dd>
                            </div>
                        ))}
                    </dl>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end">
                    <button className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90">
                        Resend Confirmation
                    </button>
                </div>
            </div>
        </div>
    );
};
