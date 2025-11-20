
import React, { useState, useEffect } from 'react';
import { type ScavengerHuntItem, type LeaderboardEntry } from '../types';
import { getScavengerHuntItems, saveScavengerHuntItem, deleteScavengerHuntItem, getScavengerHuntLeaderboard } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { Spinner } from './Spinner';

interface GamificationDashboardProps {
  adminToken: string;
}

export const GamificationDashboard: React.FC<GamificationDashboardProps> = ({ adminToken }) => {
    const [activeTab, setActiveTab] = useState<'challenges' | 'leaderboard'>('challenges');
    const [items, setItems] = useState<ScavengerHuntItem[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingItem, setEditingItem] = useState<Partial<ScavengerHuntItem> | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [itemsData, leaderboardData] = await Promise.all([
                getScavengerHuntItems(adminToken),
                getScavengerHuntLeaderboard(adminToken)
            ]);
            setItems(itemsData);
            setLeaderboard(leaderboardData);
        } catch (e) {
            setError("Failed to load gamification data.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [adminToken]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem?.name || !editingItem?.rewardAmount || !editingItem?.secretCode) {
            alert("Please fill all fields.");
            return;
        }
        await saveScavengerHuntItem(adminToken, editingItem);
        setIsModalOpen(false);
        setEditingItem(null);
        fetchData();
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Delete this challenge?")) {
            await deleteScavengerHuntItem(adminToken, id);
            fetchData();
        }
    };

    const showQrCode = (secretCode: string, name: string) => {
        // Using qrserver API for simple QR generation
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(secretCode)}`;
        setQrCodeUrl(url);
    };

    if (isLoading) return <ContentLoader text="Loading gamification..." />;
    if (error) return <Alert type="error" message={error} />;

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Scavenger Hunt</h2>
                    <p className="mt-1 text-sm text-gray-500">Create hidden challenges and track delegate progress.</p>
                </div>
                 <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('challenges')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'challenges' ? 'bg-white dark:bg-gray-600 shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}>Challenges</button>
                    <button onClick={() => setActiveTab('leaderboard')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'leaderboard' ? 'bg-white dark:bg-gray-600 shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}>Leaderboard</button>
                </div>
            </div>

            {activeTab === 'challenges' && (
                <>
                    <div className="mb-6 flex justify-end">
                        <button 
                            onClick={() => { 
                                setEditingItem({ name: '', hint: '', rewardAmount: 50, secretCode: Math.random().toString(36).substr(2, 8) }); 
                                setIsModalOpen(true); 
                            }} 
                            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 shadow-sm"
                        >
                            + Add Challenge
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {items.map(item => (
                            <div key={item.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden group hover:shadow-md transition-all">
                                <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-bl-lg shadow-sm">
                                    {item.rewardAmount} Coins
                                </div>
                                <h4 className="font-bold text-lg mb-2 pr-10">{item.name}</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 italic mb-4 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                                    "{item.hint}"
                                </p>
                                <div className="text-xs font-mono text-gray-400 mb-4">Code: {item.secretCode}</div>
                                <div className="flex justify-between gap-3 pt-2 border-t dark:border-gray-700">
                                    <button 
                                        onClick={() => showQrCode(item.secretCode, item.name)}
                                        className="flex-1 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded text-sm flex items-center justify-center gap-2 font-medium"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6.5 6.5v-1m-6.5-5.5h-1M4 12V4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z" /></svg>
                                        QR Code
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(item.id)}
                                        className="px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-sm font-medium transition-colors"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                        {items.length === 0 && <div className="col-span-full text-center py-12 text-gray-500 italic">No challenges created yet.</div>}
                    </div>
                </>
            )}

            {activeTab === 'leaderboard' && (
                 <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold">Top Hunters</h3>
                            <div className="text-sm text-gray-500">Total Participants: {leaderboard.length}</div>
                        </div>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delegate</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Items Found</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {leaderboard.map((entry, index) => (
                                <tr key={entry.userId} className={index < 3 ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                                            index === 0 ? 'bg-yellow-400 text-white shadow-md' :
                                            index === 1 ? 'bg-gray-300 text-gray-800' :
                                            index === 2 ? 'bg-orange-300 text-white' :
                                            'bg-gray-100 dark:bg-gray-700 text-gray-500'
                                        }`}>
                                            {index + 1}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{entry.name}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                            {entry.itemsFound} / {items.length}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-primary">
                                        {entry.score}
                                    </td>
                                </tr>
                            ))}
                            {leaderboard.length === 0 && (
                                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No activity yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                 </div>
            )}

            {/* Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4">Edit Challenge</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input type="text" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" value={editingItem?.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Hint (Visible to users)</label>
                                <textarea className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" value={editingItem?.hint || ''} onChange={e => setEditingItem({...editingItem, hint: e.target.value})} required rows={3} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Reward (Coins)</label>
                                <input type="number" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" value={editingItem?.rewardAmount || 0} onChange={e => setEditingItem({...editingItem, rewardAmount: parseInt(e.target.value)})} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Secret Code (Encoded in QR)</label>
                                <input type="text" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 font-mono bg-gray-50" value={editingItem?.secretCode || ''} onChange={e => setEditingItem({...editingItem, secretCode: e.target.value})} required />
                            </div>
                            <div className="flex justify-end gap-2 mt-6 pt-4 border-t dark:border-gray-700">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90">Save Challenge</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* QR Modal */}
            {qrCodeUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setQrCodeUrl(null)}>
                    <div className="bg-white p-8 rounded-xl text-center max-w-sm shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setQrCodeUrl(null)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        <h3 className="text-lg font-bold mb-4 text-black">Scan to Claim</h3>
                        <div className="bg-white p-2 inline-block rounded-lg shadow-inner border">
                            <img src={qrCodeUrl} alt="Challenge QR" className="w-64 h-64" />
                        </div>
                        <p className="text-sm text-gray-500 mt-4 bg-gray-100 p-3 rounded-lg">Print this code and place it at the challenge location.</p>
                    </div>
                </div>
            )}
        </div>
    );
};
