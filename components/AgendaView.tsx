
import React, { useState, useMemo, useEffect } from 'react';
import { type Session, type Speaker } from '../types';
import { addToAgenda, removeFromAgenda, submitSessionFeedback, downloadSessionIcs } from '../server/api';
import { StarRating } from './StarRating';
import { Spinner } from './Spinner';
import { Alert } from './Alert';
import { SessionQAModal } from './SessionQAModal';

interface AgendaViewProps {
  sessions: Session[];
  speakers: Speaker[];
  mySessionIds?: string[];
  delegateToken?: string;
  onToggleSession?: (sessionId: string, isAdded: boolean) => void;
  readOnly?: boolean; // For public page
}

const FeedbackModal: React.FC<{ isOpen: boolean, onClose: () => void, sessionTitle: string, onSubmit: (rating: number, comment: string) => Promise<void> }> = ({ isOpen, onClose, sessionTitle, onSubmit }) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0) {
            alert("Please select a rating.");
            return;
        }
        setIsSubmitting(true);
        await onSubmit(rating, comment);
        setIsSubmitting(false);
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Rate "{sessionTitle}"</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex justify-center py-2">
                        <StarRating rating={rating} onRate={setRating} size="lg" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comments (Optional)</label>
                        <textarea 
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                            rows={3}
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder="What did you think?"
                        ></textarea>
                    </div>
                    <div className="flex justify-end gap-2">
                         <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
                         <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                             {isSubmitting && <Spinner />} Submit
                         </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

const SessionCard: React.FC<{ 
    session: Session, 
    speakers: Speaker[], 
    isAdded?: boolean, 
    onToggle?: () => void,
    onRate?: () => void,
    onQA?: () => void,
    readOnly?: boolean
}> = ({ session, speakers, isAdded, onToggle, onRate, onQA, readOnly }) => {
  const formatTime = (isoString: string) => new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  const sessionSpeakers = useMemo(() => 
    session.speakerIds
      .map(id => speakers.find(s => s.id === id)?.name)
      .filter(Boolean)
      .join(', '),
    [session.speakerIds, speakers]
  );
  
  const handleDownloadIcs = (e: React.MouseEvent) => {
      e.stopPropagation();
      // Pass the full session object to avoid ID lookup issues
      downloadSessionIcs(session).catch(err => console.error("Calendar export failed", err));
  };

  return (
    <div className="flex items-start space-x-4 py-4 group">
      <div className="flex-shrink-0 w-32 text-right">
        <p className="font-semibold text-primary">{formatTime(session.startTime)}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">to {formatTime(session.endTime)}</p>
      </div>
      <div className="flex-grow border-l-2 border-gray-200 dark:border-gray-700 pl-4 relative">
        <div className="flex justify-between items-start pr-8">
            <h4 className="font-bold text-gray-900 dark:text-white">{session.title}</h4>
             <button 
                onClick={handleDownloadIcs}
                className="text-gray-400 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                title="Add to Calendar"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </button>
        </div>
        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 space-y-1">
            <p>
                <span className="font-medium text-gray-600 dark:text-gray-300">Location:</span> {session.location}
            </p>
            {sessionSpeakers && (
            <p>
                <span className="font-medium text-gray-600 dark:text-gray-300">Speakers:</span> {sessionSpeakers}
            </p>
            )}
        </div>
        <p className="mt-2 text-gray-700 dark:text-gray-300 text-sm">{session.description}</p>
        
        {!readOnly && (
            <div className="mt-3 flex gap-3">
                 {onRate && (
                     <button 
                        onClick={onRate}
                        className="text-xs font-medium text-gray-500 hover:text-primary hover:underline flex items-center gap-1"
                     >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                         Rate
                     </button>
                 )}
                 {onQA && (
                     <button 
                        onClick={onQA}
                        className="text-xs font-medium text-gray-500 hover:text-primary hover:underline flex items-center gap-1"
                     >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" /></svg>
                         Q&A
                     </button>
                 )}
            </div>
        )}

        {!readOnly && onToggle && (
            <button 
                onClick={onToggle}
                className={`absolute top-0 right-0 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${isAdded ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}
                title={isAdded ? "Remove from My Agenda" : "Add to My Agenda"}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={isAdded ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
            </button>
        )}
      </div>
    </div>
  );
};

export const AgendaView: React.FC<AgendaViewProps> = ({ sessions, speakers, mySessionIds = [], delegateToken, onToggleSession, readOnly }) => {
  const [viewMode, setViewMode] = useState<'all' | 'my'>('all');
  const [localMySessionIds, setLocalMySessionIds] = useState<Set<string>>(new Set(mySessionIds));
  const [feedbackSession, setFeedbackSession] = useState<Session | null>(null);
  const [qaSession, setQaSession] = useState<Session | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  useEffect(() => {
      setLocalMySessionIds(new Set(mySessionIds));
  }, [mySessionIds]);

  const handleToggle = async (sessionId: string) => {
    if (readOnly) return;
    const isAdded = localMySessionIds.has(sessionId);
    const newSet = new Set(localMySessionIds);
    
    if (isAdded) {
        newSet.delete(sessionId);
    } else {
        newSet.add(sessionId);
    }
    setLocalMySessionIds(newSet);

    // Call API directly for robustness, and also trigger parent callback to update portal state
    if (delegateToken) {
        try {
            if (isAdded) {
                await removeFromAgenda(delegateToken, sessionId);
            } else {
                await addToAgenda(delegateToken, sessionId);
            }
            if (onToggleSession) onToggleSession(sessionId, !isAdded);
        } catch (e) {
            console.error("Failed to update agenda", e);
            // Revert on error
            setLocalMySessionIds(prev => {
                const revertSet = new Set(prev);
                if (isAdded) revertSet.add(sessionId);
                else revertSet.delete(sessionId);
                return revertSet;
            });
        }
    }
  };
  
  const handleFeedbackSubmit = async (rating: number, comment: string) => {
      if (!delegateToken || !feedbackSession) return;
      try {
          await submitSessionFeedback(delegateToken, feedbackSession.id, rating, comment);
          setFeedbackSuccess(true);
          setTimeout(() => setFeedbackSuccess(false), 3000);
      } catch (e) {
          alert("Failed to submit feedback.");
      }
  }

  const filteredSessions = useMemo(() => {
      if (viewMode === 'my' && !readOnly) {
          return sessions.filter(s => localMySessionIds.has(s.id));
      }
      return sessions;
  }, [sessions, viewMode, localMySessionIds, readOnly]);

  const sessionsByDay = useMemo(() => {
    return filteredSessions.reduce((acc, session) => {
      const day = new Date(session.startTime).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (!acc[day]) {
        acc[day] = [];
      }
      acc[day].push(session);
      return acc;
    }, {} as Record<string, Session[]>);
  }, [filteredSessions]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Event Agenda</h2>
          
          {!readOnly && (
              <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex">
                  <button 
                    onClick={() => setViewMode('all')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'all' ? 'bg-white dark:bg-gray-600 shadow text-primary' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'}`}
                  >
                      All Sessions
                  </button>
                  <button 
                    onClick={() => setViewMode('my')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'my' ? 'bg-white dark:bg-gray-600 shadow text-primary' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'}`}
                  >
                      My Schedule
                  </button>
              </div>
          )}
      </div>
      
      {feedbackSuccess && <div className="mb-4"><Alert type="success" message="Feedback submitted! Thank you." /></div>}

      {Object.keys(sessionsByDay).length > 0 ? (
        Object.keys(sessionsByDay).map(day => {
          const daySessions = sessionsByDay[day];
          return (
            <div key={day} className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 py-2 border-b-2 border-primary/50">{day}</h3>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {daySessions && daySessions.map(session => (
                    <SessionCard 
                        key={session.id} 
                        session={session} 
                        speakers={speakers} 
                        isAdded={readOnly ? false : localMySessionIds.has(session.id)}
                        onToggle={() => handleToggle(session.id)}
                        onRate={delegateToken && !readOnly ? () => setFeedbackSession(session) : undefined}
                        onQA={delegateToken && !readOnly ? () => setQaSession(session) : undefined}
                        readOnly={readOnly}
                    />
                ))}
            </div>
            </div>
        )})
      ) : (
        <div className="text-center py-12">
            <p className="italic text-gray-500 dark:text-gray-400">
                {viewMode === 'my' && !readOnly ? "You haven't added any sessions to your schedule yet." : "The event agenda has not been published yet."}
            </p>
        </div>
      )}
      
      <FeedbackModal 
        isOpen={!!feedbackSession} 
        onClose={() => setFeedbackSession(null)} 
        sessionTitle={feedbackSession?.title || ''} 
        onSubmit={handleFeedbackSubmit} 
      />

      {qaSession && delegateToken && (
          <SessionQAModal 
            isOpen={!!qaSession} 
            onClose={() => setQaSession(null)} 
            sessionId={qaSession.id} 
            sessionTitle={qaSession.title} 
            delegateToken={delegateToken} 
          />
      )}
    </div>
  );
};
