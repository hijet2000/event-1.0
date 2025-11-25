
import React, { useState, useEffect } from 'react';
import { type TicketTier } from '../types';
import { getTicketTiers, saveTicketTier, deleteTicketTier } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Spinner } from './Spinner';
import { Alert } from './Alert';

interface TicketTiersDashboardProps {
  adminToken: string;
}

export const TicketTiersDashboard: React.FC<TicketTiersDashboardProps> = ({ adminToken }) => {
    const [tiers, setTiers] = useState<TicketTier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingTier, setEditingTier] = useState<Partial<TicketTier> | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [benefitsInput, setBenefitsInput] = useState('');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const data = await getTicketTiers(adminToken);
            setTiers(data);
        } catch (e) {
            setError("Failed to load ticket tiers.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [adminToken]);

    const openModal = (tier?: TicketTier) => {
        if (tier) {
            setEditingTier(tier);
            setBenefitsInput(tier.benefits.join('\n'));
        } else {
            setEditingTier({ 
                name: '', 
                price: 0, 
                currency: 'USD', 
                limit: 100, 
                sold: 0, 
                description: '', 
                active: true 
            });
            setBenefitsInput('');
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTier?.name) return;
        
        const benefits = benefitsInput.split('\n').filter(b => b.trim());
        
        await saveTicketTier(adminToken, { ...editingTier, benefits });
        setIsModalOpen(false);
        fetchData();
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Delete this ticket tier?")) {
            await deleteTicketTier(adminToken, id);
            fetchData();
        }
    };

    if (isLoading) return <ContentLoader text="Loading tickets..." />;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Ticket Management</h2>
                    <p className="mt-1 text-sm text-gray-500">Define ticket types and pricing for your event.</p>
                </div>
                <button 
                    onClick={() => openModal()} 
                    className="px-4 py-2 bg-primary text-white rounded-md shadow-sm hover:bg-primary/90"
                >
                    + Add Ticket Tier
                </button>
            </div>

            {error && <Alert type="error" message={error} />}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tiers.map(tier => (
                    <div key={tier.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                        <div className="p-6 flex-1">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{tier.name}</h3>
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${tier.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                    {tier.active ? 'Active' : 'Draft'}
                                </span>
                            </div>
                            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
                                {tier.price === 0 ? 'Free' : `${tier.currency} ${tier.price}`}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{tier.description}</p>
                            
                            <div className="space-y-2 mb-4">
                                {tier.benefits.map((benefit, i) => (
                                    <div key={i} className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                        <svg className="h-4 w-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        {benefit}
                                    </div>
                                ))}
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                                <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
                                    <span>Sold</span>
                                    <span>{tier.sold} / {tier.limit}</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                    <div 
                                        className="bg-primary h-2 rounded-full transition-all" 
                                        style={{ width: `${Math.min((tier.sold / tier.limit) * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-700 flex justify-end gap-2">
                            <button onClick={() => openModal(tier)} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600">Edit</button>
                            <button onClick={() => handleDelete(tier.id)} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">Delete</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4">{editingTier?.id ? 'Edit Tier' : 'New Ticket Tier'}</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <input 
                                type="text" 
                                placeholder="Ticket Name (e.g. VIP)" 
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                value={editingTier?.name || ''}
                                onChange={e => setEditingTier({...editingTier, name: e.target.value})}
                                required
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <input 
                                    type="number" 
                                    placeholder="Price" 
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                    value={editingTier?.price}
                                    onChange={e => setEditingTier({...editingTier, price: parseFloat(e.target.value)})}
                                    required
                                />
                                <input 
                                    type="number" 
                                    placeholder="Limit" 
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                    value={editingTier?.limit}
                                    onChange={e => setEditingTier({...editingTier, limit: parseInt(e.target.value)})}
                                    required
                                />
                            </div>
                            <textarea 
                                placeholder="Description" 
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                value={editingTier?.description || ''}
                                onChange={e => setEditingTier({...editingTier, description: e.target.value})}
                                rows={2}
                            />
                            <div>
                                <label className="block text-sm font-medium mb-1">Benefits (One per line)</label>
                                <textarea 
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                    value={benefitsInput}
                                    onChange={e => setBenefitsInput(e.target.value)}
                                    rows={4}
                                    placeholder="Fast Track Entry&#10;Lounge Access"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="active"
                                    checked={editingTier?.active}
                                    onChange={e => setEditingTier({...editingTier, active: e.target.checked})}
                                />
                                <label htmlFor="active">Available for sale</label>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-white rounded">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
