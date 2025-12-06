
import React, { useState, useEffect } from 'react';
import { PollWithResults } from '../types';
import { getPolls, createPoll, updatePollStatus, votePoll } from '../server/api';
import { Spinner } from './Spinner';
import { useLiveQuery } from '../hooks/useLiveQuery';

interface SessionLivePollsModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId: string;
    sessionTitle: string;
    delegateToken: string;
    isAdmin?: boolean;
}

export const SessionLivePollsModal: React.FC<SessionLivePollsModalProps> = ({ isOpen, onClose, sessionId, sessionTitle, delegateToken, isAdmin = false }) => {
    // The useLiveQuery hook now reacts to 'refresh:polls' events from the socket automatically
    const { data: polls, isLoading, refresh } = useLiveQuery<PollWithResults[]>(
        () => getPolls(delegateToken, sessionId),
        ['polls'],
        [delegateToken, sessionId]
    );

    // Create Poll State
    const [newQuestion, setNewQuestion] = useState('');
    const [newOptions, setNewOptions] = useState(['', '']);
    const [isCreating, setIsCreating] = useState(false);
    const [isSubmittingVote, setIsSubmittingVote] = useState(false);

    if (!isOpen) return null;

    const handleCreatePoll = async (e: React.FormEvent) => {
        e.preventDefault();
        const validOptions = newOptions.filter(o => o.trim());
        if (!newQuestion.trim() || validOptions.length < 2) {
            alert("Please enter a question and at least 2 options.");
            return;
        }
        
        setIsCreating(true);
        try {
            await createPoll(delegateToken, sessionId, newQuestion, validOptions);
            setNewQuestion('');
            setNewOptions(['', '']);
            // refresh(); // handled by socket event
        } catch (e) {
            alert("Failed to create poll.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleVote = async (pollId: string, optionIndex: number) => {
        setIsSubmittingVote(true);
        try {
            await votePoll(delegateToken, pollId, optionIndex);
            // refresh(); // handled by socket event
        } catch (e) {
            alert("Failed to record vote.");
        } finally {
            setIsSubmittingVote(false);
        }
    };

    const handleStatusChange = async (pollId: string, status: 'active' | 'closed') => {
        try {
            await updatePollStatus(delegateToken, pollId, status);
            // refresh(); // handled by socket event
        } catch (e) {
            alert("Failed to update status.");
        }
    };

    const addOption = () => setNewOptions([...newOptions, '']);
    const updateOption = (idx: number, val: string) => {
        const updated = [...newOptions];
        updated[idx] = val;
        setNewOptions(updated);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg flex flex-col h-[700px] max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-t-xl">
                    <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Live Polls</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[250px]">{sessionTitle}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-100 dark:bg-black/20">
                    {/* Active/Closed Polls List */}
                    {polls?.filter(p => isAdmin || p.status !== 'draft').map(poll => {
                        const total = poll.totalVotes || 0;
                        const hasVoted = poll.userVotedIndex !== undefined;
                        const showResults = isAdmin || hasVoted || poll.status === 'closed';

                        return (
                            <div key={poll.id} className="bg-white dark:bg-gray-700 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                                <div className="flex justify-between items-start mb-3">
                                    <h4 className="font-bold text-gray-900 dark:text-white">{poll.question}</h4>
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${poll.status === 'active' ? 'bg-green-100 text-green-800' : poll.status === 'draft' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-800'}`}>
                                        {poll.status}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {poll.options.map((opt, idx) => {
                                        const count = poll.votes[idx] || 0;
                                        const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                                        const isSelected = poll.userVotedIndex === idx;

                                        return (
                                            <div key={idx} className="relative">
                                                {showResults ? (
                                                    <div className="relative h-8 bg-gray-100 dark:bg-gray-600 rounded-md overflow-hidden">
                                                        <div 
                                                            className={`absolute top-0 left-0 h-full transition-all duration-500 ${isSelected ? 'bg-primary/30' : 'bg-gray-300 dark:bg-gray-500'}`} 
                                                            style={{ width: `${percent}%` }}
                                                        ></div>
                                                        <div className="absolute inset-0 flex justify-between items-center px-3 text-sm">
                                                            <span className="font-medium truncate mr-2 text-gray-800 dark:text-white">{opt} {isSelected && '(You)'}</span>
                                                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{percent}% ({count})</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleVote(poll.id, idx)}
                                                        disabled={isSubmittingVote || poll.status !== 'active'}
                                                        className="w-full text-left px-3 py-2 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium transition-colors dark:text-gray-200 dark:border-gray-500 disabled:opacity-50"
                                                    >
                                                        {opt}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                <div className="mt-3 flex justify-between items-center text-xs text-gray-500">
                                    <span>{total} votes</span>
                                    {isAdmin && (
                                        <div className="flex gap-2">
                                            {poll.status === 'draft' && <button onClick={() => handleStatusChange(poll.id, 'active')} className="text-green-600 hover:underline">Launch</button>}
                                            {poll.status === 'active' && <button onClick={() => handleStatusChange(poll.id, 'closed')} className="text-red-600 hover:underline">Close</button>}
                                            {poll.status === 'closed' && <button onClick={() => handleStatusChange(poll.id, 'active')} className="text-blue-600 hover:underline">Re-open</button>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    
                    {(!polls || polls.length === 0) && !isAdmin && (
                        <div className="text-center py-10 text-gray-500">No active polls at the moment.</div>
                    )}
                </div>

                {/* Admin Create Section */}
                {isAdmin && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-xl">
                        <h4 className="font-bold text-sm mb-3 text-gray-700 dark:text-gray-300">Create New Poll</h4>
                        <form onSubmit={handleCreatePoll} className="space-y-3">
                            <input 
                                type="text" 
                                placeholder="Question" 
                                value={newQuestion}
                                onChange={e => setNewQuestion(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                            {newOptions.map((opt, i) => (
                                <input 
                                    key={i}
                                    type="text" 
                                    placeholder={`Option ${i+1}`} 
                                    value={opt}
                                    onChange={e => updateOption(i, e.target.value)}
                                    className="w-full border rounded-md px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            ))}
                            <div className="flex gap-2">
                                <button type="button" onClick={addOption} className="text-xs text-primary hover:underline">+ Add Option</button>
                            </div>
                            <button 
                                type="submit" 
                                disabled={isCreating}
                                className="w-full bg-primary text-white py-2 rounded-md text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex justify-center items-center"
                            >
                                {isCreating ? <Spinner /> : 'Create Draft'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};
