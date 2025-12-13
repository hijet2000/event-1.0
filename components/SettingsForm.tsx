


// ... existing imports ...
import React, { useState, useEffect } from 'react';
import { type EventConfig, type FormField } from '../types';
import { getEventConfig, saveConfig, syncConfigFromGitHub, pushConfigToGitHub, sendTestEmail, getSystemApiKey, sendTestMessage } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Spinner } from './Spinner';
import { Alert } from './Alert';
import { ImageUpload } from './ImageUpload';
import { useTheme } from '../contexts/ThemeContext';
import { ToggleSwitch } from './ToggleSwitch';
import { FormFieldEditorModal } from './FormFieldEditorModal';
import { TextInput } from './TextInput';

interface SettingsFormProps {
  adminToken: string;
}

const FONT_OPTIONS = ['Inter', 'Roboto', 'Lato', 'Montserrat'];
const EVENT_TYPES = ['Conference', 'Workshop', 'Webinar', 'Meetup', 'Other'];
const VOICE_OPTIONS = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

type Tab = 'general' | 'registration' | 'theme' | 'communications' | 'economy' | 'integrations' | 'printing';

// ... existing TemplateEditor component ...
const TemplateEditor: React.FC<{
    templateKey: keyof EventConfig['emailTemplates'],
    label: string;
    config: EventConfig;
    onChange: (templateKey: keyof EventConfig['emailTemplates'], field: 'subject' | 'body', value: string) => void;
    placeholders: string[];
}> = ({ templateKey, label, config, onChange, placeholders }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Defensive check
    if (!config.emailTemplates || !config.emailTemplates[templateKey]) return null;

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center text-left"
            >
                <span className="font-medium text-gray-800 dark:text-gray-200">{label}</span>
                <svg className={`w-5 h-5 text-gray-500 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            
            {isOpen && (
                <div className="p-4 space-y-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 animate-fade-in">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Subject Line</label>
                        <input 
                            type="text" 
                            name="subject" 
                            value={config.emailTemplates[templateKey].subject}
                            onChange={(e) => onChange(templateKey, 'subject', e.target.value)}
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm focus:ring-primary focus:border-primary" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Email Body</label>
                        <textarea 
                            name="body" 
                            rows={6}
                            value={config.emailTemplates[templateKey].body}
                            onChange={(e) => onChange(templateKey, 'body', e.target.value)}
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm font-mono text-sm focus:ring-primary focus:border-primary"
                        />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-2 rounded">
                        <span className="font-semibold">Available Variables:</span> {placeholders.join(', ')}
                    </p>
                </div>
            )}
        </div>
    );
};

export const SettingsForm: React.FC<SettingsFormProps> = ({ adminToken }) => {
  // ... existing hook logic ...
  const { config: contextConfig, updateConfig, isLoading: isContextLoading } = useTheme();
  
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [apiKey, setApiKey] = useState<string>('');

  // Test Email State
  const [testEmailTo, setTestEmailTo] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{type: 'success'|'error', message: string}|null>(null);

  // JSON Validation State
  const [jsonValidationMsg, setJsonValidationMsg] = useState<{type: 'success'|'error', message: string}|null>(null);

  // Test Messaging State
  const [testMsgTo, setTestMsgTo] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [msgResult, setMsgResult] = useState<{type: 'success'|'error', message: string}|null>(null);

  // State for Form Field Editor Modal
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);

  // ... existing useEffects ...
  useEffect(() => {
      const timer = setTimeout(() => {
          if (isLoading) {
              console.warn("Settings loading timed out, forcing stop.");
              setIsLoading(false);
              if (!config) setError("Loading timed out. Please try refreshing.");
          }
      }, 8000); 
      return () => clearTimeout(timer);
  }, [isLoading, config]);

  useEffect(() => {
      if (contextConfig) {
          setConfig(contextConfig);
          setIsLoading(false);
          setError(null);
      } else if (!isContextLoading) {
           getEventConfig()
            .then(data => {
                setConfig(data);
                setError(null);
            })
            .catch(err => setError('Failed to load event settings.'))
            .finally(() => setIsLoading(false));
      }
      
      getSystemApiKey(adminToken).then(setApiKey).catch(() => {});
  }, [contextConfig, isContextLoading, adminToken]);

  // ... existing handlers (handleInputChange, handleTemplateChange, etc.) ...
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>, section: 'event' | 'host' | 'theme' | 'smtp' | 'githubSync' | 'aiConcierge' | 'printConfig') => {
    if (!config) return;

    const { name, value, type } = e.target;
    
    setConfig(prevConfig => {
      if (!prevConfig) return null;
      
      const newConfig = JSON.parse(JSON.stringify(prevConfig));
      if (!newConfig[section]) newConfig[section] = {};
      
      const finalValue = type === 'number' ? parseFloat(value) || 0 : value;
      newConfig[section][name] = finalValue;
      return newConfig;
    });
  };
  
  const handleTemplateChange = (templateKey: keyof EventConfig['emailTemplates'], field: 'subject' | 'body', value: string) => {
    if (!config) return;
    setConfig(prevConfig => {
        if (!prevConfig) return null;
        const newConfig = JSON.parse(JSON.stringify(prevConfig));
        if (!newConfig.emailTemplates[templateKey]) return newConfig;
        newConfig.emailTemplates[templateKey][field] = value;
        return newConfig;
    });
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!config) return;
    const { value } = e.target;
    setConfig(prevConfig => {
        if (!prevConfig) return null;
        const newConfig = JSON.parse(JSON.stringify(prevConfig));
        newConfig.emailProvider = value as 'smtp' | 'google';
        return newConfig;
    });
  };

  const handleGoogleConfigChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!config) return;
    const { name, value } = e.target;
    setJsonValidationMsg(null); // Clear validation on change
    setConfig(prevConfig => {
        if (!prevConfig) return null;
        const newConfig = JSON.parse(JSON.stringify(prevConfig));
        if (!newConfig.googleConfig) newConfig.googleConfig = { serviceAccountKeyJson: '' };
        newConfig.googleConfig[name as keyof EventConfig['googleConfig']] = value;
        return newConfig;
    });
  };

  const validateServiceAccountJson = () => {
      if (!config?.googleConfig?.serviceAccountKeyJson) {
          setJsonValidationMsg({ type: 'error', message: 'Field is empty.' });
          return false;
      }
      try {
          const parsed = JSON.parse(config.googleConfig.serviceAccountKeyJson);
          if (!parsed.project_id || !parsed.client_email) {
              setJsonValidationMsg({ type: 'error', message: 'Invalid format: Missing "project_id" or "client_email".' });
              return false;
          }
          setJsonValidationMsg({ type: 'success', message: 'Valid Service Account JSON.' });
          return true;
      } catch (e) {
          setJsonValidationMsg({ type: 'error', message: 'Invalid JSON syntax.' });
          return false;
      }
  };

  const handleEventCoinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!config) return;
    const { name, value, type, checked } = e.target;
    const isCheckbox = type === 'checkbox';

    setConfig(prevConfig => {
        if (!prevConfig) return null;
        const newConfig = JSON.parse(JSON.stringify(prevConfig));
        newConfig.eventCoin[name as keyof EventConfig['eventCoin']] = isCheckbox ? checked : (type === 'number' ? parseFloat(value) || 0 : value);
        return newConfig;
    });
  };

  const handleEventCoinToggle = (enabled: boolean) => {
    if (!config) return;
    setConfig(prevConfig => {
        if (!prevConfig) return null;
        const newConfig = JSON.parse(JSON.stringify(prevConfig));
        newConfig.eventCoin.enabled = enabled;
        return newConfig;
    });
  };

  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!config) return;
    const { name, value } = e.target;
    setConfig(prevConfig => {
        if (!prevConfig) return null;
        const newConfig = JSON.parse(JSON.stringify(prevConfig));
        newConfig.whatsapp[name as keyof EventConfig['whatsapp']] = value;
        return newConfig;
    });
  };

  const handleTelegramChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!config) return;
    const { name, value } = e.target;
    setConfig(prevConfig => {
        if (!prevConfig) return null;
        const newConfig = JSON.parse(JSON.stringify(prevConfig));
        if (!newConfig.telegram) newConfig.telegram = { enabled: false, botToken: '' };
        newConfig.telegram[name as keyof EventConfig['telegram']] = value;
        return newConfig;
    });
  };

  const handleSmsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!config) return;
    const { name, value } = e.target;
    setConfig(prevConfig => {
        if (!prevConfig) return null;
        const newConfig = JSON.parse(JSON.stringify(prevConfig));
        newConfig.sms[name as keyof EventConfig['sms']] = value;
        return newConfig;
    });
  };
  
  const handleImageChange = (field: 'logoUrl' | 'pageImageUrl' | 'badgeImageUrl' | 'faviconUrl', dataUrl: string) => {
    if (!config) return;
    setConfig(prevConfig => {
      if (!prevConfig) return null;
      const newConfig = JSON.parse(JSON.stringify(prevConfig));
      newConfig.theme[field] = dataUrl;
      return newConfig;
    });
  };

  const handleGithubSyncToggle = (enabled: boolean) => {
    if (!config) return;
    setConfig(prevConfig => {
        if (!prevConfig) return null;
        const newConfig = JSON.parse(JSON.stringify(prevConfig));
        newConfig.githubSync.enabled = enabled;
        return newConfig;
    });
  };

  const handleWhatsappToggle = (enabled: boolean) => {
    if (!config) return;
    setConfig(prevConfig => {
        if (!prevConfig) return null;
        const newConfig = JSON.parse(JSON.stringify(prevConfig));
        newConfig.whatsapp.enabled = enabled;
        return newConfig;
    });
  };

  const handleTelegramToggle = (enabled: boolean) => {
    if (!config) return;
    setConfig(prevConfig => {
        if (!prevConfig) return null;
        const newConfig = JSON.parse(JSON.stringify(prevConfig));
        if (!newConfig.telegram) newConfig.telegram = { enabled: false, botToken: '' };
        newConfig.telegram.enabled = enabled;
        return newConfig;
    });
  };

  const handleSmsToggle = (enabled: boolean) => {
    if (!config) return;
    setConfig(prevConfig => {
        if (!prevConfig) return null;
        const newConfig = JSON.parse(JSON.stringify(prevConfig));
        newConfig.sms.enabled = enabled;
        return newConfig;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    if (config.emailProvider === 'google' && config.googleConfig?.serviceAccountKeyJson) {
        if (!validateServiceAccountJson()) {
            setError("Please fix Google Service Account JSON errors before saving.");
            return;
        }
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
        await saveConfig(adminToken, config);
        setSuccessMessage('Settings saved successfully!');
        if (contextConfig) updateConfig(config);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
        setIsSaving(false);
        setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleSync = async () => {
      setIsSyncing(true);
      setError(null);
      setSuccessMessage(null);
      try {
          const newConfig = await syncConfigFromGitHub(adminToken);
          setConfig(newConfig);
          if (contextConfig) updateConfig(newConfig);
          setSuccessMessage('Configuration synced from GitHub successfully!');
      } catch (e) {
          setError(e instanceof Error ? e.message : "Sync failed.");
      } finally {
          setIsSyncing(false);
          setTimeout(() => setSuccessMessage(null), 3000);
      }
  };

  const handlePush = async () => {
      setIsPushing(true);
      setError(null);
      setSuccessMessage(null);
      try {
          const result = await pushConfigToGitHub(adminToken);
          setSuccessMessage(`Configuration pushed to GitHub successfully! (Commit: ${result.commit.substring(0, 7)})`);
      } catch (e) {
          setError(e instanceof Error ? e.message : "Push failed.");
      } finally {
          setIsPushing(false);
          setTimeout(() => setSuccessMessage(null), 5000);
      }
  };

  const handleTestEmail = async () => {
      if (!testEmailTo) {
          setTestEmailResult({ type: 'error', message: 'Please enter a recipient email.' });
          return;
      }
      setIsSendingTest(true);
      setTestEmailResult(null);
      try {
          await sendTestEmail(adminToken, testEmailTo, config);
          setTestEmailResult({ type: 'success', message: 'Test email sent!' });
      } catch (e) {
          setTestEmailResult({ type: 'error', message: 'Failed to send test email.' });
      } finally {
          setIsSendingTest(false);
      }
  };

  const handleTestMessage = async (channel: 'sms' | 'whatsapp' | 'telegram') => {
      if (!testMsgTo) {
          setMsgResult({ type: 'error', message: 'Please enter a recipient number/ID.' });
          return;
      }
      setIsSendingMsg(true);
      setMsgResult(null);
      try {
          await sendTestMessage(adminToken, channel, testMsgTo, config);
          setMsgResult({ type: 'success', message: `Test ${channel.toUpperCase()} sent!` });
      } catch (e) {
          setMsgResult({ type: 'error', message: 'Failed to send test message.' });
      } finally {
          setIsSendingMsg(false);
      }
  };

  const handleSaveField = (field: FormField) => {
      if (!config) return;
      setConfig(prev => {
          if (!prev) return null;
          const newConfig = JSON.parse(JSON.stringify(prev));
          if (editingFieldIndex !== null) {
              newConfig.formFields[editingFieldIndex] = field;
          } else {
              newConfig.formFields.push(field);
          }
          return newConfig;
      });
      setIsFieldModalOpen(false);
      setEditingField(null);
      setEditingFieldIndex(null);
  };

  const handleDeleteField = (index: number) => {
      if (!config) return;
      if (!window.confirm("Delete this field?")) return;
      setConfig(prev => {
          if (!prev) return null;
          const newConfig = JSON.parse(JSON.stringify(prev));
          newConfig.formFields.splice(index, 1);
          return newConfig;
      });
  };

  if (isLoading) return <ContentLoader text="Loading settings..." />;
  if (error && !config) return <Alert type="error" message={error} />;
  if (!config) return <Alert type="error" message="No configuration loaded." />;

  // Ensure robust defaults
  const safeTelegram = config.telegram || { enabled: false, botToken: '' };
  const safeWhatsapp = config.whatsapp || { enabled: false, accessToken: '', phoneNumberId: '' };
  const safeSms = config.sms || { enabled: false, provider: 'twilio', accountSid: '', authToken: '', fromNumber: '' };
  const safeHost = config.host || { name: '', email: '' };
  const safeEvent = config.event || { name: '', date: '', location: '', description: '', maxAttendees: 0, eventType: 'Conference', publicUrl: '' };
  const safeTheme = config.theme || { colorPrimary: '#4f46e5', colorSecondary: '#ec4899', backgroundColor: '#f9fafb', fontFamily: 'Inter', logoUrl: '', pageImageUrl: '', badgeImageUrl: '', faviconUrl: '' };
  const safeSmtp = config.smtp || { host: '', port: 587, username: '', password: '', encryption: 'tls' };
  const safeGoogle = config.googleConfig || { serviceAccountKeyJson: '' };
  const safeEventCoin = config.eventCoin || { enabled: true, name: 'EventCoin', startingBalance: 100, exchangeRate: 1, peggedCurrency: 'USD' };
  const safeSync = config.githubSync || { enabled: false, configUrl: '', owner: '', repo: '', path: 'config.json', token: '' };
  const safePrintConfig = config.printConfig || { enabled: true, width: 4, height: 3, orientation: 'landscape', autoPrintOnKiosk: false };

  return (
    <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Event Settings</h2>
            <div className="flex gap-3">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 flex items-center"
                >
                    {isSaving ? <><Spinner /> Saving...</> : 'Save Changes'}
                </button>
            </div>
        </div>

        {successMessage && <div className="mb-4"><Alert type="success" message={successMessage} /></div>}
        {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
            <nav className="-mb-px flex space-x-8">
                {['general', 'registration', 'theme', 'communications', 'printing', 'economy', 'integrations'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as Tab)}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === tab
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </nav>
        </div>

        <form onSubmit={handleSave} className="space-y-8 pb-10">
            {activeTab === 'general' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Event Details</h3>
                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                            <div className="sm:col-span-4">
                                <TextInput label="Event Name" name="name" value={safeEvent.name} onChange={(e) => handleInputChange(e, 'event')} required />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Type</label>
                                <select name="eventType" value={safeEvent.eventType} onChange={(e) => handleInputChange(e, 'event')} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm">
                                    {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="sm:col-span-3">
                                <TextInput label="Date" name="date" value={safeEvent.date} onChange={(e) => handleInputChange(e, 'event')} />
                            </div>
                            <div className="sm:col-span-3">
                                <TextInput label="Location" name="location" value={safeEvent.location} onChange={(e) => handleInputChange(e, 'event')} />
                            </div>
                            <div className="sm:col-span-6">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                <textarea name="description" rows={3} value={safeEvent.description} onChange={(e) => handleInputChange(e, 'event')} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm" />
                            </div>
                            <div className="sm:col-span-3">
                                <TextInput label="Max Attendees" name="maxAttendees" type="number" value={(safeEvent.maxAttendees || 0).toString()} onChange={(e) => handleInputChange(e, 'event')} />
                            </div>
                            <div className="sm:col-span-3">
                                <TextInput label="Public URL" name="publicUrl" value={safeEvent.publicUrl} onChange={(e) => handleInputChange(e, 'event')} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Host Information</h3>
                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                            <div className="sm:col-span-3">
                                <TextInput label="Host Name" name="name" value={safeHost.name} onChange={(e) => handleInputChange(e, 'host')} required />
                            </div>
                            <div className="sm:col-span-3">
                                <TextInput label="Host Email" name="email" value={safeHost.email} onChange={(e) => handleInputChange(e, 'host')} required />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'registration' && (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Custom Registration Fields</h3>
                        <button type="button" onClick={() => { setEditingField(null); setEditingFieldIndex(null); setIsFieldModalOpen(true); }} className="text-sm text-primary hover:underline">+ Add Field</button>
                    </div>
                    <div className="space-y-3">
                        {config.formFields.map((field, index) => (
                            <div key={field.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md border border-gray-200 dark:border-gray-600">
                                <div>
                                    <p className="font-medium text-sm">{field.label}</p>
                                    <p className="text-xs text-gray-500">Type: {field.type} | {field.required ? 'Required' : 'Optional'} | {field.enabled ? 'Enabled' : 'Disabled'}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => { setEditingField(field); setEditingFieldIndex(index); setIsFieldModalOpen(true); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                                    <button type="button" onClick={() => handleDeleteField(index)} className="text-xs text-red-600 hover:underline">Delete</button>
                                </div>
                            </div>
                        ))}
                        {config.formFields.length === 0 && <p className="text-sm text-gray-500 italic">No custom fields defined.</p>}
                    </div>
                </div>
            )}

            {activeTab === 'theme' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Colors & Fonts</h3>
                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Primary Color</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" name="colorPrimary" value={safeTheme.colorPrimary} onChange={(e) => handleInputChange(e, 'theme')} className="h-9 w-9 rounded border border-gray-300 cursor-pointer" />
                                    <input type="text" name="colorPrimary" value={safeTheme.colorPrimary} onChange={(e) => handleInputChange(e, 'theme')} className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm bg-white dark:bg-gray-700" />
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Secondary Color</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" name="colorSecondary" value={safeTheme.colorSecondary} onChange={(e) => handleInputChange(e, 'theme')} className="h-9 w-9 rounded border border-gray-300 cursor-pointer" />
                                    <input type="text" name="colorSecondary" value={safeTheme.colorSecondary} onChange={(e) => handleInputChange(e, 'theme')} className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm bg-white dark:bg-gray-700" />
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Background Color</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" name="backgroundColor" value={safeTheme.backgroundColor} onChange={(e) => handleInputChange(e, 'theme')} className="h-9 w-9 rounded border border-gray-300 cursor-pointer" />
                                    <input type="text" name="backgroundColor" value={safeTheme.backgroundColor} onChange={(e) => handleInputChange(e, 'theme')} className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm bg-white dark:bg-gray-700" />
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Font Family</label>
                                <select name="fontFamily" value={safeTheme.fontFamily} onChange={(e) => handleInputChange(e, 'theme')} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm">
                                    {FONT_OPTIONS.map(font => <option key={font} value={font}>{font}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Images</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                            <ImageUpload label="Event Logo" value={safeTheme.logoUrl} onChange={(url) => handleImageChange('logoUrl', url)} />
                            <ImageUpload label="Hero Background" value={safeTheme.pageImageUrl} onChange={(url) => handleImageChange('pageImageUrl', url)} />
                            <ImageUpload label="Badge Background" value={safeTheme.badgeImageUrl} onChange={(url) => handleImageChange('badgeImageUrl', url)} />
                            <ImageUpload label="Favicon" value={safeTheme.faviconUrl || ''} onChange={(url) => handleImageChange('faviconUrl', url)} />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'communications' && (
                <div className="space-y-6">
                    {/* ... existing communications tab content ... */}
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Email Configuration</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Provider</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center cursor-pointer">
                                        <input type="radio" name="emailProvider" value="smtp" checked={config.emailProvider === 'smtp'} onChange={handleProviderChange} className="mr-2 text-primary focus:ring-primary" /> 
                                        SMTP
                                    </label>
                                    <label className="flex items-center cursor-pointer">
                                        <input type="radio" name="emailProvider" value="google" checked={config.emailProvider === 'google'} onChange={handleProviderChange} className="mr-2 text-primary focus:ring-primary" /> 
                                        Google (Service Account)
                                    </label>
                                </div>
                            </div>

                            {config.emailProvider === 'smtp' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4 dark:border-gray-700 animate-fade-in">
                                    <TextInput label="SMTP Host" name="host" value={safeSmtp.host} onChange={(e) => handleInputChange(e, 'smtp')} />
                                    <TextInput label="Port" name="port" type="number" value={(safeSmtp.port || 587).toString()} onChange={(e) => handleInputChange(e, 'smtp')} />
                                    <TextInput label="Username" name="username" value={safeSmtp.username} onChange={(e) => handleInputChange(e, 'smtp')} />
                                    <TextInput label="Password" name="password" type="password" value={safeSmtp.password || ''} onChange={(e) => handleInputChange(e, 'smtp')} placeholder="••••••" />
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Encryption</label>
                                        <select name="encryption" value={safeSmtp.encryption} onChange={(e) => handleInputChange(e, 'smtp')} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm">
                                            <option value="none">None</option>
                                            <option value="ssl">SSL</option>
                                            <option value="tls">TLS</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {config.emailProvider === 'google' && (
                                <div className="border-t pt-4 dark:border-gray-700 animate-fade-in">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-sm font-medium">Service Account JSON</label>
                                        <button 
                                            type="button" 
                                            onClick={validateServiceAccountJson}
                                            className="text-xs text-primary hover:underline"
                                        >
                                            Validate JSON
                                        </button>
                                    </div>
                                    <textarea name="serviceAccountKeyJson" rows={5} value={safeGoogle.serviceAccountKeyJson} onChange={handleGoogleConfigChange} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm font-mono text-xs" placeholder='{"type": "service_account", ...}' />
                                    
                                    {jsonValidationMsg && (
                                        <p className={`text-xs mt-1 font-bold ${jsonValidationMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                            {jsonValidationMsg.message}
                                        </p>
                                    )}
                                    
                                    <p className="text-xs text-gray-500 mt-2">
                                        Paste the full JSON content of your Google Cloud Service Account key. 
                                        <a href="https://cloud.google.com/iam/docs/creating-managing-service-account-keys" target="_blank" rel="noopener noreferrer" className="ml-1 text-primary hover:underline">Learn how to create one.</a>
                                    </p>
                                </div>
                            )}
                            
                            <div className="border-t pt-4 dark:border-gray-700">
                                <label className="block text-sm font-medium mb-2">Send Test Email</label>
                                <div className="flex gap-2">
                                    <input type="email" placeholder="recipient@example.com" value={testEmailTo} onChange={(e) => setTestEmailTo(e.target.value)} className="flex-grow rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm" />
                                    <button type="button" onClick={handleTestEmail} disabled={isSendingTest} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50">
                                        {isSendingTest ? <Spinner /> : 'Send Test'}
                                    </button>
                                </div>
                                {testEmailResult && <p className={`text-xs mt-1 ${testEmailResult.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{testEmailResult.message}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Messaging Gateways</h3>
                        <div className="mb-4">
                             <div className="flex gap-2 mb-2">
                                <input 
                                    type="text" 
                                    placeholder="Test Recipient (Phone/Chat ID)" 
                                    value={testMsgTo}
                                    onChange={(e) => setTestMsgTo(e.target.value)} 
                                    className="flex-grow rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm"
                                />
                            </div>
                            {msgResult && <p className={`text-xs mb-2 ${msgResult.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{msgResult.message}</p>}
                        </div>

                        <div className="space-y-6">
                            {/* WhatsApp */}
                            <div className="border-b border-gray-100 dark:border-gray-700 pb-6">
                                <div className="flex justify-between items-center mb-2">
                                    <ToggleSwitch label="WhatsApp Integration" name="enabled" enabled={safeWhatsapp.enabled} onChange={handleWhatsappToggle} />
                                    <button 
                                        type="button" 
                                        onClick={() => handleTestMessage('whatsapp')}
                                        disabled={!safeWhatsapp.enabled || isSendingMsg}
                                        className="text-xs text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                                    >
                                        Test WhatsApp
                                    </button>
                                </div>
                                {safeWhatsapp.enabled && (
                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                                        <TextInput label="Access Token" name="accessToken" value={safeWhatsapp.accessToken} onChange={handleWhatsappChange} />
                                        <TextInput label="Phone Number ID" name="phoneNumberId" value={safeWhatsapp.phoneNumberId} onChange={handleWhatsappChange} />
                                        
                                        <div className="sm:col-span-2 mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
                                            <p className="font-semibold text-gray-500 uppercase mb-1">Webhook URL</p>
                                            <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                                                <code className="truncate">{typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/whatsapp</code>
                                            </div>
                                            <p className="mt-1 text-gray-400">Configure this in your Meta App Dashboard.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Telegram */}
                            <div className="border-b border-gray-100 dark:border-gray-700 pb-6">
                                <div className="flex justify-between items-center mb-2">
                                    <ToggleSwitch label="Telegram Bot" name="enabled" enabled={safeTelegram.enabled} onChange={handleTelegramToggle} />
                                    <button 
                                        type="button" 
                                        onClick={() => handleTestMessage('telegram')}
                                        disabled={!safeTelegram.enabled || isSendingMsg}
                                        className="text-xs text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                                    >
                                        Test Telegram
                                    </button>
                                </div>
                                {safeTelegram.enabled && (
                                    <div className="mt-4 animate-fade-in">
                                        <TextInput label="Bot Token" name="botToken" value={safeTelegram.botToken || ''} onChange={handleTelegramChange} />
                                        <p className="text-xs text-gray-500 mt-1 mb-3">Create a new bot via @BotFather to get your token.</p>
                                        
                                        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
                                            <p className="font-semibold text-gray-500 uppercase mb-1">Webhook URL</p>
                                            <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                                                <code className="truncate">{typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/telegram</code>
                                            </div>
                                            <p className="mt-1 text-gray-400">Use this URL to set up your bot webhook.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SMS */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <ToggleSwitch label="SMS (Twilio)" name="enabled" enabled={safeSms.enabled} onChange={handleSmsToggle} />
                                    <button 
                                        type="button" 
                                        onClick={() => handleTestMessage('sms')}
                                        disabled={!safeSms.enabled || isSendingMsg}
                                        className="text-xs text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                                    >
                                        Test SMS
                                    </button>
                                </div>
                                {safeSms.enabled && (
                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
                                        <TextInput label="Account SID" name="accountSid" value={safeSms.accountSid} onChange={handleSmsChange} />
                                        <TextInput label="Auth Token" name="authToken" type="password" value={safeSms.authToken} onChange={handleSmsChange} />
                                        <TextInput label="From Number" name="fromNumber" value={safeSms.fromNumber} onChange={handleSmsChange} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Email Templates</h3>
                        <div className="space-y-4">
                            <TemplateEditor templateKey="userConfirmation" label="User Confirmation" config={config} onChange={handleTemplateChange} placeholders={['{{name}}', '{{eventName}}', '{{qrCodeUrl}}']} />
                            <TemplateEditor templateKey="hostNotification" label="Host Notification" config={config} onChange={handleTemplateChange} placeholders={['{{name}}', '{{email}}', '{{customFields}}']} />
                            <TemplateEditor templateKey="passwordReset" label="Password Reset" config={config} onChange={handleTemplateChange} placeholders={['{{resetLink}}', '{{eventName}}']} />
                            <TemplateEditor templateKey="delegateInvitation" label="Delegate Invitation" config={config} onChange={handleTemplateChange} placeholders={['{{inviteLink}}', '{{inviterName}}', '{{eventName}}']} />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'printing' && (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Badge Printing</h3>
                    <p className="text-sm text-gray-500 mb-6">Configure settings for thermal label printers used at check-in kiosks.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <ToggleSwitch 
                                label="Enable Badge Printing" 
                                name="enabled" 
                                enabled={safePrintConfig.enabled} 
                                onChange={(val) => handleInputChange({ target: { name: 'enabled', value: val, type: 'checkbox', checked: val } } as any, 'printConfig')} 
                            />
                            
                            {safePrintConfig.enabled && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <TextInput 
                                            label="Width (Inches)" 
                                            name="width" 
                                            type="number" 
                                            value={safePrintConfig.width.toString()} 
                                            onChange={(e) => handleInputChange(e, 'printConfig')} 
                                        />
                                        <TextInput 
                                            label="Height (Inches)" 
                                            name="height" 
                                            type="number" 
                                            value={safePrintConfig.height.toString()} 
                                            onChange={(e) => handleInputChange(e, 'printConfig')} 
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Orientation</label>
                                        <select 
                                            name="orientation" 
                                            value={safePrintConfig.orientation} 
                                            onChange={(e) => handleInputChange(e, 'printConfig')} 
                                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm"
                                        >
                                            <option value="landscape">Landscape</option>
                                            <option value="portrait">Portrait</option>
                                        </select>
                                    </div>

                                    <ToggleSwitch 
                                        label="Auto-print on Kiosk Check-in" 
                                        name="autoPrintOnKiosk" 
                                        enabled={safePrintConfig.autoPrintOnKiosk} 
                                        onChange={(val) => handleInputChange({ target: { name: 'autoPrintOnKiosk', value: val, type: 'checkbox', checked: val } } as any, 'printConfig')} 
                                    />
                                </>
                            )}
                        </div>
                        
                        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 flex items-center justify-center border border-gray-200 dark:border-gray-700">
                            {/* Preview representation */}
                            <div 
                                className="bg-white shadow-md flex items-center justify-center text-gray-400 text-xs border border-gray-300"
                                style={{
                                    width: `${safePrintConfig.width * 40}px`,
                                    height: `${safePrintConfig.height * 40}px`,
                                    transition: 'all 0.3s'
                                }}
                            >
                                Preview ({safePrintConfig.width}" x {safePrintConfig.height}")
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'economy' && (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">EventCoin Economy</h3>
                    <ToggleSwitch label="Enable EventCoin System" name="enabled" enabled={safeEventCoin.enabled} onChange={handleEventCoinToggle} />
                    
                    {safeEventCoin.enabled && (
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4 dark:border-gray-700">
                            <TextInput label="Currency Name" name="name" value={safeEventCoin.name} onChange={handleEventCoinChange} />
                            <TextInput label="Starting Balance" name="startingBalance" type="number" value={(safeEventCoin.startingBalance || 0).toString()} onChange={handleEventCoinChange} />
                            <TextInput label="Exchange Rate (1 Coin = X USD)" name="exchangeRate" type="number" value={(safeEventCoin.exchangeRate || 1).toString()} onChange={handleEventCoinChange} />
                            <TextInput label="Pegged Currency" name="peggedCurrency" value={safeEventCoin.peggedCurrency} onChange={handleEventCoinChange} />
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'integrations' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">GitHub Sync (GitOps)</h3>
                                <p className="text-sm text-gray-500">Manage your configuration as code.</p>
                            </div>
                            <ToggleSwitch label="Enabled" name="enabled" enabled={safeSync.enabled} onChange={handleGithubSyncToggle} />
                        </div>
                        
                        {safeSync.enabled && (
                            <div className="mt-4 space-y-4 animate-fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <TextInput label="Repository Owner" name="owner" value={safeSync.owner || ''} onChange={(e) => handleInputChange(e, 'githubSync')} placeholder="e.g. facebook" />
                                    <TextInput label="Repository Name" name="repo" value={safeSync.repo || ''} onChange={(e) => handleInputChange(e, 'githubSync')} placeholder="e.g. react" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <TextInput label="File Path" name="path" value={safeSync.path || 'config.json'} onChange={(e) => handleInputChange(e, 'githubSync')} placeholder="path/to/config.json" />
                                    <TextInput label="Personal Access Token (PAT)" name="token" type="password" value={safeSync.token || ''} onChange={(e) => handleInputChange(e, 'githubSync')} placeholder="ghp_..." />
                                </div>
                                
                                <div className="flex gap-3 pt-2">
                                    <button 
                                        type="button" 
                                        onClick={handleSync}
                                        disabled={isSyncing}
                                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                                    >
                                        {isSyncing ? <Spinner /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
                                        Pull (Sync)
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={handlePush}
                                        disabled={isPushing}
                                        className="px-4 py-2 bg-gray-800 text-white dark:bg-gray-700 rounded-md text-sm font-medium hover:bg-gray-900 dark:hover:bg-gray-600 flex items-center gap-2"
                                    >
                                        {isPushing ? <Spinner /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
                                        Push (Commit)
                                    </button>
                                </div>

                                {safeSync.lastSyncTimestamp && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        Last sync: {new Date(safeSync.lastSyncTimestamp).toLocaleString()} 
                                        <span className={`ml-2 font-bold ${safeSync.lastSyncStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                            ({safeSync.lastSyncStatus})
                                        </span>
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">AI Concierge</h3>
                        <ToggleSwitch label="Enable Virtual Concierge" name="enabled" enabled={config.aiConcierge?.enabled ?? true} onChange={(enabled) => handleInputChange({ target: { name: 'enabled', value: enabled, type: 'checkbox', checked: enabled } } as any, 'aiConcierge')} />
                        {(config.aiConcierge?.enabled ?? true) && (
                            <div className="mt-4 grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Voice</label>
                                    <select name="voice" value={config.aiConcierge?.voice || 'Kore'} onChange={(e) => handleInputChange(e, 'aiConcierge')} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm">
                                        {VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Persona / Instructions</label>
                                    <textarea name="persona" value={config.aiConcierge?.persona || ''} onChange={(e) => handleInputChange(e, 'aiConcierge')} rows={3} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm" placeholder="You are a helpful assistant..." />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </form>

        <FormFieldEditorModal 
            isOpen={isFieldModalOpen} 
            onClose={() => setIsFieldModalOpen(false)} 
            onSave={handleSaveField} 
            field={editingField} 
        />
    </div>
  );
};