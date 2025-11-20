
import React, { useState, useEffect, useMemo } from 'react';
import { type Session, type Speaker } from '../types';
import { getSessions, saveSession, deleteSession, getSpeakers, getSessionFeedbackStats, analyzeFeedback } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { SessionEditorModal } from './SessionEditorModal';
import { Spinner } from './Spinner';
import { StarRating } from './StarRating';

interface AgendaDashboardProps {
  adminToken: string;
}

const FeedbackSummary: React.FC<{ session: Session, adminToken: string }> = ({ session, adminToken }) => {
    const [stats, setStats] = useState<{ count: number, avgRating: number } | null>(null);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        getSessionFeedbackStats(adminToken, session.id).then(setStats);
    }, [session.id, adminToken]);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        try {
            const result = await analyzeFeedback(adminToken, session.id);
            setAnalysis(result);
        } catch (e) {
            setAnalysis("Failed to analyze feedback.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (!stats || stats.count === 0) return <span className="text-xs text-gray-400">No ratings yet</span>;

    return (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                 <div className="flex items-center gap-2">
                    <StarRating rating={Math.round(stats.avgRating)} size="sm" disabled />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{stats.avgRating}</span>
                    <span className="text-xs text-gray-500">({stats.count} reviews)</span>
                 </div>
                 <button className="text-xs text-primary hover:underline">
                     {isOpen ? 'Hide Analysis' : 'Analyze Feedback'}
                 </button>
            </div>
            
            {isOpen && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm text-gray-800 dark:text-gray-200 animate-fade-in">
                     <div className="flex justify-between items-start mb-2">
                         <h5 className="font-bold flex items-center gap-2">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                             AI Insight
                         </h5>
                         {!analysis && !isAnalyzing && (
                             <button onClick={handleAnalyze} className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-2 py-1 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700">Generate Summary</button>
                         )}
                     </div>
                     
                     {isAnalyzing ? (
                         <div className="flex items-center gap-2 text-gray-500">
                             <Spinner /> Analyzing sentiment...
                         </div>
                     ) : analysis ? (
                         <p>{analysis}</p>
                     ) : (
                         <p className="text-gray-500 italic">Click generate to summarize attendee comments.</p>
                     )}
                </div>
            )}
        </div>
    );
};

// Color hash function for tracks
const getTrackColor = (track?: string) => {
    if (!track) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    const colors = [
        'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
        'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
        'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
        'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    ];
    let hash = 0;
    for (let i = 0; i < track.length; i++) {
        hash = track.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % colors.length);
    return colors[index];
};

export const AgendaDashboard: React.FC<AgendaDashboardProps> = ({ adminToken }) => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [speakers, setSpeakers] = useState<Speaker[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTrack, setFilterTrack] = useState('');
    
    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [sessionsData, speakersData] = await Promise.all([
                getSessions(adminToken),
                getSpeakers(adminToken)
            ]);
            setSessions(sessionsData);
            setSpeakers(speakersData);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load agenda.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [adminToken]);

    const handleSave = async (data: Partial<Session>) => {
        await saveSession(adminToken, { ...editingSession, ...data });
        await fetchData();
        return true;
    };
    
    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this session?')) {
            await deleteSession(adminToken, id);
            await fetchData();
        }
    };
    
    const filteredSessions = useMemo(() => {
        return sessions.filter(session => {
            const matchesSearch = searchQuery === '' || 
                session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                session.location.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesTrack = filterTrack === '' || session.track === filterTrack;
            
            return matchesSearch && matchesTrack;
        });
    }, [sessions, searchQuery, filterTrack]);
    
    const sessionsByDay = useMemo(() => {
        return filteredSessions.reduce((acc, session) => {
          const day = new Date(session.startTime).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          if (!acc[day]) acc[day] = [];
          acc[day].push(session);
          return acc;
        }, {} as Record<string, Session[]>);
    }, [filteredSessions]);
    
    const uniqueTracks = useMemo(() => Array.from(new Set(sessions.map(s => s.track).filter(Boolean) as string[])), [sessions]);
    
    const getSpeakerNames = (speakerIds: string[]) => {
        return speakerIds
            .map(id => speakers.find(s => s.id === id)?.name)
            .filter(Boolean)
            .join(', ');
    };

    if (isLoading) return <ContentLoader text="Loading agenda..." />;
    if (error) return <Alert type="error" message={error} />;

    return (
        <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Agenda Management</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {sessions.length} Sessions &bull; {speakers.length} Speakers
                    </p>
                </div>
                
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <div className="relative flex-grow md:flex-grow-0">
                        <input 
                            type="text" 
                            placeholder="Search sessions..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-sm focus:ring-primary focus:border-primary dark:text-white"
                        />
                    </div>
                    <select
                        value={filterTrack}
                        onChange={e => setFilterTrack(e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-sm focus:ring-primary focus:border-primary dark:text-white"
                    >
                        <option value="">All Tracks</option>
                        {uniqueTracks.map(track => <option key={track} value={track}>{track}</option>)}
                    </select>
                    <button
                        onClick={() => { setEditingSession(null); setIsModalOpen(true); }}
                        className="py-2 px-4 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary/90 whitespace-nowrap"
                    >
                        + Add Session
                    </button>
                </div>
            </div>
            
            <div className="space-y-8">
                {Object.keys(sessionsByDay).map(day => {
                    const daySessions = sessionsByDay[day];
                    return (
                    <div key={day}>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 py-2 border-b-2 border-primary/50 sticky top-16 bg-gray-100 dark:bg-gray-900 z-10">{day}</h3>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {daySessions.map(session => (
                                <div key={session.id} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col justify-between border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 pr-4">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    {session.track && (
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getTrackColor(session.track)}`}>
                                                            {session.track}
                                                        </span>
                                                    )}
                                                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                                        {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="font-bold text-gray-900 dark:text-white text-lg leading-tight">{session.title}</p>
                                                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-1 flex items-center gap-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                    {session.location}
                                                    {session.capacity && <span className="text-xs text-gray-400 ml-2">(Max {session.capacity})</span>}
                                                </p>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => { setEditingSession(session); setIsModalOpen(true); }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-primary"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg></button>
                                                <button onClick={() => handleDelete(session.id)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                                            </div>
                                        </div>
                                        {session.speakerIds.length > 0 && (
                                            <div className="mt-3 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-5.176-5.97m8.352 2.977A6 6 0 0021 15v-1a6 6 0 00-6-6" /></svg>
                                                {getSpeakerNames(session.speakerIds)}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <FeedbackSummary session={session} adminToken={adminToken} />
                                </div>
                            ))}
                        </div>
                    </div>
                )})}
                 {filteredSessions.length === 0 && (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                        <p className="text-gray-500 dark:text-gray-400">
                            {sessions.length === 0 ? "No sessions scheduled yet." : "No sessions match your filters."}
                        </p>
                        {sessions.length === 0 && (
                             <button
                                onClick={() => { setEditingSession(null); setIsModalOpen(true); }}
                                className="mt-4 text-primary hover:underline font-medium"
                            >
                                Create your first session
                            </button>
                        )}
                    </div>
                 )}
            </div>
            
            <SessionEditorModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSave={handleSave} 
                session={editingSession} 
                adminToken={adminToken} 
                speakers={speakers} 
                existingSessions={sessions}
            />
        </>
    );
};
