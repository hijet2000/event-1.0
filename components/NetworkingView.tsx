
import React, { useState, useEffect } from 'react';
import { getMyNetworkingProfile, updateNetworkingProfile, getNetworkingCandidates } from '../server/api';
import { type NetworkingProfile, type NetworkingMatch } from '../types';
import { Spinner } from './Spinner';
import { Alert } from './Alert';
import { ContentLoader } from './ContentLoader';

interface NetworkingViewProps {
  delegateToken: string;
}

const ProfileEditor: React.FC<{ profile: NetworkingProfile, onSave: (p: Partial<NetworkingProfile>) => Promise<void> }> = ({ profile, onSave }) => {
    const [formData, setFormData] = useState(profile);
    const [isSaving, setIsSaving] = useState(false);
    const [tagInput, setTagInput] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!formData.interests.includes(tagInput.trim())) {
                setFormData(prev => ({ ...prev, interests: [...prev.interests, tagInput.trim()] }));
            }
            setTagInput('');
        }
    };

    const removeTag = (tag: string) => {
        setFormData(prev => ({ ...prev, interests: prev.interests.filter(t => t !== tag) }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave(formData);
        setIsSaving(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold">Your Networking Profile</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Job Title</label>
                    <input type="text" name="jobTitle" value={formData.jobTitle} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Company</label>
                    <input type="text" name="company" value={formData.company} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Short Bio</label>
                <textarea name="bio" value={formData.bio} onChange={handleChange} rows={3} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" placeholder="What do you do? What are you passionate about?" required />
            </div>
             <div>
                <label className="block text-sm font-medium mb-1">What are you looking for?</label>
                <select name="lookingFor" value={formData.lookingFor} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                    <option value="">Select...</option>
                    <option value="Networking">General Networking</option>
                    <option value="Hiring">Hiring Talent</option>
                    <option value="Job Seeking">Looking for a Job</option>
                    <option value="Mentorship">Seeking Mentorship</option>
                    <option value="Investing">Investors / Funding</option>
                    <option value="Partnerships">Business Partnerships</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Interests / Skills (Press Enter to add)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                    {formData.interests.map(tag => (
                        <span key={tag} className="bg-primary/10 text-primary px-2 py-1 rounded-full text-sm flex items-center">
                            {tag}
                            <button type="button" onClick={() => removeTag(tag)} className="ml-1 hover:text-red-500">&times;</button>
                        </span>
                    ))}
                </div>
                <input 
                    type="text" 
                    value={tagInput} 
                    onChange={e => setTagInput(e.target.value)} 
                    onKeyDown={handleAddTag}
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                    placeholder="e.g. AI, Marketing, Golf..." 
                />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">LinkedIn URL</label>
                <input type="url" name="linkedinUrl" value={formData.linkedinUrl} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
            </div>
             <div className="flex items-center">
                 <input type="checkbox" id="isVisible" name="isVisible" checked={formData.isVisible} onChange={e => setFormData(prev => ({ ...prev, isVisible: e.target.checked }))} className="h-4 w-4 text-primary rounded" />
                 <label htmlFor="isVisible" className="ml-2 block text-sm">Visible to other attendees</label>
            </div>
            <div className="flex justify-end">
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50">
                    {isSaving ? <Spinner /> : 'Save Profile'}
                </button>
            </div>
        </form>
    );
};

const MatchCard: React.FC<{ match: NetworkingMatch }> = ({ match }) => {
    let scoreColor = 'bg-gray-100 text-gray-800';
    if (match.score >= 80) scoreColor = 'bg-green-100 text-green-800';
    else if (match.score >= 50) scoreColor = 'bg-yellow-100 text-yellow-800';

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="p-4 flex items-start justify-between">
                <div>
                    <h4 className="font-bold text-lg">{match.name}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{match.jobTitle} @ {match.company}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${scoreColor}`}>
                    {match.score}% Match
                </span>
            </div>
            <div className="px-4 pb-2">
                 <div className="flex flex-wrap gap-1 mb-3">
                    {match.profile.interests.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{tag}</span>
                    ))}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/20 p-2 rounded italic mb-2">
                    "{match.reason}"
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    <strong>Icebreaker:</strong> {match.icebreaker}
                </p>
            </div>
            <div className="mt-auto p-4 border-t dark:border-gray-700 flex justify-between items-center">
                 <span className="text-xs text-gray-500">{match.profile.lookingFor}</span>
                 {match.profile.linkedinUrl && (
                     <a href={match.profile.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">Connect on LinkedIn</a>
                 )}
            </div>
        </div>
    );
};

export const NetworkingView: React.FC<NetworkingViewProps> = ({ delegateToken }) => {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<NetworkingProfile | null>(null);
    const [matches, setMatches] = useState<NetworkingMatch[]>([]);
    const [allCandidates, setAllCandidates] = useState<NetworkingProfile[]>([]);
    const [activeTab, setActiveTab] = useState<'matches' | 'directory' | 'profile'>('matches');
    const [directoryFilter, setDirectoryFilter] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const myProfile = await getMyNetworkingProfile(delegateToken);
            setProfile(myProfile);

            if (myProfile && myProfile.isVisible) {
                const results = await getNetworkingCandidates(delegateToken);
                setMatches(results.matches);
                setAllCandidates(results.allCandidates);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [delegateToken]);

    const handleSaveProfile = async (updated: Partial<NetworkingProfile>) => {
        await updateNetworkingProfile(delegateToken, updated);
        await loadData();
        if (activeTab === 'profile') setActiveTab('matches');
    };

    const handleOptIn = async () => {
        const emptyProfile: Partial<NetworkingProfile> = { 
            isVisible: true,
            interests: [],
            lookingFor: 'Networking'
        };
        await updateNetworkingProfile(delegateToken, emptyProfile);
        await loadData();
        setActiveTab('profile'); // Send them to edit profile first
    };

    if (loading) return <ContentLoader text="Loading Networking Hub..." />;

    if (!profile) {
        return (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-2xl mx-auto">
                <div className="mb-6 flex justify-center">
                    <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.274-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.274.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
                </div>
                <h2 className="text-3xl font-bold mb-4">Join the Community</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-md mx-auto">
                    Opt-in to our Networking Hub to find attendees with similar interests, get AI-powered match recommendations, and grow your professional network.
                </p>
                <button onClick={handleOptIn} className="px-8 py-3 bg-primary text-white rounded-full font-semibold shadow-lg hover:bg-primary/90 hover:shadow-xl transition-all">
                    Create Networking Profile
                </button>
            </div>
        );
    }

    const filteredDirectory = allCandidates.filter(c => 
        (c as any).name?.toLowerCase().includes(directoryFilter.toLowerCase()) ||
        c.company.toLowerCase().includes(directoryFilter.toLowerCase()) ||
        c.interests.some(i => i.toLowerCase().includes(directoryFilter.toLowerCase()))
    );

    return (
        <div className="min-h-[600px]">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Networking Hub</h2>
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('matches')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'matches' ? 'bg-white dark:bg-gray-600 shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}>Matches</button>
                    <button onClick={() => setActiveTab('directory')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'directory' ? 'bg-white dark:bg-gray-600 shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}>Directory</button>
                    <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'profile' ? 'bg-white dark:bg-gray-600 shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}>My Profile</button>
                </div>
            </div>

            {activeTab === 'matches' && (
                <div>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Our AI has analyzed the profiles of other attendees to find the best professional connections for you.
                    </p>
                    {matches.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {matches.map(match => <MatchCard key={match.userId} match={match} />)}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            <p className="text-gray-500">No strong matches found yet. Try updating your interests or check back later as more people join!</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'directory' && (
                <div>
                    <div className="mb-6">
                        <input 
                            type="text" 
                            placeholder="Search by name, company, or interest..." 
                            value={directoryFilter}
                            onChange={e => setDirectoryFilter(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary dark:bg-gray-700"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {filteredDirectory.map(c => (
                            <div key={c.userId} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                                <h4 className="font-bold">{(c as any).name}</h4>
                                <p className="text-xs text-gray-500 mb-2">{c.jobTitle} @ {c.company}</p>
                                <div className="flex flex-wrap gap-1 mb-3">
                                    {c.interests.slice(0, 3).map(tag => (
                                        <span key={tag} className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{tag}</span>
                                    ))}
                                </div>
                                {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">View LinkedIn</a>}
                            </div>
                        ))}
                        {filteredDirectory.length === 0 && <p className="col-span-full text-center text-gray-500 py-8">No attendees found.</p>}
                    </div>
                </div>
            )}

            {activeTab === 'profile' && (
                <div className="max-w-2xl mx-auto">
                    <ProfileEditor profile={profile} onSave={handleSaveProfile} />
                </div>
            )}
        </div>
    );
};
