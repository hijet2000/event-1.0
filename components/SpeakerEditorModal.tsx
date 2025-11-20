
import React, { useState, useEffect } from 'react';
import { type Speaker } from '../types';
import { Spinner } from './Spinner';
import { generateAiContent } from '../server/api';
import { ImageUpload } from './ImageUpload';

interface SpeakerEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Speaker>) => Promise<boolean>;
    speaker: Speaker | null;
    adminToken: string;
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <input {...props} className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-primary focus:border-primary" />
    </div>
);

export const SpeakerEditorModal: React.FC<SpeakerEditorModalProps> = ({ isOpen, onClose, onSave, speaker, adminToken }) => {
    const [formData, setFormData] = useState<Partial<Speaker>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const isNew = !speaker;

    useEffect(() => {
        if (isOpen) {
            setFormData(speaker ? { ...speaker } : {
                id: `spk_${Date.now().toString(36)}_${Math.random().toString(36).substring(2)}`,
                name: '',
                title: '',
                company: '',
                bio: '',
                photoUrl: '',
                linkedinUrl: '',
                twitterUrl: ''
            });
        }
    }, [isOpen, speaker]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateBio = async () => {
        if (!formData.name || !formData.title || !formData.company) {
            alert("Please provide name, title, and company first.");
            return;
        }
        setIsGenerating(true);
        try {
            const bio = await generateAiContent('speaker_bio', { name: formData.name, title: formData.title, company: formData.company });
            setFormData(prev => ({ ...prev, bio }));
        } catch (e) {
            alert("Failed to generate bio.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const success = await onSave(formData);
        if (success) onClose();
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSave}>
                    <h2 className="p-6 text-xl font-bold text-gray-900 dark:text-white border-b dark:border-gray-700">{isNew ? 'Add Speaker' : 'Edit Speaker'}</h2>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[70vh] overflow-y-auto">
                        <div className="md:col-span-1 space-y-4">
                            <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-center">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Profile Photo</label>
                                <ImageUpload label="" value={formData.photoUrl || ''} onChange={(url) => setFormData(prev => ({ ...prev, photoUrl: url }))} />
                            </div>
                        </div>
                        <div className="md:col-span-2 space-y-4">
                            <InputField label="Full Name" id="name" name="name" value={formData.name || ''} onChange={handleChange} required />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InputField label="Title" id="title" name="title" value={formData.title || ''} onChange={handleChange} placeholder="e.g. CEO" />
                                <InputField label="Company" id="company" name="company" value={formData.company || ''} onChange={handleChange} placeholder="e.g. Tech Corp" />
                            </div>
                             <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Biography</label>
                                    <button type="button" onClick={handleGenerateBio} disabled={isGenerating} className="text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                                        {isGenerating ? 'Generating...' : 'Generate Bio with AI ✨'}
                                    </button>
                                </div>
                                <textarea id="bio" name="bio" value={formData.bio || ''} onChange={handleChange} rows={5} className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-primary focus:border-primary"></textarea>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InputField label="LinkedIn URL" id="linkedinUrl" name="linkedinUrl" type="url" value={formData.linkedinUrl || ''} onChange={handleChange} placeholder="https://linkedin.com/in/..." />
                                <InputField label="Twitter URL" id="twitterUrl" name="twitterUrl" type="url" value={formData.twitterUrl || ''} onChange={handleChange} placeholder="https://twitter.com/..." />
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 border-t dark:border-gray-700">
                        <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
                        <button type="submit" disabled={isSaving} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center justify-center disabled:opacity-50 w-32">
                            {isSaving ? <><Spinner /> Saving...</> : 'Save Speaker'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
