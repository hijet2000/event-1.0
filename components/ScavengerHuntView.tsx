
import React, { useState, useEffect } from 'react';
import { ScavengerHuntItem } from '../types';
import { getScavengerHuntItems, getScavengerHuntProgress, claimScavengerHuntItem } from '../server/api';
import { QRCodeScannerModal } from './QRCodeScannerModal';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';

interface ScavengerHuntViewProps {
  delegateToken: string;
}

export const ScavengerHuntView: React.FC<ScavengerHuntViewProps> = ({ delegateToken }) => {
    const [items, setItems] = useState<ScavengerHuntItem[]>([]);
    const [completedIds, setCompletedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const fetchData = async () => {
        try {
            const [itemsData, progressData] = await Promise.all([
                getScavengerHuntItems(delegateToken),
                getScavengerHuntProgress(delegateToken)
            ]);
            setItems(itemsData);
            setCompletedIds(progressData);
        } catch (e) {
            console.error("Failed to load hunt data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [delegateToken]);

    const handleScan = async (code: string) => {
        setIsScannerOpen(false);
        try {
            const result = await claimScavengerHuntItem(delegateToken, code);
            setStatus({ type: result.success ? 'success' : 'error', message: result.message });
            if (result.success) {
                fetchData(); // Refresh progress
            }
        } catch (e) {
            setStatus({ type: 'error', message: 'Failed to process code.' });
        }
        // Auto hide alert
        setTimeout(() => setStatus(null), 5000);
    };

    if (loading) return <ContentLoader text="Loading challenges..." />;

    const completedCount = completedIds.length;
    const totalCount = items.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return (
        <div className="max-w-4xl mx-auto">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Scavenger Hunt</h2>
                    <p className="text-gray-600 dark:text-gray-400">Find QR codes hidden around the venue to earn coins!</p>
                </div>
                <button 
                    onClick={() => setIsScannerOpen(true)}
                    className="px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center gap-2"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6.5 6.5v-1m-6.5-5.5h-1M4 12V4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z" /></svg>
                    Scan Code
                </button>
            </div>

            {status && <div className="mb-6"><Alert type={status.type} message={status.message} /></div>}

            {/* Progress Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md mb-8">
                <div className="flex justify-between text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    <span>Progress</span>
                    <span>{completedCount} / {totalCount} Found</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div 
                        className="bg-green-500 h-4 rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>

            {/* Challenge Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {items.map(item => {
                    const isCompleted = completedIds.includes(item.id);
                    return (
                        <div 
                            key={item.id} 
                            className={`relative p-6 rounded-xl border-2 transition-all ${isCompleted ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
                        >
                            {isCompleted && (
                                <div className="absolute top-4 right-4 text-green-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                </div>
                            )}
                            
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white pr-8">{item.name}</h3>
                            <p className="text-gray-600 dark:text-gray-400 mt-2 italic">"{item.hint}"</p>
                            
                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/50 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center text-yellow-600 font-bold text-xs">
                                        $
                                    </div>
                                    <span className="font-bold text-gray-700 dark:text-gray-300">{item.rewardAmount} Coins</span>
                                </div>
                                <span className={`text-sm font-medium ${isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                                    {isCompleted ? 'Completed' : 'Locked'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <QRCodeScannerModal 
                isOpen={isScannerOpen} 
                onClose={() => setIsScannerOpen(false)} 
                onScan={handleScan} 
            />
        </div>
    );
};
