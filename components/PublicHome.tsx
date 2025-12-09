
import React from 'react';
import { EventConfig, Speaker, Sponsor, TicketTier } from '../types';
import { CountdownTimer } from './CountdownTimer';
import { useTranslation } from '../contexts/LanguageContext';

interface PublicHomeProps {
  config: EventConfig;
  speakers: Speaker[];
  sponsors: Sponsor[];
  ticketTiers?: TicketTier[];
  onRegister: () => void;
}

export const PublicHome: React.FC<PublicHomeProps> = ({ config, speakers, sponsors, ticketTiers, onRegister }) => {
    const featuredSpeakers = speakers.slice(0, 3);
    const activeTickets = ticketTiers?.filter(t => t.active) || [];
    const { t } = useTranslation();
    
    return (
        <div className="space-y-20 pb-20">
            {/* Hero Section */}
            <section className="relative text-center py-24 px-4 sm:px-6 lg:px-8 rounded-[2.5rem] overflow-hidden bg-gray-900 text-white shadow-2xl">
                {config.theme.pageImageUrl && (
                    <div className="absolute inset-0 z-0">
                        <img src={config.theme.pageImageUrl} alt="Background" className="w-full h-full object-cover opacity-30 mix-blend-overlay" />
                        <div className="absolute inset-0 bg-gradient-to-b from-gray-900/10 via-gray-900/60 to-gray-900"></div>
                    </div>
                )}
                
                <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
                    {config.theme.logoUrl && <img src={config.theme.logoUrl} alt="Logo" className="h-24 mx-auto mb-8 object-contain drop-shadow-lg" />}
                    <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
                        {config.event.name}
                    </h1>
                    <p className="text-2xl sm:text-3xl font-light text-gray-200 mb-10 flex flex-wrap justify-center gap-x-6 gap-y-2">
                        <span className="flex items-center gap-2"><svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>{config.event.date}</span>
                        <span className="hidden sm:inline text-gray-500">|</span>
                        <span className="flex items-center gap-2"><svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>{config.event.location}</span>
                    </p>
                    
                    <div className="flex justify-center mb-12 w-full">
                         <CountdownTimer targetDate={config.event.date} />
                    </div>

                    <button 
                        onClick={onRegister}
                        className="px-10 py-5 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-700 text-white text-xl font-bold rounded-full shadow-xl transform hover:scale-105 transition-all duration-300"
                    >
                        {t('home.heroTitle')}
                    </button>
                </div>
            </section>

            {/* About Section */}
            <section className="max-w-4xl mx-auto px-6 text-center">
                <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">{t('home.aboutTitle')}</h2>
                <div className="prose prose-lg dark:prose-invert mx-auto text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {config.event.description || "Join us for an unforgettable experience. Connect with industry leaders, learn from experts, and explore new opportunities."}
                </div>
            </section>

            {/* Ticket Information */}
            {activeTickets.length > 0 && (
                <section className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900 rounded-[3rem] py-20 px-6 shadow-inner border border-gray-100 dark:border-gray-800">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Registration Tiers</h2>
                            <p className="text-xl text-gray-500 dark:text-gray-400">Choose the perfect pass for your experience</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-center">
                            {activeTickets.map(tier => (
                                <div key={tier.id} className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-200 dark:border-gray-700 flex flex-col hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <svg className="w-32 h-32 text-primary" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                    </div>
                                    
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{tier.name}</h3>
                                    <div className="flex items-baseline mb-6">
                                        <span className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                            {tier.price === 0 ? 'Free' : `${tier.currency} ${tier.price}`}
                                        </span>
                                    </div>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-8 min-h-[3rem]">{tier.description}</p>
                                    
                                    <ul className="space-y-4 mb-8 flex-grow">
                                        {tier.benefits.map((benefit, i) => (
                                            <li key={i} className="flex items-start text-gray-700 dark:text-gray-300">
                                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mr-3 mt-0.5">
                                                    <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                                {benefit}
                                            </li>
                                        ))}
                                    </ul>
                                    
                                    <button 
                                        onClick={onRegister}
                                        className="w-full py-4 px-6 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-lg"
                                    >
                                        {t('home.getTickets')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Featured Speakers */}
            {featuredSpeakers.length > 0 && (
                <section className="max-w-7xl mx-auto px-6">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">{t('home.featuredSpeakers')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        {featuredSpeakers.map(speaker => (
                            <div key={speaker.id} className="group text-center">
                                <div className="relative inline-block mb-6">
                                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500 opacity-0 group-hover:opacity-100"></div>
                                    <img 
                                        src={speaker.photoUrl} 
                                        alt={speaker.name} 
                                        className="relative w-48 h-48 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-xl group-hover:scale-105 transition-transform duration-300" 
                                    />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{speaker.name}</h3>
                                <p className="text-primary font-medium text-lg mb-2">{speaker.title}</p>
                                <p className="text-gray-500 dark:text-gray-400">{speaker.company}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Sponsors */}
            {sponsors.length > 0 && (
                <section className="max-w-7xl mx-auto px-6 text-center border-t border-gray-100 dark:border-gray-800 pt-16">
                    <h2 className="text-lg font-semibold text-gray-400 uppercase tracking-widest mb-10">{t('home.sponsorsTitle')}</h2>
                    <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20 opacity-70 hover:opacity-100 transition-opacity duration-500">
                        {sponsors.map(sponsor => (
                             <a key={sponsor.id} href={sponsor.websiteUrl} target="_blank" rel="noreferrer" className="group">
                                 <img 
                                    src={sponsor.logoUrl} 
                                    alt={sponsor.name} 
                                    className="h-10 md:h-14 object-contain grayscale group-hover:grayscale-0 transition-all duration-300 filter" 
                                />
                             </a>
                        ))}
                    </div>
                </section>
            )}

            {/* Contact Section */}
            <section className="max-w-4xl mx-auto px-6">
                <div className="bg-primary/5 dark:bg-primary/10 rounded-3xl p-12 text-center border border-primary/10">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{t('home.questionsTitle')}</h2>
                    <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
                        {t('home.questionsText')}
                    </p>
                    <a 
                        href={`mailto:${config.host.email}`} 
                        className="inline-flex items-center gap-3 text-primary bg-white dark:bg-gray-800 px-8 py-4 rounded-full font-bold text-lg shadow-md hover:shadow-lg transition-all hover:-translate-y-1"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {config.host.email}
                    </a>
                </div>
            </section>
        </div>
    );
};
