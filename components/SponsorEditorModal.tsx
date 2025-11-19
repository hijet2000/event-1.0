import React, { useState, useEffect } from 'react';
import { type Sponsor, SPONSORSHIP_TIERS } from '../types';
import { Spinner } from './Spinner';
import { generateAiContent } from '../server/api';
import { ImageUpload } from './ImageUpload';

interface SponsorEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Sponsor>) => Promise<boolean>;
    sponsor: Sponsor | null;
    adminToken: string;
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <input {...props} className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
    </div>
);

export const SponsorEditorModal: React.FC<SponsorEditorModalProps> = ({ isOpen, onClose, onSave, sponsor, adminToken }) => {
    const [formData, setFormData] = useState<Partial<Sponsor>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const isNew = !sponsor;

    useEffect(() => {
        if (isOpen) {
            setFormData(sponsor ? { ...sponsor } : {
                id: `sponsor_${Date.now().toString(36)}_${Math.random().toString(36).substring(2)}`,
                name: '',
                description: '',
                websiteUrl: '',
                logoUrl: '',
                tier: 'Bronze',
            });
        }
    }, [isOpen, sponsor]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateDescription = async () => {
        if (!formData.name || !formData.websiteUrl) {
            alert("Please provide sponsor name and website URL first.");
            return;
        }
        setIsGenerating(true);
        try {
            const description = await generateAiContent('sponsor_description', { name: formData.name, websiteUrl: formData.websiteUrl });
            setFormData(prev => ({ ...prev, description }));
        } catch (e) {
            alert("Failed to generate description.");
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSave}>
                    <h2 className="p-6 text-xl font-bold text-gray-900 dark:text-white border-b dark:border-gray-700">{isNew ? 'Add Sponsor' : 'Edit Sponsor'}</h2>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[70vh] overflow-y-auto">
                        <div className="md:col-span-1">
                            <ImageUpload label="Logo" value={formData.logoUrl || ''} onChange={(url) => setFormData(prev => ({ ...prev, logoUrl: url }))} />
                        </div>
                        <div className="md:col-span-2 space-y-4">
                            <InputField label="Sponsor Name" id="name" name="name" value={formData.name || ''} onChange={handleChange} required />
                            <InputField label="Website URL" id="websiteUrl" name="websiteUrl" type="url" value={formData.websiteUrl || ''} onChange={handleChange} required />
                            <div>
                                <label htmlFor="tier" className="block text-sm font-medium">Sponsorship Tier</label>
                                <select id="tier" name="tier" value={formData.tier} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm">
                                    {SPONSORSHIP_TIERS.map(tier => <option key={tier} value={tier}>{tier}</option>)}
                                </select>
                            </div>
                             <div>
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                <textarea id="description" name="description" value={formData.description || ''} onChange={handleChange} rows={4} className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
                                <button type="button" onClick={handleGenerateDescription} disabled={isGenerating} className="mt-2 text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                                    {isGenerating ? 'Generating...' : 'Generate with AI ✨'}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 border-t dark:border-gray-700">
                        <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium">Cancel</button>
                        <button type="submit" disabled={isSaving} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center disabled:opacity-50">
                            {isSaving ? <><Spinner /> Saving...</> : 'Save Sponsor'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};