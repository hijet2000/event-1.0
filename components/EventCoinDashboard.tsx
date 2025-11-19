import React, { useState, useEffect, useMemo } from 'react';
import { type Transaction, type EventCoinStats } from '../types';
import { getEventCoinStats, getAllTransactions, getEventConfig } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { useLiveQuery } from '../hooks/useLiveQuery';

interface EventCoinDashboardProps {
  adminToken: string;
}

const StatCard: React.FC<{ title: string; value: string | number; description: string }> = ({ title, value, description }) => (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
      <p className="mt-2 text-3xl font-bold text-primary">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
);

const TransactionTypeBadge: React.FC<{ type: Transaction['type'] }> = ({ type }) => {
    const typeStyles = {
        initial: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        p2p: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        purchase: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    };
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeStyles[type]}`}>
            {type}
        </span>
    );
};

export const EventCoinDashboard: React.FC<EventCoinDashboardProps> = ({ adminToken }) => {
    const [currencyName, setCurrencyName] = useState('EventCoin');
    const [filter, setFilter] = useState('');

    // Live Queries
    const { data: stats, isLoading: statsLoading, error: statsError } = useLiveQuery(
        () => getEventCoinStats(adminToken),
        ['transactions'],
        [adminToken]
    );

    const { data: transactions, isLoading: txLoading, error: txError } = useLiveQuery(
        () => getAllTransactions(adminToken),
        ['transactions'],
        [adminToken]
    );

    useEffect(() => {
        getEventConfig().then(cfg => setCurrencyName(cfg.eventCoin.name));
    }, []);

    const filteredTransactions = useMemo(() => {
        if (!transactions) return [];
        if (!filter) return transactions;
        const lowerFilter = filter.toLowerCase();
        return transactions.filter(tx =>
            tx.fromName.toLowerCase().includes(lowerFilter) ||
            tx.toName.toLowerCase().includes(lowerFilter) ||
            tx.fromEmail.toLowerCase().includes(lowerFilter) ||
            tx.toEmail.toLowerCase().includes(lowerFilter) ||
            tx.message.toLowerCase().includes(lowerFilter)
        );
    }, [transactions, filter]);

    const isLoading = statsLoading || txLoading;
    const error = statsError || txError;

    if (isLoading && !stats && !transactions) {
        return <ContentLoader text="Loading EventCoin data..." />;
    }

    if (error && !stats) {
        return (
             <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
              <Alert type="error" message={error} />
            </div>
        );
    }
    
    return (
        <div>
             <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">EventCoin Dashboard</h2>
                <span className="flex items-center text-xs text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full animate-pulse">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Live Updates
                </span>
            </div>

            {/* Stats Cards */}
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard 
                    title="Total Circulation" 
                    value={`${stats?.totalCirculation.toLocaleString() || 0} ${currencyName}`}
                    description="Total currency issued to delegates."
                />
                <StatCard 
                    title="Total Transactions" 
                    value={stats?.totalTransactions.toLocaleString() || 0}
                    description="All transfers, including initial deposits."
                />
                 <StatCard 
                    title="Active Wallets" 
                    value={stats?.activeWallets.toLocaleString() || 0}
                    description="Delegates who have sent or received currency."
                />
            </div>

            {/* Transactions Table */}
            <div className="mt-8 bg-white dark:bg-gray-800 shadow-md rounded-lg">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h3 className="text-lg font-semibold flex-shrink-0">All Transactions</h3>
                        <input 
                            type="text"
                            placeholder="Filter transactions..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="block w-full sm:max-w-xs rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm"
                        />
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">From</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">To</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredTransactions.length > 0 ? filteredTransactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{tx.fromName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{tx.toName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-gray-700 dark:text-gray-300">{tx.amount.toLocaleString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm"><TransactionTypeBadge type={tx.type} /></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(tx.timestamp).toLocaleString()}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-gray-500 dark:text-gray-400">
                                        {transactions && transactions.length === 0 ? 'No transactions have been recorded yet.' : 'No transactions match your filter.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};