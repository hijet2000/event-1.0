
import React, { useState, useEffect } from 'react';
import { type EventConfig, type FormField } from '../types';
import { getEventConfig, saveConfig, syncConfigFromGitHub } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Spinner } from './Spinner';
import { Alert } from './Alert';
import { ImageUpload } from './ImageUpload';
import { useTheme } from '../contexts/ThemeContext';
import { ToggleSwitch } from './ToggleSwitch';
import { FormFieldEditorModal } from './FormFieldEditorModal';

interface SettingsFormProps {
  adminToken: string;
}

const FONT_OPTIONS = ['Inter', 'Roboto', 'Lato', 'Montserrat'];
const EVENT_TYPES = ['Conference', 'Workshop', 'Webinar', 'Meetup', 'Other'];

const TemplateEditor: React.FC<{
    templateKey: keyof EventConfig['emailTemplates'],
    label: string;
    config: EventConfig;
    onChange: (templateKey: keyof EventConfig['emailTemplates'], field: 'subject' | 'body', value: string) => void;
    placeholders: string[];
}> = ({ templateKey, label, config, onChange, placeholders }) => (
    <div className="p-4 rounded-md bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
        <h4 className="text-md font-medium text-gray-800 dark:text-gray-200">{label}</h4>
        <div className="mt-3 space-y-2">
            <input 
                type="text" 
                name="subject" 
                value={config.emailTemplates[templateKey].subject}
                onChange={(e) => onChange(templateKey, 'subject', e.target.value)}
                placeholder="Email Subject"
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm" 
            />
            <textarea 
                name="body" 
                rows={6}
                value={config.emailTemplates[templateKey].body}
                onChange={(e) => onChange(templateKey, 'body', e.target.value)}
                placeholder="Email Body..."
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm font-mono text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-semibold">Placeholders:</span> {placeholders.join(', ')}
            </p>
        </div>
    </div>
);


export const SettingsForm: React.FC<SettingsFormProps> = ({ adminToken }) => {
  const { updateConfig } = useTheme();
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // State for Form Field Editor Modal
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);


  useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true);
        const configData = await getEventConfig();
        setConfig(configData);
      } catch (err) {
        setError('Failed to load event settings.');
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>, section: 'event' | 'host' | 'theme' | 'smtp' | 'githubSync') => {
    if (!config) return;

    const { name, value, type } = e.target;
    
    setConfig(prevConfig => {
      if (!prevConfig) return null;
      
      const newConfig = JSON.parse(JSON.stringify(prevConfig));
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
  
  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    setSuccessMessage(null);
    try {
        const syncedConfig = await syncConfigFromGitHub(adminToken);
        setConfig(syncedConfig);
        updateConfig(syncedConfig); // Update global theme context
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
    
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const saved = await saveConfig(adminToken, config);
      setConfig(saved);
      updateConfig(saved); // Update global theme context
      setSuccessMessage('Settings saved successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSuccessMessage(null), 3000); // Clear message after 3 seconds
    }
  };
  
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
              // Update existing
              newFields[editingFieldIndex] = fieldData;
          } else {
              // Add new
              newFields.push(fieldData);
          }
          return { ...prevConfig, formFields: newFields };
      });
  };

  const handleDeleteField = (index: number) => {
      if (!config) return;
      if (window.confirm('Are you sure you want to delete this field? This change will be permanent once you save.')) {
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
          // Simple swap
          [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
          return { ...prevConfig, formFields: newFields };
      });
  };

  if (isLoading) {
    return <ContentLoader text="Loading settings..." />;
  }

  if (error && !config) {
    return <Alert type="error" message={error} />;
  }
  
  if (!config) {
      return <Alert type="error" message="Could not load configuration." />;
  }

  return (
    <>
    <form onSubmit={handleSave}>
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Event Settings</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage the core details, theme, and registration form for your event.
          </p>
        </div>
        
        {/* Event Details */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <h3 className="text-lg font-medium">Event Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label htmlFor="event.name" className="block text-sm font-medium">Event Name</label>
                    <input type="text" name="name" id="event.name" value={config.event.name} onChange={(e) => handleInputChange(e, 'event')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" />
                </div>
                <div>
                    <label htmlFor="event.date" className="block text-sm font-medium">Date</label>
                    <input type="text" name="date" id="event.date" value={config.event.date} onChange={(e) => handleInputChange(e, 'event')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" />
                </div>
                 <div>
                    <label htmlFor="event.location" className="block text-sm font-medium">Location</label>
                    <input type="text" name="location" id="event.location" value={config.event.location} onChange={(e) => handleInputChange(e, 'event')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" />
                </div>
                <div>
                    <label htmlFor="event.eventType" className="block text-sm font-medium">Event Type</label>
                    <select name="eventType" id="event.eventType" value={config.event.eventType} onChange={(e) => handleInputChange(e, 'event')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm">
                        {EVENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="event.maxAttendees" className="block text-sm font-medium">Max Attendees</label>
                    <input type="number" name="maxAttendees" id="event.maxAttendees" value={config.event.maxAttendees} onChange={(e) => handleInputChange(e, 'event')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Set to 0 for unlimited attendees.</p>
                </div>
            </div>
        </div>

         {/* Theme Settings */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 space-y-6">
            <h3 className="text-lg font-medium">Theme & Appearance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ColorPickerInput label="Primary Color" name="colorPrimary" value={config.theme.colorPrimary} onChange={(e) => handleInputChange(e, 'theme')} />
                <ColorPickerInput label="Secondary Color" name="colorSecondary" value={config.theme.colorSecondary} onChange={(e) => handleInputChange(e, 'theme')} />
                <ColorPickerInput label="Background Color (Light Mode)" name="backgroundColor" value={config.theme.backgroundColor} onChange={(e) => handleInputChange(e, 'theme')} />

                <div>
                    <label htmlFor="theme.fontFamily" className="block text-sm font-medium">Font Family</label>
                    <select name="fontFamily" id="theme.fontFamily" value={config.theme.fontFamily} onChange={(e) => handleInputChange(e, 'theme')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm">
                        {FONT_OPTIONS.map(font => <option key={font} value={font}>{font}</option>)}
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label htmlFor="theme.websiteUrl" className="block text-sm font-medium">Event Website URL</label>
                    <input type="text" name="websiteUrl" id="theme.websiteUrl" placeholder="https://example.com" value={config.theme.websiteUrl} onChange={(e) => handleInputChange(e, 'theme')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" />
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <ImageUpload 
                    label="Logo Image"
                    value={config.theme.logoUrl}
                    onChange={(dataUrl) => handleImageChange('logoUrl', dataUrl)}
                />
                <ImageUpload 
                    label="Page Background Image"
                    value={config.theme.pageImageUrl}
                    onChange={(dataUrl) => handleImageChange('pageImageUrl', dataUrl)}
                />
                <ImageUpload 
                    label="ID Badge Background"
                    value={config.theme.badgeImageUrl}
                    onChange={(dataUrl) => handleImageChange('badgeImageUrl', dataUrl)}
                />
            </div>
        </div>

        {/* Custom Registration Fields */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <h3 className="text-lg font-medium">Custom Registration Fields</h3>
            <div className="space-y-3">
                {config.formFields && config.formFields.length > 0 ? (
                    config.formFields.map((field, index) => (
                        <div key={field.id} className="flex items-center justify-between p-3 rounded-md bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                            <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-white">{field.label}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Type: {field.type} &bull; {field.required ? 'Required' : 'Optional'} &bull; {field.enabled ? 'Enabled' : 'Disabled'}
                                </p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="flex flex-col">
                                    <button type="button" onClick={() => handleMoveField(index, 'up')} disabled={index === 0} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                    </button>
                                    <button type="button" onClick={() => handleMoveField(index, 'down')} disabled={index === config.formFields.length - 1} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                </div>
                                <button type="button" onClick={() => openFieldModal(field, index)} className="text-sm font-medium text-primary hover:underline">Edit</button>
                                <button type="button" onClick={() => handleDeleteField(index)} className="text-sm font-medium text-red-600 dark:text-red-500 hover:underline">Delete</button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No custom fields have been added yet.</p>
                )}
            </div>
            <div className="pt-2">
                <button type="button" onClick={() => openFieldModal(null, null)} className="py-2 px-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 w-full">
                    + Add New Field
                </button>
            </div>
        </div>

        {/* Email Templates */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <h3 className="text-lg font-medium">Email Templates</h3>
            <div className="space-y-4">
                <TemplateEditor
                    templateKey="userConfirmation"
                    label="User Confirmation Email"
                    config={config}
                    onChange={handleTemplateChange}
                    placeholders={['{{name}}', '{{eventName}}', '{{eventDate}}', '{{eventLocation}}', '{{customFields}}', '{{verificationLink}}', '{{hostName}}']}
                />
                 <TemplateEditor
                    templateKey="hostNotification"
                    label="Host Notification Email"
                    config={config}
                    onChange={handleTemplateChange}
                    placeholders={['{{name}}', '{{email}}', '{{eventName}}', '{{customFields}}']}
                />
                 <TemplateEditor
                    templateKey="passwordReset"
                    label="Password Reset Email"
                    config={config}
                    onChange={handleTemplateChange}
                    placeholders={['{{eventName}}', '{{resetLink}}', '{{hostName}}']}
                />
                 <TemplateEditor
                    templateKey="delegateInvitation"
                    label="Delegate Invitation Email"
                    config={config}
                    onChange={handleTemplateChange}
                    placeholders={['{{eventName}}', '{{inviterName}}', '{{inviteLink}}', '{{hostName}}']}
                />
            </div>
        </div>
        
        {/* EventCoin Settings */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">EventCoin Settings</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage the virtual currency for your event.</p>
                </div>
                <label htmlFor="eventCoin.enabled" className="flex items-center cursor-pointer">
                    <span className="mr-3 text-sm font-medium">{config.eventCoin.enabled ? 'Enabled' : 'Disabled'}</span>
                    <div className="relative">
                        <input type="checkbox" id="eventCoin.enabled" name="enabled" checked={config.eventCoin.enabled} onChange={handleEventCoinChange} className="sr-only" />
                        <div className="block bg-gray-200 dark:bg-gray-600 w-14 h-8 rounded-full"></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${config.eventCoin.enabled ? 'translate-x-6 bg-primary' : ''}`}></div>
                    </div>
                </label>
            </div>
            
            <fieldset disabled={!config.eventCoin.enabled} className="pt-4 border-t border-gray-200 dark:border-gray-700 disabled:opacity-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="eventCoin.name" className="block text-sm font-medium">Currency Name</label>
                        <input type="text" name="name" id="eventCoin.name" value={config.eventCoin.name} onChange={handleEventCoinChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" />
                    </div>
                     <div>
                        <label htmlFor="eventCoin.startingBalance" className="block text-sm font-medium">Starting Balance</label>
                        <input type="number" name="startingBalance" id="eventCoin.startingBalance" value={config.eventCoin.startingBalance} onChange={handleEventCoinChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" />
                    </div>
                    <div>
                        <label htmlFor="eventCoin.peggedCurrency" className="block text-sm font-medium">Pegged Currency</label>
                        <input type="text" name="peggedCurrency" placeholder="e.g., USD" id="eventCoin.peggedCurrency" value={config.eventCoin.peggedCurrency} onChange={handleEventCoinChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" />
                    </div>
                    <div>
                        <label htmlFor="eventCoin.exchangeRate" className="block text-sm font-medium">Exchange Rate (1 EC = X)</label>
                        <input type="number" name="exchangeRate" step="0.01" id="eventCoin.exchangeRate" value={config.eventCoin.exchangeRate} onChange={handleEventCoinChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" />
                    </div>
                </div>
            </fieldset>
        </div>

        {/* GitHub Synchronization */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">GitHub Synchronization</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Keep event settings in sync with a JSON file on GitHub.</p>
                </div>
                <ToggleSwitch
                    label={config.githubSync.enabled ? 'Enabled' : 'Disabled'}
                    name="enabled"
                    enabled={config.githubSync.enabled}
                    onChange={handleGithubSyncToggle}
                />
            </div>

            <fieldset disabled={!config.githubSync.enabled} className="pt-4 border-t border-gray-200 dark:border-gray-700 disabled:opacity-50 space-y-4">
                <div>
                    <label htmlFor="githubSync.configUrl" className="block text-sm font-medium">GitHub Raw JSON URL</label>
                    <input 
                        type="url" 
                        name="configUrl" 
                        id="githubSync.configUrl" 
                        value={config.githubSync.configUrl} 
                        onChange={(e) => handleInputChange(e, 'githubSync')} 
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm"
                        placeholder="https://raw.githubusercontent.com/..."
                    />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        This must be the URL to the <strong className="font-semibold">raw</strong> file content, not the repository view.
                    </p>
                </div>
                
                {config.githubSync.lastSyncTimestamp && (
                    <div className={`p-3 rounded-md text-sm ${config.githubSync.lastSyncStatus === 'success' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'}`}>
                        <p><strong>Last Sync:</strong> {new Date(config.githubSync.lastSyncTimestamp).toLocaleString()}</p>
                        <p><strong>Status:</strong> <span className="capitalize">{config.githubSync.lastSyncStatus}</span></p>
                        <p className="mt-1 text-xs">{config.githubSync.lastSyncMessage}</p>
                    </div>
                )}
                
                <div>
                    <button
                        type="button"
                        onClick={handleSync}
                        disabled={isSyncing || !config.githubSync.configUrl}
                        className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-secondary hover:bg-secondary/90 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSyncing ? <><Spinner /> Syncing...</> : 'Sync Now from GitHub'}
                    </button>
                </div>
            </fieldset>
        </div>

        {/* Email Provider Settings */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h3 className="text-lg font-medium">Email Provider Settings</h3>
          <fieldset>
            <legend className="sr-only">Email Provider</legend>
            <div className="flex items-center gap-x-6">
                <div className="flex items-center gap-x-2">
                    <input id="emailProvider-smtp" name="emailProvider" type="radio" value="smtp" checked={config.emailProvider === 'smtp'} onChange={handleProviderChange} className="h-4 w-4 border-gray-300 text-primary focus:ring-primary" />
                    <label htmlFor="emailProvider-smtp" className="block text-sm font-medium leading-6">SMTP</label>
                </div>
                 <div className="flex items-center gap-x-2">
                    <input id="emailProvider-google" name="emailProvider" type="radio" value="google" checked={config.emailProvider === 'google'} onChange={handleProviderChange} className="h-4 w-4 border-gray-300 text-primary focus:ring-primary" />
                    <label htmlFor="emailProvider-google" className="block text-sm font-medium leading-6">Google</label>
                </div>
            </div>
          </fieldset>
          
          {config.emailProvider === 'smtp' && (
             <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4 space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium">Host</label>
                        <input type="text" name="host" value={config.smtp.host} onChange={(e) => handleInputChange(e, 'smtp')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Port</label>
                        <input type="number" name="port" value={config.smtp.port} onChange={(e) => handleInputChange(e, 'smtp')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-medium">Username</label>
                        <input type="text" name="username" value={config.smtp.username} onChange={(e) => handleInputChange(e, 'smtp')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Password</label>
                        <input type="password" name="password" value={config.smtp.password} onChange={(e) => handleInputChange(e, 'smtp')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" />
                    </div>
                </div>
                <div>
                     <label className="block text-sm font-medium">Encryption</label>
                     <select name="encryption" value={config.smtp.encryption} onChange={(e) => handleInputChange(e, 'smtp')} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm">
                        <option value="none">None</option>
                        <option value="ssl">SSL</option>
                        <option value="tls">TLS</option>
                    </select>
                </div>
             </div>
          )}
          
          {config.emailProvider === 'google' && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4 animate-fade-in">
                 <label className="block text-sm font-medium">Service Account Key (JSON)</label>
                 <textarea name="serviceAccountKeyJson" rows={6} value={config.googleConfig.serviceAccountKeyJson} onChange={handleGoogleConfigChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm font-mono text-xs" placeholder='Paste your JSON key here...'></textarea>
                 <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Your key will be stored securely on the server.</p>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-end gap-4">
            {successMessage && <Alert type="success" message={successMessage} />}
            {error && <Alert type="error" message={error} />}
            <button
              type="submit"
              disabled={isSaving}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center justify-center disabled:opacity-50"
            >
              {isSaving ? <><Spinner /> Saving...</> : 'Save Settings'}
            </button>
        </div>
      </div>
    </form>
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
    <div>
        <label htmlFor={`theme.${name}`} className="block text-sm font-medium">{label}</label>
        <div className="flex items-center gap-2 mt-1">
            <input type="color" name={name} id={`theme.${name}`} value={value} onChange={onChange} className="h-10 w-10 p-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm" />
            <input type="text" name={name} value={value} onChange={onChange} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" />
        </div>
    </div>
);
