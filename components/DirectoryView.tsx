
import React, { useState, useMemo } from 'react';
import { type Speaker, type Sponsor, type SponsorshipTier, SPONSORSHIP_TIERS } from '../types';

interface DirectoryViewProps {
  speakers: Speaker[];
  sponsors: Sponsor[];
}

const SpeakerCard: React.FC<{ speaker: Speaker }> = ({ speaker }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div 
            onClick={() => setIsExpanded(!isExpanded)}
            className={`bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 text-center cursor-pointer transition-all duration-300 hover:shadow-lg border border-transparent hover:border-gray-200 dark:hover:border-gray-600 ${isExpanded ? 'ring-2 ring-primary/50' : ''}`}
        >
            <div className="relative inline-block">
                <img src={speaker.photoUrl} alt={speaker.name} className="w-28 h-28 rounded-full mx-auto object-cover border-4 border-white dark:border-gray-600 shadow-md" />
                {isExpanded && (
                    <div className="absolute inset-0 rounded-full bg-black/10"></div>
                )}
            </div>
            
            <h4 className="mt-4 font-bold text-lg text-gray-900 dark:text-white">{speaker.name}</h4>
            <p className="text-sm font-medium text-primary">{speaker.title}</p>
            <p className="text-sm text-gray-500 dark:text-gray-300 mb-3">{speaker.company}</p>
            
            <div className={`text-sm text-gray-600 dark:text-gray-400 text-left bg-white dark:bg-gray-800 p-3 rounded-lg shadow-inner transition-all duration-500 ease-in-out ${isExpanded ? '' : 'line-clamp-3'}`}>
                {speaker.bio}
            </div>
            
            {isExpanded ? (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 animate-fade-in">
                    <div className="flex justify-center space-x-4">
                        {speaker.linkedinUrl && (
                            <a href={speaker.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 transition-colors p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full" onClick={e => e.stopPropagation()}>
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                            </a>
                        )}
                        {speaker.twitterUrl && (
                            <a href={speaker.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-600 transition-colors p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full" onClick={e => e.stopPropagation()}>
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                            </a>
                        )}
                    </div>
                    <div className="mt-2 text-center text-xs text-gray-400 font-medium cursor-pointer hover:text-primary">
                        Show Less
                    </div>
                </div>
            ) : (
                <div className="mt-2 text-center text-xs text-primary font-medium cursor-pointer hover:underline">
                    Read More
                </div>
            )}
        </div>
    );
};

const SponsorCard: React.FC<{ sponsor: Sponsor }> = ({ sponsor }) => (
    <a 
        href={sponsor.websiteUrl} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="group flex flex-col bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-gray-700 h-full"
    >
        <div className="h-40 p-6 flex items-center justify-center bg-gray-50 dark:bg-gray-900/50 group-hover:bg-white dark:group-hover:bg-gray-800 transition-colors relative">
            <img 
                src={sponsor.logoUrl} 
                alt={sponsor.name} 
                className="max-h-full max-w-full object-contain filter grayscale group-hover:grayscale-0 transition-all duration-500 transform group-hover:scale-105" 
            />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </div>
        </div>
        <div className="p-4 text-center border-t border-gray-100 dark:border-gray-700 flex-1 flex flex-col justify-center">
            <h4 className="font-bold text-gray-900 dark:text-white text-lg">{sponsor.name}</h4>
            <span className="inline-block mt-2 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-full uppercase tracking-wider">
                {sponsor.tier}
            </span>
        </div>
    </a>
);

export const DirectoryView: React.FC<DirectoryViewProps> = ({ speakers, sponsors }) => {
    const [activeTab, setActiveTab] = useState<'speakers' | 'sponsors'>('speakers');
    const [filterTier, setFilterTier] = useState<string>('All');

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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                    {speakers.map(speaker => <SpeakerCard key={speaker.id} speaker={speaker} />)}
                </div>
            ) : <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg"><p className="italic text-gray-500">Speakers for this event have not been announced yet.</p></div>;
        }
        if (activeTab === 'sponsors') {
             const visibleTiers = SPONSORSHIP_TIERS.filter(t => filterTier === 'All' || filterTier === t);
             const hasSponsors = sponsors.length > 0;

             return hasSponsors ? (
                <div className="animate-fade-in">
                    {/* Filter Controls */}
                    <div className="flex flex-wrap gap-2 mb-8 items-center justify-center sm:justify-start">
                        <span className="text-sm font-medium text-gray-500 mr-2">Filter by Tier:</span>
                        <button 
                            onClick={() => setFilterTier('All')}
                            className={`px-4 py-1.5 text-sm rounded-full font-medium transition-all ${filterTier === 'All' ? 'bg-primary text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                        >
                            All
                        </button>
                        {SPONSORSHIP_TIERS.map(tier => (
                            <button 
                                key={tier}
                                onClick={() => setFilterTier(tier)}
                                className={`px-4 py-1.5 text-sm rounded-full font-medium transition-all ${filterTier === tier ? 'bg-primary text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                            >
                                {tier}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-12">
                        {visibleTiers.map(tier => 
                            sponsorsByTier[tier] && sponsorsByTier[tier].length > 0 ? (
                                <div key={tier}>
                                    <div className="flex items-center mb-6">
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mr-4">{tier} Sponsors</h3>
                                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {sponsorsByTier[tier].map(sponsor => (
                                            <SponsorCard key={sponsor.id} sponsor={sponsor} />
                                        ))}
                                    </div>
                                </div>
                            ) : null
                        )}
                        
                        {visibleTiers.every(t => !sponsorsByTier[t] || sponsorsByTier[t].length === 0) && (
                            <div className="text-center py-12 text-gray-500">No sponsors found for the selected filter.</div>
                        )}
                    </div>
                </div>
             ) : <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg"><p className="italic text-gray-500">Sponsors for this event have not been announced yet.</p></div>;
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-end mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Directory</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Discover the people and partners making this event possible.</p>
                </div>
                
                <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg inline-flex">
                    <button 
                        onClick={() => setActiveTab('speakers')} 
                        className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'speakers' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'}`}
                    >
                        Speakers
                    </button>
                    <button 
                        onClick={() => setActiveTab('sponsors')} 
                        className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'sponsors' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'}`}
                    >
                        Sponsors
                    </button>
                </div>
            </div>
            
            {renderContent()}
        </div>
    );
};
