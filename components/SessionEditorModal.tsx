
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
    const [conflicts, setConflicts] = useState<string[]>([]);
    const [forceSchedule, setForceSchedule] = useState(false);
    
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
            setConflicts([]);
            setForceSchedule(false);
        }
    }, [isOpen, session]);

    // Enhanced Conflict Detection Logic
    useEffect(() => {
        if (!formData.startTime || !formData.endTime) {
            setConflicts([]);
            return;
        }
        
        const start = new Date(formData.startTime).getTime();
        const end = new Date(formData.endTime).getTime();
        
        if (start >= end) return; // Invalid dates handled by validation later

        const currentConflicts: string[] = [];

        existingSessions.forEach(s => {
            if (s.id === session?.id) return; // Don't check against self
            
            const sStart = new Date(s.startTime).getTime();
            const sEnd = new Date(s.endTime).getTime();
            
            // Check overlap: (StartA < EndB) and (EndA > StartB)
            if (start < sEnd && end > sStart) {
                
                // 1. Check Location Conflict
                if (formData.location && s.location && s.location.toLowerCase().trim() === formData.location.toLowerCase().trim()) {
                    currentConflicts.push(`Room "${s.location}" is already booked by "${s.title}" (${new Date(s.startTime).toLocaleTimeString()} - ${new Date(s.endTime).toLocaleTimeString()}).`);
                }

                // 2. Check Speaker Conflict
                if (s.speakerIds && s.speakerIds.length > 0) {
                    const overlappingSpeakers = s.speakerIds.filter(id => selectedSpeakerIds.has(id));
                    if (overlappingSpeakers.length > 0) {
                        const names = overlappingSpeakers.map(id => speakers.find(spk => spk.id === id)?.name || 'Unknown').join(', ');
                        currentConflicts.push(`Speaker(s) ${names} are already presenting at "${s.title}" during this time.`);
                    }
                }
            }
        });

        setConflicts(currentConflicts);
        
        // Reset force schedule if conflicts are resolved
        if (currentConflicts.length === 0) {
            setForceSchedule(false);
        }

    }, [formData.startTime, formData.endTime, formData.location, selectedSpeakerIds, existingSessions, session, speakers]);


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

        if (conflicts.length > 0 && !forceSchedule) {
            alert("Please resolve scheduling conflicts or select 'Ignore Conflicts' to proceed.");
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
                        
                        {/* Conflict Warning Area */}
                        {conflicts.length > 0 && (
                            <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 animate-fade-in">
                                <div className="flex items-start">
                                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Scheduling Conflict Detected</h3>
                                        <ul className="mt-2 text-sm text-red-700 dark:text-red-300 list-disc list-inside space-y-1">
                                            {conflicts.map((c, i) => <li key={i}>{c}</li>)}
                                        </ul>
                                        <div className="mt-3">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={forceSchedule} 
                                                    onChange={e => setForceSchedule(e.target.checked)}
                                                    className="rounded border-red-300 text-red-600 focus:ring-red-500" 
                                                />
                                                <span className="text-sm font-medium text-red-800 dark:text-red-200">Ignore conflicts and force schedule</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        
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
                        <button 
                            type="submit" 
                            disabled={isSaving || (conflicts.length > 0 && !forceSchedule)} 
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center disabled:opacity-50 disabled:cursor-not-allowed w-32 justify-center transition-colors"
                        >
                            {isSaving ? <><Spinner /> Saving...</> : 'Save Session'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
