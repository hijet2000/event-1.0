import React, { useState, useEffect, useMemo } from 'react';
import { type Transaction, type EventCoinStats } from '../types';
import { getEventCoinStats, getAllTransactions, getEventConfig } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';

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
    const [stats, setStats] = useState<EventCoinStats | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [currencyName, setCurrencyName] = useState('EventCoin');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState('');

    const fetchData = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const [statsData, transactionsData, configData] = await Promise.all([
                getEventCoinStats(adminToken),
                getAllTransactions(adminToken),
                getEventConfig(),
            ]);
            setStats(statsData);
            setTransactions(transactionsData);
            setCurrencyName(configData.eventCoin.name);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load EventCoin data.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [adminToken]);

    const filteredTransactions = useMemo(() => {
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

    if (isLoading) {
        return <ContentLoader text="Loading EventCoin data..." />;
    }

    if (error) {
        return (
             <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
              <Alert type="error" message={error} />
              <button onClick={fetchData} className="mt-6 py-2 px-5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90">
                Try Again
              </button>
            </div>
        );
    }
    
    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">EventCoin Dashboard</h2>

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
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">All Transactions</h3>
                        <input 
                            type="text"
                            placeholder="Filter transactions..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="block w-full max-w-xs rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm"
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
                                        {transactions.length === 0 ? 'No transactions have been recorded yet.' : 'No transactions match your filter.'}
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
