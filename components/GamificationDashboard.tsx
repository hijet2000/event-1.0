
import React, { useState, useEffect } from 'react';
import { type ScavengerHuntItem } from '../types';
import { getScavengerHuntItems, saveScavengerHuntItem, deleteScavengerHuntItem } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { Spinner } from './Spinner';

interface GamificationDashboardProps {
  adminToken: string;
}

export const GamificationDashboard: React.FC<GamificationDashboardProps> = ({ adminToken }) => {
    const [items, setItems] = useState<ScavengerHuntItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingItem, setEditingItem] = useState<Partial<ScavengerHuntItem> | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const data = await getScavengerHuntItems(adminToken);
            setItems(data);
        } catch (e) {
            setError("Failed to load challenges.");
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
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Scavenger Hunt</h2>
                    <p className="mt-1 text-sm text-gray-500">Create hidden challenges for attendees to find and scan.</p>
                </div>
                <button 
                    onClick={() => { 
                        setEditingItem({ name: '', hint: '', rewardAmount: 50, secretCode: Math.random().toString(36).substr(2, 8) }); 
                        setIsModalOpen(true); 
                    }} 
                    className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
                >
                    + Add Challenge
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(item => (
                    <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                        <h4 className="font-bold text-lg">{item.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic mb-2">"{item.hint}"</p>
                        <div className="flex justify-between items-center text-sm mb-4">
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-bold">{item.rewardAmount} Coins</span>
                            <span className="font-mono text-gray-500 text-xs">Code: {item.secretCode}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                            <button 
                                onClick={() => showQrCode(item.secretCode, item.name)}
                                className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm flex items-center justify-center gap-1"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6.5 6.5v-1m-6.5-5.5h-1M4 12V4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z" /></svg>
                                QR Code
                            </button>
                            <button 
                                onClick={() => handleDelete(item.id)}
                                className="px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-sm"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4">Edit Challenge</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input type="text" className="w-full p-2 border rounded dark:bg-gray-700" value={editingItem?.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Hint (Visible to users)</label>
                                <textarea className="w-full p-2 border rounded dark:bg-gray-700" value={editingItem?.hint || ''} onChange={e => setEditingItem({...editingItem, hint: e.target.value})} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Reward (Coins)</label>
                                <input type="number" className="w-full p-2 border rounded dark:bg-gray-700" value={editingItem?.rewardAmount || 0} onChange={e => setEditingItem({...editingItem, rewardAmount: parseInt(e.target.value)})} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Secret Code (Encoded in QR)</label>
                                <input type="text" className="w-full p-2 border rounded dark:bg-gray-700 font-mono" value={editingItem?.secretCode || ''} onChange={e => setEditingItem({...editingItem, secretCode: e.target.value})} required />
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-white rounded">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* QR Modal */}
            {qrCodeUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setQrCodeUrl(null)}>
                    <div className="bg-white p-8 rounded-lg text-center max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4 text-black">Scan to Claim</h3>
                        <img src={qrCodeUrl} alt="Challenge QR" className="w-64 h-64 mx-auto" />
                        <p className="text-sm text-gray-500 mt-4">Print this code and place it at the challenge location.</p>
                        <button onClick={() => setQrCodeUrl(null)} className="mt-6 px-6 py-2 bg-gray-200 text-gray-800 rounded-full">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};
