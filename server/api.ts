
import { 
    RegistrationData, EventConfig, Permission, DashboardStats, AdminUser, 
    Role, PublicEvent, Task, MealPlan, Restaurant, MealType, 
    MealPlanAssignment, AccommodationBooking, Hotel, RoomType, 
    EnrichedAccommodationBooking, AccommodationBookingStatus, HotelRoom, 
    HotelRoomStatus, DiningReservation, AppNotification, SessionQuestion, 
    TicketTier, NetworkingProfile, NetworkingMatch, ScavengerHuntItem, 
    LeaderboardEntry, ChatMessage, ChatConversation, MediaItem, VenueMap,
    Speaker, Session, Sponsor, EventCoinStats, Transaction, EventData,
    Poll, PollWithResults, PollVote
} from '../types';
import { defaultConfig } from './config';
import * as db from './db';
import { generateToken, verifyToken, comparePassword } from './auth';
import { uploadFileToStorage, saveGeneratedImageToStorage } from './storage';
import * as geminiService from './geminiService';
import { sendEmail as mockSendEmail } from './email';
import { io, Socket } from 'socket.io-client';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- CONNECTIVITY STATE ---
let IS_ONLINE = false;
let FORCE_OFFLINE = false;
let socket: Socket | null = null;

// Helper for fetch with timeout
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 5000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

// --- SOCKET INITIALIZATION ---
const initSocket = (token: string) => {
    if (socket) return; // Already initialized
    
    // In production, this URL should be the backend URL
    const SOCKET_URL = window.location.origin.replace('3000', '3001'); // Dev hack or use env var
    
    socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket']
    });

    socket.on('connect', () => {
        console.log('[Socket] Connected');
    });

    socket.on('disconnect', () => {
        console.log('[Socket] Disconnected');
    });

    // Bridge Server Events to Local DB Subscribers (Refresh Triggers)
    socket.on('refresh:messages', () => db.notifySubscribers('messages'));
    socket.on('refresh:polls', () => db.notifySubscribers('polls'));
    socket.on('refresh:notifications', () => db.notifySubscribers('notifications'));
};

export const initializeApi = async (force?: boolean) => {
    if (FORCE_OFFLINE) return false;
    try {
        // Attempt to reach the backend health endpoint
        const res = await fetchWithTimeout('/api/health', {}, 2000); // 2s timeout
        
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'ok') {
                console.log("[API] Connected to Live Backend");
                IS_ONLINE = true;
                
                // Try to init socket if we have a token
                const token = localStorage.getItem('delegateToken') || localStorage.getItem('adminToken');
                if (token) initSocket(token);
                
                return true;
            }
        }
    } catch (e) {
        // Connection failed
    }
    console.log("[API] Backend unreachable, using Mock Mode");
    IS_ONLINE = false;
    return false;
};

export const isBackendConnected = () => IS_ONLINE;
export const setForceOffline = () => { FORCE_OFFLINE = true; IS_ONLINE = false; if(socket) socket.disconnect(); socket = null; };

// --- SOCKET SIGNALING (WebRTC) ---
export const sendSignal = async (token: string, targetId: string, type: 'offer' | 'answer' | 'candidate', data: any) => {
    if (IS_ONLINE && socket) {
        socket.emit('signal', { target: targetId, type, data });
        return;
    }
    // Offline Fallback
    const payload = requireAuth(token, 'delegate');
    await db.insert('signals', { id: `sig_${Date.now()}`, senderId: payload.id, receiverId: targetId, type, data, timestamp: Date.now() });
};

export const subscribeToSignals = (callback: (data: any) => void) => {
    if (socket) {
        socket.on('signal', callback);
        return () => { socket?.off('signal', callback); };
    }
    return () => {};
};

// --- AUTH HELPERS ---
const requireAuth = (token: string, type: 'admin' | 'delegate' | 'any' = 'any') => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Unauthorized: Invalid or expired token");
    
    if (type !== 'any' && payload.type !== type) {
        throw new Error(`Unauthorized: ${type} access required`);
    }
    return payload;
};

// --- AUTH & ADMIN ---

export const loginAdmin = async (email: string, password: string): Promise<{ token: string, user: any } | null> => {
    if (IS_ONLINE) {
        try {
            const res = await fetch('/api/auth/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            if (res.ok) {
                const data = await res.json();
                initSocket(data.token);
                return data;
            }
            return null;
        } catch (e) { return null; }
    }

    // Mock Fallback
    const users = await db.findAll('admin_users');
    const user = users.find((u: any) => u.email === email);
    
    if (user) {
        let valid = false;
        if (user.password_hash) {
            valid = await comparePassword(password, user.password_hash);
        } else if (password === 'password') {
            // Legacy fallback for old data without hash
            valid = true;
        }

        if (valid) {
            const role = (await db.find('roles', (r: any) => r.id === user.roleId)) || { permissions: [] };
            const token = generateToken({ id: user.id, email: user.email, permissions: role.permissions, type: 'admin' });
            return { token, user: { ...user, permissions: role.permissions } };
        }
    }
    return null;
};

export const requestAdminPasswordReset = async (email: string) => { await delay(500); };

export const requestDelegatePasswordReset = async (eventId: string, email: string) => {
    if (IS_ONLINE) {
        await fetch('/api/auth/delegate/reset-password-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId, email })
        });
        return;
    }
    await delay(500);
};

export const resetPassword = async (token: string, password: string) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password })
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || 'Failed to reset password');
        }
        return;
    }
    await delay(500);
};

export const getAdminUsers = async (token: string): Promise<AdminUser[]> => {
    if (IS_ONLINE) {
        const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    requireAuth(token, 'admin');
    return await db.findAll('admin_users');
};

export const saveAdminUser = async (token: string, user: any) => {
    requireAuth(token, 'admin');
    if (user.id) await db.update('admin_users', user.id, user);
    else await db.insert('admin_users', { ...user, id: `user_${Date.now()}`, createdAt: Date.now() });
};
export const deleteAdminUser = async (token: string, id: string) => {
    requireAuth(token, 'admin');
    await db.remove('admin_users', id);
};

export const getRoles = async (token: string): Promise<Role[]> => {
    requireAuth(token, 'admin');
    return await db.findAll('roles');
};
export const saveRole = async (token: string, role: any) => {
    requireAuth(token, 'admin');
    if (role.id) await db.update('roles', role.id, role);
    else await db.insert('roles', { ...role, id: `role_${Date.now()}` });
};
export const deleteRole = async (token: string, id: string) => {
    requireAuth(token, 'admin');
    await db.remove('roles', id);
};

export const listPublicEvents = async (): Promise<PublicEvent[]> => {
    if (IS_ONLINE) {
        const res = await fetch('/api/events');
        if (res.ok) return await res.json();
    }
    const events = await db.findAll('events');
    return events.map((e: any) => ({ ...e, config: e.config || defaultConfig }));
};

export const createEvent = async (token: string, name: string, type: string): Promise<EventData> => {
    requireAuth(token, 'admin');
    const newEvent = {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        eventType: type,
        config: { ...defaultConfig, event: { ...defaultConfig.event, name } },
        created_at: Date.now()
    };
    await db.insert('events', newEvent);
    return { id: newEvent.id, name: newEvent.name, type: newEvent.eventType };
};

export const getEventConfig = async (eventId: string = 'main-event'): Promise<EventConfig> => {
    let config: Partial<EventConfig> = defaultConfig;
    if (IS_ONLINE) {
        try {
            const res = await fetchWithTimeout(`/api/events/${eventId}/public`, {}, 3000);
            if (res.ok) {
                const data = await res.json();
                if (data.config) config = data.config;
            }
        } catch (e) {
            console.warn("Failed to fetch config from backend, falling back to local defaults/mock");
        }
    } else {
        const event = await db.find('events', (e: any) => e.id === eventId);
        if (event?.config) config = event.config;
    }

    const safeConfig = config || {};
    const merge = (def: any, src: any) => ({ ...def, ...(src || {}) });
    
    return {
        ...defaultConfig,
        ...safeConfig,
        event: merge(defaultConfig.event, safeConfig.event),
        host: merge(defaultConfig.host, safeConfig.host),
        theme: merge(defaultConfig.theme, safeConfig.theme),
        badgeConfig: merge(defaultConfig.badgeConfig, safeConfig.badgeConfig),
        eventCoin: merge(defaultConfig.eventCoin, safeConfig.eventCoin),
        emailTemplates: merge(defaultConfig.emailTemplates, safeConfig.emailTemplates),
        smtp: merge(defaultConfig.smtp, safeConfig.smtp),
        googleConfig: merge(defaultConfig.googleConfig, safeConfig.googleConfig),
        githubSync: merge(defaultConfig.githubSync, safeConfig.githubSync),
        whatsapp: merge(defaultConfig.whatsapp, safeConfig.whatsapp),
        sms: merge(defaultConfig.sms, safeConfig.sms),
        aiConcierge: merge(defaultConfig.aiConcierge, safeConfig.aiConcierge),
        formFields: safeConfig.formFields || defaultConfig.formFields
    } as EventConfig;
};

export const saveConfig = async (token: string, config: EventConfig) => {
    requireAuth(token, 'admin');
    let event = await db.find('events', (e: any) => e.id === 'main-event');
    if (!event) {
        event = await db.find('events', (e: any) => true);
    }
    if (event) {
        await db.update('events', event.id, { config });
    }
    return config;
};

export const syncConfigFromGitHub = async (token: string) => {
    requireAuth(token, 'admin');
    
    if (IS_ONLINE) {
        const res = await fetch('/api/admin/config/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Sync failed');
        }
        return await res.json();
    }

    // Offline Mode Logic
    const event = await db.find('events', (e: any) => e.id === 'main-event');
    const currentConfig = event?.config || defaultConfig;
    
    if (!currentConfig.githubSync?.configUrl) {
        throw new Error("GitHub Sync URL is not configured.");
    }

    try {
        const response = await fetch(currentConfig.githubSync.configUrl);
        if (!response.ok) throw new Error("Failed to fetch from GitHub.");
        
        const externalConfig = await response.json();
        
        const mergedConfig = {
            ...currentConfig,
            ...externalConfig,
            githubSync: {
                ...currentConfig.githubSync, // preserve URL
                ...externalConfig.githubSync, // allow overrides
                lastSyncTimestamp: Date.now(),
                lastSyncStatus: 'success'
            }
        };
        
        if (event) {
            await db.update('events', event.id, { config: mergedConfig });
        }
        return mergedConfig;
        
    } catch (e) {
        // Update status to failed locally if possible
        if (event) {
            const failedConfig = {
                ...currentConfig,
                githubSync: {
                    ...currentConfig.githubSync,
                    lastSyncTimestamp: Date.now(),
                    lastSyncStatus: 'failed'
                }
            };
            await db.update('events', event.id, { config: failedConfig });
        }
        throw e;
    }
};

export const getSystemApiKey = async (token: string) => {
    requireAuth(token, 'admin');
    return "mock-api-key-12345";
};

export const getDatabaseSchema = async (token: string) => {
    requireAuth(token, 'admin');
    return `-- Schema...`;
};

export const generateSqlExport = async (token: string) => {
    requireAuth(token, 'admin');
    return `-- SQL Export...`;
};

// ... (Registration Functions) ...
export const getPublicEventData = async (eventId: string) => {
    if (IS_ONLINE) {
        try {
            const res = await fetchWithTimeout(`/api/events/${eventId}/public`, {}, 3000);
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn("Public event data fetch failed, falling back to local DB");
        }
    }

    const config = await getEventConfig(eventId);
    const sessions = await db.findAll('sessions');
    const speakers = await db.findAll('speakers');
    const sponsors = await db.findAll('sponsors');
    const registrations = await db.findAll('registrations');
    const ticketTiers = await db.findAll('ticket_tiers');
    return { config, sessions, speakers, sponsors, ticketTiers, registrationCount: registrations.length };
};

export const registerUser = async (eventId: string, data: RegistrationData, inviteToken?: string): Promise<{ success: boolean; message: string }> => {
    if (IS_ONLINE) {
        const res = await fetch(`/api/events/${eventId}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (res.ok) return result;
        return { success: false, message: result.message || 'Registration failed' };
    }

    const event = await db.find('events', (e: any) => e.id === eventId);
    const config = event?.config || defaultConfig;
    const maxAttendees = config.event?.maxAttendees || 0;
    
    if (maxAttendees > 0) {
        const currentCount = await db.count('registrations', (r: any) => r.eventId === eventId && r.status !== 'cancelled' && r.status !== 'waitlist');
        if (currentCount >= maxAttendees) {
             data.status = 'waitlist';
        }
    }

    const exists = await db.find('registrations', (r: any) => r.email === data.email);
    if (exists) return { success: false, message: 'Email already registered.' };
    
    await db.insert('registrations', { 
        ...data, 
        id: `reg_${Date.now()}`, 
        eventId, 
        createdAt: Date.now(), 
        checkedIn: false,
        status: data.status || 'confirmed'
    });
    
    if (data.status === 'waitlist') {
        return { success: true, message: 'Event full. You have been added to the waitlist.' };
    }
    
    return { success: true, message: 'Registered successfully' };
};

export const triggerRegistrationEmails = async (eventId: string, data: RegistrationData) => { await delay(500); };
export const getInvitationDetails = async (token: string) => ({ eventId: 'main-event', inviteeEmail: 'test@example.com' });

export const loginDelegate = async (eventId: string, email: string, password: string) => {
    if (IS_ONLINE) {
        try {
            const res = await fetch('/api/auth/delegate/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, email, password })
            });
            if (res.ok) {
                const data = await res.json();
                initSocket(data.token);
                return data;
            }
            return null;
        } catch (e) { return null; }
    }

    const user = await db.find('registrations', (r: any) => r.email === email && r.eventId === eventId);
    if (user) {
        if (user.password_hash) {
            const valid = await comparePassword(password, user.password_hash);
            if (!valid) return null;
        }
        return { token: generateToken({ id: user.id, email: user.email, type: 'delegate', eventId }) };
    }
    return null;
};

// ... (Other standard functions) ...
export const getRegistrations = async (token: string): Promise<RegistrationData[]> => {
    if (IS_ONLINE) {
        const res = await fetch('/api/admin/registrations', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    requireAuth(token, 'admin');
    return await db.findAll('registrations');
};

// ... (Kiosk, Update Status, etc) ...
export const updateRegistrationStatus = async (token: string, id: string, status: any) => {
    requireAuth(token, 'admin');
    await db.update('registrations', id, status);
};
export const deleteAdminRegistration = async (token: string, id: string) => {
    requireAuth(token, 'admin');
    await db.remove('registrations', id);
};
export const saveAdminRegistration = async (token: string, id: string, data: any) => {
    requireAuth(token, 'admin');
    await db.update('registrations', id, data);
};
export const bulkImportRegistrations = async (token: string, csvData: string) => {
    requireAuth(token, 'admin');
    const lines = csvData.trim().split('\n').slice(1);
    let successCount = 0;
    for (const line of lines) {
        const [name, email] = line.split(',');
        if (name && email) {
            await db.insert('registrations', { id: `imp_${Date.now()}_${Math.random()}`, name, email, createdAt: Date.now(), checkedIn: false });
            successCount++;
        }
    }
    return { successCount, errorCount: 0, errors: [] };
};

export const verifyTicketToken = async (token: string, ticketToken: string) => {
    requireAuth(token, 'admin');
    return { success: true, message: "Ticket Valid", user: { id: ticketToken } }; 
};
export const getSignedTicketToken = async (token: string) => {
    const payload = verifyToken(token); // Verify self
    return payload?.id || '';
};

export const processCheckIn = async (token: string, qrData: string) => {
    requireAuth(token, 'admin');
    
    if (IS_ONLINE) {
        try {
            const res = await fetch('/api/admin/checkin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ qrData })
            });
            return await res.json();
        } catch (e) {
            return { success: false, message: 'Server Connection Error' };
        }
    }

    const user = await db.find('registrations', (r: any) => r.id === qrData);
    if (!user) return { success: false, message: 'Invalid Ticket' };
    if (user.checkedIn) return { success: false, message: 'Already Checked In', user };

    await db.update('registrations', user.id, { checkedIn: true });
    return { success: true, message: 'Checked In Successfully', user: { ...user, checkedIn: true } };
};

export const promoteToConfirmed = async (token: string, id: string) => {
    requireAuth(token, 'admin');
    await db.update('registrations', id, { status: 'confirmed' });
};

// ... (Dashboard, Agenda, Sessions, Speakers, Sponsors omitted) ...
export const getDashboardStats = async (token: string): Promise<DashboardStats> => {
    if (IS_ONLINE) {
        const res = await fetch('/api/admin/registrations', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
            const regs = await res.json();
            return {
                totalRegistrations: regs.length,
                maxAttendees: 500,
                eventDate: "Oct 26, 2025",
                registrationTrend: [],
                taskStats: { total: 10, completed: 5, pending: 5 },
                recentRegistrations: regs.slice(0, 5),
                eventCoinName: 'EventCoin',
                eventCoinCirculation: 10000,
                activeWallets: 50,
                totalTransactions: 200
            };
        }
    }
    requireAuth(token, 'admin');
    const regs = await db.findAll('registrations');
    return {
        totalRegistrations: regs.length,
        maxAttendees: 500,
        eventDate: "Oct 26, 2025",
        registrationTrend: [],
        taskStats: { total: 10, completed: 5, pending: 5 },
        recentRegistrations: regs.slice(-5),
        eventCoinName: 'EventCoin',
        eventCoinCirculation: 10000,
        activeWallets: 50,
        totalTransactions: 200
    };
};

export const getSessions = async (token: string): Promise<Session[]> => {
    return await db.findAll('sessions');
};
export const saveSession = async (token: string, session: any) => {
    requireAuth(token, 'admin');
    if (session.id) await db.update('sessions', session.id, session);
    else await db.insert('sessions', { ...session, id: `sess_${Date.now()}` });
};
export const deleteSession = async (token: string, id: string) => {
    requireAuth(token, 'admin');
    await db.remove('sessions', id);
};

export const getSpeakers = async (token: string): Promise<Speaker[]> => await db.findAll('speakers');
export const saveSpeaker = async (token: string, speaker: any) => {
    requireAuth(token, 'admin');
    if (speaker.id) await db.update('speakers', speaker.id, speaker);
    else await db.insert('speakers', { ...speaker, id: `spk_${Date.now()}` });
};
export const deleteSpeaker = async (token: string, id: string) => {
    requireAuth(token, 'admin');
    await db.remove('speakers', id);
};

export const getSponsors = async (token: string): Promise<Sponsor[]> => await db.findAll('sponsors');
export const saveSponsor = async (token: string, sponsor: any) => {
    requireAuth(token, 'admin');
    if (sponsor.id) await db.update('sponsors', sponsor.id, sponsor);
    else await db.insert('sponsors', { ...sponsor, id: `spo_${Date.now()}` });
};
export const deleteSponsor = async (token: string, id: string) => {
    requireAuth(token, 'admin');
    await db.remove('sponsors', id);
};

export const getMyAgenda = async (token: string): Promise<string[]> => {
    if (IS_ONLINE) {
        const res = await fetch('/api/delegate/agenda', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    const payload = verifyToken(token); // Loose verify for read
    if (!payload) return [];
    const entries = await db.findAll('agenda_entries', (a: any) => a.userId === payload.id);
    return entries.map((e: any) => e.sessionId);
};

export const addToAgenda = async (token: string, sessionId: string) => {
    if (IS_ONLINE) {
        await fetch('/api/delegate/agenda', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ sessionId })
        });
        return;
    }
    const payload = requireAuth(token, 'delegate');
    const exists = await db.find('agenda_entries', (a: any) => a.userId === payload.id && a.sessionId === sessionId);
    if (!exists) {
        await db.insert('agenda_entries', { id: `ag_${Date.now()}`, userId: payload.id, sessionId });
    }
};

export const removeFromAgenda = async (token: string, sessionId: string) => {
    if (IS_ONLINE) {
        await fetch(`/api/delegate/agenda/${sessionId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        return;
    }
    const payload = requireAuth(token, 'delegate');
    await db.removeWhere('agenda_entries', (a: any) => a.userId === payload.id && a.sessionId === sessionId);
};

// ... (Feedback, ICS, QA) ...
export const submitSessionFeedback = async (token: string, sessionId: string, rating: number, comment: string) => { 
    requireAuth(token, 'delegate');
    await delay(200); 
};
export const getSessionFeedbackStats = async (token: string, sessionId: string) => {
    requireAuth(token, 'admin');
    return { count: 5, avgRating: 4.5 };
};
export const analyzeFeedback = async (token: string, sessionId: string) => {
    requireAuth(token, 'admin');
    return "Great session overall.";
};
export const downloadSessionIcs = async (sessionOrId: Session | string) => { /* ... */ };

export const getSessionQuestions = async (token: string, sessionId: string): Promise<SessionQuestion[]> => {
    if (IS_ONLINE) {
        const res = await fetch(`/api/delegate/sessions/${sessionId}/questions`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    requireAuth(token, 'delegate');
    const questions = await db.findAll('session_questions', (q: any) => q.sessionId === sessionId);
    return questions.sort((a: any, b: any) => (b.upvotes || 0) - (a.upvotes || 0) || b.timestamp - a.timestamp);
};

export const submitSessionQuestion = async (token: string, sessionId: string, text: string) => {
    if (IS_ONLINE) {
        await fetch(`/api/delegate/sessions/${sessionId}/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ text })
        });
        return;
    }
    const payload = requireAuth(token, 'delegate');
    const user = await db.find('registrations', (r: any) => r.id === payload.id);
    
    await db.insert('session_questions', {
        id: `q_${Date.now()}`,
        sessionId,
        userId: payload.id,
        userName: user?.name || 'Anonymous',
        text,
        upvotes: 0,
        timestamp: Date.now(),
        isAnswered: false,
        upvotedBy: []
    });
};

export const upvoteSessionQuestion = async (token: string, questionId: string) => {
    if (IS_ONLINE) {
        await fetch(`/api/delegate/questions/${questionId}/upvote`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        return;
    }
    const payload = requireAuth(token, 'delegate');
    const question = await db.find('session_questions', (q: any) => q.id === questionId);
    
    if (question) {
        const upvotedBy = question.upvotedBy || [];
        if (!upvotedBy.includes(payload.id)) {
            await db.update('session_questions', questionId, {
                upvotes: (question.upvotes || 0) + 1,
                upvotedBy: [...upvotedBy, payload.id]
            });
        }
    }
};

// --- POLLS ---

export const getPolls = async (token: string, sessionId: string): Promise<PollWithResults[]> => {
    if (IS_ONLINE) {
        const res = await fetch(`/api/sessions/${sessionId}/polls`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    const payload = requireAuth(token, 'any');
    const polls = await db.findAll('polls', (p: any) => p.sessionId === sessionId);
    const votes = await db.findAll('poll_votes', (v: any) => polls.map((p: any) => p.id).includes(v.pollId));

    return polls.map((p: any) => {
        const pVotes = votes.filter((v: any) => v.pollId === p.id);
        const counts = new Array(p.options.length).fill(0);
        pVotes.forEach((v: any) => counts[v.optionIndex]++);
        const myVote = pVotes.find((v: any) => v.userId === payload.id);
        
        return {
            ...p,
            votes: counts,
            totalVotes: pVotes.length,
            userVotedIndex: myVote ? myVote.optionIndex : undefined
        };
    });
};

export const createPoll = async (token: string, sessionId: string, question: string, options: string[]) => {
    requireAuth(token, 'admin');
    if (IS_ONLINE) {
        await fetch(`/api/admin/sessions/${sessionId}/polls`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ question, options })
        });
        return;
    }
    await db.insert('polls', {
        id: `poll_${Date.now()}`,
        sessionId,
        question,
        options,
        status: 'draft',
        createdAt: Date.now()
    });
};

export const updatePollStatus = async (token: string, pollId: string, status: 'active' | 'closed') => {
    requireAuth(token, 'admin');
    if (IS_ONLINE) {
        await fetch(`/api/admin/polls/${pollId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status })
        });
        return;
    }
    await db.update('polls', pollId, { status });
};

export const votePoll = async (token: string, pollId: string, optionIndex: number) => {
    const payload = requireAuth(token, 'delegate');
    if (IS_ONLINE) {
        await fetch(`/api/delegate/polls/${pollId}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ optionIndex })
        });
        return;
    }
    
    // Check if already voted
    const existing = await db.find('poll_votes', (v: any) => v.pollId === pollId && v.userId === payload.id);
    if (!existing) {
        await db.insert('poll_votes', {
            id: `vote_${Date.now()}`,
            pollId,
            userId: payload.id,
            optionIndex,
            timestamp: Date.now()
        });
    }
};

// ... (Other functions dining, hotel, tasks, etc... assume they exist from previous turns) ...
export const getMealPlans = async (token: string): Promise<MealPlan[]> => await db.findAll('meal_plans');
export const saveMealPlan = async (token: string, plan: any) => {
    requireAuth(token, 'admin');
    if (plan.id) await db.update('meal_plans', plan.id, plan);
    else await db.insert('meal_plans', { ...plan, id: `mp_${Date.now()}` });
};
export const deleteMealPlan = async (token: string, id: string) => {
    requireAuth(token, 'admin');
    await db.remove('meal_plans', id);
};

export const getRestaurants = async (token: string): Promise<Restaurant[]> => await db.findAll('restaurants');
export const saveRestaurant = async (token: string, rest: any) => {
    requireAuth(token, 'admin');
    if (rest.id) await db.update('restaurants', rest.id, rest);
    else await db.insert('restaurants', { ...rest, id: `rst_${Date.now()}` });
};
export const deleteRestaurant = async (token: string, id: string) => {
    requireAuth(token, 'admin');
    await db.remove('restaurants', id);
};

export const getHotels = async (token: string): Promise<Hotel[]> => {
    if (IS_ONLINE) {
        const res = await fetch('/api/admin/hotels', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    return await db.findAll('hotels');
};

export const saveHotel = async (token: string, hotel: any) => {
    requireAuth(token, 'admin');
    if (IS_ONLINE) {
        await fetch('/api/admin/hotels', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(hotel)
        });
        return;
    }
    if (hotel.id) await db.update('hotels', hotel.id, hotel);
    else await db.insert('hotels', { ...hotel, id: `htl_${Date.now()}` });
};

export const deleteHotel = async (token: string, id: string) => {
    requireAuth(token, 'admin');
    if (IS_ONLINE) {
        await fetch(`/api/admin/hotels/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        return;
    }
    await db.remove('hotels', id);
};

export const getAccommodationBookings = async (token: string): Promise<EnrichedAccommodationBooking[]> => {
    if (IS_ONLINE) {
        const res = await fetch('/api/admin/bookings/accommodation', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    requireAuth(token, 'admin');

    const bookings = await db.findAll('bookings');
    const hotels = await db.findAll('hotels');
    const delegates = await db.findAll('registrations');
    
    return bookings.map((b: any) => {
        const hotel = hotels.find((h: any) => h.id === b.hotelId);
        const delegate = delegates.find((d: any) => d.id === b.delegateId);
        const roomType = hotel?.roomTypes.find((rt: any) => rt.id === b.roomTypeId);
        
        return {
            ...b,
            delegateName: delegate?.name || 'Unknown',
            delegateEmail: delegate?.email || 'Unknown',
            hotelName: hotel?.name || 'Unknown',
            roomTypeName: roomType?.name || 'Unknown',
            roomNumber: b.roomNumber || 'Pending'
        };
    });
};

export const updateBookingStatus = async (token: string, id: string, status: AccommodationBookingStatus) => {
    requireAuth(token, 'admin');
    if (IS_ONLINE) {
        await fetch(`/api/admin/bookings/accommodation/${id}/status`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status })
        });
        return;
    }
    
    const booking = await db.find('bookings', (b: any) => b.id === id);
    if (booking) {
        await db.update('bookings', id, { status });
        if (booking.hotelRoomId) {
            if (status === 'CheckedOut') await db.update('rooms', booking.hotelRoomId, { status: 'Cleaning' });
            else if (status === 'Cancelled') await db.update('rooms', booking.hotelRoomId, { status: 'Available' });
            else if (status === 'CheckedIn') await db.update('rooms', booking.hotelRoomId, { status: 'Occupied' });
        }
    }
};

export const assignRoomToBooking = async (token: string, bookingId: string, roomId: string) => {
    requireAuth(token, 'admin');
    if (IS_ONLINE) {
        await fetch(`/api/admin/bookings/accommodation/${bookingId}/assign`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ roomId })
        });
        return;
    }

    const room = await db.find('rooms', (r: any) => r.id === roomId);
    if (room && room.status === 'Available') {
        await db.update('bookings', bookingId, { hotelRoomId: roomId, roomNumber: room.roomNumber, status: 'CheckedIn' });
        await db.update('rooms', roomId, { status: 'Occupied' });
    } else {
        throw new Error("Room not available or not found.");
    }
};

export const processCheckOut = async (token: string, bookingId: string) => {
    requireAuth(token, 'admin');
    await updateBookingStatus(token, bookingId, 'CheckedOut');
};

export const selfCheckOut = async (token: string, bookingId: string) => {
    const payload = requireAuth(token, 'delegate');
    const booking = await db.find('bookings', (b: any) => b.id === bookingId && b.delegateId === payload.id);
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== 'CheckedIn') throw new Error("Booking is not currently active.");
    
    // For Mock: direct DB update
    await db.update('bookings', bookingId, { status: 'CheckedOut' });
    if(booking.hotelRoomId) await db.update('rooms', booking.hotelRoomId, { status: 'Cleaning' });

    return { success: true, message: "Checked out successfully. Safe travels!" };
};

export const cancelAccommodationBooking = async (token: string, bookingId: string) => {
    requireAuth(token, 'any'); 
    // Mock
    const booking = await db.find('bookings', (b: any) => b.id === bookingId);
    if (!booking) throw new Error("Booking not found");

    // Refund logic
    const hotel = await db.find('hotels', (h: any) => h.id === booking.hotelId);
    const roomType = hotel?.roomTypes.find((rt: any) => rt.id === booking.roomTypeId);
    
    if (roomType && booking.status !== 'Cancelled') {
        const checkInDate = new Date(booking.checkInDate);
        const checkOutDate = new Date(booking.checkOutDate);
        const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
        const totalCost = Math.max(1, nights) * roomType.costPerNight;
        
        const user = await db.find('registrations', (u: any) => u.id === booking.delegateId);
        
        await db.insert('transactions', {
            id: `tx_ref_${Date.now()}`,
            fromId: 'system',
            toId: booking.delegateId,
            fromName: 'Hotel System',
            toName: user?.name || 'User',
            fromEmail: 'system',
            toEmail: user?.email || '',
            amount: totalCost,
            type: 'reward', 
            message: `Refund for booking cancellation: ${hotel.name}`,
            timestamp: Date.now()
        });
    }

    await db.update('bookings', bookingId, { status: 'Cancelled' });
    if(booking.hotelRoomId) await db.update('rooms', booking.hotelRoomId, { status: 'Available' });
};

export const getAllRooms = async (token: string, hotelId: string): Promise<HotelRoom[]> => {
    requireAuth(token, 'admin');
    if (IS_ONLINE) {
        const res = await fetch(`/api/admin/hotels/${hotelId}/rooms`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    return await db.findAll('rooms', (r: any) => r.hotelId === hotelId);
};

export const getAvailableRooms = async (token: string, hotelId: string, roomTypeId: string): Promise<HotelRoom[]> => {
    requireAuth(token, 'admin');
    if (IS_ONLINE) {
        const rooms = await getAllRooms(token, hotelId);
        return rooms.filter(r => r.roomTypeId === roomTypeId && r.status === 'Available');
    }
    return await db.findAll('rooms', (r: any) => r.hotelId === hotelId && r.roomTypeId === roomTypeId && r.status === 'Available');
};

export const generateHotelRooms = async (token: string, hotelId: string, roomTypeId: string, count: number, startNumber: number) => {
    requireAuth(token, 'admin');
    if (IS_ONLINE) {
        await fetch(`/api/admin/hotels/${hotelId}/rooms/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ roomTypeId, count, startNumber })
        });
        return;
    }

    const existingRooms = await db.findAll('rooms', (r: any) => r.hotelId === hotelId);
    const existingNumbers = new Set(existingRooms.map((r: any) => r.roomNumber));

    for (let i = 0; i < count; i++) {
        const roomNumber = (startNumber + i).toString();
        if (existingNumbers.has(roomNumber)) continue; 

        await db.insert('rooms', { 
            id: `room_${Date.now()}_${i}`, 
            hotelId, 
            roomTypeId, 
            roomNumber: roomNumber, 
            status: 'Available' 
        });
    }
};

export const updateRoomStatus = async (token: string, id: string, status: HotelRoomStatus) => {
    requireAuth(token, 'admin');
    if (IS_ONLINE) {
        await fetch(`/api/admin/rooms/${id}/status`, {
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status })
        });
        return;
    }
    await db.update('rooms', id, { status });
};

export const recordMealConsumption = async (token: string, delegateId: string, mealType: MealType) => { 
    requireAuth(token, 'admin');
    return { success: true, message: 'Meal recorded' }; 
};
export const assignMealPlan = async (token: string, planId: string, start: string, end: string) => { requireAuth(token, 'delegate'); };

// Internal helper for capacity check (Mock Only logic mainly)
const checkCapacityAndBook = async (delegateId: string, hotelId: string, roomTypeId: string, checkIn: string, checkOut: string) => {
    if (new Date(checkIn) >= new Date(checkOut)) throw new Error("Check-out date must be after check-in date.");

    const hotel = await db.find('hotels', (h: any) => h.id === hotelId);
    if (!hotel) throw new Error("Hotel not found");
    
    const roomType = hotel.roomTypes.find((rt: any) => rt.id === roomTypeId);
    if (!roomType) throw new Error("Room type not found");

    const overlappingBookings = await db.findAll('bookings', (b: any) => 
        b.roomTypeId === roomTypeId && 
        b.status !== 'Cancelled' && 
        b.status !== 'CheckedOut' && 
        (new Date(b.checkInDate) < new Date(checkOut) && new Date(b.checkOutDate) > new Date(checkIn))
    );
    
    const otherBookings = overlappingBookings.filter((b: any) => b.delegateId !== delegateId);

    if (otherBookings.length >= roomType.totalRooms) {
        throw new Error("No availability for the selected dates.");
    }

    const existing = await db.find('bookings', (b: any) => b.delegateId === delegateId && b.status !== 'CheckedOut' && b.status !== 'Cancelled');
    if (existing) {
        await db.update('bookings', existing.id, { 
            hotelId, roomTypeId, checkInDate: checkIn, checkOutDate: checkOut, status: 'Confirmed', hotelRoomId: null, roomNumber: 'Pending'
        });
        if (existing.hotelRoomId) {
             await db.update('rooms', existing.hotelRoomId, { status: 'Available' });
        }
    } else {
        await db.insert('bookings', { 
            id: `bk_${Date.now()}`, delegateId: delegateId, hotelId, roomTypeId, checkInDate: checkIn, checkOutDate: checkOut, status: 'Confirmed', roomNumber: 'Pending'
        });
    }
};

export const bookAccommodation = async (token: string, hotelId: string, roomTypeId: string, checkIn: string, checkOut: string) => {
    const payload = requireAuth(token, 'delegate');
    
    if (!IS_ONLINE) {
        const hotel = await db.find('hotels', (h: any) => h.id === hotelId);
        const roomType = hotel?.roomTypes.find((rt: any) => rt.id === roomTypeId);
        if (!roomType) throw new Error("Room type not found.");

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
        const totalCost = Math.max(1, nights) * roomType.costPerNight;

        const balanceData = await getDelegateBalance(token);
        if (balanceData.balance < totalCost) {
            throw new Error(`Insufficient funds. Cost: ${totalCost} ${balanceData.currencyName}, Balance: ${balanceData.balance}`);
        }

        const user = await db.find('registrations', (u: any) => u.id === payload.id);
        await db.insert('transactions', {
            id: `tx_pay_${Date.now()}`, fromId: payload.id, toId: 'system', fromName: user.name, toName: 'Hotel System', fromEmail: user.email, toEmail: 'system', amount: totalCost, type: 'purchase', message: `Booking: ${hotel.name} (${nights} nights)`, timestamp: Date.now()
        });
    }

    if (IS_ONLINE) {
        await fetch('/api/admin/bookings/accommodation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ delegateId: payload.id, hotelId, roomTypeId, checkInDate: checkIn, checkOutDate: checkOut })
        });
        return;
    }

    await checkCapacityAndBook(payload.id, hotelId, roomTypeId, checkIn, checkOut);
};

export const createAdminAccommodationBooking = async (token: string, delegateId: string, hotelId: string, roomTypeId: string, checkIn: string, checkOut: string) => {
    requireAuth(token, 'admin');
    if (IS_ONLINE) {
        await fetch('/api/admin/bookings/accommodation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ delegateId, hotelId, roomTypeId, checkInDate: checkIn, checkOutDate: checkOut })
        });
        return;
    }
    await checkCapacityAndBook(delegateId, hotelId, roomTypeId, checkIn, checkOut);
};

export const makeDiningReservation = async (token: string, restaurantId: string, time: string, size: number) => {
    const payload = requireAuth(token, 'delegate');
    const user = await db.find('registrations', (r: any) => r.id === payload.id);
    
    await db.insert('dining_reservations', {
        id: `res_${Date.now()}`, restaurantId, delegateId: payload.id, delegateName: user?.name || 'Delegate', reservationTime: time, partySize: size
    });
};

export const getReservationsForRestaurant = async (token: string, id: string): Promise<DiningReservation[]> => {
    requireAuth(token, 'admin');
    return await db.findAll('dining_reservations', (r: any) => r.restaurantId === id);
};

export const createAdminDiningReservation = async (token: string, data: any) => {
    requireAuth(token, 'admin');
    const user = await db.find('registrations', (r: any) => r.id === data.delegateId);
    await db.insert('dining_reservations', {
        id: `res_${Date.now()}`, restaurantId: data.restaurantId, delegateId: data.delegateId, delegateName: user?.name || 'Unknown', reservationTime: data.reservationTime, partySize: data.partySize
    });
};

export const deleteDiningReservation = async (token: string, id: string) => {
    requireAuth(token, 'admin');
    await db.remove('dining_reservations', id);
};

// ... (Tasks, Wallet, Economy, Tickets, Maps, Communications, Media, AI, Gamification, Networking) ...
export const getTasks = async (token: string, eventId: string): Promise<Task[]> => {
    requireAuth(token, 'admin');
    return await db.findAll('tasks');
};
export const saveTask = async (token: string, task: any) => {
    requireAuth(token, 'admin');
    if (task.id) await db.update('tasks', task.id, task);
    else await db.insert('tasks', { ...task, id: `task_${Date.now()}`, createdAt: Date.now() });
};
export const deleteTask = async (token: string, id: string) => {
    requireAuth(token, 'admin');
    await db.remove('tasks', id);
};

export const getEventCoinStats = async (token: string): Promise<EventCoinStats> => {
    requireAuth(token, 'admin');
    return { totalCirculation: 50000, totalTransactions: 1200, activeWallets: 150 };
};
export const getAllTransactions = async (token: string): Promise<Transaction[]> => {
    requireAuth(token, 'admin');
    return await db.findAll('transactions');
};

export const getDelegateBalance = async (token: string) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/delegate/balance', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    const payload = requireAuth(token, 'delegate');
    const transactions = await db.findAll('transactions', (t: any) => t.toId === payload.id || t.fromId === payload.id);
    let balance = 100; 
    transactions.forEach((t: any) => {
        if (t.toId === payload.id) balance += t.amount;
        if (t.fromId === payload.id) balance -= t.amount;
    });
    return { balance, currencyName: 'EventCoin' };
};

export const getDelegateTransactions = async (token: string): Promise<Transaction[]> => {
    if (IS_ONLINE) {
        const res = await fetch('/api/delegate/transactions', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    const payload = requireAuth(token, 'delegate');
    return await db.findAll('transactions', (t: any) => t.toId === payload.id || t.fromId === payload.id);
};

export const sendCoins = async (token: string, toEmail: string, amount: number, message: string) => {
    if (IS_ONLINE) {
        await fetch('/api/delegate/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ toEmail, amount, message })
        });
        return;
    }
    const payload = requireAuth(token, 'delegate');
    const sender = await db.find('registrations', (r: any) => r.id === payload.id);
    const recipient = await db.find('registrations', (r: any) => r.email === toEmail);
    if (!recipient) throw new Error("Recipient not found");
    const balanceData = await getDelegateBalance(token);
    if (balanceData.balance < amount) throw new Error("Insufficient funds");
    await db.insert('transactions', {
        id: `tx_${Date.now()}`, fromId: sender.id, toId: recipient.id, fromName: sender.name, toName: recipient.name, fromEmail: sender.email, toEmail: recipient.email, amount: amount, type: 'p2p', message, timestamp: Date.now()
    });
};

export const issueEventCoins = async (token: string, email: string, amount: number, message: string) => {
    requireAuth(token, 'admin');
    const recipient = await db.find('registrations', (r: any) => r.email === email);
    if (!recipient) throw new Error("Recipient not found");
    await db.insert('transactions', { 
        id: `tx_${Date.now()}`, amount, message, timestamp: Date.now(), type: 'admin_adjustment', fromId: 'system', toId: recipient.id, fromName: 'Admin', toName: recipient.name, fromEmail: 'system', toEmail: email 
    });
};

export const createPaymentIntent = async (token: string, amount: number) => { 
    if (IS_ONLINE) {
        const res = await fetch('/api/payments/create-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ amount })
        });
        if (res.ok) return await res.json();
        throw new Error('Payment initialization failed');
    }
    requireAuth(token, 'delegate'); 
    return { clientSecret: 'mock_secret_offline' }; 
};

export const createPublicPaymentIntent = async (amount: number) => { 
    if (IS_ONLINE) {
        const res = await fetch('/api/payments/create-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        if (res.ok) return await res.json();
        throw new Error('Payment initialization failed');
    }
    return { clientSecret: 'mock_public_secret_no_auth' }; 
};

export const purchaseEventCoins = async (token: string, coins: number, cost: number) => {
    const payload = requireAuth(token, 'delegate');
    const user = await db.find('registrations', (r: any) => r.id === payload.id);
    await db.insert('transactions', {
        id: `tx_pur_${Date.now()}`, fromId: 'payment_gateway', toId: payload.id, fromName: 'Top Up', toName: user.name, fromEmail: 'system', toEmail: user.email, amount: coins, type: 'purchase', message: `Purchased for $${cost}`, timestamp: Date.now()
    });
};

export const recordTicketSale = async (eventId: string, tierId: string, amount: number) => {
    const tier = await db.find('ticket_tiers', (t: any) => t.id === tierId);
    if (tier) {
        await db.update('ticket_tiers', tierId, { sold: (tier.sold || 0) + 1 });
    }
    await db.insert('transactions', {
        id: `tx_sale_${Date.now()}`,
        fromId: 'guest',
        toId: 'system',
        fromName: 'Guest Purchaser',
        toName: 'Event System',
        fromEmail: 'guest',
        toEmail: 'system',
        amount: amount,
        type: 'purchase',
        message: `Ticket Sale: ${tier?.name || tierId}`,
        timestamp: Date.now()
    });
};

export const sendDelegateInvitation = async (token: string, eventId: string, email: string) => {
    requireAuth(token, 'admin');
    if (IS_ONLINE) return; 
    const inviteLink = `${window.location.origin}/register?inviteToken=mock_invite_${Date.now()}`;
    await mockSendEmail({ to: email, subject: 'You are invited!', body: `Click here to register: ${inviteLink}` }, await getEventConfig(eventId));
};

export const sendUpdateEmailToDelegate = async (token: string, eventId: string, delegateId: string) => { requireAuth(token, 'admin'); };

export const sendTestEmail = async (token: string, to: string, config: EventConfig) => {
    requireAuth(token, 'admin');
    if (IS_ONLINE) {
         const res = await fetch('/api/admin/communications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ to, subject: `Test Email: ${config.event.name}`, body: 'This is a test email.', channel: 'email', config })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to send test email');
        }
        return;
    }
    await mockSendEmail({ to, subject: `Test Email: ${config.event.name}`, body: 'Test OK' }, config);
};

export const sendBroadcast = async (token: string, subject: string, body: string, target: string, channel: string) => {
    requireAuth(token, 'admin');
    if (IS_ONLINE) {
        const res = await fetch('/api/admin/communications/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ subject, body, target, channel })
        });
        return await res.json();
    }
    await mockSendEmail({ to: 'all-delegates@example.com', subject: `[Broadcast] ${subject}`, body }, await getEventConfig());
    return { success: true, message: 'Broadcast queued (Offline Mock)' };
};

export const getEmailLogs = async (token: string) => {
    requireAuth(token, 'admin');
    if (IS_ONLINE) {
        const res = await fetch('/api/admin/communications/logs', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    return await db.findAll('email_logs');
};

export const getNotifications = async (token: string): Promise<AppNotification[]> => {
    if (IS_ONLINE) {
        const res = await fetch('/api/delegate/notifications', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    const payload = requireAuth(token, 'delegate');
    return await db.findAll('notifications', (n: any) => n.userId === payload.id);
};

export const markNotificationRead = async (token: string, id: string) => {
    if (IS_ONLINE) {
        await fetch(`/api/delegate/notifications/${id}/read`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
        return;
    }
    requireAuth(token, 'delegate');
    await db.update('notifications', id, { read: true });
};

export const clearAllNotifications = async (token: string) => {
    if (IS_ONLINE) {
        await fetch('/api/delegate/notifications', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        return;
    }
    const payload = requireAuth(token, 'delegate');
    await db.updateWhere('notifications', (n: any) => n.userId === payload.id, { read: true });
};

export const getConversations = async (token: string): Promise<ChatConversation[]> => {
    if (IS_ONLINE) {
        const res = await fetch('/api/delegate/conversations', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    const payload = requireAuth(token, 'delegate');
    const allMessages = await db.findAll('messages', (m: any) => m.senderId === payload.id || m.receiverId === payload.id);
    const conversationsMap = new Map<string, ChatConversation>();
    for (const msg of allMessages) {
        const otherId = msg.senderId === payload.id ? msg.receiverId : msg.senderId;
        const existing = conversationsMap.get(otherId);
        if (!existing || msg.timestamp > existing.lastTimestamp) {
            const otherUser = await db.find('registrations', (r: any) => r.id === otherId);
            const name = otherUser ? otherUser.name : 'Unknown';
            conversationsMap.set(otherId, {
                withUserId: otherId,
                withUserName: name,
                lastMessage: msg.content,
                lastTimestamp: msg.timestamp,
                unreadCount: (existing?.unreadCount || 0) + (!msg.read && msg.receiverId === payload.id ? 1 : 0)
            });
        } else if (!msg.read && msg.receiverId === payload.id) {
             existing.unreadCount += 1;
        }
    }
    return Array.from(conversationsMap.values()).sort((a, b) => b.lastTimestamp - a.lastTimestamp);
};

export const getMessages = async (token: string, otherId: string): Promise<ChatMessage[]> => {
    if (IS_ONLINE) {
        const res = await fetch(`/api/delegate/messages/${otherId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    const payload = requireAuth(token, 'delegate');
    const messages = await db.findAll('messages', (m: any) => 
        (m.senderId === payload.id && m.receiverId === otherId) || 
        (m.senderId === otherId && m.receiverId === payload.id)
    );
    const unread = messages.filter((m: any) => m.receiverId === payload.id && !m.read);
    for (const m of unread) {
        await db.update('messages', m.id, { read: true });
    }
    return messages.sort((a: any, b: any) => a.timestamp - b.timestamp);
};

export const sendMessage = async (token: string, receiverId: string, content: string) => {
    if (IS_ONLINE) {
        await fetch('/api/delegate/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ receiverId, content })
        });
        return;
    }
    const payload = requireAuth(token, 'delegate');
    await db.insert('messages', {
        id: `msg_${Date.now()}`, senderId: payload.id, receiverId, content, timestamp: Date.now(), read: false
    });
    await db.insert('notifications', {
        id: `notif_${Date.now()}`, userId: receiverId, type: 'info', title: 'New Message', message: `You have a new message from ${payload.email}`, timestamp: Date.now(), read: false
    });
};

export const getMediaLibrary = async (token: string): Promise<MediaItem[]> => { return await db.findAll('media'); };

export const uploadFile = async (file: File) => {
    if (IS_ONLINE) {
        return new Promise<MediaItem>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64String = reader.result as string;
                try {
                    const res = await fetch('/api/upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
                        body: JSON.stringify({ name: file.name, type: file.type, data: base64String })
                    });
                    if (!res.ok) throw new Error("Upload failed");
                    resolve(await res.json());
                } catch (e) {
                    reject(e);
                }
            };
            reader.onerror = () => reject(new Error("File reading failed"));
            reader.readAsDataURL(file);
        });
    }
    return await uploadFileToStorage(file);
};

export const deleteMedia = async (token: string, id: string) => {
    requireAuth(token, 'admin');
    await db.remove('media', id);
};

export const generateImage = async (prompt: string) => {
    if (!geminiService.generateImage) return "";
    const base64 = await geminiService.generateImage(prompt);
    const media = await saveGeneratedImageToStorage(base64);
    return media.url;
};

export const generateAiContent = async (type: string, context: any) => {
    if (!geminiService.generateAiContent) return "";
    return await geminiService.generateAiContent(type as any, context);
};

export const generateMarketingVideo = async (prompt: string, imageBase64?: string) => {
    if (!geminiService.generateMarketingVideo) return "";
    return await geminiService.generateMarketingVideo(prompt, imageBase64);
};

export const getEventContextForAI = async (token: string) => {
    const config = await getEventConfig();
    const sessions = await db.findAll('sessions');
    const speakers = await db.findAll('speakers');
    const restaurants = await db.findAll('restaurants');
    const sessionsText = sessions.map((s: any) => `- ${s.title} at ${new Date(s.startTime).toLocaleTimeString()} in ${s.location}`).join('\n');
    const speakersText = speakers.map((s: any) => `- ${s.name} (${s.company})`).join('\n');
    const diningText = restaurants.map((r: any) => `- ${r.name} (${r.cuisine}) open ${r.operatingHours}`).join('\n');
    return `Event: ${config.event.name}\nDate: ${config.event.date}\nLocation: ${config.event.location}\n\nAgenda:\n${sessionsText}\n\nSpeakers:\n${speakersText}\n\nDining Options:\n${diningText}`;
};

export const getScavengerHuntItems = async (token: string): Promise<ScavengerHuntItem[]> => {
    requireAuth(token, 'any'); 
    return await db.findAll('scavenger_hunt_items');
};
export const saveScavengerHuntItem = async (token: string, item: any) => {
    requireAuth(token, 'admin');
    if (item.id) await db.update('scavenger_hunt_items', item.id, item);
    else await db.insert('scavenger_hunt_items', { ...item, id: `hunt_${Date.now()}` });
};
export const deleteScavengerHuntItem = async (token: string, id: string) => {
    requireAuth(token, 'admin');
    await db.remove('scavenger_hunt_items', id);
};

export const getScavengerHuntLeaderboard = async (token: string): Promise<LeaderboardEntry[]> => {
    if (IS_ONLINE) {
        const res = await fetch('/api/admin/gamification/leaderboard', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    const allProgress = await db.findAll('scavenger_hunt_progress');
    const items = await db.findAll('scavenger_hunt_items');
    const users = await db.findAll('registrations');
    const userScores: Record<string, LeaderboardEntry> = {};
    for (const prog of allProgress) {
        if (!userScores[prog.userId]) {
            const user = users.find((u: any) => u.id === prog.userId);
            userScores[prog.userId] = { userId: prog.userId, name: user?.name || 'Unknown', itemsFound: 0, score: 0 };
        }
        const item = items.find((i: any) => i.id === prog.itemId);
        if (item) {
            userScores[prog.userId].itemsFound += 1;
            userScores[prog.userId].score += item.rewardAmount;
        }
    }
    return Object.values(userScores).sort((a, b) => b.score - a.score);
};

export const getScavengerHuntProgress = async (token: string): Promise<string[]> => {
    if (IS_ONLINE) {
        const res = await fetch('/api/delegate/gamification/progress', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    const payload = requireAuth(token, 'delegate');
    const prog = await db.findAll('scavenger_hunt_progress', (p: any) => p.userId === payload.id);
    return prog.map((p: any) => p.itemId);
};

export const claimScavengerHuntItem = async (token: string, code: string) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/delegate/gamification/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ code })
        });
        return await res.json();
    }
    const payload = requireAuth(token, 'delegate');
    const item = await db.find('scavenger_hunt_items', (i: any) => i.secretCode === code);
    if (!item) return { success: false, message: 'Invalid code' };
    const existing = await db.find('scavenger_hunt_progress', (p: any) => p.userId === payload.id && p.itemId === item.id);
    if (existing) return { success: false, message: 'Already claimed!' };
    await db.insert('scavenger_hunt_progress', { id: `prog_${Date.now()}`, userId: payload.id, itemId: item.id, timestamp: Date.now() });
    await issueEventCoins(token, payload.email, item.rewardAmount, `Found: ${item.name}`); 
    return { success: true, message: `Found ${item.name}! +${item.rewardAmount} Coins` };
};

export const getMyNetworkingProfile = async (token: string): Promise<NetworkingProfile | null> => {
    if (IS_ONLINE) {
        const res = await fetch('/api/delegate/networking/profile', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    const payload = requireAuth(token, 'delegate');
    return await db.find('networking_profiles', (p: any) => p.userId === payload.id);
};

export const updateNetworkingProfile = async (token: string, data: Partial<NetworkingProfile>) => {
    if (IS_ONLINE) {
        await fetch('/api/delegate/networking/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        return;
    }
    const payload = requireAuth(token, 'delegate');
    const existing = await db.find('networking_profiles', (p: any) => p.userId === payload.id);
    if (existing) {
        await db.update('networking_profiles', existing.id, data);
    } else {
        await db.insert('networking_profiles', { ...data, id: `np_${Date.now()}`, userId: payload.id });
    }
};

export const getNetworkingCandidates = async (token: string): Promise<{ matches: NetworkingMatch[], allCandidates: NetworkingProfile[] }> => {
    if (IS_ONLINE) {
        const res = await fetch('/api/delegate/networking/candidates', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    const payload = requireAuth(token, 'delegate');
    const allProfiles = await db.findAll('networking_profiles');
    const others = allProfiles.filter((p: any) => p.userId !== payload.id && p.isVisible);
    const candidates = await Promise.all(others.map(async (p: any) => {
        const user = await db.find('registrations', (r: any) => r.id === p.userId);
        return { ...p, name: user?.name || 'Unknown' };
    }));
    const matches = candidates.map(c => ({
        userId: c.userId,
        name: c.name,
        jobTitle: c.jobTitle,
        company: c.company,
        score: Math.floor(Math.random() * 40) + 60,
        reason: "Shared interest in technology events.",
        icebreaker: "Ask them about their role at " + c.company,
        profile: c
    }));
    return { matches, allCandidates: candidates };
};

export const getTicketTiers = async (token: string): Promise<TicketTier[]> => await db.findAll('ticket_tiers');
export const saveTicketTier = async (token: string, tier: any) => {
    requireAuth(token, 'admin');
    if (tier.id) await db.update('ticket_tiers', tier.id, tier);
    else await db.insert('ticket_tiers', { ...tier, id: `tier_${Date.now()}` });
};
export const deleteTicketTier = async (token: string, id: string) => {
    requireAuth(token, 'admin');
    await db.remove('ticket_tiers', id);
};

export const getVenueMaps = async (token: string): Promise<VenueMap[]> => await db.findAll('venueMaps');
export const saveVenueMap = async (token: string, map: any) => {
    requireAuth(token, 'admin');
    if (map.id) await db.update('venueMaps', map.id, map);
    else await db.insert('venueMaps', { ...map, id: `map_${Date.now()}` });
};
export const deleteVenueMap = async (token: string, id: string) => {
    requireAuth(token, 'admin');
    await db.remove('venueMaps', id);
};

export const getSignals = async (token: string, since: number) => {
    if (IS_ONLINE) {
        // Socket should handle this, but keeping polling endpoint for compat or fallback
        const res = await fetch(`/api/signal?since=${since}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    const payload = requireAuth(token, 'delegate');
    const signals = await db.findAll('signals', (s: any) => s.receiverId === payload.id && s.timestamp > since);
    return signals;
};

export const seedDemoData = async (token: string) => {
    requireAuth(token, 'admin');
    const speakers = [
        { id: 'spk_1', name: 'Dr. Alana Turing', title: 'Chief AI Scientist', company: 'NeuralNet', bio: 'Pioneer in generative models.', photoUrl: '' },
        { id: 'spk_2', name: 'James Webb', title: 'Space Engineer', company: 'Orbit Inc', bio: 'Building the future of space travel.', photoUrl: '' },
        { id: 'spk_3', name: 'Sarah Connor', title: 'Security Analyst', company: 'Skynet Prevention', bio: 'Expert in cyber defense systems.', photoUrl: '' }
    ];
    for (const s of speakers) { await saveSpeaker(token, s); }
    const sessions = [
        { id: 'sess_1', title: 'The Future of AI', description: 'Deep dive into LLMs.', startTime: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(), endTime: new Date(new Date().setHours(11, 0, 0, 0)).toISOString(), location: 'Main Hall', speakerIds: ['spk_1'], track: 'AI' },
        { id: 'sess_2', title: 'Mars Colonization', description: 'Logistics of a new world.', startTime: new Date(new Date().setHours(11, 30, 0, 0)).toISOString(), endTime: new Date(new Date().setHours(12, 30, 0, 0)).toISOString(), location: 'Room A', speakerIds: ['spk_2'], track: 'Space' },
        { id: 'sess_3', title: 'Cybersecurity 101', description: 'Protecting your data.', startTime: new Date(new Date().setHours(14, 0, 0, 0)).toISOString(), endTime: new Date(new Date().setHours(15, 0, 0, 0)).toISOString(), location: 'Room B', speakerIds: ['spk_3'], track: 'Security' }
    ];
    for (const s of sessions) { await saveSession(token, s); }
    const restaurants = [
        { id: 'rest_1', name: 'The Gourmet Byte', cuisine: 'Fusion', operatingHours: '11am - 10pm', menu: 'Tacos, Sushi, Burgers' },
        { id: 'rest_2', name: 'Silicon Café', cuisine: 'Coffee & Pastries', operatingHours: '7am - 5pm', menu: 'Latte, Croissant, Espresso' }
    ];
    for (const r of restaurants) { await saveRestaurant(token, r); }
    const hotel = { id: 'htl_1', name: 'Grand Plaza', address: '123 Tech Blvd', description: 'Luxury stay.', roomTypes: [{ id: 'rt_1', name: 'Standard', description: 'Cozy room', capacity: 2, totalRooms: 50, costPerNight: 100, amenities: ['Wifi'] }] };
    await saveHotel(token, hotel);
    await generateHotelRooms(token, hotel.id, 'rt_1', 10, 101);
    const sponsors = [
        { id: 'spo_1', name: 'CloudScale', description: 'Scalable cloud infrastructure.', websiteUrl: 'https://example.com', logoUrl: '', tier: 'Platinum' },
        { id: 'spo_2', name: 'DevTools Co', description: 'Best tools for developers.', websiteUrl: 'https://example.com', logoUrl: '', tier: 'Gold' }
    ];
    for (const s of sponsors) { await saveSponsor(token, s); }
    return true;
};

export const checkSessionConflicts = async (token: string, session: Partial<Session>): Promise<string[]> => {
    return [];
};

export const getDelegateProfile = async (token: string) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/delegate/profile', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) return await res.json();
    }
    const payload = requireAuth(token, 'delegate');
    const user = await db.find('registrations', (r: any) => r.id === payload.id);
    return { user };
};

export const updateDelegateProfile = async (token: string, data: Partial<RegistrationData>) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/delegate/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (res.ok) return await res.json();
    }
    const payload = requireAuth(token, 'delegate');
    return await db.update('registrations', payload.id, data);
};
