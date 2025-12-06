
import React, { useState, useEffect } from 'react';

export const AccessibilityTools: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [settings, setSettings] = useState({
        largeText: 0, // 0 = Normal, 1 = Large, 2 = XL
        highContrast: false,
        reduceMotion: false,
        dyslexiaFont: false,
        underlineLinks: false,
    });

    // Load settings from storage
    useEffect(() => {
        const saved = localStorage.getItem('a11y-settings');
        if (saved) {
            setSettings(JSON.parse(saved));
        }
    }, []);

    // Apply settings to HTML element
    useEffect(() => {
        const root = document.documentElement;
        
        // Text Size
        root.classList.remove('a11y-large-text', 'a11y-xl-text');
        if (settings.largeText === 1) root.classList.add('a11y-large-text');
        if (settings.largeText === 2) root.classList.add('a11y-xl-text');

        // High Contrast
        if (settings.highContrast) root.classList.add('a11y-high-contrast');
        else root.classList.remove('a11y-high-contrast');

        // Reduce Motion
        if (settings.reduceMotion) root.classList.add('a11y-reduce-motion');
        else root.classList.remove('a11y-reduce-motion');

        // Dyslexia Font
        if (settings.dyslexiaFont) root.classList.add('a11y-dyslexia-font');
        else root.classList.remove('a11y-dyslexia-font');

        // Underline Links
        if (settings.underlineLinks) root.classList.add('a11y-underline-links');
        else root.classList.remove('a11y-underline-links');

        localStorage.setItem('a11y-settings', JSON.stringify(settings));
    }, [settings]);

    const toggleSetting = (key: keyof typeof settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const cycleTextSize = () => {
        setSettings(prev => ({ ...prev, largeText: (prev.largeText + 1) % 3 }));
    };

    return (
        <div className="fixed bottom-4 left-4 z-50">
            {isOpen && (
                <div className="mb-4 bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4 w-64 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-gray-900 dark:text-white">Accessibility</h3>
                        <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700">&times;</button>
                    </div>
                    
                    <div className="space-y-3">
                        <button 
                            onClick={cycleTextSize}
                            className="w-full flex justify-between items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <span>Text Size</span>
                            <span className="font-bold text-primary">
                                {settings.largeText === 0 ? 'Normal' : settings.largeText === 1 ? 'Large' : 'Extra Large'}
                            </span>
                        </button>

                        <button 
                            onClick={() => toggleSetting('highContrast')}
                            className="w-full flex justify-between items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <span>High Contrast</span>
                            <div className={`w-10 h-5 rounded-full relative transition-colors ${settings.highContrast ? 'bg-primary' : 'bg-gray-300'}`}>
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.highContrast ? 'left-6' : 'left-1'}`}></div>
                            </div>
                        </button>

                        <button 
                            onClick={() => toggleSetting('reduceMotion')}
                            className="w-full flex justify-between items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <span>Reduce Motion</span>
                            <div className={`w-10 h-5 rounded-full relative transition-colors ${settings.reduceMotion ? 'bg-primary' : 'bg-gray-300'}`}>
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.reduceMotion ? 'left-6' : 'left-1'}`}></div>
                            </div>
                        </button>

                        <button 
                            onClick={() => toggleSetting('dyslexiaFont')}
                            className="w-full flex justify-between items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <span>Readable Font</span>
                            <div className={`w-10 h-5 rounded-full relative transition-colors ${settings.dyslexiaFont ? 'bg-primary' : 'bg-gray-300'}`}>
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.dyslexiaFont ? 'left-6' : 'left-1'}`}></div>
                            </div>
                        </button>

                        <button 
                            onClick={() => toggleSetting('underlineLinks')}
                            className="w-full flex justify-between items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <span>Underline Links</span>
                            <div className={`w-10 h-5 rounded-full relative transition-colors ${settings.underlineLinks ? 'bg-primary' : 'bg-gray-300'}`}>
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.underlineLinks ? 'left-6' : 'left-1'}`}></div>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-12 h-12 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/50 transition-transform hover:scale-110"
                aria-label="Accessibility Tools"
                title="Accessibility Tools"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm2.45 4a2.5 2.5 0 10-4.9 0h4.9zM12 9a1 1 0 100 2h3a1 1 0 100-2h-3zm-1 4a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
            </button>
        </div>
    );
};
