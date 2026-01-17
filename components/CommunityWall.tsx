
import React, { useState, useEffect } from 'react';
import { getSocialPosts, createSocialPost } from '../server/api';
import { SocialPost } from '../types';
import { Spinner } from './Spinner';
import { ImageUpload } from './ImageUpload';
import { Alert } from './Alert';

export const CommunityWall: React.FC<{ delegateToken: string }> = ({ delegateToken }) => {
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [isPosting, setIsPosting] = useState(false);
    const [content, setContent] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [postType, setPostType] = useState<'social' | 'incident'>('social');
    const [loading, setLoading] = useState(true);

    const loadPosts = async () => {
        setLoading(true);
        const data = await getSocialPosts(delegateToken);
        setPosts(data.sort((a,b) => b.timestamp - a.timestamp));
        setLoading(false);
    };

    useEffect(() => {
        loadPosts();
    }, [delegateToken]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;
        setIsPosting(true);
        try {
            await createSocialPost(delegateToken, { content, imageUrl, type: postType });
            setContent('');
            setImageUrl('');
            loadPosts();
        } finally {
            setIsPosting(false);
        }
    };

    if (loading) return <Spinner />;

    return (
        <div className="max-w-3xl mx-auto space-y-10">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border dark:border-gray-700">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex gap-4">
                        <button 
                            type="button" 
                            onClick={() => setPostType('social')}
                            className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${postType === 'social' ? 'bg-primary text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700'}`}
                        >
                            Social Post
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setPostType('incident')}
                            className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${postType === 'incident' ? 'bg-red-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700'}`}
                        >
                            Report Incident
                        </button>
                    </div>
                    
                    <textarea 
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={postType === 'social' ? "Share your experience..." : "Describe the safety or technical issue..."}
                        className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border-none focus:ring-2 focus:ring-primary h-24"
                    />
                    
                    <div className="w-full">
                        <ImageUpload label="Add Photo" value={imageUrl} onChange={setImageUrl} />
                    </div>

                    <div className="flex justify-end">
                        <button 
                            type="submit" 
                            disabled={isPosting || !content.trim()}
                            className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-8 rounded-full shadow-lg disabled:opacity-50 transition-all flex items-center gap-2"
                        >
                            {isPosting ? <Spinner /> : null}
                            {postType === 'social' ? 'Post to Feed' : 'Report to Organizers'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="space-y-6">
                {posts.map(post => (
                    <div key={post.id} className={`bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-md border ${post.type === 'incident' ? 'border-red-500/50' : 'dark:border-gray-700'}`}>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                                {post.userName.charAt(0)}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold">{post.userName}</h4>
                                <p className="text-[10px] text-gray-500">{new Date(post.timestamp).toLocaleString()}</p>
                            </div>
                            {post.type === 'incident' && (
                                <div className="flex flex-col items-end">
                                    <span className="bg-red-100 text-red-800 text-[10px] font-black px-3 py-1 rounded-full uppercase">Incident</span>
                                    {post.incidentSeverity && (
                                        <span className={`text-[8px] font-bold mt-1 ${post.incidentSeverity === 'high' ? 'text-red-600' : 'text-yellow-600'}`}>
                                            SEVERITY: {post.incidentSeverity.toUpperCase()}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{post.content}</p>
                        
                        {post.imageUrl && (
                            <div className="rounded-2xl overflow-hidden border dark:border-gray-700">
                                <img src={post.imageUrl} className="w-full h-auto" alt="Post" />
                            </div>
                        )}

                        {post.type === 'incident' && post.incidentCategory && (
                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/50">
                                <p className="text-xs font-bold text-red-800 dark:text-red-400">AI Tag: {post.incidentCategory}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
