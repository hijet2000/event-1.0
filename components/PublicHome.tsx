
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
        <div className="space-y-24 pb-20">
            {/* Hero Section */}
            <section className="relative text-center py-28 px-4 sm:px-6 lg:px-8 rounded-[3rem] overflow-hidden bg-gray-900 text-white shadow-2xl border-4 border-white/5">
                {config.theme.pageImageUrl && (
                    <div className="absolute inset-0 z-0">
                        <img src={config.theme.pageImageUrl} alt="Background" className="w-full h-full object-cover opacity-40 scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-tr from-gray-950 via-gray-900/60 to-primary/20"></div>
                    </div>
                )}
                
                <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
                    {config.theme.logoUrl ? (
                      <img src={config.theme.logoUrl} alt="Logo" className="h-20 mx-auto mb-10 object-contain drop-shadow-2xl" />
                    ) : (
                      <div className="w-16 h-16 bg-primary rounded-2xl rotate-12 mb-10 shadow-2xl shadow-primary/40 flex items-center justify-center font-black text-2xl">FE</div>
                    )}
                    
                    <h1 className="text-5xl sm:text-8xl font-black tracking-tighter mb-8 leading-[1.1] animate-fade-in-up">
                        {config.event.name.split(' ').map((word, i) => (
                          <span key={i} className={i === 1 ? "text-primary" : ""}>{word} </span>
                        ))}
                    </h1>
                    
                    <div className="flex flex-wrap justify-center gap-6 mb-12">
                        <div className="flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl">
                            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                            <span className="font-bold tracking-tight">{config.event.date}</span>
                        </div>
                        <div className="flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl">
                            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                            <span className="font-bold tracking-tight">{config.event.location}</span>
                        </div>
                    </div>
                    
                    <div className="w-full max-w-md mx-auto scale-110 mb-12">
                         <CountdownTimer targetDate={config.event.date} />
                    </div>

                    <button 
                        onClick={onRegister}
                        className="group relative px-12 py-5 bg-primary text-white text-2xl font-black rounded-full shadow-2xl shadow-primary/40 hover:bg-primary/90 transition-all duration-300 transform hover:-translate-y-1 active:scale-95"
                    >
                        <span className="relative z-10 flex items-center gap-3 uppercase tracking-tighter">
                          Register Your Pass
                          <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                        </span>
                    </button>
                </div>
            </section>

            {/* Content Split Section */}
            <section className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                <div className="space-y-8">
                    <div className="inline-block px-4 py-1.5 bg-primary/10 rounded-full text-primary text-sm font-black uppercase tracking-widest border border-primary/20">
                      Discovery
                    </div>
                    <h2 className="text-5xl font-black text-gray-900 dark:text-white leading-tight">Beyond Boundaries,<br/>On the Edge.</h2>
                    <p className="text-xl text-gray-600 dark:text-gray-400 leading-relaxed">
                        {config.event.description}
                    </p>
                    <div className="flex gap-10 pt-4">
                        <div>
                            <p className="text-4xl font-black text-primary">50+</p>
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Sessions</p>
                        </div>
                        <div>
                            <p className="text-4xl font-black text-primary">20+</p>
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Workshops</p>
                        </div>
                        <div>
                            <p className="text-4xl font-black text-primary">1k+</p>
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Attendees</p>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-6 relative">
                  <div className="aspect-[3/4] rounded-[2rem] overflow-hidden shadow-2xl transform -rotate-3 hover:rotate-0 transition-transform duration-500 border-8 border-white dark:border-gray-800">
                      <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070" className="w-full h-full object-cover" alt="Networking" />
                  </div>
                  <div className="aspect-[3/4] rounded-[2rem] overflow-hidden shadow-2xl transform translate-y-12 rotate-3 hover:rotate-0 transition-transform duration-500 border-8 border-white dark:border-gray-800">
                      <img src="https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=2070" className="w-full h-full object-cover" alt="Learning" />
                  </div>
                </div>
            </section>

            {/* Ticket Information */}
            {activeTickets.length > 0 && (
                <section className="bg-gray-50 dark:bg-gray-900/50 rounded-[4rem] py-24 px-6 border-y border-gray-100 dark:border-gray-800">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-20">
                            <h2 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white mb-6 uppercase tracking-tighter">Your Access</h2>
                            <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto font-medium">Select a tier to begin your journey at {config.event.name}.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                            {activeTickets.map(tier => (
                                <div key={tier.id} className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-10 border border-gray-100 dark:border-gray-700 flex flex-col hover:shadow-3xl hover:-translate-y-2 transition-all duration-500 relative group overflow-hidden">
                                    <div className="absolute top-0 right-0 p-8 text-primary/5 group-hover:text-primary/10 transition-colors">
                                        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 6-6z"/></svg>
                                    </div>
                                    
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-6 uppercase tracking-widest border-b pb-4 dark:border-gray-700">{tier.name}</h3>
                                    <div className="flex items-baseline mb-8">
                                        <span className="text-6xl font-black text-gray-900 dark:text-white tracking-tighter">
                                            {tier.price === 0 ? 'FREE' : `${tier.price}`}
                                        </span>
                                        {tier.price !== 0 && <span className="ml-2 text-2xl font-bold text-gray-400">{tier.currency}</span>}
                                    </div>
                                    
                                    <ul className="space-y-5 mb-12 flex-grow">
                                        {tier.benefits.map((benefit, i) => (
                                            <li key={i} className="flex items-start text-gray-600 dark:text-gray-300 font-medium">
                                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mr-4 mt-0.5">
                                                    <svg className="h-3 w-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7"/></svg>
                                                </div>
                                                {benefit}
                                            </li>
                                        ))}
                                    </ul>
                                    
                                    <button 
                                        onClick={onRegister}
                                        className="w-full py-5 px-8 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-lg font-black rounded-2xl hover:bg-black dark:hover:bg-gray-100 transition-all uppercase tracking-tighter shadow-lg shadow-black/10 group-hover:scale-[1.02]"
                                    >
                                        Choose Pass
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
                    <div className="flex justify-between items-end mb-16">
                      <div className="max-w-xl">
                        <h2 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">The Visionaries</h2>
                        <p className="text-gray-500 mt-2 font-medium">Global leaders setting the agenda for the future.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {featuredSpeakers.map(speaker => (
                            <div key={speaker.id} className="group flex flex-col items-center">
                                <div className="relative mb-8 w-64 h-64">
                                    <div className="absolute inset-0 bg-primary/20 rounded-[3rem] rotate-6 scale-95 group-hover:rotate-12 transition-transform duration-500"></div>
                                    <div className="absolute inset-0 bg-secondary/20 rounded-[3rem] -rotate-6 scale-95 group-hover:-rotate-12 transition-transform duration-500"></div>
                                    <img 
                                        src={speaker.photoUrl} 
                                        alt={speaker.name} 
                                        className="relative w-full h-full rounded-[3rem] object-cover shadow-2xl border-4 border-white dark:border-gray-800" 
                                    />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{speaker.name}</h3>
                                <p className="text-primary font-bold uppercase tracking-widest text-xs mb-1">{speaker.title}</p>
                                <p className="text-gray-500 dark:text-gray-400 font-medium">{speaker.company}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Final Call to Action */}
            <section className="max-w-7xl mx-auto px-6">
                <div className="bg-gradient-to-br from-primary to-indigo-700 rounded-[4rem] p-16 sm:p-24 text-center relative overflow-hidden shadow-3xl shadow-primary/20">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none"></div>
                    
                    <h2 className="text-4xl sm:text-7xl font-black text-white mb-8 tracking-tighter uppercase relative z-10 leading-none">Ready to step into<br/>the future?</h2>
                    <p className="text-xl sm:text-2xl text-indigo-100 mb-12 max-w-2xl mx-auto font-medium relative z-10">
                        Limited spots available for the most exclusive tech gathering of 2025.
                    </p>
                    
                    <button 
                        onClick={onRegister}
                        className="relative z-10 px-12 py-6 bg-white text-primary text-2xl font-black rounded-full shadow-2xl hover:bg-gray-100 transition-all transform hover:scale-110 uppercase tracking-tighter"
                    >
                        Claim Your Access Now
                    </button>
                </div>
            </section>
        </div>
    );
};
