import React, { useState, useEffect } from 'react';
import { type MealPlan } from '../types';
import { Spinner } from './Spinner';
import { generateAiContent } from '../server/api';

interface MealPlanEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<MealPlan>) => Promise<boolean>;
    plan: MealPlan | null;
    adminToken: string;
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = (props) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{props.label}</label>
        <input {...props} className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
    </div>
);

export const MealPlanEditorModal: React.FC<MealPlanEditorModalProps> = ({ isOpen, onClose, onSave, plan, adminToken }) => {
    const [formData, setFormData] = useState<Partial<MealPlan>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const isNew = !plan;

    useEffect(() => {
        if (isOpen) {
            setFormData(plan ? { ...plan } : { name: '', description: '', dailyCost: 0 });
        }
    }, [isOpen, plan]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value, 10) : value }));
    };

    const handleGenerateDescription = async () => {
        if (!formData.name) {
            alert("Please enter a meal plan name first.");
            return;
        }
        setIsGenerating(true);
        try {
            const description = await generateAiContent(adminToken, 'meal_plan', { name: formData.name });
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
        setIsSaving(false);
        if (success) {
            onClose();
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSave}>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{isNew ? 'Add Meal Plan' : 'Edit Meal Plan'}</h2>
                    <div className="mt-6 space-y-4">
                        <InputField label="Plan Name" id="name" name="name" type="text" value={formData.name || ''} onChange={handleChange} placeholder="e.g., All-Inclusive" required />
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium">Description</label>
                            <textarea id="description" name="description" value={formData.description || ''} onChange={handleChange} rows={3} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm"></textarea>
                            <button type="button" onClick={handleGenerateDescription} disabled={isGenerating} className="mt-2 text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                                {isGenerating ? 'Generating...' : 'Generate with AI ✨'}
                            </button>
                        </div>
                         <InputField label="Daily Cost (in EventCoin)" id="dailyCost" name="dailyCost" type="number" value={formData.dailyCost || 0} onChange={handleChange} required />
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium">Cancel</button>
                        <button type="submit" disabled={isSaving} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center disabled:opacity-50">
                            {isSaving ? <><Spinner /> Saving...</> : 'Save Plan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
