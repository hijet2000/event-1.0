import React, { useState, useEffect } from 'react';
import { type FormField } from '../types';
import { Spinner } from './Spinner';
import { ToggleSwitch } from './ToggleSwitch';
import { Alert } from './Alert';

interface FormFieldEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (field: FormField) => void;
  field: FormField | null;
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = (props) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{props.label}</label>
        <input {...props} className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
    </div>
);

export const FormFieldEditorModal: React.FC<FormFieldEditorModalProps> = ({ isOpen, onClose, onSave, field }) => {
  const [formData, setFormData] = useState<Partial<FormField>>({});
  const [optionsString, setOptionsString] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isNewField = !field;

  useEffect(() => {
    if (isOpen) {
      setFormData(field ? { ...field } : {
        id: `custom_${Date.now().toString(36)}_${Math.random().toString(36).substring(2)}`,
        label: '',
        type: 'text',
        placeholder: '',
        required: false,
        enabled: true,
      });
      setOptionsString(field?.options?.join('\n') || '');
      setError('');
      setIsSaving(false);
    }
  }, [isOpen, field]);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggleChange = (name: keyof FormField, value: boolean) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.label?.trim()) {
      setError("Label is required.");
      return;
    }

    const finalData = { ...formData };

    if (finalData.type === 'dropdown') {
        const options = optionsString.split('\n').map(o => o.trim()).filter(o => o);
        if (options.length === 0) {
            setError('Dropdown options are required for the dropdown field type. Please enter at least one option per line.');
            return;
        }
        finalData.options = options;
    } else {
        delete finalData.options; // Clean up options if type is not dropdown
    }
    
    setIsSaving(true);
    setError('');
    
    await onSave(finalData as FormField);

    setIsSaving(false);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="field-editor-title"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSave}>
          <div className="p-6">
            <h2 id="field-editor-title" className="text-xl font-bold text-gray-900 dark:text-white">{isNewField ? 'Add Custom Field' : 'Edit Custom Field'}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Customize the information you collect from attendees.
            </p>
          </div>
          
          <div className="p-6 space-y-4 border-t border-b border-gray-200 dark:border-gray-700 max-h-[60vh] overflow-y-auto">
            {error && <Alert type="error" message={error} />}
            
            <InputField label="Field Label" id="label" type="text" name="label" value={formData.label || ''} onChange={handleInputChange} required placeholder="e.g., Dietary Restrictions" />
            
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field Type</label>
              <select id="type" name="type" value={formData.type} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="text">Text (Single Line)</option>
                <option value="textarea">Text Area (Multi-line)</option>
                <option value="dropdown">Dropdown</option>
              </select>
            </div>
            
            {formData.type === 'dropdown' && (
                <div>
                    <label htmlFor="options" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Dropdown Options
                        <span className="text-red-500 ml-1">*</span>
                    </label>
                    <textarea
                        id="options"
                        name="options"
                        rows={4}
                        value={optionsString}
                        onChange={(e) => setOptionsString(e.target.value)}
                        className="appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-primary focus:border-primary"
                        placeholder="Enter one option per line"
                    />
                     <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Each line will be a separate option in the dropdown.</p>
                </div>
            )}
            
            <InputField label="Placeholder Text" id="placeholder" type="text" name="placeholder" value={formData.placeholder || ''} onChange={handleInputChange} placeholder={formData.type === 'dropdown' ? 'e.g., Select your t-shirt size...' : "e.g., Vegan, Gluten-Free, etc."} />
            
            <div className="pt-2 space-y-2">
                <ToggleSwitch label="Field is enabled (visible on form)" name="enabled" enabled={!!formData.enabled} onChange={(val) => handleToggleChange('enabled', val)} />
                <ToggleSwitch label="Field is required" name="required" enabled={!!formData.required} onChange={(val) => handleToggleChange('required', val)} />
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium">Cancel</button>
            <button type="submit" disabled={isSaving} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center disabled:opacity-50">
              {isSaving ? <><Spinner /> Saving...</> : 'Save Field'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};