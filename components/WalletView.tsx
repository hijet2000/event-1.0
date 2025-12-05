
import React, { useState, useEffect } from 'react';
import { type Transaction } from '../types';
import { getDelegateBalance, getDelegateTransactions, sendCoins } from '../server/api';
import { Spinner } from './Spinner';
import { Alert } from './Alert';
import { ContentLoader } from './ContentLoader';
import { PaymentModal } from './PaymentModal';

interface WalletViewProps {
    delegateToken: string;
}

export const WalletView: React.FC<WalletViewProps> = ({ delegateToken }) => {
    const [balance, setBalance] = useState(0);
    const [currency, setCurrency] = useState('EventCoin');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isTopUpOpen, setIsTopUpOpen] = useState(false);
    
    // Send Form State
    const [recipientEmail, setRecipientEmail] = useState('');
    const [amount, setAmount] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [balanceData, txData] = await Promise.all([
                getDelegateBalance(delegateToken),
                getDelegateTransactions(delegateToken)
            ]);
            setBalance(balanceData.balance);
            setCurrency(balanceData.currencyName);
            setTransactions(txData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load wallet data.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [delegateToken]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSending(true);
        setSendResult(null);
        try {
            await sendCoins(delegateToken, recipientEmail, parseFloat(amount), message);
            setSendResult({ type: 'success', message: 'Coins sent successfully!' });
            setRecipientEmail('');
            setAmount('');
            setMessage('');
            // Refresh data
            fetchData();
        } catch (err) {
            setSendResult({ type: 'error', message: err instanceof Error ? err.message : 'Transfer failed.' });
        } finally {
            setIsSending(false);
            setTimeout(() => setSendResult(null), 5000);
        }
    };

    if (isLoading) return <ContentLoader text="Loading wallet..." />;
    if (error) return <Alert type="error" message={error} />;

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Wallet</h2>

            {/* Balance Card */}
            <div className="bg-gradient-to-r from-primary to-secondary rounded-xl p-8 text-white shadow-lg flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-white/10 skew-x-12 -translate-x-24"></div>
                <p className="text-lg font-medium opacity-90 relative z-10">Current Balance</p>
                <h1 className="text-5xl font-bold mt-2 relative z-10">{balance.toLocaleString()} <span className="text-2xl">{currency}</span></h1>
                <div className="mt-6 flex gap-3 relative z-10">
                    <button 
                        onClick={() => setIsTopUpOpen(true)}
                        className="px-6 py-2 bg-white text-primary font-bold rounded-full shadow hover:bg-gray-100 transition-colors"
                    >
                        + Top Up Balance
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Send Form */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold mb-4">Send {currency}</h3>
                    {sendResult && <div className="mb-4"><Alert type={sendResult.type} message={sendResult.message} /></div>}
                    <form onSubmit={handleSend} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recipient Email</label>
                            <input 
                                type="email" 
                                value={recipientEmail} 
                                onChange={e => setRecipientEmail(e.target.value)} 
                                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-primary focus:border-primary" 
                                required 
                                placeholder="friend@example.com"
                            />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                            <input 
                                type="number" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)} 
                                min="0.01" 
                                step="0.01"
                                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-primary focus:border-primary" 
                                required 
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message (Optional)</label>
                            <input 
                                type="text" 
                                value={message} 
                                onChange={e => setMessage(e.target.value)} 
                                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-primary focus:border-primary" 
                                placeholder="Thanks for lunch!"
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={isSending} 
                            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center justify-center disabled:opacity-50"
                        >
                            {isSending ? <><Spinner /> Sending...</> : 'Transfer Funds'}
                        </button>
                    </form>
                </div>

                {/* Transaction History */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold mb-4">History</h3>
                    <div className="flow-root">
                        <ul className="-my-5 divide-y divide-gray-200 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
                            {transactions.map(tx => {
                                const isSystem = tx.fromId === 'system' || tx.fromId === 'payment_gateway';
                                // Simple assumption for now as API returns relevant transactions
                                // In production, check sender ID from token payload to determine direction
                                
                                return (
                                    <li key={tx.id} className="py-4">
                                        <div className="flex items-center space-x-4">
                                            <div className="flex-shrink-0">
                                                {isSystem ? (
                                                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                                                    </div>
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z" /></svg>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {isSystem ? tx.fromName : `${tx.fromName} -> ${tx.toName}`}
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                                    {tx.message || (isSystem ? "Deposit" : "Transfer")}
                                                </p>
                                                <p className="text-xs text-gray-400">{new Date(tx.timestamp).toLocaleDateString()}</p>
                                            </div>
                                            <div className={`inline-flex items-center text-base font-semibold ${isSystem ? 'text-green-600' : 'text-gray-900 dark:text-white'}`}>
                                                {isSystem ? '+' : ''}{tx.amount}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                            {transactions.length === 0 && <p className="py-4 text-center text-gray-500 italic">No transactions yet.</p>}
                        </ul>
                    </div>
                </div>
            </div>

            <PaymentModal 
                isOpen={isTopUpOpen} 
                onClose={() => setIsTopUpOpen(false)} 
                delegateToken={delegateToken}
                onSuccess={fetchData}
            />
        </div>
    );
};
