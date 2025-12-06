import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, ChatConversation } from '../types';
import { getConversations, getMessages, sendMessage } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { VideoCallModal } from './VideoCallModal';

interface ChatViewProps {
    delegateToken: string;
    initialChatUserId?: string; // To support "Message" button from other screens
}

export const ChatView: React.FC<ChatViewProps> = ({ delegateToken, initialChatUserId }) => {
    const [activeChatId, setActiveChatId] = useState<string | null>(initialChatUserId || null);
    const [messageInput, setMessageInput] = useState('');
    const [isCallOpen, setIsCallOpen] = useState(false);
    const [isCaller, setIsCaller] = useState(false); // Track if I initiated the call
    const scrollRef = useRef<HTMLDivElement>(null);

    // Live Query for Conversation List
    const { data: conversations, isLoading: loadingConvos, refresh: refreshConvos } = useLiveQuery<ChatConversation[]>(
        () => getConversations(delegateToken),
        ['messages'],
        [delegateToken]
    );

    // Live Query for Active Messages
    const { data: messages, isLoading: loadingMessages, refresh: refreshMessages } = useLiveQuery<ChatMessage[]>(
        async () => activeChatId ? getMessages(delegateToken, activeChatId) : Promise.resolve([]),
        ['messages'],
        [delegateToken, activeChatId]
    );

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageInput.trim() || !activeChatId) return;
        
        const content = messageInput;
        setMessageInput(''); // Optimistic clear
        
        try {
            await sendMessage(delegateToken, activeChatId, content);
            refreshMessages();
            refreshConvos();
        } catch (e) {
            alert("Failed to send message");
            setMessageInput(content); // Restore on fail
        }
    };

    const handleStartCall = async () => {
        if (!activeChatId) return;
        setIsCaller(true);
        setIsCallOpen(true);
        // Send a system message to invite the other person
        await sendMessage(delegateToken, activeChatId, "[VIDEO_CALL_INVITE]");
        refreshMessages();
    };

    const handleJoinCall = () => {
        setIsCaller(false);
        setIsCallOpen(true);
    };

    const activePartnerName = conversations?.find(c => c.withUserId === activeChatId)?.withUserName || "Chat";

    if (loadingConvos && !conversations) return <ContentLoader text="Loading chats..." />;

    return (
        <div className="flex h-[calc(100vh-200px)] min-h-[500px] bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
            
            {/* Sidebar / Contact List */}
            <div className={`w-full md:w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white">Messages</h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {conversations && conversations.length > 0 ? conversations.map(conv => (
                        <div 
                            key={conv.withUserId}
                            onClick={() => setActiveChatId(conv.withUserId)}
                            className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 ${activeChatId === conv.withUserId ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                        >
                            <div className="flex justify-between items-start">
                                <h4 className={`font-semibold text-sm ${conv.unreadCount > 0 ? 'text-black dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {conv.withUserName}
                                </h4>
                                <span className="text-xs text-gray-400">{new Date(conv.lastTimestamp).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <p className={`text-sm truncate w-40 ${conv.unreadCount > 0 ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                                    {conv.lastMessage === '[VIDEO_CALL_INVITE]' ? '📞 Video Call Invite' : conv.lastMessage}
                                </p>
                                {conv.unreadCount > 0 && (
                                    <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">{conv.unreadCount}</span>
                                )}
                            </div>
                        </div>
                    )) : (
                        <div className="p-8 text-center text-gray-500">
                            No conversations yet. Visit the Networking Hub to find people!
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`w-full md:w-2/3 flex flex-col ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
                {activeChatId ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setActiveChatId(null)} className="md:hidden text-gray-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
                                    {activePartnerName.charAt(0)}
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white">{activePartnerName}</h3>
                            </div>
                            <button 
                                onClick={handleStartCall}
                                className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors"
                                title="Video Call"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100 dark:bg-black/20" ref={scrollRef}>
                            {loadingMessages ? <ContentLoader /> : messages?.map(msg => {
                                const isMe = msg.senderId !== activeChatId;
                                const isInvite = msg.content === '[VIDEO_CALL_INVITE]';
                                
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        {isInvite ? (
                                            <div className={`max-w-[75%] p-4 rounded-xl shadow-sm border ${isMe ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'} flex flex-col items-center`}>
                                                <p className="font-bold text-gray-700 mb-2">{isMe ? 'You started a video call' : 'Incoming Video Call'}</p>
                                                {!isMe && (
                                                    <button onClick={handleJoinCall} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full font-bold shadow-md transition-transform hover:scale-105">
                                                        Join Call
                                                    </button>
                                                )}
                                                {isMe && <span className="text-xs text-gray-500">Waiting for answer...</span>}
                                            </div>
                                        ) : (
                                            <div className={`max-w-[75%] p-3 rounded-2xl text-sm shadow-sm ${
                                                isMe 
                                                ? 'bg-primary text-white rounded-br-none' 
                                                : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
                                            }`}>
                                                {msg.content}
                                                <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-primary-100' : 'text-gray-400'}`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSend} className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                            <input 
                                type="text" 
                                value={messageInput} 
                                onChange={e => setMessageInput(e.target.value)} 
                                placeholder="Type a message..." 
                                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-primary dark:bg-gray-700 dark:text-white"
                            />
                            <button 
                                type="submit" 
                                disabled={!messageInput.trim()}
                                className="bg-primary text-white p-2 rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                                </svg>
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-900/20">
                        <p>Select a conversation to start chatting</p>
                    </div>
                )}
            </div>
            
            {activeChatId && (
                <VideoCallModal 
                    isOpen={isCallOpen} 
                    onClose={() => setIsCallOpen(false)} 
                    partnerName={activePartnerName}
                    partnerId={activeChatId}
                    isCaller={isCaller}
                    delegateToken={delegateToken}
                />
            )}
        </div>
    );
};
