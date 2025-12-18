
import React, { useState, useMemo } from 'react';
import { type Speaker, type Sponsor, type SponsorshipTier, SPONSORSHIP_TIERS } from '../types';
import { CardSkeleton } from './Skeleton';

interface DirectoryViewProps {
  speakers: Speaker[];
  sponsors: Sponsor[];
}

const SpeakerCard: React.FC<{ speaker: Speaker }> = ({ speaker }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div 
            onClick={() => setIsExpanded(!isExpanded)}
            className={`bg-white dark:bg-gray-800 rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 hover:shadow-2xl border border-gray-100 dark:border-gray-700 shadow-sm ${isExpanded ? 'ring-2 ring-primary' : ''}`}
        >
            <div className="relative inline-block mb-4">
                <img src={speaker.photoUrl} alt={speaker.name} className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-gray-50 dark:border-gray-700 shadow-xl" />
            </div>
            <h4 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{speaker.name}</h4>
            <p className="text-md font-bold text-primary mb-1">{speaker.title}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-widest">{speaker.company}</p>
            <div className={`text-sm text-gray-600 dark:text-gray-300 text-left bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
                {speaker.bio || "Bio coming soon."}
            </div>
            {isExpanded && (
                <div className="mt-6 pt-6 border-t dark:border-gray-700 flex justify-center gap-6">
                    {speaker.linkedinUrl && <a href={speaker.linkedinUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:scale-110 transition-transform"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg></a>}
                    {speaker.twitterUrl && <a href={speaker.twitterUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:scale-110 transition-transform"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg></a>}
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
        className="group bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-gray-100 dark:border-gray-700 flex flex-col"
    >
        <div className="p-8 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0 w-32 h-32 bg-gray-50 dark:bg-white rounded-2xl p-4 flex items-center justify-center border border-gray-200 shadow-inner group-hover:scale-110 transition-transform">
                 {sponsor.logoUrl ? (
                    <img src={sponsor.logoUrl} alt={sponsor.name} className="max-h-full max-w-full object-contain" />
                 ) : (
                    <span className="text-4xl font-black text-primary">{sponsor.name.charAt(0)}</span>
                 )}
            </div>
            <div className="flex-1 text-center md:text-left min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3">
                     <h4 className="font-extrabold text-gray-900 dark:text-white text-2xl truncate">{sponsor.name}</h4>
                     <span className={`inline-flex items-center px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest ${
                        sponsor.tier === 'Platinum' ? 'bg-indigo-600 text-white' :
                        sponsor.tier === 'Gold' ? 'bg-yellow-400 text-yellow-900' :
                        sponsor.tier === 'Silver' ? 'bg-gray-200 text-gray-800' :
                        'bg-orange-100 text-orange-800'
                     }`}>
                        {sponsor.tier}
                    </span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed line-clamp-2">
                    {sponsor.description || "Partner of choice for this world-class event experience."}
                </p>
                <div className="mt-4 flex items-center justify-center md:justify-start text-xs font-bold text-primary group-hover:gap-2 transition-all">
                    VIEW WEBSITE
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </div>
            </div>
        </div>
    </a>
);

export const DirectoryView: React.FC<DirectoryViewProps> = ({ speakers, sponsors }) => {
    const [activeTab, setActiveTab] = useState<'speakers' | 'sponsors'>('speakers');
    const sponsorsByTier = useMemo(() => {
        const grouped = sponsors.reduce((acc, s) => {
            (acc[s.tier] = acc[s.tier] || []).push(s);
            return acc;
        }, {} as Record<SponsorshipTier, Sponsor[]>);
        return grouped;
    }, [sponsors]);

    return (
        <div className="max-w-7xl mx-auto py-4">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-6">
                <div className="text-center sm:text-left">
                    <h2 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Directory</h2>
                    <p className="text-gray-500 mt-2">Connect with the people and brands driving innovation.</p>
                </div>
                <div className="bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl inline-flex shadow-inner">
                    <button onClick={() => setActiveTab('speakers')} className={`px-10 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'speakers' ? 'bg-white dark:bg-gray-700 text-primary shadow-lg' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>SPEAKERS</button>
                    <button onClick={() => setActiveTab('sponsors')} className={`px-10 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'sponsors' ? 'bg-white dark:bg-gray-700 text-primary shadow-lg' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>SPONSORS</button>
                </div>
            </div>
            
            <div className="animate-fade-in">
                {activeTab === 'speakers' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        {speakers.length > 0 ? speakers.map(s => <SpeakerCard key={s.id} speaker={s} />) : <div className="col-span-full py-20 text-center text-gray-400 italic">Speaker list coming soon.</div>}
                    </div>
                ) : (
                    <div className="space-y-16">
                        {SPONSORSHIP_TIERS.map(tier => (
                            sponsorsByTier[tier]?.length > 0 && (
                                <div key={tier} className="space-y-8">
                                    <div className="flex items-center gap-6">
                                        <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-widest">{tier} PARTNERS</h3>
                                        <div className="flex-1 h-1 bg-gradient-to-r from-primary/30 to-transparent rounded-full"></div>
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        {sponsorsByTier[tier].map(s => <SponsorCard key={s.id} sponsor={s} />)}
                                    </div>
                                </div>
                            )
                        ))}
                        {sponsors.length === 0 && <div className="py-20 text-center text-gray-400 italic">Our partners will be announced shortly.</div>}
                    </div>
                )}
            </div>
        </div>
    );
};
