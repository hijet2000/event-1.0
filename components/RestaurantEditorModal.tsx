import React, { useState, useEffect } from 'react';
import { type Restaurant } from '../types';
import { Spinner } from './Spinner';
import { generateAiContent } from '../server/api';

interface RestaurantEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Restaurant>) => Promise<boolean>;
    restaurant: Restaurant | null;
    adminToken: string;
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = (props) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{props.label}</label>
        <input {...props} className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
    </div>
);

export const RestaurantEditorModal: React.FC<RestaurantEditorModalProps> = ({ isOpen, onClose, onSave, restaurant, adminToken }) => {
    const [formData, setFormData] = useState<Partial<Restaurant>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const isNew = !restaurant;

    useEffect(() => {
        if (isOpen) {
            setFormData(restaurant ? { ...restaurant } : { name: '', cuisine: '', operatingHours: '', menu: '' });
        }
    }, [isOpen, restaurant]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleGenerateMenu = async () => {
        if (!formData.name || !formData.cuisine) {
            alert("Please enter a restaurant name and cuisine type first.");
            return;
        }
        setIsGenerating(true);
        try {
            const menu = await generateAiContent(adminToken, 'menu', { name: formData.name, cuisine: formData.cuisine });
            setFormData(prev => ({ ...prev, menu }));
        } catch(e) {
            alert("Failed to generate menu.");
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
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSave}>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{isNew ? 'Add Restaurant' : 'Edit Restaurant'}</h2>
                    <div className="mt-6 space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                        <InputField label="Restaurant Name" id="name" name="name" type="text" value={formData.name || ''} onChange={handleChange} required />
                        <InputField label="Cuisine Type" id="cuisine" name="cuisine" type="text" value={formData.cuisine || ''} onChange={handleChange} placeholder="e.g., Italian, Japanese" required />
                        <InputField label="Operating Hours" id="operatingHours" name="operatingHours" type="text" value={formData.operatingHours || ''} onChange={handleChange} placeholder="e.g., 7am - 10pm" />
                        <div>
                            <label htmlFor="menu" className="block text-sm font-medium">Menu</label>
                            <textarea id="menu" name="menu" value={formData.menu || ''} onChange={handleChange} rows={10} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm font-mono text-xs"></textarea>
                            <button type="button" onClick={handleGenerateMenu} disabled={isGenerating} className="mt-2 text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                                {isGenerating ? 'Generating...' : 'Generate Sample Menu with AI ✨'}
                            </button>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                        <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium">Cancel</button>
                        <button type="submit" disabled={isSaving} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center disabled:opacity-50">
                            {isSaving ? <><Spinner /> Saving...</> : 'Save Restaurant'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
