import React, { useState, useMemo } from 'react';
import { type Speaker, type Sponsor, type SponsorshipTier, SPONSORSHIP_TIERS } from '../types';

interface DirectoryViewProps {
  speakers: Speaker[];
  sponsors: Sponsor[];
}

const SpeakerCard: React.FC<{ speaker: Speaker }> = ({ speaker }) => (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
        <img src={speaker.photoUrl} alt={speaker.name} className="w-24 h-24 rounded-full mx-auto object-cover" />
        <h4 className="mt-3 font-bold text-gray-900 dark:text-white">{speaker.name}</h4>
        <p className="text-sm text-primary">{speaker.title}</p>
        <p className="text-sm text-gray-500">{speaker.company}</p>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{speaker.bio}</p>
    </div>
);

const SponsorTierSection: React.FC<{ tier: SponsorshipTier, sponsors: Sponsor[] }> = ({ tier, sponsors }) => (
    <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 py-2 border-b-2 border-primary/50">{tier}</h3>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 items-center">
            {sponsors.map(sponsor => (
                <a key={sponsor.id} href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className="grayscale hover:grayscale-0 transition duration-300">
                    <img src={sponsor.logoUrl} alt={sponsor.name} title={sponsor.name} className="w-full h-auto object-contain" />
                </a>
            ))}
        </div>
    </div>
);

export const DirectoryView: React.FC<DirectoryViewProps> = ({ speakers, sponsors }) => {
    const [activeTab, setActiveTab] = useState<'speakers' | 'sponsors'>('speakers');

    const sponsorsByTier = useMemo(() => {
        const grouped = sponsors.reduce((acc, sponsor) => {
            (acc[sponsor.tier] = acc[sponsor.tier] || []).push(sponsor);
            return acc;
        }, {} as Record<SponsorshipTier, Sponsor[]>);

        // Sort sponsors within each tier alphabetically
        for (const tier in grouped) {
            grouped[tier as SponsorshipTier].sort((a, b) => a.name.localeCompare(b.name));
        }
        return grouped;
    }, [sponsors]);

    const renderContent = () => {
        if (activeTab === 'speakers') {
            return speakers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {speakers.map(speaker => <SpeakerCard key={speaker.id} speaker={speaker} />)}
                </div>
            ) : <p className="italic text-gray-500">Speakers for this event have not been announced yet.</p>;
        }
        if (activeTab === 'sponsors') {
             return sponsors.length > 0 ? (
                <div className="space-y-8">
                    {SPONSORSHIP_TIERS.map(tier => 
                        sponsorsByTier[tier] ? <SponsorTierSection key={tier} tier={tier} sponsors={sponsorsByTier[tier]} /> : null
                    )}
                </div>
             ) : <p className="italic text-gray-500">Sponsors for this event have not been announced yet.</p>;
        }
    };

    return (
        <div>
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Directory</h2>
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-6">
                    <button onClick={() => setActiveTab('speakers')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'speakers' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Speakers</button>
                    <button onClick={() => setActiveTab('sponsors')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'sponsors' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Sponsors</button>
                </nav>
            </div>
            {renderContent()}
        </div>
    );
};