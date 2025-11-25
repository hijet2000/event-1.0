
import React, { useState, useEffect, useRef } from 'react';
import { getNotifications, markNotificationRead, clearAllNotifications } from '../server/api';
import { AppNotification } from '../types';
import { useLiveQuery } from '../hooks/useLiveQuery';

interface NotificationBellProps {
    delegateToken: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ delegateToken }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Live query for real-time updates
    const { data: notifications, refresh } = useLiveQuery<AppNotification[]>(
        () => getNotifications(delegateToken),
        ['notifications'],
        [delegateToken]
    );

    const unreadCount = notifications?.filter(n => !n.read).length || 0;

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleMarkRead = async (id: string) => {
        await markNotificationRead(delegateToken, id);
        refresh();
    };

    const handleClearAll = async () => {
        await clearAllNotifications(delegateToken);
        refresh();
    };

    const getIcon = (type: string) => {
        switch(type) {
            case 'success': return <span className="text-green-500">✓</span>;
            case 'warning': return <span className="text-yellow-500">⚠</span>;
            case 'error': return <span className="text-red-500">!</span>;
            default: return <span className="text-blue-500">i</span>;
        }
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-primary transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50 border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-white">Notifications</h3>
                        {unreadCount > 0 && (
                            <button onClick={handleClearAll} className="text-xs text-primary hover:underline">
                                Mark all read
                            </button>
                        )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {notifications && notifications.length > 0 ? (
                            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                                {notifications.map(notif => (
                                    <li 
                                        key={notif.id} 
                                        className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${!notif.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                        onClick={() => handleMarkRead(notif.id)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 flex-shrink-0">{getIcon(notif.type)}</div>
                                            <div className="flex-1">
                                                <p className={`text-sm ${!notif.read ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                                                    {notif.title}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                                                <p className="text-[10px] text-gray-400 mt-1">{new Date(notif.timestamp).toLocaleString()}</p>
                                            </div>
                                            {!notif.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="p-8 text-center text-gray-500 text-sm">
                                No notifications.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
