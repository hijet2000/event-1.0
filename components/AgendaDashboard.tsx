
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

export const AgendaDashboard: React.FC<AgendaDashboardProps> = ({ adminToken }) => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [speakers, setSpeakers] = useState<Speaker[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
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
    
    const sessionsByDay = useMemo(() => {
        return sessions.reduce((acc, session) => {
          const day = new Date(session.startTime).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          if (!acc[day]) acc[day] = [];
          acc[day].push(session);
          return acc;
        }, {} as Record<string, Session[]>);
    }, [sessions]);
    
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
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Agenda Management</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Schedule and manage all event sessions.</p>
                </div>
                <button
                    onClick={() => { setEditingSession(null); setIsModalOpen(true); }}
                    className="py-2 px-4 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary/90"
                >
                    + Add Session
                </button>
            </div>
            
            <div className="space-y-8">
                {Object.keys(sessionsByDay).map(day => {
                    const daySessions = sessionsByDay[day];
                    return (
                    <div key={day}>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 py-2 border-b-2 border-primary/50">{day}</h3>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {daySessions.map(session => (
                                <div key={session.id} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white text-lg">{session.title}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-1">@ {session.location}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => { setEditingSession(session); setIsModalOpen(true); }} className="p-1 text-gray-400 hover:text-primary"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg></button>
                                                <button onClick={() => handleDelete(session.id)} className="p-1 text-gray-400 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                                            </div>
                                        </div>
                                        {session.speakerIds.length > 0 && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2"><strong>Speakers:</strong> {getSpeakerNames(session.speakerIds)}</p>}
                                    </div>
                                    
                                    <FeedbackSummary session={session} adminToken={adminToken} />
                                </div>
                            ))}
                        </div>
                    </div>
                )})}
                 {sessions.length === 0 && <p className="text-center italic text-gray-500 dark:text-gray-400 py-8">No sessions have been scheduled yet.</p>}
            </div>
            
            <SessionEditorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} session={editingSession} adminToken={adminToken} speakers={speakers} />
        </>
    );
};
