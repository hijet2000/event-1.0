
import React, { useState } from 'react';
import { type EventData } from '../types';
import { createEvent } from '../server/api';
import { Spinner } from './Spinner';
import { Alert } from './Alert';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newEvent: EventData) => void;
  adminToken: string;
}

const EVENT_TYPES = ['Conference', 'Workshop', 'Webinar', 'Meetup', 'Other'];

export const CreateEventModal: React.FC<CreateEventModalProps> = ({ isOpen, onClose, onSuccess, adminToken }) => {
    const [eventName, setEventName] = useState('');
    const [eventType, setEventType] = useState(EVENT_TYPES[0]);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    if (!isOpen) return null;

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventName.trim()) {
            setError("Event name is required.");
            return;
        }
        
        setIsCreating(true);
        setError(null);
        try {
            const newEvent = await createEvent(adminToken, eventName, eventType);
            onSuccess(newEvent);
            setEventName(''); // Reset for next time
            setEventType(EVENT_TYPES[0]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create event.');
        } finally {
            setIsCreating(false);
        }
    };
    
    const handleClose = () => {
        setEventName('');
        setEventType(EVENT_TYPES[0]);
        setError(null);
        setIsCreating(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={handleClose}>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 id="create-event-title" className="text-xl font-bold text-gray-900 dark:text-white">Create New Event</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Enter a name for your new event. All other settings can be configured later.
                </p>
                <form onSubmit={handleCreate} className="mt-6 space-y-4">
                    {error && <Alert type="error" message={error} />}
                    <div>
                        <label htmlFor="eventName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Event Name
                        </label>
                        <input
                            type="text"
                            id="eventName"
                            value={eventName}
                            onChange={(e) => setEventName(e.target.value)}
                            className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700"
                            placeholder="e.g., My Awesome Conference"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="eventType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Event Type
                        </label>
                         <select id="eventType" value={eventType} onChange={(e) => setEventType(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm">
                            {EVENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                    <div className="pt-2 flex justify-end gap-3">
                        <button type="button" onClick={handleClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCreating}
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center justify-center disabled:opacity-50"
                        >
                            {isCreating ? <><Spinner /> Creating...</> : 'Create Event'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
