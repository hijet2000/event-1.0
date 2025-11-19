import React, { useState, useEffect } from 'react';
import { type Session, type Speaker } from '../types';
import { Spinner } from './Spinner';
import { generateAiContent } from '../server/api';

interface SessionEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Session>) => Promise<boolean>;
    session: Session | null;
    adminToken: string;
    speakers: Speaker[];
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <input {...props} className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
    </div>
);

export const SessionEditorModal: React.FC<SessionEditorModalProps> = ({ isOpen, onClose, onSave, session, adminToken, speakers }) => {
    const [formData, setFormData] = useState<Partial<Session>>({});
    const [selectedSpeakerIds, setSelectedSpeakerIds] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const isNew = !session;

    useEffect(() => {
        if (isOpen) {
            const initialData: Partial<Session> = session ? { ...session } : {
                title: '',
                description: '',
                startTime: '',
                endTime: '',
                location: '',
                speakerIds: [],
            };
            setFormData(initialData);
            setSelectedSpeakerIds(new Set(initialData.speakerIds || []));
        }
    }, [isOpen, session]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSpeakerChange = (speakerId: string) => {
        setSelectedSpeakerIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(speakerId)) {
                newSet.delete(speakerId);
            } else {
                newSet.add(speakerId);
            }
            return newSet;
        });
    };

    const handleGenerateDescription = async () => {
        const speakerNames = speakers.filter(s => selectedSpeakerIds.has(s.id)).map(s => s.name).join(', ');
        if (!formData.title || !speakerNames) {
            alert("Please provide a session title and select at least one speaker.");
            return;
        }
        setIsGenerating(true);
        try {
            const description = await generateAiContent('session', { title: formData.title, speakers: speakerNames });
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
        const finalData = {
            ...formData,
            speakerIds: Array.from(selectedSpeakerIds),
            startTime: formData.startTime ? new Date(formData.startTime).toISOString() : undefined,
            endTime: formData.endTime ? new Date(formData.endTime).toISOString() : undefined,
        };
        const success = await onSave(finalData);
        if (success) onClose();
        setIsSaving(false);
    };
    
    const formatDateTimeLocal = (isoString?: string) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        // Adjust for timezone offset to display correctly in the input
        const adjustedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        return adjustedDate.toISOString().slice(0, 16);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSave}>
                    <h2 className="p-6 text-xl font-bold text-gray-900 dark:text-white border-b dark:border-gray-700">{isNew ? 'Add Session' : 'Edit Session'}</h2>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        <InputField label="Session Title" id="title" name="title" type="text" value={formData.title || ''} onChange={handleChange} required />
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                            <textarea id="description" name="description" value={formData.description || ''} onChange={handleChange} rows={4} className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
                            <button type="button" onClick={handleGenerateDescription} disabled={isGenerating} className="mt-2 text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                                {isGenerating ? 'Generating...' : 'Generate with AI ✨'}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Start Time" id="startTime" name="startTime" type="datetime-local" value={formatDateTimeLocal(formData.startTime)} onChange={handleChange} required />
                            <InputField label="End Time" id="endTime" name="endTime" type="datetime-local" value={formatDateTimeLocal(formData.endTime)} onChange={handleChange} required />
                        </div>
                        <InputField label="Location" id="location" name="location" type="text" value={formData.location || ''} onChange={handleChange} placeholder="e.g., Main Hall" required />
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Speakers</label>
                            <div className="max-h-32 overflow-y-auto p-2 border border-gray-300 dark:border-gray-600 rounded-md space-y-1">
                                {speakers.map(speaker => (
                                    <label key={speaker.id} className="flex items-center space-x-2">
                                        <input type="checkbox" checked={selectedSpeakerIds.has(speaker.id)} onChange={() => handleSpeakerChange(speaker.id)} className="rounded text-primary focus:ring-primary" />
                                        <span>{speaker.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 border-t dark:border-gray-700">
                        <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium">Cancel</button>
                        <button type="submit" disabled={isSaving} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center disabled:opacity-50">
                            {isSaving ? <><Spinner /> Saving...</> : 'Save Session'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};