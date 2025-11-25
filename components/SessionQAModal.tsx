
import React, { useState, useEffect } from 'react';
import { SessionQuestion } from '../types';
import { getSessionQuestions, submitSessionQuestion, upvoteSessionQuestion } from '../server/api';
import { Spinner } from './Spinner';
import { useLiveQuery } from '../hooks/useLiveQuery';

interface SessionQAModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId: string;
    sessionTitle: string;
    delegateToken: string;
}

export const SessionQAModal: React.FC<SessionQAModalProps> = ({ isOpen, onClose, sessionId, sessionTitle, delegateToken }) => {
    const [newQuestion, setNewQuestion] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: questions, refresh } = useLiveQuery<SessionQuestion[]>(
        () => getSessionQuestions(delegateToken, sessionId),
        ['sessionQuestions'],
        [delegateToken, sessionId]
    );

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newQuestion.trim()) return;
        
        setIsSubmitting(true);
        try {
            await submitSessionQuestion(delegateToken, sessionId, newQuestion);
            setNewQuestion('');
            refresh();
        } catch (e) {
            alert("Failed to post question.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpvote = async (questionId: string) => {
        try {
            await upvoteSessionQuestion(delegateToken, questionId);
            refresh();
        } catch (e) {
            // ignore
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg flex flex-col h-[600px] max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-t-xl">
                    <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Q&A</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[250px]">{sessionTitle}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100 dark:bg-black/20">
                    {questions && questions.length > 0 ? (
                        questions.map(q => (
                            <div key={q.id} className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 flex gap-3">
                                <div className="flex flex-col items-center gap-1">
                                    <button 
                                        onClick={() => handleUpvote(q.id)}
                                        className="text-gray-400 hover:text-primary transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                    </button>
                                    <span className="font-bold text-primary text-sm">{q.upvotes}</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-gray-800 dark:text-white">{q.text}</p>
                                    <div className="mt-2 flex justify-between items-center">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">{q.userName} • {new Date(q.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        {q.isAnswered && <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Answered</span>}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 text-gray-500">
                            No questions yet. Be the first to ask!
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-xl">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <input 
                            type="text" 
                            value={newQuestion}
                            onChange={e => setNewQuestion(e.target.value)}
                            placeholder="Ask a question..." 
                            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary dark:bg-gray-700 dark:text-white"
                        />
                        <button 
                            type="submit" 
                            disabled={!newQuestion.trim() || isSubmitting}
                            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center"
                        >
                            {isSubmitting ? <Spinner /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
