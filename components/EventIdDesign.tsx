
import React, { useState, useEffect } from 'react';
import { type EventConfig } from '../types';
import { getEventConfig, saveConfig } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Spinner } from './Spinner';
import { Alert } from './Alert';
import { ImageUpload } from './ImageUpload';
import { ToggleSwitch } from './ToggleSwitch';

interface EventIdDesignProps {
  adminToken: string;
}

const mockDelegate = {
    name: 'ALEX DOE',
    email: 'alex.doe@example.com',
    company: 'InnovateSphere Inc.',
    role: 'Lead Developer'
};

const BadgePreview: React.FC<{ config: EventConfig }> = ({ config }) => {
    // Check if config exists before destructuring
    if (!config) return null;

    const { theme } = config;
    // Defensive check: ensure badgeConfig exists, fallback to defaults if not
    const safeBadgeConfig = config.badgeConfig || { showName: true, showEmail: false, showCompany: true, showRole: true };
    const { showName, showEmail, showCompany, showRole } = safeBadgeConfig;

    return (
        <div className="w-full max-w-sm mx-auto aspect-[1/1.618] rounded-xl shadow-lg relative overflow-hidden bg-white dark:bg-gray-700">
            {/* Background Image */}
            {theme && theme.badgeImageUrl ? (
                <img src={theme.badgeImageUrl} alt="Badge Background" className="absolute inset-0 w-full h-full object-cover z-0" />
            ) : (
                <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 z-0"></div>
            )}
            <div className="absolute inset-0 bg-black/20 z-10"></div>

            {/* Content Overlay */}
            <div className="absolute inset-0 z-20 p-6 flex flex-col justify-between text-white">
                {/* Header with logo and event name */}
                <header className="flex items-center gap-4">
                    {theme && theme.logoUrl ? (
                        <img src={theme.logoUrl} alt="Event Logo" className="h-12 w-12 rounded-full object-contain bg-white/80 p-1" />
                    ) : <div className="h-12 w-12 rounded-full bg-white/80"></div>}
                    <h3 className="font-bold text-lg tracking-tight text-shadow">{config.event?.name || 'Event Name'}</h3>
                </header>

                {/* Delegate Info */}
                <div className="text-center">
                    {showName && <h1 className="text-3xl font-bold uppercase tracking-wider" style={{ color: theme?.colorPrimary || '#4f46e5', textShadow: '1px 1px 2px rgba(0,0,0,0.7)' }}>{mockDelegate.name}</h1>}
                    {showCompany && <p className="text-lg font-medium">{mockDelegate.company}</p>}
                    {showRole && <p className="text-md text-gray-200">{mockDelegate.role}</p>}
                    {showEmail && <p className="text-sm text-gray-300 mt-2">{mockDelegate.email}</p>}
                </div>
                
                {/* Footer with QR Code */}
                <footer className="flex items-end justify-between">
                    <p className="text-xs text-gray-300">&copy; {new Date().getFullYear()}</p>
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=DelegateID:12345&bgcolor=ffffff" alt="QR Code" className="w-20 h-20 rounded-lg bg-white p-1" />
                </footer>
            </div>
            
            {/* Lanyard Hole */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-8 h-4 bg-white/50 rounded-b-lg backdrop-blur-sm z-30 border-x border-b border-gray-300/50"></div>
        </div>
    );
};

export const EventIdDesign: React.FC<EventIdDesignProps> = ({ adminToken }) => {
    const [config, setConfig] = useState<EventConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                setIsLoading(true);
                const configData = await getEventConfig();
                setConfig(configData);
            } catch (err) {
                setError('Failed to load settings.');
            } finally {
                setIsLoading(false);
            }
        };
        loadConfig();
    }, []);

    const handleThemeChange = (field: 'badgeImageUrl', value: string) => {
        if (!config) return;
        setConfig(prevConfig => {
            if (!prevConfig) return null;
            const newConfig = JSON.parse(JSON.stringify(prevConfig));
            newConfig.theme[field] = value;
            return newConfig;
        });
    };

    const handleBadgeFieldToggle = (field: keyof EventConfig['badgeConfig'], enabled: boolean) => {
        if (!config) return;
        setConfig(prevConfig => {
            if (!prevConfig) return null;
            const newConfig = JSON.parse(JSON.stringify(prevConfig));
            if (!newConfig.badgeConfig) newConfig.badgeConfig = {};
            newConfig.badgeConfig[field] = enabled;
            return newConfig;
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!config) return;

        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);
        try {
            await saveConfig(adminToken, config);
            setSuccessMessage('Badge design saved successfully!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save design.');
        } finally {
            setIsSaving(false);
            setTimeout(() => setSuccessMessage(null), 3000);
        }
    };

    if (isLoading) {
        return <ContentLoader text="Loading ID designer..." />;
    }

    if (error && !config) {
        return <Alert type="error" message={error} />;
    }
    
    if (!config) {
        return <Alert type="info" message="Configuration not available." />;
    }

    // Safety fallback for rendering controls
    const safeBadgeConfig = config.badgeConfig || { showName: true, showEmail: false, showCompany: true, showRole: true };

    return (
        <form onSubmit={handleSave}>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Event ID Design</h2>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">Customize the look of the delegate ID badge.</p>
                </div>
                 <button
                  type="submit"
                  disabled={isSaving}
                  className="py-2 px-5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center justify-center disabled:opacity-50"
                >
                  {isSaving ? <><Spinner /> Saving...</> : 'Save Design'}
                </button>
            </div>
            
            {successMessage && <div className="mb-4"><Alert type="success" message={successMessage} /></div>}
            {error && <div className="mb-4"><Alert type="error" message={error} /></div>}
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Controls Column */}
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 space-y-6 self-start">
                    <h3 className="text-lg font-semibold border-b pb-3 dark:border-gray-700">Badge Controls</h3>
                    <ImageUpload
                        label="Badge Background"
                        value={config.theme.badgeImageUrl}
                        onChange={(dataUrl) => handleThemeChange('badgeImageUrl', dataUrl)}
                    />
                    <div className="space-y-2 pt-4 border-t dark:border-gray-700">
                        <h4 className="text-md font-medium">Displayed Fields</h4>
                        <ToggleSwitch
                            label="Show Full Name"
                            name="showName"
                            enabled={safeBadgeConfig.showName}
                            onChange={(val) => handleBadgeFieldToggle('showName', val)}
                        />
                         <ToggleSwitch
                            label="Show Company"
                            name="showCompany"
                            enabled={safeBadgeConfig.showCompany}
                            onChange={(val) => handleBadgeFieldToggle('showCompany', val)}
                        />
                         <ToggleSwitch
                            label="Show Role"
                            name="showRole"
                            enabled={safeBadgeConfig.showRole}
                            onChange={(val) => handleBadgeFieldToggle('showRole', val)}
                        />
                         <ToggleSwitch
                            label="Show Email Address"
                            name="showEmail"
                            enabled={safeBadgeConfig.showEmail}
                            onChange={(val) => handleBadgeFieldToggle('showEmail', val)}
                        />
                    </div>
                </div>

                {/* Preview Column */}
                <div className="lg:col-span-2">
                     <h3 className="text-lg font-semibold mb-4 text-center">Live Preview</h3>
                     <BadgePreview config={config} />
                </div>
            </div>
        </form>
    );
};
