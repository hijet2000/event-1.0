
import React, { useState, useEffect } from 'react';
import { type Session, type Speaker } from '../types';
import { Spinner } from './Spinner';
import { generateAiContent } from '../server/api';
import { Alert } from './Alert';

interface SessionEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Session>) => Promise<boolean>;
    session: Session | null;
    adminToken: string;
    speakers: Speaker[];
    existingSessions?: Session[]; // For conflict detection
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <input {...props} className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-primary focus:border-primary" />
    </div>
);

export const SessionEditorModal: React.FC<SessionEditorModalProps> = ({ isOpen, onClose, onSave, session, adminToken, speakers, existingSessions = [] }) => {
    const [formData, setFormData] = useState<Partial<Session>>({});
    const [selectedSpeakerIds, setSelectedSpeakerIds] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [conflictWarning, setConflictWarning] = useState<string | null>(null);
    
    const isNew = !session;

    useEffect(() => {
        if (isOpen) {
            const initialData: Partial<Session> = session ? { ...session } : {
                title: '',
                description: '',
                startTime: '',
                endTime: '',
                location: '',
                track: '',
                capacity: 0,
                speakerIds: [],
            };
            setFormData(initialData);
            setSelectedSpeakerIds(new Set(initialData.speakerIds || []));
            setConflictWarning(null);
        }
    }, [isOpen, session]);

    // Conflict Detection Logic
    useEffect(() => {
        if (!formData.startTime || !formData.endTime || !formData.location) {
            setConflictWarning(null);
            return;
        }
        
        const start = new Date(formData.startTime).getTime();
        const end = new Date(formData.endTime).getTime();
        
        if (start >= end) return; // Invalid dates handled by validation later

        const conflicts = existingSessions.filter(s => {
            if (s.id === session?.id) return false; // Don't check against self
            if (s.location.toLowerCase() !== formData.location?.toLowerCase()) return false;
            
            const sStart = new Date(s.startTime).getTime();
            const sEnd = new Date(s.endTime).getTime();
            
            // Check overlap
            return (start < sEnd && end > sStart);
        });

        if (conflicts.length > 0) {
            setConflictWarning(`Location "${formData.location}" is booked during this time by: ${conflicts.map(s => `"${s.title}"`).join(', ')}`);
        } else {
            setConflictWarning(null);
        }

    }, [formData.startTime, formData.endTime, formData.location, existingSessions, session]);


    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: type === 'number' ? (parseInt(value) || 0) : value 
        }));
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
        if (!formData.title) {
            alert("Please provide a session title.");
            return;
        }
        setIsGenerating(true);
        try {
            const description = await generateAiContent('session', { title: formData.title, speakers: speakerNames || 'industry experts' });
            setFormData(prev => ({ ...prev, description }));
        } catch (e) {
            alert("Failed to generate description.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (new Date(formData.startTime!) >= new Date(formData.endTime!)) {
            alert("End time must be after start time.");
            return;
        }

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
                        {conflictWarning && <Alert type="warning" message={conflictWarning} />}
                        
                        <InputField label="Session Title" id="title" name="title" type="text" value={formData.title || ''} onChange={handleChange} required />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <InputField label="Track / Category" id="track" name="track" type="text" value={formData.track || ''} onChange={handleChange} placeholder="e.g. Workshop, Main Stage" />
                             <InputField label="Capacity" id="capacity" name="capacity" type="number" value={formData.capacity || 0} onChange={handleChange} placeholder="0 for unlimited" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Start Time" id="startTime" name="startTime" type="datetime-local" value={formatDateTimeLocal(formData.startTime)} onChange={handleChange} required />
                            <InputField label="End Time" id="endTime" name="endTime" type="datetime-local" value={formatDateTimeLocal(formData.endTime)} onChange={handleChange} required />
                        </div>
                        <InputField label="Location" id="location" name="location" type="text" value={formData.location || ''} onChange={handleChange} placeholder="e.g., Main Hall" required />
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                            <textarea id="description" name="description" value={formData.description || ''} onChange={handleChange} rows={4} className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-primary focus:border-primary"></textarea>
                            <button type="button" onClick={handleGenerateDescription} disabled={isGenerating} className="mt-2 text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                                {isGenerating ? 'Generating...' : 'Generate with AI ✨'}
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Speakers</label>
                            <div className="max-h-40 overflow-y-auto p-2 border border-gray-300 dark:border-gray-600 rounded-md space-y-2 bg-gray-50 dark:bg-gray-700/50">
                                {speakers.length > 0 ? speakers.map(speaker => (
                                    <label key={speaker.id} className="flex items-center space-x-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 p-1 rounded">
                                        <input type="checkbox" checked={selectedSpeakerIds.has(speaker.id)} onChange={() => handleSpeakerChange(speaker.id)} className="rounded text-primary focus:ring-primary" />
                                        <div className="flex items-center">
                                            {speaker.photoUrl && <img src={speaker.photoUrl} alt="" className="w-6 h-6 rounded-full mr-2 object-cover" />}
                                            <span className="text-sm text-gray-700 dark:text-gray-200">{speaker.name}</span>
                                        </div>
                                    </label>
                                )) : <p className="text-xs text-gray-500 italic p-1">No speakers added yet.</p>}
                            </div>
                        </div>

                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 border-t dark:border-gray-700">
                        <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
                        <button type="submit" disabled={isSaving} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center disabled:opacity-50 w-32 justify-center">
                            {isSaving ? <><Spinner /> Saving...</> : 'Save Session'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
