
import React, { useState, useEffect } from 'react';
import { getPublicSessionData } from '../server/api';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Spinner } from './Spinner';
import { PollWithResults, Session, SessionQuestion } from '../types';

interface ProjectorViewProps {
    sessionId: string;
    onExit: () => void;
}

const BarChart: React.FC<{ options: string[], votes: number[], total: number }> = ({ options, votes, total }) => {
    const maxVotes = Math.max(...votes, 1);
    
    return (
        <div className="space-y-6">
            {options.map((opt, idx) => {
                const count = votes[idx] || 0;
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                const barWidth = `${(count / maxVotes) * 100}%`;
                
                return (
                    <div key={idx} className="relative">
                        <div className="flex justify-between items-end mb-2 text-2xl text-white font-medium">
                            <span>{opt}</span>
                            <span className="text-gray-400">{percentage}%</span>
                        </div>
                        <div className="h-10 bg-gray-700 rounded-full overflow-hidden relative">
                            <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-1000 ease-out"
                                style={{ width: barWidth }}
                            ></div>
                        </div>
                    </div>
                )
            })}
        </div>
    );
}

export const ProjectorView: React.FC<ProjectorViewProps> = ({ sessionId, onExit }) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    const { data, isLoading } = useLiveQuery<{ session: Session, polls: PollWithResults[], questions: SessionQuestion[] }>(
        () => getPublicSessionData(sessionId),
        ['polls', 'sessionQuestions'],
        [sessionId]
    );

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (isLoading || !data) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    const { session, polls, questions } = data;
    const activePoll = polls.find(p => p.status === 'active' || p.status === 'closed'); // Show results for active/closed
    const topQuestions = questions.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0)).slice(0, 4);

    return (
        <div className="min-h-screen bg-gray-900 text-white overflow-hidden font-sans flex flex-col">
            {/* Header */}
            <header className="px-12 py-8 bg-gray-800 flex justify-between items-center border-b border-gray-700">
                <div>
                    <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                        {session.title}
                    </h1>
                    <p className="text-2xl text-gray-400 mt-2">{session.location} • {session.track}</p>
                </div>
                <div className="text-right">
                    <div className="text-5xl font-mono font-light tracking-wider">
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <button onClick={onExit} className="text-sm text-gray-600 hover:text-gray-400 mt-2">Exit Projector Mode</button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex p-12 gap-12">
                
                {/* Left Column: Q&A / Info */}
                <div className="w-1/3 flex flex-col space-y-8">
                    {/* Join QR */}
                    <div className="bg-white text-black p-6 rounded-3xl shadow-xl flex flex-col items-center text-center">
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin + '/app')}`} 
                            alt="Join Session" 
                            className="w-48 h-48 mb-4"
                        />
                        <h3 className="text-2xl font-bold mb-2">Join the Discussion</h3>
                        <p className="text-lg">Scan to vote and ask questions</p>
                    </div>

                    {/* Top Questions */}
                    <div className="flex-1 bg-gray-800 rounded-3xl p-8 shadow-inner overflow-hidden flex flex-col">
                        <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                            <span className="text-yellow-400">★</span> Top Questions
                        </h2>
                        {topQuestions.length > 0 ? (
                            <div className="space-y-6">
                                {topQuestions.map((q, idx) => (
                                    <div key={q.id} className="bg-gray-700 p-5 rounded-xl border-l-8 border-yellow-400 shadow-md">
                                        <p className="text-2xl font-medium leading-snug">{q.text}</p>
                                        <div className="flex justify-between items-center mt-3 text-gray-400">
                                            <span className="text-lg">{q.userName}</span>
                                            <span className="flex items-center gap-2 bg-gray-900 px-3 py-1 rounded-full">
                                                <span>▲</span> {q.upvotes}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-500 text-2xl italic">
                                Waiting for questions...
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Live Poll Results */}
                <div className="w-2/3 bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-10 shadow-2xl border border-gray-700 flex flex-col relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

                    {activePoll ? (
                        <div className="relative z-10 h-full flex flex-col justify-center">
                            <div className="mb-10 text-center">
                                <span className="inline-block px-4 py-2 bg-red-600 text-white font-bold tracking-widest rounded-full mb-4 animate-pulse">
                                    LIVE POLL
                                </span>
                                <h2 className="text-5xl font-extrabold leading-tight text-white mb-4">
                                    {activePoll.question}
                                </h2>
                                <p className="text-2xl text-gray-400">{activePoll.totalVotes} Votes</p>
                            </div>
                            
                            <div className="flex-1 flex flex-col justify-center">
                                <BarChart 
                                    options={activePoll.options} 
                                    votes={activePoll.votes} 
                                    total={activePoll.totalVotes} 
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                            <svg className="w-32 h-32 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                            <h3 className="text-3xl font-bold">No Active Poll</h3>
                            <p className="text-xl mt-2">Poll results will appear here automatically.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
