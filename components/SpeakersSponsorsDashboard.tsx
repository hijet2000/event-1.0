
import React, { useState, useEffect, useMemo } from 'react';
import { type Speaker, type Sponsor, SPONSORSHIP_TIERS, type SponsorshipTier } from '../types';
import { getSpeakers, getSponsors, saveSpeaker, deleteSpeaker, saveSponsor, deleteSponsor } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { SpeakerEditorModal } from './SpeakerEditorModal';
import { SponsorEditorModal } from './SponsorEditorModal';

interface SpeakersSponsorsDashboardProps {
  adminToken: string;
}

const TierBadge: React.FC<{ tier: SponsorshipTier }> = ({ tier }) => {
    const colors = {
        Platinum: 'bg-slate-100 text-slate-800 border-slate-300 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600',
        Gold: 'bg-yellow-50 text-yellow-800 border-yellow-200 ring-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-700',
        Silver: 'bg-gray-50 text-gray-700 border-gray-200 ring-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
        Bronze: 'bg-orange-50 text-orange-800 border-orange-200 ring-orange-100 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-700',
    };
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${colors[tier] || colors.Bronze} ring-1 ring-inset`}>
            {tier}
        </span>
    );
};

export const SpeakersSponsorsDashboard: React.FC<SpeakersSponsorsDashboardProps> = ({ adminToken }) => {
    const [activeTab, setActiveTab] = useState<'speakers' | 'sponsors'>('speakers');
    const [speakers, setSpeakers] = useState<Speaker[]>([]);
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTier, setFilterTier] = useState<string>('');

    // Modal State
    const [isSpeakerModalOpen, setSpeakerModalOpen] = useState(false);
    const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null);
    const [isSponsorModalOpen, setSponsorModalOpen] = useState(false);
    const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [speakersData, sponsorsData] = await Promise.all([
                getSpeakers(adminToken),
                getSponsors(adminToken)
            ]);
            setSpeakers(speakersData);
            setSponsors(sponsorsData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [adminToken]);

    const handleSaveSpeaker = async (data: Partial<Speaker>): Promise<boolean> => {
        await saveSpeaker(adminToken, { ...editingSpeaker, ...data });
        await fetchData();
        return true;
    };
    const handleDeleteSpeaker = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this speaker?')) {
             await deleteSpeaker(adminToken, id);
             await fetchData();
        }
    };
    const handleSaveSponsor = async (data: Partial<Sponsor>): Promise<boolean> => {
        await saveSponsor(adminToken, { ...editingSponsor, ...data });
        await fetchData();
        return true;
    };
    const handleDeleteSponsor = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this sponsor?')) {
            await deleteSponsor(adminToken, id);
            await fetchData();
        }
    };

    const filteredSpeakers = useMemo(() => {
        return speakers.filter(s => 
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.title.toLowerCase().includes(searchQuery.toLowerCase())
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [speakers, searchQuery]);

    const filteredSponsors = useMemo(() => {
        const tierOrder = { 'Platinum': 0, 'Gold': 1, 'Silver': 2, 'Bronze': 3 };
        return sponsors.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesTier = filterTier ? s.tier === filterTier : true;
            return matchesSearch && matchesTier;
        }).sort((a, b) => {
            const tierDiff = (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99);
            if (tierDiff !== 0) return tierDiff;
            return a.name.localeCompare(b.name);
        });
    }, [sponsors, searchQuery, filterTier]);

    const renderContent = () => {
        if (isLoading) return <ContentLoader text="Loading data..." />;
        if (error) return <Alert type="error" message={error} />;
        
        if (activeTab === 'speakers') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSpeakers.map(speaker => (
                        <div key={speaker.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden group hover:shadow-md transition-all">
                            <div className="p-5 flex items-start space-x-4">
                                <div className="flex-shrink-0 relative">
                                    {speaker.photoUrl ? (
                                        <img src={speaker.photoUrl} alt={speaker.name} className="h-16 w-16 rounded-full object-cover border-2 border-white dark:border-gray-600 shadow-sm" />
                                    ) : (
                                        <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-2xl font-bold text-gray-400">
                                            {speaker.name.charAt(0)}
                                        </div>
                                    )}
                                    {/* Status Indicator (Example: has bio) */}
                                    {!speaker.bio && <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white bg-yellow-400" title="Missing Bio"></span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{speaker.name}</h3>
                                    <p className="text-sm font-medium text-primary truncate">{speaker.title}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{speaker.company}</p>
                                    
                                    <div className="flex mt-2 space-x-2">
                                        {speaker.linkedinUrl && (
                                            <a href={speaker.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                                            </a>
                                        )}
                                        {speaker.twitterUrl && (
                                            <a href={speaker.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-600">
                                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/30 px-5 py-3 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 mt-auto">
                                <button onClick={() => { setEditingSpeaker(speaker); setSpeakerModalOpen(true); }} className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-primary flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                    Edit
                                </button>
                                <button onClick={() => handleDeleteSpeaker(speaker.id)} className="text-xs font-medium text-red-500 hover:text-red-700 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                    {filteredSpeakers.length === 0 && <div className="col-span-full text-center py-12 text-gray-500 italic bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">No speakers found.</div>}
                </div>
            );
        }

        if (activeTab === 'sponsors') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {filteredSponsors.map(sponsor => (
                        <div key={sponsor.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden group hover:shadow-md transition-all relative">
                             <div className="absolute top-3 right-3 z-10">
                                <TierBadge tier={sponsor.tier} />
                             </div>
                             <div className="h-32 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center p-4">
                                 {sponsor.logoUrl ? (
                                     <img src={sponsor.logoUrl} alt={sponsor.name} className="max-h-full max-w-full object-contain" />
                                 ) : (
                                     <div className="text-xl font-bold text-gray-400">{sponsor.name}</div>
                                 )}
                             </div>
                             <div className="p-4 flex-1 flex flex-col">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{sponsor.name}</h3>
                                <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate mb-3 block">{sponsor.websiteUrl}</a>
                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3">{sponsor.description}</p>
                             </div>
                             <div className="bg-gray-50 dark:bg-gray-700/30 px-5 py-3 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 mt-auto">
                                <button onClick={() => { setEditingSponsor(sponsor); setSponsorModalOpen(true); }} className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-primary flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                    Edit
                                </button>
                                <button onClick={() => handleDeleteSponsor(sponsor.id)} className="text-xs font-medium text-red-500 hover:text-red-700 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    Delete
                                </button>
                            </div>
                        </div>
                     ))}
                     {filteredSponsors.length === 0 && <div className="col-span-full text-center py-12 text-gray-500 italic bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">No sponsors found.</div>}
                </div>
            );
        }
    };

    return (
        <div>
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Directory Management</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage event speakers and corporate sponsors.</p>
                </div>

                 <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
                     {/* Search */}
                     <div className="relative flex-grow md:flex-grow-0">
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full md:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-sm focus:ring-primary focus:border-primary dark:text-white"
                        />
                    </div>
                    
                    {/* Sponsor Tier Filter (Only visible on Sponsors tab) */}
                    {activeTab === 'sponsors' && (
                         <select
                            value={filterTier}
                            onChange={e => setFilterTier(e.target.value)}
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-sm focus:ring-primary focus:border-primary dark:text-white"
                        >
                            <option value="">All Tiers</option>
                            {SPONSORSHIP_TIERS.map(tier => <option key={tier} value={tier}>{tier}</option>)}
                        </select>
                    )}

                    {/* Add Button */}
                     <button
                        onClick={() => { 
                            if (activeTab === 'speakers') { setEditingSpeaker(null); setSpeakerModalOpen(true); }
                            else { setEditingSponsor(null); setSponsorModalOpen(true); }
                        }}
                        className="py-2 px-4 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary/90 whitespace-nowrap"
                    >
                        + Add {activeTab === 'speakers' ? 'Speaker' : 'Sponsor'}
                    </button>
                 </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('speakers')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'speakers'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Speakers ({speakers.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('sponsors')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'sponsors'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Sponsors ({sponsors.length})
                    </button>
                </nav>
            </div>

            {renderContent()}

            <SpeakerEditorModal 
                isOpen={isSpeakerModalOpen} 
                onClose={() => setSpeakerModalOpen(false)} 
                onSave={handleSaveSpeaker} 
                speaker={editingSpeaker} 
                adminToken={adminToken} 
            />
            <SponsorEditorModal 
                isOpen={isSponsorModalOpen} 
                onClose={() => setSponsorModalOpen(false)} 
                onSave={handleSaveSponsor} 
                sponsor={editingSponsor} 
                adminToken={adminToken} 
            />
        </div>
    );
};
