
import { 
    RegistrationData, Permission, DashboardStats, AdminUser, Role, Task, 
    EventConfig, MealPlan, Restaurant, Session, Speaker, Sponsor,
    Hotel, HotelRoom, RoomType, AccommodationBooking, DiningReservation,
    EventCoinStats, Transaction, DelegateProfile, MealPlanAssignment,
    HotelRoomStatus, AccommodationBookingStatus, PublicEvent, EventData,
    MealType, EnrichedAccommodationBooking, EmailPayload, NetworkingProfile, NetworkingMatch, SessionFeedback,
    ScavengerHuntItem
} from '../types';
import { 
    findAll, find, insert, update, remove, count, updateWhere, removeWhere 
} from './db';
import { db } from './store'; 
import { generateToken, comparePassword, hashPassword, verifyToken } from './auth';
import { defaultConfig } from './config';
import { 
    generateRegistrationEmails, generatePasswordResetEmail, 
    generateDelegateInvitationEmail, generateDelegateUpdateEmail,
    generateAiContent as geminiGenerateAiContent,
    generateImage as geminiGenerateImage,
    generateMarketingVideo as geminiGenerateMarketingVideo,
    generateNetworkingMatches as geminiGenerateNetworkingMatches,
    summarizeSessionFeedback as geminiSummarizeSessionFeedback
} from './geminiService';
import { sendEmail } from './email';
import { uploadFileToStorage as mockUpload, saveGeneratedImageToStorage, MediaItem } from './storage';

// --- CONFIGURATION ---
export const USE_REAL_API = false; 
const API_BASE_URL = 'http://localhost:3001/api';

// --- API Client Helper ---
async function apiFetch<T>(endpoint: string, method: string = 'GET', body?: any, token?: string): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!USE_REAL_API && token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            credentials: USE_REAL_API ? 'include' : undefined // Important: Sends cookies to backend
        });

        if (res.status === 401 && USE_REAL_API) {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('adminToken');
                localStorage.removeItem('delegateToken');
                window.location.href = '/';
            }
            throw new Error("Session expired");
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'API Request Failed');
        return data as T;
    } catch (error) {
        console.error(`API Error [${method} ${endpoint}]:`, error);
        throw error;
    }
}

// Re-export for components
export const generateAiContent = geminiGenerateAiContent;
export const generateImage = geminiGenerateImage;
export const generateMarketingVideo = geminiGenerateMarketingVideo;
export const saveGeneratedImage = saveGeneratedImageToStorage;
export type { MediaItem };

// --- Media ---
export const uploadFile = async (file: File): Promise<MediaItem> => {
    if (USE_REAL_API) {
         return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64String = reader.result as string;
                try {
                    // In production, send to /api/media/upload
                    const newItem = await apiFetch<MediaItem>('/media/upload', 'POST', {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        url: base64String
                    });
                    resolve(newItem);
                } catch (e) { reject(e); }
            };
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
        });
    }
    return mockUpload(file);
};

export const getMediaLibrary = async (adminToken: string): Promise<MediaItem[]> => {
    if (USE_REAL_API) return await apiFetch('/media', 'GET', undefined, adminToken);
    const media = await findAll('media');
    return media.sort((a: any, b: any) => b.uploadedAt - a.uploadedAt);
};
export const deleteMedia = async (adminToken: string, id: string): Promise<void> => {
    if (USE_REAL_API) await apiFetch(`/media/${id}`, 'DELETE', undefined, adminToken);
    else await remove('media', id);
};

const MAIN_EVENT_ID = 'main-event';

// --- Internal Helpers ---
const logEmailCommunication = async (payload: EmailPayload, status: 'sent' | 'failed', error?: string) => {
    if (!USE_REAL_API) {
        await insert('emailLogs', {
            id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            to: payload.to,
            subject: payload.subject,
            body: payload.body,
            timestamp: Date.now(),
            status,
            error
        });
    }
};

// --- System & Database ---
export const getDatabaseSchema = async (adminToken: string): Promise<string> => {
    return `-- PostgreSQL Schema for Event Platform\n\nCREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n\n-- (Complete schema definition hidden for brevity)`;
};

export const generateSqlExport = async (adminToken: string): Promise<string> => {
    let sql = `-- Data Export Generated at ${new Date().toISOString()}\n\n`;
    const esc = (val: any) => val === null || val === undefined ? 'NULL' : (typeof val === 'number' || typeof val === 'boolean' ? val : `'${String(val).replace(/'/g, "''")}'`);
    if (db.registrations) {
        sql += `-- Registrations\n`;
        db.registrations.forEach((r: any) => sql += `INSERT INTO registrations (id, name, email) VALUES (${esc(r.id)}, ${esc(r.name)}, ${esc(r.email)});\n`);
    }
    return sql;
};

// --- Auth ---
export const loginAdmin = async (email: string, password: string): Promise<{ token: string; user: { id: string; email: string; permissions: Permission[] } } | null> => {
    if (USE_REAL_API) {
        try { 
            const res = await apiFetch<{ user: any, message: string }>('/login/admin', 'POST', { email, password }); 
            const uiToken = generateToken({ id: res.user.id, email: res.user.email, permissions: res.user.permissions, type: 'admin' });
            return { token: uiToken, user: res.user };
        } catch (e) { return null; }
    }
    const user = await find('adminUsers', (u: any) => u.email === email);
    if (!user) return null;
    if (await comparePassword(password, user.passwordHash)) {
        const role = await find('roles', (r: any) => r.id === user.roleId);
        const permissions = role ? role.permissions : [];
        const token = generateToken({ id: user.id, email: user.email, permissions, type: 'admin' });
        return { token, user: { id: user.id, email: user.email, permissions } };
    }
    return null;
};

export const loginDelegate = async (eventId: string, email: string, password: string): Promise<{ token: string } | null> => {
    if (USE_REAL_API) {
        try { 
            const res = await apiFetch<{ user: any, success: boolean }>('/login/delegate', 'POST', { eventId, email, password }); 
            const uiToken = generateToken({ id: res.user.id, email: res.user.email, eventId: eventId, type: 'delegate' });
            return { token: uiToken };
        } catch (e) { return null; }
    }
    const user = await find('registrations', (u: any) => u.email === email && u.eventId === eventId);
    if (user && user.passwordHash && await comparePassword(password, user.passwordHash)) {
         const token = generateToken({ id: user.id, email: user.email, type: 'delegate', eventId });
         return { token };
    }
    return null;
};

export const requestAdminPasswordReset = async (email: string): Promise<void> => {
    if (USE_REAL_API) { await apiFetch('/auth/forgot-password', 'POST', { email, type: 'admin' }); return; }
    const user = await find('adminUsers', (u: any) => u.email === email);
    if (user) await logEmailCommunication({ to: email, subject: 'Admin Password Reset', body: 'Link...' }, 'sent');
};

export const requestDelegatePasswordReset = async (eventId: string, email: string): Promise<void> => {
     if (USE_REAL_API) { await apiFetch('/auth/forgot-password', 'POST', { email, eventId, type: 'delegate' }); return; }
     const user = await find('registrations', (u: any) => u.email === email && u.eventId === eventId);
     if (user) {
         const config = await getEventConfig();
         const resetToken = `reset_${Date.now()}_${user.id}`;
         await insert('passwordResetTokens', { token: resetToken, userId: user.id, expiry: Date.now() + 3600000 });
         const resetLink = `${config.event.publicUrl}/${eventId}?resetToken=${resetToken}`;
         try {
            const emailContent = await generatePasswordResetEmail(config, resetLink);
            await sendEmail({ to: email, ...emailContent }, config);
            await logEmailCommunication({ to: email, ...emailContent }, 'sent');
         } catch (e) { /* ignore */ }
     }
};

export const resetPassword = async (token: string, newPassword: string): Promise<void> => {
    if (USE_REAL_API) { await apiFetch('/auth/reset-password', 'POST', { token, newPassword }); return; }
    const resetRecord = await find('passwordResetTokens', (t: any) => t.token === token && t.expiry > Date.now());
    if (!resetRecord) throw new Error("Invalid or expired reset token.");
    const passwordHash = await hashPassword(newPassword);
    let user = await update('adminUsers', resetRecord.userId, { passwordHash });
    if (!user) user = await update('registrations', resetRecord.userId, { passwordHash });
    if (!user) throw new Error("User not found.");
    await remove('passwordResetTokens', resetRecord.id);
};

// --- Events ---
export const listPublicEvents = async (): Promise<PublicEvent[]> => {
    if (USE_REAL_API) return await apiFetch<PublicEvent[]>('/events');
    const events = await findAll('events');
    return events.map((e: any) => ({
        id: e.id,
        name: e.config?.event?.name || 'Untitled Event',
        date: e.config?.event?.date || '',
        location: e.config?.event?.location || '',
        logoUrl: e.config?.theme?.logoUrl || '',
        colorPrimary: e.config?.theme?.colorPrimary || '#4f46e5'
    }));
};

export const getPublicEventData = async (eventId: string): Promise<{ config: EventConfig; registrationCount: number; sessions: Session[]; speakers: Speaker[]; sponsors: Sponsor[] }> => {
    if (USE_REAL_API) return await apiFetch(`/events/${eventId}`);
    if (!eventId) throw new Error("Event ID is required");
    
    let event;
    try {
        event = await find('events', (e: any) => e.id === eventId);
    } catch (e) {
        // Ignore find error
    }
    
    // Auto-seed main-event if missing to ensure app works out of the box
    if (!event && eventId === MAIN_EVENT_ID) {
        const newEvent = { id: MAIN_EVENT_ID, config: defaultConfig };
        try {
             await insert('events', newEvent);
             event = newEvent;
        } catch (e) {
             // Return default if insertion fails
             return { config: defaultConfig, registrationCount: 0, sessions: [], speakers: [], sponsors: [] };
        }
    }

    if (!event) {
         // Graceful fallback for main-event to prevent crashes
         if (eventId === MAIN_EVENT_ID) {
             return { config: defaultConfig, registrationCount: 0, sessions: [], speakers: [], sponsors: [] };
         }
         throw new Error("Event not found");
    }

    // Safely get config or fallback to default if data is corrupted
    const config = (event.config && event.config.event) ? event.config : defaultConfig;

    const registrationCount = await count('registrations', (r: any) => r.eventId === eventId);
    const sessions = await findAll('sessions');
    const speakers = await findAll('speakers');
    const sponsors = await findAll('sponsors');
    return { config, registrationCount, sessions, speakers, sponsors };
};

export const getEventConfig = async (): Promise<EventConfig> => {
    if (USE_REAL_API) { const data = await getPublicEventData(MAIN_EVENT_ID); return data.config; }
    const event = await find('events', (e: any) => e.id === MAIN_EVENT_ID);
    return (event && event.config) ? event.config : defaultConfig;
};

export const saveConfig = async (adminToken: string, config: EventConfig): Promise<EventConfig> => {
    if (USE_REAL_API) return await apiFetch(`/events/${MAIN_EVENT_ID}/config`, 'PUT', { config }, adminToken);
    const event = await find('events', (e: any) => e.id === MAIN_EVENT_ID);
    if (event) await update('events', MAIN_EVENT_ID, { config });
    else await insert('events', { id: MAIN_EVENT_ID, config });
    return config;
};

export const syncConfigFromGitHub = async (adminToken: string): Promise<EventConfig> => {
    const currentConfig = await getEventConfig();
    if (!currentConfig.githubSync.enabled || !currentConfig.githubSync.configUrl) throw new Error("GitHub sync disabled.");
    try {
        const response = await fetch(currentConfig.githubSync.configUrl);
        if (!response.ok) throw new Error("GitHub fetch failed");
        const newConfig = await response.json();
        const merged = { ...currentConfig, ...newConfig, githubSync: { ...currentConfig.githubSync, lastSyncTimestamp: Date.now(), lastSyncStatus: 'success', lastSyncMessage: 'Synced.' } };
        await saveConfig(adminToken, merged);
        return merged;
    } catch (e) { throw e; }
};

export const createEvent = async (adminToken: string, name: string, type: string): Promise<EventData> => {
    if (USE_REAL_API) return await apiFetch('/events', 'POST', { name, eventType: type, config: defaultConfig }, adminToken);
    const newId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const config = JSON.parse(JSON.stringify(defaultConfig));
    config.event.name = name;
    config.event.eventType = type;
    const newEvent = { id: newId, name, config };
    await insert('events', newEvent);
    return newEvent;
};

// --- Registrations ---
export const registerUser = async (eventId: string, data: RegistrationData, inviteToken?: string): Promise<{ success: boolean; message: string }> => {
    if (USE_REAL_API) {
        try {
            const res = await apiFetch<{success: boolean, message: string}>('/registrations', 'POST', { eventId, data, inviteToken });
            return res;
        } catch (e) { return { success: false, message: e instanceof Error ? e.message : 'Registration failed' }; }
    }
    const existing = await find('registrations', (r: any) => r.email === data.email && r.eventId === eventId);
    if (existing) return { success: false, message: "Email already registered." };
    const passwordHash = data.password ? await hashPassword(data.password) : undefined;
    const newRegistration = { ...data, id: `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, eventId, createdAt: Date.now(), passwordHash, verified: false, checkedIn: false };
    delete newRegistration.password;
    await insert('registrations', newRegistration);
    const config = await getEventConfig();
    if (config.eventCoin.enabled && config.eventCoin.startingBalance > 0) {
        await insert('transactions', { id: `tx_init_${newRegistration.id}`, fromId: 'system', fromName: 'System', fromEmail: 'system', toId: newRegistration.id, toName: newRegistration.name, toEmail: newRegistration.email, amount: config.eventCoin.startingBalance, message: 'Welcome Bonus', type: 'initial', timestamp: Date.now() });
    }
    return { success: true, message: "Registration successful." };
};

export const triggerRegistrationEmails = async (eventId: string, data: RegistrationData): Promise<void> => {
    if (USE_REAL_API) return; 
    const config = await getEventConfig();
    const verificationLink = `${config.event.publicUrl}/verify?email=${encodeURIComponent(data.email)}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${data.id || 'unknown'}`;
    try {
        const emails = await generateRegistrationEmails(data, config, verificationLink, qrCodeUrl);
        await sendEmail({ to: data.email, ...emails.userEmail }, config);
        await logEmailCommunication({ to: data.email, ...emails.userEmail }, 'sent');
    } catch (e) { await logEmailCommunication({ to: data.email, subject: 'Reg Error', body: '' }, 'failed', e instanceof Error ? e.message : 'Error'); }
};

export const getRegistrations = async (adminToken: string): Promise<RegistrationData[]> => {
    if (USE_REAL_API) return await apiFetch('/admin/registrations', 'GET', undefined, adminToken);
    return await findAll('registrations', (r: any) => r.eventId === MAIN_EVENT_ID);
};

export const updateRegistrationStatus = async (adminToken: string, eventId: string, registrationId: string, updates: Partial<RegistrationData>): Promise<void> => {
    if (!USE_REAL_API) await update('registrations', registrationId, updates);
};

export const bulkImportRegistrations = async (adminToken: string, csvData: string): Promise<{ successCount: number; errorCount: number; errors: string[] }> => {
    if (USE_REAL_API) {
        const lines = csvData.trim().split('\n').slice(1);
        const users = lines.map(line => {
            const [name, email] = line.split(',');
            return { name: name?.trim(), email: email?.trim() };
        }).filter(u => u.name && u.email);
        return await apiFetch('/admin/registrations/import', 'POST', { users, eventId: MAIN_EVENT_ID }, adminToken);
    }
    const lines = csvData.trim().split('\n');
    let successCount = 0, errorCount = 0;
    const errors: string[] = [];
    const start = lines.length > 0 && lines[0].toLowerCase().includes('email') ? 1 : 0;
    for (let i = start; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length < 2) { errorCount++; errors.push(`Line ${i + 1}: Invalid`); continue; }
        const name = parts[0].trim();
        const email = parts[1].trim();
        try {
            const res = await registerUser(MAIN_EVENT_ID, { name, email, createdAt: 0 } as any);
            if (res.success) successCount++; else { errorCount++; errors.push(`Line ${i+1}: ${res.message}`); }
        } catch { errorCount++; errors.push(`Line ${i+1}: Error`); }
    }
    return { successCount, errorCount, errors };
};

export const sendUpdateEmailToDelegate = async (adminToken: string, eventId: string, registrationId: string): Promise<void> => {
    if (USE_REAL_API) return; 
    const delegate = await find('registrations', (r: any) => r.id === registrationId);
    if (!delegate) throw new Error("Delegate not found");
    const config = await getEventConfig();
    const emailContent = await generateDelegateUpdateEmail(config, delegate);
    await sendEmail({ to: delegate.email, ...emailContent }, config);
    await logEmailCommunication({ to: delegate.email, ...emailContent }, 'sent');
};

export const getInvitationDetails = async (token: string): Promise<{ eventId: string, inviteeEmail: string } | null> => {
    if (!USE_REAL_API) {
        const invite = await find('inviteTokens', (t: any) => t.token === token);
        return invite ? { eventId: invite.eventId, inviteeEmail: invite.email } : null;
    }
    return null; 
};

export const sendDelegateInvitation = async (adminToken: string, eventId: string, email: string): Promise<void> => {
    if (USE_REAL_API) { await apiFetch('/admin/invite', 'POST', { email, eventId }, adminToken); return; }
    const token = `invite_${Date.now()}`;
    await insert('inviteTokens', { token, eventId, email });
    const config = await getEventConfig();
    const inviteLink = `${config.event.publicUrl}/${eventId}?inviteToken=${token}`;
    const emailContent = await generateDelegateInvitationEmail(config, "Event Admin", inviteLink);
    await sendEmail({ to: email, ...emailContent }, config);
    await logEmailCommunication({ to: email, ...emailContent }, 'sent');
};

// --- Communications ---
export const getEmailLogs = async (adminToken: string): Promise<any[]> => {
    if (USE_REAL_API) return []; 
    const logs = await findAll('emailLogs');
    return logs.sort((a: any, b: any) => b.timestamp - a.timestamp);
};

// --- Delegate Portal ---
export const getDelegateProfile = async (token: string): Promise<DelegateProfile> => {
    if (USE_REAL_API) return await apiFetch<DelegateProfile>('/delegate/profile', 'GET', undefined, token);
    const payload = JSON.parse(atob(token)); 
    const userId = payload.id;
    const user = await find('registrations', (r: any) => r.id === userId);
    if (!user) throw new Error("User not found");
    const mealPlanAssignment = await find('mealPlanAssignments', (mp: any) => mp.delegateId === userId);
    const accommodationBooking = await find('accommodationBookings', (ab: any) => ab.delegateId === userId);
    const agendaSelections = await findAll('agendaSelections', (s: any) => s.delegateId === userId);
    const restaurants = await findAll('restaurants');
    const hotels = await findAll('hotels');
    const sessions = await findAll('sessions'); 
    const speakers = await findAll('speakers');
    const sponsors = await findAll('sponsors');
    return { user, mealPlanAssignment, restaurants, accommodationBooking, hotels, sessions, mySessionIds: agendaSelections.map((s: any) => s.sessionId), speakers, sponsors };
};

export const updateDelegateProfile = async (token: string, updates: Partial<RegistrationData>): Promise<RegistrationData> => {
    const payload = JSON.parse(atob(token));
    return await update('registrations', payload.id, updates);
};

export const addToAgenda = async (delegateToken: string, sessionId: string): Promise<void> => {
    if (!USE_REAL_API) {
        const payload = JSON.parse(atob(delegateToken));
        const existing = await find('agendaSelections', (s: any) => s.delegateId === payload.id && s.sessionId === sessionId);
        if (!existing) await insert('agendaSelections', { id: `sel_${Date.now()}`, delegateId: payload.id, sessionId });
    }
};

export const removeFromAgenda = async (delegateToken: string, sessionId: string): Promise<void> => {
    if (!USE_REAL_API) {
        const payload = JSON.parse(atob(delegateToken));
        await removeWhere('agendaSelections', (s: any) => s.delegateId === payload.id && s.sessionId === sessionId);
    }
};

export const getEventContextForAI = async (delegateToken: string): Promise<string> => {
    const profile = await getDelegateProfile(delegateToken);
    const config = await getEventConfig();
    const { user, sessions } = profile;
    const agendaText = sessions.map(s => `- ${s.title}: ${s.location}`).join('\n');
    return `You are Virtual Concierge for ${config.event.name}. User: ${user.name}. Agenda: ${agendaText}`;
};

// --- Networking API ---
export const getMyNetworkingProfile = async (delegateToken: string): Promise<NetworkingProfile | null> => {
    if (USE_REAL_API) return await apiFetch<NetworkingProfile>('/networking/profile', 'GET', undefined, delegateToken);
    const payload = verifyToken(delegateToken);
    if (!payload) throw new Error("Invalid token");
    return await find('networkingProfiles', (p: any) => p.userId === payload.id);
};

export const updateNetworkingProfile = async (delegateToken: string, profileData: Partial<NetworkingProfile>): Promise<NetworkingProfile> => {
    if (USE_REAL_API) return await apiFetch<NetworkingProfile>('/networking/profile', 'POST', profileData, delegateToken);
    const payload = verifyToken(delegateToken);
    if (!payload) throw new Error("Invalid token");
    const existing = await find('networkingProfiles', (p: any) => p.userId === payload.id);
    if (existing) return await update('networkingProfiles', payload.id, profileData) as NetworkingProfile;
    return await insert('networkingProfiles', { userId: payload.id, bio: '', interests: [], linkedinUrl: '', jobTitle: '', company: '', lookingFor: '', isVisible: true, ...profileData });
};

export const getNetworkingCandidates = async (delegateToken: string): Promise<{ matches: NetworkingMatch[], allCandidates: NetworkingProfile[] }> => {
    if (USE_REAL_API) {
        const candidates = await apiFetch<NetworkingProfile[]>('/networking/candidates', 'GET', undefined, delegateToken);
        const myProfile = await getMyNetworkingProfile(delegateToken);
        if (!myProfile) return { matches: [], allCandidates: candidates };
        let matches: NetworkingMatch[] = [];
        try {
             const aiMatches = await geminiGenerateNetworkingMatches(myProfile, candidates);
             matches = aiMatches.map((m: any) => {
                 const candidate = candidates.find(c => c.userId === m.userId);
                 if (!candidate) return null;
                 return { userId: m.userId, name: (candidate as any).name, jobTitle: candidate.jobTitle, company: candidate.company, score: m.score, reason: m.reason, icebreaker: m.icebreaker, profile: candidate };
            }).filter(Boolean) as NetworkingMatch[];
        } catch (e) {}
        return { matches, allCandidates: candidates };
    }
    const payload = verifyToken(delegateToken);
    if (!payload) throw new Error("Invalid");
    const myProfile = await find('networkingProfiles', (p: any) => p.userId === payload.id);
    if (!myProfile?.isVisible) return { matches: [], allCandidates: [] };
    const candidates = await findAll('networkingProfiles', (p: any) => p.userId !== payload.id && p.isVisible);
    const enriched: NetworkingProfile[] = [];
    for (const c of candidates) {
        const reg = await find('registrations', (r: any) => r.id === c.userId);
        if (reg) enriched.push({ ...c, name: reg.name }); 
    }
    let matches: NetworkingMatch[] = [];
    try {
        const aiMatches = await geminiGenerateNetworkingMatches(myProfile, enriched);
         matches = aiMatches.map((m: any) => {
             const candidate = enriched.find(c => c.userId === m.userId);
             if (!candidate) return null;
             return { userId: m.userId, name: (candidate as any).name, jobTitle: candidate.jobTitle, company: candidate.company, score: m.score, reason: m.reason, icebreaker: m.icebreaker, profile: candidate };
        }).filter(Boolean) as NetworkingMatch[];
    } catch (e) {}
    return { matches, allCandidates: enriched };
};

// --- Session Feedback ---
export const submitSessionFeedback = async (delegateToken: string, sessionId: string, rating: number, comment: string): Promise<void> => {
    if (USE_REAL_API) { await apiFetch('/feedback', 'POST', { sessionId, rating, comment }, delegateToken); return; }
    const payload = verifyToken(delegateToken);
    if (!payload) return;
    await insert('sessionFeedback', { id: `fb_${Date.now()}`, sessionId, userId: payload.id, rating, comment, timestamp: Date.now() });
};

export const getSessionFeedbackStats = async (adminToken: string, sessionId: string): Promise<{ count: number, avgRating: number, comments: string[] }> => {
     if (USE_REAL_API) return await apiFetch(`/feedback/${sessionId}`, 'GET', undefined, adminToken);
     const feedback = await findAll('sessionFeedback', (f: any) => f.sessionId === sessionId);
     if (feedback.length === 0) return { count: 0, avgRating: 0, comments: [] };
     const sum = feedback.reduce((acc: number, curr: any) => acc + curr.rating, 0);
     return { count: feedback.length, avgRating: parseFloat((sum / feedback.length).toFixed(1)), comments: feedback.map((f: any) => f.comment) };
};

export const analyzeFeedback = async (adminToken: string, sessionId: string): Promise<string> => {
    if (!USE_REAL_API) {
        const session = await find('sessions', (s: any) => s.id === sessionId);
        const stats = await getSessionFeedbackStats(adminToken, sessionId);
        if (!stats.comments.length) return "No data.";
        return await geminiSummarizeSessionFeedback(session.title, stats.comments);
    }
    // In real mode, frontend still handles AI call to avoid loading backend with AI tasks
    const session = await apiFetch<Session>(`/sessions/${sessionId}`, 'GET', undefined, adminToken); // Assuming route exists or fetch from list
    const stats = await getSessionFeedbackStats(adminToken, sessionId);
    return await geminiSummarizeSessionFeedback(session.title, stats.comments);
};

// --- Gamification ---
export const getScavengerHuntItems = async (token: string): Promise<ScavengerHuntItem[]> => {
    if (USE_REAL_API) return await apiFetch('/scavenger-hunt-items', 'GET', undefined, token);
    const items = await findAll('scavengerHuntItems');
    const payload = verifyToken(token);
    if (payload?.type === 'admin') return items;
    return items.map((item: any) => ({ ...item, secretCode: undefined }));
};

export const saveScavengerHuntItem = async (adminToken: string, item: Partial<ScavengerHuntItem>): Promise<void> => {
    if (USE_REAL_API) { await apiFetch('/scavenger-hunt-items', 'POST', item, adminToken); return; }
    if (item.id) await update('scavengerHuntItems', item.id, item);
    else await insert('scavengerHuntItems', { ...item, id: `hunt_${Date.now()}` });
};

export const deleteScavengerHuntItem = async (adminToken: string, itemId: string): Promise<void> => {
     if (USE_REAL_API) { await apiFetch(`/scavenger-hunt-items/${itemId}`, 'DELETE', undefined, adminToken); return; }
     await remove('scavengerHuntItems', itemId);
};

export const getScavengerHuntProgress = async (delegateToken: string): Promise<string[]> => {
     if (USE_REAL_API) return await apiFetch('/scavenger-hunt/progress', 'GET', undefined, delegateToken);
     const payload = verifyToken(delegateToken);
     if (!payload) return [];
     const logs = await findAll('scavengerHuntLogs', (l: any) => l.userId === payload.id);
     return logs.map((l: any) => l.itemId);
};

export const claimScavengerHuntItem = async (delegateToken: string, secretCode: string): Promise<{ success: boolean, message: string, rewardAmount?: number }> => {
    if (USE_REAL_API) return await apiFetch('/scavenger-hunt/claim', 'POST', { secretCode }, delegateToken);
    const payload = verifyToken(delegateToken);
    if (!payload) return { success: false, message: "Invalid" };
    const item = await find('scavengerHuntItems', (i: any) => i.secretCode === secretCode);
    if (!item) return { success: false, message: "Invalid Code" };
    const existing = await find('scavengerHuntLogs', (l: any) => l.userId === payload.id && l.itemId === item.id);
    if (existing) return { success: false, message: "Already claimed" };
    await insert('scavengerHuntLogs', { id: `hl_${Date.now()}`, userId: payload.id, itemId: item.id, timestamp: Date.now() });
    const user = await find('registrations', (r: any) => r.id === payload.id);
    await insert('transactions', { id: `tx_rew_${Date.now()}`, fromId: 'system', fromName: 'System', fromEmail: 'system', toId: payload.id, toName: user.name, toEmail: user.email, amount: item.rewardAmount, message: `Found ${item.name}`, type: 'reward', timestamp: Date.now() });
    return { success: true, message: `Earned ${item.rewardAmount}`, rewardAmount: item.rewardAmount };
};

// --- Admin Dashboard ---
export const getDashboardStats = async (adminToken: string): Promise<DashboardStats> => {
    if (USE_REAL_API) return await apiFetch<DashboardStats>('/admin/dashboard-stats', 'GET', undefined, adminToken);
    const config = await getEventConfig();
    const totalRegistrations = await count('registrations', (r: any) => r.eventId === MAIN_EVENT_ID);
    const recentRegistrations = (await findAll('registrations', (r: any) => r.eventId === MAIN_EVENT_ID))
        .sort((a: any, b: any) => b.createdAt - a.createdAt)
        .slice(0, 5);
    const allTx = await findAll('transactions');
    const eventCoinCirculation = allTx
        .filter((t: any) => t.type === 'initial' || t.type === 'purchase' || t.type === 'reward')
        .reduce((acc: number, t: any) => acc + t.amount, 0);
    return { totalRegistrations, maxAttendees: config.event.maxAttendees, eventDate: config.event.date, eventCoinName: config.eventCoin.name, eventCoinCirculation, recentRegistrations };
};

// --- Users & Roles ---
export const getAdminUsers = async (adminToken: string): Promise<AdminUser[]> => {
    if (USE_REAL_API) return await apiFetch('/admin/users', 'GET', undefined, adminToken);
    return findAll('adminUsers');
};
export const saveAdminUser = async (adminToken: string, user: Partial<AdminUser> & { password?: string }): Promise<void> => {
    if (USE_REAL_API) { await apiFetch('/admin/users', 'POST', user, adminToken); return; }
    if (user.password) user.passwordHash = await hashPassword(user.password);
    delete user.password;
    if (user.id) await update('adminUsers', user.id, user);
    else await insert('adminUsers', { ...user, id: `user_${Date.now()}` });
};
export const deleteAdminUser = async (adminToken: string, userId: string): Promise<void> => { 
    if (USE_REAL_API) await apiFetch(`/admin/users/${userId}`, 'DELETE', undefined, adminToken);
    else await remove('adminUsers', userId); 
};
export const getRoles = async (adminToken: string): Promise<Role[]> => {
    if (USE_REAL_API) return await apiFetch('/admin/roles', 'GET', undefined, adminToken);
    return findAll('roles');
};
export const saveRole = async (adminToken: string, role: Partial<Role>): Promise<void> => {
    if (USE_REAL_API) { await apiFetch('/admin/roles', 'POST', role, adminToken); return; }
    if (role.id) await update('roles', role.id, role);
    else await insert('roles', { ...role, id: `role_${Date.now()}` });
};
export const deleteRole = async (adminToken: string, roleId: string): Promise<void> => { 
    if (USE_REAL_API) await apiFetch(`/admin/roles/${roleId}`, 'DELETE', undefined, adminToken);
    else await remove('roles', roleId); 
};

// --- Tasks ---
export const getTasks = async (adminToken: string, eventId: string): Promise<Task[]> => {
    if (USE_REAL_API) return await apiFetch('/tasks', 'GET', undefined, adminToken);
    return findAll('tasks', (t: any) => t.eventId === eventId);
};
export const saveTask = async (adminToken: string, task: Partial<Task>): Promise<void> => {
    if (USE_REAL_API) { await apiFetch('/tasks', 'POST', task, adminToken); return; }
    if (task.id) await update('tasks', task.id, task);
    else await insert('tasks', { ...task, id: `task_${Date.now()}` });
};
export const deleteTask = async (adminToken: string, taskId: string): Promise<void> => { 
    if (USE_REAL_API) await apiFetch(`/tasks/${taskId}`, 'DELETE', undefined, adminToken);
    else await remove('tasks', taskId); 
};

// --- Agenda ---
export const getSessions = async (adminToken: string): Promise<Session[]> => {
    if (USE_REAL_API) return await apiFetch('/sessions', 'GET', undefined, adminToken);
    return ((await findAll('sessions')) as Session[]).sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
};
export const saveSession = async (adminToken: string, session: Partial<Session>): Promise<void> => {
    if (USE_REAL_API) { await apiFetch('/sessions', 'POST', session, adminToken); return; }
    if (session.id) await update('sessions', session.id, session);
    else await insert('sessions', { ...session, id: `sess_${Date.now()}` });
};
export const deleteSession = async (adminToken: string, id: string): Promise<void> => { 
    if (USE_REAL_API) await apiFetch(`/sessions/${id}`, 'DELETE', undefined, adminToken);
    else await remove('sessions', id); 
};
export const getSpeakers = async (adminToken: string): Promise<Speaker[]> => {
    if (USE_REAL_API) return await apiFetch('/speakers', 'GET', undefined, adminToken);
    return findAll('speakers');
};
export const saveSpeaker = async (adminToken: string, speaker: Partial<Speaker>): Promise<void> => {
    if (USE_REAL_API) { await apiFetch('/speakers', 'POST', speaker, adminToken); return; }
    if (speaker.id) await update('speakers', speaker.id, speaker);
    else await insert('speakers', { ...speaker, id: `spk_${Date.now()}` });
};
export const deleteSpeaker = async (adminToken: string, id: string): Promise<void> => { 
    if (USE_REAL_API) await apiFetch(`/speakers/${id}`, 'DELETE', undefined, adminToken);
    else await remove('speakers', id); 
};

// --- Sponsors ---
export const getSponsors = async (adminToken: string): Promise<Sponsor[]> => {
    if (USE_REAL_API) return await apiFetch('/sponsors', 'GET', undefined, adminToken);
    return findAll('sponsors');
};
export const saveSponsor = async (adminToken: string, sponsor: Partial<Sponsor>): Promise<void> => {
    if (USE_REAL_API) { await apiFetch('/sponsors', 'POST', sponsor, adminToken); return; }
    if (sponsor.id) await update('sponsors', sponsor.id, sponsor);
    else await insert('sponsors', { ...sponsor, id: `spn_${Date.now()}` });
};
export const deleteSponsor = async (adminToken: string, id: string): Promise<void> => { 
    if (USE_REAL_API) await apiFetch(`/sponsors/${id}`, 'DELETE', undefined, adminToken);
    else await remove('sponsors', id); 
};

// --- Dining ---
export const getMealPlans = async (token: string): Promise<MealPlan[]> => {
    if (USE_REAL_API) return await apiFetch('/meal-plans', 'GET', undefined, token);
    return findAll('mealPlans');
};
export const saveMealPlan = async (adminToken: string, plan: Partial<MealPlan>): Promise<void> => {
    if (USE_REAL_API) { await apiFetch('/meal-plans', 'POST', plan, adminToken); return; }
    if (plan.id) await update('mealPlans', plan.id, plan);
    else await insert('mealPlans', { ...plan, id: `mp_${Date.now()}` });
};
export const deleteMealPlan = async (adminToken: string, id: string): Promise<void> => { 
    if (USE_REAL_API) await apiFetch(`/meal-plans/${id}`, 'DELETE', undefined, adminToken);
    else await remove('mealPlans', id); 
};
export const getRestaurants = async (token: string): Promise<Restaurant[]> => {
    if (USE_REAL_API) return await apiFetch('/restaurants', 'GET', undefined, token);
    return findAll('restaurants');
};
export const saveRestaurant = async (adminToken: string, restaurant: Partial<Restaurant>): Promise<void> => {
    if (USE_REAL_API) { await apiFetch('/restaurants', 'POST', restaurant, adminToken); return; }
    if (restaurant.id) await update('restaurants', restaurant.id, restaurant);
    else await insert('restaurants', { ...restaurant, id: `rest_${Date.now()}` });
};
export const deleteRestaurant = async (adminToken: string, id: string): Promise<void> => { 
    if (USE_REAL_API) await apiFetch(`/restaurants/${id}`, 'DELETE', undefined, adminToken);
    else await remove('restaurants', id); 
};

export const recordMealConsumption = async (adminToken: string, delegateId: string, mealType: MealType): Promise<{ success: boolean; message: string }> => {
    if (USE_REAL_API) return await apiFetch('/dining/consume', 'POST', { delegateId, mealType }, adminToken);
    const today = new Date().toISOString().split('T')[0];
    const existing = await find('mealConsumptionLogs', (l: any) => l.delegateId === delegateId && l.mealType === mealType && l.date === today);
    if (existing) return { success: false, message: `Already redeemed ${mealType} for today.` };
    await insert('mealConsumptionLogs', { id: `log_${Date.now()}`, delegateId, mealType, date: today, timestamp: Date.now() });
    return { success: true, message: `${mealType} redeemed successfully.` };
};

export const assignMealPlan = async (delegateToken: string, mealPlanId: string, startDate: string, endDate: string): Promise<void> => {
    if (!USE_REAL_API) {
        const payload = JSON.parse(atob(delegateToken));
        const existing = await find('mealPlanAssignments', (mp: any) => mp.delegateId === payload.id);
        if (existing) await update('mealPlanAssignments', existing.id, { mealPlanId, startDate, endDate });
        else await insert('mealPlanAssignments', { id: `mpa_${Date.now()}`, delegateId: payload.id, mealPlanId, startDate, endDate, totalCost: 0 });
    }
};

export const makeDiningReservation = async (delegateToken: string, restaurantId: string, reservationTime: string, partySize: number): Promise<void> => {
    if (USE_REAL_API) { await apiFetch('/dining/reservations', 'POST', { restaurantId, reservationTime, partySize }, delegateToken); return; }
    const payload = JSON.parse(atob(delegateToken));
    const user = await find('registrations', (r: any) => r.id === payload.id);
    await insert('diningReservations', { id: `res_${Date.now()}`, restaurantId, delegateId: payload.id, delegateName: user?.name || 'Unknown', reservationTime, partySize });
};

export const getReservationsForRestaurant = async (adminToken: string, restaurantId: string): Promise<DiningReservation[]> => {
    if (USE_REAL_API) return await apiFetch(`/admin/dining/reservations/${restaurantId}`, 'GET', undefined, adminToken);
    return findAll('diningReservations', (r: any) => r.restaurantId === restaurantId);
};

// --- Accommodation ---
export const getHotels = async (token: string): Promise<Hotel[]> => {
    if (USE_REAL_API) return await apiFetch('/hotels', 'GET', undefined, token);
    return findAll('hotels');
};
export const saveHotel = async (adminToken: string, hotel: Partial<Hotel>): Promise<void> => {
     if (USE_REAL_API) { await apiFetch('/hotels', 'POST', hotel, adminToken); return; }
     if (hotel.id) await update('hotels', hotel.id, hotel);
     else await insert('hotels', { ...hotel, id: `hotel_${Date.now()}` });
};
export const deleteHotel = async (adminToken: string, id: string): Promise<void> => { 
    if (USE_REAL_API) await apiFetch(`/hotels/${id}`, 'DELETE', undefined, adminToken);
    else await remove('hotels', id); 
};
export const getRoomsForHotel = async (adminToken: string, hotelId: string): Promise<HotelRoom[]> => {
    if (USE_REAL_API) return []; 
    return (await findAll('hotelRooms', (r: any) => r.hotelId === hotelId)) as HotelRoom[];
};
export const updateRoomStatus = async (adminToken: string, roomId: string, status: HotelRoomStatus): Promise<void> => { 
    if (!USE_REAL_API) await update('hotelRooms', roomId, { status }); 
};
export const bookAccommodation = async (delegateToken: string, hotelId: string, roomTypeId: string, checkInDate: string, checkOutDate: string): Promise<void> => {
    if (USE_REAL_API) { await apiFetch('/accommodation/book', 'POST', { hotelId, roomTypeId, checkInDate, checkOutDate }, delegateToken); return; }
    const payload = JSON.parse(atob(delegateToken));
    await removeWhere('accommodationBookings', (b: any) => b.delegateId === payload.id);
    await insert('accommodationBookings', { id: `bk_${Date.now()}`, delegateId: payload.id, hotelId, roomTypeId, hotelRoomId: 'assigned_later', checkInDate, checkOutDate, status: 'Confirmed', totalCost: 0 });
};
export const updateBookingStatus = async (adminToken: string, bookingId: string, status: AccommodationBookingStatus): Promise<void> => {
    if (USE_REAL_API) { await apiFetch(`/admin/accommodation/bookings/${bookingId}/status`, 'PUT', { status }, adminToken); return; }
    const booking: any = await update('accommodationBookings', bookingId, { status });
    if (booking && booking.hotelRoomId && booking.hotelRoomId !== 'assigned_later') {
        let newRoomStatus: HotelRoomStatus | undefined;
        if (status === 'CheckedIn') newRoomStatus = 'Occupied';
        else if (status === 'CheckedOut') newRoomStatus = 'Cleaning';
        else if (status === 'Confirmed') newRoomStatus = 'Available';
        if (newRoomStatus) await update('hotelRooms', booking.hotelRoomId, { status: newRoomStatus });
    }
};
export const getAccommodationBookings = async (adminToken: string): Promise<EnrichedAccommodationBooking[]> => {
    if (USE_REAL_API) return await apiFetch('/admin/accommodation/bookings', 'GET', undefined, adminToken);
    const bookings = await findAll('accommodationBookings') as AccommodationBooking[];
    const enriched: EnrichedAccommodationBooking[] = [];
    for (const b of bookings) {
        const user = await find('registrations', (r: any) => r.id === b.delegateId);
        const hotel = await find('hotels', (h: any) => h.id === b.hotelId);
        const roomType = hotel?.roomTypes?.find((rt: any) => rt.id === b.roomTypeId);
        const roomNumber = b.hotelRoomId !== 'assigned_later' ? '101' : 'Pending';
        enriched.push({ ...b, delegateName: user?.name || 'Unknown', delegateEmail: user?.email || 'Unknown', hotelName: hotel?.name || 'Unknown', roomTypeName: roomType?.name || 'Unknown', roomNumber });
    }
    return enriched;
};

// --- EventCoin ---
export const getEventCoinStats = async (adminToken: string): Promise<EventCoinStats> => {
    if (USE_REAL_API) {
        const stats = await apiFetch<any>('/admin/dashboard-stats', 'GET', undefined, adminToken);
        return { totalTransactions: 0, totalCirculation: stats.eventCoinCirculation, activeWallets: 0 };
    }
    const transactions = await findAll('transactions');
    const totalCirculation = transactions.reduce((acc: number, t: any) => acc + t.amount, 0);
    const uniqueWallets = new Set([...transactions.map((t:any) => t.fromId), ...transactions.map((t:any) => t.toId)]).size;
    return { totalTransactions: transactions.length, totalCirculation, activeWallets: uniqueWallets };
};
export const getAllTransactions = async (adminToken: string): Promise<Transaction[]> => {
    if (USE_REAL_API) return []; 
    return findAll('transactions');
};

// --- Delegate Wallet ---
export const getDelegateTransactions = async (delegateToken: string): Promise<Transaction[]> => {
    if (USE_REAL_API) {
        const res = await apiFetch<{transactions: Transaction[]}>('/delegate/wallet', 'GET', undefined, delegateToken);
        return res.transactions;
    }
    const payload = verifyToken(delegateToken);
    if (!payload) throw new Error("Invalid");
    const transactions = (await findAll('transactions', (t: any) => t.fromId === payload.id || t.toId === payload.id)) as Transaction[];
    return transactions.sort((a, b) => b.timestamp - a.timestamp);
};

export const getDelegateBalance = async (delegateToken: string): Promise<{ balance: number, currencyName: string }> => {
    if (USE_REAL_API) {
        const res = await apiFetch<{balance: number, currencyName: string}>('/delegate/wallet', 'GET', undefined, delegateToken);
        return res;
    }
    const payload = verifyToken(delegateToken);
    if (!payload) throw new Error("Invalid");
    const transactions = (await findAll('transactions', (t: any) => t.fromId === payload.id || t.toId === payload.id)) as Transaction[];
    let balance = 0;
    for (const tx of transactions) {
        if (tx.toId === payload.id) balance += tx.amount;
        else if (tx.fromId === payload.id) balance -= tx.amount;
    }
    const config = await getEventConfig();
    return { balance, currencyName: config.eventCoin.name };
};

export const sendCoins = async (delegateToken: string, recipientEmail: string, amount: number, message: string): Promise<void> => {
    if (USE_REAL_API) { await apiFetch('/delegate/wallet/send', 'POST', { recipientEmail, amount, message }, delegateToken); return; }
    const payload = verifyToken(delegateToken);
    if (!payload) throw new Error("Invalid");
    if (amount <= 0) throw new Error("Amount must be positive.");
    const senderBalance = (await getDelegateBalance(delegateToken)).balance;
    if (senderBalance < amount) throw new Error("Insufficient funds.");
    const sender = await find('registrations', (r: any) => r.id === payload.id);
    const recipient = await find('registrations', (r: any) => r.email === recipientEmail && r.eventId === payload.eventId);
    if (!recipient) throw new Error("Recipient not found.");
    if (recipient.id === payload.id) throw new Error("Cannot send coins to yourself.");
    await insert('transactions', { id: `tx_${Date.now()}`, fromId: payload.id, fromName: sender.name, fromEmail: sender.email, toId: recipient.id, toName: recipient.name, toEmail: recipient.email, amount, message, type: 'p2p', timestamp: Date.now() });
};

// --- Purchase (Simulated) ---
export const purchaseEventCoins = async (delegateToken: string, amount: number, cost: number): Promise<void> => {
    if (USE_REAL_API) return; // TODO: Stripe Backend Endpoint
    const payload = verifyToken(delegateToken);
    if (!payload) throw new Error("Invalid");
    const user = await find('registrations', (r: any) => r.id === payload.id);
    await new Promise(resolve => setTimeout(resolve, 1500));
    await insert('transactions', { id: `tx_purchase_${Date.now()}`, fromId: 'payment_gateway', fromName: 'Credit Card Top-up', fromEmail: 'stripe-sim@example.com', toId: payload.id, toName: user.name, toEmail: user.email, amount: amount, message: `Purchase of ${amount} Coins`, type: 'purchase', timestamp: Date.now() });
};
