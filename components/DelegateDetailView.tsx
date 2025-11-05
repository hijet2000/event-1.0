import React, { useState, useEffect } from 'react';
import { type RegistrationData, type FormField, type Transaction } from '../types';
import { getTransactionsForUserByAdmin } from '../server/api';
import { ContentLoader } from './ContentLoader';

interface DelegateDetailViewProps {
  delegate: RegistrationData;
  formFields: FormField[];
  onBack: () => void;
  adminToken: string;
}

export const DelegateDetailView: React.FC<DelegateDetailViewProps> = ({ delegate, formFields, onBack, adminToken }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!adminToken) {
          setError("Admin token is missing.");
          setIsLoading(false);
          return;
      }
      try {
        setIsLoading(true);
        setError(null);
        const userTransactions = await getTransactionsForUserByAdmin(adminToken, delegate.email);
        setTransactions(userTransactions);
      } catch (err) {
        setError("Could not load transaction history.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTransactions();
  }, [delegate.email, adminToken]);

  const customFields = formFields.filter(field => field.enabled && delegate[field.id]);

  return (
    <div className="p-6 md:p-8 animate-fade-in">
      <div className="flex items-center mb-6">
        <button
          onClick={onBack}
          className="mr-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Back to registrations list"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h3 className="text-2xl font-bold leading-6 text-gray-900 dark:text-white">{delegate.name}</h3>
          <p className="mt-1 text-sm text-primary">{delegate.email}</p>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700">
        <dl className="divide-y divide-gray-200 dark:divide-gray-700">
          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Full Name</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{delegate.name}</dd>
          </div>
          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email address</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{delegate.email}</dd>
          </div>
           <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email Verified</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{delegate.emailVerified ? 'Yes' : 'No'}</dd>
          </div>
           <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Registered On</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{new Date(delegate.createdAt).toLocaleString()}</dd>
          </div>
           <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{new Date(delegate.updatedAt).toLocaleString()}</dd>
          </div>
          
          {customFields.map((field) => (
             <div key={field.id} className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{field.label}</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2 whitespace-pre-wrap">{delegate[field.id]}</dd>
             </div>
          ))}

          {customFields.length === 0 && (
             <div className="py-4 sm:py-5 sm:px-6">
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No additional information was provided by this delegate.</p>
             </div>
          )}
        </dl>
      </div>

      {/* Transaction History */}
      <div className="mt-8">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white px-6">Transaction History</h4>
        <div className="mt-4 border-t border-gray-200 dark:border-gray-700">
          {isLoading && <ContentLoader text="Loading history..." />}
          {error && <p className="p-6 text-red-500">{error}</p>}
          {!isLoading && !error && transactions.length === 0 && (
            <p className="p-6 text-sm text-gray-500 dark:text-gray-400 italic">No transactions found for this user.</p>
          )}
          {!isLoading && !error && transactions.length > 0 && (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {transactions.map(tx => (
                <li key={tx.id} className="py-4 sm:py-5 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {tx.type === 'p2p' ? `Transfer to ${tx.toName}` : tx.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(tx.timestamp).toLocaleString()} &bull; From: {tx.fromName}
                      </p>
                    </div>
                    <p className={`text-lg font-mono font-semibold ${tx.toEmail === delegate.email ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {tx.toEmail === delegate.email ? '+' : '-'}{tx.amount.toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
