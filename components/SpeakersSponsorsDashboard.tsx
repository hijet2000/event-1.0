import React, { useState, useEffect } from 'react';
import { type Speaker, type Sponsor } from '../types';
import { getSpeakers, getSponsors, saveSpeaker, deleteSpeaker, saveSponsor, deleteSponsor } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { SpeakerEditorModal } from './SpeakerEditorModal';
import { SponsorEditorModal } from './SponsorEditorModal';

interface SpeakersSponsorsDashboardProps {
  adminToken: string;
}

export const SpeakersSponsorsDashboard: React.FC<SpeakersSponsorsDashboardProps> = ({ adminToken }) => {
    const [activeTab, setActiveTab] = useState<'speakers' | 'sponsors'>('speakers');
    const [speakers, setSpeakers] = useState<Speaker[]>([]);
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
        if (window.confirm('Are you sure?')) await deleteSpeaker(adminToken, id);
        await fetchData();
    };
    const handleSaveSponsor = async (data: Partial<Sponsor>): Promise<boolean> => {
        await saveSponsor(adminToken, { ...editingSponsor, ...data });
        await fetchData();
        return true;
    };
    const handleDeleteSponsor = async (id: string) => {
        if (window.confirm('Are you sure?')) await deleteSponsor(adminToken, id);
        await fetchData();
    };

    const renderContent = () => {
        if (isLoading) return <ContentLoader />;
        if (error) return <Alert type="error" message={error} />;
        
        if (activeTab === 'speakers') {
            return (
                <div className="space-y-3">
                    {speakers.map(speaker => (
                        <div key={speaker.id} className="p-3 flex items-center justify-between bg-white dark:bg-gray-800 rounded-md shadow">
                            <div className="flex items-center space-x-4">
                                <img src={speaker.photoUrl} alt={speaker.name} className="h-12 w-12 rounded-full object-cover" />
                                <div>
                                    <p className="font-bold">{speaker.name}</p>
                                    <p className="text-sm text-gray-500">{speaker.title} at {speaker.company}</p>
                                </div>
                            </div>
                            <div className="space-x-3">
                                <button onClick={() => { setEditingSpeaker(speaker); setSpeakerModalOpen(true); }} className="text-sm font-medium text-primary hover:underline">Edit</button>
                                <button onClick={() => handleDeleteSpeaker(speaker.id)} className="text-sm font-medium text-red-500 hover:underline">Delete</button>
                            </div>
                        </div>
                    ))}
                    {speakers.length === 0 && <p className="italic text-gray-500 text-center py-4">No speakers added yet.</p>}
                </div>
            );
        }

        if (activeTab === 'sponsors') {
            return (
                <div className="space-y-3">
                     {sponsors.map(sponsor => (
                        <div key={sponsor.id} className="p-3 flex items-center justify-between bg-white dark:bg-gray-800 rounded-md shadow">
                            <div className="flex items-center space-x-4">
                                <img src={sponsor.logoUrl} alt={sponsor.name} className="h-12 w-24 object-contain" />
                                <div>
                                    <p className="font-bold">{sponsor.name}</p>
                                    <p className="text-sm text-gray-500">{sponsor.tier}</p>
                                </div>
                            </div>
                            <div className="space-x-3">
                                <button onClick={() => { setEditingSponsor(sponsor); setSponsorModalOpen(true); }} className="text-sm font-medium text-primary hover:underline">Edit</button>
                                <button onClick={() => handleDeleteSponsor(sponsor.id)} className="text-sm font-medium text-red-500 hover:underline">Delete</button>
                            </div>
                        </div>
                    ))}
                    {sponsors.length === 0 && <p className="italic text-gray-500 text-center py-4">No sponsors added yet.</p>}
                </div>
            );
        }
    };
    
    return (
        <>
            <div className="flex justify-between items-center mb-6">
                 <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Speakers & Sponsors</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage your event's speakers and sponsors.</p>
                </div>
                <button
                    onClick={() => activeTab === 'speakers' ? setSpeakerModalOpen(true) : setSponsorModalOpen(true)}
                    className="py-2 px-4 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary/90"
                >
                    + Add {activeTab === 'speakers' ? 'Speaker' : 'Sponsor'}
                </button>
            </div>

            <div>
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="-mb-px flex space-x-6">
                        <button onClick={() => setActiveTab('speakers')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'speakers' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Speakers</button>
                        <button onClick={() => setActiveTab('sponsors')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'sponsors' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Sponsors</button>
                    </nav>
                </div>
                <div className="mt-6">
                    {renderContent()}
                </div>
            </div>

            <SpeakerEditorModal isOpen={isSpeakerModalOpen} onClose={() => setSpeakerModalOpen(false)} onSave={handleSaveSpeaker} speaker={editingSpeaker} adminToken={adminToken} />
            <SponsorEditorModal isOpen={isSponsorModalOpen} onClose={() => setSponsorModalOpen(false)} onSave={handleSaveSponsor} sponsor={editingSponsor} adminToken={adminToken} />
        </>
    );
};