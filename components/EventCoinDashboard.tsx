
import React, { useState, useEffect, useMemo } from 'react';
import { type Transaction, type EventCoinStats } from '../types';
import { getEventCoinStats, getAllTransactions, getEventConfig, issueEventCoins } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Spinner } from './Spinner';

interface EventCoinDashboardProps {
  adminToken: string;
}

const StatCard: React.FC<{ title: string; value: string | number; description: string }> = ({ title, value, description }) => (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 border border-gray-100 dark:border-gray-700">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h3>
      <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
    </div>
);

const TransactionTypeBadge: React.FC<{ type: Transaction['type'] }> = ({ type }) => {
    const typeStyles = {
        initial: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        p2p: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        purchase: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
        reward: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        admin_adjustment: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full uppercase ${typeStyles[type] || 'bg-gray-100 text-gray-800'}`}>
            {type.replace('_', ' ')}
        </span>
    );
};

// New: Issue Coins Modal
const IssueCoinsModal: React.FC<{ isOpen: boolean, onClose: () => void, adminToken: string, onSuccess: () => void }> = ({ isOpen, onClose, adminToken, onSuccess }) => {
    const [email, setEmail] = useState('');
    const [amount, setAmount] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (!email || isNaN(numAmount)) {
            setError("Valid email and amount are required.");
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            await issueEventCoins(adminToken, email, numAmount, message || 'Admin adjustment');
            onSuccess();
            onClose();
            // Reset form
            setEmail('');
            setAmount('');
            setMessage('');
        } catch (err) {
            setError(err instanceof Error ? err.message : "Transaction failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Issue or Deduct Coins</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <Alert type="error" message={error} />}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User Email</label>
                        <input 
                            type="email" 
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                            placeholder="user@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (Negative to deduct)</label>
                        <input 
                            type="number" 
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                            placeholder="e.g. 50 or -20"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message / Reason</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                            placeholder="e.g. Bonus for early arrival"
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-sm dark:border-gray-600">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary text-white rounded text-sm flex items-center">
                            {isSubmitting ? <Spinner /> : 'Process Transaction'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Simple SVG Chart for Daily Volume
const VolumeChart: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
    const dailyVolume = useMemo(() => {
        const map = new Map<string, number>();
        const now = new Date();
        // Init last 7 days
        for (let i=6; i>=0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            map.set(d.toISOString().split('T')[0], 0);
        }
        
        transactions.forEach(tx => {
             const date = new Date(tx.timestamp).toISOString().split('T')[0];
             if (map.has(date)) {
                 map.set(date, (map.get(date) || 0) + tx.amount);
             }
        });
        
        return Array.from(map.entries()).map(([date, amount]) => ({ date, amount }));
    }, [transactions]);

    const maxVol = Math.max(...dailyVolume.map(d => d.amount), 10); // Min height
    const height = 100;
    const width = 100;

    return (
        <div className="w-full h-48 relative mt-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">7-Day Transaction Volume</h4>
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                {dailyVolume.map((d, i) => {
                    const barHeight = (d.amount / maxVol) * height;
                    const barWidth = (width / dailyVolume.length) - 2;
                    const x = i * (width / dailyVolume.length);
                    const y = height - barHeight;
                    return (
                        <g key={d.date}>
                            <rect 
                                x={x} 
                                y={y} 
                                width={barWidth} 
                                height={barHeight} 
                                className="fill-primary/50 hover:fill-primary transition-colors"
                            >
                                <title>{d.date}: {d.amount}</title>
                            </rect>
                            <text x={x + barWidth/2} y={height + 15} fontSize="4" textAnchor="middle" fill="gray">
                                {d.date.slice(5)}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

export const EventCoinDashboard: React.FC<EventCoinDashboardProps> = ({ adminToken }) => {
    const [currencyName, setCurrencyName] = useState('EventCoin');
    const [filter, setFilter] = useState('');
    const [isIssueModalOpen, setIssueModalOpen] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Live Queries
    const { data: stats, isLoading: statsLoading, error: statsError, refresh: refreshStats } = useLiveQuery<EventCoinStats>(
        () => getEventCoinStats(adminToken),
        ['transactions'],
        [adminToken]
    );

    const { data: transactions, isLoading: txLoading, error: txError, refresh: refreshTx } = useLiveQuery<Transaction[]>(
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
    
    const handleExportCSV = () => {
        if (!transactions || transactions.length === 0) return;
        const headers = ['ID', 'Date', 'Type', 'From', 'To', 'Amount', 'Message'];
        const csvContent = [
            headers.join(','),
            ...transactions.map(tx => [
                tx.id,
                new Date(tx.timestamp).toISOString(),
                tx.type,
                `"${tx.fromName} (${tx.fromEmail})"`,
                `"${tx.toName} (${tx.toEmail})"`,
                tx.amount,
                `"${tx.message.replace(/"/g, '""')}"`
            ].join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleIssueSuccess = () => {
        refreshStats();
        refreshTx();
        setSuccessMsg("Coins issued successfully.");
        setTimeout(() => setSuccessMsg(null), 3000);
    };

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
        <div className="space-y-8">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Economy Management</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Monitor circulation and manage user wallets.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleExportCSV}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
                    >
                        Export CSV
                    </button>
                    <button 
                        onClick={() => setIssueModalOpen(true)}
                        className="px-4 py-2 bg-primary text-white rounded-md text-sm font-bold shadow hover:bg-primary/90"
                    >
                        Issue Coins
                    </button>
                </div>
            </div>
            
            {successMsg && <Alert type="success" message={successMsg} />}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard 
                    title="Total Circulation" 
                    value={`${stats?.totalCirculation.toLocaleString() || 0} ${currencyName}`}
                    description="Coins currently held by users"
                />
                <StatCard 
                    title="Total Transactions" 
                    value={stats?.totalTransactions.toLocaleString() || 0}
                    description="Lifetime transfer count"
                />
                 <StatCard 
                    title="Active Wallets" 
                    value={stats?.activeWallets.toLocaleString() || 0}
                    description="Users with activity"
                />
                 <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 border border-gray-100 dark:border-gray-700 flex flex-col justify-center">
                    <h3 className="text-xs font-bold text-gray-500 uppercase">System Health</h3>
                    <div className="mt-2 flex items-center text-green-600 font-medium">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                        Economy Online
                    </div>
                 </div>
            </div>
            
            {/* Volume Chart */}
            {transactions && transactions.length > 0 && (
                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 border border-gray-100 dark:border-gray-700">
                    <VolumeChart transactions={transactions} />
                </div>
            )}

            {/* Transactions Table */}
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Transaction Ledger</h3>
                        <input 
                            type="text"
                            placeholder="Search ledger..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="block w-full sm:max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700 focus:ring-primary focus:border-primary"
                        />
                    </div>
                </div>
                
                <div className="overflow-x-auto max-h-[600px]">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">From</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">To</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Note</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                            {filteredTransactions.length > 0 ? filteredTransactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                        {new Date(tx.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <TransactionTypeBadge type={tx.type} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        {tx.fromName}
                                        <div className="text-xs text-gray-500">{tx.fromEmail}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        {tx.toName}
                                        <div className="text-xs text-gray-500">{tx.toEmail}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-bold text-gray-700 dark:text-gray-300">
                                        {tx.amount.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 italic max-w-xs truncate">
                                        {tx.message}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-gray-500 dark:text-gray-400">
                                        {transactions && transactions.length === 0 ? 'No transactions recorded.' : 'No matches found.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <IssueCoinsModal 
                isOpen={isIssueModalOpen} 
                onClose={() => setIssueModalOpen(false)} 
                adminToken={adminToken} 
                onSuccess={handleIssueSuccess}
            />
        </div>
    );
};
