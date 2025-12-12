
import * as db from './db';
import * as auth from './auth';
import * as emailService from './email';
import * as geminiService from './geminiService';
import { defaultConfig } from './config';
import { uploadFileToStorage } from './storage';
import { 
    EventConfig, RegistrationData, AdminUser, Role, Session, Speaker, Sponsor, 
    Task, MealPlan, Restaurant, Hotel, RoomType, HotelRoom, AccommodationBooking,
    TicketTier, Transaction, NetworkingProfile, ScavengerHuntItem, MediaItem, 
    VenueMap, EmailPayload, Permission, DiningReservation, SessionQuestion,
    Poll, PollWithResults, ChatMessage, AppNotification, NetworkingMatch, EnrichedAccommodationBooking
} from '../types';
import { io } from 'socket.io-client';

export let IS_ONLINE = false;
let socket: any = null;

// --- System & Auth ---

export const initializeApi = async (forceOnline = false): Promise<boolean> => {
    try {
        await db.initializeDb();
        
        // Try to connect to backend
        try {
            const res = await fetch('/api/health');
            if (res.ok) {
                IS_ONLINE = true;
                db.setBackendAvailable(true);
                // Sync initial state from backend
                await db.syncWithBackend();
                initializeSocket();
            }
        } catch (e) {
            console.log("Backend offline, running in browser mode.");
            IS_ONLINE = false;
            db.setBackendAvailable(false);
        }
        
        if (forceOnline) {
            IS_ONLINE = true;
            db.setBackendAvailable(true);
        }
        return IS_ONLINE;
    } catch (e) {
        return false;
    }
};

const initializeSocket = () => {
    if (socket) return;
    
    socket = io('/', {
        path: '/socket.io',
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.log('Socket connected:', socket?.id);
        socket?.emit('join', 'main-event');
    });

    // Bridge Socket Events to Local State
    socket.on('refresh:data', (payload: { table: string }) => {
        // Fetch fresh data for this table from backend to ensure consistency
        db.fetchTableFromBackend(payload.table);
    });

    socket.on('refresh:registrations', () => {
        db.fetchTableFromBackend('registrations');
    });
    
    socket.on('refresh:messages', (msg: any) => {
        db.fetchTableFromBackend('messages');
    });
    
    socket.on('refresh:polls', () => {
        db.fetchTableFromBackend('polls');
        db.fetchTableFromBackend('poll_votes');
    });
    
    socket.on('refresh:wallet', () => {
        db.fetchTableFromBackend('transactions');
    });
    
    socket.on('refresh:gamification', () => {
        db.fetchTableFromBackend('scavenger_hunt_progress');
        // Leaderboard re-fetch handled by component query invalidation or manual refresh
    });
    
    socket.on('signal', (payload: any) => {
        // Handled via subscription
    });
};

export const isBackendConnected = () => IS_ONLINE;
export const setForceOffline = () => { 
    IS_ONLINE = false; 
    db.setBackendAvailable(false);
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

const requireAuth = (token: string, type: 'admin' | 'delegate' = 'admin') => {
    const payload = auth.verifyToken(token);
    if (!payload) throw new Error("Invalid or expired token");
    if (type === 'admin' && payload.type !== 'admin') throw new Error("Admin access required");
    return payload;
};

// --- Config Merger ---
const mergeWithDefault = (config: any): EventConfig => {
    const base = defaultConfig; // Ensure defaults are used as base
    if (!config) return base;
    return {
        ...base,
        ...config,
        event: { ...base.event, ...(config.event || {}) },
        host: { ...base.host, ...(config.host || {}) },
        theme: { ...base.theme, ...(config.theme || {}) },
        emailTemplates: { ...base.emailTemplates, ...(config.emailTemplates || {}) },
        smtp: { ...base.smtp, ...(config.smtp || {}) },
        googleConfig: { ...base.googleConfig, ...(config.googleConfig || {}) },
        badgeConfig: { ...base.badgeConfig, ...(config.badgeConfig || {}) },
        eventCoin: { ...base.eventCoin, ...(config.eventCoin || {}) },
        githubSync: { ...base.githubSync, ...(config.githubSync || {}) },
        whatsapp: { ...base.whatsapp, ...(config.whatsapp || {}) },
        telegram: { ...base.telegram, ...(config.telegram || {}) },
        sms: { ...base.sms, ...(config.sms || {}) },
        aiConcierge: { ...base.aiConcierge, ...(config.aiConcierge || {}) },
        // Arrays are typically overwritten, not merged deeply by index
        formFields: config.formFields || base.formFields
    };
};

// --- Auth Functions ---

export const loginAdmin = async (email: string, password_input: string) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/auth/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: password_input })
        });
        if (res.ok) {
            return await res.json();
        }
        return null;
    } else {
        // Fallback Mock Logic
        const users = await db.findAll('admin_users', (u) => u.email === email);
        const user = users[0];
        if (user && await auth.comparePassword(password_input, user.password_hash)) {
            const role = await db.find('roles', (r) => r.id === user.roleId);
            const token = auth.generateToken({
                id: user.id,
                email: user.email,
                type: 'admin',
                permissions: role ? role.permissions : []
            });
            return { token, user: { ...user, permissions: role ? role.permissions : [] } };
        }
        return null;
    }
};

export const loginDelegate = async (eventId: string, email: string, password_input: string) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/auth/delegate/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId, email, password: password_input })
        });
        if (res.ok) {
            return await res.json();
        }
        return null;
    } else {
        // Fallback Mock Logic
        const users = await db.findAll('registrations', (u) => u.email === email && (!u.eventId || u.eventId === eventId));
        const user = users[0];
        if (user) {
            // For mock mode, accept any password or check a mock field if added
            const token = auth.generateToken({
                id: user.id,
                email: user.email,
                type: 'delegate',
                eventId
            });
            return { token, user };
        }
        return null;
    }
};

export const requestAdminPasswordReset = async (email: string) => { return true; };
export const requestDelegatePasswordReset = async (eventId: string, email: string) => { return true; };
export const resetPassword = async (token: string, password: string) => { return true; };
export const getSystemApiKey = async (token: string) => { return "mock-api-key-12345"; };

// ... (Database schema/export functions) ...
export const getDatabaseSchema = async (token: string) => { return "CREATE TABLE events (...);"; };
export const generateSqlExport = async (token: string) => { return "INSERT INTO events ..."; };
export const seedDemoData = async (token: string) => { return true; };

// --- Config ---
export const getEventConfig = async (eventId = 'main-event'): Promise<EventConfig> => {
    const event = await db.find('events', e => e.id === eventId);
    // Use robust merger to prevent undefined property errors
    return mergeWithDefault(event?.config);
};

export const saveConfig = async (token: string, config: EventConfig) => {
    const payload = requireAuth(token, 'admin');
    await db.updateWhere('events', e => e.id === 'main-event', { config });
    return config;
};

export const syncConfigFromGitHub = async (token: string) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/admin/config/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Sync failed");
        }
        return await res.json();
    } else {
        // Offline / Browser Mode
        const event = await db.find('events', e => e.id === 'main-event');
        const url = event?.config?.githubSync?.configUrl;
        
        if (!url) throw new Error("No URL configured.");
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch remote config.");
            const remoteConfig = await response.json();
            
            // Merge remote config
            const newConfig = { ...event.config, ...remoteConfig };
             newConfig.githubSync = {
                ...newConfig.githubSync,
                lastSyncTimestamp: Date.now(),
                lastSyncStatus: 'success'
            };
            
            await db.updateWhere('events', e => e.id === 'main-event', { config: newConfig });
            return newConfig;
        } catch (e) {
             // Update status failure
             if (event && event.config) {
                 const newConfig = { ...event.config };
                 newConfig.githubSync = {
                    ...newConfig.githubSync,
                    lastSyncTimestamp: Date.now(),
                    lastSyncStatus: 'failed'
                };
                await db.updateWhere('events', e => e.id === 'main-event', { config: newConfig });
             }
             throw e;
        }
    }
};

// --- Events ---
export const listPublicEvents = async () => {
    const events = await db.findAll('events');
    return events.map(e => {
        const safeConfig = mergeWithDefault(e.config);
        return {
            id: e.id,
            name: e.name,
            date: safeConfig.event.date || 'Date TBD',
            location: safeConfig.event.location || 'Location TBD',
            logoUrl: safeConfig.theme.logoUrl,
            colorPrimary: safeConfig.theme.colorPrimary,
            config: safeConfig
        };
    });
};

export const createEvent = async (token: string, name: string, type: string) => {
    const newEvent = {
        id: `event_${Date.now()}`,
        name,
        eventType: type,
        created_at: Date.now(),
        config: { ...defaultConfig, event: { ...defaultConfig.event, name } }
    };
    await db.insert('events', newEvent);
    return newEvent;
};

export const getPublicEventData = async (eventId: string) => {
    const event = await db.find('events', e => e.id === eventId);
    const sessions = await db.findAll('sessions', s => !s.eventId || s.eventId === eventId);
    const speakers = await db.findAll('speakers', s => !s.eventId || s.eventId === eventId);
    const sponsors = await db.findAll('sponsors', s => !s.eventId || s.eventId === eventId);
    const ticketTiers = await db.findAll('ticket_tiers', t => (!t.eventId || t.eventId === eventId) && t.active);
    const regCount = await db.count('registrations', r => (!r.eventId || r.eventId === eventId));
    
    return {
        event: event,
        config: mergeWithDefault(event?.config),
        sessions,
        speakers,
        sponsors,
        ticketTiers,
        registrationCount: regCount
    };
};

export const getPublicSessionData = async (sessionId: string) => {
    if (IS_ONLINE) {
        const res = await fetch(`/api/public/sessions/${sessionId}/live-data`);
        if (!res.ok) throw new Error("Failed to load session data");
        return await res.json();
    }
    // Offline
    const session = await db.find('sessions', s => s.id === sessionId);
    // Use tokenless or mock token call for public data
    const polls = await getPolls('mock-token', sessionId);
    const questions = await getSessionQuestions('mock-token', sessionId);
    return { session, polls, questions };
};

// ... (User/Role management) ...
export const getAdminUsers = async (token: string) => { return db.findAll('admin_users'); };
export const saveAdminUser = async (token: string, user: any) => {
    if (user.id) await db.update('admin_users', user.id, user);
    else await db.insert('admin_users', { ...user, id: `user_${Date.now()}` });
};
export const deleteAdminUser = async (token: string, id: string) => { await db.remove('admin_users', id); };
export const getRoles = async (token: string) => { return db.findAll('roles'); };
export const saveRole = async (token: string, role: any) => {
    if (role.id) await db.update('roles', role.id, role);
    else await db.insert('roles', { ...role, id: `role_${Date.now()}` });
};
export const deleteRole = async (token: string, id: string) => { await db.remove('roles', id); };

// --- Registrations ---
export const getRegistrations = async (token: string) => { return db.findAll('registrations'); };

export const registerUser = async (eventId: string, data: RegistrationData, inviteToken?: string) => {
    if (IS_ONLINE) {
        const res = await fetch(`/api/events/${eventId}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    } else {
        // Offline Fallback
        const existing = await db.find('registrations', r => r.email === data.email);
        if (existing) return { success: false, message: 'Email already registered.' };
        
        const newUser = {
            ...data,
            id: `reg_${Date.now()}`,
            eventId,
            createdAt: Date.now(),
            status: data.status || 'confirmed'
        };
        await db.insert('registrations', newUser);
        return { success: true, user: newUser };
    }
};

export const triggerRegistrationEmails = async (eventId: string, user: RegistrationData) => {
    // Handled by backend in registerUser if online
    if (IS_ONLINE) return;

    console.log("Offline: Simulating email trigger.");
    try {
        const config = await getEventConfig(eventId);
        
        // Ensure user.id is available, fallback to a unique string if missing (should not happen if flow is correct)
        const uniqueId = user.id || `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        // Generate QR URL - in a real scenario this might point to a validation endpoint
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(uniqueId)}`;
        const verificationLink = `${window.location.origin}/verify/${uniqueId}`; // Mock verification link

        // Generate email content using Gemini
        console.log(`Generating registration emails with AI for ${user.email}. QR Data: ${uniqueId}`);
        const emails = await geminiService.generateRegistrationEmails(user, config, verificationLink, qrCodeUrl);
        
        // Send User Email
        if (emails && emails.userEmail) {
            await emailService.sendEmail({
                to: user.email,
                subject: emails.userEmail.subject,
                body: emails.userEmail.body
            }, config);
        }

        // Send Host Notification
        if (emails && emails.hostEmail) {
            await emailService.sendEmail({
                to: config.host.email,
                subject: emails.hostEmail.subject,
                body: emails.hostEmail.body
            }, config);
        }
        
    } catch (error) {
        console.error("Failed to trigger registration emails:", error);
    }
};

export const getInvitationDetails = async (token: string) => { return { eventId: 'main-event', inviteeEmail: 'invited@example.com' }; };
export const updateRegistrationStatus = async (token: string, id: string, status: string) => { await db.update('registrations', id, { status }); };
export const deleteAdminRegistration = async (token: string, id: string) => { await db.remove('registrations', id); };
export const promoteToConfirmed = async (token: string, id: string) => { await db.update('registrations', id, { status: 'confirmed' }); };
export const verifyTicketToken = async (token: string, ticketToken: string) => {
    const reg = await db.find('registrations', r => ticketToken.includes(r.id) || r.id === ticketToken);
    if (reg) {
        await db.update('registrations', reg.id, { checkedIn: true });
        return { success: true, message: `Checked in ${reg.name}`, user: reg };
    }
    return { success: false, message: "Invalid ticket" };
};
export const processCheckIn = async (token: string, qrData: string) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/admin/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ qrData })
        });
        return await res.json();
    }
    return verifyTicketToken(token, qrData);
};
export const getSignedTicketToken = async (token: string) => {
    const payload = requireAuth(token, 'delegate');
    return `SIGNED_TICKET_${payload.id}`;
};

export const bulkImportRegistrations = async (token: string, csvData: string) => {
    // Split lines handling both LF and CRLF
    const lines = csvData.split(/\r?\n/);
    let successCount = 0;
    
    // Auto-detect delimiter: check first non-empty line
    const firstLine = lines.find(l => l.trim().length > 0) || '';
    const delimiter = firstLine.includes('\t') ? '\t' : ',';

    // Basic Header Check (optional, here we assume order or simple heuristic)
    // If user pastes from Excel, it might not have headers, or it might.
    // We assume 1st line is header if it contains "name" or "email"
    let startIndex = 0;
    if (firstLine.toLowerCase().includes('name') || firstLine.toLowerCase().includes('email')) {
        startIndex = 1;
    }

    const errors = [];

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Correctly split and clean quotes
        const parts = line.split(delimiter).map(s => s.trim().replace(/^"|"$/g, '')); 
        
        if (parts.length >= 2) {
            const name = parts[0];
            const email = parts[1];
            // Optional columns (company, role) can be processed here if needed
            
            if (name && email && email.includes('@')) {
                // Check dupes first to avoid partial failures
                const existing = await db.find('registrations', r => r.email === email);
                if (!existing) {
                    await registerUser('main-event', { name, email, createdAt: Date.now() });
                    successCount++;
                } else {
                    errors.push(`Skipped ${email}: Already registered.`);
                }
            } else {
                errors.push(`Skipped line ${i + 1}: Invalid format.`);
            }
        }
    }
    return { successCount, errorCount: errors.length, errors };
};

export const sendDelegateInvitation = async (token: string, eventId: string, email: string) => {
    // In online mode, we'd call a specific backend endpoint
    if (IS_ONLINE) {
        await fetch('/api/admin/communications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ to: email, subject: 'Invitation', body: 'You are invited!' }) // Simplified
        });
    } else {
        console.log(`[Offline Simulation] Sending invitation email to ${email}`);
    }
};
export const getDelegateProfile = async (token: string) => {
    const payload = requireAuth(token, 'delegate');
    const user = await db.find('registrations', r => r.id === payload.id);
    return { user };
};
export const updateDelegateProfile = async (token: string, data: Partial<RegistrationData>) => {
    const payload = requireAuth(token, 'delegate');
    await db.update('registrations', payload.id, data);
    return db.find('registrations', r => r.id === payload.id);
};

// Updated Cancel with Logic
export const cancelRegistration = async (token: string, id: string) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/registrations/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id })
        });
        if (!res.ok) throw new Error("Failed to cancel");
        return await res.json();
    }
    
    // Offline Mock with Auto-Promotion Logic
    const reg = await db.find('registrations', r => r.id === id);
    if (reg) {
        const wasConfirmed = reg.status === 'confirmed';
        await db.update('registrations', id, { status: 'cancelled' });
        
        if (wasConfirmed) {
            // Find waitlisted users for this event
            const allRegs = await db.findAll('registrations');
            const waitlisted = allRegs
                .filter(r => r.eventId === reg.eventId && r.status === 'waitlist')
                .sort((a, b) => a.createdAt - b.createdAt);
            
            if (waitlisted.length > 0) {
                const nextUser = waitlisted[0];
                await db.update('registrations', nextUser.id, { status: 'confirmed' });
                // In offline mode, we just log the promotion
                console.log(`[Offline Simulation] Auto-promoted ${nextUser.name} from waitlist.`);
                return { 
                    success: true, 
                    message: `Cancelled. Auto-promoted ${nextUser.name} from waitlist (Offline Simulation).` 
                };
            }
        }
    }
    
    return { success: true, message: "Cancelled (Offline Mode)" };
};

export const sendUpdateEmailToDelegate = async (token: string, eventId: string, delegateId: string) => {
    // Handled by backend if needed, or simple simulation
};
export const saveAdminRegistration = async (token: string, id: string, updates: any) => { await db.update('registrations', id, updates); };

// ... (Ticketing, Agenda, etc. - keep existing implementations which route via db.ts) ...
export const getTicketTiers = async (token: string) => { return db.findAll('ticket_tiers'); };
export const saveTicketTier = async (token: string, tier: any) => {
    if (tier.id) await db.update('ticket_tiers', tier.id, tier);
    else await db.insert('ticket_tiers', { ...tier, id: `tier_${Date.now()}` });
};
export const deleteTicketTier = async (token: string, id: string) => { await db.remove('ticket_tiers', id); };
export const recordTicketSale = async (eventId: string, tierId: string, amount: number) => {
    if (IS_ONLINE) {
        const adminToken = localStorage.getItem('adminToken'); 
        await fetch('/api/admin/sales/record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {}) },
            body: JSON.stringify({ eventId, tierId, amount })
        });
        return;
    }
    const tier = await db.find('ticket_tiers', t => t.id === tierId);
    if (tier) await db.update('ticket_tiers', tierId, { sold: (tier.sold || 0) + 1 });
};

export const getSessions = async (token: string) => { return db.findAll('sessions'); };
export const saveSession = async (token: string, session: any) => {
    if (session.id) await db.update('sessions', session.id, session);
    else await db.insert('sessions', { ...session, id: `sess_${Date.now()}` });
};
export const deleteSession = async (token: string, id: string) => { await db.remove('sessions', id); };
export const getSpeakers = async (token: string) => { return db.findAll('speakers'); };
export const saveSpeaker = async (token: string, speaker: any) => {
    if (speaker.id) await db.update('speakers', speaker.id, speaker);
    else await db.insert('speakers', { ...speaker, id: `spk_${Date.now()}` });
};
export const deleteSpeaker = async (token: string, id: string) => { await db.remove('speakers', id); };
export const getSponsors = async (token: string) => { return db.findAll('sponsors'); };
export const saveSponsor = async (token: string, sponsor: any) => {
    if (sponsor.id) await db.update('sponsors', sponsor.id, sponsor);
    else await db.insert('sponsors', { ...sponsor, id: `sponsor_${Date.now()}` });
};
export const deleteSponsor = async (token: string, id: string) => { await db.remove('sponsors', id); };
export const getMyAgenda = async (token: string) => {
    const payload = requireAuth(token, 'delegate');
    const entry = await db.find('agenda_entries', e => e.userId === payload.id);
    return entry ? entry.sessionIds : [];
};
export const addToAgenda = async (token: string, sessionId: string) => {
    const payload = requireAuth(token, 'delegate');
    let entry = await db.find('agenda_entries', e => e.userId === payload.id);
    if (!entry) {
        entry = { userId: payload.id, sessionIds: [] };
        await db.insert('agenda_entries', entry);
    }
    if (!entry.sessionIds.includes(sessionId)) {
        entry.sessionIds.push(sessionId);
        await db.updateWhere('agenda_entries', e => e.userId === payload.id, { sessionIds: entry.sessionIds });
    }
};
export const removeFromAgenda = async (token: string, sessionId: string) => {
    const payload = requireAuth(token, 'delegate');
    let entry = await db.find('agenda_entries', e => e.userId === payload.id);
    if (entry) {
        entry.sessionIds = entry.sessionIds.filter((id: string) => id !== sessionId);
        await db.updateWhere('agenda_entries', e => e.userId === payload.id, { sessionIds: entry.sessionIds });
    }
};
export const submitSessionFeedback = async (token: string, sessionId: string, rating: number, comment: string) => {
    const payload = requireAuth(token, 'delegate');
    await db.insert('session_feedback', { sessionId, userId: payload.id, rating, comment, timestamp: Date.now() });
};
export const getSessionFeedbackStats = async (token: string, sessionId: string) => {
    const feedback = await db.findAll('session_feedback', f => f.sessionId === sessionId);
    const count = feedback.length;
    const avgRating = count > 0 ? feedback.reduce((sum, f) => sum + f.rating, 0) / count : 0;
    return { count, avgRating };
};
export const analyzeFeedback = async (token: string, sessionId: string) => {
    const feedback = await db.findAll('session_feedback', f => f.sessionId === sessionId);
    const comments = feedback.map(f => f.comment).filter(Boolean);
    const session = await db.find('sessions', s => s.id === sessionId);
    return await geminiService.summarizeSessionFeedback(session?.title || 'Session', comments);
};
export const downloadSessionIcs = async (session: Session) => {
    const content = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${session.title}
DTSTART:${session.startTime.replace(/[-:]/g, '')}
DTEND:${session.endTime.replace(/[-:]/g, '')}
LOCATION:${session.location}
DESCRIPTION:${session.description}
END:VEVENT
END:VCALENDAR`;
    const blob = new Blob([content], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${session.title}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
export const getSessionQuestions = async (token: string, sessionId: string) => { return db.findAll('session_questions', q => q.sessionId === sessionId); };
export const submitSessionQuestion = async (token: string, sessionId: string, text: string) => {
    const payload = requireAuth(token, 'delegate');
    const user = await db.find('registrations', r => r.id === payload.id);
    await db.insert('session_questions', {
        id: `q_${Date.now()}`, sessionId, userId: payload.id, userName: user?.name || 'Anonymous', text, upvotes: 0, timestamp: Date.now(), isAnswered: false
    });
};
export const upvoteSessionQuestion = async (token: string, questionId: string) => {
    const q = await db.find('session_questions', q => q.id === questionId);
    if (q) await db.update('session_questions', questionId, { upvotes: (q.upvotes || 0) + 1 });
};
export const getPolls = async (token: string, sessionId: string): Promise<PollWithResults[]> => {
    let userId = 'anonymous';
    try {
        const payload = requireAuth(token, 'delegate');
        userId = payload.id;
    } catch (e) { 
        // Allow mock token or anonymous for projector
    }

    const polls = await db.findAll('polls', p => p.sessionId === sessionId);
    const votes = await db.findAll('poll_votes', v => polls.some(p => p.id === v.pollId));
    return polls.map(p => {
        const pVotes = votes.filter(v => v.pollId === p.id);
        const voteCounts = new Array(p.options.length).fill(0);
        pVotes.forEach(v => {
            if (v.optionIndex >= 0 && v.optionIndex < voteCounts.length) voteCounts[v.optionIndex]++;
        });
        const myVote = pVotes.find(v => v.userId === userId);
        return { ...p, votes: voteCounts, totalVotes: pVotes.length, userVotedIndex: myVote?.optionIndex };
    });
};
export const createPoll = async (token: string, sessionId: string, question: string, options: string[]) => {
    await db.insert('polls', {
        id: `poll_${Date.now()}`, sessionId, question, options, status: 'draft', createdAt: Date.now()
    });
};
export const updatePollStatus = async (token: string, pollId: string, status: 'active' | 'closed') => {
    await db.update('polls', pollId, { status });
};
export const votePoll = async (token: string, pollId: string, optionIndex: number) => {
    const payload = requireAuth(token, 'delegate');
    const existing = await db.find('poll_votes', v => v.pollId === pollId && v.userId === payload.id);
    if (existing) throw new Error("Already voted");
    await db.insert('poll_votes', {
        id: `vote_${Date.now()}`, pollId, userId: payload.id, optionIndex, timestamp: Date.now()
    });
    
    // Notify socket if online (handled in backend insert/update usually, but explicit emit helps)
    if (IS_ONLINE && socket) {
        socket.emit('poll:vote', { pollId, optionIndex });
    }
};

export const getTasks = async (token: string, eventId: string) => db.findAll('tasks', t => t.eventId === eventId);
export const saveTask = async (token: string, task: any) => { if(task.id) await db.update('tasks', task.id, task); else await db.insert('tasks', {...task, id: `task_${Date.now()}`}); };
export const deleteTask = async (token: string, id: string) => db.remove('tasks', id);

export const getMealPlans = async (token: string) => db.findAll('meal_plans');
export const saveMealPlan = async (token: string, p: any) => { if(p.id) await db.update('meal_plans', p.id, p); else await db.insert('meal_plans', {...p, id: `mp_${Date.now()}`}); };
export const deleteMealPlan = async (token: string, id: string) => db.remove('meal_plans', id);
export const getRestaurants = async (token: string) => db.findAll('restaurants');
export const saveRestaurant = async (token: string, r: any) => { if(r.id) await db.update('restaurants', r.id, r); else await db.insert('restaurants', {...r, id: `rest_${Date.now()}`}); };
export const deleteRestaurant = async (token: string, id: string) => db.remove('restaurants', id);
export const assignMealPlan = async (token: string, mpId: string, s: string, e: string) => { const p = requireAuth(token, 'delegate'); await db.insert('meal_plan_assignments', {id: `mpa_${Date.now()}`, delegateId: p.id, mealPlanId: mpId, startDate: s, endDate: e}); };
export const recordMealConsumption = async (token: string, did: string, type: string) => ({ success: true, message: 'Recorded' });
export const makeDiningReservation = async (token: string, rid: string, time: string, size: number) => { const p = requireAuth(token, 'delegate'); await db.insert('dining_reservations', {id: `dr_${Date.now()}`, restaurantId: rid, delegateId: p.id, reservationTime: time, partySize: size, delegateName: 'User'}); };
export const getReservationsForRestaurant = async (token: string, rid: string) => db.findAll('dining_reservations', r => r.restaurantId === rid);
export const createAdminDiningReservation = async (token: string, d: any) => db.insert('dining_reservations', {id: `dr_${Date.now()}`, ...d});
export const deleteDiningReservation = async (token: string, id: string) => db.remove('dining_reservations', id);

export const getHotels = async (token: string) => db.findAll('hotels');
export const saveHotel = async (token: string, h: any) => { if(h.id) await db.update('hotels', h.id, h); else await db.insert('hotels', {...h, id: `h_${Date.now()}`}); };
export const deleteHotel = async (token: string, id: string) => db.remove('hotels', id);
export const generateHotelRooms = async (token: string, hid: string, rtid: string, c: number, s: number) => { for(let i=0; i<c; i++) await db.insert('rooms', {id:`r_${Date.now()}_${i}`, hotelId: hid, roomTypeId: rtid, roomNumber: `${s+i}`, status: 'Available'}); };
export const getAllRooms = async (token: string, hid: string) => db.findAll('rooms', r => r.hotelId === hid);
export const getAvailableRooms = async (token: string, hid: string, rtid: string) => db.findAll('rooms', r => r.hotelId === hid && r.roomTypeId === rtid && r.status === 'Available');
export const updateRoomStatus = async (token: string, rid: string, s: string) => db.update('rooms', rid, { status: s });
export const getAccommodationBookings = async (token: string) => {
    const bookings = await db.findAll('accommodation_bookings');
    return bookings.map(b => ({...b, delegateName: 'User', hotelName: 'Hotel'})); 
};
export const createAdminAccommodationBooking = async (token: string, did: string, hid: string, rtid: string, cin: string, cout: string) => db.insert('accommodation_bookings', {id: `ab_${Date.now()}`, delegateId: did, hotelId: hid, roomTypeId: rtid, checkInDate: cin, checkOutDate: cout, status: 'Confirmed'});
export const updateBookingStatus = async (token: string, id: string, s: string) => db.update('accommodation_bookings', id, { status: s });
export const assignRoomToBooking = async (token: string, bid: string, rid: string) => { await db.update('accommodation_bookings', bid, { hotelRoomId: rid, status: 'CheckedIn' }); await db.update('rooms', rid, { status: 'Occupied' }); };
export const processCheckOut = async (token: string, bid: string) => { await db.update('accommodation_bookings', bid, { status: 'CheckedOut' }); };
export const bookAccommodation = async (token: string, hid: string, rtid: string, cin: string, cout: string) => { const p = requireAuth(token, 'delegate'); await db.insert('accommodation_bookings', {id: `ab_${Date.now()}`, delegateId: p.id, hotelId: hid, roomTypeId: rtid, checkInDate: cin, checkOutDate: cout, status: 'Confirmed'}); };
export const cancelAccommodationBooking = async (token: string, id: string) => db.update('accommodation_bookings', id, { status: 'Cancelled' });
export const selfCheckOut = async (token: string, id: string) => db.update('accommodation_bookings', id, { status: 'CheckedOut' });

// --- Economy & Wallet ---

export const getDelegateBalance = async (token: string) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/delegate/wallet', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) return await res.json();
    }
    // Offline / Mock
    return { balance: 100, currencyName: 'EventCoin' };
};

export const getDelegateTransactions = async (token: string) => {
    if (IS_ONLINE) {
        // We can just query the wallet transactions if the endpoint returns them, 
        // but currently /api/delegate/wallet returns { balance, currencyName }.
        // For now, let's fetch all transactions relevant to the user via generic sync 
        // or a specific endpoint if we added one. 
        // We added logic in calculateBalance but not a separate list endpoint.
        // Let's rely on local DB sync for the list which is populated by 'refresh:wallet'
        const payload = requireAuth(token, 'delegate');
        const allTx = await db.findAll('transactions');
        return allTx.filter((t: any) => t.fromId === payload.id || t.toId === payload.id);
    }
    return db.findAll('transactions');
};

export const sendCoins = async (token: string, email: string, amt: number, msg: string) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/delegate/wallet/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ recipientEmail: email, amount: amt, message: msg })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Transfer failed');
        }
        return await res.json();
    } else {
        const p = requireAuth(token, 'delegate');
        await db.insert('transactions', {id: `tx_${Date.now()}`, fromId: p.id, amount: amt, message: msg, timestamp: Date.now()});
    }
};

export const purchaseEventCoins = async (token: string, coins: number, cost: number) => {
    if (IS_ONLINE) {
        await fetch('/api/delegate/wallet/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ amount: coins, cost })
        });
    } else {
        const p = requireAuth(token, 'delegate');
        await db.insert('transactions', {id: `tx_${Date.now()}`, fromId: 'system', toId: p.id, amount: coins, type: 'purchase', timestamp: Date.now()});
    }
};

export const createPaymentIntent = async (token: string, amt: number) => ({ clientSecret: 'mock_secret' });
export const createPublicPaymentIntent = async (amt: number) => ({ clientSecret: 'mock_secret' });
export const getEventCoinStats = async (token: string) => ({ totalCirculation: 1000, totalTransactions: 10, activeWallets: 5, eventCoinName: 'EventCoin' });
export const getAllTransactions = async (token: string) => db.findAll('transactions');
export const issueEventCoins = async (token: string, email: string, amt: number, msg: string) => { await db.insert('transactions', {id: `tx_${Date.now()}`, fromId: 'admin', amount: amt, message: msg, timestamp: Date.now()}); };
export const getDashboardStats = async (token: string) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/admin/dashboard', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) return await res.json();
    }
    
    // Offline Fallback
    return { 
        totalRegistrations: await db.count('registrations'), 
        maxAttendees: 500, 
        eventDate: 'Oct 26', 
        registrationTrend: [], 
        taskStats: {total:0,completed:0,pending:0}, 
        recentRegistrations: [], 
        eventCoinName: 'EC', 
        eventCoinCirculation: 0, 
        activeWallets: 0, 
        totalTransactions: 0 
    };
};

export const getMyNetworkingProfile = async (token: string) => { const p = requireAuth(token, 'delegate'); return db.find('networking_profiles', np => np.userId === p.id); };
export const updateNetworkingProfile = async (token: string, data: any) => { const p = requireAuth(token, 'delegate'); const ex = await db.find('networking_profiles', np => np.userId === p.id); if(ex) await db.update('networking_profiles', ex.id, data); else await db.insert('networking_profiles', {...data, userId: p.id, id: `np_${p.id}`}); };

export const getNetworkingCandidates = async (token: string) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/delegate/networking/matches', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) return await res.json();
    }
    
    // Offline / Fallback
    const payload = requireAuth(token, 'delegate');
    const myProfile = await db.find('networking_profiles', np => np.userId === payload.id);
    const allCandidates = await db.findAll('networking_profiles', np => np.userId !== payload.id && np.isVisible);
    
    // Basic local tag matching
    const matches: NetworkingMatch[] = [];
    if (myProfile) {
        for (const candidate of allCandidates) {
            const user = await db.find('registrations', r => r.id === candidate.userId);
            const sharedInterests = candidate.interests.filter((i: string) => myProfile.interests.includes(i));
            
            if (sharedInterests.length > 0) {
                matches.push({
                    userId: candidate.userId,
                    name: user?.name || 'Anonymous',
                    jobTitle: candidate.jobTitle,
                    company: candidate.company,
                    score: 50 + (sharedInterests.length * 10), // Simple scoring
                    reason: `You both like ${sharedInterests.join(', ')}`,
                    icebreaker: `Ask about their interest in ${sharedInterests[0]}`,
                    profile: candidate,
                    photoUrl: user?.photoUrl
                });
            }
        }
    }
    
    return { matches, allCandidates: allCandidates.map(c => ({...c, name: 'Candidate'})) };
};

// --- Gamification ---

export const getScavengerHuntItems = async (token: string) => db.findAll('scavenger_hunt_items');
export const saveScavengerHuntItem = async (token: string, i: any) => { if(i.id) await db.update('scavenger_hunt_items', i.id, i); else await db.insert('scavenger_hunt_items', {...i, id: `shi_${Date.now()}`}); };
export const deleteScavengerHuntItem = async (token: string, id: string) => db.remove('scavenger_hunt_items', id);

export const getScavengerHuntProgress = async (token: string) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/delegate/gamification/progress', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) return await res.json();
    }
    // Offline Mock
    const p = requireAuth(token, 'delegate');
    const prog = await db.find('scavenger_hunt_progress', pr => pr.userId === p.id);
    return prog ? prog.foundItemIds : [];
};

export const claimScavengerHuntItem = async (token: string, code: string) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/delegate/gamification/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ code })
        });
        return await res.json();
    }
    // Offline Mock - Minimal implementation, just says success
    return { success: true, message: 'Found! (Mock Mode)' };
};

export const getScavengerHuntLeaderboard = async (token: string) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/gamification/leaderboard', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) return await res.json();
    }
    return [];
};

export const getVenueMaps = async (token: string) => db.findAll('venue_maps');
export const saveVenueMap = async (token: string, m: any) => { if(m.id) await db.update('venue_maps', m.id, m); else await db.insert('venue_maps', {...m, id: `vm_${Date.now()}`}); };
export const deleteVenueMap = async (token: string, id: string) => db.remove('venue_maps', id);

export const getMediaLibrary = async (token: string) => db.findAll('media');
export const uploadFile = async (file: File) => uploadFileToStorage(file);
export const deleteMedia = async (token: string, id: string) => db.remove('media', id);

export const getEmailLogs = async (token: string) => db.findAll('email_logs');
export const sendBroadcast = async (token: string, s: string, b: string, t: string, c: string) => { 
    if (IS_ONLINE) {
        return fetch('/api/admin/communications/broadcast', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
            body: JSON.stringify({ subject: s, body: b, target: t, channel: c })
        }).then(r => r.json());
    }
    // Update offline simulation to log channel correctly
    await db.insert('email_logs', {id: `el_${Date.now()}`, subject: `${c.toUpperCase()}: ${s}`, body: b, to: t, status: 'sent', timestamp: Date.now()}); 
    return { success: true, message: `Sent via ${c} (Mock)` }; 
};
export const sendTestEmail = async (token: string, to: string, config: any) => { 
    if (IS_ONLINE) {
        await fetch('/api/admin/communications/send', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
            body: JSON.stringify({ to, config })
        });
    } else {
        await emailService.sendEmail({to, subject: 'Test', body: 'Test'}, config); 
    }
};

export const sendTestMessage = async (token: string, channel: 'email' | 'sms' | 'whatsapp' | 'telegram', to: string, config: any) => {
    if (IS_ONLINE) {
        await fetch('/api/admin/communications/test', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
            body: JSON.stringify({ to, channel, config })
        });
    } else {
        // Offline Mock
        if (channel === 'email') {
            await emailService.sendEmail({to, subject: 'Test', body: 'Test'}, config);
        } else {
            console.log(`[Test ${channel.toUpperCase()}] Sending to ${to}...`);
            await new Promise(r => setTimeout(r, 500));
        }
    }
};

export const getNotifications = async (token: string) => { const p = requireAuth(token, 'delegate'); return db.findAll('notifications', n => n.userId === p.id); };
export const markNotificationRead = async (token: string, id: string) => db.update('notifications', id, { read: true });
export const clearAllNotifications = async (token: string) => { const p = requireAuth(token, 'delegate'); await db.updateWhere('notifications', n => n.userId === p.id, { read: true }); };

// --- Chat ---
export const getConversations = async (token: string) => {
    const payload = requireAuth(token, 'delegate');
    const messages = await db.findAll('messages', m => m.senderId === payload.id || m.receiverId === payload.id);
    const userIds = new Set<string>();
    messages.forEach(m => {
        if (m.senderId !== payload.id) userIds.add(m.senderId);
        if (m.receiverId !== payload.id) userIds.add(m.receiverId);
    });
    const users = await db.findAll('registrations', u => userIds.has(u.id));
    return Array.from(userIds).map(uid => {
        const lastMsg = messages.filter(m => m.senderId === uid || m.receiverId === uid).sort((a, b) => b.timestamp - a.timestamp)[0];
        const unread = messages.filter(m => m.senderId === uid && m.receiverId === payload.id && !m.read).length;
        return {
            withUserId: uid,
            withUserName: users.find(u => u.id === uid)?.name || 'Unknown',
            lastMessage: lastMsg?.content || '',
            lastTimestamp: lastMsg?.timestamp || 0,
            unreadCount: unread
        };
    });
};

export const getMessages = async (token: string, withUserId: string) => {
    const payload = requireAuth(token, 'delegate');
    return db.findAll('messages', m => (m.senderId === payload.id && m.receiverId === withUserId) || (m.senderId === withUserId && m.receiverId === payload.id));
};

export const sendMessage = async (token: string, toUserId: string, content: string) => {
    const payload = requireAuth(token, 'delegate');
    const message = {
        id: `msg_${Date.now()}`,
        senderId: payload.id,
        receiverId: toUserId,
        content,
        timestamp: Date.now(),
        read: false
    };
    
    // In real WebSocket setup, we emit the event
    if (IS_ONLINE && socket) {
        socket.emit('chat:send', message);
    } else {
        await db.insert('messages', message);
    }
};

// --- Video ---
export const sendSignal = async (token: string, toUserId: string, type: string, data: any) => {
    const payload = requireAuth(token, 'delegate');
    if (socket) {
        socket.emit('signal', { to: toUserId, type, data, senderId: payload.id });
    }
};

export const subscribeToSignals = (callback: (payload: any) => void) => {
    if (!socket) {
        // Fallback for offline local signaling if needed, though WebRTC usually needs network
        // For local demo, we can use BroadcastChannel
        const localChannel = new BroadcastChannel('webrtc_signals');
        const handler = (e: MessageEvent) => callback(e.data);
        localChannel.addEventListener('message', handler);
        return () => localChannel.removeEventListener('message', handler);
    }
    
    const handler = (payload: any) => callback(payload);
    socket.on('signal', handler);
    return () => {
        socket?.off('signal', handler);
    };
};

// --- AI Wrappers ---
export const generateMarketingVideo = async (prompt: string, imageBase64?: string) => geminiService.generateMarketingVideo(prompt, imageBase64);
export const researchEntity = async (token: string, type: 'speaker' | 'sponsor', name: string) => {
    if (IS_ONLINE) {
        const res = await fetch('/api/admin/ai/research', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type, name })
        });
        if (!res.ok) throw new Error("Research failed");
        return await res.json();
    }
    return geminiService.researchEntity(type, name);
};
export const generateAiContent = async (type: any, context: any) => geminiService.generateAiContent(type, context);
export const generateImage = async (prompt: string) => geminiService.generateImage(prompt);
export const getEventContextForAI = async (token: string) => {
    const config = await getEventConfig();
    const sessions = await db.findAll('sessions');
    return `Event: ${config.event.name}. Date: ${config.event.date}. Sessions: ${sessions.map(s => s.title).join(', ')}`;
};
