
import React, { useState, useEffect } from 'react';
import { ScavengerHuntItem, LeaderboardEntry } from '../types';
import { getScavengerHuntItems, getScavengerHuntProgress, claimScavengerHuntItem, getScavengerHuntLeaderboard, getDelegateProfile } from '../server/api';
import { QRCodeScannerModal } from './QRCodeScannerModal';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';

interface ScavengerHuntViewProps {
  delegateToken: string;
}

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
    let color = 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    if (rank === 1) color = 'bg-yellow-400 text-yellow-900';
    if (rank === 2) color = 'bg-gray-300 text-gray-800';
    if (rank === 3) color = 'bg-orange-400 text-orange-900';
    
    return (
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${color}`}>
            {rank}
        </div>
    );
}

export const ScavengerHuntView: React.FC<ScavengerHuntViewProps> = ({ delegateToken }) => {
    const [items, setItems] = useState<ScavengerHuntItem[]>([]);
    const [completedIds, setCompletedIds] = useState<string[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [myUserId, setMyUserId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const fetchData = async () => {
        try {
            // Fetch profile to get my ID for ranking
            const profile = await getDelegateProfile(delegateToken);
            setMyUserId(profile.user.id || '');

            const [itemsData, progressData, leaderboardData] = await Promise.all([
                getScavengerHuntItems(delegateToken),
                getScavengerHuntProgress(delegateToken),
                getScavengerHuntLeaderboard(delegateToken)
            ]);
            setItems(itemsData);
            setCompletedIds(progressData);
            setLeaderboard(leaderboardData);
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
                fetchData(); // Refresh progress and leaderboard
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
    
    // Calculate my rank
    const myRank = leaderboard.findIndex(entry => entry.userId === myUserId) + 1;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header with Scan Button */}
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-purple-900 to-indigo-900 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
                 {/* Background Deco */}
                 <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                 <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-purple-500/20 rounded-full blur-2xl"></div>
                 
                <div className="relative z-10">
                    <h2 className="text-3xl font-extrabold mb-1">Scavenger Hunt</h2>
                    <p className="text-indigo-200 text-sm">Explore the venue, find QR codes, earn rewards.</p>
                </div>
                <button 
                    onClick={() => setIsScannerOpen(true)}
                    className="relative z-10 px-6 py-3 bg-white text-indigo-900 font-bold rounded-full shadow-lg hover:bg-indigo-50 transform hover:scale-105 transition-all flex items-center gap-2"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6.5 6.5v-1m-6.5-5.5h-1M4 12V4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z" /></svg>
                    Scan Code
                </button>
            </div>

            {status && <div className="animate-fade-in-down"><Alert type={status.type} message={status.message} /></div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column: Progress & Items */}
                <div className="lg:col-span-2 space-y-6">
                     {/* Progress Bar */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">
                            <span>Mission Progress</span>
                            <span>{completedCount} / {totalCount}</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-full h-3 overflow-hidden">
                            <div 
                                className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(34,197,94,0.5)]" 
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Items Grid */}
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Your Missions</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {items.map(item => {
                            const isCompleted = completedIds.includes(item.id);
                            return (
                                <div 
                                    key={item.id} 
                                    className={`relative p-5 rounded-xl border transition-all duration-300 overflow-hidden group ${
                                        isCompleted 
                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-500/50 shadow-inner' 
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-90 hover:opacity-100 hover:shadow-md'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className={`font-bold text-lg pr-8 ${isCompleted ? 'text-green-800 dark:text-green-200' : 'text-gray-700 dark:text-gray-300'}`}>
                                            {item.name}
                                        </h4>
                                        {isCompleted ? (
                                            <div className="bg-green-100 dark:bg-green-800 p-1 rounded-full text-green-600 dark:text-green-200">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                            </div>
                                        ) : (
                                            <div className="bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded text-xs font-bold text-yellow-700 dark:text-yellow-300 flex items-center gap-1">
                                                <span>+{item.rewardAmount}</span>
                                                <span className="text-[10px]">EC</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <p className={`text-sm italic mb-4 ${isCompleted ? 'text-green-700 dark:text-green-300' : 'text-gray-500 dark:text-gray-400'}`}>
                                        "{item.hint}"
                                    </p>
                                    
                                    <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isCompleted ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                                        {isCompleted ? 'Mission Complete' : 'Locked'}
                                        {!isCompleted && <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Column: Leaderboard */}
                <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden sticky top-24">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 dark:text-white">Leaderboard</h3>
                            {myRank > 0 && <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">You are #{myRank}</span>}
                        </div>
                        <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
                            {leaderboard.map((entry, idx) => {
                                const isMe = entry.userId === myUserId;
                                return (
                                    <li key={entry.userId} className={`p-3 flex items-center justify-between ${isMe ? 'bg-primary/5' : ''}`}>
                                        <div className="flex items-center gap-3">
                                            <RankBadge rank={idx + 1} />
                                            <div>
                                                <p className={`text-sm font-medium ${isMe ? 'text-primary' : 'text-gray-800 dark:text-gray-200'}`}>
                                                    {isMe ? 'You' : entry.name}
                                                </p>
                                                <p className="text-[10px] text-gray-400">{entry.itemsFound} Found</p>
                                            </div>
                                        </div>
                                        <div className="text-sm font-bold text-gray-600 dark:text-gray-400">
                                            {entry.score} pts
                                        </div>
                                    </li>
                                )
                            })}
                            {leaderboard.length === 0 && <li className="p-6 text-center text-sm text-gray-500 italic">Be the first to score points!</li>}
                        </ul>
                    </div>
                </div>
            </div>

            <QRCodeScannerModal 
                isOpen={isScannerOpen} 
                onClose={() => setIsScannerOpen(false)} 
                onScan={handleScan} 
            />
        </div>
    );
};
