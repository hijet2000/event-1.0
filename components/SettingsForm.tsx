
import React, { useState, useEffect } from 'react';
import { type EventConfig, type FormField } from '../types';
import { getEventConfig, saveConfig, syncConfigFromGitHub, pushConfigToGitHub, sendTestEmail, getSystemApiKey, sendTestMessage } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { Spinner } from './Spinner';
import { ToggleSwitch } from './ToggleSwitch';
import { FormFieldEditorModal } from './FormFieldEditorModal';
import { useTheme } from '../contexts/ThemeContext';

interface SettingsFormProps {
  adminToken: string;
}

type Tab = 'general' | 'communications' | 'registration' | 'integrations' | 'advanced' | 'printing';

export const SettingsForm: React.FC<SettingsFormProps> = ({ adminToken }) => {
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

  // Modal State
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormField | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true);
      try {
        const cfg = await getEventConfig();
        setConfig(cfg);
        const key = await getSystemApiKey(adminToken);
        setApiKey(key);
      } catch (e) {
        setError("Failed to load settings.");
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, [adminToken]);

  const handleInputChange = (section: keyof EventConfig, field: string, value: any) => {
    if (!config) return;
    setConfig(prev => {
        if (!prev) return null;
        return {
            ...prev,
            [section]: {
                ...(prev[section] as object),
                [field]: value
            }
        };
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    // Validate JSON if Google provider is selected
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

  const handleSendTestEmail = async () => {
      if (!testEmailTo || !config) return;
      setIsSendingTest(true);
      setTestEmailResult(null);
      try {
          await sendTestEmail(adminToken, testEmailTo, config);
          setTestEmailResult({ type: 'success', message: 'Email sent!' });
      } catch (e) {
          setTestEmailResult({ type: 'error', message: (e as Error).message });
      } finally {
          setIsSendingTest(false);
      }
  };

  const handleGitHubSync = async () => {
      setIsSyncing(true);
      setError(null);
      try {
          const newConfig = await syncConfigFromGitHub(adminToken);
          setConfig(newConfig);
          setSuccessMessage('Configuration synced from GitHub!');
          if (contextConfig) updateConfig(newConfig);
      } catch (e) {
          setError((e as Error).message);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleGitHubPush = async () => {
      setIsPushing(true);
      setError(null);
      try {
          await pushConfigToGitHub(adminToken);
          setSuccessMessage('Configuration pushed to GitHub!');
      } catch (e) {
          setError((e as Error).message);
      } finally {
          setIsPushing(false);
      }
  };

  const handleSaveField = (field: FormField) => {
      if (!config) return;
      setConfig(prev => {
          if (!prev) return null;
          const newFields = [...prev.formFields];
          const index = newFields.findIndex(f => f.id === field.id);
          if (index >= 0) {
              newFields[index] = field;
          } else {
              newFields.push(field);
          }
          return { ...prev, formFields: newFields };
      });
  };

  const handleDeleteField = (id: string) => {
      if (!config) return;
      if (confirm('Delete this field?')) {
          setConfig(prev => {
              if (!prev) return null;
              return { ...prev, formFields: prev.formFields.filter(f => f.id !== id) };
          });
      }
  };

  if (isLoading || !config) {
      return <ContentLoader text="Loading settings..." />;
  }

  const safeGoogle = config.googleConfig || { serviceAccountKeyJson: '' };

  return (
    <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Event Settings</h2>
            <div className="flex gap-2">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-primary text-white rounded-md shadow-sm hover:bg-primary/90 flex items-center disabled:opacity-50"
                >
                    {isSaving ? <Spinner /> : 'Save Changes'}
                </button>
            </div>
        </div>

        {error && <div className="mb-4"><Alert type="error" message={error} /></div>}
        {successMessage && <div className="mb-4"><Alert type="success" message={successMessage} /></div>}

        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg mb-6 overflow-x-auto">
            {(['general', 'communications', 'registration', 'integrations', 'printing'] as Tab[]).map((tab) => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                        activeTab === tab
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
            ))}
        </div>

        <form onSubmit={handleSave} className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            
            {activeTab === 'general' && (
                <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-700">Event Details</h3>
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                        <div className="sm:col-span-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event Name</label>
                            <input
                                type="text"
                                value={config.event.name}
                                onChange={(e) => handleInputChange('event', 'name', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:text-white"
                            />
                        </div>
                        <div className="sm:col-span-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                            <input
                                type="text"
                                value={config.event.date}
                                onChange={(e) => handleInputChange('event', 'date', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:text-white"
                            />
                        </div>
                        <div className="sm:col-span-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Location</label>
                            <input
                                type="text"
                                value={config.event.location}
                                onChange={(e) => handleInputChange('event', 'location', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:text-white"
                            />
                        </div>
                        <div className="sm:col-span-6">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                            <textarea
                                rows={3}
                                value={config.event.description}
                                onChange={(e) => handleInputChange('event', 'description', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:text-white"
                            />
                        </div>
                    </div>

                    <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-700 mt-8">Theme</h3>
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                        <div className="sm:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Primary Color</label>
                            <div className="mt-1 flex items-center gap-2">
                                <input
                                    type="color"
                                    value={config.theme.colorPrimary}
                                    onChange={(e) => handleInputChange('theme', 'colorPrimary', e.target.value)}
                                    className="h-9 w-9 rounded-md border border-gray-300 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={config.theme.colorPrimary}
                                    onChange={(e) => handleInputChange('theme', 'colorPrimary', e.target.value)}
                                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm dark:text-white"
                                />
                            </div>
                        </div>
                        <div className="sm:col-span-6">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Logo URL</label>
                            <input
                                type="url"
                                value={config.theme.logoUrl}
                                onChange={(e) => handleInputChange('theme', 'logoUrl', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:text-white"
                            />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'communications' && (
                <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-700">Email Provider</h3>
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Service</label>
                            <select
                                value={config.emailProvider}
                                onChange={(e) => {
                                    if (!config) return;
                                    setConfig({...config, emailProvider: e.target.value as any});
                                }}
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:text-white"
                            >
                                <option value="smtp">SMTP (Generic)</option>
                                <option value="google">Google Workspace (Gmail API)</option>
                            </select>
                        </div>

                        {config.emailProvider === 'smtp' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Host</label>
                                    <input
                                        type="text"
                                        value={config.smtp.host}
                                        onChange={(e) => handleInputChange('smtp', 'host', e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Port</label>
                                    <input
                                        type="number"
                                        value={config.smtp.port}
                                        onChange={(e) => handleInputChange('smtp', 'port', parseInt(e.target.value))}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                                    <input
                                        type="text"
                                        value={config.smtp.username}
                                        onChange={(e) => handleInputChange('smtp', 'username', e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                                    <input
                                        type="password"
                                        value={config.smtp.password || ''}
                                        onChange={(e) => handleInputChange('smtp', 'password', e.target.value)}
                                        placeholder={config.smtp.password ? '••••••••' : ''}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm dark:text-white"
                                    />
                                </div>
                            </div>
                        )}

                        {config.emailProvider === 'google' && (
                            <div className="border-t pt-4 dark:border-gray-700 animate-fade-in">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Service Account JSON</label>
                                    <button 
                                        type="button" 
                                        onClick={validateServiceAccountJson}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        Validate JSON
                                    </button>
                                </div>
                                <textarea name="serviceAccountKeyJson" rows={5} value={safeGoogle.serviceAccountKeyJson} onChange={handleGoogleConfigChange} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm font-mono text-xs text-gray-900 dark:text-white" placeholder='{"type": "service_account", ...}' />
                                
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

                        {/* Test Email */}
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600 mt-4">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Send Test Email</h4>
                            <div className="flex gap-2">
                                <input 
                                    type="email" 
                                    placeholder="your@email.com" 
                                    className="flex-1 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm text-sm"
                                    value={testEmailTo}
                                    onChange={e => setTestEmailTo(e.target.value)}
                                />
                                <button 
                                    type="button" 
                                    onClick={handleSendTestEmail}
                                    disabled={isSendingTest || !testEmailTo}
                                    className="px-4 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50"
                                >
                                    {isSendingTest ? 'Sending...' : 'Send'}
                                </button>
                            </div>
                            {testEmailResult && (
                                <p className={`mt-2 text-xs ${testEmailResult.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                    {testEmailResult.message}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'registration' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center border-b pb-2 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Custom Form Fields</h3>
                        <button 
                            type="button" 
                            onClick={() => { setEditingField(null); setIsFieldModalOpen(true); }}
                            className="text-sm text-primary hover:underline"
                        >
                            + Add Field
                        </button>
                    </div>
                    
                    <div className="space-y-3">
                        {config.formFields.map(field => (
                            <div key={field.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">{field.label}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Type: {field.type} • {field.required ? 'Required' : 'Optional'} • {field.enabled ? 'Enabled' : 'Disabled'}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => { setEditingField(field); setIsFieldModalOpen(true); }} className="text-sm text-gray-600 dark:text-gray-300 hover:text-primary">Edit</button>
                                    <button type="button" onClick={() => handleDeleteField(field.id)} className="text-sm text-red-600 hover:text-red-800">Delete</button>
                                </div>
                            </div>
                        ))}
                        {config.formFields.length === 0 && <p className="text-gray-500 italic text-sm">No custom fields defined.</p>}
                    </div>
                </div>
            )}

            {activeTab === 'integrations' && (
                <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-700">GitHub Sync</h3>
                    <p className="text-sm text-gray-500">Sync your event configuration with a GitHub repository for version control.</p>
                    
                    <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Owner / Organization</label>
                            <input
                                type="text"
                                value={config.githubSync.owner}
                                onChange={(e) => handleInputChange('githubSync', 'owner', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Repository Name</label>
                            <input
                                type="text"
                                value={config.githubSync.repo}
                                onChange={(e) => handleInputChange('githubSync', 'repo', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm dark:text-white"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Path to Config File</label>
                            <input
                                type="text"
                                value={config.githubSync.path}
                                onChange={(e) => handleInputChange('githubSync', 'path', e.target.value)}
                                placeholder="config.json"
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm dark:text-white"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Personal Access Token</label>
                            <input
                                type="password"
                                value={config.githubSync.token}
                                onChange={(e) => handleInputChange('githubSync', 'token', e.target.value)}
                                placeholder="ghp_..."
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button 
                            type="button"
                            onClick={handleGitHubSync}
                            disabled={isSyncing}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                            {isSyncing ? <Spinner /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
                            Pull from GitHub
                        </button>
                        <button 
                            type="button"
                            onClick={handleGitHubPush}
                            disabled={isPushing}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                            {isPushing ? <Spinner /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
                            Push to GitHub
                        </button>
                    </div>
                    {config.githubSync.lastSyncStatus && (
                        <p className="text-xs text-gray-500 mt-2">
                            Last sync: {config.githubSync.lastSyncStatus} at {new Date(config.githubSync.lastSyncTimestamp || 0).toLocaleString()}
                        </p>
                    )}
                </div>
            )}

            {activeTab === 'printing' && (
                <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-700">Badge Printing Configuration</h3>
                    
                    <div className="space-y-4">
                        <ToggleSwitch
                            label="Enable Badge Printing"
                            name="printConfig.enabled"
                            enabled={config.printConfig?.enabled ?? true}
                            onChange={(val) => handleInputChange('printConfig', 'enabled', val)}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Badge Width (inches)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={config.printConfig?.width ?? 4}
                                    onChange={(e) => handleInputChange('printConfig', 'width', parseFloat(e.target.value))}
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Badge Height (inches)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={config.printConfig?.height ?? 3}
                                    onChange={(e) => handleInputChange('printConfig', 'height', parseFloat(e.target.value))}
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm dark:text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Orientation</label>
                            <select
                                value={config.printConfig?.orientation ?? 'landscape'}
                                onChange={(e) => handleInputChange('printConfig', 'orientation', e.target.value)}
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:text-white"
                            >
                                <option value="landscape">Landscape</option>
                                <option value="portrait">Portrait</option>
                            </select>
                        </div>

                        <ToggleSwitch
                            label="Auto-Print on Kiosk Check-in"
                            name="printConfig.autoPrintOnKiosk"
                            enabled={config.printConfig?.autoPrintOnKiosk ?? false}
                            onChange={(val) => handleInputChange('printConfig', 'autoPrintOnKiosk', val)}
                        />
                        
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
                            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">Printer Setup Tip</h4>
                            <p className="text-xs text-blue-700 dark:text-blue-200">
                                Ensure your browser's print settings match these dimensions. 
                                Select the correct paper size (e.g., 4x6 or 4x3) in the system print dialog.
                                Uncheck "Headers and footers" in browser print options.
                            </p>
                        </div>
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
