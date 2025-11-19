
import React from 'react';
import { EventConfig, Speaker, Sponsor } from '../types';
import { CountdownTimer } from './CountdownTimer';

interface PublicHomeProps {
  config: EventConfig;
  speakers: Speaker[];
  sponsors: Sponsor[];
  onRegister: () => void;
}

export const PublicHome: React.FC<PublicHomeProps> = ({ config, speakers, sponsors, onRegister }) => {
    const featuredSpeakers = speakers.slice(0, 3);
    
    return (
        <div className="space-y-16">
            {/* Hero Section */}
            <section className="relative text-center py-20 px-4 sm:px-6 lg:px-8 rounded-3xl overflow-hidden bg-gray-900 text-white shadow-2xl">
                {config.theme.pageImageUrl && (
                    <div className="absolute inset-0 z-0">
                        <img src={config.theme.pageImageUrl} alt="Background" className="w-full h-full object-cover opacity-40" />
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent"></div>
                    </div>
                )}
                
                <div className="relative z-10 max-w-4xl mx-auto">
                    {config.theme.logoUrl && <img src={config.theme.logoUrl} alt="Logo" className="h-20 mx-auto mb-6 object-contain" />}
                    <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-4">
                        {config.event.name}
                    </h1>
                    <p className="text-xl sm:text-2xl font-light text-gray-300 mb-8">
                        {config.event.date} • {config.event.location}
                    </p>
                    
                    <div className="flex justify-center mb-10">
                         <CountdownTimer targetDate={config.event.date} />
                    </div>

                    <button 
                        onClick={onRegister}
                        className="px-8 py-4 bg-primary hover:bg-primary/90 text-white text-lg font-bold rounded-full shadow-lg transform hover:scale-105 transition-all"
                    >
                        Register Now
                    </button>
                </div>
            </section>

            {/* About Section */}
            <section className="max-w-4xl mx-auto px-4 text-center">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">About the Event</h2>
                <div className="prose dark:prose-invert mx-auto text-lg text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {config.event.description || "Join us for an unforgettable experience. Connect with industry leaders, learn from experts, and explore new opportunities."}
                </div>
            </section>

            {/* Featured Speakers */}
            {featuredSpeakers.length > 0 && (
                <section className="bg-gray-50 dark:bg-gray-800/50 py-16 px-4 rounded-3xl">
                    <div className="max-w-6xl mx-auto">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-10">Featured Speakers</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {featuredSpeakers.map(speaker => (
                                <div key={speaker.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md text-center border border-gray-100 dark:border-gray-700">
                                    <img 
                                        src={speaker.photoUrl} 
                                        alt={speaker.name} 
                                        className="w-32 h-32 rounded-full mx-auto mb-4 object-cover border-4 border-white dark:border-gray-700 shadow-sm" 
                                    />
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{speaker.name}</h3>
                                    <p className="text-primary font-medium mb-1">{speaker.title}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{speaker.company}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Sponsors */}
            {sponsors.length > 0 && (
                <section className="max-w-6xl mx-auto px-4 text-center pb-10">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Our Sponsors</h2>
                    <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
                        {sponsors.map(sponsor => (
                             <a key={sponsor.id} href={sponsor.websiteUrl} target="_blank" rel="noreferrer" className="group opacity-70 hover:opacity-100 transition-opacity">
                                 <img 
                                    src={sponsor.logoUrl} 
                                    alt={sponsor.name} 
                                    className="h-12 md:h-16 object-contain grayscale group-hover:grayscale-0 transition-all duration-300" 
                                />
                             </a>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};
