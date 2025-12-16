
import React, { useState, useRef, useEffect } from 'react';
import { askHelp } from '../server/api';
import { Spinner } from './Spinner';

interface HelpDashboardProps {
    adminToken: string;
}

const MODULES = [
    { id: 'dashboard', title: 'Dashboard', content: 'Provides a high-level overview of event stats, including total registrations, financial metrics, task progress, and a countdown timer. Use Quick Actions for fast access to common tasks.' },
    { id: 'registrations', title: 'Registrations', content: 'Manage the attendee list. You can add users manually, import them via CSV (bulk import), or export the list. Use the "Scan to Check-in" button to process arrivals using QR codes. The "Launch Kiosk" mode is for self-service check-in stations.' },
    { id: 'agenda', title: 'Agenda & Speakers', content: 'Create and schedule sessions. Assign speakers to sessions. You can use the AI auto-fill feature to generate session descriptions. Use "Live Polls" to interact with the audience during sessions.' },
    { id: 'directory', title: 'Directory', content: 'Manage profiles for Speakers and Sponsors. Define sponsorship tiers (Platinum, Gold, etc.). AI can help research bio information or generate company descriptions.' },
    { id: 'communications', title: 'Communications', content: 'Send emails or broadcasts to attendees. You can target specific groups (e.g., only checked-in users). Check the logs to see delivery status. Configure your email provider (SMTP or Google) in Settings.' },
    { id: 'gamification', title: 'Gamification', content: 'Setup a Scavenger Hunt. Create challenges with secret codes and generate QR codes for them. Delegates scan these codes to earn points on the leaderboard.' },
    { id: 'settings', title: 'Settings', content: 'Configure core event details (Name, Date, Location), branding (Colors, Logo), and integrations. Set up your payment gateway (Stripe) and email provider here.' },
    { id: 'kiosk', title: 'Kiosk Mode', content: 'A simplified interface for unattended tablets at the venue entrance. Allows attendees to scan their QR code to check in and optionally auto-print their badge.' },
];

export const HelpDashboard: React.FC<HelpDashboardProps> = ({ adminToken }) => {
    const [activeModule, setActiveModule] = useState<string | null>(null);
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant', text: string }[]>([
        { role: 'assistant', text: 'Hello! I am your Event Platform Assistant. How can I help you today?' }
    ]);
    const [query, setQuery] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        const userMessage = query;
        setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
        setQuery('');
        setIsThinking(true);

        try {
            const answer = await askHelp(adminToken, userMessage);
            setChatHistory(prev => [...prev, { role: 'assistant', text: answer }]);
        } catch (e) {
            setChatHistory(prev => [...prev, { role: 'assistant', text: "Sorry, I encountered an error connecting to the help system." }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-100px)]">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Help & Support</h2>
            
            <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
                
                {/* Left Panel: Module Guide */}
                <div className="w-full lg:w-1/3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-white">Module Guide</h3>
                        <p className="text-sm text-gray-500">Click to learn more</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {MODULES.map(mod => (
                            <div key={mod.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                <button 
                                    onClick={() => setActiveModule(activeModule === mod.id ? null : mod.id)}
                                    className={`w-full flex justify-between items-center p-3 text-left font-medium transition-colors ${activeModule === mod.id ? 'bg-primary/5 text-primary' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200'}`}
                                >
                                    {mod.title}
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transform transition-transform ${activeModule === mod.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {activeModule === mod.id && (
                                    <div className="p-4 bg-gray-50 dark:bg-gray-900/30 text-sm text-gray-600 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700">
                                        {mod.content}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Panel: AI Chat */}
                <div className="w-full lg:w-2/3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary/10 to-transparent flex items-center gap-3">
                        <div className="bg-primary text-white p-2 rounded-full shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">AI Troubleshooter</h3>
                            <p className="text-xs text-gray-500">Ask about features or issues</p>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-black/20">
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-lg shadow-sm text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isThinking && (
                            <div className="flex justify-start">
                                <div className="bg-white dark:bg-gray-700 p-3 rounded-lg rounded-bl-none shadow-sm flex gap-1">
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></span>
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex gap-2">
                        <input 
                            type="text" 
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="e.g., How do I add a new speaker?" 
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                            disabled={isThinking}
                        />
                        <button 
                            type="submit" 
                            disabled={!query.trim() || isThinking}
                            className="bg-primary text-white p-2 rounded-full hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                            {isThinking ? <Spinner /> : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                                </svg>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
