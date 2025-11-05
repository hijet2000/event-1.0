import React, { useState, useRef, useEffect } from 'react';
import { type PublicEvent } from '../types';

interface EventSelectorProps {
    events: PublicEvent[];
    selectedEventId: string | null;
    onSelectEvent: (eventId: string) => void;
    onCreateEvent: () => void;
    canCreate: boolean;
}

export const EventSelector: React.FC<EventSelectorProps> = ({ events, selectedEventId, onSelectEvent, onCreateEvent, canCreate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const selectedEvent = events.find(e => e.id === selectedEventId);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                className="flex items-center justify-between w-64 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">{selectedEvent ? selectedEvent.name : 'Select an Event'}</span>
                <svg className="w-5 h-5 ml-2 -mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute z-10 w-64 mt-2 origin-top-right bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 divide-y divide-gray-100 dark:divide-gray-600 rounded-md shadow-lg">
                    <div className="py-1 max-h-60 overflow-y-auto">
                        {events.map(event => (
                            <button
                                key={event.id}
                                onClick={() => {
                                    onSelectEvent(event.id);
                                    setIsOpen(false);
                                }}
                                className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                            >
                                {event.name}
                            </button>
                        ))}
                    </div>
                    {canCreate && (
                        <div className="py-1">
                             <button
                                onClick={() => {
                                    onCreateEvent();
                                    setIsOpen(false);
                                }}
                                className="w-full text-left block px-4 py-2 text-sm text-primary hover:bg-gray-100 dark:hover:bg-gray-600"
                            >
                                + Create New Event
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
