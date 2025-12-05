
import React, { useState, useEffect, useRef } from 'react';
import { type EventConfig, type FormField } from '../types';
import { getEventConfig, saveConfig, syncConfigFromGitHub, sendTestEmail, getSystemApiKey } from '../server/api';
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

type Tab = 'general' | 'registration' | 'theme' | 'communications' | 'economy' | 'integrations';

const TemplateEditor: React.FC<{
    templateKey: keyof EventConfig['emailTemplates'],
    label: string;
    config: EventConfig;
    onChange: (templateKey: keyof EventConfig['emailTemplates'], field: 'subject' | 'body', value: string) => void;
    placeholders: string[];
}> = ({ templateKey, label, config, onChange, placeholders }) => {
    const [isOpen, setIsOpen] = useState(false);

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
  const { config: contextConfig, updateConfig, isLoading: isContextLoading } = useTheme();
  
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [apiKey, setApiKey] = useState<string>('');

  // Test Email State
  const [testEmailTo, setTestEmailTo] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{type: 'success'|'error', message: string}|null>(null);

  // State for Form Field Editor Modal
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);

  // Safety timer to prevent infinite loading
  useEffect(() => {
      const timer = setTimeout(() => {
          if (isLoading) {
              console.warn("Settings loading timed out, forcing stop.");
              setIsLoading(false);
              if (!config) setError("Loading timed out. Please try refreshing.");
          }
      }, 8000); // 8 seconds timeout
      return () => clearTimeout(timer);
  }, [isLoading, config]);

  useEffect(() => {
      // Prioritize context config if available
      if (contextConfig) {
          setConfig(contextConfig);
          setIsLoading(false);
          setError(null);
      } else if (!isContextLoading) {
          // If context finished loading but returned nothing (or error), try direct fetch as fallback
           getEventConfig()
            .then(data => {
                setConfig(data);
                setError(null);
            })
            .catch(err => setError('Failed to load event settings.'))
            .finally(() => setIsLoading(false));
      }
      
      // Load API Key if user has permission (simulated)
      getSystemApiKey(adminToken).then(setApiKey).catch(() => {});
  }, [contextConfig, isContextLoading, adminToken]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>, section: 'event' | 'host' | 'theme' | 'smtp' | 'githubSync') => {
    if (!config) return;

    const { name, value, type } = e.target;
    
    setConfig(prevConfig => {
      if (!prevConfig) return null;
      
      const newConfig = JSON.parse(JSON.stringify(prevConfig));
      // Ensure section exists (defensive)
      if (!newConfig[section]) newConfig[section] = {};
      
      const finalValue = type === 'number' ? parseInt(value, 10) || 0 : value;
      newConfig[section][name] = finalValue;
      return newConfig;
    });
  };
  
  const handleTemplateChange = (templateKey: keyof EventConfig['emailTemplates'], field: 'subject' | 'body', value: string) => {
    if (!config) return;
    setConfig(prevConfig => {
        if (!prevConfig) return null;
        const newConfig = JSON.parse(JSON.stringify(prevConfig));
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
    setConfig(prevConfig => {
        if (!prevConfig) return null;
        const newConfig = JSON.parse(JSON.stringify(prevConfig));
        newConfig.googleConfig[name as keyof EventConfig['googleConfig']] = value;
        return newConfig;
    });
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
  
  const handleImageChange = (field: 'logoUrl' | 'pageImageUrl' | 'badgeImageUrl', dataUrl: string) => {
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

  const handleSmsToggle = (enabled: boolean) => {
    if (!config) return;
    setConfig(prevConfig => {
        if (!prevConfig) return null;
        const newConfig = JSON.parse(JSON.stringify(prevConfig));
        newConfig.sms.enabled = enabled;
        return newConfig;
    });
  };
  
  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    setSuccessMessage(null);
    try {
        const syncedConfig = await syncConfigFromGitHub(adminToken);
        setConfig(syncedConfig);
        updateConfig(syncedConfig);
        setSuccessMessage('Successfully synced configuration from GitHub!');
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to sync from GitHub.');
    } finally {
        setIsSyncing(false);
        setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    
    setError(null);
    setSuccessMessage(null);

    if (!config.event.name?.trim()) { setError("Event Name is required."); return; }
    if (!config.event.date?.trim()) { setError("Event Date is required."); return; }
    
    setIsSaving(true);
    try {
      const saved = await saveConfig(adminToken, config);
      setConfig(saved);
      updateConfig(saved);
      setSuccessMessage('Settings saved successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleTestEmail = async () => {
      if (!testEmailTo || !config) {
          setTestEmailResult({ type: 'error', message: 'Please enter a recipient email.' });
          return;
      }
      setIsSendingTest(true);
      setTestEmailResult(null);
      try {
          // Pass the CURRENT config state to test what's in the form, not just what's saved
          await sendTestEmail(adminToken, testEmailTo, config);
          setTestEmailResult({ type: 'success', message: 'Test email sent successfully!' });
      } catch (e) {
          setTestEmailResult({ type: 'error', message: e instanceof Error ? e.message : 'Failed to send test email.' });
      } finally {
          setIsSendingTest(false);
      }
  }
  
  // --- Form Field Handlers ---
  const openFieldModal = (field: FormField | null, index: number | null) => {
    setEditingField(field);
    setEditingFieldIndex(index);
    setIsFieldModalOpen(true);
  };

  const handleSaveField = (fieldData: FormField) => {
      if (!config) return;
      setConfig(prevConfig => {
          if (!prevConfig) return null;
          const newFields = [...(prevConfig.formFields || [])];
          if (editingFieldIndex !== null && editingFieldIndex > -1) {
              newFields[editingFieldIndex] = fieldData;
          } else {
              newFields.push(fieldData);
          }
          return { ...prevConfig, formFields: newFields };
      });
  };

  const handleDeleteField = (index: number) => {
      if (!config) return;
      if (window.confirm('Delete this field?')) {
          setConfig(prevConfig => {
              if (!prevConfig) return null;
              const newFields = prevConfig.formFields.filter((_, i) => i !== index);
              return { ...prevConfig, formFields: newFields };
          });
      }
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
      if (!config) return;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= config.formFields.length) return;
      setConfig(prevConfig => {
          if (!prevConfig) return null;
          const newFields = [...prevConfig.formFields];
          [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
          return { ...prevConfig, formFields: newFields };
      });
  };

  if (isLoading) return <ContentLoader text="Loading settings..." />;
  
  if (error && !config) return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
          <Alert type="error" message={error} />
          <button onClick={() => window.location.reload()} className="mt-4 text-primary hover:underline">Reload Page</button>
      </div>
  );
  
  if (!config) return <Alert type="error" message="Could not load configuration." />;

  const tabs: { id: Tab, label: string }[] = [
      { id: 'general', label: 'General' },
      { id: 'registration', label: 'Registration' },
      { id: 'theme', label: 'Theme' },
      { id: 'communications', label: 'Communications' },
      { id: 'economy', label: 'Economy' },
      { id: 'integrations', label: 'Integrations' },
  ];

  return (
    <>
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg flex flex-col h-[calc(100vh-150px)]">
        <div className="p-6 pb-0 flex-shrink-0">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Event Settings</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Configure your event platform.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center justify-center disabled:opacity-50"
                >
                    {isSaving ? <><Spinner /> Saving...</> : 'Save Changes'}
                </button>
            </div>
            
            {successMessage && <div className="mb-4"><Alert type="success" message={successMessage} /></div>}
            {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === tab.id
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={handleSave} className="space-y-6 max-w-4xl mx-auto">
                
                {/* GENERAL SETTINGS */}
                {activeTab === 'general' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                            <div className="sm:col-span-4">
                                <label htmlFor="event.name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event Name</label>
                                <input type="text" name="name" id="event.name" value={config.event.name} onChange={(e) => handleInputChange(e, 'event')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary dark:bg-gray-700 dark:text-white sm:text-sm" />
                            </div>
                            <div className="sm:col-span-2">
                                <label htmlFor="event.eventType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                                <select name="eventType" id="event.eventType" value={config.event.eventType} onChange={(e) => handleInputChange(e, 'event')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary dark:bg-gray-700 dark:text-white sm:text-sm">
                                    {EVENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                </select>
                            </div>

                            <div className="sm:col-span-3">
                                <label htmlFor="event.date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                                <input type="text" name="date" id="event.date" value={config.event.date} onChange={(e) => handleInputChange(e, 'event')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary dark:bg-gray-700 dark:text-white sm:text-sm" />
                            </div>
                             <div className="sm:col-span-3">
                                <label htmlFor="event.location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Location</label>
                                <input type="text" name="location" id="event.location" value={config.event.location} onChange={(e) => handleInputChange(e, 'event')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary dark:bg-gray-700 dark:text-white sm:text-sm" />
                            </div>

                            <div className="sm:col-span-6">
                                <label htmlFor="event.description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                                <textarea name="description" id="event.description" rows={4} value={config.event.description} onChange={(e) => handleInputChange(e, 'event')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary dark:bg-gray-700 dark:text-white sm:text-sm" />
                            </div>

                            <div className="sm:col-span-3">
                                <label htmlFor="event.maxAttendees" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Max Attendees (0 for unlimited)</label>
                                <input type="number" name="maxAttendees" id="event.maxAttendees" value={config.event.maxAttendees} onChange={(e) => handleInputChange(e, 'event')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary dark:bg-gray-700 dark:text-white sm:text-sm" />
                            </div>
                            <div className="sm:col-span-3">
                                <label htmlFor="event.publicUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Public URL</label>
                                <input type="url" name="publicUrl" id="event.publicUrl" value={config.event.publicUrl} onChange={(e) => handleInputChange(e, 'event')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary dark:bg-gray-700 dark:text-white sm:text-sm" />
                            </div>
                        </div>
                        
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Host Information</h3>
                            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                                <div className="sm:col-span-3">
                                    <label htmlFor="host.name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Host Name</label>
                                    <input type="text" name="name" id="host.name" value={config.host.name} onChange={(e) => handleInputChange(e, 'host')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary dark:bg-gray-700 dark:text-white sm:text-sm" />
                                </div>
                                <div className="sm:col-span-3">
                                    <label htmlFor="host.email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Host Email</label>
                                    <input type="email" name="email" id="host.email" value={config.host.email} onChange={(e) => handleInputChange(e, 'host')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary dark:bg-gray-700 dark:text-white sm:text-sm" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* REGISTRATION FORM */}
                {activeTab === 'registration' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-600 mb-4">
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase mb-2">Standard Fields</h3>
                            <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                                <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded">First Name (Req)</span>
                                <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded">Last Name (Req)</span>
                                <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded">Email (Req)</span>
                                <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded">Password (Req)</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {config.formFields && config.formFields.length > 0 ? (
                                config.formFields.map((field, index) => (
                                    <div key={field.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm group hover:border-primary/50 transition-colors">
                                        <div>
                                            <p className="font-bold text-gray-800 dark:text-white">{field.label}</p>
                                            <div className="flex gap-2 mt-1">
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">{field.type}</span>
                                                {field.required && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300">Required</span>}
                                                {!field.enabled && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400">Disabled</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                             <button type="button" onClick={() => handleMoveField(index, 'up')} disabled={index === 0} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                            </button>
                                            <button type="button" onClick={() => handleMoveField(index, 'down')} disabled={index === config.formFields.length - 1} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </button>
                                            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
                                            <button type="button" onClick={() => openFieldModal(field, index)} className="text-sm font-medium text-primary hover:underline px-2">Edit</button>
                                            <button type="button" onClick={() => handleDeleteField(index)} className="text-sm font-medium text-red-600 hover:underline px-2">Delete</button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                                    No custom fields added.
                                </div>
                            )}
                        </div>
                        <button type="button" onClick={() => openFieldModal(null, null)} className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            + Add Custom Field
                        </button>
                    </div>
                )}

                {/* THEME SETTINGS */}
                {activeTab === 'theme' && (
                    <div className="space-y-8 animate-fade-in">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ColorPickerInput label="Primary Color" name="colorPrimary" value={config.theme.colorPrimary} onChange={(e) => handleInputChange(e, 'theme')} />
                            <ColorPickerInput label="Secondary Color" name="colorSecondary" value={config.theme.colorSecondary} onChange={(e) => handleInputChange(e, 'theme')} />
                            <ColorPickerInput label="Background Color (Light)" name="backgroundColor" value={config.theme.backgroundColor} onChange={(e) => handleInputChange(e, 'theme')} />
                            <div>
                                <label htmlFor="theme.fontFamily" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Font Family</label>
                                <select name="fontFamily" id="theme.fontFamily" value={config.theme.fontFamily} onChange={(e) => handleInputChange(e, 'theme')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary dark:text-white sm:text-sm">
                                    {FONT_OPTIONS.map(font => <option key={font} value={font}>{font}</option>)}
                                </select>
                            </div>
                         </div>
                         
                         <div className="border-t border-gray-200 dark:border-gray-700 pt-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                            <ImageUpload label="Event Logo" value={config.theme.logoUrl} onChange={(dataUrl) => handleImageChange('logoUrl', dataUrl)} />
                            <ImageUpload label="Landing Page Banner" value={config.theme.pageImageUrl} onChange={(dataUrl) => handleImageChange('pageImageUrl', dataUrl)} />
                         </div>
                    </div>
                )}

                {/* COMMUNICATIONS */}
                {activeTab === 'communications' && (
                    <div className="space-y-8 animate-fade-in">
                        
                        {/* Provider Settings */}
                        <section className="bg-gray-50 dark:bg-gray-700/20 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Email Provider</h3>
                            <div className="flex items-center gap-6 mb-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="emailProvider" value="smtp" checked={config.emailProvider === 'smtp'} onChange={handleProviderChange} className="text-primary focus:ring-primary" />
                                    <span className="text-sm font-medium">SMTP</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="emailProvider" value="google" checked={config.emailProvider === 'google'} onChange={handleProviderChange} className="text-primary focus:ring-primary" />
                                    <span className="text-sm font-medium">Google Service Account</span>
                                </label>
                            </div>

                            {config.emailProvider === 'smtp' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Host</label>
                                        <input type="text" name="host" value={config.smtp.host} onChange={(e) => handleInputChange(e, 'smtp')} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Port</label>
                                        <input type="number" name="port" value={config.smtp.port} onChange={(e) => handleInputChange(e, 'smtp')} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Encryption</label>
                                        <select name="encryption" value={config.smtp.encryption} onChange={(e) => handleInputChange(e, 'smtp')} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm">
                                            <option value="none">None</option>
                                            <option value="ssl">SSL</option>
                                            <option value="tls">TLS</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Username</label>
                                        <input type="text" name="username" value={config.smtp.username} onChange={(e) => handleInputChange(e, 'smtp')} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
                                        <input type="password" name="password" value={config.smtp.password} onChange={(e) => handleInputChange(e, 'smtp')} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm" />
                                    </div>
                                </div>
                            )}

                            {config.emailProvider === 'google' && (
                                <div className="animate-fade-in">
                                     <label className="block text-xs font-medium text-gray-500 mb-1">Service Account Key (JSON)</label>
                                     <textarea name="serviceAccountKeyJson" rows={4} value={config.googleConfig.serviceAccountKeyJson} onChange={handleGoogleConfigChange} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm font-mono text-xs" placeholder='Paste your JSON key here...'></textarea>
                                </div>
                            )}

                            {/* Test Email Section */}
                            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
                                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Test Configuration</h4>
                                <div className="flex gap-3 items-start">
                                    <div className="flex-grow">
                                        <input 
                                            type="email" 
                                            placeholder="Enter recipient email" 
                                            value={testEmailTo}
                                            onChange={e => setTestEmailTo(e.target.value)}
                                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm"
                                        />
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={handleTestEmail}
                                        disabled={isSendingTest}
                                        className="px-4 py-2 bg-secondary hover:bg-secondary/90 text-white text-sm font-medium rounded-md shadow-sm flex items-center disabled:opacity-50"
                                    >
                                        {isSendingTest ? <Spinner /> : 'Send Test Email'}
                                    </button>
                                </div>
                                {testEmailResult && (
                                    <div className="mt-2">
                                        <Alert type={testEmailResult.type} message={testEmailResult.message} />
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Templates */}
                        <section>
                             <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Email Templates</h3>
                             <div className="space-y-3">
                                <TemplateEditor templateKey="userConfirmation" label="Registration Confirmation" config={config} onChange={handleTemplateChange} placeholders={['{{name}}', '{{eventName}}', '{{eventDate}}', '{{verificationLink}}', '{{qrCodeUrl}}']} />
                                <TemplateEditor templateKey="hostNotification" label="Host Notification" config={config} onChange={handleTemplateChange} placeholders={['{{name}}', '{{email}}', '{{eventName}}']} />
                                <TemplateEditor templateKey="passwordReset" label="Password Reset" config={config} onChange={handleTemplateChange} placeholders={['{{eventName}}', '{{resetLink}}']} />
                                <TemplateEditor templateKey="delegateInvitation" label="Invitation" config={config} onChange={handleTemplateChange} placeholders={['{{eventName}}', '{{inviteLink}}']} />
                             </div>
                        </section>

                        {/* Other Channels */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold">WhatsApp</h4>
                                    <ToggleSwitch label="" name="wa" enabled={config.whatsapp.enabled} onChange={handleWhatsappToggle} />
                                </div>
                                <fieldset disabled={!config.whatsapp.enabled} className="space-y-3 disabled:opacity-50">
                                    <input type="password" name="accessToken" placeholder="Access Token" value={config.whatsapp.accessToken} onChange={handleWhatsappChange} className="w-full rounded border-gray-300 dark:border-gray-600 p-2 text-sm" />
                                    <input type="text" name="phoneNumberId" placeholder="Phone Number ID" value={config.whatsapp.phoneNumberId} onChange={handleWhatsappChange} className="w-full rounded border-gray-300 dark:border-gray-600 p-2 text-sm" />
                                </fieldset>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold">SMS (Twilio)</h4>
                                    <ToggleSwitch label="" name="sms" enabled={config.sms.enabled} onChange={handleSmsToggle} />
                                </div>
                                <fieldset disabled={!config.sms.enabled} className="space-y-3 disabled:opacity-50">
                                    <input type="text" name="accountSid" placeholder="Account SID" value={config.sms.accountSid} onChange={handleSmsChange} className="w-full rounded border-gray-300 dark:border-gray-600 p-2 text-sm" />
                                    <input type="password" name="authToken" placeholder="Auth Token" value={config.sms.authToken} onChange={handleSmsChange} className="w-full rounded border-gray-300 dark:border-gray-600 p-2 text-sm" />
                                    <input type="text" name="fromNumber" placeholder="From Number" value={config.sms.fromNumber} onChange={handleSmsChange} className="w-full rounded border-gray-300 dark:border-gray-600 p-2 text-sm" />
                                </fieldset>
                            </div>
                        </div>
                    </div>
                )}

                {/* ECONOMY */}
                {activeTab === 'economy' && (
                    <div className="animate-fade-in space-y-6">
                         <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-xl">
                             <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-bold">Virtual Economy</h3>
                                    <p className="text-sm text-gray-500">Manage the internal currency system.</p>
                                </div>
                                <ToggleSwitch label="Enabled" name="eventCoin.enabled" enabled={config.eventCoin.enabled} onChange={handleEventCoinToggle} />
                            </div>
                            <fieldset disabled={!config.eventCoin.enabled} className="grid grid-cols-1 md:grid-cols-2 gap-6 disabled:opacity-50">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Currency Name</label>
                                    <input type="text" name="name" id="eventCoin.name" value={config.eventCoin.name} onChange={handleEventCoinChange} className="w-full rounded border-gray-300 dark:border-gray-600 p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Starting Balance</label>
                                    <input type="number" name="startingBalance" id="eventCoin.startingBalance" value={config.eventCoin.startingBalance} onChange={handleEventCoinChange} className="w-full rounded border-gray-300 dark:border-gray-600 p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Pegged To</label>
                                    <input type="text" name="peggedCurrency" id="eventCoin.peggedCurrency" value={config.eventCoin.peggedCurrency} onChange={handleEventCoinChange} className="w-full rounded border-gray-300 dark:border-gray-600 p-2" placeholder="USD" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Exchange Rate</label>
                                    <input type="number" step="0.01" name="exchangeRate" id="eventCoin.exchangeRate" value={config.eventCoin.exchangeRate} onChange={handleEventCoinChange} className="w-full rounded border-gray-300 dark:border-gray-600 p-2" />
                                </div>
                            </fieldset>
                         </div>
                    </div>
                )}

                {/* INTEGRATIONS */}
                {activeTab === 'integrations' && (
                    <div className="animate-fade-in space-y-6">
                        {/* Developer API Section */}
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-xl">
                             <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-bold">Developer API</h3>
                                    <p className="text-sm text-gray-500">Use this key to connect your external applications to the platform.</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Server API Key</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={apiKey || 'Loading...'} 
                                            readOnly
                                            className="flex-grow rounded border-gray-300 dark:border-gray-600 p-2 font-mono text-xs bg-gray-50 dark:bg-gray-900" 
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => navigator.clipboard.writeText(apiKey)}
                                            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded text-sm"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Include this key in the <code>x-api-key</code> header of your HTTP requests.</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-xl">
                             <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-bold">GitHub Sync</h3>
                                    <p className="text-sm text-gray-500">Keep config in sync with a remote JSON file.</p>
                                </div>
                                <ToggleSwitch label="Enabled" name="githubSync.enabled" enabled={config.githubSync.enabled} onChange={handleGithubSyncToggle} />
                            </div>
                            <fieldset disabled={!config.githubSync.enabled} className="space-y-4 disabled:opacity-50">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Raw JSON URL</label>
                                    <input 
                                        type="url" 
                                        name="configUrl" 
                                        value={config.githubSync.configUrl} 
                                        onChange={(e) => handleInputChange(e, 'githubSync')} 
                                        className="w-full rounded border-gray-300 dark:border-gray-600 p-2" 
                                        placeholder="https://raw.githubusercontent.com/..."
                                    />
                                </div>
                                {config.githubSync.lastSyncTimestamp && (
                                    <div className={`text-sm p-3 rounded ${config.githubSync.lastSyncStatus === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                                        Last sync: {new Date(config.githubSync.lastSyncTimestamp).toLocaleString()} ({config.githubSync.lastSyncStatus})
                                    </div>
                                )}
                                <button 
                                    type="button" 
                                    onClick={handleSync} 
                                    disabled={isSyncing || !config.githubSync.configUrl}
                                    className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                                >
                                    {isSyncing ? <Spinner /> : 'Sync Now'}
                                </button>
                            </fieldset>
                        </div>
                    </div>
                )}

            </form>
        </div>
    </div>
    
    <FormFieldEditorModal
      isOpen={isFieldModalOpen}
      onClose={() => setIsFieldModalOpen(false)}
      onSave={handleSaveField}
      field={editingField}
    />
    </>
  );
};

const ColorPickerInput: React.FC<{label: string, name: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void}> = ({ label, name, value, onChange }) => (
    <div className="flex items-end gap-3">
        <div className="flex-grow">
            <TextInput 
                label={label} 
                name={name} 
                value={value} 
                onChange={onChange}
            />
        </div>
        <div className="flex-shrink-0">
            <input 
                type="color" 
                name={name} 
                value={value} 
                onChange={onChange}
                className="h-10 w-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer p-1 bg-white dark:bg-gray-700" 
            />
        </div>
    </div>
);
